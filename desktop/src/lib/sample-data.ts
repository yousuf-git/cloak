/**
 * Scaffold sample data used to render the UI before the backend/vault sync
 * lands. All values are fake placeholders — nothing here is a real secret.
 */

export type EnvTag = 'Local' | 'Staging' | 'Production' | 'Custom';

export interface SampleEnvFile {
  id: string;
  label: string;
  tag: EnvTag;
  variableCount: number;
  updatedAt: string;
}

export interface SampleProject {
  id: string;
  name: string;
  url?: string;
  note?: string;
  envFiles: SampleEnvFile[];
}

export const sampleProjects: SampleProject[] = [
  {
    id: 'p1',
    name: 'Aurora API',
    url: 'github.com/acme/aurora',
    note: 'Core billing + auth service',
    envFiles: [
      { id: 'e1', label: '.env.local', tag: 'Local', variableCount: 12, updatedAt: '2h ago' },
      { id: 'e2', label: '.env.staging', tag: 'Staging', variableCount: 18, updatedAt: '1d ago' },
      { id: 'e3', label: '.env.production', tag: 'Production', variableCount: 21, updatedAt: '3d ago' },
    ],
  },
  {
    id: 'p2',
    name: 'Nimbus Web',
    url: 'github.com/acme/nimbus',
    note: 'Marketing site + dashboard',
    envFiles: [
      { id: 'e4', label: '.env.local', tag: 'Local', variableCount: 8, updatedAt: '5h ago' },
      { id: 'e5', label: '.env.production', tag: 'Production', variableCount: 14, updatedAt: '6d ago' },
    ],
  },
  {
    id: 'p3',
    name: 'Pipeline Runner',
    note: 'CI/CD workers',
    envFiles: [
      { id: 'e6', label: '.env.ci', tag: 'Custom', variableCount: 9, updatedAt: '1w ago' },
    ],
  },
];

export interface SampleCredential {
  id: string;
  name: string;
  url?: string;
  username: string;
  password: string;
  note?: string;
}

export const sampleCredentials: SampleCredential[] = [
  {
    id: 'c1',
    name: 'AWS Root Console',
    url: 'console.aws.amazon.com',
    username: 'ops@acme.io',
    password: 'S9x!kQ2p#vLm8dRt',
    note: 'MFA required',
  },
  {
    id: 'c2',
    name: 'Postgres — Production',
    url: 'db.acme.internal',
    username: 'aurora_app',
    password: 'pg_7Yh$2nMw0Qze',
  },
  {
    id: 'c3',
    name: 'Grafana',
    url: 'grafana.acme.io',
    username: 'admin',
    password: 'gf_dash_44!zK',
  },
];

export interface SampleApiKey {
  id: string;
  label: string;
  url?: string;
  key: string;
  project?: string;
  note?: string;
}

export const sampleApiKeys: SampleApiKey[] = [
  { id: 'k1', label: 'Stripe — Live', url: 'stripe.com', key: 'sk_live_51Hb9xQ2eZvKYlo8f', project: 'Aurora API' },
  { id: 'k2', label: 'OpenAI', url: 'platform.openai.com', key: 'sk-proj-9aZ2kLmQ8vBn4Rt6', project: 'Nimbus Web' },
  { id: 'k3', label: 'Resend', url: 'resend.com', key: 're_8dKq2Lm_pWx9Zv', note: 'Transactional email' },
];

export interface SampleBackupCode {
  id: string;
  code: string;
  isUsed: boolean;
}

export interface SamplePlatform {
  id: string;
  name: string;
  note?: string;
  codes: SampleBackupCode[];
}

export const samplePlatforms: SamplePlatform[] = [
  {
    id: 'pf1',
    name: 'GitHub',
    note: 'Org owner account',
    codes: [
      { id: 'b1', code: '8fa3-2b9c', isUsed: false },
      { id: 'b2', code: '1de7-90ab', isUsed: true },
      { id: 'b3', code: 'c4f2-7e18', isUsed: false },
      { id: 'b4', code: '6a0d-3c55', isUsed: false },
      { id: 'b5', code: 'e921-4faa', isUsed: true },
      { id: 'b6', code: '77bc-01de', isUsed: false },
    ],
  },
  {
    id: 'pf2',
    name: 'Google Workspace',
    codes: [
      { id: 'b7', code: '2233-9910', isUsed: false },
      { id: 'b8', code: 'ab12-cd34', isUsed: false },
      { id: 'b9', code: '55ef-6677', isUsed: false },
    ],
  },
];
