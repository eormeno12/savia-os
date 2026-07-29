import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { OtpService } from '../src/modules/auth/otp.service';
import { PrismaService } from '../src/common/clients/prisma.service';
import { MercadoPagoPort } from '../src/modules/billing/mercadopago.port';

// Fake MP: any preapproval id resolves to an authorized subscription whose
// external_reference IS the id (so we pass the userId as the data.id).
const fakeMp: Partial<MercadoPagoPort> = {
  async getPreapproval(id: string) {
    return { id, status: 'authorized', externalRef: id, amount: 11.99, currency: 'USD', nextPaymentAt: null };
  },
};

describe('billing enforcement e2e', () => {
  let app: INestApplication;
  let otp: OtpService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MercadoPagoPort)
      .useValue(fakeMp)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    otp = app.get(OtpService);
    prisma = app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string> {
    const code = await otp.generateAndSave(email);
    const res = await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200);
    return (res.get('Set-Cookie') as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
  }

  it('a free user cannot connect an AI; the webhook upgrades them; then they can', async () => {
    const email = `bill_${Date.now()}@e2e.test`;
    const cookie = await login(email);
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    const http = () => request(app.getHttpServer());

    // Free → 403 (server-side freemium, not a modal).
    await http().post('/connections').set('Cookie', cookie).send({ label: 'Claude' }).expect(403);
    await http().get('/growth/access-activity').set('Cookie', cookie).expect(403);

    // Webhook authorizes the subscription → User.plan = pro.
    await http()
      .post('/webhooks/mercadopago')
      .set('x-request-id', `req-${Date.now()}`)
      .send({ type: 'subscription_preapproval', data: { id: userId } })
      .expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('pro');

    // Now Pro → 201.
    await http().post('/connections').set('Cookie', cookie).send({ label: 'Claude' }).expect(201);
    await http().get('/growth/access-activity').set('Cookie', cookie).expect(200);
  }, 30_000);

  it('a duplicate webhook is idempotent (not reprocessed)', async () => {
    const email = `idem_${Date.now()}@e2e.test`;
    await login(email);
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    const requestId = `req-idem-${Date.now()}`;
    const http = () => request(app.getHttpServer());
    const body = { type: 'subscription_preapproval', data: { id: userId } };

    await http().post('/webhooks/mercadopago').set('x-request-id', requestId).send(body).expect(200);
    await http().post('/webhooks/mercadopago').set('x-request-id', requestId).send(body).expect(200);

    const events = await prisma.webhookEvent.count({ where: { id: `${userId}:${requestId}` } });
    expect(events).toBe(1); // the second delivery did not create a new event
  }, 30_000);
});
