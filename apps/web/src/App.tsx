import { useEffect, useState } from 'react';
import type { GameEvent, GameState } from '../../../src/game-engine/types';
import { gameApi, ApiNetworkError } from './api';
import { GameBoard } from './GameBoard';
import { text, type Language } from './i18n';
import { playSound, vibrate } from './effects';
import { LegalPage } from './LegalPage';
import { applyOfflineMove, type QueuedMove } from './offline';
import { applyMove, createInitialState, undoMove, type MoveSnapshot } from '../../../src/game-engine/index';

const languageKey = 'click1-language';
const offlineQueueKey = 'click1-offline-queue';

declare global {
  interface Window { __CLICK1_LAST_MOVE__?: unknown; __CLICK1_PHASE_TRACE__?: Array<Record<string, unknown>> }
}

function logMoveTrace(mode: string, row: number, col: number, before: GameState, result: { state: GameState; events: GameEvent[] }) {
  if (!import.meta.env.DEV) return;
  const trace = {
    mode,
    click: { row, col },
    boardBefore: before.board,
    finalBoard: result.state.board,
    events: result.events.map((event, index) => ({
      index,
      type: event.type,
      scoreAfter: 'scoreAfter' in event ? event.scoreAfter : undefined,
      energyAfter: 'energyAfter' in event ? event.energyAfter : undefined,
      anchor: event.type === 'merge' ? event.anchor : undefined,
      cells: event.type === 'merge' ? event.cells : undefined,
      moved: event.type === 'fall' ? event.moved : undefined,
      spawn: event.type === 'spawn' ? [event.row, event.col, event.value] : undefined,
      boardBefore: event.boardBefore,
      boardAfter: event.boardAfter,
    })),
  };
  window.__CLICK1_LAST_MOVE__ = trace;
  window.__CLICK1_PHASE_TRACE__ = [];
  console.info('[click1:move]', trace);
  console.info('[click1:move] copy command: copy(JSON.stringify(window.__CLICK1_LAST_MOVE__))');
}

function GameApp() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(languageKey) as Language | null) ?? 'en');
  const [token, setToken] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [guestUndoSnapshot, setGuestUndoSnapshot] = useState<MoveSnapshot | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [freeUndoAvailable, setFreeUndoAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('click1-sound') !== 'off');
  const [vibrationEnabled, setVibrationEnabled] = useState(() => localStorage.getItem('click1-vibration') !== 'off');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<QueuedMove[]>(() => {
    try { return JSON.parse(localStorage.getItem(offlineQueueKey) ?? '[]') as QueuedMove[]; } catch { return []; }
  });
  const copy = text(language);

  useEffect(() => { document.documentElement.lang = language; localStorage.setItem(languageKey, language); }, [language]);
  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler); window.addEventListener('offline', offlineHandler);
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); };
  }, []);
  useEffect(() => { localStorage.setItem(offlineQueueKey, JSON.stringify(offlineQueue)); }, [offlineQueue]);
  useEffect(() => {
    if (!online || !token || offlineQueue.length === 0) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      let latest = state;
      try {
        for (const [index, move] of offlineQueue.entries()) {
          const result = await gameApi.move(token, move.row, move.col, move.id);
          if (cancelled) return;
          latest = result.state;
          setEvents(result.events);
          setState(result.state);
          if (index === offlineQueue.length - 1) setStatus('Offline moves synchronized.');
        }
        if (!cancelled) setOfflineQueue([]);
      } catch (error) {
        if (!cancelled) { setOnline(false); setStatus(error instanceof Error ? error.message : copy.error); }
      } finally {
        if (!cancelled) setBusy(false);
      }
      return latest;
    })();
    return () => { cancelled = true; };
  }, [online, token, offlineQueue, copy.error]);
  useEffect(() => {
    if (guestMode) return;
    let cancelled = false;
    if (!token) {
      gameApi.session().then(() => { if (!cancelled) setToken('cookie'); }).catch(() => undefined);
      return () => { cancelled = true; };
    }
    setBusy(true);
    Promise.all([gameApi.start(token), gameApi.undoStatus(token)]).then(([game, undo]) => { if (!cancelled) { setState(game.state); setFreeUndoAvailable(undo.available); } }).catch(() => { if (!cancelled) setStatus(copy.error); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [guestMode, token, copy.error]);

  const move = async (row: number, col: number) => {
    if (!state) return;
    if (guestMode) {
      try {
        const result = applyMove(state, row, col, crypto.randomUUID());
        logMoveTrace('guest', row, col, state, result);
        setState(result.state);
        setGuestUndoSnapshot(result.snapshot);
        setEvents(result.events);
        playSound(result.events.some((event) => event.type === 'merge') ? 'merge' : 'click', soundEnabled);
        vibrate(vibrationEnabled);
      } catch (error) { setStatus(error instanceof Error ? error.message : copy.error); }
      return;
    }
    if (!token) return;
    if (!online) {
      try { const id = crypto.randomUUID(); const result = applyOfflineMove(state, { row, col }, id); logMoveTrace('offline', row, col, state, result); setState(result.state); setEvents(result.events); setOfflineQueue((queue) => [...queue, { id, row, col }]); playSound('click', soundEnabled); vibrate(vibrationEnabled); setStatus('Offline move saved. Undo requires a connection.'); } catch (error) { setStatus(error instanceof Error ? error.message : copy.error); }
      return;
    }
    setBusy(true);
    try { const result = await gameApi.move(token, row, col); logMoveTrace('online', row, col, state, result); setState(result.state); setEvents(result.events); playSound(result.events.some((event) => event.type === 'merge') ? 'merge' : 'click', soundEnabled); vibrate(vibrationEnabled); setStatus(''); }
    catch (error) { if (error instanceof ApiNetworkError) setOnline(false); setStatus(error instanceof Error ? error.message : copy.error); }
    finally { setBusy(false); }
  };

  const undo = async () => {
    if (!state) return;
    if (guestMode) {
      if (!guestUndoSnapshot) return;
      setState(undoMove(state, guestUndoSnapshot));
      setGuestUndoSnapshot(null);
      setEvents([]);
      playSound('undo', soundEnabled);
      vibrate(vibrationEnabled);
      return;
    }
    if (!token) return;
    if (!online) { setStatus('Undo requires an internet connection.'); return; }
    setBusy(true);
    try { const undoStatus = await gameApi.undoStatus(token); setFreeUndoAvailable(undoStatus.available); if (undoStatus.available) { setState(await gameApi.freeUndo(token)); setFreeUndoAvailable(false); } else { const order = await gameApi.paidUndoQuote(token); const { payForUndo } = await import('./wallet'); const signature = await payForUndo(order); setState(await gameApi.paidUndoConfirm(token, order.id, signature)); } setEvents([]); playSound('undo', soundEnabled); vibrate(vibrationEnabled); setStatus(''); }
    catch (error) { if (error instanceof ApiNetworkError) setOnline(false); setStatus(error instanceof Error ? error.message : copy.error); }
    finally { setBusy(false); }
  };

  const newGame = async () => {
    if (guestMode) {
      const nextState = createInitialState(Date.now() >>> 0);
      nextState.highScore = state?.highScore ?? state?.score ?? 0;
      setState(nextState);
      setGuestUndoSnapshot(null);
      setEvents([]);
      setStatus(copy.guestNotice);
      return;
    }
    if (!token || !window.confirm(copy.confirmNewGame)) return;
    setBusy(true);
    try { setState((await gameApi.start(token, true)).state); setEvents([]); setOfflineQueue([]); setStatus(''); } catch { setStatus(copy.error); } finally { setBusy(false); }
  };
  const disconnect = async () => { if (!token) return; setBusy(true); try { await gameApi.logout(token); const { disconnectWallet } = await import('./wallet'); await disconnectWallet(); setToken(''); setState(null); setEvents([]); setOfflineQueue([]); } catch (error) { setStatus(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); } };
  const deleteAccount = async () => { if (!token || !window.confirm(copy.confirmDelete)) return; setBusy(true); try { await gameApi.deleteAccount(token); const { disconnectWallet } = await import('./wallet'); await disconnectWallet(); setToken(''); setState(null); setEvents([]); setOfflineQueue([]); } catch (error) { setStatus(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); } };
  const connect = async () => { setBusy(true); setStatus(''); try { const { connectAndSignIn } = await import('./wallet'); await connectAndSignIn(); setToken('cookie'); const [game, undoStatus] = await Promise.all([gameApi.start('cookie'), gameApi.undoStatus('cookie')]); setState(game.state); setFreeUndoAvailable(undoStatus.available); } catch (error) { setStatus(error instanceof Error ? error.message : copy.error); } finally { setBusy(false); } };
  const startGuest = () => { setGuestMode(true); setState(createInitialState(Date.now() >>> 0)); setGuestUndoSnapshot(null); setEvents([]); setStatus(copy.guestNotice); };
  const exitGuest = () => { setGuestMode(false); setState(null); setGuestUndoSnapshot(null); setEvents([]); setStatus(''); };
  const toggleSound = () => { setSoundEnabled((enabled) => { const next = !enabled; localStorage.setItem('click1-sound', next ? 'on' : 'off'); return next; }); };
  const toggleVibration = () => { setVibrationEnabled((enabled) => { const next = !enabled; localStorage.setItem('click1-vibration', next ? 'on' : 'off'); return next; }); };

  return <main id="main-content" className="shell"><header className="topbar"><div><span className="eyebrow">SOLANA SEEKER</span><h1>Click+1</h1></div><label className="language-control">{copy.language}<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="zh-CN">简体中文</option><option value="ja">日本語</option></select></label></header>{!token && !guestMode ? <section className="wallet-gate"><p>{copy.tagline}</p><p className="supporting">{copy.walletRequired}</p><div className="entry-actions"><button type="button" className="action-primary" disabled={busy} onClick={connect}>{copy.connect}</button><button type="button" className="action-secondary" disabled={busy} onClick={startGuest}>{copy.guest}</button></div><details className="how-to" open><summary>{copy.howToPlay}</summary><ol><li>{copy.howTo1}</li><li>{copy.howTo2}</li><li>{copy.howTo3}</li><li>{copy.howTo4}</li></ol></details></section> : busy && !state ? <p role="status">{copy.loading}</p> : state ? <><div className={`network-banner ${online ? 'online' : 'offline'}`} role="status">{guestMode ? copy.guest : online ? 'Online' : 'Offline'}{!guestMode && offlineQueue.length > 0 ? ` · ${offlineQueue.length} move${offlineQueue.length === 1 ? '' : 's'} pending` : ''}</div><GameBoard state={state} language={language} busy={busy || !online && false} guestMode={guestMode} freeUndoAvailable={freeUndoAvailable} events={events} onMove={move} onUndo={undo} onNewGame={newGame} /><div className="preferences"><label><input type="checkbox" checked={soundEnabled} onChange={toggleSound} /> {copy.sound}</label><label><input type="checkbox" checked={vibrationEnabled} onChange={toggleVibration} /> {copy.vibration}</label>{guestMode ? <button type="button" className="action-secondary disconnect" disabled={busy} onClick={exitGuest}>{copy.exitGuest}</button> : <><button type="button" className="action-secondary disconnect" disabled={busy} onClick={disconnect}>{copy.disconnect}</button><button type="button" className="action-danger" disabled={busy} onClick={deleteAccount}>{copy.deleteAccount}</button></>}</div></> : null}<nav className="footer-links" aria-label="Legal links"><a href="/privacy">{copy.privacy}</a><a href="/terms">{copy.terms}</a><a href="/support">{copy.support}</a></nav><p className="status" role="status" aria-live="polite">{status}</p></main>;
}

export function App() {
  const route = window.location.pathname;
  if (route === '/privacy') return <LegalPage kind="privacy" />;
  if (route === '/terms') return <LegalPage kind="terms" />;
  if (route === '/support') return <LegalPage kind="support" />;
  return <GameApp />;
}
