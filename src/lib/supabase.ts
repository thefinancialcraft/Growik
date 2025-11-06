import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Ensure singleton client in dev (HMR can re-run module)
declare global {
  // eslint-disable-next-line no-var
  var __SUPABASE_CLIENT__: ReturnType<typeof createClient> | undefined
  // eslint-disable-next-line no-var
  var __SUPABASE_ADMIN_CLIENT__: ReturnType<typeof createClient> | undefined
}

export const supabase = globalThis.__SUPABASE_CLIENT__ ?? createClient(supabaseUrl, supabaseAnonKey)
globalThis.__SUPABASE_CLIENT__ = supabase

// Admin client with service key (only if service key is available)
export const supabaseAdmin = supabaseServiceKey 
  ? (globalThis.__SUPABASE_ADMIN_CLIENT__ ?? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }))
  : null

if (supabaseServiceKey) {
  globalThis.__SUPABASE_ADMIN_CLIENT__ = supabaseAdmin as ReturnType<typeof createClient>
}

// Safe debug exports (do NOT log keys)
export const SUPABASE_URL = supabaseUrl as string
export const SUPABASE_ENV_OK = Boolean(supabaseUrl && supabaseAnonKey)
export const SUPABASE_ANON_KEY = supabaseAnonKey as string