import { execSync, spawnSync } from "child_process";
import { runCommandLive } from "./ui.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

 
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

 
export async function ensureAngularCLI() {
    if (isNgInstalled()) {
        return;
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

 
export async function cloneRepo(gitUrl, destDir) {
    if (!isGitInstalled()) {
        throw new Error(
            "git não está instalado. Instale o Git em https://git-scm.com e tente novamente.",
        );
    }
    await runCommandLive(`git clone --depth=1 "${gitUrl}" "${destDir}"`);
}

 
export async function runNpmInstall(cwd) {
    await runCommandLive("npm install", { cwd });
}

 
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
