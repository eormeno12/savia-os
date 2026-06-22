const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4400';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export const api = {
  requestOtp: (email: string) =>
    request<{ message: string }>('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    request<{ id: string; email: string; createdAt: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ id: string; email: string }>('/auth/me'),

  files: {
    presign: (name: string, mimeType: string, sizeBytes: number) =>
      request<{ uploadUrl: string; fields: Record<string, string>; s3Key: string }>('/files/presign', {
        method: 'POST',
        body: JSON.stringify({ name, mimeType, sizeBytes }),
      }),

    create: (name: string, mimeType: string, sizeBytes: number, s3Key: string) =>
      request<{ id: string }>('/files', {
        method: 'POST',
        body: JSON.stringify({ name, mimeType, sizeBytes, s3Key }),
      }),

    list: () =>
      request<Array<{
        id: string; name: string; mimeType: string; sizeBytes: number;
        status: 'pending' | 'processing' | 'indexed' | 'failed';
        source: string; memoryCount?: number; createdAt: string; indexedAt: string | null;
      }>>('/files'),

    delete: (id: string) =>
      fetch(`${API_BASE}/files/${id}`, { method: 'DELETE', credentials: 'include' }),
  },

  spaces: {
    create: (description: string) =>
      request<SpaceDto>('/spaces', {
        method: 'POST',
        body: JSON.stringify({ description }),
      }),

    list: () => request<SpaceDto[]>('/spaces'),

    update: (id: string, data: { description?: string; name?: string }) =>
      request<SpaceDto>(`/spaces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      fetch(`${API_BASE}/spaces/${id}`, { method: 'DELETE', credentials: 'include' }),

    memories: (id: string, cursor?: string, limit = 20) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) params.set('cursor', cursor);
      return request<SpaceMemoryDto[]>(`/spaces/${id}/memories?${params}`);
    },

    removeMemory: (spaceId: string, memoryId: string) =>
      fetch(`${API_BASE}/spaces/${spaceId}/memories/${memoryId}`, {
        method: 'DELETE', credentials: 'include',
      }),

    addMemory: (spaceId: string, memoryId: string) =>
      fetch(`${API_BASE}/spaces/${spaceId}/memories/${memoryId}`, {
        method: 'POST', credentials: 'include',
      }),
  },

  connections: {
    create: (label: string) =>
      request<ConnectionCreateResponse>('/connections', {
        method: 'POST',
        body: JSON.stringify({ label }),
      }),

    list: () => request<ConnectionDto[]>('/connections'),

    revoke: (id: string) =>
      fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE', credentials: 'include' }),

    addGrant: (connectionId: string, spaceId: string) =>
      fetch(`${API_BASE}/connections/${connectionId}/grants`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId }),
      }),

    removeGrant: (connectionId: string, spaceId: string) =>
      fetch(`${API_BASE}/connections/${connectionId}/grants/${spaceId}`, {
        method: 'DELETE', credentials: 'include',
      }),
  },

  growth: {
    areas: () => request<AreaDto[]>('/growth/areas'),

    summary: (range: 'day' | 'week' = 'week') =>
      request<GrowthSummary>(`/growth?range=${range}`),

    accessActivity: () =>
      request<AccessActivity[]>('/growth/access-activity'),
  },

  onboarding: {
    rescuePrompt: () =>
      request<{ prompt: string }>('/onboarding/rescue-prompt'),

    ingestRescue: (text: string) =>
      request<{ count: number }>('/onboarding/rescue', {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),

    importChatGpt: (content: string) =>
      request<{ queued: number }>('/onboarding/import/chatgpt', {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),

    suggestSpaces: () =>
      request<SuggestedSpace[]>('/onboarding/suggest-spaces'),
  },
};

interface SpaceDto {
  id: string; name: string; description: string;
  version: number; memoryCount: number; reclassifying: boolean;
  createdAt: string; updatedAt: string;
}

interface SpaceMemoryDto {
  memoryId: string; text: string; score?: number;
  manualOverride: boolean;
  otherSpaces: { id: string; name: string }[];
}

interface ConnectionDto {
  id: string; label: string;
  lastSeenAt: string | null; revoked: boolean;
  spaceIds: string[]; createdAt: string;
}

interface ConnectionCreateResponse extends ConnectionDto {
  token: string;
}

export interface AreaDto {
  spaceId: string;
  name: string;
  count: number;
  share: number;
}

export interface GrowthPoint {
  bucket: string;
  spaceId: string;
  spaceName: string;
  count: number;
}

export interface GrowthSummary {
  points: GrowthPoint[];
  todayTotal: number;
  weekTotal: number;
  weekDelta: number;
}

export interface AccessActivity {
  connectionId: string;
  label: string;
  totalCalls: number;
  lastSeenAt: string | null;
}

export interface SuggestedSpace {
  name: string;
  description: string;
  memoryCount: number;
  examples: string[];
}

// onboarding namespace added to api object below
declare global { interface Window {} }

