# ng-migrate-angularjs-ai

> CLI inteligente para migração de **AngularJS 1.x → Angular 21** com suporte a múltiplos provedores de IA.

**Pacote:** `ng-migrate-angularjs-ai`  
**Versão:** 2.0.0  
**Plataforma:** Node.js 18+ · Windows / macOS / Linux

---

## Índice

1. [Instalação](#instalação)
2. [Configuração rápida](#configuração-rápida)
3. [Provedores de IA suportados](#provedores-de-ia-suportados)
4. [Shell Interativo](#shell-interativo)
5. [Comandos](#comandos)
   - [config — Configurar provedor de IA](#config--configurar-provedor-de-ia)
   - [env — Gerenciar variáveis de ambiente](#env--gerenciar-variáveis-de-ambiente)
   - [scan — Analisar projeto](#scan--analisar-projeto)
   - [libs — Relatório de bibliotecas](#libs--relatório-de-bibliotecas)
   - [start — Pipeline automático](#start--pipeline-automático)
   - [migrate-project — Migrar projeto local](#migrate-project--migrar-projeto-local)
   - [migrate-repo — Migrar repositório remoto](#migrate-repo--migrar-repositório-remoto)
   - [migrate — Migrar arquivo único](#migrate--migrar-arquivo-único)
   - [analyze — Analisar com IA](#analyze--analisar-com-ia)
   - [repl — Modo interativo](#repl--modo-interativo)
   - [checklist — Checklist de migração](#checklist--checklist-de-migração)
   - [watch — Monitorar e migrar em tempo real](#watch--monitorar-e-migrar-em-tempo-real)
   - [doctor — Diagnóstico do ambiente](#doctor--diagnóstico-do-ambiente)
6. [Funcionalidades avançadas](#funcionalidades-avançadas)
   - [Filtro de arquivos vendor e minificados](#filtro-de-arquivos-vendor-e-minificados)
   - [Estimativa de custo de tokens](#estimativa-de-custo-de-tokens)
   - [Post-cleanup automático](#post-cleanup-automático)
   - [Relatório HTML](#relatório-html)
   - [Sistema de plugins](#sistema-de-plugins)
7. [Fluxo de trabalho recomendado](#fluxo-de-trabalho-recomendado)
8. [Arquivos gerados pelo scan](#arquivos-gerados-pelo-scan)
9. [Estrutura de saída da migração](#estrutura-de-saída-da-migração)
10. [O que é migrado automaticamente](#o-que-é-migrado-automaticamente)
11. [Tokens de acesso](#tokens-de-acesso)
12. [Executando no Windows](#executando-no-windows)
13. [Configuração armazenada](#configuração-armazenada)
14. [Arquitetura interna](#arquitetura-interna)
15. [Requisitos](#requisitos)

---

## Instalação

```bash
# Via npm (recomendado)
npm install -g ng-migrate-angularjs-ai
```

```bash
# Via código-fonte
git clone https://github.com/IKauedev/lib-migration-ia-angular.git
cd lib-migration-ia-angular
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

| Provedor | Variável de Ambiente | Modelos padrão | Observação |
|---|---|---|---|
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | `claude-opus-4-5`, `claude-3-5-sonnet-20241022`, `claude-3-haiku-20240307` | Recomendado — melhor qualidade na migração |
| **OpenAI GPT** | `OPENAI_API_KEY` | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` | GPT-4o e variantes |
| **Azure OpenAI** | `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT` | Configurável via deployment | Para ambientes corporativos |
| **Google Gemini** | `GOOGLE_API_KEY` | `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash` | Gemini 2.0 Flash / 1.5 Pro |
| **OpenAI-Compatible** | Configurável via `config` | Qualquer modelo compatível | Groq, Together AI, etc. |
| **OpenRouter** | `OPENROUTER_API_KEY` | `anthropic/claude-opus-4-5`, `openai/gpt-4o`, `deepseek/deepseek-r1`, etc. | Acesso unificado a múltiplos modelos |
| **Ollama (local)** | — (sem chave) | `llama3`, `codellama`, `mistral`, `qwen2.5-coder`, etc. | Execução 100% local |

Você pode trocar o provedor a qualquer momento com `ng-migrate config`.

---

## Shell Interativo

Ao executar `ng-migrate` **sem argumentos**, a CLI abre um shell interativo completo com histórico de comandos e autocompletar por `Tab`:

```bash
ng-migrate
# Abre o shell interativo ng-migrate>
```

```
ng-migrate> scan ./meu-projeto
ng-migrate> migrate-project --dry-run
ng-migrate> config
ng-migrate> exit
```

**Recursos do shell:**
- **Histórico persistente** salvo em `~/.ng-migrate/.shell_history` (até 500 entradas)
- **Autocompletar** com `Tab` — completa comandos e caminhos de arquivo para `migrate <arquivo>`
- **Verificação de API keys** ao iniciar — exibe status de todos os provedores configurados
- **Aliases curtos** para agilidade:

| Alias | Comando completo |
|---|---|
| `s` | `scan` |
| `m` | `migrate` |
| `mp` | `migrate-project` |
| `mr` | `migrate-repo` |
| `a` | `analyze` |
| `c` | `config` |
| `cl` | `checklist` |
| `st` | `start` |
| `r` | `repl` |
| `e` | `env` |
| `q` | `exit` |

---

## Comandos

### `config` — Configurar provedor de IA

Abre um assistente interativo para selecionar e configurar o provedor de IA.

```bash
ng-migrate config               # Assistente interativo
ng-migrate config --show        # Exibe a configuração atual
ng-migrate config --reset       # Remove todas as configurações salvas
ng-migrate config --task-model  # Configura modelos específicos por tarefa
```

**O assistente pergunta:**
- Qual provedor usar (Anthropic, OpenAI, Azure OpenAI, Google Gemini, OpenRouter, Ollama, etc.)
- API Key (exibida como senha, não aparece no terminal)
- Campos específicos do provedor (endpoint Azure, deployment, versão da API, etc.)
- Qual modelo usar (ex: `claude-opus-4-5`, `gpt-4o`, `gemini-2.0-flash`)

A configuração é salva em `~/.ng-migrate/config.json` e reutilizada automaticamente.

**`--task-model` — modelos por tarefa:**

Permite configurar modelos diferentes para cada tipo de operação:

| Tarefa | Descrição |
|---|---|
| `migration` | Migração de arquivo (`migrate`) |
| `analysis` | Análise de arquivo/projeto (`analyze`) |
| `scan` | Varredura com IA (`scan --ai`) |
| `chat` | REPL interativo (`repl`) |

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

### `start` — Pipeline automático

Executa o pipeline completo de migração em 4 fases de forma totalmente automatizada: escaneia, planeja, confirma e migra.

```bash
ng-migrate start                     # Pipeline na pasta atual
ng-migrate start ./meu-projeto       # Pipeline em pasta específica
ng-migrate start --only "src/**"     # Filtra por glob
ng-migrate start --phase 1           # Executa apenas a fase 1 (services)
```

**Aliases em português:** `ng-migrate iniciar`

**As 4 fases do pipeline:**

| Fase | O que acontece |
|---|---|
| **1/4 — Escanear** | Detecta todos os arquivos AngularJS, complexidade e dependências |
| **2/4 — Planejar** | Exibe resumo completo: arquivos, complexidade, horas estimadas, plano de fases |
| **3/4 — Confirmar** | Pergunta confirmação antes de qualquer alteração |
| **4/4 — Migrar** | Executa `migrate-project` com as opções definidas |

> Diferente de `migrate-project`, o `start` é interativo — exibe o plano completo e pede confirmação antes de migrar.

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
ng-migrate migrate-project --concurrency 5    # 5 arquivos em paralelo
ng-migrate migrate-project --phase 1          # Migra apenas serviços/factories
ng-migrate migrate-project --only "src/**"    # Filtra por glob
ng-migrate migrate-project --skip-deps        # Não atualiza package.json
ng-migrate migrate-project --skip-install     # Não executa npm install ao final
ng-migrate migrate-project --fresh            # Ignora checkpoint e começa do zero
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
| `--fresh` | — | Ignora checkpoint existente e reinicia do zero |

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

### `libs` — Relatório de bibliotecas

Analisa o `package.json` do projeto e gera um relatório completo de migração de bibliotecas, categorizando cada dependência.

```bash
ng-migrate libs                # Analisa a pasta atual
ng-migrate libs ./meu-projeto  # Analisa pasta específica
ng-migrate libs --json         # Saída em JSON (útil para CI/scripts)
ng-migrate libs --no-save      # Apenas exibe, não salva arquivo
```

**5 categorias de classificação:**

| Símbolo | Categoria | Descrição |
|---------|-----------|-----------|
| ✔ | **A substituir** | Tem equivalente no Angular 21 |
| ✖ | **A remover** | Obsoleta — não é necessária no Angular |
| ⚠ | **Migração manual** | Requer atenção e adaptação humana |
| ? | **Sem mapeamento** | Relacionada ao AngularJS mas sem mapeamento conhecido |
| → | **Mantida** | Não é AngularJS — permanece no projeto |

**Exemplos de substituições automáticas mapeadas:**

| AngularJS | Angular 21 |
|-----------|------------|
| `angular-ui-router` | `@angular/router` |
| `angular-animate` | `@angular/animations` |
| `angular-material` | `@angular/material` |
| `angular-translate` | `@ngx-translate/core` |
| `restangular` | `@angular/common/http` |
| `ui-select` | `@ng-select/ng-select` |

**Arquivo salvo:** `.ng-migrate-libs.json` na raiz do projeto.

> O comando `scan` também exibe um resumo automático das bibliotecas após varrer o projeto. Use `ng-migrate libs` para o relatório completo.

---

### `watch` — Monitorar e migrar em tempo real

Monitora uma pasta e migra automaticamente cada arquivo AngularJS salvo, usando IA e aplicando post-cleanup.

```bash
ng-migrate watch                      # Monitora a pasta atual
ng-migrate watch src/app              # Monitora pasta específica
ng-migrate watch src --out dist/ng21  # Define pasta de saída
ng-migrate watch --only .js           # Monitora apenas arquivos .js
ng-migrate watch --dry-run            # Apenas loga as mudanças, sem migrar
```

**Opções:**

| Opção | Padrão | Descrição |
|-------|--------|-----------|
| `[pasta]` | `.` (atual) | Pasta a monitorar |
| `--out <pasta>` | `<pasta>-angular21` | Pasta de saída dos arquivos migrados |
| `--only <ext>` | `.js` | Extensão a monitorar (ex: `.ts`, `.html`) |
| `--dry-run` | — | Detecta mudanças mas não executa migração |

> O `watch` usa `chokidar` internamente. Ao salvar um arquivo, ele é migrado imediatamente com post-cleanup aplicado. Ideal para refatoração incremental.

---

### `doctor` — Diagnóstico do ambiente

Verifica se todos os requisitos do `ng-migrate` estão corretamente instalados e configurados.

```bash
ng-migrate doctor           # Diagnóstico completo
ng-migrate doctor --ping    # Inclui teste de conectividade com a API de IA configurada
```

**Verificações realizadas:**

| Verificação | O que valida |
|-------------|-------------|
| **Node.js ≥ 18** | Versão mínima suportada |
| **Angular CLI** | Se `@angular/cli` está instalado globalmente |
| **Git** | Se `git` está disponível no PATH |
| **Configuração de IA** | Se existe provedor e API key configurados |
| **Ping de IA** (`--ping`) | Envia uma requisição real à API para validar conectividade |

Cada item exibe ✔ (ok), ✖ (falha) ou ⚠ (atenção), com a mensagem de correção quando aplicável.

---

## Funcionalidades avançadas

### Filtro de arquivos vendor e minificados

O `ng-migrate` ignora automaticamente arquivos que não devem ser migrados, **economizando tokens de IA** e acelerando o scan:

**Padrões ignorados:**
- Arquivos minificados: `*.min.js`, `*.min.css`, `*.bundle.js`, `*.packed.js`
- Pastas de vendor: `vendor/`, `bower_components/`, `public/lib/`, `assets/lib/`, `assets/vendor/`, `static/lib/`
- Bibliotecas conhecidas por nome: jQuery, Bootstrap, Lodash, Underscore, Moment.js, `angular.js`, `angular-mocks.js`
- **Limite de tamanho:** arquivos maiores que **300 KB** são ignorados automaticamente

Esses filtros se aplicam tanto ao `scan` quanto ao `migrate-project`.

---

### Estimativa de custo de tokens

Antes de migrar projetos grandes, você pode estimar o custo de tokens de IA:

```bash
ng-migrate migrate-project --dry-run
# O resumo exibe: arquivos × LOC estimada × custo estimado por provedor
```

**Modelos com precificação conhecida:**

| Modelo | Input (1M tokens) | Output (1M tokens) |
|--------|-------------------|---------------------|
| `claude-opus-4-5` | $15 | $75 |
| `claude-3-5-sonnet` | $3 | $15 |
| `claude-3-haiku` | $0,25 | $1,25 |
| `gpt-4o` | $2,50 | $10 |
| `gpt-4o-mini` | $0,15 | $0,60 |
| `gemini-2.0-flash` | $0,10 | $0,40 |

---

### Post-cleanup automático

Após cada migração, o `ng-migrate` aplica **28 regras de correção automática** sobre o código gerado pela IA, garantindo compatibilidade com Angular 21:

| Categoria | Exemplos de correções |
|-----------|-----------------------|
| **APIs obsoletas** | `angular.copy` → `structuredClone()`, `angular.extend` → `Object.assign()` |
| **Imports** | Remove imports de `@angular/core` duplicados ou obsoletos |
| **Sintaxe de templates** | `ng-if` → `@if`, `ng-for` → `@for`, `ng-switch` → `@switch` |
| **Signals** | `this.value` → `this.value()` em contextos de signal |
| **Decoradores** | Garante `standalone: true` em todos os componentes |

O post-cleanup é executado automaticamente pelo `migrate-project`, `migrate` e `watch`.

---

### Relatório HTML

Além do `MIGRATION_REPORT_*.md`, a migração pode gerar um **relatório HTML interativo**:

```
<projeto>-angular21/
└── MIGRATION_REPORT_2026-05-02.html   ← relatório visual com gráficos
```

O HTML inclui: gráfico de complexidade por fase, lista de arquivos migrados, erros encontrados, taxa de sucesso e links para os arquivos gerados.

---

### Sistema de plugins

O `ng-migrate` suporta um sistema de plugins para personalizar o comportamento da migração:

**Estrutura de um plugin** (arquivo `.js` ou `.mjs`):

```js
export default {
  // Regras adicionais de skip (além das padrão)
  skipPatterns: [/meu-legado\.js$/],

  // Regras de post-cleanup customizadas
  cleanupRules: [
    { pattern: /oldAPI\(/g, replacement: "newAPI(" }
  ],

  // Adições ao prompt da IA
  promptAdditions: "Preserve comentários JSDoc em todos os métodos públicos.",

  // Hook executado após cada arquivo migrado
  async postProcess(filePath, content) {
    return content.replace(/console\.log/g, "// console.log");
  }
};
```

**Uso:**

```bash
ng-migrate migrate-project --plugin ./meu-plugin.mjs
```

---

## Fluxo de trabalho recomendado

### Opção A — Pipeline automático (`start`)

```bash
# 1. Configure a IA (apenas uma vez)
ng-migrate config

# 2. Vá até a pasta do projeto
cd meu-projeto-angularjs

# 3. Inicie o pipeline completo
ng-migrate start
# → Escaneia, exibe o plano, pede confirmação e migra automaticamente
```

### Opção B — Controle manual

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

# Retomar migração interrompida (usa checkpoint automático)
ng-migrate migrate-project
# Para reiniciar do zero ignorando o checkpoint:
ng-migrate migrate-project --fresh

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
| `~/.ng-migrate/config.json` | Provedor de IA, modelo, API keys, modelos por tarefa (via `config`) |
| `~/.ng-migrate/.env` | Variáveis de ambiente (via `env`) |
| `~/.ng-migrate/.shell_history` | Histórico do shell interativo (até 500 entradas) |
| `<projeto>/.ng-migrate-analysis.json` | Análise estática do projeto |
| `<projeto>/.ng-migrate-registry.json` | Mapa de símbolos e rotas |
| `<projeto>/.ng-migrate-deps-graph.json` | Grafo de dependências entre arquivos |
| `<projeto>/.ng-migrate-libs.json` | Relatório de bibliotecas do package.json (via `libs` ou `scan`) |
| `<projeto>/.ng-migrate-cache.json` | Cache de arquivos já migrados (evita re-migração) |

> Adicione os arquivos `.ng-migrate-*.json` ao `.gitignore` se não quiser versioná-los, ou mantenha-os para acelerar migrações futuras.

---

## Arquitetura interna

```
src/
├── index.js                      # Ponto de entrada — Commander CLI
├── cli/
│   ├── shell.js                  # Shell interativo (readline, histórico, autocompletar)
│   ├── dispatcher.js             # Despacha comandos do shell para os handlers
│   ├── tokenizer.js              # Tokeniza linha de comando do shell
│   └── wizard.js                 # Wizard interativo (verificação de API keys)
├── commands/                     # Handlers de cada comando CLI
│   ├── config.js                 # ng-migrate config
│   ├── env.js                    # ng-migrate env
│   ├── scan.js                   # ng-migrate scan
│   ├── start.js                  # ng-migrate start (pipeline automático)
│   ├── migrate-project.js        # ng-migrate migrate-project
│   ├── migrate-repo.js           # ng-migrate migrate-repo
│   ├── migrate.js                # ng-migrate migrate <arquivo>
│   ├── analyze.js                # ng-migrate analyze
│   ├── repl.js                   # ng-migrate repl
│   ├── checklist.js              # ng-migrate checklist
│   ├── watch.js                  # ng-migrate watch (file watcher + migração automática)
│   ├── doctor.js                 # ng-migrate doctor (diagnóstico do ambiente)
│   └── libs.js                   # ng-migrate libs (relatório de bibliotecas)
├── core/
│   ├── orchestrator.js           # MigrationOrchestrator — cache por hash, roteamento de modelos
│   ├── context/
│   │   └── project-context.js    # Contexto do projeto para injeção nos prompts
│   ├── git/
│   │   ├── github.js             # API GitHub
│   │   ├── gitlab.js             # API GitLab
│   │   └── index.js              # Façade de providers git
│   ├── migration/
│   │   └── classifier.js         # Detecção de padrões AngularJS e skip de arquivos
│   ├── persona/
│   │   └── migration-persona.js  # ARIA — persona, regras absolutas R1-R9, model tiers
│   └── scanner/
│       ├── analyzer.js           # Detecta tipo, complexidade, padrões, dependências
│       ├── extractor.js          # Extrai símbolos, rotas, módulos, grafo de deps
│       ├── phase-planner.js      # Calcula fase e horas estimadas por arquivo
│       └── index.js              # scanProject() — orquestra o scan completo
├── providers/
│   ├── clients.js                # Construtores dos clientes de IA (Anthropic, OpenAI, etc.)
│   ├── router.js                 # sendToProvider() — roteia chamadas ao provedor ativo
│   └── langchain.js              # Integração LangChain (opcional)
└── utils/                        # Utilitários legados / compatibilidade
    ├── ai-providers.js           # Builders de clientes (compatibilidade)
    ├── ai.js                     # migrateWithAI(), analyzeWithAI()
    ├── config-manager.js         # loadConfig(), saveConfig(), PROVIDERS
    ├── cost-estimator.js         # estimateMigrationCost() — precificação por modelo
    ├── debug.js                  # Modo debug (--debug)
    ├── deps-migrator.js          # Migração de package.json
    ├── env-loader.js             # Carrega ~/.ng-migrate/.env
    ├── git-providers.js          # GitHub/GitLab API wrappers
    ├── html-report.js            # buildHtmlReport(), saveHtmlReport()
    ├── langchain-provider.js     # LangChain integration
    ├── lib-mapper.js             # LIB_MAPPINGS, findMapping(), buildFullLibReport()
    ├── ng-checker.js             # Angular CLI install, git clone, ng new
    ├── parser.js                 # Extrai blocos de código das respostas da IA
    ├── plugin-loader.js          # loadPlugin(), applyPluginRules(), shouldSkipFile()
    ├── post-cleanup.js           # applyPostCleanup() — 28 regras de auto-correção
    ├── project-scanner.js        # Scanner legado (compat)
    ├── report.js                 # Geração de MIGRATION_REPORT_*.md
    └── ui.js                     # printBanner(), ui helpers, chalk
```

### ARIA — Agente de migração

A IA opera sob a persona **ARIA** (*Angular Refactoring Intelligence Agent*), com regras absolutas que garantem código Angular 21 idiomático e completo:

| Regra | Descrição |
|---|---|
| **R1** | Código **completo** — sem `// TODO`, placeholders ou trechos omitidos |
| **R2** | `standalone: true` em 100% dos Components, Pipes e Directives |
| **R3** | `signal()` para estado reativo, `computed()` para derivados, `effect()` para side-effects |
| **R4** | `inject()` para injeção de dependências — construtor apenas quando `super()` é obrigatório |
| **R5** | Template control flow moderno: `@if`, `@for` (com `track`), `@switch`, `@defer` |
| **R6** | TypeScript strict — tipo explícito em propriedades públicas e parâmetros |
| **R7** | Nomenclatura consistente: `myCtrl` → `MyComponent`, `userSvc` → `UserService` |
| **R8** | Sem comentários explicativos — código auto-documentado |
| **R9** | Preservar 100% da lógica de negócio original |

### Roteamento de modelos por complexidade

O `MigrationOrchestrator` seleciona automaticamente o tier do modelo com base na complexidade e fase de cada arquivo:

| Tier | Usado para |
|---|---|
| **fast** | Arquivos de baixa complexidade · Filtros · Templates |
| **standard** | Complexidade média · Services · Directives · Controllers |
| **premium** | Alta complexidade · Routing & Modules (fase 6) |

O cache (`.ng-migrate-cache.json`) usa hash SHA-256 do conteúdo — arquivos não modificados não são re-migrados.

---

## Requisitos

- **Node.js** 18 ou superior
- Pelo menos **uma** chave de API de IA (Anthropic, OpenAI, Azure, Google, OpenRouter) **ou** Ollama rodando localmente
- Para `migrate-repo`: token GitHub ou GitLab com escopos de leitura

---

## Licença

MIT
