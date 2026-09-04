import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  INITIAL_ENERGY,
  applyMove,
  createInitialState,
  createStateFromBoard,
  undoMove,
} from '../src/game-engine/index.js';

function matchingGroups(board: number[][]): Array<Array<[number, number]>> {
  const visited = new Set<string>();
  const groups: Array<Array<[number, number]>> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) {
    const startKey = `${row},${col}`;
    if (visited.has(startKey)) continue;
    const value = board[row]![col]!;
    const cells: Array<[number, number]> = [];
    const queue: Array<[number, number]> = [[row, col]];
    visited.add(startKey);
    while (queue.length > 0) {
      const [currentRow, currentCol] = queue.shift()!;
      cells.push([currentRow, currentCol]);
      for (const [nextRow, nextCol] of [[currentRow - 1, currentCol], [currentRow + 1, currentCol], [currentRow, currentCol - 1], [currentRow, currentCol + 1]] as Array<[number, number]>) {
        const key = `${nextRow},${nextCol}`;
        if (nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE && !visited.has(key) && board[nextRow]![nextCol] === value) {
          visited.add(key);
          queue.push([nextRow, nextCol]);
        }
      }
    }
    if (cells.length >= 3) groups.push(cells);
  }
  return groups;
}

function hasImmediateMergeMove(board: number[][]): boolean {
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) {
    const next = board.map((line) => line.slice());
    next[row]![col] += 1;
    if (matchingGroups(next).some((group) => group.some(([groupRow, groupCol]) => groupRow === row && groupCol === col))) return true;
  }
  return false;
}

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

  it('creates initial boards without matches or deadlocks', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const state = createInitialState(seed);
      expect(matchingGroups(state.board), `seed ${seed} contains an automatic match`).toEqual([]);
      expect(hasImmediateMergeMove(state.board), `seed ${seed} has no immediate merge move`).toBe(true);
    }
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
    expect(result.events[0]).toMatchObject({ type: 'click', scoreAfter: 0, energyAfter: INITIAL_ENERGY - 1 });
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

    expect(result.state.score).toBeGreaterThanOrEqual(90);
    expect(result.state.board[4][1]).toBe(4);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'merge', value: 4, inputSum: 90, scoreAfter: 90, energyAfter: 5 }));
    const merge = result.events.find((event) => event.type === 'merge');
    expect(merge && merge.type === 'merge' ? merge.boardAfter[3][1] : null).toBe(4);
    expect(merge && merge.type === 'merge' ? merge.boardAfter[3][2] : null).toBe(0);
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
    expect(result.state.score).toBeGreaterThanOrEqual(60);
  });

  it('uses the leftmost tile on the bottommost row as the automatic chain anchor', () => {
    const state = createStateFromBoard([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 3, 2, 3, 0],
      [0, 4, 4, 4, 0],
    ], 42);
    state.energy = 3;

    const result = applyMove(state, 3, 2, 'move-1');
    const merges = result.events.filter((event) => event.type === 'merge');

    expect(merges.length).toBeGreaterThanOrEqual(2);
    expect(result.events[0]).toMatchObject({ type: 'click', scoreAfter: 0, energyAfter: 2 });
    expect(merges[0]).toMatchObject({ anchor: [3, 2], value: 4, scoreAfter: 90, energyAfter: 3 });
    expect(merges[1]).toMatchObject({ anchor: [4, 1], value: 5, scoreAfter: 410, energyAfter: 4 });
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
    expect(matchingGroups(result.state.board)).toEqual([]);
  });

  it('auto-merges a group created by falling tiles before refilling', () => {
    const state = createStateFromBoard([
      [1, 3, 3, 5, 5],
      [1, 5, 4, 3, 3],
      [4, 2, 4, 1, 5],
      [3, 5, 3, 2, 4],
      [1, 4, 3, 2, 1],
    ], 2131433680);
    const result = applyMove(state, 4, 4, 'move-1');
    const fallIndex = result.events.findIndex((event) => event.type === 'fall');
    const nextMergeIndex = result.events.findIndex((event, index) => index > fallIndex && event.type === 'merge');

    expect(fallIndex).toBeGreaterThanOrEqual(0);
    expect(nextMergeIndex).toBeGreaterThan(fallIndex);
    expect(result.events.slice(fallIndex + 1, nextMergeIndex).some((event) => event.type === 'spawn')).toBe(false);
    expect(result.events[nextMergeIndex]).toMatchObject({ type: 'merge', value: 4, anchor: [4, 2] });
    expect(matchingGroups(result.state.board)).toEqual([]);
  });

  it('auto-merges three ones created by falling into a two', () => {
    const result = applyMove(createInitialState(2), 4, 4, 'move-1');
    const mergeIndex = result.events.findIndex((event, index) => event.type === 'merge' && event.value === 2 && result.events[index - 1]?.type === 'fall');
    const merge = result.events[mergeIndex];

    expect(mergeIndex).toBeGreaterThan(0);
    expect(merge).toMatchObject({ type: 'merge', value: 2, anchor: [3, 2] });
    expect(merge?.type === 'merge' && merge.cells.every(([row, col]) => merge.boardBefore[row]?.[col] === 1)).toBe(true);
  });

  it('auto-merges fours created by refill into a five', () => {
    const result = applyMove(createInitialState(1), 0, 3, 'move-1');
    const mergeIndex = result.events.findIndex((event, index) => event.type === 'merge' && event.value === 5 && result.events[index - 1]?.type === 'spawn');

    expect(mergeIndex).toBeGreaterThan(0);
    expect(result.events[mergeIndex]).toMatchObject({ type: 'merge', value: 5 });
  });

});
