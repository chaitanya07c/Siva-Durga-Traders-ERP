import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "./components/Layout"
import { Dashboard } from "./pages/Dashboard"
import { Shops } from "./pages/Shops"
import { Purchasing } from "./pages/Purchasing"
import { Payments } from "./pages/Payments"
import { Sales } from "./pages/Sales"
import { Workers } from "./pages/Workers"
import { Loading } from "./pages/Loading"
import { Reports } from "./pages/Reports"
import { Settings } from "./pages/Settings"
import { SalesPayments } from "./pages/SalesPayments"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="shops" element={<Shops />} />
          <Route path="purchasing" element={<Purchasing />} />
          <Route path="payments" element={<Payments />} />
          <Route path="sales" element={<Sales />} />
          <Route path="sales-payments" element={<SalesPayments />} />
          <Route path="loading" element={<Loading />} />
          <Route path="workers" element={<Workers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </Router>
  )
}

export default App
