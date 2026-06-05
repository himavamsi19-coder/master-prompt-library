$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$installRoot = "D:\MasterPromptLibrary"
$appInstall = Join-Path $installRoot "App"
$configPath = Join-Path $installRoot "config.json"
$ollamaInstall = "D:\Programs\Ollama"
$modelsInstall = "D:\Ollama\models"

$modelOptions = @(
  [pscustomobject]@{ Number = 1; Model = "gemma3:1b"; Label = "Minimum / safest"; MinRamGb = 4; MinGpuGb = 0; Bundled = $true;  Notes = "Included with this installer. Best for old laptops and low VRAM systems." },
  [pscustomobject]@{ Number = 2; Model = "qwen2.5:1.5b"; Label = "Light";          MinRamGb = 6; MinGpuGb = 0; Bundled = $false; Notes = "Small, quick, good for prompt lookup and summaries." },
  [pscustomobject]@{ Number = 3; Model = "llama3.2:3b";  Label = "Balanced";       MinRamGb = 8; MinGpuGb = 0; Bundled = $false; Notes = "Better reasoning while still friendly to most systems." },
  [pscustomobject]@{ Number = 4; Model = "gemma3:4b";    Label = "Better";         MinRamGb = 8; MinGpuGb = 4; Bundled = $false; Notes = "Good quality if the PC has more memory or GPU VRAM." },
  [pscustomobject]@{ Number = 5; Model = "qwen2.5:7b";   Label = "High";           MinRamGb = 16; MinGpuGb = 6; Bundled = $false; Notes = "Stronger answers, slower on weak systems." },
  [pscustomobject]@{ Number = 6; Model = "mistral:7b";   Label = "High alternate"; MinRamGb = 16; MinGpuGb = 6; Bundled = $false; Notes = "Strong open-source general assistant model." }
)

function Get-TotalRamGb {
  $computer = Get-CimInstance Win32_ComputerSystem
  return [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
}

function Get-GpuMemoryGb {
  $adapters = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue
  $maxBytes = 0
  foreach ($adapter in $adapters) {
    if ($adapter.AdapterRAM -and $adapter.AdapterRAM -gt $maxBytes) {
      $maxBytes = [double]$adapter.AdapterRAM
    }
  }
  return [math]::Round($maxBytes / 1GB, 1)
}

function Get-RecommendedModel($ramGb, $gpuGb) {
  $recommended = $modelOptions[0]
  foreach ($option in $modelOptions) {
    if ($ramGb -ge $option.MinRamGb -and $gpuGb -ge $option.MinGpuGb) {
      $recommended = $option
    }
  }
  return $recommended
}

function Show-ModelMenu($ramGb, $gpuGb, $recommended) {
  Write-Host ""
  Write-Host "Local AI model selection"
  Write-Host "Detected RAM: $ramGb GB"
  Write-Host "Detected GPU memory: $gpuGb GB"
  Write-Host "Best suggestion for this system: $($recommended.Number). $($recommended.Model) - $($recommended.Label)"
  Write-Host ""
  Write-Host "Choose the model the assistant should use for library search:"
  foreach ($option in $modelOptions) {
    $bundledText = if ($option.Bundled) { "included/offline" } else { "free download with Ollama" }
    $suggestText = if ($option.Number -eq $recommended.Number) { "  <-- suggested" } else { "" }
    Write-Host ("{0}. {1} [{2}] RAM {3}GB+, GPU {4}GB+ - {5}{6}" -f $option.Number, $option.Model, $bundledText, $option.MinRamGb, $option.MinGpuGb, $option.Notes, $suggestText)
  }
}

New-Item -ItemType Directory -Force -Path $installRoot, $appInstall, $ollamaInstall, $modelsInstall | Out-Null

$ramGb = Get-TotalRamGb
$gpuGb = Get-GpuMemoryGb
$recommended = Get-RecommendedModel $ramGb $gpuGb
Show-ModelMenu $ramGb $gpuGb $recommended

$choice = Read-Host "Enter model number, or press Enter for the suggested model"
if ([string]::IsNullOrWhiteSpace($choice)) {
  $selected = $recommended
} else {
  $selected = $modelOptions | Where-Object { $_.Number -eq [int]$choice } | Select-Object -First 1
  if (-not $selected) {
    Write-Host "Invalid choice. Using suggested model: $($recommended.Model)"
    $selected = $recommended
  }
}

Write-Host ""
Write-Host "Installing Master Prompt Library..."
Copy-Item -LiteralPath (Join-Path $sourceRoot "App\*") -Destination $appInstall -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot "OllamaPortable\*") -Destination $ollamaInstall -Recurse -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot "OllamaModels\*") -Destination $modelsInstall -Recurse -Force

[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", $modelsInstall, "User")
[Environment]::SetEnvironmentVariable("PROMPT_LIBRARY_OLLAMA_MODEL", $selected.Model, "User")

$config = [ordered]@{
  ollamaModel = $selected.Model
  installedAt = (Get-Date).ToString("o")
  installRoot = $installRoot
  modelsPath = $modelsInstall
}
$config | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8

$ollamaExe = Join-Path $ollamaInstall "ollama.exe"
if (-not $selected.Bundled) {
  Write-Host ""
  Write-Host "$($selected.Model) is free, but it is not bundled in this installer."
  Write-Host "Internet is required once to download it with Ollama. The app still has gemma3:1b bundled as a fallback."
  $download = Read-Host "Download $($selected.Model) now? Type Y to download, or press Enter to skip"
  if ($download -match "^[Yy]") {
    $env:OLLAMA_MODELS = $modelsInstall
    & $ollamaExe pull $selected.Model
  }
}

$exe = Join-Path $appInstall "Master Prompt Library.exe"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Master Prompt Library.lnk"
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = $appInstall
$shortcut.IconLocation = "$exe,0"
$shortcut.Description = "Offline Master Prompt Library"
$shortcut.Save()

Write-Host ""
Write-Host "Installed Master Prompt Library."
Write-Host "App: $exe"
Write-Host "Shortcut: $shortcutPath"
Write-Host "Ollama: $ollamaInstall"
Write-Host "Models: $modelsInstall"
Write-Host "Selected AI model: $($selected.Model)"
Write-Host "Config: $configPath"
