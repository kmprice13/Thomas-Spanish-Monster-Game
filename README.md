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
- `Dockerfile` — multi-stage build: Node 22 runs `npm run build`, then `nginxinc/nginx-unprivileged` (pinned stable tag) serves the resulting `dist/`
- `nginx.conf` — SPA fallback routing, `no-cache` on the shell, immutable caching for hashed bundles only, `/healthz` probe
- `.github/workflows/docker.yml` — builds and pushes `ghcr.io/kmprice13/thomas-spanish-monster-game` (`:latest` plus the release tag, or the commit SHA on a manual dispatch) when a GitHub Release is published, or on manual dispatch. Pushes to `main` build nothing.

**Image contract** (what the deployment side can rely on):
- Listens on **8080** (unprivileged; there is no port 80).
- Runs as numeric non-root user **`1000:1000`** by default. No writable volumes are needed; nginx keeps its pid/temp files in `/tmp`.
- `GET /healthz` → `200 ok` (`Cache-Control: no-store`). The image's `HEALTHCHECK` probes it with the busybox `wget` that ships in the base image.

This repo only owns the image. On wagyu the game runs as the dash-managed app `islamonstruo` (owner kmp) in the `tfp1/homelab` repo ([tfp1/homelab#260](https://github.com/tfp1/homelab/issues/260)). Its runtime files there are generated: `apps/islamonstruo/docker-compose.yml` runs the GHCR image, and `caddy/apps/islamonstruo.caddy` routes `https://islamonstruo.tfp.pizza` to it. Nobody hand-edits those files; runtime changes (domain, port, health path, image tag) go through an app spec change submitted with the homelab deploy MCP or CLI and approved in dash. The existing `*.tfp.pizza` wildcard (Cloudflare DNS + tunnel ingress to Caddy) already covers the subdomain, so a deploy needs no Cloudflare changes.

Redeploys are pull-based: homelab's dash-applier polls GHCR every 2 minutes and redeploys the app when the `:latest` digest changes. `:latest` only changes when the `docker` workflow runs (a published release or a manual dispatch), so **publishing a release is the deploy button**.

## Releasing

Work merges to `main` whenever — nothing deploys from pushes. To ship what's on `main`:

1. GitHub → **Releases** → **Draft a new release**
2. **Choose a tag** → type the next version (e.g. `v0.3.0`) → "Create new tag on publish"
3. **Publish release**
4. Watch the **Actions** tab — the `docker` workflow takes ~3–4 min to build and push the image. Within ~2 more minutes, wagyu swaps the container (a few seconds of downtime). Total: live in about 5 minutes.
5. Open https://islamonstruo.tfp.pizza to confirm — no hard refresh needed, the page shell is never cached.

Caveats:
- Replaced art/audio that keeps the **same filename** can take up to 4 hours to reach devices that played recently (Cloudflare cache). New/renamed files and all code changes are immediate.
- **Rollback:** coordinate it with the homelab owner. Pick a known-good image that meets the image contract above (8080, `1000:1000`, `/healthz`). That can be a release image (tagged with its release tag) or a commit-SHA image from a manual `docker` run (tagged with the commit SHA). Don't assume a compatible release exists; check that the release was built after the 8080 change. The rollback is a runtime change like any other: an app spec change pinning that image tag, submitted with the homelab deploy MCP or CLI and approved in dash. Any image built before the 8080 change ([#47](https://github.com/kmprice13/Thomas-Spanish-Monster-Game/pull/47)), including every release published before it, is a root, port-80 image the managed app can't run, so re-running an old release's `docker` workflow is not a safe rollback.

No environment variables or secrets are needed at runtime — ElevenLabs credentials are only used at build/asset-generation time by `scripts/generate-audio.mjs`, and the resulting audio files are already static assets under `public/audio`.
