// ============================================================
// JOBFLOW — js/applications.js
// The Applications page: search, filter, sort, paginate; table
// and Kanban views; add/edit/delete; detail drawer with
// interviews/notes/reminders/activity; CSV import/export.
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
import {
  validateApplication,
  validateInterview,
  validateReminder,
  applyFormErrors,
} from "./validation.js";
import {
  escapeHtml,
  formatDate,
  formatDateTime,
  formatSalary,
  humanizeEnum,
  debounce,
  getQueryParams,
  setQueryParams,
  downloadTextFile,
  toCsv,
  parseCsv,
  uiPrefs,
} from "./utils.js";

const STATUSES = [
  "SAVED",
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "TECHNICAL_INTERVIEW",
  "OFFER",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const WORK_MODES = ["REMOTE", "HYBRID", "ONSITE"];
const EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "INTERNSHIP",
  "CONTRACT",
  "FREELANCE",
  "TEMPORARY",
];
const SOURCES = [
  "LinkedIn",
  "Indeed",
  "Company Website",
  "Glassdoor",
  "Referral",
  "University",
  "Recruiter",
  "Job Board",
  "Other",
];
const KANBAN_COLUMNS = STATUSES;

let state = {
  view: uiPrefs.get("applicationsView", "table"),
  page: 1,
  pageSize: 20,
  search: "",
  status: "",
  priority: "",
  workMode: "",
  employmentType: "",
  source: "",
  sortBy: "updated_at",
  sortDir: "desc",
};

let containerEl = null;

export function initApplications() {
  containerEl = document.getElementById("applications-container");
}

/** Called by app.js router whenever the Applications view is opened. */
export function openView(params = {}) {
  if (params.status) state.status = params.status;
  render();
  if (params.action === "add") {
    setTimeout(() => openApplicationForm(), 50);
  }
}

async function render() {
  containerEl.innerHTML = `
    <div class="page-header">
      <div class="heading-block">
        <h1>Applications</h1>
        <p>Every role you're tracking, in one place.</p>
      </div>
      <button type="button" class="btn btn-accent" id="add-app-btn">+ Add Application</button>
    </div>

    <div class="toolbar">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="m14 14-3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input type="search" id="app-search" placeholder="Search by title, location, contact…" value="${escapeHtml(state.search)}" aria-label="Search applications" />
      </div>
      <div class="view-toggle" role="group" aria-label="Switch view">
        <button type="button" data-view-mode="table" class="${state.view === "table" ? "active" : ""}">Table</button>
        <button type="button" data-view-mode="kanban" class="${state.view === "kanban" ? "active" : ""}">Kanban</button>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" id="import-btn">Import CSV</button>
      <button type="button" class="btn btn-secondary btn-sm" id="export-btn">Export</button>
    </div>

    <div class="filter-bar" id="filter-bar"></div>

    <div id="app-view-body"></div>
  `;

  renderFilterBar();
  wireToolbar();

  if (state.view === "table") await renderTableView();
  else await renderKanbanView();
}

function wireToolbar() {
  const searchInput = document.getElementById("app-search");
  searchInput.addEventListener(
    "input",
    debounce((e) => {
      state.search = e.target.value;
      state.page = 1;
      refreshBody();
    }, 350),
  );

  document.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.viewMode;
      uiPrefs.set("applicationsView", state.view);
      document
        .querySelectorAll("[data-view-mode]")
        .forEach((b) => b.classList.toggle("active", b === btn));
      refreshBody();
    });
  });

  document
    .getElementById("add-app-btn")
    .addEventListener("click", () => openApplicationForm());
  document
    .getElementById("import-btn")
    .addEventListener("click", () => openImportDialog());
  document
    .getElementById("export-btn")
    .addEventListener("click", () => openExportDialog());
}

function renderFilterBar() {
  const bar = document.getElementById("filter-bar");
  bar.innerHTML = `
    ${selectFilter("status", "All statuses", STATUSES, state.status)}
    ${selectFilter("priority", "All priorities", PRIORITIES, state.priority)}
    ${selectFilter("workMode", "All work modes", WORK_MODES, state.workMode)}
    ${selectFilter("employmentType", "All employment types", EMPLOYMENT_TYPES, state.employmentType)}
    ${selectFilter("source", "All sources", SOURCES, state.source, true)}
    ${hasActiveFilters() ? `<button type="button" class="btn btn-ghost btn-sm" id="clear-filters-btn">Clear filters</button>` : ""}
  `;
  bar.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", () => {
      state[sel.dataset.key] = sel.value;
      state.page = 1;
      setQueryParams({ status: state.status || null });
      refreshBody();
      renderFilterBar();
    });
  });
  document
    .getElementById("clear-filters-btn")
    ?.addEventListener("click", () => {
      state = {
        ...state,
        status: "",
        priority: "",
        workMode: "",
        employmentType: "",
        source: "",
        page: 1,
      };
      setQueryParams({ status: null });
      refreshBody();
      renderFilterBar();
    });
}

function hasActiveFilters() {
  return (
    state.status ||
    state.priority ||
    state.workMode ||
    state.employmentType ||
    state.source
  );
}

function selectFilter(key, allLabel, options, current, rawLabels = false) {
  return `
    <select data-key="${key}" aria-label="${escapeHtml(allLabel)}">
      <option value="">${escapeHtml(allLabel)}</option>
      ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === current ? "selected" : ""}>${rawLabels ? escapeHtml(o) : escapeHtml(humanizeEnum(o))}</option>`).join("")}
    </select>`;
}

async function refreshBody() {
  if (state.view === "table") await renderTableView();
  else await renderKanbanView();
}

/* ============================================================
   TABLE VIEW
   ============================================================ */
async function renderTableView() {
  const body = document.getElementById("app-view-body");
  renderLoading(body, "Loading applications…");
  try {
    const { rows, total } = await api.getApplications({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search,
      status: state.status,
      priority: state.priority,
      workMode: state.workMode,
      employmentType: state.employmentType,
      source: state.source,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
    });

    if (total === 0) {
      renderEmptyState(body, {
        title:
          state.search || hasActiveFilters()
            ? "No applications match your filters."
            : "Your job search starts here.",
        message:
          state.search || hasActiveFilters()
            ? "Try a different search term or clear your filters."
            : "Add your first application to start tracking your progress.",
        actionLabel: "Add Application",
        onAction: () => openApplicationForm(),
      });
      return;
    }

    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

    body.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${sortableHeader("Company", null)}
              ${sortableHeader("Position", "job_title")}
              ${sortableHeader("Status", "status")}
              ${sortableHeader("Priority", "priority")}
              <th>Location</th>
              <th>Work Mode</th>
              ${sortableHeader("Applied", "applied_at")}
              ${sortableHeader("Updated", "updated_at")}
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(rowHtml).join("")}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span class="page-info">Showing ${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, total)} of ${total}</span>
        <div class="page-controls">
          <button type="button" class="btn btn-secondary btn-sm" id="prev-page" ${state.page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${state.page} of ${totalPages}</span>
          <button type="button" class="btn btn-secondary btn-sm" id="next-page" ${state.page >= totalPages ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;

    body.querySelectorAll("th button[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.sort;
        if (state.sortBy === col)
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        else {
          state.sortBy = col;
          state.sortDir = "asc";
        }
        renderTableView();
      });
    });

    body.querySelectorAll("[data-open-id]").forEach((el) => {
      el.addEventListener("click", () =>
        openApplicationDetail(el.dataset.openId),
      );
    });
    body.querySelectorAll("[data-edit-id]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        openApplicationForm(el.dataset.editId);
      });
    });
    body.querySelectorAll("[data-delete-id]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = await confirmDialog({
          title: "Delete application?",
          message:
            "This permanently deletes the application and its interviews, notes, and reminders. This cannot be undone.",
        });
        if (confirmed) {
          try {
            await api.deleteApplication(el.dataset.deleteId);
            showSuccess("Application deleted.");
            refreshBody();
          } catch (err) {
            showError(err.message);
          }
        }
      });
    });

    document.getElementById("prev-page")?.addEventListener("click", () => {
      state.page--;
      renderTableView();
    });
    document.getElementById("next-page")?.addEventListener("click", () => {
      state.page++;
      renderTableView();
    });
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

function sortableHeader(label, col) {
  if (!col) return `<th>${label}</th>`;
  const active = state.sortBy === col;
  const arrow = active ? (state.sortDir === "asc" ? "↑" : "↓") : "";
  return `<th><button type="button" data-sort="${col}">${label} ${arrow}</button></th>`;
}

function rowHtml(a) {
  return `
    <tr data-open-id="${a.id}" style="cursor:pointer;">
      <td data-label="Company"><span class="cell-company">${escapeHtml(a.companies?.name || "—")}</span></td>
      <td data-label="Position">${escapeHtml(a.job_title)}</td>
      <td data-label="Status"><span class="badge badge-status-${a.status}">${humanizeEnum(a.status)}</span></td>
      <td data-label="Priority"><span class="badge badge-priority-${a.priority}">${humanizeEnum(a.priority)}</span></td>
      <td data-label="Location">${escapeHtml(a.location || "—")}</td>
      <td data-label="Work Mode">${a.work_mode ? humanizeEnum(a.work_mode) : "—"}</td>
      <td data-label="Applied">${formatDate(a.applied_at)}</td>
      <td data-label="Updated">${formatDate(a.updated_at)}</td>
      <td data-label="Actions">
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm btn-icon" data-open-id="${a.id}" aria-label="View ${escapeHtml(a.job_title)}" title="View">
            <i class="fa-solid fa-eye" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon" data-edit-id="${a.id}" aria-label="Edit ${escapeHtml(a.job_title)}" title="Edit">
            <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-ghost btn-sm btn-icon" data-delete-id="${a.id}" aria-label="Delete ${escapeHtml(a.job_title)}" title="Delete">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

/* ============================================================
   KANBAN VIEW
   ============================================================ */
async function renderKanbanView() {
  const body = document.getElementById("app-view-body");
  renderLoading(body, "Loading board…");
  try {
    const applications = await api.getAllApplicationsForUser();
    const filtered = applications.filter((a) => {
      if (state.search) {
        const s = state.search.toLowerCase();
        const hay =
          `${a.job_title} ${a.location || ""} ${a.companies?.name || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (state.priority && a.priority !== state.priority) return false;
      if (state.workMode && a.work_mode !== state.workMode) return false;
      if (state.employmentType && a.employment_type !== state.employmentType)
        return false;
      if (state.source && a.source !== state.source) return false;
      return true;
    });

    if (applications.length === 0) {
      renderEmptyState(body, {
        title: "Your job search starts here.",
        message: "Add your first application to start tracking your progress.",
        actionLabel: "Add Application",
        onAction: () => openApplicationForm(),
      });
      return;
    }

    body.innerHTML = `
      <div class="kanban-board">
        ${KANBAN_COLUMNS.map((status) => {
          const items = filtered.filter((a) => a.status === status);
          return `
            <div class="kanban-column">
              <div class="kanban-column-header">
                <span class="badge badge-status-${status}">${humanizeEnum(status)}</span>
                <span class="kanban-column-count">${items.length}</span>
              </div>
              <div class="kanban-column-body" data-status="${status}">
                ${items.map(kanbanCardHtml).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>
    `;

    wireKanbanDnD(body);
    body.querySelectorAll(".kanban-card").forEach((card) => {
      card.addEventListener("click", () =>
        openApplicationDetail(card.dataset.id),
      );
    });
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

function kanbanCardHtml(a) {
  return `
    <div class="kanban-card" draggable="true" data-id="${a.id}" tabindex="0" role="button" aria-label="${escapeHtml(a.job_title)} at ${escapeHtml(a.companies?.name || "unknown company")}">
      <h4>${escapeHtml(a.job_title)}</h4>
      <div class="kc-company">${escapeHtml(a.companies?.name || "—")}</div>
      <div class="kc-meta">
        <span class="badge badge-priority-${a.priority}">${humanizeEnum(a.priority)}</span>
        ${a.work_mode ? `<span class="badge" style="background:var(--surface-sunken);color:var(--ink-soft);">${humanizeEnum(a.work_mode)}</span>` : ""}
      </div>
      <div class="kc-date">Applied ${formatDate(a.applied_at)}</div>
    </div>`;
}

function wireKanbanDnD(body) {
  let draggedId = null;
  let originalStatus = null;

  body.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedId = card.dataset.id;
      originalStatus = card.closest(".kanban-column-body").dataset.status;
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });

  body.querySelectorAll(".kanban-column-body").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const newStatus = col.dataset.status;
      if (!draggedId || newStatus === originalStatus) return;

      const cardEl = body.querySelector(`.kanban-card[data-id="${draggedId}"]`);
      // 1. optimistic UI update
      col.appendChild(cardEl);
      updateColumnCount(col);
      updateColumnCount(
        body.querySelector(
          `.kanban-column-body[data-status="${originalStatus}"]`,
        ),
      );

      // 2. persist to Supabase, 3. activity logged automatically by DB trigger
      try {
        await api.updateApplicationStatus(draggedId, newStatus);
        showSuccess(`Moved to ${humanizeEnum(newStatus)}.`);
      } catch (err) {
        // 4. roll back on failure
        const originalCol = body.querySelector(
          `.kanban-column-body[data-status="${originalStatus}"]`,
        );
        originalCol.appendChild(cardEl);
        updateColumnCount(col);
        updateColumnCount(originalCol);
        showError("Could not update status: " + err.message);
      }
    });
  });
}

function updateColumnCount(colBody) {
  const countEl = colBody
    .closest(".kanban-column")
    .querySelector(".kanban-column-count");
  countEl.textContent = colBody.querySelectorAll(".kanban-card").length;
}

/* ============================================================
   ADD / EDIT APPLICATION FORM
   ============================================================ */
async function openApplicationForm(applicationId = null) {
  let existing = null;
  if (applicationId) {
    try {
      existing = await api.getApplication(applicationId);
    } catch (err) {
      showError(err.message);
      return;
    }
  }

  const modalEl = openModal({
    title: existing ? "Edit Application" : "Add Application",
    large: true,
    bodyHtml: applicationFormHtml(existing),
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" form="application-form" class="btn btn-primary">${existing ? "Save Changes" : "Add Application"}</button>
    `,
  });

  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());

  const form = modalEl.querySelector("#application-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    const errors = validateApplication(data);
    if (!applyFormErrors(form, errors)) return;

    const submitBtn = modalEl.querySelector('[form="application-form"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
    try {
      const company = await api.findOrCreateCompany(data.company_name);
      const payload = {
        company_id: company.id,
        job_title: data.job_title.trim(),
        job_url: data.job_url || null,
        location: data.location || null,
        employment_type: data.employment_type || null,
        work_mode: data.work_mode || null,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        currency: data.currency || "USD",
        status: data.status || "SAVED",
        priority: data.priority || "MEDIUM",
        source: data.source || null,
        applied_at: data.applied_at || null,
        deadline: data.deadline || null,
        description: data.description || null,
        contact_name: data.contact_name || null,
        contact_email: data.contact_email || null,
      };
      if (existing) {
        await api.updateApplication(existing.id, payload);
        showSuccess("Application updated.");
      } else {
        await api.createApplication(payload);
        showSuccess("Application added.");
      }
      closeModal();
      refreshBody();
    } catch (err) {
      showError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = existing ? "Save Changes" : "Add Application";
    }
  });
}

function applicationFormHtml(a) {
  const v = a || {};
  const companyName = a?.companies?.name || "";
  return `
    <form id="application-form" novalidate>
      <div class="form-row">
        <div class="field">
          <label for="f-company">Company</label>
          <input type="text" id="f-company" name="company_name" value="${escapeHtml(companyName)}" required list="company-list" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="f-title">Job Title</label>
          <input type="text" id="f-title" name="job_title" value="${escapeHtml(v.job_title || "")}" required />
          <span class="error-text"></span>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="f-url">Job URL</label>
          <input type="url" id="f-url" name="job_url" value="${escapeHtml(v.job_url || "")}" placeholder="https://…" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="f-location">Location</label>
          <input type="text" id="f-location" name="location" value="${escapeHtml(v.location || "")}" />
        </div>
      </div>
      <div class="form-row-3">
        <div class="field">
          <label for="f-employment">Employment Type</label>
          <select id="f-employment" name="employment_type">
            <option value="">Select…</option>
            ${EMPLOYMENT_TYPES.map((t) => `<option value="${t}" ${v.employment_type === t ? "selected" : ""}>${humanizeEnum(t)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-workmode">Work Mode</label>
          <select id="f-workmode" name="work_mode">
            <option value="">Select…</option>
            ${WORK_MODES.map((t) => `<option value="${t}" ${v.work_mode === t ? "selected" : ""}>${humanizeEnum(t)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-source">Source</label>
          <select id="f-source" name="source">
            <option value="">Select…</option>
            ${SOURCES.map((t) => `<option value="${t}" ${v.source === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="field">
          <label for="f-salary-min">Salary Min</label>
          <input type="number" id="f-salary-min" name="salary_min" min="0" value="${v.salary_min ?? ""}" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="f-salary-max">Salary Max</label>
          <input type="number" id="f-salary-max" name="salary_max" min="0" value="${v.salary_max ?? ""}" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="f-currency">Currency</label>
          <select id="f-currency" name="currency">
            ${["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => `<option value="${c}" ${(v.currency || "USD") === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="field">
          <label for="f-status">Status</label>
          <select id="f-status" name="status">
            ${STATUSES.map((s) => `<option value="${s}" ${(v.status || "SAVED") === s ? "selected" : ""}>${humanizeEnum(s)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-priority">Priority</label>
          <select id="f-priority" name="priority">
            ${PRIORITIES.map((p) => `<option value="${p}" ${(v.priority || "MEDIUM") === p ? "selected" : ""}>${humanizeEnum(p)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-applied">Applied Date</label>
          <input type="date" id="f-applied" name="applied_at" value="${v.applied_at || ""}" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="f-deadline">Deadline</label>
          <input type="date" id="f-deadline" name="deadline" value="${v.deadline || ""}" />
          <span class="error-text"></span>
        </div>
        <div class="field">
          <label for="f-contact-name">Contact Name</label>
          <input type="text" id="f-contact-name" name="contact_name" value="${escapeHtml(v.contact_name || "")}" />
        </div>
      </div>
      <div class="field">
        <label for="f-contact-email">Contact Email</label>
        <input type="email" id="f-contact-email" name="contact_email" value="${escapeHtml(v.contact_email || "")}" />
        <span class="error-text"></span>
      </div>
      <div class="field">
        <label for="f-description">Description</label>
        <textarea id="f-description" name="description">${escapeHtml(v.description || "")}</textarea>
      </div>
    </form>
  `;
}

/* ============================================================
   APPLICATION DETAIL VIEW
   ============================================================ */
async function openApplicationDetail(id) {
  const modalEl = openModal({
    title: "Loading…",
    large: true,
    bodyHtml:
      '<div class="loading-row"><span class="spinner"></span><span>Loading application…</span></div>',
  });
  try {
    const app = await api.getApplication(id);
    modalEl.querySelector("#modal-title-el").textContent = app.job_title;
    modalEl.querySelector(".modal-body").innerHTML = detailHtml(app);
    wireDetailTabs(modalEl, app);
  } catch (err) {
    modalEl.querySelector(".modal-body").innerHTML =
      `<p class="text-muted">Couldn't load this application: ${escapeHtml(err.message)}</p>`;
  }
}

function detailHtml(a) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <div>
        <div class="eyebrow">${escapeHtml(a.companies?.name || "—")}</div>
        <h2 style="margin:2px 0 8px;">${escapeHtml(a.job_title)}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-status-${a.status}">${humanizeEnum(a.status)}</span>
          <span class="badge badge-priority-${a.priority}">${humanizeEnum(a.priority)}</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="button" class="btn btn-secondary btn-sm" id="detail-edit-btn">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" id="detail-delete-btn">Delete</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Salary</div><div class="detail-value">${formatSalary(a.salary_min, a.salary_max, a.currency)}</div></div>
      <div class="detail-item"><div class="detail-label">Location</div><div class="detail-value">${escapeHtml(a.location || "—")}</div></div>
      <div class="detail-item"><div class="detail-label">Work Mode</div><div class="detail-value">${a.work_mode ? humanizeEnum(a.work_mode) : "—"}</div></div>
      <div class="detail-item"><div class="detail-label">Employment</div><div class="detail-value">${a.employment_type ? humanizeEnum(a.employment_type) : "—"}</div></div>
      <div class="detail-item"><div class="detail-label">Applied</div><div class="detail-value">${formatDate(a.applied_at)}</div></div>
      <div class="detail-item"><div class="detail-label">Deadline</div><div class="detail-value">${formatDate(a.deadline)}</div></div>
      <div class="detail-item"><div class="detail-label">Source</div><div class="detail-value">${escapeHtml(a.source || "—")}</div></div>
      <div class="detail-item"><div class="detail-label">Job URL</div><div class="detail-value">${a.job_url ? `<a href="${escapeHtml(a.job_url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : "—"}</div></div>
    </div>

    ${a.description ? `<p class="text-muted" style="margin-bottom:20px;">${escapeHtml(a.description)}</p>` : ""}

    <div class="tabs" role="tablist">
      <button type="button" class="tab-btn active" data-tab="interviews" role="tab">Interviews</button>
      <button type="button" class="tab-btn" data-tab="notes" role="tab">Notes</button>
      <button type="button" class="tab-btn" data-tab="reminders" role="tab">Reminders</button>
      <button type="button" class="tab-btn" data-tab="activity" role="tab">Activity</button>
    </div>
    <div id="detail-tab-body"></div>
  `;
}

function wireDetailTabs(modalEl, app) {
  modalEl.querySelector("#detail-edit-btn").addEventListener("click", () => {
    closeModal();
    openApplicationForm(app.id);
  });
  modalEl
    .querySelector("#detail-delete-btn")
    .addEventListener("click", async () => {
      const confirmed = await confirmDialog({
        title: "Delete application?",
        message:
          "This permanently deletes the application and its interviews, notes, and reminders. This cannot be undone.",
      });
      if (confirmed) {
        try {
          await api.deleteApplication(app.id);
          showSuccess("Application deleted.");
          closeModal();
          refreshBody();
        } catch (err) {
          showError(err.message);
        }
      }
    });

  const tabButtons = modalEl.querySelectorAll(".tab-btn");
  const loadTab = (tab) => {
    tabButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab),
    );
    const body = modalEl.querySelector("#detail-tab-body");
    if (tab === "interviews") loadInterviewsTab(body, app);
    else if (tab === "notes") loadNotesTab(body, app);
    else if (tab === "reminders") loadRemindersTab(body, app);
    else loadActivityTab(body, app);
  };
  tabButtons.forEach((b) =>
    b.addEventListener("click", () => loadTab(b.dataset.tab)),
  );
  loadTab("interviews");
}

async function loadInterviewsTab(body, app) {
  renderLoading(body, "Loading interviews…");
  try {
    const interviews = await api.getInterviewsForApplication(app.id);
    body.innerHTML = `
      <div style="margin-bottom:12px;"><button type="button" class="btn btn-secondary btn-sm" id="add-interview-btn">+ Schedule Interview</button></div>
      ${
        interviews.length === 0
          ? '<p class="text-muted">No interviews scheduled yet.</p>'
          : interviews
              .map(
                (i) => `
        <div class="card card-pad" style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;">
            <strong>${humanizeEnum(i.type)}</strong>
            <span class="badge" style="background:var(--surface-sunken);color:var(--ink-soft);">${humanizeEnum(i.result)}</span>
          </div>
          <div class="text-muted" style="font-size:13px;margin-top:4px;">${formatDateTime(i.scheduled_at)} · ${i.duration_minutes || 60} min ${i.location ? "· " + escapeHtml(i.location) : ""}</div>
          ${i.interviewer ? `<div class="text-muted" style="font-size:13px;">With ${escapeHtml(i.interviewer)}</div>` : ""}
          ${i.notes ? `<p style="margin-top:8px;font-size:13.5px;">${escapeHtml(i.notes)}</p>` : ""}
        </div>
      `,
              )
              .join("")
      }
    `;
    body
      .querySelector("#add-interview-btn")
      .addEventListener("click", () =>
        openInterviewForm(app.id, () => loadInterviewsTab(body, app)),
      );
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

async function loadNotesTab(body, app) {
  renderLoading(body, "Loading notes…");
  try {
    const notes = await api.getNotesForApplication(app.id);
    body.innerHTML = `
      <form id="add-note-form" style="margin-bottom:16px;">
        <div class="field">
          <label for="note-input" class="visually-hidden">Add a note</label>
          <textarea id="note-input" name="content" placeholder="Add a note about this application…" required></textarea>
        </div>
        <button type="submit" class="btn btn-secondary btn-sm">Add Note</button>
      </form>
      ${
        notes.length === 0
          ? '<p class="text-muted">No notes yet.</p>'
          : notes
              .map(
                (n) => `
        <div class="card card-pad" style="margin-bottom:10px;">
          <p style="margin-bottom:6px;">${escapeHtml(n.content)}</p>
          <div class="text-muted" style="font-size:12px;">${formatDateTime(n.created_at)}</div>
        </div>
      `,
              )
              .join("")
      }
    `;
    body
      .querySelector("#add-note-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const content = body.querySelector("#note-input").value.trim();
        if (!content) return;
        try {
          await api.createNote(app.id, content);
          loadNotesTab(body, app);
        } catch (err) {
          showError(err.message);
        }
      });
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

async function loadRemindersTab(body, app) {
  renderLoading(body, "Loading reminders…");
  try {
    const all = await api.getReminders();
    const forApp = all.filter((r) => r.application_id === app.id);
    body.innerHTML = `
      <div style="margin-bottom:12px;"><button type="button" class="btn btn-secondary btn-sm" id="add-reminder-btn">+ Add Reminder</button></div>
      ${
        forApp.length === 0
          ? '<p class="text-muted">No reminders for this application.</p>'
          : forApp
              .map(
                (r) => `
        <div class="card card-pad" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <div style="font-weight:600;${r.completed ? "text-decoration:line-through;color:var(--ink-faint);" : ""}">${escapeHtml(r.title)}</div>
            <div class="text-muted" style="font-size:12.5px;">${formatDateTime(r.remind_at)}</div>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" data-reminder-id="${r.id}" ${r.completed ? "checked" : ""} aria-label="Mark ${escapeHtml(r.title)} complete" />
          </label>
        </div>
      `,
              )
              .join("")
      }
    `;
    body
      .querySelector("#add-reminder-btn")
      .addEventListener("click", () =>
        openReminderForm(app.id, () => loadRemindersTab(body, app)),
      );
    body.querySelectorAll("[data-reminder-id]").forEach((cb) => {
      cb.addEventListener("change", async () => {
        try {
          await api.completeReminder(cb.dataset.reminderId, cb.checked);
          loadRemindersTab(body, app);
        } catch (err) {
          showError(err.message);
        }
      });
    });
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

async function loadActivityTab(body, app) {
  renderLoading(body, "Loading activity…");
  try {
    const activity = await api.getActivityForApplication(app.id);
    if (activity.length === 0) {
      body.innerHTML = '<p class="text-muted">No activity yet.</p>';
      return;
    }
    body.innerHTML = `
      <div class="timeline">
        ${activity
          .map(
            (ac) => `
          <div class="timeline-item">
            <div class="ti-desc">${escapeHtml(ac.description)}</div>
            <div class="ti-time">${formatDateTime(ac.created_at)}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } catch (err) {
    renderErrorState(body, err.message);
  }
}

/* ============================================================
   INTERVIEW / REMINDER quick-add forms (used from the detail drawer)
   ============================================================ */
function openInterviewForm(applicationId, onDone) {
  const modalEl = openModal({
    title: "Schedule Interview",
    bodyHtml: `
      <form id="interview-form" novalidate>
        <div class="field">
          <label for="iv-type">Type</label>
          <select id="iv-type" name="type" required>
            ${[
              "HR_SCREENING",
              "RECRUITER_CALL",
              "TECHNICAL_INTERVIEW",
              "CODING_INTERVIEW",
              "BEHAVIORAL_INTERVIEW",
              "SYSTEM_DESIGN",
              "HIRING_MANAGER",
              "FINAL_INTERVIEW",
              "OTHER",
            ]
              .map((t) => `<option value="${t}">${humanizeEnum(t)}</option>`)
              .join("")}
          </select>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="iv-datetime">Date &amp; Time</label>
            <input type="datetime-local" id="iv-datetime" name="scheduled_at" required />
            <span class="error-text"></span>
          </div>
          <div class="field">
            <label for="iv-duration">Duration (minutes)</label>
            <input type="number" id="iv-duration" name="duration_minutes" value="60" min="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="field"><label for="iv-location">Location / Link</label><input type="text" id="iv-location" name="location" /></div>
          <div class="field"><label for="iv-interviewer">Interviewer</label><input type="text" id="iv-interviewer" name="interviewer" /></div>
        </div>
        <div class="field"><label for="iv-notes">Notes</label><textarea id="iv-notes" name="notes"></textarea></div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" form="interview-form" class="btn btn-primary">Schedule</button>
    `,
  });
  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());
  modalEl
    .querySelector("#interview-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = validateInterview(data);
      if (!applyFormErrors(form, errors)) return;
      try {
        await api.createInterview({
          application_id: applicationId,
          type: data.type,
          scheduled_at: new Date(data.scheduled_at).toISOString(),
          duration_minutes: Number(data.duration_minutes) || 60,
          location: data.location || null,
          interviewer: data.interviewer || null,
          notes: data.notes || null,
        });
        showSuccess("Interview scheduled.");
        closeModal();
        onDone();
      } catch (err) {
        showError(err.message);
      }
    });
}

function openReminderForm(applicationId, onDone) {
  const modalEl = openModal({
    title: "Add Reminder",
    bodyHtml: `
      <form id="reminder-form" novalidate>
        <div class="field"><label for="rm-title">Title</label><input type="text" id="rm-title" name="title" required placeholder="e.g. Send thank-you email" /><span class="error-text"></span></div>
        <div class="field"><label for="rm-datetime">Remind me at</label><input type="datetime-local" id="rm-datetime" name="remind_at" required /><span class="error-text"></span></div>
        <div class="field"><label for="rm-desc">Description</label><textarea id="rm-desc" name="description"></textarea></div>
      </form>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button type="submit" form="reminder-form" class="btn btn-primary">Add Reminder</button>
    `,
  });
  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());
  modalEl
    .querySelector("#reminder-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = validateReminder(data);
      if (!applyFormErrors(form, errors)) return;
      try {
        await api.createReminder({
          application_id: applicationId,
          title: data.title.trim(),
          description: data.description || null,
          remind_at: new Date(data.remind_at).toISOString(),
        });
        showSuccess("Reminder added.");
        closeModal();
        onDone();
      } catch (err) {
        showError(err.message);
      }
    });
}

/* ============================================================
   IMPORT (CSV)
   ============================================================ */
function openImportDialog() {
  const modalEl = openModal({
    title: "Import Applications from CSV",
    bodyHtml: `
      <p class="text-muted" style="margin-bottom:14px;">
        CSV columns expected: <span class="text-mono">company_name, job_title, location, employment_type, work_mode, status, priority, source, applied_at, job_url</span>.
        Only <span class="text-mono">company_name</span> and <span class="text-mono">job_title</span> are required.
      </p>
      <div class="field"><input type="file" id="import-file" accept=".csv" /></div>
      <div id="import-result" style="margin-top:14px;"></div>
    `,
    footerHtml: `
      <button type="button" class="btn btn-secondary" data-action="cancel">Close</button>
      <button type="button" class="btn btn-primary" id="import-run-btn">Import</button>
    `,
  });
  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());
  modalEl
    .querySelector("#import-run-btn")
    .addEventListener("click", async () => {
      const fileInput = modalEl.querySelector("#import-file");
      const resultEl = modalEl.querySelector("#import-result");
      const file = fileInput.files[0];
      if (!file) {
        resultEl.innerHTML = `<p class="auth-error show">Choose a CSV file first.</p>`;
        return;
      }

      const runBtn = modalEl.querySelector("#import-run-btn");
      runBtn.disabled = true;
      runBtn.textContent = "Importing…";
      resultEl.innerHTML = `<div class="loading-row"><span class="spinner"></span><span>Importing…</span></div>`;

      try {
        const text = await file.text();
        const rows = parseCsv(text);
        let imported = 0,
          skipped = 0;
        const errorsList = [];

        for (const [idx, row] of rows.entries()) {
          if (!row.company_name || !row.job_title) {
            skipped++;
            errorsList.push(
              `Row ${idx + 2}: missing company_name or job_title.`,
            );
            continue;
          }
          try {
            const company = await api.findOrCreateCompany(row.company_name);
            await api.createApplication({
              company_id: company.id,
              job_title: row.job_title,
              location: row.location || null,
              employment_type: EMPLOYMENT_TYPES.includes(row.employment_type)
                ? row.employment_type
                : null,
              work_mode: WORK_MODES.includes(row.work_mode)
                ? row.work_mode
                : null,
              status: STATUSES.includes(row.status) ? row.status : "SAVED",
              priority: PRIORITIES.includes(row.priority)
                ? row.priority
                : "MEDIUM",
              source: row.source || null,
              applied_at: row.applied_at || null,
              job_url: row.job_url || null,
            });
            imported++;
          } catch (err) {
            skipped++;
            errorsList.push(`Row ${idx + 2}: ${err.message}`);
          }
        }

        resultEl.innerHTML = `
        <p><strong>${imported}</strong> imported, <strong>${skipped}</strong> skipped.</p>
        ${errorsList.length ? `<ul style="font-size:12.5px;color:var(--danger);max-height:120px;overflow-y:auto;">${errorsList.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>` : ""}
      `;
        if (imported > 0) {
          showSuccess(`Imported ${imported} application(s).`);
          refreshBody();
        }
      } catch (err) {
        resultEl.innerHTML = `<p class="auth-error show">Import failed: ${escapeHtml(err.message)}</p>`;
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Import";
      }
    });
}

/* ============================================================
   EXPORT (CSV / JSON)
   ============================================================ */
function openExportDialog() {
  const modalEl = openModal({
    title: "Export Your Data",
    bodyHtml: `
      <p class="text-muted" style="margin-bottom:16px;">Exports include only your own data.</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button type="button" class="btn btn-secondary btn-block" data-export="applications-csv">Applications — CSV</button>
        <button type="button" class="btn btn-secondary btn-block" data-export="applications-json">Applications — JSON</button>
        <button type="button" class="btn btn-secondary btn-block" data-export="all-json">All Data (applications, companies, interviews, contacts, notes, reminders, activity) — JSON</button>
      </div>
    `,
    footerHtml: `<button type="button" class="btn btn-secondary" data-action="cancel">Close</button>`,
  });
  modalEl
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", () => closeModal());
  modalEl.querySelectorAll("[data-export]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Preparing…";
      try {
        await runExport(btn.dataset.export);
        showSuccess("Export ready — check your downloads.");
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });
}

async function runExport(kind) {
  const applications = await api.getAllApplicationsForUser();
  if (kind === "applications-csv") {
    const flat = applications.map((a) => ({
      company: a.companies?.name || "",
      job_title: a.job_title,
      status: a.status,
      priority: a.priority,
      location: a.location,
      work_mode: a.work_mode,
      employment_type: a.employment_type,
      salary_min: a.salary_min,
      salary_max: a.salary_max,
      currency: a.currency,
      source: a.source,
      applied_at: a.applied_at,
      deadline: a.deadline,
      job_url: a.job_url,
    }));
    downloadTextFile("jobflow-applications.csv", toCsv(flat), "text/csv");
  } else if (kind === "applications-json") {
    downloadTextFile(
      "jobflow-applications.json",
      JSON.stringify(applications, null, 2),
      "application/json",
    );
  } else if (kind === "all-json") {
    const [companies, interviews, contacts, reminders] = await Promise.all([
      api.getCompanies(),
      api.getInterviews(),
      api.getContacts(),
      api.getReminders(),
    ]);
    const notes = [];
    for (const a of applications)
      notes.push(...(await api.getNotesForApplication(a.id)));
    downloadTextFile(
      "jobflow-all-data.json",
      JSON.stringify(
        { applications, companies, interviews, contacts, reminders, notes },
        null,
        2,
      ),
      "application/json",
    );
  }
}
