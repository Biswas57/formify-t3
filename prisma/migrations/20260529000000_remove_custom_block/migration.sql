-- Remove the legacy CustomBlock model now that it is unused (T-107).
-- The old customBlockRouter was removed and the active Template Builder uses
-- BlockDefinition; no application code reads or writes CustomBlock.
-- Historical migrations are retained; this migration drops the unused table.

DROP TABLE "CustomBlock";
