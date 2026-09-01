import React, { useState, useEffect } from "react";
import {
  X,
  Instagram,
  ExternalLink,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  FileText,
  User,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Tag,
  DollarSign,
  Layers,
} from "lucide-react";
import {
  Lead,
  FunnelStatus,
  TestStatus,
  Sistema360Status,
  Activity,
  OperationalClass,
  Script,
} from "../../types";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";
import { formatSaoPauloDateTime } from "../../utils/dateUtils";

export const LeadDetailDrawer: React.FC = () => {
  const {
    selectedLeadId,
    setSelectedLeadId,
    isDetailDrawerOpen,
    setIsDetailDrawerOpen,
    audiences,
    scripts,
    lossReasons,
    refreshAll,
    addToast,
  } = useCrm();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Script selection dialog for first contact
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState("");

  // Loss Reason dialog
  const [showLossModal, setShowLossModal] = useState(false);
  const [selectedLossReasonId, setSelectedLossReasonId] = useState("");
  const [lossReasonOtherText, setLossReasonOtherText] = useState("");

  // Close deal customer data state
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerValue, setCustomerValue] = useState("");
  const [customerMonthly, setCustomerMonthly] = useState("");
  const [isSavingCustomerData, setIsSavingCustomerData] = useState(false);

  // Concurrency conflict modal
  const [concurrencyConflict, setConcurrencyConflict] = useState<string | null>(null);

  const loadLeadDetails = async (id: string) => {
    setLoading(true);
    try {
      const [leadData, actsData] = await Promise.all([
        api.getLeadById(id),
        api.getLeadActivities(id),
      ]);
      setLead(leadData);
      setActivities(actsData);

      // Initialize customer form if present
      if (leadData.customerData) {
        setCustomerName(leadData.customerData.name || "");
        setCustomerWhatsapp(leadData.customerData.whatsapp || "");
        setCustomerEmail(leadData.customerData.email || "");
        setCustomerValue(leadData.customerData.contractValue ? String(leadData.customerData.contractValue) : "");
        setCustomerMonthly(leadData.customerData.monthlyRecurringFee ? String(leadData.customerData.monthlyRecurringFee) : "");
      }
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao carregar detalhes",
        message: err.message,
      });
      setIsDetailDrawerOpen(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLeadId && isDetailDrawerOpen) {
      loadLeadDetails(selectedLeadId);
    }
  }, [selectedLeadId, isDetailDrawerOpen]);

  if (!isDetailDrawerOpen || !lead) return null;

  const audience = audiences.find((a) => a.id === lead.audienceId);
  const availableScripts = scripts.filter((s) => s.isActive && s.audienceId === lead.audienceId);

  const allStages: { key: FunnelStatus; label: string }[] = [
    { key: "novo", label: "Novo" },
    { key: "analisado", label: "Analisado" },
    { key: "contatado", label: "Contatado" },
    { key: "respondeu", label: "Respondeu" },
    { key: "reuniao_agendada", label: "Reunião Agendada" },
    { key: "reuniao_realizada", label: "Reunião Realizada" },
    { key: "teste_oferecido", label: "Teste Oferecido" },
    { key: "teste_aceito", label: "Teste Aceito" },
    { key: "negociacao", label: "Negociação" },
    { key: "fechado", label: "Fechado" },
  ];

  const handleUpdateStatus = async (
    targetStatus: FunnelStatus,
    overrideScriptId?: string,
    overrideLoss?: { reasonId: string; otherText?: string }
  ) => {
    if (!lead) return;

    // Check if moving to Contatado for active lead requires a script
    if (
      targetStatus === "contatado" &&
      lead.source === "active" &&
      !lead.scriptVersionId &&
      !overrideScriptId
    ) {
      setShowScriptModal(true);
      return;
    }

    // Check if moving to Perdido requires a loss reason
    if (targetStatus === "perdido" && !overrideLoss && !lead.lossReasonId) {
      setShowLossModal(true);
      return;
    }

    try {
      const patch: any = {
        status: targetStatus,
        expectedVersion: lead.version,
      };

      if (overrideScriptId) {
        patch.scriptVersionId = overrideScriptId;
      }

      if (overrideLoss) {
        patch.lossReasonId = overrideLoss.reasonId;
        patch.lossReasonOther = overrideLoss.otherText;
      }

      const updated = await api.updateLead(lead.id, patch);
      setLead(updated);
      await loadLeadDetails(lead.id);
      await refreshAll();

      addToast({
        type: "success",
        title: "Status Atualizado",
        message: `Lead avançou para ${targetStatus.toUpperCase()}`,
      });
    } catch (err: any) {
      if (err.status === 409) {
        setConcurrencyConflict(
          "Este lead foi modificado simultaneamente em outra aba. Recarregue os dados para evitar sobrescrita."
        );
      } else {
        addToast({
          type: "error",
          title: "Erro na transição",
          message: err.message || "Não foi possível alterar o status.",
        });
      }
    }
  };

  const handleSaveNote = async () => {
    if (!lead || !newNote.trim()) return;
    setIsSavingNote(true);
    try {
      const combinedNotes = lead.notes
        ? `${lead.notes}\n[${new Date().toLocaleDateString("pt-BR")}] ${newNote.trim()}`
        : `[${new Date().toLocaleDateString("pt-BR")}] ${newNote.trim()}`;

      await api.updateLead(lead.id, {
        notes: combinedNotes,
        expectedVersion: lead.version,
      });

      setNewNote("");
      await loadLeadDetails(lead.id);
      addToast({ type: "success", title: "Nota adicionada com sucesso" });
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar nota", message: err.message });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveCustomerData = async () => {
    if (!lead) return;
    setIsSavingCustomerData(true);
    try {
      await api.updateLead(lead.id, {
        customerData: {
          name: customerName.trim(),
          whatsapp: customerWhatsapp.trim(),
          email: customerEmail.trim(),
          contractValue: customerValue ? parseFloat(customerValue) : undefined,
          monthlyRecurringFee: customerMonthly ? parseFloat(customerMonthly) : undefined,
        },
        expectedVersion: lead.version,
      });
      await loadLeadDetails(lead.id);
      addToast({ type: "success", title: "Dados do cliente salvos com sucesso!" });
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar dados do cliente", message: err.message });
    } finally {
      setIsSavingCustomerData(false);
    }
  };

  const handleUpdateClass = async (newClass: OperationalClass) => {
    if (!lead) return;
    try {
      const updated = await api.updateLead(lead.id, {
        manualClass: newClass,
        expectedVersion: lead.version,
      });
      setLead(updated);
      addToast({
        type: "success",
        title: "Classificação atualizada",
        message: `Lead definido como ${newClass === "PENDENTE" ? "Pendente" : `Classe ${newClass}`}.`,
      });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao atualizar classe", message: err.message });
    }
  };

  const handleArchiveToggle = async () => {
    if (!lead) return;
    const targetState = !lead.isArchived;
    try {
      await api.archiveLead(lead.id, targetState);
      addToast({
        type: "success",
        title: targetState ? "Lead arquivado" : "Lead desarquivado",
        message: targetState
          ? "O lead saiu da visão ativa mantendo todo o histórico."
          : "O lead retornou para a visão padrão.",
      });
      setIsDetailDrawerOpen(false);
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao arquivar", message: err.message });
    }
  };

  return (
    <div
      id="lead-detail-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end"
      onClick={() => setIsDetailDrawerOpen(false)}
    >
      <div
        id="lead-detail-drawer-content"
        className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                lead.manualClass === "A"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : lead.manualClass === "B"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : lead.manualClass === "C"
                  ? "bg-slate-200 text-slate-700 border border-slate-300"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-200"
              }`}
              title={`Classe: ${lead.manualClass || "Pendente"}`}
            >
              {lead.manualClass === "PENDENTE" ? "?" : lead.manualClass}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {lead.instagramUsernameNormalized ? `@${lead.instagramUsernameNormalized}` : lead.temporaryLabel}
                </h3>
                {lead.instagramUrl && (
                  <a
                    href={lead.instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title="Abrir perfil no Instagram"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="font-medium text-slate-700">
                  {lead.source === "active" ? "Prospecção Ativa" : "Tráfego Pago"}
                </span>
                <span>•</span>
                <span>{audience?.name || "Público"}</span>
                <span>•</span>
                <span>ID: {lead.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-archive-lead"
              onClick={handleArchiveToggle}
              className="text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title={lead.isArchived ? "Desarquivar Lead" : "Arquivar Lead"}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{lead.isArchived ? "Desarquivar" : "Arquivar"}</span>
            </button>
            <button
              id="btn-close-drawer"
              onClick={() => setIsDetailDrawerOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Concurrency Alert */}
        {concurrencyConflict && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{concurrencyConflict}</span>
            </div>
            <button
              onClick={() => {
                setConcurrencyConflict(null);
                loadLeadDetails(lead.id);
              }}
              className="bg-rose-600 text-white px-2.5 py-1 rounded text-[11px] font-semibold"
            >
              Recarregar
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Class Selector / Classifier */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Classificação Operacional
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Atual: <strong className="text-slate-800">{lead.manualClass === "PENDENTE" ? "Pendente (Não classificado)" : `Classe ${lead.manualClass}`}</strong>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                id="drawer-class-pendente"
                onClick={() => handleUpdateClass("PENDENTE")}
                className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center ${
                  lead.manualClass === "PENDENTE"
                    ? "bg-slate-800 text-white border-slate-900 font-bold shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Pendente
              </button>
              {(["A", "B", "C"] as OperationalClass[]).map((cls) => (
                <button
                  key={cls}
                  type="button"
                  id={`drawer-class-${cls}`}
                  onClick={() => handleUpdateClass(cls)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer text-center ${
                    lead.manualClass === cls
                      ? cls === "A"
                        ? "bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs"
                        : cls === "B"
                        ? "bg-amber-600 text-white border-amber-700 font-bold shadow-xs"
                        : "bg-slate-600 text-white border-slate-700 font-bold shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Classe {cls}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Funnel Pipeline Stage Stepper */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Etapa do Funil Comercial
              </span>
              <div className="flex items-center gap-1">
                {lead.status === "perdido" ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                    Perdido ({lead.lossReasonId ? lossReasons.find((r) => r.id === lead.lossReasonId)?.name || "Motivo" : "Sem motivo"})
                  </span>
                ) : lead.status === "fechado" ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Cliente Fechado
                  </span>
                ) : null}
              </div>
            </div>

            {/* Stages Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allStages.map((st) => {
                const isCurrent = lead.status === st.key;
                return (
                  <button
                    key={st.key}
                    id={`stage-btn-${st.key}`}
                    onClick={() => handleUpdateStatus(st.key)}
                    className={`text-left p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate">{st.label}</span>
                    {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Lost / Reopen Controls */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              {lead.status !== "perdido" ? (
                <button
                  id="btn-mark-lost"
                  onClick={() => setShowLossModal(true)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Marcar como Perdido...
                </button>
              ) : (
                <button
                  id="btn-reopen-lead"
                  onClick={() => handleUpdateStatus("negociacao")}
                  className="text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reabrir Lead (Retornar para Negociação)</span>
                </button>
              )}

              {lead.stageDates.contactedAt && (
                <span className="text-[11px] text-slate-500">
                  1º Contato: {formatSaoPauloDateTime(lead.stageDates.contactedAt)}
                </span>
              )}
            </div>
          </div>

          {/* 2. Sub-funil de Teste Prático de Edição (Camada 4) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sub-Funil de Teste de Edição
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {lead.testStatus.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(
                [
                  { key: "nenhum", label: "Nenhum" },
                  { key: "em_producao", label: "Em Produção" },
                  { key: "entregue", label: "Entregue" },
                  { key: "feedback_recebido", label: "Feedback" },
                  { key: "aprovado", label: "Aprovado" },
                  { key: "reprovado", label: "Reprovado" },
                ] as { key: TestStatus; label: string }[]
              ).map((ts) => (
                <button
                  key={ts.key}
                  id={`test-status-${ts.key}`}
                  onClick={async () => {
                    await api.updateLead(lead.id, {
                      testStatus: ts.key,
                      expectedVersion: lead.version,
                    });
                    await loadLeadDetails(lead.id);
                  }}
                  className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                    lead.testStatus === ts.key
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {ts.label}
                </button>
              ))}
            </div>

            {lead.testDates.deliveredAt && (
              <p className="text-[11px] text-slate-500">
                Entregue em: {formatSaoPauloDateTime(lead.testDates.deliveredAt)}
              </p>
            )}
          </div>

          {/* 3. First Contact Snapshot (Camada 8 - Imutabilidade Histórica) */}
          {lead.firstContactSnapshot && (
            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl space-y-2 border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Snapshot do 1º Contato (Imutável para Métricas de Coorte)</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {formatSaoPauloDateTime(lead.firstContactSnapshot.firstContactAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Classe Original:</span>
                  <span className="font-bold text-white">
                    Classe {lead.firstContactSnapshot.classAtFirstContact}
                  </span>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-400 block text-[10px]">Origem Original:</span>
                  <span className="font-bold text-white">
                    {lead.firstContactSnapshot.sourceAtFirstContact === "active" ? "Ativa" : "Paga"}
                  </span>
                </div>
                <div className="bg-slate-800 p-2 rounded col-span-2">
                  <span className="text-slate-400 block text-[10px]">Script Utilizado:</span>
                  <span className="font-bold text-white truncate block">
                    {scripts.find((s) => s.id === lead.firstContactSnapshot?.scriptVersionIdAtFirstContact)
                      ?.baseName || lead.firstContactSnapshot.scriptVersionIdAtFirstContact || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Closed Deal Customer Data (Liberada quando status === 'fechado') */}
          {(lead.status === "fechado" || lead.customerData) && (
            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>Dados do Cliente Fechado</span>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                  Contrato Fechado
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome Completo / Empresa</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Dr. Roberto Alcantara"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">WhatsApp de Contato</label>
                  <input
                    type="text"
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="Ex: (11) 99999-8888"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Valor do Contrato (R$)</label>
                  <input
                    type="number"
                    value={customerValue}
                    onChange={(e) => setCustomerValue(e.target.value)}
                    placeholder="Ex: 2500"
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  id="btn-save-customer-data"
                  onClick={handleSaveCustomerData}
                  disabled={isSavingCustomerData}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {isSavingCustomerData ? "Salvando..." : "Salvar Dados do Cliente"}
                </button>
              </div>
            </div>
          )}

          {/* 5. Sistema 360 Toggle (Camada 9) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sistema 360 (Estratégia & Roteiro Completo)
              </span>
              <button
                type="button"
                id="btn-toggle-sistema-360"
                onClick={async () => {
                  const targetOffered = !lead.sistema360Offered;
                  await api.updateLead(lead.id, {
                    sistema360Offered: targetOffered,
                    sistema360Status: targetOffered ? "oferecido" : "nao_ofertado",
                    expectedVersion: lead.version,
                  });
                  await loadLeadDetails(lead.id);
                }}
                className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                  lead.sistema360Offered
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {lead.sistema360Offered ? "Ofertado Ativo" : "Não Ofertado"}
              </button>
            </div>

            {lead.sistema360Offered && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                {(
                  [
                    { key: "oferecido", label: "Oferecido" },
                    { key: "aceito", label: "Aceito" },
                    { key: "recusado", label: "Recusado" },
                    { key: "entregue", label: "Entregue" },
                  ] as { key: Sistema360Status; label: string }[]
                ).map((s) => (
                  <button
                    key={s.key}
                    onClick={async () => {
                      await api.updateLead(lead.id, {
                        sistema360Status: s.key,
                        expectedVersion: lead.version,
                      });
                      await loadLeadDetails(lead.id);
                    }}
                    className={`py-1 px-2 rounded border text-xs font-medium ${
                      lead.sistema360Status === s.key
                        ? "bg-indigo-600 text-white border-indigo-700"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 6. AI Evaluation Memory (Se houver avaliação salva) */}
          {lead.aiEvaluation && (
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Avaliação de Inteligência Artificial Salva</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {lead.aiEvaluation.rationale}
              </p>
              {lead.aiEvaluation.opportunity && (
                <div className="text-xs text-indigo-900 bg-white p-2 rounded border border-indigo-100 font-semibold">
                  Oportunidade: {lead.aiEvaluation.opportunity}
                </div>
              )}
            </div>
          )}

          {/* 7. Activity & Follow-up Timeline */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Histórico de Atividades & Follow-ups
            </span>

            {/* Add note input */}
            <div className="flex gap-2">
              <input
                type="text"
                id="input-followup-note"
                placeholder="Registrar follow-up, resposta ou anotação..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
                className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <button
                type="button"
                id="btn-add-note"
                onClick={handleSaveNote}
                disabled={isSavingNote || !newNote.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
            </div>

            {/* Timeline */}
            <div className="space-y-2 pt-2">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex items-start gap-3 shadow-2xs"
                >
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{act.description}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatSaoPauloDateTime(act.createdAt)}
                      </span>
                    </div>
                    {act.details && (
                      <p className="text-slate-600 text-[11px] mt-0.5">{act.details}</p>
                    )}
                    <span className="text-[10px] text-slate-400 block mt-1">Por: {act.performedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Script Selection Modal */}
        {showScriptModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h4 className="text-sm font-bold text-slate-900">
                Selecione o Script para o 1º Contato
              </h4>
              <p className="text-xs text-slate-600">
                Para métricas de coorte da prospecção ativa, é obrigatório associar a versão do script enviada.
              </p>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableScripts.map((scr) => (
                  <button
                    key={scr.id}
                    onClick={() => setSelectedScriptId(scr.id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-colors ${
                      selectedScriptId === scr.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span>{scr.baseName}</span>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                        v{scr.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">{scr.content}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="text-xs px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedScriptId}
                  onClick={() => {
                    setShowScriptModal(false);
                    handleUpdateStatus("contatado", selectedScriptId);
                  }}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Confirmar Contato
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loss Reason Modal */}
        {showLossModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h4 className="text-sm font-bold text-slate-900">Motivo da Perda</h4>
              <p className="text-xs text-slate-600">
                Selecione o motivo principal pelo qual o lead não avançou:
              </p>

              <div className="space-y-2">
                {lossReasons.map((lr) => (
                  <button
                    key={lr.id}
                    onClick={() => setSelectedLossReasonId(lr.id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                      selectedLossReasonId === lr.id
                        ? "border-rose-600 bg-rose-50 text-rose-900 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {lr.name}
                  </button>
                ))}
              </div>

              {lossReasons.find((r) => r.id === selectedLossReasonId)?.isOther && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descreva o motivo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Descreva o motivo com clareza..."
                    value={lossReasonOtherText}
                    onChange={(e) => setLossReasonOtherText(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowLossModal(false)}
                  className="text-xs px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={
                    !selectedLossReasonId ||
                    (lossReasons.find((r) => r.id === selectedLossReasonId)?.isOther &&
                      !lossReasonOtherText.trim())
                  }
                  onClick={() => {
                    setShowLossModal(false);
                    handleUpdateStatus("perdido", undefined, {
                      reasonId: selectedLossReasonId,
                      otherText: lossReasonOtherText.trim() || undefined,
                    });
                  }}
                  className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                >
                  Confirmar Perda
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
