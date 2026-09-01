import React, { useState } from "react";
import {
  Sparkles,
  TrendingDown,
  FileText,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  BrainCircuit,
  Layers,
  Copy,
  Check,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";

export const AiIntelligenceView: React.FC = () => {
  const { settings, addToast } = useCrm();

  const [activeAnalysis, setActiveAnalysis] = useState<"funnel" | "scripts" | "executive">("funnel");
  const [funnelAnalysisText, setFunnelAnalysisText] = useState<string | null>(null);
  const [scriptAnalysisText, setScriptAnalysisText] = useState<string | null>(null);
  const [executiveSummaryText, setExecutiveSummaryText] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunFunnelAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await api.analyzeFunnel("thisMonth", "all");
      setFunnelAnalysisText(res.analysis);
      addToast({ type: "success", title: "Análise de Funil Concluída" });
    } catch (err: any) {
      addToast({ type: "error", title: "Falha na análise", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunScriptAnalysis = async () => {
    setIsLoading(true);
    try {
      const res = await api.analyzeScripts();
      setScriptAnalysisText(res.analysis);
      addToast({ type: "success", title: "Análise de Scripts Concluída" });
    } catch (err: any) {
      addToast({ type: "error", title: "Falha na análise", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunExecutiveSummary = async () => {
    setIsLoading(true);
    try {
      const res = await api.generateExecutiveSummary("thisMonth", "all");
      setExecutiveSummaryText(res.summary);
      addToast({ type: "success", title: "Resumo Executivo Gerado" });
    } catch (err: any) {
      addToast({ type: "error", title: "Falha ao gerar resumo", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReport = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast({ type: "success", title: "Relatório Copiado" });
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    let currentText = null;
    let currentTitle = "";
    let runFn = handleRunFunnelAnalysis;

    if (activeAnalysis === "funnel") {
      currentText = funnelAnalysisText;
      currentTitle = "Diagnóstico de Gargalos & Perdas no Funil";
      runFn = handleRunFunnelAnalysis;
    } else if (activeAnalysis === "scripts") {
      currentText = scriptAnalysisText;
      currentTitle = "Otimização & Sugestão de Variantes de Scripts";
      runFn = handleRunScriptAnalysis;
    } else {
      currentText = executiveSummaryText;
      currentTitle = "Resumo Executivo para CEO & COO";
      runFn = handleRunExecutiveSummary;
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{currentTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Alimentado por IA (OpenAI) com dados reais agregados do CRM
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentText && (
              <button
                onClick={() => handleCopyReport(currentText)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copiado!" : "Copiar Relatório"}</span>
              </button>
            )}

            <button
              onClick={runFn}
              disabled={isLoading || !settings?.aiEnabled}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Processando..." : currentText ? "Atualizar Análise" : "Executar Análise"}</span>
            </button>
          </div>
        </div>

        {!currentText ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Nenhuma análise gerada nesta sessão</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Clique em "Executar Análise" para que o modelo processe os dados reais de conversão do CRM e apresente recomendações acionáveis.
            </p>
          </div>
        ) : (
          <div className="prose prose-slate max-w-none text-xs leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-5 rounded-xl border border-slate-200 font-sans text-slate-800">
            {currentText}
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="ai-intelligence-view" className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">
              Inteligência Artificial Comercial (OpenAI)
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Modelo: {settings?.geminiModel || "gpt-5.6-luna"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Diagnósticos táticos de gargalos, otimização de copy e relatórios executivos
          </p>
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveAnalysis("funnel")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeAnalysis === "funnel"
              ? "bg-indigo-50/70 border-indigo-600 shadow-xs"
              : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <TrendingDown className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              Módulo 1
            </span>
          </div>
          <h4 className="font-bold text-sm text-slate-900">Gargalos do Funil</h4>
          <p className="text-xs text-slate-500 mt-1">
            Detecta onde os leads estão travando (taxa de resposta, reuniões ou testes).
          </p>
        </button>

        <button
          onClick={() => setActiveAnalysis("scripts")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeAnalysis === "scripts"
              ? "bg-indigo-50/70 border-indigo-600 shadow-xs"
              : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              Módulo 2
            </span>
          </div>
          <h4 className="font-bold text-sm text-slate-900">Performance de Scripts</h4>
          <p className="text-xs text-slate-500 mt-1">
            Compara versões de copys e sugere novas variações para teste A/B.
          </p>
        </button>

        <button
          onClick={() => setActiveAnalysis("executive")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeAnalysis === "executive"
              ? "bg-indigo-50/70 border-indigo-600 shadow-xs"
              : "bg-white border-slate-200 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
              Módulo 3
            </span>
          </div>
          <h4 className="font-bold text-sm text-slate-900">Resumo Executivo</h4>
          <p className="text-xs text-slate-500 mt-1">
            Diagnóstico consolidado com prioridades da semana para CEO & COO.
          </p>
        </button>
      </div>

      {/* Main Analysis Body */}
      {renderContent()}
    </div>
  );
};
