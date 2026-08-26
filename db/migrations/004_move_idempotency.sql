ALTER TABLE game_moves ADD COLUMN IF NOT EXISTS client_move_id TEXT;
ALTER TABLE game_moves ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS game_moves_client_id_idx
  ON game_moves (game_id, client_move_id)
  WHERE client_move_id IS NOT NULL;
