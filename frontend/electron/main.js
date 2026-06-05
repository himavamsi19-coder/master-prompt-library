const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const appRoot = path.resolve(__dirname, "..");
const preferredRoot = process.platform === "win32" && fs.existsSync("D:\\")
  ? "D:\\MasterPromptLibrary"
  : path.join(app.getPath("userData"), "local-library");
const configPath = path.join(preferredRoot, "config.json");
const dataDir = process.env.PROMPT_LIBRARY_DATA_DIR || path.join(preferredRoot, "data");
const logDir = path.join(preferredRoot, "logs");
const attachmentsDir = path.join(dataDir, "attachments");
const libraryPath = path.join(dataDir, "library.json");
const ollamaModelsDir = process.env.OLLAMA_MODELS || (process.platform === "win32" && fs.existsSync("D:\\") ? "D:\\Ollama\\models" : path.join(preferredRoot, "ollama-models"));
const bundledOllama = process.platform === "win32" ? "D:\\Programs\\Ollama\\ollama.exe" : "ollama";
const ollamaCmd = fs.existsSync(bundledOllama) ? bundledOllama : "ollama";

let mainWindow;
let ollamaProcess;

app.setName("Master Prompt Library");
if (process.platform === "win32" && fs.existsSync("D:\\")) {
  app.setPath("userData", "D:\\MasterPromptLibrary\\electron-user-data");
}

function ensureDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(attachmentsDir, { recursive: true });
  fs.mkdirSync(ollamaModelsDir, { recursive: true });
}

function readConfig() {
  ensureDirs();
  if (!fs.existsSync(configPath)) {
    return { ollamaModel: "gemma3:1b" };
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      ollamaModel: String(config.ollamaModel || config.model || "gemma3:1b").trim() || "gemma3:1b",
    };
  } catch {
    return { ollamaModel: "gemma3:1b" };
  }
}

function getSelectedModel() {
  return process.env.PROMPT_LIBRARY_OLLAMA_MODEL || readConfig().ollamaModel || "gemma3:1b";
}

function defaultLibrary() {
  return { version: 1, nextId: 1, prompts: [] };
}

function readLibrary() {
  ensureDirs();
  if (!fs.existsSync(libraryPath)) {
    writeLibrary(defaultLibrary());
  }

  try {
    return JSON.parse(fs.readFileSync(libraryPath, "utf8"));
  } catch {
    const backup = `${libraryPath}.broken-${Date.now()}`;
    fs.copyFileSync(libraryPath, backup);
    const library = defaultLibrary();
    writeLibrary(library);
    return library;
  }
}

function writeLibrary(library) {
  ensureDirs();
  const tmp = `${libraryPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(library, null, 2), "utf8");
  fs.renameSync(tmp, libraryPath);
}

function normalizePrompt(input, id) {
  const now = new Date().toISOString();
  return {
    id,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    content: String(input.content || "").trim(),
    tags: String(input.tags || "").trim(),
    category: String(input.category || "").trim(),
    modelType: String(input.modelType || "").trim(),
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

function getPromptText(prompt) {
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

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from",
  "give", "help", "i", "in", "is", "it", "library", "me", "my", "of", "on", "one",
  "please", "prompt", "prompts", "show", "that", "the", "this", "to", "use", "what",
  "which", "with", "workflow", "workflows", "you",
]);

const SYNONYMS = {
  product: ["commercial", "catalog", "ecommerce", "packshot", "hero", "photography"],
  image: ["photo", "picture", "visual", "render"],
  video: ["film", "cinematic", "scene", "veo"],
  angle: ["view", "perspective", "rotation", "shot"],
  measure: ["measurement", "dimension", "scale"],
  luxury: ["premium", "high-end", "elegant"],
  local: ["offline", "desktop", "storage"],
  save: ["store", "storage", "library"],
};

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (token === key || values.includes(token)) {
        expanded.add(key);
        values.forEach((value) => expanded.add(value));
      }
    }
  }
  return [...expanded];
}

function trigrams(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (normalized.length < 3) return new Set(normalized ? [normalized] : []);
  const grams = new Set();
  for (let index = 0; index <= normalized.length - 3; index += 1) {
    grams.add(normalized.slice(index, index + 3));
  }
  return grams;
}

function similarity(a, b) {
  const aGrams = trigrams(a);
  const bGrams = trigrams(b);
  if (!aGrams.size || !bGrams.size) return 0;
  let overlap = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (aGrams.size + bGrams.size);
}

function scorePrompt(prompt, query) {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const words = expandTokens(tokenize(q));
  let score = 0;
  const title = prompt.title.toLowerCase();
  const desc = prompt.description.toLowerCase();
  const content = prompt.content.toLowerCase();
  const tags = prompt.tags.toLowerCase();
  const category = prompt.category.toLowerCase();
  const modelType = prompt.modelType.toLowerCase();
  const all = getPromptText(prompt);
  const searchableTokens = tokenize(all);

  if (title.includes(q)) score += 80;
  if (desc.includes(q)) score += 50;
  if (content.includes(q)) score += 25;
  if (tags.includes(q)) score += 35;
  if (category.includes(q)) score += 25;
  if (modelType.includes(q)) score += 25;

  const titleSimilarity = similarity(q, prompt.title);
  const descriptionSimilarity = similarity(q, prompt.description);
  if (titleSimilarity > 0.35) score += Math.round(titleSimilarity * 45);
  if (descriptionSimilarity > 0.35) score += Math.round(descriptionSimilarity * 28);

  for (const word of words) {
    if (title.includes(word)) score += 12;
    if (desc.includes(word)) score += 8;
    if (tags.includes(word)) score += 8;
    if (category.includes(word)) score += 8;
    if (modelType.includes(word)) score += 8;
    if (content.includes(word)) score += 4;
    if (all.includes(word)) score += 1;
    if (!all.includes(word)) {
      const fuzzyHit = searchableTokens.some((token) => similarity(word, token) > 0.72);
      if (fuzzyHit) score += 4;
    }
  }
  return score;
}

function asksForAlternatives(query) {
  return /\b(alternative|alternatives|all|list|options|similar|related|many|multiple)\b/i.test(query);
}

function asksForFullPrompt(query) {
  return /\b(full|exact|copy|paste|entire|complete)\b/i.test(query);
}

function searchPromptScores(query, limit = 8) {
  const library = readLibrary();
  const scored = library.prompts
    .map((prompt) => ({ prompt, score: scorePrompt(prompt, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.prompt.id - a.prompt.id);

  if (!scored.length) return [];

  const topScore = scored[0].score;
  const cutoff = Math.max(14, Math.floor(topScore * 0.62));
  return scored.filter((item) => item.score >= cutoff).slice(0, limit);
}

function searchPrompts(query, limit = 5) {
  return searchPromptScores(query, limit).map((item) => item.prompt);
}

function startOllama() {
  if (path.isAbsolute(ollamaCmd) && !fs.existsSync(ollamaCmd)) return;
  ollamaProcess = spawn(ollamaCmd, ["serve"], {
    cwd: path.isAbsolute(ollamaCmd) ? path.dirname(ollamaCmd) : undefined,
    env: {
      ...process.env,
      OLLAMA_MODELS: ollamaModelsDir,
      Path: `${path.dirname(ollamaCmd)};${process.env.Path || process.env.PATH || ""}`,
    },
    windowsHide: true,
  });
  ollamaProcess.stdout.pipe(fs.createWriteStream(path.join(logDir, "offline-ollama.out.log"), { flags: "a" }));
  ollamaProcess.stderr.pipe(fs.createWriteStream(path.join(logDir, "offline-ollama.err.log"), { flags: "a" }));
}

function attachmentUrl(filename) {
  return `file://${path.join(attachmentsDir, filename).replace(/\\/g, "/")}`;
}

function withAttachmentUrls(prompt) {
  return {
    ...prompt,
    attachments: (prompt.attachments || []).map((attachment) => ({
      ...attachment,
      url: attachmentUrl(attachment.filename),
    })),
  };
}

async function askOllama(question, matches) {
  const context = matches
    .map((prompt, index) => {
      return [
        `SELECTED MATCH ${index + 1} ID ${prompt.id}`,
        `Title: ${prompt.title}`,
        `Description: ${prompt.description}`,
        `Category: ${prompt.category}`,
        `Model: ${prompt.modelType}`,
        `Tags: ${prompt.tags}`,
        `Prompt: ${prompt.content}`,
      ].join("\n");
    })
    .join("\n\n");

  const buildBody = (model) => JSON.stringify({
    model,
    stream: false,
    prompt: [
      "You are a local prompt-library assistant.",
      "Answer only from the selected library matches.",
      "Do not say to search the web.",
      "Do not mention unrelated prompts.",
      "Use only MATCH 1 unless the user explicitly asks for alternatives.",
      "Do not dump full prompts unless the user explicitly asks for the exact full prompt.",
      "If the user asks what a prompt does, summarize its purpose and mention the best matching title.",
      "If the selected match does not answer the question, say the library does not contain a good match.",
      "",
      `User question: ${question}`,
      "",
      `Selected library matches:\n${context}`,
    ].join("\n"),
  });

  const selectedModel = getSelectedModel();
  let response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: buildBody(selectedModel),
  });

  if (!response.ok && selectedModel !== "gemma3:1b") {
    response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildBody("gemma3:1b"),
    });
  }

  if (!response.ok) throw new Error(`Ollama ${response.status}`);
  const data = await response.json();
  return data.response || "I could not generate an answer from the local model.";
}

function createFallbackAnswer(question, matches) {
  if (!matches.length) {
    return "I could not find a good match in your local library.";
  }

  const top = matches[0];
  if (asksForFullPrompt(question)) {
    return `Best match: ${top.title}\n\n${top.content}`;
  }

  return [
    `Best match: ${top.title}`,
    top.description ? `What it does: ${top.description}` : "What it does: This prompt is stored in your local library and matches your request.",
    top.category ? `Category: ${top.category}` : "",
    top.modelType ? `Model: ${top.modelType}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function setupIpc() {
  ipcMain.handle("library:list", () => {
    const library = readLibrary();
    return library.prompts.map(withAttachmentUrls);
  });

  ipcMain.handle("library:save", (_event, input) => {
    if (!input.title || !input.content) {
      throw new Error("Title and prompt content are required.");
    }
    const library = readLibrary();
    const isEdit = Number.isFinite(input.id);
    if (isEdit) {
      const index = library.prompts.findIndex((prompt) => prompt.id === input.id);
      if (index === -1) throw new Error("Prompt not found.");
      library.prompts[index] = normalizePrompt({ ...library.prompts[index], ...input }, input.id);
    } else {
      const id = library.nextId++;
      library.prompts.unshift(normalizePrompt(input, id));
    }
    writeLibrary(library);
    return library.prompts.map(withAttachmentUrls);
  });

  ipcMain.handle("library:delete", (_event, id) => {
    const library = readLibrary();
    const prompt = library.prompts.find((item) => item.id === id);
    library.prompts = library.prompts.filter((item) => item.id !== id);
    writeLibrary(library);

    for (const attachment of prompt?.attachments || []) {
      const filePath = path.join(attachmentsDir, attachment.filename);
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    }
    return library.prompts.map(withAttachmentUrls);
  });

  ipcMain.handle("library:chooseAttachments", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    });
    if (result.canceled) return [];

    return result.filePaths.map((filePath) => {
      const ext = path.extname(filePath);
      const filename = `${crypto.randomUUID()}${ext}`;
      fs.copyFileSync(filePath, path.join(attachmentsDir, filename));
      return {
        id: crypto.randomUUID(),
        filename,
        originalName: path.basename(filePath),
        contentType: "",
        note: "",
        url: attachmentUrl(filename),
      };
    });
  });

  ipcMain.handle("assistant:ask", async (_event, question) => {
    const scored = searchPromptScores(question, 5);
    const allMatches = scored.map((item) => item.prompt);
    const selectedMatches = asksForAlternatives(question) ? allMatches.slice(0, 3) : allMatches.slice(0, 1);
    const promptIds = selectedMatches.map((prompt) => prompt.id);
    try {
      const answer = await askOllama(question, selectedMatches);
      return { answer, promptIds };
    } catch {
      return { answer: createFallbackAnswer(question, selectedMatches), promptIds };
    }
  });

  ipcMain.handle("shell:openPath", (_event, targetPath) => {
    shell.openPath(targetPath);
  });
}

async function createWindow() {
  ensureDirs();
  startOllama();
  setupIpc();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1020,
    minHeight: 680,
    title: "Master Prompt Library",
    backgroundColor: "#101114",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadFile(path.join(appRoot, "desktop", "index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (ollamaProcess) ollamaProcess.kill();
  app.quit();
});
