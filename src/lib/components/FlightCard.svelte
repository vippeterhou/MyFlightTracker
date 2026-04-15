<script lang="ts">
	import type { TrackedFlight } from '$lib/types';

	let {
		flight,
		onDelete,
	}: {
		flight: TrackedFlight;
		onDelete: (id: string) => void;
	} = $props();

	const STATUS_COLOR: Record<string, string> = {
		scheduled: '#6b7280',
		boarding:  '#f59e0b',
		departed:  '#3b82f6',
		airborne:  '#3b82f6',
		landed:    '#10b981',
		arrived:   '#10b981',
		cancelled: '#ef4444',
		delayed:   '#f59e0b',
		diverted:  '#f97316',
	};

	let status = $derived(flight.status?.status ?? 'unknown');
	let color = $derived(STATUS_COLOR[status] ?? '#6b7280');

	let dateLabel = $derived(
		new Date(flight.date).toLocaleDateString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric',
		})
	);

	function fmtTime(d: string | null | undefined, tz?: string | null) {
		if (!d) return null;
		return new Date(d).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: tz ?? undefined,
		});
	}

	async function handleDelete(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm(`Stop tracking ${flight.flightId}?`)) return;
		await fetch(`/api/flights/${flight.id}`, { method: 'DELETE' });
		onDelete(flight.id);
	}

	function duration(a: string | null | undefined, b: string | null | undefined): string | null {
		if (!a || !b) return null;
		const ms = new Date(b).getTime() - new Date(a).getTime();
		if (ms <= 0) return null;
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		return `${h}h ${m}m`;
	}

	let info = $derived((): { label: string; value: string } | null => {
		const s = flight.status;
		if (!s) return null;
		switch (status) {
			case 'scheduled':
			case 'boarding':
			case 'delayed': {
				const t = fmtTime(s.estimatedDep ?? s.scheduledDep, s.departureTz);
				return t ? { label: 'ETD', value: t } : null;
			}
			case 'departed':
			case 'airborne': {
				const t = fmtTime(s.estimatedArr ?? s.scheduledArr, s.arrivalTz);
				return t ? { label: 'ETA', value: t } : null;
			}
			case 'landed': {
				const t = fmtTime(s.estimatedArr ?? s.scheduledArr, s.arrivalTz);
				return t ? { label: 'Gate', value: t } : null;
			}
			case 'arrived': {
				const dur = duration(s.actualDep, s.actualArr);
				return dur ? { label: 'Total', value: dur } : null;
			}
			default:
				return null;
		}
	});
</script>

<div class="card-wrap">
	<a href="/flights/{flight.id}" class="card">
		<div class="top">
			<div class="left">
				<span class="flight-id">{flight.flightId}</span>
				{#if flight.label}
					<span class="label">{flight.label}</span>
				{/if}
			</div>
			<span class="status" style="color: {color}">
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</span>
		</div>

		{#if flight.status?.departureAirport}
			<div class="route">
				{flight.status.departureAirport} → {flight.status.arrivalAirport ?? '?'}
			</div>
		{/if}

		<div class="date">{dateLabel}</div>

		{#if info()}
			<div class="eta"><span class="eta-label">{info()!.label}</span> {info()!.value}</div>
		{/if}
	</a>
	<button class="delete" onclick={handleDelete} aria-label="Remove flight">×</button>
</div>

<style>
	.card-wrap {
		position: relative;
		height: 100%;
	}

	.card {
		display: block;
		height: 100%;
		min-height: 96px;
		padding: 16px 18px;
		padding-right: 40px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		transition: box-shadow 0.15s;
		cursor: pointer;
	}

	.card:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
	}

	.left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.flight-id {
		font-size: 1.25rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.label {
		font-size: 0.8rem;
		color: #9ca3af;
	}

	.status {
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.route {
		font-size: 0.9rem;
		color: #374151;
		font-weight: 500;
	}

	.date {
		font-size: 0.8rem;
		color: #9ca3af;
		margin-top: 2px;
	}

	.eta {
		font-size: 0.8rem;
		color: #6b7280;
		margin-top: 4px;
	}

	.eta-label {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.7rem;
	}

	.delete {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		font-size: 1.1rem;
		color: #d1d5db;
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 4px;
		transition: color 0.15s;
		line-height: 1;
		z-index: 1;
	}

	.delete:hover {
		color: #ef4444;
	}
</style>
