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

	let info = $derived.by((): { label: string; value: string } | null => {
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
			<span class="flight-id">{flight.flightId}</span>
			{#if flight.label}
				<span class="label">· {flight.label}</span>
			{/if}
		</div>

		<div class="route-row">
			{#if flight.status?.departureAirport}
				<span class="route">
					{flight.status.departureAirport} → {flight.status.arrivalAirport ?? '?'}
				</span>
			{/if}
			<span class="status" style="color: {color}">
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</span>
		</div>

		<div class="date">{dateLabel}</div>

		{#if info}
			<div class="info">
				<span class="eta"><span class="eta-label">{info.label}</span> {info.value}</span>
			</div>
		{/if}
	</a>
	<button class="delete" onclick={handleDelete} aria-label="Remove flight">
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
			<path d="M10 11v6M14 11v6" />
		</svg>
	</button>
</div>

<style>
	.card-wrap {
		position: relative;
		height: 100%;
	}

	.card {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 96px;
		padding: 16px 18px;
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
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
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

	.route-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 2px;
	}

	.status {
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-left: auto;
		flex-shrink: 0;
	}

	.route {
		font-size: 0.9rem;
		color: #374151;
		font-weight: 500;
	}

	.info {
		padding-top: 0;
	}

	.date {
		font-size: 0.8rem;
		color: #6b7280;
		margin-top: 2px;
	}

	.eta {
		font-size: 0.8rem;
		color: #6b7280;
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
		color: #9ca3af;
		cursor: pointer;
		padding: 5px;
		border-radius: 4px;
		transition: opacity 0.15s, color 0.15s, background 0.15s;
		line-height: 0;
		z-index: 1;
		opacity: 0;
	}

	.card-wrap:hover .delete {
		opacity: 1;
	}

	.delete:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
	}
</style>
