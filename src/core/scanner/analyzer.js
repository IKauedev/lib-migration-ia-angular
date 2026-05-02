export const NG_PATTERNS = [
  { name: "$scope", regex: /\$scope\b/, weight: 2 },
  { name: "$http", regex: /\$http\b(?!Client)/, weight: 2 },
  { name: "angular.module", regex: /angular\.module\s*\(/, weight: 3 },
  { name: ".controller()", regex: /\.controller\s*\(/, weight: 3 },
  { name: ".service()", regex: /\.service\s*\(/, weight: 2 },
  { name: ".factory()", regex: /\.factory\s*\(/, weight: 2 },
  { name: ".directive()", regex: /\.directive\s*\(/, weight: 3 },
  { name: ".filter()", regex: /\.filter\s*\(/, weight: 1 },
  { name: ".component()", regex: /\.component\s*\(/, weight: 2 },
  { name: "$routeProvider", regex: /\$routeProvider/, weight: 3 },
  { name: "$stateProvider", regex: /\$stateProvider/, weight: 3 },
  { name: "$q", regex: /\$q\./, weight: 2 },
  { name: "$timeout", regex: /\$timeout\b/, weight: 1 },
  { name: "$broadcast/$emit", regex: /\$broadcast|\$emit\b/, weight: 2 },
  { name: "$watch", regex: /\$watch\s*\(/, weight: 2 },
  { name: "$rootScope", regex: /\$rootScope\b/, weight: 2 },
  { name: "$compile", regex: /\$compile\b/, weight: 3 },
  { name: "ng-repeat", regex: /ng-repeat|ng:repeat/, weight: 1 },
  { name: "ng-if", regex: /ng-if\b|ng:if\b/, weight: 1 },
  { name: "ng-model", regex: /ng-model\b|ng:model\b/, weight: 1 },
  { name: "ng-controller", regex: /ng-controller\b/, weight: 2 },
  { name: "ng-app", regex: /ng-app\b/, weight: 3 },
  { name: "ng-show/ng-hide", regex: /ng-show|ng-hide/, weight: 1 },
  { name: "ng-click", regex: /ng-click\b/, weight: 1 },
  { name: "templateUrl", regex: /templateUrl\s*:/, weight: 1 },
  { name: "link function", regex: /link\s*:\s*function/, weight: 2 },
  { name: "angular.element", regex: /angular\.element\b/, weight: 1 },
  { name: "$sce", regex: /\$sce\b/, weight: 2 },
];

export const SKIP_PATTERNS = [
  /node_modules/,
  // Minified files (jQuery, Bootstrap, vendor bundles, etc.)
  /\.min\.(js|css)$/,
  /\.(bundle|packed|compiled)\.(js|css)$/,
  // Build / output folders
  /dist\//,
  /coverage\//,
  /\.git\//,
  /\.angular\//,
  /e2e\//,
  // Vendor / dependency folders (Bower, CDN copies)
  /\/vendor\//,
  /bower_components\//,
  /public\/lib\//,
  /assets\/lib\//,
  /assets\/vendor\//,
  /static\/vendor\//,
  /static\/lib\//,
  // Test / config scaffolding
  /\.spec\.(js|ts)$/,
  /karma\.conf/,
  /protractor/,
  // Known large 3rd-party source files (non-user code)
  /\bjquery[.-]/i,
  /\bbootstrap[.-]/i,
  /\blodash[.-]/i,
  /\bunderscore[.-]/i,
  /\bmoment[.-]/i,
  /\bangular\.js$/i,
  /\bangular-mocks\.js$/i,
  /\bangular-locale/i,
];

export function shouldSkip(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return SKIP_PATTERNS.some((p) => p.test(norm));
}

export function detectFileType(content) {
  if (/\.controller\s*\(/.test(content)) return "controller";
  if (/\.service\s*\(/.test(content)) return "service";
  if (/\.factory\s*\(/.test(content)) return "factory";
  if (/\.filter\s*\(/.test(content)) return "filter";
  if (/\.directive\s*\(/.test(content)) return "directive";
  if (/\.component\s*\(/.test(content)) return "component";
  if (/\$routeProvider|\$stateProvider/.test(content)) return "routing";
  if (/ng-app\b|ng-controller\b/.test(content)) return "template";
  if (/angular\.module\s*\(/.test(content)) return "module";
  return "unknown";
}

export function detectPatterns(content) {
  return NG_PATTERNS.filter((p) => p.regex.test(content)).map((p) => p.name);
}

export function estimateComplexity(content, patterns) {
  const loc = content.split("\n").length;
  const weight = patterns.reduce((sum, name) => {
    const found = NG_PATTERNS.find((x) => x.name === name);
    return sum + ((found && found.weight) || 1);
  }, 0);
  const score = loc * 0.08 + weight * 2.5;
  if (score < 14) return "baixa";
  if (score < 38) return "média";
  return "alta";
}

export function detectDependencies(content) {
  const deps = new Set();

  for (const m of content.matchAll(/\[([^\]]+),\s*function/g)) {
    m[1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .forEach((d) => {
        if (d.startsWith("$") || /^[A-Z]/.test(d)) deps.add(d);
      });
  }

  const injectMatch = content.match(/\.\$inject\s*=\s*\[([^\]]+)\]/);
  if (injectMatch) {
    injectMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .forEach((d) => deps.add(d));
  }

  for (const m of content.matchAll(/constructor\s*\(([^)]+)\)/g)) {
    m[1]
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/.*:\s*/, "")
          .replace(/['"]/g, ""),
      )
      .forEach((d) => {
        if (d.startsWith("$") || /^[A-Z]/.test(d)) deps.add(d);
      });
  }

  return [...deps];
}

export function detectProblems(content, patterns) {
  const problems = [];

  if (patterns.includes("$rootScope"))
    problems.push("$rootScope: use Signals ou serviço singleton");
  if (patterns.includes("$compile"))
    problems.push("$compile: substitua por ViewContainerRef.createComponent()");
  if (patterns.includes("$sce"))
    problems.push("$sce.trustAs: substitua por DomSanitizer");
  if (patterns.includes("templateUrl"))
    problems.push("templateUrl externo: inline o template ou use lazy loading");
  if (patterns.includes("link function"))
    problems.push("link function: refatore para OnInit/OnChanges");
  if (patterns.includes("angular.element"))
    problems.push("angular.element: use ElementRef/Renderer2");
  if (content.includes("$scope.$apply"))
    problems.push("$scope.$apply: remover após migrar para signals");
  if (content.includes("$$"))
    problems.push("Acesso a propriedades internas ($$): remover");
  if (content.includes("$interpolate"))
    problems.push("$interpolate: use template literals ou pipes");
  if (content.includes("angular.copy"))
    problems.push("angular.copy: use structuredClone() ou spread operator");
  if (content.includes("angular.extend"))
    problems.push("angular.extend: use Object.assign() ou spread");
  if (content.includes("angular.forEach"))
    problems.push("angular.forEach: use Array.forEach()");

  return problems;
}
