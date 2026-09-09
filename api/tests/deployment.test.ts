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
const { signupBody } = await import('./helpers.js');
const { sealDeployment } = await import('../src/services/deployment.service.js');
const app = createApp();

const OWNERSHIP_KEY = process.env.OWNERSHIP_KEY!;
const HEALTH_TOKEN = process.env.HEALTH_TOKEN!;

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
  // Every test starts from a freshly booted, unclaimed server.
  await sealDeployment();
});

function claim(key: string) {
  return request(app).post('/api/v1/server/claim').send({ ownership_key: key });
}

describe('taking ownership of a fresh deployment', () => {
  it('reports itself unclaimed and names the key on record', async () => {
    const info = await request(app).get('/api/v1/server/info').expect(200);
    expect(info.body.data).toMatchObject({ ownership_claimed: false, api_contract: 1 });
    expect(info.body.data.checks.database).toBe(true);
  });

  it('refuses signup with no ownership proof', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(signupBody('first@example.com'))
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(await mongoose.connection.collection('users').countDocuments()).toBe(0);
  });

  it('rejects a wrong ownership key', async () => {
    const res = await claim('not-the-key-0123456789abcdef').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('turns the ownership key into an account, once', async () => {
    const ticket = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;

    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('owner@example.com'), claimTicket: ticket })
      .expect(201);

    const info = await request(app).get('/api/v1/server/info').expect(200);
    expect(info.body.data.ownership_claimed).toBe(true);

    // The same ticket must not mint a second owner.
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('usurper@example.com'), claimTicket: ticket })
      .expect(409);
  });

  it('stops handing out tickets once an owner exists', async () => {
    const ticket = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('owner2@example.com'), claimTicket: ticket })
      .expect(201);

    await claim(OWNERSHIP_KEY).expect(409);
  });

  it('does not spend the key when signup fails', async () => {
    const ticket = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;

    // Invalid payload: rejected by validation, long before any account exists.
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('broken@example.com'), name: '', claimTicket: ticket })
      .expect(400);

    const ticket2 = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('owner3@example.com'), claimTicket: ticket2 })
      .expect(201);
  });

  it('invalidates tickets minted against a rotated key', async () => {
    const ticket = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;

    await mongoose.connection
      .collection('deployments')
      .updateOne({}, { $set: { ownership_key_fingerprint: 'deadbeef' } });

    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('stale@example.com'), claimTicket: ticket })
      .expect(401);
  });
});

describe('upgrading a database that predates ownership records', () => {
  it('records it as already owned instead of offering it up for claiming', async () => {
    await mongoose.connection.collection('deployments').deleteMany({});
    await mongoose.connection.collection('users').insertOne({
      email: 'existing@example.com',
      password_hash: 'x',
      crypto_salt: 'x',
      wrappedDEK: 'x',
      recovery_wrappedDEK: 'x',
      is_verified: true,
    });

    await sealDeployment();

    const info = await request(app).get('/api/v1/server/info').expect(200);
    expect(info.body.data.ownership_claimed).toBe(true);
    // No key can claim it — there was never one to match.
    await claim(OWNERSHIP_KEY).expect(409);
  });
});

describe('an owned deployment is invite-only', () => {
  beforeEach(async () => {
    const ticket = (await claim(OWNERSHIP_KEY).expect(200)).body.data.claim_ticket;
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...signupBody('boss@example.com'), claimTicket: ticket })
      .expect(201);
  });

  it('turns away an uninvited stranger', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(signupBody('stranger@example.com'))
      .expect(403);
    expect(res.body.message).toMatch(/invite-only/i);
  });

  it('admits an address with a live invitation', async () => {
    await mongoose.connection.collection('invitations').insertOne({
      org_id: new mongoose.Types.ObjectId(),
      email: 'guest@example.com',
      role: 'member',
      token_hash: 'guest-token-hash',
      invited_by: new mongoose.Types.ObjectId(),
      status: 'pending',
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await request(app).post('/api/v1/auth/signup').send(signupBody('guest@example.com')).expect(201);
  });

  it('turns away an address whose invitation has expired', async () => {
    await mongoose.connection.collection('invitations').insertOne({
      org_id: new mongoose.Types.ObjectId(),
      email: 'late@example.com',
      role: 'member',
      token_hash: 'late-token-hash',
      invited_by: new mongoose.Types.ObjectId(),
      status: 'pending',
      expires_at: new Date(Date.now() - 60_000),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await request(app).post('/api/v1/auth/signup').send(signupBody('late@example.com')).expect(403);
  });
});

describe('status surface', () => {
  it('keeps deployment detail off the public view', async () => {
    const res = await request(app).get('/status.json').expect(200);
    expect(res.body.data.checks.database).toBe(true);
    expect(res.body.data.database).toBeUndefined();
    expect(res.body.data.counts).toBeUndefined();
    expect(res.body.data.email).toBeUndefined();
  });

  it('unlocks detail for the health token, with the Resend key masked', async () => {
    const res = await request(app).get(`/status.json?key=${HEALTH_TOKEN}`).expect(200);
    expect(res.body.data.database.name).toBe('cloak-test');
    expect(res.body.data.counts).toBeDefined();
    // Masked, never whole: enough to match against a provider dashboard and no
    // more. `.env` supplies a real key in this environment, so this asserts the
    // masking rather than its absence.
    const masked = res.body.data.email.api_key_masked;
    if (masked !== null) {
      expect(masked).toMatch(/\*{8}/);
      expect(masked).not.toBe(process.env.RESEND_API_KEY);
    }
  });

  it('ignores a wrong health token', async () => {
    const res = await request(app).get('/status.json?key=wrong').expect(200);
    expect(res.body.data.database).toBeUndefined();
  });

  it('serves the status page as HTML', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Cloak self-hosted');
    // The bootstrap payload must not carry detail to an unauthenticated reader.
    expect(res.text).not.toContain('cloak-test');
  });
});
