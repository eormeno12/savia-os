import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { OutboxModule } from '../src/modules/outbox/outbox.module';
import { OutboxRelay } from '../src/modules/outbox/outbox-relay';
import { AccountWorkerModule } from '../src/modules/account/account.worker';
import { OtpService } from '../src/modules/auth/otp.service';
import { PrismaService } from '../src/common/clients/prisma.service';
import { VectorStorePort } from '../src/common/ports/vector-store.port';
import { P } from '../src/common/ports/predicate';

/** Poll GET /jobs/:id until it reaches a terminal status (done/failed). */
async function waitForJob(app: INestApplication, cookie: string, jobId: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = (await request(app.getHttpServer()).get(`/jobs/${jobId}`).set('Cookie', cookie).expect(200)).body;
    if (job.status === 'done' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`job ${jobId} did not finish within ${timeoutMs}ms`);
}

/**
 * account_delete can't be polled via GET /jobs/:id like other jobs: a
 * successful delete cascades away both the caller's session (AuthSession)
 * and the Job row itself (Job.userId -> User is onDelete:Cascade), so by the
 * time it'd read 'done' the polling cookie is already invalid. Poll the
 * actual outcome (the User row) directly instead.
 */
async function waitForAccountGone(prisma: PrismaService, userId: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await prisma.user.findUnique({ where: { id: userId } }))) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`account ${userId} was not deleted within ${timeoutMs}ms`);
}

describe('account deletion e2e', () => {
  let app: INestApplication;
  let relay: OutboxRelay;
  let otp: OtpService;
  let prisma: PrismaService;
  let vectors: VectorStorePort;

  beforeAll(async () => {
    // AccountWorkerModule alongside AppModule so account_delete really runs
    // against the dev Redis (same pattern as OutboxModule above) — no need to
    // hand-invoke the worker's process() method.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, OutboxModule, AccountWorkerModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    relay = app.get(OutboxRelay);
    otp = app.get(OtpService);
    prisma = app.get(PrismaService);
    vectors = app.get(VectorStorePort);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('purges Postgres AND Qdrant on account delete', async () => {
    const email = `del_${Date.now()}@e2e.test`;
    const code = await otp.generateAndSave(email);
    const cookie = (
      await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200)
    )
      .get('Set-Cookie')!
      .map((c) => c.split(';')[0])
      .join('; ');

    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    const added = await request(app.getHttpServer())
      .post('/memory')
      .set('Cookie', cookie)
      .send({ text: 'Trabajo como ingeniero de software en una startup de IA en Buenos Aires.' })
      .expect(201);
    expect(added.body.stored).toBeGreaterThan(0);
    await relay.processBatch(); // savia_* payload now in Qdrant

    const before = await vectors.scroll(P.author(userId), { limit: 50 });
    expect(before.points.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).post('/account/delete').set('Cookie', cookie).expect(201);
    await waitForAccountGone(prisma, userId);

    // Postgres: user gone (cascade).
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.memoryIndex.count({ where: { authorUserId: userId } })).toBe(0);
    // Qdrant: no points for this user.
    const after = await vectors.scroll(P.author(userId), { limit: 50 });
    expect(after.points.length).toBe(0);
  }, 60_000);

  it('deleting an account with a File does not 500 (File.spaceId is now Restrict, not Cascade)', async () => {
    const email = `delfile_${Date.now()}@e2e.test`;
    const code = await otp.generateAndSave(email);
    const cookie = (await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200))
      .get('Set-Cookie')!
      .map((c) => c.split(';')[0])
      .join('; ');
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const area = (
      await request(app.getHttpServer())
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Área con un archivo' })
        .expect(201)
    ).body;
    const file = await prisma.file.create({
      data: {
        spaceId: area.id,
        uploaderUserId: userId,
        name: 'acct.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512,
        s3Key: `users/${userId}/spaces/${area.id}/acct-key.pdf`,
        status: 'indexed',
        source: 'upload',
      },
    });

    // Without the explicit file.deleteMany() in AccountService.delete(), the
    // User→Space→File cascade can no longer reach File (Restrict), and the
    // worker would keep retrying a delete that always throws on that FK.
    await request(app.getHttpServer()).post('/account/delete').set('Cookie', cookie).expect(201);
    await waitForAccountGone(prisma, userId);

    expect(await prisma.file.findUnique({ where: { id: file.id } })).toBeNull();
  }, 60_000);

  it('account_export uploads (or embeds) a real JSON export, not a placeholder marker', async () => {
    const email = `exp_${Date.now()}@e2e.test`;
    const code = await otp.generateAndSave(email);
    const cookie = (await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200))
      .get('Set-Cookie')!
      .map((c) => c.split(';')[0])
      .join('; ');

    await request(app.getHttpServer())
      .post('/memory')
      .set('Cookie', cookie)
      .send({ text: 'Vivo en Córdoba y trabajo remoto para una empresa de EE.UU.' })
      .expect(201);
    await relay.processBatch();

    const { jobId } = (await request(app.getHttpServer()).post('/account/export').set('Cookie', cookie).expect(201)).body;
    const job = await waitForJob(app, cookie, jobId);
    expect(job.status).toBe('done');
    expect(job.resultRef).toBeTruthy();
    expect(job.resultRef).not.toMatch(/^export:\d+ memories$/); // the old placeholder shape

    if (job.resultRef.startsWith('http')) {
      // S3 enabled in this environment: resultRef is a real presigned download.
      const res = await fetch(job.resultRef);
      expect(res.ok).toBe(true);
      const payload = await res.json();
      expect(Array.isArray(payload.memories)).toBe(true);
    } else {
      // S3 disabled (this dev environment): dev fallback embeds the JSON directly.
      const payload = JSON.parse(job.resultRef);
      expect(Array.isArray(payload.memories)).toBe(true);
      expect(payload.memories.length).toBeGreaterThan(0);
    }
  }, 60_000);
});
