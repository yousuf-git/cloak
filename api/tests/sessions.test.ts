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
const { signupBody, allowSignup } = await import('./helpers.js');
const app = createApp();

const EMAIL = 'sessions@example.com';
const SIGNUP = signupBody(EMAIL);

interface Session {
  id: string;
  started_at: string;
  last_used_at: string;
  expires_at: string;
  ip?: string;
  user_agent?: string;
  current: boolean;
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

/** A verified account, plus one sign-in. */
async function signIn(userAgent = 'CloakDesktop/1.0') {
  await allowSignup(EMAIL);
  await request(app).post('/api/v1/auth/signup').send(SIGNUP).expect(201);
  await mongoose.connection
    .collection('users')
    .updateOne({ email: EMAIL }, { $set: { is_verified: true, verified_at: new Date() } });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('User-Agent', userAgent)
    .send({ email: EMAIL, authHash: SIGNUP.authHash })
    .expect(200);

  return login.body.data as { accessToken: string; refreshToken: string };
}

/** Sign in again on an account that already exists, as a second device would. */
async function signInAgain(userAgent: string) {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('User-Agent', userAgent)
    .send({ email: EMAIL, authHash: SIGNUP.authHash })
    .expect(200);
  return login.body.data as { accessToken: string; refreshToken: string };
}

function listSessions(accessToken: string): Promise<Session[]> {
  return request(app)
    .get('/api/v1/me/sessions')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200)
    .then((res) => res.body.data.sessions);
}

describe('sessions', () => {
  it('reports the signed-in device, marked as the current one', async () => {
    const tokens = await signIn('CloakDesktop/1.0 (linux)');
    const sessions = await listSessions(tokens.accessToken);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.current).toBe(true);
    expect(sessions[0]!.user_agent).toBe('CloakDesktop/1.0 (linux)');
  });

  it('keeps one session across rotation instead of accumulating them', async () => {
    const first = await signIn();
    const { id } = (await listSessions(first.accessToken))[0]!;

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    const sessions = await listSessions(refreshed.body.data.accessToken);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe(id);
    expect(sessions[0]!.current).toBe(true);
  });

  it('kills the whole session when a spent refresh token is replayed', async () => {
    const first = await signIn();
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    // The thief's copy of the original token.
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    // The legitimate client's newer token dies with it.
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.data.refreshToken })
      .expect(401);

    expect(await listSessions(rotated.body.data.accessToken)).toHaveLength(0);

    const reuse = await mongoose.connection
      .collection('auditlogs')
      .findOne({ action: 'auth:refresh_reuse' });
    expect(reuse?.outcome).toBe('failure');
  });

  it('revokes one device without touching the others', async () => {
    const desktop = await signIn('CloakDesktop/1.0');
    const laptop = await signInAgain('CloakDesktop/1.0 (laptop)');

    const sessions = await listSessions(desktop.accessToken);
    expect(sessions).toHaveLength(2);
    const other = sessions.find((s) => !s.current)!;

    await request(app)
      .delete(`/api/v1/me/sessions/${other.id}`)
      .set('Authorization', `Bearer ${desktop.accessToken}`)
      .expect(200);

    expect(await listSessions(desktop.accessToken)).toHaveLength(1);
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: laptop.refreshToken })
      .expect(401);
  });

  it('refuses to revoke a session that belongs to someone else', async () => {
    const mine = await signIn();
    const stranger = new mongoose.Types.ObjectId().toString();

    await request(app)
      .delete(`/api/v1/me/sessions/${stranger}`)
      .set('Authorization', `Bearer ${mine.accessToken}`)
      .expect(404);
  });

  it('signs out everywhere else but keeps the caller signed in', async () => {
    const desktop = await signIn();
    const laptop = await signInAgain('laptop');
    const phone = await signInAgain('phone');

    const res = await request(app)
      .post('/api/v1/me/sessions/revoke-others')
      .set('Authorization', `Bearer ${desktop.accessToken}`)
      .expect(200);
    expect(res.body.data.sessions_ended).toBe(2);

    const remaining = await listSessions(desktop.accessToken);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.current).toBe(true);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: desktop.refreshToken })
      .expect(200);
    for (const gone of [laptop, phone]) {
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: gone.refreshToken })
        .expect(401);
    }
  });

  it('ends the session on logout, not just the token presented', async () => {
    const tokens = await signIn();
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`)
      .send({ refreshToken: rotated.body.data.refreshToken })
      .expect(200);

    expect(await listSessions(rotated.body.data.accessToken)).toHaveLength(0);
  });

  it('shows the account its own history, including sign-ins it refused', async () => {
    const tokens = await signIn();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: 'd3JvbmctaGFzaA==' })
      .expect(401);

    const log = await request(app)
      .get('/api/v1/me/security-log')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);

    const entries: { action: string; outcome: string }[] = log.body.data.entries;
    expect(entries.some((e) => e.action === 'auth:login' && e.outcome === 'failure')).toBe(true);
    expect(entries.some((e) => e.action === 'auth:login' && e.outcome === 'success')).toBe(true);
  });

  it('records a failed sign-in with the address that was tried', async () => {
    await signIn();
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: 'd3JvbmctaGFzaA==' })
      .expect(401);

    const entry = await mongoose.connection
      .collection('auditlogs')
      .findOne({ action: 'auth:login', outcome: 'failure' });
    expect(entry?.actor_email).toBe(EMAIL);
    expect(entry?.context?.reason).toBe('UNAUTHORIZED');
  });
});
