# Production deployment: TFEX Trading Journal

This stack is intentionally isolated from the other applications on the VPS:

- Containers: `tfexdash-api`, `tfexdash-web`
- Private network: `tfexdash_internal`
- Persistent paths: `data/` and `uploads/` below this project directory
- The only shared resource is the existing `deploy_default` Docker network,
  used only by `tfexdash-web` so the existing `pharmshift-caddy` can route the
  new hostname to it.

## VPS release procedure

Run these from a checked-out copy at `/home/codex/tfexdash`:

```bash
mkdir -p data uploads backups
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
```

The API has no host-published port. Verify it from its container:

```bash
docker exec tfexdash-api node -e "fetch('http://127.0.0.1:4000/api/health').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) })"
```

Then append the contents of `deploy/caddy.tfexdash.caddy` to the existing
`/home/codex/pharmshift/deploy/Caddyfile`, validate it in the existing Caddy
container, and reload/restart **only** `pharmshift-caddy`.

## Database backup

Use SQLite's backup API rather than copying `tfex.db` while it is active:

```bash
docker exec tfexdash-api node dist/db/backup.js
```

Copy resulting backups off the VPS on a regular schedule before storing real
financial records there.
