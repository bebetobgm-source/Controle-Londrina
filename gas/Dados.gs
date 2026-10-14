/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Dados.gs
 * 
 * Camada de acesso a dados com CacheService e LockService.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Orçamento Londrina')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function carregarDadosApp() {
  var cache = CacheService.getUserCache();
  var cached = cache.get('dados_app_londrina');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {}
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Config
  var config = carregarConfig(ss);
  
  // 2. Fixas
  var fixas = carregarFixas(ss);

  // 3. Orcamento
  var orcamento = carregarOrcamento(ss);

  // 4. Categorias
  var categorias = carregarCategorias(ss);

  // 5. Reserva
  var reserva = carregarReserva(ss);

  // 6. Lancamentos do mês atual
  var mesAtual = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM');
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  // 7. Alertas recentes
  var alertasLog = carregarAlertasLog(ss, mesAtual);

  // 8. Frequência de categorias para ordenar botões
  var frequenciaCategorias = calcularFrequenciaCategorias(ss);

  // 9. Estabelecimentos anteriores para autocomplete
  var estabelecimentos = carregarEstabelecimentosUnicos(ss);

  var resultado = {
    config: config,
    fixas: fixas,
    orcamento: orcamento,
    categorias: categorias,
    reserva: reserva,
    lancamentos: lancamentos,
    alertasLog: alertasLog,
    frequenciaCategorias: frequenciaCategorias,
    estabelecimentos: estabelecimentos,
    mesAtual: mesAtual,
    usuarioLogado: Session.getActiveUser().getEmail()
  };

  // Armazenar no cache por 60 segundos
  try {
    cache.put('dados_app_londrina', JSON.stringify(resultado), 60);
  } catch (e) {}

  return resultado;
}

function registrarGasto(dados) {
  var lock = LockService.getScriptLock();
  try {
    // Tenta obter o lock por até 10 segundos
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Outro lançamento estava sendo gravado ao mesmo tempo. Tente novamente em alguns segundos.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Lancamentos');
    if (!aba) {
      throw new Error('Aba Lancamentos não encontrada.');
    }

    var agora = new Date();
    var id = Utilities.getUuid();
    var dataStr = dados.data || Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
    var mesRef = dataStr.substring(0, 7);
    var timestamp = Utilities.formatDate(agora, 'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss'Z'");

    var linha = [
      id,
      dataStr,
      Number(dados.valor),
      dados.categoria,
      dados.subcategoria || '',
      dados.estabelecimento || '',
      dados.forma_pagamento || 'Débito',
      dados.quem || 'Ele',
      dados.essencial || 'S',
      dados.observacao || '',
      mesRef,
      timestamp
    ];

    aba.appendRow(linha);

    // Limpar cache após escrita
    CacheService.getUserCache().remove('dados_app_londrina');

    // Executar motor de alertas imediatamente
    var novoObj = {
      id: id,
      data: dataStr,
      valor: Number(dados.valor),
      categoria: dados.categoria,
      subcategoria: dados.subcategoria || '',
      estabelecimento: dados.estabelecimento || '',
      forma_pagamento: dados.forma_pagamento,
      quem: dados.quem,
      essencial: dados.essencial,
      observacao: dados.observacao || '',
      mes_ref: mesRef,
      criado_em: timestamp
    };

    var resultadoAlertas = avaliarAlertasBackend(novoObj);

    // Calcular impacto imediato para o feedback de 1,5s
    var feedbackImpacto = calcularFeedbackImpacto(novoObj);

    return {
      status: 'sucesso',
      id: id,
      feedbackImpacto: feedbackImpacto,
      alertas: resultadoAlertas
    };
  } finally {
    lock.releaseLock();
  }
}

function excluirLancamentoPorId(id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Não foi possível obter acesso exclusivo para desfazer o lançamento.');
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Lancamentos');
    var dados = aba.getDataRange().getValues();
    
    for (var i = 1; i < dados.length; i++) {
      if (dados[i][0] === id) {
        aba.deleteRow(i + 1);
        CacheService.getUserCache().remove('dados_app_londrina');
        return { status: 'sucesso', mensagem: 'Lançamento desfeito com sucesso.' };
      }
    }
    return { status: 'nao_encontrado', mensagem: 'Lançamento não localizado.' };
  } finally {
    lock.releaseLock();
  }
}

// Helpers de Leitura
function carregarConfig(ss) {
  var aba = ss.getSheetByName('Config');
  var dados = aba.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][0]) {
      config[dados[i][0]] = dados[i][1];
    }
  }
  return config;
}

function carregarFixas(ss) {
  var aba = ss.getSheetByName('Fixas');
  var dados = aba.getDataRange().getValues();
  var fixas = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][0]) {
      fixas.push({
        descricao: String(dados[i][0]),
        valor: Number(dados[i][1]),
        dia_vencimento: Number(dados[i][2]),
        categoria: String(dados[i][3]),
        ativo: String(dados[i][4]),
        pago_mes_ref: String(dados[i][5] || '')
      });
    }
  }
  return fixas;
}

function carregarOrcamento(ss) {
  var aba = ss.getSheetByName('Orcamento');
  var dados = aba.getDataRange().getValues();
  var itens = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][1]) {
      itens.push({
        mes_ref: String(dados[i][0]),
        categoria: String(dados[i][1]),
        teto: Number(dados[i][2]),
        tipo: String(dados[i][3])
      });
    }
  }
  return itens;
}

function carregarCategorias(ss) {
  var aba = ss.getSheetByName('Categorias');
  var dados = aba.getDataRange().getValues();
  var cats = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][0]) {
      cats.push({
        categoria: String(dados[i][0]),
        subcategoria: String(dados[i][1]),
        ativo: String(dados[i][2])
      });
    }
  }
  return cats;
}

function carregarReserva(ss) {
  var aba = ss.getSheetByName('Reserva');
  var dados = aba.getDataRange().getValues();
  var res = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][1]) {
      res.push({
        data: dados[i][0],
        valor: Number(dados[i][1]),
        tipo: String(dados[i][2]),
        motivo: String(dados[i][3]),
        saldo_acumulado: Number(dados[i][4])
      });
    }
  }
  return res;
}

function carregarLancamentosMes(ss, mesRef) {
  var aba = ss.getSheetByName('Lancamentos');
  var dados = aba.getDataRange().getValues();
  var lancs = [];
  for (var i = 1; i < dados.length; i++) {
    var ref = String(dados[i][10]);
    if (ref === mesRef || !mesRef) {
      lancs.push({
        id: String(dados[i][0]),
        data: dados[i][1] instanceof Date ? Utilities.formatDate(dados[i][1], 'America/Sao_Paulo', 'yyyy-MM-dd') : String(dados[i][1]),
        valor: Number(dados[i][2]),
        categoria: String(dados[i][3]),
        subcategoria: String(dados[i][4]),
        estabelecimento: String(dados[i][5] || ''),
        forma_pagamento: String(dados[i][6]),
        quem: String(dados[i][7]),
        essencial: String(dados[i][8]),
        observacao: String(dados[i][9] || ''),
        mes_ref: ref,
        criado_em: String(dados[i][11] || '')
      });
    }
  }
  return lancs.reverse(); // Mais recentes primeiro
}

function carregarAlertasLog(ss, mesRef) {
  var aba = ss.getSheetByName('Alertas_Log');
  var dados = aba.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][1]) {
      logs.push({
        data_hora: String(dados[i][0]),
        tipo: String(dados[i][1]),
        severidade: String(dados[i][2]),
        mensagem: String(dados[i][3]),
        lido: String(dados[i][4]),
        mes_ref: String(dados[i][5])
      });
    }
  }
  return logs.reverse();
}

function calcularFrequenciaCategorias(ss) {
  var aba = ss.getSheetByName('Lancamentos');
  var dados = aba.getDataRange().getValues();
  var contagem = {};
  for (var i = 1; i < dados.length; i++) {
    var cat = dados[i][3];
    if (cat) {
      contagem[cat] = (contagem[cat] || 0) + 1;
    }
  }
  return contagem;
}

function carregarEstabelecimentosUnicos(ss) {
  var aba = ss.getSheetByName('Lancamentos');
  var dados = aba.getDataRange().getValues();
  var set = {};
  for (var i = 1; i < dados.length; i++) {
    var est = dados[i][5];
    if (est && typeof est === 'string' && est.trim()) {
      set[est.trim()] = true;
    }
  }
  return Object.keys(set).slice(0, 30);
}
