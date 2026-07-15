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
  console.log("Testing insert shop...")
  const { error } = await supabase.from('shops').insert([{
    name: 'Test Shop 2',
    type: 'Wine',
    marked_for_loading: false,
    shop_rates: {}
  }])
  console.log("Insert shop error:", error)
}
test()
