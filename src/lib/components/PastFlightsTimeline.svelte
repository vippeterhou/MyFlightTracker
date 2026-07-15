<script lang="ts">
	import FlightCardExpanded from './FlightCardExpanded.svelte';
	import type { TrackedFlight } from '$lib/types';
	import { flightDateLabel, flightDayISO } from '$lib/dateFormat';

	let {
		flights,
		onDelete,
	}: {
		flights: TrackedFlight[];
		onDelete: (id: string) => void;
	} = $props();

	const STATUS_COLOR: Record<string, string> = {
		arrived:   '#10b981',
		cancelled: '#ef4444',
		diverted:  '#f97316',
	};

	interface MonthGroup {
		key: string;
		label: string;
		flights: TrackedFlight[];
	}

	let grouped = $derived.by((): MonthGroup[] => {
		const map = new Map<string, TrackedFlight[]>();
		for (const f of flights) {
			const [year, month] = flightDayISO(f).split('-');
			const key = `${year}-${month}`;
			const existing = map.get(key);
			if (existing) existing.push(f);
			else map.set(key, [f]);
		}
		return Array.from(map.entries()).map(([key, fls]) => {
			return {
				key,
				label: flightDateLabel(fls[0], { month: 'long', year: 'numeric' }),
				flights: fls,
			};
		});
	});

	function gapFor(prev: TrackedFlight, curr: TrackedFlight): number {
		const prevMs = new Date(`${flightDayISO(prev)}T00:00:00Z`).getTime();
		const currMs = new Date(`${flightDayISO(curr)}T00:00:00Z`).getTime();
		const days = Math.abs(prevMs - currMs) / 86400000;
		return Math.min(Math.max(days * 3, 6), 40);
	}
</script>

<div class="timeline-scroll">
	<div class="timeline">
		{#each grouped as group (group.key)}
			<div class="month-marker">
				<div class="month-dot"></div>
				<span class="month-label">{group.label}</span>
			</div>

			{#each group.flights as flight, i (flight.id)}
				{@const status = flight.status?.status ?? 'unknown'}
				{@const color = STATUS_COLOR[status] ?? '#6b7280'}
				{@const gap = i > 0 ? gapFor(group.flights[i - 1], flight) : 6}

				<div class="flight-entry" style="padding-top: {gap}px; padding-bottom: {gap}px">
					<div class="flight-dot" style="background: {color}"></div>
					<div class="flight-card-wrap">
						<FlightCardExpanded {flight} {onDelete} />
					</div>
				</div>
			{/each}
		{/each}
	</div>
</div>

<style>
	.timeline-scroll {
		padding-right: 4px;
	}

	.timeline {
		position: relative;
		padding-left: 28px;
	}

	.timeline::before {
		content: '';
		position: absolute;
		left: 7px;
		top: 4px;
		bottom: 4px;
		width: 2px;
		background: #e5e7eb;
		border-radius: 1px;
	}

	.month-marker {
		position: relative;
		display: flex;
		align-items: center;
		padding: 12px 0 8px;
	}

	.month-marker:first-child {
		padding-top: 0;
	}

	.month-dot {
		position: absolute;
		left: -28px;
		width: 16px;
		height: 16px;
		background: #111827;
		border-radius: 50%;
		border: 3px solid white;
		box-shadow: 0 0 0 2px #d1d5db;
		z-index: 1;
	}

	.month-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #111827;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.flight-entry {
		position: relative;
	}

	.flight-dot {
		position: absolute;
		left: -24px;
		top: 50%;
		transform: translateY(-50%);
		width: 8px;
		height: 8px;
		border-radius: 50%;
		z-index: 1;
	}

	.flight-card-wrap {
		width: 100%;
	}
</style>
