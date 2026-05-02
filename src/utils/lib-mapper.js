/**
 * lib-mapper.js
 * Mapa de substituição de bibliotecas AngularJS de terceiros para equivalentes Angular 21.
 * Usado durante a migração de package.json e nos prompts para a IA.
 */

/**
 * @typedef {Object} LibMapping
 * @property {string} angularjs - Pacote AngularJS original
 * @property {string[]} angular - Pacotes Angular 21 equivalentes
 * @property {string} notes - Notas de migração
 * @property {'drop'|'replace'|'manual'} action - O que fazer: drop=remover, replace=substituir, manual=migração manual necessária
 * @property {string} [importPath] - Caminho de import Angular (se replace)
 */

/** @type {LibMapping[]} */
export const LIB_MAPPINGS = [
  // ── Roteamento ────────────────────────────────────────────────────────────
  {
    angularjs: "angular-ui-router",
    angular: ["@angular/router"],
    notes:
      "Use provideRouter() com Routes array. RouterModule não é mais necessário em componentes standalone.",
    action: "replace",
    importPath: "@angular/router",
  },
  {
    angularjs: "angular-route",
    angular: ["@angular/router"],
    notes:
      "Substitua ngRoute/routeProvider por @angular/router com provideRouter().",
    action: "replace",
    importPath: "@angular/router",
  },

  // ── HTTP ──────────────────────────────────────────────────────────────────
  {
    angularjs: "angular-resource",
    angular: ["@angular/common/http"],
    notes:
      "Substitua $resource por HttpClient. Considere @ngrx/data para CRUD genérico.",
    action: "replace",
    importPath: "@angular/common/http",
  },
  {
    angularjs: "restangular",
    angular: ["@angular/common/http"],
    notes: "Substitua Restangular por HttpClient com interceptors.",
    action: "replace",
    importPath: "@angular/common/http",
  },

  // ── UI / Componentes ──────────────────────────────────────────────────────
  {
    angularjs: "angular-material",
    angular: ["@angular/material", "@angular/cdk"],
    notes:
      "Use @angular/material v21. APIs são similares mas nomes de módulos/seletores mudaram.",
    action: "replace",
    importPath: "@angular/material",
  },
  {
    angularjs: "angular-ui-bootstrap",
    angular: ["@ng-bootstrap/ng-bootstrap"],
    notes: "Substitua ui.bootstrap por @ng-bootstrap/ng-bootstrap.",
    action: "replace",
    importPath: "@ng-bootstrap/ng-bootstrap",
  },
  {
    angularjs: "angular-bootstrap",
    angular: ["@ng-bootstrap/ng-bootstrap"],
    notes: "Substitua ui.bootstrap por @ng-bootstrap/ng-bootstrap.",
    action: "replace",
    importPath: "@ng-bootstrap/ng-bootstrap",
  },
  {
    angularjs: "angularjs-toaster",
    angular: ["@ngneat/hot-toast", "ngx-toastr"],
    notes: "Use @ngneat/hot-toast ou ngx-toastr para notificações.",
    action: "replace",
    importPath: "ngx-toastr",
  },
  {
    angularjs: "angular-toastr",
    angular: ["ngx-toastr"],
    notes: "Substitua angular-toastr por ngx-toastr.",
    action: "replace",
    importPath: "ngx-toastr",
  },

  // ── Internacionalização ───────────────────────────────────────────────────
  {
    angularjs: "angular-translate",
    angular: ["@ngx-translate/core", "@ngx-translate/http-loader"],
    notes: "Substitua $translate / angular-translate por @ngx-translate/core.",
    action: "replace",
    importPath: "@ngx-translate/core",
  },
  {
    angularjs: "angular-gettext",
    angular: ["@ngx-translate/core"],
    notes: "Substitua angular-gettext por @ngx-translate/core.",
    action: "replace",
    importPath: "@ngx-translate/core",
  },
  {
    angularjs: "angular-i18n",
    angular: ["@angular/localize"],
    notes: "Use @angular/localize com $localize e ng extract.",
    action: "replace",
    importPath: "@angular/localize",
  },

  // ── Gerenciamento de Estado ───────────────────────────────────────────────
  {
    angularjs: "angular-redux",
    angular: ["@ngrx/store", "@ngrx/effects"],
    notes: "Substitua angular-redux por NgRx Store + Effects.",
    action: "replace",
    importPath: "@ngrx/store",
  },

  // ── Formulários ───────────────────────────────────────────────────────────
  {
    angularjs: "angular-formly",
    angular: ["@ngx-formly/core", "@ngx-formly/material"],
    notes: "Substitua angular-formly por @ngx-formly/core.",
    action: "replace",
    importPath: "@ngx-formly/core",
  },

  // ── Animações ────────────────────────────────────────────────────────────
  {
    angularjs: "angular-animate",
    angular: ["@angular/animations"],
    notes:
      "Substitua ngAnimate por @angular/animations com trigger/state/transition.",
    action: "replace",
    importPath: "@angular/animations",
  },

  // ── Cookies / Storage ─────────────────────────────────────────────────────
  {
    angularjs: "angular-cookies",
    angular: ["ngx-cookie-service"],
    notes: "Substitua $cookies / ngCookies por ngx-cookie-service.",
    action: "replace",
    importPath: "ngx-cookie-service",
  },

  // ── Sanitização ───────────────────────────────────────────────────────────
  {
    angularjs: "angular-sanitize",
    angular: ["@angular/platform-browser"],
    notes: "Use DomSanitizer do @angular/platform-browser para sanitização.",
    action: "replace",
    importPath: "@angular/platform-browser",
  },

  // ── Datas ────────────────────────────────────────────────────────────────
  {
    angularjs: "moment",
    angular: ["date-fns"],
    notes:
      "Prefira date-fns (tree-shakeable) ou Intl nativo. Se mantiver moment, funciona sem alterações.",
    action: "replace",
    importPath: "date-fns",
  },

  // ── Utilitários a remover ─────────────────────────────────────────────────
  {
    angularjs: "angular-mocks",
    angular: [],
    notes:
      "angular-mocks é usado apenas em testes; remova e use TestBed do @angular/core/testing.",
    action: "drop",
  },
  {
    angularjs: "karma",
    angular: [],
    notes: "Substitua Karma por Jest (já configurado neste projeto).",
    action: "drop",
  },
  {
    angularjs: "karma-jasmine",
    angular: [],
    notes: "Substitua Karma+Jasmine por Jest.",
    action: "drop",
  },
  {
    angularjs: "karma-chrome-launcher",
    angular: [],
    notes: "Remova Karma launchers.",
    action: "drop",
  },
  {
    angularjs: "jasmine-core",
    angular: [],
    notes: "Substitua Jasmine por Jest.",
    action: "drop",
  },
  {
    angularjs: "jasmine-spec-reporter",
    angular: [],
    notes: "Substitua por jest reporters.",
    action: "drop",
  },
  {
    angularjs: "protractor",
    angular: ["@playwright/test", "cypress"],
    notes: "Substitua Protractor por Playwright ou Cypress para testes E2E.",
    action: "replace",
    importPath: "@playwright/test",
  },
  {
    angularjs: "bower",
    angular: [],
    notes: "Remova bower — use apenas npm/yarn.",
    action: "drop",
  },
];

/**
 * Encontra o mapeamento para um pacote AngularJS.
 * @param {string} packageName
 * @returns {LibMapping|undefined}
 */
export function findMapping(packageName) {
  const name = packageName.toLowerCase().replace(/^@/, "");
  return LIB_MAPPINGS.find(
    (m) =>
      m.angularjs.toLowerCase() === name ||
      m.angularjs.toLowerCase() === packageName.toLowerCase(),
  );
}

/**
 * Analisa um package.json e retorna quais dependências precisam ser migradas.
 *
 * @param {object} packageJson - Conteúdo do package.json parseado
 * @returns {{
 *   toReplace: Array<{from: string, to: string[], notes: string}>,
 *   toDrop: Array<{name: string, notes: string}>,
 *   manual: Array<{name: string, notes: string}>,
 *   unknown: string[],
 * }}
 */
export function analyzePackageDependencies(packageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  const toReplace = [];
  const toDrop = [];
  const manual = [];
  const unknown = [];

  for (const dep of Object.keys(allDeps || {})) {
    // Check for angular prefix packages (likely AngularJS)
    const isAngularJsDep =
      dep.startsWith("angular") ||
      dep.startsWith("ng-") ||
      dep === "bower" ||
      dep === "karma" ||
      dep === "jasmine-core" ||
      dep === "jasmine-spec-reporter" ||
      dep === "karma-jasmine" ||
      dep === "karma-chrome-launcher" ||
      dep === "protractor" ||
      dep === "moment" ||
      dep === "restangular";

    if (!isAngularJsDep) continue;

    const mapping = findMapping(dep);
    if (!mapping) {
      if (isAngularJsDep) unknown.push(dep);
      continue;
    }

    if (mapping.action === "replace") {
      toReplace.push({ from: dep, to: mapping.angular, notes: mapping.notes });
    } else if (mapping.action === "drop") {
      toDrop.push({ name: dep, notes: mapping.notes });
    } else if (mapping.action === "manual") {
      manual.push({ name: dep, notes: mapping.notes });
    }
  }

  return { toReplace, toDrop, manual, unknown };
}

/**
 * Gera o bloco de contexto sobre bibliotecas para incluir no prompt da IA.
 * Ajuda a IA a escolher os imports corretos.
 *
 * @param {string[]} detectedLibs - Lista de libs AngularJS detectadas no projeto
 * @returns {string}
 */
export function buildLibContextForPrompt(detectedLibs) {
  const relevant = detectedLibs.map((lib) => findMapping(lib)).filter(Boolean);

  if (!relevant.length) return "";

  const lines = ["BIBLIOTECAS DETECTADAS — use estes equivalentes Angular 21:"];
  for (const m of relevant) {
    if (m.action === "replace") {
      lines.push(`  - ${m.angularjs} → ${m.angular.join(", ")}: ${m.notes}`);
    } else if (m.action === "drop") {
      lines.push(`  - ${m.angularjs} → REMOVER (${m.notes})`);
    }
  }

  return lines.join("\n");
}

/**
 * Detecta quais libs de terceiros AngularJS estão sendo usadas no código.
 * @param {string} code
 * @returns {string[]}
 */
export function detectAngularJsLibsInCode(code) {
  const detected = [];

  // ui-router
  if (/\$state\b|\$stateProvider\b|ui-sref|ui\.router/.test(code))
    detected.push("angular-ui-router");
  // ngResource
  if (/\$resource\b|ngResource/.test(code)) detected.push("angular-resource");
  // angular-translate
  if (/\$translate\b|translate-filter|angular-translate/.test(code))
    detected.push("angular-translate");
  // angular-animate
  if (/ng-animate|ngAnimate|\$animate\b/.test(code))
    detected.push("angular-animate");
  // angular-cookies
  if (/\$cookies\b|\$cookieStore\b|ngCookies/.test(code))
    detected.push("angular-cookies");
  // angular-sanitize
  if (/\$sce\b|\$sanitize\b|ngSanitize/.test(code))
    detected.push("angular-sanitize");
  // moment
  if (/\bmoment\s*\(/.test(code)) detected.push("moment");
  // ui-bootstrap
  if (/ui\.bootstrap|uib-/.test(code)) detected.push("angular-ui-bootstrap");
  // angular-material
  if (/md-button|md-dialog|\$mdDialog|\$mdToast/.test(code))
    detected.push("angular-material");

  return detected;
}

/**
 * Heurística para identificar se um pacote é relacionado ao ecossistema AngularJS
 * e, portanto, precisa de atenção durante a migração.
 * @param {string} depName
 * @returns {boolean}
 */
function isAngularJsEcosystemDep(depName) {
  const lower = depName.toLowerCase();
  return (
    lower.startsWith("angular") ||
    lower.startsWith("ng-") ||
    lower === "bower" ||
    lower === "karma" ||
    lower === "karma-jasmine" ||
    lower === "karma-chrome-launcher" ||
    lower === "karma-coverage" ||
    lower === "karma-phantomjs-launcher" ||
    lower === "jasmine-core" ||
    lower === "jasmine-spec-reporter" ||
    lower === "protractor" ||
    lower === "moment" ||
    lower === "restangular" ||
    lower === "ngstorage" ||
    lower === "ng-token-auth" ||
    lower === "oclazyload" ||
    lower === "ui-router-extras"
  );
}

/**
 * Gera um relatório completo de todas as dependências do package.json,
 * classificando cada uma para o processo de migração.
 *
 * @param {object} packageJson - Conteúdo do package.json parseado
 * @returns {{
 *   toReplace: Array<{from: string, to: string[], notes: string, version: string}>,
 *   toDrop: Array<{name: string, notes: string, version: string}>,
 *   manual: Array<{name: string, notes: string, version: string}>,
 *   unknown: Array<{name: string, version: string}>,
 *   kept: Array<{name: string, version: string}>,
 *   totalDeps: number,
 * }}
 */
export function buildFullLibReport(packageJson) {
  const sections = {
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
    peerDependencies: packageJson.peerDependencies || {},
  };

  const toReplace = [];
  const toDrop = [];
  const manual = [];
  const unknown = [];
  const kept = [];
  const seen = new Set();

  for (const [sectionName, deps] of Object.entries(sections)) {
    for (const [dep, version] of Object.entries(deps)) {
      if (seen.has(dep)) continue;
      seen.add(dep);

      const mapping = findMapping(dep);

      if (mapping) {
        const entry = {
          name: dep,
          version,
          section: sectionName,
          notes: mapping.notes,
        };
        if (mapping.action === "replace") {
          toReplace.push({
            from: dep,
            to: mapping.angular,
            notes: mapping.notes,
            version,
            section: sectionName,
          });
        } else if (mapping.action === "drop") {
          toDrop.push(entry);
        } else if (mapping.action === "manual") {
          manual.push(entry);
        }
      } else if (isAngularJsEcosystemDep(dep)) {
        unknown.push({ name: dep, version, section: sectionName });
      } else {
        kept.push({ name: dep, version, section: sectionName });
      }
    }
  }

  return {
    toReplace,
    toDrop,
    manual,
    unknown,
    kept,
    totalDeps: seen.size,
  };
}
