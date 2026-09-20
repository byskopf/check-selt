# CHECK-SELT — portal PWA

Este repositório contém o portal oficial CHECK-SELT, que reúne as funções de subestações e linhas de transmissão, além da Central Administrativa. Os ambientes operacionais continuam no Google Apps
Script; estes arquivos cuidam da instalação, abertura, atualização e capa
offline dos portais.

## Estrutura

- `lt/`: aplicativo CHECK-SELT, com cache e ícones próprios.
- `admin/`: Central Administrativa, com cache, atualização assistida e modo offline próprios.
- `scripts/`: verificações automáticas dos PWAs e `gerar-icones.mjs`, que regera os ícones do
  aplicativo a partir dos SVG em `lt/`. Depois de editar um SVG, rode-o e suba o `iconVersion`
  em `lt/app-config.js` — sem isso o validador reprova e quem já instalou fica com o ícone velho.

## Validar

```bash
npm run validate
```

O comando verifica arquivos obrigatórios, manifestos, URLs, versões, fluxos de
instalação e isolamento dos caches.
