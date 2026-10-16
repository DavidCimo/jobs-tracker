-- Roles Supabase creates for you. The migration's RLS policies grant to anon.
create role anon nologin;
create role authenticator login noinherit password 'authenticator';
grant anon to authenticator;
