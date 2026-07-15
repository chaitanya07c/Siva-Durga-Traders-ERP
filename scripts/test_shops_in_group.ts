import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testShops() {
  const { data: shops } = await supabase.from('shops').select('id, name, landmark, type')
  console.log("=== ALL REGISTERED SHOPS ===")
  shops?.forEach(s => {
    console.log(`- ID: ${s.id} | Name: "${s.name}" | Landmark: "${s.landmark}" | Type: "${s.type}"`)
  })
}

testShops().catch(console.error)
