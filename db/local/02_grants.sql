-- Supabase grants these to anon automatically. Plain Postgres does not.
grant usage on schema public to anon;
grant select, insert, update, delete on all tables in schema public to anon;
grant execute on all functions in schema public to anon;
