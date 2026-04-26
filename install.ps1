# ─────────────────────────────────────────────────────────────────────────────
# install.ps1 — Instalador global do ng-migrate-ai para Windows (PowerShell)
# ─────────────────────────────────────────────────────────────────────────────
# Uso: .\install.ps1
# Requisitos: Node.js 18+, npm

Write-Host ""
Write-Host "  ███╗   ██╗ ██████╗       ███╗   ███╗██╗ ██████╗ ██████╗  █████╗ ████████╗███████╗" -ForegroundColor Cyan
Write-Host "  ████╗  ██║██╔════╝       ████╗ ████║██║██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝██╔════╝" -ForegroundColor Cyan
Write-Host "  ██╔██╗ ██║██║  ███╗█████╗██╔████╔██║██║██║  ███╗██████╔╝███████║   ██║   █████╗  " -ForegroundColor Cyan
Write-Host "  ██║╚██╗██║██║   ██║╚════╝██║╚██╔╝██║██║██║   ██║██╔══██╗██╔══██║   ██║   ██╔══╝  " -ForegroundColor Cyan
Write-Host "  ██║ ╚████║╚██████╔╝      ██║ ╚═╝ ██║██║╚██████╔╝██║  ██║██║  ██║   ██║   ███████╗" -ForegroundColor Cyan
Write-Host "  ╚═╝  ╚═══╝ ╚═════╝       ╚═╝     ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Instalador — ng-migrate-ai v2.0.0" -ForegroundColor White
Write-Host "  Migração AngularJS → Angular 21 com IA" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Verificar Node.js ─────────────────────────────────────────────────────────
Write-Host "  [1/3] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Node.js não encontrado" }
    $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Host "  ✖ Node.js $nodeVersion detectado. Requer Node.js 18+." -ForegroundColor Red
        Write-Host "  Baixe em: https://nodejs.org" -ForegroundColor DarkGray
        exit 1
    }
    Write-Host "  ✔ Node.js $nodeVersion detectado." -ForegroundColor Green
} catch {
    Write-Host "  ✖ Node.js não encontrado. Instale em: https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ── Verificar npm ─────────────────────────────────────────────────────────────
Write-Host "  [2/3] Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "npm não encontrado" }
    Write-Host "  ✔ npm $npmVersion detectado." -ForegroundColor Green
} catch {
    Write-Host "  ✖ npm não encontrado. Instale em: https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ── Instalar globalmente ───────────────────────────────────────────────────────
Write-Host "  [3/3] Instalando ng-migrate-ai globalmente..." -ForegroundColor Yellow
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
npm install -g $scriptDir

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ✖ Falha na instalação. Tente executar como Administrador." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ✔ ng-migrate-ai instalado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "  Como usar:" -ForegroundColor White
Write-Host "    ng-migrate              " -NoNewline -ForegroundColor Cyan
Write-Host "Abre o shell interativo" -ForegroundColor DarkGray
Write-Host "    ng-migrate config       " -NoNewline -ForegroundColor Cyan
Write-Host "Configura o provedor de IA" -ForegroundColor DarkGray
Write-Host "    ng-migrate scan         " -NoNewline -ForegroundColor Cyan
Write-Host "Analisa o projeto AngularJS" -ForegroundColor DarkGray
Write-Host "    ng-migrate migrate-project  " -NoNewline -ForegroundColor Cyan
Write-Host "Migra o projeto completo" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Documentação: git@github.com:IKauedev/lib-migration-ia-angular.git" -ForegroundColor DarkGray
Write-Host ""
