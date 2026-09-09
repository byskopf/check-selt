import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const base = 'lt/';
const requiredFiles = [
  'index.html',
  'app-config.js',
  'app.js',
  'manifest.json',
  'sw.js',
  'offline.html',
  'favicon.svg',
];

const failures = [];

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
  if (manifest.scope !== './' || manifest.display !== 'standalone') {
    failures.push('O CHECK-LT deve continuar instalável em modo standalone e escopo próprio.');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    failures.push('manifest.json deve declarar pelo menos um ícone.');
  }
}

const indexHtml = await readFile(base + 'index.html', 'utf8').catch(() => '');
for (const reference of ['manifest.json', 'app-config.js', 'app.js']) {
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
if (!indexHtml.includes('CHECK-LT | Comissionamento Inteligente')) {
  failures.push('Título oficial do CHECK-LT ausente no index.html.');
}

const configSource = await readFile(base + 'app-config.js', 'utf8').catch(() => '');
const configVersion = configSource.match(/version:\s*['\"]([^'\"]+)['\"]/);
const configAppUrl = configSource.match(/appUrl:\s*['\"]([^'\"]+)['\"]/);
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
if (appJavaScript.includes('script.google.com/macros/s/')) {
  failures.push('app.js não deve repetir a URL do Apps Script; use app-config.js.');
}

const serviceWorker = await readFile(base + 'sw.js', 'utf8').catch(() => '');
if (!serviceWorker.includes("importScripts('app-config.js')")) failures.push('sw.js deve importar app-config.js.');
for (const file of ['index.html', 'app-config.js', 'app.js', 'manifest.json', 'offline.html']) {
  if (!serviceWorker.includes(file)) failures.push(`sw.js não referencia o arquivo essencial ${file}.`);
}
if (!serviceWorker.includes('check-lt-launcher-')) failures.push('Cache do CHECK-LT deve permanecer isolado.');

if (failures.length) {
  console.error('Validação do CHECK-LT falhou:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CHECK-LT PWA validado com sucesso.');
