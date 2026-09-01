import React, { useState } from "react";
import {
  Plus,
  RefreshCw,
  Target,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  LogIn,
  LogOut,
} from "lucide-react";
import { useCrm } from "../../context/CrmContext";

export const Header: React.FC = () => {
  const {
    session,
    metrics,
    loading,
    refreshAll,
    setIsNewLeadModalOpen,
    activeTab,
    loginWithGoogle,
    logoutWithGoogle,
    firebaseUser,
  } = useCrm();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const goalToday = metrics?.activeGoalToday || { target: 0, achieved: 0, percentage: 0 };

  const tabLabels: Record<string, string> = {
    dashboard: "Visão Geral",
    leads: "Banco de Leads",
    pipeline: "Funil Comercial",
    agenda: "Agenda de Prospecção",
    audiences: "Públicos-Alvo",
    scripts: "Scripts & Abordagens",
    paid_traffic: "Tráfego Pago",
    intelligence: "Inteligência IA",
    settings: "Configurações",
  };

  return (
    <header
      id="crm-header"
      className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 h-14 flex items-center justify-between shadow-2xs"
    >
      {/* Left: Clean Brand & Active Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs tracking-tight">
            VP
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm tracking-tight">
              CRM Prospecção
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
              {tabLabels[activeTab] || "Workspace"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Daily Progress & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Daily Goal Indicator */}
        {goalToday.target > 0 ? (
          <div
            id="header-daily-goal"
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
            title={`Meta de hoje: ${goalToday.achieved} de ${goalToday.target} contatados`}
          >
            <Target className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-slate-500">Hoje:</span>
            <span className="font-bold text-slate-900">
              {goalToday.achieved}/{goalToday.target}
            </span>
            <div className="w-10 bg-slate-200 h-1.5 rounded-full overflow-hidden ml-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  goalToday.percentage >= 100 ? "bg-emerald-500" : "bg-indigo-600"
                }`}
                style={{ width: `${Math.min(100, goalToday.percentage)}%` }}
              />
            </div>
          </div>
        ) : (
          <div
            id="header-daily-goal-empty"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500"
          >
            <Target className="w-3.5 h-3.5 text-slate-400" />
            <span>Sem meta definida</span>
          </div>
        )}

        {/* Sync Button */}
        <button
          id="btn-refresh-data"
          onClick={() => refreshAll()}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          title="Sincronizar dados com Firestore"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
        </button>

        {/* Primary Action: Novo Lead */}
        <button
          id="btn-new-lead-header"
          onClick={() => setIsNewLeadModalOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo Lead</span>
        </button>

        {/* Google Sign-in / User Profile Dropdown */}
        <div className="relative">
          {firebaseUser ? (
            <button
              id="btn-user-menu"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors text-xs cursor-pointer"
            >
              {firebaseUser.photoURL ? (
                <img
                  src={firebaseUser.photoURL}
                  alt={firebaseUser.displayName || "User"}
                  className="w-6 h-6 rounded-full border border-slate-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[11px]">
                  {firebaseUser.displayName?.charAt(0) || "U"}
                </div>
              )}
              <span className="font-semibold text-slate-800 hidden md:inline max-w-[120px] truncate">
                {firebaseUser.displayName || session?.name || "Google User"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            <button
              id="btn-login-google-header"
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Entrar com Google"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Entrar com Google</span>
            </button>
          )}

          {isUserMenuOpen && firebaseUser && (
            <div
              id="user-dropdown-menu"
              className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 px-2 z-50 text-xs"
            >
              <div className="px-2 py-1.5 border-b border-slate-100 mb-1">
                <div className="font-bold text-slate-900 truncate">
                  {firebaseUser.displayName || session?.name || "Usuário"}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {firebaseUser.email || session?.email}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {session?.isAuthorized ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Autorizado no Workspace
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      Não Autorizado
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100">
                <button
                  id="btn-logout-google"
                  onClick={() => {
                    logoutWithGoogle();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-rose-600 hover:bg-rose-50 font-semibold py-1.5 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair da Conta Google</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
