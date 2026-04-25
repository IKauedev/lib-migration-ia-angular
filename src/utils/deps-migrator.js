// Maps AngularJS/old Angular packages to their Angular 21 equivalents
const DEP_MAP = {
  // AngularJS core
  'angular':                       null, // remove
  'angular-route':                 null,
  'angular-resource':              null,
  'angular-animate':               null,
  'angular-aria':                  null,
  'angular-messages':              null,
  'angular-sanitize':              null,
  'angular-touch':                 null,
  'angular-cookies':               null,
  'angular-mocks':                 null,

  // UI Router
  '@uirouter/angularjs':           '@uirouter/angular',
  'angular-ui-router':             '@uirouter/angular',

  // Angular Material AngularJS
  'angular-material':              '@angular/material',

  // HTTP
  'angular-http':                  null,

  // i18n
  'angular-translate':             '@ngx-translate/core',
  'angular-gettext':               '@ngx-translate/core',

  // Forms
  'angular-formly':                '@ngx-formly/core',

  // State management
  'angular-redux':                 '@ngrx/store',
  'ng-redux':                      '@ngrx/store',

  // Utilities
  'lodash':                        'lodash',  // keep
  'moment':                        'date-fns', // suggest migration
  'jquery':                        null,       // remove
  'bootstrap':                     'bootstrap', // keep, upgrade to 5
};

// Angular 21 packages to always add
const ANGULAR21_DEPS = {
  '@angular/animations':  '^21.0.0',
  '@angular/common':      '^21.0.0',
  '@angular/compiler':    '^21.0.0',
  '@angular/core':        '^21.0.0',
  '@angular/forms':       '^21.0.0',
  '@angular/platform-browser': '^21.0.0',
  '@angular/platform-browser-dynamic': '^21.0.0',
  '@angular/router':      '^21.0.0',
  'rxjs':                 '^7.8.0',
  'tslib':                '^2.6.0',
  'zone.js':              '~0.14.0',
};

const ANGULAR21_DEV_DEPS = {
  '@angular-devkit/build-angular': '^21.0.0',
  '@angular/cli':                  '^21.0.0',
  '@angular/compiler-cli':         '^21.0.0',
  'typescript':                    '~5.6.0',
};

export function migrateDependencies(originalPkg) {
  const pkg = JSON.parse(JSON.stringify(originalPkg)); // deep clone
  const report = { removed: [], added: [], updated: [], warnings: [] };

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  // Remove AngularJS deps, map replacements
  for (const [dep, replacement] of Object.entries(DEP_MAP)) {
    if (dep in (pkg.dependencies || {})) {
      delete pkg.dependencies[dep];
      if (replacement === null) {
        report.removed.push(dep);
      } else {
        report.warnings.push(`${dep} → ${replacement} (verifique compatibilidade)`);
      }
    }
    if (dep in (pkg.devDependencies || {})) {
      delete pkg.devDependencies[dep];
      if (replacement === null) report.removed.push(`${dep} (devDep)`);
    }
  }

  // Remove old @angular/* versions
  for (const key of Object.keys(pkg.dependencies || {})) {
    if (key.startsWith('@angular/') && key in ANGULAR21_DEPS) {
      const old = pkg.dependencies[key];
      pkg.dependencies[key] = ANGULAR21_DEPS[key];
      report.updated.push(`${key}: ${old} → ${ANGULAR21_DEPS[key]}`);
    }
  }

  // Add missing Angular 21 core deps
  pkg.dependencies = pkg.dependencies || {};
  for (const [dep, ver] of Object.entries(ANGULAR21_DEPS)) {
    if (!(dep in pkg.dependencies)) {
      pkg.dependencies[dep] = ver;
      report.added.push(`${dep}@${ver}`);
    }
  }

  // Update devDeps
  pkg.devDependencies = pkg.devDependencies || {};
  for (const [dep, ver] of Object.entries(ANGULAR21_DEV_DEPS)) {
    const old = pkg.devDependencies[dep];
    pkg.devDependencies[dep] = ver;
    if (old && old !== ver) report.updated.push(`${dep}: ${old} → ${ver} (devDep)`);
    else if (!old) report.added.push(`${dep}@${ver} (devDep)`);
  }

  // Update scripts
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['start']       = 'ng serve';
  pkg.scripts['build']       = 'ng build';
  pkg.scripts['build:prod']  = 'ng build --configuration production';
  pkg.scripts['test']        = 'ng test';
  pkg.scripts['lint']        = 'ng lint';

  // Minimum Node engine
  pkg.engines = { node: '>=20.0.0' };

  return { pkg, report };
}
