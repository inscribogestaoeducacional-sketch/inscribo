-- Allow 'setup' and 'completed' as valid status values in campaign_cycles
ALTER TABLE campaign_cycles
  DROP CONSTRAINT IF EXISTS campaign_cycles_status_check;

ALTER TABLE campaign_cycles
  ADD CONSTRAINT campaign_cycles_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'setup', 'completed'));
