import { spawn } from "child_process";
import readline from "readline";
/**
 * Executa um comando exibindo em tempo real (estilo Open Claude)
 * Mostra o comando, saída progressiva e feedback visual.
 * @param {string} command Comando a executar (ex: 'npm install')
 * @param {object} [opts] Opções: { cwd, env, prefix }
 * @returns {Promise<number>} Código de saída
 */
export async function runCommandLive(command, opts = {}) {
    const { cwd, env, prefix = "  $" } = opts;
    ui.blank();
    console.log(chalk.yellow(prefix) + chalk.white.bold(" ") + chalk.cyan(command));
    ui.blank();
    return new Promise((resolve, reject) => {
        const child = spawn(command, {
            cwd,
            env: {...process.env, ...env },
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const rlOut = readline.createInterface({ input: child.stdout });
        const rlErr = readline.createInterface({ input: child.stderr });
        rlOut.on("line", (line) => {
            console.log(chalk.gray("    │ ") + chalk.white(line));
        });
        rlErr.on("line", (line) => {
            console.log(chalk.red("    ✖ ") + chalk.red(line));
        });
        child.on("close", (code) => {
            rlOut.close();
            rlErr.close();
            if (code === 0) {
                ui.success(`Comando finalizado com sucesso (${command})`);
                resolve(code);
            } else {
                ui.error(`Comando falhou (${command}) [code ${code}]`);
                reject(new Error(`Comando falhou: ${command}`));
            }
        });
    });
}
import chalk from "chalk";

const ASCII_ART = chalk.red.bold(`
    _   _ _ __  _____ ____  __  __ ___ ____
   | \\ | |  _ \\| ____|  _ \\|  \\/  |_ _/ ___|
   |  \\| | |_) |  _| | |_) | |\\/| || | |  _
   | |\\  |  _ <| |___|  _ <| |  | || | |_| |
   |_| \\_|_| \\_\\_____|_| \\_\\_|  |_|___\\____|
`);

const SUBTITLE = chalk.dim("  Migração AngularJS → Angular 21 com IA");
const VERSION_INFO = chalk.cyan("  v2.0.0") + chalk.gray(" | Provedores: ") + "Anthropic · OpenAI · Azure · Gemini";

export function printBanner() {
    console.log(ASCII_ART);
    console.log(SUBTITLE);
    console.log(VERSION_INFO);
    console.log();
    console.log(chalk.dim("  " + "─".repeat(60)));
    console.log();
    printQuickTips();
}

function printQuickTips() {
    // Status do ambiente
    printEnvStatus();

    console.log(chalk.dim("  Comandos rápidos:"));
    console.log(
        "    " +
        chalk.cyan("ng-migrate config") +
        chalk.dim("        — Configurar provedor de IA"),
    );
    console.log(
        "    " +
        chalk.cyan("ng-migrate scan") +
        chalk.dim("            — Analisar projeto AngularJS"),
    );
    console.log(
        "    " +
        chalk.cyan("ng-migrate migrate-project") +
        chalk.dim(" — Migrar projeto completo"),
    );
    console.log(
        "    " +
        chalk.cyan("ng-migrate migrate <arquivo>") +
        chalk.dim(" — Migrar arquivo único"),
    );
    console.log(
        "    " +
        chalk.cyan("ng-migrate --help") +
        chalk.dim("           — Todos os comandos"),
    );
    console.log();
}

function printEnvStatus() {
    const envVars = [
        { key: "ANTHROPIC_API_KEY", name: "Anthropic" },
        { key: "OPENAI_API_KEY", name: "OpenAI" },
        { key: "AZURE_OPENAI_KEY", name: "Azure" },
        { key: "GOOGLE_API_KEY", name: "Gemini" },
        { key: "GITHUB_TOKEN", name: "GitHub" },
    ];

    const activeProviders = [];
    const inactiveProviders = [];

    for (const { key, name }
        of envVars) {
        if (process.env[key]) {
            activeProviders.push(chalk.green.bold("✓") + " " + chalk.dim(name));
        } else {
            inactiveProviders.push(chalk.gray("○") + " " + chalk.dim(name));
        }
    }

    if (activeProviders.length > 0) {
        console.log(chalk.dim("  ") + chalk.green.bold("Provedores configurados:"));
        console.log("    " + activeProviders.join("  "));
        console.log();
    }
}

export const ui = {
    step: (msg) => console.log(chalk.cyan("  →") + " " + msg),
    success: (msg) => console.log(chalk.green("  ✔") + " " + chalk.green(msg)),
    warn: (msg) => console.log(chalk.yellow("  ⚠") + " " + chalk.yellow(msg)),
    error: (msg) => console.log(chalk.red("  ✖") + " " + chalk.red(msg)),
    info: (msg) => console.log(chalk.blue("  ℹ") + " " + chalk.blue(msg)),
    ai: (msg) => console.log(chalk.magenta("  ◈") + " " + msg),
    blank: () => console.log(),
    section: (title) => {
        console.log();
        console.log(chalk.bold.white("  " + title));
        console.log(chalk.dim("  " + "─".repeat(50)));
    },
    code: (lang, code) => {
        const label =
            lang === "angularjs" ?
            chalk.bgRed.white(" AngularJS ") :
            chalk.bgMagenta.white(" Angular 21 ");
        console.log();
        console.log("  " + label);
        const lines = code.trim().split("\n");
        lines.forEach((line) => {
            console.log(chalk.gray("  │ ") + chalk.white(line));
        });
        console.log();
    },
    tag: (text, color = "cyan") => chalk[color].bold(`[${text}]`),
    badge: (text) => chalk.bgBlue.white(` ${text} `),
};

export function printSeparator() {
    console.log(chalk.dim("  " + "─".repeat(54)));
}

export function printKeyValue(key, value, indent = "  ") {
    console.log(indent + chalk.dim(key.padEnd(22)) + chalk.white(value));
}