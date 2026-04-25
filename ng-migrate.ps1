#!/usr/bin/env pwsh

# ── Setup shortcut: .\ng-migrate.ps1 setup ───────────────────────────────────
if ($args[0] -ieq "setup") {
    Write-Host ""
    Write-Host "  Assistente de configuracao de variaveis de ambiente..." -ForegroundColor Cyan
    Write-Host ""
    node "$PSScriptRoot\src\index.js" env
    exit $LASTEXITCODE
}

# ── All other commands pass through ──────────────────────────────────────────
node "$PSScriptRoot\src\index.js" @args
exit $LASTEXITCODE
