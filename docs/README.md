# `@lambda-event-router/docs`

The [VitePress](https://vitepress.dev/) documentation site for `lambda-event-router`. This is a workspace package under the monorepo root but is intentionally isolated: its scripts are prefixed `docs:*` so recursive root commands (`pnpm -r build`, `pnpm -r dev`, `pnpm -r test`, `pnpm -r clean`) skip it.

## Local development

Run commands from the repo root using pnpm filters:

```bash
# install once
pnpm install

# dev server on http://localhost:5173
pnpm -F @lambda-event-router/docs docs:dev

# production build → docs/.vitepress/dist
pnpm -F @lambda-event-router/docs docs:build

# preview the built site
pnpm -F @lambda-event-router/docs docs:preview
```

## Project layout

```
docs/
├── .vitepress/
│   ├── config.ts          # site metadata, nav, sidebar
│   └── theme/
│       ├── index.ts       # extends the default theme
│       └── custom.css     # homepage grid + (TODO) brand colour overrides
├── public/                # static assets served at the site root
│   └── lambda-event-router.svg
├── index.md               # homepage (hero + 3 side-by-side code blocks)
├── about.md               # about page
├── docs/                  # "Docs" section - Getting Started guide pages
├── routers/               # one page per router class
└── examples/              # examples landing page
```

## Deploying to GitHub Pages

### 1. Set the `base` path

VitePress serves from `/` by default. If you deploy to `https://pyepye.github.io/lambda-event-router/`, edit `docs/.vitepress/config.ts` and set:

```ts
export default defineConfig({
  base: "/lambda-event-router/",
  // ...
});
```

If you are using a custom domain, leave `base: "/"`.

### 2. Enable GitHub Pages

In the repository settings on GitHub: **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.

### 3. Add a deploy workflow

Create `.github/workflows/docs.yml` in the repo root with the following contents:

```yaml
name: Deploy docs to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm -F @lambda-event-router/docs docs:build

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

On push to `main`, the workflow builds the docs and publishes `docs/.vitepress/dist` to GitHub Pages.

### Custom domain

If serving from a custom domain, add a file at `docs/public/CNAME` containing the domain name (for example `lambda-event-router.dev`). VitePress copies `public/` into the build output, so GitHub Pages will pick it up automatically.
