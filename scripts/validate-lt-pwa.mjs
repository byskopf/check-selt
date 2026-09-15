import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const base = 'lt/';
const requiredFiles = [
  'index.html',
  'app-config.js',
  'app.js',
  'styles.css',
  'manifest.json',
  'sw.js',
  'offline.html',
  'favicon.svg',
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
  for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
    if (manifest[field] === undefined || manifest[field] === '') {
      failures.push(`Campo obrigatório ausente no manifest.json: ${field}`);
    }
  }
  if (manifest.name !== 'CHECK-LT' || manifest.short_name !== 'CHECK-LT') {
    failures.push('O manifest deve identificar o aplicativo como CHECK-LT.');
  }
  if (manifest.id !== '/check-selt/lt/' || !['./', '/check-selt/lt/'].includes(manifest.scope)) {
    failures.push('O CHECK-LT deve manter identidade e escopo próprios em /check-selt/lt/.');
  }
  if (manifest.display !== 'standalone') {
    failures.push('O CHECK-LT deve continuar instalável em modo standalone.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    failures.push('manifest.json deve declarar pelo menos um ícone.');
  } else if (manifest.icons.some((icon) => /^https?:\/\//i.test(icon.src || ''))) {
    failures.push('Os ícones do CHECK-LT devem ser locais para funcionar offline sem depender do CHECK-SE.');
  }
}

const indexHtml = await readFile(base + 'index.html', 'utf8').catch(() => '');
for (const reference of ['manifest.json', 'app-config.js', 'app.js', 'styles.css']) {
  if (!indexHtml.includes(reference)) failures.push(`index.html não referencia ${reference}.`);
}
for (const element of ['installButton', 'openButton', 'installDialog', 'launchOverlay']) {
  if (!indexHtml.includes(`id="${element}"`)) failures.push(`Portal perdeu o elemento obrigatório ${element}.`);
}
if (/<meta[^>]+http-equiv=["']refresh["']/i.test(indexHtml)) {
  failures.push('index.html não pode voltar a usar redirecionamento automático por meta refresh.');
}
if (/location\.(replace|assign)\(["']https:\/\/script\.google\.com/i.test(indexHtml)) {
  failures.push('index.html não pode redirecionar diretamente ao Apps Script. Use o portal instalável.');
}
for (const meta of [
  'property="og:image:type" content="image/jpeg"',
  'property="og:image:width" content="1200"',
  'property="og:image:height" content="630"',
]) {
  if (!indexHtml.includes(meta)) failures.push('Metadado obrigatório ausente: ' + meta);
}
if (!indexHtml.includes('CHECK-LT | Ferramentas e gestão de linhas de transmissão')) {
  failures.push('Título oficial do CHECK-LT ausente no index.html.');
}

const configSource = await readFile(base + 'app-config.js', 'utf8').catch(() => '');
const configVersion = configSource.match(/version:\s*['\"]([^'\"]+)['\"]/);
const configAppUrl = configSource.match(/appUrl:\s*['\"]([^'\"]+)['\"]/);
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
      failures.push('Todos os ícones do CHECK-LT devem usar ?v=' + configIconVersion[1] + ' para atualizar instalações existentes.');
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
if (!appJavaScript.includes('CHECK_LT_CONFIG')) failures.push('app.js deve usar CHECK_LT_CONFIG.');
if (!appJavaScript.includes('beforeinstallprompt')) failures.push('app.js perdeu o fluxo de instalação PWA.');
if (!appJavaScript.includes("serviceWorker")) failures.push('app.js perdeu o registro do Service Worker.');
if (!/updateViaCache\s*:\s*['"]none['"]/.test(appJavaScript)) {
  failures.push('O registro do Service Worker deve ignorar o cache HTTP ao procurar atualizações.');
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
  failures.push('A versão importada pelo sw.js deve corresponder à versão do app-config.js.');
}
for (const file of ['index.html', 'app-config.js', 'app.js', 'styles.css', 'manifest.json', 'offline.html']) {
  if (!serviceWorker.includes(file)) failures.push(`sw.js não referencia o arquivo essencial ${file}.`);
}
if (!serviceWorker.includes('check-lt-launcher-')) failures.push('Cache do CHECK-LT deve permanecer isolado.');
if (serviceWorker.includes('https://byskopf.github.io/CHECK-SE/')) {
  failures.push('O cache do CHECK-LT não deve depender dos arquivos do CHECK-SE.');
}

if (failures.length) {
  console.error('Validação do CHECK-LT falhou:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CHECK-LT PWA validado com sucesso.');
