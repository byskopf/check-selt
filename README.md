# CHECK-SE/LT — portais PWA

Este repositório contém o portal CHECK-SE/LT, o PWA do CHECK-LT e o PWA da
Central Administrativa. Os ambientes operacionais continuam no Google Apps
Script; estes arquivos cuidam da instalação, abertura, atualização e capa
offline dos portais.

## Estrutura

- `lt/`: CHECK-LT, com cache e ícones próprios.
- `admin/`: Central Administrativa, com cache, atualização assistida e modo offline próprios.
- `se/`: acesso compatível que encaminha ao portal oficial do CHECK-SE.
- `scripts/`: verificações automáticas dos PWAs.

## Validar

```bash
npm run validate
```

O comando verifica arquivos obrigatórios, manifestos, URLs, versões, fluxos de
instalação e isolamento dos caches.
