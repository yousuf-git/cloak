# Distribution & Packaging

How the Cloak desktop app is built, versioned, and delivered to users through the
marketing site's download buttons.

## Strategy: GitHub Releases, built by CI

Desktop installers (Linux `.AppImage`/`.deb`/`.rpm`, Windows `.msi`/`.exe`,
macOS `.dmg`) are **built by GitHub Actions and published as GitHub Release
assets**. The marketing site reads those releases and links its download buttons
straight at the matching asset for the visitor's OS.

The self-hosted backend ships as **`cloak-server-v*.zip`** on its own server
release, so an operator can stand a server up without cloning the repository or
installing pnpm. It is assembled by the `server-bundle` job, and contains the compiled `dist/`, the source it was compiled from,
`templates/`, an npm lockfile generated in CI, the Dockerfile and compose files,
`setup.sh`, `.env.example` and a pm2 config. A `.sha256` accompanies it.

The bundle installs with npm rather than pnpm on purpose: `api/` has no workspace
dependencies, and an operator should not have to adopt this repository's package
manager to run the server. The `overrides` block in `api/package.json` carries
the security pins that `pnpm.overrides` provides inside the workspace.

This is not an arbitrary choice — the web layer is already built for it:

- `web/lib/github.ts` → `getReleases()` fetches recent releases from the GitHub
  API, cached hourly (`revalidate: 3600`). `pickLatest(releases, kind)` picks the
  newest desktop or server release by tag (see below); the download page takes
  installers from the one and the server bundle from the other.
- `findAssetForPlatform()` matches an asset by the per-platform `assetPattern`
  in `web/constants/site.ts` (`.msi/.exe`, `.dmg/.app.tar.gz`,
  `.AppImage/.deb/.rpm`).
- `DownloadRow` links to `asset.browserDownloadUrl`, and falls back to
  "Build from source" when no matching asset exists yet.

So once a release with installers exists, the buttons light up automatically —
no web deploy required (they refresh within the hour via ISR).

### Why not the alternatives

- **Commit binaries to the repo / host on the server** — no. 20–100 MB × 3
  platforms × every version bloats git permanently, one machine can't cross-build
  all three OSes, and Vercel static hosting isn't meant for large versioned
  binaries.
- **Custom package pipeline alongside the repo** — that *is* GitHub Releases +
  `tauri-action`. No need to invent one.
- **S3 / R2, versioned** — valid but a superset of work, and unnecessary now.
  Move to it only if you need private builds, a custom CDN/domain, code-signing
  artifact hosting, or bandwidth beyond GitHub's limits. Migration is just
  swapping the URLs `getDownloadUrl()` returns — the web UI is untouched.

## Release trigger: git tags (on-demand)

Releases are **not** produced on every push, and the desktop app and the server
are released **separately**, each from its own tag
(`.github/workflows/release.yml`):

```yml
on:
  push:
    tags: ['desktop-v*', 'server-v*']
```

| Tag | Builds | Release |
|---|---|---|
| `desktop-vX.Y.Z` | installers for all platforms, signed update bundles, `latest.json` | `Cloak desktop desktop-vX.Y.Z`, marked **latest** |
| `server-vX.Y.Z` | `cloak-server-vX.Y.Z.zip` and its `.sha256` | `Cloak server server-vX.Y.Z`, never marked latest |

A change to one side therefore never puts out a new version of the other: a
server fix does not prompt every desktop user to install an identical app.
Tags from before the split (`v0.1.0`–`v0.3.0`) shipped both and are read as
both by the site and by the app's server-release lookup.

The two version lines only meet through compatibility bounds, checked by the app
each time it connects (`probeServer` in `desktop/src/lib/server.ts`):

| Bound | Lives in | A mismatch means |
|---|---|---|
| `API_CONTRACT` | `api/src/lib/version.ts`, `CLIENT_API_CONTRACT` in the app | a breaking API change; bump only then |
| `MIN_CLIENT_VERSION` | `api/src/lib/version.ts` | the server refuses older apps; the app offers to update itself |
| `min_server_version` | `desktop/src/compat.json` | the app refuses older servers and says to ask the admin |

### Cutting a desktop release

1. Bump `version` in `desktop/src-tauri/tauri.conf.json` and
   `desktop/src-tauri/Cargo.toml` (then `cargo update -p cloak`). If the new app
   depends on something only a newer server has, raise `min_server_version` in
   `desktop/src/compat.json`. Commit.
2. `git tag desktop-v0.4.0 && git push origin desktop-v0.4.0`
3. The `desktop` jobs check the tag against `tauri.conf.json`, build every
   platform, and publish the release. `desktop-feed` then rewrites the notes to
   cover only changes since the previous app release, adds `min_server_version`
   to `latest.json`, and marks the release latest. Installed apps see it within
   a few hours, or at once from Settings → Updates.

### Cutting a server release

1. Bump `version` in `api/package.json` and `SERVER_VERSION` in
   `api/src/lib/version.ts`. If the server now needs a newer app, raise
   `MIN_CLIENT_VERSION` and say so at the top of the release notes — admins
   should have their team update before upgrading. Commit.
2. `git tag server-v0.3.1 && git push origin server-v0.3.1`
3. `server-bundle` checks all three versions agree, builds the zip, and
   publishes it with notes since the previous server release. Admins see a
   notice in organization settings; upgrading is theirs to do
   (`api/README.md`, "Upgrading").

If one change needs both, release the server first, then the app.

To check the server bundle still assembles without spending a version number on
finding out, run the workflow manually (`workflow_dispatch`). That skips the
installers and the release entirely, and leaves the zip as a build artifact.

## Release notes

GitHub generates the notes from the commits since the previous release **of the
same kind**, found by `scripts/previous-release-tag.sh`. Left to itself GitHub
would diff against whichever release came last, which after a server release
would fill the app's notes with server changes.

The desktop notes also become the `notes` field of `latest.json`, which is what
the app shows under "ready to install".

## Gotchas

- **Publish, not draft.** The workflow uses `releaseDraft: false` so the release
  is public immediately — the unauthenticated site fetch cannot see drafts. If
  you ever want a review gate, flip it to `true`, edit notes, then Publish; the
  site only sees it after publishing.
- **Rate limit.** The site fetch is server-side and cached hourly (~1 call/hr),
  safe unauthenticated. Add a token only if usage grows.
- **Code signing.** Unsigned macOS/Windows installers show OS warnings
  ("unidentified developer", SmartScreen). Fine for early releases. To sign
  later, add the Apple notarization + Windows cert secrets and pass them to
  `tauri-action` (`APPLE_CERTIFICATE`, `APPLE_SIGNING_IDENTITY`, etc.).
- **Linux runner.** Built on `ubuntu-22.04` for the `webkit2gtk-4.1` package
  names Tauri v2 expects; newer runners rename those packages.
- **macOS is a universal build.** One `.dmg` (`universal-apple-darwin`) covers
  Intel and Apple Silicon. Browsers can't reliably report Mac architecture
  (Safari on Apple Silicon claims Intel), and `findAssetForPlatform` takes the
  first `.dmg` match — separate per-arch dmgs would risk serving the wrong one.

## In-app updates

The desktop app updates itself with `tauri-plugin-updater`
(Settings → Updates; checked on launch and every six hours unless turned off).

- **Feed.** `plugins.updater.endpoints` in `tauri.conf.json` points at
  `releases/latest/download/latest.json`. That is why only desktop releases are
  ever marked latest: if a server release held the spot, the feed would 404 and
  no app would find updates until the next desktop release.
- **Signing.** `createUpdaterArtifacts` makes each build emit signed update
  bundles; the app installs one only if it verifies against `pubkey` in
  `tauri.conf.json`. The private key and its password are the
  `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository
  secrets. **Keep an offline copy of the key.** Without it no installed app can
  be updated again; the only way out is a new key and every user reinstalling
  by hand.
- **Formats.** AppImage, `.deb`, `.rpm` (installed with `pkexec`), Windows and
  macOS all update in place.
- **Server bounds.** Before installing, the app compares the feed's
  `min_server_version` with the server it is connected to and warns that
  updating will lock the user out until the server is upgraded.
- **Not in local builds.** A `pnpm ship` build runs a backend from this
  repository and is updated by rebuilding; `scripts/ship.sh` turns updater
  artifacts off, and the app hides the update controls in that build, in dev,
  and in the browser preview.
