import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { buildModel, TASK_TYPES } from "./langchain-provider.js";
import { dbgAI } from "./debug.js";
import {
  buildSystemPrompt,
  MODEL_TIERS,
} from "../core/persona/migration-persona.js";

const SYSTEM_PROMPT_DEFAULT = buildSystemPrompt(MODEL_TIERS.STANDARD);

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

async function retryWithBackoff(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRetryable =
        err.status === 429 ||
        err.status === 500 ||
        err.status === 503 ||
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.message?.includes("rate limit") ||
        err.message?.includes("overloaded") ||
        err.message?.includes("timeout");
      if (!isRetryable || attempt === maxRetries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      dbgAI(
        "retry",
        "backoff",
        `tentativa ${attempt + 1}/${maxRetries} falhou: ${err.message} — aguardando ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function migrateWithAI(
  code,
  tipo = "auto",
  contexto = "",
  projectContext = null,
  migrationOpts = {},
) {
  const tier = migrationOpts.tier ?? MODEL_TIERS.STANDARD;
  const maxTokens = migrationOpts.maxTokens ?? 4096;

  const model = await buildModel(TASK_TYPES.MIGRATION, { maxTokens, tier });
  const structured = model.withStructuredOutput(MigrationSchema);
  const SYSTEM_PROMPT = buildSystemPrompt(tier);

  let contextoLabel;
  if (projectContext) {
    contextoLabel = "projeto";
  } else if (contexto) {
    contextoLabel = "simples";
  } else {
    contextoLabel = "nenhum";
  }
  dbgAI(
    "enviando",
    "migration",
    `tipo=${tipo} | código=${code.length} chars | contexto=${contextoLabel}`,
  );

  let result;

  if (projectContext) {
    const history = projectContext.getMessageHistory();

    const contextoParts = [contexto || ""].filter(Boolean);
    const contextoLine = contextoParts.length
      ? `Contexto adicional:\n${contextoParts.join("\n\n")}`
      : "";

    const humanText =
      `Tipo solicitado: ${tipo}\n` +
      (contextoLine ? `${contextoLine}\n\n` : "") +
      `Migre o seguinte código AngularJS para Angular 21:\n\`\`\`\n${code}\n\`\`\``;

    result = await retryWithBackoff(async () =>
      structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        ...history,
        new HumanMessage(humanText),
      ]),
    );
  } else {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      [
        "human",
        "Tipo solicitado: {tipo}\n{contextoLine}\n\nMigre o seguinte código AngularJS para Angular 21:\n```\n{code}\n```",
      ],
    ]);

    result = await retryWithBackoff(async () =>
      prompt.pipe(structured).invoke({
        tipo,
        contextoLine: contexto ? `Contexto adicional: ${contexto}` : "",
        code,
      }),
    );
  }

  dbgAI(
    "resposta",
    "migration",
    `tipo=${result.tipo} | mudanças=${result.mudancas?.length ?? 0} | notas=${result.notas ? "sim" : "não"}`,
  );
  return result;
}

export async function analyzeWithAI(
  code,
  filename = "",
  projectContext = null,
) {
  const model = await buildModel(TASK_TYPES.ANALYSIS, { maxTokens: 2048 });
  const structured = model.withStructuredOutput(AnalysisSchema);

  dbgAI(
    "enviando",
    "analysis",
    `arquivo=${filename} | código=${code.length} chars | contexto=${projectContext ? "projeto" : "nenhum"}`,
  );

  let result;

  if (projectContext) {
    const history = projectContext.getMessageHistory();
    const humanText =
      `Analise este código AngularJS do arquivo "${filename}" no contexto do projeto e retorne:\n` +
      `1. Todos os padrões AngularJS usados\n` +
      `2. Complexidade de migração (baixa/média/alta)\n` +
      `3. Dependências que precisam ser substituídas\n` +
      `4. Ordem de migração sugerida\n` +
      `5. Possíveis problemas\n\n` +
      `Código:\n\`\`\`\n${code}\n\`\`\``;

    result = await retryWithBackoff(async () =>
      structured.invoke([
        new SystemMessage(SYSTEM_PROMPT_DEFAULT),
        ...history,
        new HumanMessage(humanText),
      ]),
    );
  } else {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT_DEFAULT],
      [
        "human",
        `Analise este código AngularJS do arquivo "{filename}" e retorne:\n1. Todos os padrões AngularJS usados\n2. Complexidade de migração (baixa/média/alta)\n3. Dependências que precisam ser substituídas\n4. Ordem de migração sugerida\n5. Possíveis problemas\n\nCódigo:\n\`\`\`\n{code}\n\`\`\``,
      ],
    ]);

    result = await retryWithBackoff(async () =>
      prompt.pipe(structured).invoke({ filename, code }),
    );
  }

  dbgAI(
    "resposta",
    "analysis",
    `complexidade=${result.complexidade} | padrões=${result.padroes?.length ?? 0} | problemas=${result.problemas?.length ?? 0}`,
  );
  return result;
}

export async function chatWithAI(messages) {
  const model = await buildModel(TASK_TYPES.CHAT, { maxTokens: 4096 });

  const langchainMessages = [
    ["system", SYSTEM_PROMPT_DEFAULT],
    ...messages.map((m) => [
      m.role === "assistant" ? "ai" : "human",
      m.content,
    ]),
  ];

  const result = await model.invoke(langchainMessages);

  if (typeof result.content === "string") return result.content;
  if (Array.isArray(result.content))
    return result.content.map((b) => b.text ?? b).join("");
  return String(result.content);
}

const TestGenerationSchema = z.object({
  testFile: z
    .string()
    .describe("Código completo do arquivo de teste .spec.ts para Angular/Jest"),
  testCount: z.number().describe("Número de casos de teste gerados"),
  coverage: z.array(z.string()).describe("Aspectos cobertos pelos testes"),
  notes: z
    .string()
    .optional()
    .default("")
    .describe("Observações sobre os testes gerados"),
});

/**
 * Gera testes unitários Angular/Jest para um arquivo migrado.
 * @param {string} migratedCode - Código Angular migrado
 * @param {string} filename - Nome do arquivo (para contexto)
 * @param {string} [tipo] - Tipo do componente (service, component, pipe, etc.)
 * @returns {Promise<{testFile: string, testCount: number, coverage: string[], notes: string}>}
 */
export async function generateTestsWithAI(
  migratedCode,
  filename = "",
  tipo = "auto",
) {
  const model = await buildModel(TASK_TYPES.MIGRATION, { maxTokens: 4096 });
  const structured = model.withStructuredOutput(TestGenerationSchema);

  const systemPrompt = `Você é um especialista em testes Angular com Jest/Jasmine.
Gere testes unitários completos para código Angular 21 com standalone components e Signals.
Use TestBed, HttpClientTestingModule, RouterTestingModule quando necessário.
Siga o padrão AAA (Arrange, Act, Assert).
Os testes devem cobrir: criação do componente/serviço, métodos públicos, casos de erro, e integração com dependencies injetadas.`;

  const humanText = `Gere um arquivo de testes .spec.ts completo para o seguinte arquivo Angular 21.
Arquivo: ${filename}
Tipo: ${tipo}

Código:
\`\`\`typescript
${migratedCode}
\`\`\`

Requisitos:
- Use Jest (describe/it/expect) ou Jasmine
- Import correto de TestBed, ComponentFixture, etc.
- Mock de todas as dependências injetadas
- Testar casos de sucesso E falha
- Incluir pelo menos 5 casos de teste`;

  dbgAI(
    "enviando",
    "test-generation",
    `arquivo=${filename} | código=${migratedCode.length} chars`,
  );

  const result = await retryWithBackoff(async () =>
    structured.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanText),
    ]),
  );

  dbgAI(
    "resposta",
    "test-generation",
    `testes=${result.testCount} | cobertura=${result.coverage?.length ?? 0}`,
  );
  return result;
}

/**
 * Migra um arquivo de testes AngularJS (Jasmine/Karma) para Angular/Jest.
 * @param {string} specCode - Código original do spec file
 * @param {string} filename
 * @returns {Promise<{codigoMigrado: string, mudancas: string[], notas: string}>}
 */
export async function migrateSpecWithAI(specCode, filename = "") {
  const model = await buildModel(TASK_TYPES.MIGRATION, { maxTokens: 4096 });
  const SpecSchema = z.object({
    codigoMigrado: z
      .string()
      .describe("Arquivo .spec.ts Angular migrado para Jest/Jasmine moderno"),
    mudancas: z
      .array(z.string())
      .describe("Mudanças aplicadas na migração do spec"),
    notas: z.string().optional().default(""),
  });
  const structured = model.withStructuredOutput(SpecSchema);

  const systemPrompt = `Você é um especialista em migração de testes de AngularJS para Angular 21.
Migre testes Jasmine/Karma de AngularJS para testes Angular com TestBed moderno.
Use: TestBed.configureTestingModule, ComponentFixture, inject(), HttpClientTestingModule.
Substitua: $httpBackend por HttpClientTestingModule, $scope por Signals/ComponentRef.`;

  const humanText = `Migre este arquivo de testes AngularJS para Angular 21 moderno:
Arquivo: ${filename}

\`\`\`javascript
${specCode}
\`\`\``;

  dbgAI(
    "enviando",
    "spec-migration",
    `arquivo=${filename} | código=${specCode.length} chars`,
  );

  const result = await retryWithBackoff(async () =>
    structured.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanText),
    ]),
  );

  dbgAI(
    "resposta",
    "spec-migration",
    `mudanças=${result.mudancas?.length ?? 0}`,
  );
  return result;
}
