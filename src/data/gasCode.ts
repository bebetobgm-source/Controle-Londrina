/**
 * Arquivo: src/data/gasCode.ts
 * Exporta os códigos dos arquivos do Google Apps Script para visualização no app
 */

export const gasFiles: Record<string, string> = {
  'Inicializar.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Inicializar.gs
 */
function inicializarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  criarAbaLancamentos(ss);
  criarAbaFixas(ss);
  criarAbaOrcamento(ss);
  criarAbaCategorias(ss);
  criarAbaReserva(ss);
  criarAbaConfig(ss);
  criarAbaAlertasLog(ss);
  SpreadsheetApp.flush();
  return { status: "sucesso", mensagem: "Planilha inicializada com sucesso!" };
}

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Orçamento Londrina')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}`,

  'Dados.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Dados.gs
 */
function carregarDadosApp() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    config: carregarConfig(ss),
    fixas: carregarFixas(ss),
    orcamento: carregarOrcamento(ss),
    categorias: carregarCategorias(ss),
    reserva: carregarReserva(ss),
    statusRitmo: calcularStatusRitmoBackend()
  };
}

function registrarGasto(dados) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Lancamentos');
    var id = 'lanc_' + new Date().getTime();
    var agora = new Date();
    var dataStr = dados.data || Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM-dd');
    var mesRef = dataStr.substring(0, 7);

    aba.appendRow([
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
      new Date().toISOString()
    ]);

    CacheService.getUserCache().remove('dados_app_londrina');
    var alertas = verificarAlertasAposLancamento(dados);
    var feedback = gerarFeedbackImpacto(dados.categoria);

    return {
      status: 'sucesso',
      id: id,
      feedbackImpacto: feedback,
      alertas: alertas
    };
  } finally {
    lock.releaseLock();
  }
}

function excluirLancamentoPorId(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var aba = ss.getSheetByName('Lancamentos');
    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if (dados[i][0] === id) {
        aba.deleteRow(i + 1);
        CacheService.getUserCache().remove('dados_app_londrina');
        return { status: 'sucesso' };
      }
    }
    return { status: 'nao_encontrado' };
  } finally {
    lock.releaseLock();
  }
}`,

  'Calculos.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Calculos.gs
 */
function calcularStatusRitmoBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');

  var orcamento = carregarOrcamento(ss);
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  var tetoVariavelTotal = 0;
  for (var i = 0; i < orcamento.length; i++) {
    if (orcamento[i].tipo === 'Variável') tetoVariavelTotal += orcamento[i].teto;
  }

  var gastoVariavelTotal = 0;
  for (var j = 0; j < lancamentos.length; j++) {
    gastoVariavelTotal += lancamentos[j].valor;
  }

  var percentualMes = diaAtual / totalDiasMes;
  var percentualGasto = tetoVariavelTotal > 0 ? gastoVariavelTotal / tetoVariavelTotal : 0;
  var indiceRitmo = percentualMes > 0 ? percentualGasto / percentualMes : 1;
  var diasRestantes = Math.max(1, totalDiasMes - diaAtual + 1);
  var disponivelPorDia = Math.max(0, (tetoVariavelTotal - gastoVariavelTotal) / diasRestantes);

  var cor = 'verde';
  var estado = 'Verde';
  var explicacao = 'O ritmo de gastos está alinhado com o esperado para o dia ' + diaAtual + '.';

  if (indiceRitmo <= 0.80) {
    cor = 'verde';
    estado = 'Verde Folgado';
    explicacao = 'Gastos 20% abaixo do esperado. Ótimo ritmo.';
  } else if (indiceRitmo <= 1.05) {
    cor = 'verde';
    estado = 'Verde';
  } else if (indiceRitmo <= 1.15) {
    cor = 'amarelo';
    estado = 'Amarelo';
    explicacao = 'Atenção: ritmo ligeiramente acima do sustentável.';
  } else if (indiceRitmo <= 1.30) {
    cor = 'laranja';
    estado = 'Laranja';
    explicacao = 'Alerta: gastos 15% a 30% acima da velocidade do mês.';
  } else {
    cor = 'vermelho';
    estado = 'Vermelho';
    explicacao = 'Crítico: gastos mais de 30% acima do trajeto planejado.';
  }

  return {
    diaAtual: diaAtual,
    totalDiasMes: totalDiasMes,
    gastoVariavelTotal: gastoVariavelTotal,
    tetoVariavelTotal: tetoVariavelTotal,
    disponivelPorDia: disponivelPorDia,
    indiceRitmo: indiceRitmo,
    cor: cor,
    estado: estado,
    explicacao: explicacao
  };
}`,

  'Alertas.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Alertas.gs
 * Regras 1 a 7 do Motor de Alertas
 */
function verificarAlertasAposLancamento(novoLancamento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = carregarConfig(ss);
  if (config.alertas_ativos !== 'SIM') return [];

  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');

  var lancamentos = carregarLancamentosMes(ss, mesAtual);
  var orcamento = carregarOrcamento(ss);
  var fixas = carregarFixas(ss);
  var reserva = carregarReserva(ss);

  var alertas = [];

  // REGRA 5 - FIXAS DESCOBERTAS
  var fixasAVencer = 0;
  for (var f = 0; f < fixas.length; f++) {
    if (fixas[f].ativo === 'S' && fixas[f].pago_mes_ref !== mesAtual && fixas[f].dia_vencimento >= diaAtual) {
      fixasAVencer += fixas[f].valor;
    }
  }
  var gastoGeral = 0;
  for (var g = 0; g < lancamentos.length; g++) gastoGeral += lancamentos[g].valor;
  var saldoDisponivel = Number(config.renda_liquida_mensal) - gastoGeral;

  if (saldoDisponivel < fixasAVencer) {
    alertas.push({
      tipo: 'Fixas Descobertas',
      severidade: 'vermelho',
      mensagem: 'As contas fixas que faltam somam ' + formatarReais(fixasAVencer) + ' e o disponível é ' + formatarReais(saldoDisponivel) + '. Faltam ' + formatarReais(fixasAVencer - saldoDisponivel) + ' para cobrir o essencial.'
    });
  }

  // Grava na aba Alertas_Log
  var abaLog = ss.getSheetByName('Alertas_Log');
  for (var a = 0; a < alertas.length; a++) {
    abaLog.appendRow([
      'alt_' + new Date().getTime(),
      new Date().toISOString(),
      alertas[a].tipo,
      alertas[a].severidade,
      alertas[a].mensagem,
      'N',
      mesAtual
    ]);
  }

  return alertas;
}`,

  'Conselheiro.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Conselheiro.gs
 */
function gerarConselhoBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var statusGeral = calcularStatusRitmoBackend();

  return {
    ondeEstamos: 'Hoje é dia ' + diaAtual + '. Foram gastos ' + formatarReais(statusGeral.gastoVariavelTotal) + ' dos ' + formatarReais(statusGeral.tetoVariavelTotal) + ' variáveis.',
    porQue: 'Desvio pontual concentrado nas compras do início da quinzena.',
    oQueFazer: 'Manter a cota diária de ' + formatarReais(statusGeral.disponivelPorDia) + ' até o final do mês.'
  };
}`,

  'Notificacoes.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Notificacoes.gs
 */
function rotinaDiaria20h() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = carregarConfig(ss);
  if (config.alertas_ativos !== 'SIM') return;

  var statusGeral = calcularStatusRitmoBackend();
  // Nunca envie e-mail de rotina quando está tudo verde!
  if (statusGeral.cor === 'verde') return;

  var emails = [config.email_1, config.email_2].filter(function(e) { return e && e.indexOf('@') !== -1; });
  if (emails.length === 0) return;

  MailApp.sendEmail({
    to: emails.join(','),
    subject: 'Aviso de Orçamento: Ritmo ' + statusGeral.estado,
    body: 'O ritmo do mês está em ' + statusGeral.estado + '. Limite restante: ' + formatarReais(statusGeral.disponivelPorDia) + '/dia.'
  });
}`,

  'Gatilhos.gs': `/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Gatilhos.gs
 */
function instalarGatilhos() {
  removerGatilhos();
  ScriptApp.newTrigger('rotinaDiaria20h').timeBased().everyDays(1).atHour(20).create();
  ScriptApp.newTrigger('resumoSemanalDomingo20h').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).create();
  return { status: 'sucesso', mensagem: 'Gatilhos instalados!' };
}

function removerGatilhos() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}`,

  'Index.html': `<!-- Arquivo HTML do Web App para o Apps Script -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento Londrina</title>
</head>
<body>
  <!-- Interface Mobile-first com teclado numérico, semáforo e conselheiro -->
</body>
</html>`
};
