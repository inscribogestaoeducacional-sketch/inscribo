-- Allow 'setup' and 'completed' as valid status values in campaign_cycles
ALTER TABLE campaign_cycles
  DROP CONSTRAINT IF EXISTS campaign_cycles_status_check;

-- Normalise any legacy status values before adding the constraint
UPDATE campaign_cycles
  SET status = 'archived'
  WHERE status NOT IN ('draft', 'active', 'archived', 'setup', 'completed');

ALTER TABLE campaign_cycles
  ADD CONSTRAINT campaign_cycles_status_check
  CHECK (status IN ('draft', 'active', 'archived', 'setup', 'completed'));
