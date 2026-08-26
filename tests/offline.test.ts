import { describe, expect, it } from 'vitest';
import { createStateFromBoard } from '../src/game-engine/index.js';
import { applyOfflineMove, replayOfflineMoves, type OfflineQueue } from '../apps/web/src/offline';

describe('offline move queue', () => {
  it('applies a queued click with the shared game engine', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 2, 0, 0, 0],
    ], 42);
    const result = applyOfflineMove(state, { row: 5, col: 2 }, 'offline-1');
    expect(result.state.board[5]![2]).toBe(3);
    expect(result.state.canUndo).toBe(true);
  });

  it('replays queued moves from the saved server base state', () => {
    const queue: OfflineQueue = {
      gameId: 'game-1',
      baseState: createStateFromBoard([
        [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 2, 0, 0, 0],
      ], 42),
      moves: [{ row: 5, col: 2 }],
    };
    expect(replayOfflineMoves(queue).board[5]![2]).toBe(3);
  });
});
