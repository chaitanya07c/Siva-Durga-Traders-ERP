import { supabase } from '@/lib/supabase'

export type RecycleBinItem = {
  id: string
  type: 'purchase_bill' | 'purchase' | 'sale_bill' | 'sale' | 'shop' | 'worker' | 'employee' | 'expense' | 'buyer' | 'material' | 'loading' | string
  item_id: string
  title: string
  shop_name?: string
  bill_number?: string
  amount: number
  data: Record<string, any>
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
      shop_name: item.shop_name || '',
      bill_number: item.bill_number || '',
      amount: item.amount || 0,
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
        title: d.title || d.shop_name || 'Deleted Item',
        shop_name: d.shop_name || '',
        bill_number: d.bill_number || '',
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

  const { type, data } = target

  if (type === 'purchase_bill' || type === 'purchase') {
    const { purchase, purchase_items } = data
    if (purchase) {
      const { error: purchaseErr } = await supabase.from('purchases').insert([purchase])
      if (purchaseErr) throw purchaseErr
      if (purchase_items && purchase_items.length > 0) {
        await supabase.from('purchase_items').insert(purchase_items)
      }
    }
  } else if (type === 'sale_bill' || type === 'sale') {
    const { sale, sale_items } = data
    if (sale) {
      const { error: saleErr } = await supabase.from('sales').insert([sale])
      if (saleErr) throw saleErr
      if (sale_items && sale_items.length > 0) {
        await supabase.from('sale_items').insert(sale_items)
      }
    }
  } else if (type === 'shop') {
    const { shop } = data
    if (shop) {
      const { error } = await supabase.from('shops').insert([shop])
      if (error) throw error
    }
  } else if (type === 'worker' || type === 'employee') {
    const { employee, attendance } = data
    if (employee) {
      const { error } = await supabase.from('employees').insert([employee])
      if (error) throw error
      if (attendance && attendance.length > 0) {
        await supabase.from('attendance').insert(attendance)
      }
    }
  } else if (type === 'expense') {
    const { expense } = data
    if (expense) {
      const { error } = await supabase.from('expenses').insert([expense])
      if (error) throw error
    }
  } else if (type === 'buyer') {
    const { buyer } = data
    if (buyer) {
      const { error } = await supabase.from('buyers').insert([buyer])
      if (error) throw error
    }
  } else if (type === 'material') {
    const { material } = data
    if (material) {
      const { error } = await supabase.from('materials').insert([material])
      if (error) throw error
    }
  } else if (type === 'loading') {
    const { loading } = data
    if (loading) {
      const { error } = await supabase.from('completed_loadings').insert([loading])
      if (error) throw error
    }
  } else {
    // Generic fallback for any record
    if (data && typeof data === 'object') {
      for (const [tableName, recordOrArray] of Object.entries(data)) {
        if (Array.isArray(recordOrArray) && recordOrArray.length > 0) {
          await supabase.from(tableName).insert(recordOrArray)
        } else if (recordOrArray && typeof recordOrArray === 'object' && !Array.isArray(recordOrArray)) {
          await supabase.from(tableName).insert([recordOrArray])
        }
      }
    }
  }

  // Remove from Supabase recycle_bin table
  try {
    await supabase.from('recycle_bin').delete().eq('id', id)
  } catch (e) {
    // Ignore error
  }

  // Remove from localStorage
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
