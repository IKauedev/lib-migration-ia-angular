import fs from 'fs';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { migrateWithAI } from '../utils/ai.js';
import { parseMigrateResponse } from '../utils/parser.js';
import { ui, printSeparator, printKeyValue } from '../utils/ui.js';

export async function migrateCommand(arquivo, opts) {
  const filePath = path.resolve(arquivo);

  if (!fs.existsSync(filePath)) {
    ui.error(`Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const ext = path.extname(filePath);
  if (!['.js', '.ts', '.html'].includes(ext)) {
    ui.warn('Extensão incomum. Continuando mesmo assim...');
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);

  ui.section(`Migrando: ${filename}`);
  printKeyValue('Tipo solicitado:', opts.tipo);
  printKeyValue('Linhas de código:', String(code.split('\n').length));
  printKeyValue('Tamanho:', `${(code.length / 1024).toFixed(1)} KB`);
  ui.blank();

  const spinner = ora({
    text: chalk.dim('Analisando código com IA...'),
    color: 'magenta',
  }).start();

  let raw;
  try {
    raw = await migrateWithAI(code, opts.tipo);
    spinner.succeed(chalk.green('Migração concluída pela IA!'));
  } catch (err) {
    spinner.fail(chalk.red('Erro ao chamar a IA'));
    ui.error(err.message);
    process.exit(1);
  }

  const result = parseMigrateResponse(raw);


  if (result.tipo) {
    ui.blank();
    ui.info(`Tipo detectado: ${chalk.bold(result.tipo)}`);
  }


  if (result.padroes.length > 0) {
    ui.section('Padrões AngularJS detectados');
    result.padroes.forEach(p => {
      console.log(chalk.red('  ✖ ') + chalk.dim(p));
    });
  }


  if (opts.showDiff && result.codigoOriginal && result.codigoMigrado) {
    ui.code('angularjs', result.codigoOriginal);
    ui.code('angular', result.codigoMigrado);
  } else if (result.codigoMigrado) {
    ui.section('Código Angular 21 gerado');
    ui.code('angular', result.codigoMigrado);
  }


  if (result.mudancas.length > 0) {
    ui.section('Mudanças aplicadas');
    result.mudancas.forEach(m => {
      console.log(chalk.green('  ✔ ') + m);
    });
  }


  if (result.notas) {
    ui.section('Notas importantes');
    result.notas.split('\n').forEach(n => {
      if (n.trim()) console.log(chalk.yellow('  ⚠ ') + chalk.dim(n.trim()));
    });
  }


  if (!opts.dryRun && result.codigoMigrado) {
    const outPath = opts.output
      ? path.resolve(opts.output)
      : filePath.replace(/\.(js|ts|html)$/, '.migrated.ts');

    fs.writeFileSync(outPath, result.codigoMigrado, 'utf-8');
    ui.blank();
    ui.success(`Arquivo salvo em: ${chalk.cyan(outPath)}`);
  } else if (opts.dryRun) {
    ui.blank();
    ui.info('Modo dry-run: arquivo não salvo.');
  } else {
    ui.blank();
    ui.warn('IA não retornou código migrado. Verifique a resposta bruta abaixo.');
    console.log(chalk.dim(raw));
  }

  printSeparator();
  ui.blank();
}
