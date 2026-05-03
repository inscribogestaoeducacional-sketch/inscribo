-- Add insight_generated_at column to campaign_cycles
ALTER TABLE campaign_cycles
  ADD COLUMN IF NOT EXISTS insight_generated_at TIMESTAMPTZ;
