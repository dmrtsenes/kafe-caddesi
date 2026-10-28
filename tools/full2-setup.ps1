param([Parameter(Mandatory=$true)][string]$Python312)
$ErrorActionPreference='Stop'
$full2Root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $full2Root
if (-not (Test-Path -LiteralPath '.tools/voice-studio/Scripts/python.exe')) {
    & $Python312 -m venv '.tools/voice-studio'
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated voice environment.' }
}
$full2Python=Join-Path $full2Root '.tools/voice-studio/Scripts/python.exe'
& $full2Python -m pip install --no-cache-dir torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { throw 'GPU audio dependencies failed.' }
& $full2Python -m pip install --no-deps 'https://github.com/resemble-ai/chatterbox/archive/refs/heads/master.zip'
if ($LASTEXITCODE -ne 0) { throw 'Voice package failed.' }
& $full2Python -m pip install 'numpy<2' librosa==0.11.0 s3tokenizer==0.3.0 transformers==5.2.0 diffusers==0.29.0 conformer==0.3.2 safetensors==0.5.3 spacy-pkuseg pykakasi==2.3.0 pyloudnorm omegaconf soundfile 'https://github.com/resemble-ai/Perth/archive/refs/heads/master.zip' faster-whisper==1.2.1
if ($LASTEXITCODE -ne 0) { throw 'Voice processing dependencies failed.' }
& $full2Python tools/full2-download-voice.py
if ($LASTEXITCODE -ne 0) { throw 'Model download failed.' }
Write-Output 'Local speech environment is ready. See campaign-kafe-caddesi/README.md.'
