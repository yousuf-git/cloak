import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
  sendRecoveryEmail: vi.fn(async () => {}),
  sendInvitationEmail: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
const { createAccount } = await import('./helpers.js');
const app = createApp();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

/** 25 project entries, 3 credential entries, and whatever signup itself recorded. */
async function busyOrg() {
  const owner = await createAccount(app, 'audit-query@example.com');
  for (let i = 0; i < 25; i += 1) {
    await request(app)
      .post('/api/v1/vault/projects')
      .set(owner.headers)
      .send({ name: i === 7 ? 'Borealis' : `Project ${i}` })
      .expect(201);
  }
  for (let i = 0; i < 3; i += 1) {
    await request(app)
      .post('/api/v1/vault/creds')
      .set(owner.headers)
      .send({ name: `Login ${i}`, username: 'u', password: 'Y2lwaGVy' })
      .expect(201);
  }
  return owner;
}

function audit(owner: { headers: Record<string, string>; orgId: string }, query: Record<string, string | number>) {
  return request(app).get(`/api/v1/orgs/${owner.orgId}/audit`).query(query).set(owner.headers);
}

describe('audit log pages', () => {
  it('numbers pages and reports the totals a pager needs', async () => {
    const owner = await busyOrg();
    const all = (await audit(owner, { page: 1, limit: 100 }).expect(200)).body.data;
    const total: number = all.total;
    expect(total).toBeGreaterThanOrEqual(28);

    const first = (await audit(owner, { page: 1, limit: 20 }).expect(200)).body.data;
    const second = (await audit(owner, { page: 2, limit: 20 }).expect(200)).body.data;

    expect(first).toMatchObject({ total, page: 1, page_size: 20, page_count: Math.ceil(total / 20) });
    expect(first.entries).toHaveLength(20);
    expect(second.entries).toHaveLength(total - 20);
    const ids = new Set(first.entries.map((e: { id: string }) => e.id));
    expect(second.entries.some((e: { id: string }) => ids.has(e.id))).toBe(false);
  });

  it('refuses a page number below one', async () => {
    const owner = await createAccount(app, 'audit-page-zero@example.com');
    await audit(owner, { page: 0 }).expect(400);
  });
});

describe('audit log filters', () => {
  it('narrows to one area of the vault', async () => {
    const owner = await busyOrg();
    const projects = (await audit(owner, { page: 1, limit: 20, area: 'project' }).expect(200)).body.data;
    const creds = (await audit(owner, { page: 1, limit: 20, area: 'cred' }).expect(200)).body.data;

    expect(projects.total).toBe(25);
    expect(projects.page_count).toBe(2);
    expect(creds.total).toBe(3);
    expect(creds.entries.every((e: { action: string }) => e.action.startsWith('cred:'))).toBe(true);
  });

  it('searches names, actions and people, and treats the search as text', async () => {
    const owner = await busyOrg();
    const byName = (await audit(owner, { page: 1, limit: 20, q: 'borea' }).expect(200)).body.data;
    expect(byName.total).toBe(1);
    expect(byName.entries[0].target_label).toBe('Borealis');

    const byAction = (await audit(owner, { page: 1, limit: 20, q: 'CRED:create' }).expect(200)).body.data;
    expect(byAction.total).toBe(3);

    const byPerson = (await audit(owner, { page: 1, limit: 100, q: 'audit-query@' }).expect(200)).body.data;
    expect(byPerson.total).toBeGreaterThanOrEqual(28);

    const special = (await audit(owner, { page: 1, limit: 20, q: 'a.b(' }).expect(200)).body.data;
    expect(special.total).toBe(0);
  });

  it('combines filters, including a time window', async () => {
    const owner = await busyOrg();
    const future = new Date(Date.now() + 60_000).toISOString();
    const none = (await audit(owner, { page: 1, limit: 20, area: 'cred', from: future }).expect(200)).body.data;
    expect(none).toMatchObject({ total: 0, page_count: 0, entries: [] });

    const past = new Date(Date.now() - 60 * 60_000).toISOString();
    const recent = (await audit(owner, { page: 1, limit: 20, area: 'cred', from: past }).expect(200)).body.data;
    expect(recent.total).toBe(3);

    const failures = (await audit(owner, { page: 1, limit: 20, outcome: 'failure' }).expect(200)).body.data;
    expect(failures.total).toBe(0);
  });

  it('exports what the filters show', async () => {
    const owner = await busyOrg();
    const csv = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/audit/export.csv`)
      .query({ area: 'cred', from: new Date(Date.now() - 60 * 60_000).toISOString() })
      .set(owner.headers)
      .expect(200);
    expect(csv.text.trim().split('\n')).toHaveLength(4);
  });
});
