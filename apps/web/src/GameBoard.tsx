import type { CSSProperties } from 'react';
import type { GameEvent, GameState } from '../../../src/game-engine/types';
import type { Language } from './i18n';
import { text } from './i18n';

interface GameBoardProps { state: GameState; language: Language; busy: boolean; guestMode: boolean; freeUndoAvailable: boolean; events: GameEvent[]; onMove: (row: number, col: number) => void; onUndo: () => void; onNewGame: () => void }

export function GameBoard({ state, language, busy, guestMode, freeUndoAvailable, events, onMove, onUndo, onNewGame }: GameBoardProps) {
  const copy = text(language);
  let mergeRound = 0;
  const mergeEffects = events.flatMap((event) => {
    if (event.type !== 'merge') return [];
    const round = mergeRound++;
    return event.cells.filter(([row, col]) => row !== event.anchor[0] || col !== event.anchor[1]).map(([row, col]) => ({ event, round, row, col }));
  });
  const falls = events.flatMap((event, eventIndex) => event.type === 'fall' ? event.moved.map((move) => ({ move, eventIndex })) : []);
  const mergeCount = events.filter((event) => event.type === 'merge').length;
  const fallCount = events.filter((event) => event.type === 'fall').length;
  return <section className="game" aria-busy={busy}>
    <div className="stats" aria-label="Game status">
      <div><span>{copy.score}</span><strong>{state.score}</strong></div><div><span>{copy.energy}</span><strong>{state.energy}/5</strong></div><div><span>{copy.highest}</span><strong>{state.highScore ?? state.score}</strong></div>
    </div>
    <div className="board" role="grid" aria-label="Click+1 board">
      {state.board.map((row, rowIndex) => row.map((value, colIndex) => {
        const clicked = events.some((event) => event.type === 'click' && event.row === rowIndex && event.col === colIndex);
        const spawned = events.some((event) => event.type === 'spawn' && event.row === rowIndex && event.col === colIndex);
        const merged = events.some((event) => event.type === 'merge' && event.anchor[0] === rowIndex && event.anchor[1] === colIndex);
        const fall = falls.find(({ move }) => move.to[0] === rowIndex && move.to[1] === colIndex);
        const fallRound = fall ? events.slice(0, fall.eventIndex).filter((event) => event.type === 'merge').length : 0;
        const animationStyle = fall ? {
          '--settle-from-x': `${(fall.move.from[1] - fall.move.to[1]) * 100}%`,
          '--settle-from-y': `${(fall.move.from[0] - fall.move.to[0]) * 100}%`,
          '--settle-down-x': `${(fall.move.downTo[1] - fall.move.to[1]) * 100}%`,
          '--settle-down-y': `${(fall.move.downTo[0] - fall.move.to[0]) * 100}%`,
          '--settle-delay': `${fallRound * 560}ms`,
        } as CSSProperties : spawned ? {
          '--spawn-from-y': `${-(rowIndex + 1) * 110}%`,
          '--spawn-delay': `${mergeCount * 560 + fallCount * 420 + (rowIndex * state.board.length + colIndex) * 36}ms`,
        } as CSSProperties : undefined;
        const className = `tile tile-${Math.min(value, 10)}${clicked ? ' tile-clicked' : ''}${spawned ? ' tile-spawned' : ''}${merged ? ' tile-merged' : ''}${fall ? ' tile-settling' : ''}`;
        return <button className={className} style={animationStyle} type="button" role="gridcell" key={`${rowIndex}-${colIndex}-${events.length}-${fall ? `${fall.move.from}-${fall.move.to}` : spawned ? 'spawn' : 'still'}`} disabled={busy || value === 0 || state.energy === 0 || state.status !== 'playing'} aria-label={value === 0 ? copy.empty : copy.move.replace('{value}', String(value))} onClick={() => onMove(rowIndex, colIndex)}>{value || ''}</button>;
      }))}
      {mergeEffects.length > 0 && <div className="merge-fx-layer" aria-hidden="true">{mergeEffects.map(({ event, round, row, col }) => <span className={`tile tile-${Math.min(event.value - 1, 10)} merge-fx`} style={{ gridRow: row + 1, gridColumn: col + 1, '--merge-dx': `${(event.anchor[1] - col) * 100}%`, '--merge-dy': `${(event.anchor[0] - row) * 100}%`, '--merge-delay': `${round * 560}ms` } as CSSProperties} key={`merge-${round}-${row}-${col}`}>{event.value - 1}</span>)}</div>}
    </div>
    <p className="undo-note">{state.status === 'won' ? copy.won : state.status === 'game_over' ? copy.gameOver : !state.canUndo ? copy.noUndo : guestMode ? copy.guestUndo : freeUndoAvailable ? copy.freeUndo : copy.paidUndo}</p>
    <div className="actions"><button className="action-primary" type="button" disabled={busy || !state.canUndo} onClick={onUndo}>{copy.undo}</button><button className="action-secondary" type="button" disabled={busy} onClick={onNewGame}>{copy.newGame}</button></div>
  </section>;
}
