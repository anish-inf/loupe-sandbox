type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "callback_failed";
  callbackUrl?: string;
  error?: string;
};

const jobs = new Map<string, Job>();

const ALLOWED_CALLBACK_HOSTS = new Set<string>(
  (process.env.JOB_CALLBACK_ALLOWLIST ?? "").split(",").filter(Boolean),
);
const CALLBACK_TIMEOUT_MS = 5_000;

function validateCallbackUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error(`callback URL must use https: ${raw}`);
  }
  if (!ALLOWED_CALLBACK_HOSTS.has(url.hostname)) {
    throw new Error(`callback host not allowlisted: ${url.hostname}`);
  }
  return url;
}

export function createJob(id: string, callbackUrl?: string): Job {
  if (jobs.has(id)) {
    throw new Error(`job already exists: ${id}`);
  }
  if (callbackUrl !== undefined) {
    validateCallbackUrl(callbackUrl);
  }
  const job: Job = { id, status: "queued", callbackUrl };
  jobs.set(id, job);
  return job;
}

export async function runJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  if (job.status !== "queued") return;

  job.status = "running";
  try {
    await performWork(id);
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    throw err;
  }

  if (job.callbackUrl) {
    try {
      const url = validateCallbackUrl(job.callbackUrl);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id, status: job.status }),
        signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`callback returned ${response.status}`);
      }
    } catch (err) {
      job.status = "callback_failed";
      job.error = err instanceof Error ? err.message : String(err);
    }
  }

  // Evict the finished job so the map doesn't grow unboundedly.
  jobs.delete(id);
}

export function listJobs(): Job[] {
  return [...jobs.values()].map((job) => ({ ...job }));
}

async function performWork(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  console.log(`finished ${id}`);
}
