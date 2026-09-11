/**
 * Custody — where every value comes to rest, and what a database dump reveals.
 *
 * The attacker toggle is the teaching device here. Reading "the password field
 * is encrypted" does not land the way watching half a table go opaque does,
 * and neither does noticing that the username beside it stays perfectly legible.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.custody = (function () {
  'use strict';
  const { esc, codeRef } = Atlas.ui;

  let attacker = false;

  function keysInZone(zoneId) {
    return Atlas.keys.filter((k) => k.zone === zoneId);
  }

  function zonePanel(zone) {
    const keys = keysInZone(zone.id);
    /* brass = in someone's hands; verdigris is reserved for public-by-design
       values, so a shown-once secret must never borrow it. */
    const tone = zone.custody === 'user' || zone.custody === 'none' ? 'brass' : null;

    return `
      <div class="panel" style="display:flex;flex-direction:column;gap:11px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap">
            <h3 style="margin:0;font-size:15px;font-variation-settings:'wght' 650">${esc(zone.name)}</h3>
            ${Atlas.ui.chip(zone.custody === 'none' ? 'not stored' : zone.custody, tone)}
          </div>
          <p class="insp-text" style="font-size:12.5px">${esc(zone.blurb)}</p>
        </div>
        ${
          (zone.holds || []).length
            ? `<div class="zone-items">
                ${zone.holds
                  .map(
                    ([name, note]) => `
                  <div class="zone-item ${zone.custody === 'server' ? 'is-opaque' : 'is-held'}" style="cursor:default">
                    <span class="zi-name mono" style="font-size:11.5px">${esc(name)}</span>
                    <span class="zi-form" style="font-family:var(--sans);font-size:11px">${esc(note)}</span>
                  </div>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
        ${
          keys.length
            ? `<div class="zone-items">
                ${keys
                  .map(
                    (k) => `
                  <button class="zone-item ${
                    k.public ? 'is-public' : zone.custody === 'user' || zone.custody === 'none' ? 'is-held' : 'is-opaque'
                  }" data-key-link="${esc(k.id)}">
                    <span class="zi-name">${esc(k.name)}</span>
                    <span class="zi-form">${esc(k.size)}</span>
                  </button>`,
                  )
                  .join('')}
              </div>`
            : ''
        }
        <div style="margin-top:auto">${codeRef(zone.code)}</div>
      </div>`;
  }

  function dumpTable() {
    return `
      <table class="matrix">
        <thead>
          <tr>
            <th style="width:150px">Collection</th>
            <th>Readable in a dump</th>
            <th style="width:230px">Encrypted</th>
          </tr>
        </thead>
        <tbody>
          ${Atlas.plaintext
            .map((p) => {
              const enc = Atlas.encryptedFields.find((e) => e.collection === p.collection);
              return `
              <tr>
                <td class="rowhead mono" style="font-size:12px">${esc(p.collection)}</td>
                <td style="color:var(--paper-dim);font-size:12.5px">
                  ${p.fields
                    .map((f) =>
                      f === p.flag
                        ? `<span class="chip chip-rust" style="margin:2px 3px 2px 0">${esc(f)}</span>`
                        : `<span style="opacity:.85">${esc(f)}</span>`,
                    )
                    .join(p.flag ? ' ' : ', ')}
                </td>
                <td class="mono" style="font-size:11.5px">
                  ${
                    enc
                      ? `<span class="${attacker ? 'redacted' : ''}" style="color:var(--brass-lit)">${esc(enc.encrypted)}</span>`
                      : '<span style="color:var(--paper-faint);opacity:.5">&mdash;</span>'
                  }
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;
  }

  function paint(stage) {
    Atlas.ui.$('#dump', stage).innerHTML = dumpTable();
    const toggle = Atlas.ui.$('#attacker-toggle', stage);
    toggle.setAttribute('aria-pressed', String(attacker));
    toggle.querySelector('.toggle-label').textContent = attacker
      ? 'Showing what an attacker can read'
      : 'Show what an attacker can read';
    Atlas.ui.$('#dump-note', stage).innerHTML = attacker
      ? `<div class="panel panel-rust">
           <p class="insp-text">
             The encrypted column is now unreadable, which is the point. Look at what is still legible
             beside it. A dump yields no passwords, but it does yield a complete map of an organization&rsquo;s
             infrastructure: which services each team uses, under which usernames, which env files exist
             and how large they are, who has access and when they got it.
           </p>
         </div>`
      : `<p class="hint">Flip the toggle to redact everything the server cannot read.</p>`;
  }

  function render(stage) {
    attacker = false;
    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Custody</h1>
        <p class="stage-lede">
          Seven places a value can come to rest, from process memory that is scrubbed on logout
          to a recovery key that is shown once and never stored at all.
        </p>
      </div>

      <div class="grid-2">
        ${Atlas.zones.map(zonePanel).join('')}
      </div>

      <div class="section">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px">
          <h2 class="section-title" style="margin:0;border:0;padding:0">What a database dump reveals</h2>
          <button class="toggle" id="attacker-toggle" aria-pressed="false">
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">Show what an attacker can read</span>
          </button>
        </div>
        <div id="dump"></div>
        <div id="dump-note" style="margin-top:14px"></div>
      </div>

      <div class="section">
        <h2 class="section-title">Server deployment secrets</h2>
        <p class="stage-lede" style="font-size:14px;margin-bottom:14px">
          These live in <span class="mono">api/.env</span> on the host, in plaintext. None of them can
          decrypt vault data. An attacker who reads the whole file can forge access tokens and
          impersonate any user at the API &mdash; which gets them ciphertext, and nothing else.
        </p>
        <table class="matrix">
          <thead>
            <tr><th style="width:180px">Variable</th><th style="width:90px">Size</th><th>Purpose</th><th style="width:210px">If rotated</th></tr>
          </thead>
          <tbody>
            ${Atlas.serverSecrets
              .map(
                (s) => `
              <tr>
                <td class="rowhead mono" style="font-size:12px">${esc(s.name)}</td>
                <td style="color:var(--paper-dim)">${esc(s.size)}</td>
                <td style="color:var(--paper-dim)">
                  ${esc(s.purpose)}
                  ${s.risk ? `<button class="chip chip-rust" data-risk="${esc(s.risk)}" style="cursor:pointer;margin-left:6px">why</button>` : ''}
                </td>
                <td style="color:var(--paper-faint)">${esc(s.rotation)}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">If you lose it</h2>
        <table class="matrix">
          <thead>
            <tr><th style="width:270px">Lost</th><th>Consequence</th><th style="width:250px">Way back</th></tr>
          </thead>
          <tbody>
            ${Atlas.lossMatrix
              .map(
                (l) => `
              <tr>
                <td class="rowhead">${esc(l.lost)}</td>
                <td style="color:var(--paper-dim)">${esc(l.consequence)}</td>
                <td style="color:${l.fatal ? 'var(--rust)' : 'var(--paper-dim)'}">${esc(l.recovery)}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <p class="hint" style="margin-top:12px">
          The operator cannot reset a user&rsquo;s password into a working vault. There is no administrative
          override, because there is no key anywhere on the server that would make one possible.
        </p>
      </div>
    `;

    paint(stage);
    stage.addEventListener('click', onClick);
  }

  function onClick(ev) {
    const stage = ev.currentTarget;
    if (ev.target.closest('#attacker-toggle')) {
      attacker = !attacker;
      paint(stage);
      return;
    }
    const risk = ev.target.closest('[data-risk]');
    if (risk) {
      const r = Atlas.ui.riskById(risk.dataset.risk);
      if (r) Atlas.views.risks.inspectRisk(r);
    }
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
  }

  return { id: 'custody', label: 'Custody', hint: 'storage', title: 'Custody', render, teardown };
})();
