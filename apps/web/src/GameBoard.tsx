import type { CSSProperties } from 'react';
import type { GameEvent, GameState } from '../../../src/game-engine/types';
import type { Language } from './i18n';
import { text } from './i18n';

interface GameBoardProps { state: GameState; language: Language; busy: boolean; guestMode: boolean; freeUndoAvailable: boolean; events: GameEvent[]; onMove: (row: number, col: number) => void; onUndo: () => void; onNewGame: () => void }

export function GameBoard({ state, language, busy, guestMode, freeUndoAvailable, events, onMove, onUndo, onNewGame }: GameBoardProps) {
  const copy = text(language);
  const eventTimings = new Map<number, number>();
  let timeline = 0;
  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex]!;
    if (event.type === 'merge') {
      eventTimings.set(eventIndex, timeline);
      timeline += 560;
    } else if (event.type === 'fall') {
      eventTimings.set(eventIndex, timeline);
      timeline += 420;
    } else if (event.type === 'spawn') {
      const batchStart = timeline;
      let batchEnd = eventIndex;
      while (batchEnd + 1 < events.length && events[batchEnd + 1]?.type === 'spawn') batchEnd += 1;
      for (let spawnIndex = eventIndex; spawnIndex <= batchEnd; spawnIndex += 1) {
        eventTimings.set(spawnIndex, batchStart + (spawnIndex - eventIndex) * 36);
      }
      timeline = batchStart + 320 + (batchEnd - eventIndex) * 36;
      eventIndex = batchEnd;
    } else {
      eventTimings.set(eventIndex, timeline);
    }
  }
  const mergeEffects = events.flatMap((event, eventIndex) => {
    if (event.type !== 'merge') return [];
    return event.cells.filter(([row, col]) => row !== event.anchor[0] || col !== event.anchor[1]).map(([row, col]) => ({ event, eventIndex, row, col }));
  });
  const falls = events.flatMap((event, eventIndex) => event.type === 'fall' ? event.moved.map((move) => ({ move, eventIndex })) : []);
  return <section className="game" aria-busy={busy}>
    <div className="stats" aria-label="Game status">
      <div><span>{copy.score}</span><strong>{state.score}</strong></div><div><span>{copy.energy}</span><strong>{state.energy}/5</strong></div><div><span>{copy.highest}</span><strong>{state.highScore ?? state.score}</strong></div>
    </div>
    <div className="board" role="grid" aria-label="Click+1 board">
      {state.board.map((row, rowIndex) => row.map((value, colIndex) => {
        const clicked = events.some((event) => event.type === 'click' && event.row === rowIndex && event.col === colIndex);
        const spawned = events.some((event) => event.type === 'spawn' && event.row === rowIndex && event.col === colIndex);
        const merged = events.some((event) => event.type === 'merge' && event.anchor[0] === rowIndex && event.anchor[1] === colIndex);
        const fall = [...falls].reverse().find(({ move }) => move.to[0] === rowIndex && move.to[1] === colIndex);
        let mergeAnchorIndex = -1;
        let spawnIndex = -1;
        for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
          const event = events[eventIndex]!;
          if (mergeAnchorIndex < 0 && event.type === 'merge' && event.anchor[0] === rowIndex && event.anchor[1] === colIndex) mergeAnchorIndex = eventIndex;
          if (spawnIndex < 0 && event.type === 'spawn' && event.row === rowIndex && event.col === colIndex) spawnIndex = eventIndex;
          if (mergeAnchorIndex >= 0 && spawnIndex >= 0) break;
        }
        let animationStyle: CSSProperties | undefined;
        if (fall) {
          animationStyle = {
            '--settle-from-y': `${(fall.move.from[0] - fall.move.to[0]) * 100}%`,
            '--settle-delay': `${eventTimings.get(fall.eventIndex) ?? 0}ms`,
          } as CSSProperties;
        } else if (spawned) {
          animationStyle = {
            '--spawn-from-y': `${-(rowIndex + 1) * 110}%`,
            '--spawn-delay': `${eventTimings.get(spawnIndex) ?? 0}ms`,
          } as CSSProperties;
        }
        if (merged && mergeAnchorIndex >= 0) {
          animationStyle = { ...(animationStyle ?? {}), '--merge-delay': `${eventTimings.get(mergeAnchorIndex) ?? 0}ms` } as CSSProperties;
        }
        const className = `tile tile-${Math.min(value, 10)}${clicked ? ' tile-clicked' : ''}${spawned ? ' tile-spawned' : ''}${merged ? ' tile-merged' : ''}${fall ? ' tile-settling' : ''}`;
        return <button className={className} style={animationStyle} type="button" role="gridcell" key={`${rowIndex}-${colIndex}-${events.length}-${fall ? `${fall.move.from}-${fall.move.to}` : spawned ? 'spawn' : 'still'}`} disabled={busy || value === 0 || state.energy === 0 || state.status !== 'playing'} aria-label={value === 0 ? copy.empty : copy.move.replace('{value}', String(value))} onClick={() => onMove(rowIndex, colIndex)}>{value || ''}</button>;
      }))}
      {mergeEffects.length > 0 && <div className="merge-fx-layer" aria-hidden="true">{mergeEffects.map(({ event, eventIndex, row, col }) => {
        const route = row === event.anchor[0] ? 'horizontal' : col === event.anchor[1] ? 'vertical' : 'vertical-first';
        return <span className={`tile tile-${Math.min(event.value - 1, 10)} merge-fx merge-fx-${route}`} style={{ gridRow: row + 1, gridColumn: col + 1, '--merge-dx': `${(event.anchor[1] - col) * 100}%`, '--merge-dy': `${(event.anchor[0] - row) * 100}%`, '--merge-delay': `${eventTimings.get(eventIndex) ?? 0}ms` } as CSSProperties} key={`merge-${eventIndex}-${row}-${col}`}>{event.value - 1}</span>;
      })}</div>}
    </div>
    <p className="undo-note">{state.status === 'won' ? copy.won : state.status === 'game_over' ? copy.gameOver : !state.canUndo ? copy.noUndo : guestMode ? copy.guestUndo : freeUndoAvailable ? copy.freeUndo : copy.paidUndo}</p>
    <div className="actions"><button className="action-primary" type="button" disabled={busy || !state.canUndo} onClick={onUndo}>{copy.undo}</button><button className="action-secondary" type="button" disabled={busy} onClick={onNewGame}>{copy.newGame}</button></div>
  </section>;
}
