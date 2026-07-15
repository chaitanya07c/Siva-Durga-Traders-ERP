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

async function verify() {
  console.log("=== STARTING PHASE 5 VERIFICATION ===")
  let errors = 0
  let createdShopIds: string[] = []

  const logError = (msg: string, err: any) => {
    console.error(`❌ ${msg}:`, err)
    errors++
  }
  const logSuccess = (msg: string) => {
    console.log(`✅ ${msg}`)
  }

  // 1. Test Shop Insertion
  console.log("\n--- Testing Shop Creation with Fixed Rates ---")
  const shopsToCreate = [
    { 
      name: 'Wine Shop With Rates', 
      type: 'Wine',
      shop_rates: { "Beer": 120, "L.C.'s": 150, "Full's": 300, "Atta": 10, "Plastic": 5, "Nibe Box": 20, "Beer Box": 25 }
    },
    { 
      name: 'Akividu Wine Shop With Rates', 
      type: 'Akividu Wine',
      shop_rates: { "Beer": 125, "L.C.'s": 155, "Full's": 310, "Atta": 12, "Plastic": 6, "Nibe Box": 22, "Beer Box": 27 }
    },
    { 
      name: 'Iron Shop With Rates', 
      type: 'Iron',
      shop_rates: { "Glass": 50 }
    }
  ]

  for (const shop of shopsToCreate) {
    const { data, error } = await supabase.from('shops').insert([shop]).select()
    if (error) {
      logError(`Failed to insert ${shop.type}`, error)
    } else {
      logSuccess(`Inserted ${shop.type} (ID: ${data[0].id})`)
      createdShopIds.push(data[0].id)
    }
  }

  if (createdShopIds.length > 0) {
    // 2. Test Shop Editing (Update Rates)
    console.log("\n--- Testing Shop Rate Editing ---")
    const editPayload = { 
      shop_rates: { "Beer": 130, "L.C.'s": 160, "Full's": 320, "Atta": 15, "Plastic": 8, "Nibe Box": 25, "Beer Box": 30 } 
    }
    const { error: updateError } = await supabase.from('shops').update(editPayload).eq('id', createdShopIds[0])
    if (updateError) {
      logError(`Failed to update shop rates for ${createdShopIds[0]}`, updateError)
    } else {
      logSuccess(`Updated shop rates for Wine Shop ${createdShopIds[0]}`)
    }

    // 5. Cleanup
    console.log("\n--- Cleanup ---")
    const { error: deleteError } = await supabase.from('shops').delete().in('id', createdShopIds)
    if (deleteError) {
      logError(`Failed to delete test shops`, deleteError)
    } else {
      logSuccess(`Deleted test shops`)
    }
  }

  console.log(`\n=== VERIFICATION COMPLETE with ${errors} errors ===`)
}

verify()
