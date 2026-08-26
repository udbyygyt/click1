import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  INITIAL_ENERGY,
  applyMove,
  createInitialState,
  createStateFromBoard,
  undoMove,
} from '../src/game-engine/index.js';

describe('createInitialState', () => {
  it('creates a deterministic playable 6x6 board with five energy', () => {
    const first = createInitialState(123);
    const second = createInitialState(123);

    expect(first).toEqual(second);
    expect(first.board).toHaveLength(BOARD_SIZE);
    expect(first.board.every((row) => row.length === BOARD_SIZE)).toBe(true);
    expect(first.board.flat().filter((value) => value > 0)).toHaveLength(6);
    expect(first.energy).toBe(INITIAL_ENERGY);
    expect(first.canUndo).toBe(false);
    expect(first.status).toBe('playing');
  });

  it('rejects a non-integer seed', () => {
    expect(() => createInitialState(1.5)).toThrow('seed must be an integer');
  });
});

describe('applyMove', () => {
  it('increments a tile, spends energy, and creates one new tile', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 0],
    ], 42);

    const result = applyMove(state, 5, 2, 'move-1');

    expect(result.state.board[5][2]).toBe(3);
    expect(result.state.energy).toBe(INITIAL_ENERGY - 1);
    expect(result.state.canUndo).toBe(true);
    expect(result.state.lastMoveId).toBe('move-1');
    expect(result.events.some((event) => event.type === 'spawn')).toBe(true);
  });

  it('merges three orthogonally connected tiles and scores their input sum', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 2, 3, 0, 0, 0],
      [0, 3, 0, 0, 0, 0],
    ], 42);

    const result = applyMove(state, 4, 1, 'move-1');

    expect(result.state.score).toBe(9);
    expect(result.state.board[5][1]).toBe(4);
    expect(result.state.board.flat().filter((value) => value === 3)).toHaveLength(0);
  });

  it('allows only one undo until a new move is made', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0, 0],
    ], 42);
    const moved = applyMove(state, 5, 2, 'move-1');
    const undone = undoMove(moved.state, moved.snapshot);

    expect(undone.canUndo).toBe(false);
    expect(undone.board).toEqual(state.board);
    expect(() => undoMove(undone, moved.snapshot)).toThrow('no undo available');
  });
});
