import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
  sendRecoveryEmail: vi.fn(async () => {}),
  sendInvitationEmail: vi.fn(async () => {}),
}));

const { createApp } = await import('../src/app.js');
const { createAccount } = await import('./helpers.js');
const { sha256 } = await import('../src/lib/hashing.js');
const { AuditLog } = await import('../src/models/audit-log.model.js');
const { runUpgrades } = await import('../src/lib/upgrade.js');
const app = createApp();

/**
 * A database written by v0.2.0 holds rows the current models describe
 * differently: refresh tokens from before sessions existed, and audit entries
 * from before the hash chain. An upgraded server has to start on that data.
 */
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

describe('upgrading a v0.2.0 database', () => {
  it('keeps a device signed in whose refresh token predates sessions', async () => {
    const account = await createAccount(app, 'legacy-token@example.com');
    const raw = randomBytes(32).toString('base64url');
    const issued = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await mongoose.connection.collection('refreshtokens').insertOne({
      user_id: new mongoose.Types.ObjectId(account.userId),
      token_hash: sha256(raw),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      created_at: issued,
    });

    await runUpgrades();

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: raw })
      .expect(200);

    const sessions = await request(app)
      .get('/api/v1/me/sessions')
      .set('Authorization', `Bearer ${refreshed.body.data.accessToken}`)
      .expect(200);
    const current = sessions.body.data.sessions.find((s: { current: boolean }) => s.current);
    expect(current).toBeDefined();
    expect(new Date(current.started_at).getTime()).toBe(issued.getTime());
  });

  it('builds the chain index over audit entries written before the chain', async () => {
    const account = await createAccount(app, 'legacy-audit@example.com');
    await AuditLog.collection.drop().catch(() => {});

    const legacy = {
      org_id: new mongoose.Types.ObjectId(account.orgId),
      action: 'env:update',
      created_at: new Date(),
    };
    await mongoose.connection.collection('auditlogs').insertMany([{ ...legacy }, { ...legacy }]);

    await AuditLog.syncIndexes();
    const indexes = await AuditLog.collection.indexes();
    expect(indexes.some((i) => i.unique && i.key.chain_id === 1 && i.key.seq === 1)).toBe(true);

    await request(app)
      .patch(`/api/v1/orgs/${account.orgId}`)
      .set(account.headers)
      .send({ name: 'Renamed' })
      .expect(200);

    const verified = await request(app)
      .get(`/api/v1/orgs/${account.orgId}/audit/verify`)
      .set(account.headers)
      .expect(200);
    expect(verified.body.data.ok).toBe(true);

    const listed = await request(app)
      .get(`/api/v1/orgs/${account.orgId}/audit`)
      .set(account.headers)
      .expect(200);
    expect(listed.body.data.entries).toHaveLength(3);
  });
});
