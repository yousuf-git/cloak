const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Tokens {
  accessToken: string | null;
  refreshToken: string | null;
}

// Tokens live only in memory. Persistence (Remember-Me) is handled by the Rust
// keychain, never localStorage — this keeps bearer tokens out of the DOM.
const tokens: Tokens = { accessToken: null, refreshToken: null };

let onAuthLost: (() => void) | null = null;

export function setTokens(next: Partial<Tokens>): void {
  if ('accessToken' in next) tokens.accessToken = next.accessToken ?? null;
  if ('refreshToken' in next) tokens.refreshToken = next.refreshToken ?? null;
}

export function getRefreshToken(): string | null {
  return tokens.refreshToken;
}

export function getAccessToken(): string | null {
  return tokens.accessToken;
}

export function clearTokens(): void {
  tokens.accessToken = null;
  tokens.refreshToken = null;
}

export function onAuthLostHandler(fn: () => void): void {
  onAuthLost = fn;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  _retried?: boolean;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.code ?? 'ERROR',
      json.message ?? res.statusText,
      json.details,
    );
  }
  return (json.data ?? json) as T;
}

export async function tryRefresh(): Promise<boolean> {
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens.refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) return false;
    const data = await parseEnvelope<{ accessToken: string; refreshToken: string }>(res);
    setTokens(data);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, _retried = false } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && tokens.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Transparent one-shot refresh on 401 for authenticated calls.
  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>(path, { ...opts, _retried: true });
    }
    clearTokens();
    onAuthLost?.();
  }

  return parseEnvelope<T>(res);
}

export const api = {
  prelogin: (email: string) =>
    apiRequest<{ crypto_salt: string; two_factor_enabled: boolean }>('/auth/prelogin', {
      method: 'POST',
      body: { email },
    }),

  signup: (payload: {
    email: string;
    authHash: string;
    cryptoSalt: string;
    wrappedDEK: string;
    recoveryWrappedDEK: string;
  }) =>
    apiRequest<{ email: string; verificationRequired: boolean }>('/auth/signup', {
      method: 'POST',
      body: payload,
    }),

  verifyEmail: (email: string, code: string) =>
    apiRequest<{ verified: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: { email, code },
    }),

  login: (email: string, authHash: string) =>
    apiRequest<{
      twoFactorRequired?: boolean;
      accessToken?: string;
      refreshToken?: string;
      wrappedDEK?: string;
    }>('/auth/login', { method: 'POST', body: { email, authHash } }),

  twoFactor: (email: string, otp: string) =>
    apiRequest<{ accessToken: string; refreshToken: string; wrappedDEK: string }>('/auth/2fa', {
      method: 'POST',
      body: { email, otp },
    }),

  logout: (refreshToken: string | null) =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      auth: true,
    }),

  setTwoFactor: (enabled: boolean) =>
    apiRequest<{ two_factor_enabled: boolean }>('/me/2fa', {
      method: 'POST',
      body: { enabled },
      auth: true,
    }),

  me: () =>
    apiRequest<{
      id: string;
      email: string;
      is_verified: boolean;
      two_factor_enabled: boolean;
      created_at: string;
      last_login_at?: string;
    }>('/me', { auth: true }),

  recoveryStart: (email: string) =>
    apiRequest<{ sent: boolean }>('/auth/recovery/start', { method: 'POST', body: { email } }),

  recoveryVerify: (email: string, otp: string) =>
    apiRequest<{ crypto_salt: string; recovery_wrappedDEK: string; recoveryToken: string }>(
      '/auth/recovery/verify',
      { method: 'POST', body: { email, otp } },
    ),

  recoveryReset: (payload: {
    recoveryToken: string;
    authHash: string;
    cryptoSalt: string;
    wrappedDEK: string;
    recoveryWrappedDEK: string;
  }) =>
    apiRequest<{ accessToken: string; refreshToken: string; wrappedDEK: string }>(
      '/auth/recovery/reset',
      { method: 'POST', body: payload },
    ),
};

export interface CredDto {
  _id: string;
  name: string;
  url?: string;
  username: string;
  password: string;
  note?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyDto {
  _id: string;
  label: string;
  url?: string;
  key: string;
  note?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AccessKeyDto {
  _id: string;
  title: string;
  access_key_id: string; // plaintext — searchable
  secret_access_key: string; // ciphertext
  note?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export type SshKeyType = 'RSA' | 'ED25519';
export type SshKeyFormat = 'PEM' | 'PPK';

export interface SshKeyDto {
  _id: string;
  title: string;
  key_type: SshKeyType;
  format: SshKeyFormat;
  comment?: string;
  private_key: string; // ciphertext
  note?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BackupCodeDto {
  _id: string;
  encrypted_code: string;
  is_used: boolean;
  used_at?: string;
}

export interface PlatformDto {
  _id: string;
  name: string;
  note?: string;
  backup_codes: BackupCodeDto[];
  created_at: string;
  updated_at: string;
}

export interface ProjectDto {
  _id: string;
  name: string;
  url?: string;
  note?: string;
}

export const vaultApi = {
  listCreds: () => apiRequest<CredDto[]>('/vault/creds', { auth: true }),
  createCred: (body: Partial<CredDto>) =>
    apiRequest<CredDto>('/vault/creds', { method: 'POST', body, auth: true }),
  updateCred: (id: string, body: Partial<CredDto>) =>
    apiRequest<CredDto>(`/vault/creds/${id}`, { method: 'PATCH', body, auth: true }),
  deleteCred: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/creds/${id}`, { method: 'DELETE', auth: true }),

  listApiKeys: () => apiRequest<ApiKeyDto[]>('/vault/api-keys', { auth: true }),
  createApiKey: (body: Partial<ApiKeyDto>) =>
    apiRequest<ApiKeyDto>('/vault/api-keys', { method: 'POST', body, auth: true }),
  updateApiKey: (id: string, body: Partial<ApiKeyDto>) =>
    apiRequest<ApiKeyDto>(`/vault/api-keys/${id}`, { method: 'PATCH', body, auth: true }),
  deleteApiKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/api-keys/${id}`, { method: 'DELETE', auth: true }),

  listAccessKeys: () => apiRequest<AccessKeyDto[]>('/vault/access-keys', { auth: true }),
  createAccessKey: (body: Partial<AccessKeyDto>) =>
    apiRequest<AccessKeyDto>('/vault/access-keys', { method: 'POST', body, auth: true }),
  updateAccessKey: (id: string, body: Partial<AccessKeyDto>) =>
    apiRequest<AccessKeyDto>(`/vault/access-keys/${id}`, { method: 'PATCH', body, auth: true }),
  deleteAccessKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/access-keys/${id}`, { method: 'DELETE', auth: true }),

  listSshKeys: () => apiRequest<SshKeyDto[]>('/vault/ssh-keys', { auth: true }),
  createSshKey: (body: Partial<SshKeyDto>) =>
    apiRequest<SshKeyDto>('/vault/ssh-keys', { method: 'POST', body, auth: true }),
  updateSshKey: (id: string, body: { title?: string; comment?: string; note?: string }) =>
    apiRequest<SshKeyDto>(`/vault/ssh-keys/${id}`, { method: 'PATCH', body, auth: true }),
  deleteSshKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/ssh-keys/${id}`, { method: 'DELETE', auth: true }),

  listPlatforms: () => apiRequest<PlatformDto[]>('/vault/platforms', { auth: true }),
  createPlatform: (body: { name: string; note?: string; backup_codes?: { encrypted_code: string }[] }) =>
    apiRequest<PlatformDto>('/vault/platforms', { method: 'POST', body, auth: true }),
  updatePlatform: (id: string, body: { name?: string; note?: string }) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}`, { method: 'PATCH', body, auth: true }),
  deletePlatform: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/platforms/${id}`, { method: 'DELETE', auth: true }),
  addBackupCodes: (id: string, codes: { encrypted_code: string }[]) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}/codes`, {
      method: 'POST',
      body: { backup_codes: codes },
      auth: true,
    }),
  setBackupCodeUsed: (id: string, codeId: string, isUsed: boolean) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}/codes/${codeId}`, {
      method: 'PATCH',
      body: { is_used: isUsed },
      auth: true,
    }),

  listProjects: () => apiRequest<ProjectDto[]>('/vault/projects', { auth: true }),
  createProject: (body: { name: string; url?: string; note?: string }) =>
    apiRequest<ProjectDto>('/vault/projects', { method: 'POST', body, auth: true }),
  updateProject: (id: string, body: { name?: string; url?: string; note?: string }) =>
    apiRequest<ProjectDto>(`/vault/projects/${id}`, { method: 'PATCH', body, auth: true }),
  deleteProject: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/projects/${id}`, { method: 'DELETE', auth: true }),

  listEnvFiles: (projectId?: string) =>
    apiRequest<EnvFileDto[]>(`/vault/env-files${projectId ? `?project_id=${projectId}` : ''}`, {
      auth: true,
    }),
  createEnvFile: (body: {
    project_id: string;
    label: string;
    tag: EnvTag;
    encrypted_dotenvx_key: string | null;
    content_b64: string;
    variable_count: number;
  }) => apiRequest<EnvFileDto>('/vault/env-files', { method: 'POST', body, auth: true }),
  getEnvRaw: (id: string) =>
    apiRequest<{ content: string }>(`/vault/env-files/${id}/raw`, { auth: true }),
  updateEnvFile: (
    id: string,
    body: {
      label?: string;
      tag?: EnvTag;
      encrypted_dotenvx_key?: string | null;
      content_b64?: string;
      variable_count?: number;
    },
  ) => apiRequest<EnvFileDto>(`/vault/env-files/${id}`, { method: 'PATCH', body, auth: true }),
  deleteEnvFile: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/env-files/${id}`, { method: 'DELETE', auth: true }),
};

export type EnvTag = 'Local' | 'Staging' | 'Production' | 'Custom';

export interface EnvFileDto {
  _id: string;
  project_id: string;
  label: string;
  tag: EnvTag;
  encrypted_dotenvx_key: string | null;
  variable_count: number;
  created_at: string;
  updated_at: string;
}
