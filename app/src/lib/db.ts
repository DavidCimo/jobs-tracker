import { PostgrestClient } from '@supabase/postgrest-js';
import { createClient } from '@supabase/supabase-js';

// VITE_DB=postgres talks to a plain PostgREST server in front of a local Postgres (see docker-compose.yml).
// Anything else uses Supabase. Both expose the same .from() / .rpc() query builder.
const mode = import.meta.env.VITE_DB === 'postgres' ? 'postgres' : 'supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const postgrestUrl = import.meta.env.VITE_POSTGREST_URL as string | undefined;

export const dbConfigured = mode === 'postgres' ? Boolean(postgrestUrl) : Boolean(supabaseUrl && anonKey);

export const dbConfigHint =
  mode === 'postgres'
    ? 'Missing VITE_POSTGREST_URL. Copy app/.env.example to app/.env and fill it in.'
    : 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy app/.env.example to app/.env and fill it in.';

export const db: Pick<PostgrestClient, 'from' | 'rpc'> =
  mode === 'postgres'
    ? new PostgrestClient(postgrestUrl ?? 'http://localhost:3000')
    : createClient(supabaseUrl ?? 'https://missing.supabase.co', anonKey ?? 'missing');
