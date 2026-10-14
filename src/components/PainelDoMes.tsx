import React, { useState } from 'react';
import {
  AppState,
  alternarStatusContaFixa,
  excluirLancamento,
  limparLancamentosDeExemplo,
  atualizarContaFixa,
  adicionarContaFixa,
  excluirContaFixa,
  registrarRendaExtra,
  excluirRendaExtra
} from '../services/storage';
import {
  calcularStatusRitmo,
  calcularRitmoPorCategorias,
  calcularProjecaoFechamento,
  formatarMoeda,
  formatarDataBR
} from '../services/engine';
import {
  obterPlanilhaConectada,
  substituirLancamentosNaPlanilha,
  sincronizarFixasNaPlanilha,
  anexarRendaExtraNaPlanilha
} from '../services/googleSheets';
import {
  Check,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Wallet,
  Trash2,
  Sparkles,
  Receipt,
  RefreshCw,
  Pencil,
  Plus,
  Coins,
  Music,
  X
} from 'lucide-react';
import { ContaFixa, RendaExtra, Quem } from '../types';
import { CATEGORIAS_RENDA_EXTRA, SUGESTOES_RENDA_EXTRA } from '../data/defaultData';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarConselheiro: () => void;
}

export const PainelDoMes: React.FC<Props> = ({ appState, setAppState, onAcessarConselheiro }) => {
  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const totalDiasMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

  const statusRitmo = calcularStatusRitmo(appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes);
  const categoriasRitmo = calcularRitmoPorCategorias(appState.lancamentos, appState.orcamento, diaAtual, totalDiasMes);
  const projecao = calcularProjecaoFechamento(
    appState.lancamentos,
    appState.orcamento,
    appState.fixas,
    appState.config,
    diaAtual,
    totalDiasMes,
    appState.rendasExtras
  );

  // Reserva acumulada e aporte no mês
  const aportesMes = appState.reserva
    .filter(r => r.tipo === 'Aporte' && r.data.startsWith(mesRefAtual))
    .reduce((acc, r) => acc + r.valor, 0);

  const saldoColchao = appState.reserva.length > 0
    ? appState.reserva[appState.reserva.length - 1].saldo_acumulado
    : 2000;

  // Fixas: pagas e a vencer
  const fixasAtivas = appState.fixas.filter(f => f.ativo === 'S');
  const fixasPagas = fixasAtivas.filter(f => f.pago_mes_ref === mesRefAtual);
  const fixasAVencer = fixasAtivas.filter(f => f.pago_mes_ref !== mesRefAtual);

  const totalFixasPagas = fixasPagas.reduce((acc, f) => acc + f.valor, 0);
  const totalFixasAVencer = fixasAVencer.reduce((acc, f) => acc + f.valor, 0);

  // Rendas Extras no mês
  const rendasExtrasMes = (appState.rendasExtras || []).filter(r => r.mes_ref === mesRefAtual);
  const totalRendasExtrasMes = rendasExtrasMes.reduce((acc, r) => acc + r.valor, 0);

  // Cores semafóricas estritas
  const badgeStyle = {
    'verde': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    'amarelo': 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    'laranja': 'bg-orange-500/15 text-orange-400 border-orange-500/40',
    'vermelho': 'bg-rose-500/15 text-rose-400 border-rose-500/40'
  }[statusRitmo.cor];

  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState<boolean>(false);

  // Estados para Edição de Fixas
  const [contaFixaEmEdicao, setContaFixaEmEdicao] = useState<ContaFixa | null>(null);
  const [formFixaDescricao, setFormFixaDescricao] = useState('');
  const [formFixaValor, setFormFixaValor] = useState('');
  const [formFixaDia, setFormFixaDia] = useState('');
  const [modalNovaFixa, setModalNovaFixa] = useState(false);

  // Estados para Lançamento de Renda Extra
  const [modalRendaExtraAberta, setModalRendaExtraAberta] = useState(false);
  const [rendaValor, setRendaValor] = useState('');
  const [rendaDescricao, setRendaDescricao] = useState('');
  const [rendaQuem, setRendaQuem] = useState<Quem>(appState.ultimoQuem || 'Ele');
  const [rendaCategoria, setRendaCategoria] = useState(CATEGORIAS_RENDA_EXTRA[0].nome);
  const [rendaFormaRecebimento, setRendaFormaRecebimento] = useState('Pix');

  const handleToggleFixa = (descricao: string) => {
    const novoEstado = alternarStatusContaFixa(descricao, appState);
    setAppState(novoEstado);
  };

  const handleAbrirEdicaoFixa = (f: ContaFixa) => {
    setContaFixaEmEdicao(f);
    setFormFixaDescricao(f.descricao);
    setFormFixaValor(String(f.valor));
    setFormFixaDia(String(f.dia_vencimento));
  };

  const handleSalvarEdicaoFixa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaFixaEmEdicao) return;
    const valorNum = parseFloat(formFixaValor.replace(',', '.'));
    const diaNum = parseInt(formFixaDia, 10);
    if (isNaN(valorNum) || valorNum < 0 || isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
      alert('Por favor insira um valor e dia de vencimento válidos (1 a 31).');
      return;
    }

    const novoEstado = atualizarContaFixa(
      contaFixaEmEdicao.descricao,
      {
        descricao: formFixaDescricao.trim() || contaFixaEmEdicao.descricao,
        valor: valorNum,
        dia_vencimento: diaNum
      },
      appState
    );
    setAppState(novoEstado);
    setContaFixaEmEdicao(null);
    setMensagemFeedback(`Conta fixa '${formFixaDescricao}' atualizada para ${formatarMoeda(valorNum)}!`);

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarFixasNaPlanilha(planilha.id, novoEstado.fixas);
      setSincronizando(false);
    }
    setTimeout(() => setMensagemFeedback(null), 3500);
  };

  const handleExcluirFixa = async (descricao: string) => {
    if (!confirm(`Deseja remover a conta fixa '${descricao}' do seu orçamento?`)) return;
    const novoEstado = excluirContaFixa(descricao, appState);
    setAppState(novoEstado);
    setContaFixaEmEdicao(null);
    setMensagemFeedback(`Conta fixa '${descricao}' removida com sucesso.`);

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarFixasNaPlanilha(planilha.id, novoEstado.fixas);
      setSincronizando(false);
    }
    setTimeout(() => setMensagemFeedback(null), 3500);
  };

  const handleCriarNovaFixa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(formFixaValor.replace(',', '.'));
    const diaNum = parseInt(formFixaDia, 10);
    if (!formFixaDescricao.trim() || isNaN(valorNum) || valorNum <= 0 || isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
      alert('Preencha descrição, valor e dia válidos.');
      return;
    }

    const nova: ContaFixa = {
      descricao: formFixaDescricao.trim(),
      valor: valorNum,
      dia_vencimento: diaNum,
      categoria: 'Casa e Manutenção',
      ativo: 'S',
      pago_mes_ref: ''
    };

    const novoEstado = adicionarContaFixa(nova, appState);
    setAppState(novoEstado);
    setModalNovaFixa(false);
    setFormFixaDescricao('');
    setFormFixaValor('');
    setFormFixaDia('');
    setMensagemFeedback(`Nova conta fixa '${nova.descricao}' adicionada com sucesso!`);

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarFixasNaPlanilha(planilha.id, novoEstado.fixas);
      setSincronizando(false);
    }
    setTimeout(() => setMensagemFeedback(null), 3500);
  };

  const handleSalvarRendaExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(rendaValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum <= 0) {
      alert('Por favor insira um valor válido para a renda extra.');
      return;
    }

    const { estadoAtualizado, novoId } = registrarRendaExtra(
      {
        data: agora.toISOString().split('T')[0],
        valor: valorNum,
        descricao: rendaDescricao.trim() || 'Renda Extra',
        categoria: rendaCategoria,
        quem: rendaQuem,
        forma_recebimento: rendaFormaRecebimento
      },
      appState
    );

    setAppState(estadoAtualizado);
    setModalRendaExtraAberta(false);
    setRendaValor('');
    setRendaDescricao('');
    setMensagemFeedback(`🎉 Renda extra de ${formatarMoeda(valorNum)} somada ao orçamento do mês!`);

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      const rendaCriada = estadoAtualizado.rendasExtras.find(r => r.id === novoId);
      if (rendaCriada) {
        setSincronizando(true);
        await anexarRendaExtraNaPlanilha(planilha.id, rendaCriada);
        setSincronizando(false);
      }
    }
    setTimeout(() => setMensagemFeedback(null), 4000);
  };

  const handleExcluirRendaExtra = async (id: string) => {
    const novoEstado = excluirRendaExtra(id, appState);
    setAppState(novoEstado);
    setMensagemFeedback('Renda extra removida.');
    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  // Identificar se ainda há os 4 lançamentos de demonstração iniciais
  const idsExemplo = ['lan-1', 'lan-2', 'lan-3', 'lan-4'];
  const temLancamentosExemplo = appState.lancamentos.some(l => idsExemplo.includes(l.id));

  const handleRemoverExemplos = async () => {
    const novoEstado = limparLancamentosDeExemplo(appState);
    setAppState(novoEstado);
    setMensagemFeedback('Gastos de teste removidos! Agora o app contém apenas seus gastos reais.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await substituirLancamentosNaPlanilha(planilha.id, novoEstado.lancamentos);
      setSincronizando(false);
    }

    setTimeout(() => setMensagemFeedback(null), 4000);
  };

  const handleExcluirLancamento = async (id: string) => {
    const novoEstado = excluirLancamento(id, appState);
    setAppState(novoEstado);
    setMensagemFeedback('Lançamento excluído com sucesso.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      await substituirLancamentosNaPlanilha(planilha.id, novoEstado.lancamentos);
    }

    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  return (
    <div id="painel-do-mes-container" className="flex flex-col gap-4 pb-28 pt-2">
      {/* 1. O NÚMERO QUE IMPORTA: Maior número da tela */}
      <div id="card-numero-que-importa" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-6 text-center shadow-lg">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
          O número que importa (dia {diaAtual} de {totalDiasMes})
        </span>
        <div id="valor-disponivel-por-dia" className="mt-2 text-4xl font-extrabold tracking-tight text-white sm:text-5xl font-mono">
          {formatarMoeda(statusRitmo.disponivel_por_dia)}
        </div>
        <p className="mt-1 text-sm font-medium text-neutral-400">
          você pode gastar por dia até o fim do mês ({statusRitmo.dias_restantes} dias restantes)
        </p>
        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-neutral-500 border-t border-neutral-800/60 pt-2">
          <span>Variável restante: <strong className="text-neutral-300">{formatarMoeda(Math.max(0, statusRitmo.teto_variavel_total - statusRitmo.gasto_variavel_total))}</strong></span>
          <span>•</span>
          <span>Teto mensal: <strong className="text-neutral-300">{formatarMoeda(statusRitmo.teto_variavel_total)}</strong></span>
        </div>
      </div>

      {/* 2. SEMÁFORO DE RITMO */}
      <div id="card-semaforo-ritmo" className={`rounded-2xl border p-4.5 ${badgeStyle}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider uppercase">Semáforo de Ritmo</span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-extrabold tracking-wide uppercase border border-current">
            {statusRitmo.estado} ({Math.round(statusRitmo.indice_de_ritmo * 100)}%)
          </span>
        </div>
        <p className="mt-2 text-sm font-medium leading-relaxed">
          {statusRitmo.explicacao}
        </p>
      </div>
      {/* Feedback de Ação */}
      {mensagemFeedback && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span>{mensagemFeedback}</span>
          {sincronizando && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-normal">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Sincronizando Sheets...
            </span>
          )}
        </div>
      )}

      {/* 2.5 LISTA TRANSPARENTE DE LANÇAMENTOS DO MÊS */}
      <div id="card-lancamentos-recentes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Lançamentos do Mês ({appState.lancamentos.length})
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-white">
            Total: {formatarMoeda(appState.lancamentos.reduce((acc, l) => acc + l.valor, 0))}
          </span>
        </div>

        {/* Banner para limpar lançamentos de exemplo se existirem */}
        {temLancamentosExemplo && (
          <div className="my-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <strong className="block font-bold text-amber-300 mb-1">
                  Gastos de demonstração detectados
                </strong>
                <p className="text-neutral-300 leading-relaxed mb-2.5">
                  O aplicativo incluiu 4 lançamentos de teste como exemplo inicial (Muffato, Posto, Feira, Farmácia = R$ 679,70).
                  Deseja removê-los e manter apenas seus gastos reais (como os R$ 75,00 do Arnaldo Lanches)?
                </p>
                <button
                  type="button"
                  onClick={handleRemoverExemplos}
                  className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-neutral-950 transition-all hover:bg-amber-300 active:scale-95 flex items-center gap-1.5 shadow"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Limpar Gastos de Teste (Manter apenas os meus)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {appState.lancamentos.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            Nenhum gasto lançado ainda. Use a aba "Lançar" para registrar suas despesas.
          </div>
        ) : (
          <div className="mt-2 divide-y divide-neutral-800/60 max-h-72 overflow-y-auto pr-1">
            {appState.lancamentos.map(l => {
              const isExemplo = idsExemplo.includes(l.id);
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between py-2.5 text-xs group hover:bg-neutral-800/30 px-1 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-neutral-200 truncate">
                        {l.estabelecimento || l.observacao || l.subcategoria}
                      </span>
                      {isExemplo && (
                        <span className="rounded bg-neutral-800 border border-neutral-700 px-1.5 py-0.2 text-[9px] font-medium text-neutral-400">
                          Exemplo
                        </span>
                      )}
                      <span className="rounded bg-neutral-800 px-1.5 py-0.2 text-[10px] text-neutral-400">
                        {l.categoria}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        ({l.quem})
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                      <span>{formatarDataBR(l.data)}</span>
                      <span>•</span>
                      <span>{l.subcategoria}</span>
                      {l.forma_pagamento && (
                        <>
                          <span>•</span>
                          <span>{l.forma_pagamento}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-sm text-white">
                      {formatarMoeda(l.valor)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExcluirLancamento(l.id)}
                      title="Excluir este lançamento"
                      className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. BARRAS POR CATEGORIA VARIÁVEL (com marca vertical do dia) */}
      <div id="card-barras-categorias" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Categorias Variáveis (Gasto vs. Ritmo Esperado)
          </span>
        </div>
        <p className="text-xs text-neutral-400 mb-4">
          A linha vermelha marca onde o gasto deveria estar hoje ({Math.round(statusRitmo.percentual_do_mes * 100)}% do mês).
        </p>

        <div className="space-y-4">
          {categoriasRitmo.filter(c => c.teto > 0).map(cat => {
            const percGastoLimitado = Math.min(100, Math.round(cat.percentual_gasto * 100));
            const percEsperado = Math.min(100, Math.round(cat.percentual_esperado * 100));
            const desvio = cat.diferenca;
            const acimaDoEsperado = desvio > 0;

            return (
              <div key={cat.categoria} id={`barra-cat-${cat.categoria.toLowerCase().replace(/\s+/g, '-')}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-200">{cat.categoria}</span>
                  <span className="font-mono text-neutral-400">
                    <strong className="text-white">{formatarMoeda(cat.gasto)}</strong> / {formatarMoeda(cat.teto)}
                  </span>
                </div>

                {/* Trilha da Barra com Marcação Vertical */}
                <div className="relative h-3 w-full rounded-full bg-neutral-800 overflow-visible">
                  {/* Preenchimento do Gasto Real */}
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      acimaDoEsperado ? 'bg-amber-400' : 'bg-neutral-200'
                    }`}
                    style={{ width: `${percGastoLimitado}%` }}
                  />

                  {/* Marca Vertical do Ritmo Esperado Hoje */}
                  <div
                    className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-rose-500 shadow-sm shadow-rose-500/80 z-10"
                    style={{ left: `${percEsperado}%` }}
                    title={`Hoje (${diaAtual}): deveria estar em ${percEsperado}%`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    {acimaDoEsperado ? (
                      <span className="text-amber-400 font-medium">+{formatarMoeda(desvio)} acima do trajeto</span>
                    ) : (
                      <span className="text-emerald-400 font-medium">{formatarMoeda(Math.abs(desvio))} abaixo da cota</span>
                    )}
                  </span>
                  <span>{percGastoLimitado}% do teto</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. RENDAS EXTRAS DO MÊS (+ entradas extras que somam ao orçamento) */}
      <div id="card-rendas-extras-mes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Rendas Extras do Mês
            </span>
            {totalRendasExtrasMes > 0 && (
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-extrabold text-emerald-400 font-mono">
                +{formatarMoeda(totalRendasExtrasMes)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setRendaValor('');
              setRendaDescricao('');
              setModalRendaExtraAberta(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 transition-colors active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Lançar Renda Extra</span>
          </button>
        </div>

        <p className="text-xs text-neutral-400 mb-3">
          Entradas extras que não estavam programadas (música, casamento, freelas, vendas) somam diretamente ao orçamento familiar deste mês.
        </p>

        {rendasExtrasMes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-center">
            <Coins className="mx-auto h-6 w-6 text-neutral-600 mb-1" />
            <p className="text-xs text-neutral-300 font-medium">
              Nenhuma renda extra registrada neste mês.
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Tocou em um casamento ou fez um serviço extra? Clique em "+ Lançar Renda Extra" para somar ao orçamento!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800/70">
            {rendasExtrasMes.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 text-xs hover:bg-neutral-800/30 px-1 rounded-lg">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-neutral-100">{r.descricao}</span>
                    <span className="rounded bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 text-[10px] text-emerald-400 font-medium">
                      {r.categoria}
                    </span>
                    <span className="text-[10px] text-neutral-500">({r.quem})</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                    <span>{formatarDataBR(r.data)}</span>
                    {r.forma_recebimento && (
                      <>
                        <span>•</span>
                        <span>{r.forma_recebimento}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-sm text-emerald-400">
                    +{formatarMoeda(r.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExcluirRendaExtra(r.id)}
                    className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    title="Remover esta renda extra"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. FIXAS DO MÊS: pagas, a vencer, vencidas com EDIÇÃO DIRETA */}
      <div id="card-fixas-mes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
              Fixas do Mês ({formatarMoeda(projecao.fixasTotal)})
            </span>
            <div className="text-[11px] text-neutral-400 mt-0.5">
              Pagas: <strong className="text-emerald-400">{formatarMoeda(totalFixasPagas)}</strong> | A vencer: <strong className="text-amber-400">{formatarMoeda(totalFixasAVencer)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormFixaDescricao('');
              setFormFixaValor('');
              setFormFixaDia('10');
              setModalNovaFixa(true);
            }}
            className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 px-2.5 py-1 text-xs font-semibold text-neutral-200 transition-colors active:scale-95"
            title="Adicionar nova conta fixa"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Nova Fixa</span>
          </button>
        </div>

        <div className="divide-y divide-neutral-800/70">
          {fixasAtivas.map(f => {
            const isPago = f.pago_mes_ref === mesRefAtual;
            const vencida = !isPago && f.dia_vencimento < diaAtual;

            return (
              <div
                key={f.descricao}
                id={`fixa-item-${f.descricao.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center justify-between py-2.5 text-xs group hover:bg-neutral-800/20 px-1 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold ${isPago ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                      {f.descricao}
                    </span>
                    {vencida && (
                      <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[10px] font-bold text-rose-400">
                        Venceu dia {f.dia_vencimento}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500">Vencimento dia {f.dia_vencimento}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-neutral-200">{formatarMoeda(f.valor)}</span>
                  <button
                    type="button"
                    onClick={() => handleAbrirEdicaoFixa(f)}
                    className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title={`Editar valor ou vencimento de ${f.descricao}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFixa(f.descricao)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                      isPago
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700'
                    }`}
                  >
                    {isPago ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {isPago ? 'Paga' : 'Pagar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. PROJEÇÃO DE FECHAMENTO (Linear vs Ajustada) */}
      <div id="card-projecao-fechamento" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Projeção de Fechamento do Mês
          </span>
          <button
            type="button"
            onClick={onAcessarConselheiro}
            className="text-xs font-bold text-white underline underline-offset-4 hover:opacity-80"
          >
            Ver conselho →
          </button>
        </div>

        {/* Projeção Ajustada em Destaque */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-neutral-400 font-medium">Projeção Ajustada (Destaque)</span>
            <span className="font-mono text-lg font-extrabold text-white">
              {formatarMoeda(projecao.projecaoAjustada)}
            </span>
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            Separa compras iniciais ({formatarMoeda(projecao.compraGrandeMercado)}) e fixas ({formatarMoeda(projecao.fixasTotal)}), projetando apenas o gasto diário difuso.
          </div>

          {/* Composição da Renda se houver Renda Extra */}
          {totalRendasExtrasMes > 0 && (
            <div className="mt-2 flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-2.5 py-1">
              <span>Renda base {formatarMoeda(appState.config.renda_liquida_mensal)} + Extra {formatarMoeda(totalRendasExtrasMes)}</span>
              <strong className="font-mono font-bold">= {formatarMoeda(projecao.rendaTotal)}</strong>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between border-t border-neutral-800/80 pt-2 text-xs">
            <span>Resultado previsto:</span>
            {projecao.sobraAjustada >= 0 ? (
              <span className="font-bold text-emerald-400">Sobra de {formatarMoeda(projecao.sobraAjustada)}</span>
            ) : (
              <span className="font-bold text-rose-400">Déficit de {formatarMoeda(projecao.deficitAjustada)}</span>
            )}
          </div>
        </div>

        {/* Projeção Linear (comparativa) */}
        <div className="mt-2.5 flex items-center justify-between px-2 text-xs text-neutral-500">
          <span>Projeção Linear simples:</span>
          <span className="font-mono">{formatarMoeda(projecao.projecaoLinear)} ({projecao.sobraLinear >= 0 ? `Sobra ${formatarMoeda(projecao.sobraLinear)}` : `Déficit ${formatarMoeda(projecao.deficitLinear)}`})</span>
        </div>
      </div>

      {/* 7. RESERVA: Meta mensal e Saldo do Colchão */}
      <div id="card-reserva-colchao" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Reserva & Colchão</span>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
            <span className="text-[11px] text-neutral-400 uppercase font-semibold">Meta do Mês</span>
            <div className="mt-1 text-xl font-bold text-white font-mono">{formatarMoeda(aportesMes)}</div>
            <span className="text-[10px] text-neutral-500">de {formatarMoeda(appState.config.meta_reserva_mensal)}</span>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-center">
            <span className="text-[11px] text-neutral-400 uppercase font-semibold">Saldo do Colchão</span>
            <div className="mt-1 text-xl font-bold text-emerald-400 font-mono">{formatarMoeda(saldoColchao)}</div>
            <span className="text-[10px] text-neutral-500">meta de {formatarMoeda(appState.config.colchao_meta)}</span>
          </div>
        </div>
      </div>

      {/* MODAL: EDITAR CONTA FIXA */}
      {contaFixaEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Editar Conta Fixa</h3>
              </div>
              <button
                type="button"
                onClick={() => setContaFixaEmEdicao(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoFixa} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Nome da Conta
                </label>
                <input
                  type="text"
                  value={formFixaDescricao}
                  onChange={e => setFormFixaDescricao(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formFixaValor}
                    onChange={e => setFormFixaValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Dia Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formFixaDia}
                    onChange={e => setFormFixaDia(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 mt-1">
                Ao alterar o valor, o total de fixas, projeção de fechamento e a planilha serão sincronizados.
              </p>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleExcluirFixa(contaFixaEmEdicao.descricao)}
                  className="px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  Excluir
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setContaFixaEmEdicao(null)}
                    className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-900/40"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA CONTA FIXA */}
      {modalNovaFixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Nova Conta Fixa</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNovaFixa(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCriarNovaFixa} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Descrição (ex: Seguro, Academia, Streaming)
                </label>
                <input
                  type="text"
                  placeholder="Nome da conta fixa"
                  value={formFixaDescricao}
                  onChange={e => setFormFixaDescricao(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={formFixaValor}
                    onChange={e => setFormFixaValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Dia Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="10"
                    value={formFixaDia}
                    onChange={e => setFormFixaDia(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalNovaFixa(false)}
                  className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-900/40"
                >
                  Adicionar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LANÇAR RENDA EXTRA */}
      {modalRendaExtraAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Lançar Renda Extra</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalRendaExtraAberta(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarRendaExtra} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Valor Recebido (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-400 font-mono">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="450,00"
                    autoFocus
                    value={rendaValor}
                    onChange={e => setRendaValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-9 pr-3 py-2 text-lg font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Descrição (O que foi?)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Toquei em casamento, freelance..."
                  value={rendaDescricao}
                  onChange={e => setRendaDescricao(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  required
                />
                {/* Sugestões rápidas */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SUGESTOES_RENDA_EXTRA.slice(0, 4).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRendaDescricao(s)}
                      className="rounded bg-neutral-800 hover:bg-neutral-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Categoria de Renda
                </label>
                <select
                  value={rendaCategoria}
                  onChange={e => setRendaCategoria(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {CATEGORIAS_RENDA_EXTRA.map(c => (
                    <option key={c.id} value={c.nome}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Quem Recebeu?
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Ele', 'Ela', 'Conjunto'] as Quem[]).map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setRendaQuem(q)}
                        className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                          rendaQuem === q
                            ? 'bg-emerald-500 text-neutral-950'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Recebido por
                  </label>
                  <select
                    value={rendaFormaRecebimento}
                    onChange={e => setRendaFormaRecebimento(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalRendaExtraAberta(false)}
                  className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  + Somar ao Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
