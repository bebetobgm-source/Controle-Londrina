import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Link2,
  MessageCircle,
  Smartphone
} from 'lucide-react';
import { formatarMoeda } from '../services/engine';

// ============================================================================
// CONSTANTES FÁCEIS DE EDITAR (copy do fundador, suporte e listas)
// ============================================================================

export const WHATSAPP_SUPORTE_NUMERO = '5543999559844';

export const HISTORIA_CRIADOR = {
  titulo: 'Por que eu criei',
  paragrafos: [
    'Eu criei o Casal no Azul para mim e minha esposa pararmos de chegar no fim do mês tentando adivinhar para onde o nosso dinheiro foi. A gente até tentou planilhas e aplicativos cheios de gráficos, mas no meio da correria ninguém abria para preencher.',
    'Precisávamos de algo que funcionasse na fila do mercado: um lança em cinco segundos, o outro já enxerga no celular, e a tela principal mostra direto quanto ainda podemos gastar por dia sem comprometer as contas fixas nem a nossa reserva.',
    'O que começou como uma ferramenta só da nossa casa virou rotina. Hoje usamos todo dia — e agora está disponível para outros casais que também querem paz com o dinheiro.'
  ],
  assinatura: 'Humberto Vinicius, Londrina-PR'
};

const PASSOS_COMO_FUNCIONA = [
  {
    numero: '1',
    titulo: 'Cadastre a renda e as contas fixas (2 minutos)',
    descricao:
      'Informe quanto entra no mês e quais são as contas fixas da casa. O aplicativo calcula na hora quanto sobra para o dia a dia.'
  },
  {
    numero: '2',
    titulo: 'Convide seu par por WhatsApp',
    descricao:
      'Toque para gerar o link de convite da família e envie no WhatsApp. Os dois celulares ficam ligados na mesma conta em segundos.'
  },
  {
    numero: '3',
    titulo: 'Lance cada gasto em 5 segundos',
    descricao:
      'Registre o valor na hora em que gastar e acompanhe, em tempo real, quanto o casal ainda pode gastar por dia até o fim do mês.'
  }
];

const BENEFICIOS = [
  {
    titulo: 'Os dois veem tudo, na hora',
    descricao:
      'Cada um entra com a própria conta do Google no seu celular. Quando um registra o mercado ou a farmácia, o saldo do mês atualiza imediatamente no aparelho do outro — sem precisar mandar mensagem perguntando quanto gastou.',
    imagem: '/screens/lancar.png',
    alt: 'Tela de lançamento rápido do Casal no Azul',
    placeholderTitulo: 'Lançamento rápido',
    placeholderSubtitulo: 'Registre qualquer gasto em 5 segundos'
  },
  {
    titulo: 'Aviso antes de estourar, não depois',
    descricao:
      'Em vez de mostrar um relatório triste no dia 30, o aplicativo acompanha o ritmo dos gastos dia após dia e sinaliza cedo se alguma categoria acelerou demais. Assim vocês ajustam a rota ainda no meio do mês.',
    imagem: '/screens/painel.png',
    alt: 'Painel mensal do Casal no Azul',
    placeholderTitulo: 'Painel do mês',
    placeholderSubtitulo: 'Quanto o casal pode gastar hoje'
  },
  {
    titulo: 'Reserva de emergência separada do dia a dia',
    descricao:
      'O dinheiro guardado para imprevistos fica visível em um espaço próprio, separado do dinheiro das compras do mês. Vocês veem o colchão crescendo e sabem exatamente quanto falta para atingir a meta da família.',
    imagem: '/screens/conselheiro.png',
    alt: 'Tela do conselheiro e reserva do Casal no Azul',
    placeholderTitulo: 'Conselheiro do casal',
    placeholderSubtitulo: 'Orientação clara e reserva protegida'
  }
];

const RECURSOS_PLANOS = [
  '2 celulares sincronizados',
  'Lançamento rápido',
  'Contas fixas',
  'Renda extra',
  'Reserva de emergência',
  'Conselheiro',
  'Simulador "e se eu comprar?"',
  'Exportação para Excel'
];

const PERGUNTAS_FREQUENTES = [
  {
    pergunta: 'Os dois precisam pagar?',
    resposta: 'Não, uma assinatura vale para o casal.'
  },
  {
    pergunta: 'Meus dados estão seguros?',
    resposta:
      'Ficam em servidores do Google, só vocês dois têm acesso, não pedimos senha de banco.'
  },
  {
    pergunta: 'Como cancelo?',
    resposta:
      'Pelo link "Gerenciar assinatura" do e-mail de compra da Kiwify, a qualquer momento; o acesso segue até o fim do período pago.'
  },
  {
    pergunta: 'Funciona no iPhone e no Android?',
    resposta: 'Sim, pelo navegador, e dá para adicionar à tela inicial.'
  },
  {
    pergunta: 'O que acontece depois dos 7 dias?',
    resposta:
      'O app pede para escolher um plano; seus dados ficam guardados e podem ser exportados.'
  }
];

// ============================================================================
// COMPONENTE DE MOLDURA DE CELULAR EM CSS COM PLACEHOLDER NEUTRO
// ============================================================================

interface MolduraCelularProps {
  src: string;
  alt: string;
  placeholderTitulo: string;
  placeholderSubtitulo: string;
  tamanho?: 'hero' | 'beneficio';
}

const MolduraCelular: React.FC<MolduraCelularProps> = ({
  src,
  alt,
  placeholderTitulo,
  placeholderSubtitulo,
  tamanho = 'beneficio'
}) => {
  const [falhouCarregar, setFalhouCarregar] = useState(false);
  const [carregou, setCarregou] = useState(false);

  const larguraClasse =
    tamanho === 'hero'
      ? 'w-[258px] sm:w-[276px]'
      : 'w-[228px] sm:w-[244px]';

  return (
    <div
      className={`relative mx-auto ${larguraClasse} rounded-[2.6rem] border-[6px] border-neutral-800 bg-neutral-950 p-2 shadow-2xl shadow-black/60`}
    >
      {/* Alto-falante / câmera superior do aparelho */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-4 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-950 border border-neutral-800/80"
      />

      {/* Tela do celular (proporção 9:19.5) */}
      <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[2rem] bg-neutral-900 border border-neutral-800/70">
        {!falhouCarregar && (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            onLoad={() => setCarregou(true)}
            onError={() => setFalhouCarregar(true)}
            className={`h-full w-full object-cover object-top transition-opacity duration-200 ${
              carregou ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {(falhouCarregar || !carregou) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-neutral-200">
              {placeholderTitulo}
            </p>
            <p className="mt-1.5 text-xs text-neutral-500 leading-relaxed">
              {placeholderSubtitulo}
            </p>
            <div className="mt-6 w-full space-y-2.5">
              <div className="h-2.5 w-3/4 mx-auto rounded bg-neutral-800" />
              <div className="h-14 w-full rounded-xl border border-neutral-800/80 bg-neutral-950/70" />
              <div className="h-9 w-full rounded-xl bg-neutral-800/60" />
              <div className="h-9 w-full rounded-xl bg-neutral-800/40" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PÁGINA DE VENDAS — CASAL NO AZUL
// ============================================================================

interface Props {
  onEntrarComGoogle: (planoEscolhido?: 'trial' | 'mensal' | 'anual') => void;
  onVoltarPainelAtual?: () => void;
  onAbrirTermos?: () => void;
  onAbrirPrivacidade?: () => void;
  estaLogado?: boolean;
  carregandoLogin?: boolean;
  erroLogin?: string | null;
  tokenConvitePendente?: string | null;
  nomeFamiliaAtual?: string;
}

export const LandingPageSaaS: React.FC<Props> = ({
  onEntrarComGoogle,
  onVoltarPainelAtual,
  onAbrirTermos,
  onAbrirPrivacidade,
  estaLogado = false,
  carregandoLogin = false,
  erroLogin = null,
  tokenConvitePendente = null,
  nomeFamiliaAtual
}) => {
  const [simulacaoRenda, setSimulacaoRenda] = useState<number>(6500);
  const [simulacaoFixas, setSimulacaoFixas] = useState<number>(4400);
  const [faqAberta, setFaqAberta] = useState<number | null>(0);

  const fixasLimitadas = Math.min(simulacaoFixas, Math.max(1500, simulacaoRenda - 500));
  const sobraVariavelSimulada = Math.max(0, simulacaoRenda - fixasLimitadas - 300);
  const metaDiariaSimulada = sobraVariavelSimulada / 30;

  const urlWhatsappSuporte = `https://wa.me/${WHATSAPP_SUPORTE_NUMERO}?text=${encodeURIComponent(
    'Olá! Tenho uma dúvida sobre o Casal no Azul.'
  )}`;

  const textoBotaoPrincipal = carregandoLogin
    ? 'Conectando...'
    : estaLogado
    ? 'Voltar ao painel'
    : 'Começar 7 dias grátis';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col selection:bg-emerald-500 selection:text-neutral-950">
      {/* Barra Superior — Contrato de 3 zonas limpas */}
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-[#0A0A0A]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-8 px-5 py-4">
          {/* Zona 1: Wordmark limpa */}
          <a
            href="#topo"
            className="text-base font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Casal no Azul
          </a>

          {/* Zona 2: Links de navegação concisos em linha única */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400"
          >
            <a
              href="#como-funciona"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Como funciona
            </a>
            <a
              href="#simulador"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Simulador
            </a>
            <a
              href="#planos"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Planos
            </a>
            <a
              href="#duvidas"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Dúvidas
            </a>
          </nav>

          {/* Zona 3: 1 ação principal */}
          <div className="flex items-center shrink-0">
            {estaLogado && onVoltarPainelAtual ? (
              <button
                type="button"
                onClick={onVoltarPainelAtual}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition-colors whitespace-nowrap shrink-0 max-w-[200px]"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {nomeFamiliaAtual || 'Meu painel'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={carregandoLogin}
                onClick={() => onEntrarComGoogle('trial')}
                className="rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 px-4 py-2 text-xs font-bold text-neutral-950 transition-colors whitespace-nowrap shrink-0"
              >
                {carregandoLogin ? 'Conectando...' : 'Entrar com Google'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="topo" className="flex-1">
        {/* a) HERO */}
        <section className="mx-auto max-w-5xl px-5 pt-12 pb-16 sm:pt-16 sm:pb-24">
          {tokenConvitePendente && (
            <div className="mb-10 rounded-2xl border border-sky-500/40 bg-sky-950/25 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Link2 className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Convite familiar recebido
                  </p>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    Entre com sua conta do Google para aceitar o convite e ligar seu celular ao orçamento do seu par.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={carregandoLogin}
                onClick={() => onEntrarComGoogle('trial')}
                className="shrink-0 rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-50 px-5 py-3 text-xs font-bold text-neutral-950 transition-colors whitespace-nowrap"
              >
                {carregandoLogin ? 'Conectando...' : 'Entrar e aceitar convite'}
              </button>
            </div>
          )}

          {erroLogin && (
            <div className="mb-8 rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs text-rose-200">
              {erroLogin}
            </div>
          )}

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-[clamp(2.15rem,4.2vw,3.5rem)] font-extrabold tracking-tight text-white leading-[1.08] [text-wrap:balance]">
                Saiba exatamente quanto o casal pode gastar hoje sem estourar o mês.
              </h1>

              <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-xl">
                Um lança o gasto no caixa do mercado, o outro vê na hora. E o app avisa antes de o mês estourar.
              </p>

              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  disabled={carregandoLogin}
                  onClick={() => onEntrarComGoogle('trial')}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 px-7 py-4 text-sm font-bold text-neutral-950 transition-colors whitespace-nowrap"
                >
                  <span>{textoBotaoPrincipal}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
                <p className="text-xs text-neutral-400">
                  Sem cartão de crédito. Entre com o Google em 10 segundos.
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <MolduraCelular
                src="/screens/painel.png"
                alt="Tela do painel principal do Casal no Azul"
                placeholderTitulo="Painel do mês"
                placeholderSubtitulo="Disponível por dia e ritmo dos gastos do casal"
                tamanho="hero"
              />
            </div>
          </div>
        </section>

        {/* b) COMO FUNCIONA (3 passos) */}
        <section
          id="como-funciona"
          className="border-t border-neutral-900 bg-neutral-950/60 py-16 sm:py-24"
        >
          <div className="mx-auto max-w-5xl px-5">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-medium text-emerald-400">
                Como funciona
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Em poucos minutos os dois celulares já estão no mesmo ritmo
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {PASSOS_COMO_FUNCIONA.map(passo => (
                <div
                  key={passo.numero}
                  className="border-t border-neutral-800 pt-6 space-y-3"
                >
                  <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    0{passo.numero}
                  </span>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {passo.titulo}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {passo.descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* c) SIMULADOR ("Descubra o número do seu casal") */}
        <section
          id="simulador"
          className="border-t border-neutral-900 py-16 sm:py-24"
        >
          <div className="mx-auto max-w-5xl px-5">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5 space-y-4">
                <p className="text-xs font-medium text-emerald-400">
                  Simulador ao vivo
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                  Descubra o número do seu casal
                </h2>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                  Arraste os valores abaixo para ver, na prática, quanto vocês teriam livre por dia para mercado, combustível e lazer — já separando R$ 300 por mês para a reserva de emergência.
                </p>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-neutral-800 bg-[#121212] p-6 sm:p-8 space-y-6">
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between gap-4 text-sm mb-2">
                        <label
                          htmlFor="simulador-renda"
                          className="text-neutral-300"
                        >
                          Renda líquida do casal (mês)
                        </label>
                        <strong className="font-mono font-bold text-white tabular-nums">
                          {formatarMoeda(simulacaoRenda)}
                        </strong>
                      </div>
                      <input
                        id="simulador-renda"
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
                      <div className="flex items-center justify-between gap-4 text-sm mb-2">
                        <label
                          htmlFor="simulador-fixas"
                          className="text-neutral-300"
                        >
                          Contas fixas (aluguel, luz, carro...)
                        </label>
                        <strong className="font-mono font-bold text-white tabular-nums">
                          {formatarMoeda(fixasLimitadas)}
                        </strong>
                      </div>
                      <input
                        id="simulador-fixas"
                        type="range"
                        min={1000}
                        max={Math.max(1500, simulacaoRenda - 500)}
                        step={100}
                        value={fixasLimitadas}
                        onChange={e => setSimulacaoFixas(Number(e.target.value))}
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="border-t border-neutral-800 pt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-neutral-400">
                        Disponível por dia (base de 30 dias)
                      </p>
                      <div className="mt-1 text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 tabular-nums">
                        {formatarMoeda(metaDiariaSimulada)}
                        <span className="text-sm font-normal text-neutral-400">
                          {' '}
                          /dia
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                      Para mercado, combustível e lazer, mantendo R$ 300/mês guardados na reserva de emergência.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* d) 3 BENEFÍCIOS EM LINGUAGEM SIMPLES COM TELAS EM MOLDURA DE CELULAR */}
        <section className="border-t border-neutral-900 bg-neutral-950/60 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-5 space-y-20">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-emerald-400">
                Feito para a rotina de verdade
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white [text-wrap:balance]">
                Simples o bastante para usar todo dia
              </h2>
            </div>

            <div className="space-y-20">
              {BENEFICIOS.map((beneficio, indice) => {
                const invertido = indice % 2 === 1;
                return (
                  <div
                    key={beneficio.titulo}
                    className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-center"
                  >
                    <div
                      className={`md:col-span-6 space-y-4 ${
                        invertido ? 'md:order-2' : 'md:order-1'
                      }`}
                    >
                      <span className="font-mono text-xs text-neutral-500 tabular-nums">
                        0{indice + 1} / 03
                      </span>
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white [text-wrap:balance]">
                        {beneficio.titulo}
                      </h3>
                      <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                        {beneficio.descricao}
                      </p>
                    </div>

                    <div
                      className={`md:col-span-6 flex justify-center ${
                        invertido ? 'md:order-1' : 'md:order-2'
                      }`}
                    >
                      <MolduraCelular
                        src={beneficio.imagem}
                        alt={beneficio.alt}
                        placeholderTitulo={beneficio.placeholderTitulo}
                        placeholderSubtitulo={beneficio.placeholderSubtitulo}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* e) POR QUE EU CRIEI */}
        <section className="border-t border-neutral-900 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-5">
            <p className="text-xs font-medium text-emerald-400">
              História real
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {HISTORIA_CRIADOR.titulo}
            </h2>

            <div className="mt-6 space-y-4 text-base text-neutral-300 leading-relaxed">
              {HISTORIA_CRIADOR.paragrafos.map((paragrafo, idx) => (
                <p key={idx}>{paragrafo}</p>
              ))}
            </div>

            <p className="mt-6 text-sm font-semibold text-white">
              — {HISTORIA_CRIADOR.assinatura}
            </p>
          </div>
        </section>

        {/* f) PLANOS */}
        <section
          id="planos"
          className="border-t border-neutral-900 bg-neutral-950/60 py-16 sm:py-24"
        >
          <div className="mx-auto max-w-4xl px-5">
            <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
              <p className="text-xs font-medium text-emerald-400">Planos</p>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                Uma assinatura, os dois celulares
              </h2>
              <p className="text-sm text-neutral-400">
                Todos os recursos liberados nos dois planos. Comece grátis por 7 dias sem cadastrar cartão.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Plano Mensal */}
              <div className="rounded-2xl border border-neutral-800 bg-[#121212] p-7 flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">Mensal</h3>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold font-mono text-white tabular-nums">
                        R$ 19,90
                      </span>
                      <span className="text-sm text-neutral-400">/mês</span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400">
                      Renovação mensal · Cancele quando quiser
                    </p>
                  </div>

                  <ul className="space-y-2.5 border-t border-neutral-800/80 pt-5 text-sm text-neutral-300">
                    {RECURSOS_PLANOS.map(recurso => (
                      <li key={recurso} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{recurso}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={carregandoLogin}
                  onClick={() => onEntrarComGoogle('mensal')}
                  className="mt-8 w-full rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 py-3.5 px-5 text-sm font-bold text-white transition-colors"
                >
                  {textoBotaoPrincipal}
                </button>
              </div>

              {/* Plano Anual */}
              <div className="rounded-2xl border border-emerald-500/60 bg-[#121212] p-7 flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">Anual</h3>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
                        R$ 178,80
                      </span>
                      <span className="text-sm text-neutral-400">/ano</span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-300">
                      Equivale a R$ 14,90/mês · Economize R$ 60
                    </p>
                  </div>

                  <ul className="space-y-2.5 border-t border-neutral-800/80 pt-5 text-sm text-neutral-300">
                    {RECURSOS_PLANOS.map(recurso => (
                      <li key={recurso} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{recurso}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={carregandoLogin}
                  onClick={() => onEntrarComGoogle('anual')}
                  className="mt-8 w-full rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 py-3.5 px-5 text-sm font-bold text-neutral-950 transition-colors"
                >
                  {textoBotaoPrincipal}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* g) PERGUNTAS FREQUENTES (ACORDEÃO) */}
        <section
          id="duvidas"
          className="border-t border-neutral-900 py-16 sm:py-24"
        >
          <div className="mx-auto max-w-3xl px-5">
            <div className="mb-10">
              <p className="text-xs font-medium text-emerald-400">
                Perguntas frequentes
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Tire suas dúvidas antes de começar
              </h2>
            </div>

            <div className="divide-y divide-neutral-800 border-y border-neutral-800">
              {PERGUNTAS_FREQUENTES.map((item, idx) => {
                const aberta = faqAberta === idx;
                return (
                  <div key={item.pergunta}>
                    <button
                      type="button"
                      aria-expanded={aberta}
                      onClick={() => setFaqAberta(aberta ? null : idx)}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left text-sm sm:text-base font-semibold text-white hover:text-emerald-300 transition-colors"
                    >
                      <span>{item.pergunta}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
                          aberta ? 'rotate-180 text-emerald-400' : ''
                        }`}
                      />
                    </button>
                    {aberta && (
                      <div className="pb-5 pr-8 text-sm text-neutral-400 leading-relaxed">
                        {item.resposta}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* h) CHAMADA FINAL */}
        <section className="border-t border-neutral-900 bg-neutral-950/60 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl px-5 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
              Comece hoje a ver o mês do casal com clareza
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
              Teste gratuitamente por 7 dias com o seu par. Sem cartão de crédito e sem burocracia.
            </p>
            <div className="pt-1 space-y-3">
              <button
                type="button"
                disabled={carregandoLogin}
                onClick={() => onEntrarComGoogle('trial')}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 px-8 py-4 text-sm font-bold text-neutral-950 transition-colors whitespace-nowrap"
              >
                <span>{textoBotaoPrincipal}</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
              <p className="text-xs text-neutral-400">
                Sem cartão de crédito. Entre com o Google em 10 segundos.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ */}
      <footer className="border-t border-neutral-900 py-10 text-xs text-neutral-400">
        <div className="mx-auto max-w-5xl px-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-semibold text-neutral-300">
              Casal no Azul © 2026
            </span>
            <span aria-hidden="true" className="text-neutral-700">
              ·
            </span>
            <a
              href="/termos"
              onClick={e => {
                if (onAbrirTermos) {
                  e.preventDefault();
                  onAbrirTermos();
                }
              }}
              className="hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Termos de Uso
            </a>
            <span aria-hidden="true" className="text-neutral-700">
              ·
            </span>
            <a
              href="/privacidade"
              onClick={e => {
                if (onAbrirPrivacidade) {
                  e.preventDefault();
                  onAbrirPrivacidade();
                }
              }}
              className="hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={urlWhatsappSuporte}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Falar no WhatsApp</span>
            </a>

            {estaLogado && onVoltarPainelAtual && (
              <button
                type="button"
                onClick={onVoltarPainelAtual}
                className="text-emerald-400 hover:underline font-semibold whitespace-nowrap"
              >
                Voltar ao painel
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
