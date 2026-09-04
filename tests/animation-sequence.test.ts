import { describe, expect, it } from 'vitest';
import { progressAtPhase, scheduleFallMoves, scheduleSpawnEvents } from '../apps/web/src/animation-sequence';
import type { GameEvent } from '../src/game-engine/types';

describe('scheduleFallMoves', () => {
  it('staggers each column by 50ms while starting all columns together', () => {
    const moves = [
      { from: [2, 0], downTo: [4, 0], to: [4, 0], value: 2 },
      { from: [1, 0], downTo: [3, 0], to: [3, 0], value: 3 },
      { from: [0, 0], downTo: [2, 0], to: [2, 0], value: 4 },
      { from: [2, 2], downTo: [4, 2], to: [4, 2], value: 5 },
      { from: [0, 2], downTo: [3, 2], to: [3, 2], value: 6 },
    ] as Array<{ from: [number, number]; downTo: [number, number]; to: [number, number]; value: number }>;

    expect(scheduleFallMoves(moves).map(({ move, delayMs }) => ({ value: move.value, delayMs }))).toEqual([
      { value: 2, delayMs: 0 },
      { value: 5, delayMs: 0 },
      { value: 3, delayMs: 50 },
      { value: 6, delayMs: 50 },
      { value: 4, delayMs: 100 },
    ]);
  });
});

describe('scheduleSpawnEvents', () => {
  it('fills columns in parallel with a 50ms stagger inside each column', () => {
    const events = [
      { type: 'spawn', row: 4, col: 0, value: 1 },
      { type: 'spawn', row: 4, col: 2, value: 2 },
      { type: 'spawn', row: 3, col: 0, value: 3 },
      { type: 'spawn', row: 3, col: 2, value: 4 },
      { type: 'spawn', row: 2, col: 0, value: 5 },
    ] as GameEvent[];

    expect(scheduleSpawnEvents(events).map(({ event, delayMs }) => ({ value: event.value, delayMs }))).toEqual([
      { value: 1, delayMs: 0 },
      { value: 2, delayMs: 0 },
      { value: 3, delayMs: 50 },
      { value: 4, delayMs: 50 },
      { value: 5, delayMs: 100 },
    ]);
  });
});

describe('progressAtPhase', () => {
  const events = [
    { type: 'click', scoreAfter: 1000, energyAfter: 2 },
    { type: 'merge', inputSum: 90, scoreAfter: 1090, energyAfter: 3 },
    { type: 'fall' },
    { type: 'merge', inputSum: 240, scoreAfter: 1330, energyAfter: 4 },
  ] as GameEvent[];

  it('adds score and energy only when each merge result appears', () => {
    expect(progressAtPhase(1330, 4, events, 1, false)).toEqual({ score: 1000, energy: 2 });
    expect(progressAtPhase(1330, 4, events, 1, true)).toEqual({ score: 1090, energy: 3 });
    expect(progressAtPhase(1330, 4, events, 2, false)).toEqual({ score: 1090, energy: 3 });
    expect(progressAtPhase(1330, 4, events, 3, false)).toEqual({ score: 1090, energy: 3 });
    expect(progressAtPhase(1330, 4, events, 3, true)).toEqual({ score: 1330, energy: 4 });
    expect(progressAtPhase(1330, 4, events, 4, false)).toEqual({ score: 1330, energy: 4 });
  });

  it('returns the current values when there are no animation events', () => {
    expect(progressAtPhase(420, 3, [], 0, false)).toEqual({ score: 420, energy: 3 });
  });
});
