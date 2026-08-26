import { describe, expect, it } from 'vitest';
import { verifySolanaTransfer } from '../src/server/solana.js';

describe('verifySolanaTransfer', () => {
  it('accepts a finalized transfer with the expected memo', async () => {
    const result = await verifySolanaTransfer({
      rpcUrl: 'https://rpc.test', signature: 'sig', sender: 'sender', recipient: 'recipient', lamports: 10000000, memo: 'click1-undo:order',
      fetchImpl: async () => new Response(JSON.stringify({ result: { meta: { err: null }, transaction: { message: { instructions: [
        { program: 'system', parsed: { type: 'transfer', info: { source: 'sender', destination: 'recipient', lamports: 10000000 } } },
        { program: 'spl-memo', parsed: 'click1-undo:order' },
      ] } } } }), { status: 200 }),
    });
    expect(result).toBe(true);
  });

  it('rejects a wrong amount or missing memo', async () => {
    const result = await verifySolanaTransfer({
      rpcUrl: 'https://rpc.test', signature: 'sig', sender: 'sender', recipient: 'recipient', lamports: 10000000, memo: 'expected',
      fetchImpl: async () => new Response(JSON.stringify({ result: { meta: { err: null }, transaction: { message: { instructions: [
        { program: 'system', parsed: { type: 'transfer', info: { source: 'sender', destination: 'recipient', lamports: 1 } } },
      ] } } } }), { status: 200 }),
    });
    expect(result).toBe(false);
  });
});
