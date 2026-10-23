-- Matches get an optional human-readable title so users can name a game
-- ("Sunday friendly", "Quarter-final") independent of team names.
ALTER TABLE matches ADD COLUMN title TEXT;
