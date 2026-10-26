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
  SIMULACAO_DIA: 'orcamento_londrina_simulacao_dia_v1',
  MES_ATIVO: 'orcamento_londrina_mes_ativo_v1',
  CLOUD_CASAL_PREFIX: 'orcamento_saas_casal_v1_'
};

export function obterMesAtualPadrao(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

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
  mesAtivo: string; // AAAA-MM
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
    const rawMesAtivo = localStorage.getItem(STORAGE_KEYS.MES_ATIVO);

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
    const parsedConfig = rawConfig ? JSON.parse(rawConfig) : {};
    const config: Configuracao = {
      ...CONFIG_PADRAO,
      ...parsedConfig,
      nome_familia: parsedConfig.nome_familia || CONFIG_PADRAO.nome_familia || 'Família Londrina',
      nome_parceiro_1: parsedConfig.nome_parceiro_1 || CONFIG_PADRAO.nome_parceiro_1 || 'Ele',
      nome_parceiro_2: parsedConfig.nome_parceiro_2 || CONFIG_PADRAO.nome_parceiro_2 || 'Ela',
      codigo_casal: parsedConfig.codigo_casal || CONFIG_PADRAO.codigo_casal || 'CASAL-8492',
      plano_assinatura: parsedConfig.plano_assinatura || 'trial',
      data_inicio_trial: parsedConfig.data_inicio_trial || new Date().toISOString().split('T')[0],
      onboarding_concluido: parsedConfig.onboarding_concluido ?? true
    };
    const alertasLog = rawAlertas ? JSON.parse(rawAlertas) : [];
    const ultimoQuem = rawQuem || 'Ele';
    const diaAtualSimulado = rawDia ? parseInt(rawDia, 10) : null;
    const mesAtivo = rawMesAtivo || obterMesAtualPadrao();

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
      diaAtualSimulado,
      mesAtivo
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
      diaAtualSimulado: null,
      mesAtivo: obterMesAtualPadrao()
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
    if (estado.mesAtivo !== undefined) {
      localStorage.setItem(STORAGE_KEYS.MES_ATIVO, estado.mesAtivo);
    }

    // Espelhar no snapshot por código do casal para permitir vínculo imediato por código/link
    const codigo = estado.config?.codigo_casal || JSON.parse(localStorage.getItem(STORAGE_KEYS.CONFIG) || '{}')?.codigo_casal;
    if (codigo) {
      try {
        const snapshotAtual = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLOUD_CASAL_PREFIX + codigo) || '{}');
        const novoSnapshot = {
          ...snapshotAtual,
          ...(estado.lancamentos !== undefined ? { lancamentos: estado.lancamentos } : {}),
          ...(estado.rendasExtras !== undefined ? { rendasExtras: estado.rendasExtras } : {}),
          ...(estado.fixas !== undefined ? { fixas: estado.fixas } : {}),
          ...(estado.orcamento !== undefined ? { orcamento: estado.orcamento } : {}),
          ...(estado.reserva !== undefined ? { reserva: estado.reserva } : {}),
          ...(estado.config !== undefined ? { config: estado.config } : {}),
          atualizadoEm: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEYS.CLOUD_CASAL_PREFIX + codigo, JSON.stringify(novoSnapshot));
      } catch {
        // Ignora erro de cota
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
  const mesRef = estadoAtual.mesAtivo || (novo.data ? novo.data.substring(0, 7) : obterMesAtualPadrao());
  
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
  const mesRefAtual = estadoAtual.mesAtivo || obterMesAtualPadrao();

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
  const mesRefAtual = estadoAtual.mesAtivo || (dados.data
    ? dados.data.substring(0, 7)
    : obterMesAtualPadrao());

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
    diaAtualSimulado: null,
    mesAtivo: obterMesAtualPadrao()
  };
  salvarEstado(estado);
  return estado;
}

// -------------------------------------------------------------
// FUNÇÕES SAAS MULTI-CASAL, MULTI-MÊS E PERSONALIZAÇÃO
// -------------------------------------------------------------

export function obterRotuloQuem(quem: Quem, config?: Configuracao): string {
  if (quem === 'Ele') return config?.nome_parceiro_1?.trim() || 'Ele';
  if (quem === 'Ela') return config?.nome_parceiro_2?.trim() || 'Ela';
  return 'Casal';
}

const NOMES_MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NOMES_MESES_COMPLETOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function formatarMesExibicao(mesRef: string, curto = true): string {
  if (!mesRef || !mesRef.includes('-')) return mesRef;
  const [ano, mesStr] = mesRef.split('-');
  const idx = Math.max(0, Math.min(11, parseInt(mesStr, 10) - 1));
  return curto ? `${NOMES_MESES_CURTOS[idx]}/${ano}` : `${NOMES_MESES_COMPLETOS[idx]} de ${ano}`;
}

export function navegarMes(mesRefAtual: string, direcao: -1 | 1): string {
  const [anoStr, mesStr] = (mesRefAtual || obterMesAtualPadrao()).split('-');
  let ano = parseInt(anoStr, 10);
  let mes = parseInt(mesStr, 10) + direcao;
  if (mes < 1) {
    mes = 12;
    ano -= 1;
  } else if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function filtrarLancamentosDoMes(lancamentos: Lancamento[], mesAtivo: string): Lancamento[] {
  const mesPadraoSistema = obterMesAtualPadrao();
  const idsIniciais = new Set(['lan-1', 'lan-2', 'lan-3', 'lan-4']);
  return lancamentos.filter(l => {
    if (l.mes_ref === mesAtivo) return true;
    // Se estiver no mês atual do sistema, inclui lançamentos legado ou exemplos iniciais
    if (mesAtivo === mesPadraoSistema && (idsIniciais.has(l.id) || !l.mes_ref)) {
      return true;
    }
    return false;
  });
}

export function atualizarConfiguracaoCasal(
  parcial: Partial<Configuracao>,
  estadoAtual: AppState
): AppState {
  const novaConfig: Configuracao = {
    ...estadoAtual.config,
    ...parcial
  };
  const novoEstado: AppState = {
    ...estadoAtual,
    config: novaConfig
  };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function salvarOrcamentoCompleto(
  novosTetos: Record<string, number>,
  estadoAtual: AppState
): AppState {
  const novoOrcamento = estadoAtual.orcamento.map(item => {
    if (novosTetos[item.categoria] !== undefined) {
      return { ...item, teto: Math.max(0, novosTetos[item.categoria]) };
    }
    return item;
  });
  const novoEstado: AppState = {
    ...estadoAtual,
    orcamento: novoOrcamento
  };
  salvarEstado(novoEstado);
  return novoEstado;
}

export function virarMesCiclo(
  novoMesRef: string,
  transferirSobraColchao: boolean,
  valorSobra: number,
  estadoAtual: AppState
): AppState {
  let estado = {
    ...estadoAtual,
    mesAtivo: novoMesRef,
    diaAtualSimulado: 1
  };

  if (transferirSobraColchao && valorSobra > 0) {
    const res = registrarAporteReserva(
      {
        valor: valorSobra,
        motivo: `Sobra transferida no fechamento de ${formatarMesExibicao(estadoAtual.mesAtivo, true)}`,
        tipo: 'Aporte',
        data: `${novoMesRef}-01`
      },
      estado
    );
    estado = res.estadoAtualizado;
  }

  salvarEstado(estado);
  return estado;
}

export function gerarCodigoCasalAleatorio(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `CASAL-${num}`;
}

export function vincularPorCodigoCasal(
  codigoInput: string,
  estadoAtual: AppState
): { estadoAtualizado: AppState; encontrouDadosNuvem: boolean } {
  const codigoLimpo = codigoInput.trim().toUpperCase();
  const rawSnapshot = localStorage.getItem(STORAGE_KEYS.CLOUD_CASAL_PREFIX + codigoLimpo);

  if (rawSnapshot) {
    try {
      const snap = JSON.parse(rawSnapshot);
      const novoEstado: AppState = {
        ...estadoAtual,
        lancamentos: snap.lancamentos || estadoAtual.lancamentos,
        rendasExtras: snap.rendasExtras || estadoAtual.rendasExtras,
        fixas: snap.fixas || estadoAtual.fixas,
        orcamento: snap.orcamento || estadoAtual.orcamento,
        reserva: snap.reserva || estadoAtual.reserva,
        config: {
          ...estadoAtual.config,
          ...(snap.config || {}),
          codigo_casal: codigoLimpo
        }
      };
      salvarEstado(novoEstado);
      return { estadoAtualizado: novoEstado, encontrouDadosNuvem: true };
    } catch {
      // Continua como novo vínculo
    }
  }

  const novoEstado: AppState = {
    ...estadoAtual,
    config: {
      ...estadoAtual.config,
      codigo_casal: codigoLimpo
    }
  };
  salvarEstado(novoEstado);
  return { estadoAtualizado: novoEstado, encontrouDadosNuvem: false };
}

export function aplicarOnboardingNovoCasal(
  dados: {
    nomeFamilia: string;
    nomeParceiro1: string;
    nomeParceiro2: string;
    rendaLiquida: number;
    metaReservaMensal: number;
    metaColchaoTotal: number;
    saldoColchaoInicial: number;
    tetosCategorias: Record<string, number>;
    limparExemplos: boolean;
  },
  estadoAtual: AppState
): AppState {
  const codigo = gerarCodigoCasalAleatorio();
  const hoje = new Date().toISOString().split('T')[0];

  const novaConfig: Configuracao = {
    ...estadoAtual.config,
    nome_familia: dados.nomeFamilia.trim() || 'Nossa Família',
    nome_parceiro_1: dados.nomeParceiro1.trim() || 'Parceiro 1',
    nome_parceiro_2: dados.nomeParceiro2.trim() || 'Parceiro 2',
    renda_liquida_mensal: dados.rendaLiquida > 0 ? dados.rendaLiquida : 6500,
    meta_reserva_mensal: dados.metaReservaMensal >= 0 ? dados.metaReservaMensal : 200,
    colchao_meta: dados.metaColchaoTotal > 0 ? dados.metaColchaoTotal : 4600,
    codigo_casal: codigo,
    plano_assinatura: 'trial',
    data_inicio_trial: hoje,
    onboarding_concluido: true
  };

  const novoOrcamento = estadoAtual.orcamento.map(item => {
    if (dados.tetosCategorias[item.categoria] !== undefined) {
      return { ...item, teto: Math.max(0, dados.tetosCategorias[item.categoria]) };
    }
    if (item.categoria === 'Reserva') {
      return { ...item, teto: novaConfig.meta_reserva_mensal };
    }
    return item;
  });

  const novaReserva: TransacaoReserva[] = dados.saldoColchaoInicial >= 0
    ? [
        {
          id: `res-onb-${Date.now()}`,
          data: hoje,
          valor: dados.saldoColchaoInicial,
          tipo: 'Aporte',
          motivo: 'Saldo inicial do Colchão de Emergência',
          saldo_acumulado: dados.saldoColchaoInicial
        }
      ]
    : estadoAtual.reserva;

  const novoEstado: AppState = {
    ...estadoAtual,
    config: novaConfig,
    orcamento: novoOrcamento,
    reserva: novaReserva,
    lancamentos: dados.limparExemplos ? [] : estadoAtual.lancamentos,
    rendasExtras: dados.limparExemplos ? [] : estadoAtual.rendasExtras,
    mesAtivo: obterMesAtualPadrao(),
    diaAtualSimulado: null
  };

  salvarEstado(novoEstado);
  return novoEstado;
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
