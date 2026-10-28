$ErrorActionPreference = 'Stop'
# Run from the game's root. Public downloads only; no project upload or account.
$taskPiperDir = Join-Path (Get-Location) '.tools/piper'
New-Item -ItemType Directory -Force -Path $taskPiperDir | Out-Null
Invoke-WebRequest -Uri 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip' -OutFile (Join-Path $taskPiperDir 'piper_windows_amd64.zip')
Expand-Archive -LiteralPath (Join-Path $taskPiperDir 'piper_windows_amd64.zip') -DestinationPath (Join-Path $taskPiperDir 'runtime') -Force
$taskVoiceBase = 'https://huggingface.co/rhasspy/piper-voices/resolve/refs%2Fpr%2F37/tr/tr_TR/fahrettin/medium/'
foreach ($taskVoiceName in @('tr_TR-fahrettin-medium.onnx','tr_TR-fahrettin-medium.onnx.json')) {
    Invoke-WebRequest -Uri ($taskVoiceBase + $taskVoiceName) -OutFile (Join-Path $taskPiperDir $taskVoiceName)
}
Write-Output 'Local Turkish voice installed. Run node tools/campaign-voice.mjs.'
