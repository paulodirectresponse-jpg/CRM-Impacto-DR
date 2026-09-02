import React from "react";
import { CrmProvider, useCrm } from "./context/CrmContext";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { ToastContainer } from "./components/common/ToastContainer";
import { NewLeadModal } from "./components/leads/NewLeadModal";
import { LeadDetailDrawer } from "./components/leads/LeadDetailDrawer";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";

import { DashboardView } from "./components/views/DashboardView";
import { LeadsTableView } from "./components/views/LeadsTableView";
import { ProspectNowView } from "./components/views/ProspectNowView";
import { PipelineKanbanView } from "./components/views/PipelineKanbanView";
import { AgendaView } from "./components/views/AgendaView";
import { AudiencesView } from "./components/views/AudiencesView";
import { ApifyImportView } from "./components/views/ApifyImportView";
import { ScriptsView } from "./components/views/ScriptsView";
import { PaidTrafficView } from "./components/views/PaidTrafficView";
import { AiIntelligenceView } from "./components/views/AiIntelligenceView";
import { SettingsView } from "./components/views/SettingsView";
import { ShieldAlert, LogIn, LogOut, ShieldCheck } from "lucide-react";

const AppContent: React.FC = () => {
  const { activeTab, leadViewMode, navigateToLeads, session, firebaseUser, loginWithGoogle, logoutWithGoogle, loading } = useCrm();

  // 1. If not logged in with Google at all
  if (!firebaseUser && !loading) {
    return (
      <div
        id="login-screen"
        className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4"
      >
        <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 bg-indigo-600/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">CRM de Prospecção V1</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Autenticação obrigatória com Google Sign-In para acesso seguro ao banco de dados Firestore.
            </p>
          </div>

          <div className="pt-2">
            <button
              id="btn-login-google-main"
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold py-3 px-5 rounded-xl transition-all cursor-pointer shadow-md hover:scale-[1.01]"
            >
              <LogIn className="w-4 h-4 text-indigo-600" />
              <span>Entrar com Conta Google</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            Apenas e-mails autorizados nas configurações do workspace possuem permissão de acesso.
          </div>
        </div>
      </div>
    );
  }

  // 2. If logged in with Google but unauthorized on backend
  if (firebaseUser && session && !session.isAuthorized) {
    return (
      <div
        id="unauthorized-screen"
        className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4"
      >
        <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Acesso Restrito ao CRM</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              O e-mail <strong className="text-slate-200">{firebaseUser.email || session.email}</strong> não possui autorização neste workspace.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              id="btn-logout-unauthorized"
              onClick={logoutWithGoogle}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sair e trocar de conta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="crm-app-container" className="min-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-col">
      {/* Top Global Header */}
      <Header />

      {/* Main Layout: Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "leads" && (leadViewMode === "prospect" ? <ProspectNowView /> : <LeadsTableView />)}
          {activeTab === "pipeline" && <PipelineKanbanView />}
          {activeTab === "agenda" && <AgendaView />}
          {activeTab === "apify_import" && (
            <ApifyImportView
              onNavigateToLeads={(filterParams) => {
                navigateToLeads(filterParams || undefined);
              }}
            />
          )}
          {activeTab === "audiences" && <AudiencesView />}
          {activeTab === "scripts" && <ScriptsView />}
          {activeTab === "paid_traffic" && <PaidTrafficView />}
          {activeTab === "intelligence" && <AiIntelligenceView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <NewLeadModal />
      <LeadDetailDrawer />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <CrmProvider>
        <AppContent />
      </CrmProvider>
    </AppErrorBoundary>
  );
}
