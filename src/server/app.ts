import { access } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { resolveConfig } from './config.js';
import { createDatabasePool, migrateDatabase } from './database.js';
import { buildSignInMessage, isValidWalletAddress, verifyWalletSignature } from './auth.js';
import { GameService } from './game-service.js';
import { verifySolanaTransfer } from './solana.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const config = resolveConfig();
  const database = createDatabasePool();
  const memoryNonces = new Map<string, { walletAddress: string; expiresAt: number; used: boolean }>();
  const memorySessions = new Map<string, { walletAddress: string; expiresAt: number }>();
  const gameService = new GameService(database);

  if (config.environment === 'production' && !database) {
    throw new Error('DATABASE_URL is required in production');
  }

  if (database) {
    await migrateDatabase(database);
    app.addHook('onClose', async () => database.end());
  }

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  await app.register(cookie);
  await app.register(cors, { origin: allowedOrigins, credentials: true });

  const webRoot = path.resolve(process.cwd(), 'dist/web');
  try {
    await access(webRoot);
    await app.register(fastifyStatic, { root: webRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      const pathname = (request.raw.url ?? '').split('?')[0] ?? '';
      if (pathname.startsWith('/api/') || pathname === '/health' || pathname === '/health/db' || !['/', '/privacy', '/terms', '/support'].includes(pathname)) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // The API-only development/test mode does not require a built web bundle.
  }

  app.get('/health', async () => ({
    status: 'ok',
    service: 'click1-api',
    environment: config.environment,
  }));

  app.get('/api/config', async () => ({
    cluster: config.cluster,
    undoPriceLamports: config.undoPriceLamports,
  }));

  app.post('/api/auth/nonce', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = request.body as { walletAddress?: unknown } | undefined;
    const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress : '';
    if (!isValidWalletAddress(walletAddress)) {
      return reply.code(400).send({ error: 'invalid wallet address' });
    }
    const nonce = randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    if (database) {
      await database.query(
        'INSERT INTO auth_nonces (id, wallet_address, nonce, expires_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))',
        [randomUUID(), walletAddress, nonce, expiresAt],
      );
    } else {
      memoryNonces.set(nonce, { walletAddress, expiresAt, used: false });
    }
    return { nonce, message: buildSignInMessage(process.env.SIWS_DOMAIN ?? 'localhost', nonce), expiresAt };
  });

  app.post('/api/auth/verify', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const body = request.body as { walletAddress?: unknown; nonce?: unknown; signature?: unknown } | undefined;
    const walletAddress = typeof body?.walletAddress === 'string' ? body.walletAddress : '';
    const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
    const signature = typeof body?.signature === 'string' ? body.signature : '';
    const message = buildSignInMessage(process.env.SIWS_DOMAIN ?? 'localhost', nonce);
    if (!walletAddress || !nonce || !signature || !verifyWalletSignature(walletAddress, message, signature)) {
      return reply.code(401).send({ error: 'invalid wallet signature' });
    }

    if (database) {
      const nonceResult = await database.query(
        'UPDATE auth_nonces SET used_at = now() WHERE nonce = $1 AND wallet_address = $2 AND used_at IS NULL AND expires_at > now() RETURNING id',
        [nonce, walletAddress],
      );
      if (nonceResult.rowCount !== 1) return reply.code(401).send({ error: 'nonce expired or already used' });
    } else {
      const record = memoryNonces.get(nonce);
      if (!record || record.walletAddress !== walletAddress || record.used || record.expiresAt <= Date.now()) {
        return reply.code(401).send({ error: 'nonce expired or already used' });
      }
      record.used = true;
    }

    const token = randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (database) {
      await database.query(
        'INSERT INTO wallet_sessions (id, wallet_address, auth_token_hash, expires_at) VALUES ($1, $2, $3, now() + interval \'30 days\')',
        [randomUUID(), walletAddress, tokenHash],
      );
    } else {
      memorySessions.set(tokenHash, { walletAddress, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    }
    reply.setCookie('click1_session', token, { httpOnly: true, secure: config.environment === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
    await gameService.getDailyUndoStatus(walletAddress);
    return { walletAddress, token, expiresInSeconds: 30 * 24 * 60 * 60 };
  });

  const authenticate = async (request: { headers: Record<string, string | string[] | undefined>; cookies?: Record<string, string | undefined> }): Promise<string | null> => {
    const authorization = request.headers.authorization;
    const bearerToken = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const token = bearerToken || request.cookies?.click1_session || '';
    if (!token) return null;
    const tokenHash = createHash('sha256').update(token).digest('hex');
    if (database) {
      const result = await database.query<{ wallet_address: string }>(
        'SELECT wallet_address FROM wallet_sessions WHERE auth_token_hash = $1 AND expires_at > now()',
        [tokenHash],
      );
      return result.rows[0]?.wallet_address ?? null;
    }
    const session = memorySessions.get(tokenHash);
    return session && session.expiresAt > Date.now() ? session.walletAddress : null;
  };

  app.get('/api/auth/session', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'not authenticated' });
    return { walletAddress };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'not authenticated' });
    const authorization = request.headers.authorization;
    const bearerToken = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const cookieToken = request.cookies?.click1_session ?? '';
    const token = bearerToken || cookieToken;
    if (database && token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await database.query('DELETE FROM wallet_sessions WHERE auth_token_hash = $1', [tokenHash]);
    }
    if (token) memorySessions.delete(createHash('sha256').update(token).digest('hex'));
    reply.clearCookie('click1_session', { path: '/' });
    return { loggedOut: true };
  });

  app.post('/api/games/current', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    const body = request.body as { replace?: unknown } | undefined;
    const game = await gameService.startCurrentGame(walletAddress, body?.replace === true);
    return game;
  });

  app.get('/api/games/current', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    const game = await gameService.getCurrentGame(walletAddress);
    if (!game) return reply.code(404).send({ error: 'current game not found' });
    return game;
  });

  app.post('/api/games/current/moves', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    const body = request.body as { row?: unknown; col?: unknown; clientMoveId?: unknown } | undefined;
    const row = body?.row;
    const col = body?.col;
    const clientMoveId = typeof body?.clientMoveId === 'string' && body.clientMoveId.length <= 100 ? body.clientMoveId : undefined;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return reply.code(400).send({ error: 'row and col are required' });
    try {
      return await gameService.applyCurrentMove(walletAddress, row as number, col as number, clientMoveId);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid move' });
    }
  });

  app.get('/api/account/daily-undo', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    return gameService.getDailyUndoStatus(walletAddress);
  });

  app.post('/api/games/current/undo/free', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    try {
      return await gameService.undoCurrent(walletAddress);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'undo failed' });
    }
  });

  app.post('/api/games/current/undo/paid/quote', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    const treasury = process.env.UNDO_TREASURY_ADDRESS;
    if (!treasury || !isValidWalletAddress(treasury) || config.environment !== 'production' || config.cluster !== 'mainnet-beta') return reply.code(503).send({ error: 'paid undo is not configured' });
    const daily = await gameService.getDailyUndoStatus(walletAddress);
    if (daily.available) return reply.code(409).send({ error: 'free undo is available' });
    try {
      return await gameService.createPaidUndoOrder(walletAddress, treasury, 'mainnet-beta');
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'could not create undo order' });
    }
  });

  app.post('/api/games/current/undo/paid/confirm', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    const body = request.body as { orderId?: unknown; transactionSignature?: unknown } | undefined;
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const transactionSignature = typeof body?.transactionSignature === 'string' ? body.transactionSignature : '';
    if (!orderId || !transactionSignature) return reply.code(400).send({ error: 'orderId and transactionSignature are required' });
    const order = await gameService.getPaidUndoOrder(walletAddress, orderId);
    if (!order) return reply.code(404).send({ error: 'paid undo order not found' });
    if (order.status !== 'confirmed') {
      const rpcUrl = process.env.SOLANA_RPC_URL;
      if (!rpcUrl) return reply.code(503).send({ error: 'Solana RPC is not configured' });
      let valid = false;
      try {
        valid = await verifySolanaTransfer({ rpcUrl, signature: transactionSignature, sender: walletAddress, recipient: order.recipient, lamports: order.amountLamports, memo: order.memo });
      } catch {
        return reply.code(503).send({ error: 'Solana transaction verification unavailable' });
      }
      if (!valid) return reply.code(400).send({ error: 'transaction could not be verified' });
    }
    try {
      return await gameService.confirmPaidUndo(walletAddress, orderId, transactionSignature);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'paid undo failed' });
    }
  });

  app.delete('/api/account', async (request, reply) => {
    const walletAddress = await authenticate(request);
    if (!walletAddress) return reply.code(401).send({ error: 'authentication required' });
    await gameService.deleteAccount(walletAddress);
    for (const [tokenHash, session] of memorySessions) if (session.walletAddress === walletAddress) memorySessions.delete(tokenHash);
    reply.clearCookie('click1_session', { path: '/' });
    return { deleted: true };
  });

  app.get('/health/db', async (_request, reply) => {
    if (!database) return reply.code(503).send({ status: 'unconfigured' });
    await database.query('SELECT 1');
    return { status: 'ok' };
  });

  return app;
}
