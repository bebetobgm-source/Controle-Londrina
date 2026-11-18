export type FormaPagamento = 'Pix' | 'Débito' | 'Crédito' | 'Dinheiro';
export type Quem = 'Ele' | 'Ela' | 'Conjunto';
export type SimNao = 'S' | 'N';
export type TipoOrcamento = 'Fixa' | 'Variável' | 'Meta';
export type TipoReserva = 'Aporte' | 'Retirada';
export type SeveridadeAlerta = 'verde' | 'amarelo' | 'laranja' | 'vermelho';

export interface Lancamento {
  id: string;
  data: string; // AAAA-MM-DD
  valor: number;
  categoria: string;
  subcategoria: string;
  estabelecimento?: string;
  forma_pagamento: FormaPagamento;
  quem: Quem;
  essencial: SimNao;
  observacao?: string;
  mes_ref: string; // AAAA-MM
  criado_em: string; // ISO timestamp
}

export interface RendaExtra {
  id: string;
  data: string; // AAAA-MM-DD
  valor: number;
  descricao: string; // ex: 'Toquei em casamento', 'Freelance'
  categoria: string; // 'Música & Eventos', 'Freelance & Serviços', 'Vendas & Desapegos', 'Bônus / Extra', 'Rendimentos', 'Outras Rendas'
  quem: Quem;
  forma_recebimento?: string;
  observacao?: string;
  mes_ref: string; // AAAA-MM
  criado_em: string;
}

export interface ContaFixa {
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria: string;
  ativo: SimNao;
  pago_mes_ref: string; // AAAA-MM se pago neste mês
}

export interface OrcamentoItem {
  mes_ref: string;
  categoria: string;
  teto: number;
  tipo: TipoOrcamento;
}

export interface CategoriaItem {
  categoria: string;
  subcategoria: string;
  ativo: SimNao;
}

export interface TransacaoReserva {
  id: string;
  data: string;
  valor: number;
  tipo: TipoReserva;
  motivo: string;
  saldo_acumulado: number;
}

export interface Configuracao {
  renda_liquida_mensal: number;
  dia_pagamento: number;
  meta_reserva_mensal: number;
  colchao_meta: number;
  email_1: string;
  email_2: string;
  alertas_ativos: 'SIM' | 'NAO';
  hora_resumo_diario: number;
  dia_fechamento_ciclo: string;
  webhook_n8n?: string;
  // Campos SaaS Multi-Casal
  nome_familia?: string;
  nome_parceiro_1?: string;
  nome_parceiro_2?: string;
  plano_assinatura?: 'trial' | 'mensal' | 'anual';
  data_inicio_trial?: string;
  onboarding_concluido?: boolean;
}

export interface AlertaLog {
  id: string;
  data_hora: string;
  tipo: string;
  severidade: SeveridadeAlerta;
  mensagem: string;
  lido: SimNao;
  mes_ref: string;
}

export interface StatusRitmo {
  percentual_do_mes: number;
  percentual_gasto: number;
  indice_de_ritmo: number;
  estado: 'Verde folgado' | 'Verde' | 'Amarelo' | 'Laranja' | 'Vermelho';
  cor: 'verde' | 'amarelo' | 'laranja' | 'vermelho';
  explicacao: string;
  gasto_variavel_total: number;
  teto_variavel_total: number;
  disponivel_por_dia: number;
  dias_restantes: number;
  dia_atual: number;
  total_dias_mes: number;
}

export interface CategoriaRitmo {
  categoria: string;
  teto: number;
  gasto: number;
  percentual_gasto: number;
  percentual_esperado: number;
  indice_ritmo: number;
  diferenca: number;
  alerta_individual?: string;
}

export interface Conselho {
  onde_estamos: string;
  por_que: string;
  o_que_fazer: string;
  projecao_linear: number;
  projecao_ajustada: number;
  deficit_previsto: number;
  sobra_prevista: number;
  consequencias?: {
    dias_colchao: string;
    atraso_meta: string;
    novo_teto_sugerido: {
      categoria: string;
      teto_atual: number;
      novo_teto: number;
      corte_semanal_texto: string;
    };
  };
}
