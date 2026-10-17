import {
  Lancamento,
  RendaExtra,
  ContaFixa,
  OrcamentoItem,
  CategoriaItem,
  TransacaoReserva,
  Configuracao,
  AlertaLog,
  Quem
} from '../types';
import {
  CONFIG_PADRAO,
  FIXAS_PADRAO,
  CATEGORIAS_PADRAO,
  ORCAMENTO_PADRAO,
  RESERVA_INICIAL,
  LANCAMENTOS_INICIAIS
} from '../data/defaultData';
import { avaliarAlertas } from './engine';

const STORAGE_KEYS = {
  LANCAMENTOS: 'orcamento_londrina_lancamentos_v1',
  RENDAS_EXTRAS: 'orcamento_londrina_rendas_extras_v1',
  FIXAS: 'orcamento_londrina_fixas_v1',
  ORCAMENTO: 'orcamento_londrina_orcamento_v1',
  CATEGORIAS: 'orcamento_londrina_categorias_v1',
  RESERVA: 'orcamento_londrina_reserva_v1',
  CONFIG: 'orcamento_londrina_config_v1',
  ALERTAS_LOG: 'orcamento_londrina_alertas_log_v1',
  ULTIMO_QUEM: 'orcamento_londrina_ultimo_quem_v1',
  SIMULACAO_DIA: 'orcamento_londrina_simulacao_dia_v1'
};

export interface AppState {
  lancamentos: Lancamento[];
  rendasExtras: RendaExtra[];
  fixas: ContaFixa[];
  orcamento: OrcamentoItem[];
  categorias: CategoriaItem[];
  reserva: TransacaoReserva[];
  config: Configuracao;
  alertasLog: AlertaLog[];
  ultimoQuem: Quem;
  diaAtualSimulado: number | null; // se null, usa Date.now().getDate()
}

export function carregarEstado(): AppState {
  try {
    const rawLancamentos = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS);
    const rawRendasExtras = localStorage.getItem(STORAGE_KEYS.RENDAS_EXTRAS);
    const rawFixas = localStorage.getItem(STORAGE_KEYS.FIXAS);
    const rawOrcamento = localStorage.getItem(STORAGE_KEYS.ORCAMENTO);
    const rawCategorias = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
    const rawReserva = localStorage.getItem(STORAGE_KEYS.RESERVA);
    const rawConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const rawAlertas = localStorage.getItem(STORAGE_KEYS.ALERTAS_LOG);
    const rawQuem = localStorage.getItem(STORAGE_KEYS.ULTIMO_QUEM) as Quem | null;
    const rawDia = localStorage.getItem(STORAGE_KEYS.SIMULACAO_DIA);

    const lancamentos = rawLancamentos ? JSON.parse(rawLancamentos) : [...LANCAMENTOS_INICIAIS];
    const rendasExtras = rawRendasExtras ? JSON.parse(rawRendasExtras) : [];
    const fixas = rawFixas ? JSON.parse(rawFixas) : [...FIXAS_PADRAO];
    let orcamento = rawOrcamento ? JSON.parse(rawOrcamento) : [...ORCAMENTO_PADRAO];
    let categorias = rawCategorias ? JSON.parse(rawCategorias) : [...CATEGORIAS_PADRAO];

    // Garantir que Alimentação Fora esteja presente mesmo para quem já abriu o app antes
    if (!categorias.some((c: any) => c.categoria === 'Alimentação Fora')) {
      const novas = CATEGORIAS_PADRAO.filter(c => c.categoria === 'Alimentação Fora');
      categorias = [...novas, ...categorias];
      localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(categorias));
    }
    if (!orcamento.some((o: any) => o.categoria === 'Alimentação Fora')) {
      orcamento = [
        ...orcamento,
        { mes_ref: 'atual', categoria: 'Alimentação Fora', teto: 250, tipo: 'Variável' }
      ];
      localStorage.setItem(STORAGE_KEYS.ORCAMENTO, JSON.stringify(orcamento));
    }

    const reserva = rawReserva ? JSON.parse(rawReserva) : [...RESERVA_INICIAL];
    const config = rawConfig ? JSON.parse(rawConfig) : { ...CONFIG_PADRAO };
    const alertasLog = rawAlertas ? JSON.parse(rawAlertas) : [];
    const ultimoQuem = rawQuem || 'Ele';
    const diaAtualSimulado = rawDia ? parseInt(rawDia, 10) : null;

    return {
      lancamentos,
      rendasExtras,
      fixas,
      orcamento,
      categorias,
      reserva,
      config,
      alertasLog,
      ultimoQuem,
      diaAtualSimulado
    };
  } catch (err) {
    console.error('Erro ao ler do storage local:', err);
    return {
      lancamentos: [...LANCAMENTOS_INICIAIS],
      rendasExtras: [],
      fixas: [...FIXAS_PADRAO],
      orcamento: [...ORCAMENTO_PADRAO],
      categorias: [...CATEGORIAS_PADRAO],
      reserva: [...RESERVA_INICIAL],
      config: { ...CONFIG_PADRAO },
      alertasLog: [],
      ultimoQuem: 'Ele',
      diaAtualSimulado: null
    };
  }
}

export function salvarEstado(estado: Partial<AppState>) {
  try {
    if (estado.lancamentos !== undefined) {
      localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(estado.lancamentos));
    }
    if (estado.rendasExtras !== undefined) {
      localStorage.setItem(STORAGE_KEYS.RENDAS_EXTRAS, JSON.stringify(estado.rendasExtras));
    }
    if (estado.fixas !== undefined) {
      localStorage.setItem(STORAGE_KEYS.FIXAS, JSON.stringify(estado.fixas));
    }
    if (estado.orcamento !== undefined) {
      localStorage.setItem(STORAGE_KEYS.ORCAMENTO, JSON.stringify(estado.orcamento));
    }
    if (estado.categorias !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(estado.categorias));
    }
    if (estado.reserva !== undefined) {
      localStorage.setItem(STORAGE_KEYS.RESERVA, JSON.stringify(estado.reserva));
    }
    if (estado.config !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(estado.config));
    }
    if (estado.alertasLog !== undefined) {
      localStorage.setItem(STORAGE_KEYS.ALERTAS_LOG, JSON.stringify(estado.alertasLog));
    }
    if (estado.ultimoQuem !== undefined) {
      localStorage.setItem(STORAGE_KEYS.ULTIMO_QUEM, estado.ultimoQuem);
    }
    if (estado.diaAtualSimulado !== undefined) {
      if (estado.diaAtualSimulado === null) {
        localStorage.removeItem(STORAGE_KEYS.SIMULACAO_DIA);
      } else {
        localStorage.setItem(STORAGE_KEYS.SIMULACAO_DIA, String(estado.diaAtualSimulado));
      }
    }
  } catch (err) {
    console.error('Erro ao salvar no storage local:', err);
  }
}

export function registrarLancamento(
  novo: Omit<Lancamento, 'id' | 'mes_ref' | 'criado_em'>,
  estadoAtual: AppState
): { estadoAtualizado: AppState; novoId: string; alertasDisparados: AlertaLog[] } {
  const agora = new Date();
  const id = `lan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const mesRef = novo.data ? novo.data.substring(0, 7) : `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  
  const lancamentoCompleto: Lancamento = {
    ...novo,
    id,
    mes_ref: mesRef,
    criado_em: agora.toISOString()
  };

  const novosLancamentos = [lancamentoCompleto, ...estadoAtual.lancamentos];
  
  // Avaliar alertas com o novo lançamento
  const diaAvaliacao = estadoAtual.diaAtualSimulado || agora.getDate();
  const alertas = avaliarAlertas(
    novosLancamentos,
    estadoAtual.orcamento,
    estadoAtual.fixas,
    estadoAtual.config,
    estadoAtual.reserva,
    diaAvaliacao,
    undefined,
    lancamentoCompleto,
    estadoAtual.rendasExtras
  );

  // Aba Alertas_Log: Nunca sobrescreva, sempre acrescente
  const alertasAtualizados = [...alertas, ...estadoAtual.alertasLog];

  const novoEstado: AppState = {
    ...estadoAtual,
    lancamentos: novosLancamentos,
    alertasLog: alertasAtualizados,
    ultimoQuem: novo.quem
  };

  salvarEstado(novoEstado);
  return { estadoAtualizado: novoEstado, novoId: id, alertasDisparados: alertas };
}

export function excluirLancamento(id: string, estadoAtual: AppState): AppState {
  const filtrados = estadoAtual.lancamentos.filter(l => l.id !== id);
  const novoEstado = { ...estadoAtual, lancamentos: filtrados };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function limparLancamentosDeExemplo(estadoAtual: AppState): AppState {
  const idsExemplo = new Set(['lan-1', 'lan-2', 'lan-3', 'lan-4']);
  const nomesExemplo = [
    'muffato duque',
    'posto ipiranga',
    'feira do produtor',
    'droga raia',
    'compra grande do inicio do mes',
    'antissensibilizante crianca'
  ];

  const filtrados = estadoAtual.lancamentos.filter(l => {
    if (idsExemplo.has(l.id)) return false;
    const est = (l.estabelecimento || '').toLowerCase();
    const obs = (l.observacao || '').toLowerCase();
    if (nomesExemplo.some(termo => est.includes(termo) || obs.includes(termo))) {
      return false;
    }
    return true;
  });

  const novoEstado = { ...estadoAtual, lancamentos: filtrados };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function limparTodosLancamentos(estadoAtual: AppState): AppState {
  const novoEstado = { ...estadoAtual, lancamentos: [] };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function alternarStatusContaFixa(descricao: string, estadoAtual: AppState): AppState {
  const agora = new Date();
  const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const novasFixas = estadoAtual.fixas.map(f => {
    if (f.descricao === descricao) {
      const novoPago = f.pago_mes_ref === mesRefAtual ? '' : mesRefAtual;
      return { ...f, pago_mes_ref: novoPago };
    }
    return f;
  });

  const novoEstado = { ...estadoAtual, fixas: novasFixas };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function atualizarContaFixa(
  descricaoOriginal: string,
  dadosAtualizados: Partial<ContaFixa>,
  estadoAtual: AppState
): AppState {
  const novasFixas = estadoAtual.fixas.map(f => {
    if (f.descricao === descricaoOriginal) {
      return { ...f, ...dadosAtualizados };
    }
    return f;
  });
  const novoEstado = { ...estadoAtual, fixas: novasFixas };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function adicionarContaFixa(
  novaConta: ContaFixa,
  estadoAtual: AppState
): AppState {
  const filtradas = estadoAtual.fixas.filter(f => f.descricao.toLowerCase() !== novaConta.descricao.toLowerCase());
  const novasFixas = [...filtradas, novaConta];
  const novoEstado = { ...estadoAtual, fixas: novasFixas };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function excluirContaFixa(
  descricao: string,
  estadoAtual: AppState
): AppState {
  const novasFixas = estadoAtual.fixas.filter(f => f.descricao !== descricao);
  const novoEstado = { ...estadoAtual, fixas: novasFixas };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function registrarRendaExtra(
  dados: Omit<RendaExtra, 'id' | 'mes_ref' | 'criado_em'>,
  estadoAtual: AppState
): { estadoAtualizado: AppState; novoId: string } {
  const agora = new Date();
  const mesRefAtual = dados.data
    ? dados.data.substring(0, 7)
    : `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const novoId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const novaRenda: RendaExtra = {
    ...dados,
    id: novoId,
    mes_ref: mesRefAtual,
    criado_em: agora.toISOString()
  };

  const novasRendas = [novaRenda, ...(estadoAtual.rendasExtras || [])];
  const novoEstado = {
    ...estadoAtual,
    rendasExtras: novasRendas,
    ultimoQuem: dados.quem
  };

  salvarEstado(novoEstado);
  return { estadoAtualizado: novoEstado, novoId };
}

export function excluirRendaExtra(
  id: string,
  estadoAtual: AppState
): AppState {
  const filtradas = (estadoAtual.rendasExtras || []).filter(r => r.id !== id);
  const novoEstado = { ...estadoAtual, rendasExtras: filtradas };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function atualizarTetoOrcamento(categoria: string, novoTeto: number, estadoAtual: AppState): AppState {
  const novoOrcamento = estadoAtual.orcamento.map(item => {
    if (item.categoria === categoria) {
      return { ...item, teto: novoTeto };
    }
    return item;
  });

  const novoEstado = { ...estadoAtual, orcamento: novoOrcamento };
  salvarEstado(novoEstado);
  return novoEstado;
}

/**
 * Registra um novo aporte ou retirada na Reserva / Colchão
 */
export function registrarAporteReserva(
  dados: {
    valor: number;
    motivo: string;
    tipo?: 'Aporte' | 'Retirada';
    data?: string;
  },
  estadoAtual: AppState
): { estadoAtualizado: AppState; novaTransacao: TransacaoReserva } {
  const agora = new Date();
  const dataHoje = dados.data || agora.toISOString().split('T')[0];
  const tipo = dados.tipo || 'Aporte';
  const valor = Math.abs(dados.valor);

  const saldoAnterior = estadoAtual.reserva && estadoAtual.reserva.length > 0
    ? estadoAtual.reserva[estadoAtual.reserva.length - 1].saldo_acumulado
    : 2000;

  const novoSaldo = tipo === 'Aporte' ? saldoAnterior + valor : Math.max(0, saldoAnterior - valor);

  const novaTransacao: TransacaoReserva = {
    id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    data: dataHoje,
    valor,
    tipo,
    motivo: dados.motivo.trim() || (tipo === 'Aporte' ? 'Aporte na Reserva' : 'Retirada da Reserva'),
    saldo_acumulado: novoSaldo
  };

  const novaReserva = [...(estadoAtual.reserva || []), novaTransacao];
  const estadoAtualizado: AppState = {
    ...estadoAtual,
    reserva: novaReserva
  };

  salvarEstado(estadoAtualizado);
  return { estadoAtualizado, novaTransacao };
}

/**
 * Exclui um lançamento da reserva e recalcula o saldo acumulado
 */
export function excluirTransacaoReserva(id: string, estadoAtual: AppState): AppState {
  const filtradas = (estadoAtual.reserva || []).filter(r => r.id !== id);
  let saldo = 0;
  const recalculadas = filtradas.map(r => {
    saldo += r.tipo === 'Aporte' ? r.valor : -r.valor;
    return { ...r, saldo_acumulado: Math.max(0, saldo) };
  });

  const novoEstado: AppState = {
    ...estadoAtual,
    reserva: recalculadas
  };
  salvarEstado(novoEstado);
  return novoEstado;
}

/**
 * Ajusta diretamente o saldo total do colchão (ex: dinheiro investido em outra conta / CDB D+30)
 */
export function ajustarSaldoColchao(
  novoSaldoDesejado: number,
  motivoAjuste: string,
  estadoAtual: AppState
): { estadoAtualizado: AppState; transacaoAjuste: TransacaoReserva } {
  const agora = new Date();
  const dataHoje = agora.toISOString().split('T')[0];
  const saldoAnterior = estadoAtual.reserva && estadoAtual.reserva.length > 0
    ? estadoAtual.reserva[estadoAtual.reserva.length - 1].saldo_acumulado
    : 2000;

  const diferenca = novoSaldoDesejado - saldoAnterior;
  const tipo = diferenca >= 0 ? 'Aporte' : 'Retirada';
  const valorAbs = Math.abs(diferenca);

  const transacaoAjuste: TransacaoReserva = {
    id: `res-ajuste-${Date.now()}`,
    data: dataHoje,
    valor: valorAbs,
    tipo,
    motivo: motivoAjuste.trim() || 'Ajuste de Saldo do Colchão',
    saldo_acumulado: novoSaldoDesejado
  };

  const novaReserva = [...(estadoAtual.reserva || []), transacaoAjuste];
  const estadoAtualizado: AppState = {
    ...estadoAtual,
    reserva: novaReserva
  };

  salvarEstado(estadoAtualizado);
  return { estadoAtualizado, transacaoAjuste };
}

export function resetarParaDadosPadrao(): AppState {
  const estado: AppState = {
    lancamentos: [...LANCAMENTOS_INICIAIS],
    rendasExtras: [],
    fixas: [...FIXAS_PADRAO],
    orcamento: [...ORCAMENTO_PADRAO],
    categorias: [...CATEGORIAS_PADRAO],
    reserva: [...RESERVA_INICIAL],
    config: { ...CONFIG_PADRAO },
    alertasLog: [],
    ultimoQuem: 'Ele',
    diaAtualSimulado: null
  };
  salvarEstado(estado);
  return estado;
}

// -------------------------------------------------------------
// CENÁRIOS DE TESTE PREPARADOS PARA OS CRITÉRIOS DE ACEITAÇÃO
// -------------------------------------------------------------

// Cenário de Teste 1: Duplo desvio no Dia 15 (70% gasto, reserva R$ 0)
export function aplicarCenarioDia15(estadoAtual: AppState): AppState {
  const agora = new Date();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  
  // Tetos variáveis somam 1750 (Mercado 1200, Combustível 300, Farmácia 150, Lazer 100)
  // 70% de 1750 = 1225 gastos até o dia 15
  const lancamentosDia15: Lancamento[] = [
    {
      id: 'test-dia15-1',
      data: `${mesRef}-02`,
      valor: 750,
      categoria: 'Mercado',
      subcategoria: 'Alimentos',
      estabelecimento: 'Muffato Duque',
      forma_pagamento: 'Débito',
      quem: 'Conjunto',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-02T10:00:00Z`
    },
    {
      id: 'test-dia15-2',
      data: `${mesRef}-08`,
      valor: 240,
      categoria: 'Combustível',
      subcategoria: 'Gasolina',
      estabelecimento: 'Posto Shell Tiradentes',
      forma_pagamento: 'Débito',
      quem: 'Ele',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-08T15:00:00Z`
    },
    {
      id: 'test-dia15-3',
      data: `${mesRef}-12`,
      valor: 145,
      categoria: 'Mercado',
      subcategoria: 'Hortifrúti Semanal',
      estabelecimento: 'Feira do Produtor',
      forma_pagamento: 'Pix',
      quem: 'Ela',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-12T11:00:00Z`
    },
    {
      id: 'test-dia15-4',
      data: `${mesRef}-14`,
      valor: 90,
      categoria: 'Lazer',
      subcategoria: 'Delivery',
      estabelecimento: 'Pizzaria Londrina',
      forma_pagamento: 'Pix',
      quem: 'Conjunto',
      essencial: 'N',
      mes_ref: mesRef,
      criado_em: `${mesRef}-14T20:00:00Z`
    }
  ]; // Total = 1225 (exatamente 70% de 1750)

  // Reserva zerada no mês (nenhum aporte com o mês atual)
  const reservaSemAporte = estadoAtual.reserva.filter(r => !r.data.startsWith(mesRef));

  const estadoComDia15: AppState = {
    ...estadoAtual,
    lancamentos: lancamentosDia15,
    reserva: reservaSemAporte,
    diaAtualSimulado: 15
  };

  const alertas = avaliarAlertas(
    lancamentosDia15,
    estadoComDia15.orcamento,
    estadoComDia15.fixas,
    estadoComDia15.config,
    estadoComDia15.reserva,
    15
  );

  estadoComDia15.alertasLog = alertas;
  salvarEstado(estadoComDia15);
  return estadoComDia15;
}

// Cenário de Teste 2: Lançamento de R$ 91,88 em Higiene (teto 150)
export const carregarEstadoInicial = carregarEstado;

export function aplicarCenarioHigiene91(estadoAtual: AppState): { estadoAtualizado: AppState; alertas: AlertaLog[] } {
  const agora = new Date();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  
  const novo: Omit<Lancamento, 'id' | 'mes_ref' | 'criado_em'> = {
    data: `${mesRef}-10`,
    valor: 91.88,
    categoria: 'Mercado',
    subcategoria: 'Higiene',
    estabelecimento: 'Droga Raia Ayrton Senna',
    forma_pagamento: 'Débito',
    quem: 'Ela',
    essencial: 'S',
    observacao: 'Fraldas e produtos de higiene'
  };

  const res = registrarLancamento(novo, estadoAtual);
  return { estadoAtualizado: res.estadoAtualizado, alertas: res.alertasDisparados };
}

// Cenário de Teste 3: 5ª compra de mercado (voltinhas ao mercado)
export function aplicarCenarioVoltinhasMercado(estadoAtual: AppState): AppState {
  const agora = new Date();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  
  const comprasCinco: Lancamento[] = [
    {
      id: 'vol-1',
      data: `${mesRef}-02`,
      valor: 450,
      categoria: 'Mercado',
      subcategoria: 'Alimentos',
      estabelecimento: 'Muffato Duque',
      forma_pagamento: 'Débito',
      quem: 'Conjunto',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-02T10:00:00Z`
    },
    {
      id: 'vol-2',
      data: `${mesRef}-05`,
      valor: 45,
      categoria: 'Mercado',
      subcategoria: 'Padaria',
      estabelecimento: 'Panificadora Londrina',
      forma_pagamento: 'Pix',
      quem: 'Ele',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-05T18:00:00Z`
    },
    {
      id: 'vol-3',
      data: `${mesRef}-08`,
      valor: 68,
      categoria: 'Mercado',
      subcategoria: 'Hortifrúti Semanal',
      estabelecimento: 'Feira do Produtor',
      forma_pagamento: 'Pix',
      quem: 'Ela',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-08T10:00:00Z`
    },
    {
      id: 'vol-4',
      data: `${mesRef}-11`,
      valor: 52,
      categoria: 'Mercado',
      subcategoria: 'Padaria',
      estabelecimento: 'Musamar Centro',
      forma_pagamento: 'Débito',
      quem: 'Ele',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-11T19:00:00Z`
    },
    {
      id: 'vol-5',
      data: `${mesRef}-13`,
      valor: 74,
      categoria: 'Mercado',
      subcategoria: 'Carnes',
      estabelecimento: 'Açougue Boi de Ouro',
      forma_pagamento: 'Débito',
      quem: 'Conjunto',
      essencial: 'S',
      mes_ref: mesRef,
      criado_em: `${mesRef}-13T11:00:00Z`
    }
  ];

  const outrosLancamentos = estadoAtual.lancamentos.filter(l => l.categoria !== 'Mercado');
  const todos = [...comprasCinco, ...outrosLancamentos];

  const novoEstado: AppState = {
    ...estadoAtual,
    lancamentos: todos
  };

  const alertas = avaliarAlertas(
    todos,
    novoEstado.orcamento,
    novoEstado.fixas,
    novoEstado.config,
    novoEstado.reserva,
    estadoAtual.diaAtualSimulado || agora.getDate()
  );

  novoEstado.alertasLog = alertas;
  salvarEstado(novoEstado);
  return novoEstado;
}
