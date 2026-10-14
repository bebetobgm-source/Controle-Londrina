/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Notificacoes.gs
 * 
 * Regras de envio de e-mail via MailApp e Webhook n8n para WhatsApp.
 */

function enviarAlertaExterno(alerta, config) {
  var emails = [];
  if (config.email_1 && config.email_1.indexOf('@') !== -1) emails.push(config.email_1);
  if (config.email_2 && config.email_2.indexOf('@') !== -1) emails.push(config.email_2);

  if (emails.length > 0) {
    var assunto = '⚠️ [' + alerta.severidade.toUpperCase() + '] ' + alerta.tipo + ' - Orçamento Londrina';
    var corpo = alerta.mensagem + '\n\nAcesse o aplicativo para ver as recomendações de ajuste.';
    try {
      MailApp.sendEmail({
        to: emails.join(','),
        subject: assunto,
        body: corpo
      });
    } catch (e) {
      Logger.log('Erro ao enviar e-mail de alerta: ' + e.message);
    }
  }

  // Webhook n8n opcional
  if (config.webhook_n8n && config.webhook_n8n.indexOf('http') === 0) {
    try {
      var payload = JSON.stringify({
        tipo: alerta.tipo,
        severidade: alerta.severidade,
        mensagem: alerta.mensagem,
        timestamp: new Date().toISOString()
      });
      UrlFetchApp.fetch(config.webhook_n8n, {
        method: 'post',
        contentType: 'application/json',
        payload: payload,
        muteHttpExceptions: true
      });
    } catch (e) {
      Logger.log('Erro ao enviar webhook n8n: ' + e.message);
    }
  }
}

// Executado diariamente às 20h pelo gatilho de tempo
function rotinaDiaria20h() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = carregarConfig(ss);
  if (config.alertas_ativos !== 'SIM') return;

  var statusGeral = calcularStatusRitmoBackend();
  var agora = new Date();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  // Verificar se não houve nenhum lançamento em 3 dias
  var semLancamentosEm3Dias = false;
  if (lancamentos.length === 0 && agora.getDate() >= 3) {
    semLancamentosEm3Dias = true;
  } else if (lancamentos.length > 0) {
    var ultimoLancData = new Date(lancamentos[0].data);
    var diffDias = (agora.getTime() - ultimoLancData.getTime()) / (1000 * 3600 * 24);
    if (diffDias >= 3) {
      semLancamentosEm3Dias = true;
    }
  }

  // REGRA DE OURO: Nunca envie e-mail de rotina quando está tudo verde!
  // Apenas se houver alerta amarelo ou pior, ou se não houve nenhum lançamento em 3 dias.
  var precisaEnviar = statusGeral.cor !== 'verde' || semLancamentosEm3Dias;

  if (!precisaEnviar) {
    Logger.log('Dia verde e lançamentos em dia. Nenhum e-mail enviado para evitar ruído.');
    return;
  }

  var emails = [];
  if (config.email_1 && config.email_1.indexOf('@') !== -1) emails.push(config.email_1);
  if (config.email_2 && config.email_2.indexOf('@') !== -1) emails.push(config.email_2);

  if (emails.length === 0) return;

  var assunto = 'Aviso de Orçamento: ' + (semLancamentosEm3Dias ? '3 dias sem registros' : 'Ritmo ' + statusGeral.estado);
  var texto = semLancamentosEm3Dias
    ? 'Faz 3 dias que nenhum gasto foi registrado. Abram o app e lancem as despesas do período para manter as projeções confiáveis.'
    : 'O ritmo do mês está em ' + statusGeral.estado + ' (' + Math.round(statusGeral.indiceRitmo * 100) + '% da rota sustentável). Limite diário restante: ' + formatarReais(statusGeral.disponivelPorDia) + '.';

  MailApp.sendEmail({
    to: emails.join(','),
    subject: assunto,
    body: texto
  });
}

// Executado aos domingos às 20h pelo gatilho de tempo
function resumoSemanalDomingo20h() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = carregarConfig(ss);
  var statusGeral = calcularStatusRitmoBackend();

  var emails = [];
  if (config.email_1 && config.email_1.indexOf('@') !== -1) emails.push(config.email_1);
  if (config.email_2 && config.email_2.indexOf('@') !== -1) emails.push(config.email_2);
  if (emails.length === 0) return;

  var assunto = 'Resumo Semanal do Casal: ' + statusGeral.estado;
  var corpo = 'Revisão de Domingo:\n\n' +
    '• Ritmo atual: ' + statusGeral.estado + ' (' + Math.round(statusGeral.indiceRitmo * 100) + '% da rota)\n' +
    '• Gasto variável acumulado: ' + formatarReais(statusGeral.gastoVariavelTotal) + ' de ' + formatarReais(statusGeral.tetoVariavelTotal) + '\n' +
    '• Você pode gastar até ' + formatarReais(statusGeral.disponivelPorDia) + ' por dia até o fim do mês.\n\n' +
    'Dediquem 15 minutos para alinhar as prioridades da próxima semana.';

  MailApp.sendEmail({
    to: emails.join(','),
    subject: assunto,
    body: corpo
  });
}

// Executado no último dia do mês
function fechamentoDoMes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = carregarConfig(ss);
  var emails = [];
  if (config.email_1 && config.email_1.indexOf('@') !== -1) emails.push(config.email_1);
  if (config.email_2 && config.email_2.indexOf('@') !== -1) emails.push(config.email_2);
  if (emails.length === 0) return;

  var conselho = gerarConselhoBackend();
  var assunto = 'Fechamento do Mês - Orçamento Londrina';
  var corpo = 'Resultado Final do Mês:\n\n' +
    conselho.ondeEstamos + '\n\n' +
    'Próximo passo recomendado:\n' +
    conselho.oQueFazer;

  MailApp.sendEmail({
    to: emails.join(','),
    subject: assunto,
    body: corpo
  });
}
