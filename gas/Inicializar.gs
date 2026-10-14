/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Inicializar.gs
 * 
 * Cria todas as abas com os cabeçalhos, formatações, validações de dados
 * e popula os dados padrão de Londrina (PR).
 */

function inicializarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Aba Lancamentos
  var abaLancamentos = obterOuCriarAba(ss, 'Lancamentos');
  abaLancamentos.clear();
  var cabecalhoLancamentos = [
    'id', 'data', 'valor', 'categoria', 'subcategoria',
    'estabelecimento', 'forma_pagamento', 'quem', 'essencial',
    'observacao', 'mes_ref', 'criado_em'
  ];
  abaLancamentos.getRange(1, 1, 1, cabecalhoLancamentos.length).setValues([cabecalhoLancamentos])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaLancamentos.setFrozenRows(1);
  abaLancamentos.getRange('C2:C').setNumberFormat('R$ #,##0.00');
  abaLancamentos.getRange('B2:B').setNumberFormat('dd/mm/yyyy');

  // 2. Aba Fixas
  var abaFixas = obterOuCriarAba(ss, 'Fixas');
  abaFixas.clear();
  var cabecalhoFixas = ['descricao', 'valor', 'dia_vencimento', 'categoria', 'ativo', 'pago_mes_ref'];
  abaFixas.getRange(1, 1, 1, cabecalhoFixas.length).setValues([cabecalhoFixas])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaFixas.setFrozenRows(1);
  abaFixas.getRange('B2:B').setNumberFormat('R$ #,##0.00');

  var fixasIniciais = [
    ['Aluguel', 2100, 10, 'Casa e Manutenção', 'S', ''],
    ['Condomínio', 400, 10, 'Casa e Manutenção', 'S', ''],
    ['Carro', 1500, 15, 'Outros', 'S', ''],
    ['Faculdade', 211, 10, 'Educação', 'S', ''],
    ['Água (Sanepar)', 80, 15, 'Casa e Manutenção', 'S', ''],
    ['Gás', 100, 20, 'Casa e Manutenção', 'S', ''],
    ['Internet', 120, 15, 'Casa e Manutenção', 'S', ''],
    ['Luz (Copel)', 150, 15, 'Casa e Manutenção', 'S', '']
  ];
  abaFixas.getRange(2, 1, fixasIniciais.length, 6).setValues(fixasIniciais);

  // 3. Aba Orcamento
  var abaOrcamento = obterOuCriarAba(ss, 'Orcamento');
  abaOrcamento.clear();
  var cabecalhoOrcamento = ['mes_ref', 'categoria', 'teto', 'tipo'];
  abaOrcamento.getRange(1, 1, 1, cabecalhoOrcamento.length).setValues([cabecalhoOrcamento])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaOrcamento.setFrozenRows(1);
  abaOrcamento.getRange('C2:C').setNumberFormat('R$ #,##0.00');

  var orcamentoInicial = [
    ['atual', 'Mercado', 1200, 'Variável'],
    ['atual', 'Combustível', 300, 'Variável'],
    ['atual', 'Farmácia e Saúde', 150, 'Variável'],
    ['atual', 'Lazer', 100, 'Variável'],
    ['atual', 'Casa e Manutenção', 0, 'Variável'],
    ['atual', 'Educação', 0, 'Variável'],
    ['atual', 'Vestuário', 0, 'Variável'],
    ['atual', 'Outros', 0, 'Variável'],
    ['atual', 'Reserva', 200, 'Meta']
  ];
  abaOrcamento.getRange(2, 1, orcamentoInicial.length, 4).setValues(orcamentoInicial);

  // 4. Aba Categorias
  var abaCategorias = obterOuCriarAba(ss, 'Categorias');
  abaCategorias.clear();
  var cabecalhoCategorias = ['categoria', 'subcategoria', 'ativo'];
  abaCategorias.getRange(1, 1, 1, cabecalhoCategorias.length).setValues([cabecalhoCategorias])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaCategorias.setFrozenRows(1);

  var categoriasIniciais = [
    ['Mercado', 'Alimentos', 'S'],
    ['Mercado', 'Limpeza', 'S'],
    ['Mercado', 'Higiene', 'S'],
    ['Mercado', 'Hortifrúti Semanal', 'S'],
    ['Mercado', 'Padaria', 'S'],
    ['Mercado', 'Carnes', 'S'],
    ['Combustível', 'Gasolina', 'S'],
    ['Combustível', 'Estacionamento', 'S'],
    ['Farmácia e Saúde', 'Medicamentos', 'S'],
    ['Farmácia e Saúde', 'Consultas', 'S'],
    ['Lazer', 'Passeio', 'S'],
    ['Lazer', 'Delivery', 'S'],
    ['Lazer', 'Assinaturas', 'S'],
    ['Casa e Manutenção', 'Reparos', 'S'],
    ['Casa e Manutenção', 'Utensílios', 'S'],
    ['Educação', 'Faculdade', 'S'],
    ['Educação', 'Material', 'S'],
    ['Vestuário', 'Adulto', 'S'],
    ['Vestuário', 'Criança', 'S'],
    ['Outros', 'Presentes', 'S'],
    ['Outros', 'Imprevistos', 'S']
  ];
  abaCategorias.getRange(2, 1, categoriasIniciais.length, 3).setValues(categoriasIniciais);

  // 5. Aba Reserva
  var abaReserva = obterOuCriarAba(ss, 'Reserva');
  abaReserva.clear();
  var cabecalhoReserva = ['data', 'valor', 'tipo', 'motivo', 'saldo_acumulado'];
  abaReserva.getRange(1, 1, 1, cabecalhoReserva.length).setValues([cabecalhoReserva])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaReserva.setFrozenRows(1);
  abaReserva.getRange('B2:B').setNumberFormat('R$ #,##0.00');
  abaReserva.getRange('E2:E').setNumberFormat('R$ #,##0.00');

  var reservaInicial = [
    [new Date(), 2000, 'Aporte', 'Colchão de setembro', 2000]
  ];
  abaReserva.getRange(2, 1, 1, 5).setValues(reservaInicial);

  // 6. Aba Config
  var abaConfig = obterOuCriarAba(ss, 'Config');
  abaConfig.clear();
  var cabecalhoConfig = ['chave', 'valor', 'descricao'];
  abaConfig.getRange(1, 1, 1, 3).setValues([cabecalhoConfig])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaConfig.setFrozenRows(1);

  var configInicial = [
    ['renda_liquida_mensal', 6500, 'Renda familiar líquida mensal'],
    ['dia_pagamento', 5, 'Dia do recebimento principal'],
    ['meta_reserva_mensal', 200, 'Meta de aporte mensal na reserva'],
    ['colchao_meta', 4600, 'Meta do valor total do colchão'],
    ['email_1', Session.getActiveUser().getEmail() || '', 'Email do cônjuge 1'],
    ['email_2', '', 'Email do cônjuge 2'],
    ['alertas_ativos', 'SIM', 'SIM ou NAO para disparos'],
    ['hora_resumo_diario', 20, 'Hora do envio de notificações'],
    ['dia_fechamento_ciclo', 'ultimo', 'Dia do fechamento do ciclo mensal'],
    ['webhook_n8n', '', 'URL opcional webhook n8n para WhatsApp']
  ];
  abaConfig.getRange(2, 1, configInicial.length, 3).setValues(configInicial);

  // 7. Aba Alertas_Log
  var abaAlertas = obterOuCriarAba(ss, 'Alertas_Log');
  abaAlertas.clear();
  var cabecalhoAlertas = ['data_hora', 'tipo', 'severidade', 'mensagem', 'lido', 'mes_ref'];
  abaAlertas.getRange(1, 1, 1, 6).setValues([cabecalhoAlertas])
    .setFontWeight('bold').setBackground('#f3f4f6');
  abaAlertas.setFrozenRows(1);

  // Validações de dados em Lancamentos
  var regraQuem = SpreadsheetApp.newDataValidation().requireValueInList(['Ele', 'Ela', 'Conjunto'], true).build();
  abaLancamentos.getRange('H2:H1000').setDataValidation(regraQuem);

  var regraForma = SpreadsheetApp.newDataValidation().requireValueInList(['Pix', 'Débito', 'Crédito', 'Dinheiro'], true).build();
  abaLancamentos.getRange('G2:G1000').setDataValidation(regraForma);

  var regraEssencial = SpreadsheetApp.newDataValidation().requireValueInList(['S', 'N'], true).build();
  abaLancamentos.getRange('I2:I1000').setDataValidation(regraEssencial);

  SpreadsheetApp.flush();
  return { status: 'sucesso', mensagem: 'Planilha inicializada com sucesso com todos os parâmetros de Londrina!' };
}

function obterOuCriarAba(ss, nome) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
  }
  return aba;
}
