# Siva Durga Traders ERP

A premium, state-of-the-art enterprise resource planning (ERP) system custom-built for **Siva Durga Traders** to streamline inventory management, purchasing flows, supplier settlements, loading workflows, sales operations, client billing, and worker payroll management.

## 🚀 Key Features

- **Shop Details & Rates**: Maintain a centralized registry of supplier shops (Wines, Akividu Wines, Iron) with custom item-specific pricing rates.
- **Purchasing workflow**: Record incoming purchase bills, manage previous balance calculations, and trace transactions with a distinct purchase session key.
- **Supplier Payments**: Manage pending settlements, log partial payments, track outstanding balances, and mark completions.
- **Loading Module**: Seamless workflow to mark shops for tomorrow's loading, view pending loadings, complete loadings via custom React modals, and view completed logs.
- **Sales & Invoices**: Generate professional sales invoices with unique tracking numbers (`INV-...`) and consolidate items using efficient JSON structures.
- **Sales Payments**: Decoupled tabbed payment tracking (Pending & Completed) for buyers. Supports partial payments, auto-balance calculation, and post-completion receipts.
- **Export & Shares**: Seamless, premium jsPDF engine to Download PDF, Print, or Share statements directly on WhatsApp.
- **Worker Management**: Track daily attendance, log wage parameters, and view historic payroll.
- **Language Settings**: Switch seamlessly between English and తెలుగు, persisted across browser sessions via `localStorage`.

## 🛠 Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: TailwindCSS, Lucide React (Icons)
- **Database / API**: Supabase (PostgreSQL), PostgREST REST API
- **Document Engine**: jsPDF, jsPDF-AutoTable
- **Build Tool**: Vite v8

## 📂 Project Structure

```
Siva Durga Traders/
├── src/
│   ├── components/       # Layout and global React components
│   ├── lib/              # Supabase Client, PDF and Sales PDF helper utilities
│   ├── pages/            # Core views (Dashboard, Shops, Workers, Loading, Sales, etc.)
│   ├── types/            # Database type mappings and TypeScript models
│   ├── App.tsx           # Global routing setup
│   └── main.tsx          # Application entry point
├── supabase/
│   ├── schema_final.sql  # Consolidated production database schema
│   ├── seed_final.sql    # Consolidated production seed data
│   └── migrations/       # Archive migrations
├── package.json          # Dependency configurations
├── tsconfig.json         # TypeScript rules configuration
└── vite.config.ts        # Vite configuration
```
