/**
 * Map — the landing view.
 *
 * The thesis of Cloak in one image: a boundary, keys that stay behind it, and
 * a single value that crosses. Every other view elaborates on this one.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.map = (function () {
  'use strict';
  const { esc, codeRef, inspect, inspectKey } = Atlas.ui;

  /* Held in Rust memory for the session, in the order a reader should meet them. */
  const held = ['master-key', 'recovery-wk', 'personal-dek', 'identity-sk', 'org-recovery-wk', 'org-dek'];

  /* Never stored at all — these exist on screen, or under the fingers, exactly once. */
  const ephemeral = ['master-password', 'recovery-key', 'org-recovery-key'];

  /* What the server holds. Envelopes and hashes, all opaque to it. */
  const stored = [
    { field: 'users.wrappedDEK', note: 'Personal DEK, wrapped', open: 'master-password' },
    { field: 'users.recovery_wrappedDEK', note: 'Personal DEK, wrapped again', open: 'recovery-key' },
    { field: 'users.wrapped_identity_sk', note: 'Identity secret key', open: 'personal-dek' },
    { field: 'memberships.wrapped_org_dek', note: 'Org DEK, sealed per member', open: 'identity-sk' },
    { field: 'orgs.org_recovery_wrappedDEK', note: 'Org DEK, break-glass', open: 'org-recovery-key' },
    { field: 'users.password_hash', note: 'argon2id(authHash)', hash: true },
    { field: 'creds.password, api-keys.key, …', note: 'Ciphertext under the Org DEK', open: 'org-dek' },
  ];

  const publicByDesign = [
    { name: 'crypto_salt', why: 'The client cannot derive its authHash without it' },
    { name: 'identity_public_key', why: 'Members seal Org DEKs to it' },
    { name: 'DOTENV_PUBLIC_KEY', why: 'Lets anyone add a variable without reading the file' },
  ];

  function render(stage) {
    stage.innerHTML = `
      <div class="stage-head">
        <hr class="lede-rule">
        <h1 class="stage-title">One value crosses the line.<br>Everything else stays on the device.</h1>
        <p class="stage-lede">
          Cloak is zero-knowledge because of where its keys live, not because of a policy.
          Every key that can decrypt anything is derived or generated on the user&rsquo;s machine.
          The server holds wrapped envelopes and one-way hashes, and no key that opens any of them.
        </p>
      </div>

      <div class="boundary">
        <div class="zone-side zone-device">
          <div class="zone-head">
            <span class="chip chip-brass"><span class="chip-dot"></span>held</span>
            <h2 class="zone-name">On the user&rsquo;s device</h2>
          </div>
          <p class="zone-blurb">
            Rust process memory, wrapped in Zeroizing. Scrubbed on logout, never written to disk,
            never crossing into the webview.
          </p>
          <div class="zone-items">
            ${held
              .map((id) => {
                const k = Atlas.ui.keyById(id);
                return `
                  <button class="zone-item is-held" data-key-link="${esc(k.id)}">
                    <span class="zi-name">${esc(k.name)}</span>
                    <span class="zi-form">${esc(k.size)}</span>
                  </button>`;
              })
              .join('')}
          </div>

          <div class="zone-head" style="margin-top:22px">
            <span class="chip chip-brass"><span class="chip-dot"></span>shown once</span>
          </div>
          <p class="zone-blurb" style="margin-bottom:9px">
            Typed or displayed, used, and dropped. No copy of these exists in the client,
            the server, or the database &mdash; which is what makes losing both of them final.
          </p>
          <div class="zone-items">
            ${ephemeral
              .map((id) => {
                const k = Atlas.ui.keyById(id);
                return `
                  <button class="zone-item is-held" data-key-link="${esc(k.id)}">
                    <span class="zi-name">${esc(k.name)}</span>
                    <span class="zi-form">${esc(k.size)}</span>
                  </button>`;
              })
              .join('')}
          </div>
        </div>

        <div class="wire">
          <div class="wire-rule"></div>
          <span class="wire-label">the wire</span>
          <div class="packet">authHash</div>
        </div>

        <div class="zone-side zone-server">
          <div class="zone-head">
            <span class="chip"><span class="chip-dot"></span>opaque</span>
            <h2 class="zone-name">On the server</h2>
          </div>
          <p class="zone-blurb">
            MongoDB holds envelopes it cannot open and hashes it cannot reverse.
            Adding a member is something it physically cannot do on its own.
          </p>
          <div class="zone-items">
            ${stored
              .map(
                (s) => `
              <div class="zone-item is-opaque" ${s.open ? `data-key-link="${esc(s.open)}" style="cursor:pointer"` : 'style="cursor:default"'}>
                <span class="zi-name mono" style="font-size:11.5px">${esc(s.field)}</span>
                <span class="zi-form" style="font-family:var(--sans);font-size:11px">${esc(s.note)}</span>
              </div>`,
              )
              .join('')}
          </div>

          <div class="zone-head" style="margin-top:22px">
            <span class="chip chip-verd"><span class="chip-dot"></span>public on purpose</span>
          </div>
          <p class="zone-blurb" style="margin-bottom:9px">
            Also on the server, and readable. Each one is published deliberately, because
            publishing it costs nothing and withholding it would break something.
          </p>
          <div class="zone-items">
            ${publicByDesign
              .map(
                (p) => `
              <div class="zone-item is-public" style="cursor:default">
                <span class="zi-name mono" style="font-size:11.5px">${esc(p.name)}</span>
                <span class="zi-form" style="font-family:var(--sans);font-size:11px">${esc(p.why)}</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>
      </div>

      <p class="hint" style="margin-top:12px">
        Click anything above to open its details. The chip on the wire is the authHash &mdash;
        it proves identity and decrypts nothing.
      </p>

      <div class="section">
        <h2 class="section-title">Four verbs, used precisely</h2>
        <p class="stage-lede" style="margin-bottom:15px;font-size:14px">
          Confusing these makes everything else unreadable. &ldquo;Encrypted&rdquo; always means
          reversible with the right key. &ldquo;Hashed&rdquo; always means not reversible at all.
        </p>
        <div class="grid-2">
          ${Atlas.vocabulary
            .map(
              (v) => `
            <div class="panel">
              <div style="display:flex;align-items:baseline;gap:9px;margin-bottom:7px">
                <span style="font-size:16px;font-variation-settings:'wght' 680">${esc(v.verb)}</span>
                <span class="chip">${esc(v.primitive)}</span>
              </div>
              <p class="insp-text" style="margin-bottom:6px">${esc(v.means)}</p>
              <p class="insp-text" style="font-size:12.5px;color:var(--paper-faint)">
                Reversible by: ${esc(v.reversible)}
              </p>
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">The primitives</h2>
        <div class="grid-3">
          ${Atlas.primitives
            .map(
              (p) => `
            <button class="panel" data-prim="${esc(p.id)}"
                    style="text-align:left;cursor:pointer;font:inherit;color:inherit">
              <div style="font-size:14.5px;font-variation-settings:'wght' 650;margin-bottom:3px">${esc(p.name)}</div>
              <div style="font-size:11.5px;color:var(--brass-lit);margin-bottom:8px">${esc(p.role)}</div>
              <p class="insp-text" style="font-size:12.5px">${esc(p.blurb)}</p>
            </button>`,
            )
            .join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Where to go next</h2>
        <div class="grid-3">
          ${[
            ['keys', 'Key hierarchy', 'Trace what opens what, one lock at a time.'],
            ['flows', 'Flows', 'Walk signup, login, recovery and a member grant step by step.'],
            ['custody', 'Custody', 'See exactly what a database dump reveals.'],
          ]
            .map(
              ([id, name, blurb]) => `
            <button class="panel" data-goto="${esc(id)}"
                    style="text-align:left;cursor:pointer;font:inherit;color:inherit">
              <div style="font-size:14.5px;font-variation-settings:'wght' 650;margin-bottom:6px">${esc(name)}</div>
              <p class="insp-text" style="font-size:12.5px">${esc(blurb)}</p>
            </button>`,
            )
            .join('')}
        </div>
      </div>
    `;

    stage.addEventListener('click', onClick);
  }

  function onClick(ev) {
    const prim = ev.target.closest('[data-prim]');
    if (prim) {
      const p = Atlas.primitives.find((x) => x.id === prim.dataset.prim);
      if (p) {
        inspect({
          kicker: p.role,
          title: p.name,
          body: `
            <div class="insp-section"><p class="insp-text">${esc(p.detail)}</p></div>
            <div class="insp-section">
              <div class="insp-label">Parameters</div>
              <dl style="margin:0">
                ${p.params.map(([k, v]) => Atlas.ui.row(k, esc(v))).join('')}
              </dl>
            </div>
            <div class="insp-section">
              <div class="insp-label">Source</div>${codeRef(p.code)}
            </div>`,
        });
      }
      return;
    }

    const goto = ev.target.closest('[data-goto]');
    if (goto) Atlas.app.go(goto.dataset.goto);
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
  }

  return {
    id: 'map',
    label: 'Map',
    hint: 'start',
    title: 'Map',
    render,
    teardown,
  };
})();
