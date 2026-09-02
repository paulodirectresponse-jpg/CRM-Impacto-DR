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
  ProspectLeadFilters,
  ProspectNextLeadResponse,
  ImportBatch,
} from "../types";
import { auth } from "../lib/firebase";

const API_BASE = "/api";

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public requestId?: string;
  public body?: any;
  public details?: any;
  public duplicateLead?: Lead;
  public currentLead?: Lead;

  constructor(message: string, status: number, body?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.code = body?.code;
    this.requestId = body?.requestId;
    this.details = body?.details;
    this.duplicateLead = body?.duplicateLead;
    this.currentLead = body?.currentLead;
  }
}

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
    let body: any = null;
    try {
      body = await res.json();
      if (body && body.error) errorMsg = body.error;
    } catch {
      // Non-JSON response
    }
    throw new ApiError(errorMsg, res.status, body);
  }

  return res.json();
}

export const api = {
  // Health
  getHealth: () =>
    request<{
      status: "ok" | "degraded";
      database: {
        provider: "firestore";
        reachable: boolean;
        status: "ok" | "permission_denied" | "unavailable";
        projectId: string;
        databaseId: string;
        credentialMode: string;
        error?: string | null;
      };
      auth: string;
      ai: {
        configured: boolean;
        model: string;
      };
    }>("/health"),

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

  getNextProspectLead: (filters: ProspectLeadFilters = {}) =>
    request<ProspectNextLeadResponse>("/leads/prospect-next", {
      method: "POST",
      body: JSON.stringify(filters),
    }),

  getLeadActivities: (leadId: string) => request<Activity[]>(`/leads/${leadId}/activities`),

  createLead: (payload: {
    instagramUsername?: string;
    temporaryLabel?: string;
    instagramUrl?: string;
    manualClass: import("../types").OperationalClass;
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
      body: JSON.stringify({ isArchived: true, expectedVersion }),
    }),

  deleteLead: (id: string) =>
    request<{ success: boolean; deletionMode: "hard" | "soft"; message: string }>(`/leads/${id}`, {
      method: "DELETE",
    }),

  restoreLead: (id: string) =>
    request<{ success: boolean; lead: Lead }>(`/leads/${id}/restore`, {
      method: "POST",
    }),

  addActivity: (
    leadId: string,
    payload: {
      type: "creation" | "status_change" | "class_change" | "audience_change" | "script_change" | "test_status_change" | "loss" | "reopen" | "closed" | "system360_marked" | "system360_unmarked" | "ai_analysis" | "note_added" | "duplicate_override";
      title?: string;
      description?: string;
      notes?: string;
    }
  ) =>
    request<Activity>(`/leads/${leadId}/activities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  batchImportLeads: (
    leads: Array<{
      instagramUsername?: string;
      instagramUrl?: string;
      temporaryLabel?: string;
      manualClass: "A" | "B" | "C" | "PENDENTE";
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

  deleteAudience: (id: string) =>
    request<{ success: boolean; audience?: Audience; message: string }>(`/audiences/${id}`, {
      method: "DELETE",
    }),

  restoreAudience: (id: string) =>
    request<{ success: boolean; audience?: Audience; message: string }>(`/audiences/${id}/restore`, {
      method: "POST",
    }),

  // Scripts
  getScripts: (includeArchived = false, audienceId?: string) => {
    const params = new URLSearchParams();
    if (includeArchived) params.set("includeArchived", "true");
    if (audienceId) params.set("audienceId", audienceId);
    return request<Script[]>(`/scripts?${params.toString()}`);
  },

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

  deleteScript: (id: string) =>
    request<{ success: boolean; script?: Script; message: string }>(`/scripts/${id}`, {
      method: "DELETE",
    }),

  restoreScript: (id: string) =>
    request<{ success: boolean; script?: Script; message: string }>(`/scripts/${id}/restore`, {
      method: "POST",
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

  deleteLossReason: (id: string) =>
    request<{ success: boolean; deletionMode: "hard" | "soft"; message: string }>(`/loss-reasons/${id}`, {
      method: "DELETE",
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

  // Acceptance Tests
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

  // Apify Integration (V2.1)
  getApifyStatus: () =>
    request<{
      configured: boolean;
      status: "connected" | "not_configured" | "error";
      maskedToken?: string;
      accountId?: string;
      accountUsername?: string;
      lastTestAt?: string;
      errorMessage?: string;
    }>("/integrations/apify/status"),

  saveApifyToken: (token: string) =>
    request<{
      configured: boolean;
      status: "connected" | "not_configured" | "error";
      maskedToken?: string;
      accountId?: string;
      accountUsername?: string;
      lastTestAt?: string;
    }>("/integrations/apify/token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  testApifyConnection: () =>
    request<{
      success: boolean;
      user?: any;
      error?: string;
    }>("/integrations/apify/test", {
      method: "POST",
    }),

  removeApifyToken: () =>
    request<{ success: boolean; message: string }>("/integrations/apify/token", {
      method: "DELETE",
    }),

  // Import Configs (V2.1)
  getImportConfigs: (includeArchived = false) =>
    request<import("../types").ImportConfig[]>(`/import-configs?includeArchived=${includeArchived}`),

  getImportConfigById: (id: string) =>
    request<import("../types").ImportConfig>(`/import-configs/${id}`),

  createImportConfig: (payload: {
    name: string;
    audienceId: string;
    keywords: string[];
    searchLimitPerKeyword?: number;
    minFollowers?: number;
    maxFollowers?: number;
    ignorePrivate?: boolean;
    liveSearch?: boolean;
  }) =>
    request<import("../types").ImportConfig>("/import-configs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateImportConfig: (id: string, patch: Partial<import("../types").ImportConfig>) =>
    request<import("../types").ImportConfig>(`/import-configs/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  deleteImportConfig: (id: string) =>
    request<{ success: boolean; config?: import("../types").ImportConfig; message: string }>(`/import-configs/${id}`, {
      method: "DELETE",
    }),

  restoreImportConfig: (id: string) =>
    request<{ success: boolean; config?: import("../types").ImportConfig; message: string }>(`/import-configs/${id}/restore`, {
      method: "POST",
    }),

  // Trash & Deleted Items (V2.1.1)
  getTrashItems: () =>
    request<import("../types").TrashItems>("/trash"),

  permanentlyDeleteLead: (id: string) =>
    request<{ success: boolean; message: string }>(`/trash/leads/${id}`, {
      method: "DELETE",
    }),

  permanentlyDeleteScript: (id: string) =>
    request<{ success: boolean; message: string }>(`/trash/scripts/${id}`, {
      method: "DELETE",
    }),

  permanentlyDeleteAudience: (id: string) =>
    request<{ success: boolean; message: string }>(`/trash/audiences/${id}`, {
      method: "DELETE",
    }),

  permanentlyDeleteImportConfig: (id: string) =>
    request<{ success: boolean; message: string }>(`/trash/import-configs/${id}`, {
      method: "DELETE",
    }),

  emptyTrash: (category?: "all" | "leads" | "scripts" | "audiences" | "configs") =>
    request<{ success: boolean; purgedCount: number; message: string }>("/trash/empty", {
      method: "POST",
      body: JSON.stringify({ category: category || "all" }),
    }),

  // AI Import Strategy (V2.1.1)
  generateAiImportStrategy: (payload: import("../types").AiImportStrategyPayload) =>
    request<import("../types").AiImportStrategyResult>("/imports/ai-strategy", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Import Batches (V2.1)
  getImportBatches: () =>
    request<import("../types").ImportBatch[]>("/import-batches"),

  getImportBatchById: (id: string) =>
    request<import("../types").ImportBatch>(`/import-batches/${id}`),

  startApifyImport: (payload: {
    configId?: string;
    audienceId: string;
    keywords: string[];
    searchLimitPerKeyword?: number;
    minFollowers?: number;
    maxFollowers?: number;
    ignorePrivate?: boolean;
    liveSearch?: boolean;
  }) =>
    request<import("../types").ImportBatch>("/import-batches/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  refreshImportBatch: (id: string) =>
    request<import("../types").ImportBatch>(`/import-batches/${id}/refresh`, {
      method: "POST",
    }),

  // Downloads & Exports
  downloadLeadsCsv: async () => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/export/csv`, { headers: authHeaders });
    if (!res.ok) throw new ApiError("Erro ao exportar CSV", res.status);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm_prospeccao_leads.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadBackupJson: async () => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/export/json`, { headers: authHeaders });
    if (!res.ok) throw new ApiError("Erro ao exportar JSON", res.status);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "crm_prospeccao_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  seedDatabase: () =>
    request<{ success: boolean; leadsCount: number }>("/db/seed", {
      method: "POST",
    }),
  resetDatabase: () =>
    request<{ success: boolean; message: string }>("/db/reset", {
      method: "POST",
    }),
};
