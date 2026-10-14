import React, { useState } from 'react';
import { AppState } from '../services/storage';
import { simularImpactoGasto, formatarMoeda } from '../services/engine';
import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  appState: AppState;
}

export const SimuladorView: React.FC<Props> = ({ appState }) => {
  const [valorInput, setValorInput] = useState<string>('350');
  const [categoria, setCategoria] = useState<string>('Mercado');

  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();

  const valorNum = parseFloat(valorInput.replace(',', '.')) || 0;

  const resultado = simularImpactoGasto(
    valorNum,
    categoria,
    appState.lancamentos,
    appState.orcamento,
    appState.fixas,
    appState.config,
    appState.reserva,
    diaAtual,
    appState.rendasExtras
  );

  return (
    <div id="simulador-view-container" className="flex flex-col gap-4 pb-28 pt-2">
      {/* Header do Simulador */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-neutral-300" />
          <h2 className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
            Simulador de Compra
          </h2>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Use antes de compras grandes. Descubra o impacto instantâneo no ritmo diário e se a reserva do mês sobrevive.
        </p>
      </div>

      {/* Formulário Interativo "E se eu gastar R$ ___ em ___?" */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-6 shadow-lg space-y-4">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
          E se eu gastar agora...
        </span>

        <div className="space-y-3">
          <div>
            <label htmlFor="input-sim-valor" className="text-xs text-neutral-400 font-semibold block mb-1">
              Valor da Compra (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-neutral-400 font-mono text-sm">R$</span>
              <input
                id="input-sim-valor"
                type="number"
                step="10"
                min="0"
                value={valorInput}
                onChange={e => setValorInput(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 pl-10 pr-4 text-base font-bold text-white font-mono focus:border-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="select-sim-cat" className="text-xs text-neutral-400 font-semibold block mb-1">
              Na Categoria
            </label>
            <select
              id="select-sim-cat"
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm font-semibold text-white focus:border-neutral-500 focus:outline-none"
            >
              {appState.orcamento
                .filter(o => o.tipo === 'Variável' && o.teto > 0)
                .map(o => (
                  <option key={o.categoria} value={o.categoria}>
                    {o.categoria} (Teto: {formatarMoeda(o.teto)})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Atalhos Rápidos de Teste */}
        <div className="flex gap-2 pt-1">
          {['150', '350', '600', '1000'].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => setValorInput(val)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition-all ${
                valorInput === val
                  ? 'bg-neutral-800 text-white border-neutral-600'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:bg-neutral-800/50'
              }`}
            >
              R$ {val}
            </button>
          ))}
        </div>
      </div>

      {/* Resultados Instantâneos da Simulação */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg space-y-4">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
          Impacto Instantâneo da Compra
        </span>

        {/* 1. Impacto no Ritmo */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Índice de Ritmo</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{Math.round(resultado.statusAntes.indice_de_ritmo * 100)}%</span>
              <span>→</span>
              <strong className={`font-mono text-sm ${
                resultado.statusDepois.cor === 'verde' ? 'text-emerald-400' :
                resultado.statusDepois.cor === 'amarelo' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {Math.round(resultado.statusDepois.indice_de_ritmo * 100)}% ({resultado.statusDepois.estado})
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Impacto na Cota Diária */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Disponível por dia</span>
            <div className="flex items-center gap-2">
              <span className="font-mono">{formatarMoeda(resultado.statusAntes.disponivel_por_dia)}</span>
              <span>→</span>
              <strong className="font-mono text-sm text-white">
                {formatarMoeda(resultado.novoDisponivelPorDia)}
              </strong>
            </div>
          </div>
          <div className="mt-1 text-[11px] text-neutral-500">
            Corte diário de {formatarMoeda(resultado.impactoDiaria)} por dia nos próximos {resultado.statusDepois.dias_restantes} dias.
          </div>
        </div>

        {/* 3. A Reserva Sobrevive? */}
        <div className={`rounded-xl border p-4 ${
          resultado.reservaSobrevive
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
        }`}>
          <div className="flex items-start gap-2.5">
            {resultado.reservaSobrevive ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div>
              <strong className="text-xs uppercase tracking-wider block">
                {resultado.reservaSobrevive ? 'A Reserva Sobrevive' : 'A Reserva Não Sobrevive'}
              </strong>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {resultado.reservaSobrevive
                  ? `Mesmo com esta compra, a sobra projetada (${formatarMoeda(resultado.projecaoDepois.sobraAjustada)}) é suficiente para o aporte de ${formatarMoeda(appState.config.meta_reserva_mensal)} na reserva.`
                  : `Com esta compra, o mês fechará com déficit ou sobra de apenas ${formatarMoeda(Math.max(0, resultado.projecaoDepois.sobraAjustada))}, consumindo parte da meta de reserva de ${formatarMoeda(appState.config.meta_reserva_mensal)}.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
