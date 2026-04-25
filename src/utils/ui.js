import chalk from "chalk";
import boxen from "boxen";

export function printBanner() {
  const banner = boxen(
    chalk.red.bold("ng-migrate-ai") +
      "  " +
      chalk.gray("v1.0.0") +
      "\n" +
      chalk.dim("AngularJS 1.x  →  ") +
      chalk.magenta.bold("Angular 21") +
      "\n" +
      chalk.dim("Powered by IKaue dev"),
    {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "red",
      dimBorder: true,
    },
  );
  console.log(banner);
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
      lang === "angularjs"
        ? chalk.bgRed.white(" AngularJS ")
        : chalk.bgMagenta.white(" Angular 21 ");
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
