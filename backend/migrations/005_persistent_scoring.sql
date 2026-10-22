CREATE TABLE scoring_sessions (
  match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE scoring_delivery_details (
  event_id TEXT PRIMARY KEY REFERENCES ball_by_ball_events(id) ON DELETE RESTRICT,
  delivery_json TEXT NOT NULL CHECK (json_valid(delivery_json)),
  state_before_json TEXT NOT NULL CHECK (json_valid(state_before_json)),
  state_after_json TEXT NOT NULL CHECK (json_valid(state_after_json))
);

CREATE TABLE scoring_event_undos (
  event_id TEXT PRIMARY KEY REFERENCES ball_by_ball_events(id) ON DELETE RESTRICT,
  undone_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER scoring_delivery_details_are_immutable_update
BEFORE UPDATE ON scoring_delivery_details
BEGIN
  SELECT RAISE(ABORT, 'scoring delivery details are immutable');
END;

CREATE TRIGGER scoring_delivery_details_are_immutable_delete
BEFORE DELETE ON scoring_delivery_details
BEGIN
  SELECT RAISE(ABORT, 'scoring delivery details are immutable');
END;
