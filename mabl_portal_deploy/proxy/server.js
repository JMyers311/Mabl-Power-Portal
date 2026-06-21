/* ============================================================
   Mabl Power Portal — Cortex proxy
   ------------------------------------------------------------
   Why this exists: the browser must NOT hold the Anthropic API key or
   call the Anthropic API directly. This proxy keeps the key server-side,
   attaches the Lilly Cortex MCP server, and returns the raw Anthropic
   response that the frontend's askBackend() already knows how to parse.

   Flow:  browser  ->  this proxy  ->  Anthropic API (+ Cortex MCP)
                    <-             <-

   Contract the frontend sends:
     POST /api/chat   { system, messages:[{role,content}] }
   Response: the raw Anthropic Messages response (has a `content` array).

   Run:
     npm install
     ANTHROPIC_API_KEY=sk-ant-...  CORTEX_MCP_URL=https://...  npm start
   ============================================================ */

const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT            = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL           = process.env.MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS      = parseInt(process.env.MAX_TOKENS || '1500', 10);
const SITE_ORIGIN     = process.env.SITE_ORIGIN || '';  // set only if site & proxy differ in origin

// Lilly Cortex MCP server — attached to every Anthropic call so the model
// can use Cortex tools. Provide the URL (and auth token if Cortex requires one).
const CORTEX_MCP_URL   = process.env.CORTEX_MCP_URL || 'https://cortex-mcp.0dnfez5s.tunnel.anthropic.com/mcp';
const CORTEX_MCP_NAME  = process.env.CORTEX_MCP_NAME || 'lilly-cortex';
const CORTEX_MCP_TOKEN = process.env.CORTEX_MCP_TOKEN || ''; // if the MCP server is gated

if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY env var');
  process.exit(1);
}

// CORS — only needed when the static site is on a different origin than this
// proxy. Serve both from one origin (recommended) and this is a no-op.
app.use((req, res, next) => {
  if (SITE_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN); // exact origin, never *
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function cortexMcpServer() {
  const s = { type: 'url', url: CORTEX_MCP_URL, name: CORTEX_MCP_NAME };
  if (CORTEX_MCP_TOKEN) s.authorization_token = CORTEX_MCP_TOKEN;
  return s;
}

app.post('/api/chat', async (req, res) => {
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // required header to enable MCP connector usage
        'anthropic-beta': 'mcp-client-2025-04-04'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: system || undefined,
        messages,
        mcp_servers: [cortexMcpServer()]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('Anthropic error', r.status, data);
      return res.status(502).json({ error: (data && data.error && data.error.message) || 'upstream error' });
    }
    // Return the raw Anthropic response; the frontend pulls text from content[].
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'proxy failure' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Optional: serve the static site from this same service (cleanest for SSO).
// const path = require('path');
// app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => console.log(`Cortex proxy on :${PORT} (model ${MODEL}, mcp ${CORTEX_MCP_NAME})`));
