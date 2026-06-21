# Mabl Power Portal — Deployment Package

A static site (the portal) plus a proxy that connects the in-page chat to the
Anthropic API with the **Lilly Cortex MCP server** attached.

## What's in here

```
mabl-portal/
├── public/                 ← the website (static files — deploy these)
│   ├── index.html          ← the portal (agent wiring already applied)
│   └── config.js           ← the ONLY file you edit per environment
└── proxy/                  ← backend between browser and Anthropic/Cortex
    ├── server.js           ← Express proxy
    └── package.json
```

## How the chat connects to your agent

The chat reads `CORTEX_PROXY_URL` and `CORTEX_SYSTEM` from `config.js`, then on
each turn it `POST`s the running conversation to the proxy:

```
POST {CORTEX_PROXY_URL}   { system, messages:[{role,content}, ...] }
```

The proxy holds the Anthropic API key server-side, calls the Anthropic Messages
API with the Cortex MCP server attached, and returns the **raw Anthropic
response**. The frontend pulls the text out of the `content[]` array, escapes
it, and converts newlines to `<br>`. It keeps `cortexHistory` so the
conversation is multi-turn.

If the proxy is unreachable, the chat automatically falls back to a built-in
offline knowledge base — so it never looks broken during demos or sharing.

## Configure (the only required step)

Edit `public/config.js`:

```js
window.PORTAL_CONFIG = {
  CORTEX_PROXY_URL: '/api/chat',     // same-origin is best (SSO cookies)
  CORTEX_SYSTEM:    '...system prompt...'
};
```

Use a **same-origin** path (`/api/chat`) if the site and proxy are served under
one host — the SSO cookie then flows with the request (`credentials:'include'`
is already set). Use a full `https://host.lilly.com/api/chat` URL only if
they're on different origins, and then set `SITE_ORIGIN` on the proxy so CORS
allows credentialed requests.

## Run the proxy

```
cd proxy
npm install
ANTHROPIC_API_KEY='sk-ant-...' \
CORTEX_MCP_URL='https://<cortex-mcp-host>/mcp' \
CORTEX_MCP_TOKEN='<token-if-gated>' \
npm start            # listens on :3001
```

Environment variables:

| Var | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key (server-side only — never ship to the browser) |
| `CORTEX_MCP_URL` | yes | Lilly Cortex MCP server URL |
| `CORTEX_MCP_NAME` | no | MCP server name (default `lilly-cortex`) |
| `CORTEX_MCP_TOKEN` | no | Auth token if the MCP server is gated |
| `MODEL` | no | Anthropic model (default `claude-sonnet-4-6`) |
| `MAX_TOKENS` | no | Max response tokens (default 1500) |
| `PORT` | no | Proxy port (default 3001) |
| `SITE_ORIGIN` | no | Set ONLY if site & proxy are different origins (enables CORS) |

> Confirm the exact Cortex MCP URL / auth with your Cortex owner. The default
> URL in `server.js` is a placeholder.

## Deploying on CATS

CATS specifics vary by team — confirm with your CATS owner — but the general
path is:

1. **Static site** — upload the contents of `public/` (`index.html`,
   `config.js`) to your CATS static-hosting target. Plain files, no build step.
2. **Proxy** — deploy `proxy/` as a Node service (Node 18+). Provide
   `ANTHROPIC_API_KEY`, `CORTEX_MCP_URL`, and any token as CATS
   secrets / env vars — never hardcode them.
3. **Same origin** — route the site and `/api/chat` through one hostname so the
   Lilly SSO cookie is sent with chat requests. To serve both from the proxy
   itself, uncomment the `express.static(...)` lines in `server.js`. If they
   must be separate origins, set `SITE_ORIGIN` to the exact site origin.
4. **Verify** — load the site, open the chat (✨), ask "how to do mobile
   testing", and confirm a Cortex-grounded answer comes back. Kill the proxy
   and confirm it falls back to the offline KB.

## Local smoke test

```
# terminal 1 — proxy
cd proxy && npm install && ANTHROPIC_API_KEY=... CORTEX_MCP_URL=... npm start

# terminal 2 — site
cd public && python3 -m http.server 5500
# open http://localhost:5500, leave CORTEX_PROXY_URL as the localhost default
```
