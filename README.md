# Calculation Racer — Multiplayer Brain Racing Game

Calculation Racer is a responsive, light-theme casual multiplayer brain-racing web game where players solve **Mathematics**, **General Knowledge**, **Science**, and verified **Current Affairs** questions to propel their car across a 100-meter finish line.

---

## 1. Core Features & Rules

- **Completely Separated Single-Player & Multiplayer Flows**:
  - **Play Game (Single-Player Only)**: Clean, compact dropdown setup card with 6 settings:
    1. **Game Category**: Mathematics, General Knowledge, Science, Current Affairs.
    2. **Difficulty**: Easy, Medium, Hard.
    3. **Question Selection**: Dynamic category-specific subcategories/operations (e.g., Addition, Subtraction, Multiplication, Division, Mixed Operations for Mathematics; Physics, Chemistry, Biology, Space for Science; Geography, History, Sports, Computers, General Facts for General Knowledge; India, World, Science and Technology, Sports for Current Affairs).
    4. **Number of Questions**: 10, 15, or 20.
    5. **Time per Question**: 10, 15, 20, or 30 seconds.
    6. **Sound Effects**: On or Off.
  - **Create Room / Join Room (Multiplayer)**: Dedicated 2-player and 4-player rooms with 6-character invite codes (`/?room=ABCDEF`), live lobby ready states, synchronized countdown, and real-time car positions.
- **No Repeated Questions Within or Across Games**:
  - Within any race, questions are strictly deduplicated by ID and normalized text.
  - Across games, seen question IDs are tracked in `/question_history/{uid}_{questionId}` (and `localStorage` for guest play) so future races prioritize unseen questions and automatically recycle the pool only after all eligible questions in a category/difficulty have been shown.
- **Private Admin Panel (`/admin`)**:
  - The Admin link is completely hidden from normal users and guests in the navigation bar, profile menu, and footer.
  - Direct navigation to `/admin` is protected by both frontend route guards and backend security rules (`firestore.rules` and PostgreSQL RLS) plus a one-time owner bootstrap lock (`/system_config/admin_bootstrap`).
- **Social Sharing & Visual Score Cards**:
  - **Multiplayer Room Invites**: Copy Room Code, Copy Join Link (`/?room=ABCDEF`), WhatsApp, Telegram, Instagram, Facebook, X/Twitter, and native mobile share (`navigator.share`).
  - **Post-Race Score Sharing**: Generates a downloadable/shareable **1080×1350 PNG Score Card** on HTML5 Canvas showing player nickname, score, accuracy, time, placement, category/difficulty, and the live public URL.

---

## 2. Database Setup (Firebase & Supabase / PostgreSQL)

### A. AI Studio Provisioned Firebase (Active by Default)
1. Authentication and real-time synchronization are configured via `firebase-applet-config.json`.
2. Zero-Trust security rules are defined in `firestore.rules` (covering `/profiles`, `/users_private`, `/admins`, `/system_config`, `/questions`, `/question_keys`, `/question_history`, `/rooms`, `/race_results`, `/question_reports`, and `/admin_audit_logs`) and validated with `@firebase/eslint-plugin-security-rules`.

### B. Supabase / PostgreSQL Setup
1. Create a free project at [https://supabase.com](https://supabase.com).
2. Open **SQL Editor → New Query** and run `supabase/migrations/0001_calculation_racer_schema.sql`.
3. Copy your project URL and anon public key into `.env` (using `.env.example` as a template).

---

## 3. Assigning the Owner Administrator Securely

Never hardcode admin passwords in frontend code.
- **In Firebase Firestore**: The verified owner account (`rizveemanger@gmail.com` with `email_verified == true`) automatically claims `/system_config/admin_bootstrap` and `/admins/{uid}` on first sign-in. Additional admins can be added in `/admins/{userUid}`.
- **In Supabase PostgreSQL**: Run in the Supabase SQL Editor after signing in once:
  ```sql
  update public.profiles
     set is_admin = true
   where id = '<YOUR_AUTH_USER_UUID>';
  ```

---

## 4. Step-by-Step Free Deployment Guide

### Option A: Vercel / Netlify / Cloudflare Pages (Recommended Free Static Hosting)
1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the project into **Vercel**, **Netlify**, or **Cloudflare Pages**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Set your environment variables in the hosting dashboard:
   - `VITE_PUBLIC_GAME_URL`: Your live HTTPS domain (e.g., `https://calculation-racer.vercel.app`)
   - `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` (if using Supabase)
4. SPA routing is pre-configured via `vercel.json` (for Vercel) and `public/_redirects` (for Netlify / Cloudflare Pages), so `/admin` and `/?room=ABCDEF` links work automatically.
5. Add your deployed domain to **Authorized Domains** in Firebase Console (`Authentication → Settings → Authorized domains`) or **Redirect URLs** in Supabase (`Authentication → URL Configuration`).

### Option B: InfinityFree Static Frontend Hosting
1. Run `npm install && npm run build` locally to generate the `dist/` folder.
2. Upload the contents of `dist/` into `htdocs/` in the InfinityFree Online File Manager or via FTP.
3. Add an `.htaccess` file in `htdocs/` to route `/admin` and `/?room=ABCDEF` to `index.html`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
