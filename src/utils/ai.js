import { sendToProvider, sendChatToProvider } from "./ai-providers.js";

const SYSTEM_PROMPT = `Você é um especialista sênior em migração de AngularJS (Angular 1.x) para Angular 21 moderno.

Suas respostas devem:
1. Ser tecnicamente precisas e seguir as melhores práticas do Angular 21
2. Usar SEMPRE standalone components (sem NgModule onde possível)
3. Usar signals para reatividade (signal(), computed(), effect())
4. Usar inject() em vez de injeção por construtor quando possível
5. Usar nova sintaxe de template: @if, @for, @switch, @defer
6. Usar o Angular HttpClient moderno com provideHttpClient()
7. Usar TypeScript com tipagem explícita e strict mode
8. Usar o novo sistema de roteamento com provideRouter()
9. Preferir a API functional de guards, interceptors, resolvers

Padrões de migração específicos:
- $scope → signals ou propriedades de classe + change detection
- $http → HttpClient com Observable/async pipe ou toSignal()
- ng-if → @if
- ng-repeat / ng-for → @for (item of items; track item.id)
- ng-model → [(ngModel)] ou signals com two-way binding
- ng-class → [class] binding
- ng-click → (click)
- ng-show/ng-hide → @if ou [hidden]
- $routeProvider → provideRouter([routes])
- $stateProvider (ui-router) → provideRouter com lazy loading
- .controller() → @Component standalone
- .service() / .factory() → @Injectable({ providedIn: 'root' })
- .filter() → @Pipe({ standalone: true })
- .directive() → @Component ou @Directive standalone
- $broadcast/$emit/$on → Subject/BehaviorSubject do RxJS ou signals

Responda SEMPRE neste formato exato:

TIPO: [controller|service|filter|directive|template|factory|misto]

PADRÕES_DETECTADOS:
- [liste cada padrão AngularJS encontrado]

CÓDIGO_ORIGINAL:
\`\`\`javascript
[código original aqui, sem alterações]
\`\`\`

CÓDIGO_MIGRADO:
\`\`\`typescript
[código Angular 21 aqui]
\`\`\`

MUDANÇAS:
- [lista concisa das mudanças feitas]

NOTAS:
[avisos importantes, dependências necessárias, etc]`;

export async function migrateWithAI(code, tipo = "auto", contexto = "") {
  const userMsg = contexto
    ? `Tipo solicitado: ${tipo}\nContexto adicional: ${contexto}\n\nCódigo para migrar:\n\`\`\`\n${code}\n\`\`\``
    : `Tipo solicitado: ${tipo}\n\nCódigo para migrar:\n\`\`\`\n${code}\n\`\`\``;

  return sendToProvider(SYSTEM_PROMPT, userMsg, { maxTokens: 4096 });
}

export async function analyzeWithAI(code, filename = "") {
  const userMsg = `Analise este código AngularJS do arquivo "${filename}" e:
1. Liste todos os padrões AngularJS usados
2. Estime a complexidade de migração (baixa/média/alta)
3. Liste dependências que precisam ser substituídas
4. Sugira ordem de migração
5. Identifique possíveis problemas

Formato de resposta:
COMPLEXIDADE: [baixa|média|alta]
PADRÕES: [lista separada por vírgulas]
DEPENDÊNCIAS: [lista]
ORDEM_SUGERIDA: [passos numerados]
PROBLEMAS: [lista de possíveis problemas]
RESUMO: [parágrafo curto]

Código:
\`\`\`
${code}
\`\`\``;

  return sendToProvider(SYSTEM_PROMPT, userMsg, { maxTokens: 2048 });
}

export async function chatWithAI(messages) {
  return sendChatToProvider(messages, SYSTEM_PROMPT, { maxTokens: 4096 });
}
