import { create } from 'zustand';
import type { CredDto, ApiKeyDto, PlatformDto, ProjectDto, EnvFileDto, EnvTag } from '@/lib/api';
import {
  sampleCredentials,
  sampleApiKeys,
  samplePlatforms,
  sampleProjects,
} from '@/lib/sample-data';
import { sbEncrypt } from '@/lib/sandbox-cipher';

/** Sandbox env files carry fake raw/plaintext so View + Decrypt work offline. */
export interface SandboxEnvFile extends EnvFileDto {
  raw: string;
  plain: string;
}

let counter = 1000;
const nextId = () => `sbx-${++counter}`;
const now = () => new Date().toISOString();

/**
 * In-memory dataset for Sandbox mode. Seeded from sample data; fully mutable so
 * the app feels live, but nothing is persisted or encrypted. Secret fields hold
 * plaintext (Sandbox `decrypt`/`encrypt` are identity functions).
 */
interface SandboxState {
  creds: CredDto[];
  apiKeys: ApiKeyDto[];
  platforms: PlatformDto[];
  projects: ProjectDto[];

  addCred: (c: Partial<CredDto>) => void;
  updateCred: (id: string, c: Partial<CredDto>) => void;
  removeCred: (id: string) => void;

  addApiKey: (k: Partial<ApiKeyDto>) => void;
  updateApiKey: (id: string, k: Partial<ApiKeyDto>) => void;
  removeApiKey: (id: string) => void;

  addPlatform: (name: string, note: string | undefined, codes: string[]) => void;
  removePlatform: (id: string) => void;
  addCodes: (id: string, codes: string[]) => void;
  toggleCode: (id: string, codeId: string, used: boolean) => void;

  addProject: (p: { name: string; url?: string; note?: string }) => void;
  updateProject: (id: string, p: Partial<ProjectDto>) => void;
  removeProject: (id: string) => void;

  envFiles: SandboxEnvFile[];
  addEnvFile: (f: {
    project_id: string;
    label: string;
    tag: EnvTag;
    plain: string;
    hasKey: boolean;
  }) => void;
  updateEnvFile: (id: string, plain: string) => void;
  removeEnvFile: (id: string) => void;
}

const seedCreds: CredDto[] = sampleCredentials.map((c) => ({
  _id: c.id,
  name: c.name,
  url: c.url,
  username: sbEncrypt(c.username),
  password: sbEncrypt(c.password),
  note: c.note,
  created_at: now(),
  updated_at: now(),
}));

const seedApiKeys: ApiKeyDto[] = sampleApiKeys.map((k) => ({
  _id: k.id,
  label: k.label,
  url: k.url,
  key: sbEncrypt(k.key),
  note: k.note,
  created_at: now(),
  updated_at: now(),
}));

const seedPlatforms: PlatformDto[] = samplePlatforms.map((p) => ({
  _id: p.id,
  name: p.name,
  note: p.note,
  backup_codes: p.codes.map((c) => ({ _id: c.id, encrypted_code: sbEncrypt(c.code), is_used: c.isUsed })),
  created_at: now(),
  updated_at: now(),
}));

const seedProjects: ProjectDto[] = sampleProjects.map((p) => ({
  _id: p.id,
  name: p.name,
  url: p.url,
  note: p.note,
}));

function fakePlain(label: string): string {
  return `# ${label}\nDATABASE_URL=postgres://user:pass@db.internal:5432/app\nAPI_KEY=sk-live-9aZ2kLmQ8vBn4Rt6\nJWT_SECRET=super-secret-value-here\n`;
}

function fakeRaw(label: string, hasKey: boolean): string {
  if (!hasKey) {
    return `# ${label} (imported, no key provided)\nDATABASE_URL="encrypted:BExternalOpaqueBlob=="\nAPI_KEY="encrypted:AnotherOpaqueBlob=="\n`;
  }
  return `#/ dotenvx encrypted (Cloak) /\nDOTENV_PUBLIC_KEY="03a1b2c3d4e5f6..."\nDATABASE_URL="encrypted:BFa9k2Lm...=="\nAPI_KEY="encrypted:BGx7p1Qw...=="\nJWT_SECRET="encrypted:BHz3n8Rt...=="\n`;
}

const seedEnvFiles: SandboxEnvFile[] = sampleProjects.flatMap((p) =>
  p.envFiles.map((e) => ({
    _id: e.id,
    project_id: p.id,
    label: e.label,
    tag: e.tag,
    encrypted_dotenvx_key: e.tag === 'Production' ? null : 'sandbox-wrapped-key',
    variable_count: e.variableCount,
    created_at: now(),
    updated_at: now(),
    raw: fakeRaw(e.label, e.tag !== 'Production'),
    plain: fakePlain(e.label),
  })),
);

export const useSandboxData = create<SandboxState>((set) => ({
  creds: seedCreds,
  apiKeys: seedApiKeys,
  platforms: seedPlatforms,
  projects: seedProjects,

  addCred: (c) =>
    set((s) => ({
      creds: [
        {
          _id: nextId(),
          name: c.name ?? 'Untitled',
          url: c.url,
          username: c.username ?? '',
          password: c.password ?? '',
          note: c.note,
          created_at: now(),
          updated_at: now(),
        },
        ...s.creds,
      ],
    })),
  updateCred: (id, c) =>
    set((s) => ({ creds: s.creds.map((x) => (x._id === id ? { ...x, ...c, updated_at: now() } : x)) })),
  removeCred: (id) => set((s) => ({ creds: s.creds.filter((x) => x._id !== id) })),

  addApiKey: (k) =>
    set((s) => ({
      apiKeys: [
        {
          _id: nextId(),
          label: k.label ?? 'Untitled',
          url: k.url,
          key: k.key ?? '',
          note: k.note,
          created_at: now(),
          updated_at: now(),
        },
        ...s.apiKeys,
      ],
    })),
  updateApiKey: (id, k) =>
    set((s) => ({ apiKeys: s.apiKeys.map((x) => (x._id === id ? { ...x, ...k, updated_at: now() } : x)) })),
  removeApiKey: (id) => set((s) => ({ apiKeys: s.apiKeys.filter((x) => x._id !== id) })),

  addPlatform: (name, note, codes) =>
    set((s) => ({
      platforms: [
        {
          _id: nextId(),
          name,
          note,
          backup_codes: codes.map((code) => ({ _id: nextId(), encrypted_code: code, is_used: false })),
          created_at: now(),
          updated_at: now(),
        },
        ...s.platforms,
      ],
    })),
  removePlatform: (id) => set((s) => ({ platforms: s.platforms.filter((x) => x._id !== id) })),
  addCodes: (id, codes) =>
    set((s) => ({
      platforms: s.platforms.map((p) =>
        p._id === id
          ? {
              ...p,
              backup_codes: [
                ...p.backup_codes,
                ...codes.map((code) => ({ _id: nextId(), encrypted_code: code, is_used: false })),
              ],
            }
          : p,
      ),
    })),
  toggleCode: (id, codeId, used) =>
    set((s) => ({
      platforms: s.platforms.map((p) =>
        p._id === id
          ? {
              ...p,
              backup_codes: p.backup_codes.map((c) =>
                c._id === codeId ? { ...c, is_used: used } : c,
              ),
            }
          : p,
      ),
    })),

  addProject: (p) => set((s) => ({ projects: [...s.projects, { _id: nextId(), ...p }] })),
  updateProject: (id, p) =>
    set((s) => ({ projects: s.projects.map((x) => (x._id === id ? { ...x, ...p } : x)) })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((x) => x._id !== id),
      envFiles: s.envFiles.filter((e) => e.project_id !== id),
    })),

  envFiles: seedEnvFiles,
  addEnvFile: (f) =>
    set((s) => {
      const id = nextId();
      return {
        envFiles: [
          {
            _id: id,
            project_id: f.project_id,
            label: f.label,
            tag: f.tag,
            encrypted_dotenvx_key: f.hasKey ? 'sandbox-wrapped-key' : null,
            variable_count: f.plain.split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).length,
            created_at: now(),
            updated_at: now(),
            raw: fakeRaw(f.label, f.hasKey),
            plain: f.plain,
          },
          ...s.envFiles,
        ],
      };
    }),
  updateEnvFile: (id, plain) =>
    set((s) => ({
      envFiles: s.envFiles.map((e) =>
        e._id === id
          ? {
              ...e,
              plain,
              variable_count: plain.split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).length,
              updated_at: now(),
            }
          : e,
      ),
    })),
  removeEnvFile: (id) => set((s) => ({ envFiles: s.envFiles.filter((e) => e._id !== id) })),
}));
