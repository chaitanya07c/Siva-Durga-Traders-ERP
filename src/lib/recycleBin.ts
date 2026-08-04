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
  expires_at?: string
}

export const addToRecycleBin = async (item: RecycleBinItem): Promise<boolean> => {
  const deletedAt = item.deleted_at || new Date().toISOString()
  const expiresAt = item.expires_at || new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const payload: any = {
    id: item.id || crypto.randomUUID(),
    type: item.type,
    item_id: item.item_id,
    title: item.title,
    shop_name: item.shop_name || '',
    bill_number: item.bill_number || '',
    amount: Number(item.amount || 0),
    data: item.data,
    deleted_at: deletedAt,
    expires_at: expiresAt
  }

  const { error } = await supabase.from('recycle_bin').insert([payload])

  if (error) {
    console.error("Supabase recycle_bin insert error:", error)
    // If expires_at column is missing on DB, fallback without expires_at
    if (error.message && error.message.includes('expires_at')) {
      delete payload.expires_at
      const { error: retryErr } = await supabase.from('recycle_bin').insert([payload])
      if (retryErr) {
        console.error("Retry insert error on recycle_bin:", retryErr)
        throw retryErr
      }
    } else {
      throw error
    }
  }

  return true
}

export const getRecycleBinItems = async (): Promise<RecycleBinItem[]> => {
  try {
    const nowIso = new Date().toISOString()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const nowMs = Date.now()

    // Delete expired items from database (> 30 days or expires_at <= now)
    try {
      await supabase.from('recycle_bin').delete().lte('expires_at', nowIso)
    } catch (e) {
      const thirtyDaysAgo = new Date(nowMs - thirtyDaysMs).toISOString()
      await supabase.from('recycle_bin').delete().lt('deleted_at', thirtyDaysAgo)
    }

    const { data, error } = await supabase
      .from('recycle_bin')
      .select('*')
      .order('deleted_at', { ascending: false })

    if (error) {
      console.error("Supabase recycle_bin select error:", error)
      return []
    }

    return (data || [])
      .filter((d: any) => {
        // Client-side retention filter guard: exclude items older than 30 days
        const delTime = new Date(d.deleted_at || d.created_at || nowIso).getTime()
        const expTime = d.expires_at ? new Date(d.expires_at).getTime() : (delTime + thirtyDaysMs)
        return expTime > nowMs && (nowMs - delTime) < thirtyDaysMs
      })
      .map((d: any) => {
        const deletedAt = d.deleted_at || d.created_at || nowIso
        const expiresAt = d.expires_at || new Date(new Date(deletedAt).getTime() + thirtyDaysMs).toISOString()
        return {
          id: d.id,
          type: d.type || 'purchase_bill',
          item_id: d.item_id,
          title: d.title || d.shop_name || 'Deleted Item',
          shop_name: d.shop_name || '',
          bill_number: d.bill_number || '',
          amount: Number(d.amount || 0),
          data: d.data,
          deleted_at: deletedAt,
          expires_at: expiresAt
        }
      })
  } catch (e) {
    console.error("Supabase recycle_bin fetch error:", e)
    return []
  }
}

export const restoreFromRecycleBin = async (id: string): Promise<boolean> => {
  const { data: target, error: fetchErr } = await supabase
    .from('recycle_bin')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !target) throw new Error("Recycle bin item not found in database")

  const { type, data } = target

  if (type === 'purchase_bill' || type === 'purchase') {
    const { purchase, purchase_items } = data || {}
    if (purchase) {
      const { error: purchaseErr } = await supabase.from('purchases').insert([purchase])
      if (purchaseErr) throw purchaseErr
      if (purchase_items && purchase_items.length > 0) {
        await supabase.from('purchase_items').insert(purchase_items)
      }
    }
  } else if (type === 'sale_bill' || type === 'sale') {
    const { sale, sale_items } = data || {}
    if (sale) {
      const { error: saleErr } = await supabase.from('sales').insert([sale])
      if (saleErr) throw saleErr
      if (sale_items && sale_items.length > 0) {
        await supabase.from('sale_items').insert(sale_items)
      }
    }
  } else if (type === 'shop') {
    const { shop } = data || {}
    if (shop) {
      const { error } = await supabase.from('shops').insert([shop])
      if (error) throw error
    }
  } else if (type === 'worker' || type === 'employee') {
    const { employee, attendance } = data || {}
    if (employee) {
      const { error } = await supabase.from('employees').insert([employee])
      if (error) throw error
      if (attendance && attendance.length > 0) {
        await supabase.from('attendance').insert(attendance)
      }
    }
  } else if (type === 'expense') {
    const { expense } = data || {}
    if (expense) {
      const { error } = await supabase.from('expenses').insert([expense])
      if (error) throw error
    }
  } else if (type === 'buyer') {
    const { buyer } = data || {}
    if (buyer) {
      const { error } = await supabase.from('buyers').insert([buyer])
      if (error) throw error
    }
  } else if (type === 'material') {
    const { material } = data || {}
    if (material) {
      const { error } = await supabase.from('materials').insert([material])
      if (error) throw error
    }
  } else if (type === 'loading') {
    const { loading } = data || {}
    if (loading) {
      const { error } = await supabase.from('completed_loadings').insert([loading])
      if (error) throw error
    }
  } else {
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
  const { error: deleteErr } = await supabase.from('recycle_bin').delete().eq('id', id)
  if (deleteErr) console.error("Error deleting from recycle_bin after restore:", deleteErr)

  return true
}

export const deletePermanentlyFromRecycleBin = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from('recycle_bin').delete().eq('id', id)
  if (error) throw error
  return true
}
