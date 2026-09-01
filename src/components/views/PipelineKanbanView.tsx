import React, { useState } from "react";
import {
  Plus,
  ChevronRight,
  ExternalLink,
  Instagram,
  Tag,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { FunnelStatus, Lead, OperationalClass } from "../../types";

interface KanbanColumn {
  id: string;
  title: string;
  statuses: FunnelStatus[];
  color: string;
}

export const PipelineKanbanView: React.FC = () => {
  const { leads, audiences, openLeadDetails, setIsNewLeadModalOpen } = useCrm();

  const [classFilter, setClassFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");

  const columns: KanbanColumn[] = [
    {
      id: "col_new",
      title: "1. Novos & Analisados",
      statuses: ["novo", "analisado"],
      color: "border-slate-300 bg-slate-50/50",
    },
    {
      id: "col_contacted",
      title: "2. Contatados & Resposta",
      statuses: ["contatado", "respondeu"],
      color: "border-blue-300 bg-blue-50/30",
    },
    {
      id: "col_meeting",
      title: "3. Reunião Comercial",
      statuses: ["reuniao_agendada", "reuniao_realizada"],
      color: "border-indigo-300 bg-indigo-50/30",
    },
    {
      id: "col_test",
      title: "4. Teste Prático",
      statuses: ["teste_oferecido", "teste_aceito"],
      color: "border-purple-300 bg-purple-50/30",
    },
    {
      id: "col_negotiation",
      title: "5. Negociação",
      statuses: ["negociacao"],
      color: "border-amber-300 bg-amber-50/30",
    },
    {
      id: "col_won",
      title: "6. Clientes Fechados",
      statuses: ["fechado"],
      color: "border-emerald-300 bg-emerald-50/40",
    },
    {
      id: "col_lost",
      title: "7. Perdidos",
      statuses: ["perdido"],
      color: "border-rose-200 bg-rose-50/20",
    },
  ];

  const activeLeads = leads.filter((l) => {
    if (l.isArchived) return false;
    if (classFilter !== "all" && l.manualClass !== classFilter) return false;
    if (audienceFilter !== "all" && l.audienceId !== audienceFilter) return false;
    return true;
  });

  return (
    <div id="pipeline-kanban-view" className="space-y-4 animate-in fade-in pb-12">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Pipeline Visual do Funil Comercial
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o fluxo de negociações e testes de edição em tempo real
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas as Classes</option>
            <option value="PENDENTE">Pendente (Classificar)</option>
            <option value="A">Classe A</option>
            <option value="B">Classe B</option>
            <option value="C">Classe C</option>
          </select>

          {/* Audience Filter */}
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Públicos</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 min-h-[calc(100vh-220px)]">
        {columns.map((col) => {
          const colLeads = activeLeads.filter((l) => col.statuses.includes(l.status));
          return (
            <div
              key={col.id}
              className={`w-72 shrink-0 rounded-2xl border ${col.color} p-3 flex flex-col`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-900 truncate">{col.title}</span>
                <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-700">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                {colLeads.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic">
                    Nenhum lead nesta etapa
                  </div>
                ) : (
                  colLeads.map((lead) => {
                    const aud = audiences.find((a) => a.id === lead.audienceId);
                    return (
                      <div
                        key={lead.id}
                        onClick={() => openLeadDetails(lead.id)}
                        className="bg-white rounded-xl p-3.5 border border-slate-200 hover:border-indigo-400 shadow-2xs hover:shadow-xs cursor-pointer transition-all space-y-2"
                      >
                        {/* Top: Handle + Class */}
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {lead.instagramUsernameNormalized ? (
                              <span>@{lead.instagramUsernameNormalized}</span>
                            ) : (
                              <span>{lead.temporaryLabel}</span>
                            )}
                          </div>
                          <span
                            className={`min-w-5 h-5 px-1 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              lead.manualClass === "A"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : lead.manualClass === "B"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : lead.manualClass === "C"
                                ? "bg-slate-200 text-slate-800"
                                : "bg-slate-100 text-slate-600 border border-slate-300"
                            }`}
                          >
                            {lead.manualClass === "PENDENTE" ? "Pend." : lead.manualClass}
                          </span>
                        </div>

                        {/* Audience & Source */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="truncate max-w-[120px] font-medium text-slate-700">
                            {aud?.name || "Sem público"}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{lead.source === "active" ? "Ativa" : "Paga"}</span>
                        </div>

                        {/* Status chip if sub-stage */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold uppercase">
                            {lead.status}
                          </span>
                          {lead.testStatus && lead.testStatus !== "nao_oferecido" && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5" />
                              <span>{lead.testStatus.replace("_", " ")}</span>
                            </span>
                          )}
                          {lead.sistema360Offered && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">
                              360º
                            </span>
                          )}
                        </div>

                        {/* Notes preview if any */}
                        {lead.notes && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 bg-slate-50 p-1.5 rounded">
                            {lead.notes}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
