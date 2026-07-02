import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('health & error envelope', () => {
  it('GET /health returns liveness ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });

  it('unknown route returns the standard 404 envelope', async () => {
    const res = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toMatchObject({ status: 'error', code: 'NOT_FOUND' });
  });

  it('_error-demo route surfaces a typed AppError via the global handler', async () => {
    const res = await request(app).get('/api/v1/_error-demo').expect(404);
    expect(res.body).toMatchObject({ status: 'error', code: 'NOT_FOUND', message: 'Demo not found' });
  });
});
