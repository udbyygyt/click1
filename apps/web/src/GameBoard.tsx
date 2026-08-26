import type { GameEvent, GameState } from '../../../src/game-engine/types';
import type { Language } from './i18n';
import { text } from './i18n';

interface GameBoardProps { state: GameState; language: Language; busy: boolean; freeUndoAvailable: boolean; events: GameEvent[]; onMove: (row: number, col: number) => void; onUndo: () => void; onNewGame: () => void }

export function GameBoard({ state, language, busy, freeUndoAvailable, events, onMove, onUndo, onNewGame }: GameBoardProps) {
  const copy = text(language);
  return <section className="game" aria-busy={busy}>
    <div className="stats" aria-label="Game status">
      <div><span>{copy.score}</span><strong>{state.score}</strong></div><div><span>{copy.energy}</span><strong>{state.energy}/5</strong></div><div><span>{copy.highest}</span><strong>{state.maxTile}</strong></div>
    </div>
    <div className="board" role="grid" aria-label="Click+1 board">
      {state.board.map((row, rowIndex) => row.map((value, colIndex) => {
        const clicked = events.some((event) => event.type === 'click' && event.row === rowIndex && event.col === colIndex);
        const spawned = events.some((event) => event.type === 'spawn' && event.row === rowIndex && event.col === colIndex);
        const merged = events.some((event) => event.type === 'merge' && event.anchor[0] === rowIndex && event.anchor[1] === colIndex);
        return <button className={`tile tile-${Math.min(value, 10)}${clicked ? ' tile-clicked' : ''}${spawned ? ' tile-spawned' : ''}${merged ? ' tile-merged' : ''}`} type="button" role="gridcell" key={`${rowIndex}-${colIndex}`} disabled={busy || value === 0 || state.energy === 0 || state.status !== 'playing'} aria-label={value === 0 ? copy.empty : copy.move.replace('{value}', String(value))} onClick={() => onMove(rowIndex, colIndex)}>{value || ''}</button>;
      }))}
    </div>
    <p className="undo-note">{state.status === 'won' ? copy.won : state.status === 'game_over' ? copy.gameOver : !state.canUndo ? copy.noUndo : freeUndoAvailable ? copy.freeUndo : copy.paidUndo}</p>
    <div className="actions"><button className="action-primary" type="button" disabled={busy || !state.canUndo} onClick={onUndo}>{copy.undo}</button><button className="action-secondary" type="button" disabled={busy} onClick={onNewGame}>{copy.newGame}</button></div>
  </section>;
}
