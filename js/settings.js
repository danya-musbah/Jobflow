// ============================================================
// JOBFLOW — js/settings.js
// Settings page: Profile, Preferences, Security, Data sections.
// ============================================================

import * as api from './api.js';
import * as auth from './auth.js';
import { showError, showSuccess, confirmDialog, renderErrorState } from './ui.js';
import { escapeHtml, downloadTextFile, toCsv } from './utils.js';

let containerEl = null;
let activeSection = 'profile';

export function initSettings({ onSignedOut }) {
  containerEl = document.getElementById('settings-container');
  const section = document.querySelector('[data-view-name="settings"]');
  if (section) {
    const observer = new MutationObserver(() => { if (!section.hidden) render(); });
    observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
  }
}

async function render() {
  containerEl.innerHTML = `
    <div class="page-header"><div class="heading-block"><h1>Settings</h1><p>Manage your profile, preferences, and data.</p></div></div>
    <div class="tabs" role="tablist">
      <button type="button" class="tab-btn ${activeSection === 'profile' ? 'active' : ''}" data-section="profile">Profile</button>
      <button type="button" class="tab-btn ${activeSection === 'preferences' ? 'active' : ''}" data-section="preferences">Preferences</button>
      <button type="button" class="tab-btn ${activeSection === 'security' ? 'active' : ''}" data-section="security">Security</button>
      <button type="button" class="tab-btn ${activeSection === 'data' ? 'active' : ''}" data-section="data">Data</button>
    </div>
    <div id="settings-body" style="max-width:520px;"></div>
  `;
  containerEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => { activeSection = btn.dataset.section; render(); });
  });
  const body = document.getElementById('settings-body');
  try {
    if (activeSection === 'profile') await renderProfile(body);
    else if (activeSection === 'preferences') await renderPreferences(body);
    else if (activeSection === 'security') renderSecurity(body);
    else renderData(body);
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

async function renderProfile(body) {
  const profile = await api.getProfile();
  const user = await auth.getCurrentUser();
  body.innerHTML = `
    <form id="profile-form">
      <div class="field"><label for="s-name">Full Name</label><input type="text" id="s-name" name="full_name" value="${escapeHtml(profile?.full_name || '')}" /></div>
      <div class="field"><label for="s-email">Email</label><input type="email" id="s-email" value="${escapeHtml(user?.email || '')}" disabled /><span class="hint">Contact support to change your email.</span></div>
      <div class="field">
        <label for="s-timezone">Timezone</label>
        <select id="s-timezone" name="timezone">
          ${commonTimezones().map((tz) => `<option value="${tz}" ${profile?.timezone === tz ? 'selected' : ''}>${tz}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Profile</button>
    </form>
  `;
  body.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.updateProfile({ full_name: fd.get('full_name'), timezone: fd.get('timezone') });
      showSuccess('Profile updated.');
    } catch (err) { showError(err.message); }
  });
}

async function renderPreferences(body) {
  const profile = await api.getProfile();
  body.innerHTML = `
    <form id="prefs-form">
      <div class="field">
        <label for="p-view">Default View</label>
        <select id="p-view" name="default_view">
          <option value="table" ${profile?.default_view === 'table' ? 'selected' : ''}>Table</option>
          <option value="kanban" ${profile?.default_view === 'kanban' ? 'selected' : ''}>Kanban</option>
        </select>
      </div>
      <div class="field">
        <label for="p-sort">Default Sorting</label>
        <select id="p-sort" name="default_sort">
          <option value="updated_at_desc" ${profile?.default_sort === 'updated_at_desc' ? 'selected' : ''}>Recently updated</option>
          <option value="applied_at_desc" ${profile?.default_sort === 'applied_at_desc' ? 'selected' : ''}>Recently applied</option>
          <option value="deadline_asc" ${profile?.default_sort === 'deadline_asc' ? 'selected' : ''}>Deadline soonest</option>
        </select>
      </div>
      <div class="field">
        <label for="p-pagesize">Items Per Page</label>
        <select id="p-pagesize" name="items_per_page">
          ${[10, 20, 50].map((n) => `<option value="${n}" ${profile?.items_per_page === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Save Preferences</button>
    </form>
  `;
  body.querySelector('#prefs-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.updateProfile({
        default_view: fd.get('default_view'),
        default_sort: fd.get('default_sort'),
        items_per_page: Number(fd.get('items_per_page')),
      });
      showSuccess('Preferences saved.');
    } catch (err) { showError(err.message); }
  });
}

function renderSecurity(body) {
  body.innerHTML = `
    <div class="card card-pad" style="margin-bottom:16px;">
      <h3 style="margin-bottom:6px;">Password</h3>
      <p class="text-muted" style="margin-bottom:14px;">We'll email you a secure link to reset your password.</p>
      <button type="button" class="btn btn-secondary" id="send-reset-btn">Send Password Reset Email</button>
    </div>
    <div class="card card-pad">
      <h3 style="margin-bottom:6px;">Session</h3>
      <p class="text-muted" style="margin-bottom:14px;">Sign out of JobFlow on this device.</p>
      <button type="button" class="btn btn-danger" id="settings-logout-btn">Log Out</button>
    </div>
  `;
  body.querySelector('#send-reset-btn').addEventListener('click', async () => {
    try {
      const user = await auth.getCurrentUser();
      await auth.resetPasswordForEmail(user.email);
      showSuccess('Password reset email sent.');
    } catch (err) { showError(err.message); }
  });
  body.querySelector('#settings-logout-btn').addEventListener('click', async () => {
    try { await auth.signOut(); } catch (err) { showError(err.message); }
  });
}

function renderData(body) {
  body.innerHTML = `
    <div class="card card-pad" style="margin-bottom:16px;">
      <h3 style="margin-bottom:6px;">Export</h3>
      <p class="text-muted" style="margin-bottom:14px;">Download all your applications as a spreadsheet-friendly CSV.</p>
      <button type="button" class="btn btn-secondary" id="settings-export-btn">Export Applications (CSV)</button>
    </div>
    <div class="card card-pad" style="margin-bottom:16px;">
      <h3 style="margin-bottom:6px;">Import</h3>
      <p class="text-muted" style="margin-bottom:14px;">Import applications from a CSV file — available from the Applications page.</p>
    </div>
    <div class="card card-pad" style="border-color:var(--danger);">
      <h3 style="margin-bottom:6px;color:var(--danger);">Delete Account</h3>
      <p class="text-muted" style="margin-bottom:14px;">Permanently delete your account and all associated data. This cannot be undone.</p>
      <button type="button" class="btn btn-danger" id="delete-account-btn">Delete My Account</button>
    </div>
  `;
  body.querySelector('#settings-export-btn').addEventListener('click', async () => {
    try {
      const apps = await api.getAllApplicationsForUser();
      const flat = apps.map((a) => ({
        company: a.companies?.name || '', job_title: a.job_title, status: a.status, priority: a.priority,
        location: a.location, applied_at: a.applied_at,
      }));
      downloadTextFile('jobflow-applications.csv', toCsv(flat), 'text/csv');
      showSuccess('Export ready — check your downloads.');
    } catch (err) { showError(err.message); }
  });
  body.querySelector('#delete-account-btn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently deletes your profile and all applications, companies, interviews, contacts, notes, and reminders. This cannot be undone. Account deletion requires an authenticated request to a Supabase Edge Function (see README) since it must remove the underlying auth.users row using admin privileges.',
      confirmLabel: 'Delete Account',
    });
    if (confirmed) {
      showError('Account deletion requires the optional delete-account Edge Function to be deployed. See the README for setup — this keeps the service-role key safely server-side.');
    }
  });
}

function commonTimezones() {
  return [
    'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Tripoli',
    'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
    'Australia/Sydney',
  ];
}
