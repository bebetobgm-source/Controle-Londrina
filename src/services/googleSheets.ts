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
 * Sincroniza e puxa os lançamentos existentes do Google Sheets para o App
 */
export async function puxarLancamentosDaPlanilha(spreadsheetId: string): Promise<Lancamento[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Você precisa fazer login com o Google para sincronizar.');
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Lancamentos!A2:K`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  if (!res.ok) {
    throw new Error('Não foi possível ler os lançamentos da planilha.');
  }

  const json = await res.json();
  const rows: any[][] = json.values || [];

  const lancamentos: Lancamento[] = rows
    .filter(r => r[0] && r[1] && r[2])
    .map((r, index) => {
      const valorNumerico = typeof r[2] === 'number'
        ? r[2]
        : parseFloat(String(r[2]).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

      const dataStr = String(r[1] || new Date().toISOString().split('T')[0]);
      const mesRef = dataStr.substring(0, 7);

      return {
        id: String(r[0] || `sinc-${index}-${Date.now()}`),
        data: dataStr,
        valor: valorNumerico,
        categoria: String(r[3] || 'Mercado'),
        subcategoria: String(r[4] || 'Geral'),
        quem: (r[5] === 'Ela' || r[5] === 'Conjunto' ? r[5] : 'Ele') as any,
        estabelecimento: r[6] ? String(r[6]) : undefined,
        forma_pagamento: (['Pix', 'Débito', 'Crédito', 'Dinheiro'].includes(r[7]) ? r[7] : 'Débito') as any,
        essencial: (r[8] === 'N' ? 'N' : 'S') as any,
        observacao: r[9] ? String(r[9]) : undefined,
        mes_ref: mesRef,
        criado_em: String(r[10] || new Date().toISOString())
      };
    });

  localStorage.setItem(SHEETS_STORAGE_KEYS.LAST_SYNC, new Date().toLocaleTimeString('pt-BR'));
  return lancamentos;
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


