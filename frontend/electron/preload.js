const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("promptLibrary", {
  list: () => ipcRenderer.invoke("library:list"),
  save: (prompt) => ipcRenderer.invoke("library:save", prompt),
  delete: (id) => ipcRenderer.invoke("library:delete", id),
  chooseAttachments: () => ipcRenderer.invoke("library:chooseAttachments"),
  ask: (question) => ipcRenderer.invoke("assistant:ask", question),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
});
