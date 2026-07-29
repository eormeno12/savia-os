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
 * Federation DoD: a shared fragment surfaces in the union view; leaving removes
 * the fragment but keeps the memories; sensitive never flows without opt-in;
 * a group never ends up adminless (heir promoted, or closed if it'd be empty).
 */
describe('federation e2e', () => {
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

  it('shares a fragment into a group, the union view sees it, leaving removes it', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`fa_${stamp}@e2e.test`);
    const memberEmail = `fb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    // Admin creates a group and invites the member.
    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Proyecto X' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    // Member creates an area + memory, shares the area as a fragment.
    const area = (
      await http().post('/areas').set('Cookie', memberCookie).send({ description: 'Investigación sobre Qdrant para Proyecto X' }).expect(201)
    ).body;
    await http()
      .post('/memory')
      .set('Cookie', memberCookie)
      .send({ text: 'Proyecto X usa Qdrant con HNSW para la búsqueda vectorial.', areaId: area.id })
      .expect(201);
    await relay.processBatch();
    await http().post(`/groups/${group.id}/fragments`).set('Cookie', memberCookie).send({ areaId: area.id }).expect(201);

    // Admin's union view sees the member's shared memory.
    const view = (
      await http().get(`/groups/${group.id}/memories?q=${encodeURIComponent('qué usa Proyecto X')}`).set('Cookie', adminCookie).expect(200)
    ).body;
    expect(Array.isArray(view)).toBe(true);
    expect(view.length).toBeGreaterThan(0);

    // Member leaves → fragment gone → union empty; their memory still theirs.
    await http().post(`/groups/${group.id}/leave`).set('Cookie', memberCookie).expect(204);
    const afterLeave = (await http().get(`/groups/${group.id}/memories?q=Qdrant`).set('Cookie', adminCookie).expect(200)).body;
    expect(afterLeave.length).toBe(0);

    // The memory still belongs to the (former) member.
    const stillMine = (
      await http().post('/memory/search').set('Cookie', memberCookie).send({ query: 'Qdrant', limit: 5 }).expect(200)
    ).body;
    expect(stillMine.length).toBeGreaterThan(0);
  }, 90_000);

  it('promotes the oldest remaining member when the sole admin leaves', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ga_${stamp}@e2e.test`);
    const memberEmail = `gb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Sin techo' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    // The sole admin leaves — the group must not freeze: the remaining member is promoted.
    await http().post(`/groups/${group.id}/leave`).set('Cookie', adminCookie).expect(204);
    const asNewAdmin = (await http().get(`/groups/${group.id}`).set('Cookie', memberCookie).expect(200)).body;
    expect(asNewAdmin.role).toBe('admin');

    // The new admin can now do admin-only things (e.g. invite).
    await http()
      .post(`/groups/${group.id}/invites`)
      .set('Cookie', memberCookie)
      .send({ email: `gc_${stamp}@e2e.test`, role: 'viewer' })
      .expect(201);
  }, 60_000);

  it('closes the group when its last member (the sole admin) leaves', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`gd_${stamp}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Solo yo' }).expect(201)).body;
    await http().post(`/groups/${group.id}/leave`).set('Cookie', adminCookie).expect(204);

    const row = await prisma.collectiveGroup.findUnique({ where: { id: group.id } });
    expect(row).toBeNull();
  }, 60_000);

  it('demoting the sole admin promotes the oldest remaining member instead of leaving it adminless', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ge_${stamp}@e2e.test`);
    const memberEmail = `gf_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Autodegradación' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'viewer' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    // The sole admin demotes themselves to viewer — the group must not end up with 0 admins.
    await http()
      .patch(`/groups/${group.id}/members/${(await prisma.user.findFirstOrThrow({ where: { email: `ge_${stamp}@e2e.test` } })).id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'viewer' })
      .expect(204);

    const asPromoted = (await http().get(`/groups/${group.id}`).set('Cookie', memberCookie).expect(200)).body;
    expect(asPromoted.role).toBe('admin');
  }, 60_000);

  it('"compartir mi parte similar": B previews+confirms a match against A\'s fragment, creating a personalized area and sharing it back', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ma_${stamp}@e2e.test`);
    const memberEmail = `mb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    // A shares an area about "Startups tech".
    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Tema compartido' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    const aArea = (
      await http().post('/areas').set('Cookie', adminCookie).send({ description: 'Startups tech y aceleradoras' }).expect(201)
    ).body;
    await http()
      .post('/memory')
      .set('Cookie', adminCookie)
      .send({ text: 'Y Combinator anunció su nuevo batch de invierno con foco en IA.', areaId: aArea.id })
      .expect(201);
    await relay.processBatch();
    const fragment = (
      await http().post(`/groups/${group.id}/fragments`).set('Cookie', adminCookie).send({ areaId: aArea.id }).expect(201)
    ).body;

    // B has their own, unrelated memory about the same topic.
    const bAdded = (
      await http()
        .post('/memory')
        .set('Cookie', memberCookie)
        .send({ text: 'Lanzamos un producto de IA para startups tecnológicas en etapa temprana.' })
        .expect(201)
    ).body;
    await relay.processBatch();

    // B previews — candidates come ONLY from B's own memory, never A's.
    const preview = (
      await http().get(`/groups/${group.id}/fragments/${fragment.id}/match-preview`).set('Cookie', memberCookie).expect(200)
    ).body;
    expect(Array.isArray(preview)).toBe(true);
    expect(preview.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(bAdded.ids));

    // B confirms with shareBack — gets their own personalized area AND it lands in the group.
    const confirmed = (
      await http()
        .post(`/groups/${group.id}/fragments/${fragment.id}/match-confirm`)
        .set('Cookie', memberCookie)
        .send({ description: 'Mi parte de startups tech', memoryIds: bAdded.ids, shareBack: true })
        .expect(201)
    ).body;
    expect(confirmed.governance).toBe('manual');

    const fragmentsAfter = (
      await http().get(`/groups/${group.id}/fragments`).set('Cookie', memberCookie).expect(200)
    ).body;
    expect(fragmentsAfter.some((f: { spaceId: string; userId: string }) => f.spaceId === confirmed.id && f.userId)).toBe(true);
  }, 90_000);

  it('match-preview never returns content from another partition — only the viewer\'s own', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`mc_${stamp}@e2e.test`);
    const memberEmail = `md_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Aislamiento' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'viewer' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    const aArea = (
      await http().post('/areas').set('Cookie', adminCookie).send({ description: 'Recetas de cocina veganas' }).expect(201)
    ).body;
    const aAdded = (
      await http()
        .post('/memory')
        .set('Cookie', adminCookie)
        .send({ text: 'Receta de hamburguesas veganas con lentejas y remolacha.', areaId: aArea.id })
        .expect(201)
    ).body;
    await relay.processBatch();
    const fragment = (
      await http().post(`/groups/${group.id}/fragments`).set('Cookie', adminCookie).send({ areaId: aArea.id }).expect(201)
    ).body;

    // B (viewer, no memories of their own on this topic) previews — must never see A's memory ids.
    const preview = (
      await http().get(`/groups/${group.id}/fragments/${fragment.id}/match-preview`).set('Cookie', memberCookie).expect(200)
    ).body;
    const previewIds = preview.map((m: { id: string }) => m.id);
    expect(previewIds).not.toEqual(expect.arrayContaining(aAdded.ids));
  }, 60_000);

  it('rejects accepting an invite that is expired, already accepted, or addressed to a different email', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ha_${stamp}@e2e.test`);
    const memberEmail = `hb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const strangerCookie = await login(`hc_${stamp}@e2e.test`);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Expira' }).expect(201)).body;

    // Wrong email: a different logged-in user can't accept someone else's invite.
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'viewer' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', strangerCookie).expect(403);

    // Already accepted: accepting twice fails the second time.
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(401);

    // Expired: backdate expiresAt directly, then accepting fails.
    const expiredEmail = `hd_${stamp}@e2e.test`;
    const expiredCookie = await login(expiredEmail);
    const expiredInvite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: expiredEmail, role: 'viewer' }).expect(201)
    ).body;
    await prisma.groupInvite.updateMany({
      where: { groupId: group.id, email: expiredEmail },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().post(`/invites/${expiredInvite.token}/accept`).set('Cookie', expiredCookie).expect(401);
  }, 60_000);

  it("GET /invites lists only the caller's own pending invites — not accepted, expired, or someone else's", async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ia_${stamp}@e2e.test`);
    const memberEmail = `ib_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Bandeja' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;

    // A second, already-expired invite to the same person must not show up.
    const otherGroup = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Vencido' }).expect(201)).body;
    await http().post(`/groups/${otherGroup.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'viewer' }).expect(201);
    await prisma.groupInvite.updateMany({
      where: { groupId: otherGroup.id, email: memberEmail },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const pending = (await http().get('/invites').set('Cookie', memberCookie).expect(200)).body;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ groupId: group.id, groupName: 'Bandeja', role: 'contributor' });
    expect(pending[0].token).toBeUndefined();

    // The admin (not the invitee) sees nothing addressed to them.
    expect((await http().get('/invites').set('Cookie', adminCookie).expect(200)).body).toEqual([]);

    // Accepting removes it from the inbox.
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);
    expect((await http().get('/invites').set('Cookie', memberCookie).expect(200)).body).toEqual([]);
  }, 60_000);

  it('re-inviting the same email replaces the still-pending invite instead of accumulating rows', async () => {
    const stamp = Date.now();
    const adminCookie = await login(`ja_${stamp}@e2e.test`);
    const memberEmail = `jb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Reinvitar' }).expect(201)).body;
    const firstInvite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'viewer' }).expect(201)
    ).body;
    const secondInvite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;

    expect(await prisma.groupInvite.count({ where: { groupId: group.id, email: memberEmail } })).toBe(1);
    await http().post(`/invites/${firstInvite.token}/accept`).set('Cookie', memberCookie).expect(401); // stale token, replaced
    await http().post(`/invites/${secondInvite.token}/accept`).set('Cookie', memberCookie).expect(200);
  }, 60_000);

  it("R4: a member's sensitive memory only reaches the group view when they share the fragment with includeSensitive", async () => {
    const stamp = Date.now();
    const adminCookie = await login(`sa_${stamp}@e2e.test`);
    const memberEmail = `sb_${stamp}@e2e.test`;
    const memberCookie = await login(memberEmail);
    const http = () => request(app.getHttpServer());

    const group = (await http().post('/groups').set('Cookie', adminCookie).send({ name: 'Sensible' }).expect(201)).body;
    const invite = (
      await http().post(`/groups/${group.id}/invites`).set('Cookie', adminCookie).send({ email: memberEmail, role: 'contributor' }).expect(201)
    ).body;
    await http().post(`/invites/${invite.token}/accept`).set('Cookie', memberCookie).expect(200);

    // Member's area has a NORMAL and a SENSITIVE memory.
    const area = (
      await http().post('/areas').set('Cookie', memberCookie).send({ description: 'Finanzas personales del proyecto' }).expect(201)
    ).body;
    await http()
      .post('/memory')
      .set('Cookie', memberCookie)
      .send({ text: 'El presupuesto público del proyecto es de 50 mil dólares.', areaId: area.id })
      .expect(201);
    const secret = (
      await http()
        .post('/memory')
        .set('Cookie', memberCookie)
        .send({ text: 'Mi salario personal confidencial es de 120 mil dólares al año.', areaId: area.id })
        .expect(201)
    ).body;
    await http().patch(`/memory/${secret.ids[0]}`).set('Cookie', memberCookie).send({ sensitivity: 'sensitive' }).expect(204);
    await relay.processBatch();

    // Shared WITHOUT opt-in (default): the sensitive memory must NOT reach the admin's view…
    const frag = (
      await http().post(`/groups/${group.id}/fragments`).set('Cookie', memberCookie).send({ areaId: area.id }).expect(201)
    ).body;
    expect(frag.includeSensitive).toBe(false);
    const gated = (
      await http().get(`/groups/${group.id}/memories?q=${encodeURIComponent('salario confidencial')}`).set('Cookie', adminCookie).expect(200)
    ).body;
    expect(gated.every((m: { text: string }) => !m.text.includes('salario'))).toBe(true);
    // …but the normal memory in the SAME shared area still flows.
    const normalView = (
      await http().get(`/groups/${group.id}/memories?q=${encodeURIComponent('presupuesto del proyecto')}`).set('Cookie', adminCookie).expect(200)
    ).body;
    expect(normalView.length).toBeGreaterThan(0);

    // Owner opts in (remove + re-share with includeSensitive) → their sensitive now surfaces.
    await http().delete(`/groups/${group.id}/fragments/${frag.id}`).set('Cookie', memberCookie).expect(204);
    const opted = (
      await http().post(`/groups/${group.id}/fragments`).set('Cookie', memberCookie).send({ areaId: area.id, includeSensitive: true }).expect(201)
    ).body;
    expect(opted.includeSensitive).toBe(true);
    const nowVisible = (
      await http().get(`/groups/${group.id}/memories?q=${encodeURIComponent('salario confidencial')}`).set('Cookie', adminCookie).expect(200)
    ).body;
    expect(nowVisible.some((m: { text: string }) => m.text.includes('salario'))).toBe(true);
  }, 90_000);
});
