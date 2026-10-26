import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  carregarEstadoInicial,
  salvarEstado,
  AppState,
  obterRotuloQuem,
  formatarMesExibicao,
  navegarMes,
  filtrarLancamentosDoMes,
  vincularPorCodigoCasal,
  aplicarOnboardingNovoCasal
} from './services/storage';
import { LancamentoRapido } from './components/LancamentoRapido';
import { PainelDoMes } from './components/PainelDoMes';
import { ConselheiroView } from './components/ConselheiroView';
import { SimuladorView } from './components/SimuladorView';
import { TestesECodigoView } from './components/TestesECodigoView';
import { LandingPageSaaS } from './components/LandingPageSaaS';
import { OnboardingCasal } from './components/OnboardingCasal';
import { GestaoCasalSaaSModal } from './components/GestaoCasalSaaSModal';
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
  RefreshCw,
  ShieldAlert,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
  Crown
} from 'lucide-react';
import {
  obterPlanilhaConectada,
  salvarPlanilhaConectada,
  extrairSpreadsheetId,
  puxarDadosCompletosDaPlanilha,
  buscarPlanilhaNoDrive
} from './services/googleSheets';
import { initAuth, isTokenExpirado, renovarTokenGoogle } from './services/googleAuth';

type AbaAtiva = 'lancamento' | 'painel' | 'conselheiro' | 'simulador' | 'testes';
type ModoTelaSaaS = 'app' | 'landing' | 'onboarding';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => carregarEstadoInicial());
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('lancamento');
  const [modoTelaSaaS, setModoTelaSaaS] = useState<ModoTelaSaaS>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('modo') === 'vendas' || params.get('landing') === '1') return 'landing';
    return 'app';
  });
  const [modalSaaSAberto, setModalSaaSAberto] = useState<boolean>(false);
  const [abaModalSaaS, setAbaModalSaaS] = useState<'casal' | 'orcamento' | 'virar_mes' | 'assinatura'>('casal');
  const [alertaCriticoDispensado, setAlertaCriticoDispensado] = useState<boolean>(false);
  const [sincronizandoNuvem, setSincronizandoNuvem] = useState<boolean>(false);
  const [statusSincronizacao, setStatusSincronizacao] = useState<'ocioso' | 'sincronizando' | 'sincronizado'>('ocioso');
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [sessaoGoogleExpirada, setSessaoGoogleExpirada] = useState<boolean>(false);
  const [notificacaoSincronizacao, setNotificacaoSincronizacao] = useState<string | null>(null);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<string | null>(() => {
    return localStorage.getItem('orcamento_londrina_last_sync') || null;
  });

  // Função central de sincronização contínua com a planilha do casal
  const sincronizarComPlanilha = useCallback(
    async (silencioso = true, avisarSeNovo = true) => {
      let planilha = obterPlanilhaConectada();
      if (!planilha) {
        planilha = await buscarPlanilhaNoDrive();
      }
      if (!planilha) return;

      if (isTokenExpirado()) {
        setSessaoGoogleExpirada(true);
        return;
      }

      setSincronizandoNuvem(true);
      setStatusSincronizacao('sincronizando');

      try {
        const resultado = await puxarDadosCompletosDaPlanilha(planilha.id);
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setUltimaSincronizacao(horaAtual);
        setSessaoGoogleExpirada(false);
        setStatusSincronizacao('sincronizado');

        setAppState(prev => {
          const nomeParceira = obterRotuloQuem('Ela', prev.config);
          // Detectar lançamentos novos do cônjuge
          if (avisarSeNovo && resultado.lancamentos.length > prev.lancamentos.length) {
            const diferenca = resultado.lancamentos.length - prev.lancamentos.length;
            const novoDaEsposa = resultado.lancamentos.find(
              l => l.quem === 'Ela' && !prev.lancamentos.some(pl => pl.id === l.id)
            );
            if (novoDaEsposa) {
              setNotificacaoSincronizacao(
                `✨ Novo gasto de ${nomeParceira} sincronizado: ${formatarMoeda(novoDaEsposa.valor)} (${novoDaEsposa.categoria})`
              );
            } else {
              setNotificacaoSincronizacao(
                `✨ ${diferenca} novo(s) gasto(s) sincronizado(s) da planilha do casal!`
              );
            }
            setTimeout(() => setNotificacaoSincronizacao(null), 5000);
          } else if (!silencioso) {
            setNotificacaoSincronizacao(
              `✨ Tudo atualizado com o Sheets! (${resultado.lancamentos.length} gastos compartilhados)`
            );
            setTimeout(() => setNotificacaoSincronizacao(null), 3500);
          }

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
      } catch (err: any) {
        if (err.message?.includes('expirou') || isTokenExpirado()) {
          setSessaoGoogleExpirada(true);
        }
        if (!silencioso) {
          setNotificacaoSincronizacao(err.message || 'Erro ao sincronizar com a planilha.');
          setTimeout(() => setNotificacaoSincronizacao(null), 4000);
        }
      } finally {
        setSincronizandoNuvem(false);
      }
    },
    []
  );

  // 1. Detectar parâmetro de URL (?planilha=ID, ?sheet=ID ou ?convite=CASAL-XXXX) para conexão instantânea do par
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sheetParam = params.get('planilha') || params.get('sheet') || params.get('sheetId');
      const conviteParam = params.get('convite') || params.get('casal');

      if (conviteParam) {
        setAppState(prev => {
          const { estadoAtualizado } = vincularPorCodigoCasal(conviteParam, prev);
          return estadoAtualizado;
        });
        setModoTelaSaaS('app');
        setNotificacaoSincronizacao(
          `🔗 Conectado ao orçamento familiar (${conviteParam.toUpperCase()})!`
        );
        setTimeout(() => setNotificacaoSincronizacao(null), 5000);
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (sheetParam) {
        const idLimpo = extrairSpreadsheetId(sheetParam);
        if (idLimpo) {
          salvarPlanilhaConectada(idLimpo, 'Orçamento Doméstico Londrina (Casal)');
          setNotificacaoSincronizacao('🔗 Conectado à planilha do casal! Sincronizando dados compartilhados...');
          sincronizarComPlanilha(false, false);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch (e) {
      console.warn('Erro ao processar parâmetros da URL:', e);
    }
  }, [sincronizarComPlanilha]);

  // 2. Detectar se foi aberto dentro do navegador embutido do WhatsApp ou Instagram
  useEffect(() => {
    try {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      if (/FBAN|FBAV|Instagram|WhatsApp|Line|wv/i.test(ua)) {
        setIsInAppBrowser(true);
      }
    } catch {
      // Ignora erro
    }
  }, []);

  // 3. SINCRONIZAÇÃO AUTOMÁTICA INICIAL E AUTH LISTENER
  useEffect(() => {
    let cancelado = false;
    const unsub = initAuth(async () => {
      if (cancelado) return;
      sincronizarComPlanilha(true, true);
    });

    return () => {
      cancelado = true;
      unsub();
    };
  }, [sincronizarComPlanilha]);

  // 4. POLLING AUTOMÁTICO A CADA 20 SEGUNDOS (sincroniza despesas do cônjuge em tempo real)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sincronizarComPlanilha(true, true);
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [sincronizarComPlanilha]);

  // 5. SINCRONIZAR AO RETORNAR PARA O APP E ENTRE ABAS (storage listener para código do casal)
  useEffect(() => {
    const handleVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        sincronizarComPlanilha(true, true);
      }
    };
    const handleFoco = () => {
      sincronizarComPlanilha(true, true);
    };
    const handleSyncAtualizado = () => {
      sincronizarComPlanilha(true, false);
    };
    const handleExpirou = () => {
      setSessaoGoogleExpirada(true);
    };
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('orcamento_')) {
        setAppState(carregarEstadoInicial());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilidade);
    window.addEventListener('focus', handleFoco);
    window.addEventListener('orcamento-sync-updated', handleSyncAtualizado);
    window.addEventListener('orcamento-google-sessao-expirada', handleExpirou);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilidade);
      window.removeEventListener('focus', handleFoco);
      window.removeEventListener('orcamento-sync-updated', handleSyncAtualizado);
      window.removeEventListener('orcamento-google-sessao-expirada', handleExpirou);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [sincronizarComPlanilha]);

  // 6. SINCRONIZAR AO TROCAR DE ABA (ex: ir para o Painel)
  useEffect(() => {
    sincronizarComPlanilha(true, false);
  }, [abaAtiva, sincronizarComPlanilha]);

  const handleRenovarSessao = async () => {
    try {
      setSincronizandoNuvem(true);
      await renovarTokenGoogle();
      setSessaoGoogleExpirada(false);
      await sincronizarComPlanilha(false, true);
    } catch (e: any) {
      console.warn('Renovação de sessão:', e);
    } finally {
      setSincronizandoNuvem(false);
    }
  };

  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const mesAtivo = appState.mesAtivo || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [anoAtivoNum, mesAtivoNum] = mesAtivo.split('-').map(Number);
  const totalDiasMes = new Date(anoAtivoNum || agora.getFullYear(), mesAtivoNum || (agora.getMonth() + 1), 0).getDate();

  const lancamentosMesAtivo = useMemo(() => {
    return filtrarLancamentosDoMes(appState.lancamentos, mesAtivo);
  }, [appState.lancamentos, mesAtivo]);

  // Verificar se há alertas ativos no mês ativo
  const alertasAtivos = useMemo(() => {
    return verificarAlertas(
      lancamentosMesAtivo,
      appState.orcamento,
      appState.fixas,
      appState.config,
      appState.reserva,
      diaAtual,
      totalDiasMes,
      undefined,
      appState.rendasExtras
    );
  }, [lancamentosMesAtivo, appState.orcamento, appState.fixas, appState.config, appState.reserva, appState.rendasExtras, diaAtual, totalDiasMes]);

  // Alerta crítico prioritário (Regra 5 ou Regra 4 ou qualquer vermelho)
  const alertaCritico = useMemo(() => {
    return alertasAtivos.find(a => a.severidade === 'vermelho' || a.tipo === 'Fixas Descobertas');
  }, [alertasAtivos]);

  const handleSimularDia = (novoDia: number) => {
    setAppState(prev => {
      const atualizado = { ...prev, diaAtualSimulado: novoDia };
      salvarEstado(atualizado);
      return atualizado;
    });
    setAlertaCriticoDispensado(false);
  };

  const handleMudarMes = (direcao: -1 | 1) => {
    setAppState(prev => {
      const novoMes = navegarMes(prev.mesAtivo, direcao);
      const atualizado = { ...prev, mesAtivo: novoMes };
      salvarEstado(atualizado);
      return atualizado;
    });
  };

  const handleAbrirConfigSaaS = (aba: 'casal' | 'orcamento' | 'virar_mes' | 'assinatura' = 'casal') => {
    setAbaModalSaaS(aba);
    setModalSaaSAberto(true);
  };

  // Se estiver na Landing Page de Vendas SaaS
  if (modoTelaSaaS === 'landing') {
    return (
      <LandingPageSaaS
        codigoAtual={appState.config.codigo_casal}
        nomeFamiliaAtual={appState.config.nome_familia}
        onVoltarPainelAtual={() => setModoTelaSaaS('app')}
        onIniciarOnboarding={() => setModoTelaSaaS('onboarding')}
        onVincularCodigo={codigo => {
          const { estadoAtualizado } = vincularPorCodigoCasal(codigo, appState);
          setAppState(estadoAtualizado);
          setModoTelaSaaS('app');
          setNotificacaoSincronizacao(`🔗 Conectado ao orçamento do casal (${codigo})!`);
          setTimeout(() => setNotificacaoSincronizacao(null), 4000);
        }}
      />
    );
  }

  // Se estiver no Onboarding Guiado de 3 Passos
  if (modoTelaSaaS === 'onboarding') {
    return (
      <OnboardingCasal
        onCancelar={() => setModoTelaSaaS('app')}
        onVincularCodigoExistente={codigo => {
          const { estadoAtualizado } = vincularPorCodigoCasal(codigo, appState);
          setAppState(estadoAtualizado);
          setModoTelaSaaS('app');
          setNotificacaoSincronizacao(`🔗 Celular conectado ao código ${codigo}!`);
          setTimeout(() => setNotificacaoSincronizacao(null), 4000);
        }}
        onConcluirOnboarding={dados => {
          const novo = aplicarOnboardingNovoCasal(dados, appState);
          setAppState(novo);
          setModoTelaSaaS('app');
          setAbaAtiva('painel');
          setNotificacaoSincronizacao(
            `🎉 Painel de ${novo.config.nome_familia} criado! Código do casal: ${novo.config.codigo_casal}`
          );
          setTimeout(() => setNotificacaoSincronizacao(null), 6000);
        }}
      />
    );
  }

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

        {/* Notificação Flutuante de Sincronização / Novos Gastos do Cônjuge */}
        {notificacaoSincronizacao && (
          <div className="mt-2 p-2.5 rounded-xl bg-emerald-950/95 border border-emerald-500/80 text-xs text-emerald-200 flex items-center justify-between shadow-xl shadow-emerald-950/60 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{notificacaoSincronizacao}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificacaoSincronizacao(null)}
              className="text-emerald-400 hover:text-white p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Alerta de Sessão do Google Expirada com 1-Click Refresh */}
        {sessaoGoogleExpirada && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-950/90 border border-amber-700/80 flex items-center justify-between text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-tight">Sessão Google expirada. Renove para sincronizar com o par.</span>
            </div>
            <button
              type="button"
              onClick={handleRenovarSessao}
              disabled={sincronizandoNuvem}
              className="shrink-0 ml-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold px-2.5 py-1 text-[11px] transition-all active:scale-95 disabled:opacity-50"
            >
              {sincronizandoNuvem ? 'Conectando...' : 'Renovar'}
            </button>
          </div>
        )}

        {/* Barra Superior do App com Identidade do Casal, Seletor de Mês e Ações SaaS */}
        <header className="pt-3.5 pb-2.5 border-b border-neutral-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleAbrirConfigSaaS('casal')}
                  className="text-base font-extrabold tracking-tight text-white hover:text-emerald-400 transition-colors flex items-center gap-1.5 truncate"
                  title="Personalizar nomes do casal e código de convite"
                >
                  <span className="truncate">{appState.config.nome_familia || 'Orçamento Londrina'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAbrirConfigSaaS('casal')}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-sky-800 bg-sky-950/80 text-sky-300 hover:bg-sky-900/70 flex items-center gap-1 transition-colors"
                  title="Convidar par / Copiar código de vínculo"
                >
                  <Users className="h-2.5 w-2.5" />
                  <span>{obterRotuloQuem('Ele', appState.config)} & {obterRotuloQuem('Ela', appState.config)}</span>
                </button>
              </div>

              {(() => {
                const rendasExtrasMes = (appState.rendasExtras || [])
                  .filter(r => r.mes_ref === mesAtivo)
                  .reduce((acc, r) => acc + r.valor, 0);
                const totalRendaMes = appState.config.renda_liquida_mensal + rendasExtrasMes;
                return (
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Renda mês: <strong className="text-neutral-200 font-mono">{formatarMoeda(totalRendaMes)}</strong>
                    {rendasExtrasMes > 0 && (
                      <span className="text-emerald-400 font-bold font-mono ml-1">
                        (+{formatarMoeda(rendasExtrasMes)})
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>

            {/* Botões de Configuração SaaS & Vitrine */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setModoTelaSaaS('landing')}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300 transition-colors"
                title="Ver Página de Vendas SaaS e Planos"
              >
                <Crown className="h-3 w-3 text-emerald-400" />
                <span>Vitrine SaaS</span>
              </button>
              <button
                type="button"
                onClick={() => handleAbrirConfigSaaS('casal')}
                className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                title="Configurar Casal, Tetos, Convite e Virada de Mês"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Segunda linha do Header: Navegador de Mês (< Out/2026 >) + Sheets + Simulador de Dia */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {/* Navegador de Mês */}
            <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => handleMudarMes(-1)}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAbrirConfigSaaS('virar_mes')}
                className="px-1.5 text-xs font-mono font-bold text-white hover:text-emerald-400 transition-colors"
                title="Fechar mês ou alternar ciclo"
              >
                {formatarMesExibicao(mesAtivo, true)}
              </button>
              <button
                type="button"
                onClick={() => handleMudarMes(1)}
                className="p-1 text-neutral-400 hover:text-white transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Botão de Status Google Sheets */}
              {obterPlanilhaConectada() ? (
                <button
                  type="button"
                  onClick={() => sincronizarComPlanilha(false, true)}
                  disabled={sincronizandoNuvem}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 rounded-lg hover:bg-emerald-900/60 transition-all active:scale-95 disabled:opacity-50"
                  title="Toque para atualizar agora com a planilha do casal"
                >
                  <RefreshCw className={`h-2.5 w-2.5 text-emerald-400 ${sincronizandoNuvem ? 'animate-spin' : ''}`} />
                  <span>{sincronizandoNuvem ? 'Sync...' : (ultimaSincronizacao ? `Sheets ${ultimaSincronizacao}` : 'Sheets')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAbaAtiva('testes')}
                  className="flex items-center gap-1 text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 hover:border-emerald-600/50 hover:text-emerald-400 px-2 py-1 rounded-lg transition-colors"
                  title="Conectar Google Sheets"
                >
                  <FileSpreadsheet className="h-2.5 w-2.5" />
                  <span>Sheets</span>
                </button>
              )}

              {/* Seletor rápido de dia para simular o mês */}
              <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1">
                <Calendar className="h-3 w-3 text-neutral-400" />
                <span className="text-[11px] font-semibold text-neutral-400">Dia</span>
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
            </div>
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
              onAbrirConfigSaaS={handleAbrirConfigSaaS}
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

        {/* Modal Central SaaS (Casal, Link de Convite, Tetos, Virar Mês, Planos) */}
        <GestaoCasalSaaSModal
          aberto={modalSaaSAberto}
          abaInicial={abaModalSaaS}
          appState={appState}
          setAppState={setAppState}
          onFechar={() => setModalSaaSAberto(false)}
          onAbrirLandingPage={() => setModoTelaSaaS('landing')}
          onAbrirOnboardingNovo={() => setModoTelaSaaS('onboarding')}
        />

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
