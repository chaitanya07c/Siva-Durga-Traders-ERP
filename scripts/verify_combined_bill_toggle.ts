import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verifyCombinedBillToggle() {
  console.log("=== STARTING COMBINED BILL TOGGLE VERIFICATION ===")

  // 1. Fetch a shop to run tests on
  const { data: shops, error: fetchError } = await supabase.from('shops').select('*').limit(1)
  if (fetchError) {
    console.error("❌ Failed to fetch a shop:", fetchError)
    return
  }

  if (!shops || shops.length === 0) {
    console.log("⚠️ No shops found to test on. Creating a temporary shop...")
    const { data: tempShop, error: tempError } = await supabase.from('shops').insert([{
      name: "Temp Test Shop",
      type: "Wine",
      marked_for_combined_bill: false
    }]).select().single()

    if (tempError) {
      console.error("❌ Failed to create temp shop:", tempError)
      return
    }
    shops.push(tempShop)
  }

  const targetShop = shops[0]
  const originalFlag = targetShop.marked_for_combined_bill || false

  console.log(`Testing on Shop: ${targetShop.name} (ID: ${targetShop.id}), Current marked_for_combined_bill: ${originalFlag}`)

  // 2. Toggle to opposite flag
  const testFlag = !originalFlag
  const { error: updateError } = await supabase
    .from('shops')
    .update({ marked_for_combined_bill: testFlag })
    .eq('id', targetShop.id)

  if (updateError) {
    console.error("❌ Failed to update marked_for_combined_bill flag:", updateError)
    return
  }
  console.log(`✅ Successfully updated marked_for_combined_bill to ${testFlag}`)

  // Verify DB state
  const { data: verifiedShop, error: verifyError } = await supabase
    .from('shops')
    .select('marked_for_combined_bill')
    .eq('id', targetShop.id)
    .single()

  if (verifyError) {
    console.error("❌ Failed to verify database state:", verifyError)
    return
  }

  console.log(`✅ DB returns marked_for_combined_bill: ${verifiedShop.marked_for_combined_bill}`)
  if (verifiedShop.marked_for_combined_bill !== testFlag) {
    console.error(`❌ DB flag value mismatch! Expected ${testFlag}, but got ${verifiedShop.marked_for_combined_bill}`)
    return
  }

  // 3. Restore original flag value
  await supabase
    .from('shops')
    .update({ marked_for_combined_bill: originalFlag })
    .eq('id', targetShop.id)
  console.log("✅ Restored original shop flag value successfully.")

  // 4. Cleanup if we created a temp shop
  if (targetShop.name === "Temp Test Shop") {
    await supabase.from('shops').delete().eq('id', targetShop.id)
    console.log("✅ Deleted temporary shop.")
  }

  console.log("=== COMBINED BILL TOGGLE VERIFICATION COMPLETE with 0 errors ===")
}

verifyCombinedBillToggle().catch(console.error)
