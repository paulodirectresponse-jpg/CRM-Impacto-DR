import React, { useState } from "react";
import {
  Settings,
  Target,
  Sparkles,
  ShieldCheck,
  Download,
  Database,
  CheckCircle2,
  AlertCircle,
  Play,
  RefreshCw,
  Plus,
  Trash2,
  Archive,
  Lock,
  Flame,
  Clock,
  ChevronDown,
  ChevronRight,
  Sliders,
  FileCheck2,
  Layers,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { AcceptanceTestResult, DailyGoal, LossReason } from "../../types";
import { api } from "../../services/api";

type SettingsTab = "goals" | "paid_traffic" | "ai" | "loss_reasons" | "data_tests";

export const SettingsView: React.FC = () => {
  const {
    settings,
    audiences,
    lossReasons,
    refreshAll,
    addToast,
  } = useCrm();

  const [activeTab, setActiveTab] = useState<SettingsTab>("goals");

  // Active Goals
  const [dailyTarget, setDailyTarget] = useState<number>(settings?.defaultDailyTarget ?? 0);
  const [audienceTargets, setAudienceTargets] = useState<{ [id: string]: number }>(
    settings?.audienceTargets || {}
  );
  const [isSavingGoals, setIsSavingGoals] = useState(false);

  // Paid Traffic Settings
  const [adSpendTotal, setAdSpendTotal] = useState<number>(settings?.adSpendTotal ?? 0);
  const [avgTicket, setAvgTicket] = useState<number>(settings?.averageContractValue ?? 0);
  const [isSavingPaid, setIsSavingPaid] = useState(false);

  // Loss Reason form
  const [newReasonName, setNewReasonName] = useState("");
  const [isNewReasonOther, setIsNewReasonOther] = useState(false);
  const [isCreatingReason, setIsCreatingReason] = useState(false);

  // AI Settings
  const [aiEnabled, setAiEnabled] = useState(settings?.aiEnabled ?? true);
  const [geminiModel, setGeminiModel] = useState(settings?.geminiModel || "gpt-5.6-luna");
  const [minSample, setMinSample] = useState(settings?.minSampleForAiAnalysis || 5);
  const [isSavingAi, setIsSavingAi] = useState(false);

  // Authorized Emails
  const [newEmail, setNewEmail] = useState("");
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>(
    settings?.authorizedEmails || ["ferramentas.1@gmail.com", "ferramentaas.1@gmail.com", "paulo.direct.response@gmail.com"]
  );

  // Synchronize state when settings are loaded/refreshed
  React.useEffect(() => {
    if (settings) {
      setDailyTarget(settings.defaultDailyTarget ?? 0);
      setAudienceTargets(settings.audienceTargets || {});
      setAdSpendTotal(settings.adSpendTotal ?? 0);
      setAvgTicket(settings.averageContractValue ?? 0);
      setAiEnabled(settings.aiEnabled ?? true);
      setGeminiModel(settings.geminiModel || "gpt-5.6-luna");
      setMinSample(settings.minSampleForAiAnalysis || 5);
      if (settings.authorizedEmails && settings.authorizedEmails.length > 0) {
        setAuthorizedEmails(settings.authorizedEmails);
      }
    }
  }, [settings]);

  // Acceptance Test Suite
  const [testResults, setTestResults] = useState<AcceptanceTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSummary, setTestSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
  } | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  const handleSaveGoals = async () => {
    setIsSavingGoals(true);
    try {
      await api.updateSettings({
        defaultDailyTarget: dailyTarget,
        audienceTargets,
      });
      await api.setGoal({
        date: new Date().toISOString().split("T")[0],
        targetTotal: dailyTarget,
        targetByAudience: audienceTargets,
      });
      addToast({ type: "success", title: "Metas diárias atualizadas com sucesso!" });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar metas", message: err.message });
    } finally {
      setIsSavingGoals(false);
    }
  };

  const handleSavePaidTrafficSettings = async () => {
    setIsSavingPaid(true);
    try {
      await api.updateSettings({
        adSpendTotal,
        averageContractValue: avgTicket,
      });
      addToast({ type: "success", title: "Parâmetros de Tráfego Pago & ROI Salvos!" });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar parâmetros", message: err.message });
    } finally {
      setIsSavingPaid(false);
    }
  };

  const handleSaveAi = async () => {
    setIsSavingAi(true);
    try {
      await api.updateSettings({
        aiEnabled,
        geminiModel,
        minSampleForAiAnalysis: minSample,
      });
      addToast({ type: "success", title: "Configurações de IA salvas com sucesso!" });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      addToast({ type: "error", title: "E-mail inválido" });
      return;
    }
    const updated = [...authorizedEmails, newEmail.trim().toLowerCase()];
    setAuthorizedEmails(updated);
    setNewEmail("");
    await api.updateSettings({ authorizedEmails: updated });
    addToast({ type: "success", title: "E-mail adicionado aos autorizados" });
    await refreshAll();
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    if (authorizedEmails.length <= 1) {
      addToast({ type: "warning", title: "Atenção", message: "Deve haver pelo menos um e-mail autorizado." });
      return;
    }
    const updated = authorizedEmails.filter((e) => e !== emailToRemove);
    setAuthorizedEmails(updated);
    await api.updateSettings({ authorizedEmails: updated });
    addToast({ type: "success", title: "E-mail removido" });
    await refreshAll();
  };

  const handleCreateReason = async () => {
    if (!newReasonName.trim()) return;
    setIsCreatingReason(true);
    try {
      await api.createLossReason(newReasonName.trim(), isNewReasonOther);
      setNewReasonName("");
      setIsNewReasonOther(false);
      addToast({ type: "success", title: "Motivo cadastrado com sucesso" });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    } finally {
      setIsCreatingReason(false);
    }
  };

  const handleArchiveReason = async (id: string) => {
    try {
      await api.archiveLossReason(id);
      addToast({ type: "success", title: "Motivo arquivado" });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    }
  };

  const handleRunAcceptanceTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await api.runAcceptanceTests();
      setTestResults(res.results);
      setTestSummary({
        total: res.total,
        passed: res.passed,
        failed: res.failed,
      });

      if (res.allPassed) {
        addToast({
          type: "success",
          title: "Validação dos 50 Testes Concluída",
          message: `Todos os ${res.total} testes de aceitação passaram com 100% de sucesso!`,
        });
      } else {
        addToast({
          type: "error",
          title: "Falha em Teste de Aceitação",
          message: `${res.failed} teste(s) falharam. Verifique os logs abaixo.`,
        });
      }
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao executar suíte de testes", message: err.message });
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleSeedDemo = async () => {
    try {
      const res = await api.seedDatabase();
      addToast({
        type: "success",
        title: "Base Populada com Dados Demo",
        message: `${res.leadsCount} leads cadastrados com histórico de coorte e métricas.`,
      });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    }
  };

  const handleResetDb = async () => {
    if (!confirm("Tem certeza que deseja restaurar o CRM para a base padrão inicial limpa?")) return;
    try {
      await api.resetDatabase();
      addToast({ type: "success", title: "Banco Resetado", message: "Base restaurada para o padrão inicial." });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "goals", label: "Metas & Equipe", icon: <Target className="w-4 h-4" /> },
    { id: "paid_traffic", label: "Tráfego Pago & ROI", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "ai", label: "Inteligência Artificial (OpenAI)", icon: <Sparkles className="w-4 h-4" />, badge: aiEnabled ? "Ativa" : "Off" },
    { id: "loss_reasons", label: "Motivos de Perda", icon: <Archive className="w-4 h-4" />, badge: `${lossReasons.filter(r => r.isActive).length}` },
    { id: "data_tests", label: "Dados, Backup & Testes", icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div id="settings-view" className="space-y-6 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">Configurações & Governança</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie metas diárias, modelo OpenAI, motivos de descarte e segurança operacional
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/60 rounded-xl max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "bg-slate-300 text-slate-700"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Goals & Team */}
      {activeTab === "goals" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Daily Targets */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Target className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Metas Diárias de Prospecção Ativa</h3>
                <p className="text-xs text-slate-500">
                  Contagem diária baseada no primeiro contato no fuso America/Sao_Paulo (leads pagos não somam)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meta Diária Geral (Novos Contatos Ativos / Dia)
                </label>
                <input
                  type="number"
                  min={1}
                  value={dailyTarget}
                  onChange={(e) => setDailyTarget(parseInt(e.target.value) || 30)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Recomendado para rotina de SDR: 20 a 50 contatos/dia.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">Metas por Público / Nicho (Opcional)</label>
                {audiences.filter((a) => a.isActive).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg">
                    Nenhum público ativo cadastrado no momento.
                  </p>
                ) : (
                  audiences
                    .filter((a) => a.isActive)
                    .map((aud) => (
                      <div key={aud.id} className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-slate-700 font-medium truncate">{aud.name}:</span>
                        <input
                          type="number"
                          placeholder="Meta"
                          value={audienceTargets[aud.id] || ""}
                          onChange={(e) =>
                            setAudienceTargets({
                              ...audienceTargets,
                              [aud.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20 border border-slate-300 bg-white rounded px-2 py-1 text-xs text-right outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={handleSaveGoals}
                disabled={isSavingGoals}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingGoals ? "Salvando..." : "Salvar Metas"}
              </button>
            </div>
          </div>

          {/* Authorized Team Emails */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">E-mails Autorizados (CEO, COO & Gestão)</h3>
                <p className="text-xs text-slate-500">
                  Endereços cadastrados que possuem autorização de acesso ao painel comercial
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {authorizedEmails.map((em) => (
                <div
                  key={em}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-medium text-slate-800 font-mono">{em}</span>
                  {authorizedEmails.length > 1 && (
                    <button
                      onClick={() => handleRemoveEmail(em)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                      title="Remover e-mail"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs">
              <input
                type="email"
                placeholder="novo.gestor@empresa.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
              <button
                onClick={handleAddEmail}
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                Autorizar E-mail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Paid Traffic & ROI Settings */}
      {activeTab === "paid_traffic" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Parâmetros Financeiros & Tráfego Pago</h3>
                <p className="text-xs text-slate-500">
                  Calibre o investimento acumulado em mídia paga e o valor médio dos contratos para cálculo preciso de ROI, ROAS, CPL e CAC
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Investimento Total em Anúncios (R$)
              </label>
              <input
                type="number"
                step="50"
                min="0"
                value={adSpendTotal}
                onChange={(e) => setAdSpendTotal(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Soma de gastos em Meta Ads, Google Ads ou campanhas diretas de prospecção.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ticket Médio Mensal / Contrato de Edição (R$)
              </label>
              <input
                type="number"
                step="100"
                min="0"
                value={avgTicket}
                onChange={(e) => setAvgTicket(parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Valor médio mensal cobrado por cliente de vídeo fechado.
              </p>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900">Como o CRM calcula o ROI do Tráfego Pago:</p>
              <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-0.5">
                <li><strong>CPL (Custo por Lead):</strong> Investimento Total / Leads Pagos Captados.</li>
                <li><strong>CAC (Custo de Aquisição):</strong> Investimento Total / Clientes Fechados de Tráfego Pago.</li>
                <li><strong>ROAS (Retorno Direto):</strong> Faturamento de Leads Fechados / Investimento em Anúncios.</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSavePaidTrafficSettings}
              disabled={isSavingPaid}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSavingPaid ? "Salvando..." : "Salvar Parâmetros Financeiros"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: AI Intelligence */}
      {activeTab === "ai" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Motor de Inteligência Artificial (OpenAI)</h3>
                <p className="text-xs text-slate-500">
                  Qualificação automática de prints, criação de nichos, scripts persuasivos e diagnósticos
                </p>
              </div>
            </div>

            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                aiEnabled ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-200 text-slate-700"
              }`}
            >
              {aiEnabled ? "✓ IA Ativa" : "IA Desativada"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Modelo de IA OpenAI
              </label>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
              >
                <option value="gpt-5.6-luna">gpt-5.6-luna (Padrão de Produção • Multimodal & Vision)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Processamento server-side seguro via OpenAI API.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amostra Mínima para Diagnósticos Estatísticos
              </label>
              <input
                type="number"
                min={5}
                value={minSample}
                onChange={(e) => setMinSample(parseInt(e.target.value) || 20)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Número mínimo de disparos para a IA emitir alertas estatísticos de baixa conversão.
              </p>
            </div>
          </div>

          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-indigo-900">Recursos suportados pela IA:</p>
              <ul className="list-disc list-inside text-[11px] text-indigo-800 space-y-0.5">
                <li>Leitura de prints do Instagram (análise de biografia, engajamento, seguidores e estilo de reels).</li>
                <li>Geração inteligente de novos nichos e critérios A/B/C via prompt.</li>
                <li>Criação de scripts e copys de primeiro contato com técnicas de gancho e retenção.</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={handleSaveAi}
              disabled={isSavingAi}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSavingAi ? "Salvando..." : "Salvar Configurações de IA"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Loss Reasons */}
      {activeTab === "loss_reasons" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Archive className="w-5 h-5 text-rose-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Motivos de Perda Padronizados</h3>
              <p className="text-xs text-slate-500">
                Opções obrigatórias exigidas ao marcar um lead como Perdido para manter a governança
              </p>
            </div>
          </div>

          {/* Existing reasons list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {lossReasons.map((lr) => (
              <div
                key={lr.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{lr.name}</span>
                  {lr.isOther && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                      Exige justificativa textual
                    </span>
                  )}
                  {!lr.isActive && (
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      Desativado
                    </span>
                  )}
                </div>
                {lr.isActive && !lr.isOther && (
                  <button
                    onClick={() => handleArchiveReason(lr.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                    title="Desativar motivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new reason */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <input
              type="text"
              placeholder="Novo motivo (Ex: Não tem orçamento, Já possui editor interno)..."
              value={newReasonName}
              onChange={(e) => setNewReasonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateReason();
                }
              }}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <button
              onClick={handleCreateReason}
              disabled={isCreatingReason || !newReasonName.trim()}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
            >
              Adicionar Motivo
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Data, Backup & Acceptance Tests */}
      {activeTab === "data_tests" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Firebase Cloud Firestore & Auth Connection Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                🔥
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Conexão Firebase & Cloud Firestore</h3>
                <p className="text-xs text-slate-500">Banco de dados persistente em nuvem e autenticação Google</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status Firestore</span>
                <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Conectado (us-east1)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Firebase Auth</span>
                <div className="flex items-center gap-1.5 font-bold text-indigo-600">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Google Sign-In Ativo</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Projeto Google Cloud</span>
                <div className="font-mono text-[11px] font-semibold text-slate-800 truncate">
                  gen-lang-client-0030668744
                </div>
              </div>
            </div>
          </div>

          {/* Database Backups & Maintenance */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Database className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Exportação & Gestão de Dados</h3>
                <p className="text-xs text-slate-500">Download de relatórios ou limpeza completa da aplicação</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <a
                href="/api/export/csv"
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 text-center transition-colors shadow-2xs"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Baixar Leads (CSV)</span>
              </a>

              <a
                href="/api/export/json"
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 text-center transition-colors shadow-2xs"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Backup Completo (JSON)</span>
              </a>

              <button
                onClick={handleResetDb}
                className="flex items-center justify-center gap-2 p-3 rounded-xl border border-rose-200 hover:bg-rose-50 font-semibold text-rose-700 text-center transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Zerar Base do App (100% Limpo)</span>
              </button>
            </div>
          </div>

          {/* Acceptance Test Suite Runner (Camada 13) */}
          <div
            id="acceptance-tests-section"
            className="bg-white p-6 rounded-2xl border-2 border-indigo-100 shadow-2xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">
                      Suíte de 50 Testes de Aceitação do CRM
                    </h3>
                    {testSummary && (
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          testSummary.failed === 0
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-rose-100 text-rose-800 border border-rose-300"
                        }`}
                      >
                        {testSummary.passed}/{testSummary.total} Passaram
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Valida a integridade, snapshots de coorte, imutabilidade de scripts e regras de negócio
                  </p>
                </div>
              </div>

              <button
                id="btn-run-all-tests"
                onClick={handleRunAcceptanceTests}
                disabled={isRunningTests}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Play className={`w-4 h-4 ${isRunningTests ? "animate-spin" : ""}`} />
                <span>{isRunningTests ? "Executando 50 Testes..." : "Executar 50 Testes"}</span>
              </button>
            </div>

            {/* Results List */}
            {testResults.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {testResults.map((t) => {
                  const isExpanded = expandedTestId === t.id;
                  const isPassed = t.status === "passed";

                  return (
                    <div
                      key={t.id}
                      id={`test-card-${t.id}`}
                      className={`rounded-xl border p-3 text-xs transition-all ${
                        isPassed
                          ? "bg-emerald-50/40 border-emerald-200"
                          : "bg-rose-50/50 border-rose-300"
                      }`}
                    >
                      <div
                        onClick={() => setExpandedTestId(isExpanded ? null : t.id)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isPassed ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                            }`}
                          >
                            {t.id}
                          </span>
                          <span className="font-bold text-slate-900">{t.scenario}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-slate-600">{t.expectedResult}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{t.executionTimeMs}ms</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {isPassed ? "PASSOU" : "FALHOU"}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-2 border-t border-slate-200/80 space-y-1 font-mono text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-lg">
                          <div className="font-bold text-slate-900 mb-1">Logs de Execução:</div>
                          {t.logs?.map((l, i) => (
                            <div key={i} className="leading-tight">
                              • {l}
                            </div>
                          ))}
                          {t.details && <div className="text-rose-600 font-bold mt-1">Detalhes: {t.details}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

