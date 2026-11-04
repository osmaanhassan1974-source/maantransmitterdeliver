# Netlify and Supabase deployment

This project is prepared to deploy its existing Express API as Netlify Functions and its static login/dashboard assets as a restricted `dist/` site. Application records and database backups are stored in Supabase; the function filesystem is never used for persistent business data.

## 1. Prepare Supabase

1. Open the Supabase project and go to **SQL Editor**.
2. Run the contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. In Supabase **Project Settings → API**, copy the project URL and the server-side `service_role` secret. Do not use the publishable/anon key, place the secret in frontend code, or commit it.

## 2. Migrate the current local records

Run this from the existing project folder, on the computer that contains `data/database.json`:

1. Create a local `.env` file with:

   ```text
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_SECRET
   ```

2. Run:

   ```powershell
   npm install
   npm run migrate:supabase
   ```

The script refuses to overwrite an existing Supabase database unless `--replace` is explicitly supplied. It copies the current user records, hashed passwords, and application data; it does not edit or remove the local database. Keep a separate offline copy of `data/database.json` before migration.

## 3. Publish through Netlify

1. Create an **empty private** GitHub repository.
2. From the project folder, publish only the ignored-safe source:

   ```powershell
   git init
   git add .
   git status --short
   git commit -m "Prepare Netlify deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
   git push -u origin main
   ```

   Before committing, confirm `data/database.json`, `data/backups`, `.env`, and `node_modules` do not appear in `git status --short`. `.gitignore` excludes them.
3. In Netlify, choose **Add new site → Import an existing project** and connect that private repository. Netlify reads [`netlify.toml`](./netlify.toml) and runs the safe asset build automatically.
4. In **Site configuration → Environment variables**, add:
   - `SUPABASE_URL` — the project URL used for migration
   - `SUPABASE_SERVICE_ROLE_KEY` — the same server-only secret used for migration
   - `JWT_SECRET` — a newly generated random secret of at least 32 characters
   - `NODE_ENV=production`
5. Trigger the first deploy. Open the generated Netlify URL and sign in with an existing migrated account.

Generate a JWT secret locally without printing any existing project secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste that output directly into Netlify's environment-variable form; do not put it in `app.js`, `index.html`, or a committed file. After deploying, check the Netlify function logs for the scheduled backup and month-closing functions. They run in Mogadishu time: automatic backups daily and monthly closing shortly after the local calendar month changes.

## Operational notes

- The first deployment requires the Supabase SQL and local migration steps above. Without those, the API intentionally reports that its database has not been initialized.
- All API reads and writes use a versioned Supabase JSON document. Concurrent writes are guarded; if another function instance updates at the same time, the request returns a retryable conflict instead of silently overwriting newer records.
- Admin backup files are private objects in the Supabase `database-backups` storage bucket.
- Netlify Functions have request/response size limits. If the application's JSON database grows beyond Netlify's function payload limits, move to a normalized Supabase schema or host the Express server on a persistent Node service before that point.
- `ADMIN_INITIAL_PASSWORD` is only used when the local server creates its first administrator. The migrated production users are preserved; existing passwords are not changed by deployment.
