<script lang="ts">
	import ApiUsageChart from '$lib/components/ApiUsageChart.svelte';
	import AllRoutesMap from '$lib/components/AllRoutesMap.svelte';
	import QuickTodos from '$lib/components/QuickTodos.svelte';
	import { POLL_SNAPSHOT } from '$lib/constants';

	interface Log {
		id: string;
		timestamp: string;
		level: string;
		flightId: string | null;
		message: string;
	}

	interface FlightRoute {
		flightId: string;
		label: string | null;
		date: string;
		departureAirport: string | null;
		arrivalAirport: string | null;
		track: { lat: number; lon: number; heading: number }[];
	}

	let {
		logs,
		activity,
		lastCheckedAt,
		routes,
	}: {
		logs: Log[];
		activity: Log[];
		lastCheckedAt: string | null;
		routes: Promise<FlightRoute[]>;
	} = $props();

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

	// Live worker state used by the activity-board indicator below. It is fetched
	// after render, then refreshed by the 60s poll further down.
	let workerState = $state('unknown');

	type Filter = 'all' | 'status' | 'api' | 'notifications' | 'errors';
	let activeFilter = $state<Filter>('all');

	const FILTERS: { id: Filter; label: string }[] = [
		{ id: 'all',      label: 'All' },
		{ id: 'status',   label: 'Status changes' },
		{ id: 'api',      label: 'API calls' },
		{ id: 'notifications', label: 'Notifications' },
		{ id: 'errors',   label: 'Errors' },
	];

	let filtered = $derived(logs.filter((log) => {
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

	// Live-ish clock so relative activity times stay fresh without a reload.
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
		arrived:   '#10b981',
		cancelled: '#ef4444',
		unavailable: '#d97706',
		error: '#ef4444',
	};

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

	interface ActivityLine {
		flightId: string | null;
		status: string | null;
		text: string;
	}

	interface ActivityEntry {
		id: string;
		timestamp: string;
		lines: ActivityLine[];
	}

	let boardEntries = $derived.by((): ActivityEntry[] => {
		return activity
			.slice(0, 12)
			.map((event) => {
				if (event.message === 'Flight added') {
					return {
						id: event.id,
						timestamp: event.timestamp,
						lines: [{
							flightId: event.flightId,
							status: null,
							text: event.flightId ? `${event.flightId} added` : 'Flight added',
						}],
					};
				}

				const snapshot = event.message.slice(POLL_SNAPSHOT.PREFIX.length).trim();
				if (snapshot === POLL_SNAPSHOT.EMPTY) {
					return {
						id: event.id,
						timestamp: event.timestamp,
						lines: [{ flightId: null, status: null, text: 'No active flights found' }],
					};
				}

				return {
					id: event.id,
					timestamp: event.timestamp,
					lines: snapshot.split(POLL_SNAPSHOT.SEPARATOR).map((item) => {
						const separator = item.indexOf(' ');
						const flightId = separator === -1 ? item : item.slice(0, separator);
						const status = separator === -1 ? 'unknown' : item.slice(separator + 1);
						return { flightId, status, text: `${flightId} ${status}` };
					}),
				};
			});
	});

	// Keep the worker state live while the page is open (e.g. an external stop or
	// crash), mirroring the header dot's 60s cadence, so the flight-activity
	// header reflects reality rather than only the value from page load.
	$effect(() => {
		let mounted = true;
		const refresh = async () => {
			try {
				const res = await fetch('/api/status');
				if (mounted && res.ok) workerState = (await res.json()).workerState;
			} catch {}
		};
		void refresh();
		const t = setInterval(refresh, 60_000);
		return () => {
			mounted = false;
			clearInterval(t);
		};
	});
</script>

<div class="page">
	{#await routes}
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

	<div class="activity-section">
		<div class="activity-header">
			<div class="activity-title">
				<div>
					<h2>Flight activity</h2>
					<p>Recent status updates</p>
				</div>
			</div>
			{#if lastCheckedAt}
				<div class="worker-health">
					<span class="worker-badge" class:ok={workerState === 'running'}>
						<span class="poll-dot"></span>
						{workerState === 'running' ? 'Live' : workerState === 'stopped' ? 'Paused' : 'Unavailable'}
					</span>
					<span class="last-check">Updated {relTime(lastCheckedAt)}</span>
				</div>
			{/if}
		</div>
		{#if boardEntries.length === 0}
			<div class="activity-empty">Tracking activity will appear after the next update.</div>
		{:else}
			<div class="activity-board">
				{#each boardEntries as entry (entry.id)}
					<div class="activity-row">
						<time>{relTime(entry.timestamp)}</time>
						<div class="activity-lines">
							{#each entry.lines as line}
								<div class="activity-line">
									{#if line.status}
										<span
											class="activity-dot"
											style="background: {STATUS_COLOR[line.status] ?? '#9ca3af'}"
										></span>
									{/if}
									{#if line.flightId}
										<strong>{line.flightId}</strong>
										<span style="color: {STATUS_COLOR[line.status ?? ''] ?? '#9ca3af'}">
											{line.text.slice(line.flightId.length).trim()}
										</span>
									{:else}
										<span>{line.text}</span>
									{/if}
								</div>
							{/each}
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
		<p class="empty">{logs.length === 0 ? "No logs yet — the worker hasn't run." : 'No matching logs.'}</p>
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

	.activity-section {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 16px 20px;
		margin-bottom: 24px;
		color: #111827;
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

	.activity-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 10px;
	}

	.activity-title {
		display: flex;
		align-items: center;
	}

	.worker-health {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.worker-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 9px;
		border: 1px solid #e5e7eb;
		border-radius: 999px;
		background: #f9fafb;
		color: #6b7280;
		font-size: 0.72rem;
		font-weight: 600;
	}

	.worker-badge.ok {
		border-color: #bbf7d0;
		background: #f0fdf4;
		color: #047857;
	}

	.poll-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #d1d5db;
	}

	.worker-badge.ok .poll-dot {
		background: #10b981;
	}

	.last-check {
		color: #9ca3af;
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.activity-header h2 {
		font-size: 0.9rem;
		font-weight: 700;
		color: #374151;
		margin: 0;
	}

	.activity-header p {
		margin-top: 2px;
		color: #6b7280;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.activity-empty {
		padding: 28px 0 20px;
		color: #6b7280;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.8rem;
		text-align: center;
	}

	.activity-board {
		display: flex;
		flex-direction: column-reverse;
		max-height: 330px;
		overflow: hidden;
		font-family: 'SF Mono', 'Fira Code', monospace;
		mask-image: linear-gradient(to bottom, transparent 0, #000 20%, #000 100%);
	}

	.activity-row {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 14px;
		padding: 9px 4px;
		border-top: 1px solid #f0f1f3;
	}

	.activity-row time {
		color: #6b7280;
		font-size: 0.72rem;
		text-align: right;
		white-space: nowrap;
	}

	.activity-lines {
		display: flex;
		flex-direction: column;
		gap: 5px;
		min-width: 0;
	}

	.activity-line {
		display: flex;
		align-items: center;
		gap: 7px;
		flex-wrap: wrap;
		color: #9ca3af;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.activity-line strong {
		color: #111827;
		font-size: 0.85rem;
		letter-spacing: 0.06em;
	}

	.activity-dot {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		border-radius: 50%;
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

	@media (max-width: 640px) {
		.map-placeholder {
			height: clamp(380px, calc(70vw + 140px), 460px);
		}

		.activity-section {
			padding: 14px;
		}

		.activity-header {
			align-items: center;
			flex-wrap: wrap;
		}

		.activity-row {
			grid-template-columns: 76px 1fr;
			gap: 10px;
		}
	}
</style>
