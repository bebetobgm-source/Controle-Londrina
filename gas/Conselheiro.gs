/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Conselheiro.gs
 * 
 * O Conselheiro: Projeção Linear, Ajustada, Consequências e Ajuste de Tetos.
 */

function gerarConselhoBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');

  var config = carregarConfig(ss);
  var fixas = carregarFixas(ss);
  var orcamento = carregarOrcamento(ss);
  var lancamentos = carregarLancamentosMes(ss, mesAtual);
  var reserva = carregarReserva(ss);

  var statusGeral = calcularStatusRitmoBackend();

  // Projeção Ajustada
  var fixasTotal = 0;
  for (var f = 0; f < fixas.length; f++) {
    if (fixas[f].ativo === 'S') fixasTotal += fixas[f].valor;
  }
  
  var comprasMercado = [];
  var gastoGeral = 0;
  for (var l = 0; l < lancamentos.length; l++) {
    gastoGeral += lancamentos[l].valor;
    if (lancamentos[l].categoria === 'Mercado') comprasMercado.push(lancamentos[l].valor);
  }
  var maiorCompraMercado = comprasMercado.length > 0 ? Math.max.apply(null, comprasMercado) : 0;

  var gastoDifuso = Math.max(0, gastoGeral - maiorCompraMercado);
  var projecaoDifuso = (gastoDifuso / Math.max(1, diaAtual)) * totalDiasMes;
  var projecaoAjustada = maiorCompraMercado + fixasTotal + projecaoDifuso;
  var projecaoLinear = (gastoGeral / Math.max(1, diaAtual)) * totalDiasMes;

  var deficit = Math.max(0, projecaoAjustada - Number(config.renda_liquida_mensal));
  var saldoColchao = reserva.length > 0 ? reserva[reserva.length - 1].saldo_acumulado : 2000;

  var ondeEstamos = '';
  var porQue = '';
  var oQueFazer = '';

  if (statusGeral.cor === 'verde') {
    ondeEstamos = 'Hoje é dia ' + diaAtual + '. Foram gastos ' + formatarReais(statusGeral.gastoVariavelTotal) + ' dos ' + formatarReais(statusGeral.tetoVariavelTotal) + ' variáveis. Restam ' + formatarReais(statusGeral.disponivelPorDia) + ' por dia até o fim do mês.';
    porQue = 'O ritmo está em ' + Math.round(statusGeral.indiceRitmo * 100) + '% da rota prevista.';
    oQueFazer = 'Mantenha as reposições de mercado no limite semanal para garantir o aporte de ' + formatarReais(config.meta_reserva_mensal) + ' na reserva.';
  } else {
    ondeEstamos = 'Dia ' + diaAtual + '. O gasto variável é de ' + formatarReais(statusGeral.gastoVariavelTotal) + ', projetando fechamento com déficit de ' + formatarReais(deficit) + '.';
    porQue = 'Desvio acumulado nas categorias variáveis acima da velocidade permitida do mês.';
    oQueFazer = 'Conter o gasto variável em ' + formatarReais(statusGeral.disponivelPorDia) + ' por dia nos próximos ' + (totalDiasMes - diaAtual) + ' dias.';
  }

  var consequencias = null;
  if (deficit > 0) {
    var percColchao = Math.round((deficit / saldoColchao) * 100);
    var despesaFixaDiaria = fixasTotal / 30;
    var diasColchao = (deficit / Math.max(1, despesaFixaDiaria)).toFixed(1);
    var tetoMercadoAtual = 1200;
    var novoTetoMercado = Math.max(800, tetoMercadoAtual - deficit);
    var corteSemanal = Math.round((tetoMercadoAtual - novoTetoMercado) / 4);

    consequencias = {
      diasColchao: 'Um déficit de ' + formatarReais(deficit) + ' consome ' + percColchao + '% do colchão, que é o equivalente a ' + diasColchao + ' dias de despesa fixa da casa.',
      atrasoMeta: 'Com este resultado, o colchão de ' + formatarReais(config.colchao_meta) + ' atrasa em aproximadamente 1 a 2 meses.',
      novoTetoSugerido: {
        categoria: 'Mercado',
        tetoAtual: tetoMercadoAtual,
        novoTeto: novoTetoMercado,
        texto: 'Para recompor, o teto de mercado precisaria cair de ' + formatarReais(tetoMercadoAtual) + ' para ' + formatarReais(novoTetoMercado) + ', o que significa cortar ' + formatarReais(corteSemanal) + ' por semana em hortifrúti.'
      }
    };
  }

  return {
    ondeEstamos: ondeEstamos,
    porQue: porQue,
    oQueFazer: oQueFazer,
    projecaoLinear: projecaoLinear,
    projecaoAjustada: projecaoAjustada,
    deficit: deficit,
    consequencias: consequencias
  };
}

function aplicarNovoTetoOrcamento(categoria, novoTeto) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Orcamento');
    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if (dados[i][1] === categoria) {
        aba.getRange(i + 1, 3).setValue(Number(novoTeto));
        CacheService.getUserCache().remove('dados_app_londrina');
        return { status: 'sucesso', mensagem: 'Teto de ' + categoria + ' atualizado para ' + formatarReais(novoTeto) };
      }
    }
    return { status: 'erro', mensagem: 'Categoria não encontrada no orçamento.' };
  } finally {
    lock.releaseLock();
  }
}
