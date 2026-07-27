$chatDir = "C:\Users\Nishad\Desktop\My\works\chat"
$excludeFiles = @("build.js", "sync-www.js", "compile-css.js", "vite.config.js")

$files = Get-ChildItem -Path $chatDir -Filter "*.js" -File | Where-Object {
    $_.Name -notin $excludeFiles
}

$totalWrapped = 0
$filesModified = @()

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    $lines = $content -split "`n"
    $newLines = @()
    $modified = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]

        if ($line -match 'console\.(warn|error)\(') {
            $alreadyGuarded = $false

            # 1) Same-line guard: check text before console. for if (__DEBUG__) etc.
            $consoleIdx = $line.IndexOf("console.")
            if ($consoleIdx -gt 0) {
                $before = $line.Substring(0, $consoleIdx)
                if ($before -match 'if\s*\(' -and $before -match '(__DEBUG__|window\.__DEBUG__)') {
                    $alreadyGuarded = $true
                }
            }

            # 2) Block-level guard: scan backwards for if (__DEBUG__) { / if (_debug) { / if (debug) {
            if (-not $alreadyGuarded) {
                $braceDepth = 0
                for ($j = $i - 1; $j -ge [Math]::Max(0, $i - 20); $j--) {
                    $prevLine = $lines[$j]
                    $opens = ([regex]::Matches($prevLine, '\{')).Count
                    $closes = ([regex]::Matches($prevLine, '\}')).Count
                    $braceDepth += $closes - $opens
                    if ($braceDepth -gt 0) { break }
                    if ($prevLine -match 'if\s*\((__DEBUG__|window\.__DEBUG__|debug|_debug)\)\s*\{') {
                        $alreadyGuarded = $true
                        break
                    }
                }
            }

            if (-not $alreadyGuarded) {
                $trimmed = $line.Trim()

                # Arrow function without braces: => console.warn(
                if ($trimmed -match '=>\s*console\.(warn|error)\(') {
                    $newLine = $line -replace '(=>\s*)(console\.(warn|error)\()', '$1{ if (window.__DEBUG__) $2'
                    $newLine = $newLine.TrimEnd() + '; }'
                    $newLines += $newLine
                } else {
                    # Regular: insert if (window.__DEBUG__) before console.warn/error(
                    $newLine = $line -replace '(console\.(warn|error)\()', 'if (window.__DEBUG__) $1'
                    $newLines += $newLine
                }

                $modified = $true
                $totalWrapped++
            } else {
                $newLines += $line
            }
        } else {
            $newLines += $line
        }
    }

    if ($modified) {
        ($newLines -join "`n") | Set-Content $file.FullName -NoNewline -Encoding UTF8
        $filesModified += $file.Name
    }
}

Write-Host "Files modified: $($filesModified.Count)"
Write-Host "Total wrapped: $totalWrapped"
