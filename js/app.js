// ============================================================
// JOBFLOW — js/app.js
// Application bootstrap: session detection, auth form wiring,
// view routing, and sidebar/topbar chrome. Feature modules
// (dashboard.js, applications.js, etc.) each export an init()
// that renders into their own <section class="app-view"> container
// and are only called once we know a session exists.
// ============================================================

import { supabase } from './supabase.js';
import * as auth from './auth.js';
import * as api from './api.js';
import { showView, showError, showSuccess, initMobileNav, closeModal } from './ui.js';
import { validateSignIn, validateSignUp, applyFormErrors, isEmail } from './validation.js';
import { initials, getQueryParams, setQueryParams } from './utils.js';

import { initDashboard } from './dashboard.js';
import { initApplications, openView as openApplicationsView } from './applications.js';
import { initInterviews } from './interviews.js';
import { initContacts } from './contacts.js';
import { initAnalytics } from './analytics.js';
import { initSettings } from './settings.js';

const bootScreen = document.getElementById('boot-screen');
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');

let currentUser = null;
let modulesInitialized = false;

/* ------------------------------------------------------------
   Boot sequence
   ------------------------------------------------------------ */
async function boot() {
  wireAuthForms();
  wireAppChrome();
  initMobileNav();

  // Handle password-recovery links: Supabase puts the user into a
  // temporary "recovery" session and fires PASSWORD_RECOVERY.
  auth.listenForAuthChanges(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      bootScreen.hidden = true;
      appScreen.hidden = true;
      authScreen.hidden = false;
      switchAuthForm('reset-password');
      return;
    }
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser = session?.user ?? null;
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      modulesInitialized = false;
      showAuthScreen();
    }
  });

  const session = await auth.getSession();
  bootScreen.hidden = true;

  const params = getQueryParams();
  if (params.view === 'reset-password' && window.location.hash.includes('type=recovery')) {
    authScreen.hidden = false;
    switchAuthForm('reset-password');
    return;
  }

  if (session?.user) {
    currentUser = session.user;
    await showAppScreen();
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  authScreen.hidden = false;
  appScreen.hidden = true;
}

async function showAppScreen() {
  authScreen.hidden = true;
  appScreen.hidden = false;

  await populateSidebarUser();

  if (!modulesInitialized) {
    modulesInitialized = true;
    initDashboard({ onNavigate: navigateTo });
    initApplications();
    initInterviews();
    initContacts();
    initAnalytics();
    initSettings({ onSignedOut: () => { /* handled by SIGNED_OUT listener */ } });
  }

  const params = getQueryParams();
  const requestedView = params.view && params.view !== 'reset-password' ? params.view : 'dashboard';
  navigateTo(requestedView, { fromUrl: true, params });
}

async function populateSidebarUser() {
  try {
    const profile = await api.getProfile();
    const name = profile?.full_name || currentUser?.email?.split('@')[0] || 'there';
    document.getElementById('sidebar-user-name').textContent = name;
    document.getElementById('sidebar-user-email').textContent = currentUser?.email || '';
    document.getElementById('sidebar-avatar').textContent = initials(name);
  } catch (err) {
    document.getElementById('sidebar-user-email').textContent = currentUser?.email || '';
  }
}

/* ------------------------------------------------------------
   Routing
   ------------------------------------------------------------ */
function navigateTo(viewName, { fromUrl = false, params = {} } = {}) {
  showView(viewName);
  if (!fromUrl) setQueryParams({ view: viewName === 'dashboard' ? null : viewName });

  if (viewName === 'applications') {
    openApplicationsView(params);
  }
}

/* ------------------------------------------------------------
   App chrome: sidebar nav clicks, logout
   ------------------------------------------------------------ */
function wireAppChrome() {
  document.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.view);
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await auth.signOut();
      showSuccess('You have been logged out.');
    } catch (err) {
      showError(err.message || 'Could not log out. Please try again.');
    }
  });
}

/* ------------------------------------------------------------
   Auth forms: sign in / sign up / forgot password / reset password
   ------------------------------------------------------------ */
function switchAuthForm(name) {
  document.querySelectorAll('.auth-form').forEach((f) => {
    f.hidden = f.dataset.form !== name;
  });
}

function wireAuthForms() {
  document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthForm(link.dataset.switch);
    });
  });

  // ---- sign in ----
  const signinForm = document.getElementById('signin-form');
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('signin-error');
    errorBox.classList.remove('show');
    const fd = new FormData(signinForm);
    const payload = { email: fd.get('email').trim(), password: fd.get('password') };
    const errors = validateSignIn(payload);
    if (!applyFormErrors(signinForm, errors)) return;

    const submitBtn = signinForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in…';
    try {
      await auth.signIn(payload.email, payload.password);
      currentUser = await auth.getCurrentUser();
      await showAppScreen();
      showSuccess('Welcome back!');
    } catch (err) {
      errorBox.textContent = friendlyAuthError(err);
      errorBox.classList.add('show');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });

  // ---- sign up ----
  const signupForm = document.getElementById('signup-form');
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('signup-error');
    errorBox.classList.remove('show');
    const fd = new FormData(signupForm);
    const payload = {
      fullName: fd.get('fullName').trim(),
      email: fd.get('email').trim(),
      password: fd.get('password'),
      confirmPassword: fd.get('confirmPassword'),
    };
    const errors = validateSignUp(payload);
    if (!applyFormErrors(signupForm, errors)) return;

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';
    try {
      const data = await auth.signUp(payload.email, payload.password, payload.fullName);
      if (data.session) {
        currentUser = data.user;
        await showAppScreen();
        showSuccess('Account created! Welcome to JobFlow.');
      } else {
        // Email confirmation is required by the Supabase project's Auth settings.
        errorBox.classList.remove('show');
        const successMsg = document.createElement('div');
        showSuccess('Check your email to confirm your account, then sign in.');
        switchAuthForm('signin');
      }
    } catch (err) {
      errorBox.textContent = friendlyAuthError(err);
      errorBox.classList.add('show');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });

  // ---- forgot password ----
  const forgotForm = document.getElementById('forgot-form');
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('forgot-error');
    const successBox = document.getElementById('forgot-success');
    errorBox.classList.remove('show');
    successBox.classList.remove('show');
    const fd = new FormData(forgotForm);
    const email = fd.get('email').trim();
    if (!isEmail(email)) {
      errorBox.textContent = 'Enter a valid email address.';
      errorBox.classList.add('show');
      return;
    }
    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await auth.resetPasswordForEmail(email);
      successBox.textContent = 'If an account exists for that email, a reset link is on its way.';
      successBox.classList.add('show');
    } catch (err) {
      errorBox.textContent = friendlyAuthError(err);
      errorBox.classList.add('show');
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---- reset password (from email link) ----
  const resetForm = document.getElementById('reset-form');
  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('reset-error');
    errorBox.classList.remove('show');
    const fd = new FormData(resetForm);
    const password = fd.get('password');
    if (!password || password.length < 8) {
      errorBox.textContent = 'Password must be at least 8 characters.';
      errorBox.classList.add('show');
      return;
    }
    const submitBtn = resetForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating…';
    try {
      await auth.updatePassword(password);
      showSuccess('Password updated. You are now signed in.');
      currentUser = await auth.getCurrentUser();
      setQueryParams({ view: null });
      window.location.hash = '';
      await showAppScreen();
    } catch (err) {
      errorBox.textContent = friendlyAuthError(err);
      errorBox.classList.add('show');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update password';
    }
  });
}

function friendlyAuthError(err) {
  const msg = err?.message || '';
  if (/invalid login credentials/i.test(msg)) return 'Incorrect email or password.';
  if (/already registered/i.test(msg)) return 'An account with this email already exists.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.';
  if (/network/i.test(msg)) return 'Network error. Check your connection and try again.';
  return msg || 'Something went wrong. Please try again.';
}

boot();
