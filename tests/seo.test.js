import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const siteOrigin = 'https://sxstx.feiyastudio.com';
const expectedSitemapUrls = [
  siteOrigin + '/',
  siteOrigin + '/submit-target-time.html',
];

const readOutput = (fileName) => readFile(new URL('../dist/' + fileName, import.meta.url), 'utf8');

test('production sitemap is a static XML file with only real calculator URLs', async () => {
  const sitemap = await readOutput('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.doesNotMatch(sitemap, /<!doctype html/i);
  assert.doesNotMatch(sitemap, /<(changefreq|priority)>/);
  assert.deepEqual(urls, expectedSitemapUrls);

  for (const sitemapUrl of urls) {
    const url = new URL(sitemapUrl);
    assert.equal(url.origin, siteOrigin);
    assert.equal(url.hash, '');
    assert.equal(url.search, '');
    assert.doesNotMatch(url.pathname, /^\/api(?:\/|$)/);
    await readOutput(url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  }
});

test('production robots file allows crawling and points to the calculator sitemap', async () => {
  const robots = await readOutput('robots.txt');

  assert.equal(
    robots.replace(/\r\n/g, '\n').trimEnd(),
    'User-agent: *\nAllow: /\n\nSitemap: ' + siteOrigin + '/sitemap.xml',
  );
});

test('production homepage has the correct canonical and remains indexable', async () => {
  const homepage = await readOutput('index.html');

  assert.match(homepage, /<link rel="canonical" href="https:\/\/sxstx\.feiyastudio\.com\/"\s*\/?>/);
  assert.doesNotMatch(
    homepage,
    /(?:name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["'])/i,
  );
});

test('production HTML pages do not declare noindex', async () => {
  for (const fileName of ['index.html', 'submit-target-time.html']) {
    const html = await readOutput(fileName);
    assert.doesNotMatch(html, /<meta\b[^>]*\bnoindex\b[^>]*>/i, fileName);
    assert.doesNotMatch(html, /<meta\b[^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i, fileName);
  }
});
