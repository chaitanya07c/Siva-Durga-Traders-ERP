# Siva Durga Traders ERP - User Manual

This manual provides an operational guide for managing all modules inside the Siva Durga Traders ERP system.

---

## ⚙️ Navigation & Global Settings
- **Sidebar**: Toggle between different functional modules of the business.
- **Language Selection**:
  1. Navigate to **⚙️ Settings** in the sidebar.
  2. Locate the **🌐 Language** card.
  3. Select **English** or **తెలుగు** from the dropdown. 
  4. The application state updates instantly and persists across reloads.

---

## 🏪 Shop Details & Rates
- **Shop Types**: The system classifies supplier shops into `Wine`, `Akividu Wine`, and `Iron`.
- **Custom Rates**:
  1. Go to **Shop Details**.
  2. Click **Add New Shop** or edit an existing one.
  3. Enter custom pricing rates per material brand (e.g., Kingfisher Red, Budweiser, White Glass) in the pricing grid. These custom rates automatically auto-fill whenever you write purchasing bills for this shop.

---

## 🛒 Purchasing & Supplier Payments
### Saving a Bill
1. Go to **Purchasing**.
2. Select a Shop. The system automatically pulls any outstanding balance (Previous Balance) and custom rates.
3. Input quantities for materials. The grand total auto-calculates.
4. Input any advance paid.
5. Click **Save Bill**.
   - If you want to bundle multiple bills under one transaction, click **➕ Another Bill** and enter the next invoice details before closing.
   - If you want to start a clean session for a new shop, click **➕ Another Shop Bill**.

### Payments (Pending & Completed)
1. Go to **Payments**.
2. **Pending Tab**: Displays sessions grouped by Shop/Session ID.
   - Click **View Details** to check individual bills, items list, and rates.
   - Click **Complete Payment** to record settlements. Enter the **Amount Received** to calculate the outstanding balance.
     - **Save Partial Payment**: Retains the session in Pending while keeping the balance current.
     - **Complete Payment**: Marks the session as finished and immediately redirects you to download, print, or WhatsApp the receipt.
3. **Completed Tab**: Groups historically paid invoices by shop. Allows you to view details or export bills.

---

## 🚚 Loading Workflow
1. **Preparing Loading**:
   - In **Shop Details**, tick **"Mark for Tomorrow Loading"** on the shops scheduled for loading.
2. **Pending Loading Tab**:
   - Navigate to **Loading** in the sidebar. You will see two tabs: **Pending Loading** and **Completed Loading**.
   - Under the **Pending Loading** tab, marked shops will appear categorized by type (Wine, Akividu Wine, Iron, Public).
3. **Completing Loading**:
   - Click **✅ Complete** next to a pending shop in the grid.
   - A React Modal opens. Enter the **Purchase Amount** and **Bill Number**.
   - Click **Save**. The shop immediately vanishes from the Pending Loading tab and populates inside the **Completed Loading** tab.
4. **Completed Loading Tab**:
   - View history of completed loading sessions sorted chronologically.
   - Filter records by date, type, or search term (shop name, bill number).
   - Export reports to PDF or Print directly from the toolbar.

---

## 💰 Sales & Sales Payments
### Recording a Sale
1. Go to **Sales**.
2. Search and select a **Buyer / Factory** (or add a new one on the fly).
3. Input Date and add items with their respective quantities and rates.
4. Click **Save Invoice**. 
   - The invoice automatically generates a unique ID (`INV-...`) and is initialized as `Pending`.
   - *Note*: Immediate exports are disabled at this stage; they occur once payments are handled.

### Sales Payments Workflow
1. Go to **💰 Sales Payments** (located below Sales).
2. Invoices are grouped dynamically by the **Buyer's Name**.
3. **Receive Payment**:
   - Click **Receive Payment** to open the settlement popup.
   - Input the amount received. Click **Save Partial Payment** or **Complete Payment**.
   - Upon completion, download the consolidated multi-invoice PDF, print it, or share it on WhatsApp.
4. **Completed Sales Payments**: Displays fully cleared buyer profiles. Click **View Details** to review the history.

---

## 👥 Workers & Attendance
- **Workers Directory**: Register workers with roles and daily wage levels.
- **Attendance Registry**:
  1. Open **Workers** -> **Attendance**.
  2. Mark workers as Present, Absent, or Half-day.
  3. The daily payroll logs update automatically.
