import React, { useState } from 'react';
import {
  AppState,
  aplicarCenarioDia15,
  aplicarCenarioHigiene91,
  aplicarCenarioVoltinhasMercado,
  resetarParaDadosPadrao
} from '../services/storage';
import { Play, RotateCcw, Bell, CheckCircle2 } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarPainel: () => void;
}

export const TestesECodigoView: React.FC<Props> = ({ appState, setAppState, onAcessarPainel }) => {
  const [abaInterna, setAbaInterna] = useState<'testes' | 'logs'>('testes');
  const [feedbackTeste, setFeedbackTeste] = useState<string | null>(null);

  const handleExecutarDia15 = () => {
    const novo = aplicarCenarioDia15(appState);
    setAppState(novo);
    setFeedbackTeste(
      '✅ Cenário 1 aplicado em memória: Dia 15 do mês, sem aporte de reserva ainda. Alerta preventivo disparado.'
    );
  };

  const handleExecutarHigiene91 = () => {
    const { estadoAtualizado, alertas } = aplicarCenarioHigiene91(appState);
    setAppState(estadoAtualizado);
    const msg = alertas.length > 0 ? alertas[0].mensagem : 'Lançamento registrado.';
    setFeedbackTeste(`✅ Cenário 2 aplicado em memória: R$ 91,88 em Higiene (Ela). Alerta: "${msg}"`);
  };

  const handleExecutarVoltinhas = () => {
    const novo = aplicarCenarioVoltinhasMercado(appState);
    setAppState(novo);
    setFeedbackTeste(
      '✅ Cenário 3 aplicado em memória: 5 compras de Mercado (R$ 450 + R$ 45 + R$ 68 + R$ 52 + R$ 74 = R$ 689).'
    );
  };

  const handleResetar = () => {
    const padrao = resetarParaDadosPadrao();
    setAppState(padrao);
    setFeedbackTeste('🔄 Estado em memória restaurado para os dados de teste.');
  };

  return (
    <div id="tela-testes-e-codigo" className="space-y-4 pb-24 pt-2">
      {/* Seletor de Sub-aba */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        <button
          id="subtab-testes"
          type="button"
          onClick={() => setAbaInterna('testes')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all ${
            abaInterna === 'testes'
              ? 'bg-white text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Play className="h-3.5 w-3.5" />
          Cenários (Dev)
        </button>

        <button
          id="subtab-logs"
          type="button"
          onClick={() => setAbaInterna('logs')}
          className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all ${
            abaInterna === 'logs'
              ? 'bg-white text-neutral-950 shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Bell className="h-3.5 w-3.5" />
          Alertas ({appState.alertasLog.length})
        </button>
      </div>

      {/* Feedback de Execução de Teste */}
      {feedbackTeste && (
        <div
          id="banner-feedback-teste"
          className="rounded-xl border border-emerald-700/60 bg-emerald-950/50 p-3.5 text-xs text-emerald-200"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold leading-relaxed">{feedbackTeste}</p>
              <button
                type="button"
                onClick={onAcessarPainel}
                className="mt-2 font-bold text-emerald-400 underline hover:text-emerald-300"
              >
                Ir para o Painel do Mês ver o resultado →
              </button>
            </div>
          </div>
        </div>
      )}

      {abaInterna === 'testes' && (
        <div id="secao-cenarios-teste" className="space-y-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <h2 className="text-sm font-bold text-white">3 Cenários de Teste (Apenas em Memória)</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Estes cenários alteram apenas o estado em memória para validação local e nunca gravam dados de exemplo no Firestore.
            </p>

            <div className="mt-4 space-y-3">
              {/* Cenário 1 */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded bg-amber-950 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-800/60 uppercase">
                      Cenário 1 • Dia 15 do Mês
                    </span>
                    <h3 className="mt-1.5 text-xs font-bold text-white">
                      Metade do mês com R$ 1.225 variáveis e Reserva R$ 0
                    </h3>
                    <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                      Simula o dia 15 com compras no Muffato Duque (R$ 750), Posto Shell (R$ 240), Feira (R$ 145) e Pizzaria (R$ 90), sem aporte na Reserva.
                    </p>
                  </div>
                </div>
                <button
                  id="btn-cenario-1-dia15"
                  type="button"
                  onClick={handleExecutarDia15}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-800 py-2 text-xs font-bold text-white hover:bg-neutral-700 active:scale-98 transition-all"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                  Aplicar Cenário 1 (Dia 15)
                </button>
              </div>

              {/* Cenário 2 */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5">
                <div>
                  <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-bold text-rose-300 border border-rose-800/60 uppercase">
                    Cenário 2 • Compra de R$ 91,88 em Higiene
                  </span>
                  <h3 className="mt-1.5 text-xs font-bold text-white">
                    Lançamento por &quot;Ela&quot; na Droga Raia Ayrton Senna
                  </h3>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                    Adiciona um gasto de R$ 91,88 na subcategoria Higiene para testar o gatilho de consumo do teto de Mercado.
                  </p>
                </div>
                <button
                  id="btn-cenario-2-higiene"
                  type="button"
                  onClick={handleExecutarHigiene91}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-800 py-2 text-xs font-bold text-white hover:bg-neutral-700 active:scale-98 transition-all"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                  Simular Gasto R$ 91,88 (Higiene - Ela)
                </button>
              </div>

              {/* Cenário 3 */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5">
                <div>
                  <span className="rounded bg-purple-950 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/60 uppercase">
                    Cenário 3 • 5 Compras de Mercado no Mês
                  </span>
                  <h3 className="mt-1.5 text-xs font-bold text-white">
                    Detector de &quot;Voltinhas no Mercado&quot; (4 idas extras = R$ 239)
                  </h3>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
                    Injeta 1 compra grande de início de mês (R$ 450) + 4 idas menores (Padaria, Hortifrúti, Açougue).
                  </p>
                </div>
                <button
                  id="btn-cenario-3-voltinhas"
                  type="button"
                  onClick={handleExecutarVoltinhas}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-800 py-2 text-xs font-bold text-white hover:bg-neutral-700 active:scale-98 transition-all"
                >
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                  Aplicar Cenário 3 (5 idas ao Mercado)
                </button>
              </div>
            </div>

            <button
              id="btn-resetar-dados"
              type="button"
              onClick={handleResetar}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-950 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Dados de Teste em Memória
            </button>
          </div>
        </div>
      )}

      {abaInterna === 'logs' && (
        <div id="secao-alertas-log" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-sm font-bold text-white">Histórico de Alertas Disparados</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Registro auditável de todos os gatilhos preventivos de orçamento.
          </p>

          {appState.alertasLog.length === 0 ? (
            <p className="mt-4 text-xs text-neutral-500">Nenhum alerta registrado no log ainda.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {appState.alertasLog.map(a => (
                <div
                  key={a.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400">{a.tipo}</span>
                    <span className="font-mono text-[10px] text-neutral-500">{a.data_hora}</span>
                  </div>
                  <p className="mt-1 text-neutral-200 leading-relaxed">{a.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
