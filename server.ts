import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { store } from "./server/store";
import { adminAuth } from "./server/firebaseAdmin";
import {
  analyzeProfilePrint,
  analyzeFunnelBottlenecks,
  analyzeScriptPerformance,
  generateExecutiveSummary,
  generateAudienceWithAi,
  generateScriptWithAi,
  generateImportStrategyWithAi,
} from "./server/ai";

export interface AuthenticatedRequest extends Request {
  requestId?: string;
  user?: {
    uid: string;
    email: string;
    name: string;
    isAuthorized: boolean;
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize Firestore store
  await store.init();

  // JSON Body Parser with 15mb limit for transient print processing
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // Request ID and Logger Middleware
  app.use((req: AuthenticatedRequest, res, next) => {
    const reqId = (req.headers["x-request-id"] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    req.requestId = reqId;
    res.setHeader("X-Request-Id", reqId);

    if (req.path.startsWith("/api/")) {
      console.log(`[API ${reqId}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check endpoint with real Firestore status
  app.get("/api/health", (_req, res) => {
    const health = store.getHealth();
    res.json(health);
  });

  // --- AUTHENTICATION MIDDLEWARE ---
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Acesso não autorizado: token de autenticação ausente.",
        code: "UNAUTHORIZED",
        requestId: req.requestId,
      });
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userEmail = (decodedToken.email || "").toLowerCase().trim();

      const authorizedList = store.getAuthorizedEmails();
      const isAuthorized = authorizedList.includes(userEmail);

      if (!isAuthorized) {
        return res.status(403).json({
          error: `Acesso negado: o e-mail ${userEmail} não possui autorização de acesso ao CRM.`,
          code: "FORBIDDEN",
          email: userEmail,
          isAuthorized: false,
          requestId: req.requestId,
        });
      }

      req.user = {
        uid: decodedToken.uid,
        email: userEmail,
        name: decodedToken.name || userEmail.split("@")[0].toUpperCase(),
        isAuthorized: true,
      };
      next();
    } catch (err: any) {
      return res.status(401).json({
        error: `Sessão inválida ou expirada: ${err.message}`,
        code: "INVALID_SESSION",
        requestId: req.requestId,
      });
    }
  };

  // --- AUTH & SESSION ---
  app.get("/api/auth/session", async (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        email: "",
        name: "",
        isAuthorized: false,
        authorizedEmails: store.getAuthorizedEmails(),
      });
    }

    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userEmail = (decodedToken.email || "").toLowerCase().trim();
      const authorizedList = store.getAuthorizedEmails();
      const isAuthorized = authorizedList.includes(userEmail);

      return res.json({
        email: userEmail,
        name: decodedToken.name || userEmail.split("@")[0].toUpperCase(),
        isAuthorized,
        authorizedEmails: authorizedList,
      });
    } catch (err) {
      return res.json({
        email: "",
        name: "",
        isAuthorized: false,
        authorizedEmails: store.getAuthorizedEmails(),
      });
    }
  });

  // --- LEADS ---
  app.get("/api/leads/prospect-next", requireAuth, (req, res) => {
    const { audienceId, classes, discoverySource, importBatchId, excludeIds } = req.query;
    let parsedClasses: any = undefined;
    if (typeof classes === "string" && classes.trim().length > 0) {
      parsedClasses = classes.split(",").map((c) => c.trim());
    } else if (Array.isArray(classes)) {
      parsedClasses = classes;
    }

    let parsedExcludeIds: string[] = [];
    if (typeof excludeIds === "string" && excludeIds.trim().length > 0) {
      parsedExcludeIds = excludeIds.split(",").map((id) => id.trim());
    } else if (Array.isArray(excludeIds)) {
      parsedExcludeIds = excludeIds as string[];
    }

    const result = store.getNextProspectLead({
      audienceId: audienceId as string,
      classes: parsedClasses,
      discoverySource: discoverySource as any,
      importBatchId: importBatchId as string,
      excludeIds: parsedExcludeIds,
    });
    res.json(result);
  });

  app.post("/api/leads/prospect-next", requireAuth, (req, res) => {
    const { audienceId, classes, discoverySource, importBatchId, excludeIds } = req.body || {};
    const result = store.getNextProspectLead({
      audienceId,
      classes,
      discoverySource,
      importBatchId,
      excludeIds,
    });
    res.json(result);
  });

  app.get("/api/leads", requireAuth, (req, res) => {
    const { status, manualClass, audienceId, source, scriptVersionId, isArchived, search } = req.query;
    const leads = store.getLeads({
      status: status as any,
      manualClass: manualClass as any,
      audienceId: audienceId as string,
      source: source as any,
      scriptVersionId: scriptVersionId as string,
      isArchived: isArchived === "true" ? true : isArchived === "false" ? false : false,
      search: search as string,
    });
    res.json(leads);
  });

  app.get("/api/leads/:id", requireAuth, (req, res) => {
    const lead = store.getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado.", code: "NOT_FOUND" });
    }
    res.json(lead);
  });

  app.post("/api/leads", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.createLead(req.body, performedBy);
      if (result.conflict) {
        return res.status(409).json({
          error: result.error,
          code: result.code || "DUPLICATE_LEAD",
          conflict: true,
          duplicateLead: result.duplicateLead,
          requestId: req.requestId,
        });
      }
      if (result.error) {
        return res.status(400).json({
          error: result.error,
          code: result.code || "VALIDATION_ERROR",
          requestId: req.requestId,
        });
      }
      res.status(201).json(result.lead);
    } catch (err: any) {
      console.error(`[API Lead Create Error ${req.requestId}]`, err);
      res.status(500).json({
        error: `Falha ao persistir lead no banco de dados: ${err.message || String(err)}`,
        code: "DATABASE_WRITE_ERROR",
        requestId: req.requestId,
      });
    }
  });

  app.patch("/api/leads/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.updateLead(req.params.id, req.body, performedBy);
      if (result.conflict) {
        return res.status(409).json({
          error: result.error,
          code: result.code || "LEAD_VERSION_CONFLICT",
          conflict: true,
          currentLead: result.currentLead,
          requestId: req.requestId,
        });
      }
      if (result.error) {
        const statusCode = result.code === "NOT_FOUND" ? 404 : 400;
        return res.status(statusCode).json({
          error: result.error,
          code: result.code || "VALIDATION_ERROR",
          requestId: req.requestId,
        });
      }
      res.json(result.lead);
    } catch (err: any) {
      console.error(`[API Lead Update Error ${req.requestId}]`, err);
      res.status(500).json({
        error: `Falha ao atualizar lead no banco de dados: ${err.message || String(err)}`,
        code: "DATABASE_WRITE_ERROR",
        requestId: req.requestId,
      });
    }
  });

  app.post("/api/leads/:id/archive", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const { isArchived } = req.body;
      const targetArchive = isArchived !== undefined ? !!isArchived : true;
      const result = await store.archiveLead(req.params.id, targetArchive, performedBy);
      if (!result.success) {
        return res.status(404).json({ error: "Lead não encontrado.", code: "NOT_FOUND", requestId: req.requestId });
      }
      res.json({ success: true, lead: result.lead });
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.deleteLead(req.params.id, performedBy);
      if (!result.success) {
        return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/leads/:id/restore", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.restoreLead(req.params.id, performedBy);
      if (!result.success) {
        return res.status(404).json({ error: "Lead não encontrado para restauração.", code: "NOT_FOUND", requestId: req.requestId });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.get("/api/leads/:id/activities", requireAuth, (req, res) => {
    const activities = store.getActivitiesForLead(req.params.id);
    res.json(activities);
  });

  app.post("/api/leads/:id/activities", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const lead = store.getLeadById(req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead não encontrado.", code: "NOT_FOUND" });

      const act = await store.logActivity({
        leadId: req.params.id,
        type: req.body.type || "note_added",
        title: req.body.title || "Nota adicionada",
        description: req.body.description || req.body.notes || "",
        performedBy,
      });
      res.status(201).json(act);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/leads/batch-import", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const leads = req.body.leads || [];
      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: "Lista de leads vazia ou inválida.", code: "VALIDATION_ERROR" });
      }
      const result = await store.batchImportLeads(leads, performedBy);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- AUDIENCES ---
  app.get("/api/audiences", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    res.json(store.getAudiences(includeArchived));
  });

  app.post("/api/audiences", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, description, criteriaA, criteriaB, criteriaC, aiInstructions } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Nome do público é obrigatório." });
      const aud = await store.createAudience({
        name,
        description: description || "",
        criteriaA: criteriaA || "",
        criteriaB: criteriaB || "",
        criteriaC: criteriaC || "",
        aiInstructions: aiInstructions || "",
      });
      res.status(201).json(aud);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.patch("/api/audiences/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const aud = await store.updateAudience(req.params.id, req.body);
      if (!aud) return res.status(404).json({ error: "Público não encontrado." });
      res.json(aud);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/audiences/:id/archive", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.archiveAudience(req.params.id);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/audiences/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.deleteAudience(req.params.id, performedBy);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/audiences/:id/restore", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.restoreAudience(req.params.id, performedBy);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- SCRIPTS ---
  app.get("/api/scripts", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const audienceId = req.query.audienceId as string;
    res.json(store.getScripts(includeArchived, audienceId));
  });

  app.post("/api/scripts", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { baseName, audienceId, content, creationMode, promptUsed } = req.body;
      if (!baseName || !audienceId || !content) {
        return res.status(400).json({ error: "Nome, Público e Conteúdo são obrigatórios." });
      }
      const scr = await store.createScript({ baseName, audienceId, content, creationMode, promptUsed });
      res.status(201).json(scr);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.patch("/api/scripts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.updateScript(req.params.id, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/scripts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.deleteScript(req.params.id, performedBy);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/scripts/:id/restore", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.restoreScript(req.params.id, performedBy);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- GOALS (Legacy endpoint compat) & SETTINGS ---
  app.get("/api/goals", requireAuth, (_req, res) => {
    res.json(store.getDailyGoals());
  });

  app.post("/api/goals", requireAuth, async (req, res) => {
    const goal = await store.setDailyGoal(req.body);
    res.json(goal);
  });

  app.get("/api/settings", requireAuth, (_req, res) => {
    res.json(store.getSettings());
  });

  app.patch("/api/settings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await store.updateSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- LOSS REASONS ---
  app.get("/api/loss-reasons", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    res.json(store.getLossReasons(includeArchived));
  });

  app.post("/api/loss-reasons", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { name, isOther } = req.body;
      if (!name) return res.status(400).json({ error: "Nome do motivo é obrigatório." });
      const reason = await store.createLossReason(name, !!isOther);
      res.status(201).json(reason);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/loss-reasons/:id/archive", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ok = await store.archiveLossReason(req.params.id);
      if (!ok) return res.status(404).json({ error: "Motivo não encontrado." });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/loss-reasons/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.deleteLossReason(req.params.id);
      if (!result.success) return res.status(404).json(result);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- AGENDA & PROSPECTING SCHEDULE ---
  app.get("/api/schedule", requireAuth, (_req, res) => {
    res.json(store.getScheduleItems());
  });

  app.post("/api/schedule", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const item = await store.createScheduleItem(req.body);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.patch("/api/schedule/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await store.updateScheduleItem(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Item de agendamento não encontrado." });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/schedule/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ok = await store.deleteScheduleItem(req.params.id);
      if (!ok) return res.status(404).json({ error: "Item não encontrado." });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.get("/api/prospecting-plan", requireAuth, (req, res) => {
    const month = req.query.month as string | undefined;
    res.json(store.getMonthlyPlan(month));
  });

  app.post("/api/prospecting-plan", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const saved = await store.saveMonthlyPlan(req.body);
      res.json(saved);
    } catch (err: any) {
      console.error(`[API Save Monthly Plan Error ${req.requestId}]`, err);
      res.status(500).json({
        error: `Falha ao persistir plano mensal no banco de dados: ${err.message || String(err)}`,
        code: "DATABASE_WRITE_ERROR",
        requestId: req.requestId,
      });
    }
  });

  // --- DASHBOARD METRICS ---
  const handleMetricsRequest = (req: AuthenticatedRequest, res: express.Response) => {
    const { periodType = "thisMonth", startDate, endDate, sourceFilter = "all" } = req.query;
    const metrics = store.calculateDashboardMetrics({
      periodType: periodType as any,
      startDate: startDate as string,
      endDate: endDate as string,
      sourceFilter: sourceFilter as any,
    });
    res.json(metrics);
  };

  app.get("/api/metrics/dashboard", requireAuth, handleMetricsRequest);
  app.get("/api/metrics", requireAuth, handleMetricsRequest);

  // --- OPENAI AI ENDPOINTS ---
  app.post("/api/ai/score-print", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({
        error: "Recursos de IA estão temporariamente desativados nas configurações.",
      });
    }

    const { imageBase64, mimeType, audienceId, notes } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Print da imagem não fornecido." });
    }
    if (!audienceId) {
      return res.status(400).json({ error: "Selecione um público para calibrar a análise de perfil da IA." });
    }

    const audience = store.getAudiences().find((a) => a.id === audienceId);
    if (!audience) {
      return res.status(404).json({ error: "Público não encontrado." });
    }

    const result = await analyzeProfilePrint(
      imageBase64,
      mimeType || "image/jpeg",
      audience,
      notes,
      process.env.OPENAI_MODEL || "gpt-5.6-luna"
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result.data);
  });

  app.post("/api/ai/funnel-analysis", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({ error: "Recursos de IA desativados." });
    }

    const metrics = store.calculateDashboardMetrics({
      periodType: (req.body.periodType as any) || "thisMonth",
      sourceFilter: (req.body.sourceFilter as any) || "all",
    });

    const result = await analyzeFunnelBottlenecks(metrics, process.env.OPENAI_MODEL || "gpt-5.6-luna");
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ analysis: result.analysis });
  });

  app.post("/api/ai/script-analysis", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({ error: "Recursos de IA desativados." });
    }

    const metrics = store.calculateDashboardMetrics({
      periodType: "thisMonth",
      sourceFilter: "active",
    });
    const scripts = store.getScripts(true);

    const result = await analyzeScriptPerformance(
      scripts,
      metrics,
      settings.minSampleForAiAnalysis,
      process.env.OPENAI_MODEL || "gpt-5.6-luna"
    );
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ analysis: result.analysis });
  });

  app.post("/api/ai/executive-summary", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({ error: "Recursos de IA desativados." });
    }

    const metrics = store.calculateDashboardMetrics({
      periodType: (req.body.periodType as any) || "thisMonth",
      sourceFilter: (req.body.sourceFilter as any) || "all",
    });

    const result = await generateExecutiveSummary(metrics, process.env.OPENAI_MODEL || "gpt-5.6-luna");
    if (!result.success) return res.status(500).json({ error: result.error });
    res.json({ summary: result.summary });
  });

  app.post("/api/ai/generate-audience", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({ error: "Recursos de IA desativados nas configurações." });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Informe um prompt descrevendo o público ou nicho desejado." });
    }

    const result = await generateAudienceWithAi(prompt.trim(), process.env.OPENAI_MODEL || "gpt-5.6-luna");
    if (!result.success || !result.audience) {
      return res.status(500).json({ error: result.error || "Falha ao gerar público com IA." });
    }

    res.json(result.audience);
  });

  app.post("/api/ai/generate-script", requireAuth, async (req, res) => {
    const settings = store.getSettings();
    if (!settings.aiEnabled) {
      return res.status(400).json({ error: "Recursos de IA desativados nas configurações." });
    }

    const { prompt, audienceName } = req.body;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Informe as diretrizes ou contexto para o script." });
    }

    const result = await generateScriptWithAi(prompt.trim(), audienceName, process.env.OPENAI_MODEL || "gpt-5.6-luna");
    if (!result.success || !result.script) {
      return res.status(500).json({ error: result.error || "Falha ao gerar script com IA." });
    }

    res.json(result.script);
  });

  // --- EXPORT & BACKUP ---
  app.get("/api/export/csv", requireAuth, (_req, res) => {
    const csv = store.exportLeadsCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=crm_prospeccao_leads.csv");
    res.send(csv);
  });

  app.get("/api/export/json", requireAuth, (_req, res) => {
    const json = store.exportFullJson();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=crm_prospeccao_backup.json");
    res.send(json);
  });

  // --- APIFY INTEGRATION ENDPOINTS (V2.1) ---
  app.get("/api/integrations/apify/status", requireAuth, (_req, res) => {
    const status = store.getApifyIntegrationStatus();
    res.json(status);
  });

  app.post("/api/integrations/apify/token", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string" || !token.trim()) {
        return res.status(400).json({ error: "Token da Apify é obrigatório.", code: "APIFY_INVALID_TOKEN", requestId: req.requestId });
      }
      const updatedStatus = await store.saveApifyToken(token.trim());
      res.json(updatedStatus);
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        error: err.message || "Erro ao salvar e validar token da Apify.",
        code: err.code || "APIFY_ERROR",
        requestId: req.requestId,
      });
    }
  });

  app.post("/api/integrations/apify/test", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.testApifyConnection();
      if (!result.success) {
        return res.status(400).json({ error: result.error, code: "APIFY_AUTH_FAILED", requestId: req.requestId });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "APIFY_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/integrations/apify/token", requireAuth, async (_req, res) => {
    await store.removeApifyToken();
    res.json({ success: true, message: "Token da Apify removido com sucesso." });
  });

  // --- IMPORT CONFIGS (V2.1) ---
  app.get("/api/import-configs", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const configs = store.getImportConfigs(includeArchived);
    res.json(configs);
  });

  app.get("/api/import-configs/:id", requireAuth, (req, res) => {
    const config = store.getImportConfigById(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Configuração não encontrada.", code: "NOT_FOUND" });
    }
    res.json(config);
  });

  app.post("/api/import-configs", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const createdBy = req.user?.email || "Operador";
      const config = await store.createImportConfig(req.body, createdBy);
      res.status(201).json(config);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: "VALIDATION_ERROR", requestId: req.requestId });
    }
  });

  app.put("/api/import-configs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const config = await store.updateImportConfig(req.params.id, req.body);
      res.json(config);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: "VALIDATION_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/import-configs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.deleteImportConfig(req.params.id, performedBy);
      if (!result.success) {
        return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/import-configs/:id/restore", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const performedBy = req.user?.email || "Operador";
      const result = await store.restoreImportConfig(req.params.id, performedBy);
      if (!result.success) {
        return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- TRASH & DATA MANAGEMENT (V2.1.1) ---
  app.get("/api/trash", requireAuth, (_req, res) => {
    const trash = store.getTrashItems();
    res.json(trash);
  });

  app.delete("/api/trash/leads/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.permanentlyDeleteLead(req.params.id);
      if (!result.success) return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/trash/scripts/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.permanentlyDeleteScript(req.params.id);
      if (!result.success) return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/trash/audiences/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.permanentlyDeleteAudience(req.params.id);
      if (!result.success) return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.delete("/api/trash/import-configs/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await store.permanentlyDeleteImportConfig(req.params.id);
      if (!result.success) return res.status(404).json({ error: result.message, code: "NOT_FOUND", requestId: req.requestId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  app.post("/api/trash/empty", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const category = req.body.category as "all" | "leads" | "scripts" | "audiences" | "configs" | undefined;
      const result = await store.emptyTrash(category);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message, code: "DATABASE_WRITE_ERROR", requestId: req.requestId });
    }
  });

  // --- AI IMPORT STRATEGY (V2.1.1) ---
  app.post("/api/imports/ai-strategy", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { audienceId, location, mode = "balanced" } = req.body;
      if (!audienceId) {
        return res.status(400).json({
          error: "Público-alvo é obrigatório para gerar a estratégia com IA.",
          code: "VALIDATION_ERROR",
          requestId: req.requestId,
        });
      }

      const audience = store.getAudienceById(audienceId);
      if (!audience) {
        return res.status(404).json({
          error: "Público-alvo não encontrado.",
          code: "NOT_FOUND",
          requestId: req.requestId,
        });
      }

      const result = await generateImportStrategyWithAi(
        {
          audience,
          location: location?.trim() || undefined,
          mode: ["quality", "balanced", "volume"].includes(mode) ? mode : "balanced",
        },
        process.env.OPENAI_MODEL || "gpt-5.6-luna"
      );

      if (!result.success || !result.strategy) {
        return res.status(500).json({
          error: result.error || "Não foi possível gerar a estratégia de importação.",
          code: result.code || "AI_UNAVAILABLE",
          requestId: req.requestId,
        });
      }

      res.json(result.strategy);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || "Falha ao gerar estratégia com IA.",
        code: "AI_ERROR",
        requestId: req.requestId,
      });
    }
  });

  // --- IMPORT BATCHES (V2.1) ---
  app.get("/api/import-batches", requireAuth, (_req, res) => {
    const batches = store.getImportBatches();
    res.json(batches);
  });

  app.get("/api/import-batches/:id", requireAuth, (req, res) => {
    const batch = store.getImportBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: "Lote de importação não encontrado.", code: "NOT_FOUND" });
    }
    res.json(batch);
  });

  app.post("/api/import-batches/start", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const createdBy = req.user?.email || "Operador";
      const batch = await store.startApifyImport(req.body, createdBy);
      res.status(201).json(batch);
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        error: err.message,
        code: err.code || "IMPORT_START_ERROR",
        requestId: req.requestId,
      });
    }
  });

  app.post("/api/import-batches/:id/refresh", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const batch = await store.checkAndUpdateImportBatch(req.params.id);
      res.json(batch);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: "IMPORT_REFRESH_ERROR", requestId: req.requestId });
    }
  });

  // --- ACCEPTANCE TEST RUNNER ROUTE ---
  // Safety: never expose or execute the acceptance runner in production.
  if (process.env.NODE_ENV !== "production") {
    const handleTestRun = async (_req: AuthenticatedRequest, res: Response) => {
      try {
        const { runSuite } = await import("./server/testSuite");
        const results = await runSuite();
        const list = Array.isArray(results) ? results : [];
        const passed = list.filter((r) => r.status === "passed").length;
        const failed = list.filter((r) => r.status === "failed").length;
        res.json({
          total: list.length,
          passed,
          failed,
          allPassed: list.length > 0 && failed === 0,
          results: list,
        });
      } catch (err: any) {
        res.status(500).json({
          total: 0,
          passed: 0,
          failed: 1,
          allPassed: false,
          error: err?.message || "Falha ao executar testes.",
          results: [],
        });
      }
    };

    app.get("/api/tests/run", requireAuth, handleTestRun);
    app.post("/api/tests/run", requireAuth, handleTestRun);
  }

  // Destructive/demo database routes are never available in production.
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/db/seed", requireAuth, (_req, res) => {
      res.status(410).json({ success: false, error: "Seed desabilitado nesta versão." });
    });

    app.post("/api/db/reset", requireAuth, (_req, res) => {
      res.status(410).json({ success: false, error: "Reset desabilitado nesta versão." });
    });
  }

  // Vite middleware for development vs Static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`CRM Prospecção V1 Production Server running on http://localhost:${PORT}`);
  });
}

startServer();
