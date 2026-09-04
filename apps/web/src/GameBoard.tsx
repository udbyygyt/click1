import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { BoardSnapshot, GameEvent, GameState } from '../../../src/game-engine/types';
import type { Language } from './i18n';
import { text } from './i18n';
import { progressAtPhase, scheduleFallMoves, scheduleSpawnEvents } from './animation-sequence';
import { buildMergeLayers } from './merge-animation';

interface GameBoardProps { state: GameState; language: Language; busy: boolean; guestMode: boolean; freeUndoAvailable: boolean; events: GameEvent[]; onMove: (row: number, col: number) => void; onUndo: () => void; onNewGame: () => void }
function keyOf(row: number, col: number): string { return `${row},${col}`; }
function copyBoard(board: BoardSnapshot): BoardSnapshot { return board.map((row) => row.slice()); }

export function GameBoard({ state, language, busy, guestMode, freeUndoAvailable, events, onMove, onUndo, onNewGame }: GameBoardProps) {
  const copy = text(language);
  const firstAnimatedIndex = events[0]?.type === 'click' ? 1 : 0;
  const [phaseIndex, setPhaseIndex] = useState(firstAnimatedIndex);
  const [mergeLayerIndex, setMergeLayerIndex] = useState(0);
  const [mergeResultVisible, setMergeResultVisible] = useState(false);
  const phaseAdvanceRef = useRef(-1);
  const phaseLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { phaseAdvanceRef.current = -1; setPhaseIndex(events[0]?.type === 'click' ? 1 : 0); setMergeLayerIndex(0); setMergeResultVisible(false); }, [events]);

  const activeEvent = events[phaseIndex];
  const animating = activeEvent !== undefined && activeEvent.type !== 'click';
  const boardBefore = activeEvent?.boardBefore ?? state.board;
  const mergeLayers = useMemo(() => activeEvent?.type === 'merge' ? buildMergeLayers(activeEvent.cells, activeEvent.anchor) : [], [activeEvent]);
  const activeMergeLayer = mergeLayers[mergeLayerIndex] ?? [];
  const scheduledFalls = useMemo(() => activeEvent?.type === 'fall' ? scheduleFallMoves(activeEvent.moved) : [], [activeEvent]);
  const spawnBatch = useMemo(() => {
    if (activeEvent?.type !== 'spawn') return [];
    const batch: GameEvent[] = [];
    for (let index = phaseIndex; events[index]?.type === 'spawn'; index += 1) batch.push(events[index]!);
    return scheduleSpawnEvents(batch);
  }, [activeEvent, events, phaseIndex]);
  const progress = progressAtPhase(state.score, state.energy, events, phaseIndex, mergeResultVisible);
  const hiddenCells = useMemo(() => {
    const hidden = new Set<string>();
    if (activeEvent?.type === 'merge') {
      const completedLayers = mergeLayers.slice(0, mergeLayerIndex);
      for (const layer of completedLayers) for (const step of layer) hidden.add(keyOf(step.from[0], step.from[1]));
      for (const step of activeMergeLayer) hidden.add(keyOf(step.from[0], step.from[1]));
      if (mergeResultVisible) for (const [row, col] of activeEvent.cells) hidden.add(keyOf(row, col));
    }
    if (activeEvent?.type === 'fall') for (const move of activeEvent.moved) hidden.add(keyOf(move.from[0], move.from[1]));
    return hidden;
  }, [activeEvent, activeMergeLayer, mergeLayerIndex, mergeLayers, mergeResultVisible]);
  const renderBoard = copyBoard(boardBefore);
  for (const cell of hiddenCells) { const parts = cell.split(','); const row = Number(parts[0]); const col = Number(parts[1]); renderBoard[row]![col] = 0; }
  const advancePhase = (step = 1) => { if (phaseAdvanceRef.current === phaseIndex) return; phaseAdvanceRef.current = phaseIndex; setPhaseIndex((current) => current + step); setMergeLayerIndex(0); setMergeResultVisible(false); };
  useEffect(() => {
    if (!activeEvent || activeEvent.type === 'click') return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const layer = phaseLayerRef.current;
      const selector = activeEvent.type === 'merge' ? mergeResultVisible ? '.merge-result' : '.merge-step-piece' : activeEvent.type === 'fall' ? '.fall-piece' : '.spawn-piece';
      const animations = layer ? Array.from(layer.querySelectorAll<HTMLElement>(selector)).flatMap((element) => element.getAnimations()) : [];
      Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (cancelled) return;
        if (activeEvent.type === 'spawn') advancePhase(spawnBatch.length);
        else if (activeEvent.type !== 'merge') advancePhase();
        else if (mergeResultVisible) advancePhase();
        else if (mergeLayerIndex + 1 < mergeLayers.length) setMergeLayerIndex((current) => current + 1);
        else setMergeResultVisible(true);
      });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [activeEvent, mergeLayerIndex, mergeLayers, mergeResultVisible, phaseIndex, spawnBatch.length]);
  const mergeAnchor = activeEvent?.type === 'merge' ? activeEvent.anchor : null;

  return <section className="game" aria-busy={busy || animating}>
    <div className="stats" aria-label="Game status"><div><span>{copy.score}</span><strong>{progress.score}</strong></div><div><span>{copy.energy}</span><strong>{progress.energy}/5</strong></div><div><span>{copy.highest}</span><strong>{state.highScore ?? state.score}</strong></div></div>
    <div className="board" role="grid" aria-label="Click+1 board">
      {renderBoard.map((row, rowIndex) => row.map((value, colIndex) => <button className={`tile tile-${Math.min(value, 10)}`} type="button" role="gridcell" key={`${rowIndex}-${colIndex}`} disabled={busy || animating || value === 0 || state.energy === 0 || state.status !== 'playing'} aria-label={value === 0 ? copy.empty : copy.move.replace('{value}', String(value))} onClick={() => onMove(rowIndex, colIndex)}>{value || ''}</button>))}
      {activeEvent?.type === 'merge' && <div ref={phaseLayerRef} className="phase-layer merge-phase" aria-hidden="true">{!mergeResultVisible && activeMergeLayer.map((step) => { const value = activeEvent.boardBefore[step.from[0]]?.[step.from[1]] ?? activeEvent.value - 1; return <span className={`tile tile-${Math.min(value, 10)} phase-piece merge-step-piece`} style={{ gridRow: step.from[0] + 1, gridColumn: step.from[1] + 1, '--merge-dx': step.to[1] - step.from[1], '--merge-dy': step.to[0] - step.from[0] } as CSSProperties} key={`merge-${phaseIndex}-${mergeLayerIndex}-${step.from}`}>{value}</span>; })}{mergeResultVisible && mergeAnchor && <span className={`tile tile-${Math.min(activeEvent.value, 10)} phase-piece merge-result`} style={{ gridRow: mergeAnchor[0] + 1, gridColumn: mergeAnchor[1] + 1 }}>{activeEvent.value}</span>}</div>}
      {activeEvent?.type === 'fall' && <div ref={phaseLayerRef} className="phase-layer fall-phase" aria-hidden="true">{scheduledFalls.map(({ move, delayMs }) => <span className={`tile tile-${Math.min(move.value, 10)} phase-piece fall-piece`} style={{ gridRow: move.to[0] + 1, gridColumn: move.to[1] + 1, '--fall-rows': move.from[0] - move.to[0], '--fall-delay': `${delayMs}ms` } as CSSProperties} key={`fall-${phaseIndex}-${move.from}-${move.to}`}>{move.value}</span>)}</div>}
      {activeEvent?.type === 'spawn' && <div ref={phaseLayerRef} className="phase-layer spawn-phase" aria-hidden="true">{spawnBatch.map(({ event, delayMs }) => <span className={`tile tile-${Math.min(event.value, 10)} phase-piece spawn-piece`} style={{ gridRow: event.row + 1, gridColumn: event.col + 1, '--spawn-rows': -(event.row + 1), '--spawn-delay': `${delayMs}ms` } as CSSProperties} key={`spawn-${phaseIndex}-${event.row}-${event.col}`}>{event.value}</span>)}</div>}
    </div>
    <p className="undo-note">{state.status === 'won' ? copy.won : state.status === 'game_over' ? copy.gameOver : !state.canUndo ? copy.noUndo : guestMode ? copy.guestUndo : freeUndoAvailable ? copy.freeUndo : copy.paidUndo}</p>
    <div className="actions"><button className="action-primary" type="button" disabled={busy || animating || !state.canUndo} onClick={onUndo}>{copy.undo}</button><button className="action-secondary" type="button" disabled={busy || animating} onClick={onNewGame}>{copy.newGame}</button></div>
  </section>;
}
