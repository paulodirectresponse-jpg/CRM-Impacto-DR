import {
  AppSettings,
  Audience,
  DailyGoal,
  DashboardMetrics,
  Lead,
  LossReason,
  PrintAnalysisResult,
  Script,
  UserSession,
  MonthlyProspectingPlan,
  ProspectingScheduleItem,
  AcceptanceTestResult,
  Activity,
} from "../types";
import { auth } from "../lib/firebase";

const API_BASE = "/api";

// Helper function to extract Firebase ID token for Authorization header
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn("Could not retrieve Firebase ID token:", err);
  }

  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `Erro na requisição (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // Ignored
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Session
  getSession: () => request<UserSession>("/auth/session"),

  // Leads
  getLeads: (filters?: {
    status?: string;
    manualClass?: string;
    audienceId?: string;
    source?: string;
    scriptVersionId?: string;
    isArchived?: boolean;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.status) params.set("status", filters.status);
      if (filters.manualClass) params.set("manualClass", filters.manualClass);
      if (filters.audienceId) params.set("audienceId", filters.audienceId);
      if (filters.source) params.set("source", filters.source);
      if (filters.scriptVersionId) params.set("scriptVersionId", filters.scriptVersionId);
      if (filters.isArchived !== undefined) params.set("isArchived", String(filters.isArchived));
      if (filters.search) params.set("search", filters.search);
    }
    return request<Lead[]>(`/leads?${params.toString()}`);
  },

  getLeadById: (id: string) => request<Lead>(`/leads/${id}`),

  getLeadActivities: (leadId: string) => request<Activity[]>(`/leads/${leadId}/activities`),

  createLead: (payload: {
    instagramUsername?: string;
    temporaryLabel?: string;
    instagramUrl?: string;
    manualClass: "A" | "B" | "C";
    audienceId: string;
    scriptVersionId?: string;
    notes?: string;
    source: "active" | "paid";
    paidCampaign?: string;
    paidCreative?: string;
    duplicateOverride?: boolean;
    aiEvaluation?: any;
    customerData?: {
      name?: string;
      whatsapp?: string;
      email?: string;
      monthlyRevenue?: string;
      proposalValue?: number;
    };
  }) =>
    request<Lead>("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateLead: (
    id: string,
    patch: Partial<Lead> & { lossReasonId?: string; lossReasonOtherText?: string; expectedVersion?: number }
  ) =>
    request<Lead>(`/leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  archiveLead: (id: string, expectedVersion?: number | boolean) =>
    request<{ success: boolean; lead: Lead }>(`/leads/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }),

  addActivity: (
    leadId: string,
    payload: {
      type: "note" | "contact_attempt" | "response" | "test_offer" | "proposal" | "stage_change";
      description: string;
      metadata?: Record<string, any>;
    }
  ) =>
    request<Lead>(`/leads/${leadId}/activities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  batchImportLeads: (
    leads: Array<{
      instagramUsername?: string;
      temporaryLabel?: string;
      manualClass: "A" | "B" | "C";
      audienceId: string;
      scriptVersionId?: string;
      notes?: string;
      source?: "active" | "paid";
      paidCampaign?: string;
    }>
  ) =>
    request<{ imported: number; duplicates: number; leads: Lead[] }>("/leads/batch-import", {
      method: "POST",
      body: JSON.stringify({ leads }),
    }),

  // Audiences
  getAudiences: (includeArchived = false) =>
    request<Audience[]>(`/audiences?includeArchived=${includeArchived}`),

  createAudience: (payload: {
    name: string;
    description: string;
    criteriaA: string;
    criteriaB: string;
    criteriaC: string;
    aiInstructions?: string;
  }) =>
    request<Audience>("/audiences", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAudience: (id: string, patch: Partial<Audience>) =>
    request<Audience>(`/audiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  archiveAudience: (id: string) =>
    request<{ success: boolean; audience: Audience }>(`/audiences/${id}/archive`, {
      method: "POST",
    }),

  // Scripts
  getScripts: (includeArchived = false) =>
    request<Script[]>(`/scripts?includeArchived=${includeArchived}`),

  createScript: (payload: {
    baseName: string;
    audienceId?: string;
    content: string;
    creationMode?: string;
    promptUsed?: string;
  }) =>
    request<Script>("/scripts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateScript: (
    id: string,
    payload: {
      content?: string;
      baseName?: string;
      audienceId?: string;
      isActive?: boolean;
      creationMode?: string;
      promptUsed?: string;
    }
  ) =>
    request<{ script: Script; createdNewVersion: boolean }>(`/scripts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // Goals & Settings
  getGoals: () => request<DailyGoal[]>("/goals"),
  setGoal: (goal: DailyGoal) =>
    request<DailyGoal>("/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    }),

  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (patch: Partial<AppSettings>) =>
    request<AppSettings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // Loss Reasons
  getLossReasons: (includeArchived = false) =>
    request<LossReason[]>(`/loss-reasons?includeArchived=${includeArchived}`),

  createLossReason: (name: string, isOther = false) =>
    request<LossReason>("/loss-reasons", {
      method: "POST",
      body: JSON.stringify({ name, isOther }),
    }),

  archiveLossReason: (id: string) =>
    request<{ success: boolean }>(`/loss-reasons/${id}/archive`, {
      method: "POST",
    }),

  // Dashboard Metrics
  getDashboardMetrics: (params: {
    periodType?: string;
    startDate?: string;
    endDate?: string;
    sourceFilter?: string;
  }) => {
    const p = new URLSearchParams();
    if (params.periodType) p.set("periodType", params.periodType);
    if (params.startDate) p.set("startDate", params.startDate);
    if (params.endDate) p.set("endDate", params.endDate);
    if (params.sourceFilter) p.set("sourceFilter", params.sourceFilter);
    return request<DashboardMetrics>(`/metrics/dashboard?${p.toString()}`);
  },

  // AI
  scorePrint: (payload: {
    imageBase64: string;
    mimeType: string;
    audienceId: string;
    notes?: string;
  }) =>
    request<PrintAnalysisResult>("/ai/score-print", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  analyzeFunnel: (periodType = "thisMonth", sourceFilter = "all") =>
    request<{ analysis: string }>("/ai/funnel-analysis", {
      method: "POST",
      body: JSON.stringify({ periodType, sourceFilter }),
    }),

  analyzeScripts: () =>
    request<{ analysis: string }>("/ai/script-analysis", {
      method: "POST",
    }),

  generateExecutiveSummary: (periodType = "thisMonth", sourceFilter = "all") =>
    request<{ summary: string }>("/ai/executive-summary", {
      method: "POST",
      body: JSON.stringify({ periodType, sourceFilter }),
    }),

  generateAudienceWithAi: (prompt: string) =>
    request<{
      name: string;
      description: string;
      criteriaA: string;
      criteriaB: string;
      criteriaC: string;
      aiInstructions: string;
    }>("/ai/generate-audience", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  generateScriptWithAi: (prompt: string, audienceName?: string) =>
    request<{
      baseName: string;
      content: string;
      rationale?: string;
    }>("/ai/generate-script", {
      method: "POST",
      body: JSON.stringify({ prompt, audienceName }),
    }),

  // Agenda & Prospecting Schedule
  getScheduleItems: () => request<ProspectingScheduleItem[]>("/schedule"),
  createScheduleItem: (payload: Omit<ProspectingScheduleItem, "id" | "createdAt">) =>
    request<ProspectingScheduleItem>("/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateScheduleItem: (id: string, patch: Partial<ProspectingScheduleItem>) =>
    request<ProspectingScheduleItem>(`/schedule/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteScheduleItem: (id: string) =>
    request<{ success: boolean }>(`/schedule/${id}`, {
      method: "DELETE",
    }),
  getMonthlyPlan: (month?: string) =>
    request<MonthlyProspectingPlan>(`/prospecting-plan?month=${month || ""}`),
  saveMonthlyPlan: (plan: MonthlyProspectingPlan) =>
    request<MonthlyProspectingPlan>("/prospecting-plan", {
      method: "POST",
      body: JSON.stringify(plan),
    }),

  // Acceptance Tests & Database management
  runAcceptanceTests: () =>
    request<{
      total: number;
      passed: number;
      failed: number;
      allPassed: boolean;
      results: AcceptanceTestResult[];
    }>("/tests/run", {
      method: "POST",
    }),
  seedDatabase: () =>
    request<{ success: boolean; leadsCount: number }>("/db/seed", {
      method: "POST",
    }),
  resetDatabase: () =>
    request<{ success: boolean; message: string }>("/db/reset", {
      method: "POST",
    }),
};
