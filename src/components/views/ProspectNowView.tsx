import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Zap,
  Target,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  SkipForward,
  Trash2,
  Filter,
  Layers,
  Sparkles,
  Users,
  AlertCircle,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Flame,
  FileText,
  HelpCircle,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api, ApiError } from "../../services/api";
import { Lead, Script, OperationalClass, ImportBatch, ProspectLeadFilters } from "../../types";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";

interface SessionStats {
  contactedCount: number;
  classifiedCount: number;
  deletedCount: number;
  skippedLeadIds: string[];
}

export const ProspectNowView: React.FC = () => {
  const {
    leads,
    audiences,
    scripts,
    metrics,
    refreshMetrics,
    setLeadViewMode,
    addToast,
    upsertLeadInState,
    removeLeadFromState,
  } = useCrm();

  // 1. Session flow phases
  const [phase, setPhase] = useState<"filters" | "working" | "completed">("filters");

  // 2. Filter selections (configured before starting)
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("all");
  const [selectedClasses, setSelectedClasses] = useState<OperationalClass[]>([
    "PENDENTE",
    "A",
    "B",
    "C",
  ]);
  const [selectedDiscoverySource, setSelectedDiscoverySource] = useState<"all" | "apify" | "manual">(
    "all"
  );
  const [selectedImportBatchId, setSelectedImportBatchId] = useState<string>("all");

  // Batches for filter selection
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);

  // 3. Frozen filters for active session
  const [frozenFilters, setFrozenFilters] = useState<ProspectLeadFilters | null>(null);

  // 4. Session stats & progress tracking
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    contactedCount: 0,
    classifiedCount: 0,
    deletedCount: 0,
    skippedLeadIds: [],
  });

  // 5. Current lead state in "working" phase
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [remainingCount, setRemainingCount] = useState<number>(0);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // 6. Loading and async request locks
  const [isLoadingNext, setIsLoadingNext] = useState<boolean>(false);
  const [isSavingAction, setIsSavingAction] = useState<boolean>(false);
  const [availableCountInFilters, setAvailableCountInFilters] = useState<number>(0);
  const [isCountingFilters, setIsCountingFilters] = useState<boolean>(false);

  // 7. Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load import batches for the filter dropdown
  useEffect(() => {
    let mounted = true;
    api
      .getImportBatches()
      .then((data) => {
        if (mounted) setImportBatches(data);
      })
      .catch((err) => console.warn("Could not load import batches:", err));
    return () => {
      mounted = false;
    };
  }, []);

  // Compute available matching leads preview when in "filters" phase
  useEffect(() => {
    if (phase !== "filters") return;

    let mounted = true;
    setIsCountingFilters(true);

    const timer = setTimeout(() => {
      api
        .getNextProspectLead({
          audienceId: selectedAudienceId === "all" ? undefined : selectedAudienceId,
          classes: selectedClasses,
          discoverySource: selectedDiscoverySource === "all" ? undefined : selectedDiscoverySource,
          importBatchId: selectedImportBatchId === "all" ? undefined : selectedImportBatchId,
          excludeIds: [],
        })
        .then((res) => {
          if (mounted) {
            setAvailableCountInFilters(res.remainingCount);
            setIsCountingFilters(false);
          }
        })
        .catch(() => {
          if (mounted) setIsCountingFilters(false);
        });
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [
    phase,
    selectedAudienceId,
    selectedClasses,
    selectedDiscoverySource,
    selectedImportBatchId,
    leads,
  ]);

  // Toggle class selection in filter screen
  const handleToggleClass = (cls: OperationalClass) => {
    setSelectedClasses((prev) => {
      if (prev.includes(cls)) {
        // Prevent deselecting all classes
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== cls);
      } else {
        return [...prev, cls];
      }
    });
  };

  // Fetch next eligible lead using frozen filters
  const fetchNextLead = useCallback(
    async (excludeIds: string[], customFilters?: ProspectLeadFilters) => {
      const filters = customFilters || frozenFilters;
      if (!filters) return;

      setIsLoadingNext(true);
      try {
        const res = await api.getNextProspectLead({
          ...filters,
          excludeIds,
        });

        if (res.lead) {
          setCurrentLead(res.lead);
          setRemainingCount(res.remainingCount);
          setPhase("working");

          // Reset copy state
          setIsCopied(false);

          // Find available scripts for the lead's audience
          const matchingScripts = scripts.filter(
            (s) => s.audienceId === res.lead?.audienceId && s.isActive && !s.isDeleted
          );

          if (matchingScripts.length > 0) {
            // Pick previously selected script for this audience or default to the first one
            setSelectedScriptId(matchingScripts[0].id);
          } else {
            setSelectedScriptId("");
          }
        } else {
          // No more eligible leads found matching frozen filters!
          setCurrentLead(null);
          setRemainingCount(0);
          setPhase("completed");
        }
      } catch (err: any) {
        console.error("Error fetching next prospect lead:", err);
        addToast({
          type: "error",
          title: "Erro ao carregar próximo lead",
          message: err.message || "Verifique a conexão.",
        });
      } finally {
        setIsLoadingNext(false);
      }
    },
    [frozenFilters, scripts, addToast]
  );

  // Start prospecting session
  const handleStartProspecting = () => {
    const filters: ProspectLeadFilters = {
      audienceId: selectedAudienceId === "all" ? undefined : selectedAudienceId,
      classes: selectedClasses,
      discoverySource: selectedDiscoverySource === "all" ? undefined : selectedDiscoverySource,
      importBatchId: selectedImportBatchId === "all" ? undefined : selectedImportBatchId,
      excludeIds: [],
    };

    setFrozenFilters(filters);
    setSessionStats({
      contactedCount: 0,
      classifiedCount: 0,
      deletedCount: 0,
      skippedLeadIds: [],
    });

    fetchNextLead([], filters);
  };

  // Available scripts for the current lead
  const currentAudienceScripts = useMemo(() => {
    if (!currentLead) return [];
    return scripts.filter(
      (s) => s.audienceId === currentLead.audienceId && s.isActive && !s.isDeleted
    );
  }, [currentLead, scripts]);

  // Selected script object
  const activeScript = useMemo(() => {
    if (!selectedScriptId) return null;
    return scripts.find((s) => s.id === selectedScriptId) || null;
  }, [selectedScriptId, scripts]);

  // Current lead audience name
  const currentAudienceName = useMemo(() => {
    if (!currentLead) return "Geral";
    const aud = audiences.find((a) => a.id === currentLead.audienceId);
    return aud ? aud.name : "Geral";
  }, [currentLead, audiences]);

  // Copy script content to clipboard
  const handleCopyScript = async () => {
    if (!activeScript?.content) {
      addToast({
        type: "warning",
        title: "Script vazio",
        message: "Selecione um script com conteúdo para copiar.",
      });
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeScript.content);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = activeScript.content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      addToast({
        type: "success",
        title: "Script copiado",
        message: "O texto foi copiado para a área de transferência.",
        duration: 3000,
      });
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      addToast({
        type: "error",
        title: "Erro ao copiar",
        message: "Não foi possível copiar o texto automaticamente.",
      });
    }
  };

  // Classify current lead (A, B, C) - persists in DB and updates local state without advancing lead
  const handleClassifyLead = async (newClass: "A" | "B" | "C") => {
    if (!currentLead || isSavingAction) return;

    setIsSavingAction(true);
    try {
      const wasPending = currentLead.manualClass === "PENDENTE";
      const updated = await api.updateLead(currentLead.id, {
        manualClass: newClass,
        expectedVersion: currentLead.version,
      });

      setCurrentLead(updated);
      upsertLeadInState(updated);

      if (wasPending) {
        setSessionStats((prev) => ({
          ...prev,
          classifiedCount: prev.classifiedCount + 1,
        }));
      }

      addToast({
        type: "success",
        title: `Classe ${newClass} definida`,
        message: `Lead classificado com sucesso.`,
        duration: 2500,
      });
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        addToast({
          type: "warning",
          title: "Conflito de versão",
          message: "Este Lead foi modificado simultaneamente. Carregando próximo...",
        });
        const nextExcluded = [...sessionStats.skippedLeadIds, currentLead.id];
        setSessionStats((prev) => ({ ...prev, skippedLeadIds: nextExcluded }));
        fetchNextLead(nextExcluded);
      } else {
        addToast({
          type: "error",
          title: "Erro ao classificar",
          message: err.message || "Não foi possível salvar a classe.",
        });
      }
    } finally {
      setIsSavingAction(false);
    }
  };

  // Skip current lead - does not modify DB, adds to local session excludeIds, fetches next lead
  const handleSkipLead = () => {
    if (!currentLead || isSavingAction || isLoadingNext) return;

    const nextExcluded = [...sessionStats.skippedLeadIds, currentLead.id];
    setSessionStats((prev) => ({
      ...prev,
      skippedLeadIds: nextExcluded,
    }));

    addToast({
      type: "info",
      title: "Lead pulado",
      message: "Avançando para o próximo lead da fila.",
      duration: 2000,
    });

    fetchNextLead(nextExcluded);
  };

  // Delete current lead - soft delete, updates trash, fetches next lead
  const handleConfirmDelete = async () => {
    if (!currentLead) return;

    setIsDeleting(true);
    try {
      const leadIdToDelete = currentLead.id;
      const res = await api.deleteLead(leadIdToDelete);

      if (res.success) {
        removeLeadFromState(leadIdToDelete);
        setSessionStats((prev) => ({
          ...prev,
          deletedCount: prev.deletedCount + 1,
          skippedLeadIds: [...prev.skippedLeadIds, leadIdToDelete],
        }));

        addToast({
          type: "success",
          title: "Lead enviado para Lixeira",
          message: res.message || "O Lead foi excluído com sucesso.",
          duration: 3000,
        });

        setIsDeleteModalOpen(false);
        const nextExcluded = [...sessionStats.skippedLeadIds, leadIdToDelete];
        fetchNextLead(nextExcluded);
      }
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao excluir Lead",
        message: err.message || "Não foi possível excluir o lead.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Mark as Contacted - validates class != PENDENTE, requires script, updates DB, advances next lead
  const handleMarkContacted = async () => {
    if (!currentLead || isSavingAction || isLoadingNext) return;

    // Validation: cannot contact while class is PENDENTE
    if (currentLead.manualClass === "PENDENTE") {
      addToast({
        type: "warning",
        title: "Classificação obrigatória",
        message: "Classifique este Lead (A, B ou C) antes de registrar o primeiro contato.",
        duration: 4000,
      });
      return;
    }

    // Validation: script selection required
    if (!selectedScriptId) {
      addToast({
        type: "warning",
        title: "Script obrigatório",
        message: "Selecione um Script ativo para registrar este primeiro contato.",
        duration: 4000,
      });
      return;
    }

    setIsSavingAction(true);
    try {
      const updated = await api.updateLead(currentLead.id, {
        status: "contatado",
        scriptVersionId: selectedScriptId,
        expectedVersion: currentLead.version,
      });

      upsertLeadInState(updated);
      await refreshMetrics();

      setSessionStats((prev) => ({
        ...prev,
        contactedCount: prev.contactedCount + 1,
        skippedLeadIds: [...prev.skippedLeadIds, currentLead.id],
      }));

      addToast({
        type: "success",
        title: "Contato registrado!",
        message: `Primeiro contato salvo com sucesso.`,
        duration: 3000,
      });

      const nextExcluded = [...sessionStats.skippedLeadIds, currentLead.id];
      fetchNextLead(nextExcluded);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        addToast({
          type: "warning",
          title: "Conflito de versão",
          message: "Este Lead foi modificado simultaneamente. Carregando próximo...",
        });
        const nextExcluded = [...sessionStats.skippedLeadIds, currentLead.id];
        fetchNextLead(nextExcluded);
      } else {
        addToast({
          type: "error",
          title: "Erro ao registrar contato",
          message: err.message || "Não foi possível registrar o contato.",
        });
      }
    } finally {
      setIsSavingAction(false);
    }
  };

  // Goal metrics today
  const activeGoalToday = metrics?.activeGoalToday;
  const goalTarget = activeGoalToday?.target ?? 0;
  const goalAchieved = activeGoalToday?.achieved ?? 0;
  const goalPercentage = activeGoalToday?.percentage ?? 0;
  const goalRemaining = Math.max(0, goalTarget - goalAchieved);

  // Audience goal today if filtering by single audience
  const audienceGoalToday = useMemo(() => {
    if (!frozenFilters?.audienceId || !activeGoalToday?.byAudience) return null;
    return activeGoalToday.byAudience.find((a) => a.audienceId === frozenFilters.audienceId) || null;
  }, [frozenFilters, activeGoalToday]);

  // Canonical Instagram URL
  const instagramUrl = useMemo(() => {
    if (!currentLead) return "#";
    if (currentLead.instagramUsernameNormalized) {
      return `https://instagram.com/${currentLead.instagramUsernameNormalized}`;
    }
    return currentLead.instagramUrl || "#";
  }, [currentLead]);

  // ==========================================
  // VIEW 1: FILTER CONFIGURATION SCREEN
  // ==========================================
  if (phase === "filters") {
    return (
      <div id="prospect-now-filters-view" className="space-y-6 animate-in fade-in pb-12">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              id="btn-prospect-back-table"
              onClick={() => setLeadViewMode("table")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Voltar para a Tabela de Leads"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-2xs">
                  <Zap className="w-3 h-3 fill-current" />
                  Modo de Operação Rápida
                </span>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  Prospectar Agora
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha quais Leads deseja trabalhar nesta sessão focada de prospecção.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-prospect-return-leads"
              onClick={() => setLeadViewMode("table")}
              className="text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Voltar para Lista
            </button>
          </div>
        </div>

        {/* Filter Configuration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-4xl mx-auto">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Filtros da Sessão de Trabalho
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Os filtros ficarão congelados durante toda a sessão até você concluir os contatos ou alterar manualmente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Audience / Nicho Filter */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Público-Alvo / Nicho
              </label>
              <select
                id="select-prospect-audience"
                value={selectedAudienceId}
                onChange={(e) => setSelectedAudienceId(e.target.value)}
                className="w-full text-xs font-medium border border-slate-200 rounded-xl p-3 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Todos os Públicos Ativos</option>
                {audiences
                  .filter((a) => a.isActive && !a.isDeleted)
                  .map((aud) => (
                    <option key={aud.id} value={aud.id}>
                      {aud.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Filtre apenas os leads pertencentes ao nicho selecionado.
              </p>
            </div>

            {/* 2. Discovery Source */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                Origem de Descoberta
              </label>
              <select
                id="select-prospect-discovery-source"
                value={selectedDiscoverySource}
                onChange={(e) =>
                  setSelectedDiscoverySource(e.target.value as "all" | "apify" | "manual")
                }
                className="w-full text-xs font-medium border border-slate-200 rounded-xl p-3 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Todas as Origens Ativas</option>
                <option value="apify">Importado via Apify (Automação)</option>
                <option value="manual">Manual (Cadastrado Individualmente)</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Apenas leads de Prospecção Ativa (tráfego pago não entra na prospecção ativa).
              </p>
            </div>

            {/* 3. Operational Classes */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Classes Operacionais Desejadas
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "PENDENTE", label: "Pendente", desc: "Ainda não classificado", color: "bg-amber-50 border-amber-200 text-amber-800" },
                  { id: "A", label: "Classe A", desc: "Alta prioridade & fit", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                  { id: "B", label: "Classe B", desc: "Fit moderado", color: "bg-blue-50 border-blue-200 text-blue-800" },
                  { id: "C", label: "Classe C", desc: "Baixo fit / simples", color: "bg-slate-50 border-slate-200 text-slate-800" },
                ].map((item) => {
                  const isChecked = selectedClasses.includes(item.id as OperationalClass);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`toggle-class-${item.id}`}
                      onClick={() => handleToggleClass(item.id as OperationalClass)}
                      className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isChecked
                          ? "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                          : "border-slate-200 bg-white hover:bg-slate-50 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{item.label}</span>
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 mt-1">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Import Batch Filter */}
            {importBatches.length > 0 && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  Lote de Importação Específico (Opcional)
                </label>
                <select
                  id="select-prospect-batch"
                  value={selectedImportBatchId}
                  onChange={(e) => setSelectedImportBatchId(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl p-3 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="all">Todos os Lotes de Importação</option>
                  {importBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.keywords.slice(0, 2).join(", ")} • {b.audienceName || "Geral"} (
                      {new Date(b.createdAt).toLocaleDateString("pt-BR")}) - {b.importedCount} leads
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Real-time Lead Availability Counter & Start Button */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  availableCountInFilters > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Leads Elegíveis Disponíveis</div>
                <div className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {isCountingFilters ? (
                    <span className="text-slate-400 text-sm">Calculando...</span>
                  ) : (
                    <span>{availableCountInFilters} Leads</span>
                  )}
                </div>
              </div>
            </div>

            <button
              id="btn-start-prospecting-session"
              disabled={availableCountInFilters === 0 || isCountingFilters}
              onClick={handleStartProspecting}
              className={`flex items-center gap-2 font-bold px-6 py-3.5 rounded-xl shadow-xs transition-all text-sm cursor-pointer ${
                availableCountInFilters > 0 && !isCountingFilters
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/25"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Iniciar Prospecção</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {availableCountInFilters === 0 && !isCountingFilters && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Nenhum Lead ativo não contatado corresponde aos filtros selecionados. Tente habilitar mais classes ou alterar o público.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SESSION COMPLETED SUMMARY
  // ==========================================
  if (phase === "completed") {
    return (
      <div id="prospect-now-completed-view" className="space-y-6 animate-in zoom-in-95 pb-12 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Sessão Concluída!
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Você revisou e trabalhou todos os leads elegíveis para os filtros definidos.
            </p>
          </div>

          {/* Session Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left">
            <div className="p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Contatados</div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {sessionStats.contactedCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Classificados</div>
              <div className="text-2xl font-extrabold text-indigo-600">
                {sessionStats.classifiedCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Pulados</div>
              <div className="text-2xl font-extrabold text-slate-700">
                {sessionStats.skippedLeadIds.length}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-[11px] font-semibold text-slate-500">Excluídos</div>
              <div className="text-2xl font-extrabold text-rose-600">
                {sessionStats.deletedCount}
              </div>
            </div>
          </div>

          {/* Daily Goal Status Banner */}
          <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-2xl text-left space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5 text-amber-800">
                <Target className="w-4 h-4 text-amber-600" />
                Meta Diária Geral (Hoje)
              </span>
              <span className="text-slate-600">
                {goalAchieved} / {goalTarget} contatos ({goalPercentage.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  goalPercentage >= 100 ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, goalPercentage)}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>{goalAchieved >= goalTarget ? "Meta batida com sucesso! 🎉" : `Faltam ${goalRemaining} contatos para bater a meta.`}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              id="btn-completed-change-filters"
              onClick={() => setPhase("filters")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-5 py-3 rounded-xl transition-colors text-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Alterar Filtros e Continuar</span>
            </button>

            <button
              id="btn-completed-return-table"
              onClick={() => setLeadViewMode("table")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-xs transition-all text-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Voltar para Tabela de Leads</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: ACTIVE LEAD WORKING SCREEN
  // ==========================================
  return (
    <div id="prospect-now-working-view" className="space-y-4 animate-in fade-in pb-12 max-w-5xl mx-auto">
      {/* 1. Top Header with Daily Goal & Remaining Leads Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Module title & exit */}
          <div className="flex items-center gap-3">
            <button
              id="btn-prospect-exit-session"
              onClick={() => setPhase("filters")}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Voltar aos filtros da sessão"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-2xs">
                  <Zap className="w-3 h-3 fill-current" />
                  Prospectar Agora
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Sessão Ativa ({currentAudienceName})
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Leads na sessão: <strong>{remainingCount} restantes</strong></span>
                <span>•</span>
                <span>Contatados nesta sessão: <strong className="text-emerald-600">{sessionStats.contactedCount}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Meta de Hoje Progress */}
          <div className="w-full md:w-80 bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1 text-slate-700">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                Meta Diária:
              </span>
              <span className="font-extrabold text-slate-900">
                {goalTarget > 0 ? (
                  `${goalAchieved} / ${goalTarget}`
                ) : (
                  "Sem meta ativa hoje"
                )}
              </span>
            </div>

            {goalTarget > 0 && (
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    goalPercentage >= 100 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, goalPercentage)}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
              <span>{goalAchieved >= goalTarget ? "Meta batida! 🎯" : `${goalRemaining} restantes`}</span>
              {audienceGoalToday && audienceGoalToday.target > 0 && (
                <span>
                  {audienceGoalToday.audienceName}: {audienceGoalToday.achieved}/{audienceGoalToday.target}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Work Area (Lead Profile + Script + Actions) */}
      {isLoadingNext && !currentLead ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          Carregando próximo lead da fila...
        </div>
      ) : currentLead ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT COLUMN: Lead Information & Classification (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              {/* Instagram Handle & Direct Link */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      id="prospect-lead-username"
                      className="text-xl font-extrabold text-slate-900 truncate tracking-tight"
                    >
                      {currentLead.instagramUsernameNormalized ? (
                        `@${currentLead.instagramUsernameNormalized}`
                      ) : (
                        currentLead.temporaryLabel || "Lead sem identificador"
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {currentLead.profileData?.fullName || currentLead.temporaryLabel || "Perfil do Instagram"}
                    </p>
                  </div>

                  {instagramUrl !== "#" && (
                    <a
                      id="btn-open-instagram-link"
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
                    >
                      <span>Abrir Instagram</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                    {currentAudienceName}
                  </span>

                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                    {currentLead.discoverySource === "apify" ? "Apify (Automático)" : "Manual"}
                  </span>

                  {currentLead.profileData?.followerCount !== undefined && (
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      {currentLead.profileData.followerCount.toLocaleString("pt-BR")} seguidores
                    </span>
                  )}

                  {currentLead.profileData?.isPrivate && (
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-lg">
                      Perfil Privado
                    </span>
                  )}
                </div>
              </div>

              {/* Profile Bio if available */}
              {currentLead.profileData?.biography && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                    Biografia
                  </span>
                  {currentLead.profileData.biography}
                </div>
              )}

              {/* Lead Notes if available */}
              {currentLead.notes && (
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                  <span className="text-[10px] font-bold text-amber-600 block uppercase mb-0.5">
                    Notas Internas
                  </span>
                  {currentLead.notes}
                </div>
              )}

              {/* Classification Selector (A, B, C) */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Classificação Operacional
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Atual: <strong>{currentLead.manualClass}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(["A", "B", "C"] as const).map((cls) => {
                    const isSelected = currentLead.manualClass === cls;
                    return (
                      <button
                        key={cls}
                        type="button"
                        id={`btn-prospect-class-${cls.toLowerCase()}`}
                        disabled={isSavingAction}
                        onClick={() => handleClassifyLead(cls)}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer border ${
                          isSelected
                            ? cls === "A"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : cls === "B"
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-slate-800 text-white border-slate-800 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm">{cls}</span>
                        <span className="text-[10px] font-normal opacity-80">
                          {cls === "A" ? "Alta prioridade" : cls === "B" ? "Moderado" : "Simples"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {currentLead.manualClass === "PENDENTE" && (
                  <p className="text-[11px] text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Selecione A, B ou C para poder registrar o primeiro contato.</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Script Selection, Script Content & Action Controls (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              {/* Script Header & Dropdown */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    Script de Abordagem para este Nicho
                  </label>

                  {activeScript && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Versão v{activeScript.version}
                    </span>
                  )}
                </div>

                {currentAudienceScripts.length > 0 ? (
                  <select
                    id="select-prospect-script"
                    value={selectedScriptId}
                    onChange={(e) => setSelectedScriptId(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    {currentAudienceScripts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.baseName} (v{s.version})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                    Nenhum Script ativo cadastrado para este Público ({currentAudienceName}).
                  </div>
                )}
              </div>

              {/* Script Text Box & Copy Button */}
              {activeScript && (
                <div className="space-y-2">
                  <div className="relative">
                    <div
                      id="prospect-script-content"
                      className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/90 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto select-all"
                    >
                      {activeScript.content}
                    </div>

                    <button
                      id="btn-prospect-copy-script"
                      type="button"
                      onClick={handleCopyScript}
                      className={`absolute top-2.5 right-2.5 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs ${
                        isCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Script</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 text-right">
                    Copie a mensagem, envie no Instagram e clique em Contatado.
                  </p>
                </div>
              )}

              {/* Bottom Action Controls: Skip, Delete, Contacted */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Delete Button */}
                  <button
                    id="btn-prospect-delete"
                    type="button"
                    disabled={isSavingAction || isLoadingNext}
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
                    title="Excluir este lead e enviar para a lixeira"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>

                  {/* Skip Button */}
                  <button
                    id="btn-prospect-skip"
                    type="button"
                    disabled={isSavingAction || isLoadingNext}
                    onClick={handleSkipLead}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                    title="Pular lead sem registrar contato"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Pular Lead</span>
                  </button>
                </div>

                {/* Mark as Contacted Button (Primary CTA) */}
                <button
                  id="btn-prospect-contacted"
                  type="button"
                  disabled={
                    isSavingAction ||
                    isLoadingNext ||
                    currentLead.manualClass === "PENDENTE" ||
                    !selectedScriptId
                  }
                  onClick={handleMarkContacted}
                  className={`flex items-center justify-center gap-2 font-extrabold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer ${
                    currentLead.manualClass !== "PENDENTE" && selectedScriptId && !isSavingAction
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingAction ? "Registrando..." : "✓ Contatado (Avançar)"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal for Delete */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Excluir este Lead?"
        description={
          <span>
            O lead <strong>@{currentLead?.instagramUsernameNormalized || currentLead?.temporaryLabel}</strong>{" "}
            será enviado para a Lixeira e removido da fila de prospecção. Você poderá restaurá-lo na aba Configurações se necessário.
          </span>
        }
        confirmText="Sim, Excluir Lead"
        cancelText="Cancelar"
      />
    </div>
  );
};
