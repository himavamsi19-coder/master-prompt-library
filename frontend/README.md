# Master Prompt Library

Offline desktop prompt library for saving, editing, filtering, copying, and finding master prompts with a local AI assistant.

The app is packaged as a Windows desktop app. It does not require a paid API or cloud account. Prompt data, image attachments, and AI model files are stored locally.

## Main Features

- Full desktop app with local file storage
- Add, edit, delete, sort, filter, and search prompts
- Prompt cards show useful preview text with direct copy actions
- Local AI assistant that finds the best matching prompt instead of dumping the whole library
- Optional image/workflow attachments for each prompt
- Reusable workflows with ordered prompt steps and optional result images for every step
- Free Ollama model support
- Guided installer with system-based model recommendation

## AI Model Selection

The installer asks which open-source model to use:

- `gemma3:1b` - minimum/safest, bundled, works offline immediately
- `qwen2.5:1.5b` - light model for weaker systems
- `llama3.2:3b` - balanced model for most modern systems
- `gemma3:4b` - better quality if RAM/VRAM is available
- `qwen2.5:7b` - high quality, needs stronger hardware
- `mistral:7b` - high-quality alternate model

The installer checks system RAM and GPU memory, then suggests the best choice. Larger models are free but must be downloaded once through Ollama.

## Install From the Offline Package

1. Copy the `MasterPromptLibraryInstaller` folder to the target Windows PC.
2. Right-click `Install-MasterPromptLibrary.ps1`.
3. Choose `Run with PowerShell`.
4. Pick the suggested model or choose another model.
5. Open `Master Prompt Library` from the desktop shortcut.

Default local paths:

- App: `D:\MasterPromptLibrary\App`
- Data: `D:\MasterPromptLibrary\data`
- Config: `D:\MasterPromptLibrary\config.json`
- Ollama runtime: `D:\Programs\Ollama`
- Ollama models: `D:\Ollama\models`

## Build From Source

Install Node.js, then run:

```powershell
cd frontend
npm install
npm run dist
```

The packaged desktop app is created at:

```text
frontend\release\win-unpacked
```

Copy that folder into:

```text
MasterPromptLibraryInstaller\App
```

Then copy `installer\Install-MasterPromptLibrary.ps1` and `installer\README.txt` into the installer folder.

## Notes

- The app UI is local Electron, not a hosted website.
- Ollama uses local `127.0.0.1:11434` only for the local AI model.
- If a selected larger model is not downloaded, the assistant falls back to the bundled `gemma3:1b`.
- The offline installer package can be zipped and moved to another Windows system.
