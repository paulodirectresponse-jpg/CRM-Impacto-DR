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
  RotateCcw,
  Inbox,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { AcceptanceTestResult, DailyGoal, LossReason, TrashItems, Lead, Script, Audience, ImportConfig } from "../../types";
import { api } from "../../services/api";
import { formatSaoPauloDateTime } from "../../utils/dateUtils";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";

type SettingsTab = "ai" | "paid_traffic" | "loss_reasons" | "team" | "data_tests" | "trash";

export const SettingsView: React.FC = () => {
  const {
    settings,
    audiences,
    lossReasons,
    refreshAll,
    addToast,
  } = useCrm();

  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");

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

  // Trash & Deleted Items (V2.1.1)
  const [trashData, setTrashData] = useState<TrashItems>({
    leads: [],
    scripts: [],
    audiences: [],
    importConfigs: [],
    configs: [],
  });
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashSubTab, setTrashSubTab] = useState<"leads" | "scripts" | "audiences" | "configs">("leads");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Modal states for permanent deletion & empty trash
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{
    type: "lead" | "script" | "audience" | "config" | "loss_reason";
    id: string;
    name: string;
  } | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);

  // Dynamic Firebase Health
  const [healthData, setHealthData] = useState<{
    status: string;
    database: {
      provider: string;
      reachable: boolean;
      status: string;
      projectId: string;
      databaseId: string;
      credentialMode: string;
    };
    auth: string;
  } | null>(null);

  const loadHealth = async () => {
    try {
      const h = await api.getHealth();
      setHealthData(h);
    } catch {
      // ignore
    }
  };

  React.useEffect(() => {
    loadHealth();
  }, []);

  const loadTrash = async () => {
    setIsLoadingTrash(true);
    try {
      const data = await api.getTrashItems();
      const cfgList = data.importConfigs || data.configs || [];
      const sanitized: TrashItems = {
        leads: data.leads || [],
        scripts: data.scripts || [],
        audiences: data.audiences || [],
        importConfigs: cfgList,
        configs: cfgList,
      };
      setTrashData(sanitized);
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao carregar lixeira", message: err.message });
    } finally {
      setIsLoadingTrash(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "trash") {
      loadTrash();
    }
  }, [activeTab]);

  const handleRestoreLead = async (id: string) => {
    setRestoringId(id);
    try {
      await api.restoreLead(id);
      addToast({ type: "success", title: "Lead Restaurado com Sucesso" });
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao restaurar lead", message: err.message });
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreScript = async (id: string) => {
    setRestoringId(id);
    try {
      await api.restoreScript(id);
      addToast({ type: "success", title: "Script Restaurado com Sucesso" });
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao restaurar script", message: err.message });
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreAudience = async (id: string) => {
    setRestoringId(id);
    try {
      await api.restoreAudience(id);
      addToast({ type: "success", title: "Público Restaurado com Sucesso" });
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao restaurar público", message: err.message });
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreConfig = async (id: string) => {
    setRestoringId(id);
    try {
      await api.restoreImportConfig(id);
      addToast({ type: "success", title: "Modelo de Importação Restaurado com Sucesso" });
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao restaurar modelo", message: err.message });
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    setIsEmptyingTrash(true);
    try {
      const res = await api.emptyTrash();
      addToast({
        type: "success",
        title: "Lixeira Esvaziada",
        message: res.message || "Todos os itens foram excluídos definitivamente.",
      });
      setShowEmptyTrashModal(false);
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao esvaziar lixeira", message: err.message });
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setIsPermanentlyDeleting(true);
    try {
      const { type, id, name } = permanentDeleteTarget;
      if (type === "lead") {
        await api.permanentlyDeleteLead(id);
        addToast({ type: "success", title: "Lead excluído definitivamente" });
      } else if (type === "script") {
        await api.permanentlyDeleteScript(id);
        addToast({ type: "success", title: "Script excluído definitivamente" });
      } else if (type === "audience") {
        await api.permanentlyDeleteAudience(id);
        addToast({ type: "success", title: "Público excluído definitivamente" });
      } else if (type === "config") {
        await api.permanentlyDeleteImportConfig(id);
        addToast({ type: "success", title: "Modelo excluído definitivamente" });
      } else if (type === "loss_reason") {
        await api.deleteLossReason(id);
        addToast({ type: "success", title: "Motivo de perda excluído com sucesso" });
      }
      setPermanentDeleteTarget(null);
      await loadTrash();
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao excluir item definitivamente", message: err.message });
    } finally {
      setIsPermanentlyDeleting(false);
    }
  };

  // Synchronize state when settings are loaded/refreshed
  React.useEffect(() => {
    if (settings) {
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
      const res: any = await api.runAcceptanceTests();
      const list = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
      const total = typeof res?.total === "number" ? res.total : list.length;
      const passed = typeof res?.passed === "number" ? res.passed : list.filter((r: any) => r.status === "passed").length;
      const failed = typeof res?.failed === "number" ? res.failed : list.filter((r: any) => r.status === "failed").length;
      const allPassed = typeof res?.allPassed === "boolean" ? res.allPassed : failed === 0;

      setTestResults(list);
      setTestSummary({
        total,
        passed,
        failed,
      });

      if (allPassed) {
        addToast({
          type: "success",
          title: "Validação dos 50 Testes Concluída",
          message: `Todos os ${total} testes de aceitação passaram com 100% de sucesso!`,
        });
      } else {
        addToast({
          type: "error",
          title: "Falha em Teste de Aceitação",
          message: `${failed} teste(s) falharam. Verifique os logs abaixo.`,
        });
      }
    } catch (err: any) {
      setTestResults([]);
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

  const totalTrashCount =
    (trashData.leads?.length || 0) +
    (trashData.scripts?.length || 0) +
    (trashData.audiences?.length || 0) +
    (trashData.importConfigs?.length || trashData.configs?.length || 0);

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "ai", label: "Inteligência Artificial (OpenAI)", icon: <Sparkles className="w-4 h-4" />, badge: aiEnabled ? "Ativa" : "Off" },
    { id: "paid_traffic", label: "Tráfego Pago & ROI", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "loss_reasons", label: "Motivos de Perda", icon: <Archive className="w-4 h-4" />, badge: `${(lossReasons || []).filter(r => r.isActive).length}` },
    { id: "team", label: "Equipe & Acessos", icon: <ShieldCheck className="w-4 h-4" />, badge: `${(authorizedEmails || []).length}` },
    { id: "trash", label: "Lixeira", icon: <Trash2 className="w-4 h-4" />, badge: totalTrashCount > 0 ? `${totalTrashCount}` : undefined },
    { id: "data_tests", label: "Dados, Backup & Testes", icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div id="settings-view" className="space-y-6 animate-in fade-in pb-16">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">Configurações & Governança</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie modelo OpenAI, parâmetros de tráfego, motivos de descarte, segurança operacional e equipe
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

      {/* TAB: Team & Access */}
      {activeTab === "team" && (
        <div className="space-y-6 animate-in fade-in">
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
              {(authorizedEmails || []).map((em) => (
                <div
                  key={em}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-medium text-slate-800 font-mono">{em}</span>
                  {(authorizedEmails || []).length > 1 && (
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
            {(lossReasons || []).map((lr) => (
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
                <div className="flex items-center gap-1">
                  {lr.isActive && !lr.isOther && (
                    <button
                      onClick={() => handleArchiveReason(lr.id)}
                      className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200 px-2 py-1 rounded transition-colors cursor-pointer"
                      title="Desativar motivo"
                    >
                      Desativar
                    </button>
                  )}
                  {!lr.isOther && (
                    <button
                      onClick={() =>
                        setPermanentDeleteTarget({
                          type: "loss_reason",
                          id: lr.id,
                          name: lr.name,
                        })
                      }
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                      title="Excluir motivo definitivamente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
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

      {/* TAB 5: Lixeira (Soft Deleted Items - V2.1.1) */}
      {activeTab === "trash" && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Lixeira do Sistema (Soft Delete)</h3>
                  <p className="text-xs text-slate-500">
                    Itens excluídos permanecem salvos e podem ser restaurados ou excluídos permanentemente
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {((trashData.leads?.length || 0) +
                  (trashData.scripts?.length || 0) +
                  (trashData.audiences?.length || 0) +
                  (trashData.importConfigs?.length || trashData.configs?.length || 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => setShowEmptyTrashModal(true)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Esvaziar Lixeira</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={loadTrash}
                  disabled={isLoadingTrash}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrash ? "animate-spin" : ""}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {/* Sub-tabs for Trash Entities */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 overflow-x-auto">
              {[
                { id: "leads", label: "Leads", count: trashData.leads?.length || 0 },
                { id: "scripts", label: "Scripts", count: trashData.scripts?.length || 0 },
                { id: "audiences", label: "Públicos-Alvo", count: trashData.audiences?.length || 0 },
                { id: "configs", label: "Modelos de Importação", count: trashData.importConfigs?.length || trashData.configs?.length || 0 },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setTrashSubTab(sub.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    trashSubTab === sub.id
                      ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{sub.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      trashSubTab === sub.id ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {sub.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Content per sub-tab */}
            {isLoadingTrash ? (
              <div className="py-12 flex items-center justify-center text-xs text-slate-500 gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Carregando itens da lixeira...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Leads Trash */}
                {trashSubTab === "leads" && (
                  <div>
                    {(trashData.leads?.length || 0) === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                        <Inbox className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <span>Nenhum lead na lixeira.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(trashData.leads || []).map((lead) => {
                          const leadLabel = lead.instagramUsernameNormalized
                            ? `@${lead.instagramUsernameNormalized}`
                            : lead.temporaryLabel || lead.id;
                          return (
                            <div
                              key={lead.id}
                              className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{leadLabel}</span>
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold uppercase">
                                    {lead.status}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Excluído em: {lead.deletedAt ? formatSaoPauloDateTime(lead.deletedAt) : "Data não registrada"}
                                  {lead.deletedBy ? ` por ${lead.deletedBy}` : ""}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreLead(lead.id)}
                                  disabled={restoringId === lead.id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <RotateCcw className={`w-3.5 h-3.5 ${restoringId === lead.id ? "animate-spin" : ""}`} />
                                  <span>{restoringId === lead.id ? "Restaurando..." : "Restaurar"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPermanentDeleteTarget({
                                      type: "lead",
                                      id: lead.id,
                                      name: leadLabel,
                                    })
                                  }
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Excluir definitivamente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Scripts Trash */}
                {trashSubTab === "scripts" && (
                  <div>
                    {(trashData.scripts?.length || 0) === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                        <Inbox className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <span>Nenhum script na lixeira.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(trashData.scripts || []).map((scr) => (
                          <div
                            key={scr.id}
                            className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5 max-w-md">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{scr.baseName}</span>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                  v{scr.version}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{scr.content}</p>
                              <div className="text-[10px] text-slate-400">
                                Excluído em: {scr.deletedAt ? formatSaoPauloDateTime(scr.deletedAt) : "Data não registrada"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRestoreScript(scr.id)}
                                disabled={restoringId === scr.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${restoringId === scr.id ? "animate-spin" : ""}`} />
                                <span>{restoringId === scr.id ? "Restaurando..." : "Restaurar"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPermanentDeleteTarget({
                                    type: "script",
                                    id: scr.id,
                                    name: `Script "${scr.baseName}" (v${scr.version})`,
                                  })
                                }
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                title="Excluir definitivamente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Audiences Trash */}
                {trashSubTab === "audiences" && (
                  <div>
                    {(trashData.audiences?.length || 0) === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                        <Inbox className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <span>Nenhum público-alvo na lixeira.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(trashData.audiences || []).map((aud) => (
                          <div
                            key={aud.id}
                            className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900">{aud.name}</span>
                              {aud.description && <p className="text-[11px] text-slate-500">{aud.description}</p>}
                              <div className="text-[10px] text-slate-400">
                                Excluído em: {aud.deletedAt ? formatSaoPauloDateTime(aud.deletedAt) : "Data não registrada"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRestoreAudience(aud.id)}
                                disabled={restoringId === aud.id}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${restoringId === aud.id ? "animate-spin" : ""}`} />
                                <span>{restoringId === aud.id ? "Restaurando..." : "Restaurar"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPermanentDeleteTarget({
                                    type: "audience",
                                    id: aud.id,
                                    name: `Público "${aud.name}"`,
                                  })
                                }
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                title="Excluir definitivamente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Import Configs Trash */}
                {trashSubTab === "configs" && (
                  <div>
                    {(trashData.importConfigs?.length || 0) === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                        <Inbox className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <span>Nenhum modelo de importação na lixeira.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(trashData.importConfigs || []).map((cfg) => {
                          const kws = cfg.keywords || [];
                          return (
                            <div
                              key={cfg.id}
                              className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <span className="font-bold text-slate-900">{cfg.name}</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {kws.slice(0, 4).map((kw, i) => (
                                    <span key={i} className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded">
                                      {kw}
                                    </span>
                                  ))}
                                  {kws.length > 4 && (
                                    <span className="text-[10px] text-slate-400">+{kws.length - 4}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Excluído em: {cfg.deletedAt ? formatSaoPauloDateTime(cfg.deletedAt) : "Data não registrada"}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRestoreConfig(cfg.id)}
                                  disabled={restoringId === cfg.id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <RotateCcw className={`w-3.5 h-3.5 ${restoringId === cfg.id ? "animate-spin" : ""}`} />
                                  <span>{restoringId === cfg.id ? "Restaurando..." : "Restaurar"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPermanentDeleteTarget({
                                      type: "config",
                                      id: cfg.id,
                                      name: `Modelo "${cfg.name}"`,
                                    })
                                  }
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Excluir definitivamente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
                <div className={`flex items-center gap-1.5 font-bold ${healthData?.database.reachable ? "text-emerald-600" : "text-amber-600"}`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {healthData?.database.reachable
                      ? `Conectado (${healthData.database.databaseId || "(default)"})`
                      : "Verificando..."}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Firebase Auth</span>
                <div className="flex items-center gap-1.5 font-bold text-indigo-600">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{healthData?.auth ? "Google Sign-In Ativo" : "Google Sign-In Ativo"}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Projeto Google Cloud</span>
                <div className="font-mono text-[11px] font-semibold text-slate-800 truncate">
                  {healthData?.database.projectId || "firebase-configured"}
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
            {(testResults || []).length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(testResults || []).map((t) => {
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

      {/* Modal to Confirm Emptying Trash */}
      <ConfirmDeleteModal
        isOpen={showEmptyTrashModal}
        title="Esvaziar Toda a Lixeira?"
        description={
          <div>
            <p>
              Esta ação excluirá definitivamente todos os leads, scripts, públicos-alvo e modelos de importação presentes na lixeira.
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              Total de itens: {(trashData.leads?.length || 0) +
                (trashData.scripts?.length || 0) +
                (trashData.audiences?.length || 0) +
                (trashData.importConfigs?.length || trashData.configs?.length || 0)}
            </p>
          </div>
        }
        confirmText="Esvaziar Definitivamente"
        isPermanent={true}
        isLoading={isEmptyingTrash}
        onConfirm={handleConfirmEmptyTrash}
        onClose={() => setShowEmptyTrashModal(false)}
      />

      {/* Modal to Confirm Permanent Item Deletion */}
      <ConfirmDeleteModal
        isOpen={Boolean(permanentDeleteTarget)}
        title={
          permanentDeleteTarget?.type === "loss_reason"
            ? "Excluir Motivo de Perda?"
            : "Excluir Definitivamente?"
        }
        description={
          <div>
            <p>
              {permanentDeleteTarget?.type === "loss_reason"
                ? "Tem certeza de que deseja remover este motivo de perda?"
                : "Este item será removido permanentemente do banco de dados e não poderá mais ser restaurado."}
            </p>
            {permanentDeleteTarget?.name && (
              <p className="mt-1 font-semibold text-slate-800">
                Item: {permanentDeleteTarget.name}
              </p>
            )}
          </div>
        }
        confirmText="Excluir Definitivamente"
        isPermanent={true}
        isLoading={isPermanentlyDeleting}
        onConfirm={handleConfirmPermanentDelete}
        onClose={() => setPermanentDeleteTarget(null)}
      />
    </div>
  );
};

