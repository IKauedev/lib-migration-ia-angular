#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install.sh — Instalador global do ng-migrate-angularjs-ai para Linux/macOS
# ─────────────────────────────────────────────────────────────────────────────
# Uso: chmod +x install.sh && ./install.sh

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}     _   _  ____       __  __ ___ ____ ____      _  _____ _____${RESET}"
echo -e "${CYAN}    | \\ | |/ ___|___  |  \\/  |_ _/ ___|  _ \\    / \\|_   _| ____|${RESET}"
echo -e "${CYAN}    |  \\| | |  _|___| | |\\/| || | |  _| |_) |  / _ \\ | | |  _|${RESET}"
echo -e "${CYAN}    | |\\  | |_| |     | |  | || | |_| |  _ <  / ___ \\| | | |___${RESET}"
echo -e "${CYAN}    |_| \\_|\\____|     |_|  |_|___\\____|_| \\_\\/_/   \\_\\_| |_____|${RESET}"
echo ""
echo -e "${BOLD}  Instalador — ng-migrate-angularjs-ai v0.0.1${RESET}"
echo -e "${DIM}  Migração AngularJS → Angular 21 com IA${RESET}"
echo ""
echo -e "${DIM}  ─────────────────────────────────────────────────────────────${RESET}"
echo ""

# ── Verificar Node.js ─────────────────────────────────────────────────────────
echo -e "${YELLOW}  [1/3] Verificando Node.js...${RESET}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}  ✖ Node.js não encontrado. Instale em: https://nodejs.org${RESET}"
    exit 1
fi
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}  ✖ Node.js $(node --version) detectado. Requer Node.js 18+.${RESET}"
    exit 1
fi
echo -e "${GREEN}  ✔ Node.js $(node --version) detectado.${RESET}"

# ── Verificar npm ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}  [2/3] Verificando npm...${RESET}"
if ! command -v npm &>/dev/null; then
    echo -e "${RED}  ✖ npm não encontrado. Instale em: https://nodejs.org${RESET}"
    exit 1
fi
echo -e "${GREEN}  ✔ npm $(npm --version) detectado.${RESET}"

# ── Instalar globalmente ───────────────────────────────────────────────────────
echo -e "${YELLOW}  [3/3] Instalando ng-migrate-angularjs-ai globalmente...${RESET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
npm install -g "$SCRIPT_DIR"

echo ""
echo -e "${DIM}  ─────────────────────────────────────────────────────────────${RESET}"
echo ""
echo -e "${GREEN}  ✔ ng-migrate-angularjs-ai instalado com sucesso!${RESET}"
echo ""
echo -e "${BOLD}  Como usar:${RESET}"
echo -e "    ${CYAN}ng-migrate${RESET}              ${DIM}Abre o shell interativo${RESET}"
echo -e "    ${CYAN}ng-migrate config${RESET}       ${DIM}Configura o provedor de IA${RESET}"
echo -e "    ${CYAN}ng-migrate scan${RESET}         ${DIM}Analisa o projeto AngularJS${RESET}"
echo -e "    ${CYAN}ng-migrate migrate-project${RESET}  ${DIM}Migra o projeto completo${RESET}"
echo ""
echo -e "${DIM}  Documentação: https://github.com/seu-usuario/ng-migrate-angularjs-ai${RESET}"
echo ""
