import React, { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from 'lucide-react';

interface Passo {
  id: string;
  titulo: string;
  descricao: string;
  feito: boolean;
  opcional?: boolean;
  onAbrir: () => void;
}

interface Props {
  familyId: string;
  temLancamento: boolean;
  parConectado: boolean;
  fixasDetalhadas: boolean;
  onLancarGasto: () => void;
  onConvidarPar: () => void;
  onDetalharFixas: () => void;
}

const chaveOculto = (familyId: string) => `cna_primeiros_passos_ocultos_${familyId}`;

/**
 * Cartão de ativação mostrado no topo do app até o casal concluir os passos principais.
 * Não bloqueia nada: só aponta o caminho (lançar 1º gasto, convidar o par, detalhar contas fixas).
 */
export const PrimeirosPassos: React.FC<Props> = ({
  familyId,
  temLancamento,
  parConectado,
  fixasDetalhadas,
  onLancarGasto,
  onConvidarPar,
  onDetalharFixas
}) => {
  const [oculto, setOculto] = useState<boolean>(() => {
    try {
      return localStorage.getItem(chaveOculto(familyId)) === '1';
    } catch {
      return false;
    }
  });

  const passos: Passo[] = [
    {
      id: 'gasto',
      titulo: 'Lance seu primeiro gasto',
      descricao: 'Pode ser o café de hoje. Leva 5 segundos.',
      feito: temLancamento,
      onAbrir: onLancarGasto
    },
    {
      id: 'par',
      titulo: 'Convide seu par',
      descricao: 'Mande o link pelo WhatsApp e vejam os gastos um do outro na hora.',
      feito: parConectado,
      onAbrir: onConvidarPar
    },
    {
      id: 'fixas',
      titulo: 'Detalhe as contas fixas',
      descricao: 'Aluguel, luz, internet… deixa o número do dia mais certeiro.',
      feito: fixasDetalhadas,
      opcional: true,
      onAbrir: onDetalharFixas
    }
  ];

  const principaisFeitos = passos.filter(p => !p.opcional).every(p => p.feito);
  const concluidos = passos.filter(p => p.feito).length;

  if (oculto || (principaisFeitos && fixasDetalhadas)) return null;

  const ocultar = () => {
    try {
      localStorage.setItem(chaveOculto(familyId), '1');
    } catch {
      /* ignora */
    }
    setOculto(true);
  };

  return (
    <div id="card-primeiros-passos" className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
          <div>
            <h3 className="text-sm font-extrabold text-white">Primeiros passos</h3>
            <p className="text-[11px] text-emerald-200/80">{concluidos} de 3 concluídos</p>
          </div>
        </div>
        <button
          type="button"
          onClick={ocultar}
          className="p-1 text-neutral-500 hover:text-white"
          aria-label="Ocultar primeiros passos"
          title="Ocultar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(concluidos / 3) * 100}%` }} />
      </div>

      <ul className="mt-3 space-y-2">
        {passos.map(passo => (
          <li key={passo.id}>
            <button
              type="button"
              onClick={passo.onAbrir}
              disabled={passo.feito}
              className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                passo.feito
                  ? 'border-transparent bg-transparent opacity-60 cursor-default'
                  : 'border-neutral-800 bg-neutral-900/80 hover:border-emerald-500/50 active:scale-[0.99]'
              }`}
            >
              {passo.feito ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-neutral-500 shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold ${passo.feito ? 'text-neutral-400 line-through' : 'text-white'}`}>
                  {passo.titulo}
                  {passo.opcional && !passo.feito && <span className="ml-1.5 text-[10px] font-medium text-neutral-500">(opcional)</span>}
                </span>
                {!passo.feito && <span className="block text-[11px] text-neutral-400 leading-snug">{passo.descricao}</span>}
              </span>
              {!passo.feito && <ChevronRight className="h-4 w-4 text-emerald-400 shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
