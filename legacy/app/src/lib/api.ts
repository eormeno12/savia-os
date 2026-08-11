import type {
  AreaDto,
  AreaMemoriesPage,
  AreaTreeNode,
  BillingRow,
  ConnectionDto,
  CreateConnectionResponse,
  CreateGrantDto,
  FileDto,
  GrantDto,
  GroupDto,
  GroupMemberDto,
  GroupMemoryDto,
  GroupRole,
  GrowthAreaDto,
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
  UpdateMemoryDto,
} from '@savia-os/legacy-contracts';
import { mockApi } from './api.mock';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4400';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Stable machine code from the API (e.g. "PlanRequired" → show the SB1 gate). */
    public code?: string,
  ) {
    super(message);
  }
}

async function doFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
    ...init,
  });
}

/**
 * Single request pipeline: every call (reads AND mutations) goes through here so
 * failures always surface as `ApiError`. A 401 outside /auth retries once after
 * a silent token refresh — the access cookie only lives 15 minutes.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await doFetch(path, init);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await doFetch('/auth/refresh', { method: 'POST' });
    if (refreshed.ok) res = await doFetch(path, init);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message ?? res.statusText, body?.code);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

const realApi = {
  requestOtp: (email: string) => request<{ message: string }>('/auth/request-otp', json({ email })),

  verifyOtp: (email: string, code: string) => request<MeResponse>('/auth/verify-otp', json({ email, code })),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () => request<MeResponse>('/auth/me'),

  areas: {
    list: () => request<AreaDto[]>('/areas'),

    tree: () => request<AreaTreeNode[]>('/areas/tree'),

    create: (description: string, opts?: { parentId?: string; memoryIds?: string[] }) =>
      request<AreaDto>('/areas', json({ description, ...opts })),

    update: (id: string, data: { name?: string; description?: string }) =>
      request<AreaDto>(`/areas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id: string) => request<void>(`/areas/${id}`, { method: 'DELETE' }),

    memories: (id: string, cursor?: string, limit = 20) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      return request<AreaMemoriesPage>(`/areas/${id}/memories?${params}`);
    },

    /** Representative memories of an area (previews, hover cards). */
    sample: (id: string) => request<AreaMemoriesPage['items']>(`/areas/${id}/sample`),
  },

  memory: {
    add: (text: string, areaId?: string) => request<MemoryResult>('/memory', json({ text, areaId })),

    /** Semantic search across the user's areas (default-deny on server). */
    search: (query: string, opts?: { areaIds?: string[]; limit?: number }) =>
      request<MemoryResult[]>('/memory/search', json({ query, areaIds: opts?.areaIds, limit: opts?.limit })),

    /** Edit membership (multi-area) and/or sensitivity. */
    update: (id: string, data: UpdateMemoryDto) =>
      request<MemoryResult>(`/memory/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id: string) => request<void>(`/memory/${id}`, { method: 'DELETE' }),
  },

  connections: {
    create: (label: string) => request<CreateConnectionResponse>('/connections', json({ label })),

    list: () => request<ConnectionDto[]>('/connections'),

    revoke: (id: string) => request<void>(`/connections/${id}`, { method: 'DELETE' }),

    addGrant: (connectionId: string, grant: CreateGrantDto) =>
      request<GrantDto>(`/connections/${connectionId}/grants`, json(grant)),

    removeGrant: (connectionId: string, grantId: string) =>
      request<void>(`/connections/${connectionId}/grants/${grantId}`, { method: 'DELETE' }),
  },

  groups: {
    create: (name: string) => request<GroupDto>('/groups', json({ name })),

    list: () => request<GroupDto[]>('/groups'),

    get: (id: string) => request<GroupDto>(`/groups/${id}`),

    memories: (id: string) => request<GroupMemoryDto[]>(`/groups/${id}/memories`),

    /** Share one of my area subtrees into the group (creates my fragment). */
    shareFragment: (id: string, areaId: string) => request<void>(`/groups/${id}/fragments`, json({ areaId })),

    invite: (id: string, email: string, role: GroupRole) =>
      request<{ token: string; expiresAt: string }>(`/groups/${id}/invites`, json({ email, role })),

    members: (id: string) => request<GroupMemberDto[]>(`/groups/${id}/members`),

    setRole: (id: string, userId: string, role: GroupRole) =>
      request<GroupMemberDto>(`/groups/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),

    removeMember: (id: string, userId: string) =>
      request<void>(`/groups/${id}/members/${userId}`, { method: 'DELETE' }),

    leave: (id: string) => request<void>(`/groups/${id}/leave`, { method: 'POST' }),
  },

  invites: {
    /** Pending invites for the logged-in user (Bandeja). */
    listPending: () => request<PendingInviteDto[]>('/invites'),

    accept: (token: string) => request<{ groupId: string }>(`/invites/${token}/accept`, { method: 'POST' }),
  },

  growth: {
    summary: (range: 'day' | 'week' = 'week') => request<GrowthSummary>(`/growth?range=${range}`),

    areas: () => request<GrowthAreaDto[]>('/growth/areas'),

    events: (cursor?: string, limit = 30) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      return request<GrowthEventsPage>(`/growth/events?${params}`);
    },

    revertEvent: (id: string) => request<void>(`/growth/events/${id}/revert`, { method: 'POST' }),

    accessActivity: () => request<AccessActivity[]>('/growth/access-activity'),
  },

  inbox: {
    list: () => request<InboxItem[]>('/inbox'),

    markSeen: (id: string) => request<void>(`/inbox/${id}/seen`, { method: 'POST' }),

    jobs: () => request<JobDto[]>('/jobs'),

    job: (id: string) => request<JobDto>(`/jobs/${id}`),

    suggestions: () => request<SuggestionDto[]>('/suggestions'),

    acceptSuggestion: (id: string) => request<void>(`/suggestions/${id}/accept`, { method: 'POST' }),

    dismissSuggestion: (id: string) => request<void>(`/suggestions/${id}/dismiss`, { method: 'POST' }),
  },

  lenses: {
    /** Saved searches (M4): live views that cut across areas. */
    create: (data: { name: string; query: string; radius?: number; sourceAreaIds?: string[] }) =>
      request<LensDto>('/lenses', json(data)),

    list: () => request<LensDto[]>('/lenses'),

    memories: (id: string) => request<MemoryResult[]>(`/lenses/${id}/memories`),

    delete: (id: string) => request<void>(`/lenses/${id}`, { method: 'DELETE' }),
  },

  billing: {
    subscription: () => request<SubscriptionDto>('/billing/subscription'),

    /** Starts checkout; the API returns the Mercado Pago hosted URL to redirect to. */
    subscribe: (plan: 'monthly' | 'annual' = 'monthly') =>
      request<{ checkoutUrl: string }>('/billing/subscription', json({ plan })),

    cancel: () => request<SubscriptionDto>('/billing/subscription/cancel', { method: 'POST' }),

    reactivate: () => request<SubscriptionDto>('/billing/subscription/reactivate', { method: 'POST' }),

    payments: () => request<BillingRow[]>('/billing/payments'),
  },

  account: {
    /** Async export; progress arrives as an inbox `job` notification. */
    requestExport: () => request<{ jobId: string; status: string }>('/account/export', { method: 'POST' }),

    delete: (emailConfirmation: string) => request<void>('/account/delete', json({ email: emailConfirmation })),
  },

  onboarding: {
    saveProfile: (displayName: string) => request<MeResponse>('/onboarding/profile', json({ displayName })),

    rescuePrompt: () => request<{ prompt: string }>('/onboarding/rescue-prompt'),

    ingestRescue: (text: string) => request<{ count: number }>('/onboarding/rescue', json({ text })),

    importChatGpt: (content: string) => request<{ queued: number }>('/onboarding/import/chatgpt', json({ content })),

    suggestSpaces: () => request<SuggestedSpace[]>('/onboarding/suggest-spaces'),
  },

  files: {
    presign: (areaId: string, name: string, mimeType: string, sizeBytes: number) =>
      request<{ uploadUrl: string; fields: Record<string, string>; s3Key: string }>(
        '/files/presign',
        json({ areaId, name, mimeType, sizeBytes }),
      ),

    create: (areaId: string, name: string, mimeType: string, sizeBytes: number, s3Key: string) =>
      request<FileDto>('/files', json({ areaId, name, mimeType, sizeBytes, s3Key })),

    list: () => request<FileDto[]>('/files'),

    delete: (id: string) => request<void>(`/files/${id}`, { method: 'DELETE' }),
  },
};

/** The full client surface. `api.mock.ts` implements this exact shape. */
export type Api = typeof realApi;

/** Per-connection usage rollup for Pulso — shape defined by GET /growth/access-activity. */
export interface AccessActivity {
  connectionId: string;
  label: string;
  totalCalls: number;
  lastSeenAt: string | null;
}

// Flip NEXT_PUBLIC_MOCK=1 to browse the whole UI with synthetic data and no
// backend (see api.mock.ts). Any other value keeps the real, cookie-authed API.
const USE_MOCK = process.env.NEXT_PUBLIC_MOCK === '1';

export const api: Api = USE_MOCK ? (mockApi as Api) : realApi;
