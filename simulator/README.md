# Under the Cloak

An interactive map of how Cloak actually works underneath — the key hierarchy, where
every secret comes to rest, what happens during signup and recovery and a member
grant, who can do what, which events get audited, and where the guarantees stop.

Built for two readers: someone joining the project who needs the model explained,
and someone who has been here a year and wants to check one fact quickly.

## Running it

Open `index.html` in a browser. That is the whole setup — no build step, no server,
no package install. It works from a `file://` URL, which is why the scripts are
classic `<script>` tags rather than ES modules.

The page fetches Archivo, JetBrains Mono, and Tailwind's play CDN on first load.
Without a network it still works: the visual system lives in `assets/app.css`, so
you lose the web fonts and the Tailwind utility classes but keep a fully styled,
readable page.

## Getting around

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl-K` | Search every term, key, flow, field, event and risk |
| `1`–`8` | Jump to a section |
| `Esc` | Close the palette, then the detail panel |

Click almost anything. Terms, keys, envelopes, primitives, roles, places and risks
all open the detail panel on the right, and the panel cross-links to related keys.

## The sections

- **Map** — the trust boundary, and the single value that crosses it. Start here.
- **Keys** — the hierarchy as a graph. Trace mode answers "if someone holds this, what can they open?"
- **Flows** — signup, login, recovery, member grant, env import, org break-glass, one step at a time.
- **Custody** — where everything is stored, and a toggle that redacts the database down to what an attacker can actually read.
- **Roles** — the capability matrix, plus the membership and auth state machines.
- **Events** — the audit vocabulary.
- **Risks** — the known weak points, each split into mechanism, defence, and residual risk.
- **Catalogue** — everything in one filterable table: terms, keys, envelopes, hashes, stored fields, places, roles, capabilities, flows, states, events, server secrets, primitives, risks, and the loss matrix.

The Catalogue is the quick-reference view. The others explain; it just answers
"what is that thing" as fast as possible.

## Files

```
index.html            shell and script load order
assets/app.css        the whole visual system
js/data-core.js       zones, primitives, key catalogue, envelopes, hashes
js/data-flows.js      flows, roles, membership + auth states, events, risks
js/data-terms.js      glossary
js/ui.js              escaping, inspector, shared render helpers
js/views/*.js         one file per section
js/app.js             router, nav, command palette, keyboard
```

The JavaScript namespace is `window.Atlas`, which predates the page's name and is
kept because renaming it across every file buys nothing.

## Keeping it honest

Every record in `js/data-*.js` carries a `code` field pointing at a real
`path:line` in the repository. That is the contract: **if you change the code,
change the record.** A stale fact in an onboarding tool is worse than no tool,
because a new developer has no way to tell it is wrong.

The Catalogue derives its rows from those same records rather than keeping its own
copy, so a fact has exactly one place to go stale.

`docs/INFO_ABOUT_KEYS.md` is the source of truth this was built from. When the two
disagree, the document wins, and this page needs updating.

Adding a section means writing `js/views/<id>.js` that returns
`{ id, label, hint, title, render, teardown }`, adding the file to `index.html`,
and adding the id to `ORDER` and `GROUPS` in `js/app.js`.
