import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SerpApiClient, ResearchError } from './lib/serpapi.mjs';
import { research, validateInput } from './lib/research.mjs';
import { SessionKey, isLoopbackRequest } from './lib/session-key.mjs';
const ROOT = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
const MIMES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };
export function createServer({ apiKey = process.env.SERPAPI_API_KEY, client, hourlyLimit = Number(process.env.MAX_REQUESTS_PER_HOUR || 24), root = ROOT } = {}) {
  const cap = Math.min(100, Math.max(1, Number.isFinite(hourlyLimit) ? hourlyLimit : 24));
  const usage = { calls: [] };
  const provider = client || new SerpApiClient({ apiKey, hourlyLimit: cap, usage });
  const sessionKey = new SessionKey();
  let busy = false;
  let activeAbort;
  async function readJson(req) {
    if (!String(req.headers['content-type']).startsWith('application/json')) throw new ResearchError('BAD_CONTENT_TYPE', 'Send JSON settings.', 415);
    let body = '', size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 4096) throw new ResearchError('BODY_TOO_LARGE', 'The request is too large.', 413); body += chunk; }
    try { return JSON.parse(body); } catch { throw new ResearchError('BAD_JSON', 'Settings must be valid JSON.', 400); }
  }
  const json = (res, status, data) => { res.writeHead(status, { ...SECURITY, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const local = isLoopbackRequest(req);
      if (url.pathname.startsWith('/api/') && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: 'Cross-origin API requests are not permitted.', code: 'ORIGIN_DENIED' });
      if (['/api/config', '/api/config.json'].includes(url.pathname) && req.method === 'GET') return json(res, 200, { liveAvailable: Boolean(apiKey || client || (local && sessionKey.status().configured)), keySource: apiKey || client ? 'environment' : local && sessionKey.status().configured ? 'session' : null, localSetupAvailable: local && !apiKey && !client, sessionExpiresAt: local ? sessionKey.status().expiresAt : null, maxBudget: 8, hourlyRemaining: provider.remaining(), cacheMinutes: 15 });
      if (url.pathname === '/api/session-key') {
        if (!local) return json(res, 403, { error: 'Key setup is available only on this computer through localhost.', code: 'LOCAL_ONLY' });
        if (req.method === 'DELETE') { sessionKey.clear(); activeAbort?.abort(); return json(res, 200, { configured: false }); }
        if (req.method !== 'POST') return json(res, 405, { error: 'Use the local setup form.', code: 'METHOD_NOT_ALLOWED' });
        if (busy || apiKey || client) return json(res, 409, { error: busy ? 'Wait for the current run to finish.' : 'An environment key is already configured.', code: 'KEY_SETUP_UNAVAILABLE' });
        const parsed = await readJson(req); sessionKey.set(parsed?.key);
        return json(res, 200, { configured: true, expiresAt: sessionKey.status().expiresAt, message: 'Key ready for one explicitly started research run. No search has been made.' });
      }
      if (url.pathname === '/api/research') {
        if (req.method !== 'POST') return json(res, 405, { error: 'Use POST for research.', code: 'METHOD_NOT_ALLOWED' });
        if (!local) return json(res, 403, { error: 'Live research is available only through this computer’s localhost address.', code: 'LOCAL_ONLY' });
        // Browser requests must originate from this server; no cross-origin API or credential surface.
        if (!apiKey && !client && !(local && sessionKey.status().configured)) return json(res, 503, { error: 'Live search needs a SerpApi key in the server environment. Explore the example workspace or follow the local setup instructions.', code: 'KEY_MISSING' });
        if (busy) return json(res, 409, { error: 'A research run is already in progress. Wait for it to finish before starting another.', code: 'BUSY' });
        const parsed = await readJson(req);
        validateInput(parsed);
        busy = true;
        const abort = new AbortController(); activeAbort = abort; res.on('close', () => { if (!res.writableEnded) abort.abort(); });
        const runProvider = apiKey || client ? provider : new SerpApiClient({ apiKey: sessionKey.take(), hourlyLimit: cap, usage });
        try { const result = await research(parsed, runProvider, { signal: abort.signal }); return json(res, result.status === 'failed' ? 502 : 200, result); } finally { if (runProvider !== provider) { runProvider.apiKey = ''; runProvider.cache.clear(); } busy = false; activeAbort = undefined; }
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'API route not found.', code: 'NOT_FOUND' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
      let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid path.', code: 'BAD_PATH' }); }
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep) || pathname.split('/').some(p => p.startsWith('.'))) return json(res, 403, { error: 'Path not available.', code: 'FORBIDDEN' });
      const data = await readFile(path);
      res.writeHead(200, { ...SECURITY, 'Content-Type': MIMES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : data);
    } catch (e) {
      if (e?.code === 'ENOENT' || e?.code === 'EISDIR') return json(res, 404, { error: 'Page not found.', code: 'NOT_FOUND' });
      if (e instanceof ResearchError) return json(res, e.status, { error: e.message, code: e.code });
      return json(res, 500, { error: 'The request could not be completed.', code: 'INTERNAL_ERROR' });
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
  const server = createServer();
  server.listen(port, host, () => console.log(`Prooflane running at http://${host}:${port} · ${process.env.SERPAPI_API_KEY ? 'Live search configured' : 'Example mode; live key not configured'}`));
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'The selected port is in use. Choose another PORT.' : 'The local server could not start. Check host and port configuration.'); process.exitCode = 1; });
}
