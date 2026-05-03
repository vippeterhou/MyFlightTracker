<script lang="ts">
	import FlightTimeline from '$lib/components/FlightTimeline.svelte';
	import type { PageData } from './$types';
	import type { TrackedFlight } from '$lib/types';

	let { data }: { data: PageData } = $props();
	let flight = $derived(data.flight as TrackedFlight);

	function formatDate(d: string) {
		return new Date(d).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		});
	}

	function formatTime(d: string | null | undefined, tz?: string | null) {
		if (!d) return '—';
		return new Date(d).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: tz ?? undefined,
		});
	}
</script>

<svelte:head>
	<title>{flight.flightId} — MyFlightTracker</title>
</svelte:head>

<div class="page">
	<a href="/" class="back">← All flights</a>

	<div class="header">
		<div>
			<h1>{flight.flightId}</h1>
			{#if flight.label}
				<p class="label">{flight.label}</p>
			{/if}
			<p class="date">{formatDate(flight.date)}</p>
		</div>

		{#if flight.status}
			<div class="airports">
				<span class="iata">{flight.status.departureAirport ?? '?'}</span>
				<span class="arrow">→</span>
				<span class="iata">{flight.status.arrivalAirport ?? '?'}</span>
			</div>
		{/if}
	</div>

	<div class="content">
		<section class="card">
			<h2>Status</h2>
			<FlightTimeline status={flight.status} />
		</section>

		{#if flight.status}
			<section class="card">
				<h2>Details</h2>
				<div class="detail-block">
					{#if flight.status.scheduledDep}
						<div class="detail-row">
							<span>Scheduled dep.</span>
							<span>{formatTime(flight.status.scheduledDep, flight.status.departureTz)}</span>
						</div>
					{/if}
					{#if flight.status.estimatedArr || flight.status.scheduledArr}
						<div class="detail-row">
							<span>Est. arrival</span>
							<span>{formatTime(flight.status.estimatedArr ?? flight.status.scheduledArr, flight.status.arrivalTz)}</span>
						</div>
					{/if}
					{#if flight.status.departureGate}
						<div class="detail-row">
							<span>Dep. gate</span>
							<span>{flight.status.departureGate}</span>
						</div>
					{/if}
					{#if flight.status.arrivalGate}
						<div class="detail-row">
							<span>Arr. gate</span>
							<span>{flight.status.arrivalGate}</span>
						</div>
					{/if}
					{#if flight.status.baggageClaim}
						<div class="detail-row">
							<span>Baggage</span>
							<span>{flight.status.baggageClaim}</span>
						</div>
					{/if}
					{#if flight.status.aircraftType}
						<div class="detail-row">
							<span>Aircraft</span>
							<span>{flight.status.aircraftType}</span>
						</div>
					{/if}
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.back {
		display: inline-block;
		margin-bottom: 20px;
		color: #6b7280;
		font-size: 0.9rem;
		transition: color 0.15s;
	}

	.back:hover {
		color: #111827;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
		flex-wrap: wrap;
		gap: 16px;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.label {
		color: #6b7280;
		margin-top: 4px;
	}

	.date {
		color: #9ca3af;
		font-size: 0.875rem;
		margin-top: 4px;
	}

	.airports {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.iata {
		font-size: 1.75rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.arrow {
		color: #9ca3af;
		font-size: 1.5rem;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 480px;
	}

	.card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
	}

	h2 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #9ca3af;
		margin-bottom: 16px;
	}

	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 5px 0;
		font-size: 0.875rem;
	}

	.detail-row span:first-child {
		color: #6b7280;
	}

	.detail-row span:last-child {
		font-weight: 500;
	}
</style>
