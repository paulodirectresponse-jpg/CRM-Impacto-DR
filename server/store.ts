import { adminDb, credentialMode } from "./firebaseAdmin";
import firebaseConfig from "../firebase-applet-config.json";
import {
  Lead,
  Audience,
  Script,
  DailyGoal,
  LossReason,
  AppSettings,
  Activity,
  DashboardMetrics,
  OperationalClass,
  FunnelStatus,
  ProspectingScheduleItem,
  MonthlyProspectingPlan,
  ImportConfig,
  ImportBatch,
  ApifyIntegrationStatus,
} from "../src/types";
import {
  getCurrentIso,
  getPeriodInterval,
  getSaoPauloDateString,
  isTodayInSaoPaulo,
  isWithinInterval,
} from "../src/utils/dateUtils";
import { normalizeInstagramIdentity, mapApifyInstagramUser } from "./instagramParser";
import { apifyService, maskToken, ApifyError } from "./apify";

export function stripUndefinedDeep<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== "object") return val;
  if (val instanceof Date) return val as any;
  if (Array.isArray(val)) {
    return val.map((item) => stripUndefinedDeep(item)) as any;
  }
  const res: any = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      res[k] = stripUndefinedDeep(v);
    }
  }
  return res;
}

interface StoredApifyIntegration {
  token?: string;
  accountId?: string;
  accountUsername?: string;
  lastTestAt?: string;
  status: "connected" | "not_configured" | "error";
  errorMessage?: string;
}

interface CrmDatabase {
  leads: Lead[];
  audiences: Audience[];
  scripts: Script[];
  dailyGoals: DailyGoal[];
  lossReasons: LossReason[];
  appSettings: AppSettings;
  activities: Activity[];
  scheduleItems: ProspectingScheduleItem[];
  monthlyPlans: Record<string, MonthlyProspectingPlan>;
  importConfigs: ImportConfig[];
  importBatches: ImportBatch[];
  apifyIntegration: StoredApifyIntegration;
}

function getDefaultLossReasons(): LossReason[] {
  return [
    { id: "loss_nao_respondeu", name: "Não respondeu", isOther: false, isActive: true },
    { id: "loss_sem_interesse", name: "Sem interesse", isOther: false, isActive: true },
    { id: "loss_ja_tem_editor", name: "Já possui editor", isOther: false, isActive: true },
    { id: "loss_sem_orcamento", name: "Sem orçamento", isOther: false, isActive: true },
    { id: "loss_nao_gostou_teste", name: "Não gostou do teste", isOther: false, isActive: true },
    { id: "loss_parou_responder", name: "Parou de responder", isOther: false, isActive: true },
    { id: "loss_contato_futuro", name: "Pediu contato futuramente", isOther: false, isActive: true },
    { id: "loss_nao_perfil", name: "Não é perfil ideal", isOther: false, isActive: true },
    { id: "loss_outro", name: "Outro", isOther: true, isActive: true },
  ];
}

function getDefaultAudiences(): Audience[] {
  const now = new Date().toISOString();
  return [
    {
      id: "aud_infoprodutores",
      name: "Infoprodutores & Mentores",
      description: "Criadores e especialistas que vendem cursos e mentorias no Instagram",
      criteriaA: "Mais de 10k seguidores, posta reels diários, vende mentoria high ticket",
      criteriaB: "Entre 2k e 10k seguidores, boa frequência de postagens",
      criteriaC: "Menos de 2k seguidores ou baixa frequência",
      aiInstructions: "Focar na dor de escala e retenção de alunos.",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "aud_medicos",
      name: "Médicos & Clínicas de Estética",
      description: "Profissionais de saúde e estética que buscam autoridade e captação de pacientes",
      criteriaA: "Clínica consolidada, foco em autoridade e procedimentos premium",
      criteriaB: "Consultório individual com demanda crescente",
      criteriaC: "Início de carreira ou sem posicionamento claro",
      aiInstructions: "Focar em autoridade médica e conformidade ética.",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getDefaultSettings(): AppSettings {
  const envEmails = (process.env.AUTHORIZED_EMAILS || "ferramentaas.1@gmail.com,paulo.direct.response@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return {
    aiEnabled: true,
    geminiModel: "gpt-5.6-luna",
    authorizedEmails: envEmails.length > 0 ? envEmails : ["ferramentaas.1@gmail.com", "paulo.direct.response@gmail.com"],
    defaultDailyTarget: 0,
    dailyActiveGoal: 0,
    audienceTargets: {},
    minSampleForAiAnalysis: 5,
    adSpendTotal: 0,
    adSpendByCampaign: {},
    averageContractValue: 0,
  };
}

async function safeFirestoreWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error(`[Firestore Write Failed]: ${errMsg}`);
    throw err;
  }
}

class StoreManager {
  private db: CrmDatabase = {
    leads: [],
    audiences: getDefaultAudiences(),
    scripts: [],
    dailyGoals: [],
    lossReasons: getDefaultLossReasons(),
    appSettings: getDefaultSettings(),
    activities: [],
    scheduleItems: [],
    monthlyPlans: {},
    importConfigs: [],
    importBatches: [],
    apifyIntegration: {
      status: "not_configured",
    },
  };
  private isInitialized = false;
  private dbStatus: "ok" | "permission_denied" | "unavailable" = "unavailable";
  private dbErrorDetails: string | null = null;

  constructor() {
    this.init().catch(() => {});
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      // 1. AppSettings
      const settingsDoc = await adminDb.collection("appSettings").doc("main").get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data() as AppSettings;
        this.db.appSettings = { ...getDefaultSettings(), ...data };
      } else {
        await adminDb.collection("appSettings").doc("main").set(stripUndefinedDeep(this.db.appSettings));
      }

      // 2. Apify Integration (Server-only collection 'integrations')
      const apifyDoc = await adminDb.collection("integrations").doc("apify").get();
      if (apifyDoc.exists) {
        const data = apifyDoc.data() as StoredApifyIntegration;
        this.db.apifyIntegration = {
          token: data.token || undefined,
          accountId: data.accountId,
          accountUsername: data.accountUsername,
          lastTestAt: data.lastTestAt,
          status: data.token ? "connected" : "not_configured",
          errorMessage: data.errorMessage,
        };
      } else if (process.env.APIFY_TOKEN) {
        this.db.apifyIntegration = {
          token: process.env.APIFY_TOKEN.trim(),
          status: "connected",
        };
      }

      // 3. LossReasons
      const lossSnap = await adminDb.collection("lossReasons").get();
      if (!lossSnap.empty) {
        this.db.lossReasons = lossSnap.docs.map((d) => d.data() as LossReason);
      } else {
        const batch = adminDb.batch();
        for (const reason of this.db.lossReasons) {
          batch.set(adminDb.collection("lossReasons").doc(reason.id), stripUndefinedDeep(reason));
        }
        await batch.commit();
      }

      // 4. Audiences
      const audSnap = await adminDb.collection("audiences").get();
      if (!audSnap.empty) {
        this.db.audiences = audSnap.docs.map((d) => d.data() as Audience);
      }

      // 5. Scripts
      const scrSnap = await adminDb.collection("scripts").get();
      if (!scrSnap.empty) {
        this.db.scripts = scrSnap.docs.map((d) => d.data() as Script);
      }

      // 6. Leads
      const leadsSnap = await adminDb.collection("leads").get();
      if (!leadsSnap.empty) {
        this.db.leads = leadsSnap.docs.map((d) => d.data() as Lead);
      }

      // 7. Activities
      const actSnap = await adminDb.collection("activities").get();
      if (!actSnap.empty) {
        this.db.activities = actSnap.docs.map((d) => d.data() as Activity);
      }

      // 8. Daily Goals
      const goalSnap = await adminDb.collection("dailyGoals").get();
      if (!goalSnap.empty) {
        this.db.dailyGoals = goalSnap.docs.map((d) => d.data() as DailyGoal);
      }

      // 9. Schedule Items
      const schedSnap = await adminDb.collection("scheduleItems").get();
      if (!schedSnap.empty) {
        this.db.scheduleItems = schedSnap.docs.map((d) => d.data() as ProspectingScheduleItem);
      }

      // 10. Monthly Plans
      const planSnap = await adminDb.collection("monthlyPlans").get();
      if (!planSnap.empty) {
        const plans: Record<string, MonthlyProspectingPlan> = {};
        planSnap.docs.forEach((d) => {
          plans[d.id] = d.data() as MonthlyProspectingPlan;
        });
        this.db.monthlyPlans = plans;
      }

      // 11. Import Configs
      const cfgSnap = await adminDb.collection("importConfigs").get();
      if (!cfgSnap.empty) {
        this.db.importConfigs = cfgSnap.docs.map((d) => d.data() as ImportConfig);
      }

      // 12. Import Batches
      const batchSnap = await adminDb.collection("importBatches").get();
      if (!batchSnap.empty) {
        this.db.importBatches = batchSnap.docs.map((d) => d.data() as ImportBatch);
      }

      this.dbStatus = "ok";
      this.dbErrorDetails = null;
      this.isInitialized = true;
      console.log(
        `[Firestore] Connected: ${this.db.leads.length} leads, ${this.db.audiences.length} audiences, ${this.db.importConfigs.length} import configs, ${this.db.importBatches.length} batches.`
      );
    } catch (err: any) {
      this.isInitialized = true;
      const errMsg = err?.message || String(err);
      if (err?.code === 7 || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("Missing or insufficient permissions")) {
        this.dbStatus = "permission_denied";
      } else {
        this.dbStatus = "unavailable";
      }
      this.dbErrorDetails = errMsg;
      console.error(`[Firestore Connection Error] Status: ${this.dbStatus} - Details: ${errMsg}`);
    }
  }

  public getHealth(): {
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
    apify: {
      configured: boolean;
      status: string;
    };
  } {
    const isReachable = this.dbStatus === "ok";
    return {
      status: isReachable ? "ok" : "degraded",
      database: {
        provider: "firestore",
        reachable: isReachable,
        status: this.dbStatus,
        projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || "unknown",
        databaseId: firebaseConfig.firestoreDatabaseId || "(default)",
        credentialMode,
        error: this.dbErrorDetails,
      },
      auth: "firebase_auth",
      ai: {
        configured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()),
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      },
      apify: {
        configured: Boolean(this.db.apifyIntegration.token),
        status: this.db.apifyIntegration.status,
      },
    };
  }

  // --- Authorized Emails ---
  public getAuthorizedEmails(): string[] {
    const envEmails = (process.env.AUTHORIZED_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const storedEmails = (this.db.appSettings.authorizedEmails || []).map((e) => e.trim().toLowerCase());
    const all = Array.from(new Set([...envEmails, ...storedEmails, "ferramentaas.1@gmail.com", "paulo.direct.response@gmail.com"]));
    return all.filter(Boolean);
  }

  // --- APIFY INTEGRATION SYSTEM (V2.1) ---

  public getApifyIntegrationStatus(): ApifyIntegrationStatus {
    const integ = this.db.apifyIntegration;
    const isConfigured = Boolean(integ.token && integ.token.trim());
    return {
      configured: isConfigured,
      status: integ.status,
      maskedToken: isConfigured ? maskToken(integ.token!) : undefined,
      accountId: integ.accountId,
      accountUsername: integ.accountUsername,
      lastTestAt: integ.lastTestAt,
      errorMessage: integ.errorMessage,
    };
  }

  public getRawApifyToken(): string | undefined {
    return this.db.apifyIntegration.token || process.env.APIFY_TOKEN || undefined;
  }

  public async saveApifyToken(token: string): Promise<ApifyIntegrationStatus> {
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new ApifyError("APIFY_INVALID_TOKEN", "O token da Apify é obrigatório e não pode ser vazio.", 400);
    }

    const cleanToken = token.trim();
    // Validate with Apify API
    const user = await apifyService.validateToken(cleanToken);
    const now = getCurrentIso();

    const stored: StoredApifyIntegration = {
      token: cleanToken,
      accountId: user.id,
      accountUsername: user.username,
      lastTestAt: now,
      status: "connected",
      errorMessage: undefined,
    };

    await safeFirestoreWrite(() =>
      adminDb.collection("integrations").doc("apify").set(stripUndefinedDeep(stored))
    );

    this.db.apifyIntegration = stored;
    return this.getApifyIntegrationStatus();
  }

  public async testApifyConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    const token = this.getRawApifyToken();
    if (!token) {
      this.db.apifyIntegration.status = "not_configured";
      this.db.apifyIntegration.errorMessage = "Token da Apify não configurado.";
      return { success: false, error: "Token da Apify não configurado." };
    }

    try {
      const user = await apifyService.validateToken(token);
      const now = getCurrentIso();
      this.db.apifyIntegration.status = "connected";
      this.db.apifyIntegration.accountId = user.id;
      this.db.apifyIntegration.accountUsername = user.username;
      this.db.apifyIntegration.lastTestAt = now;
      this.db.apifyIntegration.errorMessage = undefined;

      await safeFirestoreWrite(() =>
        adminDb.collection("integrations").doc("apify").set(stripUndefinedDeep(this.db.apifyIntegration))
      );

      return { success: true, user };
    } catch (err: any) {
      this.db.apifyIntegration.status = "error";
      this.db.apifyIntegration.errorMessage = err.message || "Erro ao validar conexão com Apify.";
      await safeFirestoreWrite(() =>
        adminDb.collection("integrations").doc("apify").set(stripUndefinedDeep(this.db.apifyIntegration))
      );
      return { success: false, error: err.message };
    }
  }

  public async removeApifyToken(): Promise<void> {
    this.db.apifyIntegration = {
      status: "not_configured",
      token: undefined,
      accountId: undefined,
      accountUsername: undefined,
      errorMessage: undefined,
      lastTestAt: undefined,
    };

    await safeFirestoreWrite(() => adminDb.collection("integrations").doc("apify").delete());
  }

  // --- IMPORT CONFIGS (V2.1) ---

  public getImportConfigs(includeArchived = false): ImportConfig[] {
    return this.db.importConfigs
      .filter((c) => {
        if (c.isDeleted) return false;
        if (!includeArchived && !c.isActive) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getImportConfigById(id: string): ImportConfig | undefined {
    const c = this.db.importConfigs.find((item) => item.id === id);
    return c && !c.isDeleted ? c : undefined;
  }

  public async createImportConfig(
    payload: {
      name: string;
      audienceId: string;
      keywords: string[];
      searchLimitPerKeyword?: number;
      minFollowers?: number;
      maxFollowers?: number;
      ignorePrivate?: boolean;
      liveSearch?: boolean;
    },
    createdBy = "Operador"
  ): Promise<ImportConfig> {
    if (!payload.name || !payload.name.trim()) {
      throw new Error("O nome da configuração de importação é obrigatório.");
    }
    if (!payload.audienceId) {
      throw new Error("Público-alvo é obrigatório para salvar a configuração.");
    }
    const audience = this.db.audiences.find((a) => a.id === payload.audienceId && !a.isDeleted);
    if (!audience) {
      throw new Error("Público-alvo não encontrado.");
    }

    const cleanKeywords = Array.from(
      new Set(
        (payload.keywords || [])
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );

    if (cleanKeywords.length === 0) {
      throw new Error("Informe pelo menos 1 palavra-chave para a busca.");
    }
    if (cleanKeywords.length > 30) {
      throw new Error("Máximo de 30 palavras-chave por configuração permitido.");
    }

    const limit = Math.max(1, Math.min(250, Number(payload.searchLimitPerKeyword) || 30));

    if (
      payload.minFollowers !== undefined &&
      payload.maxFollowers !== undefined &&
      payload.minFollowers > payload.maxFollowers
    ) {
      throw new Error("O número mínimo de seguidores não pode ser maior que o máximo.");
    }

    const now = getCurrentIso();
    const config: ImportConfig = {
      id: `cfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: payload.name.trim(),
      audienceId: payload.audienceId,
      keywords: cleanKeywords,
      searchLimitPerKeyword: limit,
      minFollowers: payload.minFollowers !== undefined ? Math.max(0, payload.minFollowers) : undefined,
      maxFollowers: payload.maxFollowers !== undefined ? Math.max(0, payload.maxFollowers) : undefined,
      ignorePrivate: payload.ignorePrivate ?? true,
      liveSearch: payload.liveSearch ?? false,
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy,
    };

    const cleanConfig = stripUndefinedDeep(config);
    await safeFirestoreWrite(() => adminDb.collection("importConfigs").doc(config.id).set(cleanConfig));
    this.db.importConfigs.unshift(config);
    return config;
  }

  public async updateImportConfig(
    id: string,
    patch: Partial<ImportConfig>
  ): Promise<ImportConfig> {
    const index = this.db.importConfigs.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error("Configuração de importação não encontrada.");
    }

    const current = this.db.importConfigs[index];

    let cleanKeywords = current.keywords;
    if (patch.keywords) {
      cleanKeywords = Array.from(
        new Set(
          patch.keywords
            .map((k) => k.trim())
            .filter((k) => k.length > 0)
        )
      );
      if (cleanKeywords.length === 0) {
        throw new Error("Informe pelo menos 1 palavra-chave.");
      }
      if (cleanKeywords.length > 30) {
        throw new Error("Máximo de 30 palavras-chave permitido.");
      }
    }

    if (patch.audienceId) {
      const aud = this.db.audiences.find((a) => a.id === patch.audienceId && !a.isDeleted);
      if (!aud) throw new Error("Público-alvo especificado não existe.");
    }

    const minFollowers = patch.minFollowers !== undefined ? patch.minFollowers : current.minFollowers;
    const maxFollowers = patch.maxFollowers !== undefined ? patch.maxFollowers : current.maxFollowers;
    if (minFollowers !== undefined && maxFollowers !== undefined && minFollowers > maxFollowers) {
      throw new Error("O mínimo de seguidores não pode ultrapassar o máximo.");
    }

    const updated: ImportConfig = {
      ...current,
      ...patch,
      keywords: cleanKeywords,
      updatedAt: getCurrentIso(),
    };

    const cleanConfig = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("importConfigs").doc(id).set(cleanConfig));
    this.db.importConfigs[index] = updated;
    return updated;
  }

  public async deleteImportConfig(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; config?: ImportConfig; message: string }> {
    const index = this.db.importConfigs.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, message: "Configuração não encontrada." };
    const current = this.db.importConfigs[index];
    const updated: ImportConfig = {
      ...current, isDeleted: true, isActive: false, deletedAt: getCurrentIso(), deletedBy: performedBy, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("importConfigs").doc(id).set(stripUndefinedDeep(updated)));
    this.db.importConfigs[index] = updated;
    return { success: true, config: updated, message: "Configuração enviada para a Lixeira." };
  }

  public async restoreImportConfig(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; config?: ImportConfig; message: string }> {
    const index = this.db.importConfigs.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, message: "Configuração não encontrada." };
    const current = this.db.importConfigs[index];
    const updated: ImportConfig = {
      ...current, isDeleted: false, isActive: true, deletedAt: null, deletedBy: null, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("importConfigs").doc(id).set(stripUndefinedDeep(updated)));
    this.db.importConfigs[index] = updated;
    return { success: true, config: updated, message: "Configuração restaurada com sucesso." };
  }

  // --- IMPORT BATCHES & APIFY EXECUTION (V2.1) ---

  public getImportBatches(): ImportBatch[] {
    return this.db.importBatches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getImportBatchById(id: string): ImportBatch | undefined {
    return this.db.importBatches.find((b) => b.id === id);
  }

  /**
   * Starts an Apify search import, creates the batch in queued/running state, and triggers actor.
   */
  public async startApifyImport(
    params: {
      configId?: string;
      audienceId: string;
      keywords: string[];
      searchLimitPerKeyword?: number;
      minFollowers?: number;
      maxFollowers?: number;
      ignorePrivate?: boolean;
      liveSearch?: boolean;
    },
    createdBy = "Operador"
  ): Promise<ImportBatch> {
    const token = this.getRawApifyToken();
    if (!token) {
      throw new ApifyError(
        "APIFY_NOT_CONFIGURED",
        "A integração com a Apify não está configurada. Insira o token da Apify para importar leads.",
        400
      );
    }

    if (!params.audienceId) {
      throw new Error("Público-alvo é obrigatório.");
    }
    const audience = this.db.audiences.find((a) => a.id === params.audienceId && !a.isDeleted);
    if (!audience) {
      throw new Error("Público-alvo não encontrado.");
    }

    const cleanKeywords = Array.from(
      new Set(
        (params.keywords || [])
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );

    if (cleanKeywords.length === 0) {
      throw new Error("Informe pelo menos uma palavra-chave.");
    }
    if (cleanKeywords.length > 30) {
      throw new Error("Máximo de 30 palavras-chave permitido.");
    }

    const limit = Math.max(1, Math.min(250, Number(params.searchLimitPerKeyword) || 30));
    const requestedCount = cleanKeywords.length * limit;

    if (
      params.minFollowers !== undefined &&
      params.maxFollowers !== undefined &&
      params.minFollowers > params.maxFollowers
    ) {
      throw new Error("Seguidores mínimos não podem ser maiores que o máximo.");
    }

    const now = getCurrentIso();
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // 1. Create batch in state and Firestore BEFORE external API call
    const newBatch: ImportBatch = {
      id: batchId,
      configId: params.configId || undefined,
      configSnapshot: {
        audienceId: params.audienceId,
        keywords: cleanKeywords,
        searchLimitPerKeyword: limit,
        minFollowers: params.minFollowers,
        maxFollowers: params.maxFollowers,
        ignorePrivate: params.ignorePrivate ?? true,
        liveSearch: params.liveSearch ?? false,
      },
      audienceId: params.audienceId,
      audienceName: audience.name,
      keywords: cleanKeywords,
      requestedCount,
      status: "running",
      receivedCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      filteredCount: 0,
      errorCount: 0,
      costUsd: null,
      createdAt: now,
      startedAt: now,
      createdBy,
    };

    this.db.importBatches.unshift(newBatch);
    await safeFirestoreWrite(() =>
      adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(newBatch))
    );

    // 2. Invoke Apify Actor
    try {
      const runResult = await apifyService.startInstagramSearchRun(token, {
        keywords: cleanKeywords,
        searchLimitPerKeyword: limit,
        liveSearch: params.liveSearch,
      });

      newBatch.apifyRunId = runResult.runId;
      newBatch.apifyDatasetId = runResult.defaultDatasetId;
      newBatch.status = runResult.status === "SUCCEEDED" ? "processing" : "running";

      await safeFirestoreWrite(() =>
        adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(newBatch))
      );

      // If run already succeeded synchronously (e.g. mock test), process immediately
      if (runResult.status === "SUCCEEDED" && runResult.defaultDatasetId) {
        await this.checkAndUpdateImportBatch(batchId);
      }

      return newBatch;
    } catch (err: any) {
      newBatch.status = "failed";
      newBatch.errorCode = err.code || "APIFY_RUN_FAILED";
      newBatch.errorMessage = err.message || "Falha ao iniciar o scraper na Apify.";
      newBatch.completedAt = getCurrentIso();

      await safeFirestoreWrite(() =>
        adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(newBatch))
      );

      throw err;
    }
  }

  /**
   * Checks Apify run status, fetches dataset when ready, deduplicates, and creates leads
   */
  public async checkAndUpdateImportBatch(batchId: string): Promise<ImportBatch> {
    const batchIndex = this.db.importBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1) {
      throw new Error("Lote de importação não encontrado.");
    }

    const batch = this.db.importBatches[batchIndex];
    if (batch.status === "completed" || batch.status === "failed" || batch.status === "cancelled") {
      return batch;
    }

    if (!batch.apifyRunId) {
      batch.status = "failed";
      batch.errorMessage = "ID de execução da Apify não encontrado no lote.";
      await safeFirestoreWrite(() =>
        adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
      );
      return batch;
    }

    const token = this.getRawApifyToken();
    if (!token) {
      batch.status = "failed";
      batch.errorMessage = "Token da Apify não configurado.";
      await safeFirestoreWrite(() =>
        adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
      );
      return batch;
    }

    try {
      const runInfo = await apifyService.getRunStatus(token, batch.apifyRunId);
      if (runInfo.usageTotalUsd !== undefined) {
        batch.costUsd = runInfo.usageTotalUsd;
      }
      if (runInfo.defaultDatasetId && !batch.apifyDatasetId) {
        batch.apifyDatasetId = runInfo.defaultDatasetId;
      }

      if (runInfo.status === "RUNNING" || runInfo.status === "READY") {
        batch.status = "running";
        await safeFirestoreWrite(() =>
          adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
        );
        return batch;
      }

      if (runInfo.status === "FAILED" || runInfo.status === "ABORTED" || runInfo.status === "TIMED-OUT") {
        batch.status = "failed";
        batch.errorCode = `APIFY_${runInfo.status}`;
        batch.errorMessage = `A execução da Apify terminou com status: ${runInfo.status}`;
        batch.completedAt = getCurrentIso();
        await safeFirestoreWrite(() =>
          adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
        );
        return batch;
      }

      if (runInfo.status === "SUCCEEDED") {
        batch.status = "processing";
        const datasetId = batch.apifyDatasetId || runInfo.defaultDatasetId;
        if (!datasetId) {
          batch.status = "failed";
          batch.errorMessage = "Dataset da Apify não retornado.";
          batch.completedAt = getCurrentIso();
          await safeFirestoreWrite(() =>
            adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
          );
          return batch;
        }

        const items = await apifyService.getDatasetItems(token, datasetId);
        return await this.processApifyDatasetForBatch(batch, items);
      }

      return batch;
    } catch (err: any) {
      batch.status = "failed";
      batch.errorMessage = err.message || "Erro ao verificar execução na Apify.";
      batch.completedAt = getCurrentIso();
      await safeFirestoreWrite(() =>
        adminDb.collection("importBatches").doc(batchId).set(stripUndefinedDeep(batch))
      );
      return batch;
    }
  }

  /**
   * Processes dataset items with normalization, filtering, global deduplication, and atomic lead creation.
   * INVIOLABLE RULE: Leads enter as PENDENTE / NOVO / NAO_OFERECIDO with 0 contacts realized.
   */
  public async processApifyDatasetForBatch(batch: ImportBatch, rawItems: any[]): Promise<ImportBatch> {
    batch.receivedCount = rawItems.length;

    const minFollowers = batch.configSnapshot.minFollowers;
    const maxFollowers = batch.configSnapshot.maxFollowers;
    const ignorePrivate = batch.configSnapshot.ignorePrivate ?? true;

    const createdLeads: Lead[] = [];
    const batchSeenUsernames = new Set<string>();
    const now = getCurrentIso();

    let importedCount = 0;
    let duplicateCount = 0;
    let filteredCount = 0;
    let errorCount = 0;

    for (const rawItem of rawItems) {
      const parsed = mapApifyInstagramUser(rawItem);

      if (parsed.hasError || !parsed.isValid || !parsed.normalizedUsername) {
        errorCount++;
        continue;
      }

      // Check in-batch duplication
      if (batchSeenUsernames.has(parsed.normalizedUsername)) {
        duplicateCount++;
        continue;
      }
      batchSeenUsernames.add(parsed.normalizedUsername);

      // Check privacy filter
      if (ignorePrivate && parsed.isPrivate) {
        filteredCount++;
        continue;
      }

      // Check follower bounds
      if (parsed.followersCount !== undefined) {
        if (minFollowers !== undefined && parsed.followersCount < minFollowers) {
          filteredCount++;
          continue;
        }
        if (maxFollowers !== undefined && parsed.followersCount > maxFollowers) {
          filteredCount++;
          continue;
        }
      }

      // Check global database duplication (active, archived, closed, lost, deleted, and atomic identities)
      const isGlobalDuplicate = this.db.leads.some(
        (l) =>
          l.instagramUsernameNormalized === parsed.normalizedUsername ||
          (parsed.externalId && l.apifyExternalId === parsed.externalId)
      );

      if (isGlobalDuplicate) {
        duplicateCount++;
        continue;
      }

      // Create new Lead - strictly adhering to CRM business schema
      const newLeadId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newLead: Lead = {
        id: newLeadId,
        source: "active",
        discoverySource: "apify",
        instagramUrl: parsed.canonicalUrl,
        instagramUsernameNormalized: parsed.normalizedUsername,
        temporaryLabel: parsed.fullName || `@${parsed.normalizedUsername}`,
        audienceId: batch.audienceId,
        manualClass: "PENDENTE",
        status: "novo",
        testStatus: "nao_oferecido",
        importBatchId: batch.id,
        importConfigId: batch.configId,
        importedAt: now,
        importQuery: batch.keywords.join(", "),
        apifyExternalId: parsed.externalId,
        profileData: {
          fullName: parsed.fullName,
          followerCount: parsed.followersCount,
          biography: parsed.biography,
          publicEmail: parsed.publicEmail,
          publicPhone: parsed.publicPhone,
          isPrivate: parsed.isPrivate,
        },
        createdAt: now,
        updatedAt: now,
        version: 1,
        isArchived: false,
        isDeleted: false,
        stageDates: {},
        testDates: {},
      };

      createdLeads.push(newLead);
      importedCount++;
    }

    // Persist all new leads in Firestore & in-memory state
    if (createdLeads.length > 0) {
      const batchOp = adminDb.batch();
      for (const lead of createdLeads) {
        batchOp.set(adminDb.collection("leads").doc(lead.id), stripUndefinedDeep(lead));
        // Reserve atomic identity in instagramIdentities for concurrency safety
        if (lead.instagramUsernameNormalized) {
          batchOp.set(
            adminDb.collection("instagramIdentities").doc(lead.instagramUsernameNormalized),
            {
              leadId: lead.id,
              username: lead.instagramUsernameNormalized,
              reservedAt: now,
            }
          );
        }
      }
      await safeFirestoreWrite(() => batchOp.commit());
      this.db.leads.unshift(...createdLeads);
    }

    // Finalize batch stats
    batch.status = "completed";
    batch.receivedCount = rawItems.length;
    batch.importedCount = importedCount;
    batch.duplicateCount = duplicateCount;
    batch.filteredCount = filteredCount;
    batch.errorCount = errorCount;
    batch.completedAt = getCurrentIso();

    await safeFirestoreWrite(() =>
      adminDb.collection("importBatches").doc(batch.id).set(stripUndefinedDeep(batch))
    );

    return batch;
  }

  // --- Activities ---
  public getActivitiesForLead(leadId: string): Activity[] {
    return this.db.activities
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public async logActivity(payload: Omit<Activity, "id" | "timestamp">): Promise<Activity> {
    const act: Activity = {
      ...payload,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: getCurrentIso(),
    };
    const cleanAct = stripUndefinedDeep(act);
    await safeFirestoreWrite(() => adminDb.collection("activities").doc(act.id).set(cleanAct));
    this.db.activities.unshift(act);
    return act;
  }

  // --- Leads CRUD & Business Rules ---
  public getLeads(filters: {
    status?: FunnelStatus;
    manualClass?: OperationalClass;
    audienceId?: string;
    source?: "active" | "paid";
    scriptVersionId?: string;
    isArchived?: boolean;
    search?: string;
    importBatchId?: string;
  }): Lead[] {
    return this.db.leads.filter((lead) => {
      if (lead.isDeleted) return false;
      if (filters.isArchived !== undefined && lead.isArchived !== filters.isArchived) {
        return false;
      }
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.manualClass && lead.manualClass !== filters.manualClass) return false;
      if (filters.audienceId && lead.audienceId !== filters.audienceId) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.scriptVersionId && lead.scriptVersionId !== filters.scriptVersionId) return false;
      if (filters.importBatchId && lead.importBatchId !== filters.importBatchId) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchesInsta = lead.instagramUsernameNormalized?.includes(q);
        const matchesUrl = lead.instagramUrl?.toLowerCase().includes(q);
        const matchesLabel = lead.temporaryLabel?.toLowerCase().includes(q);
        const matchesNotes = lead.notes?.toLowerCase().includes(q);
        const matchesCustName = lead.customerData?.name?.toLowerCase().includes(q);
        const matchesBio = lead.profileData?.biography?.toLowerCase().includes(q);
        if (!matchesInsta && !matchesUrl && !matchesLabel && !matchesNotes && !matchesCustName && !matchesBio) {
          return false;
        }
      }
      return true;
    });
  }

  public getLeadById(id: string): Lead | undefined {
    const l = this.db.leads.find((item) => item.id === id);
    return l && !l.isDeleted ? l : undefined;
  }

  /**
   * Returns the next eligible active lead to prospect based on chosen filters and deterministic ordering.
   * Also computes remainingCount of eligible leads matching these filters in this session.
   */
  public getNextProspectLead(filters: {
    audienceId?: string;
    classes?: OperationalClass[] | string;
    discoverySource?: "all" | "apify" | "manual";
    importBatchId?: string;
    excludeIds?: string[];
  }): { lead: Lead | null; remainingCount: number } {
    let selectedClasses: OperationalClass[] = ["PENDENTE", "A", "B", "C"];
    if (filters.classes) {
      if (Array.isArray(filters.classes) && filters.classes.length > 0) {
        selectedClasses = filters.classes;
      } else if (typeof filters.classes === "string" && filters.classes.trim().length > 0) {
        selectedClasses = filters.classes.split(",").map((c) => c.trim()) as OperationalClass[];
      }
    }

    const excludeSet = new Set(filters.excludeIds || []);

    const eligibleLeads = this.db.leads.filter((lead) => {
      // 1. Not deleted or archived
      if (lead.isDeleted || lead.deletedAt || lead.isArchived) return false;

      // 2. Active source only
      if (lead.source !== "active") return false;

      // 3. Class filter: must be in selectedClasses and NOT RECUSADO
      if (lead.manualClass === "RECUSADO") return false;
      if (!selectedClasses.includes(lead.manualClass)) return false;

      // 4. Must not have been contacted (no firstContactSnapshot and no contactedAt)
      if (lead.firstContactSnapshot) return false;
      if (lead.stageDates?.contactedAt) return false;

      // 5. Status must be uncontacted (novo, analisado)
      if (lead.status !== "novo" && lead.status !== "analisado") return false;

      // 6. Audience filter
      if (filters.audienceId && filters.audienceId !== "all" && lead.audienceId !== filters.audienceId) {
        return false;
      }

      // 7. Discovery source filter (manual, apify)
      if (filters.discoverySource && filters.discoverySource !== "all") {
        const leadDisc = lead.discoverySource || "manual";
        if (leadDisc !== filters.discoverySource) return false;
      }

      // 8. Import batch filter
      if (filters.importBatchId && filters.importBatchId !== "all") {
        if (lead.importBatchId !== filters.importBatchId) return false;
      }

      // 9. Exclude IDs in current session
      if (excludeSet.has(lead.id)) return false;

      return true;
    });

    // Deterministic sorting:
    // importedAt ASC fallback createdAt ASC, and id as tie-breaker
    eligibleLeads.sort((a, b) => {
      const dateA = a.importedAt || a.createdAt || "";
      const dateB = b.importedAt || b.createdAt || "";
      const timeDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
      if (timeDiff !== 0) return timeDiff;

      const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (createdDiff !== 0) return createdDiff;

      return a.id.localeCompare(b.id);
    });

    const remainingCount = eligibleLeads.length;
    const lead = remainingCount > 0 ? eligibleLeads[0] : null;

    return {
      lead,
      remainingCount,
    };
  }

  public checkDuplicateInstagram(
    usernameNormalized: string,
    excludeLeadId?: string
  ): { isDuplicate: boolean; existingLead?: Lead } {
    if (!usernameNormalized) return { isDuplicate: false };
    const found = this.db.leads.find(
      (l) =>
        l.instagramUsernameNormalized === usernameNormalized &&
        l.id !== excludeLeadId
    );
    return { isDuplicate: !!found, existingLead: found };
  }

  public async createLead(
    payload: {
      source: "active" | "paid";
      instagramUrl?: string;
      instagramUsername?: string;
      temporaryLabel?: string;
      audienceId: string;
      manualClass?: OperationalClass;
      scriptVersionId?: string;
      notes?: string;
      paidCampaign?: string;
      paidCreative?: string;
      duplicateOverride?: boolean;
      aiEvaluation?: any;
      customerData?: any;
      discoverySource?: "manual" | "apify";
      importBatchId?: string;
      importConfigId?: string;
      profileData?: any;
    },
    performedBy = "Operador"
  ): Promise<{ lead?: Lead; error?: string; conflict?: boolean; duplicateLead?: Lead; code?: string }> {
    if (!payload.source || !["active", "paid"].includes(payload.source)) {
      return { error: "Origem (source) deve ser 'active' ou 'paid'.", code: "VALIDATION_ERROR" };
    }

    if (!payload.audienceId) {
      return { error: "Público/Nicho é obrigatório.", code: "VALIDATION_ERROR" };
    }

    const audience = this.db.audiences.find((a) => a.id === payload.audienceId && !a.isDeleted);
    if (!audience) {
      return { error: "Público especificado não foi encontrado.", code: "NOT_FOUND" };
    }

    let normUrl = "";
    let normUsername = "";

    const rawInput = payload.instagramUrl || payload.instagramUsername;
    if (rawInput) {
      const norm = normalizeInstagramIdentity(rawInput);
      if (!norm.isValid) {
        if (payload.source === "active") {
          return {
            error: "Link ou @username do Instagram inválido. Formato esperado: @perfil ou instagram.com/perfil",
            code: "VALIDATION_ERROR",
          };
        }
      } else {
        normUrl = norm.canonicalUrl;
        normUsername = norm.normalizedUsername;
      }
    }

    if (payload.source === "active" && !normUsername) {
      return {
        error: "Para prospecção ativa, é obrigatório informar um @username ou link de perfil do Instagram válido.",
        code: "VALIDATION_ERROR",
      };
    }

    if (payload.source === "paid" && !normUsername && (!payload.temporaryLabel || !payload.temporaryLabel.trim())) {
      return {
        error: "Para tráfego pago sem Instagram, forneça um identificador mínimo (rótulo/nome).",
        code: "VALIDATION_ERROR",
      };
    }

    if (normUsername) {
      const dupCheck = this.checkDuplicateInstagram(normUsername);
      if (dupCheck.isDuplicate && !payload.duplicateOverride) {
        return {
          conflict: true,
          code: "DUPLICATE_LEAD",
          error: `Já existe um lead cadastrado com o Instagram @${normUsername}. Deseja abrir o lead existente ou confirmar override?`,
          duplicateLead: dupCheck.existingLead,
        };
      }
    }

    const now = getCurrentIso();
    const newId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newLead: Lead = {
      id: newId,
      source: payload.source,
      discoverySource: payload.discoverySource || "manual",
      instagramUrl: normUrl || undefined,
      instagramUsernameNormalized: normUsername || undefined,
      temporaryLabel: payload.temporaryLabel?.trim() || undefined,
      audienceId: payload.audienceId,
      manualClass: payload.manualClass || "PENDENTE",
      status: "novo",
      testStatus: "nao_oferecido",
      scriptVersionId: payload.scriptVersionId || undefined,
      notes: payload.notes?.trim() || undefined,
      paidCampaign: payload.paidCampaign?.trim() || undefined,
      paidCreative: payload.paidCreative?.trim() || undefined,
      customerData: payload.customerData || undefined,
      profileData: payload.profileData || undefined,
      importBatchId: payload.importBatchId || undefined,
      importConfigId: payload.importConfigId || undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isArchived: false,
      isDeleted: false,
      duplicateOverride: !!payload.duplicateOverride,
      stageDates: {},
      testDates: {},
      aiEvaluation: payload.aiEvaluation || undefined,
    };

    if (payload.scriptVersionId) {
      await this.lockScript(payload.scriptVersionId);
    }

    const cleanLead = stripUndefinedDeep(newLead);
    await safeFirestoreWrite(() => adminDb.collection("leads").doc(newId).set(cleanLead));
    this.db.leads.unshift(newLead);

    await this.logActivity({
      leadId: newId,
      type: "creation",
      title: "Lead criado",
      description: `Lead criado com origem ${payload.source === "active" ? "Prospecção Ativa" : "Tráfego Pago"} e classe ${newLead.manualClass}.`,
      performedBy,
    });

    if (payload.duplicateOverride) {
      await this.logActivity({
        leadId: newId,
        type: "duplicate_override",
        title: "Override de duplicidade",
        description: `Cadastro confirmado conscientemente apesar de @${normUsername} já existir.`,
        performedBy,
      });
    }

    return { lead: newLead };
  }

  public async updateLead(
    id: string,
    patch: Partial<Lead> & { lossReasonId?: string; lossReasonOther?: string; lossReasonOtherText?: string; expectedVersion?: number },
    performedBy = "Operador"
  ): Promise<{ lead?: Lead; error?: string; conflict?: boolean; currentLead?: Lead; code?: string }> {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) {
      return { error: "Lead não encontrado.", code: "NOT_FOUND" };
    }

    const current = this.db.leads[index];
    const requestedExpectedVersion = patch.expectedVersion ?? current.version;
    const { expectedVersion: _expectedVersion, lossReasonOtherText: _lossReasonOtherText, ...persistablePatch } = patch;
    const pendingActivities: Array<Omit<Activity, "id" | "timestamp">> = [];
    let scriptToLockId: string | null = null;

    // Fast local optimistic concurrency check. A second authoritative check is
    // performed inside the Firestore transaction immediately before commit.
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      return {
        conflict: true,
        code: "LEAD_VERSION_CONFLICT",
        error: "Este lead foi modificado simultaneamente por outro usuário ou aba. Recarregue para revisar as alterações mais recentes.",
        currentLead: current,
      };
    }

    const now = getCurrentIso();
    const updatedStageDates: any = { ...current.stageDates };
    const updatedTestDates: any = { ...current.testDates };
    let newSnapshot = current.firstContactSnapshot ? { ...current.firstContactSnapshot } : undefined;

    // 1. Status transition logic
    if (patch.status && patch.status !== current.status) {
      const targetStatus = patch.status;

      // When marking Contatado on active lead, require scriptVersionId
      if (targetStatus === "contatado" && current.source === "active") {
        const scriptIdToUse = patch.scriptVersionId || current.scriptVersionId;
        if (!scriptIdToUse) {
          return {
            error: "Ao marcar Contatado em prospecção ativa, é obrigatório selecionar a versão do script utilizada.",
            code: "VALIDATION_ERROR",
          };
        }
      }

      // When marking Perdido, require lossReasonId
      if (targetStatus === "perdido") {
        const reasonId = patch.lossReasonId || current.lossReasonId;
        if (!reasonId) {
          return { error: "Ao marcar como Perdido, o motivo de perda é obrigatório.", code: "VALIDATION_ERROR" };
        }
        const reason = this.db.lossReasons.find((r) => r.id === reasonId);
        if (reason?.isOther) {
          const otherText = patch.lossReasonOther || patch.lossReasonOtherText || current.lossReasonOther;
          if (!otherText || !otherText.trim()) {
            return { error: "Para o motivo 'Outro', é obrigatório especificar a justificativa.", code: "VALIDATION_ERROR" };
          }
        }
      }

      // Automatically guarantee contactedAt and full historical snapshot when advancing to any posterior stage
      const posteriorStages: FunnelStatus[] = [
        "contatado",
        "respondeu",
        "reuniao_agendada",
        "reuniao_realizada",
        "teste_oferecido",
        "teste_aceito",
        "negociacao",
        "fechado",
      ];

      if (posteriorStages.includes(targetStatus)) {
        if (!updatedStageDates.contactedAt) {
          updatedStageDates.contactedAt = now;
        }
        if (!newSnapshot) {
          const scriptId = patch.scriptVersionId || current.scriptVersionId || "";
          const targetScript = scriptId ? this.db.scripts.find((s) => s.id === scriptId) : undefined;
          const targetAudience = this.db.audiences.find(
            (a) => a.id === (patch.audienceId || current.audienceId)
          );

          newSnapshot = {
            classAtFirstContact: patch.manualClass || current.manualClass,
            audienceIdAtFirstContact: patch.audienceId || current.audienceId,
            audienceNameAtFirstContact: targetAudience?.name,
            scriptVersionIdAtFirstContact: scriptId,
            scriptNameAtFirstContact: targetScript?.baseName,
            scriptVersionAtFirstContact: targetScript?.version,
            scriptContentAtFirstContact: targetScript?.content,
            sourceAtFirstContact: current.source,
            firstContactAt: now,
            performedBy,
          };

          if (scriptId) {
            scriptToLockId = scriptId;
          }
        }
      }

      // Map specific stage dates
      if (targetStatus === "respondeu" && !updatedStageDates.respondedAt) updatedStageDates.respondedAt = now;
      if (targetStatus === "reuniao_agendada" && !updatedStageDates.meetingScheduledAt) updatedStageDates.meetingScheduledAt = now;
      if (targetStatus === "reuniao_realizada" && !updatedStageDates.meetingHeldAt) updatedStageDates.meetingHeldAt = now;
      if (targetStatus === "teste_oferecido" && !updatedStageDates.testOfferedAt) updatedStageDates.testOfferedAt = now;
      if (targetStatus === "teste_aceito" && !updatedStageDates.testAcceptedAt) updatedStageDates.testAcceptedAt = now;
      if (targetStatus === "negociacao" && !updatedStageDates.negotiationAt) updatedStageDates.negotiationAt = now;
      if (targetStatus === "fechado" && !updatedStageDates.closedAt) updatedStageDates.closedAt = now;
      if (targetStatus === "perdido" && !updatedStageDates.lostAt) updatedStageDates.lostAt = now;

      pendingActivities.push({
        leadId: id,
        type: "status_change",
        title: "Status alterado",
        description: `Status alterado de '${current.status}' para '${targetStatus}'.`,
        before: current.status,
        after: targetStatus,
        performedBy,
      });
    }

    // 2. Test status transition logic
    if (patch.testStatus && patch.testStatus !== current.testStatus) {
      const targetTest = patch.testStatus;
      if (targetTest === "oferecido" && !updatedTestDates.offeredAt) updatedTestDates.offeredAt = now;
      if (targetTest === "aceito" && !updatedTestDates.acceptedAt) updatedTestDates.acceptedAt = now;
      if (targetTest === "em_producao" && !updatedTestDates.inProductionAt) updatedTestDates.inProductionAt = now;
      if (targetTest === "entregue" && !updatedTestDates.deliveredAt) updatedTestDates.deliveredAt = now;
      if (targetTest === "aprovado" && !updatedTestDates.approvedAt) updatedTestDates.approvedAt = now;
      if (targetTest === "recusado" && !updatedTestDates.rejectedAt) updatedTestDates.rejectedAt = now;

      pendingActivities.push({
        leadId: id,
        type: "test_status_change",
        title: "Status do Teste Prático alterado",
        description: `Teste prático alterado de '${current.testStatus}' para '${targetTest}'.`,
        before: current.testStatus,
        after: targetTest,
        performedBy,
      });
    }

    // 3. Class change
    if (patch.manualClass && patch.manualClass !== current.manualClass) {
      pendingActivities.push({
        leadId: id,
        type: "class_change",
        title: "Classificação alterada",
        description: `Classificação operacional alterada de ${current.manualClass} para ${patch.manualClass}.`,
        before: current.manualClass,
        after: patch.manualClass,
        performedBy,
      });
    }

    // 4. Audience change
    if (patch.audienceId && patch.audienceId !== current.audienceId) {
      pendingActivities.push({
        leadId: id,
        type: "audience_change",
        title: "Público alterado",
        description: `Público alterado de ${current.audienceId} para ${patch.audienceId}.`,
        before: current.audienceId,
        after: patch.audienceId,
        performedBy,
      });
    }

    const updatedLead: Lead = {
      ...current,
      ...persistablePatch,
      stageDates: updatedStageDates,
      testDates: updatedTestDates,
      firstContactSnapshot: newSnapshot,
      updatedAt: now,
      version: current.version + 1,
    };

    const cleanLead = stripUndefinedDeep(updatedLead);
    const docRef = adminDb.collection("leads").doc(id);

    const txResult = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) {
        return { kind: "not_found" as const };
      }

      const persistedCurrent = snap.data() as Lead;
      if ((persistedCurrent.version ?? 1) !== requestedExpectedVersion) {
        return { kind: "conflict" as const, currentLead: persistedCurrent };
      }

      tx.set(docRef, cleanLead);
      return { kind: "committed" as const };
    });

    if (txResult.kind === "not_found") {
      return { error: "Lead não encontrado.", code: "NOT_FOUND" };
    }

    if (txResult.kind === "conflict") {
      const fresh = txResult.currentLead;
      this.db.leads[index] = fresh;
      return {
        conflict: true,
        code: "LEAD_VERSION_CONFLICT",
        error: "Este lead foi modificado simultaneamente por outro usuário ou aba. Recarregue para revisar as alterações mais recentes.",
        currentLead: fresh,
      };
    }

    // Cache and side effects only after the authoritative Lead write committed.
    this.db.leads[index] = updatedLead;

    if (scriptToLockId) {
      await this.lockScript(scriptToLockId);
    }
    for (const activity of pendingActivities) {
      await this.logActivity(activity);
    }

    return { lead: updatedLead };
  }

  public async archiveLead(id: string, isArchived = true, performedBy = "Operador"): Promise<{ success: boolean; lead?: Lead }> {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) return { success: false };
    const current = this.db.leads[index];
    const updated: Lead = {
      ...current,
      isArchived,
      updatedAt: getCurrentIso(),
      version: (current.version ?? 1) + 1,
    };

    await safeFirestoreWrite(() => adminDb.collection("leads").doc(id).set(stripUndefinedDeep(updated)));
    this.db.leads[index] = updated;

    await this.logActivity({
      leadId: id,
      type: "status_change",
      title: isArchived ? "Lead arquivado" : "Lead desarquivado",
      description: isArchived ? "Lead movido para arquivo histórico." : "Lead restaurado do arquivo.",
      performedBy,
    });
    return { success: true, lead: updated };
  }

  public async restoreLead(id: string, performedBy = "Operador"): Promise<{ success: boolean; lead?: Lead; message?: string }> {
    const leadIndex = this.db.leads.findIndex((l) => l.id === id);
    if (leadIndex === -1) return { success: false, message: "Lead não encontrado." };
    const current = this.db.leads[leadIndex];
    const updated: Lead = {
      ...current,
      isDeleted: false,
      isArchived: false,
      deletedAt: null,
      deletedBy: null,
      updatedAt: getCurrentIso(),
      version: (current.version ?? 1) + 1,
    };

    await safeFirestoreWrite(() => adminDb.collection("leads").doc(id).set(stripUndefinedDeep(updated)));
    this.db.leads[leadIndex] = updated;

    await this.logActivity({
      leadId: id,
      type: "status_change",
      title: "Lead restaurado da Lixeira",
      description: `Lead restaurado com sucesso por ${performedBy}.`,
      performedBy,
    });
    return { success: true, lead: updated, message: "Lead restaurado com sucesso." };
  }

  public async archiveAudience(id: string): Promise<{ success: boolean; audience?: Audience }> {
    const index = this.db.audiences.findIndex((a) => a.id === id);
    if (index === -1) return { success: false };
    const current = this.db.audiences[index];
    const updated: Audience = { ...current, isActive: !current.isActive, updatedAt: getCurrentIso() };
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(id).set(stripUndefinedDeep(updated)));
    this.db.audiences[index] = updated;
    return { success: true, audience: updated };
  }

  public async deleteLead(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; lead?: Lead; message: string }> {
    const leadIndex = this.db.leads.findIndex((l) => l.id === id);
    if (leadIndex === -1) return { success: false, message: "Lead não encontrado." };
    const current = this.db.leads[leadIndex];
    const updated: Lead = {
      ...current,
      isDeleted: true,
      deletedAt: getCurrentIso(),
      deletedBy: performedBy,
      updatedAt: getCurrentIso(),
      version: (current.version ?? 1) + 1,
    };

    await safeFirestoreWrite(() => adminDb.collection("leads").doc(id).set(stripUndefinedDeep(updated)));
    this.db.leads[leadIndex] = updated;

    await this.logActivity({
      leadId: id,
      type: "status_change",
      title: "Lead enviado para a Lixeira",
      description: `Lead excluído por ${performedBy}.`,
      performedBy,
    });

    return { success: true, lead: updated, message: "Lead movido para a Lixeira com sucesso." };
  }

  // --- Audiences ---
  public getAudiences(includeArchived = false, includeDeleted = false): Audience[] {
    return this.db.audiences.filter((a) => {
      if (!includeDeleted && (a.isDeleted || a.deletedAt)) return false;
      if (!includeArchived && !a.isActive) return false;
      return true;
    });
  }

  public getAudienceById(id: string): Audience | undefined {
    return this.db.audiences.find((a) => a.id === id && !a.isDeleted && !a.deletedAt);
  }

  public async createAudience(payload: {
    name: string;
    description: string;
    criteriaA: string;
    criteriaB: string;
    criteriaC: string;
    aiInstructions?: string;
  }): Promise<Audience> {
    const now = getCurrentIso();
    const aud: Audience = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: payload.name.trim(),
      description: payload.description.trim(),
      criteriaA: payload.criteriaA.trim(),
      criteriaB: payload.criteriaB.trim(),
      criteriaC: payload.criteriaC.trim(),
      aiInstructions: payload.aiInstructions?.trim() || "",
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    const cleanAud = stripUndefinedDeep(aud);
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(aud.id).set(cleanAud));
    this.db.audiences.push(aud);
    return aud;
  }

  public async updateAudience(id: string, patch: Partial<Audience>): Promise<Audience> {
    const index = this.db.audiences.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error("Público não encontrado.");
    }
    const updated: Audience = {
      ...this.db.audiences[index],
      ...patch,
      updatedAt: getCurrentIso(),
    };
    const cleanAud = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(id).set(cleanAud));
    this.db.audiences[index] = updated;
    return updated;
  }

  public async deleteAudience(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; audience?: Audience; message: string }> {
    const index = this.db.audiences.findIndex((a) => a.id === id);
    if (index === -1) return { success: false, message: "Público não encontrado." };
    const current = this.db.audiences[index];
    const updated: Audience = {
      ...current, isActive: false, isDeleted: true, deletedAt: getCurrentIso(), deletedBy: performedBy, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(id).set(stripUndefinedDeep(updated)));
    this.db.audiences[index] = updated;
    return { success: true, audience: updated, message: "Público movido para a Lixeira com sucesso." };
  }

  public async restoreAudience(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; audience?: Audience; message: string }> {
    const index = this.db.audiences.findIndex((a) => a.id === id);
    if (index === -1) return { success: false, message: "Público não encontrado." };
    const current = this.db.audiences[index];
    const updated: Audience = {
      ...current, isActive: true, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(id).set(stripUndefinedDeep(updated)));
    this.db.audiences[index] = updated;
    return { success: true, audience: updated, message: "Público restaurado com sucesso." };
  }

  // --- Scripts ---
  public getScripts(includeArchived = false, audienceId?: string, includeDeleted = false): Script[] {
    return this.db.scripts.filter((s) => {
      if (!includeDeleted && (s.isDeleted || s.deletedAt)) return false;
      if (!includeArchived && !s.isActive) return false;
      if (audienceId && s.audienceId !== audienceId) return false;
      return true;
    });
  }

  public getScriptById(id: string): Script | undefined {
    return this.db.scripts.find((s) => s.id === id && !s.isDeleted && !s.deletedAt);
  }

  public async createScript(payload: {
    baseName: string;
    audienceId: string;
    content: string;
    creationMode?: "prompt" | "free";
    promptUsed?: string;
  }): Promise<Script> {
    const now = getCurrentIso();
    const scr: Script = {
      id: `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      baseName: payload.baseName.trim(),
      audienceId: payload.audienceId,
      version: 1,
      content: payload.content.trim(),
      isActive: true,
      isLocked: false,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      creationMode: payload.creationMode || "free",
      promptUsed: payload.promptUsed,
      createdAt: now,
      updatedAt: now,
    };
    const cleanScr = stripUndefinedDeep(scr);
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(scr.id).set(cleanScr));
    this.db.scripts.push(scr);
    return scr;
  }

  public async updateScript(
    id: string,
    payload: {
      content?: string;
      baseName?: string;
      audienceId?: string;
      isActive?: boolean;
      creationMode?: "prompt" | "free";
      promptUsed?: string;
    }
  ): Promise<{ script: Script; createdNewVersion: boolean }> {
    const existingIndex = this.db.scripts.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error("Script não encontrado.");
    }

    const current = this.db.scripts[existingIndex];
    const now = getCurrentIso();

    // If script is locked, create a new version
    if (current.isLocked && payload.content && payload.content.trim() !== current.content) {
      const sameBase = this.db.scripts.filter((s) => s.baseName === current.baseName);
      const nextVersion = Math.max(...sameBase.map((s) => s.version), 1) + 1;

      const newVersionScript: Script = {
        id: `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        baseName: payload.baseName || current.baseName,
        audienceId: payload.audienceId || current.audienceId,
        version: nextVersion,
        content: payload.content.trim(),
        isActive: payload.isActive !== undefined ? payload.isActive : true,
        isLocked: false,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        parentId: current.id,
        creationMode: payload.creationMode || current.creationMode,
        promptUsed: payload.promptUsed || current.promptUsed,
        createdAt: now,
        updatedAt: now,
      };

      const cleanScr = stripUndefinedDeep(newVersionScript);
      await safeFirestoreWrite(() => adminDb.collection("scripts").doc(newVersionScript.id).set(cleanScr));
      this.db.scripts.push(newVersionScript);
      return { script: newVersionScript, createdNewVersion: true };
    }

    // Editable in place
    const updated: Script = {
      ...current,
      baseName: payload.baseName ? payload.baseName.trim() : current.baseName,
      audienceId: payload.audienceId || current.audienceId,
      content: payload.content ? payload.content.trim() : current.content,
      isActive: payload.isActive !== undefined ? payload.isActive : current.isActive,
      updatedAt: now,
    };

    const cleanScr = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(id).set(cleanScr));
    this.db.scripts[existingIndex] = updated;
    return { script: updated, createdNewVersion: false };
  }

  public async lockScript(id: string): Promise<Script | null> {
    const index = this.db.scripts.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const current = this.db.scripts[index];
    if (current.isLocked) return current;
    const updated: Script = { ...current, isLocked: true, updatedAt: getCurrentIso() };
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(id).set(stripUndefinedDeep(updated)));
    this.db.scripts[index] = updated;
    return updated;
  }

  public async deleteScript(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; script?: Script; message: string }> {
    const index = this.db.scripts.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, message: "Script não encontrado." };
    const current = this.db.scripts[index];
    const updated: Script = {
      ...current, isActive: false, isDeleted: true, deletedAt: getCurrentIso(), deletedBy: performedBy, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(id).set(stripUndefinedDeep(updated)));
    this.db.scripts[index] = updated;
    return { success: true, script: updated, message: "Script movido para a Lixeira com sucesso." };
  }

  public async restoreScript(
    id: string,
    performedBy = "Operador"
  ): Promise<{ success: boolean; script?: Script; message: string }> {
    const index = this.db.scripts.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, message: "Script não encontrado." };
    const current = this.db.scripts[index];
    const updated: Script = {
      ...current, isActive: true, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: getCurrentIso(),
    };
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(id).set(stripUndefinedDeep(updated)));
    this.db.scripts[index] = updated;
    return { success: true, script: updated, message: "Script restaurado com sucesso." };
  }

  // --- TRASH & DATA MANAGEMENT (V2.1.1) ---
  public getTrashItems(): {
    leads: Lead[];
    scripts: Script[];
    audiences: Audience[];
    importConfigs: ImportConfig[];
  } {
    return {
      leads: this.db.leads
        .filter((l) => Boolean(l.isDeleted || l.deletedAt))
        .sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()),
      scripts: this.db.scripts
        .filter((s) => Boolean(s.isDeleted || s.deletedAt))
        .sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()),
      audiences: this.db.audiences
        .filter((a) => Boolean(a.isDeleted || a.deletedAt))
        .sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()),
      importConfigs: this.db.importConfigs
        .filter((c) => Boolean(c.isDeleted || c.deletedAt))
        .sort((a, b) => new Date(b.deletedAt || b.updatedAt).getTime() - new Date(a.deletedAt || a.updatedAt).getTime()),
    };
  }

  public async permanentlyDeleteLead(id: string): Promise<{ success: boolean; message: string }> {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) return { success: false, message: "Lead não encontrado." };
    const lead = this.db.leads[index];

    await safeFirestoreWrite(async () => {
      await adminDb.collection("leads").doc(id).delete();
      if (lead.instagramUsernameNormalized) {
        await adminDb.collection("instagramIdentities").doc(lead.instagramUsernameNormalized).delete().catch(() => {});
      }
    });

    this.db.leads.splice(index, 1);
    return { success: true, message: "Lead excluído definitivamente." };
  }

  public async permanentlyDeleteAudience(id: string): Promise<{ success: boolean; message: string }> {
    const index = this.db.audiences.findIndex((a) => a.id === id);
    if (index === -1) return { success: false, message: "Público não encontrado." };
    await safeFirestoreWrite(() => adminDb.collection("audiences").doc(id).delete());
    this.db.audiences.splice(index, 1);
    return { success: true, message: "Público excluído definitivamente." };
  }

  public async permanentlyDeleteScript(id: string): Promise<{ success: boolean; message: string }> {
    const index = this.db.scripts.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, message: "Script não encontrado." };
    await safeFirestoreWrite(() => adminDb.collection("scripts").doc(id).delete());
    this.db.scripts.splice(index, 1);
    return { success: true, message: "Script excluído definitivamente." };
  }

  public async permanentlyDeleteImportConfig(id: string): Promise<{ success: boolean; message: string }> {
    const index = this.db.importConfigs.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, message: "Configuração não encontrada." };
    await safeFirestoreWrite(() => adminDb.collection("importConfigs").doc(id).delete());
    this.db.importConfigs.splice(index, 1);
    return { success: true, message: "Configuração excluída definitivamente." };
  }

  public async emptyTrash(category?: "all" | "leads" | "scripts" | "audiences" | "configs"): Promise<{ success: boolean; purgedCount: number; message: string }> {
    let purgedCount = 0;

    if (!category || category === "all" || category === "leads") {
      const deletedLeads = this.db.leads.filter((l) => Boolean(l.isDeleted || l.deletedAt));
      for (const lead of deletedLeads) {
        await this.permanentlyDeleteLead(lead.id);
        purgedCount++;
      }
    }

    if (!category || category === "all" || category === "scripts") {
      const deletedScripts = this.db.scripts.filter((s) => Boolean(s.isDeleted || s.deletedAt));
      for (const scr of deletedScripts) {
        await this.permanentlyDeleteScript(scr.id);
        purgedCount++;
      }
    }

    if (!category || category === "all" || category === "audiences") {
      const deletedAudiences = this.db.audiences.filter((a) => Boolean(a.isDeleted || a.deletedAt));
      for (const aud of deletedAudiences) {
        await this.permanentlyDeleteAudience(aud.id);
        purgedCount++;
      }
    }

    if (!category || category === "all" || category === "configs") {
      const deletedConfigs = this.db.importConfigs.filter((c) => Boolean(c.isDeleted || c.deletedAt));
      for (const cfg of deletedConfigs) {
        await this.permanentlyDeleteImportConfig(cfg.id);
        purgedCount++;
      }
    }

    return {
      success: true,
      purgedCount,
      message: `${purgedCount} item(ns) excluído(s) definitivamente da lixeira.`,
    };
  }

  // --- Loss Reasons ---
  public getLossReasons(includeArchived = false): LossReason[] {
    return this.db.lossReasons.filter((r) => includeArchived || r.isActive);
  }

  public async createLossReason(name: string, isOther = false): Promise<LossReason> {
    const reason: LossReason = {
      id: `loss_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      isOther,
      isActive: true,
    };
    const cleanReason = stripUndefinedDeep(reason);
    await safeFirestoreWrite(() => adminDb.collection("lossReasons").doc(reason.id).set(cleanReason));
    this.db.lossReasons.push(reason);
    return reason;
  }

  public async archiveLossReason(id: string): Promise<boolean> {
    const reason = this.db.lossReasons.find((r) => r.id === id);
    if (!reason) return false;
    reason.isActive = false;
    await safeFirestoreWrite(() => adminDb.collection("lossReasons").doc(id).set(stripUndefinedDeep(reason)));
    return true;
  }

  public async deleteLossReason(id: string): Promise<{ success: boolean; message: string }> {
    const index = this.db.lossReasons.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, message: "Motivo de perda não encontrado." };
    await safeFirestoreWrite(() => adminDb.collection("lossReasons").doc(id).delete());
    this.db.lossReasons.splice(index, 1);
    return { success: true, message: "Motivo de perda excluído com sucesso." };
  }

  // --- Daily Goals ---
  public getDailyGoals(): DailyGoal[] {
    return this.db.dailyGoals;
  }

  public async setDailyGoal(payload: DailyGoal): Promise<DailyGoal> {
    const existingIndex = this.db.dailyGoals.findIndex((g) => g.date === payload.date);
    const cleanGoal = stripUndefinedDeep(payload);
    await safeFirestoreWrite(() => adminDb.collection("dailyGoals").doc(payload.date).set(cleanGoal));
    if (existingIndex >= 0) {
      this.db.dailyGoals[existingIndex] = payload;
    } else {
      this.db.dailyGoals.push(payload);
    }
    return payload;
  }

  // --- App Settings ---
  public getSettings(): AppSettings {
    return this.db.appSettings;
  }

  public async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const updated = {
      ...this.db.appSettings,
      ...patch,
    };
    const cleanSettings = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("appSettings").doc("main").set(cleanSettings));
    this.db.appSettings = updated;
    return this.db.appSettings;
  }

  // --- Agenda & Prospecting Schedule ---
  public getScheduleItems(): ProspectingScheduleItem[] {
    return this.db.scheduleItems || [];
  }

  public async createScheduleItem(payload: Omit<ProspectingScheduleItem, "id" | "createdAt">): Promise<ProspectingScheduleItem> {
    const item: ProspectingScheduleItem = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: payload.date,
      title: payload.title,
      audienceId: payload.audienceId,
      audienceName: payload.audienceName,
      targetCount: payload.targetCount || 10,
      completedCount: payload.completedCount || 0,
      completed: !!payload.completed,
      timeBlock: payload.timeBlock || "manha",
      notes: payload.notes,
      createdAt: getCurrentIso(),
    };
    const cleanItem = stripUndefinedDeep(item);
    await safeFirestoreWrite(() => adminDb.collection("scheduleItems").doc(item.id).set(cleanItem));
    this.db.scheduleItems.push(item);
    return item;
  }

  public async updateScheduleItem(id: string, patch: Partial<ProspectingScheduleItem>): Promise<ProspectingScheduleItem | null> {
    const index = this.db.scheduleItems.findIndex((i) => i.id === id);
    if (index === -1) return null;
    const updated = {
      ...this.db.scheduleItems[index],
      ...patch,
    };
    const cleanItem = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("scheduleItems").doc(id).set(cleanItem));
    this.db.scheduleItems[index] = updated;
    return updated;
  }

  public async deleteScheduleItem(id: string): Promise<boolean> {
    const index = this.db.scheduleItems.findIndex((i) => i.id === id);
    if (index === -1) return false;
    await safeFirestoreWrite(() => adminDb.collection("scheduleItems").doc(id).delete());
    this.db.scheduleItems.splice(index, 1);
    return true;
  }

  // --- Monthly Plans (Agenda = Single Source of Truth for Goals) ---
  public getMonthlyPlan(month?: string): MonthlyProspectingPlan {
    const mKey = month || getSaoPauloDateString(new Date()).substring(0, 7);
    if (!this.db.monthlyPlans[mKey]) {
      this.db.monthlyPlans[mKey] = {
        month: mKey,
        targetMonthlyContacts: 600,
        targetMonthlyLeads: 600,
        activeWeekdays: [1, 2, 3, 4, 5],
        calculatedDailyTarget: 30,
        targetsByAudience: {},
        monthlyTargetsByAudience: {},
        teamMemberTargets: {},
        monthlyTeamMemberTargets: {},
        updatedAt: getCurrentIso(),
      };
    }
    const raw = this.db.monthlyPlans[mKey];
    if (raw.targetMonthlyContacts === undefined && raw.targetMonthlyLeads !== undefined) {
      raw.targetMonthlyContacts = raw.targetMonthlyLeads;
    }
    return raw;
  }

  public async saveMonthlyPlan(plan: MonthlyProspectingPlan): Promise<MonthlyProspectingPlan> {
    const mKey = plan.month || getSaoPauloDateString(new Date()).substring(0, 7);
    const targetContacts = plan.targetMonthlyContacts ?? plan.targetMonthlyLeads ?? 600;
    const updated: MonthlyProspectingPlan = {
      ...plan,
      month: mKey,
      targetMonthlyContacts: targetContacts,
      targetMonthlyLeads: targetContacts,
      updatedAt: getCurrentIso(),
    };
    const cleanPlan = stripUndefinedDeep(updated);
    await safeFirestoreWrite(() => adminDb.collection("monthlyPlans").doc(mKey).set(cleanPlan));
    this.db.monthlyPlans[mKey] = updated;
    return updated;
  }

  // --- Dashboard Metrics (Calculated STRICTLY from Agenda Monthly Plan) ---
  public calculateDashboardMetrics(params: {
    periodType: "today" | "yesterday" | "thisWeek" | "thisMonth" | "lastMonth" | "all" | "custom";
    startDate?: string;
    endDate?: string;
    sourceFilter: "all" | "active" | "paid";
  }): DashboardMetrics {
    const { startIso, endIso } = getPeriodInterval(
      params.periodType,
      params.startDate,
      params.endDate
    );

    const allLeads = this.db.leads.filter((l) => !l.isArchived && !l.isDeleted);
    const filteredLeads = allLeads.filter((l) => {
      if (params.sourceFilter !== "all" && l.source !== params.sourceFilter) return false;
      return true;
    });

    let newLeadsCount = 0;
    let contactedCount = 0;
    let respondedCount = 0;
    let meetingsScheduledCount = 0;
    let meetingsHeldCount = 0;
    let testsOfferedCount = 0;
    let testsAcceptedCount = 0;
    let negotiationsCount = 0;
    let closedCount = 0;
    let lostCount = 0;

    for (const lead of filteredLeads) {
      if (isWithinInterval(lead.createdAt, startIso, endIso)) newLeadsCount++;
      if (lead.stageDates.contactedAt && isWithinInterval(lead.stageDates.contactedAt, startIso, endIso)) contactedCount++;
      if (lead.stageDates.respondedAt && isWithinInterval(lead.stageDates.respondedAt, startIso, endIso)) respondedCount++;
      if (lead.stageDates.meetingScheduledAt && isWithinInterval(lead.stageDates.meetingScheduledAt, startIso, endIso)) meetingsScheduledCount++;
      if (lead.stageDates.meetingHeldAt && isWithinInterval(lead.stageDates.meetingHeldAt, startIso, endIso)) meetingsHeldCount++;
      if (lead.stageDates.testOfferedAt && isWithinInterval(lead.stageDates.testOfferedAt, startIso, endIso)) testsOfferedCount++;
      if (lead.stageDates.testAcceptedAt && isWithinInterval(lead.stageDates.testAcceptedAt, startIso, endIso)) testsAcceptedCount++;
      if (lead.stageDates.negotiationAt && isWithinInterval(lead.stageDates.negotiationAt, startIso, endIso)) negotiationsCount++;
      if (lead.stageDates.closedAt && isWithinInterval(lead.stageDates.closedAt, startIso, endIso)) closedCount++;
      if (lead.stageDates.lostAt && isWithinInterval(lead.stageDates.lostAt, startIso, endIso)) lostCount++;
    }

    // Cohort analysis based strictly on firstContactSnapshot.firstContactAt
    const cohortLeads = filteredLeads.filter((l) => {
      if (!l.firstContactSnapshot) return false;
      return isWithinInterval(l.firstContactSnapshot.firstContactAt, startIso, endIso);
    });

    const totalCohortContacted = cohortLeads.length;
    const cohortResponded = cohortLeads.filter((l) => !!l.stageDates.respondedAt).length;
    const cohortMeetings = cohortLeads.filter((l) => !!l.stageDates.meetingScheduledAt || !!l.stageDates.meetingHeldAt).length;
    const cohortTestsAccepted = cohortLeads.filter((l) => !!l.stageDates.testAcceptedAt).length;
    const cohortClosed = cohortLeads.filter((l) => !!l.stageDates.closedAt).length;

    const responseRate = totalCohortContacted > 0 ? (cohortResponded / totalCohortContacted) * 100 : 0;
    const meetingRate = totalCohortContacted > 0 ? (cohortMeetings / totalCohortContacted) * 100 : 0;
    const testAcceptanceRate = totalCohortContacted > 0 ? (cohortTestsAccepted / totalCohortContacted) * 100 : 0;
    const closeRate = totalCohortContacted > 0 ? (cohortClosed / totalCohortContacted) * 100 : 0;

    // Cohort by Operational Class
    const classMetrics: Record<OperationalClass, { contacted: number; responded: number; meetings: number; closed: number; rate: number; conversionRate: number }> = {
      A: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      B: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      C: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      PENDENTE: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      RECUSADO: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
    };

    for (const lead of cohortLeads) {
      const cls = lead.firstContactSnapshot?.classAtFirstContact || "PENDENTE";
      if (!classMetrics[cls]) {
        classMetrics[cls] = { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 };
      }
      classMetrics[cls].contacted++;
      if (lead.stageDates.respondedAt) classMetrics[cls].responded++;
      if (lead.stageDates.meetingScheduledAt || lead.stageDates.meetingHeldAt) classMetrics[cls].meetings++;
      if (lead.stageDates.closedAt) classMetrics[cls].closed++;
    }

    for (const k of Object.keys(classMetrics) as OperationalClass[]) {
      const c = classMetrics[k];
      c.rate = c.contacted > 0 ? (c.closed / c.contacted) * 100 : 0;
      c.conversionRate = c.rate;
    }

    // Cohort by Audience
    const audMap = new Map<string, { contacted: number; closed: number }>();
    for (const lead of cohortLeads) {
      const audId = lead.firstContactSnapshot?.audienceIdAtFirstContact || lead.audienceId || "unknown";
      const cur = audMap.get(audId) || { contacted: 0, closed: 0 };
      cur.contacted++;
      if (lead.stageDates.closedAt) cur.closed++;
      audMap.set(audId, cur);
    }

    const byAudience = this.db.audiences.filter((a) => !a.isDeleted).map((aud) => {
      const stats = audMap.get(aud.id) || { contacted: 0, closed: 0 };
      return {
        audienceId: aud.id,
        audienceName: aud.name,
        contacted: stats.contacted,
        closed: stats.closed,
        rate: stats.contacted > 0 ? (stats.closed / stats.contacted) * 100 : 0,
      };
    });

    // Cohort by Script
    const byScriptMap = new Map<string, { contacted: number; responded: number; offered: number; accepted: number; closed: number }>();
    for (const lead of cohortLeads) {
      const scrId = lead.firstContactSnapshot?.scriptVersionIdAtFirstContact;
      if (scrId) {
        const cur = byScriptMap.get(scrId) || { contacted: 0, responded: 0, offered: 0, accepted: 0, closed: 0 };
        cur.contacted++;
        if (lead.stageDates.respondedAt) cur.responded++;
        if (lead.stageDates.testOfferedAt) cur.offered++;
        if (lead.stageDates.testAcceptedAt) cur.accepted++;
        if (lead.stageDates.closedAt) cur.closed++;
        byScriptMap.set(scrId, cur);
      }
    }

    const byScript = this.db.scripts.filter((s) => !s.isDeleted).map((scr) => {
      const stats = byScriptMap.get(scr.id) || { contacted: 0, responded: 0, offered: 0, accepted: 0, closed: 0 };
      const aud = this.db.audiences.find((a) => a.id === scr.audienceId);
      const respRate = stats.contacted > 0 ? (stats.responded / stats.contacted) * 100 : 0;
      const clsRate = stats.contacted > 0 ? (stats.closed / stats.contacted) * 100 : 0;
      return {
        scriptId: scr.id,
        scriptVersionId: scr.id,
        scriptName: scr.baseName,
        version: scr.version,
        audienceName: aud ? aud.name : "Geral",
        contacted: stats.contacted,
        responded: stats.responded,
        testsOffered: stats.offered,
        testsAccepted: stats.accepted,
        closed: stats.closed,
        responseRate: respRate,
        conversionRate: clsRate,
        closeRate: clsRate,
        sampleSize: stats.contacted,
      };
    });

    // --- AGENDA AS SINGLE SOURCE OF GOALS ---
    const todayStr = getSaoPauloDateString(new Date());
    const mKey = todayStr.substring(0, 7);
    const plan = this.getMonthlyPlan(mKey);

    const isCustomRest = plan.customRestDates?.includes(todayStr);
    const isCustomActive = plan.customActiveDates?.includes(todayStr);
    const todayWeekday = new Date(`${todayStr}T12:00:00Z`).getUTCDay();

    const activeWeekdays = plan.activeWeekdays || [1, 2, 3, 4, 5];
    const isWeekdayActive = activeWeekdays.includes(todayWeekday);
    const isTodayActive = !isCustomRest && (isCustomActive || isWeekdayActive);
    const overallTarget = isTodayActive ? (plan.calculatedDailyTarget || 0) : 0;

    // Real first contacts today in America/Sao_Paulo (Active leads only)
    const todayContactedActiveLeads = this.db.leads.filter(
      (l) =>
        !l.isDeleted &&
        !l.isArchived &&
        l.source === "active" &&
        l.stageDates?.contactedAt &&
        isTodayInSaoPaulo(l.stageDates.contactedAt)
    );

    const achievedToday = todayContactedActiveLeads.length;

    const goalByAudience = this.db.audiences.filter((a) => !a.isDeleted).map((aud) => {
      const audTarget = isTodayActive ? (plan.targetsByAudience?.[aud.id] || 0) : 0;
      const audAchieved = todayContactedActiveLeads.filter((l) => l.audienceId === aud.id).length;
      return {
        audienceId: aud.id,
        audienceName: aud.name,
        target: audTarget,
        achieved: audAchieved,
      };
    });

    const activeLeads = allLeads.filter((l) => l.source === "active");
    const paidLeads = allLeads.filter((l) => l.source === "paid");

    const activeCohort = activeLeads.filter(
      (l) => l.firstContactSnapshot && isWithinInterval(l.firstContactSnapshot.firstContactAt, startIso, endIso)
    );
    const paidCohort = paidLeads.filter(
      (l) => l.firstContactSnapshot && isWithinInterval(l.firstContactSnapshot.firstContactAt, startIso, endIso)
    );

    const activeVsPaid = {
      active: {
        newLeads: activeLeads.filter((l) => isWithinInterval(l.createdAt, startIso, endIso)).length,
        contacted: activeCohort.length,
        closed: activeCohort.filter((l) => !!l.stageDates.closedAt).length,
        closeRate: activeCohort.length > 0 ? (activeCohort.filter((l) => !!l.stageDates.closedAt).length / activeCohort.length) * 100 : 0,
      },
      paid: {
        newLeads: paidLeads.filter((l) => isWithinInterval(l.createdAt, startIso, endIso)).length,
        contacted: paidCohort.length,
        closed: paidCohort.filter((l) => !!l.stageDates.closedAt).length,
        closeRate: paidCohort.length > 0 ? (paidCohort.filter((l) => !!l.stageDates.closedAt).length / paidCohort.length) * 100 : 0,
      },
    };

    const lostLeadsInPeriod = allLeads.filter(
      (l) => l.status === "perdido" && isWithinInterval(l.stageDates.lostAt || l.updatedAt, startIso, endIso)
    );
    const totalLost = lostLeadsInPeriod.length;

    const lossCountMap = new Map<string, number>();
    for (const lead of lostLeadsInPeriod) {
      const reasonId = lead.lossReasonId || "loss_outro";
      lossCountMap.set(reasonId, (lossCountMap.get(reasonId) || 0) + 1);
    }

    const lossReasonsBreakdown = this.db.lossReasons.map((reason) => {
      const count = lossCountMap.get(reason.id) || 0;
      return {
        reasonId: reason.id,
        reasonName: reason.name,
        count,
        percentage: totalLost > 0 ? (count / totalLost) * 100 : 0,
      };
    });

    const uncontactedLeadsCount = allLeads.filter(
      (l) => l.source === "active" && (!l.stageDates || !l.stageDates.contactedAt) && l.status === "novo"
    ).length;

    const pendingFollowUpsCount = allLeads.filter(
      (l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date() && l.status !== "fechado" && l.status !== "perdido"
    ).length;

    return {
      period: {
        type: params.periodType,
        startDate: startIso,
        endDate: endIso,
        sourceFilter: params.sourceFilter,
      },
      volumes: {
        newLeads: newLeadsCount,
        contacted: contactedCount,
        responded: respondedCount,
        meetingsScheduled: meetingsScheduledCount,
        meetingsHeld: meetingsHeldCount,
        meetingBooked: meetingsScheduledCount,
        meetingHeld: meetingsHeldCount,
        testsOffered: testsOfferedCount,
        testsAccepted: testsAcceptedCount,
        testOffered: testsOfferedCount,
        testAccepted: testsAcceptedCount,
        negotiations: negotiationsCount,
        negotiation: negotiationsCount,
        closed: closedCount,
        lost: lostCount,
      },
      cohort: {
        totalCohortContacted,
        totalContactedInPeriod: contactedCount,
        closedWon: cohortClosed,
        responseRate,
        meetingRate,
        testAcceptanceRate,
        closeRate,
        byClass: classMetrics,
        byAudience,
        byScript,
      },
      activeGoalToday: {
        target: overallTarget,
        achieved: achievedToday,
        percentage: overallTarget > 0 ? Math.min(Math.round((achievedToday / overallTarget) * 100), 100) : 0,
        byAudience: goalByAudience,
      },
      activeVsPaid,
      lossReasonsBreakdown,
      uncontactedLeadsCount,
      pendingFollowUpsCount,
    };
  }

  public async batchImportLeads(
    leadsToImport: Array<{
      source?: "active" | "paid";
      instagramUrl?: string;
      instagramUsername?: string;
      temporaryLabel?: string;
      audienceId: string;
      manualClass?: OperationalClass;
      notes?: string;
      paidCampaign?: string;
    }>,
    performedBy = "Operador"
  ): Promise<{ imported: number; duplicates: number; leads: Lead[] }> {
    let imported = 0;
    let duplicates = 0;
    const createdLeads: Lead[] = [];

    for (const item of leadsToImport) {
      const res = await this.createLead(
        {
          source: item.source || "active",
          instagramUrl: item.instagramUrl,
          instagramUsername: item.instagramUsername,
          temporaryLabel: item.temporaryLabel,
          audienceId: item.audienceId,
          manualClass: item.manualClass,
          notes: item.notes,
          paidCampaign: item.paidCampaign,
          duplicateOverride: false,
        },
        performedBy
      );

      if (res.conflict) {
        duplicates++;
      } else if (res.lead) {
        imported++;
        createdLeads.push(res.lead);
      }
    }

    return { imported, duplicates, leads: createdLeads };
  }

  // --- Export Utilities ---
  public exportLeadsCsv(): string {
    const activeLeads = this.db.leads.filter((l) => !l.isDeleted);
    const headers = [
      "ID",
      "Origem",
      "Instagram",
      "Rotulo",
      "Publico",
      "Classe",
      "Status",
      "Teste",
      "Data Criacao",
      "Data Primeiro Contato",
      "Script Utilizado",
      "Motivo Perda",
    ];

    const rows = activeLeads.map((l) => {
      const aud = this.db.audiences.find((a) => a.id === l.audienceId);
      const scr = this.db.scripts.find((s) => s.id === l.scriptVersionId);
      const loss = this.db.lossReasons.find((r) => r.id === l.lossReasonId);

      return [
        l.id,
        l.source === "active" ? "Prospecção Ativa" : "Tráfego Pago",
        l.instagramUsernameNormalized ? `@${l.instagramUsernameNormalized}` : l.instagramUrl || "",
        `"${(l.temporaryLabel || "").replace(/"/g, '""')}"`,
        `"${(aud?.name || "").replace(/"/g, '""')}"`,
        l.manualClass,
        l.status,
        l.testStatus,
        l.createdAt,
        l.stageDates?.contactedAt || "",
        `"${(scr?.baseName || "").replace(/"/g, '""')}"`,
        `"${(loss?.name || l.lossReasonOther || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  public exportFullJson(): string {
    return JSON.stringify(
      {
        exportedAt: getCurrentIso(),
        leads: this.db.leads.filter((l) => !l.isDeleted),
        audiences: this.db.audiences.filter((a) => !a.isDeleted),
        scripts: this.db.scripts.filter((s) => !s.isDeleted),
        lossReasons: this.db.lossReasons,
        appSettings: this.db.appSettings,
        scheduleItems: this.db.scheduleItems,
        monthlyPlans: this.db.monthlyPlans,
        importConfigs: this.db.importConfigs.filter((c) => !c.isDeleted),
        importBatches: this.db.importBatches,
      },
      null,
      2
    );
  }
}

export const store = new StoreManager();
