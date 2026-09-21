-- PostgreSQL CHECK expressions accept NULL, so missing JSON keys must be
-- converted to false explicitly instead of relying on chained comparisons.
alter table public.recipe_import_jobs
  add constraint recipe_import_jobs_result_shape_check check (
    result is null or (
      coalesce(result->>'schemaVersion' = 'recipe-v1', false)
      and coalesce(btrim(result->>'title') <> '', false)
      and case when jsonb_typeof(result->'ingredients') = 'array'
        then jsonb_array_length(result->'ingredients') > 0 else false end
      and case when jsonb_typeof(result->'steps') = 'array'
        then jsonb_array_length(result->'steps') > 0 else false end
    )
  );
