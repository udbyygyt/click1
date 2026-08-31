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
    highScore: 0,
    energy: INITIAL_ENERGY,
    maxTile: 0,
    rngState: seed,
    canUndo: false,
    lastMoveId: null,
    status: 'playing',
  };

  fillBoard(state, []);
  return state;
}

export function createStateFromBoard(board: number[][], seed = 1): GameState {
  if (board.length !== BOARD_SIZE || board.some((row) => row.length !== BOARD_SIZE)) {
    throw new Error('board must be 5x5');
  }
  const state: GameState = {
    board: board.map((row) => row.slice()),
    score: 0,
    highScore: 0,
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

interface SpawnProfile { values: number[]; weights: number[] }

function getSpawnProfile(score: number): SpawnProfile {
  if (score < 30000) return { values: [1, 2, 3, 4, 5], weights: [25, 23, 20, 18, 14] };
  if (score < 90000) return { values: [1, 2, 3, 4, 5, 6], weights: [16, 19, 21, 19, 15, 10] };
  if (score < 180000) return { values: [2, 3, 4, 5, 6], weights: [18, 22, 23, 20, 12] };
  if (score < 300000) return { values: [2, 3, 4, 5, 6, 7], weights: [14, 19, 22, 20, 15, 10] };
  const stage = Math.floor((score - 300000) / 300000);
  const min = 3 + Math.floor(stage / 2);
  const max = 7 + Math.ceil(stage / 2);
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return { values, weights: values.map((_, index) => Math.max(8, 28 - index * 4)) };
}

function generatedValue(state: GameState, row: number, col: number): number {
  const profile = getSpawnProfile(state.score);
  const totalWeight = profile.weights.reduce((sum, weight) => sum + weight, 0);
  let target = nextRandom(state) * totalWeight;
  let start = 0;
  for (let index = 0; index < profile.weights.length; index += 1) {
    target -= profile.weights[index]!;
    if (target <= 0) { start = index; break; }
  }
  return profile.values[start]!;
}

function spawnTile(state: GameState, events: GameEvent[]): boolean {
  const columns = getEmptyColumns(state);
  if (columns.length === 0) return false;
  const col = columns[Math.floor(nextRandom(state) * columns.length)]!;
  let row = BOARD_SIZE - 1;
  while (row >= 0 && state.board[row]![col] !== 0) row -= 1;
  if (row < 0) return false;
  const value = generatedValue(state, row, col);
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

function findGroupAt(board: number[][], row: number, col: number): { value: number; cells: Array<[number, number]>; anchor: [number, number] } | null {
  const value = board[row]![col]!;
  if (value === 0) return null;
  const cells: Array<[number, number]> = [];
  const visited = new Set<string>([`${row},${col}`]);
  const queue: Array<[number, number]> = [[row, col]];
  while (queue.length > 0) {
    const [currentRow, currentCol] = queue.shift()!;
    cells.push([currentRow, currentCol]);
    for (const [nextRow, nextCol] of neighbors(currentRow, currentCol)) {
      const key = `${nextRow},${nextCol}`;
      if (!visited.has(key) && board[nextRow]![nextCol] === value) {
        visited.add(key);
        queue.push([nextRow, nextCol]);
      }
    }
  }
  if (cells.length < 3) return null;
  const anchor = cells.reduce((best, cell) => cell[0] > best[0] || (cell[0] === best[0] && cell[1] > best[1]) ? cell : best);
  return { value, cells, anchor };
}

function fillBoard(state: GameState, events: GameEvent[]): Array<[number, number]> {
  const spawned: Array<[number, number]> = [];
  while (spawnTile(state, events)) {
    const event = events[events.length - 1];
    if (event?.type === 'spawn') spawned.push([event.row, event.col]);
  }
  return spawned;
}

type Group = NonNullable<ReturnType<typeof findGroupAt>>;

function findGroups(board: number[][]): Group[] {
  const groups: Group[] = [];
  const visited = new Set<string>();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const key = `${row},${col}`;
      if (visited.has(key) || board[row]![col] === 0) continue;
      const group = findGroupAt(board, row, col);
      if (!group) {
        visited.add(key);
        continue;
      }
      groups.push(group);
      for (const [cellRow, cellCol] of group.cells) visited.add(`${cellRow},${cellCol}`);
    }
  }
  return groups;
}

function chooseBottomLeft(cells: Array<[number, number]>): [number, number] {
  return cells.reduce((best, cell) => cell[0] > best[0] || (cell[0] === best[0] && cell[1] < best[1]) ? cell : best);
}

function applyDownThenLeft(state: GameState, events: GameEvent[], trigger: [number, number]): [number, number] {
  type Piece = { value: number; from: [number, number]; downTo: [number, number]; to: [number, number]; isTrigger: boolean };
  const down: Array<Array<Piece | null>> = createEmptyBoard().map((row) => row.map(() => null));
  const pieces: Piece[] = [];

  for (let col = 0; col < BOARD_SIZE; col += 1) {
    let nextRow = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= 0; row -= 1) {
      const value = state.board[row]![col]!;
      if (value === 0) continue;
      const piece: Piece = { value, from: [row, col], downTo: [nextRow, col], to: [nextRow, col], isTrigger: row === trigger[0] && col === trigger[1] };
      down[nextRow]![col] = piece;
      pieces.push(piece);
      nextRow -= 1;
    }
  }

  const settled: Array<Array<Piece | null>> = createEmptyBoard().map((row) => row.map(() => null));
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    let nextCol = 0;
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = down[row]![col];
      if (!piece) continue;
      piece.to = [row, nextCol];
      settled[row]![nextCol] = piece;
      nextCol += 1;
    }
  }

  state.board = settled.map((row) => row.map((piece) => piece?.value ?? 0));
  const moved = pieces.filter((piece) => piece.from[0] !== piece.to[0] || piece.from[1] !== piece.to[1]);
  if (moved.length > 0) events.push({ type: 'fall', moved: moved.map(({ value, from, downTo, to }) => ({ value, from, downTo, to })) });
  const triggerPiece = pieces.find((piece) => piece.isTrigger);
  return triggerPiece?.to ?? trigger;
}

export function applyMove(input: GameState, row: number, col: number, moveId: string): MoveResult {
  if (input.status !== 'playing') throw new Error('game is not playing');
  if (input.energy <= 0) throw new Error('no energy');
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    throw new Error('invalid cell');
  }
  if (input.board[row]![col] === 0) throw new Error('cannot click empty cell');
  const wasFull = input.board.every((boardRow) => boardRow.every((value) => value !== 0));
  const snapshot: MoveSnapshot = { ...cloneState(input), moveId: input.lastMoveId };
  const state = cloneState(input);
  const events: GameEvent[] = [];
  const from = state.board[row]![col]!;
  state.board[row]![col] = from + 1;
  state.energy -= 1;
  events.push({ type: 'click', row, col, from, to: from + 1 });
  let chain = 0;
  const resolveChain = (initialGroup: Group, initialTrigger: [number, number]): void => {
    let trigger = initialTrigger;
    let groups: Group | null = initialGroup;
    while (groups) {
      chain += 1;
      const mergeTrigger = chain === 1 ? trigger : chooseBottomLeft(groups.cells);
      const inputSum = groups.value * groups.cells.length * 10 * Math.min(chain, 5);
      for (const [cellRow, cellCol] of groups.cells) state.board[cellRow]![cellCol] = 0;
      const nextValue = groups.value + 1;
      state.board[mergeTrigger[0]]![mergeTrigger[1]] = nextValue;
      state.score += inputSum;
      state.energy = Math.min(MAX_ENERGY, state.energy + 1);
      events.push({ type: 'merge', value: nextValue, inputSum, cells: groups.cells, anchor: mergeTrigger });
      trigger = applyDownThenLeft(state, events, mergeTrigger);
      groups = findGroupAt(state.board, trigger[0], trigger[1]);
    }
  };

  const initialGroup = findGroupAt(state.board, row, col);
  if (initialGroup) resolveChain(initialGroup, [row, col]);

  let spawned = fillBoard(state, events);
  while (wasFull && chain > 0 && spawned.length > 0) {
    const spawnedKeys = new Set(spawned.map(([spawnRow, spawnCol]) => `${spawnRow},${spawnCol}`));
    // A refill can trigger a chain, but an unrelated group already on the board stays idle.
    const autoGroup = findGroups(state.board).find((group) => group.cells.some(([cellRow, cellCol]) => spawnedKeys.has(`${cellRow},${cellCol}`)));
    if (!autoGroup) break;
    const autoTrigger = chooseBottomLeft(autoGroup.cells);
    resolveChain(autoGroup, autoTrigger);
    spawned = fillBoard(state, events);
  }
  state.maxTile = Math.max(0, ...state.board.flat());
  state.highScore = Math.max(state.highScore ?? state.score, state.score);
  state.canUndo = true;
  state.lastMoveId = moveId;
  return { state, snapshot, events };
}

export function undoMove(state: GameState, snapshot: MoveSnapshot): GameState {
  if (!state.canUndo) throw new Error('no undo available');
  return { ...cloneState(snapshot), highScore: Math.max(state.highScore ?? state.score, snapshot.highScore ?? snapshot.score), canUndo: false, lastMoveId: snapshot.moveId };
}
