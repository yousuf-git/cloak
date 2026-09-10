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

async function authHeader() {
  const account = await createAccount(app, 'vault@example.com');
  return account.headers;
}

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

describe('vault credentials', () => {
  it('requires auth', async () => {
    await request(app).get('/api/v1/vault/creds').expect(401);
  });

  it('creates, lists, updates and deletes a credential', async () => {
    const h = await authHeader();
    const create = await request(app)
      .post('/api/v1/vault/creds')
      .set(h)
      .send({ name: 'AWS', username: 'Y2lwaGVy', password: 'Y2lwaGVy2' })
      .expect(201);
    const id = create.body.data._id ?? create.body.data.id;

    const list = await request(app).get('/api/v1/vault/creds').set(h).expect(200);
    expect(list.body.data).toHaveLength(1);

    await request(app).patch(`/api/v1/vault/creds/${id}`).set(h).send({ name: 'AWS Prod' }).expect(200);
    await request(app).delete(`/api/v1/vault/creds/${id}`).set(h).expect(200);

    const empty = await request(app).get('/api/v1/vault/creds').set(h).expect(200);
    expect(empty.body.data).toHaveLength(0);
  });

  it('rejects invalid ciphertext body', async () => {
    const h = await authHeader();
    await request(app).post('/api/v1/vault/creds').set(h).send({ name: 'x' }).expect(400);
  });
});

describe('vault platforms + backup codes', () => {
  it('manages backup codes and used state', async () => {
    const h = await authHeader();
    const create = await request(app)
      .post('/api/v1/vault/platforms')
      .set(h)
      .send({ name: 'GitHub', backup_codes: [{ encrypted_code: 'Y29kZTE=' }] })
      .expect(201);
    const id = create.body.data._id ?? create.body.data.id;
    const codeId = create.body.data.backup_codes[0]._id;

    const marked = await request(app)
      .patch(`/api/v1/vault/platforms/${id}/codes/${codeId}`)
      .set(h)
      .send({ is_used: true })
      .expect(200);
    expect(marked.body.data.backup_codes[0].is_used).toBe(true);

    await request(app)
      .post(`/api/v1/vault/platforms/${id}/codes`)
      .set(h)
      .send({ backup_codes: [{ encrypted_code: 'Y29kZTI=' }] })
      .expect(200);
    const list = await request(app).get('/api/v1/vault/platforms').set(h).expect(200);
    expect(list.body.data[0].backup_codes).toHaveLength(2);
  });
});

describe('vault projects', () => {
  it('creates and lists org-owned projects', async () => {
    const h = await authHeader();
    await request(app).post('/api/v1/vault/projects').set(h).send({ name: 'Aurora' }).expect(201);
    const list = await request(app).get('/api/v1/vault/projects').set(h).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe('Aurora');
  });
});

describe('org scoping', () => {
  it('rejects a request with no org header', async () => {
    const account = await createAccount(app, 'noorg@example.com');
    await request(app)
      .get('/api/v1/vault/creds')
      .set({ Authorization: `Bearer ${account.token}` })
      .expect(400);
  });

  it('does not leak one org\'s secrets to a member of another', async () => {
    const alice = await createAccount(app, 'alice@example.com');
    const bob = await createAccount(app, 'bob@example.com');

    await request(app)
      .post('/api/v1/vault/creds')
      .set(alice.headers)
      .send({ name: 'Alice secret', username: 'YQ==', password: 'Y2lwaGVy' })
      .expect(201);

    const bobsView = await request(app).get('/api/v1/vault/creds').set(bob.headers).expect(200);
    expect(bobsView.body.data).toHaveLength(0);

    // Bob naming Alice's org outright is rejected: he has no membership in it.
    await request(app)
      .get('/api/v1/vault/creds')
      .set({ Authorization: `Bearer ${bob.token}`, 'X-Cloak-Org': alice.orgId })
      .expect(403);
  });

  it('refuses a project id belonging to another org', async () => {
    const alice = await createAccount(app, 'alice2@example.com');
    const bob = await createAccount(app, 'bob2@example.com');

    const project = await request(app)
      .post('/api/v1/vault/projects')
      .set(alice.headers)
      .send({ name: 'Aurora' })
      .expect(201);

    await request(app)
      .post('/api/v1/vault/creds')
      .set(bob.headers)
      .send({
        name: 'Cross-org',
        username: 'YQ==',
        password: 'Y2lwaGVy',
        project_id: project.body.data._id,
      })
      .expect(400);
  });
});

describe('service status', () => {
  it('requires auth', async () => {
    await request(app).get('/api/v1/status').expect(401);
  });

  it('reports the api, the database and email without exposing the key', async () => {
    const h = await authHeader();
    const res = await request(app).get('/api/v1/status').set(h).expect(200);
    expect(res.body.data.api).toEqual({ ok: true });
    expect(res.body.data.db).toEqual({
      connected: true,
      name: 'cloak-test',
      cluster: '127.0.0.1:27017',
    });
    expect(typeof res.body.data.email.configured).toBe('boolean');
    const masked: string | null = res.body.data.email.api_key_masked;
    if (masked !== null) {
      expect(masked).toContain('*');
      expect(masked).not.toBe(process.env.RESEND_API_KEY);
    }
  });
});
