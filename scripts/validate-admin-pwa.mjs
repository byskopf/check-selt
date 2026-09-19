import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const base = 'admin/';
const requiredFiles = [
  'index.html',
  'app-config.js',
  'app.js',
  'manifest.json',
  'sw.js',
  'offline.html',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
];
const failures = [];

const iconAssetPath = (src) => String(src || '').split(/[?#]/)[0].replace(/^\.\//, '');
const iconVersionOf = (src) => {
  try {
    return new URL(String(src || ''), 'https://pwa.local/').searchParams.get('v');
  } catch {
    return null;
  }
};

for (const file of requiredFiles) {
  try {
    await access(base + file, constants.R_OK);
  } catch {
    failures.push(`Arquivo obrigatório ausente ou ilegível: ${base}${file}`);
  }
}

let manifest;
try {
  manifest = JSON.parse(await readFile(base + 'manifest.json', 'utf8'));
} catch (error) {
  failures.push(`manifest.json inválido: ${error.message}`);
}

if (manifest) {
  for (const field of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
    if (manifest[field] === undefined || manifest[field] === '') {
      failures.push(`Campo obrigatório ausente no manifest.json: ${field}`);
    }
  }
  if (
    manifest.id !== '/check-selt/admin/' ||
    manifest.scope !== '/check-selt/admin/' ||
    !String(manifest.start_url).startsWith('/check-selt/admin/')
  ) {
    failures.push('A Central deve manter ID, início e escopo próprios em /check-selt/admin/.');
  }
  if (manifest.display !== 'standalone') {
    failures.push('A Central deve continuar instalável em modo standalone.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
    failures.push('A Central deve declarar ícones de instalação.');
  } else if (manifest.icons.some((icon) => /^https?:\/\//i.test(icon.src || ''))) {
    failures.push('Os ícones da Central devem ser locais para o modo offline.');
  }
}

const indexHtml = await readFile(base + 'index.html', 'utf8').catch(() => '');
for (const reference of ['manifest.json', 'app-config.js', 'app.js']) {
  if (!indexHtml.includes(reference)) failures.push(`index.html não referencia ${reference}.`);
}
for (const element of ['installButton', 'openButton', 'installDialog', 'updateBanner', 'launchOverlay', 'launchRetry']) {
  if (!indexHtml.includes(`id="${element}"`)) {
    failures.push(`A Central perdeu o elemento obrigatório ${element}.`);
  }
}

const configSource = await readFile(base + 'app-config.js', 'utf8').catch(() => '');
const configVersion = configSource.match(/version:\s*['"]([^'"]+)['"]/);
const configAppUrl = configSource.match(/appUrl:\s*['"]([^'"]+)['"]/);
const configIconVersion = configSource.match(/iconVersion:\s*['"]([^'"]+)['"]/);
if (!configIconVersion || !/^[0-9A-Za-z._-]+$/.test(configIconVersion[1])) {
  failures.push('app-config.js deve declarar uma versão de ícones válida.');
}
if (manifest && configIconVersion) {
  const shortcutIcons = Array.isArray(manifest.shortcuts)
    ? manifest.shortcuts.flatMap((shortcut) => Array.isArray(shortcut.icons) ? shortcut.icons : [])
    : [];
  const declaredIcons = [
    ...(Array.isArray(manifest.icons) ? manifest.icons : []),
    ...shortcutIcons,
  ];
  for (const icon of declaredIcons) {
    if (iconVersionOf(icon.src) !== configIconVersion[1]) {
      failures.push('Todos os ícones do Central devem usar ?v=' + configIconVersion[1] + ' para atualizar instalações existentes.');
      break;
    }
  }
  if (!indexHtml.includes('apple-touch-icon.png?v=' + configIconVersion[1])) {
    failures.push('O ícone Apple Touch deve usar a mesma versão de ícones.');
  }
}

if (!configVersion || !/^\d+\.\d+\.\d+$/.test(configVersion[1])) {
  failures.push('app-config.js deve declarar uma versão semântica válida.');
}
if (!configAppUrl) {
  failures.push('app-config.js deve declarar appUrl.');
} else {
  try {
    const parsed = new URL(configAppUrl[1]);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'script.google.com' || !parsed.pathname.endsWith('/exec')) {
      failures.push('appUrl deve ser uma implantação HTTPS válida do script.google.com terminando em /exec.');
    }
  } catch {
    failures.push('appUrl em app-config.js é inválida.');
  }
}

const appJavaScript = await readFile(base + 'app.js', 'utf8').catch(() => '');
if (!appJavaScript.includes('CHECK_ADMIN_CONFIG')) failures.push('app.js deve usar CHECK_ADMIN_CONFIG.');
if (!appJavaScript.includes('beforeinstallprompt')) failures.push('app.js perdeu o fluxo de instalação PWA.');
if (!appJavaScript.includes('controllerchange')) failures.push('app.js perdeu o fluxo de atualização assistida.');
if (!/updateViaCache\s*:\s*['"]none['"]/.test(appJavaScript)) {
  failures.push('O registro do Service Worker deve ignorar o cache HTTP ao procurar atualizações.');
}
if (!appJavaScript.includes('visibilitychange')) {
  failures.push('A Central deve verificar atualizações ao retomar o aplicativo.');
}
if (!appJavaScript.includes('launchOverlay')) {
  failures.push('A Central perdeu o retorno visual durante a abertura.');
}
if (appJavaScript.includes('script.google.com/macros/s/')) {
  failures.push('app.js não deve repetir a URL do Apps Script; use app-config.js.');
}

const serviceWorker = await readFile(base + 'sw.js', 'utf8').catch(() => '');
if (!serviceWorker.includes('ICON_VERSION') || !serviceWorker.includes('iconVersion')) {
  failures.push('O Service Worker deve pré-carregar os ícones usando a versão configurada.');
}
const importedConfig = serviceWorker.match(/importScripts\(\s*['"]app-config\.js(?:\?v=([^'"]+))?['"]\s*\)/);
if (!importedConfig) failures.push('sw.js deve importar app-config.js.');
if (importedConfig && importedConfig[1] && configVersion && importedConfig[1] !== configVersion[1]) {
  failures.push('A versão importada pelo sw.js deve corresponder à versão da Central.');
}

/* O atalho de quem já instalou é um location.replace escrito à mão no index.html, ou seja, uma
   cópia solta do appUrl. Essa cópia ficou para trás e a Central instalada continuou abrindo uma
   implantação antiga até 19/09/2026, sem nada acusar. A mesma regra já existe no validador do
   aplicativo; aqui faltava. */
const redirecionamentos = [...indexHtml.matchAll(/location\.(?:replace|assign)\(\s*["'](https:\/\/script\.google\.com[^"']*)["']/gi)];
for (const achado of redirecionamentos) {
  if (configAppUrl && achado[1] !== configAppUrl[1]) {
    failures.push('A URL do redirecionamento em index.html está diferente do appUrl em app-config.js. Elas precisam ser iguais, senão a Central instalada abre outra implantação.');
  }
}

/* A Central é só para o administrador: não entra em buscador nem é divulgada no portal. */
if (!/<meta\s+name="robots"\s+content="noindex/i.test(indexHtml)) {
  failures.push('index.html da Central deve ter <meta name="robots" content="noindex,nofollow">.');
}
const robots = await readFile('robots.txt', 'utf8').catch(() => '');
if (!/^\s*Disallow:\s*\/admin\/\s*$/m.test(robots)) {
  failures.push('robots.txt deve conter "Disallow: /admin/" — a Central não é divulgada.');
}
const hub = await readFile('index.html', 'utf8').catch(() => '');
if (/\.\/admin\/|check-selt\/admin\//.test(hub)) {
  failures.push('O portal (index.html da raiz) não deve linkar nem compartilhar a Central.');
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8').catch(() => '{}'));
if (configVersion && packageJson.version !== configVersion[1]) {
  failures.push('A versão do package.json deve corresponder à versão da Central.');
}
for (const file of ['index.html', 'app-config.js', 'app.js', 'manifest.json', 'offline.html']) {
  if (!serviceWorker.includes(file)) failures.push(`sw.js não referencia o arquivo essencial ${file}.`);
}
if (!serviceWorker.includes('check-admin-launcher-')) failures.push('Cache da Central deve permanecer isolado.');

if (failures.length) {
  console.error('Validação da Central falhou:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Central Administrativa PWA validada com sucesso.');
