// ============================================================
// JOBFLOW — js/analytics.js
// Analytics page: metrics + charts (hand-rolled responsive SVG,
// no charting library / npm dependency needed) + dynamic insights
// generated from the user's real data only.
// ============================================================

import * as api from './api.js';
import { renderErrorState } from './ui.js';
import { escapeHtml, humanizeEnum } from './utils.js';

let containerEl = null;

export function initAnalytics() {
  containerEl = document.getElementById('analytics-container');
  const section = document.querySelector('[data-view-name="analytics"]');
  if (section) {
    const observer = new MutationObserver(() => { if (!section.hidden) render(); });
    observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
  }
}

async function render() {
  containerEl.innerHTML = `<div class="loading-row"><span class="spinner"></span><span>Loading analytics…</span></div>`;
  try {
    const a = await api.getAnalytics();

    if (a.total === 0) {
      containerEl.innerHTML = `
        <div class="page-header"><div class="heading-block"><h1>Analytics</h1><p>Insights from your job search.</p></div></div>
        <div class="empty-state">
          <h3>There isn't enough data yet.</h3>
          <p>Add a few applications and check back — your funnel, sources, and rates will show up here.</p>
        </div>`;
      return;
    }

    containerEl.innerHTML = `
      <div class="page-header"><div class="heading-block"><h1>Analytics</h1><p>Insights from your job search.</p></div></div>

      <div class="metrics-grid">
        ${metric('Interview Rate', pctLabel(a.interviewRate))}
        ${metric('Response Rate', pctLabel(a.responseRate))}
        ${metric('Offer Rate', pctLabel(a.offerRate))}
        ${metric('Total Applications', a.total)}
      </div>

      <div id="insights"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px;" id="chart-grid">
        <div class="chart-card"><h3>Applications Over Time</h3><div class="chart-wrap" id="chart-time"></div></div>
        <div class="chart-card"><h3>By Status</h3><div class="chart-wrap" id="chart-status"></div></div>
        <div class="chart-card"><h3>By Source</h3><div class="chart-wrap" id="chart-source"></div></div>
        <div class="chart-card"><h3>By Employment Type</h3><div class="chart-wrap" id="chart-employment"></div></div>
        <div class="chart-card"><h3>By Work Mode</h3><div class="chart-wrap" id="chart-workmode"></div></div>
        <div class="chart-card"><h3>Top Companies</h3><div class="chart-wrap" id="chart-company"></div></div>
      </div>
    `;

    const grid = document.getElementById('chart-grid');
    const applyLayout = () => { grid.style.gridTemplateColumns = window.innerWidth < 860 ? '1fr' : '1fr 1fr'; };
    applyLayout();
    window.addEventListener('resize', applyLayout);

    renderInsights(document.getElementById('insights'), a);
    renderLineChart(document.getElementById('chart-time'), a.overTime);
    renderBarChart(document.getElementById('chart-status'), a.byStatus, (k) => humanizeEnum(k));
    renderBarChart(document.getElementById('chart-source'), a.bySource, (k) => k);
    renderBarChart(document.getElementById('chart-employment'), a.byEmploymentType, (k) => humanizeEnum(k));
    renderBarChart(document.getElementById('chart-workmode'), a.byWorkMode, (k) => humanizeEnum(k));
    renderBarChart(document.getElementById('chart-company'), a.byCompany, (k) => k, 6);
  } catch (err) {
    renderErrorState(containerEl, err.message);
  }
}

function pctLabel(v) {
  return v === null || v === undefined ? '—' : `${v}%`;
}

function metric(label, value) {
  return `
    <div class="metric-card">
      <span class="eyebrow">${escapeHtml(label)}</span>
      <div class="metric-value">${value}</div>
    </div>`;
}

/* ------------------------------------------------------------
   Dynamic insights — only ever describes real computed data.
   ------------------------------------------------------------ */
function renderInsights(container, a) {
  const insights = [];

  if (a.interviewRate !== null && a.total >= 3) {
    insights.push(`Your interview rate is ${a.interviewRate}%.`);
  }

  const sourceEntries = Object.entries(a.sourceConversion).filter(([, v]) => v.total >= 2 && v.rate !== null);
  if (sourceEntries.length >= 2) {
    const best = sourceEntries.sort((x, y) => y[1].rate - x[1].rate)[0];
    insights.push(`${escapeHtml(best[0])} currently has your highest interview conversion rate, at ${best[1].rate}%.`);
  }

  const monthKeys = Object.keys(a.overTime).sort();
  if (monthKeys.length >= 1) {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const isCurrentMonthMax = monthKeys.every((k) => a.overTime[k] <= a.overTime[currentMonthKey] || 0);
    const maxMonth = monthKeys.reduce((best, k) => (a.overTime[k] > a.overTime[best] ? k : best), monthKeys[0]);
    if (a.overTime[currentMonthKey] && a.overTime[currentMonthKey] === Math.max(...Object.values(a.overTime))) {
      insights.push(`You submitted the most applications this month (${a.overTime[currentMonthKey]}).`);
    }
  }

  if (a.offers > 0) {
    insights.push(`You've received ${a.offers} offer${a.offers === 1 ? '' : 's'} so far.`);
  }

  if (insights.length === 0) {
    container.innerHTML = `<div class="insight-card"><p>There isn't enough data yet to generate insights. Keep tracking applications and check back soon.</p></div>`;
    return;
  }

  container.innerHTML = insights.map((text) => `<div class="insight-card"><p>${text}</p></div>`).join('');
}

/* ------------------------------------------------------------
   Charts — hand-rolled responsive SVG, zero dependencies.
   ------------------------------------------------------------ */
function renderBarChart(container, dataObj, labelFn, limit = 9) {
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (entries.length === 0) { container.innerHTML = `<p class="text-muted" style="font-size:13px;">Not enough data yet.</p>`; return; }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${entries.map(([key, value]) => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px;">
            <span>${escapeHtml(labelFn(key))}</span><span class="text-muted">${value}</span>
          </div>
          <div style="background:var(--surface-sunken);border-radius:5px;height:10px;overflow:hidden;">
            <div style="background:var(--terracotta);height:100%;width:${(value / max) * 100}%;border-radius:5px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLineChart(container, overTimeObj) {
  const keys = Object.keys(overTimeObj).sort();
  if (keys.length === 0) { container.innerHTML = `<p class="text-muted" style="font-size:13px;">Not enough data yet.</p>`; return; }
  const values = keys.map((k) => overTimeObj[k]);
  const max = Math.max(...values, 1);
  const w = 520, h = 180, pad = 30;
  const stepX = keys.length > 1 ? (w - pad * 2) / (keys.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (v / max) * (h - pad * 2);
    return [x, y];
  });
  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`;

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;" role="img" aria-label="Applications submitted per month">
      <path d="${areaD}" fill="var(--lilac-light)" />
      <path d="${pathD}" fill="none" stroke="var(--deep-lilac)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${points.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--deep-lilac)"/>`).join('')}
      ${keys.map((k, i) => `<text x="${(pad + i * stepX).toFixed(1)}" y="${h - 8}" font-size="10" fill="var(--ink-faint)" text-anchor="middle">${escapeHtml(monthLabel(k))}</text>`).join('')}
    </svg>
  `;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short' });
}
