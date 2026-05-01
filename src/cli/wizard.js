import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { loadConfig, PROVIDERS } from "../utils/config-manager.js";



 
export function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}



 
export function checkApiKeys() {
    const config = loadConfig();
    const active = config.activeProvider;
    const providerCfg = config.providers[active] || {};
    const providerMeta = PROVIDERS[active];

    console.log();
    console.log(chalk.bold.white("  Verificação de API Keys"));
    console.log(chalk.dim("  " + "─".repeat(50)));

    const statuses = Object.entries(PROVIDERS).map(([key, meta]) => {
        const cfg = config.providers[key] || {};
        const isNoKey = !!meta.noKeyRequired;
        const hasKey = isNoKey ?
            !!(cfg.endpoint || cfg.model) :
            !!(cfg.apiKey || (meta.envKey && process.env[meta.envKey]));
        const isActive = key === active;

        const icon = hasKey ? chalk.green("  ✔") : chalk.gray("  ○");
        const label = isActive ?
            chalk.cyan.bold(meta.name) + chalk.cyan(" (ativo)") :
            chalk.dim(meta.name);

        let keyInfo;
        if (hasKey) {
            keyInfo = isNoKey ?
                chalk.dim(" — configurado (local)") :
                chalk.dim(" — configurado");
        } else {
            keyInfo = isNoKey ?
                chalk.red(" — não configurado (rode: ollama serve)") :
                chalk.red(" — não configurado");
        }

        console.log(icon + "  " + label + keyInfo);
        return { key, hasKey, isActive };
    });

    console.log();

    const found = statuses.find((s) => s.isActive);
    const activeHasKey = found ? found.hasKey : false;

    if (activeHasKey) {
        const model = providerCfg.model || "modelo padrão";
        console.log(
            chalk.green("  ✔ ") +
            chalk.green("Provedor ativo: ") +
            chalk.cyan.bold((providerMeta && providerMeta.name) || active) +
            chalk.dim(` | modelo: ${model}`),
        );
        console.log();
    } else {
        const envKey = providerMeta && providerMeta.envKey;
        console.log(
            chalk.yellow("  ⚠ ") +
            chalk.yellow(
                `Provedor ativo (${(providerMeta && providerMeta.name) || active}) não possui API key configurada.`,
            ),
        );
        console.log(
            chalk.dim("  Configure com: ") +
            chalk.cyan("config") +
            (envKey ?
                chalk.dim(`  ou defina a variável: ${chalk.white(envKey)}`) :
                ""),
        );
        console.log();
    }

    return activeHasKey;
}



 
export function resolveDir(input) {
    if (!input) return null;
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const expanded = input.replace(/^~/, home);
    return path.resolve(expanded);
}



 
export async function migrationWizard(_rl, commandLabel) {
    const { default: inquirer } = await
    import ("inquirer");

    console.log();
    console.log(chalk.bgCyan.black.bold("  ASSISTENTE DE MIGRAÇÃO  "));
    console.log(chalk.dim("  " + "─".repeat(50)));
    console.log(chalk.dim("  Vou te guiar pelas configurações antes de iniciar.\n"));


    console.log(chalk.bold("  1. Diretório do projeto AngularJS (origem)"));
    console.log(chalk.dim("     Onde está o projeto que será migrado?"));
    console.log(
        chalk.dim("     (padrão: diretório atual — pressione Enter para usar)"),
    );
    console.log();

    const { sourcePath: sourceAnswer } = await inquirer.prompt([{
        type: "input",
        name: "sourcePath",
        message: chalk.cyan("  Caminho do projeto AngularJS:"),
        default: process.cwd(),
        validate: (input) => {
            const dir = resolveDir(input);
            if (!dir) return "Caminho inválido.";
            if (!fs.existsSync(dir)) return `Pasta não encontrada: ${dir}`;
            if (!fs.lstatSync(dir).isDirectory())
                return "O caminho deve ser uma pasta.";
            return true;
        },
    }, ]);

    const sourcePath = resolveDir(sourceAnswer);


    console.log();
    console.log(chalk.bold("  2. Diretório de saída (projeto Angular 21)"));
    console.log(chalk.dim("     Onde o projeto migrado será criado?"));
    const defaultOutput = sourcePath + "-angular21";
    console.log(chalk.dim(`     (padrão: ${defaultOutput})`));
    console.log();

    const { outputPath: outputAnswer } = await inquirer.prompt([{
        type: "input",
        name: "outputPath",
        message: chalk.cyan("  Caminho de saída:"),
        default: defaultOutput,
    }, ]);

    const outputPath = resolveDir(outputAnswer);


    console.log();
    console.log(chalk.bold("  3. Verificação de API Keys"));
    console.log(chalk.dim("  " + "─".repeat(50)));
    const hasKey = checkApiKeys();

    if (!hasKey) {
        const { continueAnyway } = await inquirer.prompt([{
            type: "confirm",
            name: "continueAnyway",
            message: chalk.yellow(
                "  Nenhuma API key configurada. Continuar mesmo assim?",
            ),
            default: false,
        }, ]);

        if (!continueAnyway) {
            console.log();
            console.log(
                chalk.dim("  Migração cancelada. Configure com: ") + chalk.cyan("config"),
            );
            console.log();
            return { sourcePath, outputPath, confirmed: false };
        }
    }


    console.log();
    console.log(chalk.bold.white("  Resumo da migração"));
    console.log(chalk.dim("  " + "─".repeat(50)));
    console.log(chalk.dim("  Comando:      ") + chalk.cyan(commandLabel));
    console.log(chalk.dim("  Origem:       ") + chalk.white(sourcePath));
    console.log(chalk.dim("  Saída:        ") + chalk.white(outputPath));

    const config = loadConfig();
    const pMeta = PROVIDERS[config.activeProvider];
    const pCfg = config.providers[config.activeProvider] || {};
    console.log(
        chalk.dim("  Provedor IA:  ") +
        chalk.cyan((pMeta && pMeta.name) || config.activeProvider) +
        chalk.dim(` (${pCfg.model || "modelo padrão"})`),
    );
    console.log();

    const { confirmed } = await inquirer.prompt([{
        type: "confirm",
        name: "confirmed",
        message: chalk.cyan("  Iniciar a migração agora?"),
        default: true,
    }, ]);

    console.log();
    return { sourcePath, outputPath, confirmed };
}
