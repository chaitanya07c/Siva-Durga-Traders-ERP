# Changelog - Siva Durga Traders ERP

All notable changes and upgrades made to the Siva Durga Traders ERP system up to the official **Version 1.0 Production Release**.

---

## [1.0.0] - 2026-07-15

### Added
- **Sales Payments Workflow**: Added a completely new, decoupled payment tracking system for client sales. Handles partial settlements, updates balances, groups invoices by buyer, and triggers combined PDF outputs post-completion.
- **Dedicated PDF Utilities**: Created `salesPdfUtils.ts` to manage multi-invoice document styling and WhatsApp messaging independently from supplier PDF routines.
- **Language Persistence Settings**: Introduced a professional language selection menu inside the Settings interface, using a persistent `localStorage` mechanism.
- **Loading Completion Modal**: Integrated a full-screen React state-based modal for completing loading workflows, replacing browser prompts with form validation.
- **Optimized SQL Setup**: Consolidated the database definition script (`schema_final.sql`) and mock data seed (`seed_final.sql`) to clean up historical migrations.

### Changed
- **Header Clean Up**: Removed the language toggle from the main header and relocated it under Settings.
- **Sales Flow Enforcement**: Enforced that all created Sales invoices automatically set `payment_status` to `Pending` and defer export options to the Sales Payments pipeline.

### Fixed
- **Sales Database Schema Mismatch**: Fixed a PostgREST schema cache bug (`PGRST204`) by adding missing `items`, `payment_status`, `remarks`, and `invoice_number` columns.
- **Loading Module Refresh Bug**: Fixed a bug where marking a loading transaction as complete did not instantly refresh the active page list.
- **TypeScript & Build Configuration**: Cleaned up various dead imports and restored standard Lucide package elements to achieve zero compilation failures.
