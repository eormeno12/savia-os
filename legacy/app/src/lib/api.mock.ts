/**
 * Frontend-only mock of the `api` boundary. Activated with NEXT_PUBLIC_MOCK=1 so
 * the whole UI can be browsed and exercised with no backend running. Data is
 * internally consistent (area ids referenced by memories/grants/lenses/events/
 * growth all resolve) and mutations update in-memory state so create/delete/
 * toggle actions feel live within a session (a hard reload resets everything).
 *
 * This file is disposable scaffolding — delete it and flip the flag off to go
 * back to the real API. It intentionally has no network calls.
 */
import type {
  AreaDto,
  AreaMemoriesPage,
  AreaMemoryDto,
  AreaTreeNode,
  BillingRow,
  ConnectionDto,
  CreateConnectionResponse,
  FileDto,
  GrantDto,
  GroupDto,
  GroupMemberDto,
  GroupMemoryDto,
  GrowthAreaDto,
  GrowthEvent,
  GrowthEventsPage,
  GrowthSummary,
  InboxItem,
  JobDto,
  LensDto,
  MemoryResult,
  MeResponse,
  PendingInviteDto,
  SubscriptionDto,
  SuggestedSpace,
  SuggestionDto,
} from '@savia-os/legacy-contracts';
import type { AccessActivity, Api } from './api';

// ─── helpers ─────────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** ISO string `ms` milliseconds in the past (relative-time renders read right). */
const ago = (ms: number): string => new Date(Date.now() - ms).toISOString();
/** ISO string `ms` milliseconds in the future (invite expiries). */
const ahead = (ms: number): string => new Date(Date.now() + ms).toISOString();

/** Resolve `value` after a small delay so loading skeletons actually show. */
const d = <T>(value: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(clone(value)), ms));

/** Structured clone so callers mutating results never corrupt the store. */
const clone = <T>(v: T): T => (typeof v === 'object' && v !== null ? JSON.parse(JSON.stringify(v)) : v);

let seq = 1;
const id = (prefix: string): string => `${prefix}-${seq++}`;

// ─── seed store (mutable) ────────────────────────────────────────────────────

const AREAS: AreaDto[] = [
  mkArea('area-general', 'General', null, 0, 247, { isDefault: true, updatedMs: 20 * MIN }),
  mkArea('area-trabajo', 'Trabajo', 'area-general', 1, 84, { updatedMs: 35 * MIN }),
  mkArea('area-aurora', 'Proyecto Aurora', 'area-trabajo', 2, 37, { governance: 'manual', updatedMs: 3 * HOUR }),
  mkArea('area-reuniones', 'Reuniones', 'area-trabajo', 2, 22, { updatedMs: 26 * HOUR }),
  mkArea('area-personal', 'Personal', 'area-general', 1, 52, { updatedMs: 5 * HOUR }),
  mkArea('area-salud', 'Salud', 'area-personal', 2, 19, { updatedMs: 4 * DAY }),
  mkArea('area-aprendizaje', 'Aprendizaje', 'area-general', 1, 41, { updatedMs: 30 * HOUR }),
  mkArea('area-finanzas', 'Finanzas', 'area-general', 1, 23, { governance: 'manual', updatedMs: 6 * DAY }),
  mkArea('area-viajes', 'Viajes', 'area-general', 1, 18, { updatedMs: 9 * DAY }),
];

function mkArea(
  aId: string,
  name: string,
  parentId: string | null,
  depth: number,
  memoryCount: number,
  opts: { isDefault?: boolean; governance?: 'auto' | 'manual'; updatedMs?: number } = {},
): AreaDto {
  const parentName = parentId ? '/' + parentId.replace('area-', '') : '';
  return {
    id: aId,
    name,
    description:
      opts.isDefault === true
        ? 'Tu área base. Donde descansa lo que aún no tiene un lugar propio.'
        : `Todo lo relacionado con ${name.toLowerCase()}.`,
    parentId,
    depth,
    path: (parentId ? parentName : '') + '/' + name.toLowerCase().replace(/\s+/g, '-'),
    isDefault: opts.isDefault ?? false,
    governance: opts.governance ?? 'auto',
    memoryCount,
    createdAt: ago(120 * DAY),
    updatedAt: ago(opts.updatedMs ?? 7 * DAY),
  };
}

/** Memory texts per area — first-person, Spanish, realistic. */
const MEMORY_TEXTS: Record<string, string[]> = {
  'area-general': [
    'Prefiero las reuniones por la mañana, antes de las 11.',
    'Mi cumpleaños es el 14 de marzo.',
    'Uso Notion para notas rápidas y Obsidian para lo permanente.',
    'Me gusta el café cortado, sin azúcar.',
    'Zona horaria: America/Argentina/Buenos_Aires (GMT-3).',
    'Trabajo mejor con música instrumental de fondo.',
  ],
  'area-trabajo': [
    'El objetivo del Q3 es reducir el churn por debajo del 4%.',
    'Reporto directamente a la CTO; sync semanal los martes.',
    'El stack del backend es NestJS + Postgres + Qdrant.',
    'Preferimos PRs chicos y revisados el mismo día.',
    'La demo para el board es el último viernes de cada mes.',
    'Estoy liderando la migración del monolito a servicios.',
    'Slack es para lo urgente; lo demás va a Linear.',
    'Definí OKRs con el equipo: foco en activación y retención.',
  ],
  'area-aurora': [
    'Aurora es el rediseño del onboarding con clustering por embeddings.',
    'La meta de Aurora: reducir el time-to-value a menos de 3 minutos.',
    'Decidimos usar mem0 para la capa de memoria de Aurora.',
    'El primer hito de Aurora se entrega en dos semanas.',
    'Aurora usa un tour guiado en 2 pasos, no 5.',
  ],
  'area-reuniones': [
    'En la retro acordamos limitar el WIP a 3 tareas por persona.',
    'La reunión con Legal quedó para el jueves 10:30.',
    'Acción pendiente: enviar el resumen del kickoff a stakeholders.',
    'Standup diario a las 9:15, máximo 15 minutos.',
  ],
  'area-personal': [
    'Estoy leyendo «Thinking, Fast and Slow».',
    'Quiero aprender a tocar el piano este año.',
    'Los domingos son sagrados para desconectar del trabajo.',
    'Mi película favorita es «Arrival».',
    'Adopté un gato, se llama Miso.',
  ],
  'area-salud': [
    'Corro 5 km tres veces por semana.',
    'Soy alérgico a la penicilina.',
    'Intento dormir 8 horas y apagar pantallas a las 23:00.',
    'Chequeo médico anual agendado para septiembre.',
  ],
  'area-aprendizaje': [
    'Estoy haciendo el curso de sistemas distribuidos de MIT.',
    'Aprendí que los índices HNSW cambian recall por latencia.',
    'Quiero profundizar en teoría de categorías aplicada.',
    'Anoté: revisar el paper de RAG con reranking.',
    'Practico inglés técnico 20 minutos al día.',
  ],
  'area-finanzas': [
    'Presupuesto mensual de ahorro: 25% del ingreso.',
    'Reviso las inversiones una vez por trimestre, no más.',
    'La renovación del seguro es en noviembre.',
  ],
  'area-viajes': [
    'Viaje a Japón planeado para la primavera.',
    'Prefiero asiento de pasillo en vuelos largos.',
    'Tengo el pasaporte válido hasta 2029.',
  ],
};

/** Build a memory row belonging primarily to `areaId`, occasionally shared. */
function memoriesFor(areaId: string): AreaMemoryDto[] {
  const texts = MEMORY_TEXTS[areaId] ?? [];
  return texts.map((text, i) => ({
    memoryId: `${areaId}-m${i}`,
    text,
    // every 4th memory is also shared into General to exercise "También en"
    areaIds: i % 4 === 0 && areaId !== 'area-general' ? [areaId, 'area-general'] : [areaId],
    sensitivity: /alérgico|penicilina|médico|seguro|ingreso/i.test(text) ? 'sensitive' : 'normal',
    createdAt: ago((i + 1) * 6 * HOUR),
  }));
}

let CONNECTIONS: ConnectionDto[] = [
  {
    id: 'conn-claude',
    label: 'Claude Desktop',
    lastSeenAt: ago(9 * MIN),
    revoked: false,
    createdAt: ago(40 * DAY),
    grants: [
      grant('space', 'area-trabajo'),
      grant('space', 'area-personal'),
      grant('space', 'area-aprendizaje', true),
    ],
  },
  {
    id: 'conn-gpt',
    label: 'ChatGPT',
    lastSeenAt: ago(2 * HOUR),
    revoked: false,
    createdAt: ago(28 * DAY),
    grants: [grant('space', 'area-aprendizaje')],
  },
  {
    id: 'conn-cursor',
    label: 'Cursor',
    lastSeenAt: ago(3 * DAY),
    revoked: false,
    createdAt: ago(15 * DAY),
    grants: [grant('space', 'area-aurora'), grant('group', 'group-fundadores')],
  },
  {
    id: 'conn-plex',
    label: 'Perplexity',
    lastSeenAt: ago(22 * DAY),
    revoked: true,
    createdAt: ago(50 * DAY),
    grants: [],
  },
];

function grant(scope: 'space' | 'group', target: string, includeSensitive = false): GrantDto {
  return {
    id: id('grant'),
    scope,
    spaceId: scope === 'space' ? target : null,
    groupId: scope === 'group' ? target : null,
    includeSensitive,
    createdAt: ago(10 * DAY),
  };
}

const ACTIVITY: AccessActivity[] = [
  { connectionId: 'conn-claude', label: 'Claude Desktop', totalCalls: 1284, lastSeenAt: ago(9 * MIN) },
  { connectionId: 'conn-gpt', label: 'ChatGPT', totalCalls: 342, lastSeenAt: ago(2 * HOUR) },
  { connectionId: 'conn-cursor', label: 'Cursor', totalCalls: 87, lastSeenAt: ago(3 * DAY) },
];

let LENSES: LensDto[] = [
  { id: 'lens-decisiones', name: 'Decisiones técnicas', query: 'decisiones de arquitectura y stack', radius: 0.35, sourceAreaIds: ['area-trabajo'], createdAt: ago(12 * DAY) },
  { id: 'lens-habitos', name: 'Mis hábitos', query: 'rutinas, sueño, ejercicio y bienestar', radius: 0.4, sourceAreaIds: [], createdAt: ago(6 * DAY) },
  { id: 'lens-aurora', name: 'Todo sobre Aurora', query: 'proyecto aurora onboarding', radius: 0.3, sourceAreaIds: ['area-aurora'], createdAt: ago(2 * DAY) },
];

let GROUPS: GroupDto[] = [
  { id: 'group-fundadores', name: 'Fundadores Savia', role: 'admin', memberCount: 4, fragmentCount: 3, createdAt: ago(60 * DAY) },
  { id: 'group-lectura', name: 'Club de lectura', role: 'contributor', memberCount: 7, fragmentCount: 6, createdAt: ago(20 * DAY) },
];

const GROUP_MEMBERS: Record<string, GroupMemberDto[]> = {
  'group-fundadores': [
    { userId: 'u-me', email: 'contact@savia.uno', role: 'admin', joinedAt: ago(60 * DAY) },
    { userId: 'u-ceo', email: 'ceo@savia.uno', role: 'admin', joinedAt: ago(58 * DAY) },
    { userId: 'u-cto', email: 'cto@savia.uno', role: 'contributor', joinedAt: ago(55 * DAY) },
    { userId: 'u-design', email: 'design@savia.uno', role: 'viewer', joinedAt: ago(30 * DAY) },
  ],
  'group-lectura': [
    { userId: 'u-me', email: 'contact@savia.uno', role: 'contributor', joinedAt: ago(20 * DAY) },
    { userId: 'u-ana', email: 'ana@example.com', role: 'admin', joinedAt: ago(40 * DAY) },
    { userId: 'u-luis', email: 'luis@example.com', role: 'contributor', joinedAt: ago(18 * DAY) },
  ],
};

const GROUP_MEMORIES: Record<string, GroupMemoryDto[]> = {
  'group-fundadores': [
    { memoryId: 'gm-1', text: 'La misión: la memoria que conecta todas tus IAs.', score: 0.94, authorUserId: 'u-ceo', alsoFrom: ['contact@savia.uno'], sensitivity: 'normal' },
    { memoryId: 'gm-2', text: 'Lanzamos la beta privada el próximo trimestre.', score: 0.88, authorUserId: 'u-me', alsoFrom: [], sensitivity: 'normal' },
    { memoryId: 'gm-3', text: 'Priorizamos privacidad por diseño: el dato nunca sale de su autor.', score: 0.85, authorUserId: 'u-cto', alsoFrom: ['ceo@savia.uno'], sensitivity: 'normal' },
  ],
  'group-lectura': [
    { memoryId: 'gm-4', text: 'Próximo libro: «The Beginning of Infinity».', score: 0.9, authorUserId: 'u-ana', alsoFrom: [], sensitivity: 'normal' },
    { memoryId: 'gm-5', text: 'Nos reunimos el primer jueves de cada mes.', score: 0.82, authorUserId: 'u-luis', alsoFrom: ['contact@savia.uno'], sensitivity: 'normal' },
  ],
};

let PENDING_INVITES: PendingInviteDto[] = [
  { id: 'inv-1', groupId: 'group-diseno', groupName: 'Equipo de Diseño', role: 'contributor', expiresAt: ahead(3 * DAY), createdAt: ago(6 * HOUR) },
];

let INBOX: InboxItem[] = [
  { id: 'nb-1', kind: 'suggestion', refId: 'sug-1', data: { rationale: 'separar «Proyecto Aurora» de «Trabajo»' }, seen: false, createdAt: ago(40 * MIN) },
  { id: 'nb-2', kind: 'milestone', refId: null, data: { text: 'Tus IAs consultaron tu memoria 1.700 veces esta semana.' }, seen: false, createdAt: ago(3 * HOUR) },
  { id: 'nb-3', kind: 'member_joined', refId: 'group-fundadores', data: { email: 'design@savia.uno', groupName: 'Fundadores Savia' }, seen: true, createdAt: ago(2 * DAY) },
  { id: 'nb-4', kind: 'job', refId: 'job-2', data: { type: 'account_export', status: 'done' }, seen: true, createdAt: ago(4 * DAY) },
  { id: 'nb-5', kind: 'suggestion', refId: 'sug-2', data: { rationale: 'fusionar dos áreas casi duplicadas de «Viajes»' }, seen: false, createdAt: ago(5 * DAY) },
];

let EVENTS: GrowthEvent[] = buildEvents();

function buildEvents(): GrowthEvent[] {
  const actions: GrowthEvent['action'][] = ['create', 'create', 'move', 'create', 'split', 'create', 'merge', 'sensitivity', 'create', 'supersede', 'decay', 'create'];
  const spaces = ['area-trabajo', 'area-aurora', 'area-personal', 'area-aprendizaje', 'area-salud', 'area-finanzas', 'area-viajes', 'area-reuniones'];
  const out: GrowthEvent[] = [];
  for (let i = 0; i < 42; i++) {
    const action = actions[i % actions.length];
    const reorg = action === 'move' || action === 'split' || action === 'merge' || action === 'supersede';
    out.push({
      id: `ev-${i}`,
      action,
      spaceId: spaces[i % spaces.length],
      memoryId: `mem-${i}`,
      reverted: false,
      revertable: reorg,
      createdAt: ago(i * 4 * HOUR + 12 * MIN),
    });
  }
  return out;
}

const JOBS: JobDto[] = [
  { id: 'job-1', type: 'import_chatgpt', status: 'running', progress: 62, total: 100, resultRef: null, error: null, createdAt: ago(25 * MIN), updatedAt: ago(2 * MIN) },
  { id: 'job-2', type: 'account_export', status: 'done', progress: 100, total: 100, resultRef: 'https://example.com/export.zip', error: null, createdAt: ago(4 * DAY), updatedAt: ago(4 * DAY) },
];

let SUGGESTIONS: SuggestionDto[] = [
  { id: 'sug-1', kind: 'split', status: 'pending', rationale: 'separar «Proyecto Aurora» de «Trabajo»', payload: { areaId: 'area-trabajo' }, createdAt: ago(40 * MIN) },
  { id: 'sug-2', kind: 'merge', status: 'pending', rationale: 'fusionar dos áreas casi duplicadas de «Viajes»', payload: { areaIds: ['area-viajes'] }, createdAt: ago(5 * DAY) },
];

let FILES: FileDto[] = [
  { id: 'file-1', areaId: 'area-aurora', name: 'aurora-brief.pdf', mimeType: 'application/pdf', sizeBytes: 842_000, status: 'indexed', source: 'upload', uploaderUserId: 'u-me', memoryCount: 12, createdAt: ago(8 * DAY), indexedAt: ago(8 * DAY) },
  { id: 'file-2', areaId: 'area-trabajo', name: 'okrs-q3.md', mimeType: 'text/markdown', sizeBytes: 14_200, status: 'indexed', source: 'upload', uploaderUserId: 'u-me', memoryCount: 6, createdAt: ago(5 * DAY), indexedAt: ago(5 * DAY) },
  { id: 'file-3', areaId: 'area-aprendizaje', name: 'sistemas-distribuidos.pdf', mimeType: 'application/pdf', sizeBytes: 3_100_000, status: 'processing', source: 'upload', uploaderUserId: 'u-me', memoryCount: 0, createdAt: ago(20 * MIN), indexedAt: null },
  { id: 'file-4', areaId: 'area-personal', name: 'notas-personales.txt', mimeType: 'text/plain', sizeBytes: 5_400, status: 'failed', source: 'upload', uploaderUserId: 'u-me', memoryCount: 0, createdAt: ago(2 * DAY), indexedAt: null },
];

let SUBSCRIPTION: SubscriptionDto = {
  status: 'active',
  planType: 'monthly',
  amount: 12,
  currency: 'USD',
  nextPaymentAt: ahead(18 * DAY),
};

const PAYMENTS: BillingRow[] = [
  { id: 'pay-1', date: ago(12 * DAY), period: 'Jun 2026', amount: 12, currency: 'USD', status: 'approved', receiptUrl: 'https://example.com/receipt/1' },
  { id: 'pay-2', date: ago(42 * DAY), period: 'May 2026', amount: 12, currency: 'USD', status: 'approved', receiptUrl: 'https://example.com/receipt/2' },
  { id: 'pay-3', date: ago(72 * DAY), period: 'Abr 2026', amount: 12, currency: 'USD', status: 'refunded', receiptUrl: null },
];

const SUGGESTED_SPACES: SuggestedSpace[] = [
  { name: 'Recetas', description: 'Notas de cocina, ingredientes y platos que quieres probar.', memoryCount: 9, examples: ['Risotto de hongos para el finde', 'Comprar azafrán'] },
  { name: 'Ideas de producto', description: 'Chispazos sueltos sobre features y mejoras.', memoryCount: 14, examples: ['Modo enfoque para el Pulso', 'Export a Markdown'] },
  { name: 'Regalos', description: 'Ideas de regalos para gente cercana.', memoryCount: 5, examples: ['Libro de Ted Chiang para Ana'] },
];

let ME: MeResponse = {
  id: 'u-me',
  email: 'contact@savia.uno',
  displayName: 'Equipo Savia',
  plan: 'pro',
  createdAt: ago(120 * DAY),
};

// ─── search corpus (semantic search over everything) ─────────────────────────

const ALL_MEMORIES: MemoryResult[] = Object.keys(MEMORY_TEXTS).flatMap((areaId) =>
  memoriesFor(areaId).map((m) => ({
    id: m.memoryId,
    text: m.text,
    score: 0,
    areaIds: m.areaIds,
    sensitivity: m.sensitivity,
  })),
);

function search(query: string, areaIds?: string[], limit = 10): MemoryResult[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const scoped = areaIds?.length
    ? ALL_MEMORIES.filter((m) => m.areaIds.some((a) => areaIds.includes(a)))
    : ALL_MEMORIES;
  const scored = scoped
    .map((m) => {
      const text = m.text.toLowerCase();
      const hits = words.filter((w) => text.includes(w)).length;
      // Base similarity so results never come back empty for a plausible query.
      const score = Math.min(0.97, 0.55 + hits * 0.12 + (text.includes(q) ? 0.2 : 0));
      return { ...m, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── tree builder (areas.tree) ───────────────────────────────────────────────

function buildTree(): AreaTreeNode[] {
  const node = (a: AreaDto): AreaTreeNode => ({
    id: a.id,
    name: a.name,
    depth: a.depth,
    isDefault: a.isDefault,
    memoryCount: a.memoryCount,
    children: AREAS.filter((c) => c.parentId === a.id).map(node),
  });
  return AREAS.filter((a) => a.parentId === null).map(node);
}

// ─── paginated area memories ─────────────────────────────────────────────────

function areaMemories(areaId: string, cursor?: string, limit = 20): AreaMemoriesPage {
  const all = memoriesFor(areaId);
  const start = cursor ? Number(cursor) : 0;
  const slice = all.slice(start, start + limit);
  const nextStart = start + limit;
  return {
    items: slice,
    nextCursor: nextStart < all.length ? String(nextStart) : null,
  };
}

// ─── the mock api ────────────────────────────────────────────────────────────

export const mockApi: Api = {
  requestOtp: (email) => d({ message: `Código enviado a ${email} (mock).` }),
  verifyOtp: (email) => {
    ME = { ...ME, email };
    return d(ME);
  },
  logout: () => d({ message: 'Sesión cerrada (mock).' }),
  me: () => d(ME),

  areas: {
    list: () => d(AREAS),
    tree: () => d(buildTree()),
    create: (description, opts) => {
      const name = description.length > 24 ? description.slice(0, 24) + '…' : description;
      const area = mkArea(id('area'), name, opts?.parentId ?? 'area-general', 1, opts?.memoryIds?.length ?? 0, {
        governance: 'manual',
        updatedMs: 0,
      });
      AREAS.push(area);
      return d(area);
    },
    update: (aId, data) => {
      const area = AREAS.find((a) => a.id === aId)!;
      if (data.name) area.name = data.name;
      if (data.description) area.description = data.description;
      area.updatedAt = new Date().toISOString();
      return d(area);
    },
    delete: (aId) => {
      const i = AREAS.findIndex((a) => a.id === aId);
      if (i >= 0) AREAS.splice(i, 1);
      return d(undefined as void);
    },
    memories: (aId, cursor, limit) => d(areaMemories(aId, cursor, limit)),
    sample: (aId) => d(areaMemories(aId, undefined, 3).items),
  },

  memory: {
    add: (text) => d({ id: id('mem'), text, score: 1, areaIds: ['area-general'], sensitivity: 'normal' as const }),
    search: (query, opts) => d(search(query, opts?.areaIds, opts?.limit), 320),
    update: (mId, dto) =>
      d({ id: mId, text: 'Recuerdo actualizado', score: 1, areaIds: dto.addAreas ?? ['area-general'], sensitivity: dto.sensitivity ?? ('normal' as const) }),
    delete: () => d(undefined as void),
  },

  connections: {
    create: (label) => {
      const conn: CreateConnectionResponse = {
        id: id('conn'),
        label,
        lastSeenAt: null,
        revoked: false,
        grants: [],
        createdAt: new Date().toISOString(),
        token: 'sk-savia-' + Math.abs(seq * 998877).toString(36) + 'MOCKTOKEN',
      };
      CONNECTIONS = [{ ...conn }, ...CONNECTIONS];
      // strip the token from the stored ConnectionDto
      return d(conn);
    },
    list: () => d(CONNECTIONS),
    revoke: (cId) => {
      const c = CONNECTIONS.find((x) => x.id === cId);
      if (c) c.revoked = true;
      return d(undefined as void);
    },
    addGrant: (cId, g) => {
      const conn = CONNECTIONS.find((x) => x.id === cId)!;
      const created = grant(g.scope, (g.spaceId ?? g.groupId)!, g.includeSensitive ?? false);
      conn.grants.push(created);
      return d(created);
    },
    removeGrant: (cId, grantId) => {
      const conn = CONNECTIONS.find((x) => x.id === cId);
      if (conn) conn.grants = conn.grants.filter((g) => g.id !== grantId);
      return d(undefined as void);
    },
  },

  groups: {
    create: (name) => {
      const g: GroupDto = { id: id('group'), name, role: 'admin', memberCount: 1, fragmentCount: 0, createdAt: new Date().toISOString() };
      GROUPS = [g, ...GROUPS];
      GROUP_MEMBERS[g.id] = [{ userId: 'u-me', email: ME.email, role: 'admin', joinedAt: g.createdAt }];
      GROUP_MEMORIES[g.id] = [];
      return d(g);
    },
    list: () => d(GROUPS),
    get: (gId) => d(GROUPS.find((g) => g.id === gId) ?? GROUPS[0]),
    memories: (gId) => d(GROUP_MEMORIES[gId] ?? []),
    shareFragment: () => d(undefined as void),
    invite: (_gId, email) => d({ token: 'mock-invite-token', expiresAt: ahead(7 * DAY), email } as { token: string; expiresAt: string }),
    members: (gId) => d(GROUP_MEMBERS[gId] ?? []),
    setRole: (gId, userId, role) => {
      const m = (GROUP_MEMBERS[gId] ?? []).find((x) => x.userId === userId)!;
      if (m) m.role = role;
      return d(m);
    },
    removeMember: (gId, userId) => {
      if (GROUP_MEMBERS[gId]) GROUP_MEMBERS[gId] = GROUP_MEMBERS[gId].filter((x) => x.userId !== userId);
      return d(undefined as void);
    },
    leave: (gId) => {
      GROUPS = GROUPS.filter((g) => g.id !== gId);
      return d(undefined as void);
    },
  },

  invites: {
    listPending: () => d(PENDING_INVITES),
    accept: (token) => {
      PENDING_INVITES = PENDING_INVITES.filter((i) => i.id !== token);
      return d({ groupId: 'group-diseno' });
    },
  },

  growth: {
    summary: () => {
      const points = Array.from({ length: 7 }, (_, i) => ({
        bucket: new Date(Date.now() - (6 - i) * DAY).toISOString().slice(0, 10),
        count: [8, 14, 6, 19, 11, 23, 17][i],
      }));
      return d<GrowthSummary>({ points, todayTotal: 17, weekTotal: 98, weekDelta: 22 });
    },
    areas: () => {
      const top = AREAS.filter((a) => a.parentId === 'area-general');
      const total = top.reduce((s, a) => s + a.memoryCount, 0);
      return d<GrowthAreaDto[]>(
        top.map((a) => ({ spaceId: a.id, name: a.name, count: a.memoryCount, share: total ? a.memoryCount / total : 0 })),
      );
    },
    events: (cursor, limit = 30) => {
      const start = cursor ? Number(cursor) : 0;
      const slice = EVENTS.slice(start, start + limit);
      const nextStart = start + limit;
      return d<GrowthEventsPage>({ items: slice, nextCursor: nextStart < EVENTS.length ? String(nextStart) : null });
    },
    revertEvent: (evId) => {
      const e = EVENTS.find((x) => x.id === evId);
      if (e) e.reverted = true;
      return d(undefined as void);
    },
    accessActivity: () => d(ACTIVITY),
  },

  inbox: {
    list: () => d(INBOX),
    markSeen: (nId) => {
      const n = INBOX.find((x) => x.id === nId);
      if (n) n.seen = true;
      return d(undefined as void);
    },
    jobs: () => d(JOBS),
    job: (jId) => d(JOBS.find((j) => j.id === jId) ?? JOBS[0]),
    suggestions: () => d(SUGGESTIONS.filter((s) => s.status === 'pending')),
    acceptSuggestion: (sId) => {
      SUGGESTIONS = SUGGESTIONS.map((s) => (s.id === sId ? { ...s, status: 'accepted' } : s));
      return d(undefined as void);
    },
    dismissSuggestion: (sId) => {
      SUGGESTIONS = SUGGESTIONS.map((s) => (s.id === sId ? { ...s, status: 'dismissed' } : s));
      return d(undefined as void);
    },
  },

  lenses: {
    create: (data) => {
      const lens: LensDto = {
        id: id('lens'),
        name: data.name,
        query: data.query,
        radius: data.radius ?? 0.4,
        sourceAreaIds: data.sourceAreaIds ?? [],
        createdAt: new Date().toISOString(),
      };
      LENSES = [lens, ...LENSES];
      return d(lens);
    },
    list: () => d(LENSES),
    memories: (lId) => {
      const lens = LENSES.find((l) => l.id === lId);
      return d(search(lens?.query ?? '', lens?.sourceAreaIds, 12), 300);
    },
    delete: (lId) => {
      LENSES = LENSES.filter((l) => l.id !== lId);
      return d(undefined as void);
    },
  },

  billing: {
    subscription: () => d(SUBSCRIPTION),
    subscribe: () => d({ checkoutUrl: 'https://www.mercadopago.com.ar/checkout/mock' }),
    cancel: () => {
      SUBSCRIPTION = { ...SUBSCRIPTION, status: 'cancelled', cancelledAt: ago(0) } as SubscriptionDto;
      return d(SUBSCRIPTION);
    },
    reactivate: () => {
      SUBSCRIPTION = { ...SUBSCRIPTION, status: 'active' };
      return d(SUBSCRIPTION);
    },
    payments: () => d(PAYMENTS),
  },

  account: {
    requestExport: () => d({ jobId: id('job'), status: 'queued' }),
    delete: () => d(undefined as void),
  },

  onboarding: {
    saveProfile: (displayName) => {
      ME = { ...ME, displayName };
      return d(ME);
    },
    rescuePrompt: () =>
      d({
        prompt:
          'Copia esto en tu IA favorita: «Resume todo lo que sabes sobre mí, mis preferencias, proyectos y decisiones importantes, en una lista de puntos concretos.»',
      }),
    ingestRescue: (text) => d({ count: Math.max(1, Math.round(text.length / 80)) }, 600),
    importChatGpt: (content) => d({ queued: Math.max(1, Math.round(content.length / 400)) }, 600),
    suggestSpaces: () => d(SUGGESTED_SPACES),
  },

  files: {
    presign: (areaId, name, mimeType) =>
      d({ uploadUrl: 'https://mock.local/upload', fields: {}, s3Key: `spaces/${areaId}/${id('file')}-${name}`, mimeType } as unknown as { uploadUrl: string; fields: Record<string, string>; s3Key: string }),
    create: (areaId, name, mimeType, sizeBytes, s3Key) => {
      const file: FileDto = {
        id: id('file'),
        areaId,
        name,
        mimeType,
        sizeBytes,
        status: 'processing',
        source: 'upload',
        uploaderUserId: 'u-me',
        memoryCount: 0,
        createdAt: new Date().toISOString(),
        indexedAt: null,
      };
      void s3Key;
      FILES = [file, ...FILES];
      return d(file);
    },
    list: () => d(FILES),
    delete: (fId) => {
      FILES = FILES.filter((f) => f.id !== fId);
      return d(undefined as void);
    },
  },
};
