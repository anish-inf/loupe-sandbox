import { readFile } from "node:fs/promises";
import path from "node:path";

const reportsRoot = path.resolve("reports");

export interface Report {
  status?: string;
}

const MAX_CACHE_ENTRIES = 100;
// Stores in-flight promises so concurrent loads of the same report dedupe.
const reportCache = new Map<string, Promise<Report>>();

function isReport(value: unknown): value is Report {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveReportPath(name: string): string {
  if (name.includes("..") || path.isAbsolute(name) || name.includes("/") || name.includes("\\")) {
    throw new Error(`Invalid report name: ${name}`);
  }
  const reportPath = path.resolve(reportsRoot, name);
  if (!reportPath.startsWith(reportsRoot + path.sep)) {
    throw new Error(`Invalid report name: ${name}`);
  }
  return reportPath;
}

export async function loadReport(name: string): Promise<Report> {
  const cached = reportCache.get(name);
  if (cached) return cached;

  const promise = (async (): Promise<Report> => {
    const reportPath = resolveReportPath(name);
    const parsed: unknown = JSON.parse(await readFile(reportPath, "utf8"));
    if (!isReport(parsed)) throw new Error(`Report is not an object: ${name}`);
    return parsed;
  })();

  // Simple LRU: refresh position, evict oldest entry when over capacity.
  reportCache.set(name, promise);
  if (reportCache.size > MAX_CACHE_ENTRIES) {
    const oldest = reportCache.keys().next().value!;
    if (oldest !== name) reportCache.delete(oldest);
  }

  try {
    return await promise;
  } catch (error) {
    // Don't cache failures so a transient error doesn't poison the cache.
    reportCache.delete(name);
    throw error;
  }
}

export async function summarizeReports(names: string[]) {
  const results = await Promise.allSettled(names.map((name) => loadReport(name)));

  let total = 0;
  let failures = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      total += 1;
      if (result.value.status === "failed") failures += 1;
    }
  }

  return { total, failures };
}
