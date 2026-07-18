# SEO sitemap workflow

The calculator uses Vite with a root base and deploys the generated dist directory to GitHub Pages for https://sxstx.feiyastudio.com/.

- Maintain crawler-facing static files in public/sitemap.xml and public/robots.txt; Vite copies them to the root of dist.
- Keep sitemap entries limited to real HTML build inputs from vite.config.js. Do not list hash navigation, UI tabs, API paths, or language variants that share an existing URL.
- Use the page's actual modification date for each sitemap lastmod.
- Run npm run build followed by npm run test:seo before deployment. The deployment workflow runs the same SEO checks before uploading dist.
