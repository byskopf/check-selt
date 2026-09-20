/* Gera toda a família de ícones do PWA do aplicativo a partir dos dois SVG versionados
 * (lt/icon-source.svg e lt/icon-maskable-source.svg), usando o Chrome instalado.
 *
 * Uso:  node scripts/gerar-icones.mjs
 *
 * No fim grava lt/icones.lock.json com o hash de cada fonte. O validador confere esse
 * arquivo: se alguém editar um SVG e esquecer de rodar este script, a verificação reprova.
 * Sem isso, o PWA continuaria instalando o ícone antigo sem ninguém perceber — foi assim que
 * o aplicativo ficou com a torre do CHECK-LT depois de virar CHECK-SELT.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATOS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const navegador = CANDIDATOS.find(existsSync);
if (!navegador) { console.error('Não achei Chrome nem Edge para renderizar os ícones.'); process.exit(1); }

const FONTES = { normal: 'lt/icon-source.svg', maskable: 'lt/icon-maskable-source.svg' };
const SAIDAS = [
  { fonte: 'normal', arquivo: 'lt/icon-192.png', lado: 192 },
  { fonte: 'normal', arquivo: 'lt/icon-512.png', lado: 512 },
  { fonte: 'normal', arquivo: 'lt/apple-touch-icon.png', lado: 180 },
  { fonte: 'maskable', arquivo: 'lt/icon-maskable-192.png', lado: 192 },
  { fonte: 'maskable', arquivo: 'lt/icon-maskable-512.png', lado: 512 },
];

const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);
const tmp = mkdtempSync(join(tmpdir(), 'icones-'));
let falhas = 0;

for (const { fonte, arquivo, lado } of SAIDAS) {
  const destino = join(raiz, arquivo);
  const antes = existsSync(destino) ? sha(readFileSync(destino)) : 'ausente';
  const svg = readFileSync(join(raiz, FONTES[fonte]), 'utf8');
  const pagina = join(tmp, 'p.html');
  writeFileSync(pagina, `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    svg{display:block;width:${lado}px;height:${lado}px}
  </style>${svg}`, 'utf8');

  /* --screenshot exige caminho ABSOLUTO: com caminho relativo o Chrome não grava e não reclama. */
  execFileSync(navegador, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', '--force-device-scale-factor=1',
    `--window-size=${lado},${lado}`, `--screenshot=${destino}`,
    pathToFileURL(pagina).href,
  ], { stdio: 'ignore' });

  if (!existsSync(destino)) { console.log('ERRO ' + arquivo + ' não foi gerado'); falhas++; continue; }
  const dados = readFileSync(destino);
  const largura = dados.readUInt32BE(16), altura = dados.readUInt32BE(20);
  const ok = largura === lado && altura === lado;
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'ERRO ') + arquivo.padEnd(30) + largura + 'x' + altura +
    '  ' + Math.round(dados.length / 1024) + ' KB' +
    (antes === sha(dados) ? '  (inalterado)' : '  (atualizado)'));
}

if (falhas) { console.error('\n' + falhas + ' falha(s) — o lock NÃO foi gravado.'); process.exit(1); }

const lock = { gerado: new Date().toISOString().slice(0, 10), fontes: {} };
for (const [nome, caminho] of Object.entries(FONTES)) lock.fontes[caminho] = sha(readFileSync(join(raiz, caminho)));
writeFileSync(join(raiz, 'lt/icones.lock.json'), JSON.stringify(lock, null, 2) + '\n', 'utf8');
console.log('\nlt/icones.lock.json atualizado. Lembre de subir o iconVersion em lt/app-config.js.');
