# GrindCTRL — Deployment Guide

> **Canonical production app:** `apps/web-next/` (Next.js 15)
> **Domain:** `https://grindctrl.cloud`
> **Hosting:** Hostinger VPS (standalone Node.js behind Nginx)

---

## Architecture

```
grindctrl.cloud  (Hostinger DNS → VPS IP)
      │
      ▼
  Nginx (port 80/443, SSL via Let's Encrypt)
      │
      ▼
  Next.js 15 — apps/web-next (port 3000, pm2)
      │
      ├── Public landing  (/)
      ├── Auth routes (/sign-in, /sign-up) — Clerk
      └── Dashboard (/dashboard/**) — Clerk-protected
            │
            └── Supabase (egvdxshlbcqndrcnzcdn)
                  workspace/widget data layer (RLS)
```

---

## Prerequisites (VPS)

| Requirement | Minimum | Notes |
|---|---|---|
| OS | Ubuntu 22.04 LTS | Standard Hostinger VPS |
| Node.js | >= 18.17 | Required for Next.js 15. Use `nvm` or `nodesource` |
| npm | >= 9 | Ships with Node.js 18+ |
| pm2 | Latest | Process manager: `npm install -g pm2` |
| Nginx | Latest | Reverse proxy + SSL termination |
| Certbot | Latest | Let's Encrypt SSL: `apt install certbot python3-certbot-nginx` |
| Git | Latest | For pulling repo updates |

---

## Environment Variables

Create `/root/grindctrl-booking/apps/web-next/.env.local` on the VPS with:

```env
# App URL (production)
NEXT_PUBLIC_APP_URL="https://grindctrl.cloud"

# Clerk Authentication (use pk_live_ for production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxxxx"
CLERK_SECRET_KEY="sk_live_xxxxx"

# Supabase (production project)
NEXT_PUBLIC_SUPABASE_URL="https://egvdxshlbcqndrcnzcdn.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-production-anon-key"
```

> **IMPORTANT:** Use `pk_live_` and `sk_live_` Clerk keys for production.
> The `.env.example` shows `pk_test_` — that is for local development only.
> Never commit `.env.local` to the repository.

---

## Deploy Script (`deploy-next.sh`)

The GitHub Actions workflow (`deploy-next.yml`) expects this script at:

```
/root/grindctrl-next/deploy-next.sh
```

### Recommended script contents

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/root/grindctrl-booking"
APP_DIR="$REPO_DIR/apps/web-next"
PM2_NAME="grindctrl-web"

echo "==> Pulling latest code..."
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> Installing dependencies..."
cd "$APP_DIR"
npm ci --production=false

echo "==> Building Next.js..."
npm run build

echo "==> Restarting pm2..."
pm2 restart "$PM2_NAME" || pm2 start .next/standalone/server.js \
  --name "$PM2_NAME" \
  -- -H 0.0.0.0 -p 3000

pm2 save

echo "==> Deploy complete!"
```

Make it executable:

```bash
chmod +x /root/grindctrl-next/deploy-next.sh
```

### First-time pm2 setup

```bash
cd /root/grindctrl-booking/apps/web-next
npm ci
npm run build

# Copy static assets for standalone mode
cp -r public .next/standalone/apps/web-next/public 2>/dev/null || true
cp -r .next/static .next/standalone/apps/web-next/.next/static

# Start with pm2
pm2 start .next/standalone/server.js --name grindctrl-web -- -H 0.0.0.0 -p 3000
pm2 save
pm2 startup  # Generates the systemd hook for reboot persistence
```

---

## Nginx Configuration

Create `/etc/nginx/sites-available/grindctrl.cloud`:

```nginx
server {
    listen 80;
    server_name grindctrl.cloud www.grindctrl.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name grindctrl.cloud www.grindctrl.cloud;

    ssl_certificate     /etc/letsencrypt/live/grindctrl.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/grindctrl.cloud/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and test:

```bash
ln -sf /etc/nginx/sites-available/grindctrl.cloud /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### SSL setup (Let's Encrypt)

```bash
certbot --nginx -d grindctrl.cloud -d www.grindctrl.cloud
```

Certbot auto-renews via systemd timer. Verify with `certbot renew --dry-run`.

---

## DNS Configuration (Hostinger)

In the Hostinger DNS zone for `grindctrl.cloud`:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `<VPS_IP_ADDRESS>` | 3600 |
| A | `www` | `<VPS_IP_ADDRESS>` | 3600 |

> **Verify:** After DNS propagation, `dig grindctrl.cloud +short` should return your VPS IP.
> If it returns a GitHub Pages IP (e.g., `185.199.x.x`), DNS has not been migrated yet.

---

## GitHub Actions Workflow

### `deploy-next.yml` — VPS deploy

- **Trigger:** Push to `main` when `apps/web-next/**` changes
- **Action:** SSH into VPS → stash local changes → run `deploy-next.sh`
- **Required GitHub Secrets:**

| Secret | Description |
|---|---|
| `VPS_HOST` | VPS IP address or hostname |
| `VPS_SSH_KEY` | Private SSH key (PEM format) |
| `VPS_USER` or `VPS_USERNAME` | SSH user (defaults to `root`) |
| `VPS_SSH_PASSPHRASE` | SSH key passphrase (if set) |
| `VPS_PASSWORD` | VPS password (fallback auth) |

### `static.yml` — Legacy GitHub Pages deploy

- **Trigger:** Push to `main` (all paths) + pull requests
- **Action:** Builds root Vite app (`src/`) → deploys `dist/` to GitHub Pages
- **Status:** Still active. Deploys the legacy static site.

> **RECOMMENDATION:** Once `grindctrl.cloud` DNS is confirmed pointing to VPS,
> consider scoping `static.yml` to `paths: ['src/**']` or disabling it entirely
> to avoid confusion between two parallel deploys.

---

## Verification Checklist

### Before first deploy

- [ ] VPS has Node.js >= 18.17 installed (`node --version`)
- [ ] VPS has pm2 installed globally (`pm2 --version`)
- [ ] VPS has Nginx installed and running (`systemctl status nginx`)
- [ ] `/root/grindctrl-next/deploy-next.sh` exists and is executable
- [ ] `/root/grindctrl-booking/apps/web-next/.env.local` has production values
- [ ] `.env.local` uses `pk_live_` Clerk key (not `pk_test_`)
- [ ] DNS A records for `grindctrl.cloud` point to VPS IP
- [ ] SSL certificate obtained via Certbot
- [ ] Nginx config tested (`nginx -t`)
- [ ] GitHub Secrets set: `VPS_HOST`, `VPS_SSH_KEY`, `VPS_USER`

### After deploy

- [ ] `curl -sI https://grindctrl.cloud` returns 200
- [ ] Homepage loads at `https://grindctrl.cloud/`
- [ ] Sign-in works at `https://grindctrl.cloud/sign-in`
- [ ] Dashboard redirects to sign-in when unauthenticated
- [ ] Dashboard loads after sign-in at `https://grindctrl.cloud/dashboard/overview`
- [ ] `pm2 status` shows `grindctrl-web` as `online`

---

## Rollback

If a deploy breaks production:

```bash
# On VPS
cd /root/grindctrl-booking
git log --oneline -5           # Find the last good commit
git reset --hard <commit-sha>  # Revert to it

cd apps/web-next
npm ci
npm run build
pm2 restart grindctrl-web
```

---

## Dockerfile (alternative)

A Dockerfile exists at `apps/web-next/Dockerfile` for containerized deployment.
It is **not currently used** by the deploy pipeline but can be used for:

- Local testing: `docker build -t grindctrl-web -f Dockerfile ../.. && docker run -p 3000:3000 grindctrl-web`
- Future migration to Docker/Kubernetes

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Deploy script not found` in CI | `/root/grindctrl-next/deploy-next.sh` missing | Create the script (see above) |
| Site shows GitHub Pages content | DNS still points to GitHub Pages | Update DNS A records |
| 502 Bad Gateway | Next.js not running on port 3000 | `pm2 restart grindctrl-web` or check logs |
| Clerk auth fails in production | Using test key instead of live key | Update `.env.local` with `pk_live_` key |
| SSL certificate error | Certbot not configured | Run `certbot --nginx -d grindctrl.cloud` |
| `npm run build` fails on VPS | Old Node.js version | Upgrade to Node.js 18.17+ |
