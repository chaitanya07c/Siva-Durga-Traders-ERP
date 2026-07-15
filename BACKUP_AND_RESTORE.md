# Database Backup and Restore Guide

This guide details how to perform backups and restores for the Siva Durga Traders ERP system hosted on Supabase.

---

## 💾 Method 1: Exporting / Importing Data via Supabase Dashboard (No Setup Required)

### How to Back Up Data (Export)
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Navigate to the **Table Editor** page.
3. Select a table (e.g., `shops`, `materials`, `purchases`, `sales`, `employees`, etc.).
4. Click the **Export** button at the top-right of the table grid.
5. Select **Export to CSV**.
6. Repeat this process for all tables containing critical business data.

### How to Restore Data (Import)
1. Ensure your database tables are created by executing [schema_final.sql](file:///c:/Users/chait/OneDrive/Documents/Siva%20Durga%20Traders/supabase/schema_final.sql) in the **SQL Editor**.
2. Go to the **Table Editor**.
3. Choose the target table you want to restore.
4. Click **Insert** -> **Import data from CSV**.
5. Upload the CSV file backed up earlier.

---

## 🛠 Method 2: Automated CLI Backup & Restore (For System Administrators)

To use command-line backups, make sure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed.

### Backing Up the Full Database (Schema + Data)
Execute the following command in your terminal, replacing `<project-id>` with your Supabase project reference ID:
```bash
supabase db dump --project-ref <project-id> -f full_backup.sql
```
*Note*: This captures all database states, schemas, RLS policies, and tables into a single SQL script.

### Restoring the Database
To apply the backup dump to a fresh Supabase database instance:
```bash
supabase db push --project-ref <project-id> -f full_backup.sql
```
Alternatively, you can copy the contents of `full_backup.sql` and run it as a script in the SQL Editor.
