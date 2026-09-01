import React, { useState } from "react";
import {
  Search,
  Filter,
  ExternalLink,
  Instagram,
  Tag,
  Archive,
  RotateCcw,
  Download,
  Plus,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { FunnelStatus, OperationalClass, AcquisitionSource, Lead } from "../../types";
import { formatSaoPauloDateTime } from "../../utils/dateUtils";
import { api } from "../../services/api";

export const LeadsTableView: React.FC = () => {
  const {
    leads,
    audiences,
    openLeadDetails,
    setIsNewLeadModalOpen,
    refreshAll,
    addToast,
  } = useCrm();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    // Archived check
    if (lead.isArchived !== showArchived) return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchInsta = lead.instagramUsernameNormalized?.toLowerCase().includes(q);
      const matchLabel = lead.temporaryLabel?.toLowerCase().includes(q);
      const matchNotes = lead.notes?.toLowerCase().includes(q);
      const matchCampaign = lead.paidCampaign?.toLowerCase().includes(q);
      if (!matchInsta && !matchLabel && !matchNotes && !matchCampaign) return false;
    }

    // Status
    if (statusFilter !== "all" && lead.status !== statusFilter) return false;

    // Class
    if (classFilter !== "all" && lead.manualClass !== classFilter) return false;

    // Audience
    if (audienceFilter !== "all" && lead.audienceId !== audienceFilter) return false;

    // Source
    if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;

    return true;
  });

  const handleDownloadCsv = () => {
    window.location.href = "/api/export/csv";
    addToast({
      type: "success",
      title: "Download Iniciado",
      message: "O arquivo CSV foi gerado com sucesso.",
    });
  };

  return (
    <div id="leads-table-view" className="space-y-4 animate-in fade-in pb-12">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">
            Base Geral de Leads ({filteredLeads.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento completo do cadastro, status e histórico de contatos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="text-xs flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold px-3 py-2 rounded-lg border border-slate-200 transition-colors"
            title="Exportar CSV de leads"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsNewLeadModalOpen(true)}
            className="text-xs flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      {/* 2. Multi-Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              id="search-leads-input"
              placeholder="Buscar por @instagram, identificador, notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Status filter */}
          <select
            id="filter-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos os Status</option>
            <option value="novo">Novo</option>
            <option value="analisado">Analisado</option>
            <option value="contatado">Contatado</option>
            <option value="respondeu">Respondeu</option>
            <option value="reuniao_agendada">Reunião Agendada</option>
            <option value="reuniao_realizada">Reunião Realizada</option>
            <option value="teste_oferecido">Teste Oferecido</option>
            <option value="teste_aceito">Teste Aceito</option>
            <option value="negociacao">Negociação</option>
            <option value="fechado">Fechado</option>
            <option value="perdido">Perdido</option>
          </select>

          {/* Class filter */}
          <select
            id="filter-class-select"
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

          {/* Audience filter */}
          <select
            id="filter-audience-select"
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

          {/* Source filter & Archive Toggle */}
          <div className="flex items-center gap-2">
            <select
              id="filter-source-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Todas as Origens</option>
              <option value="active">Ativa (Instagram)</option>
              <option value="paid">Tráfego Pago</option>
            </select>
          </div>
        </div>

        {/* View Archived Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`font-semibold px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
              showArchived
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? "Exibindo Leads Arquivados" : "Ver Arquivo de Leads"}</span>
          </button>

          <span className="text-slate-400">
            Mostrando {filteredLeads.length} leads filtrados
          </span>
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Lead / Instagram</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Público</th>
                <th className="py-3 px-3 text-center">Classe</th>
                <th className="py-3 px-3">Status do Funil</th>
                <th className="py-3 px-3">Teste Edição</th>
                <th className="py-3 px-3">1º Contato</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <p className="font-semibold text-slate-600 text-xs">Nenhum lead encontrado</p>
                      <p className="text-[11px] text-slate-400">
                        {leads.length === 0
                          ? "O CRM está pronto para uso. Cadastre criadores ou perfis para começar a prospecção."
                          : "Tente limpar os filtros de busca ou público."}
                      </p>
                      {leads.length === 0 && (
                        <button
                          onClick={() => setIsNewLeadModalOpen(true)}
                          className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          + Cadastrar Lead
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const aud = audiences.find((a) => a.id === lead.audienceId);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDetails(lead.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Instagram / ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {lead.instagramUsernameNormalized ? (
                              <span>@{lead.instagramUsernameNormalized}</span>
                            ) : (
                              <span>{lead.temporaryLabel}</span>
                            )}
                          </div>
                          {lead.instagramUrl && (
                            <a
                              href={lead.instagramUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-indigo-600 p-0.5"
                              title="Abrir no Instagram"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {lead.aiEvaluation && (
                            <span title="Avaliado com Inteligência Artificial">
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                            </span>
                          )}
                        </div>
                        {lead.notes && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {lead.notes}
                          </p>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lead.source === "active"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {lead.source === "active" ? (
                            <Instagram className="w-2.5 h-2.5" />
                          ) : (
                            <Tag className="w-2.5 h-2.5" />
                          )}
                          {lead.source === "active" ? "Ativa" : "Paga"}
                        </span>
                      </td>

                      {/* Audience */}
                      <td className="py-3 px-3 text-slate-700 font-semibold">
                        {aud?.name || "Sem público"}
                      </td>

                      {/* Class */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md inline-flex items-center justify-center font-bold text-xs ${
                            lead.manualClass === "A"
                              ? "bg-emerald-100 text-emerald-800"
                              : lead.manualClass === "B"
                              ? "bg-amber-100 text-amber-800"
                              : lead.manualClass === "C"
                              ? "bg-slate-200 text-slate-800"
                              : "bg-slate-100 text-slate-600 border border-slate-300"
                          }`}
                        >
                          {lead.manualClass === "PENDENTE" ? "Pendente" : lead.manualClass}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-block ${
                            lead.status === "fechado"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : lead.status === "perdido"
                              ? "bg-rose-100 text-rose-800 border border-rose-300"
                              : lead.status === "negociacao" || lead.status === "reuniao_agendada"
                              ? "bg-indigo-100 text-indigo-800 font-bold"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {lead.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Test Status */}
                      <td className="py-3 px-3">
                        {lead.testStatus !== "nenhum" ? (
                          <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            {lead.testStatus.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* 1st Contact */}
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {lead.stageDates.contactedAt
                          ? formatSaoPauloDateTime(lead.stageDates.contactedAt)
                          : "Aguardando"}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLeadDetails(lead.id);
                          }}
                          className="text-indigo-600 hover:text-indigo-800 p-1 font-semibold text-xs inline-flex items-center gap-0.5"
                        >
                          <span>Detalhes</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
