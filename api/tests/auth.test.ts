import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';

// Capture OTP/verification codes instead of sending real emails.
const otpCodes: string[] = [];
const verifyCodes: string[] = [];

vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async (_to: string, code: string) => {
    otpCodes.push(code);
  }),
  sendVerificationEmail: vi.fn(async (_to: string, code: string) => {
    verifyCodes.push(code);
  }),
  sendRecoveryEmail: vi.fn(async (_to: string, code: string) => {
    otpCodes.push(code);
  }),
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

const EMAIL = 'dev@example.com';
const SIGNUP = {
  email: EMAIL,
  authHash: 'YXV0aC1oYXNoLWJhc2U2NA==',
  cryptoSalt: 'c29tZS1zYWx0LTE2Ynl0ZXNfXw==',
  wrappedDEK: 'd3JhcHBlZC1kZWstYmxvYg==',
  recoveryWrappedDEK: 'cmVjb3Zlcnktd3JhcHBlZC1kZWs=',
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  otpCodes.length = 0;
  verifyCodes.length = 0;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

async function signup() {
  return request(app).post('/api/v1/auth/signup').send(SIGNUP).expect(201);
}

describe('auth flow', () => {
  it('signs up and issues a verification code', async () => {
    const res = await signup();
    expect(res.body.data).toMatchObject({ email: EMAIL, verificationRequired: true });
    expect(verifyCodes).toHaveLength(1);
  });

  it('rejects duplicate signup with 409', async () => {
    await signup();
    const res = await request(app).post('/api/v1/auth/signup').send(SIGNUP).expect(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('prelogin returns the stored salt for a known email', async () => {
    await signup();
    const res = await request(app).post('/api/v1/auth/prelogin').send({ email: EMAIL }).expect(200);
    expect(res.body.data.crypto_salt).toBe(SIGNUP.cryptoSalt);
    expect(res.body.data.two_factor_enabled).toBe(false);
  });

  it('prelogin returns a deterministic fake salt for unknown emails', async () => {
    const a = await request(app).post('/api/v1/auth/prelogin').send({ email: 'ghost@x.com' }).expect(200);
    const b = await request(app).post('/api/v1/auth/prelogin').send({ email: 'ghost@x.com' }).expect(200);
    expect(a.body.data.crypto_salt).toBe(b.body.data.crypto_salt);
    expect(a.body.data.crypto_salt).not.toBe(SIGNUP.cryptoSalt);
  });

  it('logs in without 2FA and returns tokens + wrappedDEK', async () => {
    await signup();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.wrappedDEK).toBe(SIGNUP.wrappedDEK);
  });

  it('rejects login with wrong authHash', async () => {
    await signup();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: 'd3Jvbmc=' })
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rotates refresh tokens and invalidates the old one', async () => {
    await signup();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(200);
    const oldRefresh = login.body.data.refreshToken;

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh })
      .expect(200);
    expect(rotated.body.data.refreshToken).toBeTruthy();
    expect(rotated.body.data.refreshToken).not.toBe(oldRefresh);

    // Old token can no longer be used.
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: oldRefresh }).expect(401);
  });

  it('verifies email with the emailed code', async () => {
    await signup();
    const code = verifyCodes[0]!;
    await request(app).post('/api/v1/auth/verify-email').send({ email: EMAIL, code }).expect(200);
  });

  it('completes the 2FA challenge flow end-to-end', async () => {
    await signup();
    // Log in, get access token, enable 2FA.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(200);
    const { accessToken } = login.body.data;

    await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ enabled: true })
      .expect(200);

    // Next login should require 2FA.
    const challenge = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(200);
    expect(challenge.body.data.twoFactorRequired).toBe(true);
    expect(otpCodes).toHaveLength(1);

    // Submit the OTP.
    const verified = await request(app)
      .post('/api/v1/auth/2fa')
      .send({ email: EMAIL, otp: otpCodes[0] })
      .expect(200);
    expect(verified.body.data.accessToken).toBeTruthy();
    expect(verified.body.data.wrappedDEK).toBe(SIGNUP.wrappedDEK);
  });

  it('rejects /me/2fa without a token', async () => {
    await request(app).post('/api/v1/me/2fa').send({ enabled: true }).expect(401);
  });

  it('returns the profile from /me with a valid token', async () => {
    await signup();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(200);
    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);
    expect(me.body.data).toMatchObject({
      email: EMAIL,
      two_factor_enabled: false,
      is_verified: false,
    });
  });

  it('recovers access via the recovery envelope and rotates credentials', async () => {
    await signup();

    // Start + verify recovery (generic 200 on start).
    await request(app).post('/api/v1/auth/recovery/start').send({ email: EMAIL }).expect(200);
    expect(otpCodes).toHaveLength(1);

    const verify = await request(app)
      .post('/api/v1/auth/recovery/verify')
      .send({ email: EMAIL, otp: otpCodes[0] })
      .expect(200);
    expect(verify.body.data.crypto_salt).toBe(SIGNUP.cryptoSalt);
    expect(verify.body.data.recovery_wrappedDEK).toBe(SIGNUP.recoveryWrappedDEK);
    const { recoveryToken } = verify.body.data;
    expect(recoveryToken).toBeTruthy();

    // Reset with fresh (client-derived) material.
    const reset = await request(app)
      .post('/api/v1/auth/recovery/reset')
      .send({
        recoveryToken,
        authHash: 'bmV3LWF1dGgtaGFzaA==',
        cryptoSalt: 'bmV3LXNhbHQtMTZieXRlc19f',
        wrappedDEK: 'bmV3LXdyYXBwZWQtZGVr',
        recoveryWrappedDEK: 'bmV3LXJlY292ZXJ5LXdyYXA=',
      })
      .expect(200);
    expect(reset.body.data.accessToken).toBeTruthy();
    expect(reset.body.data.wrappedDEK).toBe('bmV3LXdyYXBwZWQtZGVr');

    // New password (authHash) now logs in and returns the new wrappedDEK.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: 'bmV3LWF1dGgtaGFzaA==' })
      .expect(200);
    expect(login.body.data.wrappedDEK).toBe('bmV3LXdyYXBwZWQtZGVr');

    // Old password no longer works.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, authHash: SIGNUP.authHash })
      .expect(401);
  });

  it('recovery/start is generic for unknown emails', async () => {
    await request(app).post('/api/v1/auth/recovery/start').send({ email: 'nobody@x.com' }).expect(200);
    expect(otpCodes).toHaveLength(0);
  });
});
