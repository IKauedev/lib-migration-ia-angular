import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { buildModel, TASK_TYPES } from "./langchain-provider.js";
import { dbgAI } from "./debug.js";

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

// ── Zod schemas ───────────────────────────────────────────────────────────────

const MigrationSchema = z.object({
  tipo: z
    .enum([
      "controller",
      "service",
      "filter",
      "directive",
      "template",
      "factory",
      "misto",
    ])
    .describe("Tipo do componente AngularJS identificado"),
  padroes: z
    .array(z.string())
    .describe("Lista de padrões AngularJS detectados no código"),
  codigoOriginal: z
    .string()
    .describe("Código original AngularJS sem nenhuma alteração"),
  codigoMigrado: z
    .string()
    .describe("Código Angular 21 completo após migração"),
  mudancas: z
    .array(z.string())
    .describe("Lista concisa das mudanças aplicadas durante a migração"),
  notas: z
    .string()
    .optional()
    .default("")
    .describe("Avisos importantes, dependências necessárias ou observações"),
});

const AnalysisSchema = z.object({
  complexidade: z
    .enum(["baixa", "média", "alta"])
    .describe("Complexidade estimada de migração"),
  padroes: z
    .array(z.string())
    .describe("Padrões AngularJS encontrados no arquivo"),
  dependencias: z
    .array(z.string())
    .describe("Dependências e bibliotecas que precisam ser substituídas"),
  ordemSugerida: z
    .array(z.string())
    .describe("Passos numerados sugeridos para a migração"),
  problemas: z
    .array(z.string())
    .describe("Possíveis problemas ou pontos de atenção na migração"),
  resumo: z.string().describe("Parágrafo curto com resumo geral da análise"),
});

// ── Migration ─────────────────────────────────────────────────────────────────

export async function migrateWithAI(code, tipo = "auto", contexto = "") {
  const model = await buildModel(TASK_TYPES.MIGRATION, { maxTokens: 4096 });
  const structured = model.withStructuredOutput(MigrationSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    [
      "human",
      "Tipo solicitado: {tipo}\n{contextoLine}\n\nMigre o seguinte código AngularJS para Angular 21:\n```\n{code}\n```",
    ],
  ]);

  dbgAI("enviando", "migration", `tipo=${tipo} | código=${code.length} chars`);
  const result = await prompt.pipe(structured).invoke({
    tipo,
    contextoLine: contexto ? `Contexto adicional: ${contexto}` : "",
    code,
  });
  dbgAI(
    "resposta",
    "migration",
    `tipo=${result.tipo} | mudanças=${result.mudancas?.length ?? 0} | notas=${result.notas ? "sim" : "não"}`,
  );
  return result;
}

// ── Analysis ──────────────────────────────────────────────────────────────────

export async function analyzeWithAI(code, filename = "") {
  const model = await buildModel(TASK_TYPES.ANALYSIS, { maxTokens: 2048 });
  const structured = model.withStructuredOutput(AnalysisSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    [
      "human",
      `Analise este código AngularJS do arquivo "{filename}" e retorne:
1. Todos os padrões AngularJS usados
2. Complexidade de migração (baixa/média/alta)
3. Dependências que precisam ser substituídas
4. Ordem de migração sugerida
5. Possíveis problemas

Código:
\`\`\`
{code}
\`\`\``,
    ],
  ]);

  dbgAI(
    "enviando",
    "analysis",
    `arquivo=${filename} | código=${code.length} chars`,
  );
  const result = await prompt.pipe(structured).invoke({ filename, code });
  dbgAI(
    "resposta",
    "analysis",
    `complexidade=${result.complexidade} | padrões=${result.padroes?.length ?? 0} | problemas=${result.problemas?.length ?? 0}`,
  );
  return result;
}

// ── Chat (REPL) ───────────────────────────────────────────────────────────────

export async function chatWithAI(messages) {
  const model = await buildModel(TASK_TYPES.CHAT, { maxTokens: 4096 });

  const langchainMessages = [
    ["system", SYSTEM_PROMPT],
    ...messages.map((m) => [
      m.role === "assistant" ? "ai" : "human",
      m.content,
    ]),
  ];

  const result = await model.invoke(langchainMessages);

  // Content can be a string (OpenAI/Gemini) or array of blocks (Anthropic)
  if (typeof result.content === "string") return result.content;
  if (Array.isArray(result.content))
    return result.content.map((b) => b.text ?? b).join("");
  return String(result.content);
}
