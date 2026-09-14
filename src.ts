type Job = {
  id: string;
  status: "queued" | "running" | "done";
  callbackUrl?: string;
};

const jobs = new Map<string, Job>();

export function createJob(id: string, callbackUrl?: string): Job {
  const job: Job = { id, status: "queued", callbackUrl };
  jobs.set(id, job);
  return job;
}

export async function runJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;

  job.status = "running";
  await performWork(id);
  job.status = "done";

  if (job.callbackUrl) {
    await fetch(job.callbackUrl, {
      method: "POST",
      body: JSON.stringify(job),
    });
  }
}

export function listJobs(): Job[] {
  return [...jobs.values()];
}

async function performWork(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
  console.log(`finished ${id}`);
}
