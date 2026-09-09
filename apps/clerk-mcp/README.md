# GRINDCTRL Clerk MCP

Small HTTP MCP server for Clerk Backend API access.

## Local Run

```bash
cd apps/clerk-mcp
cp .env.example .env
npm install
npm start
```

Endpoint:

```text
http://localhost:3031/mcp
```

## Environment

Do not commit real secrets.

```env
CLERK_SECRET_KEY=sk_live_replace_me
CLERK_MCP_ALLOW_MUTATIONS=true
CLERK_MCP_API_BASE=https://api.clerk.com
CLERK_MCP_ACCESS_TOKEN=replace_me_with_a_long_random_token
PORT=3031
```

`CLERK_MCP_ALLOW_MUTATIONS=true` enables full access for `POST`, `PATCH`, `PUT`, and `DELETE` calls.

`CLERK_MCP_ACCESS_TOKEN` gates every `/mcp` and `/clerk` call behind `Authorization: Bearer <token>`.
**Required in production** — with it unset, the server refuses all MCP requests rather than
serving them unauthenticated. Generate one with `openssl rand -hex 32`. `/healthz` stays open
(no secrets in its response).

## Production Shape

Recommended URL:

```text
https://mcp.grindctrl.cloud/clerk
```

Nginx should proxy `/clerk` to the local service `/mcp`:

```nginx
location /clerk {
  proxy_pass http://127.0.0.1:3031/mcp;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Client Config

```json
{
  "mcpServers": {
    "clerk-mcp-server": {
      "url": "https://mcp.grindctrl.cloud/clerk",
      "headers": {
        "Authorization": "Bearer <same value as CLERK_MCP_ACCESS_TOKEN>"
      }
    }
  }
}
```
