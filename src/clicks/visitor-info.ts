import { UAParser } from 'ua-parser-js';

/** Device, browser and OS derived from a user-agent string. */
export interface ClientInfo {
  device: string;
  browser: string;
  os: string;
}

const BOT_PATTERN = /bot|crawler|spider|crawling|slurp|facebookexternalhit|preview|curl|wget|httpclient|python-requests/i;

/**
 * Parses a user-agent string. Device is one of `desktop`, `mobile`, `tablet`,
 * `bot` or another ua-parser device type; unknown values become `"unknown"`.
 */
export function parseUserAgent(userAgent: string | undefined): ClientInfo {
  if (!userAgent) return { device: 'unknown', browser: 'unknown', os: 'unknown' };
  const result = new UAParser(userAgent).getResult();
  const isBot = BOT_PATTERN.test(userAgent);
  const device = isBot ? 'bot' : (result.device.type ?? (result.os.name ? 'desktop' : 'unknown'));
  return {
    device,
    browser: result.browser.name ?? (isBot ? 'Bot' : 'unknown'),
    os: result.os.name ?? 'unknown',
  };
}

/** Extracts the lower-cased host of a `Referer` header, or `null` if absent/invalid. */
export function referrerHost(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host.length > 0 ? host.slice(0, 255) : null;
  } catch {
    return null;
  }
}

/**
 * Reads the visitor country from `CF-IPCountry` or `X-Country`.
 * Returns an upper-case ISO code, or `"unknown"` (also for Cloudflare's `XX`).
 */
export function countryFromHeaders(headers: Record<string, string | string[] | undefined>): string {
  for (const name of ['cf-ipcountry', 'x-country']) {
    const raw = headers[name];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase();
    if (value && /^[A-Z0-9]{2}$/.test(value) && value !== 'XX') return value;
  }
  return 'unknown';
}
