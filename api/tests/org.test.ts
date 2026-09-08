import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

const invitationTokens: string[] = [];

vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
  sendVerificationEmail: vi.fn(async () => {}),
  sendRecoveryEmail: vi.fn(async () => {}),
  sendInvitationEmail: vi.fn(async (_to: string, _org: string, _role: string, token: string) => {
    invitationTokens.push(token);
  }),
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
  invitationTokens.length = 0;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

/** Run the whole two-step join: invite, accept, then grant the sealed Org DEK. */
async function joinOrg(
  owner: Awaited<ReturnType<typeof createAccount>>,
  invitee: Awaited<ReturnType<typeof createAccount>>,
  role: string,
) {
  await request(app)
    .post(`/api/v1/orgs/${owner.orgId}/invitations`)
    .set(owner.headers)
    .send({ email: invitee.email, role })
    .expect(201);

  const token = invitationTokens.at(-1)!;
  await request(app)
    .post(`/api/v1/invitations/${token}/accept`)
    .set({ Authorization: `Bearer ${invitee.token}` })
    .expect(201);

  await request(app)
    .post(`/api/v1/orgs/${owner.orgId}/members/${invitee.userId}/grant`)
    .set(owner.headers)
    .send({ wrapped_org_dek: 'c2VhbGVkLWZvci1pbnZpdGVl' })
    .expect(200);

  return { Authorization: `Bearer ${invitee.token}`, 'X-Cloak-Org': owner.orgId };
}

describe('default organization', () => {
  it('gives every new account an owned org with its sealed key', async () => {
    const account = await createAccount(app, 'solo@example.com', 'Solo Space');
    const orgs = await request(app)
      .get('/api/v1/orgs')
      .set({ Authorization: `Bearer ${account.token}` })
      .expect(200);

    expect(orgs.body.data).toHaveLength(1);
    expect(orgs.body.data[0]).toMatchObject({
      name: 'Solo Space',
      role: 'owner',
      status: 'active',
      is_owner: true,
      member_count: 1,
    });
    expect(orgs.body.data[0].wrapped_org_dek).toBeTruthy();
  });

  it('refuses to delete an account\'s only org', async () => {
    const account = await createAccount(app, 'only@example.com');
    await request(app).delete(`/api/v1/orgs/${account.orgId}`).set(account.headers).expect(409);
  });
});

describe('invitation flow', () => {
  it('admits a member only after an existing member grants the key', async () => {
    const owner = await createAccount(app, 'owner@example.com', 'Acme');
    const invitee = await createAccount(app, 'invitee@example.com');

    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/invitations`)
      .set(owner.headers)
      .send({ email: invitee.email, role: 'member' })
      .expect(201);
    const token = invitationTokens.at(-1)!;

    const peek = await request(app)
      .get(`/api/v1/invitations/${token}`)
      .set({ Authorization: `Bearer ${invitee.token}` })
      .expect(200);
    expect(peek.body.data).toMatchObject({ org_name: 'Acme', role: 'member' });

    const accepted = await request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set({ Authorization: `Bearer ${invitee.token}` })
      .expect(201);
    expect(accepted.body.data.status).toBe('pending_key');

    // The joiner should be able to see they are waiting, rather than the org
    // silently vanishing from their list until someone grants the key.
    const whileWaiting = await request(app)
      .get('/api/v1/orgs')
      .set({ Authorization: `Bearer ${invitee.token}` })
      .expect(200);
    const waiting = whileWaiting.body.data.find(
      (o: { id: string }) => o.id === owner.orgId,
    );
    expect(waiting).toMatchObject({ name: 'Acme', role: 'member', status: 'pending_key' });
    expect(waiting.wrapped_org_dek).toBe('');

    // Accepted but not granted: no access to the org at all.
    await request(app)
      .get('/api/v1/vault/creds')
      .set({ Authorization: `Bearer ${invitee.token}`, 'X-Cloak-Org': owner.orgId })
      .expect(403);

    const pending = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/members?status=pending_key`)
      .set(owner.headers)
      .expect(200);
    expect(pending.body.data).toHaveLength(1);
    expect(pending.body.data[0].identity_public_key).toBeTruthy();

    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/members/${invitee.userId}/grant`)
      .set(owner.headers)
      .send({ wrapped_org_dek: 'c2VhbGVkLWZvci1pbnZpdGVl' })
      .expect(200);

    await request(app)
      .get('/api/v1/vault/creds')
      .set({ Authorization: `Bearer ${invitee.token}`, 'X-Cloak-Org': owner.orgId })
      .expect(200);
  });

  it('will not let a different account consume an invitation', async () => {
    const owner = await createAccount(app, 'owner2@example.com');
    const invitee = await createAccount(app, 'invitee2@example.com');
    const stranger = await createAccount(app, 'stranger@example.com');

    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/invitations`)
      .set(owner.headers)
      .send({ email: invitee.email, role: 'member' })
      .expect(201);
    const token = invitationTokens.at(-1)!;

    await request(app)
      .post(`/api/v1/invitations/${token}/accept`)
      .set({ Authorization: `Bearer ${stranger.token}` })
      .expect(401);
  });

  it('rejects a second pending invitation for the same email', async () => {
    const owner = await createAccount(app, 'owner3@example.com');
    const invitee = await createAccount(app, 'invitee3@example.com');

    const body = { email: invitee.email, role: 'member' };
    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/invitations`)
      .set(owner.headers)
      .send(body)
      .expect(201);
    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/invitations`)
      .set(owner.headers)
      .send(body)
      .expect(409);
  });
});

describe('role enforcement', () => {
  it('lets a viewer read but not write', async () => {
    const owner = await createAccount(app, 'owner4@example.com');
    const viewer = await createAccount(app, 'viewer@example.com');
    const headers = await joinOrg(owner, viewer, 'viewer');

    await request(app).get('/api/v1/vault/creds').set(headers).expect(200);
    await request(app)
      .post('/api/v1/vault/creds')
      .set(headers)
      .send({ name: 'nope', username: 'YQ==', password: 'Y2lwaGVy' })
      .expect(403);
  });

  it('lets a member write but not manage members or read audit', async () => {
    const owner = await createAccount(app, 'owner5@example.com');
    const member = await createAccount(app, 'member@example.com');
    const headers = await joinOrg(owner, member, 'member');

    await request(app)
      .post('/api/v1/vault/creds')
      .set(headers)
      .send({ name: 'ok', username: 'YQ==', password: 'Y2lwaGVy' })
      .expect(201);
    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/invitations`)
      .set(headers)
      .send({ email: 'someone@example.com', role: 'viewer' })
      .expect(403);
    await request(app).get(`/api/v1/orgs/${owner.orgId}/audit`).set(headers).expect(403);
  });

  it('stops an admin from removing or demoting the owner', async () => {
    const owner = await createAccount(app, 'owner6@example.com');
    const admin = await createAccount(app, 'admin@example.com');
    const headers = await joinOrg(owner, admin, 'admin');

    await request(app)
      .delete(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`)
      .set(headers)
      .expect(403);
    await request(app)
      .patch(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`)
      .set(headers)
      .send({ role: 'viewer' })
      .expect(403);
  });

  it('reserves org deletion for the owner', async () => {
    const owner = await createAccount(app, 'owner7@example.com');
    const admin = await createAccount(app, 'admin2@example.com');
    const headers = await joinOrg(owner, admin, 'admin');

    await request(app).delete(`/api/v1/orgs/${owner.orgId}`).set(headers).expect(403);
  });
});

describe('member removal', () => {
  it('cuts off access immediately', async () => {
    const owner = await createAccount(app, 'owner8@example.com');
    const member = await createAccount(app, 'leaver@example.com');
    const headers = await joinOrg(owner, member, 'member');

    await request(app).get('/api/v1/vault/creds').set(headers).expect(200);
    await request(app)
      .delete(`/api/v1/orgs/${owner.orgId}/members/${member.userId}`)
      .set(owner.headers)
      .expect(200);
    await request(app).get('/api/v1/vault/creds').set(headers).expect(403);
  });
});

describe('audit', () => {
  it('scopes entries to the org and gates reads on role', async () => {
    const owner = await createAccount(app, 'owner9@example.com');
    const other = await createAccount(app, 'other@example.com');

    await request(app)
      .post('/api/v1/vault/creds')
      .set(owner.headers)
      .send({ name: 'Audited', username: 'YQ==', password: 'Y2lwaGVy' })
      .expect(201);

    const page = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/audit`)
      .set(owner.headers)
      .expect(200);
    const actions = page.body.data.entries.map((e: { action: string }) => e.action);
    expect(actions).toContain('cred:create');
    expect(page.body.data.entries[0].actor_email).toBe(owner.email);

    // Another org's owner cannot read this org's trail.
    await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/audit`)
      .set({ Authorization: `Bearer ${other.token}`, 'X-Cloak-Org': owner.orgId })
      .expect(403);

    const csv = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/audit/export.csv`)
      .set(owner.headers)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toBe('created_at,action,actor_email,resource,resource_id,ip');
  });
});

describe('break-glass', () => {
  it('returns the recovery envelope to the owner and restores the key wrap', async () => {
    const owner = await createAccount(app, 'owner10@example.com');

    const envelope = await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/break-glass`)
      .set(owner.headers)
      .expect(200);
    expect(envelope.body.data.org_recovery_wrappedDEK).toBeTruthy();
    expect(envelope.body.data.org_recovery_salt).toBeTruthy();

    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/break-glass/restore`)
      .set(owner.headers)
      .send({ wrapped_org_dek: 'cmVzZWFsZWQtdG8tb3duZXI=' })
      .expect(200);

    const orgs = await request(app)
      .get('/api/v1/orgs')
      .set({ Authorization: `Bearer ${owner.token}` })
      .expect(200);
    expect(orgs.body.data[0].wrapped_org_dek).toBe('cmVzZWFsZWQtdG8tb3duZXI=');
  });

  it('refuses break-glass to a non-owner admin', async () => {
    const owner = await createAccount(app, 'owner11@example.com');
    const admin = await createAccount(app, 'admin3@example.com');
    const headers = await joinOrg(owner, admin, 'admin');

    await request(app).post(`/api/v1/orgs/${owner.orgId}/break-glass`).set(headers).expect(403);
  });
});

describe('ownership transfer', () => {
  it('moves ownership and demotes the previous owner to admin', async () => {
    const owner = await createAccount(app, 'owner12@example.com');
    const heir = await createAccount(app, 'heir@example.com');
    await joinOrg(owner, heir, 'admin');

    await request(app)
      .post(`/api/v1/orgs/${owner.orgId}/transfer`)
      .set(owner.headers)
      .send({ user_id: heir.userId })
      .expect(200);

    const members = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/members`)
      .set(owner.headers)
      .expect(200);
    const byEmail = Object.fromEntries(
      members.body.data.map((m: { email: string; role: string }) => [m.email, m.role]),
    );
    expect(byEmail[heir.email]).toBe('owner');
    expect(byEmail[owner.email]).toBe('admin');
  });
});

describe('member detail', () => {
  it('records who invited and who granted the key', async () => {
    const owner = await createAccount(app, 'owner13@example.com', 'Acme');
    const joiner = await createAccount(app, 'joiner@example.com');
    await joinOrg(owner, joiner, 'member');

    const detail = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/members/${joiner.userId}`)
      .set(owner.headers)
      .expect(200);

    expect(detail.body.data).toMatchObject({
      email: joiner.email,
      role: 'member',
      status: 'active',
      invited_by: { email: owner.email },
      granted_by: { email: owner.email },
    });

    // The three moments are distinct events and must be ordered: invited, then
    // accepted, then granted the key.
    const { invited_at, joined_at, granted_at } = detail.body.data;
    for (const ts of [invited_at, joined_at, granted_at]) {
      expect(ts).toBeTruthy();
      expect(new Date(ts).toISOString()).toBe(ts);
    }
    expect(+new Date(invited_at)).toBeLessThanOrEqual(+new Date(joined_at));
    expect(+new Date(joined_at)).toBeLessThanOrEqual(+new Date(granted_at));
  });

  it('leaves the grant attribution empty for the org creator', async () => {
    const owner = await createAccount(app, 'owner14@example.com');

    const detail = await request(app)
      .get(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`)
      .set(owner.headers)
      .expect(200);

    expect(detail.body.data.role).toBe('owner');
    expect(detail.body.data.granted_by).toBeUndefined();
    expect(detail.body.data.invited_by).toBeUndefined();
  });
});
