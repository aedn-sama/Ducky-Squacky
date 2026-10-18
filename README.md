# Ducky Squacky

Browser SQL workspace powered by DuckDB-WASM. The web deployment builds the
React/Vite frontend with the committed Bun lockfile and serves it with Caddy.
No Tauri build or database server is needed.

## Docker and Dockge

The existing Dockge instance in `~/workspace/dockge` discovers this project's
`docker-compose.yml` under its configured stacks directory. Use **Scan Stacks
Folder** in Dockge if `ducky-squacky` is not listed yet.

From this directory:

```bash
docker compose config -q
docker compose up -d --build --wait --wait-timeout 120
docker compose ps
```

The application listens on internal port 8080 without publishing a host port.
The shared `../home-proxy` stack connects to `ducky-squacky_default` and routes
**https://ducky-squacky.home** to the application. After creating the app's
network, apply the proxy network and route configuration:

```bash
docker compose -f ../home-proxy/compose.yaml config -q
docker compose -f ../home-proxy/compose.yaml exec -T caddy \
  caddy validate --config /etc/caddy/Caddyfile
docker compose -f ../home-proxy/compose.yaml up -d --wait --wait-timeout 120
```

Configure hostname resolution on the computer running your browser. For a
browser on this host, or Windows using WSL localhost forwarding, add this entry
to `/etc/hosts` or `C:\Windows\System32\drivers\etc\hosts`:

```text
127.0.0.1 ducky-squacky.home
```

For another device, use this server's reachable LAN address instead. Trust the
shared Caddy CA certificate at `~/workspace/dockge/home-proxy-root.crt` on the
browser computer, as with `type-grid-web.home`. Trusted HTTPS is required for
the application's `crypto.randomUUID()` calls.

To check HTTPS without changing system DNS:

```bash
curl --fail --cacert "$HOME/workspace/dockge/home-proxy-root.crt" \
  --resolve ducky-squacky.home:443:127.0.0.1 https://ducky-squacky.home/
```

Use `docker compose stop` to stop the app while keeping its network. Before
using `docker compose down`, stop `home-proxy` because it is attached to the
app-owned network. Create the app again before restarting the proxy.

## Data lifetime

DuckDB executes in the browser and stores tables in memory. Reloading the page
clears tables; export results before reloading. Query tabs and history are saved
in that browser's local storage. The existing `ducky-squacky.duckdb` file is not
used by the web app and is excluded from the Docker image.

## Development

```bash
bun install --frozen-lockfile
bun run dev
bun run build
```

The build runs TypeScript checks before bundling. No lint or test scripts are
currently defined in `package.json`.
