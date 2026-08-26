import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/server/config.js';

describe('resolveConfig', () => {
  it('forces mainnet-beta in production', () => {
    expect(resolveConfig({ APP_ENV: 'production', SOLANA_CLUSTER: 'devnet' }).cluster).toBe('mainnet-beta');
  });

  it('allows devnet outside production', () => {
    expect(resolveConfig({ APP_ENV: 'development', SOLANA_CLUSTER: 'devnet' }).cluster).toBe('devnet');
  });

  it('uses the fixed undo price when no override is configured', () => {
    expect(resolveConfig({}).undoPriceLamports).toBe(10000000);
  });
});
