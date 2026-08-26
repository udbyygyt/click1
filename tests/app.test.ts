import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildApp } from '../src/server/app.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe('API foundation', () => {
  it('reports health and runtime configuration', async () => {
    app = await buildApp();
    const health = await app.inject({ method: 'GET', url: '/health' });
    const config = await app.inject({ method: 'GET', url: '/api/config' });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: 'ok', service: 'click1-api' });
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(health.headers['content-security-policy']).toEqual(expect.stringContaining("default-src 'self'"));
    expect(config.statusCode).toBe(200);
    expect(config.json()).toMatchObject({ cluster: 'devnet', undoPriceLamports: 10000000 });
  });

  it('rejects malformed wallet nonce requests', async () => {
    app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/nonce',
      payload: { walletAddress: 'not-a-wallet' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'invalid wallet address' });
  });

  it('authenticates a wallet and persists one current game in the service', async () => {
    app = await buildApp();
    const keypair = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keypair.publicKey);
    const nonceResponse = await app.inject({ method: 'POST', url: '/api/auth/nonce', payload: { walletAddress } });
    const nonce = nonceResponse.json() as { nonce: string; message: string };
    const signature = nacl.sign.detached(new TextEncoder().encode(nonce.message), keypair.secretKey);
    const verifyResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/verify',
      payload: { walletAddress, nonce: nonce.nonce, signature: Buffer.from(signature).toString('base64') },
    });
    expect(verifyResponse.statusCode).toBe(200);
    const token = (verifyResponse.json() as { token: string }).token;
    const setCookie = verifyResponse.headers['set-cookie'];
    expect(setCookie).toEqual(expect.stringContaining('click1_session='));
    const headers = { authorization: `Bearer ${token}` };
    const cookieHeaders = { cookie: setCookie.split(';')[0] };
    const cookieSession = await app.inject({ method: 'GET', url: '/api/auth/session', headers: cookieHeaders });
    expect(cookieSession.statusCode).toBe(200);
    const gameResponse = await app.inject({ method: 'POST', url: '/api/games/current', headers });
    expect(gameResponse.statusCode).toBe(200);
    const game = gameResponse.json() as { id: string; state: { board: number[][] } };
    const tile = game.state.board
      .map((row, rowIndex) => row.map((value, colIndex) => ({ value, rowIndex, colIndex })))
      .flat()
      .find((cell) => cell.value > 0)!;
    const moveResponse = await app.inject({ method: 'POST', url: '/api/games/current/moves', headers, payload: { row: tile.rowIndex, col: tile.colIndex } });
    expect(moveResponse.statusCode).toBe(200);
    const dailyResponse = await app.inject({ method: 'GET', url: '/api/account/daily-undo', headers });
    expect(dailyResponse.json()).toMatchObject({ available: true });
    const undoResponse = await app.inject({ method: 'POST', url: '/api/games/current/undo/free', headers });
    expect(undoResponse.statusCode).toBe(200);
    const secondUndoResponse = await app.inject({ method: 'POST', url: '/api/games/current/undo/free', headers });
    expect(secondUndoResponse.statusCode).toBe(400);
    const deleteResponse = await app.inject({ method: 'DELETE', url: '/api/account', headers });
    expect(deleteResponse.statusCode).toBe(200);
    const afterDelete = await app.inject({ method: 'GET', url: '/api/games/current', headers });
    expect(afterDelete.statusCode).toBe(401);
    const logoutResponse = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: cookieHeaders });
    expect(logoutResponse.statusCode).toBe(401);
  });
});
