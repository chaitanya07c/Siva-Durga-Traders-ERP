import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verifyDefaultCost() {
  console.log("=== STARTING DEFAULT COST VERIFICATION ===")

  // 1. Insert a temporary material with default cost
  const testMaterial = {
    name: "Test Default Cost Material",
    category: "Bottle Brand",
    default_cost: 145.50
  }

  const { data: inserted, error: insertError } = await supabase
    .from('materials')
    .insert([testMaterial])
    .select()
    .single()

  if (insertError) {
    console.error("❌ Failed to insert material with default_cost:", insertError)
    return
  }

  console.log(`✅ Inserted material (ID: ${inserted.id}) with default_cost = ${inserted.default_cost}`)
  if (Number(inserted.default_cost) !== 145.50) {
    console.error(`❌ Expected default_cost 145.50, but got ${inserted.default_cost}`)
    return
  }

  // 2. Edit/update the default_cost
  const { error: updateError } = await supabase
    .from('materials')
    .update({ default_cost: 199.99 })
    .eq('id', inserted.id)

  if (updateError) {
    console.error("❌ Failed to update default_cost:", updateError)
    return
  }
  console.log("✅ Updated default_cost to 199.99")

  // 3. Fetch and verify the updated value
  const { data: fetched, error: fetchError } = await supabase
    .from('materials')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (fetchError) {
    console.error("❌ Failed to fetch material:", fetchError)
    return
  }

  console.log(`✅ Fetched material default_cost = ${fetched.default_cost}`)
  if (Number(fetched.default_cost) !== 199.99) {
    console.error(`❌ Expected default_cost 199.99, but got ${fetched.default_cost}`)
    return
  }

  // 4. Cleanup
  const { error: deleteError } = await supabase
    .from('materials')
    .delete()
    .eq('id', inserted.id)

  if (deleteError) {
    console.error("❌ Failed to delete test material:", deleteError)
    return
  }
  console.log("✅ Cleanup complete")
  console.log("=== DEFAULT COST VERIFICATION COMPLETE with 0 errors ===")
}

verifyDefaultCost().catch(console.error)
