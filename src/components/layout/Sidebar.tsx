import React from "react";
import {
  LayoutDashboard,
  Users,
  Kanban,
  CalendarDays,
  Megaphone,
  Target,
  FileText,
  Sparkles,
  Settings,
  Flame,
} from "lucide-react";
import { NavTab, useCrm } from "../../context/CrmContext";

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, leads } = useCrm();

  const activeLeadsCount = leads.filter((l) => !l.isArchived).length;
  const paidLeadsCount = leads.filter((l) => !l.isArchived && l.source === "paid").length;
  const uncontactedCount = leads.filter((l) => !l.isArchived && (l.status === "novo" || l.status === "analisado")).length;

  const navItems: NavItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "leads", label: "Leads", icon: Users, badge: activeLeadsCount },
    { id: "pipeline", label: "Pipeline", icon: Kanban },
    { id: "agenda", label: "Agenda & Metas", icon: CalendarDays },
    { id: "paid_traffic", label: "Tráfego Pago", icon: Megaphone, badge: paidLeadsCount > 0 ? paidLeadsCount : undefined },
    { id: "audiences", label: "Públicos", icon: Target },
    { id: "scripts", label: "Scripts", icon: FileText },
    { id: "intelligence", label: "Inteligência", icon: Sparkles },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <aside
        id="desktop-sidebar"
        className="hidden md:flex flex-col w-60 bg-slate-900 text-slate-300 min-h-[calc(100vh-57px)] border-r border-slate-800 p-3 shrink-0"
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 py-2">
          Menu Principal
        </div>

        <nav className="space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "hover:bg-slate-800 hover:text-slate-100 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isActive ? "bg-indigo-500/80 text-white" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Lead Hotlist indicator */}
        {uncontactedCount > 0 && (
          <div
            id="sidebar-uncontacted-box"
            onClick={() => setActiveTab("leads")}
            className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 hover:border-amber-500/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
              <Flame className="w-3.5 h-3.5" />
              <span>Aguardando Contato</span>
            </div>
            <p className="text-[11px] text-slate-400">
              <strong className="text-slate-200">{uncontactedCount}</strong> leads novos prontos para prospecção ativa.
            </p>
          </div>
        )}

        {/* Bottom meta info */}
        <div className="pt-3 mt-3 border-t border-slate-800/80 px-2 text-[10px] text-slate-400 flex items-center justify-between">
          <span>CRM V1.0 • 2026</span>
          <span className="text-slate-300">SP (UTC-3)</span>
        </div>
      </aside>

      {/* Mobile Compact Navigation Bar (Bottom) */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 py-2"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`mobile-nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? "text-indigo-400 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[48px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
