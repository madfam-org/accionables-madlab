import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CLIENT = resolve(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(resolve(CLIENT, ...parts), 'utf8');

describe('crawl files', () => {
  it('ships robots.txt that keeps crawlers on the landing', () => {
    const robots = read('public', 'robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/app$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
  });

  it('nginx answers the crawl files before the SPA fallback, 404 when missing', () => {
    const conf = read('nginx.conf');
    const spa = conf.indexOf('location / {');
    expect(spa).toBeGreaterThan(-1);
    for (const file of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
      const match = conf.match(
        new RegExp(`location = ${file.replace('.', '\\.')}\\s*\\{([^}]*)\\}`)
      );
      expect(match, file).not.toBeNull();
      expect(match?.[1]).toContain('try_files $uri =404;');
      // An add_header here would drop the server-level security headers.
      expect(match?.[1]).not.toContain('add_header');
      expect(conf.indexOf(match?.[0] ?? '')).toBeLessThan(spa);
    }
  });
});
