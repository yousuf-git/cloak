/**
 * Under the Cloak — shared rendering helpers.
 *
 * No framework. Views build HTML strings and hand them to the stage, then wire
 * up behaviour with delegated listeners. `esc` is mandatory on every value that
 * reaches the DOM, even though all content here is local and trusted — the
 * habit is what keeps it safe when someone pastes in new data later.
 */
window.Atlas = window.Atlas || {};

Atlas.ui = (function () {
  'use strict';

  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Escape a value for interpolation into HTML. */
  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
  }

  /** Escape, then turn newlines into <br> — for multi-line compute blocks. */
  function escLines(value) {
    return esc(value).replace(/\n/g, '<br>');
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /** A code reference chip, or empty string when there is no reference. */
  function codeRef(path) {
    return path ? `<span class="code-ref">${esc(path)}</span>` : '';
  }

  /** A definition row for the inspector. */
  function row(term, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="drow"><dt>${esc(term)}</dt><dd>${value}</dd></div>`;
  }

  function chip(text, tone) {
    const cls = tone ? ` chip-${tone}` : '';
    return `<span class="chip${cls}">${esc(text)}</span>`;
  }

  /* ── inspector ───────────────────────────────────────────────────────── */

  let onCloseHook = null;

  /**
   * Open the right-hand inspector.
   * @param {{kicker?:string, title:string, body:string, onClose?:Function}} spec
   */
  function inspect(spec) {
    const main = $('#main');
    const panel = $('#inspector');
    if (!main || !panel) return;

    panel.innerHTML = `
      <div class="insp-head">
        ${spec.kicker ? `<div class="insp-kicker">${esc(spec.kicker)}</div>` : ''}
        <h2 class="insp-title">${esc(spec.title)}</h2>
        <button class="insp-close" data-insp-close aria-label="Close details">&times;</button>
      </div>
      <div class="insp-body">${spec.body}</div>
    `;
    main.dataset.inspector = 'open';
    onCloseHook = spec.onClose || null;
    panel.scrollTop = 0;
  }

  function closeInspector() {
    const main = $('#main');
    if (main) main.dataset.inspector = 'closed';
    if (onCloseHook) {
      const fn = onCloseHook;
      onCloseHook = null;
      fn();
    }
  }

  function inspectorOpen() {
    const main = $('#main');
    return !!main && main.dataset.inspector === 'open';
  }

  /* ── lookups ─────────────────────────────────────────────────────────── */

  const keyById = (id) => Atlas.keys.find((k) => k.id === id) || null;
  const zoneById = (id) => Atlas.zones.find((z) => z.id === id) || null;
  const riskById = (id) => Atlas.risks.find((r) => r.id === id) || null;
  const flowById = (id) => Atlas.flows.find((f) => f.id === id) || null;

  /** Which chip tone represents a key's custody. */
  function keyTone(key) {
    if (key.public) return 'verd';
    if (key.zone === 'device-ram' || key.zone === 'ephemeral') return 'brass';
    return null;
  }

  /**
   * Render the standard inspector body for a key. Used from several views, so
   * a key looks the same wherever you click it.
   */
  function keyBody(key) {
    const zone = zoneById(key.zone);
    const opens = key.unlocks.map(keyById).filter(Boolean);
    const openedBy = key.unlockedBy.map(keyById).filter(Boolean);
    const envelopes = Atlas.envelopes.filter((e) => e.opensWith === key.id);

    const link = (k) =>
      `<button class="chip" data-key-link="${esc(k.id)}" style="cursor:pointer">${esc(k.name)}</button>`;

    return `
      <div class="insp-section">
        <p class="insp-text">${esc(key.summary)}</p>
        ${key.detail ? `<p class="insp-text">${esc(key.detail)}</p>` : ''}
      </div>

      <div class="insp-section">
        <div class="insp-label">Properties</div>
        <dl style="margin:0">
          ${row('Kind', esc(key.kind))}
          ${row('Size', esc(key.size))}
          ${row('Produced', `<span class="mono">${escLines(key.produced)}</span>`)}
          ${row('Lives in', zone ? esc(zone.name) : esc(key.zone))}
          ${row('At rest', esc(key.form))}
          ${row('Leaves device', key.crossesWire ? chip('yes', key.public ? 'verd' : 'brass') : chip('never'))}
        </dl>
      </div>

      ${
        openedBy.length
          ? `<div class="insp-section">
               <div class="insp-label">Opened by</div>
               <div style="display:flex;flex-wrap:wrap;gap:6px">${openedBy.map(link).join('')}</div>
             </div>`
          : ''
      }

      ${
        opens.length
          ? `<div class="insp-section">
               <div class="insp-label">Opens</div>
               <div style="display:flex;flex-wrap:wrap;gap:6px">${opens.map(link).join('')}</div>
             </div>`
          : ''
      }

      ${
        envelopes.length
          ? `<div class="insp-section">
               <div class="insp-label">Envelopes this key opens</div>
               ${envelopes
                 .map(
                   (e) => `
                 <div class="panel panel-tight" style="margin-bottom:7px">
                   <div class="mono" style="font-size:12px;color:var(--paper)">${esc(e.field)}</div>
                   <div style="font-size:12px;color:var(--paper-faint);margin-top:3px">
                     ${esc(e.holds)} &middot; ${esc(e.primitive)}
                   </div>
                 </div>`,
                 )
                 .join('')}
             </div>`
          : ''
      }

      ${
        key.code
          ? `<div class="insp-section">
               <div class="insp-label">Source</div>
               ${codeRef(key.code)}
             </div>`
          : ''
      }
    `;
  }

  /** Open the inspector on a key by id. */
  function inspectKey(id) {
    const key = keyById(id);
    if (!key) return;
    inspect({ kicker: key.group + ' key', title: key.name, body: keyBody(key) });
  }

  /* Delegated: any element with data-key-link opens that key. */
  document.addEventListener('click', (ev) => {
    const link = ev.target.closest('[data-key-link]');
    if (link) {
      inspectKey(link.dataset.keyLink);
      return;
    }
    if (ev.target.closest('[data-insp-close]')) closeInspector();
  });

  return {
    esc,
    escLines,
    $,
    $$,
    codeRef,
    row,
    chip,
    inspect,
    closeInspector,
    inspectorOpen,
    keyById,
    zoneById,
    riskById,
    flowById,
    keyTone,
    keyBody,
    inspectKey,
  };
})();
