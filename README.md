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

## Build on Windows

Run the following commands in PowerShell on Windows 10 (version 1809 or later)
or Windows 11.

### Install dependencies

Install [Git for Windows](https://git-scm.com/downloads/win),
[Node.js LTS](https://nodejs.org/), and
[Bun](https://bun.com/docs/installation). Bun can be installed from PowerShell:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Open a new PowerShell window, then clone the project and install the dependencies
using the committed lockfile:

```powershell
git clone https://github.com/aedn-sama/Ducky-Squacky.git
cd Ducky-Squacky
bun install --frozen-lockfile
```

### Browser build

The `build` script in `package.json` runs TypeScript checks and creates the Vite
production bundle in `dist`. The `start` script serves that bundle for local
preview:

```powershell
bun run build
bun run start
```

Open the localhost URL printed by Vite. For development with live reload, use
`bun run dev` and open `http://localhost:1420`.

### Windows desktop build

Install the additional [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows):

- Microsoft C++ Build Tools, with the **Desktop development with C++** workload
  and its Windows SDK components.
- Microsoft Edge WebView2 Runtime, if it is not already installed.
- Rust through [rustup](https://rustup.rs/), using the MSVC toolchain.

Restart PowerShell after installation. For a 64-bit Intel/AMD Windows build, run:

```powershell
rustup default stable-msvc
rustup target add x86_64-pc-windows-msvc
bun run tauri -- build --target x86_64-pc-windows-msvc
```

The `tauri` script invokes the project's installed Tauri CLI. Its configuration
runs `bun run build` automatically before compiling the desktop application.
The release executable is written under
`src-tauri\target\x86_64-pc-windows-msvc\release`; installers are written under
that directory's `bundle\nsis` (`*-setup.exe`) and `bundle\msi` (`*.msi`) folders.
MSI packaging requires the Windows VBSCRIPT optional feature; see the
[Tauri installer documentation](https://v2.tauri.app/distribute/windows-installer/)
if MSI generation fails.

The existing `bun run build:desktop` script explicitly selects
`x86_64-pc-windows-gnu`. Tauri officially supports the Windows MSVC target, so
use the explicit MSVC command above for a native Windows build. The scripts in
`package.json` are unchanged.

To run the desktop app during development:

```powershell
bun run tauri -- dev
```
