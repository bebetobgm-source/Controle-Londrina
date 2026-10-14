# Guia de Instalação do Orçamento Londrina (Google Apps Script + Google Sheets)

Este aplicativo foi desenvolvido sob medida para um casal em Londrina (PR) controlar o orçamento doméstico diretamente pelo celular, com foco em:
1. **Lançamento em menos de 10 segundos** no smartphone.
2. **Índice de Ritmo diário** para avisar antes do orçamento estourar.
3. **Conselheiro Financeiro** com consequências concretas e plano de ação.

---

## Passo 1: Criar a Planilha no Google Drive

1. Abra o [Google Sheets](https://sheets.new) no seu computador com a conta Google principal de vocês.
2. Dê o nome da planilha de: **`Orçamento Doméstico Londrina`**.
3. Deixe a planilha aberta. Não precisa criar nenhuma aba agora — o script criará todas as abas, cores, validações e dados iniciais automaticamente.

---

## Passo 2: Abrir o Editor do Google Apps Script

1. No menu superior da planilha, clique em **Extensões** > **Apps Script**.
2. Uma nova aba será aberta com o editor de código.
3. No topo à esquerda, mude o nome do projeto de "Projeto sem título" para **`App Orçamento Londrina`**.

---

## Passo 3: Adicionar os Arquivos do Backend (.gs)

O projeto usa 7 arquivos de script organizados por responsabilidade. No menu lateral esquerdo do Apps Script, você pode renomear o arquivo `Código.gs` existente ou criar novos arquivos clicando no ícone de `+` ao lado de **Arquivos** > **Script**:

1. **`Inicializar.gs`**: copie e cole o código do arquivo `gas/Inicializar.gs`.
2. **`Dados.gs`**: clique em `+` > **Script**, nomeie como `Dados`, e cole o conteúdo de `gas/Dados.gs`.
3. **`Calculos.gs`**: clique em `+` > **Script**, nomeie como `Calculos`, e cole o conteúdo de `gas/Calculos.gs`.
4. **`Alertas.gs`**: clique em `+` > **Script**, nomeie como `Alertas`, e cole o conteúdo de `gas/Alertas.gs`.
5. **`Conselheiro.gs`**: clique em `+` > **Script**, nomeie como `Conselheiro`, e cole o conteúdo de `gas/Conselheiro.gs`.
6. **`Notificacoes.gs`**: clique em `+` > **Script**, nomeie como `Notificacoes`, e cole o conteúdo de `gas/Notificacoes.gs`.
7. **`Gatilhos.gs`**: clique em `+` > **Script**, nomeie como `Gatilhos`, e cole o conteúdo de `gas/Gatilhos.gs`.

---

## Passo 4: Adicionar o Arquivo HTML do Frontend

1. No menu lateral esquerdo, clique no ícone de `+` ao lado de **Arquivos** e selecione **HTML**.
2. Nomeie o arquivo exatamente como **`Index`** (sem a extensão `.html`, o Google adiciona automaticamente).
3. Apague todo o código que vier nele e cole o conteúdo completo do arquivo `gas/Index.html`.
4. Clique no ícone de disquete (**Salvar projeto**) ou aperte `Ctrl + S` / `Cmd + S`.

---

## Passo 5: Inicializar a Planilha e Conceder Permissões

1. Na barra superior do editor, localize a caixa de seleção de funções (ao lado de "Depurar" e "Executar").
2. Selecione a função **`inicializarPlanilha`**.
3. Clique no botão **Executar**.
4. O Google exibirá um aviso: **"Autorização necessária"**.
   - Clique em **Revisar permissões**.
   - Escolha a sua conta Google.
   - Clique no link cinza **Avançado** (no rodapé do popup).
   - Clique em **Acessar App Orçamento Londrina (não seguro)**.
   - Clique em **Permitir**.
5. Volte para a aba da planilha no navegador: você verá todas as abas criadas (`Lancamentos`, `Fixas`, `Orcamento`, `Categorias`, `Reserva`, `Config`, `Alertas_Log`), com as despesas de Londrina preenchidas (Aluguel R$ 2.100, Condomínio R$ 400, Carro R$ 1.500, Sanepar R$ 80, Copel R$ 150, tetos de Mercado R$ 1.200, colchão de R$ 2.000).

---

## Passo 6: Configurar os E-mails e Ativar os Gatilhos

1. Na aba **`Config`** da planilha:
   - Na linha `email_1`: coloque o e-mail do marido.
   - Na linha `email_2`: coloque o e-mail da esposa.
   - *(Opcional)* Na linha `webhook_n8n`: caso queiram receber os alertas urgentes no WhatsApp via n8n, insiram a URL do webhook aqui.
2. Volte ao editor do Apps Script, selecione a função **`instalarGatilhos`** e clique em **Executar**.
3. Pronto! Os lembretes das 20h e os resumos de domingo já estão configurados no relógio do Google.

---

## Passo 7: Publicar como Web App

1. No canto superior direito do editor do Apps Script, clique no botão azul **Implantar** > **Nova implantação**.
2. No ícone de engrenagem à esquerda de "Selecione o tipo", escolha **Aplicativo da Web**.
3. Preencha:
   - **Descrição**: `Versão 1.0 Casal Londrina`
   - **Executar como**: `Usuário acessando o aplicativo da web` ou `Eu` (recomendado `Eu` para simplificar permissões).
   - **Quem tem acesso**: `Qualquer pessoa com uma Conta do Google` (apenas quem tiver o link e for compartilhado na planilha poderá acessar).
4. Clique em **Implantar**.
5. Copie a **URL do aplicativo da Web** gerada (algo como `https://script.google.com/macros/s/.../exec`).

---

## Passo 8: Compartilhar com o Cônjuge

1. Na planilha do Google Sheets, clique no botão verde **Compartilhar** no canto superior direito.
2. Adicione o e-mail da esposa/marido com permissão de **Editor**.
3. Envie a **URL do aplicativo da Web** para o WhatsApp dela/dele.

---

## Passo 9: Adicionar o Ícone na Tela Inicial do Celular

### No iPhone (Safari):
1. Abra o link no **Safari** (não use o navegador embutido do WhatsApp).
2. Toque no botão de **Compartilhar** (ícone do quadrado com a seta para cima, na barra inferior).
3. Role para baixo e toque em **"Adicionar à Tela de Início"**.
4. Defina o nome como **Orçamento** e toque em **Adicionar**.

### No Android (Google Chrome):
1. Abra o link no **Chrome**.
2. Toque nos **três pontinhos** no canto superior direito.
3. Toque em **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
4. Confirme.

Pronto! Agora o casal tem um ícone nativo no celular que abre direto na tela de lançamento rápido em menos de 2 segundos.
