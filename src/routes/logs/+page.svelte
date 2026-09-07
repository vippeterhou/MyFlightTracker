<script lang="ts">
	import { untrack } from 'svelte';
	import ApiUsageChart from '$lib/components/ApiUsageChart.svelte';
	import AllRoutesMap from '$lib/components/AllRoutesMap.svelte';
	import BackButton from '$lib/components/BackButton.svelte';
	import QuickTodos from '$lib/components/QuickTodos.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const GRANULARITIES = [
		{ id: 'day', label: 'Day' },
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' },
	] as const;
	let granularity = $state('day');

	const LEVEL_COLOR: Record<string, string> = {
		info:  '#6b7280',
		warn:  '#d97706',
		error: '#ef4444',
	};

	// Live worker state, used only by the active-flights indicator below. Seeded
	// from the server load, then refreshed by the 60s poll further down.
	let workerState = $state(untrack(() => data.workerState));

	type Filter = 'all' | 'status' | 'api' | 'notifications' | 'errors';
	let activeFilter = $state<Filter>('all');

	const FILTERS: { id: Filter; label: string }[] = [
		{ id: 'all',      label: 'All' },
		{ id: 'status',   label: 'Status changes' },
		{ id: 'api',      label: 'API calls' },
		{ id: 'notifications', label: 'Notifications' },
		{ id: 'errors',   label: 'Errors' },
	];

	let filtered = $derived(data.logs.filter((log) => {
		if (activeFilter === 'status') {
			if (log.message === 'Flight added') return true;
			const m = log.message.match(/^Status: (.+) → (.+)$/);
			return !!m && m[1] !== m[2];
		}
		if (activeFilter === 'api') return log.message.startsWith('[API]');
		if (activeFilter === 'notifications') {
			return /^(Telegram|Email) notification (sent|failed):/.test(log.message);
		}
		if (activeFilter === 'errors') return log.level === 'error';
		return true;
	}));

	function fmt(d: string) {
		return new Date(d).toLocaleString('en-US', {
			month: 'short', day: 'numeric',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
		});
	}

	// ── Active flights section ────────────────────────────────────────────────
	// Live-ish clock so countdowns/relative times stay fresh without a reload.
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(t);
	});

	const STATUS_COLOR: Record<string, string> = {
		scheduled: '#6b7280',
		boarding:  '#7c3aed',
		departed:  '#2563eb',
		airborne:  '#0ea5e9',
		landed:    '#059669',
		delayed:   '#d97706',
		diverted:  '#dc2626',
	};
	const STATUS_RANK: Record<string, number> = {
		airborne: 0, departed: 1, boarding: 2, landed: 3, delayed: 4, diverted: 5, scheduled: 6,
	};

	type Active = (typeof data.activeFlights)[number];

	function depTime(f: Active): number {
		return Date.parse(f.estimatedDep ?? f.scheduledDep ?? f.date);
	}
	function hasDeparted(f: Active): boolean {
		return !!f.actualDep || ['departed', 'airborne', 'landed', 'diverted'].includes(f.status ?? '');
	}

	function fmtDur(ms: number): string {
		const m = Math.round(ms / 60_000);
		if (m < 60) return `${m}m`;
		const h = Math.floor(m / 60), mm = m % 60;
		if (h < 24) return mm ? `${h}h ${mm}m` : `${h}h`;
		const d = Math.floor(h / 24), hh = h % 24;
		return hh ? `${d}d ${hh}h` : `${d}d`;
	}
	function relTime(iso: string): string {
		const diff = now - Date.parse(iso);
		return diff < 60_000 ? 'just now' : `${fmtDur(diff)} ago`;
	}

	// Primary timing line: countdown to departure before takeoff, to arrival after.
	function timing(f: Active): string {
		if (!hasDeparted(f)) {
			const t = Date.parse(f.estimatedDep ?? f.scheduledDep ?? '');
			if (!Number.isNaN(t)) return t > now ? `departs in ${fmtDur(t - now)}` : 'departure due';
			return '';
		}
		const t = Date.parse(f.estimatedArr ?? f.scheduledArr ?? '');
		if (!Number.isNaN(t) && t > now) return `arrives in ${fmtDur(t - now)}`;
		if (f.status === 'landed') return 'landed — awaiting gate';
		return '';
	}

	// Current status paired with how long it has held (from the last transition).
	function freshness(f: Active): string {
		if (!f.statusChangedAt) return 'awaiting first poll';
		const label = f.status ?? 'pending';
		const held = now - Date.parse(f.statusChangedAt);
		return `${label} · ${held < 60_000 ? 'just now' : fmtDur(held)}`;
	}

	let active = $derived(
		[...data.activeFlights].sort((a, b) => {
			const ra = STATUS_RANK[a.status ?? ''] ?? 7;
			const rb = STATUS_RANK[b.status ?? ''] ?? 7;
			return ra !== rb ? ra - rb : depTime(a) - depTime(b);
		}),
	);

	// Keep the worker state live while the page is open (e.g. an external stop or
	// crash), mirroring the header dot's 60s cadence, so the active-flights
	// indicator reflects reality rather than only the value from page load.
	$effect(() => {
		const t = setInterval(async () => {
			try {
				const res = await fetch('/api/status');
				if (res.ok) workerState = (await res.json()).workerState;
			} catch {}
		}, 60_000);
		return () => clearInterval(t);
	});
</script>

<svelte:head>
	<title>Logs — Contrail</title>
</svelte:head>

<div class="page">
	<BackButton />

	{#await data.routes}
		<div class="map-placeholder">Loading route map…</div>
	{:then routes}
		<AllRoutesMap {routes} />
	{:catch}
		<div class="map-placeholder">Couldn't load the route map.</div>
	{/await}

	<div class="page-header">
		<h1>Poll Logs</h1>
	</div>

	<div class="usage-section">
		<div class="usage-header">
			<div class="usage-title">
				<h2>API Usage</h2>
				<span class="tz-note">times in UTC</span>
			</div>
			<div class="granularity-toggle">
				{#each GRANULARITIES as g}
					<button
						class="filter-btn"
						class:active={granularity === g.id}
						onclick={() => granularity = g.id}
					>{g.label}</button>
				{/each}
			</div>
		</div>
		<ApiUsageChart {granularity} />
	</div>

	<div class="active-section">
		<div class="active-header">
			<h2>Active flights</h2>
			<span class="active-count">{active.length}</span>
			{#if data.lastCheckedAt}
				<span class="poll-status" class:ok={workerState === 'running'}>
					<span class="poll-dot"></span>
					{workerState === 'running' ? 'Worker active' : workerState === 'stopped' ? 'Worker stopped' : 'Worker unknown'} · last checked {relTime(data.lastCheckedAt)}
				</span>
			{/if}
		</div>
		{#if active.length === 0}
			<p class="active-empty">No flights in progress or upcoming.</p>
		{:else}
			<div class="active-list">
				{#each active as f (f.id)}
					<div class="active-row">
						<div class="active-body">
							<div class="line1">
								<span class="sdot" style="background: {STATUS_COLOR[f.status ?? ''] ?? '#9ca3af'}"></span>
								<span class="fid">{f.flightId}</span>
								{#if f.departureAirport && f.arrivalAirport}
									<span class="route">{f.departureAirport} → {f.arrivalAirport}</span>
								{/if}
								{#if f.label}<span class="flabel">{f.label}</span>{/if}
							</div>
							<div class="line2">
								{#if timing(f)}<span class="timing">{timing(f)}</span>{/if}
								{#if freshness(f)}<span class="dot">·</span><span class="fresh">{freshness(f)}</span>{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="filters">
		{#each FILTERS as f}
			<button
				class="filter-btn"
				class:active={activeFilter === f.id}
				onclick={() => activeFilter = f.id}
			>{f.label}</button>
		{/each}
	</div>

	{#if filtered.length === 0}
		<p class="empty">{data.logs.length === 0 ? "No logs yet — the worker hasn't run." : 'No matching logs.'}</p>
	{:else}
		<div class="log-list">
			{#each filtered as log}
				<div class="row">
					<span class="ts">{fmt(log.timestamp)}</span>
					<div class="body">
						{#if log.flightId}
							<span class="flight">{log.flightId}</span>
						{/if}
						<span class="msg" style="color: {LEVEL_COLOR[log.level] ?? '#111827'}">{log.message}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<QuickTodos />
</div>

<style>
	.page {
		max-width: 1100px;
	}

	.usage-section {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 16px 20px;
		margin-bottom: 24px;
	}

	.active-section {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 16px 20px;
		margin-bottom: 24px;
	}

	.map-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 540px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		margin-bottom: 24px;
		color: #9ca3af;
		font-size: 0.9rem;
	}

	.active-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.poll-status {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.poll-status.ok {
		color: #059669;
	}

	.poll-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #d1d5db;
	}

	.poll-status.ok .poll-dot {
		background: #10b981;
	}

	.active-header h2 {
		font-size: 0.85rem;
		font-weight: 600;
		color: #374151;
		margin: 0;
	}

	.active-count {
		font-size: 0.7rem;
		font-weight: 600;
		color: #6b7280;
		background: #f3f4f6;
		border-radius: 999px;
		padding: 1px 8px;
	}

	.active-empty {
		font-size: 0.85rem;
		color: #9ca3af;
		margin: 0;
	}

	.active-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.active-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid #f0f1f3;
		border-radius: 10px;
	}

	.sdot {
		flex-shrink: 0;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		align-self: center;
	}

	.active-body {
		min-width: 0;
		flex: 1;
	}

	.line1 {
		display: flex;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
	}

	.fid {
		font-weight: 700;
		font-size: 0.95rem;
		color: #111827;
	}

	.route {
		font-size: 0.8rem;
		color: #4b5563;
		font-variant-numeric: tabular-nums;
	}

	.flabel {
		font-size: 0.78rem;
		color: #9ca3af;
	}

	.line2 {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 3px;
		font-size: 0.78rem;
		color: #6b7280;
	}

	.timing {
		color: #2563eb;
		font-weight: 600;
	}

	.dot {
		color: #d1d5db;
	}

	.usage-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.usage-header h2 {
		font-size: 0.85rem;
		font-weight: 600;
		color: #374151;
		margin: 0;
	}

	.usage-title {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.tz-note {
		font-size: 0.7rem;
		font-weight: 500;
		color: #9ca3af;
		letter-spacing: 0.02em;
	}

	.granularity-toggle {
		display: flex;
		gap: 6px;
	}

	.page-header {
		margin-bottom: 20px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.filters {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.filter-btn {
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid #e5e7eb;
		background: white;
		color: #6b7280;
		font-size: 0.78rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.filter-btn:hover {
		border-color: #9ca3af;
		color: #111827;
	}

	.filter-btn.active {
		background: #111827;
		border-color: #111827;
		color: white;
	}

	.log-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.8rem;
		max-height: 600px;
		overflow-y: auto;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: white;
		padding: 8px 12px;
		border-radius: 6px;
	}

	.ts {
		color: #9ca3af;
		font-size: 0.72rem;
	}

	.body {
		display: flex;
		gap: 8px;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.flight {
		color: #3b82f6;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.msg {
		flex: 1;
		white-space: pre-line;
	}

	.empty {
		color: #9ca3af;
	}
</style>
