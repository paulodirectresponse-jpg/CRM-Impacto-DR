import type { AcceptanceTestResult } from "../src/types";
import { normalizeInstagramInput } from "../src/utils/instagramUtils";
import { getSaoPauloDateString } from "../src/utils/dateUtils";

/**
 * Read-only acceptance diagnostics.
 * This module intentionally does not import the production store and never writes
 * to Firestore, Apify or OpenAI. Live integration tests must be executed explicitly
 * outside production with dedicated test infrastructure.
 */
export async function runSuite(): Promise<AcceptanceTestResult[]> {
  const results: AcceptanceTestResult[] = [];
  const run = async (id: number, scenario: string, expectedResult: string, fn: () => void | Promise<void>) => {
    const started = Date.now();
    const logs: string[] = [];
    try {
      await fn();
      results.push({ id, scenario, expectedResult, status: "passed", logs, executionTimeMs: Date.now() - started });
    } catch (err: any) {
      logs.push(err?.message || String(err));
      results.push({ id, scenario, expectedResult, status: "failed", logs, details: err?.message || String(err), executionTimeMs: Date.now() - started });
    }
  };

  await run(1, "Normalização de @handle", "Username normalizado corretamente", () => {
    const r = normalizeInstagramInput("  @DR.ALEXANDRE  ");
    if (!r.isValid || r.username !== "dr.alexandre") throw new Error("Falha na normalização de handle.");
  });

  await run(2, "Normalização de URL Instagram", "URL canônica aceita", () => {
    const r = normalizeInstagramInput("https://www.instagram.com/exemplo/?igsh=abc");
    if (!r.isValid || r.username !== "exemplo") throw new Error("Falha na normalização de URL.");
  });

  await run(3, "Rejeição de URL externa", "URL fora do Instagram rejeitada", () => {
    const r = normalizeInstagramInput("https://google.com/teste");
    if (r.isValid) throw new Error("URL externa foi aceita incorretamente.");
  });

  await run(4, "Timezone operacional", "Data de São Paulo produzida", () => {
    const d = getSaoPauloDateString(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Data São Paulo inválida.");
  });

  return results;
}
