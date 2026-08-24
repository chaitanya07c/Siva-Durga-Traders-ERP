import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_SUPABASE_URL) || "https://mock.supabase.co"
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_SUPABASE_PUBLISHABLE_KEY) || "mock-key"

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl || "https://mock.supabase.co", supabaseAnonKey || "mock-key")
