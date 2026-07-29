import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { OutboxModule } from '../src/modules/outbox/outbox.module';
import { OutboxRelay } from '../src/modules/outbox/outbox-relay';
import { OtpService } from '../src/modules/auth/otp.service';

/**
 * Proves the write path end-to-end against the live stack (Postgres + Qdrant +
 * OpenAI via mem0): add → write-kernel ($transaction + outbox) → OutboxRelay
 * applies savia_* payload to Qdrant → search returns it, filtered by access.
 * Makes real (cheap) OpenAI calls — gated behind TEST_E2E.
 */
describe('memory pipeline e2e', () => {
  let app: INestApplication;
  let relay: OutboxRelay;
  let otp: OtpService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, OutboxModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    relay = app.get(OutboxRelay);
    otp = app.get(OtpService);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string> {
    const code = await otp.generateAndSave(email);
    const res = await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200);
    return (res.get('Set-Cookie') as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
  }

  it('remembers a fact and finds it back through hybrid search', async () => {
    const cookie = await login(`pipe_${Date.now()}@e2e.test`);

    const added = await request(app.getHttpServer())
      .post('/memory')
      .set('Cookie', cookie)
      .send({ text: 'Mi proyecto se llama Savia y usa Qdrant como vector store.' })
      .expect(201);
    expect(added.body.stored).toBeGreaterThan(0);

    // Flush the outbox so savia_* payload lands in Qdrant.
    await relay.processBatch();

    const found = await request(app.getHttpServer())
      .post('/memory/search')
      .set('Cookie', cookie)
      .send({ query: '¿qué vector store usa mi proyecto?', limit: 5 })
      .expect(200);

    expect(Array.isArray(found.body)).toBe(true);
    expect(found.body.length).toBeGreaterThan(0);
    expect(found.body[0]).toHaveProperty('areaIds');
  }, 60_000);
});
