import { ResearchError } from './serpapi.mjs';
/** Local user-controlled handoff. No persistence, logging, echo, or automatic search. */
export function isLoopbackRequest(req) {
  const host = String(req.headers.host || '').split(':')[0];
  const remote = req.socket.remoteAddress;
  return ['127.0.0.1', 'localhost'].includes(host) && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
}
export class SessionKey {
  #value = ''; #expiresAt = 0;
  constructor({ now = () => Date.now(), lifetimeMs = 10 * 60 * 1000 } = {}) { this.now = now; this.lifetimeMs = lifetimeMs; }
  set(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(value.trim())) throw new ResearchError('INVALID_KEY_FORMAT', 'The key format is not recognized. Copy your SerpApi API key, without spaces or quotes.', 400);
    this.#value = value.trim(); this.#expiresAt = this.now() + this.lifetimeMs;
  }
  status() { if (this.now() >= this.#expiresAt) this.clear(); return { configured: Boolean(this.#value), expiresAt: this.#value ? new Date(this.#expiresAt).toISOString() : null }; }
  take() { if (!this.status().configured) return ''; const value = this.#value; this.clear(); return value; }
  clear() { this.#value = ''; this.#expiresAt = 0; }
}
