import { execSync, spawnSync } from "child_process";
import { runCommandLive } from "./ui.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

/**
 * Returns true if the `ng` CLI is reachable on PATH.
 */
function isNgInstalled() {
    try {
        const result = spawnSync("ng", ["version", "--skip-confirmation"], {
            stdio: "pipe",
            shell: true,
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

/**
 * Returns true if `git` is reachable on PATH.
 */
export function isGitInstalled() {
    try {
        const result = spawnSync("git", ["--version"], {
            stdio: "pipe",
            shell: true,
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

/**
 * Ensures @angular/cli is installed globally.
 * Installs it via `npm install -g @angular/cli@latest` if missing.
 * Exits process if install fails.
 */
export async function ensureAngularCLI() {
    if (isNgInstalled()) {
        return; // already available, nothing to do
    }

    const spinner = ora(
        chalk.yellow(
            "Angular CLI não encontrado. Instalando @angular/cli globalmente...",
        ),
    ).start();

    try {
        execSync("npm install -g @angular/cli@latest", {
            stdio: "pipe",
            shell: true,
        });
        spinner.succeed(chalk.green("Angular CLI instalado com sucesso!"));
    } catch (err) {
        spinner.fail(chalk.red("Falha ao instalar Angular CLI."));
        console.error(
            chalk.dim(
                "Instale manualmente: npm install -g @angular/cli\n" + err.message,
            ),
        );
        process.exit(1);
    }
}

/**
 * Clones a git repository into `destDir`.
 * Throws an error if git is not installed or the clone fails.
 */
export async function cloneRepo(gitUrl, destDir) {
    if (!isGitInstalled()) {
        throw new Error(
            "git não está instalado. Instale o Git em https://git-scm.com e tente novamente.",
        );
    }
    await runCommandLive(`git clone --depth=1 "${gitUrl}" "${destDir}"`);
}

/**
 * Runs `npm install` inside `cwd`.
 * Throws on failure.
 */
export async function runNpmInstall(cwd) {
    await runCommandLive("npm install", { cwd });
}

/**
 * Scaffolds a new Angular 21 project via `ng new` into `outputDir`.
 * Uses --skip-install so the caller can run npm install after patching package.json.
 * Throws on failure.
 *
 * @param {string} appName  - Angular project name (slug, e.g. "my-app")
 * @param {string} outputDir - Absolute path to the target directory
 */
export function scaffoldAngularProject(appName, outputDir) {
    const parentDir = path.dirname(outputDir);
    const dirName = path.basename(outputDir);

    fs.mkdirSync(parentDir, { recursive: true });

    execSync(
        `ng new "${appName}" --directory "${dirName}" --skip-git --style=scss --standalone --skip-tests --skip-install`, {
            cwd: parentDir,
            stdio: "inherit",
            shell: true,
        },
    );
}