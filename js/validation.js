// ============================================================
// JOBFLOW — js/validation.js
// Lightweight form validation shared across every form in the app.
// Each validator returns an array of { field, message } errors.
// ============================================================

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export function isUrl(value) {
  if (!value) return true; // optional field
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function required(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** Validate the "Add / Edit Application" form. */
export function validateApplication(data) {
  const errors = [];
  if (!required(data.job_title)) errors.push({ field: 'job_title', message: 'Job title is required.' });
  if (!required(data.company_name)) errors.push({ field: 'company_name', message: 'Company is required.' });
  if (data.job_url && !isUrl(data.job_url)) errors.push({ field: 'job_url', message: 'Enter a valid URL (starting with http:// or https://).' });
  if (data.contact_email && !isEmail(data.contact_email)) errors.push({ field: 'contact_email', message: 'Enter a valid email address.' });
  if (data.salary_min && data.salary_max && Number(data.salary_min) > Number(data.salary_max)) {
    errors.push({ field: 'salary_max', message: 'Maximum salary must be greater than or equal to minimum salary.' });
  }
  if (data.salary_min && Number(data.salary_min) < 0) errors.push({ field: 'salary_min', message: 'Salary cannot be negative.' });
  if (data.salary_max && Number(data.salary_max) < 0) errors.push({ field: 'salary_max', message: 'Salary cannot be negative.' });
  if (data.deadline && data.applied_at && data.deadline < data.applied_at) {
    errors.push({ field: 'deadline', message: 'Deadline should be after the applied date.' });
  }
  return errors;
}

export function validateInterview(data) {
  const errors = [];
  if (!required(data.type)) errors.push({ field: 'type', message: 'Interview type is required.' });
  if (!required(data.scheduled_at)) errors.push({ field: 'scheduled_at', message: 'Date and time are required.' });
  if (data.duration_minutes && Number(data.duration_minutes) <= 0) {
    errors.push({ field: 'duration_minutes', message: 'Duration must be a positive number.' });
  }
  return errors;
}

export function validateContact(data) {
  const errors = [];
  if (!required(data.name)) errors.push({ field: 'name', message: 'Name is required.' });
  if (data.email && !isEmail(data.email)) errors.push({ field: 'email', message: 'Enter a valid email address.' });
  if (data.linkedin_url && !isUrl(data.linkedin_url)) errors.push({ field: 'linkedin_url', message: 'Enter a valid URL.' });
  return errors;
}

export function validateReminder(data) {
  const errors = [];
  if (!required(data.title)) errors.push({ field: 'title', message: 'Title is required.' });
  if (!required(data.remind_at)) errors.push({ field: 'remind_at', message: 'Reminder date/time is required.' });
  return errors;
}

export function validateCompany(data) {
  const errors = [];
  if (!required(data.name)) errors.push({ field: 'name', message: 'Company name is required.' });
  if (data.website && !isUrl(data.website)) errors.push({ field: 'website', message: 'Enter a valid URL.' });
  return errors;
}

export function validateSignUp(data) {
  const errors = [];
  if (!isEmail(data.email)) errors.push({ field: 'email', message: 'Enter a valid email address.' });
  if (!data.password || data.password.length < 8) errors.push({ field: 'password', message: 'Password must be at least 8 characters.' });
  if (data.password !== data.confirmPassword) errors.push({ field: 'confirmPassword', message: 'Passwords do not match.' });
  return errors;
}

export function validateSignIn(data) {
  const errors = [];
  if (!isEmail(data.email)) errors.push({ field: 'email', message: 'Enter a valid email address.' });
  if (!required(data.password)) errors.push({ field: 'password', message: 'Password is required.' });
  return errors;
}

/**
 * Apply an errors array to a <form> element: adds .has-error to each
 * .field wrapper and fills in its .error-text. Clears prior errors first.
 */
export function applyFormErrors(formEl, errors) {
  formEl.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  formEl.querySelectorAll('.error-text').forEach((e) => { e.textContent = ''; });
  for (const err of errors) {
    const input = formEl.querySelector(`[name="${err.field}"]`);
    const fieldWrap = input ? input.closest('.field') : null;
    if (fieldWrap) {
      fieldWrap.classList.add('has-error');
      const errEl = fieldWrap.querySelector('.error-text');
      if (errEl) errEl.textContent = err.message;
    }
  }
  return errors.length === 0;
}
