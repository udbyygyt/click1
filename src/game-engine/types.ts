export const BOARD_SIZE = 5;
export const INITIAL_ENERGY = 5;
export const MAX_ENERGY = 5;

export type GameStatus = 'playing' | 'won' | 'game_over';

export interface GameState {
  board: number[][];
  score: number;
  highScore?: number;
  energy: number;
  maxTile: number;
  rngState: number;
  canUndo: boolean;
  lastMoveId: string | null;
  status: GameStatus;
}

export interface MoveSnapshot extends GameState {
  moveId: string | null;
}

export type BoardSnapshot = number[][];

export type GameEvent =
  | { type: 'click'; row: number; col: number; from: number; to: number; boardBefore: BoardSnapshot; boardAfter: BoardSnapshot }
  | { type: 'merge'; value: number; inputSum: number; cells: Array<[number, number]>; anchor: [number, number]; boardBefore: BoardSnapshot; boardAfter: BoardSnapshot }
  | { type: 'fall'; moved: Array<{ from: [number, number]; downTo: [number, number]; to: [number, number]; value: number }>; boardBefore: BoardSnapshot; boardAfter: BoardSnapshot }
  | { type: 'spawn'; row: number; col: number; value: number; boardBefore: BoardSnapshot; boardAfter: BoardSnapshot };

export interface MoveResult {
  state: GameState;
  snapshot: MoveSnapshot;
  events: GameEvent[];
}
