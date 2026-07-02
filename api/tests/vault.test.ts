import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
  sendRecoveryEmail: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

const SIGNUP = {
  email: 'vault@example.com',
  authHash: 'YXV0aA==',
  cryptoSalt: 'c29tZS1zYWx0LTE2Ynl0ZXNfXw==',
  wrappedDEK: 'd3JhcHBlZA==',
  recoveryWrappedDEK: 'cmVjb3Zlcnk=',
};

let token = '';

async function authHeader() {
  await request(app).post('/api/v1/auth/signup').send(SIGNUP).expect(201);
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: SIGNUP.email, authHash: SIGNUP.authHash })
    .expect(200);
  token = login.body.data.accessToken;
  return { Authorization: `Bearer ${token}` };
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
  it('creates and lists embedded projects', async () => {
    const h = await authHeader();
    await request(app).post('/api/v1/vault/projects').set(h).send({ name: 'Aurora' }).expect(201);
    const list = await request(app).get('/api/v1/vault/projects').set(h).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].name).toBe('Aurora');
  });
});
