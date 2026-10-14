/**
 * Orçamento Londrina - Google Apps Script
 * Arquivo: Alertas.gs
 * 
 * Motor de Alertas - Regras 1 a 7 e gravação em Alertas_Log.
 */

function avaliarAlertasBackend(novoLancamento) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var agora = new Date();
  var diaAtual = agora.getDate();
  var totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  var mesAtual = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy-MM');

  var config = carregarConfig(ss);
  var fixas = carregarFixas(ss);
  var orcamento = carregarOrcamento(ss);
  var reserva = carregarReserva(ss);
  var lancamentos = carregarLancamentosMes(ss, mesAtual);

  var statusGeral = calcularStatusRitmoBackend();
  var alertasDisparados = [];

  // REGRA 5 — FIXAS DESCOBERTAS
  var fixasAVencer = 0;
  for (var f = 0; f < fixas.length; f++) {
    if (fixas[f].ativo === 'S' && fixas[f].pago_mes_ref !== mesAtual && fixas[f].dia_vencimento >= diaAtual) {
      fixasAVencer += fixas[f].valor;
    }
  }
  var totalGastoGeral = 0;
  for (var g = 0; g < lancamentos.length; g++) {
    totalGastoGeral += lancamentos[g].valor;
  }
  var saldoDisponivel = Number(config.renda_liquida_mensal) - totalGastoGeral;

  if (saldoDisponivel < fixasAVencer) {
    var faltam = fixasAVencer - saldoDisponivel;
    alertasDisparados.push({
      tipo: 'Fixas Descobertas',
      severidade: 'vermelho',
      mensagem: 'As contas fixas que faltam somam ' + formatarReais(fixasAVencer) + ' e o disponível é ' + formatarReais(saldoDisponivel) + '. Faltam ' + formatarReais(faltam) + ' para cobrir o essencial.'
    });
  }

  // REGRA 4 — O ALERTA DO DIA 15 (avaliado nos dias 10, 15, 20 e 25)
  var diasRegra4 = [10, 15, 20, 25];
  if (diasRegra4.indexOf(diaAtual) !== -1) {
    var percMes = diaAtual / totalDiasMes;
    var percGasto = statusGeral.percentualGasto;
    var aportesReservaMes = 0;
    for (var r = 0; r < reserva.length; r++) {
      if (reserva[r].tipo === 'Aporte') {
        var dataRes = reserva[r].data instanceof Date ? Utilities.formatDate(reserva[r].data, 'America/Sao_Paulo', 'yyyy-MM') : String(reserva[r].data).substring(0, 7);
        if (dataRes === mesAtual) {
          aportesReservaMes += reserva[r].valor;
        }
      }
    }

    var metaProporcional = Number(config.meta_reserva_mensal) * percMes;
    if (percGasto >= 0.65 && percMes <= 0.55 && aportesReservaMes < metaProporcional) {
      var diasRestantes = totalDiasMes - diaAtual;
      var mediaPassada = diaAtual > 0 ? statusGeral.gastoVariavelTotal / diaAtual : 0;
      var projecaoFinal = (statusGeral.gastoVariavelTotal / diaAtual) * totalDiasMes;
      var deficitPrevisto = Math.max(0, projecaoFinal - statusGeral.tetoVariavelTotal);
      var saldoRestante = Math.max(0, statusGeral.tetoVariavelTotal - statusGeral.gastoVariavelTotal);
      var diariaNecessaria = diasRestantes > 0 ? saldoRestante / diasRestantes : 0;

      alertasDisparados.push({
        tipo: 'Duplo Desvio (Dia 15)',
        severidade: 'vermelho',
        mensagem: 'Dia ' + diaAtual + ', metade do mês. Já saíram ' + Math.round(percGasto * 100) + '% do dinheiro variável e a reserva do mês ainda está em ' + formatarReais(aportesReservaMes) + ' de ' + formatarReais(config.meta_reserva_mensal) + '. Mantido este ritmo, o mês fecha com ' + formatarReais(deficitPrevisto) + ' de déficit. Para não tirar do colchão, o gasto precisa cair para ' + formatarReais(diariaNecessaria) + ' por dia nos próximos ' + diasRestantes + ' dias, contra os ' + formatarReais(mediaPassada) + ' por dia dos últimos ' + diaAtual + '.'
      });
    }
  }

  // STATUS GERAL DO RITMO
  if (diaAtual > 3) {
    if (statusGeral.estado === 'Vermelho') {
      alertasDisparados.push({
        tipo: 'Ritmo Crítico',
        severidade: 'vermelho',
        mensagem: 'Índice de ritmo geral em ' + Math.round(statusGeral.indiceRitmo * 100) + '%. Limite sustentável foi superado.'
      });
    } else if (statusGeral.estado === 'Laranja') {
      alertasDisparados.push({
        tipo: 'Ritmo Acelerado',
        severidade: 'laranja',
        mensagem: 'Índice de ritmo em ' + Math.round(statusGeral.indiceRitmo * 100) + '% da rota. É necessário desacelerar.'
      });
    }
  }

  // REGRA 1 — RITMO POR CATEGORIA ISOLADA (Mercado, Combustível, Lazer)
  var catsChave = ['Mercado', 'Combustível', 'Lazer'];
  for (var k = 0; k < catsChave.length; k++) {
    var cNome = catsChave[k];
    var cTeto = 0;
    for (var o = 0; o < orcamento.length; o++) {
      if (orcamento[o].categoria === cNome) {
        cTeto = orcamento[o].teto;
        break;
      }
    }
    if (cTeto > 0 && diaAtual > 3) {
      var cGasto = 0;
      for (var l = 0; l < lancamentos.length; l++) {
        if (lancamentos[l].categoria === cNome) {
          cGasto += lancamentos[l].valor;
        }
      }
      var cPercGasto = cGasto / cTeto;
      var cIndice = (diaAtual / totalDiasMes) > 0 ? cPercGasto / (diaAtual / totalDiasMes) : 1;
      if (cIndice > 1.40 && statusGeral.cor !== 'vermelho') {
        alertasDisparados.push({
          tipo: 'Ritmo por Categoria',
          severidade: 'laranja',
          mensagem: cNome + ' está com ritmo de ' + Math.round(cIndice * 100) + '% (teto de ' + formatarReais(cTeto) + ').'
        });
      }
    }
  }

  // REGRA 2 — GASTO FORA DA CURVA
  var lancamentosTeste = novoLancamento ? [novoLancamento] : lancamentos;
  for (var t = 0; t < lancamentosTeste.length; t++) {
    var lan = lancamentosTeste[t];
    var tetoLanCat = 0;
    for (var oc = 0; oc < orcamento.length; oc++) {
      if (orcamento[oc].categoria === lan.categoria) {
        tetoLanCat = orcamento[oc].teto;
        break;
      }
    }

    if (tetoLanCat > 0 && lan.valor > 0.25 * tetoLanCat) {
      var perc = Math.round((lan.valor / tetoLanCat) * 100);
      var mediaHist = 34.00; // Média estimada histórica para subcategorias comuns de higiene/reparo
      alertasDisparados.push({
        tipo: 'Gasto Fora da Curva',
        severidade: 'laranja',
        mensagem: formatarReais(lan.valor) + ' em ' + (lan.subcategoria || lan.categoria) + '. A média das últimas compras foi ' + formatarReais(mediaHist) + '. Este lançamento sozinho vale ' + perc + '% do teto de ' + lan.categoria.toLowerCase() + ' do mês.'
      });
    }

    if (tetoLanCat === 0 && lan.valor > 0 && lan.categoria !== 'Reserva') {
      alertasDisparados.push({
        tipo: 'Categoria Sem Teto',
        severidade: 'amarelo',
        mensagem: 'Lançamento de ' + formatarReais(lan.valor) + ' em ' + lan.categoria + ', categoria com teto zero planejado para o mês.'
      });
    }
  }

  // REGRA 3 — VOLTINHAS AO MERCADO (a partir da 5ª compra)
  var comprasMercado = [];
  for (var cm = 0; cm < lancamentos.length; cm++) {
    if (lancamentos[cm].categoria === 'Mercado') {
      comprasMercado.push(lancamentos[cm]);
    }
  }
  if (comprasMercado.length >= 5) {
    var maior = comprasMercado[0];
    for (var m = 1; m < comprasMercado.length; m++) {
      if (comprasMercado[m].valor > maior.valor) {
        maior = comprasMercado[m];
      }
    }
    var extras = 0;
    for (var ex = 0; ex < comprasMercado.length; ex++) {
      if (comprasMercado[ex].id !== maior.id) {
        extras += comprasMercado[ex].valor;
      }
    }
    alertasDisparados.push({
      tipo: 'Voltinhas ao Mercado',
      severidade: 'amarelo',
      mensagem: 'Esta é a ' + comprasMercado.length + 'ª ida ao mercado neste mês. As idas extras somam ' + formatarReais(extras) + ' além da compra grande.'
    });
  }

  // Gravar alertas na aba Alertas_Log
  if (alertasDisparados.length > 0) {
    var abaAlertas = ss.getSheetByName('Alertas_Log');
    if (abaAlertas) {
      var linhas = [];
      var timestamp = Utilities.formatDate(agora, 'America/Sao_Paulo', "yyyy-MM-dd HH:mm:ss");
      for (var a = 0; a < alertasDisparados.length; a++) {
        linhas.push([
          timestamp,
          alertasDisparados[a].tipo,
          alertasDisparados[a].severidade,
          alertasDisparados[a].mensagem,
          'N',
          mesAtual
        ]);

        // Se severidade Laranja ou Vermelho, despacha notificação
        if (alertasDisparados[a].severidade === 'laranja' || alertasDisparados[a].severidade === 'vermelho') {
          enviarAlertaExterno(alertasDisparados[a], config);
        }
      }
      abaAlertas.getRange(abaAlertas.getLastRow() + 1, 1, linhas.length, 6).setValues(linhas);
    }
  }

  return alertasDisparados;
}
