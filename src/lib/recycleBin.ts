import { supabase } from '@/lib/supabase'

export type RecycleBinItem = {
  id: string
  type: 'purchase_bill'
  item_id: string
  title: string
  shop_name: string
  bill_number: string
  amount: number
  data: {
    purchase: any
    purchase_items: any[]
  }
  deleted_at: string
}

const LOCAL_STORAGE_KEY = 'siva_durga_recycle_bin_v1'

const getLocalRecycleBin = (): RecycleBinItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    console.error("Error reading recycle bin from localStorage:", e)
    return []
  }
}

const setLocalRecycleBin = (items: RecycleBinItem[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
  } catch (e) {
    console.error("Error saving recycle bin to localStorage:", e)
  }
}

export const addToRecycleBin = async (item: RecycleBinItem): Promise<boolean> => {
  // Always update localStorage as reliable fallback
  const localItems = getLocalRecycleBin()
  const updatedLocal = [item, ...localItems.filter(i => i.id !== item.id)]
  setLocalRecycleBin(updatedLocal)

  try {
    const { error } = await supabase.from('recycle_bin').insert([{
      id: item.id,
      type: item.type,
      item_id: item.item_id,
      title: item.title,
      shop_name: item.shop_name,
      bill_number: item.bill_number,
      amount: item.amount,
      data: item.data,
      deleted_at: item.deleted_at
    }])

    if (error) {
      console.warn("Supabase recycle_bin insert warning (using local fallback):", error.message)
    }
  } catch (e) {
    console.warn("Supabase recycle_bin error (using local fallback):", e)
  }

  return true
}

export const getRecycleBinItems = async (): Promise<RecycleBinItem[]> => {
  try {
    const { data, error } = await supabase
      .from('recycle_bin')
      .select('*')
      .order('deleted_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return data.map((d: any) => ({
        id: d.id,
        type: d.type || 'purchase_bill',
        item_id: d.item_id,
        title: d.title,
        shop_name: d.shop_name,
        bill_number: d.bill_number,
        amount: Number(d.amount || 0),
        data: d.data,
        deleted_at: d.deleted_at
      }))
    }
  } catch (e) {
    console.warn("Supabase recycle_bin select error (using local fallback):", e)
  }

  return getLocalRecycleBin()
}

export const restoreFromRecycleBin = async (id: string): Promise<boolean> => {
  const items = await getRecycleBinItems()
  const target = items.find(i => i.id === id)
  if (!target) throw new Error("Recycle bin item not found")

  const { purchase, purchase_items } = target.data

  if (!purchase) throw new Error("Invalid bill data for restoration")

  // 1. Re-insert purchase row into Supabase
  const { error: purchaseErr } = await supabase.from('purchases').insert([purchase])
  if (purchaseErr) throw purchaseErr

  // 2. Re-insert purchase_items rows into Supabase if any
  if (purchase_items && purchase_items.length > 0) {
    const { error: itemsErr } = await supabase.from('purchase_items').insert(purchase_items)
    if (itemsErr) {
      console.warn("Error re-inserting purchase items during restore:", itemsErr.message)
    }
  }

  // 3. Remove from Supabase recycle_bin table
  try {
    await supabase.from('recycle_bin').delete().eq('id', id)
  } catch (e) {
    // Ignore error if table doesn't exist
  }

  // 4. Remove from localStorage
  const localItems = getLocalRecycleBin()
  const updatedLocal = localItems.filter(i => i.id !== id)
  setLocalRecycleBin(updatedLocal)

  return true
}

export const deletePermanentlyFromRecycleBin = async (id: string): Promise<boolean> => {
  try {
    await supabase.from('recycle_bin').delete().eq('id', id)
  } catch (e) {
    // Ignore error
  }

  const localItems = getLocalRecycleBin()
  const updatedLocal = localItems.filter(i => i.id !== id)
  setLocalRecycleBin(updatedLocal)

  return true
}
