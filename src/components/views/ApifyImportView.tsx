import React, { useState, useEffect } from "react";
import {
  Instagram,
  Key,
  Play,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sliders,
  Filter,
  Users,
  Search,
  ExternalLink,
  ShieldCheck,
  FileSpreadsheet,
  Sparkles,
  Wand2,
  MapPin,
  Check,
  Zap,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";
import { ImportBatch, ImportConfig, AiImportStrategyResult } from "../../types";
import { formatSaoPauloDateTime } from "../../utils/dateUtils";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";

interface ApifyImportViewProps {
  onNavigateToLeads?: (filterParams?: { importBatchId?: string }) => void;
}

export const ApifyImportView: React.FC<ApifyImportViewProps> = ({ onNavigateToLeads }) => {
  const { audiences, addToast, refreshAll } = useCrm();

  // Integration state
  const [apifyStatus, setApifyStatus] = useState<{
    configured: boolean;
    status: "connected" | "not_configured" | "error";
    maskedToken?: string;
    accountId?: string;
    accountUsername?: string;
    lastTestAt?: string;
    errorMessage?: string;
  } | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);

  // Import Batches and Configs
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [configs, setConfigs] = useState<ImportConfig[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // New Scrape / Run Form
  const [selectedAudienceId, setSelectedAudienceId] = useState(audiences[0]?.id || "");
  const [configName, setConfigName] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [limitPerKeyword, setLimitPerKeyword] = useState<number>(20);
  const [minFollowers, setMinFollowers] = useState<string>("1000");
  const [maxFollowers, setMaxFollowers] = useState<string>("");
  const [ignorePrivate, setIgnorePrivate] = useState<boolean>(true);
  const [saveAsConfig, setSaveAsConfig] = useState<boolean>(false);
  const [isStartingImport, setIsStartingImport] = useState(false);

  // AI Strategy Assistant State (V2.1.1)
  const [aiLocation, setAiLocation] = useState("");
  const [aiMode, setAiMode] = useState<"quality" | "balanced" | "volume">("balanced");
  const [isGeneratingAiStrategy, setIsGeneratingAiStrategy] = useState(false);
  const [generatedStrategy, setGeneratedStrategy] = useState<AiImportStrategyResult | null>(null);

  // Delete modal state
  const [deleteConfigTarget, setDeleteConfigTarget] = useState<ImportConfig | null>(null);
  const [isDeletingConfig, setIsDeletingConfig] = useState(false);

  // Refreshing Batch IDs
  const [refreshingBatchId, setRefreshingBatchId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [statusRes, batchesRes, configsRes] = await Promise.all([
        api.getApifyStatus(),
        api.getImportBatches(),
        api.getImportConfigs(),
      ]);
      setApifyStatus(statusRes);
      setBatches(batchesRes);
      setConfigs(configsRes);
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao carregar dados da Apify",
        message: err.message,
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      addToast({ type: "error", title: "Informe o token da Apify." });
      return;
    }
    setIsSavingToken(true);
    try {
      const updated = await api.saveApifyToken(tokenInput.trim());
      setApifyStatus(updated);
      setIsEditingToken(false);
      setTokenInput("");
      addToast({
        type: "success",
        title: "Integração Apify Conectada!",
        message: `Conta autenticada com sucesso${updated.accountUsername ? ` (@${updated.accountUsername})` : ""}.`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Falha na validação do token",
        message: err.message || "Token inválido ou não autorizado na Apify.",
      });
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingToken(true);
    try {
      const res = await api.testApifyConnection();
      if (res.success) {
        addToast({
          type: "success",
          title: "Conexão Ativa e Saudável",
          message: `Usuário Apify: ${res.user?.username || res.user?.id || "OK"}`,
        });
        await loadData();
      } else {
        addToast({
          type: "error",
          title: "Erro na conexão",
          message: res.error || "Não foi possível contactar a API da Apify.",
        });
      }
    } catch (err: any) {
      addToast({ type: "error", title: "Erro no teste", message: err.message });
    } finally {
      setIsTestingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!window.confirm("Deseja desconectar a integração com a Apify?")) return;
    try {
      await api.removeApifyToken();
      setApifyStatus({ configured: false, status: "not_configured" });
      addToast({ type: "success", title: "Token da Apify removido." });
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    }
  };

  const handleAddKeyword = () => {
    const clean = keywordInput.trim();
    if (!clean) return;
    if (keywords.includes(clean)) {
      setKeywordInput("");
      return;
    }
    if (keywords.length >= 25) {
      addToast({ type: "warning", title: "Limite de 25 palavras-chave por busca atingido." });
      return;
    }
    setKeywords([...keywords, clean]);
    setKeywordInput("");
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== kwToRemove));
  };

  const handleSelectSavedConfig = (cfg: ImportConfig) => {
    setSelectedAudienceId(cfg.audienceId);
    setKeywords(cfg.keywords);
    setLimitPerKeyword(cfg.searchLimitPerKeyword);
    setMinFollowers(cfg.minFollowers !== undefined ? String(cfg.minFollowers) : "");
    setMaxFollowers(cfg.maxFollowers !== undefined ? String(cfg.maxFollowers) : "");
    setIgnorePrivate(cfg.ignorePrivate);
    addToast({
      type: "info",
      title: "Configuração Carregada",
      message: `Modelo "${cfg.name}" aplicado ao formulário.`,
    });
  };

  const handleDeleteConfigClick = (cfg: ImportConfig) => {
    setDeleteConfigTarget(cfg);
  };

  const handleConfirmDeleteConfig = async () => {
    if (!deleteConfigTarget) return;
    setIsDeletingConfig(true);
    try {
      await api.deleteImportConfig(deleteConfigTarget.id);
      setConfigs(configs.filter((c) => c.id !== deleteConfigTarget.id));
      addToast({ type: "success", title: "Modelo movido para a lixeira com sucesso." });
      setDeleteConfigTarget(null);
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao excluir modelo", message: err.message });
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleGenerateAiStrategy = async () => {
    if (!selectedAudienceId) {
      addToast({
        type: "error",
        title: "Público Obrigatório",
        message: "Selecione um público-alvo para calibrar a estratégia com IA.",
      });
      return;
    }

    setIsGeneratingAiStrategy(true);
    try {
      const strategy = await api.generateAiImportStrategy({
        audienceId: selectedAudienceId,
        location: aiLocation.trim() || undefined,
        mode: aiMode,
      });

      setGeneratedStrategy(strategy);
      addToast({
        type: "success",
        title: "Estratégia IA Gerada!",
        message: `${strategy.suggestedKeywords.length} termos de busca e filtros calibrados com base no perfil do nicho.`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao gerar estratégia com IA",
        message: err.message || "Não foi possível gerar a estratégia no momento.",
      });
    } finally {
      setIsGeneratingAiStrategy(false);
    }
  };

  const handleApplyAiStrategy = (mode: "replace" | "append" = "replace") => {
    if (!generatedStrategy) return;

    const stratKeywords = generatedStrategy.keywords || generatedStrategy.suggestedKeywords || [];
    const stratSearchLimit = generatedStrategy.searchLimitPerKeyword ?? generatedStrategy.suggestedSearchLimit;
    const stratMinFollowers = generatedStrategy.minFollowers ?? generatedStrategy.suggestedMinFollowers;
    const stratMaxFollowers = generatedStrategy.maxFollowers !== undefined ? generatedStrategy.maxFollowers : generatedStrategy.suggestedMaxFollowers;
    const stratIgnorePrivate = generatedStrategy.ignorePrivate !== undefined ? generatedStrategy.ignorePrivate : generatedStrategy.suggestedIgnorePrivate;

    if (mode === "replace") {
      setKeywords(stratKeywords);
    } else {
      const merged = Array.from(new Set([...keywords, ...stratKeywords]));
      setKeywords(merged.slice(0, 25));
    }

    if (stratSearchLimit !== undefined) {
      setLimitPerKeyword(stratSearchLimit);
    }

    if (stratMinFollowers !== undefined) {
      setMinFollowers(String(stratMinFollowers));
    }

    if (stratMaxFollowers !== undefined && stratMaxFollowers !== null) {
      setMaxFollowers(String(stratMaxFollowers));
    } else {
      setMaxFollowers("");
    }

    if (stratIgnorePrivate !== undefined) {
      setIgnorePrivate(stratIgnorePrivate);
    }

    addToast({
      type: "success",
      title: "Estratégia Aplicada ao Formulário",
      message: "Parâmetros preenchidos. Revise e clique em 'Iniciar Importação na Apify' quando estiver pronto.",
    });
  };

  const handleStartImport = async () => {
    if (!apifyStatus?.configured) {
      addToast({
        type: "error",
        title: "Apify Não Configurada",
        message: "Configure o seu token da Apify antes de executar buscas.",
      });
      return;
    }

    if (!selectedAudienceId) {
      addToast({ type: "error", title: "Selecione o público-alvo de destino." });
      return;
    }

    if (keywords.length === 0) {
      addToast({ type: "error", title: "Adicione ao menos 1 palavra-chave para a busca." });
      return;
    }

    const minF = minFollowers.trim() ? Number(minFollowers) : undefined;
    const maxF = maxFollowers.trim() ? Number(maxFollowers) : undefined;

    if (minF !== undefined && maxF !== undefined && minF > maxF) {
      addToast({ type: "error", title: "O mínimo de seguidores não pode ser maior que o máximo." });
      return;
    }

    setIsStartingImport(true);
    try {
      let createdConfigId: string | undefined = undefined;

      if (saveAsConfig && configName.trim()) {
        const newCfg = await api.createImportConfig({
          name: configName.trim(),
          audienceId: selectedAudienceId,
          keywords,
          searchLimitPerKeyword: limitPerKeyword,
          minFollowers: minF,
          maxFollowers: maxF,
          ignorePrivate,
        });
        createdConfigId = newCfg.id;
        setConfigs([newCfg, ...configs]);
      }

      const batch = await api.startApifyImport({
        configId: createdConfigId,
        audienceId: selectedAudienceId,
        keywords,
        searchLimitPerKeyword: limitPerKeyword,
        minFollowers: minF,
        maxFollowers: maxF,
        ignorePrivate,
      });

      setBatches([batch, ...batches]);
      addToast({
        type: "success",
        title: "Importação Iniciada na Apify!",
        message: `Lote ${batch.id} disparado para ${batch.requestedCount} perfis previstos.`,
      });

      // Clear some form inputs
      setSaveAsConfig(false);
      setConfigName("");
      await refreshAll();
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Falha ao iniciar importação",
        message: err.message || "Erro de comunicação com a Apify.",
      });
    } finally {
      setIsStartingImport(false);
    }
  };

  const handleRefreshBatch = async (batchId: string) => {
    setRefreshingBatchId(batchId);
    try {
      const updated = await api.refreshImportBatch(batchId);
      setBatches(batches.map((b) => (b.id === updated.id ? updated : b)));
      if (updated.status === "completed") {
        addToast({
          type: "success",
          title: "Importação Concluída!",
          message: `${updated.importedCount} novos leads adicionados como PENDENTE.`,
        });
        await refreshAll();
      } else if (updated.status === "failed") {
        addToast({
          type: "error",
          title: "Execução Falhou",
          message: updated.errorMessage || "Erro durante o processamento do scraper.",
        });
      } else {
        addToast({
          type: "info",
          title: "Status Atualizado",
          message: `Scraper em andamento na Apify (Status: ${updated.status}).`,
        });
      }
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao consultar lote", message: err.message });
    } finally {
      setRefreshingBatchId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-xs">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                Importador de Leads do Instagram (Apify)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Busque criadores de conteúdo e negócios por palavras-chave com deduplicação atômica e ingestão segura.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoadingData}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin text-indigo-600" : ""}`} />
            <span>Atualizar Painel</span>
          </button>
        </div>
      </div>

      {/* 1. Integration Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                apifyStatus?.status === "connected"
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : apifyStatus?.status === "error"
                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}
            >
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Integração Oficial com Apify Scraper
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    apifyStatus?.status === "connected"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : apifyStatus?.status === "error"
                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {apifyStatus?.status === "connected"
                    ? "Conectado e Ativo"
                    : apifyStatus?.status === "error"
                    ? "Erro na Conexão"
                    : "Token Não Configurado"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {apifyStatus?.configured
                  ? `Token ativo: ${apifyStatus.maskedToken || "••••••••"} ${
                      apifyStatus.accountUsername ? `| Conta: @${apifyStatus.accountUsername}` : ""
                    }`
                  : "Conecte sua conta da Apify para habilitar o scraper automatizado de perfis do Instagram."}
              </p>
              {apifyStatus?.errorMessage && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{apifyStatus.errorMessage}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {apifyStatus?.configured && !isEditingToken && (
              <>
                <button
                  onClick={handleTestConnection}
                  disabled={isTestingToken}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className={`w-4 h-4 ${isTestingToken ? "animate-spin text-indigo-600" : ""}`} />
                  <span>{isTestingToken ? "Testando..." : "Testar Conexão"}</span>
                </button>
                <button
                  onClick={() => setIsEditingToken(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Alterar Token
                </button>
                <button
                  onClick={handleRemoveToken}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Desconectar
                </button>
              </>
            )}

            {(!apifyStatus?.configured || isEditingToken) && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Insira seu Apify API Token (apify_api_...)"
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-64"
                />
                <button
                  onClick={handleSaveToken}
                  disabled={isSavingToken}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingToken ? "Validando..." : "Salvar"}
                </button>
                {isEditingToken && (
                  <button
                    onClick={() => {
                      setIsEditingToken(false);
                      setTokenInput("");
                    }}
                    className="text-slate-500 hover:text-slate-700 text-xs px-2 py-2"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Grid: New Search Form + Saved Configs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form de Importação */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Configurar Nova Importação</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Actor: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">apify/instagram-search-scraper</code>
            </span>
          </div>

          <div className="space-y-4">
            {/* Audience Destination */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Público-Alvo de Destino <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedAudienceId}
                onChange={(e) => setSelectedAudienceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {audiences.map((aud) => (
                  <option key={aud.id} value={aud.id}>
                    {aud.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Os leads importados entrarão automaticamente com classe <strong>PENDENTE</strong> e status <strong>NOVO</strong> neste nicho.
              </p>
            </div>

            {/* AI Search Strategy Assistant (V2.1.1) */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 rounded-2xl border border-indigo-100/80 p-4 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">
                      Assistente IA de Estratégia de Busca
                    </h4>
                    <p className="text-[11px] text-indigo-800/80">
                      Gere automaticamente palavras-chave, limites e filtros calibrados para este público.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Localização / Região (Opcional)
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={aiLocation}
                      onChange={(e) => setAiLocation(e.target.value)}
                      placeholder="Ex: São Paulo, Rio de Janeiro, Brasil..."
                      className="w-full bg-white border border-indigo-200/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Modo de Busca
                  </label>
                  <select
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value as any)}
                    className="w-full bg-white border border-indigo-200/80 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="quality">Mais Qualidade (Filtros Estritos)</option>
                    <option value="balanced">Equilibrado (Recomendado)</option>
                    <option value="volume">Mais Volume (Filtros Amplos)</option>
                  </select>
                </div>

                <div className="sm:col-span-3 flex items-end">
                  <button
                    type="button"
                    onClick={handleGenerateAiStrategy}
                    disabled={isGeneratingAiStrategy || !selectedAudienceId}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${isGeneratingAiStrategy ? "animate-spin" : ""}`} />
                    <span>{isGeneratingAiStrategy ? "Gerando..." : "Gerar com IA"}</span>
                  </button>
                </div>
              </div>

              {/* Generated Strategy Preview Card */}
              {generatedStrategy && (() => {
                const stratKeywords = generatedStrategy.keywords || generatedStrategy.suggestedKeywords || [];
                const stratSearchLimit = generatedStrategy.searchLimitPerKeyword ?? generatedStrategy.suggestedSearchLimit ?? 20;
                const stratMinFollowers = generatedStrategy.minFollowers ?? generatedStrategy.suggestedMinFollowers ?? 500;
                const stratMaxFollowers = generatedStrategy.maxFollowers !== undefined ? generatedStrategy.maxFollowers : generatedStrategy.suggestedMaxFollowers;
                const stratIgnorePrivate = generatedStrategy.ignorePrivate !== undefined ? generatedStrategy.ignorePrivate : (generatedStrategy.suggestedIgnorePrivate ?? true);
                const stratRationale = generatedStrategy.targetAudienceRationale || generatedStrategy.rationale || (generatedStrategy.reasoning?.summary ?? "");
                const isAiSource = generatedStrategy.source === "ai";

                return (
                  <div className="bg-white rounded-xl border border-indigo-200 p-3.5 space-y-3 mt-2 shadow-xs">
                    <div className="flex items-center justify-between border-b border-indigo-50 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isAiSource ? "Estratégia Recomendada por IA (OpenAI)" : "Estratégia Estruturada"}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {stratKeywords.length} termos identificados
                      </span>
                    </div>

                    {stratRationale && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {stratRationale}
                      </p>
                    )}

                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                        Palavras-chave sugeridas:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {stratKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-md border border-indigo-100 font-medium"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600 pt-1">
                      <span>
                        Limite sugerido: <strong>{stratSearchLimit} perfis/termo</strong>
                      </span>
                      <span>
                        Seguidores: <strong>{stratMinFollowers} - {stratMaxFollowers ? `${stratMaxFollowers}` : "Sem teto"}</strong>
                      </span>
                      <span>
                        Privados: <strong>{stratIgnorePrivate ? "Ignorar" : "Incluir"}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-50">
                      <span className="text-[11px] text-slate-500 italic">
                        Aplicar a estratégia preenche os campos do formulário para sua revisão.
                      </span>
                      <div className="flex items-center gap-2">
                        {keywords.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyAiStrategy("append")}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Adicionar aos Termos Atuais
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleApplyAiStrategy("replace")}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aplicar ao Formulário</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Palavras-chave de Busca no Instagram <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Ex: infoprodutor, mentor high ticket, dermatologista sp..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>

              {/* Tag Cloud */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 min-h-[32px]">
                {keywords.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    Nenhuma palavra-chave adicionada. Digite uma termo e clique em Adicionar.
                  </span>
                ) : (
                  keywords.map((kw) => (
                    <span
                      key={kw}
                      className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="text-indigo-400 hover:text-indigo-700 p-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Limits and Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Limite por Palavra-chave
                </label>
                <select
                  value={limitPerKeyword}
                  onChange={(e) => setLimitPerKeyword(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={10}>10 perfis por termo</option>
                  <option value={20}>20 perfis por termo</option>
                  <option value={30}>30 perfis por termo</option>
                  <option value={50}>50 perfis por termo</option>
                  <option value={100}>100 perfis por termo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mínimo de Seguidores
                </label>
                <input
                  type="number"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Máximo de Seguidores (Opcional)
                </label>
                <input
                  type="number"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(e.target.value)}
                  placeholder="Sem limite"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Privacy Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="ignore-private-check"
                checked={ignorePrivate}
                onChange={(e) => setIgnorePrivate(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="ignore-private-check" className="text-xs font-medium text-slate-700 cursor-pointer">
                Ignorar perfis privados (recomendado para prospecção ativa B2B)
              </label>
            </div>

            {/* Save as Config Template */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save-config-check"
                  checked={saveAsConfig}
                  onChange={(e) => setSaveAsConfig(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="save-config-check" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Salvar estes parâmetros como modelo reutilizável
                </label>
              </div>

              {saveAsConfig && (
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="Nome do modelo (ex: Infoprodutores High Ticket SP)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Previsão de busca: <strong className="text-slate-800">{keywords.length * limitPerKeyword} perfis</strong>
            </div>

            <button
              type="button"
              onClick={handleStartImport}
              disabled={isStartingImport || !apifyStatus?.configured}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className={`w-4 h-4 ${isStartingImport ? "animate-spin" : ""}`} />
              <span>{isStartingImport ? "Disparando Scraper..." : "Iniciar Importação na Apify"}</span>
            </button>
          </div>
        </div>

        {/* Right Col: Saved Config Templates */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Modelos Salvos</h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{configs.length} modelos</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[420px] pr-1">
            {configs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p>Nenhum modelo de importação salvo ainda.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Marque a opção "Salvar como modelo" ao configurar uma nova busca.
                </p>
              </div>
            ) : (
              configs.map((cfg) => {
                const aud = audiences.find((a) => a.id === cfg.audienceId);
                return (
                  <div
                    key={cfg.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 truncate">{cfg.name}</h4>
                      <button
                        onClick={() => handleDeleteConfigClick(cfg)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Excluir modelo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p>
                        Público: <strong className="text-slate-700">{aud?.name || "Geral"}</strong>
                      </p>
                      <p>
                        Termos: <strong className="text-slate-700">{cfg.keywords.join(", ")}</strong>
                      </p>
                      <p>
                        Limite: <strong className="text-slate-700">{cfg.searchLimitPerKeyword}/termo</strong>
                        {cfg.minFollowers ? ` | Min: ${cfg.minFollowers}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectSavedConfig(cfg)}
                      className="w-full bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 text-xs font-semibold py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Aplicar Parâmetros
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Import Batches History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Histórico de Lotes de Importação</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe o status dos scrapers disparados, volume de leads importados e bloqueio de duplicidades.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
            Total de Lotes: {batches.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                <th className="py-2.5 px-3">Data / Lote</th>
                <th className="py-2.5 px-3">Público</th>
                <th className="py-2.5 px-3">Palavras-chave</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Recebidos</th>
                <th className="py-2.5 px-3 text-right">Novos (Importados)</th>
                <th className="py-2.5 px-3 text-right">Duplicados</th>
                <th className="py-2.5 px-3 text-right">Filtrados</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhum lote de importação registrado até o momento.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const aud = audiences.find((a) => a.id === batch.audienceId);
                  const isRefreshing = refreshingBatchId === batch.id;
                  return (
                    <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{formatSaoPauloDateTime(batch.createdAt)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{batch.id}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {batch.audienceName || aud?.name || "N/A"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-700 max-w-[180px] truncate" title={batch.keywords.join(", ")}>
                          {batch.keywords.join(", ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Previsão: {batch.requestedCount} perfis
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            batch.status === "completed"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : batch.status === "running" || batch.status === "processing"
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300 animate-pulse"
                              : batch.status === "failed"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {batch.status === "completed"
                            ? "Concluído"
                            : batch.status === "running"
                            ? "Scraper Rodando"
                            : batch.status === "processing"
                            ? "Processando..."
                            : batch.status === "failed"
                            ? "Falhou"
                            : batch.status}
                        </span>
                        {batch.errorMessage && (
                          <div className="text-[10px] text-rose-600 truncate max-w-[160px] mt-0.5" title={batch.errorMessage}>
                            {batch.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {batch.receivedCount || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">
                        +{batch.importedCount || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-amber-600">
                        {batch.duplicateCount || 0}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-400">
                        {batch.filteredCount || 0}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {batch.status === "running" || batch.status === "processing" ? (
                            <button
                              onClick={() => handleRefreshBatch(batch.id)}
                              disabled={isRefreshing}
                              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="Atualizar status do scraper na Apify"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                            </button>
                          ) : null}

                          {batch.importedCount > 0 && onNavigateToLeads && (
                            <button
                              onClick={() => onNavigateToLeads({ importBatchId: batch.id })}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                              title="Visualizar leads deste lote"
                            >
                              Ver Leads
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Delete Config Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteConfigTarget)}
        onClose={() => setDeleteConfigTarget(null)}
        onConfirm={handleConfirmDeleteConfig}
        isLoading={isDeletingConfig}
        title="Excluir Modelo de Importação"
        description={
          <span>
            Tem certeza que deseja mover o modelo{" "}
            <strong className="text-slate-900 font-semibold">"{deleteConfigTarget?.name}"</strong> para a lixeira?
            Você poderá restaurá-lo a qualquer momento em Configurações &gt; Lixeira.
          </span>
        }
        confirmText="Mover para Lixeira"
        cancelText="Cancelar"
        isPermanent={false}
      />
    </div>
  );
};
