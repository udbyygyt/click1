import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import type { PaidUndoOrder } from './api';

const cluster = import.meta.env.PROD ? 'mainnet-beta' : (import.meta.env.VITE_SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
const adapter = new SolanaMobileWalletAdapter({
  addressSelector: createDefaultAddressSelector(),
  appIdentity: { name: 'Click+1', uri: window.location.origin, icon: `${window.location.origin}/icon.svg` },
  authorizationResultCache: createDefaultAuthorizationResultCache(),
  cluster,
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
});

function base64(signature: Uint8Array): string {
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function connectAndSignIn(): Promise<{ walletAddress: string; token: string }> {
  await adapter.connect();
  const walletAddress = adapter.publicKey?.toBase58();
  if (!walletAddress) throw new Error('wallet did not return an address');
  const nonceResponse = await fetch('/api/auth/nonce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ walletAddress }) });
  const nonce = await nonceResponse.json() as { nonce?: string; message?: string; error?: string };
  if (!nonceResponse.ok || !nonce.nonce || !nonce.message) throw new Error(nonce.error ?? 'could not create sign-in request');
  const signature = await adapter.signMessage(new TextEncoder().encode(nonce.message));
  const verifyResponse = await fetch('/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ walletAddress, nonce: nonce.nonce, signature: base64(signature) }) });
  const session = await verifyResponse.json() as { walletAddress?: string; token?: string; error?: string };
  if (!verifyResponse.ok || !session.token) throw new Error(session.error ?? 'wallet sign-in failed');
  return { walletAddress: session.walletAddress ?? walletAddress, token: session.token };
}

export async function disconnectWallet(): Promise<void> { await adapter.disconnect(); }

export async function payForUndo(order: PaidUndoOrder): Promise<string> {
  const from = adapter.publicKey;
  if (!from) throw new Error('wallet is not connected');
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL ?? (cluster === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com');
  const memoProgram = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const transaction = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(order.recipient), lamports: order.amountLamports }),
    new TransactionInstruction({ keys: [], programId: memoProgram, data: new TextEncoder().encode(order.memo) as any }),
  );
  return adapter.sendTransaction(transaction, new Connection(rpcUrl, 'confirmed'), { preflightCommitment: 'confirmed' });
}
