<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Chart as ChartType } from 'chart.js';

	interface Props {
		granularity: string;
	}

	let { granularity }: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | undefined>(undefined);
	let chartInstance: ChartType | null = null;
	let ChartClass: typeof ChartType | null = null;
	let loading = $state(true);
	let empty = $state(false);

	interface DrilldownCall {
		id: string;
		timestamp: string;
		endpoint: string;
		flightId: string | null;
		durationMs: number;
		success: boolean;
		httpStatus: number | null;
	}

	let drilldownData = $state<DrilldownCall[] | null>(null);
	let drilldownLabel = $state('');

	interface MonthlySummary {
		status: number;
		route: number;
		total: number;
		month: string;
	}
	let summary = $state<MonthlySummary | null>(null);

	onMount(async () => {
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);
		ChartClass = Chart;
		await Promise.all([loadChart(), loadSummary()]);
	});

	async function loadSummary() {
		const res = await fetch('/api/usage?summary');
		summary = await res.json();
	}

	onDestroy(() => {
		chartInstance?.destroy();
	});

	let buckets: string[] = [];

	async function loadChart() {
		if (!ChartClass || !canvasEl) return;
		loading = true;
		drilldownData = null;

		const res = await fetch(`/api/usage?granularity=${granularity}`);
		const rows: { bucket: string; endpoint: string; count: number }[] = await res.json();

		if (rows.length === 0) {
			loading = false;
			empty = true;
			chartInstance?.destroy();
			chartInstance = null;
			return;
		}

		empty = false;
		const statusMap = new Map(
			rows.filter((r) => r.endpoint === 'status').map((r) => [r.bucket, r.count]),
		);
		const routeMap = new Map(
			rows.filter((r) => r.endpoint === 'route').map((r) => [r.bucket, r.count]),
		);

		const rawBuckets = [...new Set(rows.map((r) => r.bucket))].sort();
		buckets = fillGaps(rawBuckets, granularity);

		const labels = buckets.map((b) => formatBucketLabel(b));
		const statusData = buckets.map((b) => statusMap.get(b) ?? 0);
		const routeData = buckets.map((b) => routeMap.get(b) ?? 0);

		chartInstance?.destroy();
		chartInstance = new ChartClass(canvasEl, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Status',
						data: statusData,
						borderColor: '#3b82f6',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						tension: 0.3,
						fill: true,
						pointRadius: 4,
						pointHoverRadius: 6,
					},
					{
						label: 'Route',
						data: routeData,
						borderColor: '#22c55e',
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						tension: 0.3,
						fill: true,
						pointRadius: 4,
						pointHoverRadius: 6,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				onClick: (_event: unknown, elements: { index: number }[]) => {
					if (elements.length > 0) {
						handleDrilldown(buckets[elements[0].index]);
					}
				},
				plugins: {
					tooltip: { mode: 'index', intersect: false },
					legend: {
						position: 'bottom',
						labels: {
							usePointStyle: true,
							pointStyle: 'circle',
							boxWidth: 6,
							boxHeight: 6,
							padding: 16,
							font: { size: 12 },
						},
					},
				},
				scales: {
					y: { beginAtZero: true, ticks: { maxTicksLimit: 6 } },
				},
			},
		});

		loading = false;
	}

	function fillGaps(sorted: string[], gran: string): string[] {
		if (sorted.length === 0) return sorted;
		const result: string[] = [];
		const start = new Date(sorted[0]);
		const now = new Date();
		const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
		const d = new Date(start);
		while (d <= end) {
			result.push(d.toISOString());
			if (gran === 'month') d.setMonth(d.getMonth() + 1);
			else if (gran === 'week') d.setDate(d.getDate() + 7);
			else d.setDate(d.getDate() + 1);
		}
		return result;
	}

	function formatBucketLabel(iso: string): string {
		const d = new Date(iso);
		if (granularity === 'month')
			return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		if (granularity === 'week')
			return `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatTimestamp(iso: string): string {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	}

	async function handleDrilldown(bucket: string) {
		drilldownLabel = formatBucketLabel(bucket);
		const res = await fetch(`/api/usage?granularity=${granularity}&drilldown=${bucket}`);
		drilldownData = await res.json();
	}

	$effect(() => {
		const _g = granularity;
		if (ChartClass) loadChart();
	});
</script>

{#if summary}
	<div class="summary">
		<div class="summary-item">
			<span class="summary-label">This month</span>
			<span class="summary-value">{summary.total}</span>
		</div>
		<div class="summary-item">
			<span class="summary-dot status"></span>
			<span class="summary-label">Status</span>
			<span class="summary-value">{summary.status}</span>
		</div>
		<div class="summary-item">
			<span class="summary-dot route"></span>
			<span class="summary-label">Route</span>
			<span class="summary-value">{summary.route}</span>
		</div>
	</div>
{/if}

<div class="chart-wrap">
	{#if loading}
		<div class="chart-loading"><span class="spinner"></span></div>
	{:else if empty}
		<div class="chart-empty">No API usage data yet</div>
	{/if}
	<canvas bind:this={canvasEl} style:display={loading || empty ? 'none' : 'block'}></canvas>
</div>

{#if drilldownData}
	<div class="drilldown">
		<div class="drilldown-header">
			<h3>API Calls — {drilldownLabel}</h3>
			<button class="close-btn" onclick={() => (drilldownData = null)}>Close</button>
		</div>
		<div class="drilldown-list">
			{#each drilldownData as call}
				<div class="drilldown-row">
					<span class="ts">{formatTimestamp(call.timestamp)}</span>
					<span class="endpoint" class:status={call.endpoint === 'status'}
						class:route={call.endpoint === 'route'}>
						{call.endpoint === 'status' ? 'Status' : 'Route'}
					</span>
					{#if call.flightId}
						<span class="flight">{call.flightId}</span>
					{/if}
					<span class="duration">{call.durationMs}ms</span>
					<span class="http-status" class:error={!call.success}>{call.httpStatus ?? '—'}</span>
				</div>
			{/each}
			{#if drilldownData.length === 0}
				<div class="drilldown-empty">No calls in this period</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.summary {
		display: flex;
		gap: 20px;
		margin-bottom: 16px;
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.summary-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.summary-dot.status {
		background: #3b82f6;
	}

	.summary-dot.route {
		background: #22c55e;
	}

	.summary-label {
		font-size: 0.8rem;
		color: #6b7280;
	}

	.summary-value {
		font-size: 0.9rem;
		font-weight: 700;
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: #111827;
	}

	.chart-wrap {
		position: relative;
		height: 240px;
	}

	.chart-loading,
	.chart-empty {
		height: 100%;
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
		to {
			transform: rotate(360deg);
		}
	}

	.drilldown {
		margin-top: 16px;
		border-top: 1px solid #e5e7eb;
		padding-top: 12px;
	}

	.drilldown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.drilldown-header h3 {
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
	}

	.close-btn {
		font-size: 0.75rem;
		color: #6b7280;
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		padding: 2px 10px;
		cursor: pointer;
	}

	.close-btn:hover {
		background: #f3f4f6;
	}

	.drilldown-list {
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.drilldown-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 8px;
		background: #f9fafb;
		border-radius: 6px;
		font-size: 0.8rem;
	}

	.ts {
		color: #6b7280;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.75rem;
		min-width: 140px;
	}

	.endpoint {
		font-weight: 600;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 6px;
		border-radius: 4px;
		min-width: 50px;
		text-align: center;
	}

	.endpoint.status {
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
	}

	.endpoint.route {
		color: #22c55e;
		background: rgba(34, 197, 94, 0.1);
	}

	.flight {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-weight: 500;
		color: #111827;
	}

	.duration {
		color: #6b7280;
		margin-left: auto;
	}

	.http-status {
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: #059669;
		min-width: 28px;
		text-align: right;
	}

	.http-status.error {
		color: #ef4444;
	}

	.drilldown-empty {
		color: #9ca3af;
		font-size: 0.8rem;
		padding: 12px;
		text-align: center;
	}
</style>
