import React, { useState, useMemo } from 'react';
import { Lancamento, Quem, FormaPagamento, AlertaLog } from '../types';
import { formatarMoeda } from '../services/engine';
import { AppState, registrarLancamento, excluirLancamento } from '../services/storage';
import { ESTABELECIMENTOS_SUGERIDOS } from '../data/defaultData';
import { obterPlanilhaConectada, anexarLancamentoNaPlanilha } from '../services/googleSheets';
import { Undo2, CheckCircle2, Store, Calendar, ArrowRight, CloudCheck } from 'lucide-react';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarPainel: () => void;
}

export const LancamentoRapido: React.FC<Props> = ({ appState, setAppState, onAcessarPainel }) => {
  // Estado do teclado numérico em centavos
  const [centavos, setCentavos] = useState<number>(0);
  
  // Categorias ordenadas por frequência de uso do casal
  const categoriasOrdenadas = useMemo(() => {
    const frequencia: Record<string, number> = {};
    appState.lancamentos.forEach(l => {
      frequencia[l.categoria] = (frequencia[l.categoria] || 0) + 1;
    });

    const todas = ['Mercado', 'Combustível', 'Farmácia e Saúde', 'Lazer', 'Casa e Manutenção', 'Educação', 'Vestuário', 'Outros'];
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

  // Feedback imediato e Desfazer
  const [feedbackImpacto, setFeedbackImpacto] = useState<string | null>(null);
  const [ultimoLancamentoId, setUltimoLancamentoId] = useState<string | null>(null);
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

  // Salvar gasto
  const handleSalvar = () => {
    if (valorFinal <= 0) return;

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
    const estadoRestaurado = excluirLancamento(ultimoLancamentoId, appState);
    setAppState(estadoRestaurado);
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

      {/* Display do Valor Gigante */}
      <div id="display-valor-container" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 text-center shadow-lg backdrop-blur">
        <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">Valor do Gasto</span>
        <div id="display-valor-texto" className="mt-1 text-4xl font-extrabold tracking-tight text-white sm:text-5xl font-mono">
          {formatarMoeda(valorFinal)}
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

      {/* Categorias como Botões Grandes Tocáveis ordenados por frequência */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Categoria (Mais frequentes)</span>
        </div>
        <div id="grid-categorias-botoes" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categoriasOrdenadas.slice(0, 6).map(cat => {
            const isSelected = categoriaSelecionada === cat;
            return (
              <button
                key={cat}
                id={`btn-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
                type="button"
                onClick={() => handleSelecionarCategoria(cat)}
                className={`rounded-xl border px-3 py-3 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'border-white bg-neutral-800 text-white font-bold ring-1 ring-white/50'
                    : 'border-neutral-800/90 bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800/60'
                }`}
              >
                <div className="text-sm font-semibold truncate">{cat}</div>
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
            placeholder="Ex: Muffato Duque, Posto Shell..."
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

      {/* Botão SALVAR Fixo na Base da Tela, Sempre Visível */}
      <div id="container-salvar-fixo" className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800/80 bg-neutral-950/95 p-3.5 backdrop-blur-md">
        <div className="mx-auto max-w-md">
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
        </div>
      </div>
    </div>
  );
};
