import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  Target,
  Percent,
  Edit3,
  ChevronRight,
  Calendar,
  Filter,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";
import { api } from "../../services/api";
import { getPeriodInterval, isWithinInterval } from "../../utils/dateUtils";

export const PaidTrafficView: React.FC = () => {
  const { leads, settings, setSelectedLeadId, refreshAll, addToast } = useCrm();

  const [periodFilter, setPeriodFilter] = useState<"all" | "thisMonth" | "thisWeek" | "today">("all");

  const [avgTicket, setAvgTicket] = useState<number>(() => {
    return settings?.averageContractValue ?? 0;
  });

  const [totalAdSpend, setTotalAdSpend] = useState<number>(() => {
    return settings?.adSpendTotal ?? 0;
  });

  // Synchronize state whenever settings updates from backend/context
  React.useEffect(() => {
    if (settings) {
      setAvgTicket(settings.averageContractValue ?? 0);
      setTotalAdSpend(settings.adSpendTotal ?? 0);
    }
  }, [settings?.averageContractValue, settings?.adSpendTotal]);

  const [isEditingSpend, setIsEditingSpend] = useState(false);
  const [tempSpend, setTempSpend] = useState((settings?.adSpendTotal ?? 0).toString());
  const [tempTicket, setTempTicket] = useState((settings?.averageContractValue ?? 0).toString());
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Filter paid traffic leads according to active period filter
  const paidLeads = useMemo(() => {
    const allPaid = leads.filter((l) => l.source === "paid" && !l.isArchived);
    if (periodFilter === "all") return allPaid;

    const { startIso, endIso } = getPeriodInterval(periodFilter);
    return allPaid.filter((l) => {
      const relevantDate = l.stageDates?.contactedAt || l.createdAt;
      return isWithinInterval(relevantDate, startIso, endIso);
    });
  }, [leads, periodFilter]);

  // Aggregate stats utilizing stageDates for precision
  const totalPaidLeads = paidLeads.length;
  const contactedPaid = paidLeads.filter(
    (l) => !!l.stageDates?.contactedAt || (l.status !== "novo" && l.status !== "analisado")
  ).length;

  const respondedPaid = paidLeads.filter(
    (l) =>
      !!l.stageDates?.respondedAt ||
      ["respondeu", "teste_oferecido", "teste_aceito", "negociacao", "fechado"].includes(l.status)
  ).length;

  const testsAcceptedPaid = paidLeads.filter(
    (l) =>
      !!l.stageDates?.testAcceptedAt ||
      !!l.testDates?.acceptedAt ||
      l.testStatus === "aceito" ||
      l.status === "teste_aceito" ||
      l.status === "fechado"
  ).length;

  const closedPaidLeads = paidLeads.filter((l) => !!l.stageDates?.closedAt || l.status === "fechado");
  const closedPaid = closedPaidLeads.length;
  const lostPaid = paidLeads.filter((l) => !!l.stageDates?.lostAt || l.status === "perdido").length;

  // Conversion rates
  const responseRate = contactedPaid > 0 ? (respondedPaid / contactedPaid) * 100 : 0;
  const testRate = respondedPaid > 0 ? (testsAcceptedPaid / respondedPaid) * 100 : 0;
  const closeRate = contactedPaid > 0 ? (closedPaid / contactedPaid) * 100 : 0;

  // Financial calculations with dynamic contract values per lead
  const totalRevenue = useMemo(() => {
    return closedPaidLeads.reduce((acc, lead) => {
      const customVal = lead.customerData?.contractValue;
      return acc + (customVal !== undefined && customVal > 0 ? customVal : avgTicket);
    }, 0);
  }, [closedPaidLeads, avgTicket]);

  const cpl = totalPaidLeads > 0 ? totalAdSpend / totalPaidLeads : 0;
  const cac = closedPaid > 0 ? totalAdSpend / closedPaid : 0;
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0;
  const roi = totalAdSpend > 0 ? ((totalRevenue - totalAdSpend) / totalAdSpend) * 100 : 0;

  // Campaign breakdowns with real recorded campaign spend from settings or 0
  const campaignsSummary = useMemo(() => {
    const map = new Map<string, { count: number; contacted: number; closed: number; leads: typeof paidLeads }>();

    paidLeads.forEach((lead) => {
      const campaign = lead.paidCampaign?.trim() || "Tráfego Direto / Anúncios Instagram";
      const curr = map.get(campaign) || { count: 0, contacted: 0, closed: 0, leads: [] };
      curr.count += 1;
      curr.leads.push(lead);
      if (lead.stageDates?.contactedAt || (lead.status !== "novo" && lead.status !== "analisado")) curr.contacted += 1;
      if (lead.stageDates?.closedAt || lead.status === "fechado") curr.closed += 1;
      map.set(campaign, curr);
    });

    const spendMap = settings?.adSpendByCampaign || {};

    return Array.from(map.entries()).map(([name, data]) => {
      const realCampaignSpend = spendMap[name] !== undefined ? spendMap[name] : 0;
      const closedInCamp = data.leads.filter((l) => !!l.stageDates?.closedAt || l.status === "fechado");
      const rev = closedInCamp.reduce((acc, l) => {
        const customVal = l.customerData?.contractValue;
        return acc + (customVal !== undefined && customVal > 0 ? customVal : avgTicket);
      }, 0);

      const campRoas = realCampaignSpend > 0 ? rev / realCampaignSpend : 0;
      const campCpl = data.count > 0 && realCampaignSpend > 0 ? realCampaignSpend / data.count : 0;
      const campCac = data.closed > 0 && realCampaignSpend > 0 ? realCampaignSpend / data.closed : 0;

      return {
        name,
        leads: data.count,
        contacted: data.contacted,
        closed: data.closed,
        spend: realCampaignSpend,
        revenue: rev,
        roas: campRoas,
        cpl: campCpl,
        cac: campCac,
      };
    });
  }, [paidLeads, avgTicket, settings?.adSpendByCampaign]);

  const handleSaveFinancials = async () => {
    const parsedSpend = parseFloat(tempSpend) || 0;
    const parsedTicket = parseFloat(tempTicket) || 0;

    setIsSavingSettings(true);
    try {
      await api.updateSettings({
        adSpendTotal: parsedSpend,
        averageContractValue: parsedTicket,
      });
      setTotalAdSpend(parsedSpend);
      setAvgTicket(parsedTicket);
      setIsEditingSpend(false);
      addToast({
        type: "success",
        title: "Métricas Financeiras Atualizadas",
        message: "O ROI, ROAS e CPL foram recalculados com sucesso.",
      });
      await refreshAll();
    } catch (err: any) {
      addToast({ type: "error", title: "Erro ao salvar", message: err.message });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div id="paid-traffic-view" className="space-y-6 animate-in fade-in pb-12">
      {/* Top Banner / Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                Painel de Tráfego Pago & ROI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento financeiro, ROAS, Custo por Lead (CPL) e Custo de Aquisição de Clientes (CAC)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
          {/* Period Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="text-xs font-semibold text-slate-700 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none"
            >
              <option value="all">Todo o Período</option>
              <option value="thisMonth">Este Mês</option>
              <option value="thisWeek">Esta Semana</option>
              <option value="today">Hoje</option>
            </select>
          </div>

          <button
            onClick={() => {
              setTempSpend(totalAdSpend.toString());
              setTempTicket(avgTicket.toString());
              setIsEditingSpend(true);
            }}
            className="text-xs flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Calibrar Investimento & Ticket</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Investimento Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Investimento em Anúncios</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            R$ {totalAdSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Ticket Médio Contrato:</span>
            <span className="font-semibold text-slate-700">R$ {avgTicket.toLocaleString("pt-BR")}</span>
          </div>
        </div>

        {/* Faturamento Pago */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Receita Gerada (Pago)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Clientes Fechados:</span>
            <span className="font-bold text-emerald-700">{closedPaid} contrato{closedPaid !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* ROAS & ROI */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>ROAS & Retorno (ROI)</span>
            <Percent className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600 font-mono">{roas.toFixed(2)}x</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                roi >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {roi >= 0 ? `+${roi.toFixed(1)}% ROI` : `${roi.toFixed(1)}% ROI`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Lucro Bruto Comercial:</span>
            <span className={`font-semibold ${totalRevenue - totalAdSpend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              R$ {(totalRevenue - totalAdSpend).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* CPL & CAC */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>CPL & CAC Médio</span>
            <Target className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block">Custo por Lead (CPL)</span>
              <strong className="text-base font-mono text-slate-800">
                R$ {cpl.toFixed(2)}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Custo de Aquisição (CAC)</span>
              <strong className="text-base font-mono text-indigo-600">
                {closedPaid > 0 && totalAdSpend > 0 ? `R$ ${cac.toFixed(2)}` : "—"}
              </strong>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Total de Leads Pagos:</span>
            <span className="font-semibold text-slate-700">{totalPaidLeads} captados</span>
          </div>
        </div>
      </div>

      {/* Funnel Conversion Breakdown for Paid Leads */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Funil de Conversão de Tráfego Pago</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de passagem de etapa dos leads originados em anúncios
            </p>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
            Taxa de Fechamento: {closeRate.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 block">1. Leads Captados</span>
            <strong className="text-lg font-bold text-slate-900">{totalPaidLeads}</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">100% base</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 block">2. Contatados</span>
            <strong className="text-lg font-bold text-slate-900">{contactedPaid}</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {totalPaidLeads > 0 ? `${((contactedPaid / totalPaidLeads) * 100).toFixed(0)}% do total` : "0%"}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 block">3. Respostas</span>
            <strong className="text-lg font-bold text-indigo-600">{respondedPaid}</strong>
            <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
              {responseRate.toFixed(1)}% resposta
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 block">4. Testes Aceitos</span>
            <strong className="text-lg font-bold text-amber-600">{testsAcceptedPaid}</strong>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
              {testRate.toFixed(1)}% aceitação
            </span>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
            <span className="text-[11px] text-emerald-800 font-semibold block">5. Fechados</span>
            <strong className="text-lg font-bold text-emerald-600">{closedPaid}</strong>
            <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
              {closeRate.toFixed(1)}% conversão
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 block">6. Perdidos</span>
            <strong className="text-lg font-bold text-slate-400">{lostPaid}</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {contactedPaid > 0 ? `${((lostPaid / contactedPaid) * 100).toFixed(0)}% taxa perda` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* Campaign / Source Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Performance por Campanha / Criativo</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuição de volume, custo e retorno financeiro por anúncio
            </p>
          </div>
        </div>

        {campaignsSummary.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhum lead de tráfego pago cadastrado ainda. Cadastre leads com a origem <strong>"Tráfego Pago"</strong> para monitorar ROI por anúncio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Campanha / Origem</th>
                  <th className="py-3 px-3 text-center">Leads</th>
                  <th className="py-3 px-3 text-center">Contatados</th>
                  <th className="py-3 px-3 text-center">Fechados</th>
                  <th className="py-3 px-3 text-right">Investimento</th>
                  <th className="py-3 px-3 text-right">CPL</th>
                  <th className="py-3 px-3 text-right">CAC</th>
                  <th className="py-3 px-3 text-right">Receita</th>
                  <th className="py-3 px-4 text-center">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaignsSummary.map((camp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>{camp.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium text-slate-700">{camp.leads}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">{camp.contacted}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">{camp.closed}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      R$ {camp.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600">
                      {camp.cpl > 0 ? `R$ ${camp.cpl.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-indigo-600 font-medium">
                      {camp.cac > 0 ? `R$ ${camp.cac.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      R$ {camp.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {camp.roas > 0 ? `${camp.roas.toFixed(2)}x` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paid Leads List for Quick Action */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Leads de Tráfego Pago Registrados ({paidLeads.length})</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Clique em qualquer lead para abrir o drawer completo de atendimento
            </p>
          </div>
        </div>

        {paidLeads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhum lead com origem "Tráfego Pago" encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Instagram / Perfil</th>
                  <th className="py-3 px-3">Campanha</th>
                  <th className="py-3 px-3 text-center">Classe</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Vídeo Teste</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paidLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {lead.instagramUsernameNormalized ? `@${lead.instagramUsernameNormalized}` : lead.temporaryLabel || "Lead sem @"}
                      </div>
                      {lead.customerData?.name && <div className="text-[11px] text-slate-500">{lead.customerData.name}</div>}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {lead.paidCampaign || "Anúncio Direto"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lead.manualClass === "A"
                            ? "bg-emerald-100 text-emerald-800"
                            : lead.manualClass === "B"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        Classe {lead.manualClass}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          lead.testStatus === "aceito"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : lead.testStatus === "oferecido"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {lead.testStatus === "aceito" ? "Aceito" : lead.testStatus === "oferecido" ? "Oferecido" : "Não oferecido"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLeadId(lead.id);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <span>Abrir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal to calibrate Ad Spend & Average Contract Value */}
      {isEditingSpend && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <div>
              <h3 className="text-base font-bold text-slate-900">Calibrar Métricas de Tráfego Pago</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina o investimento acumulado em anúncios e o valor médio do contrato para cálculo automático de ROI e CAC.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Investimento Total em Anúncios (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  value={tempSpend}
                  onChange={(e) => setTempSpend(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Valor Médio de Contrato / Ticket Mensal (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  value={tempTicket}
                  onChange={(e) => setTempTicket(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsEditingSpend(false)}
                className="text-xs px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFinancials}
                disabled={isSavingSettings}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-lg disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSavingSettings ? "Salvando..." : "Salvar e Recalcular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
