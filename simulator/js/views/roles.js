/**
 * Roles — authorization, and the line where it stops being cryptographic.
 *
 * The single most important thing on this page is the note at the top: every
 * active member holds the same Org DEK, so roles govern writes, not reads.
 * A viewer can decrypt everything a member can.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.roles = (function () {
  'use strict';
  const { esc, codeRef } = Atlas.ui;

  const ORDER = ['viewer', 'member', 'admin', 'owner'];

  function render(stage) {
    const R = Atlas.roles;

    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Roles and states</h1>
        <p class="stage-lede">
          Four roles, six capabilities, and one boundary that is easy to misread.
        </p>
      </div>

      <div class="panel panel-brass">
        <p class="insp-text"><strong>Roles are authorization, not cryptography.</strong></p>
        <p class="insp-text" style="margin-top:8px">${esc(R.note)}</p>
        <div style="margin-top:11px">${codeRef(R.code)}</div>
      </div>

      <div class="section">
        <h2 class="section-title">Capability matrix</h2>
        <table class="matrix">
          <thead>
            <tr>
              <th style="width:190px">Capability</th>
              ${ORDER.map((r) => `<th style="width:96px">${esc(r)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${R.actions
              .map(
                (a) => `
              <tr>
                <td class="rowhead">
                  <div class="mono" style="font-size:12px">${esc(a.id)}</div>
                  <div style="font-size:11.5px;color:var(--paper-faint);font-family:var(--sans)">${esc(a.blurb)}</div>
                </td>
                ${ORDER.map((role) => {
                  const yes = R.matrix[role].includes(a.id);
                  return `<td class="${yes ? 'cell-yes' : 'cell-no'}">${yes ? '&#9679; yes' : '&mdash;'}</td>`;
                }).join('')}
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <p class="hint" style="margin-top:12px">${esc(R.rankNote)}
          Ranking: ${ORDER.map((r) => `${esc(r)}&nbsp;${R.rank[r]}`).join(', ')}.
        </p>
      </div>

      <div class="section">
        <h2 class="section-title">Membership lifecycle</h2>
        <p class="stage-lede" style="font-size:14px;margin-bottom:15px">
          Three separate moments, recorded separately, because they are genuinely different events:
          the invitation was sent, they accepted it, and someone finally sealed the key to them.
          Only the third one grants read access.
        </p>
        <div class="grid-2">
          ${Atlas.membershipStates
            .map(
              (s) => `
            <div class="panel" style="border-left:2px solid ${s.canRead ? 'var(--brass)' : 'var(--steel-lit)'}">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap">
                <h3 class="mono" style="margin:0;font-size:13.5px;color:var(--paper)">${esc(s.name)}</h3>
                ${
                  s.canRead
                    ? Atlas.ui.chip('can decrypt', 'brass')
                    : Atlas.ui.chip('sees nothing')
                }
                ${s.risk ? `<button class="chip chip-rust" data-risk="${esc(s.risk)}" style="cursor:pointer">caveat</button>` : ''}
              </div>
              <p class="insp-text" style="font-size:12.5px">${esc(s.blurb)}</p>
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">Client auth states</h2>
        <p class="stage-lede" style="font-size:14px;margin-bottom:15px">
          The desktop app is a state machine. Only the last of these has keys in memory.
        </p>
        <div class="grid-3">
          ${Atlas.authStates
            .map(
              (s) => `
            <div class="panel panel-tight" style="${s.id === 'unlocked' ? 'border-color:var(--brass-dim);background:rgba(201,162,39,.05)' : ''}">
              <div class="mono" style="font-size:12.5px;color:${s.id === 'unlocked' ? 'var(--brass-lit)' : 'var(--paper)'};margin-bottom:5px">${esc(s.id)}</div>
              <p class="insp-text" style="font-size:12.5px">${esc(s.blurb)}</p>
            </div>`,
            )
            .join('')}
        </div>
      </div>
    `;

    stage.addEventListener('click', onClick);
  }

  function onClick(ev) {
    const risk = ev.target.closest('[data-risk]');
    if (risk) {
      const r = Atlas.ui.riskById(risk.dataset.risk);
      if (r) Atlas.views.risks.inspectRisk(r);
    }
  }

  function teardown(stage) {
    stage.removeEventListener('click', onClick);
  }

  return { id: 'roles', label: 'Roles', hint: 'who can what', title: 'Roles and states', render, teardown };
})();
