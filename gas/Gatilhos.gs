/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Gatilhos.gs
 * 
 * Instalação e gerenciamento dos gatilhos de tempo automáticos.
 */

function instalarGatilhos() {
  // 1. Remover gatilhos antigos para evitar duplicatas
  removerGatilhos();

  // 2. Gatilho Diário às 20h (rotinaDiaria20h)
  ScriptApp.newTrigger('rotinaDiaria20h')
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .nearMinute(0)
    .inTimezone('America/Sao_Paulo')
    .create();

  // 3. Gatilho Semanal Domingo às 20h (resumoSemanalDomingo20h)
  ScriptApp.newTrigger('resumoSemanalDomingo20h')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .nearMinute(0)
    .inTimezone('America/Sao_Paulo')
    .create();

  // 4. Gatilho Diário para verificar fechamento do mês (às 21h)
  ScriptApp.newTrigger('verificarUltimoDiaMes')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .nearMinute(0)
    .inTimezone('America/Sao_Paulo')
    .create();

  return {
    status: 'sucesso',
    mensagem: 'Gatilhos instalados: diário às 20h, semanal domingo às 20h e verificação de fechamento.'
  };
}

function verificarUltimoDiaMes() {
  var hoje = new Date();
  var amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  // Se o mês de amanhã for diferente, hoje é o último dia do mês
  if (amanha.getMonth() !== hoje.getMonth()) {
    fechamentoDoMes();
  }
}

function removerGatilhos() {
  var todos = ScriptApp.getProjectTriggers();
  for (var i = 0; i < todos.length; i++) {
    var fn = todos[i].getHandlerFunction();
    if (fn === 'rotinaDiaria20h' || fn === 'resumoSemanalDomingo20h' || fn === 'verificarUltimoDiaMes') {
      ScriptApp.deleteTrigger(todos[i]);
    }
  }
}
