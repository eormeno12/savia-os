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
 * Lens DoD: a lens attracts memories by similarity ACROSS area boundaries (it's
 * not bound to one Space); sourceAreaIds clamps the surface when set. Lens is
 * 100% personal, always-live (no curation, no dashboard exposure) — it never
 * crosses an access boundary (no Grant scope, no FragmentShare source); see
 * collective.service.ts for the "share my similar part" flow that contributes a
 * derived, persisted Space instead of pinning exceptions on a live query.
 */
describe('lenses e2e', () => {
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

  it('attracts memories across areas by similarity, not by routing', async () => {
    const cookie = await login(`lens_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const platform = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Infraestructura de la plataforma' }).expect(201)
    ).body;
    const marketing = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Campañas de marketing' }).expect(201)
    ).body;

    const onTopicA = (
      await http()
        .post('/memory')
        .set('Cookie', cookie)
        .send({ text: 'Desplegamos los microservicios del backend en Kubernetes con Helm.', areaId: platform.id })
        .expect(201)
    ).body;
    const onTopicB = (
      await http()
        .post('/memory')
        .set('Cookie', cookie)
        .send({ text: 'El equipo de Marketing también corre sus pipelines de email sobre Kubernetes.', areaId: marketing.id })
        .expect(201)
    ).body;
    await http()
      .post('/memory')
      .set('Cookie', cookie)
      .send({ text: 'Compré café y medialunas para la oficina.', areaId: platform.id })
      .expect(201);
    await relay.processBatch();

    const lens = (
      await http()
        .post('/lenses')
        .set('Cookie', cookie)
        .send({ name: 'Microservicios', query: 'Arquitectura de microservicios en Kubernetes' })
        .expect(201)
    ).body;

    const memories = (await http().get(`/lenses/${lens.id}/memories`).set('Cookie', cookie).expect(200)).body;
    const ids = memories.map((m: { id: string }) => m.id);
    expect(ids).toEqual(expect.arrayContaining([...onTopicA.ids, ...onTopicB.ids])); // cross-area
    expect(memories.every((m: { text: string }) => !m.text.includes('café'))); // off-topic stays out
  }, 90_000);

  it('sourceAreaIds clamps the surface to a subtree', async () => {
    const cookie = await login(`lensclamp_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const platform = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Infraestructura técnica' }).expect(201)
    ).body;
    const marketing = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Campañas y growth' }).expect(201)
    ).body;

    const inScope = (
      await http()
        .post('/memory')
        .set('Cookie', cookie)
        .send({ text: 'Migramos la base de datos de Postgres a una instancia más grande.', areaId: platform.id })
        .expect(201)
    ).body;
    const outOfScope = (
      await http()
        .post('/memory')
        .set('Cookie', cookie)
        .send({ text: 'Migramos el dashboard de growth a una base de datos Postgres dedicada.', areaId: marketing.id })
        .expect(201)
    ).body;
    await relay.processBatch();

    const lens = (
      await http()
        .post('/lenses')
        .set('Cookie', cookie)
        .send({ name: 'Solo plataforma', query: 'Migración de base de datos Postgres', sourceAreaIds: [platform.id] })
        .expect(201)
    ).body;

    const memories = (await http().get(`/lenses/${lens.id}/memories`).set('Cookie', cookie).expect(200)).body;
    const ids = memories.map((m: { id: string }) => m.id);
    expect(ids).toEqual(expect.arrayContaining(inScope.ids));
    expect(ids).not.toEqual(expect.arrayContaining(outOfScope.ids));
  }, 90_000);
});
