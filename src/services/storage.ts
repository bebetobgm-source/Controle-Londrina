import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Timestamp,
  Unsubscribe,
  DocumentReference
} from 'firebase/firestore';
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
import { db, auth, handleFirestoreError, OperationType } from './googleAuth';

// Chaves legadas (usadas apenas para detectar/migrar dados antigos e depois apagadas)
const LEGACY_STORAGE_KEYS = {
  LANCAMENTOS: 'orcamento_londrina_lancamentos_v1',
  RENDAS_EXTRAS: 'orcamento_londrina_rendas_extras_v1',
  FIXAS: 'orcamento_londrina_fixas_v1',
  ORCAMENTO: 'orcamento_londrina_orcamento_v1',
  CATEGORIAS: 'orcamento_londrina_categorias_v1',
  RESERVA: 'orcamento_londrina_reserva_v1',
  CONFIG: 'orcamento_londrina_config_v1',
  ALERTAS_LOG: 'orcamento_londrina_alertas_log_v1',
  MES_ATIVO: 'orcamento_londrina_mes_ativo_v1'
};

// Preferências exclusivas deste aparelho
const DEVICE_PREF_KEYS = {
  ULTIMO_QUEM: 'orcamento_londrina_ultimo_quem_v1',
  SIMULACAO_DIA: 'orcamento_londrina_simulacao_dia_v1'
};

// ID da família ativa na sessão do Firestore
let activeFamilyId: string | null = null;

export function definirFamilyIdAtivo(familyId: string | null) {
  activeFamilyId = familyId;
}

export function obterFamilyIdAtivo(): string | null {
  return activeFamilyId;
}

export function obterMesAtualPadrao(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

export function gerarUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `uuid-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
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

export type OperacaoBatch = {
  type?: 'set' | 'update' | 'delete';
  ref: DocumentReference;
  data?: Record<string, any>;
};

const TAMANHO_LOTE = 400;

/**
 * Grava, atualiza ou exclui documentos no Firestore dividindo em lotes de até 400 operações por writeBatch
 */
export async function gravarEmLotes(operacoes: OperacaoBatch[]): Promise<void> {
  for (let i = 0; i < operacoes.length; i += TAMANHO_LOTE) {
    const fatia = operacoes.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    fatia.forEach(op => {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.type === 'update' && op.data !== undefined) {
        batch.update(op.ref, op.data);
      } else if (op.data !== undefined) {
        batch.set(op.ref, op.data);
      }
    });
    await batch.commit();
  }
}

export function carregarEstado(): AppState {
  try {
    const rawQuem = localStorage.getItem(DEVICE_PREF_KEYS.ULTIMO_QUEM) as Quem | null;
    const isDev =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('dev') === '1';

    if (!isDev) {
      localStorage.removeItem(DEVICE_PREF_KEYS.SIMULACAO_DIA);
    }
    const rawDia = isDev ? localStorage.getItem(DEVICE_PREF_KEYS.SIMULACAO_DIA) : null;

    return {
      lancamentos: [],
      rendasExtras: [],
      fixas: [],
      orcamento: [...ORCAMENTO_PADRAO],
      categorias: [...CATEGORIAS_PADRAO],
      reserva: [],
      config: {
        ...CONFIG_PADRAO,
        nome_familia: CONFIG_PADRAO.nome_familia || 'Nossa Família',
        nome_parceiro_1: CONFIG_PADRAO.nome_parceiro_1 || 'Ele',
        nome_parceiro_2: CONFIG_PADRAO.nome_parceiro_2 || 'Ela',
        plano_assinatura: 'trial',
        data_inicio_trial: new Date().toISOString().split('T')[0],
        onboarding_concluido: true
      },
      alertasLog: [],
      ultimoQuem: rawQuem || 'Ele',
      diaAtualSimulado: rawDia ? parseInt(rawDia, 10) : null,
      mesAtivo: obterMesAtualPadrao()
    };
  } catch (err) {
    console.error('Erro ao inicializar estado:', err);
    return {
      lancamentos: [],
      rendasExtras: [],
      fixas: [],
      orcamento: [...ORCAMENTO_PADRAO],
      categorias: [...CATEGORIAS_PADRAO],
      reserva: [],
      config: { ...CONFIG_PADRAO },
      alertasLog: [],
      ultimoQuem: 'Ele',
      diaAtualSimulado: null,
      mesAtivo: obterMesAtualPadrao()
    };
  }
}

export const carregarEstadoInicial = carregarEstado;

/**
 * Salva apenas preferências locais do aparelho no localStorage.
 * Os dados financeiros da família têm o Firestore como fonte da verdade.
 */
export function salvarEstado(estado: Partial<AppState>) {
  try {
    if (estado.ultimoQuem !== undefined) {
      localStorage.setItem(DEVICE_PREF_KEYS.ULTIMO_QUEM, estado.ultimoQuem);
    }
    if (estado.diaAtualSimulado !== undefined) {
      if (estado.diaAtualSimulado === null) {
        localStorage.removeItem(DEVICE_PREF_KEYS.SIMULACAO_DIA);
      } else {
        localStorage.setItem(DEVICE_PREF_KEYS.SIMULACAO_DIA, String(estado.diaAtualSimulado));
      }
    }
    if (activeFamilyId && estado.mesAtivo !== undefined) {
      const famPath = `families/${activeFamilyId}`;
      updateDoc(doc(db, 'families', activeFamilyId), {
        mesAtivo: estado.mesAtivo
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, famPath));
    }
  } catch (err) {
    console.error('Erro ao salvar preferências do aparelho:', err);
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

  const alertasAtualizados = [...alertas, ...estadoAtual.alertasLog];

  const novoEstado: AppState = {
    ...estadoAtual,
    lancamentos: novosLancamentos,
    alertasLog: alertasAtualizados,
    ultimoQuem: novo.quem
  };

  salvarEstado({ ultimoQuem: novo.quem });

  if (activeFamilyId) {
    const lanPath = `families/${activeFamilyId}/lancamentos/${id}`;
    setDoc(doc(db, 'families', activeFamilyId, 'lancamentos', id), lancamentoCompleto).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, lanPath)
    );
    alertas.forEach(alerta => {
      const alertaId = alerta.id || `alerta-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const alertaPath = `families/${activeFamilyId}/alertas/${alertaId}`;
      setDoc(doc(db, 'families', activeFamilyId!, 'alertas', alertaId), {
        ...alerta,
        id: alertaId
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, alertaPath));
    });
  }

  return { estadoAtualizado: novoEstado, novoId: id, alertasDisparados: alertas };
}

export function excluirLancamento(id: string, estadoAtual: AppState): AppState {
  const filtrados = estadoAtual.lancamentos.filter(l => l.id !== id);
  const novoEstado = { ...estadoAtual, lancamentos: filtrados };

  if (activeFamilyId) {
    const lanPath = `families/${activeFamilyId}/lancamentos/${id}`;
    deleteDoc(doc(db, 'families', activeFamilyId, 'lancamentos', id)).catch(err =>
      handleFirestoreError(err, OperationType.DELETE, lanPath)
    );
  }

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

  const removidos: string[] = [];
  const filtrados = estadoAtual.lancamentos.filter(l => {
    if (idsExemplo.has(l.id)) {
      removidos.push(l.id);
      return false;
    }
    const est = (l.estabelecimento || '').toLowerCase();
    const obs = (l.observacao || '').toLowerCase();
    if (nomesExemplo.some(termo => est.includes(termo) || obs.includes(termo))) {
      removidos.push(l.id);
      return false;
    }
    return true;
  });

  if (activeFamilyId && removidos.length > 0) {
    const famId = activeFamilyId;
    removidos.forEach(id => {
      deleteDoc(doc(db, 'families', famId, 'lancamentos', id)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `families/${famId}/lancamentos/${id}`)
      );
    });
  }

  return { ...estadoAtual, lancamentos: filtrados };
}

export function limparTodosLancamentos(estadoAtual: AppState): AppState {
  if (activeFamilyId) {
    const famId = activeFamilyId;
    estadoAtual.lancamentos.forEach(l => {
      deleteDoc(doc(db, 'families', famId, 'lancamentos', l.id)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `families/${famId}/lancamentos/${l.id}`)
      );
    });
  }
  return { ...estadoAtual, lancamentos: [] };
}

export function alternarStatusContaFixa(idOuDescricao: string, estadoAtual: AppState): AppState {
  const mesRefAtual = estadoAtual.mesAtivo || obterMesAtualPadrao();
  let contaModificada: ContaFixa | null = null;
  let jaAlterou = false;

  const temMatchPorId = estadoAtual.fixas.some(f => f.id === idOuDescricao);

  const novasFixas = estadoAtual.fixas.map(f => {
    const match = temMatchPorId ? f.id === idOuDescricao : f.descricao === idOuDescricao;
    if (match && !jaAlterou) {
      jaAlterou = true;
      const novoPago = f.pago_mes_ref === mesRefAtual ? '' : mesRefAtual;
      const id = f.id || gerarUuid();
      contaModificada = { ...f, id, pago_mes_ref: novoPago };
      return contaModificada;
    }
    return f;
  });

  if (activeFamilyId && contaModificada) {
    const fixId = (contaModificada as ContaFixa).id!;
    const fixPath = `families/${activeFamilyId}/fixas/${fixId}`;
    setDoc(doc(db, 'families', activeFamilyId, 'fixas', fixId), contaModificada).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, fixPath)
    );
  }

  return { ...estadoAtual, fixas: novasFixas };
}

export function atualizarContaFixa(
  idOuDescricaoOriginal: string,
  dadosAtualizados: Partial<ContaFixa>,
  estadoAtual: AppState
): AppState {
  let contaFinal: ContaFixa | null = null;
  let jaAlterou = false;
  const temMatchPorId = estadoAtual.fixas.some(f => f.id === idOuDescricaoOriginal);

  const novasFixas = estadoAtual.fixas.map(f => {
    const match = temMatchPorId ? f.id === idOuDescricaoOriginal : f.descricao === idOuDescricaoOriginal;
    if (match && !jaAlterou) {
      jaAlterou = true;
      const id = f.id || gerarUuid();
      contaFinal = { ...f, ...dadosAtualizados, id };
      return contaFinal;
    }
    return f;
  });

  if (activeFamilyId && contaFinal) {
    const fixId = (contaFinal as ContaFixa).id!;
    setDoc(doc(db, 'families', activeFamilyId, 'fixas', fixId), contaFinal).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, `families/${activeFamilyId}/fixas/${fixId}`)
    );
  }

  return { ...estadoAtual, fixas: novasFixas };
}

export function adicionarContaFixa(
  novaConta: ContaFixa,
  estadoAtual: AppState
): AppState {
  const id = novaConta.id || gerarUuid();
  const contaComId: ContaFixa = { ...novaConta, id };
  const novasFixas = [...estadoAtual.fixas, contaComId];

  if (activeFamilyId) {
    setDoc(doc(db, 'families', activeFamilyId, 'fixas', id), contaComId).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, `families/${activeFamilyId}/fixas/${id}`)
    );
  }

  return { ...estadoAtual, fixas: novasFixas };
}

export function excluirContaFixa(
  idOuDescricao: string,
  estadoAtual: AppState
): AppState {
  const temMatchPorId = estadoAtual.fixas.some(f => f.id === idOuDescricao);
  const alvo = temMatchPorId
    ? estadoAtual.fixas.find(f => f.id === idOuDescricao)
    : estadoAtual.fixas.find(f => f.descricao === idOuDescricao);

  let removeu = false;
  const novasFixas = estadoAtual.fixas.filter(f => {
    if (removeu) return true;
    const match = temMatchPorId ? f.id === idOuDescricao : f.descricao === idOuDescricao;
    if (match) {
      removeu = true;
      return false;
    }
    return true;
  });

  if (activeFamilyId && alvo?.id) {
    deleteDoc(doc(db, 'families', activeFamilyId, 'fixas', alvo.id)).catch(err =>
      handleFirestoreError(err, OperationType.DELETE, `families/${activeFamilyId}/fixas/${alvo.id}`)
    );
  }

  return { ...estadoAtual, fixas: novasFixas };
}

export function registrarRendaExtra(
  dados: Omit<RendaExtra, 'id' | 'mes_ref' | 'criado_em'>,
  estadoAtual: AppState
): { estadoAtualizado: AppState; novoId: string } {
  const agora = new Date();
  const mesRefAtual = estadoAtual.mesAtivo || (dados.data ? dados.data.substring(0, 7) : obterMesAtualPadrao());

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

  salvarEstado({ ultimoQuem: dados.quem });

  if (activeFamilyId) {
    const recPath = `families/${activeFamilyId}/rendasExtras/${novoId}`;
    setDoc(doc(db, 'families', activeFamilyId, 'rendasExtras', novoId), novaRenda).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, recPath)
    );
  }

  return { estadoAtualizado: novoEstado, novoId };
}

export function excluirRendaExtra(
  id: string,
  estadoAtual: AppState
): AppState {
  const filtradas = (estadoAtual.rendasExtras || []).filter(r => r.id !== id);

  if (activeFamilyId) {
    const recPath = `families/${activeFamilyId}/rendasExtras/${id}`;
    deleteDoc(doc(db, 'families', activeFamilyId, 'rendasExtras', id)).catch(err =>
      handleFirestoreError(err, OperationType.DELETE, recPath)
    );
  }

  return { ...estadoAtual, rendasExtras: filtradas };
}

export function atualizarTetoOrcamento(categoria: string, novoTeto: number, estadoAtual: AppState): AppState {
  const novoOrcamento = estadoAtual.orcamento.map(item => {
    if (item.categoria === categoria) {
      return { ...item, teto: novoTeto };
    }
    return item;
  });

  if (activeFamilyId) {
    const famPath = `families/${activeFamilyId}`;
    updateDoc(doc(db, 'families', activeFamilyId), { orcamento: novoOrcamento }).catch(err =>
      handleFirestoreError(err, OperationType.UPDATE, famPath)
    );
  }

  return { ...estadoAtual, orcamento: novoOrcamento };
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
    : 0;

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

  if (activeFamilyId) {
    const resPath = `families/${activeFamilyId}/reserva/${novaTransacao.id}`;
    setDoc(doc(db, 'families', activeFamilyId, 'reserva', novaTransacao.id), novaTransacao).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, resPath)
    );
  }

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

  if (activeFamilyId) {
    const famId = activeFamilyId;
    deleteDoc(doc(db, 'families', famId, 'reserva', id)).catch(err =>
      handleFirestoreError(err, OperationType.DELETE, `families/${famId}/reserva/${id}`)
    );
    recalculadas.forEach(r => {
      setDoc(doc(db, 'families', famId, 'reserva', r.id), r).catch(err =>
        handleFirestoreError(err, OperationType.WRITE, `families/${famId}/reserva/${r.id}`)
      );
    });
  }

  return {
    ...estadoAtual,
    reserva: recalculadas
  };
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
    : 0;

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

  if (activeFamilyId) {
    const resPath = `families/${activeFamilyId}/reserva/${transacaoAjuste.id}`;
    setDoc(doc(db, 'families', activeFamilyId, 'reserva', transacaoAjuste.id), transacaoAjuste).catch(err =>
      handleFirestoreError(err, OperationType.WRITE, resPath)
    );
  }

  return { estadoAtualizado, transacaoAjuste };
}

/**
 * Reseta apenas o estado em memória (para modo de testes/dev), NUNCA grava no Firestore
 */
export function resetarParaDadosPadrao(): AppState {
  return {
    lancamentos: [...LANCAMENTOS_INICIAIS],
    rendasExtras: [],
    fixas: FIXAS_PADRAO.map(f => ({ ...f, id: f.id || gerarUuid() })),
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

  if (activeFamilyId) {
    const famPath = `families/${activeFamilyId}`;
    updateDoc(doc(db, 'families', activeFamilyId), {
      config: novaConfig,
      nomeFamilia: novaConfig.nome_familia || 'Nossa Família'
    }).catch(err => handleFirestoreError(err, OperationType.UPDATE, famPath));
  }

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

  if (activeFamilyId) {
    const famPath = `families/${activeFamilyId}`;
    updateDoc(doc(db, 'families', activeFamilyId), {
      orcamento: novoOrcamento
    }).catch(err => handleFirestoreError(err, OperationType.UPDATE, famPath));
  }

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
    diaAtualSimulado: null
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

  salvarEstado({ diaAtualSimulado: null, mesAtivo: novoMesRef });
  return estado;
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
  const hoje = new Date().toISOString().split('T')[0];

  const novaConfig: Configuracao = {
    ...estadoAtual.config,
    nome_familia: dados.nomeFamilia.trim() || 'Nossa Família',
    nome_parceiro_1: dados.nomeParceiro1.trim() || 'Parceiro 1',
    nome_parceiro_2: dados.nomeParceiro2.trim() || 'Parceiro 2',
    renda_liquida_mensal: dados.rendaLiquida > 0 ? dados.rendaLiquida : 6500,
    meta_reserva_mensal: dados.metaReservaMensal >= 0 ? dados.metaReservaMensal : 200,
    colchao_meta: dados.metaColchaoTotal > 0 ? dados.metaColchaoTotal : 4600,
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

  const novaReserva: TransacaoReserva[] = dados.saldoColchaoInicial > 0
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
    : [];

  const novoEstado: AppState = {
    ...estadoAtual,
    config: novaConfig,
    orcamento: novoOrcamento,
    reserva: novaReserva,
    fixas: [],
    lancamentos: [],
    rendasExtras: [],
    mesAtivo: obterMesAtualPadrao(),
    diaAtualSimulado: null
  };

  return novoEstado;
}

// -------------------------------------------------------------
// FIRESTORE: PERFIL DO USUÁRIO, FAMÍLIA, CONVITE 24 CHARS E MIGRAÇÃO
// -------------------------------------------------------------

export interface UserProfileFirestore {
  familyId?: string;
  nome: string;
  criadoEm: string;
}

export async function obterPerfilUsuarioFirestore(uid: string): Promise<UserProfileFirestore | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileFirestore;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function criarFamiliaNoFirestore(
  uid: string,
  nomeUsuario: string,
  estadoInicial: AppState
): Promise<string> {
  const familyId = `fam-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const agoraIso = new Date().toISOString();

  try {
    // 1. Criar documento principal da família (regra: request.resource.data.members == [request.auth.uid])
    await setDoc(doc(db, 'families', familyId), {
      nomeFamilia: estadoInicial.config.nome_familia || 'Nossa Família',
      members: [uid],
      config: estadoInicial.config,
      orcamento: estadoInicial.orcamento,
      categorias: estadoInicial.categorias,
      mesAtivo: estadoInicial.mesAtivo || obterMesAtualPadrao(),
      criadoEm: agoraIso,
      conviteUsado: ''
    });

    // 2. Salvar familyId em users/{uid}
    await setDoc(
      doc(db, 'users', uid),
      {
        familyId,
        nome: nomeUsuario || estadoInicial.config.nome_parceiro_1 || 'Parceiro 1',
        criadoEm: agoraIso
      },
      { merge: true }
    );

    // 3. Gravar subcoleções iniciais em lotes de no máximo 400 operações cada
    // Garantir que FIXAS_PADRAO, LANCAMENTOS_INICIAIS e RESERVA_INICIAL de defaultData.ts NUNCA sejam gravados
    const descricoesFixasPadrao = new Set(
      FIXAS_PADRAO.map(fp => `${fp.descricao.trim().toLowerCase()}|${fp.valor}|${fp.dia_vencimento}`)
    );
    const idsLancamentosPadrao = new Set(LANCAMENTOS_INICIAIS.map(l => l.id));
    const idsReservaPadrao = new Set(RESERVA_INICIAL.map(r => r.id));

    const operacoes: OperacaoBatch[] = [];
    estadoInicial.fixas
      .filter(f => !descricoesFixasPadrao.has(`${f.descricao.trim().toLowerCase()}|${f.valor}|${f.dia_vencimento}`))
      .forEach(f => {
        const fId = f.id || gerarUuid();
        operacoes.push({
          ref: doc(db, 'families', familyId, 'fixas', fId),
          data: { ...f, id: fId }
        });
      });
    estadoInicial.reserva
      .filter(r => !idsReservaPadrao.has(r.id))
      .forEach(r => {
        operacoes.push({
          ref: doc(db, 'families', familyId, 'reserva', r.id),
          data: r
        });
      });
    estadoInicial.lancamentos
      .filter(l => !idsLancamentosPadrao.has(l.id))
      .forEach(l => {
        operacoes.push({
          ref: doc(db, 'families', familyId, 'lancamentos', l.id),
          data: l
        });
      });
    estadoInicial.rendasExtras.forEach(re => {
      operacoes.push({
        ref: doc(db, 'families', familyId, 'rendasExtras', re.id),
        data: re
      });
    });

    if (operacoes.length > 0) {
      await gravarEmLotes(operacoes);
    }

    definirFamilyIdAtivo(familyId);
    return familyId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `families/${familyId}`);
    throw err;
  }
}

export async function sincronizarEstadoCompletoParaFirestore(
  familyId: string,
  estado: AppState
): Promise<void> {
  try {
    await updateDoc(doc(db, 'families', familyId), {
      nomeFamilia: estado.config.nome_familia || 'Nossa Família',
      config: estado.config,
      orcamento: estado.orcamento,
      categorias: estado.categorias,
      mesAtivo: estado.mesAtivo
    });

    const operacoes: OperacaoBatch[] = [];
    estado.fixas.forEach(f => {
      const fId = f.id || gerarUuid();
      operacoes.push({
        ref: doc(db, 'families', familyId, 'fixas', fId),
        data: { ...f, id: fId }
      });
    });
    estado.reserva.forEach(r => {
      operacoes.push({
        ref: doc(db, 'families', familyId, 'reserva', r.id),
        data: r
      });
    });
    estado.lancamentos.forEach(l => {
      operacoes.push({
        ref: doc(db, 'families', familyId, 'lancamentos', l.id),
        data: l
      });
    });
    estado.rendasExtras.forEach(r => {
      operacoes.push({
        ref: doc(db, 'families', familyId, 'rendasExtras', r.id),
        data: r
      });
    });

    await gravarEmLotes(operacoes);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `families/${familyId}`);
  }
}

/**
 * Escuta em tempo real (onSnapshot) o documento da família e todas as 5 subcoleções
 */
export function assinarFamiliaTempoReal(
  familyId: string,
  onUpdate: (
    parcial: Partial<AppState>,
    meta?: { members?: string[]; nomeFamilia?: string; origemSubcolecao?: string }
  ) => void
): Unsubscribe {
  definirFamilyIdAtivo(familyId);

  const unsubs: Unsubscribe[] = [];

  // 1. Documento principal families/{familyId}
  unsubs.push(
    onSnapshot(
      doc(db, 'families', familyId),
      snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        onUpdate(
          {
            ...(data.config ? { config: data.config as Configuracao } : {}),
            ...(data.orcamento ? { orcamento: data.orcamento as OrcamentoItem[] } : {}),
            ...(data.categorias ? { categorias: data.categorias as CategoriaItem[] } : {}),
            ...(data.mesAtivo ? { mesAtivo: data.mesAtivo as string } : {})
          },
          {
            members: (data.members as string[]) || [],
            nomeFamilia: data.nomeFamilia as string
          }
        );
      },
      err => handleFirestoreError(err, OperationType.GET, `families/${familyId}`)
    )
  );

  // 2. Subcoleção lancamentos
  unsubs.push(
    onSnapshot(
      collection(db, 'families', familyId, 'lancamentos'),
      snap => {
        const lista: Lancamento[] = [];
        snap.forEach(d => lista.push(d.data() as Lancamento));
        lista.sort((a, b) => (b.criado_em || b.data).localeCompare(a.criado_em || a.data));
        onUpdate({ lancamentos: lista }, { origemSubcolecao: 'lancamentos' });
      },
      err => handleFirestoreError(err, OperationType.LIST, `families/${familyId}/lancamentos`)
    )
  );

  // 3. Subcoleção fixas (com migração idempotente de contas antigas sem campo id)
  let migrandoFixasAntigas = false;
  unsubs.push(
    onSnapshot(
      collection(db, 'families', familyId, 'fixas'),
      snap => {
        const lista: ContaFixa[] = [];
        const operacoesMigracaoFixas: OperacaoBatch[] = [];

        snap.forEach(d => {
          const dados = d.data() as ContaFixa;
          if (!dados.id) {
            lista.push({ ...dados, id: d.id });
            operacoesMigracaoFixas.push({
              type: 'update',
              ref: doc(db, 'families', familyId, 'fixas', d.id),
              data: { id: d.id }
            });
          } else {
            lista.push(dados);
          }
        });

        if (operacoesMigracaoFixas.length > 0 && !migrandoFixasAntigas) {
          migrandoFixasAntigas = true;
          gravarEmLotes(operacoesMigracaoFixas)
            .catch(err => handleFirestoreError(err, OperationType.UPDATE, `families/${familyId}/fixas`))
            .finally(() => {
              migrandoFixasAntigas = false;
            });
        }

        lista.sort((a, b) => a.dia_vencimento - b.dia_vencimento);
        onUpdate({ fixas: lista }, { origemSubcolecao: 'fixas' });
      },
      err => handleFirestoreError(err, OperationType.LIST, `families/${familyId}/fixas`)
    )
  );

  // 4. Subcoleção rendasExtras
  unsubs.push(
    onSnapshot(
      collection(db, 'families', familyId, 'rendasExtras'),
      snap => {
        const lista: RendaExtra[] = [];
        snap.forEach(d => lista.push(d.data() as RendaExtra));
        lista.sort((a, b) => (b.criado_em || b.data).localeCompare(a.criado_em || a.data));
        onUpdate({ rendasExtras: lista }, { origemSubcolecao: 'rendasExtras' });
      },
      err => handleFirestoreError(err, OperationType.LIST, `families/${familyId}/rendasExtras`)
    )
  );

  // 5. Subcoleção reserva
  unsubs.push(
    onSnapshot(
      collection(db, 'families', familyId, 'reserva'),
      snap => {
        const lista: TransacaoReserva[] = [];
        snap.forEach(d => lista.push(d.data() as TransacaoReserva));
        lista.sort((a, b) => a.data.localeCompare(b.data));
        onUpdate({ reserva: lista }, { origemSubcolecao: 'reserva' });
      },
      err => handleFirestoreError(err, OperationType.LIST, `families/${familyId}/reserva`)
    )
  );

  // 6. Subcoleção alertas
  unsubs.push(
    onSnapshot(
      collection(db, 'families', familyId, 'alertas'),
      snap => {
        const lista: AlertaLog[] = [];
        snap.forEach(d => lista.push(d.data() as AlertaLog));
        lista.sort((a, b) => (b.data_hora || '').localeCompare(a.data_hora || ''));
        onUpdate({ alertasLog: lista }, { origemSubcolecao: 'alertas' });
      },
      err => handleFirestoreError(err, OperationType.LIST, `families/${familyId}/alertas`)
    )
  );

  return () => {
    unsubs.forEach(u => u());
  };
}

// -------------------------------------------------------------
// CONVITE SEGURO DE 24 CARACTERES (48h de validade)
// -------------------------------------------------------------

export function gerarTokenConvite24(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[randomBytes[i] % chars.length];
  }
  return token;
}

export interface InviteFirestoreData {
  token: string;
  familyId: string;
  createdBy: string;
  nomeFamilia?: string;
  expiresAt: Timestamp;
  used: boolean;
  usedBy?: string;
}

export async function criarConviteParceiroFirestore(
  familyId: string,
  nomeFamilia: string
): Promise<{ token: string; link: string; expiresAt: Date }> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login com sua conta Google para gerar um link de convite.');
  }

  const token = gerarTokenConvite24();
  const expiresDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas
  const path = `invites/${token}`;

  try {
    await setDoc(doc(db, 'invites', token), {
      familyId,
      createdBy: uid,
      nomeFamilia: nomeFamilia || 'Nossa Família',
      expiresAt: Timestamp.fromDate(expiresDate),
      used: false
    });

    const link = `${window.location.origin}${window.location.pathname}?convite=${encodeURIComponent(token)}`;
    return { token, link, expiresAt: expiresDate };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function consultarConviteFirestore(token: string): Promise<{
  valido: boolean;
  motivoErro?: string;
  convite?: InviteFirestoreData;
}> {
  const path = `invites/${token}`;
  try {
    const snap = await getDoc(doc(db, 'invites', token));
    if (!snap.exists()) {
      return {
        valido: false,
        motivoErro: 'Este link de convite não existe ou foi digitado incorretamente.'
      };
    }

    const data = snap.data();
    const expiresAt = data.expiresAt as Timestamp;
    const used = Boolean(data.used);

    if (used) {
      return {
        valido: false,
        motivoErro: 'Este convite já foi utilizado. Cada família permite no máximo 2 membros conectados.'
      };
    }

    if (!expiresAt || expiresAt.toMillis() <= Date.now()) {
      return {
        valido: false,
        motivoErro: 'Este convite expirou (validade máxima de 48 horas). Peça ao seu par para gerar um novo link.'
      };
    }

    return {
      valido: true,
      convite: {
        token,
        familyId: data.familyId,
        createdBy: data.createdBy,
        nomeFamilia: data.nomeFamilia || 'Família',
        expiresAt,
        used,
        usedBy: data.usedBy
      }
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return {
      valido: false,
      motivoErro: 'Não foi possível validar o convite agora.'
    };
  }
}

export async function aceitarConviteFamiliaFirestore(token: string): Promise<{
  sucesso: boolean;
  familyId?: string;
  nomeFamilia?: string;
  erro?: string;
}> {
  const user = auth.currentUser;
  if (!user) {
    return { sucesso: false, erro: 'Faça login com o Google antes de aceitar o convite.' };
  }

  const consulta = await consultarConviteFirestore(token);
  if (!consulta.valido || !consulta.convite) {
    return { sucesso: false, erro: consulta.motivoErro || 'Convite inválido.' };
  }

  const { familyId, createdBy, nomeFamilia } = consulta.convite;

  if (createdBy === user.uid) {
    definirFamilyIdAtivo(familyId);
    return {
      sucesso: true,
      familyId,
      nomeFamilia
    };
  }

  try {
    const batch = writeBatch(db);

    batch.update(doc(db, 'families', familyId), {
      members: [createdBy, user.uid],
      conviteUsado: token
    });

    batch.update(doc(db, 'invites', token), {
      used: true,
      usedBy: user.uid
    });

    batch.set(
      doc(db, 'users', user.uid),
      {
        familyId,
        nome: user.displayName || 'Parceiro(a)',
        criadoEm: new Date().toISOString()
      },
      { merge: true }
    );

    await batch.commit();
    definirFamilyIdAtivo(familyId);

    return {
      sucesso: true,
      familyId,
      nomeFamilia
    };
  } catch (err: any) {
    console.error('Erro ao aceitar convite:', err);
    if (err?.message?.includes('permission-denied') || err?.code === 'permission-denied') {
      return {
        sucesso: false,
        erro: 'Não foi possível entrar na família. Verifique se ela já atingiu o limite máximo de 2 membros ou se o convite expirou.'
      };
    }
    return {
      sucesso: false,
      erro: 'Erro ao vincular sua conta à família. Tente novamente.'
    };
  }
}

// -------------------------------------------------------------
// MIGRAÇÃO DOS DADOS ANTIGOS DO LOCALSTORAGE PARA O FIRESTORE
// -------------------------------------------------------------

export function temDadosAntigosNoLocalStorage(): boolean {
  try {
    return Object.values(LEGACY_STORAGE_KEYS).some(key => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

export function limparChavesAntigasLocalStorage(): void {
  try {
    Object.values(LEGACY_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('orcamento_saas_casal_v1_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Erro ao limpar chaves antigas do localStorage:', err);
  }
}

export async function verificarFamiliaVaziaNoFirestore(familyId: string): Promise<boolean> {
  try {
    const snap = await getDocs(collection(db, 'families', familyId, 'lancamentos'));
    return snap.empty;
  } catch {
    return false;
  }
}

export async function migrarDadosLocalStorageParaFirestore(familyId: string): Promise<number> {
  const rawLancamentos = localStorage.getItem(LEGACY_STORAGE_KEYS.LANCAMENTOS);
  const rawRendasExtras = localStorage.getItem(LEGACY_STORAGE_KEYS.RENDAS_EXTRAS);
  const rawFixas = localStorage.getItem(LEGACY_STORAGE_KEYS.FIXAS);
  const rawOrcamento = localStorage.getItem(LEGACY_STORAGE_KEYS.ORCAMENTO);
  const rawCategorias = localStorage.getItem(LEGACY_STORAGE_KEYS.CATEGORIAS);
  const rawReserva = localStorage.getItem(LEGACY_STORAGE_KEYS.RESERVA);
  const rawConfig = localStorage.getItem(LEGACY_STORAGE_KEYS.CONFIG);
  const rawAlertas = localStorage.getItem(LEGACY_STORAGE_KEYS.ALERTAS_LOG);
  const rawMesAtivo = localStorage.getItem(LEGACY_STORAGE_KEYS.MES_ATIVO);

  const lancamentos: Lancamento[] = rawLancamentos ? JSON.parse(rawLancamentos) : [];
  const rendasExtras: RendaExtra[] = rawRendasExtras ? JSON.parse(rawRendasExtras) : [];
  const fixas: ContaFixa[] = rawFixas ? JSON.parse(rawFixas) : [];
  const orcamento: OrcamentoItem[] | null = rawOrcamento ? JSON.parse(rawOrcamento) : null;
  const categorias: CategoriaItem[] | null = rawCategorias ? JSON.parse(rawCategorias) : null;
  const reserva: TransacaoReserva[] = rawReserva ? JSON.parse(rawReserva) : [];
  const config: Partial<Configuracao> | null = rawConfig ? JSON.parse(rawConfig) : null;
  const alertas: AlertaLog[] = rawAlertas ? JSON.parse(rawAlertas) : [];

  const operacoes: OperacaoBatch[] = [];

  const updateFamilia: Record<string, any> = {};
  if (config) {
    updateFamilia.config = {
      ...CONFIG_PADRAO,
      ...config
    };
    if (config.nome_familia) {
      updateFamilia.nomeFamilia = config.nome_familia;
    }
  }
  if (orcamento && orcamento.length > 0) updateFamilia.orcamento = orcamento;
  if (categorias && categorias.length > 0) updateFamilia.categorias = categorias;
  if (rawMesAtivo) updateFamilia.mesAtivo = rawMesAtivo;

  if (Object.keys(updateFamilia).length > 0) {
    await updateDoc(doc(db, 'families', familyId), updateFamilia);
  }

  const descricoesFixasPadrao = new Set(
    FIXAS_PADRAO.map(fp => `${fp.descricao.trim().toLowerCase()}|${fp.valor}|${fp.dia_vencimento}`)
  );
  const idsLancamentosPadrao = new Set(LANCAMENTOS_INICIAIS.map(l => l.id));
  const idsReservaPadrao = new Set(RESERVA_INICIAL.map(r => r.id));

  lancamentos
    .filter(l => !idsLancamentosPadrao.has(l.id))
    .forEach(l => {
      const id = l.id || `lan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      operacoes.push({
        ref: doc(db, 'families', familyId, 'lancamentos', id),
        data: { ...l, id }
      });
    });

  rendasExtras.forEach(r => {
    const id = r.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    operacoes.push({
      ref: doc(db, 'families', familyId, 'rendasExtras', id),
      data: { ...r, id }
    });
  });

  fixas
    .filter(f => !descricoesFixasPadrao.has(`${f.descricao.trim().toLowerCase()}|${f.valor}|${f.dia_vencimento}`))
    .forEach(f => {
      const id = f.id || gerarUuid();
      operacoes.push({
        ref: doc(db, 'families', familyId, 'fixas', id),
        data: { ...f, id }
      });
    });

  reserva
    .filter(r => !idsReservaPadrao.has(r.id))
    .forEach(r => {
      const id = r.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      operacoes.push({
        ref: doc(db, 'families', familyId, 'reserva', id),
        data: { ...r, id }
      });
    });

  alertas.forEach(a => {
    const id = a.id || `alerta-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    operacoes.push({
      ref: doc(db, 'families', familyId, 'alertas', id),
      data: { ...a, id }
    });
  });

  if (operacoes.length > 0) {
    await gravarEmLotes(operacoes);
  }

  // Apagar as chaves antigas do localStorage após concluir a importação
  limparChavesAntigasLocalStorage();
  return operacoes.length;
}

// -------------------------------------------------------------
// CENÁRIOS DE TESTE EM MEMÓRIA (NUNCA GRAVAM NO FIRESTORE)
// -------------------------------------------------------------

export function aplicarCenarioDia15(estadoAtual: AppState): AppState {
  const agora = new Date();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

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
  ];

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
  return estadoComDia15;
}

export function aplicarCenarioHigiene91(estadoAtual: AppState): { estadoAtualizado: AppState; alertas: AlertaLog[] } {
  const agora = new Date();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const lancamentoSimulado: Lancamento = {
    id: `test-hig-${Date.now()}`,
    data: `${mesRef}-10`,
    valor: 91.88,
    categoria: 'Mercado',
    subcategoria: 'Higiene',
    estabelecimento: 'Droga Raia Ayrton Senna',
    forma_pagamento: 'Débito',
    quem: 'Ela',
    essencial: 'S',
    observacao: 'Fraldas e produtos de higiene',
    mes_ref: mesRef,
    criado_em: agora.toISOString()
  };

  const novosLancamentos = [lancamentoSimulado, ...estadoAtual.lancamentos];
  const diaAvaliacao = estadoAtual.diaAtualSimulado || agora.getDate();
  const alertas = avaliarAlertas(
    novosLancamentos,
    estadoAtual.orcamento,
    estadoAtual.fixas,
    estadoAtual.config,
    estadoAtual.reserva,
    diaAvaliacao,
    undefined,
    lancamentoSimulado,
    estadoAtual.rendasExtras
  );

  const estadoAtualizado: AppState = {
    ...estadoAtual,
    lancamentos: novosLancamentos,
    alertasLog: [...alertas, ...estadoAtual.alertasLog],
    ultimoQuem: 'Ela'
  };

  return { estadoAtualizado, alertas };
}

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
  return novoEstado;
}
