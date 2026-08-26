import { applyMove, type GameState, type MoveResult } from '../../../src/game-engine/index';

export interface QueuedMove { row: number; col: number }
export interface OfflineQueue { gameId: string; baseState: GameState; moves: QueuedMove[] }

export function applyOfflineMove(state: GameState, move: QueuedMove, moveId: string): MoveResult {
  return applyMove(state, move.row, move.col, moveId);
}

export function replayOfflineMoves(queue: OfflineQueue): GameState {
  return queue.moves.reduce(
    (current, move, index) => applyOfflineMove(current, move, `offline-${index + 1}`).state,
    { ...queue.baseState, board: queue.baseState.board.map((row) => row.slice()) },
  );
}
