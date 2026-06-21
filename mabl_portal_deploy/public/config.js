/* ============================================================
   Mabl Power Portal — runtime config
   ------------------------------------------------------------
   The ONLY file you edit per environment. No build step.
   Change the URL, redeploy, done.
   ============================================================ */
window.PORTAL_CONFIG = {

  // The proxy endpoint the chat calls. The proxy holds the Anthropic API
  // key server-side and forwards to the Anthropic API with the Lilly Cortex
  // MCP server attached. It must accept:
  //     POST { system, messages:[{role,content}] }
  // and return the raw Anthropic response (with a `content` array).
  //
  //   Local demo : 'http://localhost:3001/api/chat'
  //   Same-origin: '/api/chat'                 (best for SSO cookies)
  //   Hosted     : 'https://your-host.lilly.com/api/chat'
  //
  // If the proxy is unreachable, the chat falls back to the offline KB,
  // so it never looks broken.
  CORTEX_PROXY_URL: 'http://localhost:3001/api/chat',

  // System prompt sent with every request. Tune the agent's behavior here.
  CORTEX_SYSTEM:
    'You are the Mabl AI Agent for Lilly, powered by the Lilly Cortex Connector. ' +
    'Use the available Cortex tools to answer questions about using Mabl at Lilly accurately and concisely. ' +
    'If a question is outside the scope of Mabl or the portal, say you cannot answer confidently and suggest ' +
    'escalating to Mabl Support (24/5) or Stack Overflow Enterprise with the mabl tag.'

};
