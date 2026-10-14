import React, { useState } from 'react';
import {
  AppState,
  alternarStatusContaFixa,
  excluirLancamento,
  limparLancamentosDeExemplo
} from '../services/storage';
import {
  calcularStatusRitmo,
  calcularRitmoPorCategorias,
  calcularProjecaoFechamento,
  formatarMoeda,
  formatarDataBR
} from '../services/engine';
import {
  obterPlanilhaConectada,
  substituirLancamentosNaPlanilha
} from '../services/googleSheets';
import { Check, Clock, AlertTriangle, ShieldCheck, Wallet, Trash2, Sparkles, Receipt, RefreshCw } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarConselheiro: () => void;
}

export const PainelDoMes: React.FC<Props> = ({ appState, setAppState, onAcessarConselheiro }) => {
  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const statusRitmo = calcularStatusRitmo(appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes);
  const categoriasRitmo = calcularRitmoPorCategorias(appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes);
  const projecao = calcularProjecaoFechamento(appState.lancamentos, appState.orcamento, appState.fixas, appState.config, diaAtual, totalDiasMes);

  // Reserva acumulada e aporte no mês
  const aportesMes = appState.reserva
    .filter(r => r.tipo === 'Aporte' && r.data.startsWith(mesRefAtual))
    .reduce((acc, r) => acc + r.valor, 0);

  const saldoColchao = appState.reserva.length > 0
    ? appState.reserva[appState.reserva.length - 1].saldo_acumulado
    : 2000;

  // Fixas: pagas e a vencer
  const fixasAtivas = appState.fixas.filter(f => f.ativo === 'S');
  const fixasPagas = fixasAtivas.filter(f => f.pago_mes_ref === mesRefAtual);
  const fixasAVencer = fixasAtivas.filter(f => f.pago_mes_ref !== mesRefAtual);

  const totalFixasPagas = fixasPagas.reduce((acc, f) => acc + f.valor, 0);
  const totalFixasAVencer = fixasAVencer.reduce((acc, f) => acc + f.valor, 0);

  // Cores semafóricas estritas
  const badgeStyle = {
    'verde': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    'amarelo': 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    'laranja': 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    'vermelho': 'bg-rose-500/15 text-rose-400 border-rose-500/40'
  }[statusRitmo.cor];

  const handleToggleFixa = (descricao: string) => {
    const novoEstado = alternarStatusContaFixa(descricao, appState);
    setAppState(novoEstado);
  };

  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<boolean>(false);

  // Identificar se ainda há os 4 lançamentos de demonstração iniciais
  const idsExemplo = ['lan-1', 'lan-2', 'lan-3', 'lan-4'];
  const temLancamentosExemplo = appState.lancamentos.some(l => idsExemplo.includes(l.id));

  const handleRemoverExemplos = async () => {
    const novoEstado = limparLancamentosDeExemplo(appState);
    setAppState(novoEstado);
    setMensagemFeedback('Gastos de teste removidos! Agora o app contém apenas seus gastos reais.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await substituirLancamentosNaPlanilha(planilha.id, novoEstado.lancamentos);
      setSincronizando(false);
    }

    setTimeout(() => setMensagemFeedback(null), 4000);
  };

  const handleExcluirLancamento = async (id: string) => {
    const novoEstado = excluirLancamento(id, appState);
    setAppState(novoEstado);
    setMensagemFeedback('Lançamento excluído com sucesso.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      await substituirLancamentosNaPlanilha(planilha.id, novoEstado.lancamentos);
    }

    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  return (
    <div id="painel-do-mes-container" className="flex flex-col gap-4 pb-28 pt-2">
      {/* 1. O NÚMERO QUE IMPORTA: Maior número da tela */}
      <div id="card-numero-que-importa" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-6 text-center shadow-lg">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
          O número que importa (dia {diaAtual} de {totalDiasMes})
        </span>
        <div id="valor-disponivel-por-dia" className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl font-mono">
          {formatarMoeda(statusRitmo.disponivel_por_dia)}
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-400">
          você pode gastar por dia até o fim do mês ({statusRitmo.dias_restantes} dias restantes)
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-neutral-500 border-t border-neutral-800/60 pt-2">
          <span>Variável restante: <strong className="text-neutral-300">{formatarMoeda(Math.max(0, statusRitmo.teto_variavel_total - statusRitmo.gasto_variavel_total))}</strong></span>
          <span>•</span>
          <span>Teto mensal: <strong className="text-neutral-300">{formatarMoeda(statusRitmo.teto_variavel_total)}</strong></span>
        </div>
      </div>

      {/* 2. SEMÁFORO DE RITMO */}
      <div id="card-semaforo-ritmo" className={`rounded-2xl border p-4.5 ${badgeStyle}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider uppercase">Semáforo de Ritmo</span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide uppercase border border-current">
            {statusRitmo.estado} ({Math.round(statusRitmo.indice_de_ritmo * 100)}%)
          </span>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed">
          {statusRitmo.explicacao}
        </p>
      </div>
      {/* Feedback de Ação */}
      {mensagemFeedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span>{mensagemFeedback}</span>
          {sincronizando && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-normal">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sincronizando Sheets...
            </span>
          )}
        </div>
      )}

      {/* 2.5 LISTA TRANSPARENTE DE LANÇAMENTOS DO MÊS */}
      <div id="card-lancamentos-recentes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Lançamentos do Mês ({appState.lancamentos.length})
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-white">
            Total: {formatarMoeda(appState.lancamentos.reduce((acc, l) => acc + l.valor, 0))}
          </span>
        </div>

        {/* Banner para limpar lançamentos de exemplo se existirem */}
        {temLancamentosExemplo && (
          <div className="my-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-bold text-amber-300 mb-1">
                  Gastos de demonstração detectados
                </strong>
                <p className="text-neutral-300 leading-relaxed mb-2.5">
                  O aplicativo incluiu 4 lançamentos de teste como exemplo inicial (Muffato, Posto, Feira, Farmácia = R$ 679,70).
                  Deseja removê-los e manter apenas seus gastos reais (como os R$ 75,00 do Arnaldo Lanches)?
                </p>
                <button
                  type="button"
                  onClick={handleRemoverExemplos}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-neutral-950 transition-all hover:bg-amber-300 active:scale-95 flex items-center gap-1.5 shadow"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Limpar Gastos de Teste (Manter apenas os meus)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {appState.lancamentos.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            Nenhum gasto lançado ainda. Use a aba "Lançar" para registrar suas despesas.
          </div>
        ) : (
          <div className="mt-2 divide-y divide-neutral-800/60 max-h-72 overflow-y-auto pr-1">
            {appState.lancamentos.map(l => {
              const isExemplo = idsExemplo.includes(l.id);
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between py-2.5 text-xs group hover:bg-neutral-800/30 px-1 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-neutral-200 truncate">
                        {l.estabelecimento || l.observacao || l.subcategoria}
                      </span>
                      {isExemplo && (
                        <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.2 text-[9px] font-medium text-neutral-400">
                          Exemplo
                        </span>
                      )}
                      <span className="rounded bg-neutral-800 px-1.5 py-0.2 text-[10px] text-neutral-400">
                        {l.categoria}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        ({l.quem})
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                      <span>{formatarDataBR(l.data)}</span>
                      <span>•</span>
                      <span>{l.subcategoria}</span>
                      {l.forma_pagamento && (
                        <>
                          <span>•</span>
                          <span>{l.forma_pagamento}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-sm text-white">
                      {formatarMoeda(l.valor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExcluirLancamento(l.id)}
                      title="Excluir este lançamento"
                      className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. BARRAS POR CATEGORIA VARIÁVEL (com marca vertical do dia) */}
      <div id="card-barras-categorias" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Categorias Variáveis (Gasto vs. Ritmo Esperado)
          </span>
        </div>
        <p className="text-xs text-neutral-400 mb-4">
          A linha vermelha marca onde o gasto deveria estar hoje ({Math.round(statusRitmo.percentual_do_mes * 100)}% do mês).
        </p>

        <div className="space-y-4">
          {categoriasRitmo.filter(c => c.teto > 0).map(cat => {
            const percGastoLimitado = Math.min(100, Math.round(cat.percentual_gasto * 100));
            const percEsperado = Math.min(100, Math.round(cat.percentual_esperado * 100));
            const desvio = cat.diferenca;
            const acimaDoEsperado = desvio > 0;

            return (
              <div key={cat.categoria} id={`barra-cat-${cat.categoria.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-200">{cat.categoria}</span>
                  <span className="font-mono text-neutral-400">
                    <strong className="text-white">{formatarMoeda(cat.gasto)}</strong> / {formatarMoeda(cat.teto)}
                  </span>
                </div>

                {/* Trilha da Barra com Marcação Vertical */}
                <div className="relative h-3 w-full rounded-full bg-neutral-800 overflow-visible">
                  {/* Preenchimento do Gasto Real */}
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      acimaDoEsperado ? 'bg-amber-400' : 'bg-neutral-200'
                    }`}
                    style={{ width: `${percGastoLimitado}%` }}
                  />

                  {/* Marca Vertical do Ritmo Esperado Hoje */}
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-rose-500 shadow-sm shadow-rose-500/80 z-10"
                    style={{ left: `${percEsperado}%` }}
                    title={`Hoje (${diaAtual}): deveria estar em ${percEsperado}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    {acimaDoEsperado ? (
                      <span className="text-amber-400 font-medium">+{formatarMoeda(desvio)} acima do trajeto</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">{formatarMoeda(Math.abs(desvio))} abaixo da cota</span>
                    )}
                  </span>
                  <span>{percGastoLimitado}% do teto</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. FIXAS DO MÊS: pagas, a vencer, vencidas */}
      <div id="card-fixas-mes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Fixas do Mês ({formatarMoeda(projecao.fixasTotal)})
          </span>
          <span className="text-xs text-neutral-400">
            Pagas: <strong className="text-emerald-400">{formatarMoeda(totalFixasPagas)}</strong> | A vencer: <strong className="text-amber-400">{formatarMoeda(totalFixasAVencer)}</strong>
          </span>
        </div>

        <div className="divide-y divide-neutral-800/70">
          {fixasAtivas.map(f => {
            const isPago = f.pago_mes_ref === mesRefAtual;
            const vencida = !isPago && f.dia_vencimento < diaAtual;

            return (
              <div
                key={f.descricao}
                id={`fixa-item-${f.descricao.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center justify-between py-2.5 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold ${isPago ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                      {f.descricao}
                    </span>
                    {vencida && (
                      <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[10px] font-bold text-rose-400">
                        Venceu dia {f.dia_vencimento}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500">Vencimento dia {f.dia_vencimento}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-medium text-neutral-200">{formatarMoeda(f.valor)}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleFixa(f.descricao)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                      isPago
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {isPago ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {isPago ? 'Paga' : 'Pagar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PROJEÇÃO DE FECHAMENTO (Linear vs Ajustada) */}
      <div id="card-projecao-fechamento" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Projeção de Fechamento do Mês
          </span>
          <button
            type="button"
            onClick={onAcessarConselheiro}
            className="text-xs font-bold text-white underline underline-offset-4 hover:opacity-80"
          >
            Ver conselho →
          </button>
        </div>

        {/* Projeção Ajustada em Destaque */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-neutral-400 font-medium">Projeção Ajustada (Destaque)</span>
            <span className="font-mono text-lg font-extrabold text-white">
              {formatarMoeda(projecao.projecaoAjustada)}
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            Separa compras iniciais ({formatarMoeda(projecao.compraGrandeMercado)}) e fixas ({formatarMoeda(projecao.fixasTotal)}), projetando apenas o gasto diário difuso.
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-neutral-800/80 pt-2 text-xs">
            <span>Resultado previsto:</span>
            {projecao.sobraAjustada >= 0 ? (
              <span className="font-bold text-emerald-400">Sobra de {formatarMoeda(projecao.sobraAjustada)}</span>
            ) : (
              <span className="font-bold text-rose-400">Déficit de {formatarMoeda(projecao.deficitAjustada)}</span>
            )}
          </div>
        </div>

        {/* Projeção Linear (comparativa) */}
        <div className="mt-2.5 flex items-center justify-between px-2 text-xs text-neutral-500">
          <span>Projeção Linear simples:</span>
          <span className="font-mono">{formatarMoeda(projecao.projecaoLinear)} ({projecao.sobraLinear >= 0 ? `Sobra ${formatarMoeda(projecao.sobraLinear)}` : `Déficit ${formatarMoeda(projecao.deficitLinear)}`})</span>
        </div>
      </div>

      {/* 6. RESERVA: Meta mensal e Saldo do Colchão */}
      <div id="card-reserva-colchao" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Reserva & Colchão</span>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
            <span className="text-[11px] text-neutral-400 uppercase font-semibold">Meta do Mês</span>
            <div className="mt-1 text-xl font-bold text-white font-mono">{formatarMoeda(aportesMes)}</div>
            <span className="text-[10px] text-neutral-500">de {formatarMoeda(appState.config.meta_reserva_mensal)}</span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
            <span className="text-[11px] text-neutral-400 uppercase font-semibold">Saldo do Colchão</span>
            <div className="mt-1 text-xl font-bold text-emerald-400 font-mono">{formatarMoeda(saldoColchao)}</div>
            <span className="text-[10px] text-neutral-500">meta de {formatarMoeda(appState.config.colchao_meta)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
