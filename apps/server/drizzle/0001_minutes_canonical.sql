-- Minutes are canonical time (ecosystem doctrine D14): stored work is exact
-- integer minutes; the hour columns become a derived compat view kept in
-- sync on write. Backfill converts every existing hour value once; rows that
-- never carried hours stay NULL in both units — absent is absent.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_minutes" integer;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "actual_minutes" integer;

UPDATE "tasks" SET "estimated_minutes" = "estimated_hours" * 60
  WHERE "estimated_minutes" IS NULL AND "estimated_hours" IS NOT NULL;
UPDATE "tasks" SET "actual_minutes" = "actual_hours" * 60
  WHERE "actual_minutes" IS NULL AND "actual_hours" IS NOT NULL;
