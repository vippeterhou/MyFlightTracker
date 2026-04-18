const FLY_API = 'https://api.machines.dev/v1';

export async function startWorker() {
	const token = process.env.FLY_API_TOKEN;
	const app = process.env.FLY_WORKER_APP;
	if (!token || !app) return; // not configured (dev environment)

	const res = await fetch(`${FLY_API}/apps/${app}/machines`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`Fly API list machines error: ${res.status}`);

	const machines: { id: string; state: string }[] = await res.json();
	for (const machine of machines) {
		if (machine.state === 'stopped') {
			await fetch(`${FLY_API}/apps/${app}/machines/${machine.id}/start`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			});
			console.log(`[flyio] started worker machine ${machine.id}`);
		}
	}
}
