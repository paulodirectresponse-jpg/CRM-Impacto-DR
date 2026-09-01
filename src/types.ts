/**
 * CRM de Prospecção V1 - Type Definitions
 * Specification Version 1.0 - 31/08/2026
 */

export type AcquisitionSource = "active" | "paid";

export type OperationalClass = "A" | "B" | "C" | "PENDENTE";

export type SuggestedClass = "A" | "B" | "C" | "PENDENTE" | "INCONCLUSIVE";

export type FunnelStatus =
  | "novo"
  | "analisado"
  | "contatado"
  | "respondeu"
  | "reuniao_agendada"
  | "reuniao_realizada"
  | "teste_oferecido"
  | "teste_aceito"
  | "negociacao"
  | "fechado"
  | "perdido";

export type TestStatus =
  | "nenhum"
  | "nao_oferecido"
  | "oferecido"
  | "aceito"
  | "em_producao"
  | "entregue"
  | "aprovado"
  | "recusado";

export type Sistema360Status = "nao_oferecido" | "oferecido" | "aceito" | "recusado" | "nao_ofertado";

export interface StageDates {
  analyzedAt?: string;
  contactedAt?: string;
  respondedAt?: string;
  meetingScheduledAt?: string;
  meetingHeldAt?: string;
  testOfferedAt?: string;
  testAcceptedAt?: string;
  negotiationAt?: string;
  closedAt?: string;
  lostAt?: string;
}

export interface TestDates {
  offeredAt?: string;
  acceptedAt?: string;
  inProductionAt?: string;
  deliveredAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface FirstContactSnapshot {
  classAtFirstContact: OperationalClass;
  audienceIdAtFirstContact: string;
  scriptVersionIdAtFirstContact: string;
  sourceAtFirstContact: AcquisitionSource;
  firstContactAt: string;
}

export interface AiEvaluation {
  suggestedClass: SuggestedClass;
  confidence: number;
  visibleFacts: {
    username?: string;
    followerText?: string;
    bioSummary?: string;
    contentPattern?: string;
  };
  strengths: string[];
  risks: string[];
  opportunity: string;
  rationale: string;
  missingInformation: string[];
  evaluatedAt: string;
}

export interface PrintAnalysisResult {
  extractedUsername?: string;
  suggestedClass: SuggestedClass;
  confidence: number;
  visibleFacts: {
    username?: string;
    followerText?: string;
    bioSummary?: string;
    contentPattern?: string;
  };
  strengths: string[];
  risks: string[];
  opportunity: string;
  rationale: string;
  missingInformation: string[];
}

export interface CustomerData {
  name?: string;
  company?: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
  contractValue?: number;
  monthlyRecurringFee?: number;
  servicesIncluded?: string[];
  closedDate?: string;
}

export interface Lead {
  id: string;
  source: AcquisitionSource;
  instagramUrl?: string;
  instagramUsernameNormalized?: string;
  temporaryLabel?: string;
  audienceId: string;
  manualClass: OperationalClass;
  status: FunnelStatus;
  testStatus: TestStatus;
  scriptVersionId?: string;
  paidCampaign?: string;
  paidCreative?: string;
  notes?: string;
  nextFollowUpAt?: string | null;
  lossReasonId?: string;
  lossReasonOther?: string;
  customerData?: CustomerData;
  sistema360Offered?: boolean;
  sistema360Status?: Sistema360Status;
  system360TransferredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  isArchived: boolean;
  duplicateOverride?: boolean;
  stageDates: StageDates;
  testDates: TestDates;
  firstContactSnapshot?: FirstContactSnapshot;
  aiEvaluation?: AiEvaluation;
}

export interface Audience {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  criteriaA: string;
  criteriaB: string;
  criteriaC: string;
  aiInstructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface Script {
  id: string;
  baseName: string;
  audienceId: string;
  version: number;
  content: string;
  isActive: boolean;
  isLocked: boolean; // Locked automatically once used in a first contact
  creationMode?: "prompt" | "free";
  promptUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyGoal {
  date: string; // YYYY-MM-DD in America/Sao_Paulo
  targetTotal: number;
  defaultDailyTarget?: number;
  targetByAudience: Record<string, number>;
  targetsByAudience?: Record<string, number>;
}

export interface LossReason {
  id: string;
  name: string;
  isOther: boolean;
  isActive: boolean;
}

export interface AppSettings {
  aiEnabled: boolean;
  geminiModel: string;
  openaiModel?: string;
  authorizedEmails: string[];
  defaultDailyTarget: number;
  dailyActiveGoal?: number;
  audienceTargets: Record<string, number>;
  minSampleForAiAnalysis: number;
  adSpendTotal?: number;
  adSpendByCampaign?: Record<string, number>;
  averageContractValue?: number;
}

export type ActivityType =
  | "creation"
  | "status_change"
  | "class_change"
  | "audience_change"
  | "script_change"
  | "test_status_change"
  | "loss"
  | "reopen"
  | "closed"
  | "system360_marked"
  | "system360_unmarked"
  | "ai_analysis"
  | "note_added"
  | "duplicate_override";

export interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;
  title: string;
  description: string;
  before?: any;
  after?: any;
  performedBy: string;
  timestamp: string;
}

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  isAuthorized: boolean;
}

export interface DashboardMetrics {
  period: {
    type: string;
    label?: string;
    startDate: string;
    endDate: string;
    sourceFilter: string;
  };
  volumes: {
    newLeads: number;
    contacted: number;
    responded: number;
    meetingsScheduled: number;
    meetingsHeld: number;
    meetingBooked?: number;
    meetingHeld?: number;
    testsOffered: number;
    testsAccepted: number;
    testOffered?: number;
    testAccepted?: number;
    negotiations: number;
    negotiation?: number;
    closed: number;
    lost: number;
  };
  cohort: {
    totalCohortContacted: number;
    totalContactedInPeriod?: number;
    closedWon?: number;
    responseRate: number; // %
    meetingRate: number; // %
    testAcceptanceRate: number; // %
    closeRate: number; // %
    byClass: Record<
      OperationalClass,
      {
        contacted: number;
        responded?: number;
        meetings?: number;
        closed: number;
        rate: number;
        conversionRate?: number;
      }
    >;
    byAudience: Array<{
      audienceId: string;
      audienceName: string;
      contacted: number;
      closed: number;
      rate: number;
    }>;
    byScript: Array<{
      scriptId: string;
      scriptVersionId: string;
      scriptName: string;
      version: number;
      audienceName: string;
      contacted: number;
      responded: number;
      testsOffered: number;
      testsAccepted: number;
      closed: number;
      responseRate: number;
      conversionRate: number;
      closeRate: number;
      sampleSize: number;
    }>;
  };
  activeGoalToday: {
    target: number;
    achieved: number;
    percentage: number;
    byAudience: Array<{
      audienceId: string;
      audienceName: string;
      target: number;
      achieved: number;
    }>;
  };
  activeVsPaid: {
    active: { newLeads: number; contacted: number; closed: number; closeRate: number };
    paid: { newLeads: number; contacted: number; closed: number; closeRate: number };
  };
  lossReasonsBreakdown: Array<{
    reasonId: string;
    reasonName: string;
    count: number;
    percentage: number;
  }>;
  uncontactedLeadsCount: number;
  pendingFollowUpsCount: number;
}

export interface AcceptanceTestResult {
  id: number;
  scenario: string;
  expectedResult: string;
  status: "passed" | "failed" | "running" | "pending";
  logs: string[];
  executionTimeMs?: number;
  details?: string;
}

export interface ProspectingScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  audienceId?: string;
  audienceName?: string;
  targetCount: number;
  completedCount?: number;
  completed?: boolean;
  timeBlock?: "manha" | "tarde" | "noite" | "dia_todo";
  notes?: string;
  createdAt: string;
}

export interface MonthlyProspectingPlan {
  month: string; // YYYY-MM
  targetMonthlyLeads: number; // Quantidade total de leads para prospectar no mês
  activeWeekdays: number[]; // [1,2,3,4,5] = Segunda a Sexta
  customActiveDates?: string[]; // Datas YYYY-MM-DD ativadas
  customRestDates?: string[]; // Datas YYYY-MM-DD de folga
  calculatedDailyTarget: number; // Leads por dia de prospecção
  dailyNotes?: Record<string, string>; // Notas por data
  dailyCompletions?: Record<string, boolean>; // Conclusão manual do dia
  
  // Specific niche/audience target allocations:
  targetsByAudience?: Record<string, number>; // Meta diária por nicho/público (leads/dia)
  monthlyTargetsByAudience?: Record<string, number>; // Meta mensal por nicho/público
  
  // Team member allocations & tracking:
  teamMemberTargets?: Record<string, number>; // Meta diária por membro da equipe (email)
  monthlyTeamMemberTargets?: Record<string, number>; // Meta mensal por membro da equipe
  
  // Backward compatibility fields
  targetNewClients?: number;
  targetRevenue?: number;
  avgTicket?: number;
  workingDays?: number;
  calculatedDailyLeads?: number;
  calculatedWeeklyLeads?: number;
  calculatedMonthlyLeads?: number;
  calculatedRequiredTests?: number;
  weeklyThemes?: {
    week1?: string;
    week2?: string;
    week3?: string;
    week4?: string;
    week5?: string;
  };
  notes?: string;
  updatedAt?: string;
}

