import bs58 from 'bs58';
import nacl from 'tweetnacl';

export function buildSignInMessage(domain: string, nonce: string): string {
  return `Click+1 wants you to sign in with your Solana account.\n\nDomain: ${domain}\nNonce: ${nonce}`;
}

export function isValidWalletAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

export function verifyWalletSignature(address: string, message: string, signatureBase64: string): boolean {
  try {
    const publicKey = bs58.decode(address);
    const signature = Buffer.from(signatureBase64, 'base64');
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(message), signature, publicKey);
  } catch {
    return false;
  }
}
