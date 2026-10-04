/* Configuração única do portal CHECK-LT.
   03/10/2026: a troca para o projeto do Workspace foi desfeita na mesma noite (o link novo não abria no celular dele); o app segue no projeto de sempre.
   04/10/2026 (1.9.0): ícone cinza e nome "CHECK-SELT antigo" (decisão "2a" dele; o app novo é o verde do checkselt.com).
   04/10/2026 (1.8.0, V5.6): quem abre o app por aqui leva a marca de=pwa-antigo (index.html e app.js), para o app
   oferecer a ida ao checkselt.com. O appUrl continua SEM consulta: a marca entra por código, e o index.html usa a
   mesma literal. O ?v= dos scripts no index.html e do importScripts no sw.js acompanha esta versão. */
var CHECK_LT_CONFIG = Object.freeze({
  version: '1.9.0',
  iconVersion: '20261004',
  appUrl: 'https://script.google.com/macros/s/AKfycbzo_WN_PzoRhS-LhV070vmE8GDr1vJX9qEa1iqxADe6kVhNZa968olZLVVDAtObmvE/exec'
});
