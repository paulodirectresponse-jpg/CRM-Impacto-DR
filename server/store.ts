import { adminDb } from "./firebaseAdmin";
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
} from "../src/types";
import {
  getCurrentIso,
  getPeriodInterval,
  getSaoPauloDateString,
  isTodayInSaoPaulo,
  isWithinInterval,
} from "../src/utils/dateUtils";
import { normalizeInstagramInput } from "../src/utils/instagramUtils";

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

class StoreManager {
  private db: CrmDatabase = {
    leads: [],
    audiences: [],
    scripts: [],
    dailyGoals: [],
    lossReasons: getDefaultLossReasons(),
    appSettings: getDefaultSettings(),
    activities: [],
    scheduleItems: [],
    monthlyPlans: {},
  };
  private isInitialized = false;

  constructor() {
    this.init().catch(() => {});
  }

  public async init() {
    if (this.isInitialized) return;
    try {
      // 1. AppSettings
      const settingsDoc = await adminDb.collection("appSettings").doc("main").get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data() as AppSettings;
        this.db.appSettings = { ...getDefaultSettings(), ...data };
      } else {
        await adminDb.collection("appSettings").doc("main").set(this.db.appSettings);
      }

      // 2. LossReasons
      const lossSnap = await adminDb.collection("lossReasons").get();
      if (!lossSnap.empty) {
        this.db.lossReasons = lossSnap.docs.map((d) => d.data() as LossReason);
      } else {
        const batch = adminDb.batch();
        for (const reason of this.db.lossReasons) {
          batch.set(adminDb.collection("lossReasons").doc(reason.id), reason);
        }
        await batch.commit();
      }

      // 3. Audiences
      const audSnap = await adminDb.collection("audiences").get();
      if (!audSnap.empty) {
        this.db.audiences = audSnap.docs.map((d) => d.data() as Audience);
      }

      // 4. Scripts
      const scrSnap = await adminDb.collection("scripts").get();
      if (!scrSnap.empty) {
        this.db.scripts = scrSnap.docs.map((d) => d.data() as Script);
      }

      // 5. Leads
      const leadsSnap = await adminDb.collection("leads").get();
      if (!leadsSnap.empty) {
        this.db.leads = leadsSnap.docs.map((d) => d.data() as Lead);
      }

      // 6. Activities
      const actSnap = await adminDb.collection("activities").get();
      if (!actSnap.empty) {
        this.db.activities = actSnap.docs.map((d) => d.data() as Activity);
      }

      // 7. Daily Goals
      const goalSnap = await adminDb.collection("dailyGoals").get();
      if (!goalSnap.empty) {
        this.db.dailyGoals = goalSnap.docs.map((d) => d.data() as DailyGoal);
      }

      // 8. Schedule Items
      const schedSnap = await adminDb.collection("scheduleItems").get();
      if (!schedSnap.empty) {
        this.db.scheduleItems = schedSnap.docs.map((d) => d.data() as ProspectingScheduleItem);
      }

      // 9. Monthly Plans
      const planSnap = await adminDb.collection("monthlyPlans").get();
      if (!planSnap.empty) {
        const plans: Record<string, MonthlyProspectingPlan> = {};
        planSnap.docs.forEach((d) => {
          plans[d.id] = d.data() as MonthlyProspectingPlan;
        });
        this.db.monthlyPlans = plans;
      }

      this.isInitialized = true;
      console.log(`[Firestore] Successfully loaded CRM records: ${this.db.leads.length} leads, ${this.db.audiences.length} audiences, ${this.db.scripts.length} scripts.`);
    } catch (err: any) {
      this.isInitialized = true;
      console.log("[Firestore] Operating with memory buffer and direct client synchronization.");
    }
  }

  public async save(): Promise<void> {
    // Firestore writes are executed immediately in individual methods
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

  // --- Activities ---
  public getActivitiesForLead(leadId: string): Activity[] {
    return this.db.activities
      .filter((a) => a.leadId === leadId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logActivity(payload: Omit<Activity, "id" | "timestamp">) {
    const act: Activity = {
      ...payload,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: getCurrentIso(),
    };
    this.db.activities.unshift(act);
    adminDb.collection("activities").doc(act.id).set(act).catch((err) => {
      console.error("[Firestore] Error persisting activity:", err);
    });
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
  }): Lead[] {
    return this.db.leads.filter((lead) => {
      if (filters.isArchived !== undefined && lead.isArchived !== filters.isArchived) {
        return false;
      }
      if (filters.status && lead.status !== filters.status) return false;
      if (filters.manualClass && lead.manualClass !== filters.manualClass) return false;
      if (filters.audienceId && lead.audienceId !== filters.audienceId) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.scriptVersionId && lead.scriptVersionId !== filters.scriptVersionId) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchesInsta = lead.instagramUsernameNormalized?.includes(q);
        const matchesUrl = lead.instagramUrl?.toLowerCase().includes(q);
        const matchesLabel = lead.temporaryLabel?.toLowerCase().includes(q);
        const matchesNotes = lead.notes?.toLowerCase().includes(q);
        const matchesCustName = lead.customerData?.name?.toLowerCase().includes(q);
        if (!matchesInsta && !matchesUrl && !matchesLabel && !matchesNotes && !matchesCustName) {
          return false;
        }
      }
      return true;
    });
  }

  public getLeadById(id: string): Lead | undefined {
    return this.db.leads.find((l) => l.id === id);
  }

  public checkDuplicateInstagram(
    usernameNormalized: string,
    excludeLeadId?: string
  ): { isDuplicate: boolean; existingLead?: Lead } {
    if (!usernameNormalized) return { isDuplicate: false };
    const found = this.db.leads.find(
      (l) =>
        !l.isArchived &&
        l.instagramUsernameNormalized === usernameNormalized &&
        l.id !== excludeLeadId
    );
    return { isDuplicate: !!found, existingLead: found };
  }

  public createLead(
    payload: {
      source: "active" | "paid";
      instagramUrl?: string;
      temporaryLabel?: string;
      audienceId: string;
      manualClass: OperationalClass;
      notes?: string;
      paidCampaign?: string;
      paidCreative?: string;
      duplicateOverride?: boolean;
      aiEvaluation?: any;
    },
    performedBy = "Operador"
  ): { lead?: Lead; error?: string; duplicateLead?: Lead; conflict?: boolean } {
    if (!payload.source || (payload.source !== "active" && payload.source !== "paid")) {
      return { error: "Origem (active ou paid) é obrigatória." };
    }

    if (!payload.audienceId) {
      return { error: "Público/Nicho é obrigatório no cadastro." };
    }

    const audience = this.db.audiences.find((a) => a.id === payload.audienceId);
    if (!audience) {
      return { error: "Público/Nicho especificado não existe." };
    }

    let normUrl = "";
    let normUsername = "";

    if (payload.source === "active") {
      if (!payload.instagramUrl || !payload.instagramUrl.trim()) {
        return { error: "Link do Instagram é obrigatório para prospecção ativa." };
      }
      const norm = normalizeInstagramInput(payload.instagramUrl);
      if (!norm.isValid) {
        return { error: "Link ou @username do Instagram inválido." };
      }
      normUrl = norm.normalizedUrl;
      normUsername = norm.normalizedUsername;
    } else {
      if (payload.instagramUrl && payload.instagramUrl.trim()) {
        const norm = normalizeInstagramInput(payload.instagramUrl);
        if (norm.isValid) {
          normUrl = norm.normalizedUrl;
          normUsername = norm.normalizedUsername;
        }
      }
      if (!normUsername && (!payload.temporaryLabel || !payload.temporaryLabel.trim())) {
        return { error: "Para tráfego pago sem Instagram, forneça um identificador mínimo (rótulo/nome)." };
      }
    }

    if (normUsername) {
      const dupCheck = this.checkDuplicateInstagram(normUsername);
      if (dupCheck.isDuplicate && !payload.duplicateOverride) {
        return {
          conflict: true,
          error: `Instagram @${normUsername} já cadastrado no lead existente. Deseja abrir o lead existente ou confirmar override?`,
          duplicateLead: dupCheck.existingLead,
        };
      }
    }

    const now = getCurrentIso();
    const newId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newLead: Lead = {
      id: newId,
      source: payload.source,
      instagramUrl: normUrl || undefined,
      instagramUsernameNormalized: normUsername || undefined,
      temporaryLabel: payload.temporaryLabel?.trim() || undefined,
      audienceId: payload.audienceId,
      manualClass: payload.manualClass || "PENDENTE",
      status: "novo",
      testStatus: "nao_oferecido",
      notes: payload.notes?.trim() || undefined,
      paidCampaign: payload.paidCampaign?.trim() || undefined,
      paidCreative: payload.paidCreative?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isArchived: false,
      duplicateOverride: !!payload.duplicateOverride,
      stageDates: {},
      testDates: {},
      aiEvaluation: payload.aiEvaluation || undefined,
    };

    this.db.leads.unshift(newLead);
    adminDb.collection("leads").doc(newId).set(newLead).catch((err) => {
      console.error("[Firestore] Error saving lead:", err);
    });

    this.logActivity({
      leadId: newId,
      type: "creation",
      title: "Lead criado",
      description: `Lead criado com origem ${payload.source === "active" ? "Prospecção Ativa" : "Tráfego Pago"} e classe ${newLead.manualClass}.`,
      performedBy,
    });

    if (payload.duplicateOverride) {
      this.logActivity({
        leadId: newId,
        type: "duplicate_override",
        title: "Override de duplicidade",
        description: `Cadastro confirmado conscientemente apesar de @${normUsername} já existir.`,
        performedBy,
      });
    }

    return { lead: newLead };
  }

  public updateLead(
    id: string,
    patch: Partial<Lead> & { expectedVersion?: number },
    performedBy = "Operador"
  ): { lead?: Lead; error?: string; conflict?: boolean; currentLead?: Lead } {
    const index = this.db.leads.findIndex((l) => l.id === id);
    if (index === -1) {
      return { error: "Lead não encontrado." };
    }

    const current = this.db.leads[index];

    // Optimistic concurrency check
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== current.version) {
      return {
        conflict: true,
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
          return { error: "Ao marcar Contatado em prospecção ativa, é obrigatório selecionar a versão do script utilizada." };
        }
      }

      // When marking Perdido, require lossReasonId
      if (targetStatus === "perdido") {
        const reasonId = patch.lossReasonId || current.lossReasonId;
        if (!reasonId) {
          return { error: "Ao marcar como Perdido, o motivo de perda é obrigatório." };
        }
        const reason = this.db.lossReasons.find((r) => r.id === reasonId);
        if (reason?.isOther) {
          const otherText = patch.lossReasonOther || current.lossReasonOther;
          if (!otherText || !otherText.trim()) {
            return { error: "Para o motivo 'Outro', é obrigatório especificar a descrição do motivo." };
          }
        }
      }

      // Automatically guarantee contactedAt and firstContactSnapshot when advancing to any posterior stage
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
          newSnapshot = {
            classAtFirstContact: patch.manualClass || current.manualClass,
            audienceIdAtFirstContact: patch.audienceId || current.audienceId,
            scriptVersionIdAtFirstContact: scriptId,
            sourceAtFirstContact: current.source,
            firstContactAt: now,
          };
          if (scriptId) {
            this.lockScript(scriptId);
          }
        }
      }

      // Record specific stage timestamps
      if (targetStatus === "analisado" && !updatedStageDates.analyzedAt) {
        updatedStageDates.analyzedAt = now;
      } else if (targetStatus === "respondeu") {
        if (!updatedStageDates.respondedAt) updatedStageDates.respondedAt = now;
      } else if (targetStatus === "reuniao_agendada") {
        if (!updatedStageDates.meetingScheduledAt) updatedStageDates.meetingScheduledAt = now;
      } else if (targetStatus === "reuniao_realizada") {
        if (!updatedStageDates.meetingScheduledAt) updatedStageDates.meetingScheduledAt = now;
        if (!updatedStageDates.meetingHeldAt) updatedStageDates.meetingHeldAt = now;
      } else if (targetStatus === "teste_oferecido") {
        if (!updatedStageDates.testOfferedAt) updatedStageDates.testOfferedAt = now;
        if (current.testStatus === "nao_oferecido") {
          patch.testStatus = "oferecido";
          if (!updatedTestDates.offeredAt) updatedTestDates.offeredAt = now;
        }
      } else if (targetStatus === "teste_aceito") {
        if (!updatedStageDates.testOfferedAt) updatedStageDates.testOfferedAt = now;
        if (!updatedStageDates.testAcceptedAt) updatedStageDates.testAcceptedAt = now;
        patch.testStatus = "aceito";
        if (!updatedTestDates.offeredAt) updatedTestDates.offeredAt = now;
        if (!updatedTestDates.acceptedAt) updatedTestDates.acceptedAt = now;
      } else if (targetStatus === "negociacao") {
        if (!updatedStageDates.negotiationAt) updatedStageDates.negotiationAt = now;
      } else if (targetStatus === "fechado") {
        if (!updatedStageDates.closedAt) updatedStageDates.closedAt = now;
      } else if (targetStatus === "perdido") {
        if (!updatedStageDates.lostAt) updatedStageDates.lostAt = now;
      }

      // Activity logging
      if (current.status === "perdido" && targetStatus !== "perdido") {
        this.logActivity({
          leadId: id,
          type: "reopen",
          title: "Lead reaberto",
          description: `Lead reaberto da fase Perdido para ${targetStatus}.`,
          performedBy,
        });
      } else {
        this.logActivity({
          leadId: id,
          type: targetStatus === "fechado" ? "closed" : targetStatus === "perdido" ? "loss" : "status_change",
          title: `Status alterado: ${targetStatus}`,
          description: `Status alterado de '${current.status}' para '${targetStatus}'.`,
          before: current.status,
          after: targetStatus,
          performedBy,
        });
      }
    }

    // 2. Test status logic
    if (patch.testStatus && patch.testStatus !== current.testStatus) {
      const targetTest = patch.testStatus;
      if (targetTest === "oferecido" && !updatedTestDates.offeredAt) {
        updatedTestDates.offeredAt = now;
        if (!updatedStageDates.testOfferedAt) updatedStageDates.testOfferedAt = now;
      } else if (targetTest === "aceito") {
        if (!updatedTestDates.offeredAt) updatedTestDates.offeredAt = now;
        if (!updatedTestDates.acceptedAt) updatedTestDates.acceptedAt = now;
        if (!updatedStageDates.testOfferedAt) updatedStageDates.testOfferedAt = now;
        if (!updatedStageDates.testAcceptedAt) updatedStageDates.testAcceptedAt = now;
      } else if (targetTest === "em_producao" && !updatedTestDates.inProductionAt) {
        updatedTestDates.inProductionAt = now;
      } else if (targetTest === "entregue" && !updatedTestDates.deliveredAt) {
        updatedTestDates.deliveredAt = now;
      } else if (targetTest === "aprovado" && !updatedTestDates.approvedAt) {
        updatedTestDates.approvedAt = now;
      } else if (targetTest === "recusado" && !updatedTestDates.rejectedAt) {
        updatedTestDates.rejectedAt = now;
      }

      this.logActivity({
        leadId: id,
        type: "test_status_change",
        title: `Status do teste: ${targetTest}`,
        description: `Status do teste alterado de '${current.testStatus}' para '${targetTest}'.`,
        before: current.testStatus,
        after: targetTest,
        performedBy,
      });
    }

    // 3. Class change
    if (patch.manualClass && patch.manualClass !== current.manualClass) {
      this.logActivity({
        leadId: id,
        type: "class_change",
        title: `Classe alterada: ${patch.manualClass}`,
        description: `Classe operacional alterada de ${current.manualClass} para ${patch.manualClass}.`,
        before: current.manualClass,
        after: patch.manualClass,
        performedBy,
      });
    }

    // 4. Audience change
    if (patch.audienceId && patch.audienceId !== current.audienceId) {
      this.logActivity({
        leadId: id,
        type: "audience_change",
        title: "Público alterado",
        description: `Público alterado de ${current.audienceId} para ${patch.audienceId}.`,
        before: current.audienceId,
        after: patch.audienceId,
        performedBy,
      });
    }

    // 5. Sistema 360 mark
    if (patch.system360TransferredAt !== undefined && patch.system360TransferredAt !== current.system360TransferredAt) {
      if (patch.system360TransferredAt) {
        this.logActivity({
          leadId: id,
          type: "system360_marked",
          title: "Cadastrado no Sistema 360",
          description: "Lead marcado como transferido e cadastrado no Sistema 360.",
          performedBy,
        });
      } else {
        this.logActivity({
          leadId: id,
          type: "system360_unmarked",
          title: "Marcação Sistema 360 desfeita",
          description: "Transferência para o Sistema 360 foi desmarcada.",
          performedBy,
        });
      }
    }

    const updatedLead: Lead = {
      ...current,
      ...patch,
      stageDates: updatedStageDates,
      testDates: updatedTestDates,
      firstContactSnapshot: newSnapshot,
      updatedAt: now,
      version: current.version + 1,
    };

    this.db.leads[index] = updatedLead;
    adminDb.collection("leads").doc(id).set(updatedLead).catch((err) => {
      console.error("[Firestore] Error updating lead:", err);
    });

    return { lead: updatedLead };
  }

  public archiveLead(id: string, isArchived = true, performedBy = "Operador"): boolean {
    const lead = this.db.leads.find((l) => l.id === id);
    if (!lead) return false;
    lead.isArchived = isArchived;
    lead.updatedAt = getCurrentIso();
    lead.version += 1;

    adminDb.collection("leads").doc(id).set(lead).catch((err) => {
      console.error("[Firestore] Error archiving lead:", err);
    });

    this.logActivity({
      leadId: id,
      type: "status_change",
      title: isArchived ? "Lead arquivado" : "Lead desarquivado",
      description: isArchived ? "Lead movido para arquivo histórico." : "Lead restaurado do arquivo.",
      performedBy,
    });
    return true;
  }

  // --- Audiences ---
  public getAudiences(includeArchived = false): Audience[] {
    return this.db.audiences.filter((a) => includeArchived || a.isActive);
  }

  public createAudience(payload: Omit<Audience, "id" | "createdAt" | "updatedAt" | "isActive">): Audience {
    const now = getCurrentIso();
    const aud: Audience = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: payload.name.trim(),
      description: payload.description?.trim() || "",
      criteriaA: payload.criteriaA?.trim() || "",
      criteriaB: payload.criteriaB?.trim() || "",
      criteriaC: payload.criteriaC?.trim() || "",
      aiInstructions: payload.aiInstructions?.trim() || "",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.audiences.push(aud);
    adminDb.collection("audiences").doc(aud.id).set(aud).catch((err) => {
      console.error("[Firestore] Error creating audience:", err);
    });
    return aud;
  }

  public updateAudience(id: string, patch: Partial<Audience>): Audience | null {
    const aud = this.db.audiences.find((a) => a.id === id);
    if (!aud) return null;
    Object.assign(aud, patch, { updatedAt: getCurrentIso() });
    adminDb.collection("audiences").doc(id).set(aud).catch((err) => {
      console.error("[Firestore] Error updating audience:", err);
    });
    return aud;
  }

  public archiveAudience(id: string): { success: boolean; message?: string } {
    const aud = this.db.audiences.find((a) => a.id === id);
    if (!aud) return { success: false, message: "Público não encontrado." };
    aud.isActive = false;
    aud.updatedAt = getCurrentIso();
    adminDb.collection("audiences").doc(id).set(aud).catch((err) => {
      console.error("[Firestore] Error archiving audience:", err);
    });
    return { success: true };
  }

  // --- Scripts & Immutability / Versioning ---
  public getScripts(includeArchived = false, audienceId?: string): Script[] {
    return this.db.scripts.filter((s) => {
      if (!includeArchived && !s.isActive) return false;
      if (audienceId && s.audienceId !== audienceId) return false;
      return true;
    });
  }

  public lockScript(scriptId: string) {
    const scr = this.db.scripts.find((s) => s.id === scriptId);
    if (scr && !scr.isLocked) {
      scr.isLocked = true;
      scr.updatedAt = getCurrentIso();
      adminDb.collection("scripts").doc(scriptId).set(scr).catch((err) => {
        console.error("[Firestore] Error locking script:", err);
      });
    }
  }

  public createScript(payload: {
    baseName: string;
    audienceId: string;
    content: string;
    creationMode?: "prompt" | "free";
    promptUsed?: string;
  }): Script {
    const now = getCurrentIso();
    const newScript: Script = {
      id: `scr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      baseName: payload.baseName.trim(),
      audienceId: payload.audienceId,
      version: 1,
      content: payload.content.trim(),
      creationMode: payload.creationMode || "free",
      promptUsed: payload.promptUsed?.trim() || undefined,
      isActive: true,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.scripts.push(newScript);
    adminDb.collection("scripts").doc(newScript.id).set(newScript).catch((err) => {
      console.error("[Firestore] Error creating script:", err);
    });
    return newScript;
  }

  public updateScript(
    id: string,
    payload: {
      baseName?: string;
      content?: string;
      audienceId?: string;
      isActive?: boolean;
      creationMode?: "prompt" | "free";
      promptUsed?: string;
    }
  ): { script: Script; createdNewVersion: boolean } {
    const scr = this.db.scripts.find((s) => s.id === id);
    if (!scr) throw new Error("Script não encontrado.");

    const now = getCurrentIso();

    // Logic rule: If script is already locked (used in first contact) AND content OR audience changed -> create new version V2/V3
    const contentChanged = payload.content !== undefined && payload.content.trim() !== scr.content;
    const audienceChanged = payload.audienceId !== undefined && payload.audienceId !== scr.audienceId;

    if (scr.isLocked && (contentChanged || audienceChanged)) {
      const sameFamily = this.db.scripts.filter(
        (s) => s.baseName.toLowerCase() === scr.baseName.toLowerCase() && s.audienceId === (payload.audienceId || scr.audienceId)
      );
      const maxVer = Math.max(...sameFamily.map((s) => s.version), scr.version);
      const newVersionNumber = maxVer + 1;

      const forkedScript: Script = {
        id: `scr_${Date.now()}_v${newVersionNumber}`,
        baseName: payload.baseName?.trim() || scr.baseName,
        audienceId: payload.audienceId || scr.audienceId,
        version: newVersionNumber,
        content: payload.content !== undefined ? payload.content.trim() : scr.content,
        creationMode: payload.creationMode || scr.creationMode || "free",
        promptUsed: payload.promptUsed !== undefined ? payload.promptUsed.trim() : scr.promptUsed,
        isActive: true,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      };

      this.db.scripts.push(forkedScript);
      adminDb.collection("scripts").doc(forkedScript.id).set(forkedScript).catch((err) => {
        console.error("[Firestore] Error saving versioned script:", err);
      });
      return { script: forkedScript, createdNewVersion: true };
    }

    if (payload.baseName !== undefined) scr.baseName = payload.baseName.trim();
    if (payload.content !== undefined) scr.content = payload.content.trim();
    if (payload.audienceId !== undefined) scr.audienceId = payload.audienceId;
    if (payload.isActive !== undefined) scr.isActive = payload.isActive;
    if (payload.creationMode !== undefined) scr.creationMode = payload.creationMode;
    if (payload.promptUsed !== undefined) scr.promptUsed = payload.promptUsed.trim();
    scr.updatedAt = now;

    adminDb.collection("scripts").doc(id).set(scr).catch((err) => {
      console.error("[Firestore] Error updating script:", err);
    });
    return { script: scr, createdNewVersion: false };
  }

  // --- Loss Reasons ---
  public getLossReasons(includeArchived = false): LossReason[] {
    return this.db.lossReasons.filter((r) => includeArchived || r.isActive);
  }

  public createLossReason(name: string, isOther = false): LossReason {
    const reason: LossReason = {
      id: `loss_${Date.now()}`,
      name: name.trim(),
      isOther,
      isActive: true,
    };
    this.db.lossReasons.push(reason);
    adminDb.collection("lossReasons").doc(reason.id).set(reason).catch((err) => {
      console.error("[Firestore] Error creating loss reason:", err);
    });
    return reason;
  }

  public archiveLossReason(id: string): boolean {
    const reason = this.db.lossReasons.find((r) => r.id === id);
    if (!reason) return false;
    reason.isActive = false;
    adminDb.collection("lossReasons").doc(id).set(reason).catch((err) => {
      console.error("[Firestore] Error archiving loss reason:", err);
    });
    return true;
  }

  // --- Daily Goals ---
  public getDailyGoals(): DailyGoal[] {
    return this.db.dailyGoals;
  }

  public setDailyGoal(payload: DailyGoal): DailyGoal {
    const existingIndex = this.db.dailyGoals.findIndex((g) => g.date === payload.date);
    if (existingIndex >= 0) {
      this.db.dailyGoals[existingIndex] = payload;
    } else {
      this.db.dailyGoals.push(payload);
    }
    adminDb.collection("dailyGoals").doc(payload.date).set(payload).catch((err) => {
      console.error("[Firestore] Error saving daily goal:", err);
    });
    return payload;
  }

  // --- App Settings ---
  public getSettings(): AppSettings {
    return this.db.appSettings;
  }

  public updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.db.appSettings = {
      ...this.db.appSettings,
      ...patch,
    };
    adminDb.collection("appSettings").doc("main").set(this.db.appSettings).catch((err) => {
      console.error("[Firestore] Error saving app settings:", err);
    });
    return this.db.appSettings;
  }

  // --- Agenda & Prospecting Schedule ---
  public getScheduleItems(): ProspectingScheduleItem[] {
    return this.db.scheduleItems || [];
  }

  public createScheduleItem(payload: Omit<ProspectingScheduleItem, "id" | "createdAt">): ProspectingScheduleItem {
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
    this.db.scheduleItems.push(item);
    adminDb.collection("scheduleItems").doc(item.id).set(item).catch((err) => {
      console.error("[Firestore] Error saving schedule item:", err);
    });
    return item;
  }

  public updateScheduleItem(id: string, patch: Partial<ProspectingScheduleItem>): ProspectingScheduleItem | null {
    const index = this.db.scheduleItems.findIndex((i) => i.id === id);
    if (index === -1) return null;
    this.db.scheduleItems[index] = {
      ...this.db.scheduleItems[index],
      ...patch,
    };
    const updated = this.db.scheduleItems[index];
    adminDb.collection("scheduleItems").doc(id).set(updated).catch((err) => {
      console.error("[Firestore] Error updating schedule item:", err);
    });
    return updated;
  }

  public deleteScheduleItem(id: string): boolean {
    const index = this.db.scheduleItems.findIndex((i) => i.id === id);
    if (index === -1) return false;
    this.db.scheduleItems.splice(index, 1);
    adminDb.collection("scheduleItems").doc(id).delete().catch((err) => {
      console.error("[Firestore] Error deleting schedule item:", err);
    });
    return true;
  }

  // --- Monthly Plans ---
  public getMonthlyPlan(month?: string): MonthlyProspectingPlan {
    const mKey = month || getSaoPauloDateString(new Date()).substring(0, 7);
    if (!this.db.monthlyPlans[mKey]) {
      this.db.monthlyPlans[mKey] = {
        month: mKey,
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
    return this.db.monthlyPlans[mKey];
  }

  public saveMonthlyPlan(plan: MonthlyProspectingPlan): MonthlyProspectingPlan {
    const mKey = plan.month || getSaoPauloDateString(new Date()).substring(0, 7);
    const updated = {
      ...plan,
      month: mKey,
      updatedAt: getCurrentIso(),
    };
    this.db.monthlyPlans[mKey] = updated;
    adminDb.collection("monthlyPlans").doc(mKey).set(updated).catch((err) => {
      console.error("[Firestore] Error saving monthly plan:", err);
    });
    return updated;
  }

  // --- Dashboard Metrics ---
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

    const allLeads = this.db.leads.filter((l) => !l.isArchived);
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
      if (isWithinInterval(lead.stageDates?.contactedAt, startIso, endIso)) contactedCount++;
      if (isWithinInterval(lead.stageDates?.respondedAt, startIso, endIso)) respondedCount++;
      if (isWithinInterval(lead.stageDates?.meetingScheduledAt, startIso, endIso)) meetingsScheduledCount++;
      if (isWithinInterval(lead.stageDates?.meetingHeldAt, startIso, endIso)) meetingsHeldCount++;
      if (isWithinInterval(lead.stageDates?.testOfferedAt, startIso, endIso)) testsOfferedCount++;
      if (isWithinInterval(lead.stageDates?.testAcceptedAt, startIso, endIso)) testsAcceptedCount++;
      if (isWithinInterval(lead.stageDates?.negotiationAt, startIso, endIso)) negotiationsCount++;
      if (isWithinInterval(lead.stageDates?.closedAt, startIso, endIso)) closedCount++;
      if (isWithinInterval(lead.stageDates?.lostAt, startIso, endIso)) lostCount++;
    }

    const cohortLeads = filteredLeads.filter(
      (l) => l.firstContactSnapshot && isWithinInterval(l.firstContactSnapshot.firstContactAt, startIso, endIso)
    );

    const totalCohortContacted = cohortLeads.length;
    const cohortResponded = cohortLeads.filter((l) => !!l.stageDates.respondedAt).length;
    const cohortTestOffered = cohortLeads.filter((l) => !!l.stageDates.testOfferedAt).length;
    const cohortTestAccepted = cohortLeads.filter((l) => !!l.stageDates.testAcceptedAt).length;
    const cohortClosed = cohortLeads.filter((l) => !!l.stageDates.closedAt).length;

    const responseRate = totalCohortContacted > 0 ? (cohortResponded / totalCohortContacted) * 100 : 0;
    const testAcceptanceRate = cohortTestOffered > 0 ? (cohortTestAccepted / cohortTestOffered) * 100 : 0;
    const closeRate = totalCohortContacted > 0 ? (cohortClosed / totalCohortContacted) * 100 : 0;

    const byClass: Record<
      OperationalClass,
      {
        contacted: number;
        responded: number;
        meetings: number;
        closed: number;
        rate: number;
        conversionRate: number;
      }
    > = {
      A: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      B: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      C: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
      PENDENTE: { contacted: 0, responded: 0, meetings: 0, closed: 0, rate: 0, conversionRate: 0 },
    };

    for (const lead of cohortLeads) {
      const cls = lead.firstContactSnapshot?.classAtFirstContact || lead.manualClass;
      if (byClass[cls]) {
        byClass[cls].contacted++;
        if (lead.stageDates?.respondedAt) byClass[cls].responded++;
        if (lead.stageDates?.meetingScheduledAt || lead.stageDates?.meetingHeldAt) byClass[cls].meetings++;
        if (lead.stageDates?.closedAt) {
          byClass[cls].closed++;
        }
      }
    }
    for (const k of ["A", "B", "C"] as OperationalClass[]) {
      const conv = byClass[k].contacted > 0 ? (byClass[k].closed / byClass[k].contacted) * 100 : 0;
      byClass[k].rate = conv;
      byClass[k].conversionRate = conv;
    }

    const byAudienceMap = new Map<string, { contacted: number; closed: number }>();
    for (const lead of cohortLeads) {
      const audId = lead.firstContactSnapshot?.audienceIdAtFirstContact || lead.audienceId;
      const cur = byAudienceMap.get(audId) || { contacted: 0, closed: 0 };
      cur.contacted++;
      if (lead.stageDates.closedAt) cur.closed++;
      byAudienceMap.set(audId, cur);
    }

    const byAudience = this.db.audiences.map((aud) => {
      const data = byAudienceMap.get(aud.id) || { contacted: 0, closed: 0 };
      return {
        audienceId: aud.id,
        audienceName: aud.name,
        contacted: data.contacted,
        closed: data.closed,
        rate: data.contacted > 0 ? (data.closed / data.contacted) * 100 : 0,
      };
    });

    const byScriptMap = new Map<
      string,
      { contacted: number; responded: number; offered: number; accepted: number; closed: number }
    >();
    for (const lead of cohortLeads) {
      const scrId = lead.firstContactSnapshot?.scriptVersionIdAtFirstContact || lead.scriptVersionId;
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

    const byScript = this.db.scripts.map((scr) => {
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

    const todayStr = getSaoPauloDateString(new Date());
    const dailyGoalConfig = this.db.dailyGoals.find((g) => g.date === todayStr);
    const overallTarget = dailyGoalConfig?.targetTotal || dailyGoalConfig?.defaultDailyTarget || this.db.appSettings.defaultDailyTarget || this.db.appSettings.dailyActiveGoal || 0;

    const todayContactedActiveLeads = this.db.leads.filter(
      (l) =>
        !l.isArchived &&
        l.source === "active" &&
        l.stageDates?.contactedAt &&
        isTodayInSaoPaulo(l.stageDates.contactedAt)
    );

    const achievedToday = todayContactedActiveLeads.length;

    const goalByAudience = this.db.audiences.map((aud) => {
      const audTarget =
        dailyGoalConfig?.targetByAudience?.[aud.id] ||
        dailyGoalConfig?.targetsByAudience?.[aud.id] ||
        this.db.appSettings.audienceTargets?.[aud.id] ||
        0;
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
    }).filter((r) => r.count > 0);

    const uncontactedLeadsCount = allLeads.filter(
      (l) => l.status === "novo" || l.status === "analisado"
    ).length;

    const pendingFollowUpsCount = allLeads.filter(
      (l) => l.status === "contatado" || l.status === "respondeu" || l.status === "teste_oferecido"
    ).length;

    return {
      period: {
        type: params.periodType,
        label:
          params.periodType === "today"
            ? "Hoje"
            : params.periodType === "yesterday"
            ? "Ontem"
            : params.periodType === "thisWeek"
            ? "Esta Semana"
            : params.periodType === "thisMonth"
            ? "Este Mês"
            : params.periodType === "lastMonth"
            ? "Mês Passado"
            : "Todo o Histórico",
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
        totalContactedInPeriod: totalCohortContacted,
        closedWon: cohortClosed,
        responseRate,
        meetingRate: totalCohortContacted > 0 ? (meetingsScheduledCount / totalCohortContacted) * 100 : 0,
        testAcceptanceRate,
        closeRate,
        byClass,
        byAudience,
        byScript,
      },
      activeGoalToday: {
        target: overallTarget,
        achieved: achievedToday,
        percentage: overallTarget > 0 ? Math.min(100, Math.round((achievedToday / overallTarget) * 100)) : 0,
        byAudience: goalByAudience,
      },
      activeVsPaid,
      lossReasonsBreakdown,
      uncontactedLeadsCount,
      pendingFollowUpsCount,
    };
  }

  // --- Exporting Data ---
  public exportFullJson(): string {
    return JSON.stringify(this.db, null, 2);
  }

  public exportLeadsCsv(): string {
    const headers = [
      "ID",
      "Origem",
      "Instagram",
      "Username_Normalizado",
      "Rotulo_Pago",
      "Publico_ID",
      "Classe_Manual",
      "Status_Funil",
      "Status_Teste",
      "Script_ID",
      "Data_Criacao",
      "Data_Primeiro_Contato",
      "Data_Resposta",
      "Data_Reuniao_Agendada",
      "Data_Reuniao_Realizada",
      "Data_Fechamento",
      "Data_Perda",
      "Motivo_Perda",
      "Sistema_360_Cadastrado",
      "Cliente_Nome",
      "Cliente_Empresa",
      "Cliente_WhatsApp",
      "Cliente_Email",
    ];

    const rows = this.db.leads.map((l) => [
      l.id,
      l.source,
      l.instagramUrl || "",
      l.instagramUsernameNormalized || "",
      l.temporaryLabel || "",
      l.audienceId,
      l.manualClass,
      l.status,
      l.testStatus,
      l.scriptVersionId || "",
      l.createdAt,
      l.stageDates?.contactedAt || "",
      l.stageDates?.respondedAt || "",
      l.stageDates?.meetingScheduledAt || "",
      l.stageDates?.meetingHeldAt || "",
      l.stageDates?.closedAt || "",
      l.stageDates?.lostAt || "",
      l.lossReasonId || "",
      l.system360TransferredAt || "",
      l.customerData?.name || "",
      l.customerData?.company || "",
      l.customerData?.whatsapp || "",
      l.customerData?.email || "",
    ]);

    return [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
  }
}

export const store = new StoreManager();
