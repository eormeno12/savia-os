import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { PrismaService } from '../src/common/clients/prisma.service';
import { OtpService } from '../src/modules/auth/otp.service';
import { AreasService } from '../src/modules/areas/areas.service';

/**
 * Integration proof of the FASE-1/2 headline guarantees against the live dev
 * stack (Postgres/Redis). Run with `pnpm test:e2e`. Memories are created directly
 * (no OpenAI) so the test is fast and deterministic.
 */
describe('security e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otp: OtpService;
  let areas: AreasService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    otp = app.get(OtpService);
    areas = app.get(AreasService);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string[]> {
    const code = await otp.generateAndSave(email);
    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ email, code })
      .expect(200);
    return res.get('Set-Cookie') as unknown as string[];
  }

  const cookieHeader = (cookies: string[]) => cookies.map((c) => c.split(';')[0]).join('; ');
  const pick = (cookies: string[], name: string) =>
    cookies.find((c) => c.startsWith(`${name}=`))?.split(';')[0] ?? '';

  it('IDOR: user B cannot delete user A’s memory (403/404), A can (204)', async () => {
    const a = `a_${Date.now()}@e2e.test`;
    const b = `b_${Date.now()}@e2e.test`;
    const aCookies = await login(a);
    const bCookies = await login(b);

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: a } });
    const general = await areas.ensureGeneral(userA.id);
    const memoryId = `e2e-mem-${Date.now()}`;
    await prisma.memoryIndex.create({
      data: {
        memoryId,
        authorUserId: userA.id,
        source: 'manual',
        areas: { create: [{ spaceId: general.id }] }, // membership en MemoryArea (verdad)
      },
    });

    await request(app.getHttpServer())
      .delete(`/memory/${memoryId}`)
      .set('Cookie', cookieHeader(bCookies))
      .expect((res) => {
        if (![403, 404].includes(res.status)) throw new Error(`expected 403/404, got ${res.status}`);
      });

    await request(app.getHttpServer())
      .delete(`/memory/${memoryId}`)
      .set('Cookie', cookieHeader(aCookies))
      .expect(204);
  });

  it('refresh rotates; a concurrent reuse WITHIN the grace window is tolerated', async () => {
    const cookies = await login(`r_${Date.now()}@e2e.test`);
    const r1 = pick(cookies, 'refresh_token');

    const rotated = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r1).expect(200);
    const r2 = pick(rotated.get('Set-Cookie') as unknown as string[], 'refresh_token');
    expect(r2).not.toEqual(r1);

    // Immediate reuse of r1 = benign concurrent refresh (two tabs) → tolerated, family intact.
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r1).expect(200);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r2).expect(200);
  });

  it('reuse of a STALE (beyond-grace) rotated token burns the family', async () => {
    const email = `rt_${Date.now()}@e2e.test`;
    const cookies = await login(email);
    const r1 = pick(cookies, 'refresh_token');
    const rotated = await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r1).expect(200);
    const r2 = pick(rotated.get('Set-Cookie') as unknown as string[], 'refresh_token');

    // Backdate r1's (now-revoked) session beyond the grace window → genuine theft.
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    await prisma.authSession.updateMany({
      where: { userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r1).expect(401); // theft detected
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', r2).expect(401); // family burned
  });

  it('logout denylists the access token immediately', async () => {
    const email = `l_${Date.now()}@e2e.test`;
    const cookies = await login(email);
    const access = pick(cookies, 'access_token');

    await request(app.getHttpServer()).get('/auth/me').set('Cookie', access).expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookieHeader(cookies))
      .expect(200);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', access).expect(401);
  });

  it('sets displayName at onboarding and /me reflects it (+ plan)', async () => {
    const cookies = await login(`prof_${Date.now()}@e2e.test`);
    const auth = cookieHeader(cookies);

    const before = await request(app.getHttpServer()).get('/auth/me').set('Cookie', auth).expect(200);
    expect(before.body.displayName).toBeNull();
    expect(before.body.plan).toBe('free');

    await request(app.getHttpServer())
      .post('/onboarding/profile')
      .set('Cookie', auth)
      .send({ displayName: '  Ada Lovelace  ' })
      .expect(201);

    const after = await request(app.getHttpServer()).get('/auth/me').set('Cookie', auth).expect(200);
    expect(after.body.displayName).toBe('Ada Lovelace'); // trimmed
  });
});
