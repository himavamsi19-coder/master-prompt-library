Master Prompt Library Offline Installer

This folder is a complete Windows offline desktop app package.

Included:
- App: the Electron desktop app
- OllamaPortable: free local AI runtime
- OllamaModels: bundled gemma3:1b model for minimum/offline systems
- Install-MasterPromptLibrary.ps1: guided installer

Install:
1. Copy the whole MasterPromptLibraryInstaller folder to the Windows PC.
2. Right-click Install-MasterPromptLibrary.ps1.
3. Choose Run with PowerShell.
4. Pick the AI model when the installer asks.
5. Open Master Prompt Library from the desktop shortcut.

Model choice:
- gemma3:1b is bundled and works offline immediately.
- Larger open-source models are optional free Ollama downloads.
- The installer detects system RAM/GPU memory and suggests the best model.
- If a larger model is skipped or cannot download, install with gemma3:1b first.

Default paths:
- D:\MasterPromptLibrary
- D:\Programs\Ollama
- D:\Ollama\models

No paid cloud API is required. Prompts and images are saved locally.
