import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  Lead,
  Audience,
  Script,
  LossReason,
  AppSettings,
  DashboardMetrics,
  UserSession,
} from "../types";
import { api } from "../services/api";
import {
  auth,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  testConnection,
  FirebaseUser,
} from "../lib/firebase";

export type NavTab =
  | "dashboard"
  | "leads"
  | "pipeline"
  | "agenda"
  | "paid_traffic"
  | "audiences"
  | "scripts"
  | "intelligence"
  | "settings";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;
}

interface CrmContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  leads: Lead[];
  audiences: Audience[];
  scripts: Script[];
  lossReasons: LossReason[];
  settings: AppSettings | null;
  session: UserSession | null;
  metrics: DashboardMetrics | null;
  loading: boolean;
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
  isNewLeadModalOpen: boolean;
  setIsNewLeadModalOpen: (open: boolean) => void;
  isDetailDrawerOpen: boolean;
  setIsDetailDrawerOpen: (open: boolean) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
  refreshAll: () => Promise<void>;
  refreshLeads: () => Promise<void>;
  refreshMetrics: (params?: { periodType?: string; sourceFilter?: string }) => Promise<void>;
  openLeadDetails: (leadId: string) => void;
  loginWithGoogle: () => Promise<void>;
  logoutWithGoogle: () => Promise<void>;
  firebaseUser: FirebaseUser | null;
  isFirebaseConnected: boolean;
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    const dur = toast.duration || 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, dur);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshLeads = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const data = await api.getLeads({ isArchived: false });
      setLeads(data);
    } catch (err: any) {
      console.error("Error loading leads:", err);
    }
  }, []);

  const refreshMetrics = useCallback(
    async (params: { periodType?: string; sourceFilter?: string } = {}) => {
      if (!auth.currentUser) return;
      try {
        const data = await api.getDashboardMetrics(params);
        setMetrics(data);
      } catch (err: any) {
        console.error("Error loading metrics:", err);
      }
    },
    []
  );

  const refreshAll = useCallback(async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sessData = await api.getSession();
      setSession(sessData);

      if (!sessData.isAuthorized) {
        setLoading(false);
        return;
      }

      const [leadsData, audData, scrData, lossData, settData, metData] =
        await Promise.all([
          api.getLeads({ isArchived: false }),
          api.getAudiences(true),
          api.getScripts(true),
          api.getLossReasons(true),
          api.getSettings(),
          api.getDashboardMetrics({ periodType: "thisMonth", sourceFilter: "all" }),
        ]);

      setLeads(leadsData);
      setAudiences(audData);
      setScripts(scrData);
      setLossReasons(lossData);
      setSettings(settData);
      setMetrics(metData);
    } catch (err: any) {
      console.error("Error loading initial CRM data:", err);
      if (err.status === 403) {
        addToast({
          type: "error",
          title: "Acesso Não Autorizado",
          message: err.message || "Seu e-mail não possui permissão para acessar este CRM.",
        });
      } else if (err.status !== 401) {
        addToast({
          type: "error",
          title: "Erro de conexão",
          message: "Não foi possível carregar os dados do servidor. Verifique a conexão.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const openLeadDetails = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setIsDetailDrawerOpen(true);
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user && user.email) {
        setFirebaseUser(user);
        const sessData = await api.getSession();
        setSession(sessData);
        if (sessData.isAuthorized) {
          addToast({
            type: "success",
            title: "Login realizado com sucesso",
            message: `Bem-vindo ao CRM de Prospecção, ${user.displayName || user.email}!`,
          });
          await refreshAll();
        } else {
          addToast({
            type: "warning",
            title: "Acesso Negado",
            message: `O e-mail ${user.email} não possui autorização neste CRM.`,
          });
        }
      }
    } catch (err: any) {
      console.error("Google Auth error:", err);
      addToast({
        type: "error",
        title: "Falha na Autenticação Google",
        message: err.message || "Não foi possível autenticar com o Google.",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, refreshAll]);

  const logoutWithGoogle = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setSession(null);
      setLeads([]);
      setAudiences([]);
      setScripts([]);
      setLossReasons([]);
      setSettings(null);
      setMetrics(null);
      addToast({
        type: "info",
        title: "Desconectado",
        message: "Sessão encerrada com sucesso.",
      });
    } catch (err: any) {
      console.error("Error signing out:", err);
    }
  }, [addToast]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const sessData = await api.getSession();
          setSession(sessData);
          if (sessData.isAuthorized) {
            await refreshAll();
          } else {
            setLoading(false);
          }
        } catch {
          setLoading(false);
        }
      } else {
        setSession(null);
        setLeads([]);
        setLoading(false);
      }
    });

    testConnection().then((connected) => {
      setIsFirebaseConnected(connected);
    });

    return () => unsubscribe();
  }, [refreshAll]);

  return (
    <CrmContext.Provider
      value={{
        activeTab,
        setActiveTab,
        leads,
        audiences,
        scripts,
        lossReasons,
        settings,
        session,
        metrics,
        loading,
        selectedLeadId,
        setSelectedLeadId,
        isNewLeadModalOpen,
        setIsNewLeadModalOpen,
        isDetailDrawerOpen,
        setIsDetailDrawerOpen,
        toasts,
        addToast,
        removeToast,
        refreshAll,
        refreshLeads,
        refreshMetrics,
        openLeadDetails,
        loginWithGoogle,
        logoutWithGoogle,
        firebaseUser,
        isFirebaseConnected,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error("useCrm must be used within a CrmProvider");
  }
  return context;
}
