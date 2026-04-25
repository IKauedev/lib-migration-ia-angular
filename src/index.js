#!/usr/bin/env node

import { program } from "commander";
import { migrateCommand } from "./commands/migrate.js";
import { analyzeCommand } from "./commands/analyze.js";
import { replCommand } from "./commands/repl.js";
import { checklistCommand } from "./commands/checklist.js";
import { migrateRepoCommand } from "./commands/migrate-repo.js";
import { migrateProjectCommand } from "./commands/migrate-project.js";
import { startCommand } from "./commands/start.js";
import { scanCommand } from "./commands/scan.js";
import { configCommand } from "./commands/config.js";
import { envCommand } from "./commands/env.js";
import { loadEnvFile } from "./utils/env-loader.js";
import { printBanner } from "./utils/ui.js";
import { activateDebug } from "./utils/debug.js";

// Load ~/.ng-migrate/.env before anything else
loadEnvFile();

printBanner();

program
  .name("ng-migrate")
  .description("CLI de migração AngularJS → Angular 21 com IA (multi-provider)")
  .version("2.0.0")
  .option(
    "--debug",
    "Modo debug: exibe detalhes de cada operação (arquivos lidos/criados, chamadas IA, etc.)",
  );

program.hook("preAction", () => {
  if (program.opts().debug) activateDebug();
});

// ── AI provider configuration ────────────────────────────────────────────────
program
  .command("config")
  .description(
    "Configura o provedor de IA (OpenAI, Azure AI, Anthropic, Gemini, etc.)",
  )
  .option("--show", "Exibe a configuração atual")
  .option("--reset", "Redefine todas as configurações")
  .option(
    "--task-model",
    "Configura modelos específicos por tarefa (migrate, analyze, scan, repl)",
  )
  .action(configCommand);

// ── Project analysis ──────────────────────────────────────────────────────────
program
  .command("scan [pasta]")
  .alias("escanear")
  .description(
    "Escaneia um projeto AngularJS e salva análise de complexidade em JSON",
  )
  .option(
    "--ai",
    "Análise profunda por arquivo via IA (mais lento, mais preciso)",
  )
  .option(
    "--force",
    "Força nova análise mesmo que já exista .ng-migrate-analysis.json",
  )
  .option("--no-save", "Não salva o arquivo .ng-migrate-analysis.json")
  .option(
    "--include-all",
    "Inclui também arquivos sem padrões AngularJS no relatório",
  )
  .option("--json", "Imprime o JSON completo no stdout")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate scan              Analisa a pasta atual
    ng-migrate scan .            Idem
    ng-migrate scan src/app      Analisa subfolder específico
    ng-migrate scan --ai         Análise profunda com IA por arquivo
    ng-migrate scan --force      Refaz a análise mesmo que já exista`,
  )
  .action(scanCommand);

// ── Single file migration ─────────────────────────────────────────────────────
program
  .command("migrate <arquivo>")
  .description("Migra um arquivo .js/.ts AngularJS para Angular 21")
  .option(
    "-o, --output <caminho>",
    "Arquivo de saída (padrão: <arquivo>.migrated.ts)",
  )
  .option(
    "-t, --tipo <tipo>",
    "Tipo: controller | service | filter | directive | template | factory | auto",
    "auto",
  )
  .option("--dry-run", "Apenas mostra o resultado, não salva")
  .option("--show-diff", "Mostra diff lado a lado")
  .action(migrateCommand);

// ── Full pipeline (scan → plan → scaffold → migrate) ──────────────────────────
program
  .command("start [pasta]")
  .alias("iniciar")
  .description(
    "Pipeline completo: escaneia o projeto, planeja e converte AngularJS → Angular 21 automaticamente",
  )
  .option(
    "--only <glob>",
    'Migrar apenas arquivos que casem com o padrão (ex: "src/app/**")',
  )
  .option(
    "--phase <n>",
    "Migrar apenas a fase N (1=services, 2=filters, 3=directives, 4=controllers, 5=templates, 6=routing)",
  )
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate start              Inicia o pipeline na pasta atual
    ng-migrate start src/app      Inicia o pipeline em uma subpasta
    ng-migrate start --only "src/services/**"   Migra apenas services
    ng-migrate start --phase 1    Executa apenas a fase 1 (services)`,
  )
  .action(startCommand);

// ── Local project migration ───────────────────────────────────────────────────
program
  .command("migrate-project [pasta]")
  .alias("migrar-projeto")
  .description("Migra projeto AngularJS local completo para Angular 21")
  .option(
    "--clone <url>",
    "Clona o repositório git antes de migrar (ex: https://github.com/user/repo)",
  )
  .option(
    "-o, --output <pasta>",
    "Pasta de saída (padrão: ./<projeto>-angular21)",
  )
  .option(
    "--in-place",
    "Migra dentro da própria pasta do projeto (cria src-angular21/ e backup em src-angularjs-backup/)",
  )
  .option("-c, --concurrency <n>", "Arquivos migrados em paralelo", "3")
  .option("--dry-run", "Lista arquivos que seriam migrados sem executar")
  .option(
    "--only <glob>",
    'Migrar apenas arquivos que casem com o padrão (ex: "src/app/**")',
  )
  .option(
    "--phase <n>",
    "Migrar apenas a fase N do plano (1=services, 2=filters, 3=directives, 4=controllers, 5=templates, 6=routing)",
  )
  .option("--skip-deps", "Não atualizar package.json")
  .option("--skip-install", "Não executar npm install após a migração")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate migrate-project              Migra pasta atual → pasta-angular21/
    ng-migrate migrate-project .            Idem
    ng-migrate migrate-project src/app      Migra subfolder específico
    ng-migrate migrate-project --clone https://github.com/user/repo   Clona e migra
    ng-migrate migrate-project --in-place   Migra no mesmo projeto (cria src-angular21/)
    ng-migrate migrate-project --dry-run    Lista o que seria migrado sem executar`,
  )
  .action(migrateProjectCommand);

// ── Remote repo migration ─────────────────────────────────────────────────────
program
  .command("migrate-repo <repo>")
  .description("Migra repositório completo do GitHub ou GitLab")
  .option(
    "--github-token <token>",
    "Token de acesso do GitHub (ou env GITHUB_TOKEN)",
  )
  .option(
    "--gitlab-token <token>",
    "Token de acesso do GitLab (ou env GITLAB_TOKEN)",
  )
  .option("--gitlab-url <url>", "URL base do GitLab", "https://gitlab.com")
  .option(
    "-b, --branch <branch>",
    "Branch a migrar (padrão: branch default do repo)",
  )
  .option("-o, --output <pasta>", "Pasta de saída da migração")
  .option("--concurrency <n>", "Arquivos migrados em paralelo", "3")
  .option("--dry-run", "Analisa e gera relatório sem salvar arquivos")
  .option("--only <glob>", "Migrar apenas arquivos que casem com o padrão")
  .option("--skip-deps", "Não atualizar package.json")
  .option(
    "--create-pr",
    "Criar Pull Request com as mudanças no repositório original",
  )
  .action(migrateRepoCommand);

// ── Analysis ──────────────────────────────────────────────────────────────────
program
  .command("analyze <arquivo_ou_pasta>")
  .alias("analisar")
  .description(
    "Analisa projeto/arquivo AngularJS e gera relatório de migração via IA",
  )
  .option("--json", "Saída em formato JSON")
  .action(analyzeCommand);

// ── REPL ──────────────────────────────────────────────────────────────────────
program
  .command("repl")
  .description("Modo interativo: cole código e receba conversão em tempo real")
  .action(replCommand);

// ── Checklist ─────────────────────────────────────────────────────────────────
program
  .command("checklist")
  .description("Gera checklist completo de migração para o seu projeto")
  .option("-p, --projeto <pasta>", "Pasta do projeto para análise", ".")
  .action(checklistCommand);

// ── Environment variables ─────────────────────────────────────────────────────
program
  .command("env [subcomando] [args...]")
  .description("Gerencia variáveis de ambiente (API keys, tokens, etc.)")
  .addHelpText(
    "after",
    `
  Sub-comandos:
    (nenhum)               Abre o assistente interativo
    list                   Lista todas as variáveis salvas
    set  <VARIAVEL> <val>  Define uma variável
    remove <VARIAVEL>      Remove uma variável
    clear                  Remove todas as variáveis

  Exemplos:
    ng-migrate env
    ng-migrate env set OPENAI_API_KEY sk-...
    ng-migrate env set AZURE_OPENAI_KEY mykey123
    ng-migrate env list
    ng-migrate env remove GITHUB_TOKEN`,
  )
  .action(envCommand);

program.parse();
