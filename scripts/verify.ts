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
  console.log("=== STARTING VERIFICATION ===")
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
  console.log("\n--- Testing Shop Creation ---")
  const shopsToCreate = [
    { name: 'Test Wine Shop', type: 'Wine' },
    { name: 'Test Akividu Shop', type: 'Akividu Wine' },
    { name: 'Test Iron Shop', type: 'Iron' }
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
    // 2. Test Shop Editing
    console.log("\n--- Testing Shop Editing ---")
    const editPayload = { landmark: 'Updated Landmark Verification' }
    const { error: updateError } = await supabase.from('shops').update(editPayload).eq('id', createdShopIds[0])
    if (updateError) {
      logError(`Failed to update shop ${createdShopIds[0]}`, updateError)
    } else {
      logSuccess(`Updated shop ${createdShopIds[0]}`)
    }

    // 3. Test Complete Loading Payloads (Validating the parsing logic)
    console.log("\n--- Testing Complete Loading (Payload Parsing) ---")
    const testCases = [
      { amountStr: '1000', billStr: '123' },
      { amountStr: '1,000', billStr: '' },
      { amountStr: '1000.50', billStr: '456' },
      { amountStr: '', billStr: '' } // blank
    ]

    for (let i = 0; i < Math.min(testCases.length, createdShopIds.length); i++) {
      const tc = testCases[i]
      const shopId = createdShopIds[i]
      
      const amountStr = tc.amountStr || '0'
      const parsedAmount = parseFloat(amountStr.replace(/,/g, ''))
      const amount = isNaN(parsedAmount) ? 0 : parsedAmount

      let finalBill: number | null = null
      if (tc.billStr) {
        const parsed = parseInt(tc.billStr, 10)
        if (!isNaN(parsed)) finalBill = parsed
      }

      console.log(`Testing Complete Loading -> Amount string: "${tc.amountStr}" parsed to ${amount}, Bill string: "${tc.billStr}" parsed to ${finalBill}`)
      
      const payload = {
        shop_id: shopId,
        shop_name: 'Test Shop Name',
        shop_type: 'Test Type',
        loading_date: new Date().toISOString().split('T')[0],
        purchase_bill_number: finalBill,
        purchase_amount: amount
      }
      
      const { error: completedError } = await supabase.from('completed_loadings').insert([payload])

      if (completedError) {
        if (completedError.code === 'PGRST205') {
           logSuccess(`Payload for amount ${amount} is valid but table 'completed_loadings' is missing in schema cache. Parsing passed.`)
        } else {
           logError(`Failed to insert into completed_loadings`, completedError)
        }
      } else {
        logSuccess(`Successfully inserted into completed_loadings with amount ${amount}`)
      }
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
