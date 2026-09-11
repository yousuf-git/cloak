/**
 * Risks — where the guarantees stop.
 *
 * Documenting a security model honestly means documenting the edges. Each entry
 * separates four things that get conflated in conversation: what the weakness
 * is, how it would actually be exploited, what defends it, and what is left
 * over once that defence has done its job.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.risks = (function () {
  'use strict';
  const { esc, codeRef, inspect } = Atlas.ui;

  const SEVERITY = {
    inherent: { label: 'inherent to the trust model', tone: 'rust' },
    operational: { label: 'operational', tone: 'rust' },
    'by-design': { label: 'by design', tone: 'brass' },
    cleanup: { label: 'cleanup', tone: null },
  };

  function inspectRisk(risk) {
    const sev = SEVERITY[risk.severity] || { label: risk.severity, tone: null };
    inspect({
      kicker: sev.label,
      title: risk.name,
      body: `
        <div class="insp-section"><p class="insp-text">${esc(risk.summary)}</p></div>
        <div class="insp-section">
          <div class="insp-label">How it would be exploited</div>
          <p class="insp-text">${esc(risk.mechanism)}</p>
        </div>
        <div class="insp-section">
          <div class="insp-label">What defends it</div>
          <p class="insp-text">${esc(risk.defence)}</p>
        </div>
        <div class="insp-section">
          <div class="insp-label">What is left over</div>
          <p class="insp-text">${esc(risk.residual)}</p>
        </div>
        <div class="insp-section">
          <div class="insp-label">Source</div>${codeRef(risk.code)}
        </div>`,
    });
  }

  function render(stage) {
    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Where the guarantees stop</h1>
        <p class="stage-lede">
          A security model is only useful if you know its edges. None of these are secret,
          and none of them are excuses &mdash; two are deliberate trades, one is a deferred
          piece of work, and one is inherent to trusting a server you do not control.
        </p>
      </div>

      <div class="grid-2">
        ${Atlas.risks
          .map((r) => {
            const sev = SEVERITY[r.severity] || { label: r.severity, tone: null };
            return `
          <button class="panel ${r.severity === 'inherent' || r.severity === 'operational' ? 'panel-rust' : ''}"
                  data-risk-open="${esc(r.id)}"
                  style="text-align:left;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${Atlas.ui.chip(sev.label, sev.tone)}
            </div>
            <h3 style="margin:0;font-size:15.5px;font-variation-settings:'wght' 650;line-height:1.3">${esc(r.name)}</h3>
            <p class="insp-text" style="font-size:13px">${esc(r.summary)}</p>
            <span class="hint" style="margin-top:auto;color:var(--paper-faint)">Open the breakdown</span>
          </button>`;
          })
          .join('')}
      </div>

      <div class="section">
        <h2 class="section-title">Two things people assume are encrypted, and are not</h2>
        <div class="grid-2">
          <div class="panel">
            <div class="mono" style="font-size:13px;color:var(--rust);margin-bottom:7px">creds.username</div>
            <p class="insp-text" style="font-size:13px">
              Plaintext, and searchable on purpose. Anyone with database read access learns which
              accounts exist, on which sites, under which usernames. Just not the passwords.
            </p>
          </div>
          <div class="panel">
            <div class="mono" style="font-size:13px;color:var(--rust);margin-bottom:7px">access_key_id</div>
            <p class="insp-text" style="font-size:13px">
              Plaintext. It is an identifier, not a credential &mdash; the matching
              <span class="mono">secret_access_key</span> is what gets encrypted.
            </p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">One thing that looks like a secret container and is not</h2>
        <div class="panel">
          <div class="mono" style="font-size:13px;color:var(--paper);margin-bottom:9px">cloak_&lt;base64url&gt;</div>
          <p class="insp-text">
            A join key bundles the server URL and the invitation token into one pasteable string.
            This is encoding, not encryption &mdash; anyone who intercepts it can base64-decode it and
            read both halves. The security comes from the token inside: high entropy, bound to one
            email address, expiring. Worth repeating because <span class="mono">cloak_&hellip;</span>
            reads as though it were sealed.
          </p>
          <div style="margin-top:11px">${codeRef('api/src/lib/join-key.ts:15')}</div>
        </div>
      </div>
    `;

    stage.addEventListener('click', onClick);
  }

  function onClick(ev) {
    const el = ev.target.closest('[data-risk-open]');
    if (!el) return;
    const r = Atlas.ui.riskById(el.dataset.riskOpen);
    if (r) inspectRisk(r);
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
  }

  return {
    id: 'risks',
    label: 'Risks',
    hint: 'known edges',
    title: 'Where the guarantees stop',
    render,
    teardown,
    inspectRisk,
  };
})();
