import { Lancamento, RendaExtra, ContaFixa, OrcamentoItem, TransacaoReserva } from '../types';
import { getAccessToken } from './googleAuth';
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

    if (res.ok) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
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
    const erroJson = await metaRes.json().catch(() => ({}));
    throw new Error(
      erroJson.error?.message ||
        'Não foi possível acessar a planilha. Verifique as permissões da sua conta Google.'
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

  // 2. Buscar todas as abas em uma única chamada em lote (batchGet)
  const rangesToFetch = [
    `${encodeURIComponent(abaLancamentos)}!A2:K`,
    `${encodeURIComponent(abaFixas)}!A2:F`
  ];
  if (abasDisponiveis.includes(abaOrcamento)) {
    rangesToFetch.push(`${encodeURIComponent(abaOrcamento)}!A2:D`);
  }
  if (abasDisponiveis.includes(abaMetas)) {
    rangesToFetch.push(`${encodeURIComponent(abaMetas)}!A2:E`);
  }

  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesToFetch
    .map(r => `ranges=${r}`)
    .join('&')}`;

  const batchRes = await fetch(batchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!batchRes.ok) {
    throw new Error('Falha ao ler os dados das abas da planilha.');
  }

  const batchJson = await batchRes.json();
  const valueRanges: any[] = batchJson.valueRanges || [];

  const rowsLancamentos: any[][] = valueRanges[0]?.values || [];
  const rowsFixas: any[][] = valueRanges[1]?.values || [];
  const rowsOrcamento: any[][] = valueRanges[2]?.values || [];
  const rowsMetas: any[][] = valueRanges[3]?.values || [];

  // 3. Processar Lançamentos e Rendas Extras COM DEDUPLICAÇÃO INTELIGENTE
  const lancamentos: Lancamento[] = [];
  const rendasExtras: RendaExtra[] = [];
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  let duplicadosIgnorados = 0;

  rowsLancamentos.forEach((r, index) => {
    if (!r || r.length === 0) return;

    // Ignorar linhas de cabeçalho que tenham sido inseridas ou coladas no meio
    const c0 = String(r[0] || '').trim().toLowerCase();
    const c1 = String(r[1] || '').trim().toLowerCase();
    const c2 = String(r[2] || '').trim().toLowerCase();
    if (
      c0 === 'id' ||
      c0 === 'data' ||
      c1 === 'data' ||
      c1 === 'valor' ||
      c2 === 'valor' ||
      c0.startsWith('código') ||
      c0.startsWith('codigo')
    ) {
      return;
    }

    // Detectar dinamicamente se a coluna A é ID ou se o usuário começou direto pela Data
    const r0EhData =
      r[0] &&
      (/^\d{4}-\d{2}-\d{2}/.test(String(r[0])) ||
        /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(r[0])) ||
        (typeof r[0] === 'number' && r[0] > 30000 && r[0] < 80000));

    let idRaw = r0EhData ? undefined : r[0];
    let dataRaw = r0EhData ? r[0] : r[1];
    let valorRaw = r0EhData ? r[1] : r[2];
    let catRaw = r0EhData ? r[2] : r[3];
    let subcatRaw = r0EhData ? r[3] : r[4];
    let quemRaw = r0EhData ? r[4] : r[5];
    let estRaw = r0EhData ? r[5] : r[6];
    let formaRaw = r0EhData ? r[6] : r[7];
    let essRaw = r0EhData ? r[7] : r[8];
    let obsRaw = r0EhData ? r[8] : r[9];
    let criadoRaw = r0EhData ? undefined : r[10];

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
      return;
    }
    if (seenFingerprints.has(fingerprint)) {
      duplicadosIgnorados++;
      return;
    }

    if (idLimpo) seenIds.add(idLimpo);
    seenFingerprints.add(fingerprint);

    const catLower = categoria.toLowerCase();
    if (catLower === 'renda extra' || catLower === 'receita') {
      rendasExtras.push({
        id: idLimpo || `renda-sinc-${index}-${Date.now()}`,
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
        id: idLimpo || `sinc-${index}-${Date.now()}`,
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

  // 4. Processar Contas Fixas (Aluguel, Condomínio, etc. com valores editados)
  const fixas: ContaFixa[] = [];
  rowsFixas.forEach(rf => {
    if (!rf || rf.length < 2) return;
    const desc = String(rf[0]).trim();
    if (!desc || desc.toLowerCase() === 'descrição' || desc.toLowerCase() === 'descricao') return;

    const valor = normalizarValorNumerico(rf[1]);
    const dia = parseInt(String(rf[2]), 10) || 10;
    const cat = String(rf[3] || 'Moradia').trim();
    const ativo = rf[4] === 'N' ? 'N' : 'S';
    const pagoMesRef = rf[5] ? String(rf[5]).trim() : undefined;

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

    // 1. Limpar todas as linhas de dados a partir da linha 2
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (lancamentos.length === 0) {
      localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
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
 * Atualiza e sincroniza a aba 'Fixas' completa na planilha
 */
export async function sincronizarFixasNaPlanilha(
  spreadsheetId: string,
  fixas: ContaFixa[]
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // 1. Limpar linhas anteriores
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fixas!A2:F:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (fixas.length === 0) return true;

    // 2. Preencher com as fixas atuais
    const linhas = fixas.map(f => [
      f.descricao,
      f.valor,
      f.dia_vencimento,
      f.categoria,
      f.ativo,
      f.pago_mes_ref || ''
    ]);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Fixas!A2:F?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Fixas!A2:F',
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
 */
export async function sincronizarTudoSemDuplicar(
  spreadsheetId: string,
  lancamentos: Lancamento[],
  rendasExtras: RendaExtra[] = []
): Promise<boolean> {
  try {
    const token = await getAccessToken();
    if (!token) return false;

    // 1. Limpar todas as linhas de dados a partir da linha 2
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
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
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: 'Lancamentos!A2:K',
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let totalLinhasBrutas = 0;
  if (rawRes.ok) {
    const rawJson = await rawRes.json();
    totalLinhasBrutas = (rawJson.values || []).filter((r: any[]) => r && r.length > 0).length;
  }

  // 2. Puxar com o algoritmo de deduplicação inteligente
  const dados = await puxarDadosCompletosDaPlanilha(spreadsheetId);
  const totalUnicos = dados.lancamentos.length + dados.rendasExtras.length;
  const duplicadosRemovidos = Math.max(0, totalLinhasBrutas - totalUnicos);

  // 3. Reescrever a aba Lancamentos com APENAS os itens únicos
  await sincronizarTudoSemDuplicar(spreadsheetId, dados.lancamentos, dados.rendasExtras);

  return {
    sucesso: true,
    duplicadosRemovidos,
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
 * Mantém os cabeçalhos, categorias, contas fixas e orçamentos intactos.
 */
export async function zerarPlanilhaERecomessar(
  spreadsheetId: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa estar conectado com sua conta Google para zerar a planilha.');
  }

  // Limpar todas as linhas da aba Lancamentos a partir da linha 2
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    throw new Error('Não foi possível limpar a aba Lancamentos na sua planilha Google Sheets.');
  }

  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));

  return {
    sucesso: true,
    mensagem: 'Planilha e aplicativo zerados com sucesso! Prontos para começar seus lançamentos reais do zero.'
  };
}
