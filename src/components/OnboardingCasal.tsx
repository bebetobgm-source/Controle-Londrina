import React, { useMemo, useState } from 'react';
import { ArrowRight, Link2, Wallet } from 'lucide-react';
import { formatarMoeda } from '../services/engine';

export interface DadosOnboardingCasal {
  nomeFamilia: string;
  nomeParceiro1: string;
  nomeParceiro2: string;
  rendaLiquida: number;
  metaReservaMensal: number;
  metaColchaoTotal: number;
  saldoColchaoInicial: number;
  tetosCategorias: Record<string, number>;
  limparExemplos: boolean;
  /** Total aproximado das contas fixas do mês (opcional). Vira uma conta fixa editável depois. */
  contasFixasTotal?: number;
}

interface Props {
  nomeUsuarioGoogle?: string;
  salvando?: boolean;
  onConcluirOnboarding: (dados: DadosOnboardingCasal) => void;
  onUsarTokenConvite?: (tokenOuLink: string) => void;
  onCancelar?: () => void;
}

const numero = (valor: string): number => {
  let bruto = valor.replace(/[^\d,.]/g, '');
  // "4000.50" (ponto como decimal) → trata como decimal; "4.000" ou "6.500,00" → ponto é milhar
  if (!bruto.includes(',') && /^\d+\.\d{1,2}$/.test(bruto)) bruto = bruto.replace('.', ',');
  const limpo = bruto.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const arredondar = (valor: number, passo = 50) => Math.max(0, Math.round(valor / passo) * passo);

/** Divide a verba variável do mês entre as categorias principais (o casal ajusta depois, se quiser). */
function sugerirTetos(verbaVariavel: number): Record<string, number> {
  const v = Math.max(500, verbaVariavel);
  return {
    'Mercado': arredondar(v * 0.5, 25),
    'Alimentação Fora': arredondar(v * 0.14, 25),
    'Combustível': arredondar(v * 0.16, 25),
    'Farmácia e Saúde': arredondar(v * 0.1, 25),
    'Lazer': arredondar(v * 0.1, 25)
  };
}

/**
 * Configuração inicial em UMA tela: nome, nome do par (opcional), renda e contas fixas (opcional).
 * O resto (limites por categoria, reserva, colchão) é preenchido com sugestões automáticas
 * e pode ser ajustado depois dentro do app.
 */
export const OnboardingCasal: React.FC<Props> = ({
  nomeUsuarioGoogle,
  salvando = false,
  onConcluirOnboarding,
  onUsarTokenConvite,
  onCancelar
}) => {
  const [modoConvite, setModoConvite] = useState(false);
  const [linkOuTokenInput, setLinkOuTokenInput] = useState('');

  const [nome, setNome] = useState(nomeUsuarioGoogle ? nomeUsuarioGoogle.split(' ')[0] : '');
  const [nomePar, setNomePar] = useState('');
  const [renda, setRenda] = useState('');
  const [fixas, setFixas] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const rendaNum = numero(renda);
  const fixasNum = numero(fixas);
  const reservaSugerida = arredondar(rendaNum * 0.05);

  const previaPorDia = useMemo(() => {
    if (!rendaNum || !fixasNum) return null;
    const livre = rendaNum - fixasNum - reservaSugerida;
    return livre > 0 ? livre / 30 : 0;
  }, [rendaNum, fixasNum, reservaSugerida]);

  const extrairTokenDeLink = (valor: string): string => {
    const limpo = valor.trim();
    try {
      if (limpo.includes('convite=')) {
        const url = new URL(limpo.startsWith('http') ? limpo : `https://app.local/${limpo}`);
        return url.searchParams.get('convite') || limpo;
      }
    } catch {
      const match = limpo.match(/convite=([A-Za-z0-9]+)/);
      if (match) return match[1];
    }
    return limpo;
  };

  const handleComecar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rendaNum) {
      setErro('Informe a renda do casal no mês (pode ser um valor aproximado).');
      return;
    }
    if (fixasNum >= rendaNum) {
      setErro('As contas fixas ficaram maiores que a renda. Confira os valores.');
      return;
    }
    setErro(null);

    const nome1 = nome.trim() || 'Eu';
    const nome2 = nomePar.trim();
    const verbaVariavel = fixasNum > 0 ? (rendaNum - fixasNum - reservaSugerida) * 0.85 : rendaNum * 0.32;

    onConcluirOnboarding({
      nomeFamilia: nome2 ? `${nome1} & ${nome2}` : `Casa de ${nome1}`,
      nomeParceiro1: nome1,
      nomeParceiro2: nome2 || 'Meu par',
      rendaLiquida: rendaNum,
      metaReservaMensal: reservaSugerida,
      metaColchaoTotal: Math.max(1000, arredondar(rendaNum, 100)),
      saldoColchaoInicial: 0,
      tetosCategorias: sugerirTetos(verbaVariavel),
      limparExemplos: true,
      contasFixasTotal: fixasNum > 0 ? fixasNum : undefined
    });
  };

  const campo =
    'w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-3 text-base text-white placeholder:text-neutral-600 focus:border-emerald-400 focus:outline-none';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-emerald-400">Falta só isso para começar</span>
            <h2 className="mt-1 text-xl font-extrabold text-white leading-snug">
              {modoConvite ? 'Entrar na conta do seu par' : 'Conte o básico do mês de vocês'}
            </h2>
          </div>
          {onCancelar && (
            <button type="button" onClick={onCancelar} className="text-xs font-semibold text-neutral-400 hover:text-white">
              Voltar
            </button>
          )}
        </div>

        {modoConvite && onUsarTokenConvite ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 text-sm text-sky-200 leading-relaxed flex items-start gap-2.5">
              <Link2 className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <span>Cole aqui o link de convite que seu par mandou pelo WhatsApp.</span>
            </div>
            <input
              type="text"
              placeholder="https://casalnoazul.com.br/?convite=..."
              value={linkOuTokenInput}
              onChange={e => setLinkOuTokenInput(e.target.value)}
              className={`${campo} text-sm font-mono`}
            />
            <button
              type="button"
              disabled={!linkOuTokenInput.trim()}
              onClick={() => onUsarTokenConvite(extrairTokenDeLink(linkOuTokenInput))}
              className="w-full rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-40 py-3.5 text-sm font-extrabold text-neutral-950 transition-all"
            >
              Entrar com o convite
            </button>
            <button
              type="button"
              onClick={() => setModoConvite(false)}
              className="w-full text-xs font-semibold text-neutral-400 hover:text-white"
            >
              Não recebi convite, quero começar do zero
            </button>
          </div>
        ) : (
          <form onSubmit={handleComecar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onb-nome" className="text-xs font-semibold text-neutral-300 block mb-1">Seu nome</label>
                <input id="onb-nome" type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Lucas" className={campo} autoComplete="given-name" />
              </div>
              <div>
                <label htmlFor="onb-par" className="text-xs font-semibold text-neutral-300 block mb-1">
                  Seu par <span className="text-neutral-500 font-normal">(opcional)</span>
                </label>
                <input id="onb-par" type="text" value={nomePar} onChange={e => setNomePar(e.target.value)} placeholder="Ex: Camila" className={campo} />
              </div>
            </div>

            <div>
              <label htmlFor="onb-renda" className="text-xs font-semibold text-neutral-300 block mb-1">
                Quanto entra por mês, somando os dois?
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500">R$</span>
                <input
                  id="onb-renda"
                  type="text"
                  inputMode="decimal"
                  value={renda}
                  onChange={e => setRenda(e.target.value)}
                  placeholder="6.500"
                  className={`${campo} pl-10 font-mono font-bold text-emerald-300`}
                  autoFocus
                />
              </div>
              <span className="text-[11px] text-neutral-500 mt-1 block">Salários líquidos. Pode ser aproximado.</span>
            </div>

            <div>
              <label htmlFor="onb-fixas" className="text-xs font-semibold text-neutral-300 block mb-1">
                Contas fixas do mês, somadas <span className="text-neutral-500 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-neutral-500">R$</span>
                <input
                  id="onb-fixas"
                  type="text"
                  inputMode="decimal"
                  value={fixas}
                  onChange={e => setFixas(e.target.value)}
                  placeholder="4.000"
                  className={`${campo} pl-10 font-mono`}
                />
              </div>
              <span className="text-[11px] text-neutral-500 mt-1 block">Aluguel, luz, água, internet, parcelas… Depois dá para detalhar uma por uma.</span>
            </div>

            {previaPorDia !== null && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3.5 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-emerald-400 shrink-0" />
                <p className="text-sm text-emerald-100 leading-snug">
                  Vocês poderão gastar cerca de{' '}
                  <strong className="font-mono text-emerald-300">{formatarMoeda(previaPorDia)}</strong> por dia,
                  já guardando {formatarMoeda(reservaSugerida)} no mês.
                </p>
              </div>
            )}

            {erro && <p className="text-sm text-rose-300">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 py-4 text-base font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span>{salvando ? 'Preparando o app de vocês…' : 'Começar a usar'}</span>
              {!salvando && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="text-[11px] text-neutral-500 text-center">
              Limites por categoria e reserva são sugeridos automaticamente. Vocês ajustam quando quiserem.
            </p>

            {onUsarTokenConvite && (
              <button
                type="button"
                onClick={() => setModoConvite(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-sky-300 hover:text-sky-200"
              >
                <Link2 className="h-4 w-4" />
                Recebi um link de convite do meu par
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
