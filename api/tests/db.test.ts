import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { clusterFromUri, connectBackoffMs, connectDb } from '../src/lib/db.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('connectBackoffMs', () => {
  it('doubles from one second and caps at eight', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => connectBackoffMs(n))).toEqual([
      1000, 2000, 4000, 8000, 8000, 8000,
    ]);
  });
});

describe('connectDb', () => {
  it('retries a failed connection and reports each retry', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce(mongoose);
    vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
    const onRetry = vi.fn();

    await connectDb({ attempts: 5, firstBackoffMs: 1, onRetry });

    expect(connect).toHaveBeenCalledTimes(3);
    expect(onRetry.mock.calls.map(([r]) => [r.attempt, r.maxAttempts, r.error.message])).toEqual([
      [2, 5, 'first'],
      [3, 5, 'second'],
    ]);
  });

  it('gives up after the last attempt with that attempt’s error', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('still down'));
    vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
    const onRetry = vi.fn();

    await expect(connectDb({ attempts: 3, firstBackoffMs: 1, onRetry })).rejects.toThrow('still down');
    expect(connect).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('abandons an attempt that never answers and starts the next one clean', async () => {
    // A stalled DNS lookup looks like this: a connect that neither resolves nor rejects.
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockReturnValueOnce(new Promise(() => {}))
      .mockResolvedValueOnce(mongoose);
    const disconnect = vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
    const onRetry = vi.fn();

    await connectDb({ attempts: 2, deadlineMs: 20, firstBackoffMs: 1, onRetry });

    expect(connect).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0].error.message).toMatch(/No answer from the database/);
  });
});

describe('clusterFromUri', () => {
  it('names the cluster without leaking credentials', () => {
    expect(clusterFromUri('mongodb+srv://user:pa%40ss@cloak.rs8xjtg.mongodb.net/cloak?retryWrites=true')).toBe(
      'cloak.rs8xjtg.mongodb.net',
    );
    expect(clusterFromUri('mongodb://127.0.0.1:27017/cloak')).toBe('127.0.0.1:27017');
    expect(clusterFromUri('mongodb://mongo:27017/cloak')).toBe('mongo:27017');
  });

  it('summarises a replica set by its first host', () => {
    expect(clusterFromUri('mongodb://a:27017,b:27017,c:27017/cloak?replicaSet=rs0')).toBe('a:27017 +2');
  });

  it('returns null for anything that is not a MongoDB URI', () => {
    expect(clusterFromUri('postgres://localhost/cloak')).toBeNull();
  });
});
