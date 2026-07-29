import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type { Space } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { OutboxModule } from '../src/modules/outbox/outbox.module';
import { OrganizationModule } from '../src/modules/organization/organization.module';
import { OutboxRelay } from '../src/modules/outbox/outbox-relay';
import { OtpService } from '../src/modules/auth/otp.service';
import { PrismaService } from '../src/common/clients/prisma.service';
import { AreasService } from '../src/modules/areas/areas.service';
import { StructureExecutorService } from '../src/modules/organization/structure-executor.service';
import { EngineWorker } from '../src/modules/organization/engine.worker';
import { EngineBootstrapService } from '../src/modules/organization/bootstrap/engine-bootstrap.service';

/**
 * Closes Paso 9 (v2 engine) against the LIVE stack. Three properties the 181 unit
 * tests can't reach because they need Postgres + Qdrant + OpenAI/mem0 for real:
 *
 *  1. DRAIN — the async refinement path. An HTTP add enqueues a `memory_upserted`
 *     task; EngineWorker.drainUser rebuilds the mutual-kNN graph off real Qdrant
 *     vectors → personas → communities → membership, all materialized in Postgres.
 *  2. MERGE — the executor's access-preserving re-homing (MemoryArea/File/Grant/
 *     FragmentShare + persona reassignment) against the real DB, deterministically.
 *  3. BOOTSTRAP — a clean rebuild of a user with legacy areas + grants/lens/file,
 *     re-homed by plurality, and an idempotent re-run.
 *
 * Gated behind TEST_E2E (real, cheap OpenAI calls in tests 1 & 3). Run with the
 * stale app containers stopped so nothing else mutates the shared infra mid-test.
 */
describe('engine v2 e2e', () => {
  let app: INestApplication;
  let relay: OutboxRelay;
  let otp: OtpService;
  let prisma: PrismaService;
  let areas: AreasService;
  let executor: StructureExecutorService;
  let worker: EngineWorker;
  let bootstrap: EngineBootstrapService;

  beforeAll(async () => {
    // Import OrganizationModule at the root so its exports resolve the root-level
    // EngineWorker provider (the worker itself only lives in worker.ts). No
    // ScheduleModule → its @Interval is inert; we drive drainUser() by hand.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, OutboxModule, OrganizationModule],
      providers: [EngineWorker],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    relay = app.get(OutboxRelay);
    otp = app.get(OtpService);
    prisma = app.get(PrismaService);
    areas = app.get(AreasService, { strict: false });
    executor = app.get(StructureExecutorService, { strict: false });
    worker = app.get(EngineWorker);
    bootstrap = app.get(EngineBootstrapService, { strict: false });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string): Promise<string> {
    const code = await otp.generateAndSave(email);
    const res = await request(app.getHttpServer()).post('/auth/verify-otp').send({ email, code }).expect(200);
    return (res.get('Set-Cookie') as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
  }

  async function addMemory(cookie: string, text: string): Promise<void> {
    await request(app.getHttpServer()).post('/memory').set('Cookie', cookie).send({ text }).expect(201);
  }

  async function userIdByEmail(email: string): Promise<string> {
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    return u.id;
  }

  // ── Test 1: drain builds the whole structure off real vectors ────────────────
  it('drains an add-batch into graph → personas → communities → membership', async () => {
    const email = `drain_${Date.now()}@e2e.test`;
    const cookie = await login(email);

    // Six atomic, tightly-related facts about one project → one dense cluster.
    const facts = [
      'Mi proyecto Nébula usa Rust para el backend.',
      'El frontend de Nébula está hecho en SvelteKit.',
      'Nébula se despliega en Fly.io con contenedores Docker.',
      'La base de datos de Nébula es CockroachDB.',
      'Nébula usa NATS para la mensajería entre servicios.',
      'El equipo de Nébula hace los deploys los días martes.',
    ];
    for (const f of facts) await addMemory(cookie, f);
    await relay.processBatch(); // land savia_* payload in Qdrant

    const userId = await userIdByEmail(email);
    const memories = await prisma.memoryIndex.findMany({ where: { authorUserId: userId }, select: { memoryId: true } });
    expect(memories.length).toBeGreaterThanOrEqual(3); // mem0 kept enough facts to cluster

    // Adding enqueued memory_upserted tasks; drain the whole batch as one pass.
    const pending = await prisma.engineTask.count({ where: { userId, status: 'pending' } });
    expect(pending).toBeGreaterThan(0);
    await worker.drainUser(userId);

    // Graph + personas + component were materialized off the real Qdrant neighbourhood.
    const [edges, personas, component] = await Promise.all([
      prisma.memoryEdge.count({ where: { userId } }),
      prisma.memoryPersona.count({ where: { userId } }),
      prisma.engineComponent.findFirst({ where: { userId } }),
    ]);
    expect(edges).toBeGreaterThan(0);
    expect(personas).toBeGreaterThan(0);
    expect(component).not.toBeNull();

    // A dense cluster of ≥3 memories crosses MIN_COMMUNITY_SIZE → a real community area.
    const communityNodes = await prisma.engineNode.findMany({ where: { userId, kind: 'community' } });
    expect(communityNodes.length).toBeGreaterThanOrEqual(1);

    // syncMembership projected the community onto MemoryArea: at least one memory now
    // lives in a community area (not only General).
    const communitySpaceIds = new Set(communityNodes.map((n) => n.spaceId));
    const inCommunity = await prisma.memoryArea.count({
      where: { memoryId: { in: memories.map((m) => m.memoryId) }, spaceId: { in: [...communitySpaceIds] } },
    });
    expect(inCommunity).toBeGreaterThan(0);

    // The queue was drained clean (completed tasks are deleted).
    const leftover = await prisma.engineTask.count({ where: { userId, status: 'pending' } });
    expect(leftover).toBe(0);
  }, 180_000);

  // ── Test 2: merge re-homes every area-attached artifact, deterministically ────
  it('merges two communities, re-homing memberships/files/grants/fragments to the survivor', async () => {
    const user = await prisma.user.create({ data: { email: `merge_${Date.now()}@e2e.test` } });
    const userId = user.id;
    const general = await areas.ensureGeneral(userId);
    const component = await prisma.engineComponent.create({ data: { userId } });

    const mk = async (name: string): Promise<{ space: Space; nodeId: string }> => {
      const space = await prisma.space.create({
        data: {
          ownerUserId: userId,
          parentId: general.id,
          depth: general.depth + 1,
          name,
          path: `/general/${name}-${randomUUID().slice(0, 8)}`,
          description: '',
          governance: 'auto',
        },
      });
      const node = await prisma.engineNode.create({ data: { userId, componentId: component.id, spaceId: space.id, kind: 'community' } });
      return { space, nodeId: node.id };
    };
    const keep = await mk('keep');
    const drop = await mk('drop');

    // Two memories living in the doomed community, each with a persona pointing at it.
    const memIds = [randomUUID(), randomUUID()];
    for (const memoryId of memIds) {
      await prisma.memoryIndex.create({ data: { memoryId, authorUserId: userId } });
      await prisma.memoryArea.createMany({ data: [{ memoryId, spaceId: drop.space.id }, { memoryId, spaceId: general.id }] });
      await prisma.memoryPersona.create({ data: { memoryId, userId, communityId: drop.nodeId } });
    }

    // A File on the doomed area (Restrict → must be re-homed, not cascade-deleted).
    const file = await prisma.file.create({
      data: { spaceId: drop.space.id, uploaderUserId: userId, name: 'notas.pdf', mimeType: 'application/pdf', sizeBytes: 10, s3Key: `spaces/${drop.space.id}/notas.pdf` },
    });

    // Connection A: grant only on the doomed area (includeSensitive) → plain move.
    const connA = await prisma.connection.create({ data: { userId, label: 'A', tokenHash: 'hA', tokenLookup: randomUUID() } });
    await prisma.grant.create({ data: { connectionId: connA.id, scope: 'space', spaceId: drop.space.id, includeSensitive: true } });

    // Connection B: grants on BOTH areas → collision on re-home. Doomed side has
    // includeSensitive, survivor doesn't → must reconcile UP (never narrow access).
    const connB = await prisma.connection.create({ data: { userId, label: 'B', tokenHash: 'hB', tokenLookup: randomUUID() } });
    await prisma.grant.create({ data: { connectionId: connB.id, scope: 'space', spaceId: drop.space.id, includeSensitive: true } });
    await prisma.grant.create({ data: { connectionId: connB.id, scope: 'space', spaceId: keep.space.id, includeSensitive: false } });

    // A shared fragment on the doomed area.
    const group = await prisma.collectiveGroup.create({ data: { name: 'g' } });
    await prisma.fragmentShare.create({ data: { groupId: group.id, userId, spaceId: drop.space.id } });

    await executor.merge(userId, keep.nodeId, drop.nodeId);

    // Doomed Space gone → its EngineNode cascaded away.
    expect(await prisma.space.findUnique({ where: { id: drop.space.id } })).toBeNull();
    expect(await prisma.engineNode.findUnique({ where: { id: drop.nodeId } })).toBeNull();

    // Personas reassigned to the survivor (not nulled by the cascade).
    const personas = await prisma.memoryPersona.findMany({ where: { userId } });
    expect(personas).toHaveLength(2);
    expect(personas.every((p) => p.communityId === keep.nodeId)).toBe(true);

    // MemoryArea re-homed to the survivor closure [keep, general]; none dangling on the gone id.
    for (const memoryId of memIds) {
      const spaces = new Set((await prisma.memoryArea.findMany({ where: { memoryId } })).map((r) => r.spaceId));
      expect(spaces.has(keep.space.id)).toBe(true);
      expect(spaces.has(general.id)).toBe(true);
      expect(spaces.has(drop.space.id)).toBe(false);
    }

    // File moved to the survivor.
    expect((await prisma.file.findUniqueOrThrow({ where: { id: file.id } })).spaceId).toBe(keep.space.id);

    // Grants: A moved to survivor (sensitive kept); B reconciled to ONE grant on the
    // survivor with includeSensitive lifted (collision resolved toward permissive).
    const keepGrants = await prisma.grant.findMany({ where: { spaceId: keep.space.id } });
    const grantA = keepGrants.find((g) => g.connectionId === connA.id);
    const grantsB = keepGrants.filter((g) => g.connectionId === connB.id);
    expect(grantA?.includeSensitive).toBe(true);
    expect(grantsB).toHaveLength(1);
    expect(grantsB[0].includeSensitive).toBe(true);
    expect(await prisma.grant.count({ where: { spaceId: drop.space.id } })).toBe(0);

    // Fragment moved to the survivor.
    expect(await prisma.fragmentShare.count({ where: { spaceId: keep.space.id } })).toBe(1);

    // A merge Suggestion was surfaced for the inbox.
    expect(await prisma.suggestion.count({ where: { userId, kind: 'merge' } })).toBeGreaterThanOrEqual(1);
  }, 60_000);

  // ── Test 3: clean bootstrap re-homes legacy artifacts + is idempotent ────────
  it('bootstraps a user with a legacy area, re-homes its grant/lens/file, and re-runs idempotently', async () => {
    const email = `boot_${Date.now()}@e2e.test`;
    const cookie = await login(email);
    const facts = [
      'Mi bici de montaña es una Trek Marlin 7 de 2024.',
      'Uso la Trek para rodar en el cerro los fines de semana.',
      'Le cambié las llantas a la Trek por unas Maxxis.',
      'La Trek tiene suspensión delantera RockShox.',
    ];
    for (const f of facts) await addMemory(cookie, f);
    await relay.processBatch();
    const userId = await userIdByEmail(email);
    const general = await areas.ensureGeneral(userId);
    const liveMemories = await prisma.memoryIndex.findMany({ where: { authorUserId: userId }, select: { memoryId: true } });
    expect(liveMemories.length).toBeGreaterThanOrEqual(3);

    // A LEGACY (pre-v2) area with real memories + a grant + a lens + a file hanging off it.
    const legacy = await prisma.space.create({
      data: { ownerUserId: userId, parentId: general.id, depth: 1, name: 'Bici', path: '/general/bici', description: '', governance: 'auto' },
    });
    await prisma.memoryArea.createMany({
      data: liveMemories.map((m) => ({ memoryId: m.memoryId, spaceId: legacy.id })),
      skipDuplicates: true,
    });
    const conn = await prisma.connection.create({ data: { userId, label: 'legacy', tokenHash: 'h', tokenLookup: randomUUID() } });
    await prisma.grant.create({ data: { connectionId: conn.id, scope: 'space', spaceId: legacy.id, includeSensitive: false } });
    const lens = await prisma.lens.create({ data: { userId, name: 'Bici', sourceAreaIds: [legacy.id] } });
    const file = await prisma.file.create({
      data: { spaceId: legacy.id, uploaderUserId: userId, name: 'factura.pdf', mimeType: 'application/pdf', sizeBytes: 10, s3Key: `spaces/${legacy.id}/factura.pdf` },
    });

    await bootstrap.bootstrapUser(userId);

    // The legacy area is gone; the engine rebuilt fresh state.
    expect(await prisma.space.findUnique({ where: { id: legacy.id } })).toBeNull();
    expect(await prisma.engineComponent.findFirst({ where: { userId } })).not.toBeNull();
    expect(await prisma.memoryEdge.count({ where: { userId } })).toBeGreaterThan(0);

    // The lens no longer references the dead area id (remapped or dropped).
    expect((await prisma.lens.findUniqueOrThrow({ where: { id: lens.id } })).sourceAreaIds).not.toContain(legacy.id);

    // The file found a new home (a community area, or General as the last-resort fallback) — never the dead id.
    const fileNow = await prisma.file.findUniqueOrThrow({ where: { id: file.id } });
    expect(fileNow.spaceId).not.toBe(legacy.id);
    expect(await prisma.space.findUnique({ where: { id: fileNow.spaceId } })).not.toBeNull();

    // The grant was either re-homed to a real (non-General) community or dropped —
    // NEVER widened onto General (the scope-widening the bootstrap rule forbids).
    const grants = await prisma.grant.findMany({ where: { connectionId: conn.id } });
    for (const g of grants) {
      expect(g.spaceId).not.toBe(legacy.id);
      if (g.spaceId) {
        const s = await prisma.space.findUnique({ where: { id: g.spaceId } });
        expect(s?.isDefault).toBe(false);
      }
    }

    // Idempotent: a second run rebuilds deterministically without throwing and keeps state coherent.
    const communitiesBefore = await prisma.engineNode.count({ where: { userId, kind: 'community' } });
    await expect(bootstrap.bootstrapUser(userId)).resolves.not.toThrow();
    const communitiesAfter = await prisma.engineNode.count({ where: { userId, kind: 'community' } });
    expect(communitiesAfter).toBe(communitiesBefore);
    expect(await prisma.engineComponent.count({ where: { userId } })).toBe(1);
  }, 180_000);
});
