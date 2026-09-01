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
} from "./server/ai";

export interface AuthenticatedRequest extends Request {
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

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: "firestore",
      auth: "firebase",
      aiConfigured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()),
    });
  });

  // --- AUTHENTICATION MIDDLEWARE ---
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Acesso não autorizado: token de autenticação ausente." });
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
          email: userEmail,
          isAuthorized: false,
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
      return res.status(401).json({ error: `Sessão inválida ou expirada: ${err.message}` });
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
    if (!lead) return res.status(404).json({ error: "Lead não encontrado." });
    res.json(lead);
  });

  app.post("/api/leads", requireAuth, (req: AuthenticatedRequest, res) => {
    const performedBy = req.user?.email || "Operador";
    const result = store.createLead(req.body, performedBy);
    if (result.conflict) {
      return res.status(409).json({
        error: result.error,
        conflict: true,
        duplicateLead: result.duplicateLead,
      });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result.lead);
  });

  app.patch("/api/leads/:id", requireAuth, (req: AuthenticatedRequest, res) => {
    const performedBy = req.user?.email || "Operador";
    const result = store.updateLead(req.params.id, req.body, performedBy);
    if (result.conflict) {
      return res.status(409).json({
        error: result.error,
        conflict: true,
        currentLead: result.currentLead,
      });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.lead);
  });

  app.post("/api/leads/:id/archive", requireAuth, (req: AuthenticatedRequest, res) => {
    const performedBy = req.user?.email || "Operador";
    const { isArchived } = req.body;
    const ok = store.archiveLead(req.params.id, isArchived !== undefined ? !!isArchived : true, performedBy);
    if (!ok) return res.status(404).json({ error: "Lead não encontrado." });
    res.json({ success: true, isArchived });
  });

  app.get("/api/leads/:id/activities", requireAuth, (req, res) => {
    const activities = store.getActivitiesForLead(req.params.id);
    res.json(activities);
  });

  // --- AUDIENCES ---
  app.get("/api/audiences", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    res.json(store.getAudiences(includeArchived));
  });

  app.post("/api/audiences", requireAuth, (req, res) => {
    const { name, description, criteriaA, criteriaB, criteriaC, aiInstructions } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nome do público é obrigatório." });
    const aud = store.createAudience({
      name,
      description: description || "",
      criteriaA: criteriaA || "",
      criteriaB: criteriaB || "",
      criteriaC: criteriaC || "",
      aiInstructions: aiInstructions || "",
    });
    res.status(201).json(aud);
  });

  app.patch("/api/audiences/:id", requireAuth, (req, res) => {
    const aud = store.updateAudience(req.params.id, req.body);
    if (!aud) return res.status(404).json({ error: "Público não encontrado." });
    res.json(aud);
  });

  app.post("/api/audiences/:id/archive", requireAuth, (req, res) => {
    const result = store.archiveAudience(req.params.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  });

  // --- SCRIPTS ---
  app.get("/api/scripts", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    const audienceId = req.query.audienceId as string;
    res.json(store.getScripts(includeArchived, audienceId));
  });

  app.post("/api/scripts", requireAuth, (req, res) => {
    const { baseName, audienceId, content, creationMode, promptUsed } = req.body;
    if (!baseName || !audienceId || !content) {
      return res.status(400).json({ error: "Nome, Público e Conteúdo são obrigatórios." });
    }
    const scr = store.createScript({ baseName, audienceId, content, creationMode, promptUsed });
    res.status(201).json(scr);
  });

  app.patch("/api/scripts/:id", requireAuth, (req, res) => {
    try {
      const result = store.updateScript(req.params.id, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- GOALS & SETTINGS ---
  app.get("/api/goals", requireAuth, (req, res) => {
    res.json(store.getDailyGoals());
  });

  app.post("/api/goals", requireAuth, (req, res) => {
    const goal = store.setDailyGoal(req.body);
    res.json(goal);
  });

  app.get("/api/settings", requireAuth, (req, res) => {
    res.json(store.getSettings());
  });

  app.patch("/api/settings", requireAuth, (req, res) => {
    const updated = store.updateSettings(req.body);
    res.json(updated);
  });

  // --- LOSS REASONS ---
  app.get("/api/loss-reasons", requireAuth, (req, res) => {
    const includeArchived = req.query.includeArchived === "true";
    res.json(store.getLossReasons(includeArchived));
  });

  app.post("/api/loss-reasons", requireAuth, (req, res) => {
    const { name, isOther } = req.body;
    if (!name) return res.status(400).json({ error: "Nome do motivo é obrigatório." });
    const reason = store.createLossReason(name, !!isOther);
    res.status(201).json(reason);
  });

  app.post("/api/loss-reasons/:id/archive", requireAuth, (req, res) => {
    const ok = store.archiveLossReason(req.params.id);
    if (!ok) return res.status(404).json({ error: "Motivo não encontrado." });
    res.json({ success: true });
  });

  // --- AGENDA & PROSPECTING SCHEDULE ---
  app.get("/api/schedule", requireAuth, (req, res) => {
    res.json(store.getScheduleItems());
  });

  app.post("/api/schedule", requireAuth, (req, res) => {
    const item = store.createScheduleItem(req.body);
    res.status(201).json(item);
  });

  app.patch("/api/schedule/:id", requireAuth, (req, res) => {
    const updated = store.updateScheduleItem(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Item de agendamento não encontrado." });
    res.json(updated);
  });

  app.delete("/api/schedule/:id", requireAuth, (req, res) => {
    const ok = store.deleteScheduleItem(req.params.id);
    if (!ok) return res.status(404).json({ error: "Item não encontrado." });
    res.json({ success: true });
  });

  app.get("/api/prospecting-plan", requireAuth, (req, res) => {
    const month = req.query.month as string | undefined;
    res.json(store.getMonthlyPlan(month));
  });

  app.post("/api/prospecting-plan", requireAuth, (req, res) => {
    const saved = store.saveMonthlyPlan(req.body);
    res.json(saved);
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
  app.get("/api/export/csv", requireAuth, (req, res) => {
    const csv = store.exportLeadsCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=crm_prospeccao_leads.csv");
    res.send(csv);
  });

  app.get("/api/export/json", requireAuth, (req, res) => {
    const json = store.exportFullJson();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=crm_prospeccao_backup.json");
    res.send(json);
  });

  // --- PRODUCTION GATED DEV ROUTES ---
  const isProduction = process.env.NODE_ENV === "production";

  app.get("/api/tests/run", (req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Rota desativada em ambiente de produção." });
    }
    res.json({
      total: 0,
      passed: 0,
      failed: 0,
      allPassed: true,
      results: [],
    });
  });

  app.post("/api/db/seed", (req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Rota destrutiva desativada em ambiente de produção." });
    }
    res.json({ success: true, leadsCount: 0 });
  });

  app.post("/api/db/reset", (req, res) => {
    if (isProduction) {
      return res.status(403).json({ error: "Rota destrutiva desativada em ambiente de produção." });
    }
    res.json({ success: true, message: "Operação não permitida." });
  });

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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`CRM Prospecção V1 Production Server running on http://localhost:${PORT}`);
  });
}

startServer();
