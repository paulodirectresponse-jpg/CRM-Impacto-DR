import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Target,
  Users,
  CheckCircle2,
  DollarSign,
  Flame,
  Award,
  ArrowRight,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  Plus,
  Compass,
  FileText,
  Clock,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";

export const DashboardView: React.FC = () => {
  const {
    metrics,
    refreshMetrics,
    setActiveTab,
    openLeadDetails,
    setIsNewLeadModalOpen,
    startProspecting,
    leads,
  } = useCrm();

  const [periodType, setPeriodType] = useState<string>("thisMonth");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const handleApplyFilter = () => {
    refreshMetrics({
      periodType,
      sourceFilter,
    });
  };

  useEffect(() => {
    handleApplyFilter();
  }, [periodType, sourceFilter]);

  if (!metrics) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Carregando métricas do painel...
      </div>
    );
  }

  const { volumes, cohort, activeGoalToday } = metrics;
  const goalTarget = activeGoalToday?.target ?? 0;
  const goalAchieved = activeGoalToday?.achieved || 0;
  const goalPercentage = activeGoalToday?.percentage || 0;
  const goalRemaining = Math.max(0, goalTarget - goalAchieved);

  // Uncontacted leads for quick action queue
  const uncontactedLeads = leads
    .filter((l) => !l.isArchived && (l.status === "novo" || l.status === "analisado"))
    .slice(0, 5);

  const totalContacts = cohort?.totalContactedInPeriod ?? cohort?.totalCohortContacted ?? 0;
  const isFreshApp = totalContacts === 0 && (volumes?.newLeads ?? 0) === 0;

  return (
    <div id="dashboard-view" className="space-y-6 animate-in fade-in pb-12">
      {/* 1. HERO: DESTAQUE FORTE PARA A META DIÁRIA DE PROSPECÇÃO */}
      <div
        id="hero-daily-goal-card"
        className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 via-white to-indigo-500/10 p-5 sm:p-6 rounded-2xl border border-amber-300/80 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Main Counter & Progress */}
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-2xs">
                <Target className="w-3.5 h-3.5" />
                Meta Diária de Prospecção Ativa
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Hoje • Fuso America/Sao_Paulo
              </span>
              {goalAchieved >= goalTarget ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  Meta Batida!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  <Zap className="w-3 h-3 text-amber-600" />
                  {goalRemaining} restantes
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                {goalAchieved}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-400">
                / {goalTarget}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">
                contatos realizados hoje
              </div>
            </div>

            {/* High-Contrast Progress Bar */}
            <div className="space-y-1.5 max-w-xl">
              <div className="w-full bg-slate-200/90 h-3.5 rounded-full p-0.5 overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    goalPercentage >= 100
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-r from-amber-500 to-amber-400"
                  }`}
                  style={{ width: `${Math.min(100, goalPercentage)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500">
                <span>0</span>
                <span>50%</span>
                <span className="text-slate-700 font-bold">{goalPercentage.toFixed(0)}% da meta atingida</span>
                <span>100% ({goalTarget})</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-2.5 border-t lg:border-t-0 border-amber-200/60 pt-3 lg:pt-0">
            <button
              id="btn-goal-prospect-now"
              onClick={startProspecting}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs sm:text-sm font-extrabold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>⚡ Prospectar Agora</span>
            </button>

            <button
              id="btn-goal-add-lead"
              onClick={() => setIsNewLeadModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Novo Lead</span>
            </button>

            <button
              id="btn-goal-settings"
              onClick={() => setActiveTab("agenda")}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ver Agenda & Metas</span>
            </button>
          </div>
        </div>

        {/* Niche Breakdown for Today */}
        {activeGoalToday?.byAudience && activeGoalToday.byAudience.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-amber-200/50 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mr-1">
              <Layers className="w-3 h-3 text-amber-600" />
              Metas por Nicho Hoje:
            </span>
            {activeGoalToday.byAudience.map((item) => (
              <div
                key={item.audienceId}
                className="inline-flex items-center gap-1.5 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-lg text-xs"
              >
                <span className="font-semibold text-slate-800">{item.audienceName}:</span>
                <span className={`font-bold ${item.achieved >= item.target ? "text-emerald-600" : "text-slate-600"}`}>
                  {item.achieved}/{item.target}
                </span>
                {item.achieved >= item.target && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Top Bar: Filters & Period */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Filtro de Análise:</span>
          <span className="text-slate-500 font-normal">{metrics.period.label}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
            <select
              id="dashboard-period-select"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-hidden pr-2 cursor-pointer"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="thisWeek">Esta Semana</option>
              <option value="thisMonth">Este Mês</option>
              <option value="lastMonth">Mês Passado</option>
              <option value="all">Todo o Histórico</option>
            </select>
          </div>

          {/* Source Selector */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <select
              id="dashboard-source-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-hidden pr-2 cursor-pointer"
            >
              <option value="all">Todas as Origens</option>
              <option value="active">Apenas Prospecção Ativa</option>
              <option value="paid">Apenas Tráfego Pago</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Empty State Guidance (When App is Fresh) */}
      {isFreshApp && (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">CRM Limpo & Pronto para Prospecção</h3>
            <p className="text-xs text-slate-500">
              Cadastre seu primeiro criador ou canal para iniciar os disparos de mensagens. Conforme você avança nas etapas, o funil e a coorte serão calculados automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Lead</span>
            </button>
            <button
              onClick={() => setActiveTab("scripts")}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Ver Modelos de Scripts</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Lite 4-KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Prospectados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prospectados</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {cohort?.totalContactedInPeriod ?? cohort?.totalCohortContacted ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            1º contato no período selecionado
          </div>
        </div>

        {/* Card 2: Taxa de Resposta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Respostas</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {volumes?.responded ?? 0}
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
            {(cohort?.responseRate ?? 0).toFixed(1)}% taxa de resposta
          </div>
        </div>

        {/* Card 3: Testes de Edição */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Testes de Vídeo</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {volumes?.testsAccepted ?? volumes?.testAccepted ?? 0} <span className="text-xs font-normal text-slate-400">/ {volumes?.testsOffered ?? volumes?.testOffered ?? 0}</span>
          </div>
          <div className="text-[11px] text-purple-700 font-semibold mt-0.5">
            {(cohort?.testAcceptanceRate ?? 0).toFixed(1)}% de aceitação
          </div>
        </div>

        {/* Card 4: Clientes Fechados */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fechados</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {volumes?.closed ?? 0}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            {(cohort?.closeRate ?? 0).toFixed(1)}% conversão da coorte
          </div>
        </div>
      </div>

      {/* 5. Funil Comercial Visual & Lite */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Funil Comercial Simplificado
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Eventos registrados no período</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            {
              step: "1. Contatados",
              val: volumes?.contacted ?? 0,
              badge: null,
              color: "border-slate-200 bg-slate-50/70",
            },
            {
              step: "2. Responderam",
              val: volumes?.responded ?? 0,
              badge: volumes?.contacted ? `${(((volumes?.responded ?? 0) / (volumes.contacted || 1)) * 100).toFixed(1)}%` : null,
              color: "border-indigo-100 bg-indigo-50/30",
            },
            {
              step: "3. Reunião Feita",
              val: volumes?.meetingsHeld ?? volumes?.meetingHeld ?? 0,
              badge: (volumes?.meetingsScheduled ?? volumes?.meetingBooked ?? 0) ? `${(((volumes?.meetingsHeld ?? 0) / (volumes?.meetingsScheduled || 1)) * 100).toFixed(0)}%` : null,
              color: "border-blue-100 bg-blue-50/30",
            },
            {
              step: "4. Teste Aceito",
              val: volumes?.testsAccepted ?? volumes?.testAccepted ?? 0,
              badge: volumes?.testsOffered ? `${(((volumes?.testsAccepted ?? 0) / (volumes.testsOffered || 1)) * 100).toFixed(1)}%` : null,
              color: "border-purple-100 bg-purple-50/30",
            },
            {
              step: "5. Negociação",
              val: volumes?.negotiations ?? volumes?.negotiation ?? 0,
              badge: null,
              color: "border-amber-100 bg-amber-50/30",
            },
            {
              step: "6. Fechados",
              val: volumes?.closed ?? 0,
              badge: volumes?.contacted ? `${(((volumes?.closed ?? 0) / (volumes.contacted || 1)) * 100).toFixed(1)}%` : null,
              color: "border-emerald-300 bg-emerald-50/80 text-emerald-950",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-center transition-all ${item.color}`}
            >
              <div className="text-[11px] font-semibold text-slate-500 truncate">{item.step}</div>
              <div className="text-xl font-bold text-slate-900 my-1">{item.val}</div>
              {item.badge ? (
                <div className="text-[10px] font-bold text-indigo-700 bg-white/90 py-0.5 rounded border border-slate-200/60 shadow-2xs">
                  {item.badge}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 py-0.5">—</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. Coorte por Classe & Ranking de Scripts (Lado a Lado, Clean & Lite) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coorte por Classe */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Conversão por Classificação (Snapshot)
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold">
                <tr>
                  <th className="py-2 px-2.5">Classe</th>
                  <th className="py-2 px-2 text-center">Prospectados</th>
                  <th className="py-2 px-2 text-center">Respostas</th>
                  <th className="py-2 px-2 text-center">Fechados</th>
                  <th className="py-2 px-2.5 text-right">Taxa Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(["A", "B", "C"] as const).map((cls) => {
                  const data = cohort?.byClass?.[cls] || { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 };
                  const convRate = data?.conversionRate ?? data?.rate ?? 0;
                  return (
                    <tr key={cls} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2.5 font-bold flex items-center gap-1.5">
                        <span
                          className={`w-4 h-4 rounded text-[10px] text-white flex items-center justify-center font-bold ${
                            cls === "A" ? "bg-emerald-600" : cls === "B" ? "bg-amber-500" : "bg-slate-500"
                          }`}
                        >
                          {cls}
                        </span>
                        <span>Classe {cls}</span>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-700">{data?.contacted ?? 0}</td>
                      <td className="py-2 px-2 text-center text-slate-700">{data?.responded ?? 0}</td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-600">{data?.closed ?? 0}</td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                        {convRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ranking de Scripts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Performance dos Scripts
              </h3>
            </div>
            <button
              onClick={() => setActiveTab("scripts")}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Ver todos
            </button>
          </div>

          {(cohort?.byScript?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              Nenhum script foi vinculado a contatos neste período.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {cohort.byScript.map((s) => {
                const respRate = s?.responseRate ?? 0;
                const convRate = s?.conversionRate ?? s?.closeRate ?? 0;
                return (
                  <div
                    key={s.scriptVersionId}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5 max-w-[60%]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate">{s.scriptName}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded font-mono">
                          v{s.version}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {s.sampleSize ?? 0} envios • {respRate.toFixed(1)}% resposta
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-600 text-xs sm:text-sm">
                        {s.closed ?? 0} fechados ({convRate.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 7. Quick Contact Queue (Se houver leads pendentes) */}
      {uncontactedLeads.length > 0 && (
        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Fila Rápida: Leads Prontos para Primeiro Contato</span>
            </div>
            <button
              onClick={() => setActiveTab("leads")}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {uncontactedLeads.map((l) => (
              <div
                key={l.id}
                onClick={() => openLeadDetails(l.id)}
                className="bg-white p-3 rounded-xl border border-amber-200/70 hover:border-amber-400 shadow-2xs cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded text-[9px] text-white flex items-center justify-center font-bold ${
                        l.manualClass === "A" ? "bg-emerald-600" : l.manualClass === "B" ? "bg-amber-500" : "bg-slate-400"
                      }`}
                    >
                      {l.manualClass}
                    </span>
                    <span>{l.instagramUsernameNormalized ? `@${l.instagramUsernameNormalized}` : l.temporaryLabel}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {l.source === "active" ? "Prospecção Ativa" : "Tráfego Pago"}
                  </div>
                </div>
                <button className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg hover:bg-indigo-100">
                  Contatar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

