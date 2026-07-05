# Thomas Spanish Monster Game

A Spanish vocabulary-learning game built with Phaser 3 + Vite + TypeScript. An NPC speaks Spanish, the player walks their character to the matching object, and gets an instant reward — no flashcards, no punishment, no English during play.

## Development

```
npm install
npm run dev
```

Opens at http://127.0.0.1:5188.

Other scripts:

```
npm run build          # tsc + vite build -> dist/
npm run preview         # serve the production build locally
npm test                # vitest unit tests
npm run test:ui         # playwright tests
```

## Deployment

The production build is a static site (no backend, no runtime env vars) served by nginx in a container.

**Files:**
- `Dockerfile` — multi-stage build: Node 22 runs `npm run build`, then `nginx:1.27-alpine` serves the resulting `dist/`
- `nginx.conf` — SPA fallback routing, `no-cache` on the shell, immutable caching for hashed bundles only
- `.github/workflows/docker.yml` — builds and pushes `ghcr.io/kmprice13/thomas-spanish-monster-game` on every push to `main`

This repo only owns the image. The deployment to wagyu lives in the `tfp1/homelab` repo (the GitOps source of truth for its Portainer stacks): `stacks/islamonstruo/docker-compose.yml` pulls the GHCR image onto Caddy's docker network, and `caddy/Caddyfile` routes `http://islamonstruo.tfp.pizza` to it. The existing `*.tfp.pizza` wildcard (Cloudflare DNS + tunnel ingress to Caddy) already covers the subdomain, so a deploy needs no Cloudflare changes.

One-time setup after the first image publish: flip the GHCR package to public (repo → Packages → package settings) so wagyu can pull it unauthenticated.

No environment variables or secrets are needed at runtime — ElevenLabs credentials are only used at build/asset-generation time by `scripts/generate-audio.mjs`, and the resulting audio files are already static assets under `public/audio`.
