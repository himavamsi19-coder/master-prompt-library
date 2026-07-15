# Master Prompt Library

Master Prompt Library is a fully local Windows desktop app for saving, organizing, copying, and finding your best prompts. It includes a local AI assistant powered by free Ollama models, so no paid API or cloud service is required.

## What's New In This Version

- Workflow steps now show the selected prompt text directly inside the workflow view
- Workflow steps now show visible step images for easier understanding and reuse
- Copy prompt is available directly from workflow steps
- Workflow editor now previews the selected prompt and images while editing
- Desktop app package and installer were updated for the latest local version

## What This App Does

- Save master prompts locally
- Edit and delete existing prompts
- Search, sort, and filter prompts
- Copy prompts directly from the home screen
- Add prompt descriptions, categories, tags, model type, and workflow images
- Build reusable workflows with ordered prompt steps and optional result images for each step
- Use a local AI assistant to find the best matching prompt in your library
- Store app data locally on the computer
- Run as a desktop app, not as a hosted web app

## Download for Normal Users

If you only want to install the app, download the offline installer package:

```text
MasterPromptLibraryInstaller.zip
```

After downloading:

1. Right-click `MasterPromptLibraryInstaller.zip`.
2. Click `Extract All`.
3. Open the extracted `MasterPromptLibraryInstaller` folder.
4. Right-click `Install-MasterPromptLibrary.ps1`.
5. Click `Run with PowerShell`.
6. When asked, choose the AI model you want.
7. Open `Master Prompt Library` from the desktop shortcut.

## AI Model Choice During Install

The installer asks which free local AI model to use.

Recommended choices:

- `gemma3:1b` - safest for almost any computer, bundled in the installer
- `qwen2.5:1.5b` - light model for low-end systems
- `llama3.2:3b` - balanced model for most modern systems
- `gemma3:4b` - better answers for stronger systems
- `qwen2.5:7b` - high quality, needs more RAM/VRAM
- `mistral:7b` - high quality alternate model

The installer checks the computer RAM and GPU memory and suggests the best option. Larger models are free, but they need internet once to download through Ollama.

## Default Install Locations

```text
D:\MasterPromptLibrary
D:\Programs\Ollama
D:\Ollama\models
```

Prompt data is stored locally:

```text
D:\MasterPromptLibrary\data
```

Selected AI model config is stored here:

```text
D:\MasterPromptLibrary\config.json
```

## For Developers

The source code is inside:

```text
frontend
```

Build the Windows desktop app:

```powershell
cd frontend
npm install
npm run dist
```

The built app appears here:

```text
frontend\release\win-unpacked
```

To prepare the offline installer package:

1. Copy `frontend\release\win-unpacked` into `MasterPromptLibraryInstaller\App`.
2. Copy `installer\Install-MasterPromptLibrary.ps1` into `MasterPromptLibraryInstaller`.
3. Copy `installer\README.txt` into `MasterPromptLibraryInstaller`.
4. Include portable Ollama in `MasterPromptLibraryInstaller\OllamaPortable`.
5. Include bundled model files in `MasterPromptLibraryInstaller\OllamaModels`.
6. Zip the `MasterPromptLibraryInstaller` folder.

## Notes

- The app is offline-first.
- No paid cloud API is required.
- Ollama runs locally on `127.0.0.1:11434`.
- If a bigger selected model is not available, the app falls back to bundled `gemma3:1b`.
