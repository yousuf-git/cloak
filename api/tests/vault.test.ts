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

describe('project links', () => {
  async function projectFor(headers: Record<string, string>, name = 'Aurora') {
    const res = await request(app).post('/api/v1/vault/projects').set(headers).send({ name }).expect(201);
    return res.body.data._id as string;
  }

  it('links a credential to a project, moves it, and makes it standalone again', async () => {
    const { headers } = await createAccount(app, 'links@example.com');
    const aurora = await projectFor(headers);
    const borealis = await projectFor(headers, 'Borealis');

    const created = await request(app)
      .post('/api/v1/vault/creds')
      .set(headers)
      .send({ name: 'DB', username: 'admin', password: 'Y2lwaGVy', project_id: aurora })
      .expect(201);
    const id = created.body.data._id;
    expect(created.body.data.project_id).toBe(aurora);

    const moved = await request(app)
      .patch(`/api/v1/vault/creds/${id}`)
      .set(headers)
      .send({ project_id: borealis })
      .expect(200);
    expect(moved.body.data.project_id).toBe(borealis);

    const standalone = await request(app)
      .patch(`/api/v1/vault/creds/${id}`)
      .set(headers)
      .send({ project_id: null })
      .expect(200);
    expect(standalone.body.data.project_id).toBeUndefined();
  });

  it('lets an SSH key change project without touching its key material', async () => {
    const { headers } = await createAccount(app, 'ssh-links@example.com');
    const aurora = await projectFor(headers);

    const created = await request(app)
      .post('/api/v1/vault/ssh-keys')
      .set(headers)
      .send({ title: 'bastion', key_type: 'ED25519', format: 'PEM', private_key: 'Y2lwaGVy' })
      .expect(201);

    const linked = await request(app)
      .patch(`/api/v1/vault/ssh-keys/${created.body.data._id}`)
      .set(headers)
      .send({ project_id: aurora })
      .expect(200);
    expect(linked.body.data.project_id).toBe(aurora);
    expect(linked.body.data.private_key).toBe('Y2lwaGVy');
  });

  it('moves an env file to another project, but never out of every project', async () => {
    const { headers, orgId } = await createAccount(app, 'env-move@example.com');
    const aurora = await projectFor(headers);
    const borealis = await projectFor(headers, 'Borealis');
    const other = await createAccount(app, 'env-move-other@example.com');
    const foreign = await projectFor(other.headers, 'Foreign');

    const file = await request(app)
      .post('/api/v1/vault/env-files')
      .set(headers)
      .send({
        project_id: aurora,
        label: '.env',
        encrypted_dotenvx_key: null,
        content_b64: Buffer.from('A="encrypted:x"').toString('base64'),
        variable_count: 1,
      })
      .expect(201);
    const id = file.body.data._id;

    const moved = await request(app)
      .patch(`/api/v1/vault/env-files/${id}`)
      .set(headers)
      .send({ project_id: borealis })
      .expect(200);
    expect(moved.body.data.project_id).toBe(borealis);

    for (const project_id of [foreign, null]) {
      await request(app)
        .patch(`/api/v1/vault/env-files/${id}`)
        .set(headers)
        .send({ project_id })
        .expect(400);
    }

    const audit = await request(app).get(`/api/v1/orgs/${orgId}/audit`).set(headers).expect(200);
    const entry = audit.body.data.entries.find(
      (e: { action: string; context?: Record<string, unknown> }) =>
        e.action === 'env:update' && e.context?.moved_from,
    );
    expect(entry.context).toMatchObject({ project: 'Borealis', moved_from: 'Aurora' });
  });

  it('leaves items standalone, not dangling, when their project is deleted', async () => {
    const { headers } = await createAccount(app, 'project-delete@example.com');
    const aurora = await projectFor(headers);

    const bodies: [string, Record<string, unknown>][] = [
      ['creds', { name: 'DB', username: 'admin', password: 'Y2lwaGVy' }],
      ['api-keys', { label: 'Stripe', key: 'Y2lwaGVy' }],
      ['access-keys', { title: 'Deploy', access_key_id: 'AKIA1', secret_access_key: 'Y2lwaGVy' }],
      ['ssh-keys', { title: 'bastion', key_type: 'RSA', format: 'PEM', private_key: 'Y2lwaGVy' }],
    ];
    for (const [path, body] of bodies) {
      await request(app)
        .post(`/api/v1/vault/${path}`)
        .set(headers)
        .send({ ...body, project_id: aurora })
        .expect(201);
    }

    await request(app).delete(`/api/v1/vault/projects/${aurora}`).set(headers).expect(200);

    for (const [path] of bodies) {
      const list = await request(app).get(`/api/v1/vault/${path}`).set(headers).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].project_id).toBeUndefined();
    }
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
