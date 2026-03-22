# Windows Self-Hosting Runbook

This runbook is for serving the web frontend and Express backend from the same Windows PC.

Manual steps still required:
- Google Cloud Console: create or update the Web OAuth client
- Domainclub DNS: point the domain to your public IP
- Router and Windows Firewall: allow inbound 80 and 443

## 1. Required software

- Node.js 20+
- npm 10+
- PostgreSQL
- Caddy

## 2. Prepare environment files

Backend:

```powershell
Copy-Item packages\backend\.env.production.example packages\backend\.env
```

Web:

```powershell
Copy-Item packages\web\.env.production.example packages\web\.env.production
```

Edit the files and fill in the real values.

Backend file: [packages/backend/.env.production.example](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/packages/backend/.env.production.example)
Web file: [packages/web/.env.production.example](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/packages/web/.env.production.example)

## 3. Google Cloud Console

Use a `Web application` OAuth client and register both origins:

- `https://snow-drop.kr`
- `https://www.snow-drop.kr`

Set the same client ID in both:

- `packages/backend/.env` as `GOOGLE_CLIENT_ID_WEB`
- `packages/web/.env.production` as `VITE_GOOGLE_CLIENT_ID_WEB`

The login screen reads `VITE_GOOGLE_CLIENT_ID_WEB` in [LoginPage.tsx](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/packages/web/src/pages/LoginPage.tsx).

## 4. DNS and network

Domainclub DNS:

- `@` -> `A` -> your public IPv4
- `www` -> `CNAME` -> `snow-drop.kr`

Router port forwarding:

- `80` -> this PC -> `80`
- `443` -> this PC -> `443`

Windows Firewall:

- allow inbound `80`
- allow inbound `443`

Do not expose `3000` externally. Caddy proxies to the backend locally.

## 5. Build the app

Build and run migrations:

```powershell
npm run selfhost:build -- -RunMigrations
```

If the database is already migrated, you can skip that step:

```powershell
npm run selfhost:build
```

The helper script lives at [selfhost-build.ps1](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/scripts/selfhost-build.ps1).

## 6. Start the backend

```powershell
npm run selfhost:backend
```

If you already ran migrations in the previous step:

```powershell
npm run selfhost:backend -- -SkipMigrations
```

The helper script lives at [selfhost-start-backend.ps1](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/scripts/selfhost-start-backend.ps1).

Expected local health check:

- `http://localhost:3000/health`

## 7. Start Caddy

The ready-to-use config is [deploy/Caddyfile](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/deploy/Caddyfile).

If the repo path changes, update the `root *` line in that file.

Example:

```powershell
caddy validate --config C:\Users\Sudo\Documents\Github\JapaneseLearnApp\deploy\Caddyfile
caddy run --config C:\Users\Sudo\Documents\Github\JapaneseLearnApp\deploy\Caddyfile
```

What the Caddy config does:

- redirects `www.snow-drop.kr` to `snow-drop.kr`
- serves the built frontend from `packages/web/dist`
- proxies `/v1/*` and `/health` to `127.0.0.1:3000`
- falls back to `index.html` so React routes like `/today` and `/report` still work

## 8. Final checks

- `nslookup snow-drop.kr`
- open `https://snow-drop.kr`
- open `https://snow-drop.kr/today` and refresh the page
- open `https://snow-drop.kr/health`
- test Google login

## 9. Repo-specific notes

The current web app uses relative `/v1` API calls in [api.ts](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/packages/web/src/services/api.ts), so same-domain reverse proxying is the right production shape.

Current backend CORS handling in [index.ts](c:/Users/Sudo/Documents/Github/JapaneseLearnApp/packages/backend/src/index.ts) is still localhost-oriented. Same-origin requests through Caddy should work, but if you later split the API onto another origin or expose the backend to mobile clients directly, add environment-driven CORS settings first.
