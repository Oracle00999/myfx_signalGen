ALTER TABLE signals
ADD COLUMN IF NOT EXISTS entry_source VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'signals_entry_source_check'
  ) THEN
    ALTER TABLE signals
    ADD CONSTRAINT signals_entry_source_check
    CHECK (entry_source IN ('FVG', 'SUPPORT_ZONE', 'RESISTANCE_ZONE', 'MARKET'));
  END IF;
END $$;
