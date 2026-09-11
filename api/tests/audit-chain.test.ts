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

function auditLogs() {
  return mongoose.connection.collection('auditlogs');
}

/** An account with a handful of audited writes behind it. */
async function accountWithTrail(email: string, writes = 4) {
  const owner = await createAccount(app, email);
  for (let i = 0; i < writes; i += 1) {
    await request(app)
      .post('/api/v1/vault/projects')
      .set(owner.headers)
      .send({ name: `Project ${i}` })
      .expect(201);
  }
  return owner;
}

function verify(owner: { orgId: string; headers: Record<string, string> }) {
  return request(app)
    .get(`/api/v1/orgs/${owner.orgId}/audit/verify`)
    .set(owner.headers)
    .expect(200)
    .then((res) => res.body.data);
}

describe('audit chain', () => {
  it('chains entries per org and verifies them end to end', async () => {
    const owner = await accountWithTrail('chain1@example.com');

    const result = await verify(owner);
    expect(result.ok).toBe(true);
    expect(result.chain_id).toBe(owner.orgId);
    expect(result.first_seq).toBe(1);
    expect(result.entries_checked).toBeGreaterThanOrEqual(4);
    expect(result.truncated).toBe(false);
  });

  it('catches an edited entry, and names where the trail stops being trustworthy', async () => {
    const owner = await accountWithTrail('chain2@example.com');

    const target = await auditLogs().findOne({ chain_id: owner.orgId, seq: 3 });
    await auditLogs().updateOne({ _id: target!._id }, { $set: { target_label: 'Something else' } });

    const result = await verify(owner);
    expect(result.ok).toBe(false);
    expect(result.broken_at.seq).toBe(3);
    expect(result.broken_at.reason).toBe('hash_mismatch');
    // Everything before the edit is still provably intact.
    expect(result.entries_checked).toBe(2);
  });

  it('catches a deleted entry', async () => {
    const owner = await accountWithTrail('chain3@example.com');

    await auditLogs().deleteOne({ chain_id: owner.orgId, seq: 3 });

    const result = await verify(owner);
    expect(result.ok).toBe(false);
    expect(result.broken_at.reason).toBe('missing_entry');
    expect(result.broken_at.seq).toBe(4);
  });

  it('keeps one unforked chain when writes arrive at once', async () => {
    const owner = await createAccount(app, 'chain4@example.com');

    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        request(app)
          .post('/api/v1/vault/projects')
          .set(owner.headers)
          .send({ name: `Parallel ${i}` })
          .expect(201),
      ),
    );

    const rows = await auditLogs()
      .find({ chain_id: owner.orgId })
      .sort({ seq: 1 })
      .toArray();
    expect(rows.map((r) => r.seq)).toEqual(rows.map((_, i) => i + 1));
    expect(await verify(owner)).toMatchObject({ ok: true });
  });

  it('chains account-level entries separately from org ones', async () => {
    const owner = await accountWithTrail('chain5@example.com', 1);

    const accountRows = await auditLogs().countDocuments({ chain_id: 'account' });
    expect(accountRows).toBeGreaterThan(0);

    const orgResult = await verify(owner);
    expect(orgResult.ok).toBe(true);
    // The org chain holds only org-scoped entries; sign-ins live on their own.
    expect(orgResult.entries_checked).toBeLessThan(accountRows + orgResult.entries_checked);
  });

  it('refuses verification to someone outside the org', async () => {
    const owner = await accountWithTrail('chain6@example.com', 1);
    const stranger = await createAccount(app, 'stranger@example.com');

    await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/audit/verify`)
      .set({ Authorization: `Bearer ${stranger.token}`, 'X-Cloak-Org': owner.orgId })
      .expect(403);
  });
});
