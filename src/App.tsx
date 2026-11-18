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
  definirFamilyIdAtivo,
  salvarEmailUsuarioNoFirestore,
  assinarSubscriptionTempoReal,
  avaliarAcessoAssinatura,
  reivindicarComprasPendentesKiwify,
  exportarLancamentosCsv
} from './services/storage';
import { SubscriptionData } from './types';
import { montarUrlCheckoutKiwify } from './config/planos';
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
  AlertTriangle,
  X,
  Calendar,
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
  Crown,
  CloudUpload,
  CheckCircle2,
  FlaskConical,
  Download,
  LogOut,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import {
  observeFirebaseAuth,
  googleSignIn,
  googleSignOut
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
  const [dadosFamiliaCarregados, setDadosFamiliaCarregados] = useState<boolean>(false);
  const [precisaOnboarding, setPrecisaOnboarding] = useState<boolean>(false);
  const [salvandoOnboarding, setSalvandoOnboarding] = useState<boolean>(false);
  const [membrosConectados, setMembrosConectados] = useState<string[]>([]);
  const [exibirVitrineLanding, setExibirVitrineLanding] = useState<boolean>(false);

  // Assinatura Real (subscriptions/{familyId})
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [subscriptionCarregada, setSubscriptionCarregada] = useState<boolean>(false);

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
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [notificacaoSincronizacao, setNotificacaoSincronizacao] = useState<string | null>(null);

  // 1. Detectar parâmetro de URL (?convite=<token>)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const conviteParam = params.get('convite');

      if (conviteParam) {
        const tokenLimpo = conviteParam.trim();
        sessionStorage.setItem(SESSION_INVITE_KEY, tokenLimpo);
        setTokenConvitePendente(tokenLimpo);
        window.history.replaceState({}, '', window.location.pathname);
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
    const unsubUser = observeFirebaseAuth(user => {
      setUsuarioAtual(user);
      setAuthVerificado(true);
      if (!user) {
        setFamilyId(null);
        setDadosFamiliaCarregados(false);
        setSubscription(null);
        setSubscriptionCarregada(false);
        definirFamilyIdAtivo(null);
        setPrecisaOnboarding(false);
      }
    });

    return () => {
      unsubUser();
    };
  }, []);

  // 4. Quando o usuário faz login: gravar e-mail em users/{uid}.email, validar convite pendente e buscar users/{uid}
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
        await salvarEmailUsuarioNoFirestore(
          usuarioAtual!.uid,
          usuarioAtual!.email,
          usuarioAtual!.displayName
        );

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

  // 5. Assinar em tempo real (onSnapshot) a família ativa e subscriptions/{familyId} no Firestore + POST /api/claim
  useEffect(() => {
    if (!usuarioAtual || !familyId) return;

    let cancelado = false;
    setDadosFamiliaCarregados(false);
    setSubscriptionCarregada(false);

    // Reivindicar possíveis compras pendentes na Kiwify (POST /api/claim)
    reivindicarComprasPendentesKiwify(familyId);

    // Verificar se há dados antigos no localStorage e se a família no Firestore está vazia
    async function checarMigracaoInicial() {
      if (!temDadosAntigosNoLocalStorage()) return;
      const vazia = await verificarFamiliaVaziaNoFirestore(familyId!);
      if (!cancelado && vazia) {
        setMostrarModalMigracao(true);
      }
    }
    checarMigracaoInicial();

    const unsubscribeFamilia = assinarFamiliaTempoReal(familyId, (parcial, meta) => {
      if (meta?.members) {
        setMembrosConectados(meta.members);
      }
      setAppState(prev => ({
        ...prev,
        ...parcial
      }));
      setDadosFamiliaCarregados(true);
    });

    const unsubscribeSubscription = assinarSubscriptionTempoReal(familyId, sub => {
      setSubscription(sub);
      setSubscriptionCarregada(true);
    });

    return () => {
      cancelado = true;
      unsubscribeFamilia();
      unsubscribeSubscription();
    };
  }, [usuarioAtual, familyId]);

  const infoAcesso = useMemo(() => {
    return avaliarAcessoAssinatura(subscription);
  }, [subscription]);

  const handleEntrarComGoogle = async () => {
    setCarregandoLogin(true);
    setErroLogin(null);
    try {
      await googleSignIn();
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
    setDadosFamiliaCarregados(false);
    setSubscription(null);
    setSubscriptionCarregada(false);
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

  const agora = new Date();
  const diaAtual = isDevMode ? (appState.diaAtualSimulado || agora.getDate()) : agora.getDate();
  const mesAtivo = appState.mesAtivo || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [anoAtivoNum, mesAtivoNum] = mesAtivo.split('-').map(Number);
  const totalDiasMes = new Date(anoAtivoNum || agora.getFullYear(), mesAtivoNum || (agora.getMonth() + 1), 0).getDate();

  const handleIrParaLancamentosPainel = () => {
    setAbaAtiva('painel');
    setTimeout(() => {
      const el = document.getElementById('card-lancamentos-recentes');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

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
            setDadosFamiliaCarregados(true);
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

  // Enquanto o onSnapshot ainda não carregou os dados da família no Firestore, mostrar estado de carregando (e nunca dados de exemplo)
  if (familyId && (!dadosFamiliaCarregados || !subscriptionCarregada)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
          <p className="text-xs font-mono text-neutral-400">
            Carregando orçamento da família...
          </p>
        </div>
      </div>
    );
  }

  // ETAPA 2 — CONTROLE DE ACESSO: Sem acesso, mostrar tela "Seu período terminou" (nunca apagar dados)
  if (familyId && subscriptionCarregada && !infoAcesso.temAcesso) {
    const urlCheckoutMensal = montarUrlCheckoutKiwify('mensal', usuarioAtual.email, familyId);
    const urlCheckoutAnual = montarUrlCheckoutKiwify('anual', usuarioAtual.email, familyId);

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-5">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Crown className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
              Casal no Azul • {appState.config.nome_familia || 'Orçamento do Casal'}
            </span>
            <h1 className="text-xl font-extrabold text-white">
              Seu período terminou
            </h1>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Todos os lançamentos, metas e histórico do casal no Casal no Azul continuam salvos e protegidos na nuvem. Escolha um plano abaixo para liberar o acesso imediato nos 2 celulares:
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Plano Mensal */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-xs font-bold text-neutral-200 block">Plano Mensal</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-white">R$ 19,90</span>
                  <span className="text-[11px] text-neutral-400">/mês</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  2 celulares sincronizados • Cancele quando quiser
                </p>
              </div>
              <a
                href={urlCheckoutMensal}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 py-2.5 text-xs font-extrabold text-white transition-all"
              >
                <span>Assinar Mensal</span>
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
              </a>
            </div>

            {/* Plano Anual */}
            <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-4 flex flex-col justify-between space-y-3 relative">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">Plano Anual</span>
                  <span className="rounded bg-emerald-400 px-1.5 py-0.5 text-[9px] font-extrabold text-neutral-950 uppercase">
                    R$ 14,90/mês
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-xl font-extrabold text-emerald-400">R$ 178,80</span>
                  <span className="text-[11px] text-neutral-300">/ano</span>
                </div>
                <p className="text-[11px] text-neutral-300 mt-1">
                  Equivalente a R$ 14,90/mês • Economize R$ 60/ano
                </p>
              </div>
              <a
                href={urlCheckoutAnual}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-2.5 text-xs font-extrabold text-neutral-950 transition-all shadow-lg shadow-emerald-500/20"
              >
                <span>Assinar Anual</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 flex items-center gap-2.5 text-[11px] text-neutral-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Já realizou o pagamento? Assim que a Kiwify confirmar, sua tela será liberada automaticamente em tempo real.
            </span>
          </div>

          <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() =>
                exportarLancamentosCsv(
                  appState.lancamentos,
                  appState.config,
                  'orcamento-completo-todos-os-meses.csv'
                )
              }
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 py-2.5 px-3 text-xs font-bold text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Exportar meus dados (CSV)</span>
            </button>
            <button
              type="button"
              onClick={handleSairConta}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-900/60 bg-rose-950/30 hover:bg-rose-950/60 py-2.5 px-4 text-xs font-bold text-rose-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
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
      <main
        className={`w-full max-w-md px-4 flex-1 flex flex-col ${
          abaAtiva === 'lancamento' ? 'pb-44' : 'pb-24'
        }`}
      >
        {/* Banner Discreto no Topo Durante o Trial */}
        {infoAcesso.emTrial && infoAcesso.temAcesso && (
          <div
            id="banner-trial-topo"
            className="mt-2 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-[11px] text-emerald-200"
          >
            <span>
              Casal no Azul · Teste grátis: <strong>{infoAcesso.diasRestantesTrial} {infoAcesso.diasRestantesTrial === 1 ? 'dia restante' : 'dias restantes'}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleAbrirConfigSaaS('assinatura')}
              className="font-extrabold text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            >
              Assinar
            </button>
          </div>
        )}

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
                  <span className="truncate">{appState.config.nome_familia || 'Casal no Azul'}</span>
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

            {/* Botões de Configuração & Sobre o Casal no Azul */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setExibirVitrineLanding(true)}
                className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300 transition-colors"
                title="Sobre o Casal no Azul"
              >
                <Crown className="h-3 w-3 text-emerald-400" />
                <span>Sobre o Casal no Azul</span>
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

          {/* Segunda linha do Header: Navegador de Mês (< Out/2026 >) + Simulador de Dia (Dev) */}
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
              {/* Seletor rápido de dia para simular o mês (apenas no modo dev ?dev=1) */}
              {isDevMode && (
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
              )}
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
              onAcessarPainel={handleIrParaLancamentosPainel}
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
          subscription={subscription}
          appState={appState}
          setAppState={setAppState}
          onFechar={() => setModalSaaSAberto(false)}
          onAbrirLandingPage={() => setExibirVitrineLanding(true)}
          onSairConta={handleSairConta}
        />

        {/* Barra de Navegação Inferior Fixa (64px + safe-area-inset-bottom, sempre visível) */}
        <nav
          id="barra-navegacao-inferior"
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800/90 bg-neutral-950/95 px-2 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md"
        >
          <div className="mx-auto flex h-16 max-w-md items-center justify-around">
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
                  <FlaskConical className={`h-5 w-5 ${abaAtiva === 'testes' ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  <span className="text-[11px]">Testes</span>
                </button>
              </>
            )}
          </div>
        </nav>
      </main>
    </div>
  );
}

