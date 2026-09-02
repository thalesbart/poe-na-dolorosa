# PixMeDeve — Guia de Instalação

Este guia te leva do zero ao app funcionando no celular, sem gastar nada.

---

## Parte 1 — Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha em branco.
2. Renomeie a planilha para "PixMeDeve DB" (ou o nome que preferir).
3. Você **não precisa criar as abas manualmente** — o Apps Script cria
   automaticamente as abas `transacoes`, `acertos`, `descricoes_pessoais`,
   `formas_pagamento` e `usuarios` na primeira vez que forem usadas.
4. Copie a URL da planilha e guarde — você vai precisar dela mais raramente,
   mas é bom ter por perto.

---

## Parte 2 — Google Apps Script (a API)

1. Na planilha, vá em **Extensões → Apps Script**.
2. Vai abrir um editor com um arquivo `Código.gs` vazio. **Apague tudo**.
3. Crie 4 arquivos com os nomes exatos abaixo (use o ícone "+" ao lado de
   "Arquivos" no menu lateral → Script):
   - `Code.gs`
   - `Transacoes.gs`
   - `Acertos.gs`
   - `Auxiliares.gs`
4. Copie o conteúdo de cada arquivo (que está na pasta `apps-script/` deste
   projeto) para o arquivo correspondente no editor.
5. Salve tudo (Ctrl+S ou ⌘+S).
6. Clique em **Implantar → Nova implantação**.
   - Tipo: clique na engrenagem e escolha **App da Web**.
   - Descrição: "v1"
   - Executar como: **Eu (seu e-mail)**
   - Quem tem acesso: **Qualquer pessoa**
7. Clique em **Implantar**. O Google vai pedir autorização — aceite e
   permita o acesso (é normal aparecer um aviso de "app não verificado",
   pode continuar pois é o seu próprio script).
8. Copie a **URL do app da Web** gerada. Ela se parece com:
   `https://script.google.com/macros/s/AKfycb.../exec`

**Guarde essa URL — você vai colar ela no app Expo no próximo passo.**

> Sempre que editar o código do Apps Script, você precisa criar uma
> **Nova implantação** (ou editar a implantação existente) para as
> mudanças valerem na URL pública.

---

## Parte 3 — Projeto Expo

1. Instale o [Node.js](https://nodejs.org) no seu computador, se ainda não tiver.
2. Abra um terminal na pasta `expo-app/` deste projeto.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Abra o arquivo `services/api.js` e substitua:
   ```js
   const APPS_SCRIPT_URL = 'COLE_AQUI_A_URL_DO_SEU_APPS_SCRIPT';
   ```
   pela URL que você copiou na Parte 2.
5. Instale o app **Expo Go** no celular de Thales e Tamires (disponível na
   App Store e Google Play, de graça).
6. No terminal, rode:
   ```bash
   npx expo start
   ```
7. Vai aparecer um QR code no terminal. Escaneie com a câmera do celular
   (Android) ou pelo próprio app Expo Go (iOS) — o app abre direto, sem
   precisar instalar nada na loja.

---

## Parte 4 — Testando

1. Abra o app nos dois celulares.
2. Em cada um, escolha o nome correspondente (Thales ou Tamires).
3. Lance um débito dividido em um celular — o outro deve receber uma
   notificação push em alguns segundos (é necessário aceitar a permissão
   de notificações quando o app pedir).
4. Confira no Google Sheets se a linha foi criada na aba `transacoes`.

---

## Problemas comuns

**"Erro na requisição GET/POST"**
→ Confira se a URL em `api.js` está exatamente igual à gerada no passo 2.8,
terminando em `/exec`.

**Notificação não chega**
→ Notificações push só funcionam em **dispositivo físico**, não em
emuladores. Confirme que os dois aceitaram a permissão de notificações.

**"App não verificado" ao publicar o Apps Script**
→ Normal, é o aviso padrão do Google para scripts pessoais. Clique em
"Configurações avançadas" → "Acessar PixMeDeve (não seguro)" → continuar.

**Mudei o código do Apps Script mas nada mudou no app**
→ Você precisa fazer uma nova implantação: Implantar → Gerenciar
implantações → ícone de lápis → Nova versão → Implantar.

---

## Próximos passos opcionais

- Gerar um **build standalone** (sem precisar do Expo Go) com
  `eas build`, gratuito até um certo número de builds por mês.
- Adicionar gráficos de gastos por categoria no Dashboard.
- Exportar relatório mensal em PDF.
