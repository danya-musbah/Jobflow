// ============================================================
// JOBFLOW — js/contacts.js
// Contacts page: create, edit, delete, search, filter contacts.
// ============================================================

import * as api from "./api.js";
import {
  openModal,
  closeModal,
  confirmDialog,
  showError,
  showSuccess,
  renderLoading,
  renderEmptyState,
  renderErrorState,
} from "./ui.js";
import { validateContact, applyFormErrors } from "./validation.js";
import { escapeHtml, debounce } from "./utils.js";

let containerEl = null;
let search = "";

export function initContacts() {
  containerEl = document.getElementById("contacts-container");
  const section = document.querySelector('[data-view-name="contacts"]');
  if (section) {
    const observer = new MutationObserver(() => {
      if (!section.hidden) render();
    });
    observer.observe(section, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
}

async function render() {
  containerEl.innerHTML = `
    <div class="page-header">
      <div class="heading-block">
        <h1>Contacts</h1>
        <p>Recruiters, referrals, and hiring managers you're in touch with.</p>
      </div>
      <button type="button" class="btn btn-accent" id="add-contact-btn">+ Add Contact</button>
    </div>
    <div class="toolbar">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="m14 14-3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input type="search" id="contact-search" placeholder="Search by name, email, or role…" value="${escapeHtml(search)}" aria-label="Search contacts" />
      </div>
    </div>
    <div id="contacts-body"></div>
  `;
  containerEl
    .querySelector("#add-contact-btn")
    .addEventListener("click", () => openContactForm());
  containerEl.querySelector("#contact-search").addEventListener(
    "input",
    debounce((e) => {
      search = e.target.value;
      renderList();
    }, 300),
  );
  await renderList();
}

async function renderList() {
  const body = document.getElementById("contacts-body");
  renderLoading(body, "Loading contacts…");
  try {
    const contacts = await api.getContacts({ search });
    if (contacts.length === 0) {
      renderEmptyState(body, {
        title: search ? "No contacts match your search." : "No contacts yet.",
        message: search
          ? "Try a different search term."
          : "Add recruiters and hiring managers to keep track of who you know where.",
        actionLabel: search ? null : "Add Contact",
        onAction: () => openContactForm(),
      });
      return;
    }
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
        ${contacts
          .map(
            (c) => `
          <div class="card card-pad">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <h4 style="margin-bottom:2px;">${escapeHtml(c.name)}</h4>
                <div class="text-muted" style="font-size:13px;">${escapeHtml(c.position || "—")}${c.companies?.name ? " · " + escapeHtml(c.companies.name) : ""}</div>
              </div>
              <div style="display:flex;gap:4px;">
                <button type="button" class="btn btn-ghost btn-sm btn-icon" data-edit="${c.id}" aria-label="Edit ${escapeHtml(c.name)}">
                  <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-ghost btn-sm btn-icon" data-delete="${c.id}" aria-label="Delete ${escapeHtml(c.name)}">
                  <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div style="margin-top:10px;font-size:13.5px;display:flex;flex-direction:column;gap:4px;">
              ${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : ""}
              ${c.phone ? `<span class="text-muted">${escapeHtml(c.phone)}</span>` : ""}
              ${c.linkedin_url ? `<a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>` : ""}
            </div>
            ${c.notes ? `<p class="text-muted" style="margin-top:10px;font-size:13px;">${escapeHtml(c.notes)}</p>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    `;
    body.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () =>
        openContactForm(
          btn.dataset.edit,
          contacts.find((c) => c.id === btn.dataset.edit),
        ),
      ),
    );
    body.querySelectorAll("[data-delete]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const confirmed = await confirmDialog({
          title: "Delete contact?",
          message: "This cannot be undone.",
        });
        if (confirmed) {
          try {
            await api.deleteContact(btn.dataset.delete);
            showSuccess("Contact deleted.");
            renderList();
          } catch (err) {
            showError(err.message);
          }
        }
      }),
    );
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

async function openContactForm(id = null, existing = null) {
  const companies = await api.getCompanies().catch(() => []);
  const v = existing || {};
  const modalEl = openModal({
    title: id ? "Edit Contact" : "Add Contact",
    bodyHtml: `
      <form id="contact-form" novalidate>
        <div class="form-row">
          <div class="field"><label for="c-name">Name</label><input type="text" id="c-name" name="name" value="${escapeHtml(v.name || "")}" required /><span class="error-text"></span></div>
          <div class="field"><label for="c-position">Position</label><input type="text" id="c-position" name="position" value="${escapeHtml(v.position || "")}" /></div>
        </div>
        <div class="field">
          <label for="c-company">Company</label>
          <select id="c-company" name="company_id">
            <option value="">None</option>
            ${companies.map((co) => `<option value="${co.id}" ${v.company_id === co.id ? "selected" : ""}>${escapeHtml(co.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="field"><label for="c-email">Email</label><input type="email" id="c-email" name="email" value="${escapeHtml(v.email || "")}" /><span class="error-text"></span></div>
          <div class="field"><label for="c-phone">Phone</label><input type="tel" id="c-phone" name="phone" value="${escapeHtml(v.phone || "")}" /></div>
        </div>
        <div class="field"><label for="c-linkedin">LinkedIn URL</label><input type="url" id="c-linkedin" name="linkedin_url" value="${escapeHtml(v.linkedin_url || "")}" /><span class="error-text"></span></div>
        <div class="field"><label for="c-notes">Notes</label><textarea id="c-notes" name="notes">${escapeHtml(v.notes || "")}</textarea></div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" form="contact-form" class="btn btn-primary">${id ? "Save Changes" : "Add Contact"}</button>
    `,
  });
  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());
  modalEl
    .querySelector("#contact-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = validateContact(data);
      if (!applyFormErrors(form, errors)) return;
      const payload = {
        name: data.name.trim(),
        position: data.position || null,
        company_id: data.company_id || null,
        email: data.email || null,
        phone: data.phone || null,
        linkedin_url: data.linkedin_url || null,
        notes: data.notes || null,
      };
      try {
        if (id) await api.updateContact(id, payload);
        else await api.createContact(payload);
        showSuccess(id ? "Contact updated." : "Contact added.");
        closeModal();
        renderList();
      } catch (err) {
        showError(err.message);
      }
    });
}
