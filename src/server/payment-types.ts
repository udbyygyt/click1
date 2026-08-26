import type { GameState } from '../game-engine/types.js';

export interface PaidUndoOrder {
  id: string;
  walletAddress: string;
  gameId: string;
  moveId: string;
  amountLamports: number;
  recipient: string;
  network: 'mainnet-beta';
  memo: string;
  transactionSignature: string | null;
  status: 'created' | 'pending' | 'confirmed' | 'failed' | 'expired';
  resultState?: GameState | null;
}
