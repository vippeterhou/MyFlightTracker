<script lang="ts">
	import FlightTimeline from '$lib/components/FlightTimeline.svelte';
	import type { PageData } from './$types';
	import type { TrackedFlight } from '$lib/types';
	import type { TrackPoint } from '$lib/server/aeroapi';

	let { data }: { data: PageData } = $props();
	let flight = $derived(data.flight as TrackedFlight);

	const MAP_STATUSES = new Set(['departed', 'airborne', 'landed', 'arrived', 'diverted']);
	let showMap = $derived(MAP_STATUSES.has(flight.status?.status ?? ''));

	let track = $state<TrackPoint[]>([]);
	let trackLoading = $state(true);

	$effect(() => {
		trackLoading = true;
		Promise.resolve(data.track as Promise<TrackPoint[]> | TrackPoint[]).then((t) => {
			track = t;
			trackLoading = false;
		});
	});

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

	const LAYERS = [
		{
			id: 'default',
			label: 'Default',
			thumb: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/2/1/1.png',
		},
		{
			id: 'terrain',
			label: 'Terrain',
			thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/2/1/1',
		},
		{
			id: 'satellite',
			label: 'Satellite',
			thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/2/1/1',
		},
	];

	let mapEl = $state<HTMLDivElement | undefined>(undefined);
	let activeLayerId = $state('default');
	let layerOpen = $state(false);

	// Non-reactive refs for Leaflet objects (mutated inside async, not tracked by Svelte)
	let leafletInst: import('leaflet').Map | undefined;
	let tileLayers: Record<string, import('leaflet').TileLayer> = {};

	function switchLayer(id: string) {
		if (!leafletInst) return;
		Object.values(tileLayers).forEach((l) => leafletInst!.removeLayer(l));
		tileLayers[id]?.addTo(leafletInst);
		activeLayerId = id;
		layerOpen = false;
	}

	$effect(() => {
		if (!mapEl || track.length === 0) return;

		let mounted = true;

		(async () => {
			const [{ default: L }] = await Promise.all([
				import('leaflet'),
				import('leaflet/dist/leaflet.css'),
			]);

			if (!mounted || !mapEl) return;

			leafletInst = L.map(mapEl).setView([track[0].lat, track[0].lon], 5);

			tileLayers = {
				default: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
					attribution: '© CARTO', maxZoom: 19,
				}),
				terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
					attribution: 'Tiles © Esri', maxZoom: 19,
				}),
				satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
					attribution: 'Tiles © Esri', maxZoom: 19,
				}),
			};

			tileLayers[activeLayerId].addTo(leafletInst);

			// Normalize longitudes to fix antimeridian crossing (e.g. 170° → -170° jump)
			const latlngs = track.reduce<[number, number][]>((acc, p) => {
				let lng = p.lon;
				if (acc.length > 0) {
					const prevLng = acc[acc.length - 1][1];
					while (lng - prevLng > 180) lng -= 360;
					while (lng - prevLng < -180) lng += 360;
				}
				acc.push([p.lat, lng]);
				return acc;
			}, []);
			L.polyline(latlngs, { color: '#3b82f6', weight: 2.5, opacity: 0.8 }).addTo(leafletInst);
			leafletInst.fitBounds(latlngs, { padding: [32, 32] });

			L.circleMarker(latlngs[0], {
				radius: 5,
				color: '#22c55e',
				fillColor: '#22c55e',
				fillOpacity: 1,
				weight: 0,
			}).addTo(leafletInst);

			const last = track[track.length - 1];
			const planeIcon = L.divIcon({
				html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 72" width="40" height="52"
					style="transform:rotate(${last.heading}deg);filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));display:block">
					<defs>
						<linearGradient id="pg-body" x1="0.2" y1="0" x2="0.8" y2="1">
							<stop offset="0%" stop-color="#f8fafc"/>
							<stop offset="50%" stop-color="#e2e8f0"/>
							<stop offset="100%" stop-color="#b0bec5"/>
						</linearGradient>
						<linearGradient id="pg-wing" x1="0" y1="0.5" x2="1" y2="0.5">
							<stop offset="0%" stop-color="#90a4ae"/>
							<stop offset="35%" stop-color="#ecf0f1"/>
							<stop offset="65%" stop-color="#ecf0f1"/>
							<stop offset="100%" stop-color="#90a4ae"/>
						</linearGradient>
						<linearGradient id="pg-eng" x1="0.5" y1="0" x2="0.5" y2="1">
							<stop offset="0%" stop-color="#78909c"/>
							<stop offset="100%" stop-color="#263238"/>
						</linearGradient>
					</defs>

					<!-- Engines (drawn before wings so wings overlap them) -->
					<!-- Left outer engine -->
					<path d="M 8 33 A 3 3 0 0 1 14 33 L 12.5 41.5 A 1.5 1.5 0 0 1 9.5 41.5 Z"
						fill="url(#pg-eng)" stroke="#607d8b" stroke-width="0.55"/>
					<!-- Left inner engine -->
					<path d="M 16 29 A 3 3 0 0 1 22 29 L 20.5 37.5 A 1.5 1.5 0 0 1 17.5 37.5 Z"
						fill="url(#pg-eng)" stroke="#607d8b" stroke-width="0.55"/>
					<!-- Right inner engine -->
					<path d="M 34 29 A 3 3 0 0 1 40 29 L 38.5 37.5 A 1.5 1.5 0 0 1 35.5 37.5 Z"
						fill="url(#pg-eng)" stroke="#607d8b" stroke-width="0.55"/>
					<!-- Right outer engine -->
					<path d="M 42 33 A 3 3 0 0 1 48 33 L 46.5 41.5 A 1.5 1.5 0 0 1 43.5 41.5 Z"
						fill="url(#pg-eng)" stroke="#607d8b" stroke-width="0.55"/>

					<!-- Main wings (drawn on top of engines) -->
					<path d="M24 28 Q10 33 3 42 L3 46 Q10 40 24 36 L32 36 Q46 40 53 46 L53 42 Q46 33 32 28Z"
						fill="url(#pg-wing)" stroke="#94a3b8" stroke-width="0.7"/>

					<!-- Fuselage — wider nose-to-mid, tapers to tail -->
					<path d="M28 2 C26 2 23 5 23 10 L22 22 L24 52 C24 58 26 64 28 68 C30 64 32 58 32 52 L34 22 L33 10 C33 5 30 2 28 2Z"
						fill="url(#pg-body)" stroke="#94a3b8" stroke-width="0.9"/>

					<!-- Fuselage sheen highlight -->
					<path d="M26.5 5 C25.5 7 25 11 25 16 L25 50 C25 55 25.5 60 26.5 64 L28 62 L28 6 Z"
						fill="white" opacity="0.22"/>

					<!-- Cockpit dash line -->
					<path d="M23.5 9.5 Q28 5 32.5 9.5" fill="none" stroke="#607d8b" stroke-width="0.7" stroke-linecap="round"/>

					<!-- Tail stabilizers (smaller, proportionate) -->
					<path d="M25 55 L15 63 L15 66 L25 60 L31 60 L41 66 L41 63 L31 55Z"
						fill="url(#pg-wing)" stroke="#94a3b8" stroke-width="0.7"/>
				</svg>`,
				iconSize: [40, 52],
				iconAnchor: [20, 26],
				className: '',
			});
			L.marker(latlngs[latlngs.length - 1], { icon: planeIcon }).addTo(leafletInst);
		})();

		return () => {
			mounted = false;
			leafletInst?.remove();
			leafletInst = undefined;
			tileLayers = {};
		};
	});
</script>

<svelte:head>
	<title>{flight.flightId} — My Flight Tracker</title>
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

	<div class="content" class:has-map={showMap}>
		<section class="card status-card">
			<h2>Status</h2>
			<FlightTimeline status={flight.status} />
		</section>

		{#if showMap}
			<section class="card map-card">
				<h2>Route</h2>
				<div class="map-wrap">
					{#if trackLoading}
						<div class="map-loading"><span class="spinner"></span></div>
					{:else if track.length > 0}
						<div class="map" bind:this={mapEl}></div>
					{:else}
						<div class="map-empty">No route data available</div>
					{/if}

					<!-- Layer switcher (only when map is shown) -->
					{#if !trackLoading && track.length > 0}
					<div class="layer-switcher">
						{#if layerOpen}
							<div class="layer-panel">
								{#each LAYERS as layer}
									<button
										class="layer-option"
										class:active={activeLayerId === layer.id}
										onclick={() => switchLayer(layer.id)}
									>
										<img src={layer.thumb} alt={layer.label} class="layer-thumb" />
										<span class="layer-label">{layer.label}</span>
									</button>
								{/each}
							</div>
						{/if}
						<button
							class="layer-btn"
							class:open={layerOpen}
							onclick={() => layerOpen = !layerOpen}
							aria-label="Switch map layer"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
								<polyline points="2 17 12 22 22 17"></polyline>
								<polyline points="2 12 12 17 22 12"></polyline>
							</svg>
						</button>
					</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if flight.status}
			<section class="card details-card">
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
	}

	.content.has-map {
		display: grid;
		grid-template-columns: 280px 1fr;
		grid-template-rows: auto 1fr;
		grid-template-areas:
			'status map'
			'details map';
	}

	.status-card  { grid-area: status; }
	.details-card { grid-area: details; }
	.map-card     { grid-area: map; display: flex; flex-direction: column; }

	@media (max-width: 640px) {
		.content.has-map {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
			grid-template-areas:
				'status'
				'map'
				'details';
		}
	}

	.card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
	}

	.map-wrap {
		flex: 1;
		position: relative;
		min-height: 220px;
	}

	.map {
		height: 100%;
		border-radius: 8px;
		overflow: hidden;
	}

	.map-loading,
	.map-empty {
		height: 100%;
		min-height: 220px;
		border-radius: 8px;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
		font-size: 0.85rem;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid #e5e7eb;
		border-top-color: #6b7280;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Layer switcher */
	.layer-switcher {
		position: absolute;
		bottom: 12px;
		right: 10px;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}

	.layer-panel {
		display: flex;
		gap: 8px;
		background: white;
		border-radius: 10px;
		padding: 10px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
	}

	.layer-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		border: 2px solid transparent;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		padding: 2px;
		transition: border-color 0.15s;
	}

	.layer-option:hover {
		border-color: #d1d5db;
	}

	.layer-option.active {
		border-color: #3b82f6;
	}

	.layer-thumb {
		width: 64px;
		height: 64px;
		border-radius: 6px;
		object-fit: cover;
		display: block;
	}

	.layer-label {
		font-size: 0.7rem;
		color: #374151;
		font-weight: 500;
	}

	.layer-option.active .layer-label {
		color: #3b82f6;
	}

	.layer-btn {
		width: 36px;
		height: 36px;
		background: white;
		border: none;
		border-radius: 8px;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: #374151;
		transition: background 0.15s, color 0.15s;
	}

	.layer-btn:hover,
	.layer-btn.open {
		background: #111827;
		color: white;
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
