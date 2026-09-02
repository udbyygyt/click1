import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { BoardSnapshot, GameEvent, GameState } from '../../../src/game-engine/types';
import type { Language } from './i18n';
import { text } from './i18n';

interface GameBoardProps { state: GameState; language: Language; busy: boolean; guestMode: boolean; freeUndoAvailable: boolean; events: GameEvent[]; onMove: (row: number, col: number) => void; onUndo: () => void; onNewGame: () => void }
type AnimatedEvent = Exclude<GameEvent, { type: 'click' }>;
function keyOf(row: number, col: number): string { return `${row},${col}`; }
function copyBoard(board: BoardSnapshot): BoardSnapshot { return board.map((row) => row.slice()); }
function mergeRoute(row: number, col: number, anchor: [number, number]): 'horizontal' | 'vertical' | 'vertical-first' { if (row === anchor[0]) return 'horizontal'; if (col === anchor[1]) return 'vertical'; return 'vertical-first'; }

export function GameBoard({ state, language, busy, guestMode, freeUndoAvailable, events, onMove, onUndo, onNewGame }: GameBoardProps) {
  const copy = text(language);
  const firstAnimatedIndex = events[0]?.type === 'click' ? 1 : 0;
  const [phaseIndex, setPhaseIndex] = useState(firstAnimatedIndex);
  const [mergeResultVisible, setMergeResultVisible] = useState(false);
  const phaseAdvanceRef = useRef(-1);
  const phaseLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { phaseAdvanceRef.current = -1; setPhaseIndex(events[0]?.type === 'click' ? 1 : 0); setMergeResultVisible(false); }, [events]);

  const activeEvent = events[phaseIndex] as AnimatedEvent | undefined;
  const animating = activeEvent !== undefined;
  const boardBefore = activeEvent?.boardBefore ?? state.board;
  const hiddenCells = useMemo(() => {
    const hidden = new Set<string>();
    if (activeEvent?.type === 'merge') for (const [row, col] of activeEvent.cells) hidden.add(keyOf(row, col));
    if (activeEvent?.type === 'fall') for (const move of activeEvent.moved) hidden.add(keyOf(move.from[0], move.from[1]));
    return hidden;
  }, [activeEvent]);
  const renderBoard = copyBoard(boardBefore);
  for (const cell of hiddenCells) { const parts = cell.split(','); const row = Number(parts[0]); const col = Number(parts[1]); renderBoard[row]![col] = 0; }
  const advancePhase = () => { if (phaseAdvanceRef.current === phaseIndex) return; phaseAdvanceRef.current = phaseIndex; setPhaseIndex((current) => current + 1); setMergeResultVisible(false); };
  useEffect(() => {
    if (!activeEvent) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const layer = phaseLayerRef.current;
      const selector = activeEvent.type === 'merge' ? mergeResultVisible ? '.merge-result' : '.merge-piece' : activeEvent.type === 'fall' ? '.fall-piece' : '.spawn-piece';
      const animations = layer ? Array.from(layer.querySelectorAll<HTMLElement>(selector)).flatMap((element) => element.getAnimations()) : [];
      Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (cancelled) return;
        if (activeEvent.type === 'merge' && !mergeResultVisible) setMergeResultVisible(true);
        else advancePhase();
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [activeEvent, mergeResultVisible, phaseIndex]);
  const mergeAnchor = activeEvent?.type === 'merge' ? activeEvent.anchor : null;

  return <section className="game" data-phase-index={phaseIndex} data-active-event={activeEvent?.type ?? 'none'} aria-busy={busy || animating}>
    <div className="stats" aria-label="Game status"><div><span>{copy.score}</span><strong>{state.score}</strong></div><div><span>{copy.energy}</span><strong>{state.energy}/5</strong></div><div><span>{copy.highest}</span><strong>{state.highScore ?? state.score}</strong></div></div>
    <div className="board" role="grid" aria-label="Click+1 board">
      {renderBoard.map((row, rowIndex) => row.map((value, colIndex) => <button className={`tile tile-${Math.min(value, 10)}`} type="button" role="gridcell" key={`${phaseIndex}-${rowIndex}-${colIndex}`} disabled={busy || animating || value === 0 || state.energy === 0 || state.status !== 'playing'} aria-label={value === 0 ? copy.empty : copy.move.replace('{value}', String(value))} onClick={() => onMove(rowIndex, colIndex)}>{value || ''}</button>))}
      {activeEvent?.type === 'merge' && <div ref={phaseLayerRef} className="phase-layer merge-phase" aria-hidden="true">{activeEvent.cells.map(([row, col]) => { const value = activeEvent.boardBefore[row]?.[col] ?? activeEvent.value - 1; const route = mergeRoute(row, col, activeEvent.anchor); return <span className={`tile tile-${Math.min(value, 10)} phase-piece merge-piece merge-piece-${route}`} style={{ gridRow: row + 1, gridColumn: col + 1, '--merge-dx': activeEvent.anchor[1] - col, '--merge-dy': activeEvent.anchor[0] - row } as CSSProperties} key={`merge-${phaseIndex}-${row}-${col}`}>{value}</span>; })}{mergeResultVisible && mergeAnchor && <span className={`tile tile-${Math.min(activeEvent.value, 10)} phase-piece merge-result`} style={{ gridRow: mergeAnchor[0] + 1, gridColumn: mergeAnchor[1] + 1 }}>{activeEvent.value}</span>}</div>}
      {activeEvent?.type === 'fall' && <div ref={phaseLayerRef} className="phase-layer fall-phase" aria-hidden="true">{activeEvent.moved.map((move) => <span className={`tile tile-${Math.min(move.value, 10)} phase-piece fall-piece`} style={{ gridRow: move.to[0] + 1, gridColumn: move.to[1] + 1, '--fall-from-y': `${(move.from[0] - move.to[0]) * 100}%` } as CSSProperties} key={`fall-${phaseIndex}-${move.from}-${move.to}`}>{move.value}</span>)}</div>}
      {activeEvent?.type === 'spawn' && <div ref={phaseLayerRef} className="phase-layer spawn-phase" aria-hidden="true"><span className={`tile tile-${Math.min(activeEvent.value, 10)} phase-piece spawn-piece`} style={{ gridRow: activeEvent.row + 1, gridColumn: activeEvent.col + 1, '--spawn-from-y': `${-(activeEvent.row + 1) * 110}%` } as CSSProperties}>{activeEvent.value}</span></div>}
    </div>
    <p className="undo-note">{state.status === 'won' ? copy.won : state.status === 'game_over' ? copy.gameOver : !state.canUndo ? copy.noUndo : guestMode ? copy.guestUndo : freeUndoAvailable ? copy.freeUndo : copy.paidUndo}</p>
    <div className="actions"><button className="action-primary" type="button" disabled={busy || animating || !state.canUndo} onClick={onUndo}>{copy.undo}</button><button className="action-secondary" type="button" disabled={busy || animating} onClick={onNewGame}>{copy.newGame}</button></div>
  </section>;
}
