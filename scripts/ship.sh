#!/usr/bin/env bash
#
# Builds Cloak and installs it for the current user. No sudo, no CI.
#
#   pnpm ship
#
# The backend is deliberately NOT bundled: the app runs `$CLOAK_API_DIR/dist/server.js`
# with the system node, so a backend-only change needs `pnpm build:api` and a
# relaunch — no rebuild of the AppImage.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Baked into the binary via option_env! so a GUI launch (which never sources a
# shell profile) can still find the backend.
export CLOAK_API_DIR="$ROOT/api"

echo "==> building backend"
pnpm --filter @cloak/api build

echo "==> building desktop (AppImage)"
pnpm --filter @cloak/desktop tauri build --bundles appimage

APPIMAGE="$(find "$ROOT/desktop/src-tauri/target/release/bundle/appimage" -name '*.AppImage' -printf '%T@ %p\n' \
  | sort -rn | head -1 | cut -d' ' -f2-)"
if [[ -z "${APPIMAGE:-}" ]]; then
  echo "no AppImage produced" >&2
  exit 1
fi

echo "==> installing to ~/.local"
ICONS="$HOME/.local/share/icons/hicolor"
mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" \
  "$ICONS/128x128/apps" "$ICONS/256x256/apps" "$ICONS/512x512/apps"

install -m755 "$APPIMAGE" "$HOME/.local/bin/Cloak.AppImage"
install -m644 "$ROOT/desktop/src-tauri/icons/128x128.png"    "$ICONS/128x128/apps/cloak.png"
install -m644 "$ROOT/desktop/src-tauri/icons/128x128@2x.png" "$ICONS/256x256/apps/cloak.png"
install -m644 "$ROOT/desktop/src-tauri/icons/icon.png"       "$ICONS/512x512/apps/cloak.png"

# An AppImage registers nothing on its own — this entry is what puts Cloak in the
# launcher. StartupWMClass must match the window's real WM_CLASS (lowercase
# "cloak", per xprop) or the running window falls back to a generic icon.
cat > "$HOME/.local/share/applications/cloak.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Cloak
Comment=Zero-knowledge secrets manager and password vault
Exec=$HOME/.local/bin/Cloak.AppImage
Icon=cloak
Terminal=false
Categories=Utility;Security;
StartupWMClass=cloak
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "$ICONS" 2>/dev/null || true

echo "==> done: $(basename "$APPIMAGE") -> ~/.local/bin/Cloak.AppImage"
