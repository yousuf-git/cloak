/**
 * Flows — step through what actually happens, one operation at a time.
 *
 * The player exists because these sequences are the thing people get wrong when
 * they read them as prose: which side computes what, and in what order. Walking
 * a step at a time makes the ordering impossible to skim past.
 */
window.Atlas = window.Atlas || {};
Atlas.views = Atlas.views || {};

Atlas.views.flows = (function () {
  'use strict';
  const { esc, escLines, codeRef } = Atlas.ui;

  const ACTOR_LABEL = {
    user: 'person',
    device: 'device',
    wire: 'wire',
    server: 'server',
  };

  let current = 'signup';
  let cursor = 0; /* index of the active step */
  let timer = null;

  const flow = () => Atlas.ui.flowById(current);

  /* ── playback ─────────────────────────────────────────────────────────── */

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function play(stage) {
    if (timer) {
      stop();
      paint(stage);
      return;
    }
    if (cursor >= flow().steps.length - 1) cursor = -1;
    timer = setInterval(() => {
      if (cursor >= flow().steps.length - 1) {
        stop();
        paint(stage);
        return;
      }
      cursor += 1;
      paint(stage);
      scrollToActive(stage);
    }, 2100);
    paint(stage);
  }

  function scrollToActive(stage) {
    const el = Atlas.ui.$('.step[data-state="active"]', stage);
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.scrollIntoView({ block: 'center' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* ── render ───────────────────────────────────────────────────────────── */

  function stepHtml(step, index) {
    const state = index < cursor ? 'seen' : index === cursor ? 'active' : 'ahead';
    const risk = step.risk ? Atlas.ui.riskById(step.risk) : null;

    return `
      <div class="step" data-state="${state}" data-step="${index}">
        <div class="step-gutter">
          <span class="step-dot"></span>
          <span class="step-line"></span>
        </div>
        <div class="step-body">
          <div class="step-meta">
            <span class="step-actor" data-actor="${esc(step.actor)}">${esc(ACTOR_LABEL[step.actor] || step.actor)}</span>
            ${(step.produces || [])
              .map((p) => {
                const k = Atlas.ui.keyById(p);
                return k
                  ? `<button class="chip chip-brass" data-key-link="${esc(k.id)}" style="cursor:pointer">${esc(k.name)}</button>`
                  : '';
              })
              .join('')}
            ${risk ? `<button class="chip chip-rust" data-risk="${esc(risk.id)}" style="cursor:pointer">weak point</button>` : ''}
          </div>
          <h3 class="step-title">${esc(step.title)}</h3>
          ${step.compute ? `<pre class="code-block step-compute">${escLines(step.compute)}</pre>` : ''}
          ${step.detail ? `<p class="step-detail" style="margin-top:9px">${esc(step.detail)}</p>` : ''}
          ${step.code ? `<div style="margin-top:9px">${codeRef(step.code)}</div>` : ''}
        </div>
      </div>`;
  }

  function paint(stage) {
    const f = flow();
    const total = f.steps.length;
    const pct = Math.round(((cursor + 1) / total) * 100);

    Atlas.ui.$('#flow-tabs', stage).innerHTML = Atlas.flows
      .map(
        (x) => `
      <button class="flow-tab" data-flow="${esc(x.id)}" aria-selected="${x.id === current}">
        ${esc(x.name)}
      </button>`,
      )
      .join('');

    Atlas.ui.$('#flow-head', stage).innerHTML = `
      <h2 style="margin:0 0 7px;font-size:20px;font-variation-settings:'wdth' 110,'wght' 680">${esc(f.name)}</h2>
      <p class="stage-lede" style="font-size:14.5px;margin-bottom:10px">${esc(f.lede)}</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${Atlas.ui.chip('Entry: ' + f.entry)}
        ${codeRef(f.code)}
      </div>`;

    Atlas.ui.$('#player', stage).innerHTML = `
      <button class="pbtn pbtn-primary" data-act="play">
        ${timer ? '&#10073;&#10073; Pause' : '&#9654; Play'}
      </button>
      <button class="pbtn" data-act="prev" ${cursor <= 0 ? 'disabled' : ''}>Back</button>
      <button class="pbtn" data-act="next" ${cursor >= total - 1 ? 'disabled' : ''}>Next</button>
      <button class="pbtn" data-act="reset">Reset</button>
      <div class="ptrack"><div class="pfill" style="width:${pct}%"></div></div>
      <span class="pcount">${cursor + 1} / ${total}</span>`;

    Atlas.ui.$('#steps', stage).innerHTML = f.steps.map(stepHtml).join('');
  }

  function render(stage) {
    current = 'signup';
    cursor = 0;
    stop();

    stage.innerHTML = `
      <div class="stage-head">
        <h1 class="stage-title">Flows</h1>
        <p class="stage-lede">
          Six operations, each broken into the steps that actually occur.
          Watch which side of the boundary does the work &mdash; in every one of these,
          the interesting computation happens on the device.
        </p>
      </div>

      <div class="flow-layout">
        <div class="flow-list" id="flow-tabs"></div>
        <div style="min-width:0">
          <div id="flow-head" style="margin-bottom:18px"></div>
          <div class="player" id="player"></div>
          <div class="steps" id="steps"></div>
        </div>
      </div>
    `;

    paint(stage);
    stage.addEventListener('click', onClick);
    stage._paint = () => paint(stage);
  }

  function onClick(ev) {
    const stage = ev.currentTarget;

    const tab = ev.target.closest('[data-flow]');
    if (tab) {
      stop();
      current = tab.dataset.flow;
      cursor = 0;
      paint(stage);
      return;
    }

    const risk = ev.target.closest('[data-risk]');
    if (risk) {
      const r = Atlas.ui.riskById(risk.dataset.risk);
      if (r) Atlas.views.risks.inspectRisk(r);
      return;
    }

    const step = ev.target.closest('[data-step]');
    if (step && !ev.target.closest('[data-key-link]') && !ev.target.closest('[data-risk]')) {
      stop();
      cursor = Number(step.dataset.step);
      paint(stage);
      return;
    }

    const act = ev.target.closest('[data-act]');
    if (!act) return;
    const total = flow().steps.length;

    switch (act.dataset.act) {
      case 'play':
        play(stage);
        break;
      case 'prev':
        stop();
        cursor = Math.max(0, cursor - 1);
        paint(stage);
        scrollToActive(stage);
        break;
      case 'next':
        stop();
        cursor = Math.min(total - 1, cursor + 1);
        paint(stage);
        scrollToActive(stage);
        break;
      case 'reset':
        stop();
        cursor = 0;
        paint(stage);
        break;
    }
  }

  function teardown(stage) {
    stop();
    stage.removeEventListener('click', onClick);
  }

  /** Used by the command palette to jump straight into a flow. */
  function open(flowId) {
    current = flowId;
    cursor = 0;
  }

  return { id: 'flows', label: 'Flows', hint: 'step through', title: 'Flows', render, teardown, open };
})();
