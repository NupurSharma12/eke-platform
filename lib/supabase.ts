import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return client;
}

// Constructing the real client validates supabaseUrl synchronously and
// throws if it's empty. Every actual call site only ever touches
// `supabase` inside a useEffect/handler at browser runtime, never at
// module scope or render time, so building this lazily — via a Proxy
// that defers construction to the first real property access — lets
// module import (and therefore Next.js static generation, which never
// invokes a useEffect) succeed without Supabase env vars, while an
// actual attempt to use Supabase without valid configuration still
// fails exactly as before, just at first use instead of at import.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});
