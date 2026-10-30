-- The administrator's review of held addresses (ADR-005 slice 4, akinaza#537): why a hold was kept, when it was last reviewed, and the address
-- that was cleared, so that re-judging shops against the current terms never undoes a decision an administrator already took.
ALTER TABLE shops ADD COLUMN slug_hold_note text;
ALTER TABLE shops ADD COLUMN slug_hold_reviewed_at timestamptz;
ALTER TABLE shops ADD COLUMN slug_cleared_for text;
