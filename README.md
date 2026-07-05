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

The production build is a static site (no backend, no runtime env vars) served from a container via nginx.

**Files:**
- `Dockerfile` — multi-stage build: Node 22 runs `npm run build`, then `nginx:1.27-alpine` serves the resulting `dist/`
- `nginx.conf` — SPA fallback routing + long-cache headers for hashed build assets
- `docker-compose.yml` — publishes the container on `127.0.0.1:8091` by default

### Deploying via Portainer

1. Stacks → Add stack → **Repository**, pointing at this repo (`https://github.com/kmprice13/Thomas-Spanish-Monster-Game`), compose path `docker-compose.yml`, branch `main`. Deploy.
2. Add a Caddy route:

   ```
   islamonstruo.tfp.pizza {
       reverse_proxy 127.0.0.1:8091
   }
   ```

   If Caddy runs in Docker on a shared network instead of proxying to a host port, edit `docker-compose.yml`: remove the `ports` mapping, uncomment the `networks` blocks, set the network name, and route Caddy to `islamonstruo:80` instead.
3. Add `islamonstruo.tfp.pizza` as a public hostname in the Cloudflare Tunnel config, routed the same way as other `tfp.pizza` subdomains.
4. Reload Caddy.

No environment variables or secrets are needed at runtime — ElevenLabs credentials are only used at build/asset-generation time by `scripts/generate-audio.mjs`, and the resulting audio files are already static assets under `public/audio`.
