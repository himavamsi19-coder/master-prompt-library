const state = {
  prompts: [],
  workflows: [],
  view: "library",
  editing: null,
  attachments: [],
  editingWorkflow: null,
  workflowSteps: [],
};

const el = (id) => document.getElementById(id);
const api = window.promptLibrary;

function text(value) {
  return String(value || "");
}

function searchText(prompt) {
  return [
    prompt.title,
    prompt.description,
    prompt.content,
    prompt.tags,
    prompt.category,
    prompt.modelType,
  ]
    .join(" ")
    .toLowerCase();
}

function filteredPrompts() {
  const query = el("search").value.trim().toLowerCase();
  const category = el("categoryFilter").value;
  const model = el("modelFilter").value;
  const sort = el("sortBy").value;

  const prompts = state.prompts
    .filter((prompt) => !query || searchText(prompt).includes(query))
    .filter((prompt) => !category || prompt.category === category)
    .filter((prompt) => !model || prompt.modelType === model);

  prompts.sort((a, b) => {
    if (sort === "title-asc") return text(a.title).localeCompare(text(b.title));
    if (sort === "category-asc") return text(a.category).localeCompare(text(b.category));
    if (sort === "created-desc") return text(b.createdAt).localeCompare(text(a.createdAt));
    return text(b.updatedAt).localeCompare(text(a.updatedAt));
  });

  return prompts;
}

function escapeHtml(value) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attachmentName(attachment) {
  return escapeHtml(attachment.originalName || attachment.filename || "workflow image");
}

function attachmentGallery(prompt) {
  const attachments = prompt.attachments || [];
  if (!attachments.length) return "";
  return `
    <div class="thumb-grid">
      ${attachments
        .slice(0, 4)
        .map((attachment) => `<img class="thumb" src="${escapeHtml(attachment.url)}" alt="${attachmentName(attachment)}">`)
        .join("")}
      ${attachments.length > 4 ? `<span class="thumb-more">+${attachments.length - 4}</span>` : ""}
    </div>`;
}

function renderFilters() {
  const categories = [...new Set(state.prompts.map((p) => p.category).filter(Boolean))].sort();
  const models = [...new Set(state.prompts.map((p) => p.modelType).filter(Boolean))].sort();
  el("totalCount").textContent = state.prompts.length;
  el("workflowCount").textContent = state.workflows.length;
  el("categoryCount").textContent = categories.length;
  el("categoryFilter").innerHTML = `<option value="">All categories</option>${categories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("")}`;
  el("modelFilter").innerHTML = `<option value="">All models</option>${models
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("")}`;
}

function promptCard(prompt) {
  const tags = text(prompt.tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return `
    <article class="card">
      ${attachmentGallery(prompt)}
      <div class="card-top">
        <button class="copy-icon" data-action="copy" data-id="${prompt.id}" title="Copy prompt">&#x2398;</button>
      </div>
      <div class="meta">
        ${prompt.modelType ? `<span class="pill">${escapeHtml(prompt.modelType)}</span>` : ""}
        ${prompt.category ? `<span class="pill">${escapeHtml(prompt.category)}</span>` : ""}
        ${prompt.attachments?.length ? `<span class="pill">${prompt.attachments.length} image${prompt.attachments.length === 1 ? "" : "s"}</span>` : ""}
      </div>
      <h3>${escapeHtml(prompt.title)}</h3>
      ${prompt.description ? `<p class="description">${escapeHtml(prompt.description).slice(0, 180)}</p>` : ""}
      <pre class="prompt-preview">${escapeHtml(prompt.content).slice(0, 720)}</pre>
      <div class="meta">${tags.map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="card-actions">
        <button data-action="edit" data-id="${prompt.id}">Edit</button>
        <button data-action="copy" data-id="${prompt.id}">Copy &#x2398;</button>
      </div>
    </article>`;
}

function renderLibrary() {
  const prompts = filteredPrompts();
  el("promptGrid").innerHTML = prompts.length
    ? prompts.map(promptCard).join("")
    : `<div class="card"><h3>No prompts found</h3><p>Create a prompt or clear filters.</p></div>`;
}

function renderWorkflows() {
  const query = el("search").value.trim().toLowerCase();
  const workflows = state.workflows.filter((workflow) => !query || [workflow.title, workflow.description, ...workflow.steps.map((step) => step.prompt?.title || "")].join(" ").toLowerCase().includes(query));
  el("workflowGrid").innerHTML = workflows.length
    ? workflows.map(workflowCard).join("")
    : `<div class="card"><h3>No workflows yet</h3><p>Create a workflow, then add your saved prompts as ordered steps.</p></div>`;
}

function workflowCard(workflow) {
  return `
    <article class="card workflow-card">
      <h3>${escapeHtml(workflow.title)}</h3>
      ${workflow.description ? `<p>${escapeHtml(workflow.description)}</p>` : ""}
      <div class="workflow-steps">
        ${workflow.steps.map((step, index) => workflowStepView(step, index)).join("")}
      </div>
      <div class="card-actions">
        <button data-action="edit-workflow" data-id="${workflow.id}">Edit workflow</button>
      </div>
    </article>`;
}

function workflowStepView(step, index) {
  const prompt = step.prompt || state.prompts.find((item) => item.id === Number(step.promptId));
  const images = [...(step.attachments || []), ...(prompt?.attachments || [])];
  return `
    <section class="workflow-step">
      <div class="workflow-step-head">
        <span>Step ${index + 1}</span>
        ${prompt ? `<button type="button" data-action="copy" data-id="${prompt.id}">Copy prompt &#x2398;</button>` : ""}
      </div>
      <h4>${escapeHtml(prompt?.title || "Deleted prompt")}</h4>
      ${prompt?.description ? `<p>${escapeHtml(prompt.description)}</p>` : ""}
      ${prompt?.content ? `<pre class="workflow-prompt">${escapeHtml(prompt.content)}</pre>` : ""}
      ${images.length ? `<div class="workflow-image-grid">${images.map((attachment) => `<img class="workflow-image" src="${escapeHtml(attachment.url)}" alt="${attachmentName(attachment)}">`).join("")}</div>` : ""}
    </section>`;
}

function renderAll() {
  renderFilters();
  renderLibrary();
  renderWorkflows();
}

async function refresh() {
  [state.prompts, state.workflows] = await Promise.all([api.list(), api.listWorkflows()]);
  renderAll();
}

function openPrompt(prompt = null) {
  state.editing = prompt;
  state.attachments = prompt?.attachments ? [...prompt.attachments] : [];
  el("dialogTitle").textContent = prompt ? "Edit Prompt" : "New Prompt";
  el("promptId").value = prompt?.id || "";
  el("title").value = prompt?.title || "";
  el("content").value = prompt?.content || "";
  el("description").value = prompt?.description || "";
  el("modelType").value = prompt?.modelType || "";
  el("category").value = prompt?.category || "";
  el("tags").value = prompt?.tags || "";
  el("deletePrompt").style.display = prompt ? "inline-block" : "none";
  renderAttachments();
  el("promptDialog").showModal();
}

function renderAttachments() {
  el("attachmentList").innerHTML = state.attachments
    .map(
      (attachment, index) => `
        <div class="attachment-chip">
          <img src="${escapeHtml(attachment.url)}" alt="${attachmentName(attachment)}">
          <span>${attachmentName(attachment)}</span>
          <button type="button" data-action="remove-attachment" data-index="${index}" title="Remove image">X</button>
        </div>`,
    )
    .join("");
}

async function savePrompt(event) {
  event.preventDefault();
  const prompt = {
    id: el("promptId").value ? Number(el("promptId").value) : undefined,
    title: el("title").value,
    content: el("content").value,
    description: el("description").value,
    modelType: el("modelType").value,
    category: el("category").value,
    tags: el("tags").value,
    attachments: state.attachments,
  };
  state.prompts = await api.save(prompt);
  el("promptDialog").close();
  renderAll();
}

async function deletePrompt() {
  if (!state.editing) return;
  const ok = confirm(`Delete "${state.editing.title}"?`);
  if (!ok) return;
  state.prompts = await api.delete(state.editing.id);
  el("promptDialog").close();
  renderAll();
}

function blankWorkflowStep() {
  return { promptId: state.prompts[0]?.id || "", attachments: [] };
}

function openWorkflow(workflow = null) {
  state.editingWorkflow = workflow;
  state.workflowSteps = workflow?.steps ? workflow.steps.map((step) => ({ promptId: step.promptId, attachments: [...(step.attachments || [])] })) : [blankWorkflowStep()];
  el("workflowDialogTitle").textContent = workflow ? "Edit Workflow" : "New Workflow";
  el("workflowId").value = workflow?.id || "";
  el("workflowTitle").value = workflow?.title || "";
  el("workflowDescription").value = workflow?.description || "";
  el("deleteWorkflow").style.display = workflow ? "inline-block" : "none";
  renderWorkflowSteps();
  el("workflowDialog").showModal();
}

function renderWorkflowSteps() {
  el("workflowSteps").innerHTML = state.workflowSteps.map((step, index) => `
    <section class="workflow-editor-step">
      <span>Step ${index + 1}</span>
      <select data-step-prompt="${index}" required>
        ${state.prompts.map((prompt) => `<option value="${prompt.id}" ${Number(step.promptId) === prompt.id ? "selected" : ""}>${escapeHtml(prompt.title)}</option>`).join("")}
      </select>
      <div class="workflow-step-actions">
        <button type="button" data-action="step-images" data-index="${index}">Attach result image</button>
        <button type="button" data-action="step-up" data-index="${index}" ${index ? "" : "disabled"}>Up</button>
        <button type="button" data-action="step-down" data-index="${index}" ${index < state.workflowSteps.length - 1 ? "" : "disabled"}>Down</button>
        <button type="button" data-action="step-remove" data-index="${index}" ${state.workflowSteps.length > 1 ? "" : "disabled"}>Remove</button>
      </div>
      <div class="step-image-list">${step.attachments.map((attachment, imageIndex) => `<div class="attachment-chip"><img src="${escapeHtml(attachment.url)}" alt="${attachmentName(attachment)}"><span>${attachmentName(attachment)}</span><button type="button" data-action="step-image-remove" data-step-index="${index}" data-image-index="${imageIndex}">X</button></div>`).join("")}</div>
      <div class="workflow-editor-preview">${workflowStepView(step, index)}</div>
    </section>`).join("");
}

async function saveWorkflow(event) {
  event.preventDefault();
  state.workflowSteps.forEach((step, index) => { step.promptId = Number(el("workflowSteps").querySelector(`[data-step-prompt='${index}']`).value); });
  await api.saveWorkflow({
    id: el("workflowId").value ? Number(el("workflowId").value) : undefined,
    title: el("workflowTitle").value,
    description: el("workflowDescription").value,
    steps: state.workflowSteps,
  });
  el("workflowDialog").close();
  await refresh();
}

async function deleteWorkflow() {
  if (!state.editingWorkflow || !confirm(`Delete "${state.editingWorkflow.title}"?`)) return;
  await api.deleteWorkflow(state.editingWorkflow.id);
  el("workflowDialog").close();
  await refresh();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.id === `${view}View`);
  });
}

function addMessage(textValue, sender, promptIds = []) {
  const div = document.createElement("div");
  div.className = `message ${sender}`;
  div.textContent = textValue;
  if (promptIds.length) {
    const links = document.createElement("div");
    links.className = "match-links";
    for (const id of promptIds) {
      const prompt = state.prompts.find((item) => item.id === id);
      const button = document.createElement("button");
      button.textContent = prompt ? `Open: ${prompt.title}` : `Open #${id}`;
      button.addEventListener("click", () => openPrompt(prompt));
      links.appendChild(button);
    }
    div.appendChild(links);
  }
  el("chatLog").appendChild(div);
  el("chatLog").scrollTop = el("chatLog").scrollHeight;
}

async function sendChat() {
  const question = el("chatInput").value.trim();
  if (!question) return;
  el("chatInput").value = "";
  addMessage(question, "user");
  addMessage("Checking your local library...", "ai");
  const pending = el("chatLog").lastElementChild;
  const response = await api.ask(question);
  pending.remove();
  addMessage(response.answer, "ai", response.promptIds || []);
}

function bindEvents() {
  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  el("newPrompt").addEventListener("click", () => openPrompt());
  el("newWorkflow").addEventListener("click", () => openWorkflow());
  el("promptForm").addEventListener("submit", savePrompt);
  el("closeDialog").addEventListener("click", () => el("promptDialog").close());
  el("cancelDialog").addEventListener("click", () => el("promptDialog").close());
  el("deletePrompt").addEventListener("click", deletePrompt);
  el("workflowForm").addEventListener("submit", saveWorkflow);
  el("closeWorkflowDialog").addEventListener("click", () => el("workflowDialog").close());
  el("cancelWorkflowDialog").addEventListener("click", () => el("workflowDialog").close());
  el("deleteWorkflow").addEventListener("click", deleteWorkflow);
  el("addWorkflowStep").addEventListener("click", () => { state.workflowSteps.push(blankWorkflowStep()); renderWorkflowSteps(); });
  el("workflowSteps").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "step-images") {
      state.workflowSteps[index].attachments.push(...await api.chooseAttachments());
    } else if (button.dataset.action === "step-up" && index) {
      [state.workflowSteps[index - 1], state.workflowSteps[index]] = [state.workflowSteps[index], state.workflowSteps[index - 1]];
    } else if (button.dataset.action === "step-down" && index < state.workflowSteps.length - 1) {
      [state.workflowSteps[index], state.workflowSteps[index + 1]] = [state.workflowSteps[index + 1], state.workflowSteps[index]];
    } else if (button.dataset.action === "step-remove" && state.workflowSteps.length > 1) {
      state.workflowSteps.splice(index, 1);
    } else if (button.dataset.action === "step-image-remove") {
      const step = state.workflowSteps[Number(button.dataset.stepIndex)];
      const [attachment] = step.attachments.splice(Number(button.dataset.imageIndex), 1);
      if (attachment?.filename) await api.deleteAttachment(attachment.filename);
    }
    renderWorkflowSteps();
  });
  el("workflowSteps").addEventListener("change", (event) => {
    const select = event.target.closest("[data-step-prompt]");
    if (!select) return;
    state.workflowSteps[Number(select.dataset.stepPrompt)].promptId = Number(select.value);
    renderWorkflowSteps();
  });
  el("addImages").addEventListener("click", async () => {
    const attachments = await api.chooseAttachments();
    state.attachments.push(...attachments);
    renderAttachments();
  });
  el("attachmentList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action='remove-attachment']");
    if (!button) return;
    const index = Number(button.dataset.index);
    const [attachment] = state.attachments.splice(index, 1);
    if (attachment?.filename) await api.deleteAttachment(attachment.filename);
    renderAttachments();
  });
  el("sendChat").addEventListener("click", sendChat);
  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      el("chatInput").value = button.dataset.question;
      sendChat();
    });
  });
  el("chatInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendChat();
  });
  ["search", "categoryFilter", "modelFilter", "sortBy"].forEach((id) => {
    el(id).addEventListener("input", renderAll);
  });
  document.body.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-workflow") {
      const workflow = state.workflows.find((item) => item.id === Number(button.dataset.id));
      if (workflow) openWorkflow(workflow);
      return;
    }
    const prompt = state.prompts.find((item) => item.id === Number(button.dataset.id));
    if (!prompt) return;
    if (button.dataset.action === "edit") openPrompt(prompt);
    if (button.dataset.action === "copy") {
      await navigator.clipboard.writeText(prompt.content);
      const original = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = original;
      }, 900);
    }
  });
}

bindEvents();
refresh();
