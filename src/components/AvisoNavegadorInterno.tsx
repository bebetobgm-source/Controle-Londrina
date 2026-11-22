import React, { useState } from 'react';
import { Copy, Check, ExternalLink, X, Smartphone } from 'lucide-react';

export type NavegadorInterno = 'instagram' | 'facebook' | 'whatsapp' | 'outro';

/** Detecta se a página foi aberta dentro do navegador embutido de um app (Instagram, Facebook, WhatsApp...). */
export function detectarNavegadorInterno(): NavegadorInterno | null {
  try {
    const ua = navigator.userAgent || '';
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook';
    if (/WhatsApp/i.test(ua)) return 'whatsapp';
    if (/\bLine\//.test(ua) || /; wv\)/.test(ua)) return 'outro';
  } catch {
    /* ignora */
  }
  return null;
}

function ehAndroid(): boolean {
  try {
    return /Android/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

const NOME_APP: Record<NavegadorInterno, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  outro: 'aplicativo',
};

interface Props {
  navegador: NavegadorInterno;
  onFechar: () => void;
}

/**
 * O Google bloqueia o login dentro dos navegadores embutidos (erro 403 disallowed_useragent).
 * Este aviso aparece quando a pessoa toca em "Começar 7 dias grátis" vindo de um anúncio
 * e ensina a abrir o site no Chrome/Safari, onde o login funciona.
 */
export const AvisoNavegadorInterno: React.FC<Props> = ({ navegador, onFechar }) => {
  const [copiado, setCopiado] = useState(false);
  const android = ehAndroid();
  const urlAtual = window.location.href;
  const nomeApp = NOME_APP[navegador];

  const abrirNoChrome = () => {
    const semProtocolo = urlAtual.replace(/^https?:\/\//, '');
    const fallback = encodeURIComponent(urlAtual);
    window.location.href = `intent://${semProtocolo}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(urlAtual);
    } catch {
      const campo = document.createElement('textarea');
      campo.value = urlAtual;
      document.body.appendChild(campo);
      campo.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignora */
      }
      document.body.removeChild(campo);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-navegador-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-neutral-900 p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400 shrink-0" />
            <h2 id="aviso-navegador-titulo" className="text-base font-extrabold text-white leading-snug">
              Falta só 1 passo para começar
            </h2>
          </div>
          <button type="button" onClick={onFechar} className="p-1 text-neutral-400 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-neutral-300 leading-relaxed">
          Você está vendo o site por dentro do <strong className="text-white">{nomeApp}</strong>, e aqui o Google não
          deixa fazer login. Abra no navegador do celular e toque de novo em{' '}
          <strong className="text-emerald-300">“Começar 7 dias grátis”</strong>. Leva 10 segundos.
        </p>

        {android ? (
          <button
            type="button"
            onClick={abrirNoChrome}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 py-3 text-sm font-extrabold text-neutral-950 transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir no Chrome
          </button>
        ) : (
          <ol className="space-y-2 rounded-xl bg-neutral-800/70 p-3 text-sm text-neutral-200">
            <li>
              <strong className="text-white">1.</strong> Toque nos <strong className="text-white">três pontinhos ⋯</strong> no canto
              superior direito da tela.
            </li>
            <li>
              <strong className="text-white">2.</strong> Escolha <strong className="text-white">“Abrir no navegador externo”</strong>{' '}
              (ou “Abrir no Safari”).
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={copiarLink}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 py-2.5 text-sm font-bold text-white transition-all"
        >
          {copiado ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          {copiado ? 'Link copiado! Cole no Chrome ou Safari' : 'Copiar link do site'}
        </button>

        {android && (
          <p className="text-[11px] text-neutral-500 text-center">
            Se o botão não abrir, toque nos três pontinhos ⋮ e escolha “Abrir no Chrome”.
          </p>
        )}
      </div>
    </div>
  );
};
