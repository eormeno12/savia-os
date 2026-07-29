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
import { PrismaService } from '../src/common/clients/prisma.service';

/**
 * Pulso revert DoD: every revertible event must restore the PRIOR value, not just
 * flip a flag — sensitivity and move both depend on the kernel snapshotting the
 * before-state into revertPayload (0A review finding: they used to be silently
 * non-revertible because that snapshot was missing).
 */
describe('growth (Pulso) e2e', () => {
  let app: INestApplication;
  let relay: OutboxRelay;
  let otp: OtpService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, OutboxModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    relay = app.get(OutboxRelay);
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

  it('reverts a sensitivity change back to its prior value (not just "reverted")', async () => {
    const cookie = await login(`gs_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const added = (
      await http().post('/memory').set('Cookie', cookie).send({ text: 'Nota de prueba sobre finanzas personales.' }).expect(201)
    ).body;
    const memoryId = added.ids[0];
    await relay.processBatch();

    await http().patch(`/memory/${memoryId}`).set('Cookie', cookie).send({ sensitivity: 'sensitive' }).expect(200);

    const events = (await http().get('/growth/events').set('Cookie', cookie).expect(200)).body;
    const event = events.items.find((e: { action: string; memoryId: string | null }) => e.action === 'sensitivity' && e.memoryId === memoryId);
    expect(event).toBeTruthy();
    expect(event.revertable).toBe(true);

    await http().post(`/growth/events/${event.id}/revert`).set('Cookie', cookie).expect(204);

    const row = await prisma.memoryIndex.findUniqueOrThrow({ where: { memoryId } });
    expect(row.sensitivity).toBe('normal'); // back to the value BEFORE the change, not a hardcoded default

    await http().post(`/growth/events/${event.id}/revert`).set('Cookie', cookie).expect(409); // not twice
  }, 60_000);

  it('reverts a membership move back to the exact prior set of areas', async () => {
    const cookie = await login(`gm_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const areaA = (await http().post('/areas').set('Cookie', cookie).send({ description: 'Área origen del move' }).expect(201)).body;
    const areaB = (await http().post('/areas').set('Cookie', cookie).send({ description: 'Área destino del move' }).expect(201)).body;

    const added = (
      await http().post('/memory').set('Cookie', cookie).send({ text: 'Memoria que se va a mover de área.', areaId: areaA.id }).expect(201)
    ).body;
    const memoryId = added.ids[0];
    await relay.processBatch();

    const before = await prisma.memoryArea.findMany({ where: { memoryId } });
    const beforeSpaceIds = before.map((b) => b.spaceId).sort();
    expect(beforeSpaceIds).toContain(areaA.id);

    await http()
      .patch(`/memory/${memoryId}`)
      .set('Cookie', cookie)
      .send({ addAreas: [areaB.id], removeAreas: [areaA.id] })
      .expect(200);
    const afterMove = await prisma.memoryArea.findMany({ where: { memoryId } });
    expect(afterMove.map((a) => a.spaceId)).toContain(areaB.id);
    expect(afterMove.map((a) => a.spaceId)).not.toContain(areaA.id);

    const events = (await http().get('/growth/events').set('Cookie', cookie).expect(200)).body;
    const event = events.items.find((e: { action: string; memoryId: string | null }) => e.action === 'move' && e.memoryId === memoryId);
    expect(event).toBeTruthy();
    expect(event.revertable).toBe(true);

    await http().post(`/growth/events/${event.id}/revert`).set('Cookie', cookie).expect(204);

    const restored = await prisma.memoryArea.findMany({ where: { memoryId } });
    expect(restored.map((r) => r.spaceId).sort()).toEqual(beforeSpaceIds); // exactly the pre-move set, not just "areaA back"
  }, 60_000);
});
