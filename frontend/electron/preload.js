const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("promptLibrary", {
  list: () => ipcRenderer.invoke("library:list"),
  save: (prompt) => ipcRenderer.invoke("library:save", prompt),
  delete: (id) => ipcRenderer.invoke("library:delete", id),
  chooseAttachments: () => ipcRenderer.invoke("library:chooseAttachments"),
  deleteAttachment: (filename) => ipcRenderer.invoke("library:deleteAttachment", filename),
  listWorkflows: () => ipcRenderer.invoke("workflow:list"),
  saveWorkflow: (workflow) => ipcRenderer.invoke("workflow:save", workflow),
  deleteWorkflow: (id) => ipcRenderer.invoke("workflow:delete", id),
  ask: (question) => ipcRenderer.invoke("assistant:ask", question),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
});
