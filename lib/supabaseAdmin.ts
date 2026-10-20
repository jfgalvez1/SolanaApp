import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  // Only warn on the server; missing key fails at request time with a clear error.
  if (typeof window === 'undefined') {
    console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
}

/** Server-only Supabase client that bypasses RLS. Never import this in client components. */
export function createSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server is missing Supabase admin credentials')
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
