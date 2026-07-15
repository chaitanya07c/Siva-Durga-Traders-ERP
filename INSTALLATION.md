# Installation & Setup Guide

This guide details how to install, configure, and launch the Siva Durga Traders ERP system in a local development environment or deploy it to production.

## Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Supabase Account**: A free or paid Supabase workspace to host the PostgreSQL database.

---

## 1. Database Setup (Supabase)

1. **Create a New Project**:
   Log in to [Supabase](https://supabase.com), go to the Dashboard, and click **New Project**. Note down your **Database Password**.

2. **Run Final Database Schema**:
   - Navigate to the **SQL Editor** in the left menu of the Supabase dashboard.
   - Click **New Query**.
   - Copy the contents of the final consolidated schema file: [schema_final.sql](file:///c:/Users/chait/OneDrive/Documents/Siva%20Durga%20Traders/supabase/schema_final.sql)
   - Paste the SQL code into the editor and click **Run**.

3. **Run Final Seed Data** (Optional):
   - To populate the database with default materials, default buyers, seed shops, and rates:
   - Create another new query in the SQL Editor.
   - Copy the contents of [seed_final.sql](file:///c:/Users/chait/OneDrive/Documents/Siva%20Durga%20Traders/supabase/seed_final.sql).
   - Paste and click **Run**.

4. **Obtain API Keys**:
   - Go to **Project Settings** -> **API**.
   - Copy the **Project URL** and the **anon public API Key**.

---

## 2. Local Code Configuration

1. **Clone or Copy Codebase**:
   Ensure all files are placed in your working directory.

2. **Create Environment Configuration**:
   - In the root of the project, create a new file named `.env`.
   - Add the following variables using your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
     VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
     ```

3. **Install Dependencies**:
   Open a terminal in the root folder and run:
   ```bash
   npm install
   ```

---

## 3. Launching the App

### For Development (Local Server)
To run the local development server with hot-reloading:
```bash
npm run dev
```
The application will launch on `http://localhost:5173`.

### For Production Build
To test or build the optimized production package:
```bash
npm run build
```
This builds static assets into the `dist/` folder, which can be deployed to static hosting providers like Netlify, Vercel, or GitHub Pages.
