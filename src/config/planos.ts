export const KIWIFY_CHECKOUT_MENSAL = 'COLE_AQUI';
export const KIWIFY_CHECKOUT_ANUAL = 'COLE_AQUI';
export const KIWIFY_AREA_CLIENTE = 'COLE_AQUI';

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
