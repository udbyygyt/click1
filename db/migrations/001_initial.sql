CREATE TABLE IF NOT EXISTS wallet_sessions (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  auth_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_sessions_wallet_idx ON wallet_sessions (wallet_address);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'game_over', 'abandoned')),
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  abandoned_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS games_one_active_per_wallet_idx
  ON games (wallet_address)
  WHERE status <> 'abandoned';

CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL CHECK (move_number > 0),
  row_index SMALLINT NOT NULL CHECK (row_index BETWEEN 0 AND 5),
  col_index SMALLINT NOT NULL CHECK (col_index BETWEEN 0 AND 5),
  snapshot JSONB NOT NULL,
  result_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, move_number)
);

CREATE TABLE IF NOT EXISTS daily_undo_entitlements (
  wallet_address TEXT NOT NULL,
  utc_date DATE NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, utc_date)
);

CREATE TABLE IF NOT EXISTS undo_orders (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_id UUID NOT NULL REFERENCES game_moves(id) ON DELETE CASCADE,
  amount_lamports BIGINT NOT NULL CHECK (amount_lamports = 10000000),
  recipient TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network = 'mainnet-beta'),
  memo TEXT NOT NULL UNIQUE,
  transaction_signature TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'confirmed', 'failed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS undo_orders_game_idx ON undo_orders (game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'completed', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
