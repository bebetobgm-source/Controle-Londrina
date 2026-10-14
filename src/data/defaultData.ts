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
  webhook_n8n: ''
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
  { categoria: 'Farmácia e Saúde', subcategoria: 'Consultas', ativo: 'S' },

  // Lazer
  { categoria: 'Lazer', subcategoria: 'Passeio', ativo: 'S' },
  { categoria: 'Lazer', subcategoria: 'Delivery', ativo: 'S' },
  { categoria: 'Lazer', subcategoria: 'Assinaturas', ativo: 'S' },

  // Casa e Manutenção
  { categoria: 'Casa e Manutenção', subcategoria: 'Reparos', ativo: 'S' },
  { categoria: 'Casa e Manutenção', subcategoria: 'Utensílios', ativo: 'S' },

  // Educação
  { categoria: 'Educação', subcategoria: 'Faculdade', ativo: 'S' },
  { categoria: 'Educação', subcategoria: 'Material', ativo: 'S' },

  // Vestuário
  { categoria: 'Vestuário', subcategoria: 'Adulto', ativo: 'S' },
  { categoria: 'Vestuário', subcategoria: 'Criança', ativo: 'S' },

  // Outros
  { categoria: 'Outros', subcategoria: 'Presentes', ativo: 'S' },
  { categoria: 'Outros', subcategoria: 'Imprevistos', ativo: 'S' }
];

export const ORCAMENTO_PADRAO: OrcamentoItem[] = [
  { mes_ref: 'atual', categoria: 'Mercado', teto: 1200, tipo: 'Variável' },
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
  'Muffato Duque',
  'Musamar Centro',
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
  'Delivery': [60.00, 55.00, 70.00, 65.00, 50.00]
};
