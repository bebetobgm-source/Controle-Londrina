import React, { useState, useMemo } from 'react';
import { Lancamento, Quem, FormaPagamento, AlertaLog } from '../types';
import { formatarMoeda } from '../services/engine';
import {
  AppState,
  registrarLancamento,
  excluirLancamento,
  registrarRendaExtra,
  excluirRendaExtra
} from '../services/storage';
import { ESTABELECIMENTOS_SUGERIDOS, CATEGORIAS_RENDA_EXTRA, SUGESTOES_RENDA_EXTRA } from '../data/defaultData';
import {
  obterPlanilhaConectada,
  anexarLancamentoNaPlanilha,
  anexarRendaExtraNaPlanilha,
  sincronizarTudoSemDuplicar
} from '../services/googleSheets';
import { Undo2, CheckCircle2, Store, Calendar, ArrowRight, CloudCheck, Coins, TrendingUp } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarPainel: () => void;
}

export const LancamentoRapido: React.FC<Props> = ({ appState, setAppState, onAcessarPainel }) => {
  // Tipo: Despesa vs Renda Extra
  const [tipoLancamento, setTipoLancamento] = useState<'despesa' | 'renda_extra'>('despesa');

  // Estado do teclado numérico em centavos
  const [centavos, setCentavos] = useState<number>(0);
  
  // Categorias ordenadas por frequência de uso do casal
  const categoriasOrdenadas = useMemo(() => {
    const frequencia: Record<string, number> = {};
    appState.lancamentos.forEach(l => {
      frequencia[l.categoria] = (frequencia[l.categoria] || 0) + 1;
    });

    const todas = [
      'Mercado',
      'Alimentação Fora',
      'Combustível',
      'Farmácia e Saúde',
      'Lazer',
      'Casa e Manutenção',
      'Educação',
      'Vestuário',
      'Outros'
    ];
    return todas.sort((a, b) => (frequencia[b] || 0) - (frequencia[a] || 0));
  }, [appState.lancamentos]);

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>(categoriasOrdenadas[0] || 'Mercado');
  
  // Subcategorias disponíveis para a categoria ativa
  const subcategoriasDisponiveis = useMemo(() => {
    return appState.categorias
      .filter(c => c.categoria === categoriaSelecionada && c.ativo === 'S')
      .map(c => c.subcategoria);
  }, [appState.categorias, categoriaSelecionada]);

  const [subcategoriaSelecionada, setSubcategoriaSelecionada] = useState<string>(subcategoriasDisponiveis[0] || '');
  const [quem, setQuem] = useState<Quem>(appState.ultimoQuem || 'Ele');
  const [dataGasto, setDataGasto] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [estabelecimento, setEstabelecimento] = useState<string>('');
  const [formaPagamento] = useState<FormaPagamento>('Débito');

  // Campos específicos de Renda Extra
  const [rendaDescricao, setRendaDescricao] = useState<string>('');
  const [rendaCategoria, setRendaCategoria] = useState<string>(CATEGORIAS_RENDA_EXTRA[0].nome);
  const [rendaFormaRecebimento, setRendaFormaRecebimento] = useState<string>('Pix');

  // Feedback imediato e Desfazer
  const [feedbackImpacto, setFeedbackImpacto] = useState<string | null>(null);
  const [ultimoLancamentoId, setUltimoLancamentoId] = useState<string | null>(null);
  const [ultimoTipoLancado, setUltimoTipoLancado] = useState<'despesa' | 'renda_extra'>('despesa');
  const [tempoDesfazer, setTempoDesfazer] = useState<number>(10);
  const [alertaRecente, setAlertaRecente] = useState<AlertaLog | null>(null);

  // Manipulação do teclado numérico
  const handleDigito = (digito: string) => {
    if (digito === 'C') {
      setCentavos(0);
    } else if (digito === 'DEL') {
      setCentavos(prev => Math.floor(prev / 10));
    } else {
      setCentavos(prev => {
        if (prev > 999999) return prev;
        return prev * 10 + parseInt(digito, 10);
      });
    }
  };

  const valorFinal = centavos / 100;

  // Ao trocar de categoria, seleciona a primeira subcategoria
  const handleSelecionarCategoria = (cat: string) => {
    setCategoriaSelecionada(cat);
    const subs = appState.categorias
      .filter(c => c.categoria === cat && c.ativo === 'S')
      .map(c => c.subcategoria);
    if (subs.length > 0) {
      setSubcategoriaSelecionada(subs[0]);
    } else {
      setSubcategoriaSelecionada('');
    }
  };

  // Salvar gasto ou renda extra
  const handleSalvar = () => {
    if (valorFinal <= 0) return;

    if (tipoLancamento === 'renda_extra') {
      const novaRenda = {
        data: dataGasto,
        valor: valorFinal,
        descricao: rendaDescricao.trim() || 'Renda Extra',
        categoria: rendaCategoria,
        quem,
        forma_recebimento: rendaFormaRecebimento
      };

      const { estadoAtualizado, novoId } = registrarRendaExtra(novaRenda, appState);
      setAppState(estadoAtualizado);
      setUltimoLancamentoId(novoId);
      setUltimoTipoLancado('renda_extra');

      const planilhaConectada = obterPlanilhaConectada();
      if (planilhaConectada) {
        const itemCriado = estadoAtualizado.rendasExtras.find(r => r.id === novoId);
        if (itemCriado) {
          anexarRendaExtraNaPlanilha(planilhaConectada.id, itemCriado);
        }
      }

      setFeedbackImpacto(
        `🎉 Renda extra de ${formatarMoeda(valorFinal)} registrada! Somada ao orçamento familiar deste mês.`
      );
      setAlertaRecente(null);
      setCentavos(0);
      setRendaDescricao('');
      setTempoDesfazer(10);
      return;
    }

    const novoGasto: Omit<Lancamento, 'id' | 'mes_ref' | 'criado_em'> = {
      data: dataGasto,
      valor: valorFinal,
      categoria: categoriaSelecionada,
      subcategoria: subcategoriaSelecionada || 'Geral',
      estabelecimento: estabelecimento.trim() || undefined,
      forma_pagamento: formaPagamento,
      quem,
      essencial: 'S',
      observacao: ''
    };

    const { estadoAtualizado, novoId, alertasDisparados } = registrarLancamento(novoGasto, appState);
    setAppState(estadoAtualizado);
    setUltimoLancamentoId(novoId);
    setUltimoTipoLancado('despesa');

    // Sincronização automática em tempo real com Google Sheets se conectado
    const planilhaConectada = obterPlanilhaConectada();
    if (planilhaConectada) {
      const gastoRecemCriado = estadoAtualizado.lancamentos.find(l => l.id === novoId);
      if (gastoRecemCriado) {
        anexarLancamentoNaPlanilha(planilhaConectada.id, gastoRecemCriado);
      }
    }

    // Calcular feedback imediato: "Restam R$ 214 de mercado para 9 dias, ou seja R$ 23 por dia."
    const agora = new Date();
    const diaAtual = appState.diaAtualSimulado || agora.getDate();
    const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
    const diasRestantes = Math.max(1, totalDiasMes - diaAtual + 1);

    const tetoCat = appState.orcamento.find(o => o.categoria === categoriaSelecionada)?.teto || 0;
    const gastoCatAtualizado = estadoAtualizado.lancamentos
      .filter(l => l.categoria === categoriaSelecionada)
      .reduce((acc, l) => acc + l.valor, 0);

    const restanteCat = Math.max(0, tetoCat - gastoCatAtualizado);
    const porDiaCat = diasRestantes > 0 ? restanteCat / diasRestantes : 0;

    setFeedbackImpacto(
      `Registrado. Restam ${formatarMoeda(restanteCat)} de ${categoriaSelecionada.toLowerCase()} para ${diasRestantes} dias, ou seja ${formatarMoeda(porDiaCat)} por dia.`
    );

    if (alertasDisparados.length > 0) {
      setAlertaRecente(alertasDisparados[0]);
    } else {
      setAlertaRecente(null);
    }

    // Resetar teclado e estabelecimento para o próximo gasto
    setCentavos(0);
    setEstabelecimento('');

    // Iniciar contagem regressiva de 10 segundos para desfazer
    setTempoDesfazer(10);
  };

  // Efeito do timer de desfazer
  React.useEffect(() => {
    if (!ultimoLancamentoId) return;
    if (tempoDesfazer <= 0) {
      setFeedbackImpacto(null);
      setUltimoLancamentoId(null);
      return;
    }

    const timer = setTimeout(() => {
      setTempoDesfazer(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [tempoDesfazer, ultimoLancamentoId]);

  const handleDesfazer = () => {
    if (!ultimoLancamentoId) return;
    let estadoRestaurado: AppState;
    if (ultimoTipoLancado === 'renda_extra') {
      estadoRestaurado = excluirRendaExtra(ultimoLancamentoId, appState);
      setAppState(estadoRestaurado);
    } else {
      estadoRestaurado = excluirLancamento(ultimoLancamentoId, appState);
      setAppState(estadoRestaurado);
    }

    const planilhaConectada = obterPlanilhaConectada();
    if (planilhaConectada) {
      sincronizarTudoSemDuplicar(
        planilhaConectada.id,
        estadoRestaurado.lancamentos,
        estadoRestaurado.rendasExtras
      );
    }

    setUltimoLancamentoId(null);
    setFeedbackImpacto(null);
    setAlertaRecente(null);
  };

  return (
    <div id="tela-lancamento-rapido" className="flex flex-col pb-28 pt-2">
      {/* Toast de Impacto Imediato e Desfazer (< 10 segundos) */}
      {feedbackImpacto && (
        <div id="toast-impacto-imediato" className="mb-4 rounded-xl border border-emerald-500/40 bg-neutral-900 p-4 text-neutral-100 shadow-xl shadow-black/60 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold leading-snug text-neutral-100">{feedbackImpacto}</p>
              {alertaRecente && (
                <p className="mt-2 text-xs font-medium text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded px-2 py-1">
                  ⚠️ {alertaRecente.mensagem}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Desfazer disponível ({tempoDesfazer}s)</span>
                <button
                  id="btn-desfazer-lancamento"
                  type="button"
                  onClick={handleDesfazer}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Desfazer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seletor Tipo: Despesa vs Renda Extra */}
      <div className="mb-3 grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
        <button
          type="button"
          onClick={() => setTipoLancamento('despesa')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            tipoLancamento === 'despesa'
              ? 'bg-neutral-800 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span>Gasto / Despesa</span>
        </button>
        <button
          type="button"
          onClick={() => setTipoLancamento('renda_extra')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
            tipoLancamento === 'renda_extra'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md font-extrabold'
              : 'text-neutral-400 hover:text-emerald-400'
          }`}
        >
          <Coins className="h-3.5 w-3.5 text-emerald-400" />
          <span>Renda Extra (+ Entrada)</span>
        </button>
      </div>

      {/* Display do Valor Gigante */}
      <div id="display-valor-container" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 text-center shadow-lg backdrop-blur">
        <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
          {tipoLancamento === 'despesa' ? 'Valor do Gasto' : 'Valor da Renda Extra (Entrada)'}
        </span>
        <div id="display-valor-texto" className={`mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl font-mono ${
          tipoLancamento === 'despesa' ? 'text-white' : 'text-emerald-400'
        }`}>
          {tipoLancamento === 'renda_extra' && valorFinal > 0 ? '+ ' : ''}{formatarMoeda(valorFinal)}
        </div>
      </div>

      {/* Teclado Numérico Integrado (garante < 10 segundos e 4 toques em qualquer smartphone) */}
      <div id="teclado-numerico-grid" className="mt-3 grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'DEL'].map(key => (
          <button
            key={key}
            id={`btn-teclado-${key}`}
            type="button"
            onClick={() => handleDigito(key)}
            className={`flex items-center justify-center rounded-xl border border-neutral-800 py-3 text-xl font-bold transition-all active:scale-95 ${
              key === 'C'
                ? 'bg-neutral-900 text-red-400 hover:bg-neutral-800'
                : key === 'DEL'
                ? 'bg-neutral-900 text-amber-400 hover:bg-neutral-800'
                : 'bg-neutral-900/80 text-white hover:bg-neutral-800'
            }`}
          >
            {key === 'DEL' ? '⌫' : key}
          </button>
        ))}
      </div>

      {tipoLancamento === 'renda_extra' ? (
        /* CONTEÚDO ESPECÍFICO DE RENDA EXTRA */
        <div className="mt-4 space-y-4 animate-in fade-in">
          <div>
            <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase block mb-1">
              O que foi? (Descrição da Renda Extra)
            </label>
            <input
              type="text"
              placeholder="Ex: Toquei em casamento, freelance de edição, bônus..."
              value={rendaDescricao}
              onChange={e => setRendaDescricao(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
            />
            {/* Chips rápidos */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGESTOES_RENDA_EXTRA.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRendaDescricao(s)}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 hover:border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:text-white transition-all active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase block mb-1.5">
              Categoria de Renda
            </span>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS_RENDA_EXTRA.map(c => {
                const isSelected = rendaCategoria === c.nome;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setRendaCategoria(c.nome)}
                    className={`rounded-xl border p-2 text-left text-xs transition-all active:scale-95 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800/60'
                    }`}
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase block mb-1.5">
              Quem Recebeu?
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['Ele', 'Ela', 'Conjunto'] as Quem[]).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuem(q)}
                  className={`rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 ${
                    quem === q
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800/60'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase block mb-1">
                Data
              </label>
              <input
                type="date"
                value={dataGasto}
                onChange={e => setDataGasto(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold tracking-wider text-neutral-400 uppercase block mb-1">
                Recebido via
              </label>
              <select
                value={rendaFormaRecebimento}
                onChange={e => setRendaFormaRecebimento(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Transferência">Transferência</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* CONTEÚDO DE DESPESA / GASTO */
        <>
          {/* Categorias como Botões Grandes Tocáveis ordenados por frequência */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Categoria</span>
              <span className="text-[11px] text-neutral-500">Toque para selecionar</span>
            </div>
            <div id="grid-categorias-botoes" className="mt-2 grid grid-cols-3 gap-2">
              {categoriasOrdenadas.map(cat => {
                const isSelected = categoriaSelecionada === cat;
                return (
                  <button
                    key={cat}
                    id={`btn-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    onClick={() => handleSelecionarCategoria(cat)}
                    className={`rounded-xl border px-2 py-2 text-center flex items-center justify-center transition-all active:scale-95 min-h-[46px] ${
                      isSelected
                        ? 'border-white bg-neutral-800 text-white font-bold ring-1 ring-white/50 shadow-md'
                        : 'border-neutral-800/90 bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="text-[11px] sm:text-xs font-semibold leading-tight text-center">{cat}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategorias (aparecem imediatamente após escolher a categoria) */}
          {subcategoriasDisponiveis.length > 0 && (
            <div id="bloco-subcategorias" className="mt-3">
              <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Subcategoria</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {subcategoriasDisponiveis.map(sub => {
                  const isSelected = subcategoriaSelecionada === sub;
                  return (
                    <button
                      key={sub}
                      id={`btn-subcat-${sub.toLowerCase().replace(/\s+/g, '-')}`}
                      type="button"
                      onClick={() => setSubcategoriaSelecionada(sub)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-white text-neutral-950 font-bold'
                          : 'border border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quem Gastou (Ele, Ela, Conjunto) com memória no dispositivo */}
          <div className="mt-4">
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Quem Gastou</span>
            <div id="grupo-quem-botoes" className="mt-1.5 grid grid-cols-3 gap-2">
              {(['Ele', 'Ela', 'Conjunto'] as Quem[]).map(q => {
                const isSelected = quem === q;
                return (
                  <button
                    key={q}
                    id={`btn-quem-${q.toLowerCase()}`}
                    type="button"
                    onClick={() => setQuem(q)}
                    className={`rounded-xl border py-2.5 text-sm font-bold transition-all active:scale-95 ${
                      isSelected
                        ? 'border-white bg-neutral-800 text-white ring-1 ring-white/40'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800/60'
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detalhes Opcionais (Estabelecimento com autocomplete e Data em 1 toque) */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="input-estabelecimento" className="text-xs font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1">
                <Store className="h-3 w-3" />
                Estabelecimento (Opcional)
              </label>
              <input
                id="input-estabelecimento"
                type="text"
                list="estabelecimentos-datalist"
                value={estabelecimento}
                onChange={e => setEstabelecimento(e.target.value)}
                placeholder="Ex: Arnaldo Lanches, Muffato Duque..."
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
              />
              <datalist id="estabelecimentos-datalist">
                {ESTABELECIMENTOS_SUGERIDOS.map(item => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="input-data-gasto" className="text-xs font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data do Gasto
              </label>
              <input
                id="input-data-gasto"
                type="date"
                value={dataGasto}
                onChange={e => setDataGasto(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
            </div>
          </div>
        </>
      )}

      {/* Botão SALVAR Fixo na Base da Tela, Sempre Visível */}
      <div id="container-salvar-fixo" className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800/80 bg-neutral-950/95 p-3.5 backdrop-blur-md">
        <div className="mx-auto max-w-md">
          {tipoLancamento === 'renda_extra' ? (
            <button
              id="btn-salvar-renda-extra-principal"
              type="button"
              disabled={valorFinal <= 0}
              onClick={handleSalvar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3.5 text-base font-bold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>+ SOMAR RENDA EXTRA AO MÊS</span>
              {valorFinal > 0 && <span className="font-mono text-sm opacity-90">(+{formatarMoeda(valorFinal)})</span>}
            </button>
          ) : (
            <button
              id="btn-salvar-gasto-principal"
              type="button"
              disabled={valorFinal <= 0}
              onClick={handleSalvar}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-base font-bold text-neutral-950 shadow-lg shadow-white/10 transition-all hover:bg-neutral-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>SALVAR GASTO</span>
              {valorFinal > 0 && <span className="font-mono text-sm opacity-80">({formatarMoeda(valorFinal)})</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
