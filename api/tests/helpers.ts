import request from 'supertest';
import mongoose from 'mongoose';
import type { Express } from 'express';

/**
 * Signup payload in the org-first shape. The key material is opaque to the
 * server, so tests use recognisable stand-ins rather than real ciphertext.
 */
export function signupBody(email: string, orgName = 'Personal Space') {
  const tag = Buffer.from(email).toString('base64');
  return {
    email,
    name: email.split('@')[0],
    authHash: `YXV0aC${tag}`,
    cryptoSalt: 'c29tZS1zYWx0LTE2Ynl0ZXNfXw==',
    wrappedDEK: 'd3JhcHBlZC1kZWstYmxvYg==',
    recoveryWrappedDEK: 'cmVjb3Zlcnktd3JhcHBlZC1kZWs=',
    identityPublicKey: `aWRlbnRpdHktcHVibGljLWtleS0zMi1ieXRlcy${tag}`,
    wrappedIdentitySk: 'd3JhcHBlZC1pZGVudGl0eS1zZWNyZXQ=',
    defaultOrg: {
      name: orgName,
      wrapped_org_dek: `c2VhbGVkLW9yZy1kZWs${tag}`,
      org_recovery_salt: 'b3JnLXJlY292ZXJ5LXNhbHQtMTY=',
      org_recovery_wrappedDEK: 'b3JnLXJlY292ZXJ5LXdyYXBwZWQ=',
    },
  };
}

export interface Account {
  email: string;
  token: string;
  orgId: string;
  userId: string;
  headers: Record<string, string>;
}

/** Sign up, log in, and return everything a request needs: bearer plus org. */
export async function createAccount(app: Express, email: string, orgName?: string): Promise<Account> {
  const body = signupBody(email, orgName);
  await request(app).post('/api/v1/auth/signup').send(body).expect(201);

  // Signup leaves the account unverified, and login now refuses those. These
  // suites test what happens after onboarding, so mark it verified directly
  // rather than threading an OTP through every file's email mock. The
  // verification flow itself is covered in auth.test.ts.
  await mongoose.connection
    .collection('users')
    .updateOne({ email }, { $set: { is_verified: true, verified_at: new Date() } });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, authHash: body.authHash })
    .expect(200);
  const token = login.body.data.accessToken;

  const orgs = await request(app)
    .get('/api/v1/orgs')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const orgId = orgs.body.data[0].id;

  const me = await request(app)
    .get('/api/v1/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  return {
    email,
    token,
    orgId,
    userId: me.body.data.id,
    headers: { Authorization: `Bearer ${token}`, 'X-Cloak-Org': orgId },
  };
}
