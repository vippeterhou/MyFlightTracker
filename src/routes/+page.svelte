<script lang="ts">
	import { browser } from '$app/environment';
	import FlightCard from '$lib/components/FlightCard.svelte';
	import PastFlightsTimeline from '$lib/components/PastFlightsTimeline.svelte';
	import type { PageData } from './$types';
	import type { TrackedFlight } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let localFlights = $state<TrackedFlight[] | null>(null);
	type PastView = 'grid' | 'timeline';
	let pastView = $state<PastView>(
		(browser && sessionStorage.getItem('pastView') as PastView) || 'grid'
	);

	function setPastView(view: PastView) {
		pastView = view;
		sessionStorage.setItem('pastView', view);
	}
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

	interface FlightCandidate {
		id: string;
		departureAirport: string | null;
		arrivalAirport: string | null;
		scheduledDep: string | null;
		scheduledArr: string | null;
		departureTz: string | null;
		arrivalTz: string | null;
	}

	let candidates = $state<FlightCandidate[]>([]);

	async function addFlight(e: SubmitEvent) {
		e.preventDefault();
		await submitFlight();
	}

	async function submitFlight(selectedCandidateId?: string) {
		if (!flightId.trim() || !date) return;
		loading = true;
		formError = '';

		try {
			const res = await fetch('/api/flights', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ flightId, date, label, selectedCandidateId }),
			});

			const body = await res.json();
			if (res.status === 409 && body.requiresSelection) {
				candidates = body.candidates;
				return;
			}

			if (!res.ok) {
				formError = body.error ?? 'Failed to add flight';
				return;
			}

			const flight = body as TrackedFlight;
			localFlights = [flight, ...allFlights];
			flightId = '';
			label = '';
			candidates = [];
			showForm = false;
		} catch {
			formError = 'Network error — please try again';
		} finally {
			loading = false;
		}
	}

	function clearCandidates() {
		candidates = [];
		formError = '';
	}

	function formatCandidateTime(value: string | null, tz: string | null): string {
		if (!value) return '—';
		const time = new Date(value).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			timeZone: tz ?? 'UTC',
		});
		return tz ? time : `${time} UTC`;
	}

	function removeFlight(id: string) {
		localFlights = allFlights.filter((f) => f.id !== id);
	}

</script>

<svelte:head>
	<title>Flight Tracker</title>
</svelte:head>

<div class="page">
	<header>
		<div class="intro">
			<p class="tagline">Track flights before your departure. Get notified from gate to gate on every status change — departed, airborne, landed, and more.</p>
		</div>
		<button class="btn" onclick={() => (showForm = !showForm)}>
			{showForm ? 'Cancel' : '+ Track Flight'}
		</button>
	</header>

	{#if showForm}
		<form class="add-form" onsubmit={addFlight}>
			<input
				bind:value={flightId}
				oninput={clearCandidates}
				placeholder="Flight ID (e.g. AA123)"
				class="input"
				required
				autocapitalize="characters"
			/>
			<input bind:value={date} oninput={clearCandidates} type="date" class="input" required />
			<input
				bind:value={label}
				placeholder="Label — optional (e.g. Mom's flight)"
				class="input"
			/>
			{#if formError}
				<p class="error">{formError}</p>
			{/if}
			{#if candidates.length > 1}
				<div class="candidate-picker">
					<p class="candidate-title">Choose the flight segment:</p>
					{#each candidates as candidate (candidate.id)}
						<button
							type="button"
							class="candidate"
							disabled={loading}
							onclick={() => submitFlight(candidate.id)}
						>
							<span class="candidate-route">
								{candidate.departureAirport ?? '?'} → {candidate.arrivalAirport ?? '?'}
							</span>
							<span class="candidate-time">
								{formatCandidateTime(candidate.scheduledDep, candidate.departureTz)}
								–
								{formatCandidateTime(candidate.scheduledArr, candidate.arrivalTz)}
							</span>
						</button>
					{/each}
				</div>
			{:else}
				<button type="submit" class="btn btn-submit" disabled={loading}>
					{loading ? 'Looking up...' : 'Track'}
				</button>
			{/if}
		</form>
	{/if}

	{#if allFlights.length === 0}
		<div class="empty">
			<p>No flights being tracked.</p>
			<p>Click "Track Flight" to get started.</p>
		</div>
	{:else}
		{#each [{ label: 'Active', flights: activeFlights }, { label: 'Upcoming', flights: upcomingFlights }] as group}
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

		{#if pastFlights.length > 0}
			<div class="group">
				<div class="group-header">
					<h2 class="group-label">Past</h2>
					<div class="view-toggle">
						<button class="view-btn" class:active={pastView === 'grid'} onclick={() => setPastView('grid')} aria-label="Grid view">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="3" width="7" height="7"></rect>
								<rect x="14" y="3" width="7" height="7"></rect>
								<rect x="3" y="14" width="7" height="7"></rect>
								<rect x="14" y="14" width="7" height="7"></rect>
							</svg>
						</button>
						<button class="view-btn" class:active={pastView === 'timeline'} onclick={() => setPastView('timeline')} aria-label="Timeline view">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="8" y1="6" x2="21" y2="6"></line>
								<line x1="8" y1="12" x2="21" y2="12"></line>
								<line x1="8" y1="18" x2="21" y2="18"></line>
								<line x1="3" y1="6" x2="3.01" y2="6"></line>
								<line x1="3" y1="12" x2="3.01" y2="12"></line>
								<line x1="3" y1="18" x2="3.01" y2="18"></line>
							</svg>
						</button>
					</div>
				</div>
				{#if pastView === 'grid'}
					<div class="grid">
						{#each pastFlights as flight (flight.id)}
							<FlightCard {flight} onDelete={removeFlight} />
						{/each}
					</div>
				{:else}
					<PastFlightsTimeline flights={pastFlights} onDelete={removeFlight} />
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	header {
		margin-bottom: 28px;
	}

	.intro {
		display: flex;
		justify-content: center;
		margin-bottom: 20px;
	}

	.tagline {
		font-size: 0.95rem;
		color: #6b7280;
		max-width: 480px;
		line-height: 1.6;
		text-align: center;
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

	.candidate-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.candidate-title {
		margin: 0 0 2px;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
	}

	.candidate {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		padding: 11px 12px;
		background: #f9fafb;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		color: #111827;
		cursor: pointer;
		text-align: left;
	}

	.candidate:hover {
		border-color: #3b82f6;
		background: #eff6ff;
	}

	.candidate:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.candidate-route {
		font-weight: 600;
	}

	.candidate-time {
		color: #6b7280;
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.group {
		margin-bottom: 32px;
	}

	.group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.group-header .group-label {
		margin-bottom: 0;
	}

	.view-toggle {
		display: flex;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		overflow: hidden;
	}

	.view-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 26px;
		background: white;
		border: none;
		cursor: pointer;
		color: #9ca3af;
		transition: all 0.15s;
	}

	.view-btn:first-child {
		border-right: 1px solid #e5e7eb;
	}

	.view-btn:hover {
		color: #374151;
	}

	.view-btn.active {
		background: #111827;
		color: white;
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
