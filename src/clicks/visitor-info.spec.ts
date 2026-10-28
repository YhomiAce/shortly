import { countryFromHeaders, parseUserAgent, referrerHost } from './visitor-info';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('parseUserAgent', () => {
  it('detects mobile Safari on iOS', () => {
    expect(parseUserAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'Mobile Safari', os: 'iOS' });
  });

  it('treats desktop browsers as desktop', () => {
    expect(parseUserAgent(WINDOWS_CHROME)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' });
  });

  it('flags bots and command-line clients', () => {
    expect(parseUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)').device).toBe('bot');
    expect(parseUserAgent('curl/8.5.0').device).toBe('bot');
  });

  it('handles a missing user-agent', () => {
    expect(parseUserAgent(undefined)).toEqual({ device: 'unknown', browser: 'unknown', os: 'unknown' });
  });
});

describe('referrerHost', () => {
  it('keeps only the lower-cased host', () => {
    expect(referrerHost('https://News.YCombinator.com/item?id=1')).toBe('news.ycombinator.com');
  });

  it('returns null for missing or invalid referrers', () => {
    expect(referrerHost(undefined)).toBeNull();
    expect(referrerHost('not a url')).toBeNull();
  });
});

describe('countryFromHeaders', () => {
  it('prefers CF-IPCountry, then X-Country', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'ng', 'x-country': 'US' })).toBe('NG');
    expect(countryFromHeaders({ 'x-country': 'de' })).toBe('DE');
  });

  it('falls back to "unknown"', () => {
    expect(countryFromHeaders({})).toBe('unknown');
    expect(countryFromHeaders({ 'cf-ipcountry': 'XX' })).toBe('unknown');
    expect(countryFromHeaders({ 'x-country': '<script>' })).toBe('unknown');
  });
});
