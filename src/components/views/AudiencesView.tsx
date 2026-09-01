import React, { useState } from "react";
import {
  Plus,
  Target,
  Edit2,
  Archive,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  X,
  Layers,
  HelpCircle,
  Loader2,
  Wand2,
  Check,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { Audience } from "../../types";
import { api } from "../../services/api";

export const AudiencesView: React.FC = () => {
  const { audiences, refreshAll, addToast, leads } = useCrm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState<Audience | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criteriaA, setCriteriaA] = useState("");
  const [criteriaB, setCriteriaB] = useState("");
  const [criteriaC, setCriteriaC] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // AI Prompt generation state
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [showAiBox, setShowAiBox] = useState(true);

  const handleOpenCreate = (prefillPrompt?: string) => {
    setEditingAudience(null);
    setName("");
    setDescription("");
    setCriteriaA("");
    setCriteriaB("");
    setCriteriaC("");
    setAiInstructions("");
    setAiPrompt(prefillPrompt || "");
    setShowAiBox(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (aud: Audience) => {
    setEditingAudience(aud);
    setName(aud.name);
    setDescription(aud.description || "");
    setCriteriaA(aud.criteriaA || "");
    setCriteriaB(aud.criteriaB || "");
    setCriteriaC(aud.criteriaC || "");
    setAiInstructions(aud.aiInstructions || "");
    setShowAiBox(false);
    setIsModalOpen(true);
  };

  const handleGenerateWithAi = async (promptToUse?: string) => {
    const text = promptToUse || aiPrompt;
    if (!text.trim()) {
      addToast({
        type: "error",
        title: "Prompt vazio",
        message: "Descreva o nicho ou perfil de criador que deseja prospectar.",
      });
      return;
    }

    setIsGeneratingAi(true);
    try {
      const result = await api.generateAudienceWithAi(text.trim());
      setName(result.name || "");
      setDescription(result.description || "");
      setCriteriaA(result.criteriaA || "");
      setCriteriaB(result.criteriaB || "");
      setCriteriaC(result.criteriaC || "");
      setAiInstructions(result.aiInstructions || "");
      addToast({
        type: "success",
        title: "Público estruturado com IA!",
        message: "Critérios de qualificação e calibração preenchidos com sucesso. Você pode ajustar antes de salvar.",
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao gerar com IA",
        message: err.message || "Inteligência artificial temporariamente indisponível.",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ type: "error", title: "Nome obrigatório", message: "Informe o nome do público/nicho." });
      return;
    }

    setIsSaving(true);
    try {
      if (editingAudience) {
        await api.updateAudience(editingAudience.id, {
          name: name.trim(),
          description: description.trim(),
          criteriaA: criteriaA.trim(),
          criteriaB: criteriaB.trim(),
          criteriaC: criteriaC.trim(),
          aiInstructions: aiInstructions.trim(),
        });
        addToast({ type: "success", title: "Público atualizado com sucesso" });
      } else {
        await api.createAudience({
          name: name.trim(),
          description: description.trim(),
          criteriaA: criteriaA.trim(),
          criteriaB: criteriaB.trim(),
          criteriaC: criteriaC.trim(),
          aiInstructions: aiInstructions.trim(),
        });
        addToast({ type: "success", title: "Público criado com sucesso" });
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar público", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await api.archiveAudience(id);
        addToast({
          type: "success",
          title: "Público arquivado",
          message: "O público não aparecerá mais para novos leads, mantendo os existentes intactos.",
        });
      } else {
        await api.updateAudience(id, { isActive: true });
        addToast({ type: "success", title: "Público reativado com sucesso" });
      }
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao atualizar público", message: err.message });
    }
  };

  const suggestionPrompts = [
    "Infoprodutores e mentores que vendem cursos e gravam reels diários",
    "Médicos e clínicas de estética com demanda de autoridade e estética visual",
    "Podcasts e videocasts que precisam de cortes virais para Instagram e TikTok",
    "Empresas de tecnologia e startups B2B com foco em branding corporativo",
  ];

  return (
    <div id="audiences-view" className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Públicos & Nichos de Prospecção
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Defina os nichos de criadores, critérios de qualificação (A/B/C) ou crie instantaneamente via IA
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-create-audience-ai"
            onClick={() => handleOpenCreate()}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span>Novo Público (com IA)</span>
          </button>
        </div>
      </div>

      {/* Empty State or Audiences Grid */}
      {audiences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-2xs">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
              <Target className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nenhum público cadastrado</h3>
              <p className="text-xs text-slate-500 mt-1">
                Cadastre seus nichos de mercado para categorizar leads e orientar a IA na qualificação automática de prints.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <button
                onClick={() => handleOpenCreate()}
                className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Criar Público com IA</span>
              </button>
              <button
                onClick={() => {
                  handleOpenCreate();
                  setShowAiBox(false);
                }}
                className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Preencher Manualmente</span>
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="pt-4 border-t border-slate-100 text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sugestões rápidas de nichos:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestionPrompts.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleOpenCreate(sug);
                      handleGenerateWithAi(sug);
                    }}
                    className="text-[11px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-600 transition-colors text-left cursor-pointer"
                  >
                    ⚡ {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {audiences.map((aud) => {
            const leadCount = leads.filter((l) => l.audienceId === aud.id && !l.isArchived).length;
            return (
              <div
                key={aud.id}
                className={`rounded-2xl border bg-white p-5 flex flex-col justify-between shadow-2xs transition-all ${
                  aud.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50/70 opacity-75"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{aud.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{aud.description || "Sem descrição"}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        aud.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {aud.isActive ? "Ativo" : "Arquivado"}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{leadCount} leads vinculados</span>
                  </div>

                  {/* Criteria Snippets */}
                  <div className="space-y-1.5 text-xs pt-1">
                    {aud.criteriaA && (
                      <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100 text-emerald-950">
                        <strong className="block text-[11px] text-emerald-800 font-bold mb-0.5">
                          Classe A (Alta Prioridade):
                        </strong>
                        <p className="text-[11px] line-clamp-2 text-slate-700">{aud.criteriaA}</p>
                      </div>
                    )}
                    {aud.criteriaB && (
                      <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-100 text-amber-950">
                        <strong className="block text-[11px] text-amber-800 font-bold mb-0.5">
                          Classe B (Padrão):
                        </strong>
                        <p className="text-[11px] line-clamp-2 text-slate-700">{aud.criteriaB}</p>
                      </div>
                    )}
                  </div>

                  {aud.aiInstructions && (
                    <div className="text-[11px] text-indigo-900 bg-indigo-50/60 p-2 rounded-lg border border-indigo-100 flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">
                        <strong>Diretriz IA:</strong> {aud.aiInstructions}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(aud)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleArchive(aud.id, aud.isActive)}
                    className={`text-xs font-semibold p-1.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                      aud.isActive
                        ? "text-rose-600 hover:bg-rose-50"
                        : "text-indigo-600 hover:bg-indigo-50"
                    }`}
                  >
                    {aud.isActive ? (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        <span>Desativar</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reativar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAudience ? "Editar Público" : "Novo Público / Nicho"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {editingAudience
                    ? "Ajuste as definições e critérios de classificação"
                    : "Crie via prompt inteligente com IA ou preencha manualmente"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Generator Box */}
            {!editingAudience && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Gerar Público com Inteligência Artificial
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAiBox(!showAiBox)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    {showAiBox ? "Ocultar" : "Expandir"}
                  </button>
                </div>

                {showAiBox && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Médicos cirurgiões que gravam reels e buscam autoridade premium..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isGeneratingAi) {
                            e.preventDefault();
                            handleGenerateWithAi();
                          }
                        }}
                        className="flex-1 border border-indigo-200 bg-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => handleGenerateWithAi()}
                        disabled={isGeneratingAi || !aiPrompt.trim()}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                      >
                        {isGeneratingAi ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Gerando...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Gerar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1">
                      <span className="text-[10px] text-slate-400 self-center mr-1">Sugestões:</span>
                      {["Criadores de Finanças", "Médicos e Clínicas", "Podcasts", "Empresas B2B"].map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setAiPrompt(item);
                            handleGenerateWithAi(item);
                          }}
                          className="text-[10px] bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-md px-2 py-0.5 transition-colors cursor-pointer"
                        >
                          + {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome do Público / Nicho <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Infoprodutores de Negócios & Finanças"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Criadores que vendem mentorias e cursos online"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-emerald-800 mb-1">
                  Critérios para Classe A (Alta Prioridade)
                </label>
                <textarea
                  rows={2}
                  value={criteriaA}
                  onChange={(e) => setCriteriaA(e.target.value)}
                  placeholder="O que qualifica o lead como Classe A?"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-800 mb-1">
                  Critérios para Classe B (Padrão)
                </label>
                <textarea
                  rows={2}
                  value={criteriaB}
                  onChange={(e) => setCriteriaB(e.target.value)}
                  placeholder="O que qualifica o lead como Classe B?"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Critérios para Classe C (Baixa Prioridade)
                </label>
                <textarea
                  rows={2}
                  value={criteriaC}
                  onChange={(e) => setCriteriaC(e.target.value)}
                  placeholder="O que qualifica o lead como Classe C?"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Instruções de Calibração para a IA</span>
                </label>
                <textarea
                  rows={2}
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder="Instruções específicas para o modelo ao analisar prints deste nicho..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-xs px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSaving ? "Salvando..." : "Salvar Público"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

