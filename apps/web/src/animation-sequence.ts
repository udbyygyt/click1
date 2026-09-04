import type { GameEvent } from '../../../src/game-engine/types';

type FallMove = Extract<GameEvent, { type: 'fall' }>['moved'][number];
type SpawnEvent = Extract<GameEvent, { type: 'spawn' }>;

export interface ScheduledFallMove { move: FallMove; delayMs: number }
export interface ScheduledSpawnEvent { event: SpawnEvent; delayMs: number }

function scheduleByColumn<T>(items: T[], getRow: (item: T) => number, getCol: (item: T) => number): Array<{ item: T; delayMs: number }> {
  const columns = new Map<number, T[]>();
  for (const item of items) {
    const col = getCol(item);
    const column = columns.get(col) ?? [];
    column.push(item);
    columns.set(col, column);
  }

  const scheduled: Array<{ item: T; delayMs: number; col: number }> = [];
  for (const [col, column] of columns) {
    column.sort((left, right) => getRow(right) - getRow(left));
    column.forEach((item, index) => scheduled.push({ item, delayMs: index * 50, col }));
  }
  return scheduled.sort((left, right) => left.delayMs - right.delayMs || left.col - right.col);
}

export function scheduleFallMoves(moves: FallMove[]): ScheduledFallMove[] {
  return scheduleByColumn(moves, (move) => move.to[0], (move) => move.to[1]).map(({ item, delayMs }) => ({ move: item, delayMs }));
}

export function scheduleSpawnEvents(events: GameEvent[]): ScheduledSpawnEvent[] {
  const spawns = events.filter((event): event is SpawnEvent => event.type === 'spawn');
  return scheduleByColumn(spawns, (event) => event.row, (event) => event.col).map(({ item, delayMs }) => ({ event: item, delayMs }));
}

export function progressAtPhase(finalScore: number, finalEnergy: number, events: GameEvent[], phaseIndex: number, mergeResultVisible: boolean): { score: number; energy: number } {
  if (events.length === 0) return { score: finalScore, energy: finalEnergy };
  const click = events.find((event): event is Extract<GameEvent, { type: 'click' }> => event.type === 'click');
  let score = click?.scoreAfter ?? finalScore - events.reduce((total, event) => total + (event.type === 'merge' ? event.inputSum : 0), 0);
  let energy = click?.energyAfter ?? finalEnergy;

  events.forEach((event, index) => {
    if (event.type !== 'merge' || index > phaseIndex || (index === phaseIndex && !mergeResultVisible)) return;
    score = event.scoreAfter ?? score + event.inputSum;
    energy = event.energyAfter ?? Math.min(5, energy + 1);
  });
  return { score, energy };
}
