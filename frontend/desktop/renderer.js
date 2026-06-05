const state = {
  prompts: [],
  view: "library",
  editing: null,
  attachments: [],
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

function renderFilters() {
  const categories = [...new Set(state.prompts.map((p) => p.category).filter(Boolean))].sort();
  const models = [...new Set(state.prompts.map((p) => p.modelType).filter(Boolean))].sort();
  el("totalCount").textContent = state.prompts.length;
  el("workflowCount").textContent = state.prompts.filter((prompt) => prompt.attachments?.length).length;
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
      ${prompt.attachments?.[0] ? `<img class="thumb" src="${prompt.attachments[0].url}" alt="">` : ""}
      <div class="card-top">
        <button class="copy-icon" data-action="copy" data-id="${prompt.id}" title="Copy prompt">&#x2398;</button>
      </div>
      <div class="meta">
        ${prompt.modelType ? `<span class="pill">${escapeHtml(prompt.modelType)}</span>` : ""}
        ${prompt.category ? `<span class="pill">${escapeHtml(prompt.category)}</span>` : ""}
        ${prompt.attachments?.length ? `<span class="pill">${prompt.attachments.length} image</span>` : ""}
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
  const prompts = filteredPrompts().filter((prompt) => prompt.attachments?.length);
  el("workflowGrid").innerHTML = prompts.length
    ? prompts.map(promptCard).join("")
    : `<div class="card"><h3>No workflow images</h3><p>Attach workflow images when creating or editing a prompt.</p></div>`;
}

function renderAll() {
  renderFilters();
  renderLibrary();
  renderWorkflows();
}

async function refresh() {
  state.prompts = await api.list();
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
    .map((attachment) => `<span class="attachment-chip">${escapeHtml(attachment.originalName || attachment.filename)}</span>`)
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
  el("promptForm").addEventListener("submit", savePrompt);
  el("closeDialog").addEventListener("click", () => el("promptDialog").close());
  el("cancelDialog").addEventListener("click", () => el("promptDialog").close());
  el("deletePrompt").addEventListener("click", deletePrompt);
  el("addImages").addEventListener("click", async () => {
    const attachments = await api.chooseAttachments();
    state.attachments.push(...attachments);
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
