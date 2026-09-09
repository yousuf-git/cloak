/**
 * Which backend this app talks to.
 *
 * Cloak is self-hosted, so the address is a runtime choice, not a build
 * constant: one installer serves every team. The server store overwrites this
 * from the saved profile before any request goes out.
 *
 * What is left here only matters until a server is chosen: the env value for a
 * bundled build (see `.env.production`), and otherwise the port `pnpm dev:api`
 * listens on, so a development session works before anyone visits the connect
 * screen.
 */
let BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:4000/api/v1';

export function setApiBaseUrl(url: string): void {
  BASE_URL = url.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

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

// Which org the vault calls act on. Set by the org store when the active org
// changes; the server rejects a vault request without it.
let activeOrgId: string | null = null;

export function setActiveOrgId(orgId: string | null): void {
  activeOrgId = orgId;
}

export function getActiveOrgId(): string | null {
  return activeOrgId;
}

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
  /** Send the active org header. Required by every /vault route. */
  org?: boolean;
  raw?: boolean;
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
  const { method = 'GET', body, auth = false, org = false, raw = false, _retried = false } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && tokens.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  if (org && activeOrgId) {
    headers['X-Cloak-Org'] = activeOrgId;
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

  if (raw) {
    if (!res.ok) return parseEnvelope<T>(res);
    return (await res.text()) as T;
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
    name: string;
    authHash: string;
    cryptoSalt: string;
    wrappedDEK: string;
    recoveryWrappedDEK: string;
    identityPublicKey: string;
    wrappedIdentitySk: string;
    /** Proof of the server's ownership key. Only the first account carries one. */
    claimTicket?: string;
    defaultOrg: {
      name: string;
      wrapped_org_dek: string;
      org_recovery_salt: string;
      org_recovery_wrappedDEK: string;
    };
  }) =>
    apiRequest<{ email: string; verificationRequired: boolean; orgId: string }>('/auth/signup', {
      method: 'POST',
      body: payload,
    }),

  resendVerification: (email: string) =>
    apiRequest<{ sent: boolean }>('/auth/resend-verification', {
      method: 'POST',
      body: { email },
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
      wrappedIdentitySk?: string;
    }>('/auth/login', { method: 'POST', body: { email, authHash } }),

  twoFactor: (email: string, otp: string) =>
    apiRequest<{
      accessToken: string;
      refreshToken: string;
      wrappedDEK: string;
      wrappedIdentitySk?: string;
    }>('/auth/2fa', {
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

  status: () => apiRequest<ServiceStatusDto>('/status', { auth: true }),

  me: () => apiRequest<ProfileDto>('/me', { auth: true }),

  updateMe: (name: string) =>
    apiRequest<ProfileDto>('/me', { method: 'PATCH', body: { name }, auth: true }),

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
    apiRequest<{
      accessToken: string;
      refreshToken: string;
      wrappedDEK: string;
      wrappedIdentitySk?: string;
    }>('/auth/recovery/reset', { method: 'POST', body: payload }),

  publishIdentity: (identityPublicKey: string, wrappedIdentitySk: string) =>
    apiRequest<{ identity_public_key: string }>('/me/identity', {
      method: 'POST',
      body: {
        identity_public_key: identityPublicKey,
        wrapped_identity_sk: wrappedIdentitySk,
      },
      auth: true,
    }),
};

export interface ServiceStatusDto {
  api: { ok: boolean };
  db: { connected: boolean; name: string | null };
}

export interface ProfileDto {
  id: string;
  email: string;
  name?: string;
  is_verified: boolean;
  two_factor_enabled: boolean;
  identity_public_key?: string;
  wrapped_identity_sk?: string;
  created_at: string;
  last_login_at?: string;
}

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrgDto {
  id: string;
  name: string;
  role: Role;
  /** 'pending_key' until an admin seals the org key to this device. */
  status: 'active' | 'pending_key';
  is_owner: boolean;
  /** Empty while pending — the wrap does not exist until someone grants it. */
  wrapped_org_dek: string;
  member_count: number;
  created_at: string;
}

export interface MemberDto {
  user_id: string;
  email: string;
  name?: string;
  role: Role;
  status: 'pending_key' | 'active';
  identity_public_key?: string;
  joined_at?: string;
}

/** A person referenced by a membership — who invited, who granted. */
export interface MemberRefDto {
  user_id: string;
  email: string;
  name?: string;
}

export interface MemberDetailDto extends MemberDto {
  invited_by?: MemberRefDto;
  granted_by?: MemberRefDto;
  invited_at?: string;
  granted_at?: string;
  last_activity_at?: string;
  created_at: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
  expires_at: string;
  created_at: string;
}

/**
 * Returned once, to the admin who created it. Carries the live join key so it
 * can be handed over by chat when the server has no mail provider configured.
 * The listing endpoint never returns this.
 */
export interface CreatedInvitationDto extends InvitationDto {
  join_key: string;
  emailed: boolean;
}

export interface AuditEntryDto {
  id: string;
  action: string;
  actor_email: string | null;
  resource?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditPageDto {
  entries: AuditEntryDto[];
  next_cursor: string | null;
}

export interface OrgBootstrapBody {
  name: string;
  wrapped_org_dek: string;
  org_recovery_salt: string;
  org_recovery_wrappedDEK: string;
}

export const orgApi = {
  list: () => apiRequest<OrgDto[]>('/orgs', { auth: true }),
  create: (body: OrgBootstrapBody) =>
    apiRequest<OrgDto>('/orgs', { method: 'POST', body, auth: true }),
  rename: (orgId: string, name: string) =>
    apiRequest<{ id: string; name: string }>(`/orgs/${orgId}`, {
      method: 'PATCH',
      body: { name },
      auth: true,
    }),
  remove: (orgId: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}`, { method: 'DELETE', auth: true }),
  transfer: (orgId: string, userId: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/transfer`, {
      method: 'POST',
      body: { user_id: userId },
      auth: true,
    }),

  listMembers: (orgId: string, status?: 'pending_key' | 'active') =>
    apiRequest<MemberDto[]>(`/orgs/${orgId}/members${status ? `?status=${status}` : ''}`, {
      auth: true,
    }),
  getMember: (orgId: string, userId: string) =>
    apiRequest<MemberDetailDto>(`/orgs/${orgId}/members/${userId}`, { auth: true }),
  grantKey: (orgId: string, userId: string, wrappedOrgDek: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/members/${userId}/grant`, {
      method: 'POST',
      body: { wrapped_org_dek: wrappedOrgDek },
      auth: true,
    }),
  changeRole: (orgId: string, userId: string, role: Exclude<Role, 'owner'>) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body: { role },
      auth: true,
    }),
  removeMember: (orgId: string, userId: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/members/${userId}`, {
      method: 'DELETE',
      auth: true,
    }),

  listInvitations: (orgId: string) =>
    apiRequest<InvitationDto[]>(`/orgs/${orgId}/invitations`, { auth: true }),
  invite: (orgId: string, email: string, role: Exclude<Role, 'owner'>) =>
    apiRequest<CreatedInvitationDto>(`/orgs/${orgId}/invitations`, {
      method: 'POST',
      body: { email, role },
      auth: true,
    }),
  revokeInvitation: (orgId: string, invitationId: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/invitations/${invitationId}`, {
      method: 'DELETE',
      auth: true,
    }),

  peekInvitation: (token: string) =>
    apiRequest<{ org_name: string; role: Role; invited_by_email: string; expires_at: string }>(
      `/invitations/${token}`,
      { auth: true },
    ),
  acceptInvitation: (token: string) =>
    apiRequest<{ org_id: string; org_name: string; role: Role; status: 'pending_key' }>(
      `/invitations/${token}/accept`,
      { method: 'POST', auth: true },
    ),

  startBreakGlass: (orgId: string) =>
    apiRequest<{ org_recovery_salt: string; org_recovery_wrappedDEK: string }>(
      `/orgs/${orgId}/break-glass`,
      { method: 'POST', auth: true },
    ),
  finishBreakGlass: (orgId: string, wrappedOrgDek: string) =>
    apiRequest<{ success: boolean }>(`/orgs/${orgId}/break-glass/restore`, {
      method: 'POST',
      body: { wrapped_org_dek: wrappedOrgDek },
      auth: true,
    }),

  listAudit: (orgId: string, params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest<AuditPageDto>(`/orgs/${orgId}/audit${query ? `?${query}` : ''}`, {
      auth: true,
    });
  },
  exportAudit: (orgId: string) =>
    apiRequest<string>(`/orgs/${orgId}/audit/export.csv`, { auth: true, raw: true }),
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
  listCreds: () => apiRequest<CredDto[]>('/vault/creds', { auth: true, org: true }),
  createCred: (body: Partial<CredDto>) =>
    apiRequest<CredDto>('/vault/creds', { method: 'POST', body, auth: true, org: true }),
  updateCred: (id: string, body: Partial<CredDto>) =>
    apiRequest<CredDto>(`/vault/creds/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteCred: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/creds/${id}`, { method: 'DELETE', auth: true, org: true }),

  listApiKeys: () => apiRequest<ApiKeyDto[]>('/vault/api-keys', { auth: true, org: true }),
  createApiKey: (body: Partial<ApiKeyDto>) =>
    apiRequest<ApiKeyDto>('/vault/api-keys', { method: 'POST', body, auth: true, org: true }),
  updateApiKey: (id: string, body: Partial<ApiKeyDto>) =>
    apiRequest<ApiKeyDto>(`/vault/api-keys/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteApiKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/api-keys/${id}`, { method: 'DELETE', auth: true, org: true }),

  listAccessKeys: () => apiRequest<AccessKeyDto[]>('/vault/access-keys', { auth: true, org: true }),
  createAccessKey: (body: Partial<AccessKeyDto>) =>
    apiRequest<AccessKeyDto>('/vault/access-keys', { method: 'POST', body, auth: true, org: true }),
  updateAccessKey: (id: string, body: Partial<AccessKeyDto>) =>
    apiRequest<AccessKeyDto>(`/vault/access-keys/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteAccessKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/access-keys/${id}`, { method: 'DELETE', auth: true, org: true }),

  listSshKeys: () => apiRequest<SshKeyDto[]>('/vault/ssh-keys', { auth: true, org: true }),
  createSshKey: (body: Partial<SshKeyDto>) =>
    apiRequest<SshKeyDto>('/vault/ssh-keys', { method: 'POST', body, auth: true, org: true }),
  updateSshKey: (id: string, body: { title?: string; comment?: string; note?: string }) =>
    apiRequest<SshKeyDto>(`/vault/ssh-keys/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteSshKey: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/ssh-keys/${id}`, { method: 'DELETE', auth: true, org: true }),

  listPlatforms: () => apiRequest<PlatformDto[]>('/vault/platforms', { auth: true, org: true }),
  createPlatform: (body: { name: string; note?: string; backup_codes?: { encrypted_code: string }[] }) =>
    apiRequest<PlatformDto>('/vault/platforms', { method: 'POST', body, auth: true, org: true }),
  updatePlatform: (id: string, body: { name?: string; note?: string }) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deletePlatform: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/platforms/${id}`, { method: 'DELETE', auth: true, org: true }),
  addBackupCodes: (id: string, codes: { encrypted_code: string }[]) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}/codes`, {
      method: 'POST',
      body: { backup_codes: codes },
      auth: true,
      org: true,
    }),
  setBackupCodeUsed: (id: string, codeId: string, isUsed: boolean) =>
    apiRequest<PlatformDto>(`/vault/platforms/${id}/codes/${codeId}`, {
      method: 'PATCH',
      body: { is_used: isUsed },
      auth: true,
      org: true,
    }),

  listProjects: () => apiRequest<ProjectDto[]>('/vault/projects', { auth: true, org: true }),
  createProject: (body: { name: string; url?: string; note?: string }) =>
    apiRequest<ProjectDto>('/vault/projects', { method: 'POST', body, auth: true, org: true }),
  updateProject: (id: string, body: { name?: string; url?: string; note?: string }) =>
    apiRequest<ProjectDto>(`/vault/projects/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteProject: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/projects/${id}`, { method: 'DELETE', auth: true, org: true }),

  listEnvFiles: (projectId?: string) =>
    apiRequest<EnvFileDto[]>(`/vault/env-files${projectId ? `?project_id=${projectId}` : ''}`, {
      auth: true,
      org: true,
    }),
  createEnvFile: (body: {
    project_id: string;
    label: string;
    tag: EnvTag;
    encrypted_dotenvx_key: string | null;
    content_b64: string;
    variable_count: number;
  }) => apiRequest<EnvFileDto>('/vault/env-files', { method: 'POST', body, auth: true, org: true }),
  getEnvRaw: (id: string) =>
    apiRequest<{ content: string }>(`/vault/env-files/${id}/raw`, { auth: true, org: true }),
  updateEnvFile: (
    id: string,
    body: {
      label?: string;
      tag?: EnvTag;
      encrypted_dotenvx_key?: string | null;
      content_b64?: string;
      variable_count?: number;
    },
  ) => apiRequest<EnvFileDto>(`/vault/env-files/${id}`, { method: 'PATCH', body, auth: true, org: true }),
  deleteEnvFile: (id: string) =>
    apiRequest<{ success: boolean }>(`/vault/env-files/${id}`, { method: 'DELETE', auth: true, org: true }),
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
