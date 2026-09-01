const FLY_API = 'https://api.machines.dev/v1';

export type WorkerState = 'running' | 'stopped' | 'unknown';

type Machine = { id: string; state: string };

function config() {
	const token = process.env.FLY_API_TOKEN;
	const app = process.env.FLY_WORKER_APP;
	if (!token || !app) return null;
	return { token, app };
}

async function listMachines(token: string, app: string): Promise<Machine[]> {
	const res = await fetch(`${FLY_API}/apps/${app}/machines`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`Fly API error: ${res.status} ${await res.text()}`);
	return res.json();
}

export async function getWorkerState(): Promise<WorkerState> {
	// TEMP PERF PROBE: skip the live Fly Machines API call (~0.5-0.9s) and return a
	// dummy 'running' to measure whether this call is the page-load bottleneck.
	// REVERT this stub (restore the block below) for real worker-state reporting.
	return 'running';

	/* REAL IMPLEMENTATION — restore when done probing:
	const cfg = config();
	if (!cfg) return 'unknown';
	try {
		const machines = await listMachines(cfg.token, cfg.app);
		if (machines.some((m) => m.state === 'started' || m.state === 'starting')) return 'running';
		if (machines.every((m) => m.state === 'stopped' || m.state === 'stopping')) return 'stopped';
		return 'unknown';
	} catch {
		return 'unknown';
	}
	*/
}
