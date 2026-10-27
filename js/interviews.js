// ============================================================
// JOBFLOW — js/interviews.js
// Interviews page: upcoming + past interviews, pulled from every
// application. Editing happens through the application detail
// drawer (applications.js) to keep interview context attached
// to its parent application.
// ============================================================

import * as api from './api.js';
import { renderLoading, renderEmptyState, renderErrorState } from './ui.js';
import { escapeHtml, formatDateTime, humanizeEnum } from './utils.js';

let containerEl = null;
let activeTab = 'upcoming';

export function initInterviews() {
  containerEl = document.getElementById('interviews-container');
  const observer = new MutationObserver(() => {
    const section = document.querySelector('[data-view-name="interviews"]');
    if (section && !section.hidden) render();
  });
  const section = document.querySelector('[data-view-name="interviews"]');
  if (section) observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
}

async function render() {
  containerEl.innerHTML = `
    <div class="page-header">
      <div class="heading-block">
        <h1>Interviews</h1>
        <p>Every interview across all your applications.</p>
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button type="button" class="tab-btn ${activeTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">Upcoming</button>
      <button type="button" class="tab-btn ${activeTab === 'past' ? 'active' : ''}" data-tab="past">Past</button>
    </div>
    <div id="interviews-body"></div>
  `;
  containerEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(); });
  });
  await renderList();
}

async function renderList() {
  const body = document.getElementById('interviews-body');
  renderLoading(body, 'Loading interviews…');
  try {
    const interviews = await api.getInterviews({ upcoming: activeTab === 'upcoming' });
    if (interviews.length === 0) {
      renderEmptyState(body, {
        title: activeTab === 'upcoming' ? 'No upcoming interviews.' : 'No past interviews yet.',
        message: activeTab === 'upcoming'
          ? 'Interviews you schedule from an application will show up here.'
          : 'Completed interviews will appear here once their date passes.',
      });
      return;
    }
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${interviews.map((i) => `
          <div class="card card-pad">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <div>
                <div style="font-weight:700;">${escapeHtml(i.applications?.job_title || 'Application')}</div>
                <div class="text-muted" style="font-size:13px;">${escapeHtml(i.applications?.companies?.name || '—')}</div>
              </div>
              <span class="badge" style="background:var(--surface-sunken);color:var(--ink-soft);">${humanizeEnum(i.result)}</span>
            </div>
            <div style="margin-top:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:13.5px;">
              <span><strong>${humanizeEnum(i.type)}</strong></span>
              <span class="text-muted">${formatDateTime(i.scheduled_at)}</span>
              <span class="text-muted">${i.duration_minutes || 60} min</span>
              ${i.location ? `<span class="text-muted">${escapeHtml(i.location)}</span>` : ''}
              ${i.interviewer ? `<span class="text-muted">With ${escapeHtml(i.interviewer)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    renderErrorState(body, err.message);
  }
}
