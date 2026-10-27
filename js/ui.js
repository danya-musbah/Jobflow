// ============================================================
// JOBFLOW — js/ui.js
// Reusable UI plumbing: toasts, modals/dialogs, mobile nav,
// loading skeletons, and empty-state rendering. No Supabase
// logic lives here — this file is purely presentational.
// ============================================================

import { escapeHtml } from './utils.js';

/* ------------------------------------------------------------
   Toasts
   ------------------------------------------------------------ */
let toastRegion = null;

function getToastRegion() {
  if (!toastRegion) {
    toastRegion = document.getElementById('toast-region');
  }
  return toastRegion;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
export function showToast(message, type = 'info') {
  const region = getToastRegion();
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 220);
  }, 4200);
}

export function showError(message) {
  showToast(message, 'error');
}
export function showSuccess(message) {
  showToast(message, 'success');
}

/* ------------------------------------------------------------
   Modal / Dialog
   ------------------------------------------------------------ */
let activeModalOverlay = null;
let lastFocusedEl = null;

/**
 * Open a modal dialog.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.bodyHtml
 * @param {string} [opts.footerHtml]
 * @param {boolean} [opts.large]
 * @param {Function} [opts.onClose]
 * @returns {HTMLElement} the modal element, so callers can query inputs within it.
 */
export function openModal({ title, bodyHtml, footerHtml = '', large = false, onClose = null }) {
  closeModal(); // only one modal at a time
  lastFocusedEl = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${large ? 'modal-lg' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title-el">
      <div class="modal-header">
        <h2 id="modal-title-el">${escapeHtml(title)}</h2>
        <button type="button" class="modal-close" aria-label="Close dialog">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  activeModalOverlay = overlay;

  const modalEl = overlay.querySelector('.modal');

  const doClose = () => {
    overlay.remove();
    document.body.style.overflow = '';
    if (activeModalOverlay === overlay) activeModalOverlay = null;
    if (onClose) onClose();
    if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
  };

  overlay.querySelector('.modal-close').addEventListener('click', doClose);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) doClose(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') doClose();
    if (e.key === 'Tab') trapFocus(e, modalEl);
  });
  overlay.__close = doClose;

  // focus first focusable element
  const focusable = modalEl.querySelector('input, select, textarea, button:not(.modal-close)');
  (focusable || modalEl.querySelector('.modal-close')).focus();

  return modalEl;
}

export function closeModal() {
  if (activeModalOverlay && activeModalOverlay.__close) {
    activeModalOverlay.__close();
  }
}

function trapFocus(e, container) {
  const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

/** Simple promise-based confirmation dialog for destructive actions. */
export function confirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const modalEl = openModal({
      title,
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      footerHtml: `
        <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
      `,
      onClose: () => resolve(false),
    });
    modalEl.querySelector('[data-action="cancel"]').addEventListener('click', () => closeModal());
    modalEl.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      resolve(true);
      // prevent onClose from double-resolving with false
      activeModalOverlay.__close = () => {
        activeModalOverlay.parentElement && activeModalOverlay.remove();
        document.body.style.overflow = '';
        activeModalOverlay = null;
      };
      closeModal();
    });
  });
}

/* ------------------------------------------------------------
   Loading / Empty states
   ------------------------------------------------------------ */
export function renderLoading(container, message = 'Loading…') {
  container.innerHTML = `
    <div class="loading-row" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
    </div>`;
}

export function renderSkeletonRows(container, rows = 5) {
  container.innerHTML = Array.from({ length: rows }).map(() => `
    <div class="skeleton" style="height:52px;margin-bottom:10px;"></div>
  `).join('');
}

export function renderEmptyState(container, { title, message, actionLabel = null, onAction = null, icon = '' }) {
  container.innerHTML = `
    <div class="empty-state">
      ${icon}
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${actionLabel ? `<button type="button" class="btn btn-accent" id="empty-state-action">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
  if (actionLabel && onAction) {
    container.querySelector('#empty-state-action').addEventListener('click', onAction);
  }
}

export function renderErrorState(container, message = 'Something went wrong. Please try again.') {
  container.innerHTML = `
    <div class="empty-state">
      <h3>Couldn't load this</h3>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

/* ------------------------------------------------------------
   Navigation / view switching
   ------------------------------------------------------------ */
const VIEWS = ['dashboard', 'applications', 'interviews', 'contacts', 'analytics', 'settings'];

export function setActiveNav(viewName) {
  document.querySelectorAll('.sidebar-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === viewName);
    if (a.dataset.view === viewName) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

export function showView(viewName) {
  if (!VIEWS.includes(viewName)) viewName = 'dashboard';
  document.querySelectorAll('.app-view').forEach((v) => {
    v.hidden = v.dataset.viewName !== viewName;
  });
  setActiveNav(viewName);
  closeMobileSidebar();
  window.scrollTo({ top: 0 });
}

export function initMobileNav() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  if (!hamburger || !sidebar || !scrim) return;
  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    scrim.classList.toggle('show');
  });
  scrim.addEventListener('click', closeMobileSidebar);
}

export function closeMobileSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-scrim')?.classList.remove('show');
}
