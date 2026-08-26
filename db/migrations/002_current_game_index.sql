DROP INDEX IF EXISTS games_one_active_per_wallet_idx;

CREATE UNIQUE INDEX games_one_active_per_wallet_idx
  ON games (wallet_address)
  WHERE status <> 'abandoned';
