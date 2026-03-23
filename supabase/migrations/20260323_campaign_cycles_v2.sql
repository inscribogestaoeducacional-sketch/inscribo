-- Migration: Campaign cycles v2 — status, wizard fields, campaign_start_month
-- Execute no Supabase Dashboard → SQL Editor

ALTER TABLE campaign_cycles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  ADD COLUMN IF NOT EXISTS campaign_start_month INTEGER DEFAULT 8
    CHECK (campaign_start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS school_data JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS historical_data JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS erp_files JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS wizard_step INTEGER DEFAULT 1;
