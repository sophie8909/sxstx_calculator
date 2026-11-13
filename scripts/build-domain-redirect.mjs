import { readFile, rename, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);
const destination = 'https://feiyastudio.com';

await rename(new URL('index.html', dist), new URL('legacy.html', dist));

for (const [file, path] of [
  ['index.html', '/'],
  ['submit-target-time.html', '/submit-target-time.html'],
  ['404.html', '/'],
]) {
  const target = destination + path;
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${target}">
  <title>杖劍傳說計算機已搬遷</title>
  <script>location.replace(${JSON.stringify(target)} + location.search + location.hash);</script>
</head>
<body>
  <p><a href="${target}">前往杖劍傳說計算機</a></p>
</body>
</html>
`;
  await writeFile(new URL(file, dist), html);
}

const legacy = new URL('legacy.html', dist);
const html = (await readFile(legacy, 'utf8'))
  .replace('content="index, follow"', 'content="noindex, follow"')
  .replace('href="https://sxstx.feiyastudio.com/"', 'href="https://feiyastudio.com/"');
await writeFile(legacy, html);
