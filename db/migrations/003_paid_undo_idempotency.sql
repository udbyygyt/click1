ALTER TABLE undo_orders ADD COLUMN IF NOT EXISTS result_state JSONB;

WITH duplicate_orders AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id, move_id ORDER BY created_at DESC, id DESC) AS order_rank
  FROM undo_orders
  WHERE status IN ('created', 'pending')
)
UPDATE undo_orders
SET status = 'expired'
WHERE id IN (SELECT id FROM duplicate_orders WHERE order_rank > 1);

CREATE UNIQUE INDEX IF NOT EXISTS undo_orders_one_open_per_move_idx
  ON undo_orders (game_id, move_id)
  WHERE status IN ('created', 'pending');
