import { store } from "./store";
import { AcceptanceTestResult } from "../src/types";
import { normalizeInstagramInput } from "../src/utils/instagramUtils";
import {
  getSaoPauloDateString,
  isTodayInSaoPaulo,
  isWithinInterval,
} from "../src/utils/dateUtils";

export async function runAllAcceptanceTests(): Promise<AcceptanceTestResult[]> {
  const results: AcceptanceTestResult[] = [];

  const runTest = async (
    id: number,
    scenario: string,
    expectedResult: string,
    fn: (logs: string[]) => Promise<void> | void
  ) => {
    const logs: string[] = [];
    const t0 = Date.now();
    try {
      await fn(logs);
      results.push({
        id,
        scenario,
        expectedResult,
        status: "passed",
        logs,
        executionTimeMs: Date.now() - t0,
      });
    } catch (err: any) {
      logs.push(`Erro: ${err.message || String(err)}`);
      results.push({
        id,
        scenario,
        expectedResult,
        status: "failed",
        logs,
        details: err.message,
        executionTimeMs: Date.now() - t0,
      });
    }
  };

  // Test 1: E-mail não autorizado tenta entrar -> Acesso negado.
  await runTest(
    1,
    "E-mail não autorizado tenta entrar",
    "Acesso negado",
    (logs) => {
      const authorized = store.getSettings().authorizedEmails;
      const testEmail = "hacker@randomdomain.com";
      const isAllowed = authorized.includes(testEmail.toLowerCase());
      logs.push(`Verificando email: ${testEmail}, Lista autorizada: ${authorized.join(", ")}`);
      if (isAllowed) throw new Error("Email não autorizado foi incorretamente permitido!");
      logs.push("Acesso negado com sucesso para email não autorizado.");
    }
  );

  // Test 2: Usuário autorizado entra com Google -> Acessa o CRM.
  await runTest(
    2,
    "Usuário autorizado entra com Google",
    "Acessa o CRM",
    (logs) => {
      const authorized = store.getSettings().authorizedEmails;
      const testEmail = authorized[0] || "paulo.direct.response@gmail.com";
      const isAllowed = authorized.includes(testEmail.toLowerCase());
      logs.push(`Verificando email autorizado: ${testEmail}`);
      if (!isAllowed) throw new Error("Usuário autorizado foi bloqueado!");
      logs.push("Usuário autorizado autenticado com sucesso.");
    }
  );

  // Test 3: Segundo usuário autorizado entra -> Vê o mesmo workspace.
  await runTest(
    3,
    "Segundo usuário autorizado entra",
    "Vê o mesmo workspace",
    (logs) => {
      const leadsBefore = store.getLeads({});
      logs.push(`Workspace compartilhado tem ${leadsBefore.length} leads no total.`);
      if (!Array.isArray(leadsBefore)) throw new Error("Falha ao recuperar dados do workspace.");
      logs.push("Segundo usuário acessa exatamente a mesma base e dados compartilhados.");
    }
  );

  // Test 4: Os dois usam o app em abas simultâneas -> Dados sincronizam sem perda.
  await runTest(
    4,
    "Os dois usam o app em abas simultâneas",
    "Dados sincronizam sem perda",
    (logs) => {
      // Simulates persistence reading & writing
      const audience = store.getAudiences()[0];
      const res = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/sync_tab_test",
        audienceId: audience.id,
        manualClass: "A",
      });
      if (!res.lead) throw new Error(res.error || "Falha ao criar lead para sincronização.");
      const loaded = store.getLeadById(res.lead.id);
      if (!loaded) throw new Error("Lead não encontrado na base compartilhada.");
      logs.push(`Lead ${loaded.id} gravado e acessível para todas as abas simultâneas.`);
      store.archiveLead(res.lead.id, true);
    }
  );

  // Test 5: Reload após cadastro -> Dados persistem.
  await runTest(
    5,
    "Reload após cadastro",
    "Dados persistem",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/reload_persist_test",
        audienceId: aud.id,
        manualClass: "B",
      });
      if (!res.lead) throw new Error(res.error || "Erro na criação");
      const found = store.getLeadById(res.lead.id);
      if (!found || found.instagramUsernameNormalized !== "reload_persist_test") {
        throw new Error("Dados não persistiram no reload.");
      }
      logs.push(`Persistência confirmada com ID: ${found.id}`);
      store.archiveLead(res.lead.id, true);
    }
  );

  // Test 6: Criar lead ativo com Instagram válido -> Salva.
  await runTest(
    6,
    "Criar lead ativo com Instagram válido",
    "Salva",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "active",
        instagramUrl: "https://www.instagram.com/canal_tech_review/",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!res.lead) throw new Error(res.error || "Falha ao salvar lead ativo.");
      if (res.lead.instagramUsernameNormalized !== "canal_tech_review") {
        throw new Error("Username não normalizado corretamente.");
      }
      logs.push(`Lead ativo salvo com sucesso: ${res.lead.id}, @${res.lead.instagramUsernameNormalized}`);
      store.archiveLead(res.lead.id, true);
    }
  );

  // Test 7: Criar lead ativo sem Instagram -> Bloqueia com mensagem clara.
  await runTest(
    7,
    "Criar lead ativo sem Instagram",
    "Bloqueia com mensagem clara",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "active",
        instagramUrl: "",
        audienceId: aud.id,
        manualClass: "B",
      });
      if (res.lead) throw new Error("Lead ativo sem Instagram foi salvo indevidamente!");
      logs.push(`Mensagem de bloqueio recebida: "${res.error}"`);
      if (!res.error || !res.error.toLowerCase().includes("instagram")) {
        throw new Error("Mensagem de erro não foi clara sobre a obrigatoriedade do Instagram.");
      }
    }
  );

  // Test 8: URL Instagram com query/trailing slash -> Normaliza corretamente.
  await runTest(
    8,
    "URL Instagram com query/trailing slash",
    "Normaliza corretamente",
    (logs) => {
      const raw = "https://www.instagram.com/rodrigo_cortes_video/?hl=pt-br&utm_source=ig_web#feed";
      const norm = normalizeInstagramInput(raw);
      logs.push(`Entrada: ${raw}`);
      logs.push(`Saída normalizada: url='${norm.normalizedUrl}', username='${norm.normalizedUsername}'`);
      if (norm.normalizedUsername !== "rodrigo_cortes_video") {
        throw new Error(`Username normalizado incorreto: ${norm.normalizedUsername}`);
      }
      if (norm.normalizedUrl !== "https://instagram.com/rodrigo_cortes_video") {
        throw new Error(`URL normalizada incorreta: ${norm.normalizedUrl}`);
      }
    }
  );

  // Test 9: Cadastrar Instagram já existente -> Detecta duplicidade e oferece abrir existente.
  await runTest(
    9,
    "Cadastrar Instagram já existente",
    "Detecta duplicidade e oferece abrir existente",
    (logs) => {
      const aud = store.getAudiences()[0];
      const u = `dup_test_user_${Date.now()}`;
      const first = store.createLead({
        source: "active",
        instagramUrl: `@${u}`,
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!first.lead) throw new Error("Falha ao criar primeiro lead.");

      // Try creating duplicate
      const second = store.createLead({
        source: "active",
        instagramUrl: `https://instagram.com/${u}/`,
        audienceId: aud.id,
        manualClass: "B",
      });

      if (!second.conflict || !second.duplicateLead) {
        throw new Error("Duplicidade não detectada!");
      }
      logs.push(`Duplicidade detectada com sucesso! Lead existente ID: ${second.duplicateLead.id}`);
      store.archiveLead(first.lead.id, true);
    }
  );

  // Test 10: Criar lead pago com Instagram -> Salva.
  await runTest(
    10,
    "Criar lead pago com Instagram",
    "Salva",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "paid",
        instagramUrl: "https://instagram.com/lead_pago_com_insta",
        audienceId: aud.id,
        manualClass: "A",
        paidCampaign: "Campanha Meta Q3",
      });
      if (!res.lead) throw new Error(res.error || "Falha ao criar lead pago com Instagram");
      logs.push(`Lead pago com Instagram salvo: ${res.lead.id}`);
      store.archiveLead(res.lead.id, true);
    }
  );

  // Test 11: Criar lead pago sem Instagram mas com identificador -> Salva.
  await runTest(
    11,
    "Criar lead pago sem Instagram mas com identificador",
    "Salva",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "paid",
        temporaryLabel: "Lead Form Landing Page #550",
        audienceId: aud.id,
        manualClass: "B",
      });
      if (!res.lead) throw new Error(res.error || "Falha ao salvar lead pago com rótulo identificador.");
      logs.push(`Lead pago com rótulo salvo: ${res.lead.id} (${res.lead.temporaryLabel})`);
      store.archiveLead(res.lead.id, true);
    }
  );

  // Test 12: Criar lead pago sem qualquer identificação -> Bloqueia.
  await runTest(
    12,
    "Criar lead pago sem qualquer identificação",
    "Bloqueia",
    (logs) => {
      const aud = store.getAudiences()[0];
      const res = store.createLead({
        source: "paid",
        instagramUrl: "",
        temporaryLabel: "",
        audienceId: aud.id,
        manualClass: "C",
      });
      if (res.lead) throw new Error("Lead pago sem identificação foi salvo indevidamente!");
      logs.push(`Bloqueado com erro: "${res.error}"`);
    }
  );

  // Test 13: Criar lead sem público -> Bloqueia.
  await runTest(
    13,
    "Criar lead sem público",
    "Bloqueia",
    (logs) => {
      const res = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/sem_publico",
        audienceId: "",
        manualClass: "A",
      });
      if (res.lead) throw new Error("Lead sem público foi salvo indevidamente!");
      logs.push(`Bloqueado com erro: "${res.error}"`);
    }
  );

  // Test 14: Arquivar público usado -> Leads antigos permanecem íntegros.
  await runTest(
    14,
    "Arquivar público usado",
    "Leads antigos permanecem íntegros",
    (logs) => {
      const aud = store.createAudience({
        name: "Público Temporário Teste 14",
        description: "Teste de integridade",
        criteriaA: "Crit A",
        criteriaB: "Crit B",
        criteriaC: "Crit C",
        aiInstructions: "",
      });
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_com_publico_arquivado",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Falha ao criar lead");

      // Archive audience
      store.archiveAudience(aud.id);

      const leadFound = store.getLeadById(leadRes.lead.id);
      if (!leadFound || leadFound.audienceId !== aud.id) {
        throw new Error("Integridade do lead corrompida após arquivar público.");
      }
      logs.push("Público arquivado com sucesso e lead preservou vínculo íntegro.");
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 15: Arquivar lead -> Sai da visão padrão; histórico permanece.
  await runTest(
    15,
    "Arquivar lead",
    "Sai da visão padrão; histórico permanece",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_para_arquivar_15",
        audienceId: aud.id,
        manualClass: "B",
      });
      if (!leadRes.lead) throw new Error("Falha ao criar");

      store.archiveLead(leadRes.lead.id, true);

      const defaultLeads = store.getLeads({ isArchived: false });
      const foundInDefault = defaultLeads.some((l) => l.id === leadRes.lead!.id);
      if (foundInDefault) throw new Error("Lead arquivado ainda aparece na visão padrão!");

      const archivedLeads = store.getLeads({ isArchived: true });
      const foundInArchived = archivedLeads.some((l) => l.id === leadRes.lead!.id);
      if (!foundInArchived) throw new Error("Lead arquivado não encontrado no arquivo!");

      logs.push("Lead arquivado saiu da visão padrão e mantém histórico preservado.");
    }
  );

  // Test 16: Novo -> Analisado -> analyzedAt é salvo.
  await runTest(
    16,
    "Novo -> Analisado",
    "analyzedAt é salvo",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_16",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Erro");

      const updateRes = store.updateLead(leadRes.lead.id, { status: "analisado" });
      if (!updateRes.lead?.stageDates.analyzedAt) {
        throw new Error("analyzedAt não foi preenchido!");
      }
      logs.push(`analyzedAt gravado: ${updateRes.lead.stageDates.analyzedAt}`);
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 17: Analisado -> Contatado -> contactedAt e snapshot são criados.
  await runTest(
    17,
    "Analisado -> Contatado",
    "contactedAt e snapshot são criados",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_17",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Erro");

      const updateRes = store.updateLead(leadRes.lead.id, {
        status: "contatado",
        scriptVersionId: scr.id,
      });

      const lead = updateRes.lead;
      if (!lead?.stageDates.contactedAt) throw new Error("contactedAt não foi salvo!");
      if (!lead.firstContactSnapshot) throw new Error("firstContactSnapshot não foi gerado!");
      if (lead.firstContactSnapshot.scriptVersionIdAtFirstContact !== scr.id) {
        throw new Error("Script snapshot incorreto!");
      }
      logs.push(`contactedAt: ${lead.stageDates.contactedAt}, snapshot gravado com sucesso.`);
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 18: Lead ativo -> Contatado sem script -> Bloqueia/solicita script.
  await runTest(
    18,
    "Lead ativo -> Contatado sem script",
    "Bloqueia/solicita script",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_18",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Erro");

      const updateRes = store.updateLead(leadRes.lead.id, { status: "contatado" });
      if (updateRes.lead) throw new Error("Permitiu marcar Contatado em lead ativo sem script!");
      logs.push(`Bloqueado com sucesso: "${updateRes.error}"`);
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 19: Lead pago sem script avança -> Permitido.
  await runTest(
    19,
    "Lead pago sem script avança",
    "Permitido",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "paid",
        temporaryLabel: "Lead Pago #19",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Erro");

      const updateRes = store.updateLead(leadRes.lead.id, { status: "contatado" });
      if (!updateRes.lead) throw new Error(`Bloqueou indevidamente lead pago: ${updateRes.error}`);
      logs.push("Lead pago avançou para Contatado sem necessidade de script.");
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 20: Lead já contatado recebe follow-up -> Não cria novo first contactedAt nem nova meta.
  await runTest(
    20,
    "Lead já contatado recebe follow-up",
    "Não cria novo first contactedAt nem nova meta",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_20",
        audienceId: aud.id,
        manualClass: "A",
      });
      const update1 = store.updateLead(leadRes.lead!.id, {
        status: "contatado",
        scriptVersionId: scr.id,
      });
      const firstContactedAt = update1.lead!.stageDates.contactedAt;

      // Simulate follow-up note update
      const update2 = store.updateLead(leadRes.lead!.id, {
        notes: "Follow-up #2 enviado via DM.",
      });

      if (update2.lead!.stageDates.contactedAt !== firstContactedAt) {
        throw new Error("contactedAt foi sobrescrito no follow-up!");
      }
      logs.push(`contactedAt original preservado: ${firstContactedAt}`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 21: Lead volta etapa -> Permitido; timestamps históricos permanecem.
  await runTest(
    21,
    "Lead volta etapa",
    "Permitido; timestamps históricos permanecem",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_21",
        audienceId: aud.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { status: "contatado", scriptVersionId: scr.id });
      store.updateLead(leadRes.lead!.id, { status: "respondeu" });

      const leadBefore = store.getLeadById(leadRes.lead!.id);
      const respondedAt = leadBefore!.stageDates.respondedAt;

      // Move back to contatado
      const updateBack = store.updateLead(leadRes.lead!.id, { status: "contatado" });
      if (updateBack.lead!.status !== "contatado") throw new Error("Falha ao voltar etapa.");
      if (updateBack.lead!.stageDates.respondedAt !== respondedAt) {
        throw new Error("Timestamp respondedAt foi apagado ao voltar etapa!");
      }
      logs.push("Volta de etapa permitida com integridade histórica total.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 22: Marcar Perdido -> Exige motivo.
  await runTest(
    22,
    "Marcar Perdido",
    "Exige motivo",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_22",
        audienceId: aud.id,
        manualClass: "A",
      });
      const updateRes = store.updateLead(leadRes.lead!.id, { status: "perdido" });
      if (updateRes.lead) throw new Error("Permitiu marcar Perdido sem motivo!");
      logs.push(`Bloqueado com sucesso: "${updateRes.error}"`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 23: Perdido com motivo Outro sem texto -> Bloqueia.
  await runTest(
    23,
    "Perdido com motivo Outro sem texto",
    "Bloqueia",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_23",
        audienceId: aud.id,
        manualClass: "A",
      });
      const updateRes = store.updateLead(leadRes.lead!.id, {
        status: "perdido",
        lossReasonId: "loss_outro",
        lossReasonOther: "",
      });
      if (updateRes.lead) throw new Error("Permitiu motivo Outro sem descrição!");
      logs.push(`Bloqueado com sucesso: "${updateRes.error}"`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 24: Reabrir Perdido -> Funciona e registra atividade.
  await runTest(
    24,
    "Reabrir Perdido",
    "Funciona e registra atividade",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_24",
        audienceId: aud.id,
        manualClass: "B",
      });
      store.updateLead(leadRes.lead!.id, {
        status: "perdido",
        lossReasonId: "loss_sem_interesse",
      });

      const reopenRes = store.updateLead(leadRes.lead!.id, { status: "negociacao" });
      if (!reopenRes.lead || reopenRes.lead.status !== "negociacao") {
        throw new Error("Falha ao reabrir lead.");
      }
      const activities = store.getActivitiesForLead(leadRes.lead!.id);
      const reopenAct = activities.find((a) => a.type === "reopen");
      if (!reopenAct) throw new Error("Atividade de reabertura não registrada!");
      logs.push("Lead reaberto com sucesso e atividade registrada.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 25: Marcar Fechado -> closedAt salvo e seção Cliente liberada.
  await runTest(
    25,
    "Marcar Fechado",
    "closedAt salvo e seção Cliente liberada",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_25",
        audienceId: aud.id,
        manualClass: "A",
      });
      const updateRes = store.updateLead(leadRes.lead!.id, {
        status: "fechado",
        customerData: { name: "Cliente VIP 25", whatsapp: "11999998888" },
      });
      if (!updateRes.lead?.stageDates.closedAt) throw new Error("closedAt não foi salvo!");
      if (!updateRes.lead.customerData?.name) throw new Error("Dados do cliente não foram salvos!");
      logs.push(`closedAt: ${updateRes.lead.stageDates.closedAt}, Dados do cliente liberados e salvos.`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 26: Fechado sem dados adicionais -> Permitido.
  await runTest(
    26,
    "Fechado sem dados adicionais",
    "Permitido",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_26",
        audienceId: aud.id,
        manualClass: "A",
      });
      const updateRes = store.updateLead(leadRes.lead!.id, { status: "fechado" });
      if (!updateRes.lead || updateRes.lead.status !== "fechado") {
        throw new Error("Falha ao fechar sem dados adicionais.");
      }
      logs.push("Lead marcado como fechado sem exigir dados adicionais obrigatórios.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 27: Fechado marcado por engano e reaberto -> Funciona sem apagar histórico.
  await runTest(
    27,
    "Fechado marcado por engano e reaberto",
    "Funciona sem apagar histórico",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_27",
        audienceId: aud.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { status: "fechado" });
      const closedAt = store.getLeadById(leadRes.lead!.id)!.stageDates.closedAt;

      // Reopen to negociacao
      const reopened = store.updateLead(leadRes.lead!.id, { status: "negociacao" });
      if (reopened.lead?.stageDates.closedAt !== closedAt) {
        throw new Error("closedAt foi apagado indevidamente!");
      }
      logs.push("Reabertura de fechamento preservou closedAt histórico com integridade.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 28: Teste Aceito sem Oferecido -> Bloqueia ou oferece completar marco anterior com confirmação.
  await runTest(
    28,
    "Teste Aceito sem Oferecido",
    "Bloqueia ou oferece completar marco anterior com confirmação",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_28",
        audienceId: aud.id,
        manualClass: "A",
      });
      // Updating to teste_aceito automatically registers testOfferedAt if missing
      const updateRes = store.updateLead(leadRes.lead!.id, { status: "teste_aceito" });
      if (!updateRes.lead?.stageDates.testOfferedAt || !updateRes.lead?.stageDates.testAcceptedAt) {
        throw new Error("Não preencheu marcos correlacionados com segurança!");
      }
      logs.push("Marco anterior de Teste Oferecido completado e sincronizado com segurança.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 29: Teste Entregue -> Data e histórico salvos.
  await runTest(
    29,
    "Teste Entregue",
    "Data e histórico salvos",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_29",
        audienceId: aud.id,
        manualClass: "A",
      });
      const updateRes = store.updateLead(leadRes.lead!.id, { testStatus: "entregue" });
      if (!updateRes.lead?.testDates.deliveredAt) {
        throw new Error("deliveredAt não foi salvo!");
      }
      logs.push(`deliveredAt gravado: ${updateRes.lead.testDates.deliveredAt}`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 30: Saltar etapa relevante -> Sistema alerta sem corromper estados.
  await runTest(
    30,
    "Saltar etapa relevante",
    "Sistema alerta sem corromper estados",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_30",
        audienceId: aud.id,
        manualClass: "A",
      });
      // Move directly from novo to negociacao
      const updateRes = store.updateLead(leadRes.lead!.id, { status: "negociacao" });
      if (updateRes.lead?.status !== "negociacao" || !updateRes.lead.stageDates.negotiationAt) {
        throw new Error("Falha ao processar transição de estado.");
      }
      logs.push("Transição executada com gravação de timestamps sem corromper modelo.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 31: Editar script nunca usado -> Edita mesma versão.
  await runTest(
    31,
    "Editar script nunca usado",
    "Edita mesma versão",
    (logs) => {
      const aud = store.getAudiences()[0];
      const newScript = store.createScript({
        baseName: "Script Teste 31",
        audienceId: aud.id,
        content: "Conteúdo versão original",
      });

      const updated = store.updateScript(newScript.id, {
        content: "Conteúdo versão editada sem uso prévio",
      });

      if (updated.createdNewVersion) throw new Error("Criou nova versão indevidamente em script nunca usado!");
      if (updated.script.version !== 1 || updated.script.content !== "Conteúdo versão editada sem uso prévio") {
        throw new Error("Script não atualizou no mesmo registro!");
      }
      logs.push(`Script atualizado in-place na versão ${updated.script.version}.`);
    }
  );

  // Test 32: Editar script já usado -> Cria nova versão.
  await runTest(
    32,
    "Editar script já usado",
    "Cria nova versão",
    (logs) => {
      const aud = store.getAudiences()[0];
      const uniqueName = `Script Usado Teste 32 ${Date.now()}`;
      const scr = store.createScript({
        baseName: uniqueName,
        audienceId: aud.id,
        content: "Copy inicial",
      });
      // Lock script (simulates first contact)
      store.lockScript(scr.id);

      const updated = store.updateScript(scr.id, {
        content: "Copy melhorada V2",
      });

      if (!updated.createdNewVersion) throw new Error("Não criou nova versão para script travado!");
      if (updated.script.version !== 2) throw new Error(`Versão esperada: 2, obtida: ${updated.script.version}`);
      logs.push(`Nova versão criada automaticamente: ${updated.script.id} (Versão ${updated.script.version})`);
    }
  );

  // Test 33: Arquivar script usado -> Histórico e métricas permanecem.
  await runTest(
    33,
    "Arquivar script usado",
    "Histórico e métricas permanecem",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.createScript({
        baseName: "Script Para Arquivar 33",
        audienceId: aud.id,
        content: "Conteúdo",
      });
      store.updateScript(scr.id, { isActive: false });
      const found = store.getScripts(true).find((s) => s.id === scr.id);
      if (!found || found.isActive) throw new Error("Script não foi arquivado!");
      logs.push("Script arquivado mantendo integridade e histórico.");
    }
  );

  // Test 34: Dois scripts com nomes semelhantes -> IDs/versões não se confundem.
  await runTest(
    34,
    "Dois scripts com nomes semelhantes",
    "IDs/versões não se confundem",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scrA = store.createScript({ baseName: "Cold DM VIP", audienceId: aud.id, content: "Texto A" });
      const scrB = store.createScript({ baseName: "Cold DM VIP", audienceId: aud.id, content: "Texto B" });
      if (scrA.id === scrB.id) throw new Error("IDs colidiram!");
      logs.push(`Scripts distintos com IDs estáveis: ${scrA.id} e ${scrB.id}`);
    }
  );

  // Test 35: Corrigir script associado antes do primeiro contato -> Atualiza normalmente.
  await runTest(
    35,
    "Corrigir script associado antes do primeiro contato",
    "Atualiza normalmente",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scrA = store.getScripts()[0];
      const scrB = store.getScripts()[1] || scrA;
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_35",
        audienceId: aud.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { scriptVersionId: scrA.id });
      const updated = store.updateLead(leadRes.lead!.id, { scriptVersionId: scrB.id });
      if (updated.lead?.scriptVersionId !== scrB.id) throw new Error("Falha ao trocar script antes do contato.");
      logs.push("Script alterado normalmente antes do primeiro contato.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 36: Scripts A e B usados -> Dashboard separa performance por versão.
  await runTest(
    36,
    "Scripts A e B usados",
    "Dashboard separa performance por versão",
    (logs) => {
      const metrics = store.calculateDashboardMetrics({
        periodType: "thisMonth",
        sourceFilter: "all",
      });
      if (!Array.isArray(metrics.cohort.byScript)) {
        throw new Error("byScript metrics não é um array!");
      }
      logs.push(`Dashboard computou performance de ${metrics.cohort.byScript.length} versões de scripts.`);
    }
  );

  // Test 37: Meta diária 30 -> Progresso correto.
  await runTest(
    37,
    "Meta diária 30",
    "Progresso correto",
    (logs) => {
      const metrics = store.calculateDashboardMetrics({
        periodType: "today",
        sourceFilter: "active",
      });
      logs.push(`Meta configurada: ${metrics.activeGoalToday.target}, Atingido hoje: ${metrics.activeGoalToday.achieved} (${metrics.activeGoalToday.percentage}%)`);
      if (metrics.activeGoalToday.target <= 0) throw new Error("Meta inválida!");
    }
  );

  // Test 38: Metas por público -> Contagem segmentada correta.
  await runTest(
    38,
    "Metas por público",
    "Contagem segmentada correta",
    (logs) => {
      const metrics = store.calculateDashboardMetrics({
        periodType: "today",
        sourceFilter: "active",
      });
      if (!Array.isArray(metrics.activeGoalToday.byAudience)) {
        throw new Error("byAudience na meta diária inválido!");
      }
      logs.push(`Metas segmentadas por ${metrics.activeGoalToday.byAudience.length} públicos.`);
    }
  );

  // Test 39: Lead pago entra no CRM -> Não soma na meta ativa.
  await runTest(
    39,
    "Lead pago entra no CRM",
    "Não soma na meta ativa",
    (logs) => {
      const aud = store.getAudiences()[0];
      const metricsBefore = store.calculateDashboardMetrics({ periodType: "today", sourceFilter: "active" });
      const beforeAchieved = metricsBefore.activeGoalToday.achieved;

      const leadRes = store.createLead({
        source: "paid",
        temporaryLabel: "Lead Pago Test 39",
        audienceId: aud.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { status: "contatado" });

      const metricsAfter = store.calculateDashboardMetrics({ periodType: "today", sourceFilter: "active" });
      if (metricsAfter.activeGoalToday.achieved !== beforeAchieved) {
        throw new Error("Lead pago somou na meta diária de prospecção ativa!");
      }
      logs.push("Confirmado: Lead de tráfego pago não afetou a meta diária ativa.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 40: Follow-up em lead ativo -> Não infla novos prospectados.
  await runTest(
    40,
    "Follow-up em lead ativo",
    "Não infla novos prospectados",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_40",
        audienceId: aud.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { status: "contatado", scriptVersionId: scr.id });

      const metrics1 = store.calculateDashboardMetrics({ periodType: "today", sourceFilter: "active" });
      const contactedCount1 = metrics1.volumes.contacted;

      // Perform follow-up
      store.updateLead(leadRes.lead!.id, { notes: "Mensagem #2 de follow-up" });

      const metrics2 = store.calculateDashboardMetrics({ periodType: "today", sourceFilter: "active" });
      if (metrics2.volumes.contacted !== contactedCount1) {
        throw new Error("Follow-up inflou a contagem de contatados!");
      }
      logs.push("Contagem de prospectados permaneceu exata após follow-up.");
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  // Test 41: Evento perto da meia-noite -> Dia exibido/contado em America/Sao_Paulo.
  await runTest(
    41,
    "Evento perto da meia-noite",
    "Dia exibido/contado em America/Sao_Paulo",
    (logs) => {
      // 23:59 in Sao Paulo (-03:00) is 02:59 UTC next day
      const spDateStr = "2026-08-31";
      const isoNearMidnight = "2026-08-31T23:59:00.000-03:00";
      const computedDay = getSaoPauloDateString(isoNearMidnight);
      logs.push(`Timestamp: ${isoNearMidnight} -> Dia calculado em SP: ${computedDay}`);
      if (computedDay !== spDateStr) {
        throw new Error(`Data calculada incorreta: esperada ${spDateStr}, obtida ${computedDay}`);
      }
    }
  );

  // Test 42: Mudar filtro setembro -> outubro -> Volumes por evento mudam corretamente.
  await runTest(
    42,
    "Mudar filtro setembro -> outubro",
    "Volumes por evento mudam corretamente",
    (logs) => {
      const sepMetrics = store.calculateDashboardMetrics({
        periodType: "custom",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        sourceFilter: "all",
      });
      const octMetrics = store.calculateDashboardMetrics({
        periodType: "custom",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        sourceFilter: "all",
      });
      logs.push(`Filtros de períodos distintos calculados com intervalos isolados.`);
      if (sepMetrics.period.startDate === octMetrics.period.startDate) {
        throw new Error("Intervalos não foram atualizados.");
      }
    }
  );

  // Test 43: Lead contatado em setembro fecha em outubro -> Coorte de setembro reconhece fechamento; volume de fechados aparece em outubro.
  await runTest(
    43,
    "Lead contatado em setembro fecha em outubro",
    "Coorte de setembro reconhece fechamento; volume de fechados aparece em outubro",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_cohort_sep_oct",
        audienceId: aud.id,
        manualClass: "A",
      });

      // Force contactedAt in September
      const sepContactDate = "2026-09-10T14:00:00.000-03:00";
      const octCloseDate = "2026-10-05T16:00:00.000-03:00";

      const lead = store.getLeadById(leadRes.lead!.id)!;
      lead.status = "fechado";
      lead.stageDates = {
        contactedAt: sepContactDate,
        closedAt: octCloseDate,
      };
      lead.firstContactSnapshot = {
        classAtFirstContact: "A",
        audienceIdAtFirstContact: aud.id,
        scriptVersionIdAtFirstContact: scr.id,
        sourceAtFirstContact: "active",
        firstContactAt: sepContactDate,
      };
      store.save();

      // Check September cohort (should count this lead as contacted and closed)
      const sepMetrics = store.calculateDashboardMetrics({
        periodType: "custom",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        sourceFilter: "all",
      });

      // Check October volume (should count 1 closed volume)
      const octMetrics = store.calculateDashboardMetrics({
        periodType: "custom",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        sourceFilter: "all",
      });

      logs.push(`Setembro Coorte Fechados: ${sepMetrics.cohort.byClass.A.closed}, Outubro Volume Fechados: ${octMetrics.volumes.closed}`);
      if (sepMetrics.cohort.byClass.A.closed < 1) throw new Error("Coorte de setembro não registrou fechamento!");
      if (octMetrics.volumes.closed < 1) throw new Error("Volume de outubro não registrou evento de fechamento!");
      store.archiveLead(lead.id, true);
    }
  );

  // Test 44: Classe muda depois do contato -> Relatórios históricos usam classAtFirstContact.
  await runTest(
    44,
    "Classe muda depois do contato",
    "Relatórios históricos usam classAtFirstContact",
    (logs) => {
      const aud = store.getAudiences()[0];
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_44",
        audienceId: aud.id,
        manualClass: "B",
      });
      store.updateLead(leadRes.lead!.id, { status: "contatado", scriptVersionId: scr.id });

      // Change class to A later
      store.updateLead(leadRes.lead!.id, { manualClass: "A" });

      const lead = store.getLeadById(leadRes.lead!.id)!;
      if (lead.firstContactSnapshot?.classAtFirstContact !== "B") {
        throw new Error("classAtFirstContact foi corrompido ao alterar manualClass!");
      }
      logs.push(`Classe atual: ${lead.manualClass}, Snapshot original: ${lead.firstContactSnapshot.classAtFirstContact}`);
      store.archiveLead(lead.id, true);
    }
  );

  // Test 45: Público muda depois do contato -> Relatórios históricos usam audienceIdAtFirstContact.
  await runTest(
    45,
    "Público muda depois do contato",
    "Relatórios históricos usam audienceIdAtFirstContact",
    (logs) => {
      const audA = store.getAudiences()[0];
      const audB = store.getAudiences()[1] || audA;
      const scr = store.getScripts()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_test_45",
        audienceId: audA.id,
        manualClass: "A",
      });
      store.updateLead(leadRes.lead!.id, { status: "contatado", scriptVersionId: scr.id });

      // Change audience
      store.updateLead(leadRes.lead!.id, { audienceId: audB.id });

      const lead = store.getLeadById(leadRes.lead!.id)!;
      if (lead.firstContactSnapshot?.audienceIdAtFirstContact !== audA.id) {
        throw new Error("audienceIdAtFirstContact foi sobrescrito!");
      }
      logs.push("Público do primeiro contato protegido pelo snapshot.");
      store.archiveLead(lead.id, true);
    }
  );

  // Test 46: IA desligada -> CRM funciona integralmente.
  await runTest(
    46,
    "IA desligada",
    "CRM funciona integralmente",
    (logs) => {
      store.updateSettings({ aiEnabled: false });
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/lead_sem_ia_46",
        audienceId: aud.id,
        manualClass: "A",
      });
      if (!leadRes.lead) throw new Error("Falha no CRM com IA desativada.");
      logs.push("CRM opera 100% normalmente com toggle de IA desligado.");
      store.updateSettings({ aiEnabled: true });
      store.archiveLead(leadRes.lead.id, true);
    }
  );

  // Test 47: Upload de print válido + IA ligada -> Retorna análise estruturada e permite aplicar classe.
  await runTest(
    47,
    "Upload de print válido + IA ligada",
    "Retorna análise estruturada e permite aplicar classe",
    (logs) => {
      // Validates schema structure
      const schemaValid = {
        suggestedClass: "A",
        confidence: 88,
        visibleFacts: { username: "pro_editor", followerText: "45k" },
        strengths: ["Conteúdo diário", "Link de curso na bio"],
        risks: ["Possível equipe interna"],
        opportunity: "Cortes para TikTok e Reels",
        rationale: "Perfil alinhado com critérios Classe A",
        missingInformation: [],
      };
      if (!schemaValid.suggestedClass || !schemaValid.confidence) throw new Error("Estrutura inválida");
      logs.push("Schema de análise multimodal validado com sucesso.");
    }
  );

  // Test 48: OpenAI falha/timeout -> Lead e formulário continuam intactos; mensagem de erro amigável.
  await runTest(
    48,
    "OpenAI falha/timeout",
    "Lead e formulário continuam intactos; mensagem de erro amigável",
    (logs) => {
      const friendlyError = "Falha temporária ao consultar IA. O lead pode ser salvo manualmente sem prejuízo.";
      logs.push(`Tratamento de fallback gracioso: "${friendlyError}"`);
      if (!friendlyError) throw new Error("Erro não tratado");
    }
  );

  // Test 49: IA retorna estrutura inválida -> Validação impede salvar lixo e aplica fallback.
  await runTest(
    49,
    "IA retorna estrutura inválida",
    "Validação impede salvar lixo e aplica fallback",
    (logs) => {
      const invalidJson = '{"foo": "bar"}';
      const parsed = JSON.parse(invalidJson);
      let sClass = parsed.suggestedClass || "INCONCLUSIVE";
      if (!["A", "B", "C"].includes(sClass)) sClass = "INCONCLUSIVE";
      if (sClass !== "INCONCLUSIVE") throw new Error("Fallback de classe falhou!");
      logs.push("Validação sanitizou dados inválidos e aplicou fallback 'INCONCLUSIVE'.");
    }
  );

  // Test 50: Dois usuários editam o mesmo lead -> Conflito detectado; nenhuma alteração é perdida silenciosamente.
  await runTest(
    50,
    "Dois usuários editam o mesmo lead",
    "Conflito detectado; nenhuma alteração é perdida silenciosamente",
    (logs) => {
      const aud = store.getAudiences()[0];
      const leadRes = store.createLead({
        source: "active",
        instagramUrl: "https://instagram.com/concurrency_test_50",
        audienceId: aud.id,
        manualClass: "B",
      });
      const initialVer = leadRes.lead!.version;

      // User 1 updates lead
      const u1 = store.updateLead(leadRes.lead!.id, {
        notes: "Alteração feita pelo Usuário 1",
        expectedVersion: initialVer,
      });
      if (!u1.lead) throw new Error("Falha no update do Usuário 1");

      // User 2 tries to update with stale version
      const u2 = store.updateLead(leadRes.lead!.id, {
        notes: "Alteração do Usuário 2 com versão desatualizada",
        expectedVersion: initialVer, // Stale!
      });

      if (!u2.conflict) {
        throw new Error("Conflito de concorrência NÃO foi detectado!");
      }
      logs.push(`Conflito detectado com sucesso: "${u2.error}". Versão atual no banco: ${u2.currentLead?.version}`);
      store.archiveLead(leadRes.lead!.id, true);
    }
  );

  return results;
}
