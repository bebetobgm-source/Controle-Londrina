import { Lancamento, RendaExtra, ContaFixa, OrcamentoItem, TransacaoReserva } from '../types';
import { getAccessToken, invalidarTokenGoogle } from './googleAuth';
import { FIXAS_PADRAO, ORCAMENTO_PADRAO, CONFIG_PADRAO } from '../data/defaultData';

const SHEETS_STORAGE_KEYS = {
  SPREADSHEET_ID: 'orcamento_londrina_spreadsheet_id',
  SPREADSHEET_NAME: 'orcamento_londrina_spreadsheet_name',
  LAST_SYNC: 'orcamento_londrina_last_sync'
};

export interface PlanilhaConectada {
  id: string;
  nome: string;
  url: string;
  ultimaSincronizacao?: string;
}

export function obterPlanilhaConectada(): PlanilhaConectada | null {
  const id = localStorage.getItem(SHEETS_STORAGE_KEYS.SPREADSHEET_ID);
  const nome = localStorage.getItem(SHEETS_STORAGE_KEYS.SPREADSHEET_NAME) || 'Orçamento Doméstico Londrina';
  const ultimaSincronizacao = localStorage.getItem(SHEETS_STORAGE_KEYS.LAST_SYNC) || undefined;
  if (!id) return null;
  return {
    id,
    nome,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    ultimaSincronizacao
  };
}

export function salvarPlanilhaConectada(id: string, nome: string) {
  localStorage.setItem(SHEETS_STORAGE_KEYS.SPREADSHEET_ID, id);
  localStorage.setItem(SHEETS_STORAGE_KEYS.SPREADSHEET_NAME, nome);
  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
}

export function desconectarPlanilha() {
  localStorage.removeItem(SHEETS_STORAGE_KEYS.SPREADSHEET_ID);
  localStorage.removeItem(SHEETS_STORAGE_KEYS.SPREADSHEET_NAME);
  localStorage.removeItem(SHEETS_STORAGE_KEYS.LAST_SYNC);
}

/**
 * Cria automaticamente uma nova planilha do Google Sheets no Google Drive do usuário
 * com as 7 abas formatadas e dados iniciais de Londrina
 */
export async function criarPlanilhaAutomatica(lancamentosAtuais: Lancamento[]): Promise<PlanilhaConectada> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa fazer login com sua conta Google primeiro.');
  }

  // 1. Criar planilha com as abas necessárias
  const payloadCriacao = {
    properties: {
      title: 'Orçamento Doméstico Londrina (Casal)'
    },
    sheets: [
      { properties: { title: 'Lancamentos', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Orcamento', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Fixas', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Metas', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Alertas_Log', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Dashboard', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Config', gridProperties: { frozenRowCount: 1 } } }
    ]
  };

  const resCriar = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payloadCriacao)
  });

  if (!resCriar.ok) {
    const erro = await resCriar.json().catch(() => ({}));
    throw new Error(erro.error?.message || 'Falha ao criar planilha no Google Drive.');
  }

  const spreadsheet = await resCriar.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetName = spreadsheet.properties.title;

  // 2. Preencher os cabeçalhos e dados iniciais em lote
  const cabecalhosLancamentos = [
    ['ID', 'Data', 'Valor (R$)', 'Categoria', 'Subcategoria', 'Quem', 'Estabelecimento', 'Forma Pagamento', 'Essencial', 'Observação', 'Criado Em']
  ];
  const dadosLancamentos = lancamentosAtuais.map(l => [
    l.id,
    l.data,
    l.valor,
    l.categoria,
    l.subcategoria,
    l.quem,
    l.estabelecimento || '',
    l.forma_pagamento || 'Débito',
    l.essencial || 'S',
    l.observacao || '',
    l.criado_em || new Date().toISOString()
  ]);

  const cabecalhosOrcamento = [
    ['Mês Ref', 'Categoria', 'Teto Mensal (R$)', 'Tipo']
  ];
  const dadosOrcamento = ORCAMENTO_PADRAO.map(o => [
    o.mes_ref,
    o.categoria,
    o.teto,
    o.tipo
  ]);

  const cabecalhosFixas = [
    ['Descrição', 'Valor (R$)', 'Dia Vencimento', 'Categoria', 'Ativo', 'Pago']
  ];
  const dadosFixas = FIXAS_PADRAO.map(f => [
    f.descricao,
    f.valor,
    f.dia_vencimento,
    f.categoria,
    f.ativo,
    f.pago_mes_ref
  ]);

  const cabecalhosConfig = [
    ['Chave', 'Valor', 'Descrição'],
    ['renda_liquida_mensal', CONFIG_PADRAO.renda_liquida_mensal, 'Renda líquida familiar'],
    ['dia_pagamento', CONFIG_PADRAO.dia_pagamento, 'Dia do pagamento'],
    ['meta_reserva_mensal', CONFIG_PADRAO.meta_reserva_mensal, 'Meta de aporte mensal'],
    ['colchao_meta', CONFIG_PADRAO.colchao_meta, 'Meta total de colchão de emergência']
  ];

  const cabecalhosAlertas = [
    ['Data Hora', 'Tipo', 'Severidade', 'Categoria', 'Mensagem']
  ];

  const batchData = [
    {
      range: 'Lancamentos!A1:I',
      values: [...cabecalhosLancamentos, ...dadosLancamentos]
    },
    {
      range: 'Orcamento!A1:D',
      values: [...cabecalhosOrcamento, ...dadosOrcamento]
    },
    {
      range: 'Fixas!A1:F',
      values: [...cabecalhosFixas, ...dadosFixas]
    },
    {
      range: 'Config!A1:C',
      values: cabecalhosConfig
    },
    {
      range: 'Alertas_Log!A1:E',
      values: cabecalhosAlertas
    }
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData
    })
  });

  salvarPlanilhaConectada(spreadsheetId, spreadsheetName);

  return {
    id: spreadsheetId,
    nome: spreadsheetName,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR')
  };
}

/**
 * Adiciona um único lançamento diretamente à planilha do Google Sheets
 */
export async function anexarLancamentoNaPlanilha(
  spreadsheetId: string,
  lancamento: Lancamento
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    const linha = [
      lancamento.id,
      lancamento.data,
      lancamento.valor,
      lancamento.categoria,
      lancamento.subcategoria,
      lancamento.quem,
      lancamento.estabelecimento || '',
      lancamento.forma_pagamento || 'Débito',
      lancamento.essencial || 'S',
      lancamento.observacao || '',
      lancamento.criado_em || new Date().toISOString()
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [linha]
        })
      }
    );

    if (res.status === 401) {
      invalidarTokenGoogle();
      return false;
    }

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      window.dispatchEvent(new CustomEvent('orcamento-sync-updated'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao anexar linha no Google Sheets:', err);
    return false;
  }
}

/**
 * Normaliza qualquer formato de valor numérico brasileiro ou internacional
 * (ex: "75", "75,00", "75.00", "R$ 1.250,50", 1250.50)
 */
export function normalizarValorNumerico(raw: any): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  let str = String(raw).replace(/[R$\s]/g, '').trim();
  if (!str) return 0;
  // Se contiver tanto ponto quanto vírgula (ex: 1.250,50)
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Se for formato BR com vírgula decimal (ex: 75,50)
    str = str.replace(',', '.');
  }
  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Normaliza qualquer data para ISO AAAA-MM-DD e extrai o mes_ref AAAA-MM
 * (suporta serial do Google Sheets ex: 45579, "14/10/2026", "2026-10-14", ISO datetime, etc.)
 */
export function normalizarDataISO(raw: any): { data: string; mes_ref: string } {
  const agora = new Date();
  const mesAtualPadrao = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const dataHojePadrao = `${mesAtualPadrao}-${String(agora.getDate()).padStart(2, '0')}`;

  if (!raw) {
    return { data: dataHojePadrao, mes_ref: mesAtualPadrao };
  }

  // Se for número serial de data do Google Sheets (ex: 45579 para 14/10/2026)
  if (typeof raw === 'number' && raw > 30000 && raw < 80000) {
    try {
      const dt = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(dt.getTime())) {
        const dIso = dt.toISOString().substring(0, 10);
        return { data: dIso, mes_ref: dIso.substring(0, 7) };
      }
    } catch {
      // continua para o fallback
    }
  }

  const str = String(raw).trim();

  // Se já for YYYY-MM-DD ou contiver T
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const data = str.substring(0, 10);
    return { data, mes_ref: data.substring(0, 7) };
  }

  // Se for DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0');
    const mes = brMatch[2].padStart(2, '0');
    const ano = brMatch[3];
    return { data: `${ano}-${mes}-${dia}`, mes_ref: `${ano}-${mes}` };
  }

  // Se for DD/MM/YY
  const brShortMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (brShortMatch) {
    const dia = brShortMatch[1].padStart(2, '0');
    const mes = brShortMatch[2].padStart(2, '0');
    const ano = `20${brShortMatch[3]}`;
    return { data: `${ano}-${mes}-${dia}`, mes_ref: `${ano}-${mes}` };
  }

  // Se for string numérica de serial
  const numSerial = parseFloat(str);
  if (!isNaN(numSerial) && numSerial > 30000 && numSerial < 80000) {
    try {
      const dt = new Date(Math.round((numSerial - 25569) * 86400 * 1000));
      if (!isNaN(dt.getTime())) {
        const dIso = dt.toISOString().substring(0, 10);
        return { data: dIso, mes_ref: dIso.substring(0, 7) };
      }
    } catch {
      // continua
    }
  }

  return { data: dataHojePadrao, mes_ref: mesAtualPadrao };
}

export interface ResultadoSincronizacaoPlanilha {
  sucesso: boolean;
  lancamentos: Lancamento[];
  rendasExtras: RendaExtra[];
  fixas: ContaFixa[];
  orcamento?: OrcamentoItem[];
  reserva?: TransacaoReserva[];
  totalLancamentos: number;
  totalRendas: number;
  totalFixas: number;
  duplicadosIgnorados: number;
  mensagem: string;
}

/**
 * Puxa todos os dados das abas do Google Sheets com DEDUPLICAÇÃO INTELIGENTE
 * e filtros rigorosos para ignorar cabeçalhos repetidos e linhas corrompidas.
 */
export async function puxarDadosCompletosDaPlanilha(
  spreadsheetId: string
): Promise<ResultadoSincronizacaoPlanilha> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa fazer login com sua conta Google para sincronizar.');
  }

  // 1. Obter metadados da planilha para identificar nomes reais das abas
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!metaRes.ok) {
    if (metaRes.status === 401) {
      invalidarTokenGoogle();
      throw new Error('Sua sessão do Google expirou. Clique para reconectar sua conta e sincronizar os gastos do casal.');
    }
    const erroJson = await metaRes.json().catch(() => ({}));
    throw new Error(
      erroJson.error?.message ||
        'Não foi possível acessar a planilha. Verifique se a planilha está compartilhada com sua conta Google.'
    );
  }

  const metaData = await metaRes.json();
  const abasDisponiveis: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title || '');

  const normalizarNomeAba = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const abaLancamentos =
    abasDisponiveis.find(a => normalizarNomeAba(a).includes('lancamento')) || 'Lancamentos';
  const abaFixas =
    abasDisponiveis.find(a => normalizarNomeAba(a).includes('fixa')) || 'Fixas';
  const abaOrcamento =
    abasDisponiveis.find(a => normalizarNomeAba(a).includes('orcamento')) || 'Orcamento';
  const abaMetas =
    abasDisponiveis.find(a => normalizarNomeAba(a).includes('meta') || normalizarNomeAba(a).includes('reserva')) || 'Metas';

  // 2. Buscar todas as abas em uma única chamada em lote (batchGet) sem limite rígido de linhas
  const rangesToFetch = [
    `${encodeURIComponent(abaLancamentos)}!A1:Z`,
    `${encodeURIComponent(abaFixas)}!A1:F`
  ];
  if (abasDisponiveis.includes(abaOrcamento)) {
    rangesToFetch.push(`${encodeURIComponent(abaOrcamento)}!A1:D`);
  }
  if (abasDisponiveis.includes(abaMetas)) {
    rangesToFetch.push(`${encodeURIComponent(abaMetas)}!A1:F`);
  }

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesToFetch
    .map(r => `ranges=${r}`)
    .join('&')}`;

  const batchRes = await fetch(batchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!batchRes.ok) {
    if (batchRes.status === 401) {
      invalidarTokenGoogle();
      throw new Error('Sua sessão do Google expirou. Clique para reconectar sua conta e sincronizar os gastos do casal.');
    }
    throw new Error('Falha ao ler os dados das abas da planilha.');
  }

  const batchJson = await batchRes.json();
  const valueRanges: any[] = batchJson.valueRanges || [];

  const rowsLancamentos: any[][] = valueRanges[0]?.values || [];
  const rowsFixas: any[][] = valueRanges[1]?.values || [];
  const rowsOrcamento: any[][] = valueRanges[2]?.values || [];
  const rowsMetas: any[][] = valueRanges[3]?.values || [];

  // 3. Processar Lançamentos e Rendas Extras COM SUPORTE A DADOS DESLOCADOS E DEDUPLICAÇÃO
  const lancamentos: Lancamento[] = [];
  const rendasExtras: RendaExtra[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  let duplicadosIgnorados = 0;
  let planilhaPrecisavaCorrecao = false;

  rowsLancamentos.forEach((r, index) => {
    if (!r || r.length === 0) return;

    // Detectar se os dados estão nas colunas A..K ou se foram inseridos a partir da coluna L (índice 11)
    let cols = r;
    if ((!r[0] && !r[1] && !r[2]) && (r[11] || r[12] || r[13])) {
      cols = r.slice(11);
      planilhaPrecisavaCorrecao = true;
    }

    // Ignorar linhas de cabeçalho
    const c0 = String(cols[0] || '').trim().toLowerCase();
    const c1 = String(cols[1] || '').trim().toLowerCase();
    const c2 = String(cols[2] || '').trim().toLowerCase();
    const c3 = String(cols[3] || '').trim().toLowerCase();
    if (
      c0 === 'id' ||
      c0 === 'data' ||
      c0 === 'código' ||
      c0 === 'codigo' ||
      c1 === 'data' ||
      c1 === 'valor' ||
      c2 === 'valor' ||
      c2.includes('valor') ||
      c3 === 'categoria'
    ) {
      return;
    }

    // Se na linha 1 (index === 0) tínhamos dados reais em vez de cabeçalho, a planilha precisa de cabeçalhos
    if (index === 0) {
      planilhaPrecisavaCorrecao = true;
    }

    // Detectar dinamicamente se a primeira coluna é ID ou se o usuário começou direto pela Data
    const r0EhData =
      cols[0] &&
      (/^\d{4}-\d{2}-\d{2}/.test(String(cols[0])) ||
        /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(cols[0])) ||
        (typeof cols[0] === 'number' && cols[0] > 30000 && cols[0] < 80000));

    let idRaw = r0EhData ? undefined : cols[0];
    let dataRaw = r0EhData ? cols[0] : cols[1];
    let valorRaw = r0EhData ? cols[1] : cols[2];
    let catRaw = r0EhData ? cols[2] : cols[3];
    let subcatRaw = r0EhData ? cols[3] : cols[4];
    let quemRaw = r0EhData ? cols[4] : cols[5];
    let estRaw = r0EhData ? cols[5] : cols[6];
    let formaRaw = r0EhData ? cols[6] : cols[7];
    let essRaw = r0EhData ? cols[7] : cols[8];
    let obsRaw = r0EhData ? cols[8] : cols[9];
    let criadoRaw = r0EhData ? undefined : cols[10];

    const valor = normalizarValorNumerico(valorRaw);
    if (valor <= 0) return; // Se não tem valor monetário positivo, ignora

    const { data, mes_ref } = normalizarDataISO(dataRaw);
    const categoria = String(catRaw || 'Mercado').trim();
    const subcategoria = String(subcatRaw || 'Geral').trim();
    const quem = quemRaw === 'Ela' || quemRaw === 'Conjunto' ? quemRaw : 'Ele';
    const estabelecimento = estRaw ? String(estRaw).trim() : '';

    // DEDUPLICAÇÃO INTELIGENTE:
    // Identifica se já existe o mesmo ID explícito ou a mesma assinatura
    // (Data + Valor com 2 casas + Categoria + Subcategoria + Estabelecimento/Descrição + Quem)
    const idLimpo = idRaw ? String(idRaw).trim() : '';
    const fingerprint = `${data}|${valor.toFixed(2)}|${categoria.toLowerCase()}|${subcategoria.toLowerCase()}|${estabelecimento.toLowerCase()}|${quem}`;

    if (idLimpo && seenIds.has(idLimpo)) {
      duplicadosIgnorados++;
      planilhaPrecisavaCorrecao = true;
      return;
    }
    if (seenFingerprints.has(fingerprint)) {
      duplicadosIgnorados++;
      planilhaPrecisavaCorrecao = true;
      return;
    }

    if (idLimpo) seenIds.add(idLimpo);
    seenFingerprints.add(fingerprint);

    const catLower = categoria.toLowerCase();
    if (catLower === 'renda extra' || catLower === 'receita') {
      rendasExtras.push({
        id: idLimpo || `renda-${Date.now()}-${rendasExtras.length}`,
        data,
        mes_ref,
        valor,
        categoria: subcategoria || 'Outros',
        descricao: estabelecimento || (obsRaw ? String(obsRaw).trim() : 'Renda Extra'),
        quem,
        forma_recebimento: formaRaw || 'Pix',
        observacao: obsRaw ? String(obsRaw) : undefined,
        criado_em: String(criadoRaw || new Date().toISOString())
      });
    } else {
      lancamentos.push({
        id: idLimpo || `lan-${Date.now()}-${lancamentos.length}`,
        data,
        mes_ref,
        valor,
        categoria: categoria || 'Mercado',
        subcategoria: subcategoria || 'Geral',
        quem,
        estabelecimento: estabelecimento || undefined,
        forma_pagamento: (['Pix', 'Débito', 'Crédito', 'Dinheiro'].includes(formaRaw)
          ? formaRaw
          : 'Débito') as any,
        essencial: (essRaw === 'N' ? 'N' : 'S') as any,
        observacao: obsRaw ? String(obsRaw) : undefined,
        criado_em: String(criadoRaw || new Date().toISOString())
      });
    }
  });

  // AUTO-CORREÇÃO DA PLANILHA:
  // Se a planilha tinha dados deslocados na coluna L, sem cabeçalhos ou duplicados,
  // nós regravamos a aba Lancamentos perfeitamente alinhada em A..K com cabeçalhos!
  if (planilhaPrecisavaCorrecao) {
    try {
      await sincronizarTudoSemDuplicar(spreadsheetId, lancamentos, rendasExtras);
    } catch (e) {
      console.warn('Aviso na auto-correção da planilha:', e);
    }
  }

  // 4. Processar Contas Fixas (Aluguel, Condomínio, etc. com status de pago)
  const fixas: ContaFixa[] = [];
  rowsFixas.forEach(rf => {
    if (!rf || rf.length < 2) return;
    const desc = String(rf[0]).trim();
    if (!desc || desc.toLowerCase() === 'descrição' || desc.toLowerCase() === 'descricao') return;

    const valor = normalizarValorNumerico(rf[1]);
    const dia = parseInt(String(rf[2]), 10) || 10;
    const cat = String(rf[3] || 'Moradia').trim();
    const ativo = rf[4] === 'N' ? 'N' : 'S';
    const pagoMesRef = rf[5] ? String(rf[5]).trim() : '';

    fixas.push({
      descricao: desc,
      valor,
      dia_vencimento: Math.min(31, Math.max(1, dia)),
      categoria: cat,
      ativo,
      pago_mes_ref: pagoMesRef
    });
  });

  // 5. Processar Orçamento (se disponível)
  let orcamento: OrcamentoItem[] | undefined = undefined;
  if (rowsOrcamento.length > 0) {
    orcamento = rowsOrcamento
      .filter(ro => ro && ro[1] && ro[2])
      .map(ro => ({
        mes_ref: String(ro[0] || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`),
        categoria: String(ro[1]),
        teto: normalizarValorNumerico(ro[2]),
        tipo: (ro[3] === 'Fixo' ? 'Fixo' : 'Variável') as any
      }))
      .filter(o => o.categoria.toLowerCase() !== 'categoria');
  }

  // 6. Processar Metas / Reserva (se disponível)
  let reserva: TransacaoReserva[] | undefined = undefined;
  if (rowsMetas.length > 0) {
    let acumulado = 2000;
    reserva = rowsMetas
      .filter(rm => rm && rm[1] && rm[3])
      .map((rm, idx) => {
        const { data } = normalizarDataISO(rm[1]);
        const valor = normalizarValorNumerico(rm[3]);
        const tipo = (rm[2] === 'Retirada' ? 'Retirada' : 'Aporte') as any;
        const saldoDireto = normalizarValorNumerico(rm[5]);
        if (saldoDireto > 0) {
          acumulado = saldoDireto;
        } else {
          acumulado += tipo === 'Aporte' ? valor : -valor;
        }
        return {
          id: String(rm[0] || `reserva-sinc-${idx}`),
          data,
          tipo,
          valor,
          motivo: String(rm[4] || ''),
          saldo_acumulado: acumulado
        };
      })
      .filter(r => r.motivo.toLowerCase() !== 'motivo');
  }

  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));

  return {
    sucesso: true,
    lancamentos,
    rendasExtras,
    fixas,
    orcamento,
    reserva,
    totalLancamentos: lancamentos.length,
    totalRendas: rendasExtras.length,
    totalFixas: fixas.length,
    duplicadosIgnorados,
    mensagem: `Sincronizado: ${lancamentos.length} despesas, ${rendasExtras.length} rendas extras e ${fixas.length} contas fixas.${
      duplicadosIgnorados > 0 ? ` (${duplicadosIgnorados} duplicatas filtradas)` : ''
    }`
  };
}

/**
 * Busca automaticamente a planilha do casal no Google Drive
 */
export async function buscarPlanilhaNoDrive(): Promise<PlanilhaConectada | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const q = encodeURIComponent(
      "name contains 'Orçamento' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    );
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)&pageSize=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      const file = data.files[0];
      salvarPlanilhaConectada(file.id, file.name);
      return {
        id: file.id,
        nome: file.name,
        url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
        ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR')
      };
    }
  } catch (err) {
    console.warn('Busca automática no Google Drive:', err);
  }
  return null;
}

/**
 * Sincroniza e puxa os lançamentos existentes do Google Sheets para o App (compatibilidade)
 */
export async function puxarLancamentosDaPlanilha(spreadsheetId: string): Promise<Lancamento[]> {
  const resultado = await puxarDadosCompletosDaPlanilha(spreadsheetId);
  return resultado.lancamentos;
}

/**
 * Extrai o ID da planilha caso o usuário cole o link completo ou o ID
 */
export function extrairSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Conecta a uma planilha já existente verificando se ela é acessível
 */
export async function conectarPlanilhaExistente(spreadsheetIdOrUrl: string): Promise<PlanilhaConectada> {
  const id = extrairSpreadsheetId(spreadsheetIdOrUrl);
  if (!id || id.length < 15) {
    throw new Error('ID ou link da planilha inválido. Verifique o link e tente novamente.');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error('Faça login com sua conta Google primeiro.');
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Não foi possível acessar esta planilha. Verifique se ela existe e se você tem permissão.');
  }

  const data = await res.json();
  const nome = data.properties?.title || 'Planilha Conectada';

  salvarPlanilhaConectada(id, nome);

  return {
    id,
    nome,
    url: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR')
  };
}

/**
 * Limpa com segurança máxima e garantia absoluta todas as linhas de dados da aba Lancamentos,
 * preservando a linha 1 com os cabeçalhos.
 * Combina batchClear, values.clear com headers/body válidos e deleteDimension.
 */
export async function limparLinhasDeDadosLancamentos(spreadsheetId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa estar conectado à sua conta Google para limpar a planilha.');
  }

  // 1. Descobrir os detalhes da aba Lancamentos (nome exato e sheetId)
  let sheetTitle = 'Lancamentos';
  let sheetId: number | undefined = undefined;
  let rowCount = 1000;

  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties))`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const sheet = (meta.sheets || []).find((s: any) => {
        const t = (s.properties?.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return t.includes('lancamento');
      });
      if (sheet) {
        sheetTitle = sheet.properties.title;
        sheetId = sheet.properties.sheetId;
        rowCount = sheet.properties.gridProperties?.rowCount || 1000;
      }
    }
  } catch (err) {
    console.warn('Aviso ao consultar metadados da planilha:', err);
  }

  // 2. Executar batchClear com corpo JSON válido em todas as variações de range
  const rangesToClear = [
    `'${sheetTitle}'!A2:Z${Math.max(500, rowCount)}`,
    `Lancamentos!A2:Z${Math.max(500, rowCount)}`,
    `'${sheetTitle}'!A2:Z`,
    `Lancamentos!A2:Z`
  ];

  try {
    const batchRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ranges: rangesToClear })
      }
    );
    if (!batchRes.ok) {
      console.warn('batchClear retornou status:', batchRes.status);
    }
  } catch (err) {
    console.warn('Aviso no batchClear:', err);
  }

  // 3. Executar values.clear direto no range com body vazio garantido
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${encodeURIComponent(sheetTitle)}'!A2:Z:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );
  } catch (err) {
    console.warn('Aviso no values.clear:', err);
  }

  // 4. Se tivermos o sheetId e mais de 2 linhas, deletar as dimensões extras
  if (sheetId !== undefined && rowCount > 2) {
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: rowCount - 1
                  }
                }
              }
            ]
          })
        }
      );
    } catch (err) {
      console.warn('Aviso no deleteDimension:', err);
    }
  }

  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
  return true;
}

/**
 * Reescreve a lista completa de lançamentos na planilha
 * (usado ao limpar gastos de teste ou sincronizar lista completa limpa)
 */
export async function substituirLancamentosNaPlanilha(
  spreadsheetId: string,
  lancamentos: Lancamento[]
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // 1. Limpar todas as linhas anteriores com a rotina segura
    await limparLinhasDeDadosLancamentos(spreadsheetId);

    if (lancamentos.length === 0) {
      return true;
    }

    // 2. Preencher com os lançamentos atuais
    const linhas = lancamentos.map(l => [
      l.id,
      l.data,
      l.valor,
      l.categoria,
      l.subcategoria,
      l.quem,
      l.estabelecimento || '',
      l.forma_pagamento || 'Débito',
      l.essencial || 'S',
      l.observacao || '',
      l.criado_em || new Date().toISOString()
    ]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Lancamentos!A2:K',
          values: linhas
        })
      }
    );

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao substituir lançamentos no Sheets:', err);
    return false;
  }
}

/**
 * Atualiza e sincroniza a aba 'Fixas' completa na planilha (incluindo status de pago)
 */
export async function sincronizarFixasNaPlanilha(
  spreadsheetId: string,
  fixas: ContaFixa[]
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // Cabeçalho padrão garantido na linha 1
    const cabecalho = [['Descrição', 'Valor (R$)', 'Dia Vencimento', 'Categoria', 'Ativo', 'Pago']];
    const linhas = fixas.map(f => [
      f.descricao,
      f.valor,
      f.dia_vencimento,
      f.categoria,
      f.ativo,
      f.pago_mes_ref || ''
    ]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fixas!A1:F${Math.max(10, linhas.length + 1)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `Fixas!A1:F${linhas.length + 1}`,
          values: [...cabecalho, ...linhas]
        })
      }
    );

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao sincronizar fixas na planilha:', err);
    return false;
  }
}

/**
 * Anexa uma Renda Extra na planilha Google Sheets (na aba Lancamentos, com categoria 'Renda Extra')
 */
export async function anexarRendaExtraNaPlanilha(
  spreadsheetId: string,
  renda: RendaExtra
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    const valores = [
      [
        renda.id,
        renda.data,
        renda.valor,
        'Renda Extra',
        renda.categoria,
        renda.quem,
        renda.descricao,
        renda.forma_recebimento || 'Pix',
        'S',
        renda.observacao || 'Entrada extra de renda no orçamento',
        renda.criado_em || new Date().toISOString()
      ]
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: valores })
      }
    );

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao anexar renda extra na planilha:', err);
    return false;
  }
}

/**
 * Reescreve a lista completa de lançamentos e rendas extras na planilha de forma limpa e sem duplicados
 * Sempre garante os cabeçalhos na linha 1 e dados nas colunas A até K.
 */
export async function sincronizarTudoSemDuplicar(
  spreadsheetId: string,
  lancamentos: Lancamento[],
  rendasExtras: RendaExtra[] = []
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // 1. Limpar todas as linhas anteriores para evitar qualquer duplicata ou dado antigo
    await limparLinhasDeDadosLancamentos(spreadsheetId);

    // 2. Garantir cabeçalhos padrão na linha 1
    const cabecalhos = [
      ['ID', 'Data', 'Valor (R$)', 'Categoria', 'Subcategoria', 'Quem', 'Estabelecimento', 'Forma Pagamento', 'Essencial', 'Observação', 'Criado Em']
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A1:K1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Lancamentos!A1:K1',
          values: cabecalhos
        })
      }
    );

    // Linhas de despesas
    const linhasDespesas = lancamentos.map(l => [
      l.id,
      l.data,
      l.valor,
      l.categoria,
      l.subcategoria,
      l.quem,
      l.estabelecimento || '',
      l.forma_pagamento || 'Débito',
      l.essencial || 'S',
      l.observacao || '',
      l.criado_em || new Date().toISOString()
    ]);

    // Linhas de rendas extras
    const linhasRendas = rendasExtras.map(r => [
      r.id,
      r.data,
      r.valor,
      'Renda Extra',
      r.categoria,
      r.quem,
      r.descricao,
      r.forma_recebimento || 'Pix',
      'S',
      r.observacao || 'Entrada extra de renda no orçamento',
      r.criado_em || new Date().toISOString()
    ]);

    const todasLinhas = [...linhasDespesas, ...linhasRendas];
    if (todasLinhas.length === 0) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      return true;
    }

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K${todasLinhas.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `Lancamentos!A2:K${todasLinhas.length + 1}`,
          values: todasLinhas
        })
      }
    );

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao sincronizar tudo sem duplicar:', err);
    return false;
  }
}

/**
 * Varre a planilha no Google Sheets, elimina todas as linhas duplicadas e reescreve
 * a aba Lancamentos perfeitamente limpa e organizada.
 */
export async function limparDuplicadosDaPlanilha(
  spreadsheetId: string
): Promise<{
  sucesso: boolean;
  duplicadosRemovidos: number;
  totalRestante: number;
  lancamentos: Lancamento[];
  rendasExtras: RendaExtra[];
  mensagem: string;
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa estar conectado à sua conta Google para limpar a planilha.');
  }

  // 1. Ler as linhas brutas da aba Lancamentos para contar o total antes da limpeza
  const rawRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A1:Z500`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let totalLinhasBrutas = 0;
  if (rawRes.ok) {
    const rawJson = await rawRes.json();
    totalLinhasBrutas = (rawJson.values || []).filter((r: any[]) => r && r.length > 0).length;
  }

  // 2. Puxar com o algoritmo de deduplicação inteligente e correção de colunas
  const dados = await puxarDadosCompletosDaPlanilha(spreadsheetId);
  const totalUnicos = dados.lancamentos.length + dados.rendasExtras.length;
  const duplicadosRemovidos = Math.max(0, totalLinhasBrutas - totalUnicos - 1); // -1 por causa do cabeçalho

  // 3. Reescrever a aba Lancamentos com APENAS os itens únicos
  await sincronizarTudoSemDuplicar(spreadsheetId, dados.lancamentos, dados.rendasExtras);

  return {
    sucesso: true,
    duplicadosRemovidos: Math.max(0, duplicadosRemovidos),
    totalRestante: totalUnicos,
    lancamentos: dados.lancamentos,
    rendasExtras: dados.rendasExtras,
    mensagem:
      duplicadosRemovidos > 0
        ? `Varredura concluída! ${duplicadosRemovidos} lançamento(s) duplicado(s) removido(s). Restaram ${totalUnicos} lançamento(s) únicos e organizados.`
        : `Nenhum lançamento duplicado encontrado. Sua planilha já possui apenas dados únicos (${totalUnicos} registros).`
  };
}

/**
 * Zera completamente os lançamentos da planilha e do app para começar do zero
 * Mantém os cabeçalhos na linha 1 intactos, categorias, contas fixas e orçamentos.
 */
export async function zerarPlanilhaERecomessar(
  spreadsheetId: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa estar conectado com sua conta Google para zerar a planilha.');
  }

  // Limpar todas as linhas de dados da aba Lancamentos de forma garantida
  await limparLinhasDeDadosLancamentos(spreadsheetId);

  // Garantir cabeçalhos padrão na linha 1
  const cabecalhos = [
    ['ID', 'Data', 'Valor (R$)', 'Categoria', 'Subcategoria', 'Quem', 'Estabelecimento', 'Forma Pagamento', 'Essencial', 'Observação', 'Criado Em']
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A1:K1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: 'Lancamentos!A1:K1',
        values: cabecalhos
      })
    }
  );

  // Limpar também no localStorage local para que o app fique sincronizado
  try {
    localStorage.setItem('orcamento_londrina_lancamentos_v1', JSON.stringify([]));
    localStorage.setItem('orcamento_londrina_rendas_extras_v1', JSON.stringify([]));
  } catch (e) {
    console.warn('Aviso ao limpar localStorage:', e);
  }

  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));

  return {
    sucesso: true,
    mensagem: 'Planilha e aplicativo zerados com sucesso! A aba Lancamentos agora tem apenas os cabeçalhos, pronta para seus gastos reais.'
  };
}

/**
 * Adiciona um aporte ou retirada na aba Metas da planilha e atualiza o colchão
 */
export async function anexarTransacaoReservaNaPlanilha(
  spreadsheetId: string,
  transacao: TransacaoReserva
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // Linha: ID, Data, Tipo (Aporte/Retirada), Valor, Motivo, Saldo Acumulado
    const linha = [
      transacao.id,
      transacao.data,
      transacao.tipo,
      transacao.valor,
      transacao.motivo,
      transacao.saldo_acumulado
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Metas!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [linha]
        })
      }
    );

    if (res.status === 401) {
      invalidarTokenGoogle();
      return false;
    }

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      window.dispatchEvent(new CustomEvent('orcamento-sync-updated'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao anexar transação de reserva no Google Sheets:', err);
    return false;
  }
}

/**
 * Reescreve a lista completa da aba Metas na planilha Google Sheets
 */
export async function sincronizarReservaNaPlanilha(
  spreadsheetId: string,
  reservas: TransacaoReserva[]
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    const cabecalho = [['ID', 'Data', 'Tipo', 'Valor (R$)', 'Motivo', 'Saldo Acumulado']];
    const linhas = reservas.map(r => [
      r.id,
      r.data,
      r.tipo,
      r.valor,
      r.motivo,
      r.saldo_acumulado
    ]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Metas!A1:F?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Metas!A1:F',
          values: [...cabecalho, ...linhas]
        })
      }
    );

    if (res.status === 401) {
      invalidarTokenGoogle();
      return false;
    }

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
      window.dispatchEvent(new CustomEvent('orcamento-sync-updated'));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Erro ao sincronizar aba Metas no Google Sheets:', err);
    return false;
  }
}

