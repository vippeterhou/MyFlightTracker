<script lang="ts">
	import FlightCard from '$lib/components/FlightCard.svelte';
	import { navHint } from '$lib/stores/navHint';
	import type { PageData } from './$types';
	import type { TrackedFlight } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let localFlights = $state<TrackedFlight[] | null>(null);
	const ACTIVE_STATUSES  = new Set(['boarding', 'departed', 'airborne', 'landed', 'delayed']);
	const PAST_STATUSES    = new Set(['arrived', 'cancelled', 'diverted']);

	function sortByDep(a: TrackedFlight, b: TrackedFlight) {
		const ta = a.status?.scheduledDep ? new Date(a.status.scheduledDep).getTime() : null;
		const tb = b.status?.scheduledDep ? new Date(b.status.scheduledDep).getTime() : null;
		if (ta === null && tb === null) return 0;
		if (ta === null) return -1;
		if (tb === null) return 1;
		return tb - ta;
	}

	let allFlights = $derived<TrackedFlight[]>(localFlights ?? (data.flights as TrackedFlight[]));
	let activeFlights   = $derived(allFlights.filter(f => ACTIVE_STATUSES.has(f.status?.status ?? '')).sort(sortByDep));
	let upcomingFlights = $derived(allFlights.filter(f => !ACTIVE_STATUSES.has(f.status?.status ?? '') && !PAST_STATUSES.has(f.status?.status ?? '')).sort(sortByDep));
	let pastFlights     = $derived(allFlights.filter(f => PAST_STATUSES.has(f.status?.status ?? '')).sort(sortByDep));
	let showForm = $state(false);
	let flightId = $state('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let label = $state('');
	let loading = $state(false);
	let formError = $state('');

	async function addFlight(e: SubmitEvent) {
		e.preventDefault();
		if (!flightId.trim() || !date) return;
		loading = true;
		formError = '';

		try {
			const res = await fetch('/api/flights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flightId, date, label }),
			});

			if (!res.ok) {
				const body = await res.json();
				formError = body.error ?? 'Failed to add flight';
				return;
			}

			const flight: TrackedFlight = await res.json();
			localFlights = [flight, ...allFlights];
			flightId = '';
			label = '';
			showForm = false;
		} catch {
			formError = 'Network error — please try again';
		} finally {
			loading = false;
		}
	}

	function removeFlight(id: string) {
		localFlights = allFlights.filter((f) => f.id !== id);
	}

	const POLL_INTERVAL_MS = 10 * 60 * 1000;
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	let nextRefresh = $derived(() => {
		if (!data.lastChecked) return null;
		const diff = new Date(data.lastChecked).getTime() + POLL_INTERVAL_MS - now;
		if (diff <= 0) return null;
		const m = Math.floor(diff / 60000);
		const s = Math.floor((diff % 60000) / 1000);
		return `${m}:${s.toString().padStart(2, '0')}`;
	});

	$effect(() => {
		const r = nextRefresh();
		if (r) navHint.set(`Next poll in ${r}`);
		else if (data.lastChecked) navHint.set('Refresh to update');
		else navHint.set(null);
		return () => navHint.set(null);
	});
</script>

<svelte:head>
	<title>MyFlightTracker</title>
</svelte:head>

<div class="page">
	<header>
		<button class="btn" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : '+ Track Flight'}
		</button>
	</header>

	{#if showForm}
		<form class="add-form" onsubmit={addFlight}>
			<input
				bind:value={flightId}
				placeholder="Flight ID (e.g. AA123)"
				class="input"
				required
				autocapitalize="characters"
			/>
			<input bind:value={date} type="date" class="input" required />
			<input
				bind:value={label}
				placeholder="Label — optional (e.g. Mom's flight)"
				class="input"
			/>
{#if formError}
				<p class="error">{formError}</p>
			{/if}
			<button type="submit" class="btn btn-submit" disabled={loading}>
				{loading ? 'Adding...' : 'Track'}
			</button>
		</form>
	{/if}

	{#if allFlights.length === 0}
		<div class="empty">
			<p>No flights being tracked.</p>
			<p>Click "Track Flight" to get started.</p>
		</div>
	{:else}
		{#each [{ label: 'Active', flights: activeFlights }, { label: 'Upcoming', flights: upcomingFlights }, { label: 'Past', flights: pastFlights }] as group}
			{#if group.flights.length > 0}
				<div class="group">
					<h2 class="group-label">{group.label}</h2>
					<div class="grid">
						{#each group.flights as flight (flight.id)}
							<FlightCard {flight} onDelete={removeFlight} />
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.page {}

	header {
		margin-bottom: 28px;
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 28px;
		max-width: 420px;
	}

	.input {
		padding: 10px 14px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 1rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.input:focus {
		border-color: #3b82f6;
	}

	.btn {
		padding: 10px 20px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.btn:hover {
		background: #2563eb;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-submit {
		align-self: flex-start;
	}

	.error {
		color: #ef4444;
		font-size: 0.875rem;
	}

	.group {
		margin-bottom: 32px;
	}

	.group-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #9ca3af;
		margin-bottom: 12px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
		align-items: stretch;
	}

	.empty {
		text-align: center;
		padding: 80px 20px;
		color: #9ca3af;
		line-height: 1.8;
	}
</style>
