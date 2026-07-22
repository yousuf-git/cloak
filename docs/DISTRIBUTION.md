# Distribution & Packaging

How the Cloak desktop app is built, versioned, and delivered to users through the
marketing site's download buttons.

## Strategy: GitHub Releases, built by CI

Desktop installers (Linux `.AppImage`/`.deb`/`.rpm`, Windows `.msi`/`.exe`,
macOS `.dmg`) are **built by GitHub Actions and published as GitHub Release
assets**. The marketing site reads those releases and links its download buttons
straight at the matching asset for the visitor's OS.

This is not an arbitrary choice — the web layer is already built for it:

- `web/lib/github.ts` → `getGitHubData()` fetches the latest release from the
  GitHub API (`.../releases?per_page=1`), cached hourly (`revalidate: 3600`).
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

Releases are **not** produced on every push. The workflow
(`.github/workflows/release.yml`) triggers only on a version tag:

```yml
on:
  push:
    tags: ['v*']
```

Ordinary commits to `main` build nothing. You ship a release when — and only
when — you push a tag. The tag is the release intent: it pins the version and
gives an immutable ref.

### Cutting a release

1. Bump the version in `desktop/src-tauri/tauri.conf.json` (`"version"`), commit.
2. Tag and push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. GitHub Actions builds all platforms in parallel and publishes a release
   named `Cloak v0.2.0` with the installers attached.
4. Within the hour the site's download buttons point at the new assets.

Keep the tag and `tauri.conf.json` version in sync (tag `v0.2.0` ↔ version
`0.2.0`).

> Want a manual escape hatch too? Add a `workflow_dispatch:` trigger with a
> `version` input and derive `tagName` from it. Left out for now to keep a single
> obvious path (tag = release).

## Release notes

The workflow sets `generateReleaseNotes: true`, so GitHub auto-generates the
notes from the merged PRs / commits since the previous tag. Zero manual effort.

To hand-write instead (or in addition), set `releaseBody` on the `tauri-action`
step — when `generateReleaseNotes` is also on, `releaseBody` is *pre-pended* to
the auto-generated section. A common pattern is to feed the relevant section of a
`CHANGELOG.md` into `releaseBody`.

The site keeps the release `body` (`mapRelease` in `web/lib/github.ts`), so these
notes can be rendered on the download page later with no API change.

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

## Auto-update (future, no web change)

When you want in-app updates:

1. Add `tauri-plugin-updater` + a signing keypair.
2. Enable updater artifacts so the build emits `latest.json`.
3. `tauri-action` already uploads `latest.json` to the release
   (`uploadUpdaterJson`, default on).
4. The app self-updates by polling that JSON — the marketing site is unaffected.
