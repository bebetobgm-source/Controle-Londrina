import {
  Lancamento,
  RendaExtra,
  ContaFixa,
  OrcamentoItem,
  Configuracao,
  TransacaoReserva,
  StatusRitmo,
  CategoriaRitmo,
  AlertaLog,
  Conselho,
  SeveridadeAlerta
} from '../types';
import { HISTORICO_SUBCATEGORIAS_MEDIANA } from '../data/defaultData';

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
}

export function formatarDataBR(dataStr: string): string {
  if (!dataStr) return '';
  const partes = dataStr.split('T')[0].split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataStr;
}

export function obterTotalDiasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

export function calcularMediana(numeros: number[]): number {
  if (numeros.length === 0) return 0;
  const ordenados = [...numeros].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 !== 0) {
    return ordenados[meio];
  }
  return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

// 1. Cálculo de Status de Ritmo
export function calcularStatusRitmo(
  lancamentos: Lancamento[],
  orcamentos: OrcamentoItem[],
  diaAtualParam?: number,
  totalDiasParam?: number
): StatusRitmo {
  const agora = new Date();
  const diaAtual = diaAtualParam !== undefined ? diaAtualParam : agora.getDate();
  const totalDiasMes = totalDiasParam !== undefined ? totalDiasParam : obterTotalDiasNoMes(agora.getFullYear(), agora.getMonth() + 1);

  const diasRestantes = Math.max(1, totalDiasMes - diaAtual + 1);

  // Soma dos tetos variáveis
  const tetosVariaveis = orcamentos.filter(o => o.tipo === 'Variável');
  const tetoVariavelTotal = tetosVariaveis.reduce((acc, curr) => acc + curr.teto, 0);

  // Gasto variável até o momento
  const categoriasVariaveisNomes = new Set(tetosVariaveis.map(t => t.categoria));
  const gastoVariavelTotal = lancamentos
    .filter(l => categoriasVariaveisNomes.has(l.categoria))
    .reduce((acc, curr) => acc + curr.valor, 0);

  const percentualDoMes = diaAtual / totalDiasMes;
  const percentualGasto = tetoVariavelTotal > 0 ? gastoVariavelTotal / tetoVariavelTotal : 0;
  
  // Evitar divisão por zero
  let indiceRitmo = percentualDoMes > 0 ? percentualGasto / percentualDoMes : 1.0;

  // Nos 3 primeiros dias do mês, a compra grande de mercado distorce o ritmo
  const nosPrimeirosTresDias = diaAtual <= 3;

  let estado: StatusRitmo['estado'] = 'Verde';
  let cor: StatusRitmo['cor'] = 'verde';
  let explicacao = '';

  if (nosPrimeirosTresDias) {
    estado = 'Verde';
    cor = 'verde';
    explicacao = `Início do mês (dia ${diaAtual}). Compra inicial esperada no período.`;
  } else if (indiceRitmo <= 0.90) {
    estado = 'Verde folgado';
    cor = 'verde';
    explicacao = `Ritmo excelente (${(indiceRitmo * 100).toFixed(0)}% da rota). Gastando menos que o ritmo sustentável.`;
  } else if (indiceRitmo <= 1.10) {
    estado = 'Verde';
    cor = 'verde';
    explicacao = `Ritmo dentro do plano (${(indiceRitmo * 100).toFixed(0)}% da rota prevista até o dia ${diaAtual}).`;
  } else if (indiceRitmo <= 1.30) {
    estado = 'Amarelo';
    cor = 'amarelo';
    explicacao = `Atenção: ritmo acelerado (${(indiceRitmo * 100).toFixed(0)}% do planejado para o dia ${diaAtual}).`;
  } else if (indiceRitmo <= 1.60) {
    estado = 'Laranja';
    cor = 'laranja';
    explicacao = `Alerta: ritmo de gasto ${(indiceRitmo * 100).toFixed(0)}% acima da rota sustentável.`;
  } else {
    estado = 'Vermelho';
    cor = 'vermelho';
    explicacao = `Crítico: ritmo ${(indiceRitmo * 100).toFixed(0)}% do limite. Risco iminente de estouro orçamentário.`;
  }

  const saldoVariavelRestante = Math.max(0, tetoVariavelTotal - gastoVariavelTotal);
  const disponivelPorDia = diasRestantes > 0 ? saldoVariavelRestante / diasRestantes : 0;

  return {
    percentual_do_mes: percentualDoMes,
    percentual_gasto: percentualGasto,
    indice_de_ritmo: indiceRitmo,
    estado,
    cor,
    explicacao,
    gasto_variavel_total: gastoVariavelTotal,
    teto_variavel_total: tetoVariavelTotal,
    disponivel_por_dia: disponivelPorDia,
    dias_restantes: diasRestantes,
    dia_atual: diaAtual,
    total_dias_mes: totalDiasMes
  };
}

// 2. Cálculo por Categoria Variável (para as barras com marcação de ritmo esperado)
export function calcularRitmoPorCategorias(
  lancamentos: Lancamento[],
  orcamentos: OrcamentoItem[],
  diaAtual: number,
  totalDiasMes: number
): CategoriaRitmo[] {
  const percentualEsperado = diaAtual / totalDiasMes;
  const tetosVariaveis = orcamentos.filter(o => o.tipo === 'Variável');

  return tetosVariaveis.map(item => {
    const gasto = lancamentos
      .filter(l => l.categoria === item.categoria)
      .reduce((acc, l) => acc + l.valor, 0);

    const percentualGasto = item.teto > 0 ? gasto / item.teto : (gasto > 0 ? 1 : 0);
    const indiceRitmo = percentualEsperado > 0 ? percentualGasto / percentualEsperado : 1;
    const diferenca = gasto - (item.teto * percentualEsperado);

    let alertaIndividual: string | undefined;
    // Regra 1: se categoria isolada passar de 1.40 (Mercado, Combustível, Lazer)
    if (['Mercado', 'Combustível', 'Lazer'].includes(item.categoria) && indiceRitmo > 1.40 && item.teto > 0 && diaAtual > 3) {
      alertaIndividual = `${item.categoria} está com ritmo de ${(indiceRitmo * 100).toFixed(0)}% (teto de ${formatarMoeda(item.teto)}).`;
    }

    return {
      categoria: item.categoria,
      teto: item.teto,
      gasto,
      percentual_gasto: percentualGasto,
      percentual_esperado: percentualEsperado,
      indice_ritmo: indiceRitmo,
      diferenca,
      alerta_individual: alertaIndividual
    };
  });
}

// 3. MOTOR DE ALERTAS — REGRAS 1 A 7
export function avaliarAlertas(
  lancamentos: Lancamento[],
  orcamentos: OrcamentoItem[],
  fixas: ContaFixa[],
  config: Configuracao,
  reservas: TransacaoReserva[],
  diaAtualParam?: number,
  totalDiasParam?: number,
  novoLancamento?: Lancamento,
  rendasExtrasParam?: RendaExtra[]
): AlertaLog[] {
  const agora = new Date();
  const diaAtual = diaAtualParam !== undefined ? diaAtualParam : agora.getDate();
  const totalDiasMes = totalDiasParam !== undefined ? totalDiasParam : obterTotalDiasNoMes(agora.getFullYear(), agora.getMonth() + 1);
  const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const alertas: AlertaLog[] = [];
  const addAlerta = (tipo: string, severidade: SeveridadeAlerta, mensagem: string) => {
    alertas.push({
      id: `alt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      data_hora: new Date().toISOString(),
      tipo,
      severidade,
      mensagem,
      lido: 'N',
      mes_ref: mesRefAtual
    });
  };

  const statusGeral = calcularStatusRitmo(lancamentos, orcamentos, diaAtual, totalDiasMes);
  const ritmosCat = calcularRitmoPorCategorias(lancamentos, orcamentos, diaAtual, totalDiasMes);

  // Total de rendas extras no mês atual
  const totalRendasExtras = (rendasExtrasParam || [])
    .filter(r => r.mes_ref === mesRefAtual)
    .reduce((acc, r) => acc + r.valor, 0);

  // REGRA 5 — FIXAS DESCOBERTAS (Prioridade máxima, avaliada primeiro)
  // Some as fixas ainda não pagas até o fim do mês. Se saldo_disponivel < fixas_a_vencer, dispare alerta crítico
  const fixasAVencer = fixas
    .filter(f => f.ativo === 'S' && f.pago_mes_ref !== mesRefAtual && f.dia_vencimento >= diaAtual)
    .reduce((acc, f) => acc + f.valor, 0);

  const totalGastoMesGeral = lancamentos.reduce((acc, l) => acc + l.valor, 0);
  const rendaEfetiva = config.renda_liquida_mensal + totalRendasExtras;
  const saldoDisponivel = rendaEfetiva - totalGastoMesGeral;

  if (saldoDisponivel < fixasAVencer) {
    const faltam = fixasAVencer - saldoDisponivel;
    addAlerta(
      'Fixas Descobertas',
      'vermelho',
      `As contas fixas que faltam somam ${formatarMoeda(fixasAVencer)} e o disponível é ${formatarMoeda(saldoDisponivel)}. Faltam ${formatarMoeda(faltam)} para cobrir o essencial.`
    );
  }

  // REGRA 4 — O ALERTA DO DIA 15 (avaliado nos dias 10, 15, 20 e 25)
  // SE percentual_gasto >= 0,65 E percentual_do_mes <= 0,55 E reserva_aportada_no_mes < meta_reserva * percentual_do_mes
  // ENTÃO alerta VERMELHO de duplo desvio
  const diasAvaliacaoRegra4 = [10, 15, 20, 25];
  const aportesReservaMes = reservas
    .filter(r => r.tipo === 'Aporte' && r.data.startsWith(mesRefAtual))
    .reduce((acc, r) => acc + r.valor, 0);

  const percentualDoMes = diaAtual / totalDiasMes;
  const percentualGasto = statusGeral.percentual_gasto;
  const metaReservaProporcional = config.meta_reserva_mensal * percentualDoMes;

  // Permitir disparar no dia exato ou se simulado no dia 15
  if (
    diasAvaliacaoRegra4.includes(diaAtual) &&
    percentualGasto >= 0.65 &&
    percentualDoMes <= 0.55 &&
    aportesReservaMes < metaReservaProporcional
  ) {
    const diasRestantes = totalDiasMes - diaAtual;
    const gastoAteAgora = statusGeral.gasto_variavel_total;
    const mediaPassadaPorDia = diaAtual > 0 ? gastoAteAgora / diaAtual : 0;
    
    // Projeção linear para calcular déficit previsto mantido o ritmo
    const projecaoFinal = (gastoAteAgora / diaAtual) * totalDiasMes;
    const deficitPrevisto = Math.max(0, projecaoFinal - statusGeral.teto_variavel_total);
    const saldoRestanteVariavel = Math.max(0, statusGeral.teto_variavel_total - gastoAteAgora);
    const diariaNecessaria = diasRestantes > 0 ? saldoRestanteVariavel / diasRestantes : 0;

    addAlerta(
      'Duplo Desvio (Dia 15)',
      'vermelho',
      `Dia ${diaAtual}, metade do mês. Já saíram ${(percentualGasto * 100).toFixed(0)}% do dinheiro variável e a reserva do mês ainda está em ${formatarMoeda(aportesReservaMes)} de ${formatarMoeda(config.meta_reserva_mensal)}. Mantido este ritmo, o mês fecha com ${formatarMoeda(deficitPrevisto)} de déficit. Para não tirar do colchão, o gasto precisa cair para ${formatarMoeda(diariaNecessaria)} por dia nos próximos ${diasRestantes} dias, contra os ${formatarMoeda(mediaPassadaPorDia)} por dia dos últimos ${diaAtual}.`
    );
  }

  // STATUS GERAL DO ÍNDICE DE RITMO (Amarelo / Laranja / Vermelho)
  if (diaAtual > 3) {
    if (statusGeral.estado === 'Vermelho') {
      addAlerta(
        'Ritmo Crítico',
        'vermelho',
        `Índice de ritmo geral em ${(statusGeral.indice_de_ritmo * 100).toFixed(0)}% (além do teto sustentável de 100%). Gasto atual: ${formatarMoeda(statusGeral.gasto_variavel_total)} de ${formatarMoeda(statusGeral.teto_variavel_total)}.`
      );
    } else if (statusGeral.estado === 'Laranja') {
      const piorCat = ritmosCat.sort((a, b) => b.indice_ritmo - a.indice_ritmo)[0];
      addAlerta(
        'Ritmo Acelerado',
        'laranja',
        `Índice geral em ${(statusGeral.indice_de_ritmo * 100).toFixed(0)}% da rota. Categoria mais descompensada: ${piorCat ? piorCat.categoria : 'Variáveis'}.`
      );
    } else if (statusGeral.estado === 'Amarelo') {
      addAlerta(
        'Atenção ao Ritmo',
        'amarelo',
        `Ritmo em ${(statusGeral.indice_de_ritmo * 100).toFixed(0)}% do esperado para o dia ${diaAtual}. É prudente frear os próximos dias.`
      );
    }
  }

  // REGRA 1 — RITMO POR CATEGORIA ISOLADA (Mercado, Combustível e Lazer)
  ritmosCat.forEach(rc => {
    if (rc.alerta_individual && statusGeral.cor !== 'vermelho') {
      addAlerta('Ritmo por Categoria', 'laranja', rc.alerta_individual);
    }
  });

  // REGRA 2 — GASTO FORA DA CURVA (avaliado sobre o novo lançamento ou lançamentos recentes)
  const lancamentosParaTestar = novoLancamento ? [novoLancamento] : lancamentos;
  lancamentosParaTestar.forEach(lan => {
    const tetoCat = orcamentos.find(o => o.categoria === lan.categoria)?.teto || 0;

    // Condição 1: Lançamento único acima de 25% do teto mensal da sua categoria
    if (tetoCat > 0 && lan.valor > 0.25 * tetoCat) {
      const percTeto = ((lan.valor / tetoCat) * 100).toFixed(0);
      const historico = HISTORICO_SUBCATEGORIAS_MEDIANA[lan.subcategoria] || [];
      const mediaHist = historico.length > 0 ? (historico.reduce((a, b) => a + b, 0) / historico.length) : (tetoCat * 0.2);

      addAlerta(
        'Gasto Fora da Curva',
        'laranja',
        `${formatarMoeda(lan.valor)} em ${lan.subcategoria || lan.categoria}. A média das últimas compras foi ${formatarMoeda(mediaHist)}. Este lançamento sozinho vale ${percTeto}% do teto de ${lan.categoria.toLowerCase()} do mês.`
      );
    }

    // Condição 2: Lançamento acima de 2,5 vezes a mediana dos lançamentos daquela subcategoria nos últimos 90 dias (min 5)
    const historicoSub = HISTORICO_SUBCATEGORIAS_MEDIANA[lan.subcategoria] || [];
    if (historicoSub.length >= 5) {
      const mediana = calcularMediana(historicoSub);
      if (lan.valor > 2.5 * mediana) {
        const media = historicoSub.reduce((a, b) => a + b, 0) / historicoSub.length;
        const percTeto = tetoCat > 0 ? ((lan.valor / tetoCat) * 100).toFixed(0) : '100';
        addAlerta(
          'Gasto Fora da Curva (Mediana)',
          'laranja',
          `${formatarMoeda(lan.valor)} em ${lan.subcategoria}. A média das últimas compras foi ${formatarMoeda(media)} (mediana ${formatarMoeda(mediana)}). Este lançamento sozinho vale ${percTeto}% do teto de ${lan.categoria.toLowerCase()} do mês.`
        );
      }
    }

    // Condição 3: Lançamento em categoria com teto zero
    if (tetoCat === 0 && lan.valor > 0 && lan.categoria !== 'Reserva') {
      addAlerta(
        'Categoria Sem Teto',
        'amarelo',
        `Lançamento de ${formatarMoeda(lan.valor)} em ${lan.categoria} (${lan.subcategoria}), categoria com teto zero planejado para o mês.`
      );
    }

    // Condição 4: Dois lançamentos da mesma subcategoria no mesmo dia em estabelecimentos diferentes
    const mesmosDiaSub = lancamentos.filter(
      l => l.data === lan.data && l.subcategoria === lan.subcategoria && l.id !== lan.id
    );
    const estabelecimentosDiferentes = mesmosDiaSub.some(
      l => l.estabelecimento && lan.estabelecimento && l.estabelecimento.toLowerCase() !== lan.estabelecimento.toLowerCase()
    );
    if (estabelecimentosDiferentes) {
      addAlerta(
        'Compras Duplicadas no Dia',
        'amarelo',
        `Dois lançamentos em ${lan.subcategoria} no mesmo dia (${formatarDataBR(lan.data)}) em estabelecimentos diferentes.`
      );
    }
  });

  // REGRA 3 — VOLTINHAS AO MERCADO
  // Conte as compras distintas de Mercado no ciclo. A partir da 5ª compra, alerte:
  // "Esta é a 5ª ida ao mercado neste mês. As idas extras somam R$ X além da compra grande."
  const comprasMercado = lancamentos.filter(l => l.categoria === 'Mercado');
  if (comprasMercado.length >= 5) {
    // A compra grande é a de maior valor
    const compraGrande = comprasMercado.reduce((max, c) => (c.valor > max.valor ? c : max), comprasMercado[0]);
    const idasExtras = comprasMercado.filter(c => c.id !== compraGrande.id);
    const somaExtras = idasExtras.reduce((acc, c) => acc + c.valor, 0);

    addAlerta(
      'Voltinhas ao Mercado',
      'amarelo',
      `Esta é a ${comprasMercado.length}ª ida ao mercado neste mês. As idas extras somam ${formatarMoeda(somaExtras)} além da compra grande (${formatarMoeda(compraGrande.valor)} em ${formatarDataBR(compraGrande.data)}).`
    );
  }

  // REGRA 6 — META DE RESERVA EM RISCO (A partir do dia 20)
  // se a sobra projetada for menor que a meta de reserva, alerte com o valor exato que precisa ser cortado
  if (diaAtual >= 20) {
    const projecao = calcularProjecaoFechamento(lancamentos, orcamentos, fixas, config, diaAtual, totalDiasMes);
    if (projecao.sobraAjustada < config.meta_reserva_mensal) {
      const corteNecessario = config.meta_reserva_mensal - projecao.sobraAjustada;
      addAlerta(
        'Meta de Reserva em Risco',
        'laranja',
        `A partir do dia ${diaAtual}, a sobra projetada (${formatarMoeda(Math.max(0, projecao.sobraAjustada))}) é inferior à meta de reserva (${formatarMoeda(config.meta_reserva_mensal)}). É necessário conter ${formatarMoeda(corteNecessario)} nos gastos variáveis.`
      );
    }
  }

  // Evitar duplicatas exatas de mensagem
  const alertasUnicos: AlertaLog[] = [];
  const mensagensVistas = new Set<string>();
  for (const a of alertas) {
    if (!mensagensVistas.has(a.mensagem)) {
      mensagensVistas.add(a.mensagem);
      alertasUnicos.push(a);
    }
  }

  return alertasUnicos;
}

// 4. Projeções de Fechamento (Linear e Ajustada)
export interface ProjecaoDetalhada {
  projecaoLinear: number;
  projecaoAjustada: number;
  fixasTotal: number;
  fixasAVencer: number;
  compraGrandeMercado: number;
  gastoDifusoAteAgora: number;
  sobraLinear: number;
  sobraAjustada: number;
  deficitLinear: number;
  deficitAjustada: number;
  totalRendasExtras: number;
  rendaTotal: number;
}

export function calcularProjecaoFechamento(
  lancamentos: Lancamento[],
  orcamentos: OrcamentoItem[],
  fixas: ContaFixa[],
  config: Configuracao,
  diaAtualParam?: number,
  totalDiasParam?: number,
  rendasExtrasParam?: RendaExtra[]
): ProjecaoDetalhada {
  const agora = new Date();
  const diaAtual = diaAtualParam !== undefined ? diaAtualParam : agora.getDate();
  const totalDiasMes = totalDiasParam !== undefined ? totalDiasParam : obterTotalDiasNoMes(agora.getFullYear(), agora.getMonth() + 1);
  const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const gastoTotalAteAgora = lancamentos.reduce((acc, l) => acc + l.valor, 0);
  const diasDecorridos = Math.max(1, diaAtual);

  // Projeção Linear Simples: gasto_atual / dias_decorridos * dias_do_mes
  const projecaoLinear = (gastoTotalAteAgora / diasDecorridos) * totalDiasMes;

  // Projeção Ajustada (mais honesta):
  // Separa os gastos concentrados no começo do mês (compra grande de mercado e fixas pagas)
  // e projeta apenas o gasto difuso diário, somando as fixas ainda a vencer.
  const comprasMercado = lancamentos.filter(l => l.categoria === 'Mercado');
  const maiorCompraMercado = comprasMercado.length > 0
    ? Math.max(...comprasMercado.map(c => c.valor))
    : 0;

  const fixasTotal = fixas.filter(f => f.ativo === 'S').reduce((acc, f) => acc + f.valor, 0);
  const fixasPagas = fixas.filter(f => f.ativo === 'S' && f.pago_mes_ref === mesRefAtual).reduce((acc, f) => acc + f.valor, 0);
  const fixasAVencer = fixasTotal - fixasPagas;

  // Lançamentos que já contam como fixas pagas ou compra grande
  const gastoDifuso = Math.max(0, gastoTotalAteAgora - fixasPagas - maiorCompraMercado);
  const projecaoDifuso = (gastoDifuso / diasDecorridos) * totalDiasMes;

  const projecaoAjustada = maiorCompraMercado + fixasTotal + projecaoDifuso;

  const totalRendasExtras = (rendasExtrasParam || [])
    .filter(r => r.mes_ref === mesRefAtual)
    .reduce((acc, r) => acc + r.valor, 0);

  const renda = config.renda_liquida_mensal + totalRendasExtras;
  const sobraLinear = renda - projecaoLinear;
  const sobraAjustada = renda - projecaoAjustada;

  return {
    projecaoLinear,
    projecaoAjustada,
    fixasTotal,
    fixasAVencer,
    compraGrandeMercado: maiorCompraMercado,
    gastoDifusoAteAgora: gastoDifuso,
    sobraLinear,
    sobraAjustada,
    deficitLinear: sobraLinear < 0 ? Math.abs(sobraLinear) : 0,
    deficitAjustada: sobraAjustada < 0 ? Math.abs(sobraAjustada) : 0,
    totalRendasExtras,
    rendaTotal: renda
  };
}

// 5. O CONSELHEIRO — PROJEÇÃO E CONSEQUÊNCIA
// Estruturado estritamente em três blocos:
// 1. Onde estamos (fato com número)
// 2. Por que (categoria ou lançamento culpado concreto)
// 3. O que fazer (ação única quantificada para esta semana)
export function gerarConselho(
  lancamentos: Lancamento[],
  orcamentos: OrcamentoItem[],
  fixas: ContaFixa[],
  config: Configuracao,
  reservas: TransacaoReserva[],
  diaAtualParam?: number,
  totalDiasParam?: number,
  rendasExtrasParam?: RendaExtra[]
): Conselho {
  const agora = new Date();
  const diaAtual = diaAtualParam !== undefined ? diaAtualParam : agora.getDate();
  const totalDiasMes = totalDiasParam !== undefined ? totalDiasParam : obterTotalDiasNoMes(agora.getFullYear(), agora.getMonth() + 1);

  const status = calcularStatusRitmo(lancamentos, orcamentos, diaAtual, totalDiasMes);
  const ritmosCat = calcularRitmoPorCategorias(lancamentos, orcamentos, diaAtual, totalDiasMes);
  const projecao = calcularProjecaoFechamento(lancamentos, orcamentos, fixas, config, diaAtual, totalDiasMes, rendasExtrasParam);

  const saldoColchaoAtual = reservas.length > 0 ? reservas[reservas.length - 1].saldo_acumulado : 2000;
  const despesaFixaDiaria = projecao.fixasTotal / 30;

  // Categoria mais descompensada (maior desvio absoluto sobre o esperado)
  const categoriasDesviadas = [...ritmosCat].sort((a, b) => b.diferenca - a.diferenca);
  const piorCategoria = categoriasDesviadas[0];

  let ondeEstamos = '';
  let porQue = '';
  let oQueFazer = '';

  const deficitAjustado = projecao.deficitAjustada;
  const diasRestantes = totalDiasMes - diaAtual;

  if (status.cor === 'verde') {
    ondeEstamos = `Hoje é dia ${diaAtual}. Foram gastos ${formatarMoeda(status.gasto_variavel_total)} dos ${formatarMoeda(status.teto_variavel_total)} variáveis previstos (${(status.percentual_gasto * 100).toFixed(0)}% do teto). Restam ${formatarMoeda(status.disponivel_por_dia)} por dia até o fim do mês.`;
    porQue = `O ritmo está equilibrado em ${(status.indice_de_ritmo * 100).toFixed(0)}% da rota, com compras distribuídas conforme o esperado.`;
    oQueFazer = `Mantenha os aportes semanais de mercado em até ${formatarMoeda(status.teto_variavel_total > 0 ? (status.teto_variavel_total * 0.15) : 180)} para fechar o mês com sobra e garantir o aporte de ${formatarMoeda(config.meta_reserva_mensal)} na reserva.`;
  } else if (status.cor === 'amarelo') {
    ondeEstamos = `Hoje é dia ${diaAtual}. Já saíram ${(status.percentual_gasto * 100).toFixed(0)}% do orçamento variável, enquanto o mês está em ${(status.percentual_do_mes * 100).toFixed(0)}%. O limite diário seguro caiu para ${formatarMoeda(status.disponivel_por_dia)}.`;
    porQue = piorCategoria && piorCategoria.diferenca > 0
      ? `O desvio foi puxado por ${piorCategoria.categoria}, que já consumiu ${formatarMoeda(piorCategoria.gasto)} do teto de ${formatarMoeda(piorCategoria.teto)} (${formatarMoeda(piorCategoria.diferenca)} acima do esperado para o dia ${diaAtual}).`
      : `O ritmo de saídas está 20% acima do trajeto planejado.`;
    oQueFazer = `Limite os gastos livres de ${piorCategoria?.categoria || 'Lazer e extras'} a zero até domingo para reequilibrar o ritmo para a segunda quinzena.`;
  } else {
    // Laranja ou Vermelho
    ondeEstamos = `Dia ${diaAtual}, restam ${diasRestantes} dias. O gasto variável acumulado é de ${formatarMoeda(status.gasto_variavel_total)}, projetando fechamento em ${formatarMoeda(projecao.projecaoAjustada)} (déficit previsto de ${formatarMoeda(deficitAjustado)}).`;
    porQue = piorCategoria && piorCategoria.diferenca > 0
      ? `A aceleração crítica ocorreu em ${piorCategoria.categoria}, que está em ${(piorCategoria.indice_ritmo * 100).toFixed(0)}% da velocidade permitida, ultrapassando a cota esperada em ${formatarMoeda(piorCategoria.diferenca)}.`
      : `Os desembolsos variáveis ultrapassaram a linha sustentável em quase 40%.`;
    oQueFazer = `Reduza o desembolso diário para no máximo ${formatarMoeda(status.disponivel_por_dia)} por dia nos próximos ${diasRestantes} dias e suspenda novas compras em ${piorCategoria?.categoria || 'Mercado/Lazer'} até o dia ${Math.min(totalDiasMes, diaAtual + 7)}.`;
  }

  // 3 Consequências concretas do déficit para o mês seguinte:
  let consequencias: Conselho['consequencias'] | undefined;
  if (deficitAjustado > 0) {
    const percColchao = saldoColchaoAtual > 0 ? ((deficitAjustado / saldoColchaoAtual) * 100).toFixed(0) : '100';
    const diasFixaColchao = despesaFixaDiaria > 0 ? (deficitAjustado / despesaFixaDiaria).toFixed(1) : '1';

    // Atraso de meta
    const mesesParaMetaAtual = config.meta_reserva_mensal > 0 ? Math.ceil((config.colchao_meta - saldoColchaoAtual) / config.meta_reserva_mensal) : 12;
    const mesesParaMetaComDeficit = config.meta_reserva_mensal > 0 ? Math.ceil((config.colchao_meta - (saldoColchaoAtual - deficitAjustado)) / config.meta_reserva_mensal) : 14;
    const mesesAtraso = Math.max(1, mesesParaMetaComDeficit - mesesParaMetaAtual);

    // Ajuste no teto de Mercado
    const tetoMercadoAtual = orcamentos.find(o => o.categoria === 'Mercado')?.teto || 1200;
    const novoTetoMercado = Math.max(800, tetoMercadoAtual - deficitAjustado);
    const corteSemanal = Math.round((tetoMercadoAtual - novoTetoMercado) / 4);

    consequencias = {
      dias_colchao: `Um déficit de ${formatarMoeda(deficitAjustado)} consome ${percColchao}% do colchão, que é o equivalente a ${diasFixaColchao} dias de despesa fixa da casa.`,
      atraso_meta: `Com este resultado, a meta do colchão de ${formatarMoeda(config.colchao_meta)} atrasa em aproximadamente ${mesesAtraso} ${mesesAtraso === 1 ? 'mês' : 'meses'}.`,
      novo_teto_sugerido: {
        categoria: 'Mercado',
        teto_atual: tetoMercadoAtual,
        novo_teto: novoTetoMercado,
        corte_semanal_texto: `Para recompor, o teto de mercado do próximo mês precisaria cair de ${formatarMoeda(tetoMercadoAtual)} para ${formatarMoeda(novoTetoMercado)}, o que significa cortar ${formatarMoeda(corteSemanal)} por semana em hortifrúti e extras.`
      }
    };
  }

  return {
    onde_estamos: ondeEstamos,
    por_que: porQue,
    o_que_fazer: oQueFazer,
    projecao_linear: projecao.projecaoLinear,
    projecao_ajustada: projecao.projecaoAjustada,
    deficit_previsto: projecao.deficitAjustada,
    sobra_prevista: projecao.sobraAjustada,
    consequencias
  };
}

// 6. SIMULADOR
// "E se eu gastar R$ ___ em ___?"
export function simularImpactoGasto(
  valor: number,
  categoria: string,
  lancamentosAtuais: Lancamento[],
  orcamentos: OrcamentoItem[],
  fixas: ContaFixa[],
  config: Configuracao,
  reservas: TransacaoReserva[],
  diaAtualParam?: number,
  rendasExtrasParam?: RendaExtra[]
) {
  const agora = new Date();
  const diaAtual = diaAtualParam !== undefined ? diaAtualParam : agora.getDate();
  const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const lancamentoSimulado: Lancamento = {
    id: 'sim-temp',
    data: agora.toISOString().split('T')[0],
    valor,
    categoria,
    subcategoria: 'Simulação',
    forma_pagamento: 'Pix',
    quem: 'Conjunto',
    essencial: 'S',
    mes_ref: mesRef,
    criado_em: agora.toISOString()
  };

  const lancamentosComSimulacao = [...lancamentosAtuais, lancamentoSimulado];
  const statusAntes = calcularStatusRitmo(lancamentosAtuais, orcamentos, diaAtual);
  const statusDepois = calcularStatusRitmo(lancamentosComSimulacao, orcamentos, diaAtual);

  const projecaoAntes = calcularProjecaoFechamento(lancamentosAtuais, orcamentos, fixas, config, diaAtual, undefined, rendasExtrasParam);
  const projecaoDepois = calcularProjecaoFechamento(lancamentosComSimulacao, orcamentos, fixas, config, diaAtual, undefined, rendasExtrasParam);

  const reservaSobrevive = projecaoDepois.sobraAjustada >= config.meta_reserva_mensal;

  return {
    statusAntes,
    statusDepois,
    projecaoAntes,
    projecaoDepois,
    reservaSobrevive,
    impactoDiaria: statusAntes.disponivel_por_dia - statusDepois.disponivel_por_dia,
    novoDisponivelPorDia: statusDepois.disponivel_por_dia
  };
}

export const verificarAlertas = avaliarAlertas;
