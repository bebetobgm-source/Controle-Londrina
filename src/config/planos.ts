export const KIWIFY_CHECKOUT_MENSAL = 'https://pay.kiwify.com.br/eB08x0S';
export const KIWIFY_CHECKOUT_ANUAL = 'https://pay.kiwify.com.br/xXDFpbj';
export const KIWIFY_AREA_CLIENTE = 'mailto:bebeto.bgm@gmail.com?subject=Gerenciar%20assinatura%20Casal%20no%20Azul';

export function montarUrlCheckoutKiwify(
  plano: 'mensal' | 'anual',
  email?: string | null,
  familyId?: string | null
): string {
  const base = plano === 'anual' ? KIWIFY_CHECKOUT_ANUAL : KIWIFY_CHECKOUT_MENSAL;
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (familyId) params.set('src', familyId);
  const qs = params.toString();
  if (!qs) return base;
  const separador = base.includes('?') ? '&' : '?';
  return `${base}${separador}${qs}`;
}
