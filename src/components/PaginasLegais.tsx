import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const EMAIL_CONTATO_LEGAL = 'bebeto.bgm@gmail.com';
const ULTIMA_ATUALIZACAO = '2026';

interface Props {
  tipo: 'termos' | 'privacidade';
  onVoltar: () => void;
  onAlternarTipo: (novoTipo: 'termos' | 'privacidade') => void;
}

export const PaginasLegais: React.FC<Props> = ({
  tipo,
  onVoltar,
  onAlternarTipo
}) => {
  const ehTermos = tipo === 'termos';

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-100 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-900 bg-[#0A0A0A]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-6 px-5 py-4">
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              onVoltar();
            }}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Casal no Azul
          </a>

          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 px-3.5 py-2 text-xs font-semibold text-neutral-200 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Voltar</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
        <div className="mb-10 border-b border-neutral-900 pb-8">
          <p className="text-xs text-neutral-400">
            Casal no Azul · Atualizado em {ULTIMA_ATUALIZACAO}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {ehTermos ? 'Termos de Uso' : 'Política de Privacidade'}
          </h1>
          <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
            {ehTermos
              ? 'Condições gerais para o uso do aplicativo de orçamento compartilhado Casal no Azul.'
              : 'Como coletamos, armazenamos e protegemos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).'}
          </p>
        </div>

        {ehTermos ? (
          <article className="space-y-8 text-sm sm:text-[15px] text-neutral-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">1. Objeto do serviço</h2>
              <p>
                O <strong>Casal no Azul</strong> é um aplicativo web de controle de orçamento doméstico criado para ajudar casais a registrar despesas, acompanhar contas fixas, organizar a reserva de emergência e visualizar quanto podem gastar por dia sem ultrapassar o planejamento mensal.
              </p>
              <p>
                O aplicativo tem caráter exclusivamente informativo e de organização pessoal. Ele não constitui consultoria financeira, contábil, jurídica ou recomendação de investimentos, nem realiza movimentações bancárias.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">2. Cadastro e conta familiar</h2>
              <p>
                O acesso é realizado por meio de autenticação com conta Google. Cada conta familiar comporta até 2 (dois) membros conectados, vinculados mediante link de convite gerado pelo titular.
              </p>
              <p>
                Você é responsável pela veracidade das informações inseridas e pela guarda dos dispositivos conectados à sua conta.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">3. Teste gratuito, planos e cobrança</h2>
              <p>
                Novas famílias recebem um período de teste gratuito de 7 (sete) dias, sem exigência de cartão de crédito. Ao término do teste, para continuar utilizando o aplicativo, é necessário contratar um dos planos disponíveis (Mensal ou Anual).
              </p>
              <p>
                Uma única assinatura cobre os dois celulares vinculados à mesma família. Os pagamentos são processados de forma segura pela plataforma Kiwify. O aplicativo nunca solicita nem armazena senhas bancárias ou dados de cartão de crédito.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">4. Cancelamento e retenção de dados</h2>
              <p>
                Você pode cancelar a assinatura a qualquer momento pelo link &ldquo;Gerenciar assinatura&rdquo; presente no e-mail de confirmação enviado pela Kiwify. Após o cancelamento, o acesso permanece ativo até o final do período já pago.
              </p>
              <p>
                Caso o teste termine ou a assinatura não seja renovada, seus dados não são apagados automaticamente: você continua podendo exportar seus lançamentos em formato CSV (compatível com Excel) ou solicitar a exclusão definitiva pelo e-mail de contato.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">5. Disponibilidade e limitações</h2>
              <p>
                Empregamos boas práticas para manter o aplicativo disponível e seguro. Ainda assim, podem ocorrer interrupções temporárias para manutenção técnica ou falhas em serviços de terceiros (como provedores de internet, autenticação ou pagamento).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">6. Contato e foro</h2>
              <p>
                Dúvidas, solicitações de suporte ou pedidos relacionados a estes Termos podem ser enviados para{' '}
                <a
                  href={`mailto:${EMAIL_CONTATO_LEGAL}`}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  {EMAIL_CONTATO_LEGAL}
                </a>
                . Estes Termos são regidos pelas leis da República Federativa do Brasil.
              </p>
            </section>
          </article>
        ) : (
          <article className="space-y-8 text-sm sm:text-[15px] text-neutral-300 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">1. Controlador e compromisso com a LGPD</h2>
              <p>
                O <strong>Casal no Azul</strong> trata os dados pessoais dos usuários em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD). Para qualquer assunto relacionado à privacidade ou ao exercício dos seus direitos como titular, entre em contato pelo e-mail{' '}
                <a
                  href={`mailto:${EMAIL_CONTATO_LEGAL}`}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  {EMAIL_CONTATO_LEGAL}
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">2. Quais dados coletamos</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Dados de autenticação:</strong> nome, endereço de e-mail e identificador fornecidos pelo login com o Google.
                </li>
                <li>
                  <strong>Dados do orçamento familiar:</strong> nomes configurados para o casal, renda mensal informada, contas fixas, lançamentos de despesas, rendas extras, metas e registros da reserva de emergência inseridos voluntariamente por vocês.
                </li>
                <li>
                  <strong>Dados de assinatura:</strong> status da assinatura, plano contratado, datas de vigência e identificador do pedido repassados pela Kiwify para liberação do acesso.
                </li>
              </ul>
              <p>
                <strong>O que não coletamos:</strong> não pedimos nem armazenamos senhas bancárias, extratos bancários automáticos ou números de cartão de crédito.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">3. Finalidade e base legal</h2>
              <p>
                Utilizamos seus dados estritamente para: (a) autenticar sua conta e sincronizar o orçamento entre os dois membros da família (execução de contrato — art. 7º, V, LGPD); (b) gerenciar o período de teste e a assinatura ativa; e (c) prestar suporte técnico quando solicitado.
              </p>
              <p>
                Não vendemos, alugamos nem compartilhamos seus dados financeiros pessoais com terceiros para fins publicitários.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">4. Armazenamento e segurança</h2>
              <p>
                Os dados são armazenados em servidores do Google com criptografia em trânsito (HTTPS) e regras de acesso restritas para que somente os dois membros vinculados à família tenham acesso às informações da conta.
              </p>
              <p>
                O processamento de pagamentos é feito pela Kiwify, segundo a política de privacidade própria da plataforma.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">5. Seus direitos como titular (art. 18 da LGPD)</h2>
              <p>
                A qualquer momento, você pode:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Acessar e exportar seus lançamentos diretamente pelo aplicativo em arquivo CSV (Excel);</li>
                <li>Corrigir dados incompletos ou desatualizados nas configurações do aplicativo;</li>
                <li>Solicitar a confirmação do tratamento ou a exclusão definitiva da sua conta e de todos os dados da família pelo e-mail{' '}
                  <a
                    href={`mailto:${EMAIL_CONTATO_LEGAL}`}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    {EMAIL_CONTATO_LEGAL}
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">6. Atualizações desta política</h2>
              <p>
                Esta Política de Privacidade pode ser atualizada periodicamente para refletir melhorias no serviço ou exigências legais. A versão vigente estará sempre disponível neste endereço.
              </p>
            </section>
          </article>
        )}

        <div className="mt-12 pt-8 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400">
          <span>Casal no Azul © 2026</span>
          <div className="flex items-center gap-5">
            <a
              href={ehTermos ? '/privacidade' : '/termos'}
              onClick={e => {
                e.preventDefault();
                onAlternarTipo(ehTermos ? 'privacidade' : 'termos');
              }}
              className="text-neutral-300 hover:text-white underline-offset-4 hover:underline"
            >
              {ehTermos ? 'Ler Política de Privacidade' : 'Ler Termos de Uso'}
            </a>
            <a
              href={`mailto:${EMAIL_CONTATO_LEGAL}`}
              className="text-emerald-400 hover:underline"
            >
              {EMAIL_CONTATO_LEGAL}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};
