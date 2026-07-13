# Cloak Marketing Site

Production-ready marketing landing page for [Cloak](https://github.com/yousuf-git/cloak) — built with Next.js 16, TypeScript, Tailwind CSS v4, and Motion.

## Development

```bash
cd web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
pnpm start
```

## Features

- Conversion-focused single-page landing
- GitHub API integration for stars, forks, and release downloads
- Platform-aware download button (Windows, macOS, Linux)
- SEO: metadata, Open Graph, JSON-LD, sitemap, robots.txt
- Dark/light theme toggle
- Fully responsive (mobile → ultra-wide)
- All copy sourced from the repository README — no invented features

## Deployment

Deploy to Vercel, Netlify, or any static/Node host. Set `SITE.url` in `constants/site.ts` to your production domain.

This package is isolated from the main Cloak desktop app and API — it does not affect the existing application.
