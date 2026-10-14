import React, { useState, useMemo, useEffect } from 'react';
import { carregarEstadoInicial, salvarEstado, AppState } from './services/storage';
import { LancamentoRapido } from './components/LancamentoRapido';
import { PainelDoMes } from './components/PainelDoMes';
import { ConselheiroView } from './components/ConselheiroView';
import { SimuladorView } from './components/SimuladorView';
import { TestesECodigoView } from './components/TestesECodigoView';
import { verificarAlertas, calcularStatusRitmo, formatarMoeda } from './services/engine';
import {
  PlusCircle,
  TrendingUp,
  Sparkles,
  Calculator,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Calendar,
  CloudCheck,
  RefreshCw
} from 'lucide-react';
import {
  obterPlanilhaConectada,
  salvarPlanilhaConectada,
  extrairSpreadsheetId,
  puxarDadosCompletosDaPlanilha,
  buscarPlanilhaNoDrive
} from './services/googleSheets';
import { initAuth } from './services/googleAuth';

type AbaAtiva = 'lancamento' | 'painel' | 'conselheiro' | 'simulador' | 'testes';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => carregarEstadoInicial());
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('lancamento');
  const [alertaCriticoDispensado, setAlertaCriticoDispensado] = useState<boolean>(false);
  const [sincronizandoNuvem, setSincronizandoNuvem] = useState<boolean>(false);
  const [statusSincronizacao, setStatusSincronizacao] = useState<'ocioso' | 'sincronizando' | 'sincronizado'>('ocioso');
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);

  // 1. Detectar parâmetro de URL (?planilha=ID ou ?sheet=ID) para conexão instantânea entre o casal
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sheetParam = params.get('planilha') || params.get('sheet') || params.get('sheetId');
      if (sheetParam) {
        const idLimpo = extrairSpreadsheetId(sheetParam);
        if (idLimpo) {
          salvarPlanilhaConectada(idLimpo, 'Orçamento Doméstico Londrina (Casal)');
          console.log('Planilha vinculada via link compartilhado:', idLimpo);
        }
      }
    } catch (e) {
      console.warn('Erro ao processar parâmetros da URL:', e);
    }
  }, []);

  // 2. Detectar se foi aberto dentro do navegador embutido do WhatsApp ou Instagram
  useEffect(() => {
    try {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      if (/FBAN|FBAV|Instagram|WhatsApp|Line|wv/i.test(ua)) {
        setIsInAppBrowser(true);
      }
    } catch (e) {
      // Ignora erro
    }
  }, []);

  // SINCRONIZAÇÃO AUTOMÁTICA EM SEGUNDO PLANO:
  // Ao abrir o app ou ao conectar a conta Google, busca a planilha e popula automaticamente
  useEffect(() => {
    let cancelado = false;
    const unsub = initAuth(async () => {
      if (cancelado) return;
      let planilha = obterPlanilhaConectada();
      if (!planilha) {
        planilha = await buscarPlanilhaNoDrive();
      }
      if (planilha && !cancelado) {
        setSincronizandoNuvem(true);
        setStatusSincronizacao('sincronizando');
        try {
          const resultado = await puxarDadosCompletosDaPlanilha(planilha.id);
          if (!cancelado) {
            setAppState(prev => {
              const atualizado: AppState = {
                ...prev,
                lancamentos: resultado.lancamentos,
                rendasExtras: resultado.rendasExtras,
                fixas: resultado.fixas.length > 0 ? resultado.fixas : prev.fixas,
                orcamento: resultado.orcamento && resultado.orcamento.length > 0 ? resultado.orcamento : prev.orcamento,
                reserva: resultado.reserva && resultado.reserva.length > 0 ? resultado.reserva : prev.reserva
              };
              salvarEstado(atualizado);
              return atualizado;
            });
            setStatusSincronizacao('sincronizado');
          }
        } catch (err) {
          console.warn('Sincronização em background finalizada com aviso:', err);
        } finally {
          if (!cancelado) {
            setSincronizandoNuvem(false);
          }
        }
      }
    });

    return () => {
      cancelado = true;
      unsub();
    };
  }, []);

  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();

  // Verificar se há alertas ativos
  const alertasAtivos = useMemo(() => {
    return verificarAlertas(
      appState.lancamentos,
      appState.orcamento,
      appState.fixas,
      appState.config,
      appState.reserva,
      diaAtual,
      totalDiasMes,
      undefined,
      appState.rendasExtras
    );
  }, [appState, diaAtual, totalDiasMes]);

  // Alerta crítico prioritário (Regra 5 ou Regra 4 ou qualquer vermelho)
  const alertaCritico = useMemo(() => {
    return alertasAtivos.find(a => a.severidade === 'vermelho' || a.tipo === 'Fixas Descobertas');
  }, [alertasAtivos]);

  // Status de ritmo geral
  const statusGeral = useMemo(() => {
    return calcularStatusRitmo(appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes);
  }, [appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes]);

  const handleSimularDia = (novoDia: number) => {
    setAppState(prev => {
      const atualizado = { ...prev, diaAtualSimulado: novoDia };
      salvarEstado(atualizado);
      return atualizado;
    });
    setAlertaCriticoDispensado(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center">
      {/* Container Mobile-first (390px - 440px) */}
      <main className="w-full max-w-md px-4 flex-1 flex flex-col">
        {/* Aviso de Navegador Interno do WhatsApp/Instagram (bloqueia login Google) */}
        {isInAppBrowser && (
          <div className="mt-2 rounded-xl bg-amber-950/80 border border-amber-600/50 p-3 text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300">Atenção ao conectar com o Google no celular:</p>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    Você abriu pelo navegador do WhatsApp. O Google bloqueia login aqui. Toque nos <strong>3 pontinhos ⋮</strong> no topo (ou compartilhar no iPhone) e escolha <strong>"Abrir no Chrome"</strong> ou <strong>"Abrir no Safari"</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInAppBrowser(false)}
                className="text-amber-400 hover:text-white p-1"
                title="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Barra Superior do App */}
        <header className="pt-4 pb-2 border-b border-neutral-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>Orçamento Londrina</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-900 text-neutral-400">
                  Casal
                </span>
              </h1>
              {obterPlanilhaConectada() ? (
                <button
                  type="button"
                  onClick={() => setAbaAtiva('testes')}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded-full hover:bg-emerald-900/50 transition-colors"
                  title="Planilha Google Sheets conectada e sincronizada"
                >
                  {sincronizandoNuvem ? (
                    <RefreshCw className="h-2.5 w-2.5 animate-spin text-emerald-400" />
                  ) : (
                    <CloudCheck className="h-3 w-3 text-emerald-400" />
                  )}
                  <span>{sincronizandoNuvem ? 'Sincronizando...' : 'Sheets'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAbaAtiva('testes')}
                  className="flex items-center gap-1 text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 hover:border-emerald-600/50 hover:text-emerald-400 px-2 py-0.5 rounded-full transition-colors"
                  title="Conectar Google Sheets"
                >
                  <FileSpreadsheet className="h-2.5 w-2.5" />
                  <span>Conectar</span>
                </button>
              )}
            </div>
            {(() => {
              const mesAtualStr = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
              const rendasExtrasMes = (appState.rendasExtras || [])
                .filter(r => r.mes_ref === mesAtualStr)
                .reduce((acc, r) => acc + r.valor, 0);
              const totalRendaMes = appState.config.renda_liquida_mensal + rendasExtrasMes;
              return (
                <p className="text-[11px] text-neutral-400">
                  Renda mês: <strong className="text-neutral-200">{formatarMoeda(totalRendaMes)}</strong>
                  {rendasExtrasMes > 0 && (
                    <span className="text-emerald-400 font-bold ml-1">
                      (+{formatarMoeda(rendasExtrasMes)})
                    </span>
                  )}
                </p>
              );
            })()}
          </div>

          {/* Seletor rápido de dia para simular o mês */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1">
            <Calendar className="h-3 w-3 text-neutral-400" />
            <span className="text-xs font-semibold text-neutral-300">Dia:</span>
            <select
              id="select-dia-simulado"
              value={diaAtual}
              onChange={e => handleSimularDia(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer"
            >
              {Array.from({ length: totalDiasMes }, (_, i) => i + 1).map(d => (
                <option key={d} value={d} className="bg-neutral-900 text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Banner de Alerta Crítico no Topo (Regra 5 / Regra 4) */}
        {alertaCritico && !alertaCriticoDispensado && (
          <div
            id="banner-alerta-critico-topo"
            className="mt-3 rounded-xl border border-rose-600 bg-rose-950/80 p-3.5 text-xs text-rose-200 shadow-lg animate-in fade-in"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <strong className="font-bold uppercase tracking-wider text-rose-300 block mb-0.5">
                    {alertaCritico.tipo}
                  </strong>
                  <p className="leading-relaxed">{alertaCritico.mensagem}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlertaCriticoDispensado(true)}
                className="text-rose-400 hover:text-white p-0.5 transition-colors"
                title="Entendi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Principal de Acordo com a Aba Ativa */}
        <div className="flex-1">
          {abaAtiva === 'lancamento' && (
            <LancamentoRapido
              appState={appState}
              setAppState={setAppState}
              onAcessarPainel={() => setAbaAtiva('painel')}
            />
          )}

          {abaAtiva === 'painel' && (
            <PainelDoMes
              appState={appState}
              setAppState={setAppState}
              onAcessarConselheiro={() => setAbaAtiva('conselheiro')}
            />
          )}

          {abaAtiva === 'conselheiro' && (
            <ConselheiroView
              appState={appState}
              setAppState={setAppState}
            />
          )}

          {abaAtiva === 'simulador' && (
            <SimuladorView
              appState={appState}
            />
          )}

          {abaAtiva === 'testes' && (
            <TestesECodigoView
              appState={appState}
              setAppState={setAppState}
              onAcessarPainel={() => setAbaAtiva('painel')}
            />
          )}
        </div>

        {/* Barra de Navegação Inferior Fixa (5 Abas, Mobile-First) */}
        <nav
          id="barra-navegacao-inferior"
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-800/90 bg-neutral-950/95 px-2 py-2 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-md items-center justify-around">
            <button
              id="tab-btn-lancar"
              type="button"
              onClick={() => setAbaAtiva('lancamento')}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                abaAtiva === 'lancamento'
                  ? 'text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <PlusCircle className={`h-5 w-5 ${abaAtiva === 'lancamento' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px]">Lançar</span>
            </button>

            <button
              id="tab-btn-painel"
              type="button"
              onClick={() => setAbaAtiva('painel')}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                abaAtiva === 'painel'
                  ? 'text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <TrendingUp className={`h-5 w-5 ${abaAtiva === 'painel' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px]">Painel</span>
            </button>

            <button
              id="tab-btn-conselho"
              type="button"
              onClick={() => setAbaAtiva('conselheiro')}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                abaAtiva === 'conselheiro'
                  ? 'text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className={`h-5 w-5 ${abaAtiva === 'conselheiro' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px]">Conselho</span>
            </button>

            <button
              id="tab-btn-simular"
              type="button"
              onClick={() => setAbaAtiva('simulador')}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                abaAtiva === 'simulador'
                  ? 'text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Calculator className={`h-5 w-5 ${abaAtiva === 'simulador' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px]">Simular</span>
            </button>

            <button
              id="tab-btn-testes"
              type="button"
              onClick={() => setAbaAtiva('testes')}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all active:scale-95 ${
                abaAtiva === 'testes'
                  ? 'text-emerald-400 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <FileSpreadsheet className={`h-5 w-5 ${abaAtiva === 'testes' ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[11px]">Planilha</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}
