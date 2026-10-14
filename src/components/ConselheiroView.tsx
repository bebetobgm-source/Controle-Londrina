import React, { useState } from 'react';
import { AppState, atualizarTetoOrcamento } from '../services/storage';
import { gerarConselho, formatarMoeda } from '../services/engine';
import { Check, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const ConselheiroView: React.FC<Props> = ({ appState, setAppState }) => {
  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();

  const conselho = gerarConselho(
    appState.lancamentos,
    appState.orcamento,
    appState.fixas,
    appState.config,
    appState.reserva,
    diaAtual,
    totalDiasMes
  );

  const [tetoAplicadoSucesso, setTetoAplicadoSucesso] = useState<string | null>(null);

  const handleAplicarNovoTeto = () => {
    if (!conselho.consequencias?.novo_teto_sugerido) return;
    const { categoria, novo_teto } = conselho.consequencias.novo_teto_sugerido;

    const novoEstado = atualizarTetoOrcamento(categoria, novo_teto, appState);
    setAppState(novoEstado);
    setTetoAplicadoSucesso(`Teto de ${categoria} atualizado para ${formatarMoeda(novo_teto)} no planejamento.`);

    setTimeout(() => {
      setTetoAplicadoSucesso(null);
    }, 4000);
  };

  return (
    <div id="conselheiro-container" className="flex flex-col gap-4 pb-28 pt-2">
      {/* Header do Conselheiro */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-neutral-300" />
          <h2 className="text-sm font-bold tracking-wider text-neutral-300 uppercase">
            Conselheiro Financeiro da Casa
          </h2>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Análise direta baseada no ritmo real do mês. Não apenas quanto gastou, mas o que isso significa para o casal.
        </p>
      </div>

      {/* Os 3 Blocos Obrigatórios */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-6 shadow-lg space-y-6">
        {/* Bloco 1: Onde estamos */}
        <div id="bloco-onde-estamos" className="space-y-1.5">
          <span className="text-[11px] font-extrabold tracking-wider text-neutral-400 uppercase">
            1. Onde Estamos (Fato com número)
          </span>
          <p className="text-base font-semibold leading-relaxed text-neutral-100">
            {conselho.onde_estamos}
          </p>
        </div>

        {/* Bloco 2: Por que */}
        <div id="bloco-por-que" className="space-y-1.5 border-t border-neutral-800/80 pt-4">
          <span className="text-[11px] font-extrabold tracking-wider text-neutral-400 uppercase">
            2. Por Quê (Culpado concreto)
          </span>
          <p className="text-base font-semibold leading-relaxed text-neutral-100">
            {conselho.por_que}
          </p>
        </div>

        {/* Bloco 3: O que fazer */}
        <div id="bloco-o-que-fazer" className="space-y-1.5 border-t border-neutral-800/80 pt-4">
          <span className="text-[11px] font-extrabold tracking-wider text-neutral-400 uppercase">
            3. O Que Fazer (Ação executável nesta semana)
          </span>
          <div className="rounded-xl border border-neutral-700 bg-neutral-800/60 p-4">
            <p className="text-sm font-bold leading-relaxed text-white">
              {conselho.o_que_fazer}
            </p>
          </div>
        </div>
      </div>

      {/* CONSEQUÊNCIAS CONCRETAS PARA O MÊS SEGUINTE (Em caso de déficit) */}
      {conselho.consequencias && (
        <div id="card-consequencias-deficit" className="rounded-2xl border border-rose-900/50 bg-neutral-900/95 p-5 shadow-lg">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold tracking-wider uppercase">
              Consequências Concretas do Déficit ({formatarMoeda(conselho.deficit_previsto)})
            </span>
          </div>

          <div className="mt-4 space-y-3.5 divide-y divide-neutral-800/70 text-xs">
            {/* 1. Em dias de colchão */}
            <div className="pt-2">
              <strong className="text-neutral-300 block mb-1">1. Impacto no Colchão:</strong>
              <p className="text-neutral-400 leading-relaxed">
                {conselho.consequencias.dias_colchao}
              </p>
            </div>

            {/* 2. Em atraso de meta */}
            <div className="pt-3">
              <strong className="text-neutral-300 block mb-1">2. Atraso na Meta de Reserva:</strong>
              <p className="text-neutral-400 leading-relaxed">
                {conselho.consequencias.atraso_meta}
              </p>
            </div>

            {/* 3. Em teto do mês seguinte COM BOTÃO ATIVO */}
            <div className="pt-3 space-y-3">
              <div>
                <strong className="text-neutral-300 block mb-1">3. Recomposição de Teto:</strong>
                <p className="text-neutral-400 leading-relaxed">
                  {conselho.consequencias.novo_teto_sugerido.corte_semanal_texto}
                </p>
              </div>

              {tetoAplicadoSucesso ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-400">
                  <Check className="h-4 w-4" />
                  <span>{tetoAplicadoSucesso}</span>
                </div>
              ) : (
                <button
                  id="btn-aplicar-novo-teto"
                  type="button"
                  onClick={handleAplicarNovoTeto}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-extrabold text-neutral-950 shadow hover:bg-neutral-100 active:scale-[0.98] transition-all"
                >
                  <span>Aplicar novo teto de {formatarMoeda(conselho.consequencias.novo_teto_sugerido.novo_teto)}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Projeção Comparativa Resumida */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 text-xs text-neutral-400">
        <div className="flex justify-between items-center py-1">
          <span>Projeção Ajustada (difuso + fixas + compra inicial):</span>
          <strong className="text-neutral-200 font-mono">{formatarMoeda(conselho.projecao_ajustada)}</strong>
        </div>
        <div className="flex justify-between items-center py-1 border-t border-neutral-800/60">
          <span>Projeção Linear simples:</span>
          <strong className="text-neutral-400 font-mono">{formatarMoeda(conselho.projecao_linear)}</strong>
        </div>
      </div>
    </div>
  );
};
