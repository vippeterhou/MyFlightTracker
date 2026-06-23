<script lang="ts">
	import { onDestroy } from 'svelte';

	interface FlightRoute {
		flightId: string;
		label: string | null;
		date: string;
		departureAirport: string | null;
		arrivalAirport: string | null;
		track: { lat: number; lon: number; heading: number }[];
	}

	let { routes }: { routes: FlightRoute[] } = $props();

	type ViewMode = 'map' | 'globe';
	let viewMode = $state<ViewMode>('map');

	const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

	const RANGES = [
		{ id: 'all', label: 'All' },
		{ id: '30d', label: '30 days' },
		{ id: '90d', label: '90 days' },
		{ id: 'ytd', label: 'This year' },
	] as const;

	function toDateStr(d: Date): string {
		return d.toISOString().split('T')[0];
	}

	function earliest(): string {
		if (routes.length === 0) return toDateStr(new Date());
		return routes.reduce((min, r) => r.date < min ? r.date : min, routes[0].date).split('T')[0];
	}

	let activeRange = $state<string>('all');
	let dateFrom = $state(earliest());
	let dateTo = $state(toDateStr(new Date()));

	function selectRange(id: string) {
		activeRange = id;
		const today = new Date();
		dateTo = toDateStr(today);
		if (id === 'all') {
			dateFrom = earliest();
		} else if (id === 'ytd') {
			dateFrom = `${today.getFullYear()}-01-01`;
		} else {
			const days = id === '30d' ? 30 : 90;
			dateFrom = toDateStr(new Date(today.getTime() - days * 86400000));
		}
	}

	function onDateChange() {
		activeRange = 'custom';
	}

	let filteredRoutes = $derived.by(() => {
		const from = dateFrom ? new Date(dateFrom).getTime() : 0;
		const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
		return routes.filter((r) => {
			const t = new Date(r.date).getTime();
			return t >= from && t <= to;
		});
	});

	const LAYERS = [
		{ id: 'default', label: 'Default', thumb: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/2/1/1.png' },
		{ id: 'terrain', label: 'Terrain', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/2/1/1' },
		{ id: 'satellite', label: 'Satellite', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/2/1/1' },
	];

	let mapEl = $state<HTMLDivElement | undefined>(undefined);
	let activeLayerId = $state('terrain');
	let layerOpen = $state(false);
	let leafletInst: import('leaflet').Map | undefined;
	let tileLayers: Record<string, import('leaflet').TileLayer> = {};

	function switchLayer(id: string) {
		if (!leafletInst) return;
		Object.values(tileLayers).forEach((l) => leafletInst!.removeLayer(l));
		tileLayers[id]?.addTo(leafletInst);
		activeLayerId = id;
		layerOpen = false;
	}

	function unwrapTrack(track: { lat: number; lon: number }[]): [number, number][] {
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

	function normalizeAllTracks(routes: FlightRoute[]): [number, number][][] {
		const unwrapped = routes.map((r) => unwrapTrack(r.track));

		const allMidLngs: number[] = [];
		for (const track of unwrapped) {
			if (track.length === 0) continue;
			const lngs = track.map((p) => p[1]);
			allMidLngs.push((Math.min(...lngs) + Math.max(...lngs)) / 2);
		}
		if (allMidLngs.length === 0) return unwrapped;

		const refLng = allMidLngs.reduce((a, b) => a + b, 0) / allMidLngs.length;

		for (const track of unwrapped) {
			if (track.length === 0) continue;
			const lngs = track.map((p) => p[1]);
			const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
			const shift = Math.round((midLng - refLng) / 360) * 360;
			if (shift !== 0) {
				for (const p of track) p[1] -= shift;
			}
		}
		return unwrapped;
	}

	$effect(() => {
		if (!mapEl || filteredRoutes.length === 0) return;

		let mounted = true;

		(async () => {
			const [{ default: L }] = await Promise.all([
				import('leaflet'),
				import('leaflet/dist/leaflet.css'),
			]);

			if (!mounted || !mapEl) return;

			leafletInst = L.map(mapEl, { zoomSnap: 0.1 }).setView([20, 0], 2);

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

			const allBounds: [number, number][] = [];
			const normalizedTracks = normalizeAllTracks(filteredRoutes);

			filteredRoutes.forEach((route, i) => {
				const color = COLORS[i % COLORS.length];
				const latlngs = normalizedTracks[i];
				if (latlngs.length === 0) return;

				allBounds.push(...latlngs);

				L.polyline(latlngs, { color, weight: 2.5, opacity: 0.8 }).addTo(leafletInst!);

				L.circleMarker(latlngs[0], {
					radius: 4, color, fillColor: color, fillOpacity: 1, weight: 0,
				}).addTo(leafletInst!);

				L.circleMarker(latlngs[latlngs.length - 1], {
					radius: 4, color, fillColor: color, fillOpacity: 1, weight: 0,
				}).bindTooltip(
					`${route.flightId}${route.label ? ' · ' + route.label : ''}<br>${route.departureAirport ?? '?'} → ${route.arrivalAirport ?? '?'}`,
					{ permanent: false, direction: 'top', className: 'route-tooltip' },
				).addTo(leafletInst!);
			});

			if (allBounds.length > 0) {
				leafletInst.fitBounds(allBounds, { padding: [32, 32] });
			}
		})();

		return () => {
			mounted = false;
			leafletInst?.remove();
			leafletInst = undefined;
			tileLayers = {};
		};
	});

	const GLOBE_THEMES = [
		{
			id: 'blue-marble',
			label: 'Satellite',
			globe: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
			bg: '//unpkg.com/three-globe/example/img/night-sky.png',
		},
		{
			id: 'night',
			label: 'Night',
			globe: '//unpkg.com/three-globe/example/img/earth-night.jpg',
			bg: '//unpkg.com/three-globe/example/img/night-sky.png',
		},
	];

	let activeGlobeTheme = $state('blue-marble');
	let globeThemeOpen = $state(false);

	function switchGlobeTheme(id: string) {
		activeGlobeTheme = id;
		const theme = GLOBE_THEMES.find((t) => t.id === id);
		if (globeInst && theme) {
			globeInst.globeImageUrl(theme.globe);
			globeInst.backgroundImageUrl(theme.bg || null);
		}
		globeThemeOpen = false;
	}

	let globeEl = $state<HTMLDivElement | undefined>(undefined);
	let globeInst: any = null;

	$effect(() => {
		if (viewMode !== 'globe' || !globeEl || filteredRoutes.length === 0) return;

		let mounted = true;

		(async () => {
			const Globe = (await import('globe.gl')).default;
			if (!mounted || !globeEl) return;

			const arcsData = filteredRoutes.map((route, i) => ({
				startLat: route.track[0].lat,
				startLng: route.track[0].lon,
				endLat: route.track[route.track.length - 1].lat,
				endLng: route.track[route.track.length - 1].lon,
				color: COLORS[i % COLORS.length],
				label: `${route.flightId}${route.label ? ' · ' + route.label : ''}\n${route.departureAirport ?? '?'} → ${route.arrivalAirport ?? '?'}`,
			}));

			const theme = GLOBE_THEMES.find((t) => t.id === activeGlobeTheme) ?? GLOBE_THEMES[0];

			globeInst = new Globe(globeEl)
				.globeImageUrl(theme.globe)
				.bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
				.backgroundImageUrl(theme.bg || null)
				.arcsData(arcsData)
				.arcColor('color')
				.arcLabel('label')
				.arcDashLength(0.4)
				.arcDashGap(0.2)
				.arcDashAnimateTime(1500)
				.arcStroke(0.5)
				.width(globeEl.clientWidth)
				.height(globeEl.clientHeight);

			globeInst.pointOfView({ lat: 30, lng: -95, altitude: 2.5 });

			const controls = globeInst.controls();
			controls.autoRotate = true;
			controls.autoRotateSpeed = 0.5;
		})();

		return () => {
			mounted = false;
			if (globeInst) {
				globeInst._destructor?.();
				globeInst = null;
			}
			if (globeEl) globeEl.innerHTML = '';
		};
	});

	onDestroy(() => {
		leafletInst?.remove();
		leafletInst = undefined;
		if (globeInst) {
			globeInst._destructor?.();
			globeInst = null;
		}
	});
</script>

<div class="map-card">
	<div class="map-header">
		<div class="title-row">
			<h2>Flight Routes</h2>
			<div class="view-toggle">
				<button class="view-btn" class:active={viewMode === 'map'} onclick={() => viewMode = 'map'} aria-label="Map view">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
						<line x1="8" y1="2" x2="8" y2="18"></line>
						<line x1="16" y1="6" x2="16" y2="22"></line>
					</svg>
				</button>
				<button class="view-btn" class:active={viewMode === 'globe'} onclick={() => viewMode = 'globe'} aria-label="Globe view">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="2" y1="12" x2="22" y2="12"></line>
						<path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path>
					</svg>
				</button>
			</div>
		</div>
		<div class="range-controls">
			<div class="range-toggle">
				{#each RANGES as r}
					<button
						class="range-btn"
						class:active={activeRange === r.id}
						onclick={() => selectRange(r.id)}
					>{r.label}</button>
				{/each}
			</div>
			<div class="date-range">
				<input type="date" class="date-input" bind:value={dateFrom} onchange={onDateChange} />
				<span class="date-sep">—</span>
				<input type="date" class="date-input" bind:value={dateTo} onchange={onDateChange} />
			</div>
		</div>
	</div>
	<div class="map-wrap">
		{#if filteredRoutes.length === 0}
			<div class="map-empty">{routes.length === 0 ? 'No route data available' : 'No flights in this period'}</div>
		{:else if viewMode === 'map'}
			<div class="map" bind:this={mapEl}></div>
		{:else}
			<div class="globe" bind:this={globeEl}></div>
		{/if}

		{#if filteredRoutes.length > 0 && viewMode === 'globe'}
			<div class="layer-switcher">
				{#if globeThemeOpen}
					<div class="layer-panel">
						{#each GLOBE_THEMES as theme}
							<button
								class="layer-option"
								class:active={activeGlobeTheme === theme.id}
								onclick={() => switchGlobeTheme(theme.id)}
							>
								<span class="theme-label">{theme.label}</span>
							</button>
						{/each}
					</div>
				{/if}
				<button
					class="layer-btn"
					class:open={globeThemeOpen}
					onclick={() => globeThemeOpen = !globeThemeOpen}
					aria-label="Switch globe theme"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="2" y1="12" x2="22" y2="12"></line>
						<path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path>
					</svg>
				</button>
			</div>
		{/if}

		{#if filteredRoutes.length > 0 && viewMode === 'map'}
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
</div>

<style>
	.map-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 20px;
		margin-bottom: 24px;
	}

	.map-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	h2 {
		font-size: 0.85rem;
		font-weight: 600;
		color: #374151;
		margin: 0;
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

	.range-controls {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.range-toggle {
		display: flex;
		gap: 6px;
	}

	.date-range {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.date-input {
		padding: 3px 8px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.78rem;
		color: #374151;
		outline: none;
	}

	.date-input:focus {
		border-color: #3b82f6;
	}

	.date-sep {
		color: #9ca3af;
		font-size: 0.8rem;
	}

	.range-btn {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
		font-size: 0.78rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.range-btn:hover {
		border-color: #9ca3af;
		color: #111827;
	}

	.range-btn.active {
		background: #111827;
		border-color: #111827;
		color: white;
	}

	.map-wrap {
		position: relative;
		height: 500px;
	}

	.map, .globe {
		height: 100%;
		border-radius: 8px;
		overflow: hidden;
	}

	.map-empty {
		height: 100%;
		border-radius: 8px;
		background: #f3f4f6;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #9ca3af;
		font-size: 0.85rem;
	}

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

	.theme-label {
		font-size: 0.75rem;
		color: #374151;
		font-weight: 500;
		padding: 6px 12px;
	}

	.layer-option.active .theme-label {
		color: #3b82f6;
	}

	:global(.route-tooltip) {
		font-size: 0.75rem;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}
</style>
