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
  it('creates a deterministic full 5x5 board with five energy and no automatic matches', () => {
    const first = createInitialState(123);
    const second = createInitialState(123);

    expect(first).toEqual(second);
    expect(first.board).toHaveLength(BOARD_SIZE);
    expect(first.board.every((row) => row.length === BOARD_SIZE)).toBe(true);
    expect(first.board.flat().filter((value) => value > 0)).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(first.board.flat().every((value) => value >= 1 && value <= 5)).toBe(true);
    expect(new Set(first.board.flat())).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(first.energy).toBe(INITIAL_ENERGY);
    expect(first.canUndo).toBe(false);
    expect(first.status).toBe('playing');
  });

  it('rejects a non-integer seed', () => {
    expect(() => createInitialState(1.5)).toThrow('seed must be an integer');
  });
});

describe('applyMove', () => {
  it('increments a tile, spends energy, and refills the board', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
    ], 42);

    const result = applyMove(state, 4, 2, 'move-1');

    expect(result.state.board[4][2]).toBe(3);
    expect(result.state.energy).toBe(INITIAL_ENERGY - 1);
    expect(result.state.canUndo).toBe(true);
    expect(result.state.lastMoveId).toBe('move-1');
    expect(result.state.board.flat().filter((value) => value > 0)).toHaveLength(BOARD_SIZE * BOARD_SIZE);
  });

  it('settles remaining tiles down without shifting columns before refilling', () => {
    const state = createStateFromBoard([
      [0, 5, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 3, 0, 0],
      [0, 6, 2, 3, 0],
    ], 42);

    const result = applyMove(state, 4, 2, 'move-1');
    const fall = result.events.find((event) => event.type === 'fall');

    expect(fall).toMatchObject({
      type: 'fall',
      moved: expect.arrayContaining([
        { from: [0, 1], downTo: [3, 1], to: [3, 1], value: 5 },
      ]),
    });
    expect(fall && fall.type === 'fall' && fall.moved.every(({ from, to }) => from[1] === to[1])).toBe(true);
    expect(result.state.board.flat().filter((value) => value > 0)).toHaveLength(BOARD_SIZE * BOARD_SIZE);
  });

  it('merges three orthogonally connected tiles and scores their input sum', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 2, 3, 0, 0],
      [0, 3, 0, 0, 0],
    ], 42);

    const result = applyMove(state, 3, 1, 'move-1');

    expect(result.state.score).toBe(90);
    expect(result.state.board[4][1]).toBe(4);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'merge', value: 4, inputSum: 90 }));
    const mergeIndex = result.events.findIndex((event) => event.type === 'merge');
    const fallIndex = result.events.findIndex((event) => event.type === 'fall');
    const spawnIndex = result.events.findIndex((event) => event.type === 'spawn');
    expect(mergeIndex).toBeGreaterThanOrEqual(0);
    expect(fallIndex).toBeGreaterThan(mergeIndex);
    expect(spawnIndex).toBeGreaterThan(fallIndex);
  });

  it('creates a plus-one tile at the trigger point for three equal twos', () => {
    const state = createStateFromBoard([
      [0, 2, 0, 0, 0],
      [0, 1, 0, 0, 0],
      [0, 2, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ], 42);

    const result = applyMove(state, 1, 1, 'move-1');
    const merge = result.events.find((event) => event.type === 'merge');

    expect(merge).toMatchObject({ type: 'merge', value: 3, inputSum: 60, anchor: [1, 1] });
    expect(result.state.score).toBe(60);
  });

  it('allows only one undo until a new move is made', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 2, 0, 0],
    ], 42);
    const moved = applyMove(state, 4, 2, 'move-1');
    const undone = undoMove(moved.state, moved.snapshot);

    expect(undone.canUndo).toBe(false);
    expect(undone.board).toEqual(state.board);
    expect(() => undoMove(undone, moved.snapshot)).toThrow('no undo available');
  });

  it('does not clear unrelated matches when the clicked tile creates no match', () => {
    const state = createStateFromBoard([
      [1, 1, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [2, 0, 0, 0, 0],
    ], 42);

    const result = applyMove(state, 4, 0, 'move-1');

    expect(result.events.some((event) => event.type === 'merge')).toBe(false);
    expect(result.state.score).toBe(0);
    expect(result.state.board[0].slice(0, 3)).toEqual([1, 1, 1]);
  });

  it('preserves historical high score without ending the game', () => {
    const state = createStateFromBoard([
      [2, 1, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ], 42);
    state.highScore = 2020;

    const result = applyMove(state, 0, 1, 'move-1');

    expect(result.state.status).toBe('playing');
    expect(result.state.highScore).toBe(2020);
    expect(result.state.score).toBeGreaterThan(0);
  });

  it('does not lower historical high score when undoing a move', () => {
    const state = createStateFromBoard([
      [2, 1, 2, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ], 42);
    const moved = applyMove(state, 0, 1, 'move-1');
    const undone = undoMove(moved.state, moved.snapshot);

    expect(undone.score).toBe(0);
    expect(undone.highScore).toBe(moved.state.score);
  });

  it('uses the 3-7 spawn range once the score reaches 300000', () => {
    const state = createStateFromBoard([
      [1, 2, 3, 4, 5],
      [5, 4, 3, 2, 1],
      [2, 3, 4, 5, 2],
      [3, 4, 5, 2, 3],
      [4, 5, 2, 3, 0],
    ], 42);
    state.score = 300000;

    const result = applyMove(state, 0, 0, 'move-1');
    const spawned = result.events.filter((event) => event.type === 'spawn').map((event) => event.value);

    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((value) => value >= 3 && value <= 7)).toBe(true);
  });

  it('auto-merges a matching group created by refill, including three ones', () => {
    const state = createStateFromBoard([
      [3, 3, 4, 5, 1],
      [3, 3, 5, 1, 2],
      [3, 3, 1, 2, 4],
      [3, 3, 2, 4, 5],
      [2, 4, 5, 1, 3],
    ], 6);

    const result = applyMove(state, 4, 0, 'move-1');
    const merges = result.events.filter((event) => event.type === 'merge');

    expect(merges.some((event) => event.type === 'merge' && event.value === 2 && event.cells.length >= 3)).toBe(true);
  });

});
