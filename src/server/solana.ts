export interface TransferVerificationInput {
  rpcUrl: string;
  signature: string;
  sender: string;
  recipient: string;
  lamports: number;
  memo: string;
  fetchImpl?: typeof fetch;
}

interface RpcResponse {
  result?: {
    meta?: { err?: unknown };
    transaction?: { message?: { instructions?: Array<{ program?: string; parsed?: { type?: string; info?: { source?: string; destination?: string; lamports?: number } } | string }> } };
  } | null;
}

export async function verifySolanaTransfer(input: TransferVerificationInput): Promise<boolean> {
  const request = input.fetchImpl ?? fetch;
  const response = await request(input.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [input.signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }] }),
  });
  if (!response.ok) return false;
  const payload = await response.json() as RpcResponse;
  const transaction = payload.result;
  if (!transaction || transaction.meta?.err) return false;
  const instructions = transaction.transaction?.message?.instructions ?? [];
  const transferFound = instructions.some((instruction) => {
    const parsed = instruction.parsed;
    if (!parsed || typeof parsed === 'string' || instruction.program !== 'system' || parsed.type !== 'transfer') return false;
    const info = parsed.info;
    return info?.source === input.sender && info.destination === input.recipient && info.lamports === input.lamports;
  });
  const memoFound = instructions.some((instruction) => instruction.program === 'spl-memo' && (instruction.parsed === input.memo || (typeof instruction.parsed === 'object' && instruction.parsed?.type === input.memo)));
  return transferFound && memoFound;
}
