import { BOARD_SIZE, INITIAL_ENERGY, MAX_ENERGY, type GameEvent, type GameState, type MoveResult, type MoveSnapshot } from './types.js';

export function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<number>(BOARD_SIZE).fill(0));
}

export function createInitialState(seed: number): GameState {
  if (!Number.isInteger(seed)) {
    throw new Error('seed must be an integer');
  }

  const state: GameState = {
    board: createEmptyBoard(),
    score: 0,
    energy: INITIAL_ENERGY,
    maxTile: 0,
    rngState: seed,
    canUndo: false,
    lastMoveId: null,
    status: 'playing',
  };

  for (let index = 0; index < 6; index += 1) {
    spawnTile(state, []);
  }
  return state;
}

export function createStateFromBoard(board: number[][], seed = 1): GameState {
  if (board.length !== BOARD_SIZE || board.some((row) => row.length !== BOARD_SIZE)) {
    throw new Error('board must be 6x6');
  }
  const state: GameState = {
    board: board.map((row) => row.slice()),
    score: 0,
    energy: INITIAL_ENERGY,
    maxTile: Math.max(0, ...board.flat()),
    rngState: seed,
    canUndo: false,
    lastMoveId: null,
    status: 'playing',
  };
  return state;
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => row.slice());
}

function cloneState(state: GameState): GameState {
  return { ...state, board: cloneBoard(state.board) };
}

function nextRandom(state: GameState): number {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0 || 0x6d2b79f5;
  return state.rngState / 0x100000000;
}

function getEmptyColumns(state: GameState): number[] {
  return Array.from({ length: BOARD_SIZE }, (_, col) => col)
    .filter((col) => state.board.some((row) => row[col] === 0));
}

function generatedValue(state: GameState): number {
  const highest = Math.max(0, ...state.board.flat());
  const random = nextRandom(state);
  if (highest < 8) return random < 0.6 ? 1 : random < 0.9 ? 2 : 3;
  if (highest < 14) return random < 0.5 ? 1 : random < 0.8 ? 2 : random < 0.95 ? 3 : 4;
  return random < 0.45 ? 1 : random < 0.75 ? 2 : random < 0.9 ? 3 : random < 0.98 ? 4 : 5;
}

function spawnTile(state: GameState, events: GameEvent[]): boolean {
  const columns = getEmptyColumns(state);
  if (columns.length === 0) return false;
  const col = columns[Math.floor(nextRandom(state) * columns.length)]!;
  let row = BOARD_SIZE - 1;
  while (row >= 0 && state.board[row]![col] !== 0) row -= 1;
  if (row < 0) return false;
  const value = generatedValue(state);
  state.board[row]![col] = value;
  state.maxTile = Math.max(state.maxTile, value);
  events.push({ type: 'spawn', row, col, value });
  return true;
}

function neighbors(row: number, col: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (const [nextRow, nextCol] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as Array<[number, number]>) {
    if (nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE) result.push([nextRow, nextCol]);
  }
  return result;
}

function findGroups(board: number[][]): Array<{ value: number; cells: Array<[number, number]>; anchor: [number, number] }> {
  const visited = new Set<string>();
  const groups: Array<{ value: number; cells: Array<[number, number]>; anchor: [number, number] }> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row]![col]!;
      const key = `${row},${col}`;
      if (value === 0 || visited.has(key)) continue;
      const cells: Array<[number, number]> = [];
      const queue: Array<[number, number]> = [[row, col]];
      visited.add(key);
      while (queue.length > 0) {
        const [currentRow, currentCol] = queue.shift()!;
        cells.push([currentRow, currentCol]);
        for (const [nextRow, nextCol] of neighbors(currentRow, currentCol)) {
          const nextKey = `${nextRow},${nextCol}`;
          if (!visited.has(nextKey) && board[nextRow]![nextCol] === value) {
            visited.add(nextKey);
            queue.push([nextRow, nextCol]);
          }
        }
      }
      if (cells.length >= 3) {
        const anchor = cells.reduce((best, cell) => cell[0] > best[0] || (cell[0] === best[0] && cell[1] > best[1]) ? cell : best);
        groups.push({ value, cells, anchor });
      }
    }
  }
  return groups.sort((left, right) => right.anchor[0] - left.anchor[0] || right.anchor[1] - left.anchor[1]);
}

function applyGravity(state: GameState, events: GameEvent[]): void {
  const moved: Array<{ from: [number, number]; to: [number, number]; value: number }> = [];
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const values: Array<{ row: number; value: number }> = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const value = state.board[row]![col]!;
      if (value !== 0) values.push({ row, value });
    }
    for (let row = 0; row < BOARD_SIZE; row += 1) state.board[row]![col] = 0;
    values.forEach(({ row: fromRow, value }, index) => {
      const toRow = BOARD_SIZE - 1 - index;
      state.board[toRow]![col] = value;
      if (fromRow !== toRow) moved.push({ from: [fromRow, col], to: [toRow, col], value });
    });
  }
  if (moved.length > 0) events.push({ type: 'fall', moved });
}

export function applyMove(input: GameState, row: number, col: number, moveId: string): MoveResult {
  if (input.status !== 'playing') throw new Error('game is not playing');
  if (input.energy <= 0) throw new Error('no energy');
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    throw new Error('invalid cell');
  }
  if (input.board[row]![col] === 0) throw new Error('cannot click empty cell');
  const snapshot: MoveSnapshot = { ...cloneState(input), moveId: input.lastMoveId };
  const state = cloneState(input);
  const events: GameEvent[] = [];
  const from = state.board[row]![col]!;
  state.board[row]![col] = from + 1;
  state.energy -= 1;
  events.push({ type: 'click', row, col, from, to: from + 1 });
  let merged = false;
  while (true) {
    const groups = findGroups(state.board);
    if (groups.length === 0) break;
    merged = true;
    for (const group of groups) {
      const inputSum = group.cells.reduce((sum, [cellRow, cellCol]) => sum + state.board[cellRow]![cellCol]!, 0);
      for (const [cellRow, cellCol] of group.cells) state.board[cellRow]![cellCol] = 0;
      state.board[group.anchor[0]]![group.anchor[1]] = group.value + 1;
      state.score += inputSum;
      state.energy = Math.min(MAX_ENERGY, state.energy + 1);
      events.push({ type: 'merge', value: group.value + 1, inputSum, cells: group.cells, anchor: group.anchor });
    }
    applyGravity(state, events);
  }
  const spawned = spawnTile(state, events);
  if (!spawned && !merged) state.status = 'game_over';
  state.maxTile = Math.max(0, ...state.board.flat());
  state.canUndo = true;
  state.lastMoveId = moveId;
  return { state, snapshot, events };
}

export function undoMove(state: GameState, snapshot: MoveSnapshot): GameState {
  if (!state.canUndo) throw new Error('no undo available');
  return { ...cloneState(snapshot), canUndo: false, lastMoveId: snapshot.moveId };
}
