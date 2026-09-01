import React, { useState, useRef } from "react";
import {
  X,
  Sparkles,
  Upload,
  Instagram,
  Tag,
  AlertTriangle,
  Check,
  FileText,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { AcquisitionSource, OperationalClass, PrintAnalysisResult } from "../../types";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";
import { normalizeInstagramInput } from "../../utils/instagramUtils";

export const NewLeadModal: React.FC = () => {
  const {
    isNewLeadModalOpen,
    setIsNewLeadModalOpen,
    audiences,
    refreshAll,
    addToast,
    openLeadDetails,
    settings,
  } = useCrm();

  const [source, setSource] = useState<AcquisitionSource>("active");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [temporaryLabel, setTemporaryLabel] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [manualClass, setManualClass] = useState<OperationalClass>("PENDENTE");
  const [notes, setNotes] = useState("");
  const [paidCampaign, setPaidCampaign] = useState("");
  const [paidCreative, setPaidCreative] = useState("");

  // Transient print upload & AI
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiResult, setAiResult] = useState<PrintAnalysisResult | null>(null);

  // Duplicate conflict state
  const [duplicateConflict, setDuplicateConflict] = useState<{
    leadId: string;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isNewLeadModalOpen) return null;

  const activeAudiences = audiences.filter((a) => a.isActive);
  const selectedAudience = audiences.find((a) => a.id === audienceId);

  // Normalize Instagram handle preview
  const normResult = instagramUrl ? normalizeInstagramInput(instagramUrl) : null;

  // Image downscaler & reader
  const processImageFile = (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      addToast({
        type: "error",
        title: "Arquivo inválido",
        message: "Por favor selecione uma imagem PNG, JPG ou WEBP.",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      addToast({
        type: "error",
        title: "Arquivo muito grande",
        message: "O print deve ter no máximo 8MB.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 2000;
        let width = img.width;
        let height = img.height;

        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setImageFile(file);
        setImagePreview(dataUrl);
        setAiResult(null);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyzeAi = async () => {
    if (!imagePreview) {
      addToast({
        type: "warning",
        title: "Print obrigatório",
        message: "Faça upload do print do perfil do Instagram antes de analisar.",
      });
      return;
    }
    if (!audienceId) {
      addToast({
        type: "warning",
        title: "Público obrigatório",
        message: "Selecione o Público/Nicho para que a IA possa avaliar os critérios corretos.",
      });
      return;
    }

    setIsAnalyzingAi(true);
    try {
      const res = await api.scorePrint({
        imageBase64: imagePreview,
        mimeType: "image/jpeg",
        audienceId,
        notes: notes || undefined,
      });
      setAiResult(res);
      addToast({
        type: "success",
        title: "Análise da IA Concluída",
        message: `Classe sugerida: ${res.suggestedClass} (Confiança: ${res.confidence}%)`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Falha na análise com IA",
        message: err.message || "Não foi possível analisar a imagem. Você pode definir a classe manualmente.",
      });
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSave = async (overrideDuplicate = false) => {
    // Basic validation
    if (source === "active") {
      if (!instagramUrl.trim()) {
        addToast({
          type: "error",
          title: "Campo obrigatório",
          message: "O link do Instagram é obrigatório para prospecção ativa.",
        });
        return;
      }
      if (!normResult?.isValid) {
        addToast({
          type: "error",
          title: "Instagram inválido",
          message: "Insira uma URL válida do Instagram ou @username.",
        });
        return;
      }
    } else {
      // Paid
      if (!instagramUrl.trim() && !temporaryLabel.trim()) {
        addToast({
          type: "error",
          title: "Identificador obrigatório",
          message: "Para tráfego pago sem Instagram, forneça um rótulo ou identificador.",
        });
        return;
      }
    }

    if (!audienceId) {
      addToast({
        type: "error",
        title: "Público obrigatório",
        message: "Selecione um público/nicho para o lead.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createLead({
        source,
        instagramUrl: instagramUrl.trim() || undefined,
        temporaryLabel: temporaryLabel.trim() || undefined,
        audienceId,
        manualClass,
        notes: notes.trim() || undefined,
        paidCampaign: paidCampaign.trim() || undefined,
        paidCreative: paidCreative.trim() || undefined,
        duplicateOverride: overrideDuplicate,
        aiEvaluation: aiResult || undefined,
      });

      addToast({
        type: "success",
        title: "Lead cadastrado com sucesso",
        message: `Lead ${created.instagramUsernameNormalized ? `@${created.instagramUsernameNormalized}` : created.temporaryLabel} adicionado.`,
      });

      // Clear form and close modal
      setIsNewLeadModalOpen(false);
      resetForm();
      await refreshAll();
    } catch (err: any) {
      if (err.status === 409 && err.duplicateLead) {
        setDuplicateConflict({
          leadId: err.duplicateLead.id,
          message: err.message,
        });
      } else {
        addToast({
          type: "error",
          title: "Erro ao salvar",
          message: err.message || "Não foi possível cadastrar o lead.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setInstagramUrl("");
    setTemporaryLabel("");
    setAudienceId("");
    setManualClass("PENDENTE");
    setNotes("");
    setPaidCampaign("");
    setPaidCreative("");
    setImageFile(null);
    setImagePreview(null);
    setAiResult(null);
    setDuplicateConflict(null);
  };

  return (
    <div
      id="new-lead-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="new-lead-modal-content"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Novo Lead de Prospecção</h2>
            <p className="text-xs text-slate-500">Cadastre um novo perfil para o funil comercial</p>
          </div>
          <button
            id="btn-close-modal"
            onClick={() => {
              setIsNewLeadModalOpen(false);
              resetForm();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Duplicate Conflict Alert */}
          {duplicateConflict && (
            <div
              id="duplicate-conflict-alert"
              className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-amber-950">Perfil Já Existente Detectado</div>
                  <p className="text-amber-800 mt-0.5">{duplicateConflict.message}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  id="btn-open-existing-lead"
                  onClick={() => {
                    setIsNewLeadModalOpen(false);
                    openLeadDetails(duplicateConflict.leadId);
                    resetForm();
                  }}
                  className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Abrir Lead Existente
                </button>
                <button
                  type="button"
                  id="btn-confirm-override"
                  onClick={() => handleSave(true)}
                  disabled={isSubmitting}
                  className="text-xs bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Confirmar Override (Cadastrar mesmo assim)
                </button>
              </div>
            </div>
          )}

          {/* 1. Acquisition Source Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Origem de Aquisição <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="source-active-btn"
                onClick={() => setSource("active")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  source === "active"
                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Instagram className="w-4 h-4" />
                <span>Prospecção Ativa (Instagram)</span>
              </button>
              <button
                type="button"
                id="source-paid-btn"
                onClick={() => setSource("paid")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  source === "paid"
                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Tráfego Pago (Anúncios)</span>
              </button>
            </div>
          </div>

          {/* 2. Instagram Link & Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link ou @ do Instagram {source === "active" && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                id="input-instagram-url"
                placeholder="https://instagram.com/perfil ou @perfil"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
              />
              {normResult?.isValid && (
                <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Normalizado: @{normResult.normalizedUsername}
                </p>
              )}
            </div>

            {source === "paid" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rótulo / Identificador do Lead {!instagramUrl && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  id="input-temporary-label"
                  placeholder="Ex: Lead Formulário #1042 - Marca X"
                  value={temporaryLabel}
                  onChange={(e) => setTemporaryLabel(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Público / Nicho <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-audience-active"
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">Selecione um público...</option>
                  {activeAudiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {source === "paid" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Público / Nicho <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select-audience-paid"
                  value={audienceId}
                  onChange={(e) => setAudienceId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-hidden"
                >
                  <option value="">Selecione um público...</option>
                  {activeAudiences.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Campanha (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Campanha Reels Q3"
                  value={paidCampaign}
                  onChange={(e) => setPaidCampaign(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Criativo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Video_Depoimento_01"
                  value={paidCreative}
                  onChange={(e) => setPaidCreative(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {/* 3. Operational Class Selector (Opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                3. Classificação Operacional <span className="text-[11px] font-normal text-slate-500">(Opcional - pode ser classificado depois)</span>
              </label>
              {selectedAudience && (
                <span className="text-[11px] text-slate-500">
                  Critérios: A (Excelente) | B (Médio) | C (Baixo)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                id="btn-class-PENDENTE"
                onClick={() => setManualClass("PENDENTE")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                  manualClass === "PENDENTE"
                    ? "bg-slate-100 border-slate-500 text-slate-900 shadow-xs ring-1 ring-slate-400"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs">Pendente</span>
                <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">
                  Classificar depois
                </span>
              </button>
              {(["A", "B", "C"] as OperationalClass[]).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  id={`btn-class-${cls}`}
                  onClick={() => setManualClass(cls)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                    manualClass === cls
                      ? cls === "A"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-1 ring-emerald-400"
                        : cls === "B"
                        ? "bg-amber-50 border-amber-500 text-amber-800 shadow-xs ring-1 ring-amber-400"
                        : "bg-slate-100 border-slate-400 text-slate-800 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs">Classe {cls}</span>
                  <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">
                    {cls === "A" ? "Alta Prioridade" : cls === "B" ? "Padrão" : "Secundário"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Transient Instagram Print Upload & AI Lead Scoring (Camada 5) */}
          <div
            id="print-upload-section"
            className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Análise Inteligente por Print do Instagram (Opcional)</span>
              </div>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">
                Privacidade V1: Print Transitório
              </span>
            </div>

            <p className="text-xs text-slate-500">
              O print é processado temporariamente na memória e descartado logo após a análise. Nenhuma imagem é gravada no banco.
            </p>

            {/* Drop Zone */}
            {!imagePreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  Arraste o print do perfil aqui ou clique para selecionar
                </p>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG ou WEBP até 8MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processImageFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800">Print carregado na memória</p>
                      <p className="text-[11px] text-slate-500">Pronto para envio à IA (OpenAI Vision)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setAiResult(null);
                      }}
                      className="text-xs text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      id="btn-run-ai-scoring"
                      onClick={handleAnalyzeAi}
                      disabled={isAnalyzingAi || !audienceId}
                      className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingAi ? "animate-spin" : ""}`} />
                      <span>{isAnalyzingAi ? "Analisando..." : "Analisar com IA"}</span>
                    </button>
                  </div>
                </div>

                {/* AI Scoring Result Presentation */}
                {aiResult && (
                  <div
                    id="ai-scoring-result"
                    className="p-4 rounded-xl bg-white border border-indigo-200 shadow-xs space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Sugestão da IA:</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            aiResult.suggestedClass === "A"
                              ? "bg-emerald-100 text-emerald-800"
                              : aiResult.suggestedClass === "B"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-200 text-slate-800"
                          }`}
                        >
                          Classe {aiResult.suggestedClass}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          (Confiança: {aiResult.confidence}%)
                        </span>
                      </div>
                      {aiResult.suggestedClass !== "INCONCLUSIVE" && (
                        <button
                          type="button"
                          id="btn-apply-suggested-class"
                          onClick={() => setManualClass(aiResult.suggestedClass as OperationalClass)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Aplicar Classe {aiResult.suggestedClass}
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {aiResult.rationale}
                    </p>

                    {aiResult.opportunity && (
                      <div className="text-xs bg-indigo-50/70 text-indigo-900 p-2.5 rounded-lg border border-indigo-100">
                        <strong>Oportunidade de Edição:</strong> {aiResult.opportunity}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {aiResult.strengths?.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <strong className="text-slate-800 block mb-1">Pontos Fortes:</strong>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                            {aiResult.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiResult.risks?.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded border border-slate-200">
                          <strong className="text-slate-800 block mb-1">Riscos / Objeções:</strong>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                            {aiResult.risks.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações Comerciais (Opcional)
            </label>
            <textarea
              id="input-lead-notes"
              rows={2}
              placeholder="Ex: Posta diariamente sobre finanças, estilo de edição atual é estático sem legendas dinâmicas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>A IA nunca é requisito obrigatório para salvar o lead.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-cancel-new-lead"
              onClick={() => {
                setIsNewLeadModalOpen(false);
                resetForm();
              }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              id="btn-save-new-lead"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>{isSubmitting ? "Salvando..." : "Salvar Lead"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
