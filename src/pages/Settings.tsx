import { useEffect, useState } from "react"
import { Moon, Sun, Plus, Edit2, Trash2, Package, Globe } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Material } from "@/types/database"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

export function Settings() {
  const [activeTab, setActiveTab] = useState<"general" | "items">("general")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const { lang, setLang } = useOutletContext<{ lang: "en" | "te", setLang: (lang: "en" | "te") => void }>()

  // Sales Items State
  const [materials, setMaterials] = useState<Material[]>([])
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Material | null>(null)
  
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formNameTe, setFormNameTe] = useState("")
  const [formCategoryTe, setFormCategoryTe] = useState("")

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setTheme("dark")
    }
    loadMaterials()
  }, [])

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark")
      setTheme("dark")
    } else {
      document.documentElement.classList.remove("dark")
      setTheme("light")
    }
  }

  const loadMaterials = async () => {
    const { data } = await supabase.from('materials').select('*').order('category').order('name')
    if (data) setMaterials(data)
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formCategory.trim()) return toast.error(t("errFieldsRequired", lang))
    
    try {
      const payload = {
        name: formName,
        name_te: formNameTe,
        category: formCategory,
        category_te: formCategoryTe
      }
      if (editingItem) {
        await supabase.from('materials').update(payload).eq('id', editingItem.id)
        toast.success(t("successUpdate", lang))
      } else {
        await supabase.from('materials').insert([payload])
        toast.success(t("successSave", lang))
      }
      setIsModalOpen(false)
      loadMaterials()
    } catch (err: any) {
      toast.error(err.message || "Error saving item")
    }
  }

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      await supabase.from('materials').delete().eq('id', id)
      toast.success("Item deleted")
      loadMaterials()
    } catch (err: any) {
      toast.error(err.message || "Error deleting item")
    }
  }

  const openModal = (item?: Material) => {
    if (item) {
      setEditingItem(item)
      setFormName(item.name)
      setFormNameTe(item.name_te || "")
      setFormCategory(item.category)
      setFormCategoryTe(item.category_te || "")
    } else {
      setEditingItem(null)
      setFormName("")
      setFormNameTe("")
      setFormCategory("")
      setFormCategoryTe("")
    }
    setIsModalOpen(true)
  }

  // Get unique categories for dropdown
  const categories = Array.from(new Set(materials.map(m => m.category)))
  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    (m.name_te && m.name_te.includes(search)) ||
    m.category.toLowerCase().includes(search.toLowerCase()) ||
    (m.category_te && m.category_te.includes(search))
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-2">
          <button 
            onClick={() => setActiveTab("general")}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === "general" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            General Settings
          </button>
          <button 
            onClick={() => setActiveTab("items")}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${activeTab === "items" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <Package className="w-4 h-4 mr-2" /> Sales Items
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card rounded-xl border shadow-sm min-h-[500px]">
          
          {activeTab === "general" && (
            <div className="p-6 space-y-8">
              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> Language
                </h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Application Language</p>
                    <p className="text-sm text-muted-foreground">Select your preferred language for the application interface.</p>
                  </div>
                  <div className="relative">
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as "en" | "te")}
                      className="appearance-none bg-secondary hover:bg-secondary/80 border-none rounded-lg px-4 py-2.5 pr-10 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="en">English</option>
                      <option value="te">తెలుగు</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Appearance</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Application Theme</p>
                    <p className="text-sm text-muted-foreground">Switch between light and dark mode for the application interface.</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 flex items-center gap-2"
                  >
                    {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    <span className="capitalize">{theme} Mode</span>
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">Database Connection</h2>
                <div className="space-y-2">
                  <p className="text-sm"><span className="font-medium">Status:</span> <span className="text-green-600 font-bold">Connected (Supabase)</span></p>
                  <p className="text-sm"><span className="font-medium">URL:</span> {import.meta.env.VITE_SUPABASE_URL}</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">System Information</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Siva Durga Traders ERP v1.0.0</p>
                  <p>Developed with React & Supabase</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "items" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Manage Items & Categories</h2>
                <button onClick={() => openModal()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm flex items-center hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </button>
              </div>

              <input 
                type="text" 
                placeholder="Search items or categories..." 
                className="w-full border p-2 rounded-lg"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left">
              <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3">{t("category", lang)}</th>
                      <th className="px-4 py-3">{t("name", lang)}</th>
                      <th className="px-4 py-3 text-right">{t("actions", lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMaterials.map(m => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-muted-foreground">{lang === 'te' && m.category_te ? m.category_te : m.category}</td>
                        <td className="px-4 py-3 font-semibold">{lang === 'te' && m.name_te ? m.name_te : m.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openModal(m)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded mr-1"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteItem(m.id, m.name)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No items found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">{editingItem ? "Edit Item" : "Add New Item"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("name", lang)} *</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Kingfisher Red"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("nameTe", lang)}</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formNameTe}
                  onChange={e => setFormNameTe(e.target.value)}
                  placeholder="ఉదా. కింగ్‌ఫిషర్ రెడ్"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("category", lang)} *</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  placeholder="e.g. Beer Bottles"
                  list="categoriesList"
                  required
                />
                <datalist id="categoriesList">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("categoryTe", lang)}</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formCategoryTe}
                  onChange={e => setFormCategoryTe(e.target.value)}
                  placeholder="ఉదా. బీర్ బాటిల్స్"
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
