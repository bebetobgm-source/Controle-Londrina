import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  carregarEstadoInicial,
  salvarEstado,
  AppState,
  obterRotuloQuem,
  formatarMesExibicao,
  navegarMes,
  filtrarLancamentosDoMes,
  aplicarOnboardingNovoCasal,
  obterPerfilUsuarioFirestore,
  criarFamiliaNoFirestore,
  assinarFamiliaTempoReal,
  consultarConviteFirestore,
  aceitarConviteFamiliaFirestore,
  InviteFirestoreData,
  temDadosAntigosNoLocalStorage,
  verificarFamiliaVaziaNoFirestore,
  migrarDadosLocalStorageParaFirestore,
  limparChavesAntigasLocalStorage,
  definirFamilyIdAtivo
} from './services/storage';
import { LancamentoRapido } from './components/LancamentoRapido';
import { PainelDoMes } from './components/PainelDoMes';
import { ConselheiroView } from './components/ConselheiroView';
import { SimuladorView } from './components/SimuladorView';
import { TestesECodigoView } from './components/TestesECodigoView';
import { LandingPageSaaS } from './components/LandingPageSaaS';
import { OnboardingCasal } from './components/OnboardingCasal';
import { GestaoCasalSaaSModal } from './components/GestaoCasalSaaSModal';
import { verificarAlertas, formatarMoeda } from './services/engine';
import {
  PlusCircle,
  TrendingUp,
  Sparkles,
  Calculator,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Calendar,
  RefreshCw,
  ShieldAlert,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
  Crown,
  CloudUpload,
  CheckCircle2
} from 'lucide-react';
import {
  obterPlanilhaConectada,
  salvarPlanilhaConectada,
  extrairSpreadsheetId,
  puxarDadosCompletosDaPlanilha
} from './services/googleSheets';
import {
  initAuth,
  observeFirebaseAuth,
  googleSignIn,
  googleSignOut,
  isTokenExpirado,
  renovarTokenGoogle
} from './services/googleAuth';

type AbaPadrao = 'lancamento' | 'painel' | 'conselheiro';
type AbaDev = 'simulador' | 'testes';
type AbaAtiva = AbaPadrao | AbaDev;

const SESSION_INVITE_KEY = 'orcamento_pending_invite_token_v1';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => carregarEstadoInicial());
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('lancamento');
  const [isDevMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1';
  });

  // Autenticação Google e Família no Firestore
  const [authVerificado, setAuthVerificado] = useState<boolean>(false);
  const [usuarioAtual, setUsuarioAtual] = useState<User | null>(null);
  const [carregandoLogin, setCarregandoLogin] = useState<boolean>(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  const [familyId, setFamilyId] = useState<string | null>(null);
  const [carregandoFamilia, setCarregandoFamilia] = useState<boolean>(false);
  const [precisaOnboarding, setPrecisaOnboarding] = useState<boolean>(false);
  const [salvandoOnboarding, setSalvandoOnboarding] = useState<boolean>(false);
  const [membrosConectados, setMembrosConectados] = useState<string[]>([]);
  const [exibirVitrineLanding, setExibirVitrineLanding] = useState<boolean>(false);

  // Fluxo de Convite Seguro (24 caracteres)
  const [tokenConvitePendente, setTokenConvitePendente] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenUrl = params.get('convite');
    if (tokenUrl) {
      sessionStorage.setItem(SESSION_INVITE_KEY, tokenUrl.trim());
      return tokenUrl.trim();
    }
    return sessionStorage.getItem(SESSION_INVITE_KEY);
  });
  const [conviteValidado, setConviteValidado] = useState<InviteFirestoreData | null>(null);
  const [erroConviteModal, setErroConviteModal] = useState<string | null>(null);
  const [aceitandoConvite, setAceitandoConvite] = useState<boolean>(false);

  // Fluxo de Migração de Dados Antigos do localStorage
  const [mostrarModalMigracao, setMostrarModalMigracao] = useState<boolean>(false);
  const [migrandoDados, setMigrandoDados] = useState<boolean>(false);

  // UI & Modais
  const [modalSaaSAberto, setModalSaaSAberto] = useState<boolean>(false);
  const [abaModalSaaS, setAbaModalSaaS] = useState<'casal' | 'orcamento' | 'virar_mes' | 'assinatura'>('casal');
  const [alertaCriticoDispensado, setAlertaCriticoDispensado] = useState<boolean>(false);
  const [sincronizandoNuvem, setSincronizandoNuvem] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [sessaoGoogleExpirada, setSessaoGoogleExpirada] = useState<boolean>(false);
  const [notificacaoSincronizacao, setNotificacaoSincronizacao] = useState<string | null>(null);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<string | null>(() => {
    return localStorage.getItem('orcamento_londrina_last_sync') || null;
  });

  // Sincronização opcional com Google Sheets (apenas quando uma planilha está conectada)
  const sincronizarComPlanilhaOpcional = useCallback(
    async (silencioso = true) => {
      const planilha = obterPlanilhaConectada();
      if (!planilha) return;

      if (isTokenExpirado()) {
        setSessaoGoogleExpirada(true);
        return;
      }

      setSincronizandoNuvem(true);
      try {
        const resultado = await puxarDadosCompletosDaPlanilha(planilha.id);
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        setUltimaSincronizacao(horaAtual);
        setSessaoGoogleExpirada(false);

        if (!silencioso) {
          setNotificacaoSincronizacao(
            `✨ Planilha Google Sheets sincronizada (${resultado.lancamentos.length} lançamentos)!`
          );
          setTimeout(() => setNotificacaoSincronizacao(null), 3500);
        }
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

  // 1. Detectar parâmetro de URL (?convite=<token> ou ?planilha=<id>)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sheetParam = params.get('planilha') || params.get('sheet') || params.get('sheetId');
      const conviteParam = params.get('convite');

      if (conviteParam) {
        const tokenLimpo = conviteParam.trim();
        sessionStorage.setItem(SESSION_INVITE_KEY, tokenLimpo);
        setTokenConvitePendente(tokenLimpo);
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (sheetParam) {
        const idLimpo = extrairSpreadsheetId(sheetParam);
        if (idLimpo) {
          salvarPlanilhaConectada(idLimpo, 'Orçamento Doméstico Londrina (Casal)');
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch (e) {
      console.warn('Erro ao processar parâmetros da URL:', e);
    }
  }, []);

  // 2. Detectar navegador embutido do WhatsApp/Instagram
  useEffect(() => {
    try {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      if (/FBAN|FBAV|Instagram|WhatsApp|Line|wv/i.test(ua)) {
        setIsInAppBrowser(true);
      }
    } catch {
      // Ignora
    }
  }, []);

  // 3. Observar estado de autenticação do Firebase (Login obrigatório)
  useEffect(() => {
    const unsubInit = initAuth();
    const unsubUser = observeFirebaseAuth(user => {
      setUsuarioAtual(user);
      setAuthVerificado(true);
      if (!user) {
        setFamilyId(null);
        definirFamilyIdAtivo(null);
        setPrecisaOnboarding(false);
      }
    });

    return () => {
      unsubInit();
      unsubUser();
    };
  }, []);

  // 4. Quando o usuário faz login: validar convite pendente (se houver) e buscar users/{uid}
  const validarTokenConvite = useCallback(async (token: string) => {
    const res = await consultarConviteFirestore(token);
    if (!res.valido || !res.convite) {
      setErroConviteModal(res.motivoErro || 'Este convite não é mais válido.');
      setConviteValidado(null);
      sessionStorage.removeItem(SESSION_INVITE_KEY);
      setTokenConvitePendente(null);
    } else {
      setConviteValidado(res.convite);
      setErroConviteModal(null);
    }
  }, []);

  useEffect(() => {
    if (!usuarioAtual) return;
    let cancelado = false;

    async function carregarPerfilEFamilia() {
      setCarregandoFamilia(true);
      try {
        if (tokenConvitePendente) {
          await validarTokenConvite(tokenConvitePendente);
        }

        const perfil = await obterPerfilUsuarioFirestore(usuarioAtual!.uid);
        if (cancelado) return;

        if (perfil && perfil.familyId) {
          setFamilyId(perfil.familyId);
          definirFamilyIdAtivo(perfil.familyId);
          setPrecisaOnboarding(false);
        } else {
          setFamilyId(null);
          definirFamilyIdAtivo(null);
          setPrecisaOnboarding(true);
        }
      } catch (err) {
        console.error('Erro ao carregar perfil no Firestore:', err);
      } finally {
        if (!cancelado) {
          setCarregandoFamilia(false);
        }
      }
    }

    carregarPerfilEFamilia();

    return () => {
      cancelado = true;
    };
  }, [usuarioAtual, tokenConvitePendente, validarTokenConvite]);

  // 5. Assinar em tempo real (onSnapshot) a família ativa no Firestore e verificar migração do localStorage
  useEffect(() => {
    if (!usuarioAtual || !familyId) return;

    let cancelado = false;

    // Verificar se há dados antigos no localStorage e se a família no Firestore está vazia
    async function checarMigracaoInicial() {
      if (!temDadosAntigosNoLocalStorage()) return;
      const vazia = await verificarFamiliaVaziaNoFirestore(familyId!);
      if (!cancelado && vazia) {
        setMostrarModalMigracao(true);
      }
    }
    checarMigracaoInicial();

    const unsubscribe = assinarFamiliaTempoReal(familyId, (parcial, meta) => {
      if (meta?.members) {
        setMembrosConectados(meta.members);
      }
      setAppState(prev => ({
        ...prev,
        ...parcial
      }));
    });

    return () => {
      cancelado = true;
      unsubscribe();
    };
  }, [usuarioAtual, familyId]);

  const handleEntrarComGoogle = async () => {
    setCarregandoLogin(true);
    setErroLogin(null);
    try {
      await googleSignIn(false);
      setExibirVitrineLanding(false);
    } catch (err: any) {
      setErroLogin(err?.message || 'Não foi possível entrar com o Google.');
    } finally {
      setCarregandoLogin(false);
    }
  };

  const handleSairConta = async () => {
    await googleSignOut();
    setFamilyId(null);
    definirFamilyIdAtivo(null);
    setExibirVitrineLanding(false);
  };

  const handleConfirmarEntradaConvite = async () => {
    if (!conviteValidado) return;
    setAceitandoConvite(true);
    try {
      const res = await aceitarConviteFamiliaFirestore(conviteValidado.token);
      if (!res.sucesso || !res.familyId) {
        setErroConviteModal(res.erro || 'Não foi possível entrar na família.');
        setConviteValidado(null);
      } else {
        sessionStorage.removeItem(SESSION_INVITE_KEY);
        setTokenConvitePendente(null);
        setConviteValidado(null);
        setFamilyId(res.familyId);
        definirFamilyIdAtivo(res.familyId);
        setPrecisaOnboarding(false);
        setNotificacaoSincronizacao(
          `🎉 Você entrou na família ${res.nomeFamilia || 'do seu par'}! Sincronização em tempo real ativada.`
        );
        setTimeout(() => setNotificacaoSincronizacao(null), 6000);
      }
    } finally {
      setAceitandoConvite(false);
    }
  };

  const handleImportarDadosLocais = async () => {
    if (!familyId) return;
    setMigrandoDados(true);
    try {
      const total = await migrarDadosLocalStorageParaFirestore(familyId);
      setMostrarModalMigracao(false);
      setNotificacaoSincronizacao(
        `☁️ ${total} registro(s) importado(s) para a nuvem com sucesso! Chaves antigas removidas.`
      );
      setTimeout(() => setNotificacaoSincronizacao(null), 6000);
    } catch (err) {
      console.error('Erro na migração:', err);
      setNotificacaoSincronizacao('Erro ao importar dados locais para a nuvem.');
      setTimeout(() => setNotificacaoSincronizacao(null), 4000);
    } finally {
      setMigrandoDados(false);
    }
  };

  const handleDescartarDadosLocais = () => {
    limparChavesAntigasLocalStorage();
    setMostrarModalMigracao(false);
  };

  const handleRenovarSessao = async () => {
    try {
      setSincronizandoNuvem(true);
      await renovarTokenGoogle();
      setSessaoGoogleExpirada(false);
      await sincronizarComPlanilhaOpcional(false);
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

  const alertaCritico = useMemo(() => {
    return alertasAtivos.find(a => a.severidade === 'vermelho' || a.tipo === 'Fixas Descobertas');
  }, [alertasAtivos]);

  const handleSimularDia = (novoDia: number) => {
    setAppState(prev => {
      const atualizado = { ...prev, diaAtualSimulado: novoDia };
      salvarEstado({ diaAtualSimulado: novoDia });
      return atualizado;
    });
    setAlertaCriticoDispensado(false);
  };

  const handleMudarMes = (direcao: -1 | 1) => {
    setAppState(prev => {
      const novoMes = navegarMes(prev.mesAtivo, direcao);
      const atualizado = { ...prev, mesAtivo: novoMes };
      salvarEstado({ mesAtivo: novoMes });
      return atualizado;
    });
  };

  const handleAbrirConfigSaaS = (aba: 'casal' | 'orcamento' | 'virar_mes' | 'assinatura' = 'casal') => {
    setAbaModalSaaS(aba);
    setModalSaaSAberto(true);
  };

  // Enquanto verifica sessão do Firebase Auth
  if (!authVerificado || (usuarioAtual && carregandoFamilia && !familyId && !precisaOnboarding)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
          <p className="text-xs font-mono text-neutral-400">
            Sincronizando sua conta familiar na nuvem...
          </p>
        </div>
      </div>
    );
  }

  // REGRA 2: LOGIN OBRIGATÓRIO — Sem login (ou se abriu a vitrine), mostrar só a LandingPageSaaS
  if (!usuarioAtual || exibirVitrineLanding) {
    return (
      <LandingPageSaaS
        estaLogado={Boolean(usuarioAtual)}
        carregandoLogin={carregandoLogin}
        erroLogin={erroLogin}
        tokenConvitePendente={tokenConvitePendente}
        nomeFamiliaAtual={appState.config.nome_familia}
        onEntrarComGoogle={() => {
          if (usuarioAtual) {
            setExibirVitrineLanding(false);
          } else {
            handleEntrarComGoogle();
          }
        }}
        onVoltarPainelAtual={usuarioAtual ? () => setExibirVitrineLanding(false) : undefined}
      />
    );
  }

  // Modal prioritário de Confirmação de Convite ("Entrar na família X") ou Erro de Convite
  if (conviteValidado || erroConviteModal) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-4">
          {erroConviteModal ? (
            <>
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h2 className="text-base font-extrabold text-white">Convite Indisponível</h2>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">{erroConviteModal}</p>
              <button
                type="button"
                onClick={() => setErroConviteModal(null)}
                className="w-full rounded-xl bg-neutral-800 hover:bg-neutral-700 py-3 text-xs font-extrabold text-white transition-all"
              >
                Continuar
              </button>
            </>
          ) : conviteValidado ? (
            <>
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Users className="h-5 w-5 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                    Convite Familiar Seguro
                  </span>
                  <h2 className="text-lg font-extrabold text-white">
                    Entrar na família {conviteValidado.nomeFamilia || 'do seu par'}?
                  </h2>
                </div>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Ao confirmar, sua conta Google (<strong>{usuarioAtual.email}</strong>) será vinculada a esta família e vocês verão todos os gastos e metas sincronizados em tempo real nos dois celulares.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={aceitandoConvite}
                  onClick={() => {
                    sessionStorage.removeItem(SESSION_INVITE_KEY);
                    setTokenConvitePendente(null);
                    setConviteValidado(null);
                  }}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-bold text-neutral-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={aceitandoConvite}
                  onClick={handleConfirmarEntradaConvite}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 py-3 text-xs font-extrabold text-neutral-950 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {aceitandoConvite
                      ? 'Vinculando à família...'
                      : `Entrar na família ${conviteValidado.nomeFamilia || ''}`}
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // REGRA 2: Depois do login, se users/{uid} não tem familyId, abrir o OnboardingCasal, que cria a família no Firestore com members: [uid]
  if (precisaOnboarding && !familyId) {
    return (
      <OnboardingCasal
        nomeUsuarioGoogle={usuarioAtual.displayName || undefined}
        salvando={salvandoOnboarding}
        onUsarTokenConvite={token => {
          sessionStorage.setItem(SESSION_INVITE_KEY, token);
          setTokenConvitePendente(token);
          validarTokenConvite(token);
        }}
        onConcluirOnboarding={async dados => {
          setSalvandoOnboarding(true);
          try {
            const estadoInicial = aplicarOnboardingNovoCasal(dados, appState);
            const novoFamilyId = await criarFamiliaNoFirestore(
              usuarioAtual.uid,
              usuarioAtual.displayName || dados.nomeParceiro1,
              estadoInicial
            );
            setAppState(estadoInicial);
            setFamilyId(novoFamilyId);
            setPrecisaOnboarding(false);
            setAbaAtiva('painel');
            setNotificacaoSincronizacao(
              `🎉 Família ${estadoInicial.config.nome_familia} criada na nuvem! Toque em "Conectar meu par" nas configurações para gerar o link.`
            );
            setTimeout(() => setNotificacaoSincronizacao(null), 6000);
          } catch (err: any) {
            setNotificacaoSincronizacao(err?.message || 'Erro ao criar família no Firestore.');
          } finally {
            setSalvandoOnboarding(false);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center">
      {/* Modal de Migração dos Dados que já existem no localStorage (REGRA 5) */}
      {mostrarModalMigracao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-neutral-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <CloudUpload className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                  Migração para Nuvem
                </span>
                <h3 className="text-base font-extrabold text-white">
                  Importar os dados deste aparelho para a nuvem?
                </h3>
              </div>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Encontramos lançamentos e configurações salvos localmente neste celular. Deseja enviar tudo em lote para o Firestore para sincronizar com o seu par?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={migrandoDados}
                onClick={handleDescartarDadosLocais}
                className="rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Não importar
              </button>
              <button
                type="button"
                disabled={migrandoDados}
                onClick={handleImportarDadosLocais}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 py-3 text-xs font-extrabold text-neutral-950 transition-all"
              >
                <CloudUpload className="h-4 w-4" />
                <span>{migrandoDados ? 'Enviando lotes para nuvem...' : 'Sim, importar para a nuvem'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container Mobile-first (390px - 440px) */}
      <main className="w-full max-w-md px-4 flex-1 flex flex-col">
        {/* Aviso de Navegador Interno do WhatsApp/Instagram */}
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

        {/* Notificação Flutuante de Sincronização */}
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

        {/* Alerta de Sessão do Google Sheets Expirada (Opcional) */}
        {sessaoGoogleExpirada && obterPlanilhaConectada() && (
          <div className="mt-2 p-2.5 rounded-xl bg-amber-950/90 border border-amber-700/80 flex items-center justify-between text-xs text-amber-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-tight">Sessão do Google Sheets expirada. Renove para espelhar na planilha.</span>
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
                  title="Personalizar nomes do casal e convite"
                >
                  <span className="truncate">{appState.config.nome_familia || 'Orçamento Londrina'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAbrirConfigSaaS('casal')}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-sky-800 bg-sky-950/80 text-sky-300 hover:bg-sky-900/70 flex items-center gap-1 transition-colors"
                  title="Conectar meu par"
                >
                  <Users className="h-2.5 w-2.5" />
                  <span>
                    {obterRotuloQuem('Ele', appState.config)} & {obterRotuloQuem('Ela', appState.config)} ({Math.min(2, Math.max(1, membrosConectados.length))}/2)
                  </span>
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
                onClick={() => setExibirVitrineLanding(true)}
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

          {/* Segunda linha do Header: Navegador de Mês (< Out/2026 >) + Sheets Opcional + Simulador de Dia */}
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
              {/* Botão de Status Google Sheets (Opcional / Modo Dev) */}
              {obterPlanilhaConectada() ? (
                <button
                  type="button"
                  onClick={() => sincronizarComPlanilhaOpcional(false)}
                  disabled={sincronizandoNuvem}
                  className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-1 rounded-lg hover:bg-emerald-900/60 transition-all active:scale-95 disabled:opacity-50"
                  title="Espelhamento opcional com Google Sheets"
                >
                  <RefreshCw className={`h-2.5 w-2.5 text-emerald-400 ${sincronizandoNuvem ? 'animate-spin' : ''}`} />
                  <span>{sincronizandoNuvem ? 'Sync...' : (ultimaSincronizacao ? `Sheets ${ultimaSincronizacao}` : 'Sheets')}</span>
                </button>
              ) : isDevMode ? (
                <button
                  type="button"
                  onClick={() => setAbaAtiva('testes')}
                  className="flex items-center gap-1 text-[10px] text-neutral-400 bg-neutral-900 border border-neutral-800 hover:border-emerald-600/50 hover:text-emerald-400 px-2 py-1 rounded-lg transition-colors"
                  title="Conectar Google Sheets (Opcional)"
                >
                  <FileSpreadsheet className="h-2.5 w-2.5" />
                  <span>Sheets</span>
                </button>
              ) : null}

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

          {isDevMode && abaAtiva === 'simulador' && (
            <SimuladorView
              appState={appState}
            />
          )}

          {isDevMode && abaAtiva === 'testes' && (
            <TestesECodigoView
              appState={appState}
              setAppState={setAppState}
              onAcessarPainel={() => setAbaAtiva('painel')}
            />
          )}
        </div>

        {/* Modal Central SaaS (Casal, Link Seguro de 24 Caracteres, Tetos, Virar Mês, Planos) */}
        <GestaoCasalSaaSModal
          aberto={modalSaaSAberto}
          abaInicial={abaModalSaaS}
          familyId={familyId}
          membrosConectados={membrosConectados}
          emailUsuario={usuarioAtual.email}
          appState={appState}
          setAppState={setAppState}
          onFechar={() => setModalSaaSAberto(false)}
          onAbrirLandingPage={() => setExibirVitrineLanding(true)}
          onSairConta={handleSairConta}
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

            {isDevMode && (
              <>
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
              </>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}
