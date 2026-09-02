import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckCircle2,
  Clock,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Edit3,
  Users,
  CalendarDays,
  Flame,
  Coffee,
  Info,
  Layers,
  ArrowRight,
  CheckSquare,
  Square,
  AlertCircle,
  FileText,
  Sliders,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";
import { MonthlyProspectingPlan, Lead, Audience } from "../../types";
import { getSaoPauloDateString } from "../../utils/dateUtils";

const WEEKDAYS = [
  { key: 1, label: "Segunda", short: "Seg" },
  { key: 2, label: "Terça", short: "Ter" },
  { key: 3, label: "Quarta", short: "Qua" },
  { key: 4, label: "Quinta", short: "Qui" },
  { key: 5, label: "Sexta", short: "Sex" },
  { key: 6, label: "Sábado", short: "Sáb" },
  { key: 0, label: "Domingo", short: "Dom" },
];

export const AgendaView: React.FC = () => {
  const { leads, audiences, settings, openLeadDetails, addToast, refreshAll } = useCrm();

  // Selected Year-Month (e.g. 2026-09) in America/Sao_Paulo
  const todayIso = getSaoPauloDateString(new Date());
  const currentMonthStr = todayIso.substring(0, 7);

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(currentMonthStr);
  const [plan, setPlan] = useState<MonthlyProspectingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [targetMonthlyLeads, setTargetMonthlyLeads] = useState<number>(200);
  const [activeWeekdays, setActiveWeekdays] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex
  const [customActiveDates, setCustomActiveDates] = useState<string[]>([]);
  const [customRestDates, setCustomRestDates] = useState<string[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [dailyCompletions, setDailyCompletions] = useState<Record<string, boolean>>({});

  // Niche & Audience Targets (Daily and Monthly)
  const [targetsByAudience, setTargetsByAudience] = useState<Record<string, number>>({});
  const [monthlyTargetsByAudience, setMonthlyTargetsByAudience] = useState<Record<string, number>>({});

  // Team Member Quotas & Allocations
  const [teamMemberTargets, setTeamMemberTargets] = useState<Record<string, number>>({});

  // Active sub-tab in Agenda view ("calendar" | "niches" | "team")
  const [agendaTab, setAgendaTab] = useState<"calendar" | "niches" | "team">("calendar");

  // Selected Day Modal/Drawer
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [editingDayNote, setEditingDayNote] = useState<string>("");

  const activeAudiences = useMemo(() => {
    return audiences.filter((a) => a.isActive);
  }, [audiences]);

  const teamEmails = useMemo(() => {
    return settings?.authorizedEmails && settings.authorizedEmails.length > 0
      ? settings.authorizedEmails
      : ["paulo.direct.response@gmail.com"];
  }, [settings]);

  // Load Monthly Plan
  const loadPlan = async (monthStr: string) => {
    setLoading(true);
    try {
      const fetched = await api.getMonthlyPlan(monthStr);
      setPlan(fetched);
      setTargetMonthlyLeads(fetched.targetMonthlyLeads || fetched.calculatedMonthlyLeads || 200);
      setActiveWeekdays(
        fetched.activeWeekdays && fetched.activeWeekdays.length > 0
          ? fetched.activeWeekdays
          : [1, 2, 3, 4, 5]
      );
      setCustomActiveDates(fetched.customActiveDates || []);
      setCustomRestDates(fetched.customRestDates || []);
      setDailyNotes(fetched.dailyNotes || {});
      setDailyCompletions(fetched.dailyCompletions || {});

      // Initialize niche targets
      const initialNiches: Record<string, number> = { ...(fetched.targetsByAudience || {}) };
      if (activeAudiences.length > 0 && Object.keys(initialNiches).length === 0) {
        const defaultDaily = fetched.calculatedDailyTarget || 10;
        const perAud = Math.max(1, Math.round(defaultDaily / activeAudiences.length));
        activeAudiences.forEach((a) => {
          initialNiches[a.id] = perAud;
        });
      }
      setTargetsByAudience(initialNiches);
      setMonthlyTargetsByAudience(fetched.monthlyTargetsByAudience || {});

      // Initialize team targets
      const initialTeam: Record<string, number> = { ...(fetched.teamMemberTargets || {}) };
      if (teamEmails.length > 0 && Object.keys(initialTeam).length === 0) {
        const defaultDaily = fetched.calculatedDailyTarget || 10;
        const perMember = Math.max(1, Math.round(defaultDaily / teamEmails.length));
        teamEmails.forEach((em) => {
          initialTeam[em] = perMember;
        });
      }
      setTeamMemberTargets(initialTeam);
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao carregar agenda",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan(currentYearMonth);
  }, [currentYearMonth]);

  // Year and Month navigation helpers
  const [yearNum, monthNum] = currentYearMonth.split("-").map(Number);

  const handlePrevMonth = () => {
    const d = new Date(yearNum, monthNum - 2, 1);
    const prevStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCurrentYearMonth(prevStr);
  };

  const handleNextMonth = () => {
    const d = new Date(yearNum, monthNum, 1);
    const nextStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCurrentYearMonth(nextStr);
  };

  const handleGoToday = () => {
    setCurrentYearMonth(currentMonthStr);
  };

  // Month formatting label (ex: "Setembro de 2026")
  const monthName = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    const name = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [yearNum, monthNum]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
    const lastDayOfMonth = new Date(yearNum, monthNum, 0);

    const totalDaysInMonth = lastDayOfMonth.getDate();
    // Seg=0, Ter=1, Qua=2, Qui=3, Sex=4, Sab=5, Dom=6
    const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      weekdayKey: number;
    }> = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(yearNum, monthNum - 1, 0).getDate();
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const prevDate = new Date(yearNum, monthNum - 2, prevMonthLastDay - i);
      const dStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(prevDate.getDate()).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: dStr === todayIso,
        weekdayKey: prevDate.getDay(),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const thisDate = new Date(yearNum, monthNum - 1, d);
      const dStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dStr === todayIso,
        weekdayKey: thisDate.getDay(),
      });
    }

    // Next month filler days (fill up to 35 or 42 cells)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(yearNum, monthNum, i);
      const dStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayIso,
        weekdayKey: nextDate.getDay(),
      });
    }

    return days;
  }, [yearNum, monthNum, todayIso]);

  // Check if a specific date is active for prospecting
  const isDateActive = (dateStr: string, weekdayKey: number) => {
    if (customRestDates.includes(dateStr)) return false;
    if (customActiveDates.includes(dateStr)) return true;
    return activeWeekdays.includes(weekdayKey);
  };

  // Count active days in the current month
  const activeDaysCount = useMemo(() => {
    return calendarDays
      .filter((d) => d.isCurrentMonth)
      .filter((d) => isDateActive(d.dateStr, d.weekdayKey)).length;
  }, [calendarDays, activeWeekdays, customActiveDates, customRestDates]);

  // Calculated daily target
  const calculatedDailyTarget =
    activeDaysCount > 0 ? Math.ceil(targetMonthlyLeads / activeDaysCount) : 0;

  // Real prospecting metrics from leads (strictly active prospecting leads with real first contact)
  const leadsByDate = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    leads.forEach((l) => {
      if (!l.isArchived && l.source === "active") {
        const contactIso = l.stageDates?.contactedAt || (l.status !== "novo" && l.status !== "analisado" ? l.createdAt : null);
        if (contactIso) {
          const contactDate = getSaoPauloDateString(contactIso);
          if (contactDate) {
            if (!map[contactDate]) map[contactDate] = [];
            map[contactDate].push(l);
          }
        }
      }
    });
    return map;
  }, [leads]);

  // Leads contacted this month by audience
  const monthContactedByAudience = useMemo(() => {
    const map: Record<string, number> = {};
    activeAudiences.forEach((a) => {
      map[a.id] = 0;
    });
    calendarDays
      .filter((d) => d.isCurrentMonth)
      .forEach((d) => {
        const dayLeads = leadsByDate[d.dateStr] || [];
        dayLeads.forEach((l) => {
          if (l.audienceId) {
            map[l.audienceId] = (map[l.audienceId] || 0) + 1;
          }
        });
      });
    return map;
  }, [calendarDays, leadsByDate, activeAudiences]);

  // Total leads contacted this month
  const totalMonthContacted = useMemo(() => {
    let count = 0;
    calendarDays
      .filter((d) => d.isCurrentMonth)
      .forEach((d) => {
        count += (leadsByDate[d.dateStr] || []).length;
      });
    return count;
  }, [calendarDays, leadsByDate]);

  // Progress percentage
  const monthProgressPct = Math.min(
    100,
    Math.round((totalMonthContacted / (targetMonthlyLeads || 1)) * 100)
  );

  // Toggle weekday active
  const handleToggleWeekday = (dayKey: number) => {
    setActiveWeekdays((prev) => {
      if (prev.includes(dayKey)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((k) => k !== dayKey);
      } else {
        return [...prev, dayKey];
      }
    });
  };

  // Preset schedules
  const applyPreset = (preset: "weekdays" | "all" | "mon_to_sat") => {
    if (preset === "weekdays") setActiveWeekdays([1, 2, 3, 4, 5]);
    if (preset === "all") setActiveWeekdays([0, 1, 2, 3, 4, 5, 6]);
    if (preset === "mon_to_sat") setActiveWeekdays([1, 2, 3, 4, 5, 6]);
    setCustomActiveDates([]);
    setCustomRestDates([]);
  };

  // Toggle specific date active/rest
  const handleToggleSpecificDate = (dateStr: string, weekdayKey: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const active = isDateActive(dateStr, weekdayKey);
    if (active) {
      setCustomRestDates((prev) => [...prev.filter((d) => d !== dateStr), dateStr]);
      setCustomActiveDates((prev) => prev.filter((d) => d !== dateStr));
    } else {
      setCustomActiveDates((prev) => [...prev.filter((d) => d !== dateStr), dateStr]);
      setCustomRestDates((prev) => prev.filter((d) => d !== dateStr));
    }
  };

  // Toggle day completed
  const handleToggleDayComplete = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDailyCompletions((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Open day details
  const handleOpenDayModal = (dateStr: string) => {
    setSelectedDayDate(dateStr);
    setEditingDayNote(dailyNotes[dateStr] || "");
  };

  // Save day note
  const handleSaveDayNote = () => {
    if (!selectedDayDate) return;
    setDailyNotes((prev) => ({
      ...prev,
      [selectedDayDate]: editingDayNote.trim(),
    }));
    addToast({
      type: "success",
      title: "Anotação salva!",
      message: `Nota do dia ${selectedDayDate} atualizada.`,
    });
  };

  // Handler to update target for a specific audience
  const handleAudienceTargetChange = (audienceId: string, val: number) => {
    const cleanVal = Math.max(0, val);
    setTargetsByAudience((prev) => ({
      ...prev,
      [audienceId]: cleanVal,
    }));
  };

  // Handler to update target for a team member
  const handleTeamMemberTargetChange = (email: string, val: number) => {
    const cleanVal = Math.max(0, val);
    setTeamMemberTargets((prev) => ({
      ...prev,
      [email]: cleanVal,
    }));
  };

  // Auto-distribute daily target equally across all active niches
  const handleDistributeNichesEqually = () => {
    if (activeAudiences.length === 0) return;
    const perAud = Math.max(1, Math.round(calculatedDailyTarget / activeAudiences.length));
    const newTargets: Record<string, number> = {};
    activeAudiences.forEach((a) => {
      newTargets[a.id] = perAud;
    });
    setTargetsByAudience(newTargets);
    addToast({
      type: "success",
      title: "Metas por Nicho Distribuídas",
      message: `Meta de ${perAud} leads/dia aplicada para cada um dos ${activeAudiences.length} públicos.`,
    });
  };

  // Sum up all niche daily targets and update global monthly target accordingly
  const handleSyncNichesToGlobalMonthly = () => {
    const values = Object.values(targetsByAudience) as number[];
    const totalNichesDaily = values.reduce(
      (acc: number, v: number) => acc + (Number(v) || 0),
      0
    );
    if (totalNichesDaily > 0 && activeDaysCount > 0) {
      const newMonthly = totalNichesDaily * activeDaysCount;
      setTargetMonthlyLeads(newMonthly);
      addToast({
        type: "success",
        title: "Meta Global Atualizada",
        message: `Soma dos nichos (${totalNichesDaily}/dia x ${activeDaysCount} dias) = ${newMonthly} leads no mês.`,
      });
    }
  };

  // Auto-distribute daily target equally across team members
  const handleDistributeTeamEqually = () => {
    if (teamEmails.length === 0) return;
    const perMember = Math.max(1, Math.round(calculatedDailyTarget / teamEmails.length));
    const newTargets: Record<string, number> = {};
    teamEmails.forEach((em) => {
      newTargets[em] = perMember;
    });
    setTeamMemberTargets(newTargets);
    addToast({
      type: "success",
      title: "Metas por Membro da Equipe Distribuídas",
      message: `Meta de ${perMember} leads/dia atribuída a cada operador da equipe.`,
    });
  };

  // Save the entire Monthly Plan and Sync with System Goals
  const handleSaveMonthlyPlan = async () => {
    setIsSaving(true);
    try {
      const payload: MonthlyProspectingPlan = {
        month: currentYearMonth,
        targetMonthlyLeads,
        activeWeekdays,
        customActiveDates,
        customRestDates,
        calculatedDailyTarget,
        targetsByAudience,
        monthlyTargetsByAudience,
        teamMemberTargets,
        dailyNotes,
        dailyCompletions,
        updatedAt: new Date().toISOString(),
      };

      const saved = await api.saveMonthlyPlan(payload);
      setPlan(saved);
      await refreshAll();

      addToast({
        type: "success",
        title: "Agenda & Metas Sincronizadas com Sucesso!",
        message: `${targetMonthlyLeads} leads distribuídos em ${activeDaysCount} dias de prospecção (${calculatedDailyTarget} leads/dia). Metas de nicho e equipe atualizadas!`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        title: "Erro ao salvar agenda",
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="agenda-view" className="space-y-5 animate-in fade-in pb-16">
      {/* 1. Header & Navigation Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        {/* Top bar: Month Title, Navigation and Save button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 leading-tight">
                  {monthName}
                </h1>
                {currentYearMonth === currentMonthStr && (
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                    Mês Atual
                  </span>
                )}
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Sincronizado com Metas & Equipe
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Planejamento estratégico de prospecção ativa com segmentação por nicho e alocação de equipe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                id="btn-prev-month"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                id="btn-today-month"
                onClick={handleGoToday}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                id="btn-next-month"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              id="btn-save-schedule"
              onClick={handleSaveMonthlyPlan}
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? "Sincronizando..." : "Sincronizar & Salvar Metas"}</span>
            </button>
          </div>
        </div>

        {/* 2. Interactive Schedule Configurator: Leads target & Active Days */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Total Monthly Leads Input (4 cols) */}
          <div className="lg:col-span-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>🎯 Quantidade de Leads no Mês:</span>
              <span className="text-[11px] text-slate-500 font-normal">Meta global ativa</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="10"
                max="10000"
                step="10"
                id="input-monthly-target"
                value={targetMonthlyLeads}
                onChange={(e) => setTargetMonthlyLeads(Math.max(1, Number(e.target.value)))}
                className="flex-1 text-base font-black border border-slate-300 rounded-xl px-3 py-1.5 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="text-xs font-semibold text-slate-600">leads totais</span>
            </div>
          </div>

          {/* Active Days Selector (5 cols) */}
          <div className="lg:col-span-5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>📅 Dias de Prospecção na Semana:</span>
              {/* Presets */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyPreset("weekdays")}
                  className="text-[10px] px-1.5 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Seg-Sex
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("mon_to_sat")}
                  className="text-[10px] px-1.5 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Seg-Sáb
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("all")}
                  className="text-[10px] px-1.5 py-0.5 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded border border-slate-200 transition-colors cursor-pointer"
                >
                  Todos
                </button>
              </div>
            </div>

            {/* Weekday checkboxes as friendly toggle buttons */}
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((wd) => {
                const isActive = activeWeekdays.includes(wd.key);
                return (
                  <button
                    key={wd.key}
                    type="button"
                    onClick={() => handleToggleWeekday(wd.key)}
                    className={`py-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {wd.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Daily Calculated Metric Card (3 cols) */}
          <div className="lg:col-span-3 bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3.5 rounded-xl border border-indigo-200 text-center space-y-1">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
              Meta Diária Resultante
            </span>
            <div className="text-2xl font-black text-indigo-700">
              {calculatedDailyTarget}{" "}
              <span className="text-xs font-semibold text-indigo-600">leads/dia</span>
            </div>
            <span className="text-[11px] text-indigo-800 font-medium block">
              {activeDaysCount} dias úteis no mês
            </span>
          </div>
        </div>

        {/* 3. Sub-Navigation Tabs: Calendário vs Metas por Nicho vs Equipe */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setAgendaTab("calendar")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              agendaTab === "calendar"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Calendário Mensal</span>
          </button>

          <button
            type="button"
            id="tab-agenda-niches"
            onClick={() => setAgendaTab("niches")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              agendaTab === "niches"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Target className="w-3.5 h-3.5 text-amber-500" />
            <span>Metas por Nicho / Público ({activeAudiences.length})</span>
          </button>

          <button
            type="button"
            id="tab-agenda-team"
            onClick={() => setAgendaTab("team")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              agendaTab === "team"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span>Equipe & Distribuição ({teamEmails.length})</span>
          </button>
        </div>
      </div>

      {/* 2. NICHE / AUDIENCE TARGETS TAB */}
      {agendaTab === "niches" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                Especificar Quantidade de Leads por Nicho / Público
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina quantos leads prospectar em cada nicho por dia e acompanhe o total mensal estimado
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDistributeNichesEqually}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Sliders className="w-3 h-3" />
                <span>Distribuir Igualmente</span>
              </button>
              <button
                type="button"
                onClick={handleSyncNichesToGlobalMonthly}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer flex items-center gap-1"
              >
                <TrendingUp className="w-3 h-3 text-amber-600" />
                <span>Somar Nichos à Meta Global</span>
              </button>
            </div>
          </div>

          {activeAudiences.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
              Nenhum público ativo cadastrado no momento. Acesse a aba "Públicos" para cadastrar seus nichos.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {activeAudiences.map((aud) => {
                const dailyVal = targetsByAudience[aud.id] ?? Math.max(1, Math.round(calculatedDailyTarget / activeAudiences.length));
                const monthlyEstimated = dailyVal * activeDaysCount;
                const realAchieved = monthContactedByAudience[aud.id] || 0;
                const progressPct = monthlyEstimated > 0 ? Math.min(100, Math.round((realAchieved / monthlyEstimated) * 100)) : 0;

                return (
                  <div
                    key={aud.id}
                    className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-indigo-300 transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[180px]">
                        {aud.name}
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        {monthlyEstimated} / mês
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-semibold text-slate-600">Meta diária:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={dailyVal}
                          onChange={(e) => handleAudienceTargetChange(aud.id, Number(e.target.value))}
                          className="w-16 text-center text-sm font-black border border-slate-300 rounded-lg py-1 px-1 text-slate-900 focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-xs font-medium text-slate-500">leads/dia</span>
                      </div>
                    </div>

                    {/* Progress in current month */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Realizado este mês:</span>
                        <span className="font-bold text-slate-800">
                          {realAchieved} de {monthlyEstimated} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TEAM TARGETS & ALLOCATION TAB */}
      {agendaTab === "team" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Equipe de Prospecção & Metas Individuais
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribua o volume diário de prospecção entre os operadores e acompanhe o desempenho individual
              </p>
            </div>

            <button
              type="button"
              onClick={handleDistributeTeamEqually}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Sliders className="w-3 h-3" />
              <span>Distribuir Igualmente na Equipe</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {teamEmails.map((email) => {
              const dailyQuota = teamMemberTargets[email] ?? Math.max(1, Math.round(calculatedDailyTarget / teamEmails.length));
              const monthlyQuota = dailyQuota * activeDaysCount;
              const nameInitials = email.split("@")[0].toUpperCase();

              return (
                <div
                  key={email}
                  className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-white hover:border-indigo-300 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {nameInitials.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-slate-900 text-xs truncate">{nameInitials}</div>
                      <div className="text-[11px] text-slate-500 truncate">{email}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-slate-600">Cota diária:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={dailyQuota}
                        onChange={(e) => handleTeamMemberTargetChange(email, Number(e.target.value))}
                        className="w-16 text-center text-sm font-black border border-slate-300 rounded-lg py-1 px-1 text-slate-900 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-slate-500">leads/dia</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium px-1">
                    <span>Meta mensal do membro:</span>
                    <span className="font-bold text-slate-900">{monthlyQuota} leads</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. CALENDAR MATRIX TAB */}
      {agendaTab === "calendar" && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4 animate-in fade-in">
          {/* Calendar Header with Days of Week */}
          <div className="grid grid-cols-7 gap-2 text-center pb-2 border-b border-slate-100">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => (
              <div
                key={d}
                className={`text-xs font-bold uppercase tracking-wider ${
                  i >= 5 ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Cells Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const isActive = isDateActive(day.dateStr, day.weekdayKey);
              const dayLeads = leadsByDate[day.dateStr] || [];
              const dayContactedCount = dayLeads.length;
              const isCompleted = !!dailyCompletions[day.dateStr] || (isActive && dayContactedCount >= calculatedDailyTarget && calculatedDailyTarget > 0);
              const hasNote = !!dailyNotes[day.dateStr];

              return (
                <div
                  key={day.dateStr}
                  onClick={() => handleOpenDayModal(day.dateStr)}
                  className={`min-h-[110px] sm:min-h-[125px] p-2 rounded-xl border transition-all flex flex-col justify-between cursor-pointer group relative ${
                    !day.isCurrentMonth
                      ? "bg-slate-50/50 border-slate-100 opacity-40 hover:opacity-80"
                      : day.isToday
                      ? "bg-indigo-50/30 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                      : isActive
                      ? "bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-2xs"
                      : "bg-slate-50/80 border-slate-200/60"
                  }`}
                >
                  {/* Cell Top: Day number, status indicator and active toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          day.isToday
                            ? "bg-indigo-600 text-white font-black"
                            : day.isCurrentMonth
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {day.isToday && (
                        <span className="text-[9px] font-bold text-indigo-700 hidden sm:inline">
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* Quick toggle active/rest day */}
                    {day.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleSpecificDate(day.dateStr, day.weekdayKey, e)}
                        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 cursor-pointer ${
                          isActive ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        title={
                          isActive
                            ? "Dia ativo de prospecção (clique para folga)"
                            : "Dia de folga (clique para ativar)"
                        }
                      />
                    )}
                  </div>

                  {/* Cell Body: Prospecting target vs achieved */}
                  <div className="my-1.5 space-y-1">
                    {isActive && day.isCurrentMonth ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600">
                          <span>{dayContactedCount} contatos</span>
                          <span className="text-slate-400">/ {calculatedDailyTarget}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              dayContactedCount >= calculatedDailyTarget
                                ? "bg-emerald-500"
                                : "bg-indigo-600"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((dayContactedCount / (calculatedDailyTarget || 1)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      day.isCurrentMonth && (
                        <div className="text-[10px] text-slate-400 text-center py-2 flex items-center justify-center gap-1 font-medium">
                          <Coffee className="w-3 h-3 text-slate-300" />
                          <span>Descanso</span>
                        </div>
                      )
                    )}
                  </div>

                  {/* Cell Footer: Note indicator & Completion Checkbox */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                    {hasNote ? (
                      <div
                        className="flex items-center gap-1 text-slate-500 truncate max-w-[80%]"
                        title={dailyNotes[day.dateStr]}
                      >
                        <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{dailyNotes[day.dateStr]}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[9px] group-hover:text-slate-400">
                        + nota
                      </span>
                    )}

                    {isActive && day.isCurrentMonth && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleDayComplete(day.dateStr, e)}
                        className="text-slate-300 hover:text-emerald-600 cursor-pointer"
                        title={isCompleted ? "Desmarcar dia concluído" : "Marcar dia como concluído"}
                      >
                        {isCompleted ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Day Details Modal / Drawer */}
      {selectedDayDate && (
        <div
          id="day-detail-modal"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Detalhes do Dia: {selectedDayDate}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {new Date(selectedDayDate + "T12:00:00").toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayDate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {/* Day Status & Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium block">Status do Dia</span>
                  <span className="text-sm font-bold text-slate-900">
                    {isDateActive(selectedDayDate, new Date(selectedDayDate + "T12:00:00").getDay())
                      ? "🟢 Dia de Prospecção"
                      : "⚪ Dia de Folga"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[11px] text-indigo-900 font-medium block">Meta Programada</span>
                  <span className="text-sm font-bold text-indigo-700">
                    {calculatedDailyTarget} leads para prospectar
                  </span>
                </div>
              </div>

              {/* Niche Breakdown Targets for this day */}
              {activeAudiences.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    🎯 Distribuição por Nicho Programada:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeAudiences.map((aud) => {
                      const targetVal = targetsByAudience[aud.id] || Math.max(1, Math.round(calculatedDailyTarget / activeAudiences.length));
                      return (
                        <span
                          key={aud.id}
                          className="text-[11px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-800"
                        >
                          {aud.name}: <strong>{targetVal}/dia</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Leads Contacted on This Day */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Leads Registrados Nesta Data ({(leadsByDate[selectedDayDate] || []).length})
                  </span>
                </div>

                {(leadsByDate[selectedDayDate] || []).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    Nenhum lead contatado nesta data ainda.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {(leadsByDate[selectedDayDate] || []).map((lead) => {
                      const aud = audiences.find((a) => a.id === lead.audienceId);
                      return (
                        <div
                          key={lead.id}
                          onClick={() => {
                            setSelectedDayDate(null);
                            openLeadDetails(lead.id);
                          }}
                          className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-indigo-300 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {lead.instagramUsernameNormalized
                                ? `@${lead.instagramUsernameNormalized}`
                                : lead.temporaryLabel || "Lead"}
                            </span>
                            {aud && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                                {aud.name}
                              </span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {lead.status}
                            </span>
                          </div>
                          <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                            Ver detalhes <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Day Note / Reminder */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Lembrete / Anotação para este dia:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Focar no nicho de Clínicas Médicas e enviar 15 abordagens pela manhã..."
                  value={editingDayNote}
                  onChange={(e) => setEditingDayNote(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDayDate(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveDayNote();
                    setSelectedDayDate(null);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Salvar Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
