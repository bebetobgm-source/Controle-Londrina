import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  getCurrentUser
} from '../services/googleAuth';
import {
  PlanilhaConectada,
  obterPlanilhaConectada,
  criarPlanilhaAutomatica,
  conectarPlanilhaExistente,
  desconectarPlanilha,
  puxarLancamentosDaPlanilha,
  puxarDadosCompletosDaPlanilha,
  buscarPlanilhaNoDrive,
  anexarLancamentoNaPlanilha,
  limparDuplicadosDaPlanilha,
  zerarPlanilhaERecomessar,
  sincronizarTudoSemDuplicar
} from '../services/googleSheets';
import { AppState, salvarEstado } from '../services/storage';
import { formatarMoeda } from '../services/engine';
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  CloudCheck,
  AlertCircle,
  LogOut,
  ChevronDown,
  ChevronUp,
  FileCode,
  Copy,
  Sparkles,
  Layers,
  ArrowDownToLine,
  ArrowUpToLine,
  Lock,
  Trash2,
  CheckCheck
} from 'lucide-react';
import { gasFiles } from '../data/gasCode';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const GoogleSheetsConnectView: React.FC<Props> = ({ appState, setAppState }) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [planilha, setPlanilha] = useState<PlanilhaConectada | null>(() => obterPlanilhaConectada());
  const [carregando, setCarregando] = useState<boolean>(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Link manual
  const [mostrarManual, setMostrarManual] = useState<boolean>(false);
  const [inputUrlPlanilha, setInputUrlPlanilha] = useState<string>('');

  // Seção de código Apps Script
  const [mostrarCodigoAvancado, setMostrarCodigoAvancado] = useState<boolean>(false);
  const [arquivoGasSelecionado, setArquivoGasSelecionado] = useState<string>('Inicializar.gs');
  const [copiadoGas, setCopiadoGas] = useState<boolean>(false);

  // Confirmação para sobrescrever dados
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    aberto: boolean;
    titulo: string;
    mensagem: string;
    acao: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const unsub = initAuth(
      async (loggedUser) => {
        setUser(loggedUser);
        if (!planilha) {
          const encontrada = await buscarPlanilhaNoDrive();
          if (encontrada) {
            setPlanilha(encontrada);
            setMensagemSucesso(`Planilha "${encontrada.nome}" detectada automaticamente no seu Google Drive!`);
          }
        }
      },
      () => {
        setUser(null);
      }
    );
    return () => {
      unsub();
    };
  }, [planilha]);

  const handleLogin = async () => {
    setCarregando(true);
    setMensagemErro(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setMensagemSucesso(`Conectado como ${result.user.displayName || result.user.email}!`);
        
        // Auto-busca da planilha caso ainda não conectada
        if (!planilha) {
          const encontrada = await buscarPlanilhaNoDrive();
          if (encontrada) {
            setPlanilha(encontrada);
            setMensagemSucesso(`Conectado e planilha "${encontrada.nome}" detectada no Google Drive!`);
          }
        }
        setTimeout(() => setMensagemSucesso(null), 4000);
      }
    } catch (err: any) {
      setMensagemErro(err.message || 'Falha ao autenticar com o Google.');
    } finally {
      setCarregando(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setMensagemSucesso('Desconectado da conta Google.');
    setTimeout(() => setMensagemSucesso(null), 3000);
  };

  const handleCriarPlanilhaAutomatica = async () => {
    if (!user) {
      await handleLogin();
      return;
    }

    setCarregando(true);
    setMensagemErro(null);
    try {
      const novaPlanilha = await criarPlanilhaAutomatica(appState.lancamentos);
      setPlanilha(novaPlanilha);
      setMensagemSucesso('Planilha criada com sucesso no seu Google Drive com todas as 7 abas!');
    } catch (err: any) {
      setMensagemErro(err.message || 'Erro ao criar planilha automaticamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleConectarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrlPlanilha.trim()) return;

    setCarregando(true);
    setMensagemErro(null);
    try {
      const conectada = await conectarPlanilhaExistente(inputUrlPlanilha);
      setPlanilha(conectada);
      setMensagemSucesso(`Conectado com sucesso à planilha "${conectada.nome}"!`);
      setInputUrlPlanilha('');
      setMostrarManual(false);
    } catch (err: any) {
      setMensagemErro(err.message || 'Erro ao vincular planilha.');
    } finally {
      setCarregando(false);
    }
  };

  const executarPuxadaDeDados = async () => {
    if (!planilha) return;
    setCarregando(true);
    setMensagemErro(null);
    try {
      const resultado = await puxarDadosCompletosDaPlanilha(planilha.id);
      
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

      setPlanilha(obterPlanilhaConectada());
      const dupInfo =
        resultado.duplicadosIgnorados > 0
          ? ` (${resultado.duplicadosIgnorados} lançamentos repetidos foram ignorados automaticamente)`
          : '';
      setMensagemSucesso(
        `🎉 Sincronizado com sucesso! Carregados: ${resultado.totalLancamentos} despesas, ${resultado.totalRendas} rendas extras e ${resultado.totalFixas} contas fixas.${dupInfo}`
      );
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      if (err.message?.includes('login') || err.message?.includes('autenticar') || err.message?.includes('permissões')) {
        setMensagemErro('Sessão expirada ou sem permissão. Clique em "Entrar com o Google" para autorizar novamente.');
      } else {
        setMensagemErro(err.message || 'Erro ao sincronizar com o Google Sheets.');
      }
    } finally {
      setCarregando(false);
      setModalConfirmacao(null);
    }
  };

  const handlePuxarDaPlanilha = () => {
    if (!planilha) return;
    executarPuxadaDeDados();
  };

  const handleSincronizarTudoSemDuplicar = async () => {
    if (!planilha) return;

    setModalConfirmacao({
      aberto: true,
      titulo: 'Sincronizar Dados com a Planilha?',
      mensagem: `Deseja enviar os dados do aplicativo para a planilha de forma limpa e sem duplicar? A aba 'Lancamentos' será atualizada com os ${appState.lancamentos.length} gastos e ${appState.rendasExtras.length} rendas extras sem criar linhas repetidas.`,
      acao: async () => {
        setCarregando(true);
        setMensagemErro(null);
        try {
          const ok = await sincronizarTudoSemDuplicar(
            planilha.id,
            appState.lancamentos,
            appState.rendasExtras
          );
          if (ok) {
            setMensagemSucesso('Planilha sincronizada perfeitamente sem duplicatas!');
          } else {
            setMensagemErro('Erro ao sincronizar planilha.');
          }
        } catch (err: any) {
          setMensagemErro(err.message || 'Erro ao enviar lançamentos.');
        } finally {
          setCarregando(false);
          setModalConfirmacao(null);
        }
      }
    });
  };

  const handleLimparDuplicadosPlanilha = async () => {
    if (!planilha) return;

    setModalConfirmacao({
      aberto: true,
      titulo: 'Eliminar Lançamentos Duplicados da Planilha?',
      mensagem:
        'O sistema fará uma varredura completa na aba Lancamentos da sua planilha Google Sheets, identificando e removendo todas as linhas duplicadas (mesmo ID ou mesma data, valor, categoria e descrição). Apenas uma cópia única de cada lançamento será mantida.',
      acao: async () => {
        setCarregando(true);
        setMensagemErro(null);
        try {
          const res = await limparDuplicadosDaPlanilha(planilha.id);
          setAppState(prev => {
            const atualizado: AppState = {
              ...prev,
              lancamentos: res.lancamentos,
              rendasExtras: res.rendasExtras
            };
            salvarEstado(atualizado);
            return atualizado;
          });
          setMensagemSucesso(`🧹 ${res.mensagem}`);
        } catch (err: any) {
          setMensagemErro(err.message || 'Erro ao limpar duplicados da planilha.');
        } finally {
          setCarregando(false);
          setModalConfirmacao(null);
        }
      }
    });
  };

  const handleZerarPlanilha = async () => {
    if (!planilha) return;

    setModalConfirmacao({
      aberto: true,
      titulo: '⚠️ Zerar Planilha e Recomeçar?',
      mensagem:
        'Tem certeza que deseja apagar os lançamentos da planilha e do aplicativo? Isso limpará todas as despesas e rendas extras registradas para você começar do zero com seus gastos reais. Os cabeçalhos da planilha, orçamento e contas fixas serão preservados.',
      acao: async () => {
        setCarregando(true);
        setMensagemErro(null);
        try {
          await zerarPlanilhaERecomessar(planilha.id);
          setAppState(prev => {
            const atualizado: AppState = {
              ...prev,
              lancamentos: [],
              rendasExtras: []
            };
            salvarEstado(atualizado);
            return atualizado;
          });
          setMensagemSucesso('Planilha e aplicativo zerados com sucesso! Comece do zero com seus lançamentos reais.');
        } catch (err: any) {
          setMensagemErro(err.message || 'Erro ao zerar planilha.');
        } finally {
          setCarregando(false);
          setModalConfirmacao(null);
        }
      }
    });
  };

  const handleDesconectar = () => {
    setModalConfirmacao({
      aberto: true,
      titulo: 'Desconectar Planilha?',
      mensagem: 'O aplicativo continuará funcionando normalmente no modo local e seus dados na planilha do Google Drive continuarão preservados.',
      acao: async () => {
        desconectarPlanilha();
        setPlanilha(null);
        setMensagemSucesso('Planilha desconectada com sucesso.');
        setModalConfirmacao(null);
      }
    });
  };

  const handleCopiarGas = () => {
    const texto = gasFiles[arquivoGasSelecionado];
    if (texto) {
      navigator.clipboard.writeText(texto);
      setCopiadoGas(true);
      setTimeout(() => setCopiadoGas(false), 2000);
    }
  };

  return (
    <div id="google-sheets-view" className="flex flex-col gap-4 pb-28 pt-2">
      {/* Alertas de Notificação */}
      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3.5 text-xs font-semibold text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/80 p-3.5 text-xs font-semibold text-rose-300 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* CARTÃO PRINCIPAL: MODO AUTOMÁTICO 100% SEM CÓDIGO */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Google Sheets Automático</h2>
              <p className="text-[11px] text-neutral-400">Conexão direta sem códigos ou scripts manuais</p>
            </div>
          </div>
          {planilha ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Conectado
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-full">
              Local
            </span>
          )}
        </div>

        {/* 1. SE NÃO ESTIVER LOGADO NO GOOGLE */}
        {!user && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Você não precisa programar ou colar scripts. Basta entrar com sua conta Google com permissão para criar sua planilha de orçamento diretamente no seu Google Drive com 1 clique.
            </p>

            {/* Botão Oficial do Google */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={carregando}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {carregando ? 'Conectando...' : 'Entrar com o Google'}
                </span>
              </div>
            </button>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 text-[11px] text-neutral-400 flex items-start gap-2">
              <Lock className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Seus dados ficam 100% no seu próprio Google Drive e Google Sheets. Apenas você e seu cônjuge têm acesso.
              </span>
            </div>
          </div>
        )}

        {/* 2. SE ESTIVER LOGADO NO GOOGLE */}
        {user && (
          <div className="space-y-4">
            {/* Status do Usuário Logado */}
            <div className="flex items-center justify-between rounded-xl bg-neutral-950/80 border border-neutral-800 p-2.5">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Foto" className="h-7 w-7 rounded-full border border-neutral-700" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-white">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-white leading-tight">{user.displayName || user.email}</p>
                  <p className="text-[10px] text-neutral-400">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Desconectar conta"
              >
                <LogOut className="h-3 w-3" />
                <span>Sair</span>
              </button>
            </div>

            {/* SE JÁ TEM PLANILHA CONECTADA */}
            {planilha ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-emerald-600/30 bg-emerald-950/20 p-3.5 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{planilha.nome}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        ID: <span className="font-mono text-neutral-500">{planilha.id.substring(0, 16)}...</span>
                      </p>
                    </div>
                    <a
                      href={planilha.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors"
                    >
                      <span>Abrir no Sheets</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-900/40 text-[11px] text-neutral-400">
                    <span>Lançamentos locais: <strong className="text-white">{appState.lancamentos.length}</strong></span>
                    <span>Última sincronização: <strong className="text-neutral-300">{planilha.ultimaSincronizacao || 'agora'}</strong></span>
                  </div>
                </div>

                {/* Aviso de Sincronização Automática */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
                  <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-emerald-300 font-bold block mb-0.5">Sincronização Automática Ativa</strong>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Novos gastos e rendas lançados no app são salvos na sua planilha imediatamente. Ao abrir o app, seus dados são atualizados automaticamente com o que estiver no Sheets.
                    </p>
                  </div>
                </div>

                {/* Ações Rápidas de Sincronização */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePuxarDaPlanilha}
                    disabled={carregando}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/50 bg-emerald-950/40 hover:bg-emerald-900/50 px-3 py-2.5 text-xs font-bold text-white transition-all active:scale-98 disabled:opacity-50"
                  >
                    {carregando ? (
                      <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
                    ) : (
                      <ArrowDownToLine className="h-4 w-4 text-emerald-400" />
                    )}
                    <span>{carregando ? 'Puxando...' : 'Puxar do Sheets'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSincronizarTudoSemDuplicar}
                    disabled={carregando}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-800 px-3 py-2.5 text-xs font-semibold text-white transition-colors active:scale-98"
                  >
                    <ArrowUpToLine className="h-4 w-4 text-sky-400" />
                    <span>Enviar Sem Duplicar</span>
                  </button>
                </div>

                {/* Ferramentas de Limpeza: Eliminar Duplicados e Zerar Planilha */}
                <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Manutenção da Planilha
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleLimparDuplicadosPlanilha}
                      disabled={carregando}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-600/40 bg-amber-950/30 hover:bg-amber-900/40 px-3 py-2.5 text-xs font-bold text-amber-200 transition-colors active:scale-98"
                      title="Varre a planilha no Sheets e remove linhas duplicadas mantendo apenas 1 cópia de cada lançamento"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Eliminar Duplicados</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleZerarPlanilha}
                      disabled={carregando}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-900/50 bg-rose-950/20 hover:bg-rose-900/40 px-3 py-2.5 text-xs font-semibold text-rose-300 transition-colors active:scale-98"
                      title="Apaga os lançamentos de teste para começar do zero com gastos reais"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>Zerar Planilha (Começar do Zero)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleDesconectar}
                    className="text-[11px] text-neutral-500 hover:text-rose-400 transition-colors"
                  >
                    Desvincular esta planilha
                  </button>
                </div>
              </div>
            ) : (
              /* SE NÃO TEM PLANILHA CONECTADA AINDA */
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5">
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Clique no botão abaixo e o sistema criará uma planilha intitulada <strong>"Orçamento Doméstico Londrina (Casal)"</strong> no seu Google Drive com todas as 7 abas formatadas:
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px] text-neutral-400">
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span><strong>Lancamentos:</strong> registros de gastos com data, valor e quem gastou</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span><strong>Orcamento & Fixas:</strong> tetos mensais e contas do casal</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span><strong>Metas, Alertas_Log & Config:</strong> reserva de emergência e regras</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleCriarPlanilhaAutomatica}
                  disabled={carregando}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 px-4 text-xs font-bold text-white shadow-lg shadow-emerald-950 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{carregando ? 'Criando planilha no seu Google Drive...' : 'Criar Minha Planilha no Google Sheets (1 Toque)'}</span>
                </button>

                {/* Opção secundária: Vincular planilha já existente */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => setMostrarManual(!mostrarManual)}
                    className="flex w-full items-center justify-between text-xs text-neutral-400 hover:text-neutral-200 py-1"
                  >
                    <span>Já tem uma planilha existente no Google Sheets?</span>
                    {mostrarManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {mostrarManual && (
                    <form onSubmit={handleConectarManual} className="mt-2 space-y-2 animate-in fade-in">
                      <input
                        type="text"
                        value={inputUrlPlanilha}
                        onChange={e => setInputUrlPlanilha(e.target.value)}
                        placeholder="Cole o link ou ID da planilha..."
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={carregando || !inputUrlPlanilha.trim()}
                        className="w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                      >
                        Vincular Planilha Existente
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GUIA DE COMO FUNCIONA (PARA LEIGOS) */}
      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/60 p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <CloudCheck className="h-4 w-4 text-emerald-400" />
          <span>Como funciona a sincronização</span>
        </h3>
        <div className="grid grid-cols-1 gap-2.5 text-xs text-neutral-300">
          <div className="flex items-start gap-2.5 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/60">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">1</span>
            <p className="text-[11px] leading-relaxed">
              <strong>Lançamento instantâneo:</strong> Cada gasto registrado na tela principal é enviado direto para a aba <em>Lancamentos</em> da sua planilha.
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/60">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">2</span>
            <p className="text-[11px] leading-relaxed">
              <strong>Acesso simultâneo:</strong> Você e sua esposa podem usar no celular. Ambos alimentam a mesma planilha oficial.
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-800/60">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">3</span>
            <p className="text-[11px] leading-relaxed">
              <strong>Visualização no computador:</strong> Abra o Google Sheets a qualquer momento para ver tabelas, exportar relatórios ou compartilhar.
            </p>
          </div>
        </div>
      </div>

      {/* SEÇÃO OPCIONAL / AVANÇADA: CÓDIGO APPS SCRIPT */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
        <button
          type="button"
          onClick={() => setMostrarCodigoAvancado(!mostrarCodigoAvancado)}
          className="flex w-full items-center justify-between text-xs text-neutral-400 hover:text-neutral-200"
        >
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-neutral-500" />
            <span className="font-semibold">Avançado: Scripts Opcionais & Robô de E-mail</span>
          </div>
          {mostrarCodigoAvancado ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {mostrarCodigoAvancado && (
          <div className="mt-3 space-y-3 pt-3 border-t border-neutral-800 animate-in fade-in">
            <p className="text-[11px] text-neutral-400">
              Caso deseje que o Google envie relatórios e e-mails automáticos às 20h para o casal sem abrir o app, você pode opcionalmente colar o código abaixo em <em>Extensões &gt; Apps Script</em> na sua planilha:
            </p>

            <div className="flex flex-wrap gap-1">
              {Object.keys(gasFiles).map(nome => (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setArquivoGasSelecionado(nome)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition-all ${
                    arquivoGasSelecionado === nome
                      ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {nome}
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="flex items-center justify-between bg-neutral-950 px-3 py-1.5 rounded-t-lg border-x border-t border-neutral-800 text-[11px] font-mono text-neutral-400">
                <span>{arquivoGasSelecionado}</span>
                <button
                  type="button"
                  onClick={handleCopiarGas}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  {copiadoGas ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiadoGas ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="max-h-56 overflow-auto rounded-b-lg border border-neutral-800 bg-neutral-950 p-3 text-[10px] font-mono text-neutral-300 leading-relaxed">
                {gasFiles[arquivoGasSelecionado]}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE OPERAÇÃO COM DADOS */}
      {modalConfirmacao && modalConfirmacao.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white">{modalConfirmacao.titulo}</h4>
            <p className="text-xs text-neutral-300 leading-relaxed">{modalConfirmacao.mensagem}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacao(null)}
                className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => modalConfirmacao.acao()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
