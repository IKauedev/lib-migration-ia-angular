import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { chatWithAI } from '../utils/ai.js';
import { parseMigrateResponse } from '../utils/parser.js';
import { ui, printSeparator } from '../utils/ui.js';

const HELP_TEXT = `
${chalk.bold.white('  Comandos disponíveis:')}

  ${chalk.cyan('migrar')} ${chalk.dim('<código ou path>')}     Migra código AngularJS colado ou de um arquivo
  ${chalk.cyan('analisar')} ${chalk.dim('<código>')}           Analisa padrões sem migrar
  ${chalk.cyan('explicar')} ${chalk.dim('<conceito>')}         Explica diferença AngularJS vs Angular 21
  ${chalk.cyan('exemplo')} ${chalk.dim('<tipo>')}              Mostra exemplo: controller|service|filter|directive
  ${chalk.cyan('checklist')}                      Checklist de migração
  ${chalk.cyan('limpar')}                         Limpa histórico da conversa
  ${chalk.cyan('sair')} / ${chalk.cyan('exit')}                  Encerra o REPL

  ${chalk.dim('Ou simplesmente cole qualquer código AngularJS e pressione Enter duas vezes.')}
`;

export async function replCommand() {
  ui.section('Modo REPL Interativo');
  console.log(chalk.dim('  Cole código AngularJS e pressione Enter. Digite "ajuda" para ver os comandos.'));
  ui.blank();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('  ng-migrate') + chalk.dim(' › '),
  });

  let conversationHistory = [];
  let buffer = [];
  let inMultiline = false;

  rl.prompt();

  rl.on('line', async (line) => {
    const trimmed = line.trim();


    if (!inMultiline) {
      if (trimmed === 'sair' || trimmed === 'exit' || trimmed === 'quit') {
        ui.blank();
        ui.success('Até logo! 👋');
        ui.blank();
        process.exit(0);
      }

      if (trimmed === 'ajuda' || trimmed === 'help') {
        console.log(HELP_TEXT);
        rl.prompt();
        return;
      }

      if (trimmed === 'limpar' || trimmed === 'clear') {
        conversationHistory = [];
        console.clear();
        ui.success('Histórico limpo.');
        ui.blank();
        rl.prompt();
        return;
      }

      if (trimmed === '') {
        if (buffer.length > 0) {

          await processInput(buffer.join('\n'), conversationHistory, rl);
          buffer = [];
          inMultiline = false;
          return;
        }
        rl.prompt();
        return;
      }


      if (trimmed.includes('\n') || looksLikeCode(trimmed)) {
        buffer.push(line);
        inMultiline = true;
        process.stdout.write(chalk.dim('  ... '));
        return;
      }


      await processInput(trimmed, conversationHistory, rl);
    } else {

      if (trimmed === '') {
        await processInput(buffer.join('\n'), conversationHistory, rl);
        buffer = [];
        inMultiline = false;
      } else {
        buffer.push(line);
        process.stdout.write(chalk.dim('  ... '));
      }
    }
  });

  rl.on('close', () => {
    ui.blank();
    ui.success('Sessão encerrada.');
    process.exit(0);
  });
}

async function processInput(input, history, rl) {
  rl.pause();
  ui.blank();

  const spinner = ora({
    text: chalk.dim('IA processando...'),
    color: 'magenta',
  }).start();

  try {
    history.push({ role: 'user', content: input });

    const response = await chatWithAI(history);
    history.push({ role: 'assistant', content: response });

    spinner.stop();

    const parsed = parseMigrateResponse(response);

    if (parsed.tipo) {
      ui.info(`Tipo: ${chalk.bold(parsed.tipo)}`);
    }

    if (parsed.padroes.length > 0) {
      ui.blank();
      console.log(chalk.bold('  Padrões detectados:'));
      parsed.padroes.forEach(p => console.log(chalk.red('  ✖ ') + chalk.dim(p)));
    }

    if (parsed.codigoMigrado) {
      ui.code('angularjs', parsed.codigoOriginal || input);
      ui.code('angular', parsed.codigoMigrado);
    } else {

      ui.blank();
      response.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(chalk.magenta('  ◈ ') + line);
        }
      });
    }

    if (parsed.mudancas.length > 0) {
      ui.blank();
      console.log(chalk.bold('  Mudanças:'));
      parsed.mudancas.forEach(m => console.log(chalk.green('  ✔ ') + m));
    }

    if (parsed.notas) {
      ui.blank();
      parsed.notas.split('\n').forEach(n => {
        if (n.trim()) console.log(chalk.yellow('  ⚠ ') + chalk.dim(n.trim()));
      });
    }

  } catch (err) {
    spinner.fail(chalk.red('Erro: ' + err.message));
  }

  ui.blank();
  printSeparator();
  ui.blank();
  rl.resume();
  rl.prompt();
}

function looksLikeCode(text) {
  return /angular\.|\.controller|\.service|\.factory|\.directive|\.filter|\$scope|\$http|ng-|function\s*\(/.test(text);
}
