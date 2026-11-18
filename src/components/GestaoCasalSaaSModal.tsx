import React, { useState } from 'react';
import {
  X,
  Users,
  Copy,
  Check,
  Share2,
  Calendar,
  Crown,
  ExternalLink,
  Link2,
  MessageCircle,
  LogOut
} from 'lucide-react';
import {
  AppState,
  atualizarConfiguracaoCasal,
  salvarOrcamentoCompleto,
  virarMesCiclo,
  formatarMesExibicao,
  navegarMes,
  criarConviteParceiroFirestore
} from '../services/storage';
import { formatarMoeda, calcularProjecaoFechamento } from '../services/engine';

interface Props {
  aberto: boolean;
  abaInicial?: 'casal' | 'orcamento' | 'virar_mes' | 'assinatura';
  familyId: string | null;
  membrosConectados: string[];
  emailUsuario?: string | null;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onFechar: () => void;
  onAbrirLandingPage: () => void;
  onSairConta?: () => void;
}

export const GestaoCasalSaaSModal: React.FC<Props> = ({
  aberto,
  abaInicial = 'casal',
  familyId,
  membrosConectados,
  emailUsuario,
  appState,
  setAppState,
  onFechar,
  onAbrirLandingPage,
  onSairConta
}) => {
  const [aba, setAba] = useState<'casal' | 'orcamento' | 'virar_mes' | 'assinatura'>(abaInicial);

  // Estado Aba 1: Casal & Convite Seguro de 24 caracteres
  const [nomeFamilia, setNomeFamilia] = useState(appState.config.nome_familia || 'Família Londrina');
  const [nomeParceiro1, setNomeParceiro1] = useState(appState.config.nome_parceiro_1 || 'Ele');
  const [nomeParceiro2, setNomeParceiro2] = useState(appState.config.nome_parceiro_2 || 'Ela');
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [conviteGerado, setConviteGerado] = useState<{ token: string; link: string; expiresAt: Date } | null>(null);
  const [copiadoLink, setCopiadoLink] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Estado Aba 2: Renda & Tetos
  const [rendaMensal, setRendaMensal] = useState(String(appState.config.renda_liquida_mensal));
  const [metaReservaMensal, setMetaReservaMensal] = useState(String(appState.config.meta_reserva_mensal));
  const [metaColchao, setMetaColchao] = useState(String(appState.config.colchao_meta));
  const [tetosEditados, setTetosEditados] = useState<Record<string, number>>(() => {
    const mapa: Record<string, number> = {};
    appState.orcamento
      .filter(o => o.tipo === 'Variável')
      .forEach(o => {
        mapa[o.categoria] = o.teto;
      });
    return mapa;
  });

  // Estado Aba 3: Virar Mês
  const proximoMesRef = navegarMes(appState.mesAtivo, 1);
  const [transferirSobra, setTransferirSobra] = useState(true);

  if (!aberto) return null;

  const projecaoAtual = calcularProjecaoFechamento(
    appState.lancamentos.filter(l => l.mes_ref === appState.mesAtivo),
    appState.orcamento,
    appState.fixas,
    appState.config,
    appState.diaAtualSimulado || new Date().getDate(),
    30,
    appState.rendasExtras
  );
  const sobraEstimada = Math.max(0, projecaoAtual.saldoRestanteAtual);

  const handleGerarLinkConvite = async () => {
    if (!familyId) {
      setFeedback('Aguarde o carregamento da família na nuvem.');
      return;
    }
    setGerandoConvite(true);
    try {
      const dados = await criarConviteParceiroFirestore(
        familyId,
        nomeFamilia.trim() || appState.config.nome_familia || 'Nossa Família'
      );
      setConviteGerado(dados);
      setFeedback('🔗 Link seguro de 24 caracteres criado com validade de 48h!');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback(err?.message || 'Erro ao gerar convite.');
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setGerandoConvite(false);
    }
  };

  const handleCopiarLink = () => {
    if (!conviteGerado) return;
    navigator.clipboard.writeText(conviteGerado.link);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2500);
  };

  const handleCompartilharWhatsApp = () => {
    if (!conviteGerado) return;
    const texto = `Oi! Criei o orçamento da nossa casa (${nomeFamilia || 'Nossa Família'}) no app. Toque neste link para conectar seu celular ao meu em tempo real (válido por 48h): ${conviteGerado.link}`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSalvarNomesCasal = (e: React.FormEvent) => {
    e.preventDefault();
    const novo = atualizarConfiguracaoCasal(
      {
        nome_familia: nomeFamilia.trim() || 'Nossa Família',
        nome_parceiro_1: nomeParceiro1.trim() || 'Ele',
        nome_parceiro_2: nomeParceiro2.trim() || 'Ela'
      },
      appState
    );
    setAppState(novo);
    setFeedback('✨ Nomes do casal sincronizados na nuvem!');
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSalvarRendaETetos = (e: React.FormEvent) => {
    e.preventDefault();
    const rNum = parseFloat(rendaMensal.replace(',', '.')) || 6500;
    const mRes = parseFloat(metaReservaMensal.replace(',', '.')) || 200;
    const mCol = parseFloat(metaColchao.replace(',', '.')) || 4600;

    let estado = atualizarConfiguracaoCasal(
      {
        renda_liquida_mensal: rNum,
        meta_reserva_mensal: mRes,
        colchao_meta: mCol
      },
      appState
    );
    estado = salvarOrcamentoCompleto(tetosEditados, estado);
    setAppState(estado);
    setFeedback('💰 Renda mensal, metas e tetos sincronizados na nuvem!');
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleConfirmarViradaMes = () => {
    const novo = virarMesCiclo(proximoMesRef, transferirSobra, sobraEstimada, appState);
    setAppState(novo);
    setFeedback(`📅 Bem-vindo a ${formatarMesExibicao(proximoMesRef, false)}! Contas fixas prontas para o novo ciclo.`);
    setTimeout(() => {
      setFeedback(null);
      onFechar();
    }, 2000);
  };

  const handleMudarPlano = (plano: 'trial' | 'mensal' | 'anual') => {
    const novo = atualizarConfiguracaoCasal({ plano_assinatura: plano }, appState);
    setAppState(novo);
    setFeedback(
      plano === 'anual'
        ? '👑 Plano Casal Anual (R$ 14,90/mês) ativado!'
        : plano === 'mensal'
        ? '✨ Plano Casal Mensal (R$ 19,90/mês) ativado!'
        : '⏳ Modo de Avaliação Gratuita de 7 dias ativo.'
    );
    setTimeout(() => setFeedback(null), 3500);
  };

  const qtdMembros = Math.min(2, Math.max(1, membrosConectados.length));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
              Sincronização Cloud Firestore • {qtdMembros}/2 Membros
            </span>
            <h3 className="text-base font-extrabold text-white">
              {appState.config.nome_familia || 'Família Londrina'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navegação de Abas Internas */}
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-neutral-950 p-1 border border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={() => setAba('casal')}
            className={`rounded-lg py-2 text-[11px] font-bold transition-all ${
              aba === 'casal' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Casal & Par
          </button>
          <button
            type="button"
            onClick={() => setAba('orcamento')}
            className={`rounded-lg py-2 text-[11px] font-bold transition-all ${
              aba === 'orcamento' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Renda & Tetos
          </button>
          <button
            type="button"
            onClick={() => setAba('virar_mes')}
            className={`rounded-lg py-2 text-[11px] font-bold transition-all ${
              aba === 'virar_mes' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Virar Mês
          </button>
          <button
            type="button"
            onClick={() => setAba('assinatura')}
            className={`rounded-lg py-2 text-[11px] font-bold transition-all ${
              aba === 'assinatura' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'
            }`}
          >
            SaaS & Conta
          </button>
        </div>

        {feedback && (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs font-semibold text-emerald-200 shrink-0">
            {feedback}
          </div>
        )}

        {/* Conteúdo Rolável */}
        <div className="mt-4 overflow-y-auto space-y-4 pr-1 flex-1">
          {aba === 'casal' && (
            <div className="space-y-4">
              {/* Bloco de Convite Seguro (Token de 24 caracteres com validade de 48h) */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>Conectar Meu Par (Tempo Real)</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                      qtdMembros >= 2
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : 'bg-neutral-950 text-sky-300 border-sky-500/40'
                    }`}
                  >
                    {qtdMembros}/2 conectados
                  </span>
                </div>

                {qtdMembros >= 2 ? (
                  <p className="text-xs text-emerald-300 leading-relaxed">
                    Os 2 celulares do casal já estão vinculados a esta família! Qualquer despesa lançada por um aparece no celular do outro em segundos.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-neutral-300 leading-relaxed">
                      Gere um link de convite único (token criptográfico de 24 caracteres com validade de 48h) e envie para o seu par no WhatsApp:
                    </p>

                    {!conviteGerado ? (
                      <button
                        type="button"
                        disabled={gerandoConvite}
                        onClick={handleGerarLinkConvite}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 py-2.5 text-xs font-extrabold text-neutral-950 transition-all"
                      >
                        <Link2 className="h-4 w-4" />
                        <span>{gerandoConvite ? 'Gerando convite seguro...' : 'Conectar meu par'}</span>
                      </button>
                    ) : (
                      <div className="space-y-2.5 pt-1">
                        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
                          <span className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                            Link de convite (válido por 48h):
                          </span>
                          <p className="text-[11px] font-mono text-sky-300 break-all select-all">
                            {conviteGerado.link}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleCopiarLink}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 py-2.5 text-xs font-bold text-white transition-colors"
                          >
                            {copiadoLink ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-sky-400" />
                            )}
                            <span>{copiadoLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCompartilharWhatsApp}
                            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 py-2.5 text-xs font-extrabold text-neutral-950 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>Enviar no WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Personalizar Nomes */}
              <form onSubmit={handleSalvarNomesCasal} className="space-y-3 border-t border-neutral-800 pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
                  Personalizar Nomes no App
                </span>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Nome da Família / Casa
                  </label>
                  <input
                    type="text"
                    value={nomeFamilia}
                    onChange={e => setNomeFamilia(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-sky-400 block mb-1">
                      Parceiro 1 (Botão Azul)
                    </label>
                    <input
                      type="text"
                      value={nomeParceiro1}
                      onChange={e => setNomeParceiro1(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-purple-400 block mb-1">
                      Parceiro 2 (Botão Roxo)
                    </label>
                    <input
                      type="text"
                      value={nomeParceiro2}
                      onChange={e => setNomeParceiro2(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-400 hover:bg-emerald-300 py-2.5 text-xs font-extrabold text-neutral-950 transition-all"
                >
                  Salvar Nomes do Casal
                </button>
              </form>
            </div>
          )}

          {aba === 'orcamento' && (
            <form onSubmit={handleSalvarRendaETetos} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                    Renda Mensal (R$)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={rendaMensal}
                    onChange={e => setRendaMensal(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                    Reserva/Mês (R$)
                  </label>
                  <input
                    type="number"
                    step="25"
                    value={metaReservaMensal}
                    onChange={e => setMetaReservaMensal(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-300 block mb-1">
                    Meta Colchão (R$)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={metaColchao}
                    onChange={e => setMetaColchao(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-sky-400"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Tetos por Categoria Variável
                  </span>
                  <span className="text-xs font-mono text-neutral-300">
                    Soma: {formatarMoeda((Object.values(tetosEditados) as number[]).reduce((a, b) => a + b, 0))}
                  </span>
                </div>

                {(Object.entries(tetosEditados) as [string, number][]).map(([cat, val]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2"
                  >
                    <span className="text-xs font-medium text-neutral-200">{cat}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-neutral-500">R$</span>
                      <input
                        type="number"
                        step="25"
                        min="0"
                        value={val}
                        onChange={e =>
                          setTetosEditados(prev => ({
                            ...prev,
                            [cat]: Math.max(0, parseFloat(e.target.value) || 0)
                          }))
                        }
                        className="w-24 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1 text-right text-xs font-mono font-bold text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3 text-xs font-extrabold text-neutral-950 transition-all"
              >
                Salvar Renda e Tetos Orçamentários
              </button>
            </form>
          )}

          {aba === 'virar_mes' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                  Fechamento de Ciclo Mensal
                </span>
                <h4 className="text-sm font-bold text-white">
                  Encerrar {formatarMesExibicao(appState.mesAtivo, false)} → Iniciar {formatarMesExibicao(proximoMesRef, false)}
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Ao virar o mês, seus lançamentos de {formatarMesExibicao(appState.mesAtivo, true)} ficam salvos no histórico na nuvem e todas as Contas Fixas reabrem como "A vencer" para o novo mês.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Saldo restante da renda neste mês:</span>
                  <strong className="font-mono text-emerald-400">{formatarMoeda(sobraEstimada)}</strong>
                </div>
                {sobraEstimada > 0 && (
                  <label className="flex items-start gap-2.5 pt-2 border-t border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferirSobra}
                      onChange={e => setTransferirSobra(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-emerald-400"
                    />
                    <span className="text-neutral-200 leading-snug">
                      Transferir automaticamente a sobra de <strong className="font-mono text-emerald-400">{formatarMoeda(sobraEstimada)}</strong> para o Colchão de Emergência ao abrir {formatarMesExibicao(proximoMesRef, true)}
                    </span>
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmarViradaMes}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3.5 text-xs font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Calendar className="h-4 w-4" />
                <span>Fechar Ciclo e Iniciar {formatarMesExibicao(proximoMesRef, true)}</span>
              </button>
            </div>
          )}

          {aba === 'assinatura' && (
            <div className="space-y-4">
              {/* Status Atual da Assinatura */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                    <Crown className="h-4 w-4 text-emerald-400" />
                    <span>Plano Atual do Casal</span>
                  </span>
                  <span className="rounded bg-emerald-400/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                    {appState.config.plano_assinatura === 'anual'
                      ? 'Anual Ativo (R$ 14,90/mês)'
                      : appState.config.plano_assinatura === 'mensal'
                      ? 'Mensal Ativo (R$ 19,90/mês)'
                      : 'Teste Grátis 7 Dias'}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Sua assinatura cobre os 2 celulares do casal com sincronização em tempo real no Firestore e espelhamento opcional em planilha Google Sheets.
                </p>
                {emailUsuario && (
                  <p className="text-[11px] font-mono text-neutral-400 pt-1 border-t border-emerald-500/20">
                    Conta Google conectada: <strong className="text-white">{emailUsuario}</strong>
                  </p>
                )}
              </div>

              {/* Alternar Planos */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleMudarPlano('mensal')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    appState.config.plano_assinatura === 'mensal'
                      ? 'border-emerald-400 bg-neutral-800'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Plano Mensal</span>
                  <span className="font-mono text-base font-extrabold text-emerald-400">R$ 19,90/mês</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">2 aparelhos inclusos</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleMudarPlano('anual')}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    appState.config.plano_assinatura === 'anual'
                      ? 'border-emerald-400 bg-neutral-800'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Plano Anual (-25%)</span>
                  <span className="font-mono text-base font-extrabold text-emerald-400">R$ 14,90/mês</span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">Economize R$ 60/ano</span>
                </button>
              </div>

              <div className="border-t border-neutral-800 pt-3 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onFechar();
                    onAbrirLandingPage();
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 px-4 py-3 text-xs font-bold text-white transition-colors"
                >
                  <span>Ver Página de Vendas (Landing Page SaaS)</span>
                  <ExternalLink className="h-4 w-4 text-emerald-400" />
                </button>

                {onSairConta && (
                  <button
                    type="button"
                    onClick={() => {
                      onFechar();
                      onSairConta();
                    }}
                    className="w-full flex items-center justify-between rounded-xl border border-rose-900/60 bg-rose-950/30 hover:bg-rose-950/60 px-4 py-3 text-xs font-bold text-rose-300 transition-colors"
                  >
                    <span>Sair da Conta Google neste aparelho</span>
                    <LogOut className="h-4 w-4 text-rose-400" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
