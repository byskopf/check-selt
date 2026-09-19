# CHECK-SELT — portal PWA

Este repositório contém o portal oficial CHECK-SELT, que reúne as funções de subestações e linhas de transmissão, além da Central Administrativa. Os ambientes operacionais continuam no Google Apps
Script; estes arquivos cuidam da instalação, abertura, atualização e capa
offline dos portais.

## Estrutura

- `lt/`: aplicativo CHECK-SELT, com cache e ícones próprios.
- `admin/`: Central Administrativa, com cache, atualização assistida e modo offline próprios.
- `scripts/`: verificações automáticas dos PWAs.

## Validar

```bash
npm run validate
```

O comando verifica arquivos obrigatórios, manifestos, URLs, versões, fluxos de
instalação e isolamento dos caches.
