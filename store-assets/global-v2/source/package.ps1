$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$assetRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$zipFile = Join-Path $assetRoot 'cafe-avenue-kafe-caddesi-store-kit.zip'
$archiveStream = [System.IO.File]::Open($zipFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    $items = Get-ChildItem -LiteralPath $assetRoot -File -Recurse | Where-Object { $_.FullName -ne $zipFile -and $_.FullName -notmatch '\\previews\\(report|pdf)\\' -and $_.Name -ne 'zip-audit.json' }
    foreach ($item in $items) {
        $relative = $item.FullName.Substring($assetRoot.Length + 1).Replace('\','/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $item.FullName, $relative, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $archive.Dispose() }
$verifyArchive = [System.IO.Compression.ZipFile]::OpenRead($zipFile)
try {
    $manifest = Get-Content -LiteralPath (Join-Path $assetRoot 'research/verification.json') -Raw | ConvertFrom-Json
    foreach ($file in $manifest.finalFiles) {
        $entry = $verifyArchive.GetEntry($file.file)
        if ($null -eq $entry) { throw "Missing ZIP entry: $($file.file)" }
        $stream = $entry.Open()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $digest = ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($digest -ne $file.sha256) { throw "ZIP hash mismatch: $($file.file)" }
    }
    $result = [ordered]@{ file = 'cafe-avenue-kafe-caddesi-store-kit.zip'; bytes = (Get-Item -LiteralPath $zipFile).Length; entries = $verifyArchive.Entries.Count; finalAssetHashesVerified = $manifest.finalFiles.Count; sha256 = (Get-FileHash -LiteralPath $zipFile -Algorithm SHA256).Hash.ToLowerInvariant() }
    $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $assetRoot 'research/zip-audit.json') -Encoding utf8
    $result | ConvertTo-Json
} finally { $verifyArchive.Dispose() }
