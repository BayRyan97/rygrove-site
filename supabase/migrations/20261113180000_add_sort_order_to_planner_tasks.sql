-- Let tasks be manually reordered within a category on the Project Planner.
ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS sort_order integer;

-- Backfill: keep the existing order (creation time) within each category.
UPDATE planner_tasks t
SET sort_order = ranked.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY category_id ORDER BY created_at) - 1 AS rn
  FROM planner_tasks
) ranked
WHERE t.id = ranked.id AND t.sort_order IS NULL;

ALTER TABLE planner_tasks ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE planner_tasks ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS planner_tasks_category_sort_idx ON planner_tasks (category_id, sort_order);
