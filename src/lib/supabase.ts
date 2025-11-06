import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Ensure singleton client in dev (HMR can re-run module)
declare global {
  // eslint-disable-next-line no-var
  var __SUPABASE_CLIENT__: ReturnType<typeof createClient> | undefined
}

export const supabase = globalThis.__SUPABASE_CLIENT__ ?? createClient(supabaseUrl, supabaseAnonKey)
globalThis.__SUPABASE_CLIENT__ = supabase

// Safe debug exports (do NOT log keys)
export const SUPABASE_URL = supabaseUrl as string
export const SUPABASE_ENV_OK = Boolean(supabaseUrl && supabaseAnonKey)
export const SUPABASE_ANON_KEY = supabaseAnonKey as string