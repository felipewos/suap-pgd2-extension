# suap-pgd2-extension

Extensao Chrome Manifest V3 para automatizar o preenchimento de PIT e RIT no SUAP PGD2.

## O que faz

- preenche PIT individual com dados do PES
- preenche RIT individual com dados do PIT
- executa fluxo em lote para PIT e RIT
- controla trial e licenca por usuario
- consulta backend principal e fallback Cloudflare

## Estrutura

- `manifest.json`: configuracao da extensao
- `service_worker.js`: estado, licenciamento e mensagens
- `content/`: automacao injetada no SUAP
- `ui/`: popup e pagina de opcoes
- `lib/apiClient.js`: cliente HTTP do backend

## Uso local

1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Load unpacked`
4. Selecione esta pasta

## Backend esperado

- `https://api.proffelipewagner.com.br`
- `https://suap-pgd2-license-backend.felipewagner83.workers.dev`

## Observacao

O arquivo `apiClient.json` e local e permanece fora do versionamento por regra de `.gitignore`.
