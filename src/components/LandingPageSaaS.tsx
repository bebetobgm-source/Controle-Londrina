import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  TrendingUp,
  Smartphone,
  FileSpreadsheet,
  Lock,
  Calendar,
  KeyRound,
  ChevronLeft
} from 'lucide-react';
import { formatarMoeda } from '../services/engine';

interface Props {
  onIniciarOnboarding: (planoEscolhido?: 'trial' | 'mensal' | 'anual') => void;
  onVoltarPainelAtual: () => void;
  onVincularCodigo: (codigo: string) => void;
  codigoAtual?: string;
  nomeFamiliaAtual?: string;
}

export const LandingPageSaaS: React.FC<Props> = ({
  onIniciarOnboarding,
  onVoltarPainelAtual,
  onVincularCodigo,
  codigoAtual,
  nomeFamiliaAtual
}) => {
  const [cicloPreco, setCicloPreco] = useState<'anual' | 'mensal'>('anual');
  const [mostrarInputCodigo, setMostrarInputCodigo] = useState(false);
  const [codigoInput, setCodigoInput] = useState('');
  const [simulacaoRenda, setSimulacaoRenda] = useState<number>(6500);
  const [simulacaoFixas, setSimulacaoFixas] = useState<number>(4400);

  const sobraVariavelSimulada = Math.max(0, simulacaoRenda - simulacaoFixas - 300);
  const metaDiariaSimulada = sobraVariavelSimulada / 30;

  const handleConectarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoInput.trim()) return;
    onVincularCodigo(codigoInput.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col selection:bg-emerald-500 selection:text-neutral-950">
      {/* Barra de Navegação SaaS */}
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-[#0A0A0A]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-neutral-950 font-black text-sm font-mono">
              R$
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-white block leading-none">
                RitmoCasal
              </span>
              <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
                Orçamento Sincronizado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onVoltarPainelAtual}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-300 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5 text-emerald-400" />
              <span>Meu Painel ({nomeFamiliaAtual || 'Ativo'})</span>
            </button>
            <button
              type="button"
              onClick={() => onIniciarOnboarding('trial')}
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-white hover:bg-neutral-200 px-3.5 py-2 text-xs font-bold text-neutral-950 transition-all active:scale-95"
            >
              <span>Testar 7 Dias Grátis</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section Assimétrica */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:pt-16 md:pb-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          {/* Coluna de Copy Principal (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 border-l-2 border-emerald-400 pl-3 text-xs font-mono uppercase tracking-widest text-emerald-400">
              <span>Feito para casais reais • Sincronização em 3 segundos</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
              Saiba exatamente quanto o casal pode gastar <span className="text-emerald-400">hoje</span> sem estourar o mês.
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-xl">
              Chega de planilhas que ninguém preenche ou surpresas na fatura. Quando um lança R$ 59 no mercado, o celular do outro atualiza na hora o limite diário da casa.
            </p>

            {/* CTAs Principais */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => onIniciarOnboarding('trial')}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 px-6 py-4 text-sm font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-98"
              >
                <span>Começar Teste Grátis de 7 Dias</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setMostrarInputCodigo(prev => !prev)}
                className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-5 py-4 text-sm font-bold text-neutral-200 transition-colors"
              >
                <KeyRound className="h-4 w-4 text-sky-400" />
                <span>Tenho Código do Meu Par</span>
              </button>
            </div>

            {/* Caixa de vínculo rápido por código do cônjuge */}
            {mostrarInputCodigo && (
              <form
                onSubmit={handleConectarCodigo}
                className="rounded-2xl border border-sky-500/40 bg-neutral-900/95 p-4 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300 uppercase tracking-wider">
                    Conectar ao Orçamento do Cônjuge
                  </span>
                  {codigoAtual && (
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Seu código atual: <strong className="text-white">{codigoAtual}</strong>
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  Digite o código que seu marido ou esposa enviou no WhatsApp para sincronizar os dois celulares na mesma conta:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: CASAL-8492"
                    value={codigoInput}
                    onChange={e => setCodigoInput(e.target.value.toUpperCase())}
                    className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-sm font-mono font-bold uppercase text-white placeholder-neutral-600 focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-sky-400 hover:bg-sky-300 px-4 py-2.5 text-xs font-extrabold text-neutral-950 transition-all"
                  >
                    Vincular Agora
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-neutral-900 text-xs text-neutral-400">
              <div>
                <strong className="text-white font-mono text-base block">5 seg</strong>
                <span>Para lançar um gasto no caixa</span>
              </div>
              <div>
                <strong className="text-white font-mono text-base block">2 celulares</strong>
                <span>Sincronizados em tempo real</span>
              </div>
              <div>
                <strong className="text-white font-mono text-base block">100% seu</strong>
                <span>Nuvem + espelho no Google Sheets</span>
              </div>
            </div>
          </div>

          {/* Coluna Direita: Preview Interativo Real do App (5 cols) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
                    Simulador ao Vivo
                  </span>
                  <h3 className="text-sm font-bold text-white">Descubra o Número do Seu Casal</h3>
                </div>
                <span className="text-xs font-mono text-neutral-400">30 dias</span>
              </div>

              {/* Controles rápidos do simulador de página de vendas */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Renda Líquida do Casal (Mês)</span>
                    <strong className="font-mono text-white">{formatarMoeda(simulacaoRenda)}</strong>
                  </div>
                  <input
                    type="range"
                    min={2500}
                    max={25000}
                    step={250}
                    value={simulacaoRenda}
                    onChange={e => setSimulacaoRenda(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Contas Fixas (Aluguel, Luz, Carro...)</span>
                    <strong className="font-mono text-white">{formatarMoeda(simulacaoFixas)}</strong>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={Math.max(1500, simulacaoRenda - 500)}
                    step={100}
                    value={Math.min(simulacaoFixas, Math.max(1500, simulacaoRenda - 500))}
                    onChange={e => setSimulacaoFixas(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Card O Número Que Importa */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  O Número Que Importa Hoje
                </span>
                <div className="mt-1 text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                  {formatarMoeda(metaDiariaSimulada)}
                  <span className="text-xs font-normal text-neutral-400"> /dia</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Disponível para mercado, combustível e lazer mantendo R$ 300/mês no Colchão de Emergência.
                </p>
              </div>

              {/* Exemplo de sincronização entre o casal */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Últimos lançamentos sincronizados
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-900/90 px-3 py-2 text-xs border border-neutral-800/80">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    <span className="font-semibold text-neutral-200">Mercado e Hortifrúti</span>
                    <span className="text-[10px] text-purple-300 font-mono">Ela</span>
                  </div>
                  <span className="font-mono font-bold text-white">- R$ 59,00</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-900/90 px-3 py-2 text-xs border border-neutral-800/80">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span className="font-semibold text-neutral-200">Gasolina Posto</span>
                    <span className="text-[10px] text-sky-300 font-mono">Ele</span>
                  </div>
                  <span className="font-mono font-bold text-white">- R$ 150,00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Dores Resolvidas (Por que casais assinam) */}
      <section className="border-t border-neutral-900 bg-[#0F0F0F] py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Por que funciona na vida real
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Construído para acabar com a pergunta: "Para onde foi o nosso dinheiro este mês?"
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950 p-6 space-y-3">
              <Users className="h-6 w-6 text-sky-400" />
              <h3 className="text-base font-bold text-white">
                Os dois veem tudo juntos
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Cada parceiro instala no seu celular e conecta com 1 código de convite. Quando um registra uma despesa ou renda extra, o painel do outro atualiza automaticamente.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950 p-6 space-y-3">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Projeção Honesta de Fim de Mês
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Diferente de apps comuns que só olham para trás, o motor separa a compra grande de mercado das "voltinhas" da semana e avisa no dia 15 se o mês vai fechar no azul.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950 p-6 space-y-3">
              <ShieldCheck className="h-6 w-6 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                Colchão de Emergência & Planilha
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Acompanhe o saldo investido em outras contas (CDB D+30, Tesouro) separado do giro do mês e, se quiser, espelhe cada centavo em uma planilha Google Sheets própria do casal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Planos & Assinatura Acessível */}
      <section id="planos-saas" className="border-t border-neutral-900 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="text-center max-w-xl mx-auto mb-10 space-y-3">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              1 Assinatura vale para os 2 celulares do casal
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Mais barato que um lanche. Economiza centenas todo mês.
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Comece com 7 dias de teste grátis completo. Sem fidelidade.
            </p>

            {/* Toggle Mensal vs Anual */}
            <div className="pt-2 inline-flex items-center rounded-xl border border-neutral-800 bg-neutral-900 p-1">
              <button
                type="button"
                onClick={() => setCicloPreco('anual')}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  cicloPreco === 'anual'
                    ? 'bg-emerald-400 text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Anual (25% OFF)
              </button>
              <button
                type="button"
                onClick={() => setCicloPreco('mensal')}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  cicloPreco === 'mensal'
                    ? 'bg-emerald-400 text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Mensal Flexível
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Plano Mensal */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Plano Casal Mensal</h3>
                  <span className="text-xs font-mono text-neutral-400">Sem fidelidade</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-white">R$ 19,90</span>
                  <span className="text-xs text-neutral-400">/mês para o casal</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Ideal para experimentar a rotina financeira a dois mês a mês.
                </p>

                <ul className="space-y-2.5 pt-2 text-xs text-neutral-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Acesso simultâneo nos 2 celulares (Ele + Ela)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Teclado rápido de 5 segundos + Desfazer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Gestão de Contas Fixas, Renda Extra e Colchão</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Fechamento mensal e histórico de meses</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onIniciarOnboarding('mensal')}
                className="mt-6 w-full rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 py-3.5 text-xs font-extrabold text-white transition-all active:scale-98"
              >
                Começar 7 Dias Grátis no Mensal
              </button>
            </div>

            {/* Plano Anual (Destaque) */}
            <div className="rounded-2xl border-2 border-emerald-500/80 bg-neutral-900 p-6 flex flex-col justify-between shadow-xl shadow-emerald-950/30">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Plano Casal Anual</h3>
                  <span className="rounded-md bg-emerald-400/15 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300 uppercase">
                    Mais Escolhido
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono text-emerald-400">R$ 14,90</span>
                  <span className="text-xs text-neutral-400">/mês (R$ 178,80/ano)</span>
                </div>
                <p className="text-xs text-neutral-300">
                  Economia de R$ 60 por ano para blindar o orçamento e construir a reserva da família.
                </p>

                <ul className="space-y-2.5 pt-2 text-xs text-neutral-200">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Tudo do plano Mensal + 2 celulares sincronizados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Sincronização Híbrida (Nuvem + Google Sheets próprio)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Conselheiro Inteligente + Simulador "E se eu comprar?"</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>7 dias grátis para testar sem compromisso</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onIniciarOnboarding('anual')}
                className="mt-6 w-full rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3.5 text-xs font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all active:scale-98"
              >
                Começar 7 Dias Grátis no Anual →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé enxuto */}
      <footer className="border-t border-neutral-900 py-8 text-center text-xs text-neutral-500">
        <div className="mx-auto max-w-5xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>RitmoCasal SaaS • Orçamento Doméstico Compartilhado</span>
          <button
            type="button"
            onClick={onVoltarPainelAtual}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Voltar ao Painel do Aplicativo →
          </button>
        </div>
      </footer>
    </div>
  );
};
