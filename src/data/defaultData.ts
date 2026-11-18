import {
  ContaFixa,
  OrcamentoItem,
  CategoriaItem,
  TransacaoReserva,
  Configuracao,
  Lancamento,
  AlertaLog
} from '../types';

export const CONFIG_PADRAO: Configuracao = {
  renda_liquida_mensal: 6500,
  dia_pagamento: 5,
  meta_reserva_mensal: 200,
  colchao_meta: 4600,
  email_1: 'marido@exemplo.com',
  email_2: 'esposa@exemplo.com',
  alertas_ativos: 'SIM',
  hora_resumo_diario: 20,
  dia_fechamento_ciclo: 'ultimo',
  webhook_n8n: '',
  nome_familia: 'Família Londrina',
  nome_parceiro_1: 'Ele',
  nome_parceiro_2: 'Ela',
  plano_assinatura: 'trial',
  data_inicio_trial: new Date().toISOString().split('T')[0],
  onboarding_concluido: true
};

export const FIXAS_PADRAO: ContaFixa[] = [
  { descricao: 'Aluguel', valor: 2100, dia_vencimento: 10, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Condomínio', valor: 400, dia_vencimento: 10, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Carro', valor: 1500, dia_vencimento: 15, categoria: 'Outros', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Faculdade', valor: 211, dia_vencimento: 10, categoria: 'Educação', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Água (Sanepar)', valor: 80, dia_vencimento: 15, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Gás', valor: 100, dia_vencimento: 20, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Internet', valor: 120, dia_vencimento: 15, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' },
  { descricao: 'Luz (Copel)', valor: 150, dia_vencimento: 15, categoria: 'Casa e Manutenção', ativo: 'S', pago_mes_ref: '' }
];

export const CATEGORIAS_PADRAO: CategoriaItem[] = [
  // Alimentação Fora (Lanches, Restaurantes, Delivery)
  { categoria: 'Alimentação Fora', subcategoria: 'Lanches e Pastel', ativo: 'S' },
  { categoria: 'Alimentação Fora', subcategoria: 'Restaurante e Almoço', ativo: 'S' },
  { categoria: 'Alimentação Fora', subcategoria: 'Delivery e iFood', ativo: 'S' },
  { categoria: 'Alimentação Fora', subcategoria: 'Café e Padaria', ativo: 'S' },

  // Mercado
  { categoria: 'Mercado', subcategoria: 'Alimentos', ativo: 'S' },
  { categoria: 'Mercado', subcategoria: 'Limpeza', ativo: 'S' },
  { categoria: 'Mercado', subcategoria: 'Higiene', ativo: 'S' },
  { categoria: 'Mercado', subcategoria: 'Hortifrúti Semanal', ativo: 'S' },
  { categoria: 'Mercado', subcategoria: 'Padaria', ativo: 'S' },
  { categoria: 'Mercado', subcategoria: 'Carnes', ativo: 'S' },

  // Combustível
  { categoria: 'Combustível', subcategoria: 'Gasolina', ativo: 'S' },
  { categoria: 'Combustível', subcategoria: 'Estacionamento', ativo: 'S' },

  // Farmácia e Saúde
  { categoria: 'Farmácia e Saúde', subcategoria: 'Medicamentos', ativo: 'S' },
  { categoria: 'Farmácia e Saúde', subcategoria: 'Consultas e Exames', ativo: 'S' },
  { categoria: 'Farmácia e Saúde', subcategoria: 'Higiene e Cuidados', ativo: 'S' },
  { categoria: 'Farmácia e Saúde', subcategoria: 'Academia', ativo: 'S' },

  // Combustível
  { categoria: 'Combustível', subcategoria: 'Gasolina', ativo: 'S' },
  { categoria: 'Combustível', subcategoria: 'Etanol', ativo: 'S' },
  { categoria: 'Combustível', subcategoria: 'Estacionamento', ativo: 'S' },
  { categoria: 'Combustível', subcategoria: 'Lavagem', ativo: 'S' },

  // Lazer
  { categoria: 'Lazer', subcategoria: 'Passeio e Cinema', ativo: 'S' },
  { categoria: 'Lazer', subcategoria: 'Bares e Petiscos', ativo: 'S' },
  { categoria: 'Lazer', subcategoria: 'Assinaturas e Streaming', ativo: 'S' },
  { categoria: 'Lazer', subcategoria: 'Viagem', ativo: 'S' },

  // Casa e Manutenção
  { categoria: 'Casa e Manutenção', subcategoria: 'Reparos e Consertos', ativo: 'S' },
  { categoria: 'Casa e Manutenção', subcategoria: 'Utensílios', ativo: 'S' },
  { categoria: 'Casa e Manutenção', subcategoria: 'Faxina e Diarista', ativo: 'S' },

  // Educação
  { categoria: 'Educação', subcategoria: 'Faculdade e Cursos', ativo: 'S' },
  { categoria: 'Educação', subcategoria: 'Material e Livros', ativo: 'S' },

  // Vestuário
  { categoria: 'Vestuário', subcategoria: 'Roupas', ativo: 'S' },
  { categoria: 'Vestuário', subcategoria: 'Calçados', ativo: 'S' },

  // Outros
  { categoria: 'Outros', subcategoria: 'Pet Shop e Veterinário', ativo: 'S' },
  { categoria: 'Outros', subcategoria: 'Presentes', ativo: 'S' },
  { categoria: 'Outros', subcategoria: 'Imprevistos', ativo: 'S' }
];

export const CATEGORIAS_RENDA_EXTRA = [
  { id: 'musica', nome: 'Música & Eventos', icon: 'Music' },
  { id: 'freelance', nome: 'Freelance & Serviços', icon: 'Briefcase' },
  { id: 'vendas', nome: 'Vendas & Desapegos', icon: 'Tag' },
  { id: 'bonus', nome: 'Bônus & Gratificação', icon: 'Award' },
  { id: 'rendimentos', nome: 'Rendimentos & Dividendos', icon: 'TrendingUp' },
  { id: 'outros', nome: 'Outras Rendas Extras', icon: 'Coins' }
];

export const SUGESTOES_RENDA_EXTRA = [
  'Toquei em casamento',
  'Show / Apresentação musical',
  'Trabalho freelance',
  'Venda de desapego / usado',
  'Consultoria / Aula particular',
  'Bônus / Hora extra',
  'Reembolso recebido'
];

export const ORCAMENTO_PADRAO: OrcamentoItem[] = [
  { mes_ref: 'atual', categoria: 'Mercado', teto: 1200, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Alimentação Fora', teto: 250, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Combustível', teto: 300, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Farmácia e Saúde', teto: 150, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Lazer', teto: 100, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Casa e Manutenção', teto: 0, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Educação', teto: 0, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Vestuário', teto: 0, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Outros', teto: 0, tipo: 'Variável' },
  { mes_ref: 'atual', categoria: 'Reserva', teto: 200, tipo: 'Meta' }
];

export const RESERVA_INICIAL: TransacaoReserva[] = [
  {
    id: 'res-init-1',
    data: '2026-09-01',
    valor: 2000,
    tipo: 'Aporte',
    motivo: 'Colchão de setembro',
    saldo_acumulado: 2000
  }
];

// Estabelecimentos comuns para autocomplete rápido
export const ESTABELECIMENTOS_SUGERIDOS = [
  'Arnaldo Lanches',
  'Muffato Duque',
  'Musamar Centro',
  'Viscardi',
  'Angeloni',
  'Posto Ipiranga Higienópolis',
  'Posto Shell Tiradentes',
  'Droga Raia Ayrton Senna',
  'Nissei Maringá',
  'Panificadora Londrina',
  'Feira do Produtor',
  'Açougue Boi de Ouro'
];

// Dados iniciais representativos para o casal
export const LANCAMENTOS_INICIAIS: Lancamento[] = [
  {
    id: 'lan-1',
    data: '2026-09-02',
    valor: 420.50,
    categoria: 'Mercado',
    subcategoria: 'Alimentos',
    estabelecimento: 'Muffato Duque',
    forma_pagamento: 'Débito',
    quem: 'Conjunto',
    essencial: 'S',
    observacao: 'Compra grande do início do mês',
    mes_ref: '2026-09',
    criado_em: '2026-09-02T10:30:00Z'
  },
  {
    id: 'lan-2',
    data: '2026-09-05',
    valor: 150.00,
    categoria: 'Combustível',
    subcategoria: 'Gasolina',
    estabelecimento: 'Posto Ipiranga Higienópolis',
    forma_pagamento: 'Débito',
    quem: 'Ele',
    essencial: 'S',
    observacao: '',
    mes_ref: '2026-09',
    criado_em: '2026-09-05T08:15:00Z'
  },
  {
    id: 'lan-3',
    data: '2026-09-07',
    valor: 64.20,
    categoria: 'Mercado',
    subcategoria: 'Hortifrúti Semanal',
    estabelecimento: 'Feira do Produtor',
    forma_pagamento: 'Pix',
    quem: 'Ela',
    essencial: 'S',
    observacao: '',
    mes_ref: '2026-09',
    criado_em: '2026-09-07T11:00:00Z'
  },
  {
    id: 'lan-4',
    data: '2026-09-08',
    valor: 45.00,
    categoria: 'Farmácia e Saúde',
    subcategoria: 'Medicamentos',
    estabelecimento: 'Droga Raia Ayrton Senna',
    forma_pagamento: 'Crédito',
    quem: 'Ela',
    essencial: 'S',
    observacao: 'Antialérgico criança',
    mes_ref: '2026-09',
    criado_em: '2026-09-08T18:20:00Z'
  }
];

export const HISTORICO_SUBCATEGORIAS_MEDIANA: Record<string, number[]> = {
  'Higiene': [28.50, 32.00, 35.00, 38.00, 36.50], // Média ~34, mediana 35
  'Alimentos': [120.00, 150.00, 95.00, 110.00, 140.00],
  'Hortifrúti Semanal': [55.00, 60.00, 50.00, 65.00, 58.00],
  'Gasolina': [150.00, 140.00, 160.00, 150.00, 155.00],
  'Medicamentos': [40.00, 45.00, 50.00, 35.00, 42.00],
  'Delivery': [60.00, 55.00, 70.00, 65.00, 50.00],
  'Lanches e Pastel': [45.00, 50.00, 65.00, 70.00, 75.00],
  'Restaurante e Almoço': [60.00, 80.00, 75.00, 90.00, 70.00]
};
