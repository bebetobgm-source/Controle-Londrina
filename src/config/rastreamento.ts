// Meta Pixel (conjunto de dados "Casal no Azul - Site", portfólio Casal no Azul | Finanças do casal)
export const META_PIXEL_ID = '1496944645689948';

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

let ativo = false;

function modoSemRastreamento(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('vitrine') === '1' || params.get('dev') === '1';
}

/** Carrega o script padrão do Meta Pixel e registra o PageView. Não roda em ?vitrine=1 nem ?dev=1. */
export function iniciarPixel(): void {
  if (ativo || typeof window === 'undefined' || !META_PIXEL_ID || modoSemRastreamento()) return;
  if (!window.fbq) {
    const fbq: FbqFn = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as FbqFn;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
  ativo = true;
}

function rastrear(evento: string, dados?: Record<string, unknown>): void {
  if (!ativo || !window.fbq) return;
  try {
    if (dados) window.fbq('track', evento, dados);
    else window.fbq('track', evento);
  } catch {
    /* rastreamento nunca pode quebrar o app */
  }
}

/** Clique em "Começar 7 dias grátis" (ou nos botões de plano) na página de vendas. */
export function rastrearLead(): void {
  rastrear('Lead');
}

/** Família criada no onboarding = início do teste grátis. Dispara uma única vez por família. */
export function rastrearInicioTeste(familyId: string): void {
  const chave = `cna_pixel_registro_${familyId}`;
  try {
    if (localStorage.getItem(chave)) return;
    localStorage.setItem(chave, '1');
  } catch {
    /* sem localStorage: ainda assim dispara */
  }
  rastrear('CompleteRegistration', { content_name: 'Teste grátis 7 dias' });
}

/** Clique para ir ao checkout da Kiwify. */
export function rastrearCheckout(plano: 'mensal' | 'anual'): void {
  rastrear('InitiateCheckout', {
    value: plano === 'anual' ? 178.8 : 19.9,
    currency: 'BRL',
    content_name: plano === 'anual' ? 'Plano Anual' : 'Plano Mensal',
  });
}
