# ng-migrate-ai

> CLI inteligente para migração de **AngularJS 1.x → Angular 21** com suporte a múltiplos provedores de IA.

**Versão:** 2.0.0  
**Plataforma:** Node.js 18+ · Windows / macOS / Linux

---

## Índice

1. [Instalação](#instalação)
2. [Configuração rápida](#configuração-rápida)
3. [Provedores de IA suportados](#provedores-de-ia-suportados)
4. [Comandos](#comandos)
   - [config — Configurar provedor de IA](#config--configurar-provedor-de-ia)
   - [env — Gerenciar variáveis de ambiente](#env--gerenciar-variáveis-de-ambiente)
   - [scan — Analisar projeto](#scan--analisar-projeto)
   - [migrate-project — Migrar projeto local](#migrate-project--migrar-projeto-local)
   - [migrate-repo — Migrar repositório remoto](#migrate-repo--migrar-repositório-remoto)
   - [migrate — Migrar arquivo único](#migrate--migrar-arquivo-único)
   - [analyze — Analisar com IA](#analyze--analisar-com-ia)
   - [repl — Modo interativo](#repl--modo-interativo)
   - [checklist — Checklist de migração](#checklist--checklist-de-migração)
5. [Fluxo de trabalho recomendado](#fluxo-de-trabalho-recomendado)
6. [Arquivos gerados pelo scan](#arquivos-gerados-pelo-scan)
7. [Estrutura de saída da migração](#estrutura-de-saída-da-migração)
8. [O que é migrado automaticamente](#o-que-é-migrado-automaticamente)
9. [Tokens de acesso](#tokens-de-acesso)
10. [Executando no Windows](#executando-no-windows)
11. [Configuração armazenada](#configuração-armazenada)
12. [Requisitos](#requisitos)

---

## Instalação

```bash
# Clone ou extraia o projeto
cd ng-migrate-ai

# Instale as dependências
npm install

# (Opcional) instale globalmente
npm install -g .
```

### Windows — usando o .bat/.ps1 incluído

```powershell
# PowerShell
.\ng-migrate.ps1 --help

# Prompt de comando (CMD)
ng-migrate.bat --help

# Ou via node diretamente
node src/index.js --help
```

---

## Configuração rápida

O método mais simples é usar o assistente interativo:

```bash
# 1. Configure o provedor de IA
ng-migrate config

# 2. Analise seu projeto
ng-migrate scan

# 3. Migre
ng-migrate migrate-project
```

---

## Provedores de IA suportados

| Provedor | Variável de Ambiente | Observação |
|---|---|---|
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | Recomendado — melhor qualidade na migração |
| **OpenAI GPT** | `OPENAI_API_KEY` | GPT-4o e variantes |
| **Azure OpenAI** | `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT` | Para ambientes corporativos |
| **Google Gemini** | `GOOGLE_API_KEY` | Gemini 1.5 Pro / Flash |
| **OpenAI-compatible** | Configurável via `config` | Ollama, Together AI, Groq, etc. |

Você pode trocar o provedor a qualquer momento com `ng-migrate config`.

---

## Comandos

### `config` — Configurar provedor de IA

Abre um assistente interativo para selecionar e configurar o provedor de IA.

```bash
ng-migrate config           # Assistente interativo
ng-migrate config --show    # Exibe a configuração atual
ng-migrate config --reset   # Remove todas as configurações salvas
```

**O assistente pergunta:**
- Qual provedor usar (Anthropic, OpenAI, Azure OpenAI, Google Gemini, etc.)
- API Key (exibida como senha, não aparece no terminal)
- Campos específicos do provedor (endpoint Azure, deployment, versão da API, etc.)
- Qual modelo usar (ex: `claude-opus-4-5`, `gpt-4o`, `gemini-1.5-pro`)

A configuração é salva em `~/.ng-migrate/config.json` e reutilizada automaticamente.

---

### `env` — Gerenciar variáveis de ambiente

Gerencia variáveis de ambiente persistidas em `~/.ng-migrate/.env`. São carregadas automaticamente a cada execução.

```bash
ng-migrate env                          # Assistente interativo
ng-migrate env list                     # Lista todas as variáveis salvas
ng-migrate env set OPENAI_API_KEY sk-…  # Define uma variável
ng-migrate env set GITHUB_TOKEN ghp_…  # Define token GitHub
ng-migrate env remove OPENAI_API_KEY   # Remove uma variável
ng-migrate env clear                    # Remove TODAS as variáveis
```

**Aliases em português:** `listar`, `definir`, `remover`, `limpar`

**Variáveis conhecidas (com auto-descrição no assistente):**

| Variável | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic (Claude) |
| `OPENAI_API_KEY` | Chave da API OpenAI (GPT) |
| `AZURE_OPENAI_KEY` | Chave da API Azure OpenAI |
| `AZURE_OPENAI_ENDPOINT` | Endpoint Azure (`https://...openai.azure.com`) |
| `AZURE_OPENAI_DEPLOYMENT` | Nome do deployment Azure |
| `AZURE_OPENAI_API_VERSION` | Versão da API Azure (ex: `2024-05-01-preview`) |
| `GOOGLE_API_KEY` | Chave da API Google Gemini |
| `GITHUB_TOKEN` | Token GitHub (para `migrate-repo`) |
| `GITLAB_TOKEN` | Token GitLab (para `migrate-repo`) |
| `GITLAB_URL` | URL base do GitLab self-hosted |

> **Prioridade:** Variáveis já definidas no sistema operacional têm prioridade sobre o arquivo `.env`.

**No assistente interativo**, além de definir variáveis, há a opção **"Remover variável(eis)..."** que abre uma lista de checkbox — selecione com `Espaço` e confirme com `Enter`.

---

### `scan` — Analisar projeto

Escaneia estaticamente um projeto AngularJS e gera arquivos de análise JSON que guiam a migração.

```bash
ng-migrate scan                  # Analisa a pasta atual
ng-migrate scan .                # Idem
ng-migrate scan ./meu-projeto    # Analisa pasta específica
ng-migrate scan --ai             # Análise profunda por arquivo via IA
ng-migrate scan --force          # Refaz análise mesmo que já exista
ng-migrate scan --include-all    # Inclui arquivos sem padrões AngularJS
ng-migrate scan --json           # Imprime o JSON completo no stdout
ng-migrate scan --no-save        # Não salva os arquivos de análise
```

**Aliases em português:** `ng-migrate escanear`

**O que é detectado:**
- Tipo de cada arquivo (controller, service, factory, directive, filter, component, template, routing)
- Complexidade por arquivo (baixa / média / alta) baseada em LOC e peso dos padrões
- Padrões AngularJS presentes (`$scope`, `$http`, `ng-repeat`, `.directive()`, etc.)
- Dependências injetadas (DI array, `$inject`, constructors TypeScript)
- Problemas de migração por arquivo (`$compile`, `$rootScope`, `angular.element`, etc.)
- Fase de migração sugerida (1=services → 6=routing)
- Horas estimadas por arquivo e total do projeto
- Versão do AngularJS usada (`package.json`)
- Todos os módulos Angular declarados
- Todas as rotas (`$routeProvider.when()` e `$stateProvider.state()`)
- Grafo de dependências entre arquivos

**3 arquivos gerados no projeto:**

| Arquivo | Conteúdo |
|---|---|
| `.ng-migrate-analysis.json` | Resumo geral, lista de arquivos, fases, plano de migração |
| `.ng-migrate-registry.json` | Mapa de símbolos: `myUserSvc` → `MyUserService`; rotas; módulos |
| `.ng-migrate-deps-graph.json` | Para cada arquivo: tokens injetados e quais arquivos os fornecem |

---

### `migrate-project` — Migrar projeto local

Migra todos os arquivos AngularJS de uma pasta local para Angular 21, usando a análise do `scan` para determinar ordem e contexto.

```bash
ng-migrate migrate-project                    # Migra pasta atual → <projeto>-angular21/
ng-migrate migrate-project .                  # Idem
ng-migrate migrate-project ./src/app          # Migra subfolder específico
ng-migrate migrate-project --in-place         # Migra dentro do próprio projeto
ng-migrate migrate-project -o ./saida         # Define pasta de saída
ng-migrate migrate-project --dry-run          # Lista o que seria migrado sem executar
ng-migrate migrate-project --concurrency 5   # 5 arquivos em paralelo
ng-migrate migrate-project --phase 1         # Migra apenas serviços/factories
ng-migrate migrate-project --only "src/**"   # Filtra por glob
ng-migrate migrate-project --skip-deps       # Não atualiza package.json
ng-migrate migrate-project --skip-install    # Não executa npm install ao final
ng-migrate migrate-project --clone https://github.com/usuario/repo  # Clona e migra
```

**Aliases em português:** `ng-migrate migrar-projeto`

> O `migrate-project` **sempre escaneia o projeto antes de migrar**, exibindo um resumo completo (arquivos encontrados, complexidade, horas estimadas, plano de fases) antes de iniciar qualquer alteração.

**Opções:**

| Opção | Padrão | Descrição |
|---|---|---|
| `[pasta]` | `.` (atual) | Pasta raiz do projeto AngularJS |
| `--clone <url>` | — | Clona o repositório git antes de migrar |
| `-o, --output <pasta>` | `../<projeto>-angular21` | Pasta de saída |
| `--in-place` | — | Migra dentro do próprio projeto (veja abaixo) |
| `-c, --concurrency <n>` | `3` | Número de arquivos migrados em paralelo |
| `--dry-run` | — | Mostra o plano sem executar |
| `--only <glob>` | — | Filtra arquivos por padrão glob |
| `--phase <n>` | — | Migra apenas a fase N (1–6) |
| `--skip-deps` | — | Não atualiza o `package.json` |
| `--skip-install` | — | Não executa `npm install` ao final |

**Modo `--in-place` — dentro do próprio projeto:**

```bash
cd meu-projeto-angularjs
ng-migrate migrate-project --in-place
```

Estrutura criada:
```
meu-projeto/
├── src-angularjs-backup/   ← backup completo dos originais (criado antes de qualquer mudança)
├── src-angular21/          ← arquivos migrados para Angular 21
├── angular.json            ← gerado/atualizado na raiz
├── tsconfig.json           ← gerado/atualizado na raiz
└── package.json            ← atualizado com dependências do Angular 21
```

**Modo padrão — pasta separada (com `ng new`):**

Antes de migrar qualquer arquivo, a CLI executa automaticamente `ng new` para criar a estrutura oficial do Angular 21. Os arquivos do projeto AngularJS são então migrados para dentro desse scaffold.

```
../meu-projeto-angular21/          ← criado via `ng new`
├── src/
│   └── app/
│       ├── user.component.ts      ← migrado do controller original
│       ├── auth.service.ts        ← migrado do service/factory original
│       └── currency.pipe.ts       ← migrado do filter original
├── angular.json                   ← gerado pelo Angular CLI
├── tsconfig.json                  ← gerado pelo Angular CLI
├── package.json                   ← atualizado com deps do projeto
└── MIGRATION_REPORT_<data>.md
```

**Fases de migração (ordem automática):**

| Fase | Tipo | Razão |
|---|---|---|
| 1 | Services & Factories | Sem dependências na maioria dos casos |
| 2 | Filters → Pipes | Dependem apenas de services |
| 3 | Directives & Components | Dependem de services e pipes |
| 4 | Controllers | Dependem de tudo acima |
| 5 | Templates HTML | Dependem dos componentes |
| 6 | Routing & Modules | Último pois referencia todos os anteriores |

**Contexto inteligente da IA:** Para cada arquivo migrado, a CLI injeta no prompt:
- Os nomes Angular sugeridos para as dependências injetadas (do registry)
- O nome Angular sugerido para o próprio símbolo do arquivo
- Tipo do arquivo (controller, service, etc.)

---

### `migrate-repo` — Migrar repositório remoto

Clona (em memória) um repositório do GitHub ou GitLab e migra todos os arquivos AngularJS.

```bash
# GitHub público
ng-migrate migrate-repo owner/repo

# GitHub privado
ng-migrate migrate-repo owner/repo --github-token ghp_...

# GitLab
ng-migrate migrate-repo grupo/projeto --gitlab-token glpat-...

# GitLab self-hosted
ng-migrate migrate-repo grupo/projeto \
  --gitlab-token glpat-... \
  --gitlab-url https://gitlab.minha-empresa.com

# Branch específica
ng-migrate migrate-repo owner/repo --branch develop

# Pasta de saída personalizada
ng-migrate migrate-repo owner/repo -o ./minha-saida

# Migrar apenas parte do projeto
ng-migrate migrate-repo owner/repo --only "src/app/**"

# Dry-run: analisa sem salvar
ng-migrate migrate-repo owner/repo --dry-run

# Criar Pull Request automaticamente após migração
ng-migrate migrate-repo owner/repo --create-pr
```

**Opções:**

| Opção | Padrão | Descrição |
|---|---|---|
| `--github-token <token>` | `$GITHUB_TOKEN` | Token GitHub |
| `--gitlab-token <token>` | `$GITLAB_TOKEN` | Token GitLab |
| `--gitlab-url <url>` | `https://gitlab.com` | URL base GitLab self-hosted |
| `-b, --branch <branch>` | branch default | Branch a migrar |
| `-o, --output <pasta>` | `./<repo>-angular21` | Pasta de saída |
| `--concurrency <n>` | `3` | Arquivos em paralelo |
| `--dry-run` | — | Analisa sem salvar arquivos |
| `--only <glob>` | — | Filtra por glob |
| `--skip-deps` | — | Não atualiza `package.json` |
| `--create-pr` | — | Cria PR/MR automático no repositório |

---

### `migrate` — Migrar arquivo único

Migra um único arquivo `.js`, `.ts` ou `.html` de AngularJS para Angular 21.

```bash
ng-migrate migrate app.js
ng-migrate migrate controller.js --tipo controller
ng-migrate migrate service.js -o service.ts
ng-migrate migrate filter.js --dry-run
ng-migrate migrate directive.js --show-diff
```

**Opções:**

| Opção | Padrão | Descrição |
|---|---|---|
| `-o, --output <caminho>` | `<arquivo>.migrated.ts` | Arquivo de saída |
| `-t, --tipo <tipo>` | `auto` | `controller` / `service` / `factory` / `filter` / `directive` / `template` / `auto` |
| `--dry-run` | — | Mostra o resultado sem salvar |
| `--show-diff` | — | Exibe diff lado a lado (original × migrado) |

---

### `analyze` — Analisar com IA

Envia um arquivo ou pasta para a IA e gera um relatório detalhado de migração (complexidade, padrões, estratégia sugerida).

```bash
ng-migrate analyze ./src
ng-migrate analyze controller.js
ng-migrate analyze ./src --json > relatorio.json
```

**Aliases em português:** `ng-migrate analisar`

Diferente do `scan` (análise estática), o `analyze` usa a IA para gerar um relatório qualitativo com:
- Complexidade e esforço estimado
- Padrões identificados e equivalentes no Angular 21
- Problemas específicos e como resolvê-los
- Ordem de migração sugerida

---

### `repl` — Modo interativo

Abre um loop interativo onde você cola código AngularJS e recebe o código Angular 21 imediatamente.

```bash
ng-migrate repl
```

Útil para testar trechos específicos ou entender como a IA migra determinados padrões sem precisar criar arquivos.

---

### `checklist` — Checklist de migração

Gera um checklist completo e personalizado de migração para o seu projeto.

```bash
ng-migrate checklist
ng-migrate checklist --projeto ./meu-projeto
ng-migrate checklist -p ./meu-projeto
```

O checklist inclui todos os passos necessários para uma migração bem-sucedida: configuração do ambiente, ordem de migração, testes, e verificações pós-migração.

---

## Fluxo de trabalho recomendado

### Projeto local

```bash
# Passo 1: Configure a IA (apenas uma vez)
ng-migrate config

# Passo 2: Vá até a pasta do projeto
cd meu-projeto-angularjs

# Passo 3: Analise o projeto
ng-migrate scan
# → Leia o resumo: complexidade, fases, horas estimadas

# Passo 4 (opcional): Análise profunda com IA
ng-migrate scan --ai --force

# Passo 5: Veja o plano sem executar
ng-migrate migrate-project --dry-run

# Passo 6: Execute a migração
ng-migrate migrate-project
# O que acontece automaticamente:
#   1. Verifica/instala o Angular CLI globalmente (se necessário)
#   2. FASE 1 — Escaneia o projeto: exibe arquivos, complexidade, plano de fases
#   3. FASE 2 — Executa `ng new` para criar o projeto Angular 21 base
#   4. IA migra cada arquivo por fase (services → routing)
#   5. package.json é atualizado com as deps corretas
#   6. npm install é executado no projeto final

# Modo in-place (dentro do próprio projeto, sem ng new)
ng-migrate migrate-project --in-place

# Migrando direto de um repositório remoto
ng-migrate migrate-project --clone https://github.com/usuario/repo

# Passo 7: Revise e corrija os erros
# O relatório MIGRATION_REPORT_*.md lista os arquivos com problema
cd ../meu-projeto-angular21
ng serve
```

### Repositório remoto

```bash
# Configure tokens
ng-migrate env set GITHUB_TOKEN ghp_...

# Dry-run para ver o escopo
ng-migrate migrate-repo owner/repo --dry-run

# Migrar
ng-migrate migrate-repo owner/repo

# Migrar e abrir PR automaticamente
ng-migrate migrate-repo owner/repo --create-pr
```

---

## Arquivos gerados pelo scan

Três arquivos são salvos na raiz do projeto após `ng-migrate scan`:

### `.ng-migrate-analysis.json`
```json
{
  "summary": {
    "totalFiles": 120,
    "angularJsFiles": 47,
    "overallComplexity": "média",
    "complexityDistribution": { "alta": 5, "média": 22, "baixa": 20 },
    "totalLoc": 8420,
    "estimatedHours": 34.5,
    "angularVersion": "1.8.3"
  },
  "files": [
    {
      "path": "src/app/user/user.controller.js",
      "type": "controller",
      "complexity": "alta",
      "loc": 312,
      "patterns": ["$scope", "$http", "$watch", "ng-model"],
      "dependencies": ["$scope", "$http", "UserService"],
      "problems": ["$scope.$apply: remover após migrar para signals"],
      "phase": 4,
      "estimatedHours": 3.5
    }
  ],
  "migrationPlan": {
    "phases": [
      { "phase": 1, "name": "Services & Factories", "files": ["..."] },
      { "phase": 4, "name": "Controllers", "files": ["..."] }
    ]
  }
}
```

### `.ng-migrate-registry.json`
```json
{
  "symbols": [
    {
      "kind": "controller",
      "angularName": "UserController",
      "suggestedClassName": "UserComponent",
      "file": "src/app/user/user.controller.js"
    },
    {
      "kind": "service",
      "angularName": "authService",
      "suggestedClassName": "AuthService",
      "file": "src/app/auth/auth.service.js"
    }
  ],
  "renameMap": {
    "UserController": "UserComponent",
    "authService": "AuthService"
  },
  "routes": [
    {
      "type": "ngRoute",
      "path": "/users",
      "controller": "UserController",
      "templateUrl": "user.html"
    }
  ],
  "modules": [
    { "moduleName": "app.main", "deps": ["ngRoute", "app.auth"] }
  ]
}
```

### `.ng-migrate-deps-graph.json`
```json
{
  "graph": {
    "src/app/user/user.controller.js": {
      "type": "controller",
      "phase": 4,
      "injects": ["$scope", "$http", "authService", "UserService"],
      "dependsOnFiles": [
        "src/app/auth/auth.service.js",
        "src/app/user/user.service.js"
      ]
    }
  }
}
```

---

## Estrutura de saída da migração

```
meu-projeto-angular21/
├── src/
│   └── app/
│       ├── user/
│       │   ├── user.component.ts       ← de user.controller.js
│       │   └── user.component.html     ← template migrado
│       ├── auth/
│       │   └── auth.service.ts         ← de auth.service.js / auth.factory.js
│       ├── shared/
│       │   └── currency.pipe.ts        ← de currency.filter.js
│       └── app.routes.ts               ← de app.routes.js ($routeProvider)
├── angular.json                        ← scaffold gerado automaticamente
├── tsconfig.json                       ← configuração TypeScript
├── package.json                        ← dependências atualizadas
└── MIGRATION_REPORT_2026-04-25.md      ← relatório detalhado
```

---

## O que é migrado automaticamente

| AngularJS | Angular 21 |
|---|---|
| `.controller()` | `@Component` standalone com Signals |
| `.service()` | `@Injectable({ providedIn: 'root' })` |
| `.factory()` | `@Injectable({ providedIn: 'root' })` |
| `.filter()` | `@Pipe({ standalone: true })` |
| `.directive()` | `@Component` ou `@Directive` standalone |
| `.component()` | `@Component` standalone |
| `$http` | `HttpClient` com `inject()` |
| `$scope` | `signal()` / `computed()` / `effect()` |
| `$rootScope` | Serviço singleton com signals |
| `$q` | `Promise` / `firstValueFrom()` |
| `$timeout` / `$interval` | `setTimeout` / `setInterval` |
| `$broadcast` / `$emit` | `Subject` (RxJS) ou signals |
| `$watch` | `effect()` / `computed()` |
| `$routeProvider` | `provideRouter()` |
| `$stateProvider` (ui-router) | `provideRouter()` com lazy loading |
| `ng-if` | `@if` (control flow) |
| `ng-for` / `ng-repeat` | `@for` (control flow) |
| `ng-switch` | `@switch` (control flow) |
| `ng-model` | `[(ngModel)]` ou signal binding |
| `ng-class` | `[class]` binding |
| `ng-show` / `ng-hide` | `[hidden]` / `@if` |
| `ng-click` | `(click)` event binding |
| `ng-controller` | Componente standalone |
| `templateUrl` externo | Template inline ou lazy loading |
| `link function` | `ngOnInit` / `ngOnChanges` |
| `angular.element` | `ElementRef` / `Renderer2` |
| `$compile` | `ViewContainerRef.createComponent()` |
| `$sce.trustAs` | `DomSanitizer` |
| `angular.copy` | `structuredClone()` |
| `angular.extend` | `Object.assign()` / spread |
| `angular.forEach` | `Array.forEach()` |
| `package.json` AngularJS deps | Dependências Angular 21 |

---

## Tokens de acesso

### GitHub
1. Acesse: https://github.com/settings/tokens/new
2. Escopos mínimos: `repo` (privado) ou `public_repo` (público)
3. Para `--create-pr`: adicionar `repo` completo
4. Salve com: `ng-migrate env set GITHUB_TOKEN ghp_...`

### GitLab
1. Acesse: Perfil → Access Tokens → Add new token
2. Escopos mínimos: `read_repository`
3. Para `--create-pr`: adicionar `write_repository`, `api`
4. Salve com: `ng-migrate env set GITLAB_TOKEN glpat-...`

---

## Executando no Windows

### PowerShell
```powershell
.\ng-migrate.ps1 config
.\ng-migrate.ps1 scan
.\ng-migrate.ps1 migrate-project --in-place
.\ng-migrate.ps1 env set OPENAI_API_KEY sk-...
```

### Prompt de Comando (CMD)
```cmd
ng-migrate.bat config
ng-migrate.bat scan
ng-migrate.bat migrate-project --in-place
```

### Adicionar alias permanente no PowerShell
```powershell
# Execute uma vez para adicionar ao seu perfil:
Add-Content $PROFILE "`nSet-Alias ng-migrate '$PWD\ng-migrate.ps1'"
# Depois de reabrir o terminal:
ng-migrate scan
```

---

## Configuração armazenada

| Local | Conteúdo |
|---|---|
| `~/.ng-migrate/config.json` | Provedor de IA, modelo, API keys (via `config`) |
| `~/.ng-migrate/.env` | Variáveis de ambiente (via `env`) |
| `<projeto>/.ng-migrate-analysis.json` | Análise estática do projeto |
| `<projeto>/.ng-migrate-registry.json` | Mapa de símbolos e rotas |
| `<projeto>/.ng-migrate-deps-graph.json` | Grafo de dependências entre arquivos |

> Adicione os arquivos `.ng-migrate-*.json` ao `.gitignore` se não quiser versioná-los, ou mantenha-os para acelerar migrações futuras.

---

## Requisitos

- **Node.js** 18 ou superior
- Pelo menos **uma** chave de API de IA (Anthropic, OpenAI, Azure ou Google)
- Para `migrate-repo`: token GitHub ou GitLab com escopos de leitura

---

## Licença

MIT
