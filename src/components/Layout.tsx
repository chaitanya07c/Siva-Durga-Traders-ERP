import { Outlet, Link, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { LayoutDashboard, Store, ShoppingCart, Banknote, Users, FileText, Settings as SettingsIcon, Truck, Search, Mic, CreditCard, Menu, X, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Dashboard", te: "డ్యాష్‌బోర్డ్", path: "/", icon: LayoutDashboard },
  { name: "Shop Details", te: "దుకాణం వివరాలు", path: "/shops", icon: Store },
  { name: "Purchasing", te: "కొనుగోళ్లు", path: "/purchasing", icon: ShoppingCart },
  { name: "Payments", te: "చెల్లింపులు", path: "/payments", icon: CreditCard },
  { name: "Loading", te: "లోడింగ్", path: "/loading", icon: Truck },
  { name: "Sales", te: "అమ్మకాలు", path: "/sales", icon: Banknote },
  { name: "Sales Payments", te: "అమ్మకాల చెల్లింపులు", path: "/sales-payments", icon: CreditCard },
  { name: "Workers", te: "పనివారు", path: "/workers", icon: Users },
  { name: "Expenses", te: "ఖర్చులు", path: "/expenses", icon: Receipt },
  { name: "Reports", te: "నివేదికలు", path: "/reports", icon: FileText },
  { name: "Settings", te: "సెట్టింగులు", path: "/settings", icon: SettingsIcon },
]

export function Layout() {
  const location = useLocation()
  const [lang, setLang] = useState<"en" | "te">(
    () => (localStorage.getItem("app_lang") as "en" | "te") || "en"
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Persist language
  useEffect(() => {
    localStorage.setItem("app_lang", lang)
  }, [lang])

  const handleVoiceSearch = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert("Voice search is not supported in your browser.")
    
    const recognition = new SpeechRecognition()
    recognition.lang = lang === "te" ? "te-IN" : "en-IN"
    recognition.interimResults = false
    
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setSearchQuery(transcript)
    }
    
    recognition.start()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-card hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <h1 className="text-xl font-bold text-primary">Siva Durga Traders</h1>
        </div>
        
        {/* Welcome Section */}
        <div className="px-6 py-4 border-b bg-muted/10">
          <div className="text-sm text-muted-foreground">👋 Welcome,</div>
          <div className="text-sm font-semibold text-foreground mt-1">Gubbala</div>
          <div className="text-sm font-semibold text-foreground pl-3">Ravi Kumar</div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 flex-shrink-0 h-5 w-5",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {lang === "te" ? item.te : item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div className={cn(
        "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
        isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        {/* Backdrop overlay */}
        <div 
          className="absolute inset-0 bg-black/50" 
          onClick={() => setIsSidebarOpen(false)}
        />
        {/* Drawer Content */}
        <div className={cn(
          "absolute top-0 bottom-0 left-0 w-64 bg-card border-r flex flex-col transition-transform duration-300 ease-in-out transform",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* Drawer Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b">
            <h1 className="text-xl font-bold text-primary">Siva Durga Traders</h1>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Welcome Section */}
          <div className="px-6 py-4 border-b bg-muted/10">
            <div className="text-sm text-muted-foreground">👋 Welcome,</div>
            <div className="text-sm font-semibold text-foreground mt-1">Gubbala</div>
            <div className="text-sm font-semibold text-foreground pl-3">Ravi Kumar</div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <nav className="px-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 flex-shrink-0 h-5 w-5",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                      aria-hidden="true"
                    />
                    {lang === "te" ? item.te : item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Global Header */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 shrink-0 gap-4">
          <div className="flex items-center gap-3 shrink-0 md:hidden">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-primary whitespace-nowrap">Siva Durga Traders</span>
          </div>

          <div className="flex-1 max-w-2xl relative flex items-center min-w-0">
            <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
            <input 
              type="text" 
              placeholder={lang === "te" ? "వెతకండి..." : "Search shops, bills, workers..."} 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2 bg-muted/50 border rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
            <button 
              onClick={handleVoiceSearch}
              className={`absolute right-3 p-1.5 rounded-full ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
          <div className="hidden sm:flex flex-col items-start text-xs shrink-0 md:hidden">
            <span className="text-muted-foreground">👋 Welcome,</span>
            <span className="font-semibold text-foreground">Gubbala</span>
            <span className="font-semibold text-foreground pl-3">Ravi Kumar</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 bg-muted/20">
          <Outlet context={{ lang, setLang }} />
        </main>
      </div>
    </div>
  )
}
