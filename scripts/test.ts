import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf-8')
let supabaseUrl = ''
let supabaseAnonKey = ''
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim()
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) supabaseAnonKey = line.split('=')[1].trim()
})

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
  const { data: shops, error } = await supabase.from('shops').select('*').limit(1)
  if (error) {
    console.error("Error fetching shop:", error)
    return
  }
  if (shops && shops.length > 0) {
    console.log("Shop columns:", Object.keys(shops[0]))
  } else {
    console.log("No shops found.")
  }
}
test()
