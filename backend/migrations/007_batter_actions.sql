-- Auditable scorer corrections to the crease: swapping ends and replacing a
-- batter without a delivery. Each row stores the full session state before
-- and after the action so undo can restore it exactly, mirroring
-- scoring_delivery_details for deliveries.
CREATE TABLE scoring_batter_actions (
  action_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  action_json TEXT NOT NULL CHECK (json_valid(action_json)),
  state_before_json TEXT NOT NULL CHECK (json_valid(state_before_json)),
  state_after_json TEXT NOT NULL CHECK (json_valid(state_after_json)),
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE scoring_batter_action_undos (
  action_id TEXT PRIMARY KEY REFERENCES scoring_batter_actions(action_id) ON DELETE RESTRICT,
  undone_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_batter_actions_match ON scoring_batter_actions(match_id);
