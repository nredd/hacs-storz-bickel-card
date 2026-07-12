# Home Assistant Custom Card - Dev Container Setup

This directory contains the development container configuration for building and testing the
`storz-bickel-card` custom card for Home Assistant.

## Setup Instructions

1. **Install VS Code Remote Containers**
   - [VS Code Extension: Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Dev Container**
   - Open the project folder in VS Code
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Remote-Containers: Reopen in Container"
   - Wait for the container to build (first time takes ~2-3 minutes)

3. **Build the Card**
   ```bash
   bun run build   # Production build (minified)
   bun run dev     # Watch-mode build with hot reload
   bun run serve   # Static server on port 5000
   bun run lint    # Check code quality
   ```

4. **Access Services**
   - **Dev Container**: Terminal in VS Code (automatic)
   - **Home Assistant**: http://localhost:8123 (user: dev/pass: dev)
   - **Dev Server**: http://localhost:5000

5. **Configure Home Assistant to Use Your Card**
   - The card auto-loads via `LOVELACE_REMOTE_FILES` — no manual resource registration needed
   - In Home Assistant, go to Settings > Dashboards
   - Create a new Dashboard
   - Add the card from the GUI (search **Storz & Bickel Card**)

## File Structure

```
.devcontainer/
├── devcontainer.json    # VS Code dev container config
├── config/              # Bind-mounted Home Assistant config directory
├── .gitignore          # Ignore HA data
└── README.md           # This file
```

## Base Image

This project uses the published image:

- `ghcr.io/custom-cards/custom-card-devcontainer:latest`

The image includes the `container` helper used by the devcontainer lifecycle commands. The Bun
feature (`ghcr.io/shyim/devcontainers-features/bun:0`) is added on top, pinned to match
`.bun-version`.

## Development Workflow

### Building the Card

```bash
# One-time setup (automatic on container creation)
bun install --frozen-lockfile

# Development with hot reload
bun run dev              # Watch-mode build
bun run serve            # Static server on port 5000 (pair with `dev` above)

# Quality checks
bun run lint             # Biome check
bun run check             # tsc --noEmit
bun test                  # bun test --coverage

# Production build
bun run build             # Minified dist/storz-bickel-card.js
```

`script/check` runs the full CI gate (lint-check + type-check + test) in one command.

### File Locations

- **Source Code**: `src/`
- **Built Output**: `dist/` (inside container, bind-mounted to `/config/www/workspace` as a
  fallback path alongside `LOVELACE_REMOTE_FILES`)
- **Configuration**: Root directory (`tsconfig.json`, `biome.json`, `bunfig.toml`, etc.)

## Troubleshooting

### Container Won't Start
```bash
# Rebuild the container
ctrl+shift+p → "Remote: Rebuild Container"
```

### Port Already in Use
```bash
# Find what's using port 5000 or 8123
lsof -i :5000
lsof -i :8123
```

### Node Modules Issues
```bash
# Clear and reinstall dependencies
rm -rf node_modules
bun install --frozen-lockfile
```

## Additional Resources

- [Home Assistant Custom Card Development](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [VS Code Dev Containers Docs](https://code.visualstudio.com/docs/remote/containers)
- [Lit Documentation](https://lit.dev/)
- [Bun Documentation](https://bun.sh/docs)
- [Biome Documentation](https://biomejs.dev/)

## Environment Details

- **Bun**: 1.3.14 (pinned in `.bun-version`)
- **TypeScript**: 6.0.x (strict, `tsc --noEmit`)
- **Bundler**: `bun build`
- **Linter/Formatter**: Biome 2.5.x
- **Web Framework**: Lit 3.3
- **Home Assistant Image**: Latest (optional)

## Notes

- The container runs as non-root user `vscode` for security
- Volume mounts use `cached` consistency mode for better performance on Mac/Windows
- All Bun commands run inside the container automatically
- VS Code extensions are configured for TypeScript, Biome, and YAML development
