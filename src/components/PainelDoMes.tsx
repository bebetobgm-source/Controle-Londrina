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
  excluirRendaExtra,
  registrarAporteReserva,
  excluirTransacaoReserva,
  ajustarSaldoColchao,
  obterRotuloQuem,
  filtrarLancamentosDoMes,
  formatarMesExibicao
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
  anexarRendaExtraNaPlanilha,
  anexarTransacaoReservaNaPlanilha,
  sincronizarReservaNaPlanilha,
  puxarDadosCompletosDaPlanilha,
  limparDuplicadosDaPlanilha,
  zerarPlanilhaERecomessar,
  sincronizarTudoSemDuplicar
} from '../services/googleSheets';
import { salvarEstado } from '../services/storage';
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
  X,
  Users
} from 'lucide-react';
import { ContaFixa, RendaExtra, Quem } from '../types';
import { CATEGORIAS_RENDA_EXTRA, SUGESTOES_RENDA_EXTRA } from '../data/defaultData';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarConselheiro: () => void;
  onAbrirConfigSaaS?: (aba: 'casal' | 'orcamento' | 'virar_mes' | 'assinatura') => void;
}

export const PainelDoMes: React.FC<Props> = ({
  appState,
  setAppState,
  onAcessarConselheiro,
  onAbrirConfigSaaS
}) => {
  const agora = new Date();
  const diaAtual = appState.diaAtualSimulado || agora.getDate();
  const mesRefAtual = appState.mesAtivo || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [anoRefNum, mesRefNum] = mesRefAtual.split('-').map(Number);
  const totalDiasMes = new Date(anoRefNum || agora.getFullYear(), mesRefNum || (agora.getMonth() + 1), 0).getDate();

  const lancamentosDoMes = filtrarLancamentosDoMes(appState.lancamentos, mesRefAtual);

  const statusRitmo = calcularStatusRitmo(lancamentosDoMes, appState.orcamento, diaAtual, totalDiasMes);
  const categoriasRitmo = calcularRitmoPorCategorias(lancamentosDoMes, appState.orcamento, diaAtual, totalDiasMes);
  const projecao = calcularProjecaoFechamento(
    lancamentosDoMes,
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

  // Estados para Colchão / Reserva de Emergência
  const [modalColchaoAberta, setModalColchaoAberta] = useState(false);
  const [modalExtratoColchaoAberta, setModalExtratoColchaoAberta] = useState(false);
  const [colchaoModo, setColchaoModo] = useState<'aporte' | 'ajuste_total'>('aporte');
  const [colchaoFormValor, setColchaoFormValor] = useState('');
  const [colchaoFormMotivo, setColchaoFormMotivo] = useState('Dinheiro investido em outra conta (CDB D+30)');
  const [colchaoFormData, setColchaoFormData] = useState(() => new Date().toISOString().split('T')[0]);
  const [colchaoFormQuem, setColchaoFormQuem] = useState<Quem>(appState.ultimoQuem || 'Ele');

  const handleToggleFixa = async (descricao: string) => {
    const novoEstado = alternarStatusContaFixa(descricao, appState);
    setAppState(novoEstado);

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarFixasNaPlanilha(planilha.id, novoEstado.fixas);
      setSincronizando(false);
    }
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

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarTudoSemDuplicar(planilha.id, novoEstado.lancamentos, novoEstado.rendasExtras);
      setSincronizando(false);
    }
    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  const handleAbrirModalColchao = (modo: 'aporte' | 'ajuste_total') => {
    setColchaoModo(modo);
    setColchaoFormValor(modo === 'ajuste_total' ? String(saldoColchao) : '');
    setColchaoFormMotivo(modo === 'ajuste_total' ? 'Ajuste de Saldo do Colchão' : 'Dinheiro investido em outra conta (CDB D+30)');
    setColchaoFormData(new Date().toISOString().split('T')[0]);
    setColchaoFormQuem(appState.ultimoQuem || 'Ele');
    setModalColchaoAberta(true);
  };

  const handleSalvarColchao = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(colchaoFormValor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 0) {
      alert('Por favor insira um valor numérico válido.');
      return;
    }

    if (colchaoModo === 'aporte') {
      const motivoFinal = colchaoFormMotivo.trim() || 'Aporte na Reserva';
      const { estadoAtualizado, novaTransacao } = registrarAporteReserva(
        {
          valor: valorNum,
          motivo: motivoFinal,
          tipo: 'Aporte',
          data: colchaoFormData || new Date().toISOString().split('T')[0]
        },
        appState
      );
      setAppState(estadoAtualizado);
      setModalColchaoAberta(false);
      setColchaoFormValor('');
      setMensagemFeedback(`🛡️ Aporte de ${formatarMoeda(valorNum)} adicionado ao Colchão!`);

      const planilha = obterPlanilhaConectada();
      if (planilha) {
        setSincronizando(true);
        await anexarTransacaoReservaNaPlanilha(planilha.id, novaTransacao);
        setSincronizando(false);
      }
    } else {
      // Ajustar saldo total consolidado
      const motivoFinal = colchaoFormMotivo.trim() || 'Ajuste de Saldo Consolidado';
      const { estadoAtualizado } = ajustarSaldoColchao(valorNum, motivoFinal, appState);
      setAppState(estadoAtualizado);
      setModalColchaoAberta(false);
      setColchaoFormValor('');
      setMensagemFeedback(`🛡️ Saldo total do Colchão ajustado para ${formatarMoeda(valorNum)}!`);

      const planilha = obterPlanilhaConectada();
      if (planilha) {
        setSincronizando(true);
        await sincronizarReservaNaPlanilha(planilha.id, estadoAtualizado.reserva);
        setSincronizando(false);
      }
    }
    setTimeout(() => setMensagemFeedback(null), 4000);
  };

  const handleExcluirTransacaoReserva = async (id: string) => {
    const novoEstado = excluirTransacaoReserva(id, appState);
    setAppState(novoEstado);
    setMensagemFeedback('Lançamento removido do Colchão e saldo recalculado.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarReservaNaPlanilha(planilha.id, novoEstado.reserva);
      setSincronizando(false);
    }
    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  // Modal genérico de confirmação in-app (evita window.confirm em iframes/mobile)
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    aberto: boolean;
    titulo: string;
    mensagem: string;
    textoBotao?: string;
    variante?: 'perigo' | 'aviso';
    acao: () => Promise<void>;
  } | null>(null);

  // Identificar se ainda há os lançamentos de demonstração iniciais
  const idsExemplo = ['lan-1', 'lan-2', 'lan-3', 'lan-4'];
  const termosExemplo = ['muffato duque', 'posto ipiranga', 'feira do produtor', 'droga raia'];
  const temLancamentosExemplo = appState.lancamentos.some(
    l =>
      idsExemplo.includes(l.id) ||
      termosExemplo.some(t => (l.estabelecimento || '').toLowerCase().includes(t))
  );

  const handleRemoverExemplos = () => {
    setModalConfirmacao({
      aberto: true,
      titulo: 'Remover Gastos de Exemplo?',
      mensagem:
        'Deseja remover os 4 lançamentos de teste iniciais (Muffato, Posto, Feira, Farmácia) e manter apenas os seus lançamentos reais? A aba Lancamentos na planilha Google Sheets será atualizada de forma limpa, preservando seus gastos reais.',
      textoBotao: 'Remover Exemplos e Manter Meus Gastos',
      variante: 'aviso',
      acao: async () => {
        setSincronizando(true);
        setMensagemFeedback('Removendo exemplos da planilha e do app...');
        try {
          const novoEstado = limparLancamentosDeExemplo(appState);
          setAppState(novoEstado);
          const planilha = obterPlanilhaConectada();
          if (planilha) {
            await sincronizarTudoSemDuplicar(
              planilha.id,
              novoEstado.lancamentos,
              novoEstado.rendasExtras
            );
          }
          setMensagemFeedback('✨ Gastos de exemplo removidos! Mantidos apenas seus gastos reais.');
        } catch (err: any) {
          setMensagemFeedback(err.message || 'Erro ao atualizar planilha.');
        } finally {
          setSincronizando(false);
          setModalConfirmacao(null);
          setTimeout(() => setMensagemFeedback(null), 4000);
        }
      }
    });
  };

  const handleExcluirLancamento = async (id: string) => {
    const novoEstado = excluirLancamento(id, appState);
    setAppState(novoEstado);
    setMensagemFeedback('Lançamento excluído com sucesso.');

    const planilha = obterPlanilhaConectada();
    if (planilha) {
      setSincronizando(true);
      await sincronizarTudoSemDuplicar(planilha.id, novoEstado.lancamentos, novoEstado.rendasExtras);
      setSincronizando(false);
    }

    setTimeout(() => setMensagemFeedback(null), 3000);
  };

  const handlePuxarDaPlanilha = async () => {
    const planilha = obterPlanilhaConectada();
    if (!planilha) {
      setMensagemFeedback('Nenhuma planilha conectada ainda. Conecte pelo botão Sheets.');
      setTimeout(() => setMensagemFeedback(null), 3500);
      return;
    }

    setSincronizando(true);
    setMensagemFeedback('Puxando dados atualizados da sua planilha...');
    try {
      const res = await puxarDadosCompletosDaPlanilha(planilha.id);
      setAppState(prev => {
        const atualizado: AppState = {
          ...prev,
          lancamentos: res.lancamentos,
          rendasExtras: res.rendasExtras,
          fixas: res.fixas.length > 0 ? res.fixas : prev.fixas,
          orcamento: res.orcamento && res.orcamento.length > 0 ? res.orcamento : prev.orcamento,
          reserva: res.reserva && res.reserva.length > 0 ? res.reserva : prev.reserva
        };
        salvarEstado(atualizado);
        return atualizado;
      });
      const dupInfo =
        res.duplicadosIgnorados > 0
          ? ` (${res.duplicadosIgnorados} duplicatas ignoradas)`
          : '';
      setMensagemFeedback(
        `🎉 Sincronizado! ${res.totalLancamentos} despesas, ${res.totalRendas} rendas extras e ${res.totalFixas} contas fixas atualizados.${dupInfo}`
      );
    } catch (err: any) {
      setMensagemFeedback(err.message || 'Erro ao sincronizar com a planilha.');
    } finally {
      setSincronizando(false);
      setTimeout(() => setMensagemFeedback(null), 4500);
    }
  };

  const handleLimparDuplicados = () => {
    const planilha = obterPlanilhaConectada();
    if (!planilha) {
      setMensagemFeedback('Nenhuma planilha conectada ainda.');
      return;
    }
    setModalConfirmacao({
      aberto: true,
      titulo: '🧹 Eliminar Duplicados da Planilha?',
      mensagem:
        'O sistema fará uma varredura na aba Lancamentos da sua planilha Google Sheets, identificando e removendo todas as linhas duplicadas (mesmo ID ou mesma data, valor, categoria e descrição). Apenas uma cópia única será mantida.',
      textoBotao: 'Eliminar Duplicados Agora',
      variante: 'aviso',
      acao: async () => {
        setSincronizando(true);
        setMensagemFeedback('Varrendo e eliminando duplicados na planilha...');
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
          setMensagemFeedback(`🧹 ${res.mensagem}`);
        } catch (err: any) {
          setMensagemFeedback(err.message || 'Erro ao limpar duplicados.');
        } finally {
          setSincronizando(false);
          setModalConfirmacao(null);
          setTimeout(() => setMensagemFeedback(null), 5000);
        }
      }
    });
  };

  const handleZerarTudo = () => {
    setModalConfirmacao({
      aberto: true,
      titulo: '⚠️ Zerar Planilha e Aplicativo?',
      mensagem:
        'Atenção: Isso apagará TODOS os lançamentos de despesas e rendas extras da planilha Google Sheets (a aba Lancamentos ficará completamente em branco, apenas com a linha de cabeçalhos) e do aplicativo. Use para começar do zero com seus gastos reais. Suas contas fixas e configurações continuarão salvas.',
      textoBotao: 'Sim, Zerar Tudo e Começar Limpo',
      variante: 'perigo',
      acao: async () => {
        setSincronizando(true);
        setMensagemFeedback('Zerando lançamentos na planilha e no app...');
        try {
          const planilha = obterPlanilhaConectada();
          if (planilha) {
            await zerarPlanilhaERecomessar(planilha.id);
          }
          setAppState(prev => {
            const atualizado: AppState = {
              ...prev,
              lancamentos: [],
              rendasExtras: []
            };
            salvarEstado(atualizado);
            return atualizado;
          });
          setMensagemFeedback('🗑️ Planilha e aplicativo zerados com sucesso! Comece seus lançamentos reais.');
        } catch (err: any) {
          setMensagemFeedback(err.message || 'Erro ao zerar planilha.');
        } finally {
          setSincronizando(false);
          setModalConfirmacao(null);
          setTimeout(() => setMensagemFeedback(null), 4500);
        }
      }
    });
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
      {(() => {
        const totalGastoLancamentos = lancamentosDoMes.reduce((acc, l) => acc + l.valor, 0);
        const gastoEle = lancamentosDoMes.filter(l => l.quem === 'Ele').reduce((acc, l) => acc + l.valor, 0);
        const gastoEla = lancamentosDoMes.filter(l => l.quem === 'Ela').reduce((acc, l) => acc + l.valor, 0);
        const gastoConjunto = lancamentosDoMes.filter(l => l.quem === 'Conjunto').reduce((acc, l) => acc + l.valor, 0);
        const nomeEle = obterRotuloQuem('Ele', appState.config);
        const nomeEla = obterRotuloQuem('Ela', appState.config);

        return (
          <div id="card-lancamentos-recentes" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-neutral-400" />
                <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                  Lançamentos de {formatarMesExibicao(mesRefAtual, true)} ({lancamentosDoMes.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {obterPlanilhaConectada() && (
                  <button
                    type="button"
                    onClick={handlePuxarDaPlanilha}
                    disabled={sincronizando}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400 transition-all active:scale-95 disabled:opacity-50"
                    title="Puxar dados atualizados do Google Sheets em tempo real"
                  >
                    <RefreshCw className={`h-3 w-3 ${sincronizando ? 'animate-spin' : ''}`} />
                    <span>{sincronizando ? 'Puxando...' : 'Puxar do Sheets'}</span>
                  </button>
                )}
                <span className="text-xs font-mono font-bold text-white">
                  Total: {formatarMoeda(totalGastoLancamentos)}
                </span>
              </div>
            </div>

            {/* Divisão dos Gastos do Casal no Mês */}
            <div className="grid grid-cols-3 gap-2 my-2.5 p-2 rounded-xl bg-neutral-950/70 border border-neutral-800 text-center">
              <div className="p-1.5 rounded-lg bg-sky-950/40 border border-sky-800/40">
                <span className="text-[10px] font-bold text-sky-400 block truncate">🔵 {nomeEle}</span>
                <span className="text-xs font-mono font-bold text-white">{formatarMoeda(gastoEle)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40">
                <span className="text-[10px] font-bold text-purple-400 block truncate">🟣 {nomeEla}</span>
                <span className="text-xs font-mono font-bold text-white">{formatarMoeda(gastoEla)}</span>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                <span className="text-[10px] font-bold text-emerald-400 block truncate">🟢 Casal</span>
                <span className="text-xs font-mono font-bold text-white">{formatarMoeda(gastoConjunto)}</span>
              </div>
            </div>

        {/* Barra Rápida de Manutenção da Planilha (Eliminar duplicados ou Zerar) */}
        {obterPlanilhaConectada() && (
          <div className="flex items-center justify-between gap-1.5 py-1.5 px-2.5 mb-2 rounded-xl bg-neutral-950/70 border border-neutral-800 text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Sincronização Ativa
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleLimparDuplicados}
                disabled={sincronizando}
                className="flex items-center gap-1 text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 rounded-lg px-2 py-0.5 transition-colors font-medium text-[10px]"
                title="Varre o Google Sheets e remove linhas duplicadas mantendo registros únicos"
              >
                <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                <span>Eliminar Duplicados</span>
              </button>
              <button
                type="button"
                onClick={handleZerarTudo}
                disabled={sincronizando}
                className="flex items-center gap-1 text-neutral-400 hover:text-rose-300 bg-neutral-900 hover:bg-rose-950/40 border border-neutral-800 hover:border-rose-800/50 rounded-lg px-2 py-0.5 transition-colors text-[10px]"
                title="Limpar lançamentos de teste para começar do zero com gastos reais"
              >
                <Trash2 className="h-2.5 w-2.5 text-neutral-400" />
                <span>Zerar</span>
              </button>
            </div>
          </div>
        )}

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

        {lancamentosDoMes.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-500">
            Nenhum gasto lançado em {formatarMesExibicao(mesRefAtual, true)}. Use a aba "Lançar" para registrar suas despesas.
          </div>
        ) : (
          <div className="mt-2 divide-y divide-neutral-800/60 max-h-72 overflow-y-auto pr-1">
            {lancamentosDoMes.map(l => {
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
                      {l.quem === 'Ela' ? (
                        <span className="rounded-full bg-purple-950/90 border border-purple-700/80 text-purple-300 font-bold px-2 py-0.5 text-[9px] flex items-center gap-1 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                          {nomeEla}
                        </span>
                      ) : l.quem === 'Ele' ? (
                        <span className="rounded-full bg-sky-950/90 border border-sky-700/80 text-sky-300 font-bold px-2 py-0.5 text-[9px] flex items-center gap-1 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                          {nomeEle}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-950/90 border border-emerald-700/80 text-emerald-300 font-bold px-2 py-0.5 text-[9px] flex items-center gap-1 shadow-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          Casal
                        </span>
                      )}
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
        );
      })()}

      {/* 3. BARRAS POR CATEGORIA VARIÁVEL (com marca vertical do dia) */}
      <div id="card-barras-categorias" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
            Categorias Variáveis (Gasto vs. Ritmo Esperado)
          </span>
          {onAbrirConfigSaaS && (
            <button
              type="button"
              onClick={() => onAbrirConfigSaaS('orcamento')}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline"
            >
              <Pencil className="h-3 w-3" />
              <span>Editar Tetos</span>
            </button>
          )}
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
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-neutral-300 font-bold">Gasto Total Projetado (Fixas + Variáveis)</span>
            <span className="font-mono text-lg font-extrabold text-white">
              {formatarMoeda(projecao.projecaoAjustada)}
            </span>
          </div>

          <div className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80 space-y-1">
            <div className="flex justify-between text-neutral-300">
              <span>• Contas Fixas do mês:</span>
              <strong className="font-mono text-white">{formatarMoeda(projecao.fixasTotal)}</strong>
            </div>
            <div className="flex justify-between text-neutral-300">
              <span>• Variáveis já gastos (até dia {diaAtual}):</span>
              <strong className="font-mono text-white">{formatarMoeda(projecao.gastoVariavelAteAgora)}</strong>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>• Variáveis futuros projetados:</span>
              <span className="font-mono">{formatarMoeda(Math.max(0, projecao.projecaoAjustada - projecao.fixasTotal - projecao.gastoVariavelAteAgora))}</span>
            </div>
          </div>

          {/* Composição da Renda se houver Renda Extra */}
          {totalRendasExtrasMes > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-2.5 py-1.5">
              <span>Renda base {formatarMoeda(appState.config.renda_liquida_mensal)} + Extra {formatarMoeda(totalRendasExtrasMes)}</span>
              <strong className="font-mono font-bold">= {formatarMoeda(projecao.rendaTotal)}</strong>
            </div>
          )}

          {/* Resultado Previsto no Fim do Mês */}
          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2 text-xs">
            <span className="font-medium text-neutral-300">Resultado final do mês:</span>
            {projecao.sobraAjustada >= 0 ? (
              <span className="font-bold text-emerald-400 font-mono">Sobra de {formatarMoeda(projecao.sobraAjustada)}</span>
            ) : (
              <span className="font-bold text-rose-400 font-mono">Déficit de {formatarMoeda(projecao.deficitAjustada)}</span>
            )}
          </div>

          {/* Saldo Restante Hoje da Renda */}
          <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-900">
            <span>Saldo da renda ainda livre hoje:</span>
            <span className={`font-mono font-bold ${projecao.saldoRestanteAtual >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatarMoeda(projecao.saldoRestanteAtual)}
            </span>
          </div>
        </div>

        {/* Projeção Linear (comparativa completa) */}
        <div className="mt-2.5 flex items-center justify-between px-2 text-xs text-neutral-400">
          <span>Projeção Linear simples:</span>
          <span className="font-mono text-neutral-300">
            {formatarMoeda(projecao.projecaoLinear)}{' '}
            <span className={projecao.sobraLinear >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              ({projecao.sobraLinear >= 0 ? `Sobra ${formatarMoeda(projecao.sobraLinear)}` : `Déficit ${formatarMoeda(projecao.deficitLinear)}`})
            </span>
          </span>
        </div>

        {/* Botão Fechar Mês / Virar Ciclo */}
        {onAbrirConfigSaaS && (
          <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              Pronto para encerrar {formatarMesExibicao(mesRefAtual, true)}?
            </span>
            <button
              type="button"
              onClick={() => onAbrirConfigSaaS('virar_mes')}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors"
            >
              Fechar Mês & Virar Ciclo →
            </button>
          </div>
        )}
      </div>

      {/* 7. RESERVA: Meta mensal e Saldo do Colchão */}
      <div id="card-reserva-colchao" className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-bold tracking-wider text-neutral-300 uppercase">Reserva & Colchão de Emergência</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded-full">
            {((saldoColchao / (appState.config.colchao_meta || 4600)) * 100).toFixed(0)}% da meta
          </span>
        </div>

        {/* Barra visual de progresso da meta */}
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, (saldoColchao / (appState.config.colchao_meta || 4600)) * 100))}%`
              }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
            <span>Saldo: <strong className="text-emerald-400 font-mono">{formatarMoeda(saldoColchao)}</strong></span>
            <span>Meta final: <strong className="text-neutral-300 font-mono">{formatarMoeda(appState.config.colchao_meta)}</strong></span>
          </div>
        </div>

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

        {/* Dica explicativa sobre investimentos externos (CDB D+30, etc.) */}
        <div className="mt-3 rounded-xl border border-sky-900/40 bg-sky-950/20 p-3 text-[11px] text-sky-200/90 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-sky-100">Dinheiro investido ou em outra conta (ex: CDB D+30)?</strong> Como o resgate tem carência e você não corre o risco de gastá-lo no dia a dia, lance-o aqui como <strong>Aporte</strong> ou faça o <strong>Ajuste de Saldo</strong> para compor o Colchão familiar sem mexer no seu orçamento mensal.
          </p>
        </div>

        {/* Ações da Reserva / Colchão */}
        <div className="mt-3.5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleAbrirModalColchao('aporte')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 p-2.5 text-xs font-bold text-sky-300 transition-all active:scale-95"
          >
            <Plus className="h-3.5 w-3.5 text-sky-400" />
            <span>+ Aporte</span>
          </button>

          <button
            type="button"
            onClick={() => handleAbrirModalColchao('ajuste_total')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 p-2.5 text-xs font-semibold text-neutral-200 transition-all active:scale-95"
          >
            <Pencil className="h-3.5 w-3.5 text-neutral-400" />
            <span>Ajustar Saldo</span>
          </button>

          <button
            type="button"
            onClick={() => setModalExtratoColchaoAberta(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 p-2.5 text-xs font-semibold text-neutral-200 transition-all active:scale-95"
          >
            <Receipt className="h-3.5 w-3.5 text-neutral-400" />
            <span>Extrato ({appState.reserva?.length || 0})</span>
          </button>
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
                        {obterRotuloQuem(q, appState.config)}
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

      {/* MODAL: APORTE / AJUSTE NO COLCHÃO */}
      {modalColchaoAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-400" />
                <h3 className="text-sm font-bold text-white">
                  {colchaoModo === 'aporte' ? 'Novo Aporte no Colchão' : 'Ajustar Saldo do Colchão'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalColchaoAberta(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Alternador de Modo */}
            <div className="mt-3.5 grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-950 p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setColchaoModo('aporte');
                  setColchaoFormValor('');
                  setColchaoFormMotivo('Dinheiro investido em outra conta (CDB D+30)');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  colchaoModo === 'aporte'
                    ? 'bg-sky-500 text-neutral-950 shadow-md font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                + Aporte / Entrada
              </button>
              <button
                type="button"
                onClick={() => {
                  setColchaoModo('ajuste_total');
                  setColchaoFormValor(String(saldoColchao));
                  setColchaoFormMotivo('Ajuste de Saldo do Colchão');
                }}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  colchaoModo === 'ajuste_total'
                    ? 'bg-neutral-800 text-white shadow-md font-extrabold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Ajustar Total
              </button>
            </div>

            <form onSubmit={handleSalvarColchao} className="mt-4 space-y-3.5">
              {colchaoModo === 'aporte' ? (
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Valor a Guardar (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0,00"
                    value={colchaoFormValor}
                    onChange={e => setColchaoFormValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-base font-mono text-white focus:border-sky-500 focus:outline-none"
                    required
                    autoFocus
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    Este valor será somado ao colchão sem descontar dos seus gastos do mês.
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-300 block">
                      Novo Saldo Total do Colchão (R$)
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      Atual: {formatarMoeda(saldoColchao)}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={colchaoFormValor}
                    onChange={e => setColchaoFormValor(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-base font-mono text-white focus:border-sky-500 focus:outline-none"
                    required
                    autoFocus
                  />
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    Altera diretamente o saldo consolidado da sua reserva de emergência.
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">
                  Origem / Motivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dinheiro em CDB D+30 outra conta..."
                  value={colchaoFormMotivo}
                  onChange={e => setColchaoFormMotivo(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                  required
                />
                {/* Sugestões rápidas */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[
                    'Dinheiro investido em outra conta (CDB D+30)',
                    'Aporte mensal da economia',
                    'Aplicação Tesouro / Poupança',
                    'Reserva guardada'
                  ].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setColchaoFormMotivo(s)}
                      className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                        colchaoFormMotivo === s
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Quem Guardou?
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Ele', 'Ela', 'Conjunto'] as Quem[]).map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setColchaoFormQuem(q)}
                        className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                          colchaoFormQuem === q
                            ? 'bg-sky-500 text-neutral-950 font-extrabold'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {obterRotuloQuem(q, appState.config)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Data do Aporte
                  </label>
                  <input
                    type="date"
                    value={colchaoFormData}
                    onChange={e => setColchaoFormData(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalColchaoAberta(false)}
                  className="px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sincronizando}
                  className="px-4 py-2 text-xs font-bold text-neutral-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition-all shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50"
                >
                  {colchaoModo === 'aporte' ? '+ Guardar no Colchão' : 'Salvar Novo Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXTRATO & HISTÓRICO DO COLCHÃO */}
      {modalExtratoColchaoAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-sky-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Extrato da Reserva & Colchão</h3>
                  <p className="text-[10px] text-neutral-400">
                    Saldo Atual: <strong className="text-emerald-400 font-mono">{formatarMoeda(saldoColchao)}</strong> de {formatarMoeda(appState.config.colchao_meta)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalExtratoColchaoAberta(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 overflow-y-auto space-y-2 pr-1 flex-1">
              {!appState.reserva || appState.reserva.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-500">
                  Nenhum aporte ou lançamento no colchão ainda.
                </div>
              ) : (
                [...appState.reserva].reverse().map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-950 p-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            r.tipo === 'Aporte'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {r.tipo}
                        </span>
                        <span className="font-semibold text-white truncate">
                          {r.motivo || 'Aporte no Colchão'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400">
                        <span>{formatarDataBR(r.data)}</span>
                        <span>•</span>
                        <span>Acumulado: <strong className="font-mono text-neutral-300">{formatarMoeda(r.saldo_acumulado)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-sm font-bold ${
                          r.tipo === 'Aporte' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.tipo === 'Aporte' ? '+' : '-'} {formatarMoeda(r.valor)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setModalConfirmacao({
                            aberto: true,
                            titulo: 'Excluir lançamento da reserva?',
                            mensagem: `Deseja remover "${r.motivo}" (${formatarMoeda(r.valor)})? O saldo do colchão será recalculado automaticamente e sincronizado com a planilha.`,
                            textoBotao: 'Excluir',
                            variante: 'perigo',
                            acao: async () => {
                              await handleExcluirTransacaoReserva(r.id);
                              setModalConfirmacao(null);
                            }
                          });
                        }}
                        className="text-neutral-500 hover:text-rose-400 p-1 transition-colors"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-neutral-800 shrink-0 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setModalExtratoColchaoAberta(false);
                  handleAbrirModalColchao('aporte');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Novo Aporte</span>
              </button>
              <button
                type="button"
                onClick={() => setModalExtratoColchaoAberta(false)}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {modalConfirmacao && modalConfirmacao.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {modalConfirmacao.variante === 'perigo' ? (
                <Trash2 className="h-5 w-5 text-rose-400" />
              ) : (
                <Sparkles className="h-5 w-5 text-amber-400" />
              )}
              <span>{modalConfirmacao.titulo}</span>
            </h3>
            <p className="mt-2.5 text-xs text-neutral-300 leading-relaxed">
              {modalConfirmacao.mensagem}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={sincronizando}
                onClick={() => setModalConfirmacao(null)}
                className="rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sincronizando}
                onClick={modalConfirmacao.acao}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 active:scale-95 ${
                  modalConfirmacao.variante === 'perigo'
                    ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-lg shadow-amber-400/20'
                }`}
              >
                {sincronizando && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {sincronizando
                    ? 'Processando...'
                    : modalConfirmacao.textoBotao || 'Confirmar'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
