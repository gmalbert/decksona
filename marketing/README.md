# Decksona marketing site

This is a standalone, dependency-free static site. The Electron app remains in the repository root; Cloudflare Pages should publish the `marketing/` folder as its own site.

## Cloudflare Pages setup

Create a Pages project from the `gmalbert/decksona` GitHub repository, and set:

- **Production branch:** `main`
- **Root directory:** `marketing`
- **Build command:** leave empty; this site does not need a build step
- **Build output directory:** `.`

Cloudflare Pages serves the **marketing site**. The separate phone web app in the repository's `web/` folder is intended to be served by Home Assistant from `/local/decksona/` on the home network. The marketing site links to its source and setup guide; it does not proxy Music Assistant or store users' connection tokens.

The `marketing/` directory contains the ready-to-serve `index.html`, CSS, JavaScript, metadata, and images. After the first deployment, open the project’s **Custom domains** settings, add `decksona.com`, and follow Cloudflare’s DNS instructions. Add `www.decksona.com` as a second domain and configure it to redirect to the primary domain if desired.

## Local preview

Open `index.html` in `marketing/` in a browser, or use any local static-file server. There are no build dependencies or installation steps.
