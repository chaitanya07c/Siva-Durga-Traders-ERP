import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verifyLoading() {
  console.log("=== STARTING LOADING VERIFICATION ===")

  // 1. Create a shop with marked_for_loading = true
  const testShop = {
    name: "Test Loading Shop",
    type: "Wine",
    marked_for_loading: true,
    shop_rates: { "Beer": 100 }
  }

  const { data: insertData, error: insertError } = await supabase.from('shops').insert([testShop]).select().single()
  if (insertError) {
    console.error("❌ Failed to insert shop:", insertError)
    return
  }
  console.log(`✅ Inserted shop (ID: ${insertData.id}) with marked_for_loading=true`)

  // 1b. Edit the same shop: Untick the checkbox
  const { error: editError } = await supabase.from('shops').update({ marked_for_loading: false }).eq('id', insertData.id)
  if (editError) {
    console.error("❌ Failed to untick marked_for_loading:", editError)
    return
  }
  const { data: editedShop } = await supabase.from('shops').select('marked_for_loading').eq('id', insertData.id).single()
  if (editedShop?.marked_for_loading !== false) {
    console.error("❌ Shop marked_for_loading is not false after update!")
    return
  }
  console.log("✅ Successfully unticked marked_for_loading")

  // Re-tick it so we can test the rest of the flow
  await supabase.from('shops').update({ marked_for_loading: true }).eq('id', insertData.id)

  // 2. Fetch pending loading shops (simulating Loading.tsx)
  const { data: pendingShops, error: pendingError } = await supabase.from('shops').select('*').eq('marked_for_loading', true)
  if (pendingError) {
    console.error("❌ Failed to fetch pending shops:", pendingError)
    return
  }
  
  const found = pendingShops.find(s => s.id === insertData.id)
  if (!found) {
    console.error("❌ Shop not found in pending loading query")
    return
  }
  console.log("✅ Shop correctly queried by marked_for_loading=true")

  // 3. Mark as complete (simulating Loading.tsx handleComplete)
  const { error: completeError } = await supabase.from('completed_loadings').insert([{
    shop_id: found.id,
    shop_name: found.name,
    shop_type: found.type,
    loading_date: new Date().toISOString().split('T')[0],
    purchase_bill_number: 999,
    purchase_amount: 1000
  }])
  
  if (completeError) {
    console.error("❌ Failed to insert into completed_loadings:", completeError)
    return
  }
  console.log("✅ Inserted into completed_loadings")

  // 4. Set marked_for_loading = false
  const { error: updateError } = await supabase.from('shops').update({ marked_for_loading: false }).eq('id', found.id)
  if (updateError) {
    console.error("❌ Failed to update marked_for_loading to false:", updateError)
    return
  }
  console.log("✅ Updated marked_for_loading to false")

  // 5. Verify it appears in Completed Loadings
  const { data: completedData, error: completedFetchError } = await supabase.from('completed_loadings').select('*').eq('shop_id', found.id).single()
  if (completedFetchError) {
    console.error("❌ Failed to fetch from completed_loadings:", completedFetchError)
    return
  }
  
  if (completedData.purchase_amount !== 1000 || completedData.purchase_bill_number !== 999) {
    console.error("❌ Completed loading data mismatch!")
    return
  }
  console.log("✅ Verified data correctly inserted and retrieved from completed_loadings")

  // 6. Cleanup
  await supabase.from('shops').delete().eq('id', found.id)
  console.log("✅ Cleanup complete")
  
  console.log("=== VERIFICATION COMPLETE with 0 errors ===")
}

verifyLoading().catch(console.error)
