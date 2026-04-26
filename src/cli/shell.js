/**
 * Interactive shell — persistent readline loop (Open Claude style).
 * Stays running after each command, prompting for the next.
 */

import readline from "node:readline";
import chalk from "chalk";
import { tokenize } from "./tokenizer.js";
import { dispatch, showInteractiveHelp } from "./dispatcher.js";

// ── Tab-completion ────────────────────────────────────────────────────────────

const SHELL_COMMANDS = [
    "config",
    "scan",
    "migrate",
    "migrate-project",
    "migrate-repo",
    "start",
    "analyze",
    "repl",
    "checklist",
    "env",
    "help",
    "exit",
    "sair",
];

function shellCompleter(line) {
    const hits = SHELL_COMMANDS.filter((c) => c.startsWith(line));
    return [hits.length ? hits : SHELL_COMMANDS, line];
}

// ── Prompt string ─────────────────────────────────────────────────────────────

function buildPrompt() {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const cwd = process.cwd().replace(home, "~");
    const time = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    return (
        chalk.dim(` [${time}] `) +
        chalk.dim(cwd) +
        "\n" +
        chalk.cyan.bold("  ng-migrate") +
        chalk.dim(" › ")
    );
}

// ── Welcome message ───────────────────────────────────────────────────────────

function printShellWelcome() {
    const argv1 = process.argv[1] || "";
    const isGlobal = !argv1.includes("node_modules/.bin") &&
        (argv1.includes("/bin/") ||
            argv1.includes("\\bin\\") ||
            argv1.endsWith("ng-migrate") ||
            argv1.endsWith("ng-migrate.cmd"));

    if (!isGlobal) {
        console.log(
            chalk.bgYellow.black.bold("  DICA  ") +
            chalk.yellow(" Instale globalmente para usar ") +
            chalk.white.bold("ng-migrate") +
            chalk.yellow(" em qualquer pasta:"),
        );
        console.log(chalk.dim("  └─ ") + chalk.cyan("npm install -g ng-migrate-ai"));
        console.log();
    }

    console.log(
        chalk.dim("  Shell interativo ativo. Digite ") +
        chalk.cyan("help") +
        chalk.dim(" para ver os comandos, ") +
        chalk.cyan("exit") +
        chalk.dim(" para sair."),
    );
    console.log(chalk.dim("  Tab autocompleta os comandos."));
    console.log();
    console.log(chalk.dim("  " + "─".repeat(56)));
    console.log();
}

// ── Main shell loop ───────────────────────────────────────────────────────────

/**
 * Starts the persistent interactive shell.
 * Waits for user input after each command — exits only on "exit"/"sair"/Ctrl+C.
 */
export async function interactiveShell() {
    printShellWelcome();

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        completer: shellCompleter,
    });

    rl.setPrompt(buildPrompt());
    rl.prompt();

    rl.on("line", async(input) => {
        const trimmed = input.trim();

        if (!trimmed) {
            rl.setPrompt(buildPrompt());
            rl.prompt();
            return;
        }

        // ── Exit ──────────────────────────────────────────────────────────────────
        if (["exit", "quit", "sair"].includes(trimmed.toLowerCase())) {
            console.log();
            console.log(chalk.dim("  ──────────────────────────────────────────────────"));
            console.log(
                chalk.green("  ✔ ") +
                chalk.dim("Até logo! Use ") +
                chalk.cyan("ng-migrate") +
                chalk.dim(" quando precisar."),
            );
            console.log();
            rl.close();
            process.exit(0);
        }

        // ── Command header ────────────────────────────────────────────────────────
        const time = new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        console.log();
        process.stdout.write(
            chalk.bgCyan.black.bold(" ❯ ") +
            chalk.cyan.bold(" ng-migrate ") +
            chalk.white.bold(trimmed) +
            chalk.dim(`  ${time}`) +
            "\n",
        );
        console.log(chalk.dim("  " + "─".repeat(56)));
        console.log();

        // ── Execute ───────────────────────────────────────────────────────────────
        const t0 = Date.now();
        rl.pause();

        try {
            await dispatch(tokenize(trimmed), rl);
        } catch (err) {
            console.log();
            console.log(
                chalk.red("  ✖ ") + chalk.red((err && err.message) || String(err)),
            );
            console.log();
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
        console.log(chalk.dim("  " + "─".repeat(56)));
        console.log(chalk.dim(`  concluído em ${elapsed}s`));
        console.log();

        rl.resume();
        rl.setPrompt(buildPrompt());
        rl.prompt();
    });

    rl.on("close", () => {
        console.log();
        process.exit(0);
    });
}

// Re-export for use in Commander's default action
export { showInteractiveHelp };