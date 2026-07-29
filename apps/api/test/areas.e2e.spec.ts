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

describe('areas e2e', () => {
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

  it('creates an area, routes a memory into it, and lists it with hydrated text', async () => {
    const cookie = await login(`area_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const area = (
      await http()
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Notas sobre el proyecto Savia y su infraestructura Qdrant' })
        .expect(201)
    ).body;
    expect(area.id).toBeTruthy();
    expect(area.depth).toBe(1);

    const text = 'Savia indexa la memoria en Qdrant usando embeddings de OpenAI.';
    await http().post('/memory').set('Cookie', cookie).send({ text, areaId: area.id }).expect(201);
    await relay.processBatch();

    const page = (await http().get(`/areas/${area.id}/memories`).set('Cookie', cookie).expect(200)).body;
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items[0].text.length).toBeGreaterThan(0); // hydrated from Qdrant, not ''
    expect(page.items[0].areaIds).toContain(area.id);

    const tree = (await http().get('/areas/tree').set('Cookie', cookie).expect(200)).body;
    const found = JSON.stringify(tree).includes(area.id);
    expect(found).toBe(true);
  }, 60_000);

  it('allows deep nesting (no cap); rename re-paths descendants; editing pins governance', async () => {
    const cookie = await login(`depth_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    // Build a 4-level chain — the old hard cap of 3 would have rejected the 4th.
    const top = (await http().post('/areas').set('Cookie', cookie).send({ description: 'nivel uno' }).expect(201)).body;
    let node = top;
    for (const [i, d] of ['nivel dos', 'nivel tres', 'nivel cuatro'].entries()) {
      node = (
        await http().post('/areas').set('Cookie', cookie).send({ description: d, parentId: node.id }).expect(201)
      ).body;
      expect(node.depth).toBe(i + 2); // 2, 3, 4 — no cap
    }
    const deepId = node.id;

    // Rename the top → its descendants' materialized paths must update (reindex).
    const edited = (
      await http().patch(`/areas/${top.id}`).set('Cookie', cookie).send({ name: 'Renombrada' }).expect(200)
    ).body;
    expect(edited.governance).toBe('manual');
    expect(edited.name).toBe('Renombrada');

    const areas = (await http().get('/areas').set('Cookie', cookie).expect(200)).body;
    const deep = areas.find((a: { id: string }) => a.id === deepId);
    expect(deep.depth).toBe(4);
    expect(deep.path).toContain('renombrada'); // descendant re-pathed under the new slug
  }, 60_000);

  it('symmetric CF: an area count drops when its memories are deleted', async () => {
    const cookie = await login(`cf_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());
    const area = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Finanzas personales y presupuesto' }).expect(201)
    ).body;

    const a = (await http().post('/memory').set('Cookie', cookie).send({ text: 'Ahorro 500 dólares por mes.', areaId: area.id }).expect(201)).body;
    await http().post('/memory').set('Cookie', cookie).send({ text: 'Mi alquiler es 800 dólares.', areaId: area.id }).expect(201);
    await relay.processBatch(); // savia_area_ids in Qdrant so cfRemove can read membership

    const countOf = async () =>
      (await http().get('/areas').set('Cookie', cookie).expect(200)).body.find((x: { id: string }) => x.id === area.id).memoryCount;
    const before = await countOf();
    expect(before).toBeGreaterThanOrEqual(a.stored);

    for (const id of a.ids) await http().delete(`/memory/${id}`).set('Cookie', cookie).expect(204);
    expect(await countOf()).toBe(before - a.stored); // CF decremented symmetrically, immediately
  }, 60_000);

  it('disambiguates the path of same-named sibling areas', async () => {
    const cookie = await login(`slug_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());
    const desc = 'Proyecto Qdrant uno';
    const a = (await http().post('/areas').set('Cookie', cookie).send({ description: desc }).expect(201)).body;
    const b = (await http().post('/areas').set('Cookie', cookie).send({ description: desc }).expect(201)).body;

    const areas = (await http().get('/areas').set('Cookie', cookie).expect(200)).body;
    const pa = areas.find((x: { id: string }) => x.id === a.id).path;
    const pb = areas.find((x: { id: string }) => x.id === b.id).path;
    expect(pa).not.toBe(pb); // never two areas with the same path
  }, 60_000);

  it('seeds a personalized area from existing memories: governance flips to manual, CF + multi-membership land', async () => {
    const cookie = await login(`seed_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());

    // The memory starts in an unrelated area — seeding must be ADDITIVE, never replace it.
    const original = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Notas generales de trabajo' }).expect(201)
    ).body;
    const added = (
      await http()
        .post('/memory')
        .set('Cookie', cookie)
        .send({ text: 'Lanzamos un nuevo producto de IA para startups tecnológicas.', areaId: original.id })
        .expect(201)
    ).body;
    await relay.processBatch();

    const preview = (
      await http().post('/memory/search').set('Cookie', cookie).send({ query: 'startups tech', limit: 10 }).expect(200)
    ).body;
    expect(preview.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(added.ids));

    const seeded = (
      await http()
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Startups tech', memoryIds: added.ids })
        .expect(201)
    ).body;
    expect(seeded.governance).toBe('manual'); // curated content at creation pins it
    expect(seeded.memoryCount).toBeGreaterThanOrEqual(added.stored); // CF seeded, not 0

    await relay.processBatch();
    const page = (await http().get(`/areas/${seeded.id}/memories`).set('Cookie', cookie).expect(200)).body;
    const ids = page.items.map((m: { memoryId: string }) => m.memoryId);
    expect(ids).toEqual(expect.arrayContaining(added.ids));
    // Multi-membership: the memory keeps its original area too — seeding never replaces.
    const seededAreaIds = page.items.find((m: { memoryId: string }) => added.ids.includes(m.memoryId)).areaIds;
    expect(seededAreaIds).toContain(seeded.id);
    expect(seededAreaIds).toContain(original.id);
  }, 90_000);

  it('creating without memoryIds stays auto-governed (unchanged default)', async () => {
    const cookie = await login(`noseed_${Date.now()}@e2e.test`);
    const http = () => request(app.getHttpServer());
    const area = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Área vacía sin sembrar' }).expect(201)
    ).body;
    expect(area.governance).toBe('auto');
    expect(area.memoryCount).toBe(0);
  }, 60_000);

  it('deleting an area re-homes its File rows to the parent (no orphan-delete via Cascade)', async () => {
    const email = `filearea_${Date.now()}@e2e.test`;
    const cookie = await login(email);
    const http = () => request(app.getHttpServer());
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const parent = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Carpeta padre' }).expect(201)
    ).body;
    const child = (
      await http()
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Subcarpeta a borrar', parentId: parent.id })
        .expect(201)
    ).body;

    const file = await prisma.file.create({
      data: {
        spaceId: child.id,
        uploaderUserId: userId,
        name: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        s3Key: `users/${userId}/spaces/${child.id}/test-key.pdf`,
        status: 'indexed',
        source: 'upload',
      },
    });

    await http().delete(`/areas/${child.id}`).set('Cookie', cookie).expect(204);

    const survivor = await prisma.file.findUnique({ where: { id: file.id } });
    expect(survivor).not.toBeNull(); // NOT cascade-deleted — Restrict + re-home keeps it alive
    expect(survivor!.spaceId).toBe(parent.id); // re-homed to the parent, not left dangling
  }, 60_000);

  it('deleting an area re-homes its Grant and FragmentShare rows to the parent (no silent access revocation)', async () => {
    const email = `granthomearea_${Date.now()}@e2e.test`;
    const cookie = await login(email);
    const http = () => request(app.getHttpServer());
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const parent = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Carpeta padre con acceso' }).expect(201)
    ).body;
    const child = (
      await http()
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Subcarpeta compartida a borrar', parentId: parent.id })
        .expect(201)
    ).body;

    const connection = await prisma.connection.create({
      data: { userId, label: 'AI de prueba', tokenHash: 'hash', tokenLookup: `lookup-${Date.now()}` },
    });
    const grant = await prisma.grant.create({ data: { connectionId: connection.id, scope: 'space', spaceId: child.id } });

    const group = await prisma.collectiveGroup.create({ data: { name: 'Grupo de prueba' } });
    const fragment = await prisma.fragmentShare.create({ data: { groupId: group.id, userId, spaceId: child.id } });

    await http().delete(`/areas/${child.id}`).set('Cookie', cookie).expect(204);

    const survivingGrant = await prisma.grant.findUnique({ where: { id: grant.id } });
    expect(survivingGrant).not.toBeNull(); // NOT cascade-deleted — re-homed
    expect(survivingGrant!.spaceId).toBe(parent.id);

    const survivingFragment = await prisma.fragmentShare.findUnique({ where: { id: fragment.id } });
    expect(survivingFragment).not.toBeNull();
    expect(survivingFragment!.spaceId).toBe(parent.id);
  }, 60_000);

  it('deleting an area reconciles a colliding Grant to the more permissive includeSensitive, then drops the duplicate', async () => {
    const email = `grantcollide_${Date.now()}@e2e.test`;
    const cookie = await login(email);
    const http = () => request(app.getHttpServer());
    const userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const parent = (
      await http().post('/areas').set('Cookie', cookie).send({ description: 'Carpeta padre ya con grant' }).expect(201)
    ).body;
    const child = (
      await http()
        .post('/areas')
        .set('Cookie', cookie)
        .send({ description: 'Subcarpeta con grant duplicado', parentId: parent.id })
        .expect(201)
    ).body;

    const connection = await prisma.connection.create({
      data: { userId, label: 'AI con dos grants', tokenHash: 'hash', tokenLookup: `lookup-${Date.now()}` },
    });
    // Parent grant is the stricter one; the child's (about to be dropped) is the
    // more permissive — merging must NOT silently narrow what the connection saw.
    await prisma.grant.create({ data: { connectionId: connection.id, scope: 'space', spaceId: parent.id, includeSensitive: false } });
    await prisma.grant.create({ data: { connectionId: connection.id, scope: 'space', spaceId: child.id, includeSensitive: true } });

    await http().delete(`/areas/${child.id}`).set('Cookie', cookie).expect(204); // must not 500 on the unique-index collision

    const remaining = await prisma.grant.findMany({ where: { connectionId: connection.id } });
    expect(remaining).toHaveLength(1); // the duplicate was dropped, not left dangling on a deleted area
    expect(remaining[0].spaceId).toBe(parent.id);
    expect(remaining[0].includeSensitive).toBe(true); // reconciled to the more permissive setting, not silently narrowed
  }, 60_000);
});
