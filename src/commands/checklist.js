import chalk from 'chalk';
import { ui, printSeparator } from '../utils/ui.js';

const CHECKLIST = [
  {
    fase: '1. Preparação do Ambiente',
    itens: [
      'Instalar Node.js 20+ e Angular CLI 21 (npm i -g @angular/cli)',
      'Criar projeto Angular 21: ng new meu-app --standalone',
      'Configurar tsconfig.json com strict: true',
      'Instalar dependências equivalentes (ex: ui-router → @angular/router)',
      'Configurar ESLint + Prettier para TypeScript',
    ],
  },
  {
    fase: '2. Migrar Módulo Principal',
    itens: [
      'Remover angular.module() e substituir por bootstrapApplication()',
      'Configurar provideHttpClient() no app.config.ts',
      'Configurar provideRouter(routes) no app.config.ts',
      'Migrar constantes ($provide) para variáveis/tokens de injeção',
      'Remover dependência do AngularJS do package.json',
    ],
  },
  {
    fase: '3. Migrar Services e Factories',
    itens: [
      'Converter .service() para @Injectable({ providedIn: \'root\' })',
      'Converter .factory() para @Injectable com factory pattern',
      'Substituir $http por HttpClient com Observables ou Promises',
      'Substituir $q.defer() por Promise / firstValueFrom()',
      'Substituir $timeout/$interval por setTimeout/setInterval ou RxJS',
    ],
  },
  {
    fase: '4. Migrar Controllers → Components',
    itens: [
      'Converter .controller() para @Component standalone',
      'Substituir $scope por propriedades de classe ou signals',
      'Migrar watchers ($watch) para effect() ou computed()',
      'Substituir $broadcast/$emit por @Output EventEmitter ou signals',
      'Substituir ng-controller no template por seletor do componente',
    ],
  },
  {
    fase: '5. Migrar Templates',
    itens: [
      'Substituir ng-if por @if / @else',
      'Substituir ng-repeat por @for (item of list; track item.id)',
      'Substituir ng-show/ng-hide por @if ou [hidden]',
      'Substituir ng-model por [(ngModel)] ou signals com two-way',
      'Substituir ng-class por [class] ou [ngClass]',
      'Substituir ng-style por [style] ou [ngStyle]',
      'Substituir ng-click por (click)',
      'Substituir {{ }} por {{ }} (mantém, mas com tipagem)',
      'Substituir ng-switch por @switch / @case / @default',
      'Substituir ng-include por componentes reutilizáveis',
    ],
  },
  {
    fase: '6. Migrar Filters → Pipes',
    itens: [
      'Converter .filter() para @Pipe({ standalone: true })',
      'Substituir filtros built-in: currency|date|uppercase|lowercase|json',
      'Registrar pipes como imports no componente standalone',
      'Testar pipes com PipeTransform interface',
    ],
  },
  {
    fase: '7. Migrar Diretivas',
    itens: [
      'Converter diretivas estruturais para componentes ou @Directive',
      'Usar @Input() para replace/restrict/scope',
      'Migrar link function para ngAfterViewInit/ngOnInit',
      'Substituir ng-transclude por <ng-content>',
      'Usar @HostListener para eventos DOM',
    ],
  },
  {
    fase: '8. Migrar Roteamento',
    itens: [
      'Substituir $routeProvider por provideRouter()',
      'Substituir ui-router por @angular/router com lazy loading',
      'Migrar $stateParams para ActivatedRoute.params',
      'Migrar $state.go() para Router.navigate()',
      'Configurar guards funcionais: canActivate, canDeactivate',
      'Usar resolver funcional: ResolveFn<T>',
    ],
  },
  {
    fase: '9. Testes',
    itens: [
      'Configurar Jest ou Jasmine para Angular 21',
      'Reescrever testes usando TestBed com standalone components',
      'Usar HttpClientTestingModule para testes de HTTP',
      'Testar signals com TestBed.flushEffects()',
      'Rodar ng build --configuration=production e corrigir erros',
    ],
  },
  {
    fase: '10. Otimizações Finais',
    itens: [
      'Ativar SSR com ng add @angular/ssr (opcional)',
      'Configurar lazy loading em rotas pesadas',
      'Usar @defer para carregar componentes sob demanda',
      'Ativar hydration: provideClientHydration()',
      'Auditar bundle com ng build --stats-json + webpack-bundle-analyzer',
    ],
  },
];

export async function checklistCommand(opts) {
  ui.section('Checklist de Migração AngularJS → Angular 21');
  ui.blank();

  let total = 0;
  let totalFases = CHECKLIST.length;

  for (const fase of CHECKLIST) {
    console.log(chalk.bold.cyan(`  ${fase.fase}`));
    printSeparator();

    fase.itens.forEach((item, i) => {
      console.log(chalk.dim(`  [ ] `) + item);
      total++;
    });

    ui.blank();
  }

  console.log(chalk.bold.white(`  Total: ${total} itens em ${totalFases} fases`));
  ui.blank();
  ui.info('Use ' + chalk.cyan('ng-migrate migrate <arquivo>') + ' para migrar arquivos automaticamente.');
  ui.info('Use ' + chalk.cyan('ng-migrate analyze <pasta>') + ' para analisar seu projeto.');
  ui.blank();
}
