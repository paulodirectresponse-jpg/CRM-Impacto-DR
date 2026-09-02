import React, { useState } from "react";
import {
  Plus,
  FileText,
  Copy,
  Check,
  Edit2,
  Archive,
  RotateCcw,
  Sparkles,
  Lock,
  Flame,
  X,
  Target,
  Loader2,
  Wand2,
  HelpCircle,
  Code2,
  MessageSquare,
  ChevronRight,
  Info,
  Trash2,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { Script } from "../../types";
import { api } from "../../services/api";
import { ConfirmDeleteModal } from "../common/ConfirmDeleteModal";

export const ScriptsView: React.FC = () => {
  const { scripts, audiences, metrics, refreshAll, addToast } = useCrm();

  const [selectedAudienceId, setSelectedAudienceId] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);

  // Script Creation Mode: 1) linked to prompt ("prompt"), 2) free text ("free")
  const [creationMode, setCreationMode] = useState<"prompt" | "free">("prompt");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiRationale, setAiRationale] = useState<string | null>(null);

  // Script Form Fields
  const [baseName, setBaseName] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Prompt View Modal for inspecting prompt attached to a script
  const [viewingPromptScript, setViewingPromptScript] = useState<Script | null>(null);

  const activeAudiences = audiences.filter((a) => a.isActive);

  const filteredScripts = scripts.filter((s) => {
    if (selectedAudienceId !== "all" && s.audienceId !== selectedAudienceId) return false;
    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast({ type: "success", title: "Copiado", message: "Script copiado para a área de transferência!" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenCreate = (mode: "prompt" | "free" = "prompt", prefillPrompt?: string) => {
    setEditingScript(null);
    setCreationMode(mode);
    setBaseName("");
    setAudienceId(activeAudiences[0]?.id || "geral");
    setContent("");
    setAiPrompt(prefillPrompt || "");
    setAiRationale(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (scr: Script) => {
    setEditingScript(scr);
    setCreationMode(scr.creationMode || "free");
    setBaseName(scr.baseName);
    setAudienceId(scr.audienceId);
    setContent(scr.content);
    setAiPrompt(scr.promptUsed || "");
    setAiRationale(null);
    setIsModalOpen(true);
  };

  const handleGenerateWithAi = async (promptToUse?: string) => {
    const text = promptToUse || aiPrompt;
    if (!text.trim()) {
      addToast({
        type: "error",
        title: "Prompt obrigatório",
        message: "Digite a instrução ou objetivo do script para a IA gerar a copy.",
      });
      return;
    }

    setIsGeneratingAi(true);
    try {
      const selectedAud = audiences.find((a) => a.id === audienceId);
      const result = await api.generateScriptWithAi(text.trim(), selectedAud?.name);
      setBaseName(result.baseName || "");
      setContent(result.content || "");
      if (result.rationale) {
        setAiRationale(result.rationale);
      }
      addToast({
        type: "success",
        title: "Script gerado com IA!",
        message: "Copy criada e vinculada ao prompt. Você pode ajustar os detalhes antes de salvar.",
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao gerar script",
        message: err.message || "Inteligência artificial temporariamente indisponível.",
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const insertVariable = (variableTag: string) => {
    setContent((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + variableTag + " ");
  };

  const handleSave = async () => {
    if (!baseName.trim() || !content.trim()) {
      addToast({ type: "error", title: "Campos obrigatórios", message: "Preencha o nome e o conteúdo do script." });
      return;
    }

    const finalAudienceId = audienceId || (activeAudiences[0]?.id ?? "geral");

    setIsSaving(true);
    try {
      if (editingScript) {
        const res = await api.updateScript(editingScript.id, {
          baseName: baseName.trim(),
          audienceId: finalAudienceId,
          content: content.trim(),
          creationMode,
          promptUsed: creationMode === "prompt" ? aiPrompt.trim() : undefined,
        });
        if (res.createdNewVersion) {
          addToast({
            type: "info",
            title: "Nova Versão Criada Automaticamente",
            message: `Como a v${editingScript.version} já possuía disparos no histórico, foi criada a v${res.script.version}.`,
          });
        } else {
          addToast({ type: "success", title: "Script atualizado com sucesso" });
        }
      } else {
        await api.createScript({
          baseName: baseName.trim(),
          audienceId: finalAudienceId,
          content: content.trim(),
          creationMode,
          promptUsed: creationMode === "prompt" ? aiPrompt.trim() : undefined,
        });
        addToast({ type: "success", title: "Script salvo com sucesso!" });
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar script", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async (scr: Script) => {
    try {
      await api.updateScript(scr.id, { isActive: !scr.isActive });
      addToast({
        type: "success",
        title: scr.isActive ? "Script arquivado" : "Script reativado",
        message: "O histórico métrico de coortes permanece preservado.",
      });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro", message: err.message });
    }
  };

  const handleDeleteScriptClick = (scr: Script) => {
    setDeleteTarget(scr);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteScript(deleteTarget.id);
      addToast({
        type: "success",
        title: "Script Excluído",
        message: res.message || "Script movido para a lixeira com sucesso.",
      });
      setDeleteTarget(null);
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao excluir script", message: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const scriptSuggestions = [
    { title: "Gancho Primeiros 3s + Teste Grátis", prompt: "Abordagem com oferta de 1 corte teste gratuito sem compromisso para demonstrar gancho de retenção nos primeiros 3s" },
    { title: "Cortes para Podcasts & Entrevistas", prompt: "Abordagem especializada para podcasts focada em extrair cortes virais com legendas dinâmicas e design moderno" },
    { title: "Elogio de Conteúdo + Ajuste de Ritmo", prompt: "Abordagem elogiando a autoridade do criador e apontando oportunidade de dinamizar o ritmo da edição para reter mais inscritos" },
    { title: "Infoprodutores & Vendas de Curso", prompt: "Abordagem para infoprodutores com foco em criativos de alta retenção para vender mentorias e produtos digitais" },
  ];

  return (
    <div id="scripts-view" className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Scripts de Abordagem & Mensagens
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Crie scripts vinculados a prompts de IA ou scripts livres com rastreabilidade por coorte e versionamento automático.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {audiences.length > 0 && (
            <select
              value={selectedAudienceId}
              onChange={(e) => setSelectedAudienceId(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
            >
              <option value="all">Todos os Públicos</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <button
              id="btn-create-script-prompt"
              onClick={() => handleOpenCreate("prompt")}
              className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
              <span>Opção 1: Com IA (Prompt)</span>
            </button>
            <button
              id="btn-create-script-free"
              onClick={() => handleOpenCreate("free")}
              className="text-xs flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer border border-slate-200"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Opção 2: Script Livre</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State or Scripts Grid */}
      {scripts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-2xs">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nenhum script cadastrado</h3>
              <p className="text-xs text-slate-500 mt-1">
                Escolha abaixo se deseja criar um script <strong>vinculado a um prompt de IA</strong> ou redigir um <strong>script livre</strong> manual.
              </p>
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleOpenCreate("prompt")}
                className="text-left p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>Opção 1: Gerar com IA</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Vincula o script a um prompt inteligente com gancho de 3s e oferta de teste grátis.
                </p>
              </button>

              <button
                onClick={() => handleOpenCreate("free")}
                className="text-left p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs mb-1">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Opção 2: Script Livre</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Redija sua própria copy com tags personalizadas <code className="text-indigo-600 font-mono">[Nome]</code> e <code className="text-indigo-600 font-mono">[Tema]</code>.
                </p>
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="pt-4 border-t border-slate-100 text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sugestões de prompts para iniciar:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scriptSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      handleOpenCreate("prompt", sug.prompt);
                      handleGenerateWithAi(sug.prompt);
                    }}
                    className="text-[11px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg p-2.5 text-slate-600 transition-colors text-left cursor-pointer flex items-start gap-1.5"
                  >
                    <span className="text-indigo-500 font-bold">⚡</span>
                    <div>
                      <strong className="block text-slate-800 font-medium">{sug.title}</strong>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{sug.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredScripts.map((scr) => {
            const aud = audiences.find((a) => a.id === scr.audienceId);
            const scrMetric = metrics?.cohort.byScript.find((s) => s.scriptVersionId === scr.id);
            const isPromptMode = scr.creationMode === "prompt" || !!scr.promptUsed;

            return (
              <div
                key={scr.id}
                className={`rounded-2xl border bg-white p-5 flex flex-col justify-between shadow-2xs transition-all ${
                  scr.isActive ? "border-slate-200 hover:border-slate-300" : "border-slate-200 bg-slate-50/70 opacity-75"
                }`}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900">{scr.baseName}</h3>
                        <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                          v{scr.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{aud?.name || "Geral"}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {isPromptMode ? (
                        <button
                          onClick={() => setViewingPromptScript(scr)}
                          title="Script vinculado a Prompt de IA. Clique para visualizar o prompt."
                          className="text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold border border-indigo-200 cursor-pointer transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>IA / Prompt</span>
                        </button>
                      ) : (
                        <span
                          title="Script livre criado manualmente"
                          className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold border border-slate-200"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Livre</span>
                        </span>
                      )}

                      {scr.isLocked && (
                        <span
                          title="Script travado por já ter disparos registrados. Edições criarão uma nova versão."
                          className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold border border-amber-200 shrink-0"
                        >
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content text */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {scr.content}
                  </div>

                  {/* Performance stats if present */}
                  {scrMetric && scrMetric.sampleSize > 0 ? (
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Disparos</span>
                        <strong className="text-slate-800">{scrMetric.sampleSize}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Resposta</span>
                        <strong className="text-indigo-600">{(scrMetric.responseRate ?? 0).toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Conversão</span>
                        <strong className="text-emerald-600">
                          {(scrMetric.conversionRate ?? scrMetric.closeRate ?? 0).toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Nenhum disparo na coorte do período selecionado.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleCopy(scr.content, scr.id)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedId === scr.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === scr.id ? "Copiado!" : "Copiar Texto"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(scr)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                      title={
                        scr.isLocked
                          ? "Editar gerará uma nova versão automaticamente"
                          : "Editar conteúdo desta versão"
                      }
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => handleArchiveToggle(scr)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
                      title={scr.isActive ? "Arquivar Script" : "Reativar Script"}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteScriptClick(scr)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-md cursor-pointer"
                      title="Excluir Script"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Prompt Modal */}
      {viewingPromptScript && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{viewingPromptScript.baseName}</h3>
                  <span className="text-[11px] text-slate-500">Prompt de IA Vinculado</span>
                </div>
              </div>
              <button
                onClick={() => setViewingPromptScript(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-xl text-slate-800 leading-relaxed font-mono">
                {viewingPromptScript.promptUsed || "Script gerado com inteligência artificial baseado nas diretrizes de alta retenção."}
              </div>
              <div className="text-[11px] text-slate-500">
                Este script foi gerado a partir do prompt acima e versionado como <strong>v{viewingPromptScript.version}</strong>.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingPromptScript(null)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Create/Edit Modal with Two Distinct Options */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingScript ? `Editar Script (${editingScript.baseName})` : "Criar Novo Script de Mensagem"}
                </h3>
                {editingScript?.isLocked && (
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                    Como este script já foi usado em disparos, salvar irá gerar automaticamente a versão {editingScript.version + 1}.
                  </p>
                )}
                {!editingScript && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Escolha a modalidade de criação abaixo:
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher: Option 1 vs Option 2 */}
            {!editingScript && (
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCreationMode("prompt")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    creationMode === "prompt"
                      ? "bg-white text-indigo-600 shadow-xs border border-indigo-100"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Opção 1: Vinculado a Prompt (IA)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode("free")}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    creationMode === "free"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Opção 2: Script Livre</span>
                </button>
              </div>
            )}

            {/* Option 1 Panel: AI Prompt Generation */}
            {creationMode === "prompt" && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Prompt da IA para Gerar o Script
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                    Salvo com o Script
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    placeholder="Ex: Crie uma abordagem rápida para criadores de podcast oferecendo 1 corte gratuito com gancho nos primeiros 3s e legendas dinâmicas..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full border border-indigo-200 bg-white rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {["1 Vídeo Teste Grátis", "Gancho 3s", "Cortes Podcast", "Clínicas & Médicos"].map((item, i) => (
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

                    <button
                      type="button"
                      onClick={() => handleGenerateWithAi()}
                      disabled={isGeneratingAi || !aiPrompt.trim()}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-xs"
                    >
                      {isGeneratingAi ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Gerando Copy...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Gerar com IA</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {aiRationale && (
                  <div className="bg-white/80 border border-indigo-100 p-2.5 rounded-lg text-[11px] text-indigo-900 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span><strong>Por que essa copy funciona:</strong> {aiRationale}</span>
                  </div>
                )}
              </div>
            )}

            {/* Option 2 Notification / Helper */}
            {creationMode === "free" && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">Modo Script Livre:</span> Escreva sua mensagem diretamente com as variáveis desejadas. O script não dependerá de prompt pré-definido.
                </div>
              </div>
            )}

            {/* Common Script Fields */}
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome Identificador do Script <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Abordagem Rápida - Podcast V1"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Público / Nicho
                  </label>
                  <select
                    value={audienceId}
                    onChange={(e) => setAudienceId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    <option value="geral">Geral / Todos os Nichos</option>
                    {activeAudiences.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Conteúdo da Mensagem <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Inserir variável:</span>
                    {["[Nome]", "[Tema]", "[Último_Vídeo]", "[Oferta_Teste]"].map((tag, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => insertVariable(tag)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva aqui a mensagem que será enviada aos leads no primeiro contato..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>
                    Dica: use colchetes como <code className="text-indigo-600 font-mono">[Nome]</code> para facilitar a personalização antes do envio.
                  </span>
                  <span>{content.length} caracteres</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
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
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                {isSaving ? "Salvando..." : editingScript?.isLocked ? "Criar Nova Versão" : "Salvar Script"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Script Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Excluir Script"
        description={
          <span>
            Tem certeza que deseja mover o script{" "}
            <strong className="text-slate-900 font-semibold">"{deleteTarget?.baseName}"</strong> (v{deleteTarget?.version}) para a lixeira?
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
