// ============================================================
// JOBFLOW — js/dashboard.js
// Renders the Dashboard view: greeting, metrics, funnel,
// upcoming reminders, and recent activity. All numbers come
// straight from Supabase via api.js — nothing is hard-coded.
// ============================================================

import * as api from './api.js';
import { getProfile } from './api.js';
import { renderErrorState } from './ui.js';
import { escapeHtml, formatDate, formatDateTime, humanizeEnum } from './utils.js';
import { supabase } from './supabase.js';

let onNavigateCallback = null;

export function initDashboard({ onNavigate }) {
  onNavigateCallback = onNavigate;
  renderDashboard();
}

async function renderDashboard() {
  const container = document.getElementById('dashboard-container');
  try {
    const [profile, metrics, funnel, reminderGroups] = await Promise.all([
      getProfile(),
      api.getDashboardMetrics(),
      api.getFunnelData(),
      api.getGroupedReminders(),
    ]);

    const { data: userData } = await supabase.auth.getUser();
    const firstName = (profile?.full_name || userData?.user?.email?.split('@')[0] || 'there').split(' ')[0];
    const greeting = getGreeting();

    if (metrics.total === 0) {
      container.innerHTML = `
        <div class="page-header">
          <div class="heading-block">
            <span class="eyebrow">${greeting}</span>
            <h1>Hi, ${escapeHtml(firstName)}.</h1>
            <p>Here's where your job search stands.</p>
          </div>
        </div>
        <div class="empty-state">
          <h3>Your job search starts here.</h3>
          <p>Add your first application to start tracking your progress.</p>
          <button type="button" class="btn btn-accent" id="dash-add-app">Add Application</button>
        </div>
      `;
      container.querySelector('#dash-add-app').addEventListener('click', () => {
        onNavigateCallback('applications', { params: { action: 'add' } });
      });
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <div class="heading-block">
          <span class="eyebrow">${greeting}</span>
          <h1>Hi, ${escapeHtml(firstName)}.</h1>
          <p>Here's where your job search stands.</p>
        </div>
        <button type="button" class="btn btn-accent" id="dash-add-app">+ Add Application</button>
      </div>

      <div class="metrics-grid">
        ${metricCard('Total Applications', metrics.total, '', '')}
        ${metricCard('This Month', metrics.thisMonth, '', 'accent-lilac')}
        ${metricCard('Interviews', metrics.interviews, '', 'accent-terracotta')}
        ${metricCard('Offers', metrics.offers, '', '')}
        ${metricCard('Accepted', metrics.accepted, '', 'accent-lilac')}
        ${metricCard('Rejected', metrics.rejected, '', '')}
        ${metricCard('Response Rate', metrics.responseRate + '%', '', 'accent-terracotta')}
        ${metricCard('Interview Rate', metrics.interviewRate + '%', '', '')}
        ${metricCard('Offer Rate', metrics.offerRate + '%', '', 'accent-lilac')}
      </div>

      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:start;" id="dash-columns">
        <div class="chart-card">
          <h3>Application Funnel</h3>
          <div id="dash-funnel"></div>
        </div>
        <div class="chart-card">
          <h3>Reminders</h3>
          <div id="dash-reminders"></div>
        </div>
      </div>
    `;

    container.querySelector('#dash-add-app').addEventListener('click', () => {
      onNavigateCallback('applications', { params: { action: 'add' } });
    });

    // responsive: stack columns on narrow screens
    const cols = document.getElementById('dash-columns');
    const applyLayout = () => { cols.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '1.4fr 1fr'; };
    applyLayout();
    window.addEventListener('resize', applyLayout);

    renderFunnel(document.getElementById('dash-funnel'), funnel);
    renderReminders(document.getElementById('dash-reminders'), reminderGroups);
  } catch (err) {
    renderErrorState(container, err.message);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function metricCard(label, value, sub, accentClass) {
  return `
    <div class="metric-card ${accentClass}">
      <span class="eyebrow">${escapeHtml(label)}</span>
      <div class="metric-value">${value}</div>
      ${sub ? `<div class="metric-sub">${escapeHtml(sub)}</div>` : ''}
    </div>`;
}

function renderFunnel(container, funnelData) {
  const max = Math.max(...funnelData.map((f) => f.count), 1);
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${funnelData.map((f) => {
        const width = Math.max((f.count / max) * 100, f.count > 0 ? 4 : 0);
        return `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
              <span style="font-weight:600;">${humanizeEnum(f.stage)}</span>
              <span class="text-muted">${f.count}</span>
            </div>
            <div style="background:var(--surface-sunken);border-radius:6px;height:14px;overflow:hidden;">
              <div style="background:var(--deep-lilac);height:100%;width:${width}%;border-radius:6px;transition:width 400ms ease;"></div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderReminders(container, groups) {
  const sections = [
    ['overdue', 'Overdue'],
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['upcoming', 'Upcoming'],
  ];
  const hasAny = sections.some(([key]) => groups[key].length > 0);
  if (!hasAny) {
    container.innerHTML = `<p class="text-muted" style="font-size:13.5px;">No reminders yet. Add one from an application's detail view to stay on top of follow-ups.</p>`;
    return;
  }
  container.innerHTML = sections.map(([key, label]) => {
    if (!groups[key].length) return '';
    return `
      <div style="margin-bottom:16px;">
        <div class="eyebrow" style="margin-bottom:8px;">${label} (${groups[key].length})</div>
        ${groups[key].slice(0, 4).map((r) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:13.5px;font-weight:600;">${escapeHtml(r.title)}</div>
            <div style="font-size:12px;color:var(--ink-faint);">
              ${r.applications?.job_title ? escapeHtml(r.applications.job_title) + ' · ' : ''}${formatDateTime(r.remind_at)}
            </div>
          </div>
        `).join('')}
      </div>`;
  }).join('');
}

export { renderDashboard };
