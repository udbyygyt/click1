import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { buildSignInMessage, isValidWalletAddress, verifyWalletSignature } from '../src/server/auth.js';

describe('wallet signature authentication', () => {
  it('validates a Solana base58 public key', () => {
    const keypair = nacl.sign.keyPair();
    expect(isValidWalletAddress(bs58.encode(keypair.publicKey))).toBe(true);
    expect(isValidWalletAddress('not-a-wallet')).toBe(false);
  });
  it('verifies a signed nonce message', () => {
    const keypair = nacl.sign.keyPair();
    const address = bs58.encode(keypair.publicKey);
    const message = buildSignInMessage('click1.example', 'nonce-123');
    const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);

    expect(verifyWalletSignature(address, message, Buffer.from(signature).toString('base64'))).toBe(true);
  });

  it('rejects a signature for a different message', () => {
    const keypair = nacl.sign.keyPair();
    const address = bs58.encode(keypair.publicKey);
    const message = buildSignInMessage('click1.example', 'nonce-123');
    const signature = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);

    expect(verifyWalletSignature(address, `${message}-tampered`, Buffer.from(signature).toString('base64'))).toBe(false);
  });
});
