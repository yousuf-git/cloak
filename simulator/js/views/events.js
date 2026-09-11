/**
 * Events — the audit vocabulary.
 *
 * Useful as a lookup ("what does member:grant mean") and as a reminder of what
 * the trail deliberately does not contain.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.events = (function () {
  'use strict';
  const { esc, codeRef } = Atlas.ui;

  let filter = '';

  function groupHtml(group) {
    const q = filter.trim().toLowerCase();
    const actions = q
      ? group.actions.filter((a) => a.id.toLowerCase().includes(q) || a.blurb.toLowerCase().includes(q))
      : group.actions;
    if (!actions.length) return '';

    return `
      <div class="section" style="margin-top:26px">
        <h2 class="section-title">${esc(group.name)} <span style="color:var(--paper-faint);font-variation-settings:'wght' 400">${actions.length}</span></h2>
        <div class="grid-2">
          ${actions
            .map(
              (a) => `
            <div class="panel panel-tight" style="${a.weight === 'high' ? 'border-color:var(--brass-dim)' : ''}">
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;flex-wrap:wrap">
                <span class="mono" style="font-size:12.5px;color:${a.weight === 'high' ? 'var(--brass-lit)' : 'var(--paper)'}">${esc(a.id)}</span>
                ${a.weight === 'high' ? Atlas.ui.chip('key event', 'brass') : ''}
              </div>
              <p class="insp-text" style="font-size:12.5px">${esc(a.blurb)}</p>
            </div>`,
            )
            .join('')}
        </div>
      </div>`;
  }

  function paint(stage) {
    const html = Atlas.events.groups.map(groupHtml).join('');
    Atlas.ui.$('#event-groups', stage).innerHTML =
      html || `<p class="hint" style="margin-top:26px">Nothing matches &ldquo;${esc(filter)}&rdquo;.</p>`;
  }

  function render(stage) {
    filter = '';
    const total = Atlas.events.groups.reduce((n, g) => n + g.actions.length, 0);

    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Events</h1>
        <p class="stage-lede">
          ${total} audit actions across four groups. Every entry records org, actor, action, resource,
          IP, user agent and timestamp &mdash; and nothing else.
        </p>
      </div>

      <div class="panel">
        <p class="insp-text">${esc(Atlas.events.note)}</p>
        <div style="margin-top:11px">${codeRef(Atlas.events.code)}</div>
      </div>

      <div style="margin-top:22px">
        <input id="event-filter" class="palette-input"
               style="border:1px solid var(--steel);border-radius:7px;background:var(--ink-2);font-size:14px;padding:11px 14px"
               placeholder="Filter events" aria-label="Filter events">
      </div>

      <div id="event-groups"></div>
    `;

    paint(stage);
    const input = Atlas.ui.$('#event-filter', stage);
    input.addEventListener('input', () => {
      filter = input.value;
      paint(stage);
    });
  }

  function teardown() {}

  return { id: 'events', label: 'Events', hint: 'audit trail', title: 'Events', render, teardown };
})();
