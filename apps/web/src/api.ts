import type { GameEvent, GameState } from '../../../src/game-engine/types';

export interface CurrentGame { id: string; walletAddress: string; state: GameState }

export interface Session { walletAddress: string; token: string }
export interface PaidUndoOrder { id: string; walletAddress: string; gameId: string; moveId: string; amountLamports: number; recipient: string; network: 'mainnet-beta'; memo: string; transactionSignature: string | null; status: string }

async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token && token !== 'cookie') headers.authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...options, credentials: 'include', headers: { ...headers, ...options.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

export const gameApi = {
  session: () => api<{ walletAddress: string }>('/api/auth/session', '', { method: 'GET' }),
  logout: (token: string) => api<{ loggedOut: boolean }>('/api/auth/logout', token, { method: 'POST' }),
  deleteAccount: (token: string) => api<{ deleted: boolean }>('/api/account', token, { method: 'DELETE' }),
  start: (token: string, replace = false) => api<CurrentGame>('/api/games/current', token, { method: 'POST', body: JSON.stringify({ replace }) }),
  move: (token: string, row: number, col: number) => api<{ state: GameState; events: GameEvent[] }>('/api/games/current/moves', token, { method: 'POST', body: JSON.stringify({ row, col }) }),
  undoStatus: (token: string) => api<{ utcDate: string; available: boolean }>('/api/account/daily-undo', token),
  freeUndo: (token: string) => api<GameState>('/api/games/current/undo/free', token, { method: 'POST' }),
  paidUndoQuote: (token: string) => api<PaidUndoOrder>('/api/games/current/undo/paid/quote', token, { method: 'POST' }),
  paidUndoConfirm: (token: string, orderId: string, transactionSignature: string) => api<GameState>('/api/games/current/undo/paid/confirm', token, { method: 'POST', body: JSON.stringify({ orderId, transactionSignature }) }),
};
