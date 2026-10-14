/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Calculos.gs
 * 
 * Funções matemáticas de ritmo, impacto imediato e projeções.
 */

function calcularFeedbackImpacto(novoLancamento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var mesAtual = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM');
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var diasRestantes = Math.max(1, totalDiasMes - diaAtual + 1);

  var orcamentos = carregarOrcamento(ss);
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  var itemOrcamento = null;
  for (var i = 0; i < orcamentos.length; i++) {
    if (orcamentos[i].categoria === novoLancamento.categoria) {
      itemOrcamento = orcamentos[i];
      break;
    }
  }

  var gastoNaCategoria = 0;
  for (var j = 0; j < lancamentos.length; j++) {
    if (lancamentos[j].categoria === novoLancamento.categoria) {
      gastoNaCategoria += lancamentos[j].valor;
    }
  }

  var teto = itemOrcamento ? itemOrcamento.teto : 0;
  var restante = Math.max(0, teto - gastoNaCategoria);
  var porDia = diasRestantes > 0 ? (restante / diasRestantes) : 0;

  var catNome = novoLancamento.categoria.toLowerCase();
  var textoRestante = formatarReais(restante);
  var textoPorDia = formatarReais(porDia);

  return 'Registrado. Restam ' + textoRestante + ' de ' + catNome + ' para ' + diasRestantes + ' dias, ou seja ' + textoPorDia + ' por dia.';
}

function formatarReais(valor) {
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function calcularStatusRitmoBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');

  var orcamento = carregarOrcamento(ss);
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  var tetoVariavelTotal = 0;
  var categoriasVariaveis = {};
  for (var i = 0; i < orcamento.length; i++) {
    if (orcamento[i].tipo === 'Variável') {
      tetoVariavelTotal += orcamento[i].teto;
      categoriasVariaveis[orcamento[i].categoria] = true;
    }
  }

  var gastoVariavelTotal = 0;
  for (var j = 0; j < lancamentos.length; j++) {
    if (categoriasVariaveis[lancamentos[j].categoria]) {
      gastoVariavelTotal += lancamentos[j].valor;
    }
  }

  var percentualDoMes = diaAtual / totalDiasMes;
  var percentualGasto = tetoVariavelTotal > 0 ? gastoVariavelTotal / tetoVariavelTotal : 0;
  var indiceRitmo = percentualDoMes > 0 ? percentualGasto / percentualDoMes : 1.0;

  var diasRestantes = Math.max(1, totalDiasMes - diaAtual + 1);
  var saldoRestante = Math.max(0, tetoVariavelTotal - gastoVariavelTotal);
  var disponivelPorDia = diasRestantes > 0 ? saldoRestante / diasRestantes : 0;

  var estado = 'Verde';
  var cor = 'verde';
  var explicacao = '';

  if (diaAtual <= 3) {
    estado = 'Verde';
    cor = 'verde';
    explicacao = 'Início do mês (compra grande esperada no período).';
  } else if (indiceRitmo <= 0.90) {
    estado = 'Verde folgado';
    cor = 'verde';
    explicacao = 'Ritmo excelente. Gastando abaixo do teto diário sustentável.';
  } else if (indiceRitmo <= 1.10) {
    estado = 'Verde';
    cor = 'verde';
    explicacao = 'Ritmo dentro do plano previsto.';
  } else if (indiceRitmo <= 1.30) {
    estado = 'Amarelo';
    cor = 'amarelo';
    explicacao = 'Atenção: ritmo acelerado em relação aos dias decorridos.';
  } else if (indiceRitmo <= 1.60) {
    estado = 'Laranja';
    cor = 'laranja';
    explicacao = 'Alerta: ritmo de gasto acima da rota sustentável.';
  } else {
    estado = 'Vermelho';
    cor = 'vermelho';
    explicacao = 'Crítico: risco iminente de estouro orçamentário.';
  }

  return {
    diaAtual: diaAtual,
    totalDiasMes: totalDiasMes,
    diasRestantes: diasRestantes,
    percentualDoMes: percentualDoMes,
    percentualGasto: percentualGasto,
    indiceRitmo: indiceRitmo,
    estado: estado,
    cor: cor,
    explicacao: explicacao,
    gastoVariavelTotal: gastoVariavelTotal,
    tetoVariavelTotal: tetoVariavelTotal,
    disponivelPorDia: disponivelPorDia
  };
}
