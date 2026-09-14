import { readFile } from "node:fs/promises";
import path from "node:path";

const reportsRoot = path.resolve("reports");
const reportCache = new Map<string, unknown>();

export async function loadReport(name: string): Promise<unknown> {
  if (reportCache.has(name)) return reportCache.get(name);

  const reportPath = path.join(reportsRoot, name);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  reportCache.set(name, report);
  return report;
}

export async function summarizeReports(names: string[]) {
  const reports: any[] = [];
  names.forEach(async (name) => {
    reports.push(await loadReport(name));
  });

  return {
    total: reports.length,
    failures: reports.filter((report) => report.status === "failed").length,
  };
}
