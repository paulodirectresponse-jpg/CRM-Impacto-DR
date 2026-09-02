/**
 * Apify Integration Service - CRM Impacto DR V2.1
 * Handles authentication, actor runs, dataset fetching, token masking, and mock support.
 */

export class ApifyError extends Error {
  public code: string;
  public statusCode?: number;
  public details?: any;

  constructor(code: string, message: string, statusCode = 400, details?: any) {
    super(message);
    this.name = "ApifyError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function maskToken(token: string): string {
  if (!token || typeof token !== "string") return "";
  const trimmed = token.trim();
  if (trimmed.length <= 4) return "••••••••";
  const lastChars = trimmed.slice(-4);
  return `••••••••${lastChars}`;
}

export interface ApifyUserData {
  id: string;
  username: string;
  email?: string;
  plan?: string;
}

export interface ApifyRunResult {
  runId: string;
  status: string;
  defaultDatasetId?: string;
  actId?: string;
  startedAt?: string;
  finishedAt?: string;
  usageTotalUsd?: number | null;
}

export interface ApifyActorInput {
  search: string;
  searchType: "user";
  searchLimit: number;
  enhanceUserSearchWithFacebookPage: boolean;
  liveSearch: boolean;
}

export type ApifyFetchHandler = (url: string, options?: RequestInit) => Promise<Response>;

export class ApifyService {
  private customFetch?: ApifyFetchHandler;

  constructor(customFetch?: ApifyFetchHandler) {
    this.customFetch = customFetch;
  }

  public setMockFetch(mockFetch?: ApifyFetchHandler) {
    this.customFetch = mockFetch;
  }

  private async fetch(url: string, options?: RequestInit): Promise<Response> {
    if (this.customFetch) {
      return this.customFetch(url, options);
    }
    return fetch(url, options);
  }

  /**
   * Validates Apify token against GET /v2/users/me
   */
  public async validateToken(token: string): Promise<ApifyUserData> {
    if (!token || typeof token !== "string" || !token.trim()) {
      throw new ApifyError("APIFY_NOT_CONFIGURED", "Token da Apify não fornecido.", 400);
    }

    const cleanToken = token.trim();
    const url = "https://api.apify.com/v2/users/me";

    try {
      const resp = await this.fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json",
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new ApifyError(
          "APIFY_AUTH_ERROR",
          "Token da Apify inválido ou não autorizado.",
          401
        );
      }

      if (resp.status === 429) {
        throw new ApifyError(
          "APIFY_RATE_LIMIT",
          "Limite de requisições da Apify excedido (Rate limit).",
          429
        );
      }

      if (!resp.ok) {
        const errorBody = await resp.text().catch(() => "");
        throw new ApifyError(
          "APIFY_UNAVAILABLE",
          `Serviço da Apify indisponível (HTTP ${resp.status}): ${errorBody}`,
          resp.status
        );
      }

      const json = await resp.json();
      const userData = json?.data || json;

      if (!userData || !userData.id) {
        throw new ApifyError(
          "APIFY_INVALID_RESPONSE",
          "Resposta inesperada ao validar usuário da Apify.",
          500
        );
      }

      return {
        id: userData.id,
        username: userData.username || userData.name || "ApifyUser",
        email: userData.email,
        plan: userData.plan?.id || userData.plan,
      };
    } catch (err: any) {
      if (err instanceof ApifyError) throw err;
      if (err.name === "AbortError" || err.message?.includes("timeout")) {
        throw new ApifyError("APIFY_RUN_TIMEOUT", "Tempo limite esgotado ao conectar à Apify.", 504);
      }
      throw new ApifyError(
        "APIFY_UNAVAILABLE",
        `Erro de conexão com a Apify: ${err.message || String(err)}`,
        503
      );
    }
  }

  /**
   * Starts an Instagram search scraper actor run
   */
  public async startInstagramSearchRun(
    token: string,
    params: {
      keywords: string[];
      searchLimitPerKeyword: number;
      liveSearch?: boolean;
    }
  ): Promise<ApifyRunResult> {
    if (!token || !token.trim()) {
      throw new ApifyError("APIFY_NOT_CONFIGURED", "Token da Apify não configurado.", 400);
    }

    const cleanToken = token.trim();
    const actorId = "apify~instagram-search-scraper";
    const url = `https://api.apify.com/v2/acts/${actorId}/runs`;

    const input: ApifyActorInput = {
      search: params.keywords.join(", "),
      searchType: "user",
      searchLimit: params.searchLimitPerKeyword,
      enhanceUserSearchWithFacebookPage: false,
      liveSearch: !!params.liveSearch,
    };

    try {
      const resp = await this.fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new ApifyError(
          "APIFY_AUTH_ERROR",
          "Falha de autenticação ao iniciar Actor da Apify.",
          401
        );
      }

      if (resp.status === 429) {
        throw new ApifyError(
          "APIFY_RATE_LIMIT",
          "Limite de execuções ou taxa da Apify excedido.",
          429
        );
      }

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        throw new ApifyError(
          "APIFY_RUN_FAILED",
          `Falha ao iniciar execução do scraper no Apify (HTTP ${resp.status}): ${errorText}`,
          resp.status
        );
      }

      const json = await resp.json();
      const runData = json?.data || json;

      if (!runData || !runData.id) {
        throw new ApifyError(
          "APIFY_INVALID_RESPONSE",
          "Resposta inválida da Apify ao criar execução.",
          500
        );
      }

      return {
        runId: runData.id,
        status: runData.status || "RUNNING",
        defaultDatasetId: runData.defaultDatasetId,
        actId: runData.actId,
        startedAt: runData.startedAt,
      };
    } catch (err: any) {
      if (err instanceof ApifyError) throw err;
      throw new ApifyError(
        "APIFY_RUN_FAILED",
        `Erro ao iniciar Actor Apify: ${err.message || String(err)}`,
        500
      );
    }
  }

  /**
   * Retrieves run status and usage metrics
   */
  public async getRunStatus(token: string, runId: string): Promise<ApifyRunResult> {
    if (!token || !token.trim()) {
      throw new ApifyError("APIFY_NOT_CONFIGURED", "Token da Apify não configurado.", 400);
    }
    if (!runId || !runId.trim()) {
      throw new ApifyError("APIFY_INVALID_RESPONSE", "ID da execução (runId) inválido.", 400);
    }

    const cleanToken = token.trim();
    const url = `https://api.apify.com/v2/actor-runs/${runId.trim()}`;

    try {
      const resp = await this.fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new ApifyError(
          "APIFY_RUN_FAILED",
          `Falha ao consultar status da execução ${runId} (HTTP ${resp.status}): ${errText}`,
          resp.status
        );
      }

      const json = await resp.json();
      const data = json?.data || json;

      // Extract usage cost if available
      let costUsd: number | null = null;
      if (typeof data.usageTotalUsd === "number") {
        costUsd = data.usageTotalUsd;
      } else if (typeof data.usageUsd === "number") {
        costUsd = data.usageUsd;
      } else if (data.usage?.TOTAL_USD !== undefined) {
        costUsd = Number(data.usage.TOTAL_USD) || null;
      }

      return {
        runId: data.id,
        status: (data.status || "").toUpperCase(),
        defaultDatasetId: data.defaultDatasetId,
        actId: data.actId,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        usageTotalUsd: costUsd,
      };
    } catch (err: any) {
      if (err instanceof ApifyError) throw err;
      throw new ApifyError(
        "APIFY_RUN_FAILED",
        `Erro ao consultar execução Apify: ${err.message || String(err)}`,
        500
      );
    }
  }

  /**
   * Fetches dataset items
   */
  public async getDatasetItems(token: string, datasetId: string, limit = 2000): Promise<any[]> {
    if (!token || !token.trim()) {
      throw new ApifyError("APIFY_NOT_CONFIGURED", "Token da Apify não configurado.", 400);
    }
    if (!datasetId || !datasetId.trim()) {
      throw new ApifyError("APIFY_DATASET_ERROR", "Dataset ID não fornecido.", 400);
    }

    const cleanToken = token.trim();
    const url = `https://api.apify.com/v2/datasets/${datasetId.trim()}/items?clean=true&format=json&limit=${limit}`;

    try {
      const resp = await this.fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new ApifyError(
          "APIFY_DATASET_ERROR",
          `Falha ao baixar dataset da Apify (HTTP ${resp.status}): ${errText}`,
          resp.status
        );
      }

      const items = await resp.json();
      if (!Array.isArray(items)) {
        throw new ApifyError(
          "APIFY_DATASET_ERROR",
          "Formato de dataset retornado não é um array válido.",
          500
        );
      }

      return items;
    } catch (err: any) {
      if (err instanceof ApifyError) throw err;
      throw new ApifyError(
        "APIFY_DATASET_ERROR",
        `Erro ao obter dados do dataset: ${err.message || String(err)}`,
        500
      );
    }
  }
}

export const apifyService = new ApifyService();
