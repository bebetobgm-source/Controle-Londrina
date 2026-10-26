import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Users,
  Wallet,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  KeyRound,
  Copy,
  Check
} from 'lucide-react';
import { formatarMoeda } from '../services/engine';

interface Props {
  onConcluirOnboarding: (dados: {
    nomeFamilia: string;
    nomeParceiro1: string;
    nomeParceiro2: string;
    rendaLiquida: number;
    metaReservaMensal: number;
    metaColchaoTotal: number;
    saldoColchaoInicial: number;
    tetosCategorias: Record<string, number>;
    limparExemplos: boolean;
  }) => void;
  onVincularCodigoExistente: (codigo: string) => void;
  onCancelar: () => void;
}

export const OnboardingCasal: React.FC<Props> = ({
  onConcluirOnboarding,
  onVincularCodigoExistente,
  onCancelar
}) => {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [modoConvite, setModoConvite] = useState(false);
  const [codigoConviteInput, setCodigoConviteInput] = useState('');

  // Passo 1: Identidade do Casal
  const [nomeFamilia, setNomeFamilia] = useState('Nossa Família');
  const [nomeParceiro1, setNomeParceiro1] = useState('Marido');
  const [nomeParceiro2, setNomeParceiro2] = useState('Esposa');

  // Passo 2: Renda e Colchão
  const [rendaLiquida, setRendaLiquida] = useState('6500');
  const [metaReservaMensal, setMetaReservaMensal] = useState('300');
  const [metaColchaoTotal, setMetaColchaoTotal] = useState('6000');
  const [saldoColchaoInicial, setSaldoColchaoInicial] = useState('2000');

  // Passo 3: Tetos de Gastos Variáveis
  const [tetos, setTetos] = useState<Record<string, number>>({
    'Mercado': 1200,
    'Alimentação Fora': 300,
    'Combustível': 350,
    'Farmácia e Saúde': 200,
    'Lazer': 200
  });
  const [limparExemplos, setLimparExemplos] = useState(true);

  const rendaNum = parseFloat(rendaLiquida.replace(',', '.')) || 0;
  const totalTetosVariaveis = (Object.values(tetos) as number[]).reduce((a, b) => a + b, 0);

  const handleSugerirTetosAutomaticos = () => {
    // Sugestão inteligente de ~32% da renda líquida para variáveis do dia a dia
    const verbaVariavel = Math.max(800, Math.round(rendaNum * 0.32));
    setTetos({
      'Mercado': Math.round(verbaVariavel * 0.50),
      'Alimentação Fora': Math.round(verbaVariavel * 0.14),
      'Combustível': Math.round(verbaVariavel * 0.16),
      'Farmácia e Saúde': Math.round(verbaVariavel * 0.10),
      'Lazer': Math.round(verbaVariavel * 0.10)
    });
  };

  const handleFinalizar = (e: React.FormEvent) => {
    e.preventDefault();
    onConcluirOnboarding({
      nomeFamilia: nomeFamilia.trim() || 'Nossa Família',
      nomeParceiro1: nomeParceiro1.trim() || 'Ele',
      nomeParceiro2: nomeParceiro2.trim() || 'Ela',
      rendaLiquida: parseFloat(rendaLiquida.replace(',', '.')) || 6500,
      metaReservaMensal: parseFloat(metaReservaMensal.replace(',', '.')) || 200,
      metaColchaoTotal: parseFloat(metaColchaoTotal.replace(',', '.')) || 4600,
      saldoColchaoInicial: parseFloat(saldoColchaoInicial.replace(',', '.')) || 0,
      tetosCategorias: tetos,
      limparExemplos
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl space-y-6">
        {/* Cabeçalho com progresso */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block">
              Configuração em 60 segundos • Passo {passo} de 3
            </span>
            <h2 className="text-lg font-extrabold text-white">
              {passo === 1 && 'Quem faz parte do casal?'}
              {passo === 2 && 'Renda e Meta do Colchão'}
              {passo === 3 && 'Limites Mensais de Gastos'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="text-xs font-semibold text-neutral-400 hover:text-white"
          >
            Voltar
          </button>
        </div>

        {/* Barra de Progresso */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n <= passo ? 'bg-emerald-400' : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>

        {passo === 1 && (
          <div className="space-y-4 animate-in fade-in">
            {/* Alternador: Criar Nova Conta vs Entrar com Código do Par */}
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-950 p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setModoConvite(false)}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  !modoConvite
                    ? 'bg-neutral-800 text-white shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Criar Conta do Casal
              </button>
              <button
                type="button"
                onClick={() => setModoConvite(true)}
                className={`rounded-lg py-2 text-xs font-bold transition-all ${
                  modoConvite
                    ? 'bg-sky-500 text-neutral-950 font-extrabold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Já tenho Código
              </button>
            </div>

            {modoConvite ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 text-xs text-sky-200 leading-relaxed">
                  Seu marido ou esposa já configurou o aplicativo? Digite abaixo o código <strong>CASAL-XXXX</strong> que você recebeu para conectar seu celular imediatamente:
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                    Código de Convite do Casal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: CASAL-8492"
                    value={codigoConviteInput}
                    onChange={e => setCodigoConviteInput(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-base font-mono font-bold uppercase text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={!codigoConviteInput.trim()}
                  onClick={() => onVincularCodigoExistente(codigoConviteInput.trim().toUpperCase())}
                  className="w-full rounded-xl bg-sky-400 hover:bg-sky-300 disabled:opacity-40 py-3.5 text-sm font-extrabold text-neutral-950 transition-all"
                >
                  Vincular Celular ao Casal →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                    Nome da Casa / Família
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Família Silva, Casa João & Maria"
                    value={nomeFamilia}
                    onChange={e => setNomeFamilia(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-sky-400 uppercase block mb-1">
                      Seu Nome (Parceiro 1)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Lucas"
                      value={nomeParceiro1}
                      onChange={e => setNomeParceiro1(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-purple-400 uppercase block mb-1">
                      Nome do Par (Parceiro 2)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Camila"
                      value={nomeParceiro2}
                      onChange={e => setNomeParceiro2(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-white focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400">
                  Estes nomes aparecerão nos botões de lançamento rápido para vocês saberem quem registrou cada compra.
                </p>

                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3.5 text-sm font-extrabold text-neutral-950 transition-all"
                >
                  <span>Próximo: Renda e Colchão</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {passo === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                Renda Líquida Mensal Somada do Casal (R$)
              </label>
              <input
                type="number"
                step="50"
                min="500"
                value={rendaLiquida}
                onChange={e => setRendaLiquida(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2.5 text-base font-mono font-bold text-emerald-400 focus:border-emerald-400 focus:outline-none"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Salários líquidos somados (você poderá lançar rendas extras separadamente a qualquer momento).
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                  Guardar por Mês (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={metaReservaMensal}
                  onChange={e => setMetaReservaMensal(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-300 uppercase block mb-1">
                  Meta do Colchão (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  min="500"
                  value={metaColchaoTotal}
                  onChange={e => setMetaColchaoTotal(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-mono text-white focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-sky-400 uppercase block mb-1">
                Já possuem algum valor guardado hoje? (CDB, Poupança...)
              </label>
              <input
                type="number"
                step="100"
                min="0"
                value={saldoColchaoInicial}
                onChange={e => setSaldoColchaoInicial(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm font-mono text-sky-300 focus:border-sky-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasso(1)}
                className="flex items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-bold text-neutral-300 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSugerirTetosAutomaticos();
                  setPasso(3);
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3 text-sm font-extrabold text-neutral-950 transition-all"
              >
                <span>Próximo: Definir Limites</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {passo === 3 && (
          <form onSubmit={handleFinalizar} className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400">
                Total Variável Planejado: <strong className="font-mono text-white">{formatarMoeda(totalTetosVariaveis)}</strong>
              </span>
              <button
                type="button"
                onClick={handleSugerirTetosAutomaticos}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline"
              >
                <Sparkles className="h-3 w-3" />
                <span>Recalcular sugestão</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {(Object.entries(tetos) as [string, number][]).map(([categoria, valor]) => (
                <div
                  key={categoria}
                  className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2"
                >
                  <span className="text-xs font-semibold text-neutral-200">{categoria}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-neutral-500">R$</span>
                    <input
                      type="number"
                      step="25"
                      min="0"
                      value={valor}
                      onChange={e =>
                        setTetos(prev => ({
                          ...prev,
                          [categoria]: Math.max(0, parseFloat(e.target.value) || 0)
                        }))
                      }
                      className="w-24 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-right text-sm font-mono font-bold text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={limparExemplos}
                onChange={e => setLimparExemplos(e.target.checked)}
                className="rounded accent-emerald-400 h-4 w-4"
              />
              <span>Começar com painel limpo (sem gastos de demonstração)</span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPasso(2)}
                className="flex items-center justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs font-bold text-neutral-300 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar</span>
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3.5 text-sm font-extrabold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Criar Painel do Casal</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
