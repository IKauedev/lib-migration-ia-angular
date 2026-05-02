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
import { generateTestsCommand } from "./commands/generate-tests.js";
import { doctorCommand } from "./commands/doctor.js";
import { watchCommand } from "./commands/watch.js";
import { libsCommand } from "./commands/libs.js";
import { loadEnvFile } from "./utils/env-loader.js";
import { printBanner } from "./utils/ui.js";
import { activateDebug } from "./utils/debug.js";
import { interactiveShell } from "./cli/shell.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";

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

program.action(async () => {
  await interactiveShell();
});

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
  .option("--fresh", "Ignorar checkpoint existente e iniciar migração do zero")
  .option(
    "--state-management <tipo>",
    "Estratégia de gerenciamento de estado: signals (padrão), ngrx, standalone",
    "signals",
  )
  .option("--validate-ts", "Validar TypeScript compilado após cada fase")
  .option(
    "--generate-tests",
    "Gerar testes unitários para cada arquivo migrado",
  )
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate migrate-project              Migra pasta atual → pasta-angular21/
    ng-migrate migrate-project .            Idem
    ng-migrate migrate-project src/app      Migra subfolder específico
    ng-migrate migrate-project --clone https://github.com/user/repo   Clona e migra
    ng-migrate migrate-project --in-place   Migra no mesmo projeto (cria src-angular21/)
    ng-migrate migrate-project --dry-run    Lista o que seria migrado sem executar
    ng-migrate migrate-project --fresh      Ignora checkpoint e começa do zero
    ng-migrate migrate-project --state-management ngrx   Usa NgRx para estado
    ng-migrate migrate-project --validate-ts             Valida TypeScript após cada fase
    ng-migrate migrate-project --generate-tests          Gera testes para cada arquivo`,
  )
  .action(migrateProjectCommand);

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

program
  .command("analyze <arquivo_ou_pasta>")
  .alias("analisar")
  .description(
    "Analisa projeto/arquivo AngularJS e gera relatório de migração via IA",
  )
  .option("--json", "Saída em formato JSON")
  .action(analyzeCommand);

program
  .command("repl")
  .description("Modo interativo: cole código e receba conversão em tempo real")
  .action(replCommand);

program
  .command("checklist")
  .description("Gera checklist completo de migração para o seu projeto")
  .option("-p, --projeto <pasta>", "Pasta do projeto para análise", ".")
  .action(checklistCommand);

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

program
  .command("generate-tests [caminho]")
  .alias("gerar-testes")
  .description(
    "Gera ou migra testes unitários para arquivos Angular 21 migrados",
  )
  .option(
    "--from-spec",
    "Migra spec files AngularJS existentes para Angular/Jest",
  )
  .option("-o, --output <pasta>", "Pasta de saída dos testes gerados")
  .option("--only <glob>", "Processar apenas arquivos que casem com o padrão")
  .option("-c, --concurrency <n>", "Arquivos processados em paralelo", "2")
  .option("--dry-run", "Lista arquivos que seriam processados sem executar")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate generate-tests src/app             Gera testes para toda a pasta
    ng-migrate generate-tests src/app/my.service.ts  Gera teste para um arquivo
    ng-migrate generate-tests --from-spec src/   Migra specs AngularJS existentes
    ng-migrate generate-tests --dry-run          Lista o que seria processado`,
  )
  .action(generateTestsCommand);

program
  .command("doctor")
  .description(
    "Verifica a saúde do ambiente: Node.js, Angular CLI, git, configuração de IA",
  )
  .option("--ping", "Faz uma chamada real de ping para validar a API key")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate doctor           Verifica o ambiente
    ng-migrate doctor --ping    Valida a API key com uma chamada real`,
  )
  .action(doctorCommand);

program
  .command("watch [pasta]")
  .description("Monitora arquivos AngularJS e migra automaticamente ao salvar")
  .option(
    "-o, --out <pasta>",
    "Pasta de saída dos arquivos migrados",
    "migrated-angular21",
  )
  .option("--only <ext>", "Extensão a monitorar", ".js")
  .option("--dry-run", "Detecta e loga mudanças sem migrar")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate watch                     Monitora a pasta atual
    ng-migrate watch src/app             Monitora src/app
    ng-migrate watch src --out dist/ng21 Saída customizada
    ng-migrate watch --dry-run           Apenas loga, sem migrar`,
  )
  .action(watchCommand);

program
  .command("libs [pasta]")
  .description(
    "Analisa o package.json e gera relatório de migração de bibliotecas",
  )
  .option("--json", "Imprime o relatório completo em JSON no stdout")
  .option("--no-save", "Não salva o arquivo .ng-migrate-libs.json")
  .addHelpText(
    "after",
    `
  Exemplos:
    ng-migrate libs                Analisa o projeto na pasta atual
    ng-migrate libs src/myapp      Analisa projeto em src/myapp
    ng-migrate libs --json         Saída em JSON para CI/scripts
    ng-migrate libs --no-save      Apenas exibe, não salva arquivo`,
  )
  .action(libsCommand);

// Auto-detect AngularJS project if no path is given and cwd has angular patterns
function detectAngularJsProject(cwd = process.cwd()) {
  const indicators = ["bower.json", "angular.js", ".bowerrc"];
  return indicators.some((f) => fs.existsSync(path.join(cwd, f)));
}

if (process.argv.length === 2 && detectAngularJsProject()) {
  console.log(chalk.yellow(`\n  Projeto AngularJS detectado na pasta atual.`));
  console.log(
    chalk.dim(
      `  Dica: rode ${chalk.cyan("ng-migrate scan")} para analisar ou ${chalk.cyan("ng-migrate start")} para migrar.\n`,
    ),
  );
}

await program.parseAsync();
