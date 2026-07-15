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
    name: 'Test Shop',
    type: 'Wine',
    landmark: 'Test Landmark',
    mobile: '1234567890'
  }])
  console.log("Insert shop error:", error)
}
test()
