# Transformação em MVP SaaS Comercial para Casais

Evolução do aplicativo de controle financeiro familiar para uma plataforma SaaS multi-casal pronta para comercialização por assinatura mensal, permitindo que qualquer casal configure sua realidade financeira em minutos, sincronize gastos em tempo real sem barreiras técnicas e gerencie seu orçamento mês a mês.

## Revisão do Usuário & Decisões Confirmadas

> [!IMPORTANT]
> As decisões abaixo refletem exatamente as suas escolhas para tornar o produto comercializável mantendo a simplicidade e a transparência da planilha que vocês já utilizam.

- **Arquitetura de Dados Híbrida (Nuvem + Google Sheets)**: Sincronização principal instantânea em nuvem entre o casal (eliminando falhas de permissão do Google para clientes leigos), mantendo a integração com Google Sheets como recurso de espelhamento e auditoria em tempo real.
- **Funil de Entrada Comercial**: Landing Page de vendas integrada com proposta de valor focada em casais, botão de teste grátis de 7 dias e assistente de configuração inicial (Onboarding em 3 passos).
- **Conexão do Casal por Código ou Link de Convite**: Um parceiro cria a conta familiar e gera um código curto ou link direto de convite para vincular o celular do cônjuge ao mesmo espaço financeiro instantaneamente.
- **Escopo Prioritário do MVP**:
  1. Personalização completa dos nomes do casal (substituindo "Ele/Ela" pelos nomes reais), renda líquida mensal, contas fixas, tetos por categoria e metas do colchão.
  2. Seletor de meses (`Outubro 2026`, `Novembro 2026`, etc.) com fechamento de ciclo e virada inteligente de contas fixas.
  3. Gestão de Assinatura e Planos (Trial de 7 dias, Plano Mensal e Plano Anual com desconto).

---

## 1. Visão Geral & Conceito do Produto

- **O Que Faz**: Transforma um aplicativo de uso pessoal em um software como serviço (SaaS) onde múltiplos casais independentes podem assinar, configurar seus próprios números, vincular seus celulares sem complicações técnicas e acompanhar em tempo real para onde vai o dinheiro da casa.
- **Público-Alvo**: Casais que dividem as contas da casa, sentem que o dinheiro "some" ao longo do mês em gastos variáveis (mercado, delivery, combustível) e querem decidir juntos sem planilhas complicadas.
- **Diferencial Competitivo**: Enquanto apps tradicionais exigem categorizar centenas de centavos passados, este MVP foca no **Ritmo do Mês (Semáforo em Tempo Real)**, no **Lançamento em 4 Toques (< 10 segundos)** e no **Conselheiro Direto sem Jargões**.

---

## 2. Experiência do Usuário & Design Visual

### Fluxos Principais do Cliente

1. **Vitrine Comercial (Landing Page)**:
   - Apresentação clara da dor do casal (*"Saiba exatamente quanto vocês ainda podem gastar por dia sem brigar no fim do mês"*).
   - Demonstração interativa do Semáforo de Ritmo e do Lançamento em 10 segundos.
   - Seção transparente de preço acessível (Teste Grátis de 7 dias sem compromisso + Plano Casal Mensal/Anual).
   - Acesso rápido tanto para **Começar Teste Grátis** quanto para **Já sou assinante / Entrar**.

2. **Onboarding Guiado do Casal (3 Passos em 60 Segundos)**:
   - **Passo 1 — Quem são vocês**: Nome do Parceiro 1, Nome do Parceiro 2 (ex: *Bebeto & Esposa*) e nome da família.
   - **Passo 2 — Renda e Reserva**: Renda líquida conjunta do mês, meta mensal de poupança e meta total do Colchão de Emergência.
   - **Passo 3 — Contas Fixas e Tetos Variáveis**: Seleção rápida das contas fixas da casa e definição dos limites para Mercado, Alimentação Fora, Combustível, Farmácia e Lazer.

3. **Vínculo do Casal (Convite Instantâneo)**:
   - Painel dedicado **"Conectar Meu Par"** gerando um código único de 6 caracteres (ex: `CASAL-8492`) e um link direto de compartilhamento via WhatsApp.
   - Quando o cônjuge abre o link ou digita o código, ambos os aparelhos passam a compartilhar o mesmo espaço familiar em tempo real.

4. **Navegação Mensal & Fechamento de Ciclo**:
   - Seletor de competência no topo do Painel do Mês permitindo alternar entre meses anteriores, mês atual e planejar o próximo mês.
   - Botão **"Virar o Mês / Novo Ciclo"** que copia automaticamente a estrutura de contas fixas (desmarcando o status de "pago" para o novo mês) e preserva o saldo acumulado do Colchão de Emergência.

5. **Central de Assinatura, Configurações & Planilha**:
   - Tela de ajustes onde o casal pode editar a qualquer momento seus nomes, renda, tetos de categorias e contas fixas.
   - Visualização do status da assinatura (dias restantes do Teste Grátis de 7 dias, opção de upgrade para o Plano Casal Pro e simulação de checkout).

### Identidade Visual & Ergonomia

- **Direção Estética**: Utilitário financeiro de alta precisão com contraste escuro refinado, desenhado para uso com uma mão no celular (na fila do caixa do supermercado) e visão panorâmica limpa em telas maiores.
- **Paleta de Cores (Regra 60-30-10)**:
  - *60% Base Neutra Profunda*: Ardósia escuro (`#0A0A0A` a `#121316`) para conforto visual e economia de bateria.
  - *30% Superfícies Estruturais*: Cartões em cinza grafite (`#171717`) com divisórias sutis de `1px` (`#262626`), sem aninhamento excessivo de caixas.
  - *10% Acentos Semânticos*: Verde Esmeralda (`#10B981`) para ritmo saudável e entradas, Âmbar (`#F59E0B`) para atenção, Rosa/Carmesim (`#F43F5E`) para estouro de teto e Azul Celeste (`#38BDF8`) exclusivo para o patrimônio do Colchão.
- **Tipografia & Alinhamento Numérico**:
  - Fontes geométricas de alta legibilidade (`Plus Jakarta Sans` para títulos e navegação, `DM Sans` para leitura rápida) combinadas com numerais tabulares monoespaçados (`JetBrains Mono` / `tabular-nums`) em todos os valores monetários para alinhamento vertical perfeito.
- **Ergonomia Mobile**:
  - Áreas de toque mínimas de `44x44px` em todos os botões do teclado rápido e seletores de categoria.
  - Barra de navegação fixa inferior ocupando menos de 15% da altura da tela.

---

## 3. Decisões de Produto & Trade-Offs

- **Decisão 1: Sincronização Híbrida (Espaço Compartilhado + Google Sheets Opcional)**
  - *Abordagem Escolhida*: O estado oficial do casal é sincronizado automaticamente via código de espaço familiar compartilhado, enquanto o Google Sheets funciona como espelho sincronizado para quem gosta de abrir a planilha no computador.
  - *Por quê*: Garante que 100% dos clientes consigam usar o app juntos imediatamente após o cadastro, mesmo que um dos cônjuges não saiba configurar permissões do Google Drive.
- **Decisão 2: Rótulos Dinâmicos do Casal em Todo o App**
  - *Abordagem Escolhida*: Substituir os textos fixos `"Ele"` e `"Ela"` pelos nomes personalizados configurados pelo casal na interface (mantendo compatibilidade total com os lançamentos já existentes).
  - *Por quê*: Cria senso imediato de pertencimento e propriedade para cada casal assinante, além de atender qualquer configuração familiar.
- **Decisão 3: Isolamento por Mês de Referência (`AAAA-MM`)**
  - *Abordagem Escolhida*: Filtrar lançamentos variáveis, rendas extras e status de pagamento de contas fixas pelo mês selecionado no topo do painel, mantendo o saldo do Colchão contínuo entre os meses.
  - *Por quê*: Permite histórico real de uso contínuo para retenção de assinantes mês após mês.

---

## 4. Arquitetura Técnica & Fluxo de Dados

### Diagrama de Arquitetura do Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CAMADA DE ENTRADA & COMERCIAL                        │
│  ┌────────────────────────┐   ┌───────────────────────┐   ┌────────────┐ │
│  │ Landing Page de Vendas │──▶│ Onboarding (3 Passos) │──▶│ Trial 7d   │ │
│  └────────────────────────┘   └───────────────────────┘   └────────────┘ │
└───────────────────────────────────────────┬──────────────────────────────┘
                                            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   MOTOR DE ESTADO & ESPAÇO DO CASAL                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Perfil do Casal (Nomes Personalizados, Código de Convite, Plano)   │  │
│  └──────────────────┬─────────────────────────────────┬───────────────┘  │
│                     ▼                                 ▼                  │
│  ┌────────────────────────────────────┐   ┌───────────────────────────┐  │
│  │ Sincronização em Nuvem (Casal ID)  │   │ Espelhamento Google Sheets│  │
│  │ (Tempo real entre os 2 celulares)  │   │ (Abas: Lançamentos/Metas) │  │
│  └──────────────────┬─────────────────┘   └─────────────┬─────────────┘  │
└─────────────────────┼───────────────────────────────────┼────────────────┘
                      ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    MÓDULOS OPERACIONAIS DO APLICATIVO                    │
│  ┌───────────────────┐  ┌────────────────────┐  ┌─────────────────────┐  │
│  │ Lançamento Rápido │  │ Painel Multi-Meses │  │ Config, Tetos,      │  │
│  │ (Gasto / Renda /  │  │ (Semáforo, Fixas,  │  │ Convite do Par &    │  │
│  │  Colchão em <10s) │  │  Projeção, Reserva)│  │ Gestão de Assinatura│  │
│  └───────────────────┘  └────────────────────┘  └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Dados Expandido para SaaS

1. **Perfil e Assinatura do Casal (`PerfilCasal`)**:
   - `casal_id`: Identificador único do espaço compartilhado (ex: `CASAL-8492`).
   - `nome_parceiro_1` e `nome_parceiro_2`: Nomes personalizados exibidos nos botões de lançamento, filtros e resumos.
   - `onboarding_concluido`: Flag booleana que controla se o casal já configurou seus números iniciais.
   - `plano`: Status da assinatura (`'trial_7_dias'`, `'mensal_pro'`, `'anual_pro'`), data de início do teste e validação de recursos.
2. **Gestão Multi-Mês (`mesAtivo`)**:
   - Estado global de competência (`AAAA-MM`) que filtra dinamicamente os cálculos do motor (`calcularStatusRitmo`, `calcularProjecaoFechamento`, `calcularRitmoPorCategorias` e `gerarConselho`) para o mês em exibição.
   - Função de fechamento e abertura de mês que preserva o histórico de meses passados para consulta.
3. **Mapeamento de Componentes e Interações**:
   - **Vitrine & Onboarding**: Permite testar a demonstração ou configurar um novo casal do zero; inclui botão rápido para quem já é usuário pular direto para sua conta atual (preservando 100% dos seus dados atuais de Londrina).
   - **Editor de Orçamento e Perfil**: Interface dedicada para alterar a renda líquida, editar o teto de cada categoria variável, trocar os nomes do casal e copiar o link/código de convite para o cônjuge.
   - **Modal de Planos & Checkout Demonstrativo**: Exibe comparativo claro entre o período de avaliação gratuita e os planos pagos (ex: R$ 19,90/mês para o casal), simulando o fluxo de ativação imediata da assinatura.
