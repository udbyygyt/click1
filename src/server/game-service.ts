import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { applyMove, createInitialState, undoMove, type GameEvent, type GameState, type MoveResult, type MoveSnapshot } from '../game-engine/index.js';
import type { PaidUndoOrder } from './payment-types.js';

export interface CurrentGame {
  id: string;
  walletAddress: string;
  state: GameState;
}

interface MemoryGame extends CurrentGame {
  moves: Array<{ id: string; snapshot: MoveSnapshot; row: number; col: number; events: GameEvent[]; resultState: GameState }>;
}

interface MemoryOrder extends PaidUndoOrder {}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function statusFor(state: GameState): 'playing' | 'won' | 'game_over' {
  return state.status;
}

export class GameService {
  private readonly memoryGames = new Map<string, MemoryGame>();
  private readonly memoryEntitlements = new Map<string, Set<string>>();
  private readonly memoryOrders = new Map<string, MemoryOrder>();

  public constructor(private readonly pool: Pool | null = null) {}

  public async startCurrentGame(walletAddress: string, replace = false): Promise<CurrentGame> {
    if (!walletAddress) throw new Error('wallet address is required');
    if (!this.pool) {
      const current = this.memoryGames.get(walletAddress);
      if (current && !replace) return this.cloneCurrent(current);
      this.memoryGames.set(walletAddress, { id: randomUUID(), walletAddress, state: createInitialState(Date.now()), moves: [] });
      return this.cloneCurrent(this.memoryGames.get(walletAddress)!);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const currentResult = await client.query<{ id: string; state: GameState }>(
        'SELECT id, state FROM games WHERE wallet_address = $1 AND status <> \'abandoned\' FOR UPDATE',
        [walletAddress],
      );
      if (currentResult.rows[0] && !replace) {
        await client.query('COMMIT');
        return { id: currentResult.rows[0].id, walletAddress, state: currentResult.rows[0].state };
      }
      if (currentResult.rows[0]) {
        await client.query(
          'UPDATE games SET status = \'abandoned\', abandoned_at = now(), updated_at = now() WHERE id = $1',
          [currentResult.rows[0].id],
        );
      }
      const id = randomUUID();
      const state = createInitialState(Date.now());
      await client.query(
        'INSERT INTO games (id, wallet_address, status, state) VALUES ($1, $2, $3, $4::jsonb)',
        [id, walletAddress, statusFor(state), JSON.stringify(state)],
      );
      await client.query('COMMIT');
      return { id, walletAddress, state };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async getCurrentGame(walletAddress: string): Promise<CurrentGame | null> {
    if (!this.pool) {
      const current = this.memoryGames.get(walletAddress);
      return current ? this.cloneCurrent(current) : null;
    }
    const result = await this.pool.query<{ id: string; state: GameState }>(
      'SELECT id, state FROM games WHERE wallet_address = $1 AND status <> \'abandoned\'',
      [walletAddress],
    );
    const row = result.rows[0];
    return row ? { id: row.id, walletAddress, state: row.state } : null;
  }

  public async applyCurrentMove(walletAddress: string, row: number, col: number, clientMoveId?: string): Promise<MoveResult & { moveId: string }> {
    const operationId = clientMoveId ?? randomUUID();
    if (!this.pool) {
      const current = this.memoryGames.get(walletAddress);
      if (!current) throw new Error('current game not found');
      const moveId = operationId;
      const existing = current.moves.find((move) => move.id === moveId);
      if (existing) return { state: { ...existing.resultState, board: existing.resultState.board.map((line) => line.slice()) }, snapshot: { ...existing.snapshot, board: existing.snapshot.board.map((line) => line.slice()) }, events: existing.events, moveId };
      const result = applyMove(current.state, row, col, moveId);
      current.state = result.state;
      current.moves.push({ id: moveId, snapshot: result.snapshot, row, col, events: result.events, resultState: result.state });
      return { ...result, moveId };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const game = await this.lockCurrentGame(client, walletAddress);
      const existingResult = await client.query<{ id: string; snapshot: MoveSnapshot; result_state: GameState; events: GameEvent[] }>(
        'SELECT id, snapshot, result_state, events FROM game_moves WHERE game_id = $1 AND client_move_id = $2',
        [game.id, operationId],
      );
      if (existingResult.rows[0]) {
        await client.query('COMMIT');
        const existing = existingResult.rows[0];
        return { state: existing.result_state, snapshot: existing.snapshot, events: existing.events, moveId: existing.id };
      }
      const moveId = operationId;
      const result = applyMove(game.state, row, col, moveId);
      const moveNumberResult = await client.query<{ next_number: number }>(
        'SELECT COALESCE(MAX(move_number), 0) + 1 AS next_number FROM game_moves WHERE game_id = $1',
        [game.id],
      );
      const moveNumber = Number(moveNumberResult.rows[0]?.next_number ?? 1);
      await client.query(
        'INSERT INTO game_moves (id, game_id, move_number, row_index, col_index, client_move_id, snapshot, result_state, events) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)',
        [moveId, game.id, moveNumber, row, col, operationId, JSON.stringify(result.snapshot), JSON.stringify(result.state), JSON.stringify(result.events)],
      );
      await client.query(
        'UPDATE games SET state = $1::jsonb, status = $2, updated_at = now() WHERE id = $3',
        [JSON.stringify(result.state), statusFor(result.state), game.id],
      );
      await client.query('COMMIT');
      return { ...result, moveId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async getDailyUndoStatus(walletAddress: string, now = new Date()): Promise<{ utcDate: string; available: boolean }> {
    const date = utcDate(now);
    if (!this.pool) {
      const usedDates = this.memoryEntitlements.get(walletAddress);
      return { utcDate: date, available: !usedDates?.has(date) };
    }
    await this.pool.query(
      'INSERT INTO daily_undo_entitlements (wallet_address, utc_date) VALUES ($1, $2) ON CONFLICT (wallet_address, utc_date) DO NOTHING',
      [walletAddress, date],
    );
    const result = await this.pool.query<{ used: boolean }>(
      'SELECT used FROM daily_undo_entitlements WHERE wallet_address = $1 AND utc_date = $2',
      [walletAddress, date],
    );
    return { utcDate: date, available: result.rows[0]?.used !== true };
  }

  public async undoCurrent(walletAddress: string, now = new Date()): Promise<GameState> {
    const date = utcDate(now);
    if (!this.pool) {
      const current = this.memoryGames.get(walletAddress);
      if (!current) throw new Error('current game not found');
      if (!current.state.canUndo) throw new Error('no undo available');
      const usedDates = this.memoryEntitlements.get(walletAddress) ?? new Set<string>();
      if (usedDates.has(date)) throw new Error('free undo already used');
      const lastMove = current.moves.at(-1);
      if (!lastMove) throw new Error('no move to undo');
      current.state = undoMove(current.state, lastMove.snapshot);
      usedDates.add(date);
      this.memoryEntitlements.set(walletAddress, usedDates);
      return { ...current.state, board: current.state.board.map((line) => line.slice()) };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const game = await this.lockCurrentGame(client, walletAddress);
      if (!game.state.canUndo) throw new Error('no undo available');
      const moveResult = await client.query<{ snapshot: MoveSnapshot }>(
        'SELECT snapshot FROM game_moves WHERE game_id = $1 ORDER BY move_number DESC LIMIT 1',
        [game.id],
      );
      const snapshot = moveResult.rows[0]?.snapshot;
      if (!snapshot) throw new Error('no move to undo');
      await client.query(
        'INSERT INTO daily_undo_entitlements (wallet_address, utc_date) VALUES ($1, $2) ON CONFLICT (wallet_address, utc_date) DO NOTHING',
        [walletAddress, date],
      );
      const entitlement = await client.query(
        'UPDATE daily_undo_entitlements SET used = TRUE WHERE wallet_address = $1 AND utc_date = $2 AND used = FALSE RETURNING wallet_address',
        [walletAddress, date],
      );
      if (entitlement.rowCount !== 1) throw new Error('free undo already used');
      const state = undoMove(game.state, snapshot);
      await client.query('UPDATE games SET state = $1::jsonb, updated_at = now() WHERE id = $2', [JSON.stringify(state), game.id]);
      await client.query('COMMIT');
      return state;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async createPaidUndoOrder(walletAddress: string, recipient: string, network: 'mainnet-beta' = 'mainnet-beta'): Promise<PaidUndoOrder> {
    if (network !== 'mainnet-beta') throw new Error('paid undo requires mainnet-beta');
    const id = randomUUID();
    const memo = `click1-undo:${id}`;
    if (!this.pool) {
      const current = this.memoryGames.get(walletAddress);
      if (!current) throw new Error('current game not found');
      if (!current.state.canUndo || !current.state.lastMoveId) throw new Error('no undo available');
      const existing = [...this.memoryOrders.values()].find((order) => order.gameId === current.id && order.moveId === current.state.lastMoveId && (order.status === 'created' || order.status === 'pending'));
      if (existing) return { ...existing };
      const order: MemoryOrder = { id, walletAddress, gameId: current.id, moveId: current.state.lastMoveId, amountLamports: 10000000, recipient, network, memo, transactionSignature: null, status: 'created', resultState: null };
      this.memoryOrders.set(id, order);
      return { ...order };
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const game = await this.lockCurrentGame(client, walletAddress);
      if (!game.state.canUndo || !game.state.lastMoveId) throw new Error('no undo available');
      const existingResult = await client.query<PaidUndoOrder>(
        'SELECT id, wallet_address AS "walletAddress", game_id AS "gameId", move_id AS "moveId", amount_lamports::int AS "amountLamports", recipient, network, memo, transaction_signature AS "transactionSignature", status, result_state AS "resultState" FROM undo_orders WHERE game_id = $1 AND move_id = $2 AND status IN (\'created\', \'pending\') FOR UPDATE',
        [game.id, game.state.lastMoveId],
      );
      if (existingResult.rows[0]) { await client.query('COMMIT'); return existingResult.rows[0]; }
      const order: PaidUndoOrder = { id, walletAddress, gameId: game.id, moveId: game.state.lastMoveId, amountLamports: 10000000, recipient, network, memo, transactionSignature: null, status: 'created', resultState: null };
      await client.query(
        'INSERT INTO undo_orders (id, wallet_address, game_id, move_id, amount_lamports, recipient, network, memo, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [order.id, order.walletAddress, order.gameId, order.moveId, order.amountLamports, order.recipient, order.network, order.memo, order.status],
      );
      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async getPaidUndoOrder(walletAddress: string, orderId: string): Promise<PaidUndoOrder | null> {
    if (!this.pool) {
      const order = this.memoryOrders.get(orderId);
      return order?.walletAddress === walletAddress ? { ...order } : null;
    }
    const result = await this.pool.query<PaidUndoOrder>(
      'SELECT id, wallet_address AS "walletAddress", game_id AS "gameId", move_id AS "moveId", amount_lamports::int AS "amountLamports", recipient, network, memo, transaction_signature AS "transactionSignature", status, result_state AS "resultState" FROM undo_orders WHERE id = $1 AND wallet_address = $2',
      [orderId, walletAddress],
    );
    return result.rows[0] ?? null;
  }

  public async confirmPaidUndo(walletAddress: string, orderId: string, transactionSignature: string): Promise<GameState> {
    if (!transactionSignature) throw new Error('transaction signature is required');
    if (!this.pool) {
      const order = this.memoryOrders.get(orderId);
      const current = this.memoryGames.get(walletAddress);
      if (!order || order.walletAddress !== walletAddress || !current) throw new Error('paid undo order not found');
      if (order.status === 'confirmed' && order.resultState) {
        if (order.transactionSignature !== transactionSignature) throw new Error('transaction signature does not match order');
        return { ...order.resultState, board: order.resultState.board.map((row) => row.slice()) };
      }
      if (order.status !== 'created' && order.status !== 'pending') throw new Error('paid undo order is not payable');
      if (!current.state.canUndo || current.state.lastMoveId !== order.moveId) throw new Error('undo step is no longer current');
      for (const existing of this.memoryOrders.values()) {
        if (existing.id !== order.id && existing.transactionSignature === transactionSignature) throw new Error('transaction already used');
      }
      const move = current.moves.find((item) => item.id === order.moveId);
      if (!move) throw new Error('undo move not found');
      current.state = undoMove(current.state, move.snapshot);
      order.status = 'confirmed';
      order.transactionSignature = transactionSignature;
      order.resultState = { ...current.state, board: current.state.board.map((row) => row.slice()) };
      return { ...current.state, board: current.state.board.map((row) => row.slice()) };
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const orderResult = await client.query<PaidUndoOrder>(
        'SELECT id, wallet_address AS "walletAddress", game_id AS "gameId", move_id AS "moveId", amount_lamports::int AS "amountLamports", recipient, network, memo, transaction_signature AS "transactionSignature", status, result_state AS "resultState" FROM undo_orders WHERE id = $1 AND wallet_address = $2 FOR UPDATE',
        [orderId, walletAddress],
      );
      const order = orderResult.rows[0];
      if (!order) throw new Error('paid undo order not found');
      const game = await this.lockCurrentGame(client, walletAddress);
      if (order.status === 'confirmed' && order.resultState) {
        if (order.transactionSignature !== transactionSignature) throw new Error('transaction signature does not match order');
        await client.query('COMMIT');
        return order.resultState;
      }
      if (order.status !== 'created' && order.status !== 'pending') throw new Error('paid undo order is not payable');
      if (!game.state.canUndo || game.state.lastMoveId !== order.moveId) throw new Error('undo step is no longer current');
      const moveResult = await client.query<{ snapshot: MoveSnapshot }>('SELECT snapshot FROM game_moves WHERE id = $1 AND game_id = $2', [order.moveId, order.gameId]);
      const snapshot = moveResult.rows[0]?.snapshot;
      if (!snapshot) throw new Error('undo move not found');
      const state = undoMove(game.state, snapshot);
      await client.query('UPDATE undo_orders SET status = \'confirmed\', transaction_signature = $1, result_state = $2::jsonb, confirmed_at = now() WHERE id = $3', [transactionSignature, JSON.stringify(state), order.id]);
      await client.query('UPDATE games SET state = $1::jsonb, updated_at = now() WHERE id = $2', [JSON.stringify(state), game.id]);
      await client.query('COMMIT');
      return state;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async deleteAccount(walletAddress: string): Promise<void> {
    if (!this.pool) {
      this.memoryGames.delete(walletAddress);
      this.memoryEntitlements.delete(walletAddress);
      for (const [orderId, order] of this.memoryOrders) if (order.walletAddress === walletAddress) this.memoryOrders.delete(orderId);
      return;
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM wallet_sessions WHERE wallet_address = $1', [walletAddress]);
      await client.query('DELETE FROM auth_nonces WHERE wallet_address = $1', [walletAddress]);
      await client.query('DELETE FROM daily_undo_entitlements WHERE wallet_address = $1', [walletAddress]);
      await client.query('DELETE FROM account_deletion_requests WHERE wallet_address = $1', [walletAddress]);
      await client.query('DELETE FROM games WHERE wallet_address = $1', [walletAddress]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockCurrentGame(client: PoolClient, walletAddress: string): Promise<CurrentGame> {
    const result = await client.query<{ id: string; state: GameState }>(
      'SELECT id, state FROM games WHERE wallet_address = $1 AND status <> \'abandoned\' FOR UPDATE',
      [walletAddress],
    );
    const row = result.rows[0];
    if (!row) throw new Error('current game not found');
    return { id: row.id, walletAddress, state: row.state };
  }

  private cloneCurrent(game: MemoryGame): CurrentGame {
    return { id: game.id, walletAddress: game.walletAddress, state: { ...game.state, board: game.state.board.map((row) => row.slice()) } };
  }
}
