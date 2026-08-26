export type SolanaCluster = 'devnet' | 'mainnet-beta';

export interface AppConfig {
  environment: string;
  cluster: SolanaCluster;
  undoPriceLamports: number;
}

export function resolveConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const environment = source.APP_ENV ?? 'development';
  const requestedCluster = source.SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
  const cluster: SolanaCluster = environment === 'production' ? 'mainnet-beta' : requestedCluster;
  const configuredPrice = Number(source.UNDO_PRICE_LAMPORTS ?? 10000000);
  const undoPriceLamports = configuredPrice === 10000000 ? configuredPrice : 10000000;
  return { environment, cluster, undoPriceLamports };
}
