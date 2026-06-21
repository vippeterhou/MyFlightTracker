<script lang="ts">
	import { onDestroy } from 'svelte';
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

	function duration(a: string | null | undefined, b: string | null | undefined): string | null {
		if (!a || !b) return null;
		const ms = new Date(b).getTime() - new Date(a).getTime();
		if (ms <= 0) return null;
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		return `${h}h ${m}m`;
	}

	async function handleDelete(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm(`Stop tracking ${flight.flightId}?`)) return;
		await fetch(`/api/flights/${flight.id}`, { method: 'DELETE' });
		onDelete(flight.id);
	}

	let schedDep = $derived(fmtTime(flight.status?.scheduledDep, flight.status?.departureTz));
	let schedArr = $derived(fmtTime(flight.status?.scheduledArr, flight.status?.arrivalTz));
	let actDep = $derived(fmtTime(flight.status?.actualDep, flight.status?.departureTz));
	let actArr = $derived(fmtTime(flight.status?.actualArr, flight.status?.arrivalTz));
	let totalDur = $derived(duration(flight.status?.actualDep, flight.status?.actualArr));

	let hasTrack = $derived.by(() => {
		const td = flight.status?.trackData;
		return Array.isArray(td) && td.length >= 2;
	});

	let mapEl = $state<HTMLDivElement | undefined>(undefined);
	let miniMap: import('leaflet').Map | undefined;

	function normalizeTrack(track: { lat: number; lon: number }[]): [number, number][] {
		return track.reduce<[number, number][]>((acc, p) => {
			let lng = p.lon;
			if (acc.length > 0) {
				const prevLng = acc[acc.length - 1][1];
				while (lng - prevLng > 180) lng -= 360;
				while (lng - prevLng < -180) lng += 360;
			}
			acc.push([p.lat, lng]);
			return acc;
		}, []);
	}

	$effect(() => {
		if (!mapEl || !hasTrack) return;

		let mounted = true;

		(async () => {
			const [{ default: L }] = await Promise.all([
				import('leaflet'),
				import('leaflet/dist/leaflet.css'),
			]);

			if (!mounted || !mapEl) return;

			miniMap = L.map(mapEl, {
				zoomControl: false,
				attributionControl: false,
				dragging: false,
				scrollWheelZoom: false,
				doubleClickZoom: false,
				touchZoom: false,
				boxZoom: false,
				keyboard: false,
			});

			L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
				maxZoom: 19,
			}).addTo(miniMap);

			const track = flight.status!.trackData as { lat: number; lon: number }[];
			const latlngs = normalizeTrack(track);

			L.polyline(latlngs, { color, weight: 2.5, opacity: 0.8 }).addTo(miniMap);
			L.circleMarker(latlngs[0], { radius: 3, color, fillColor: color, fillOpacity: 1, weight: 0 }).addTo(miniMap);
			L.circleMarker(latlngs[latlngs.length - 1], { radius: 3, color, fillColor: color, fillOpacity: 1, weight: 0 }).addTo(miniMap);

			miniMap.fitBounds(latlngs, { padding: [12, 12] });
		})();

		return () => {
			mounted = false;
			miniMap?.remove();
			miniMap = undefined;
		};
	});

	onDestroy(() => {
		miniMap?.remove();
		miniMap = undefined;
	});
</script>

<div class="card-wrap">
	<a href="/flights/{flight.id}" class="card">
		{#if hasTrack}
			<div class="map-col">
				<div class="mini-map" bind:this={mapEl}></div>
			</div>
		{/if}
		<div class="info-col">
			<div class="group-top">
				<div class="top">
					<span class="flight-id">{flight.flightId}</span>
					{#if flight.label}
						<span class="label">· {flight.label}</span>
					{/if}
				</div>

				<div class="route-row">
					{#if flight.status?.departureAirport}
						<span class="route">{flight.status.departureAirport} → {flight.status.arrivalAirport ?? '?'}</span>
					{/if}
					<span class="status" style="color: {color}">
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</span>
				</div>

				{#if flight.status?.departureCity || flight.status?.arrivalCity}
					<span class="city">{flight.status?.departureCity ?? ''} → {flight.status?.arrivalCity ?? ''}</span>
				{/if}
			</div>

			<div class="group-bottom">
				<div class="date">{dateLabel}</div>

				<div class="times">
					{#if schedDep || schedArr}
						<div class="time-row">
							<span class="time-label">Sched</span>
							<span class="time-value">{schedDep ?? '—'} → {schedArr ?? '—'}</span>
						</div>
					{/if}
					{#if actDep || actArr}
						<div class="time-row">
							<span class="time-label">Actual</span>
							<span class="time-value">{actDep ?? '—'} → {actArr ?? '—'}</span>
						</div>
					{/if}
					{#if totalDur}
						<div class="time-row">
							<span class="time-label">Total</span>
							<span class="time-value">{totalDur}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
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
		gap: 0;
		height: 100%;
		min-height: 200px;
		padding: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		transition: box-shadow 0.15s;
		cursor: pointer;
	}

	.card:hover {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
	}

	.map-col {
		flex: 1;
		min-width: 0;
	}

	.mini-map {
		width: 100%;
		height: 100%;
		border-radius: 11px 0 0 11px;
		border-right: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.info-col {
		flex-shrink: 0;
		width: 340px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 18px 20px;
		min-width: 0;
	}

	.group-top {
		display: flex;
		flex-direction: column;
		gap: 2px;
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

	.route {
		font-size: 0.9rem;
		color: #374151;
		font-weight: 500;
	}

	.status {
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-left: auto;
		flex-shrink: 0;
	}

	.city {
		font-size: 0.8rem;
		color: #9ca3af;
	}

	.group-bottom {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.date {
		font-size: 0.82rem;
		color: #9ca3af;
	}

	.times {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.time-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.time-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #9ca3af;
		min-width: 42px;
	}

	.time-value {
		font-size: 0.82rem;
		color: #6b7280;
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
