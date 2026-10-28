$ErrorActionPreference = 'Stop'
$taskStoreRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskZipPath = Join-Path $taskStoreRoot 'tepsilo-google-play.zip'
# Only package the explicit delivery tree; exclude caches and the ZIP itself.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskFileStream = [System.IO.File]::Open($taskZipPath, [System.IO.FileMode]::Create)
$taskArchive = New-Object System.IO.Compression.ZipArchive($taskFileStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($taskFile in (Get-ChildItem -LiteralPath $taskStoreRoot -Recurse -File)) {
    if ($taskFile.FullName -eq $taskZipPath) { continue }
    $taskRelative = $taskFile.FullName.Substring($taskStoreRoot.Length + 1).Replace('\', '/')
    if ($taskRelative.StartsWith('.cache/') -or $taskRelative.EndsWith('.zip')) { continue }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive, $taskFile.FullName, $taskRelative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $taskArchive.Dispose(); $taskFileStream.Dispose() }
$taskHash = (Get-FileHash -LiteralPath $taskZipPath -Algorithm SHA256).Hash
Write-Output ('ZIP: ' + $taskZipPath)
Write-Output ('SHA256: ' + $taskHash)
