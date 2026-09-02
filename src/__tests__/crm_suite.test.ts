import { describe, it, expect, beforeEach } from "vitest";
import { store } from "../../server/store";
import { normalizeInstagramInput } from "../../src/utils/instagramUtils";
import { getSaoPauloDateString, isTodayInSaoPaulo } from "../../src/utils/dateUtils";

const describeLive = process.env.RUN_LIVE_FIRESTORE_TESTS === "true" ? describe : describe.skip;

describeLive("CRM Prospecção V1 - Suíte Integral de Testes e Validações", () => {
  beforeEach(async () => {
    await store.init();
  });

  // --- SEÇÃO 1: AUTENTICAÇÃO E CONTROLE DE ACESSO RBAC ---
  describe("1. Autenticação e Segurança RBAC", () => {
    it("1.1 Deve rejeitar e-mails não autorizados", () => {
      const authorized = store.getAuthorizedEmails();
      const unauthorized = "invasor@externo.com";
      expect(authorized.includes(unauthorized)).toBe(false);
    });

    it("1.2 Deve autorizar e-mail padrão do operador", () => {
      const authorized = store.getAuthorizedEmails();
      expect(authorized).toContain("paulo.direct.response@gmail.com");
    });

    it("1.3 Deve permitir múltiplos e-mails autorizados em sincronia", async () => {
      const settings = store.getSettings();
      expect(Array.isArray(settings.authorizedEmails)).toBe(true);
      expect(settings.authorizedEmails.length).toBeGreaterThan(0);
    });
  });

  // --- SEÇÃO 2: NORMALIZAÇÃO DE INSTAGRAM E IDENTIFICADORES ---
  describe("2. Normalização e Tratamento de Perfis do Instagram", () => {
    it("2.1 Deve normalizar URL padrão do Instagram", () => {
      const norm = normalizeInstagramInput("https://www.instagram.com/pedro_editor/");
      expect(norm.isValid).toBe(true);
      expect(norm.username).toBe("pedro_editor");
    });

    it("2.2 Deve normalizar handle com @ e espaços", () => {
      const norm = normalizeInstagramInput("  @DR.ALEXANDRE  ");
      expect(norm.isValid).toBe(true);
      expect(norm.username).toBe("dr.alexandre");
    });

    it("2.3 Deve rejeitar URLs inválidas", () => {
      const norm = normalizeInstagramInput("https://google.com");
      expect(norm.isValid).toBe(false);
    });

    it("2.4 Deve lidar com URLs móveis com parâmetros de tracking", () => {
      const norm = normalizeInstagramInput("https://instagram.com/clinica.dermato?igsh=MXRkYTZi");
      expect(norm.isValid).toBe(true);
      expect(norm.username).toBe("clinica.dermato");
    });
  });

  // --- SEÇÃO 3: AGENDA COMO FONTE ÚNICA DE METAS ---
  describe("3. Agenda e Planejamento Mensal de Prospecção", () => {
    it("3.1 Deve ler e salvar o plano mensal na Agenda", async () => {
      const month = "2026-09";
      const plan = await store.saveMonthlyPlan({
        month,
        targetMonthlyLeads: 250,
        activeWeekdays: [1, 2, 3, 4, 5],
        customActiveDates: [],
        customRestDates: [],
        calculatedDailyTarget: 12,
        targetsByAudience: {},
        monthlyTargetsByAudience: {},
        teamMemberTargets: {},
        dailyNotes: { "2026-09-01": "Foco em Infoprodutores" },
        dailyCompletions: { "2026-09-01": true },
        updatedAt: new Date().toISOString(),
      });

      expect(plan.month).toBe(month);
      expect(plan.targetMonthlyLeads).toBe(250);
      expect(plan.dailyNotes["2026-09-01"]).toBe("Foco em Infoprodutores");
    });

    it("3.2 Métricas do Dashboard devem consumir a meta calculada da Agenda", async () => {
      const metrics = store.calculateDashboardMetrics({ periodType: "thisMonth", sourceFilter: "all" });
      expect(metrics.activeGoalToday).toBeDefined();
      expect(typeof metrics.activeGoalToday.target).toBe("number");
      expect(typeof metrics.activeGoalToday.achieved).toBe("number");
      expect(typeof metrics.activeGoalToday.percentage).toBe("number");
    });
  });

  // --- SEÇÃO 4: PREVENÇÃO DE DUPLICATAS E CONTROLE DE CONCORRÊNCIA ---
  describe("4. Prevenção de Duplicatas e Integridade de Leads", () => {
    it("4.1 Deve bloquear duplicação do mesmo Instagram na prospecção ativa", async () => {
      const aud = store.getAudiences()[0];
      const testUser = `test_dup_${Date.now()}`;
      
      const first = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/${testUser}`,
        audienceId: aud.id,
        manualClass: "A",
      });
      expect(first.lead).toBeDefined();

      const second = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/${testUser}`,
        audienceId: aud.id,
        manualClass: "B",
      });
      expect(second.conflict).toBe(true);
      expect(second.error).toContain("Já existe um lead cadastrado");
    });

    it("4.2 Deve permitir cadastro de duplicata com duplicateOverride = true", async () => {
      const aud = store.getAudiences()[0];
      const testUser = `test_override_${Date.now()}`;

      await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/${testUser}`,
        audienceId: aud.id,
        manualClass: "A",
      });

      const second = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/${testUser}`,
        audienceId: aud.id,
        manualClass: "B",
        duplicateOverride: true,
      });

      expect(second.lead).toBeDefined();
      expect(second.conflict).toBeUndefined();
    });
  });

  // --- SEÇÃO 5: CRUD, ARQUIVAMENTO E EXCLUSÃO SUAVE (SOFT DELETE) ---
  describe("5. Operações de CRUD e Exclusão Segura", () => {
    it("5.1 Deve criar, atualizar e excluir lead sem quebrar integridade", async () => {
      const aud = store.getAudiences()[0];
      const res = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/delete_test_${Date.now()}`,
        audienceId: aud.id,
        manualClass: "A",
      });
      const leadId = res.lead!.id;

      // Update
      const updated = await store.updateLead(leadId, { notes: "Nota de teste" });
      expect(updated.lead?.notes).toBe("Nota de teste");

      // Delete (soft delete)
      const del = await store.deleteLead(leadId);
      expect(del.success).toBe(true);

      // Verificação: lead excluído não deve aparecer na listagem ativa
      const activeLeads = store.getLeads({ isArchived: false });
      expect(activeLeads.find((l) => l.id === leadId)).toBeUndefined();
    });

    it("5.2 Deve suportar arquivamento e desarquivamento de leads", async () => {
      const aud = store.getAudiences()[0];
      const res = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/archive_test_${Date.now()}`,
        audienceId: aud.id,
        manualClass: "B",
      });
      const leadId = res.lead!.id;

      // Arquivar
      await store.archiveLead(leadId, true);
      const archived = store.getLeads({ isArchived: true });
      expect(archived.find((l) => l.id === leadId)).toBeDefined();

      // Desarquivar
      await store.archiveLead(leadId, false);
      const active = store.getLeads({ isArchived: false });
      expect(active.find((l) => l.id === leadId)).toBeDefined();
    });
  });

  // --- SEÇÃO 6: VERSIONAMENTO AUTOMÁTICO DE SCRIPTS ---
  describe("6. Versionamento Automático de Scripts de Abordagem", () => {
    it("6.1 Deve criar nova versão ao editar script já utilizado em disparos", async () => {
      const aud = store.getAudiences()[0];
      const script = await store.createScript({
        baseName: "Script Imutabilidade Test",
        audienceId: aud.id,
        content: "Olá {{nome}}, primeira versão do script!",
      });

      // Simula lead contatado com o script v1
      await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/user_script_${Date.now()}`,
        audienceId: aud.id,
        manualClass: "A",
        scriptVersionId: script.id,
      });

      // Atualiza o script
      const updateRes = await store.updateScript(script.id, {
        content: "Olá {{nome}}, segunda versão modificada!",
      });

      expect(updateRes.createdNewVersion).toBe(true);
      expect(updateRes.script.version).toBe(2);
      expect(updateRes.script.parentId).toBe(script.id);
    });
  });

  // --- SEÇÃO 7: SANITIZAÇÃO E COMPATIBILIDADE FIRESTORE ---
  describe("7. Sanitização de Objetos para Firestore", () => {
    it("7.1 Não deve conter campos com valor 'undefined' antes de persistir", async () => {
      const aud = store.getAudiences()[0];
      const res = await store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/sanitize_test_${Date.now()}`,
        audienceId: aud.id,
        manualClass: "A",
        notes: undefined,
        paidCampaign: undefined,
      });

      expect(res.lead).toBeDefined();
      expect(res.lead?.notes).toBeUndefined();
    });
  });

  // --- SEÇÃO 8: HEALTH CHECK DO SISTEMA ---
  describe("8. Diagnóstico e Health Check", () => {
    it("8.1 Endpoint getHealth deve retornar status estruturado", () => {
      const health = store.getHealth();
      expect(health.status).toBeDefined();
      expect(health.database.provider).toBe("firestore");
      expect(typeof health.database.reachable).toBe("boolean");
      expect(health.auth).toBe("firebase_auth");
    });
  });
});
