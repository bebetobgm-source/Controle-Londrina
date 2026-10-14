import React, { useState } from 'react';
import { AppState, aplicarCenarioDia15, aplicarCenarioHigiene91, aplicarCenarioVoltinhasMercado, resetarParaDadosPadrao } from '../services/storage';
import { formatarMoeda, formatarDataBR } from '../services/engine';
import { Check, Copy, FileCode, Play, RotateCcw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { gasFiles } from '../data/gasCode';
import { GoogleSheetsConnectView } from './GoogleSheetsConnectView';

interface Props {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onAcessarPainel: () => void;
}

export const TestesECodigoView: React.FC<Props> = ({ appState, setAppState, onAcessarPainel }) => {
  const [subAba, setSubAba] = useState<'sheets' | 'testes' | 'logs' | 'codigo'>('sheets');
  const [arquivoSelecionado, setArquivoSelecionado] = useState<string>('Inicializar.gs');
  const [copiado, setCopiado] = useState<boolean>(false);
  const [msgSucessoCenario, setMsgSucessoCenario] = useState<string | null>(null);

  const arquivosCodigo = gasFiles;

  const handleCopiar = () => {
    const texto = arquivosCodigo[arquivoSelecionado];
    if (texto) {
      navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const dispararCenario = (tipo: 'dia15' | 'higiene' | 'voltinhas' | 'reset') => {
    if (tipo === 'dia15') {
      const novo = aplicarCenarioDia15(appState);
      setAppState(novo);
      setMsgSucessoCenario('Cenário Dia 15 Duplo Desvio aplicado! Verifique o Alerta e o Painel do Mês.');
    } else if (tipo === 'higiene') {
      const { estadoAtualizado } = aplicarCenarioHigiene91(appState);
      setAppState(estadoAtualizado);
      setMsgSucessoCenario('Lançamento de R$ 91,88 em Higiene registrado! Verifique o alerta de gasto fora da curva.');
    } else if (tipo === 'voltinhas') {
      const novo = aplicarCenarioVoltinhasMercado(appState);
      setAppState(novo);
      setMsgSucessoCenario('5 compras de Mercado registradas no ciclo! Alerta de voltinhas ao mercado ativado.');
    } else if (tipo === 'reset') {
      const novo = resetarParaDadosPadrao();
      setAppState(novo);
      setMsgSucessoCenario('Dados restaurados para o padrão de Londrina (R$ 6.500 renda, R$ 2.000 colchão).');
    }

    setTimeout(() => {
      setMsgSucessoCenario(null);
    }, 4500);
  };

  return (
    <div id="testes-e-codigo-container" className="flex flex-col gap-4 pb-28 pt-2">
      {/* Navegação Secundária */}
      <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/80 p-1">
        <button
          type="button"
          onClick={() => setSubAba('sheets')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            subAba === 'sheets' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Google Sheets</span>
        </button>
        <button
          type="button"
          onClick={() => setSubAba('testes')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            subAba === 'testes' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Cenários
        </button>
        <button
          type="button"
          onClick={() => setSubAba('logs')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            subAba === 'logs' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Logs ({appState.alertasLog.length})
        </button>
        <button
          type="button"
          onClick={() => setSubAba('codigo')}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
            subAba === 'codigo' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Scripts
        </button>
      </div>

      {/* SUB-ABA 0: CONEXÃO 100% AUTOMÁTICA GOOGLE SHEETS */}
      {subAba === 'sheets' && (
        <GoogleSheetsConnectView
          appState={appState}
          setAppState={setAppState}
        />
      )}

      {msgSucessoCenario && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-300 animate-in fade-in">
          {msgSucessoCenario}
        </div>
      )}

      {/* SUB-ABA 1: CENÁRIOS DE TESTE DOS CRITÉRIOS DE ACEITAÇÃO */}
      {subAba === 'testes' && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg space-y-4">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
              Validação dos Critérios de Aceitação
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Clique em qualquer botão abaixo para reproduzir instantaneamente os cenários exigidos no prompt:
            </p>
          </div>

          <div className="space-y-3">
            {/* Teste 1: Dia 15 Duplo Desvio */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">1. Alerta Vermelho de Duplo Desvio (Dia 15)</span>
                <button
                  type="button"
                  onClick={() => dispararCenario('dia15')}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-neutral-100"
                >
                  <Play className="h-3 w-3" />
                  Simular Dia 15
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Simula dia 15 com 70% do variável consumido (R$ 1.225 de R$ 1.750) e reserva zerada. Dispara a frase completa com déficit previsto e nova diária necessária.
              </p>
            </div>

            {/* Teste 2: Gasto Fora da Curva R$ 91,88 Higiene */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">2. Gasto Fora da Curva (R$ 91,88 Higiene)</span>
                <button
                  type="button"
                  onClick={() => dispararCenario('higiene')}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-neutral-100"
                >
                  <Play className="h-3 w-3" />
                  Lançar R$ 91,88
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Lança R$ 91,88 em Higiene (teto R$ 150). Dispara: "R$ 91,88 em Higiene. A média das últimas compras foi R$ 34. Este lançamento sozinho vale 61% do teto de higiene do mês."
              </p>
            </div>

            {/* Teste 3: 5ª ida ao mercado */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">3. Voltinhas ao Mercado (5ª compra no ciclo)</span>
                <button
                  type="button"
                  onClick={() => dispararCenario('voltinhas')}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-950 hover:bg-neutral-100"
                >
                  <Play className="h-3 w-3" />
                  Testar 5ª Compra
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Registra 5 idas ao mercado. Dispara: "Esta é a 5ª ida ao mercado neste mês. As idas extras somam R$ X além da compra grande."
              </p>
            </div>

            {/* Restaurar Dados */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => dispararCenario('reset')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar dados padrão de Londrina (R$ 6.500 renda)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: ABA Alertas_Log */}
      {subAba === 'logs' && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
              Histórico da Aba Alertas_Log
            </span>
            <span className="text-xs text-neutral-500">Nunca sobrescreve, sempre acrescente</span>
          </div>

          {appState.alertasLog.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500">
              Nenhum alerta disparado ainda. Use os botões de teste para simular.
            </p>
          ) : (
            <div className="space-y-2.5">
              {appState.alertasLog.map(log => {
                const corBadge = {
                  'verde': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                  'amarelo': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                  'laranja': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
                  'vermelho': 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                }[log.severidade] || 'text-neutral-400 bg-neutral-800 border-neutral-700';

                return (
                  <div key={log.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${corBadge}`}>
                        {log.tipo} ({log.severidade})
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {log.data_hora.split('T')[0]} {log.data_hora.split('T')[1]?.substring(0, 5)}
                      </span>
                    </div>
                    <p className="text-neutral-200 font-medium leading-relaxed">{log.mensagem}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA 3: CÓDIGO GOOGLE APPS SCRIPT & LEIA-ME */}
      {subAba === 'codigo' && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-neutral-300 uppercase">
              Arquivos Google Apps Script (.gs)
            </span>
            <button
              type="button"
              onClick={handleCopiar}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-xs font-bold text-neutral-950 hover:bg-neutral-200 transition-all"
            >
              {copiado ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copiado ? 'Copiado!' : 'Copiar Código'}
            </button>
          </div>

          {/* Seletor de Arquivos */}
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(arquivosCodigo).map(arq => (
              <button
                key={arq}
                type="button"
                onClick={() => setArquivoSelecionado(arq)}
                className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                  arquivoSelecionado === arq
                    ? 'bg-neutral-200 text-neutral-950 font-bold'
                    : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'
                }`}
              >
                {arq}
              </button>
            ))}
          </div>

          {/* Visualizador de Código */}
          <div className="relative mt-2">
            <pre className="max-h-96 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-[11px] font-mono leading-relaxed text-neutral-300 selection:bg-neutral-700">
              {arquivosCodigo[arquivoSelecionado]}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
