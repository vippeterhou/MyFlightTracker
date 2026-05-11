<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const LEVEL_COLOR: Record<string, string> = {
		info:  '#6b7280',
		warn:  '#d97706',
		error: '#ef4444',
	};

	// Worker control — initialized from server, then managed client-side
	let workerState = $state(untrack(() => data.workerState));
	let workerLoading = $state(false);
	let workerError = $state<string | null>(null);

	async function toggleWorker() {
		workerLoading = true;
		workerError = null;
		try {
			const method = workerState === 'running' ? 'DELETE' : 'POST';
			const res = await fetch('/api/worker', { method });
			const json = await res.json();
			if (!res.ok) {
				workerError = json.message ?? 'Unknown error';
			} else {
				workerState = json.state;
				await invalidateAll(); // sync layout dot
			}
		} catch {
			workerError = 'Request failed';
		} finally {
			workerLoading = false;
		}
	}

	type Filter = 'all' | 'status' | 'telegram' | 'errors';
	let activeFilter = $state<Filter>('all');

	const FILTERS: { id: Filter; label: string }[] = [
		{ id: 'all',      label: 'All' },
		{ id: 'status',   label: 'Status changes' },
		{ id: 'telegram', label: 'Telegram' },
		{ id: 'errors',   label: 'Errors' },
	];

	let filtered = $derived(data.logs.filter((log) => {
		if (activeFilter === 'status') {
			if (log.message === 'Flight added') return true;
			const m = log.message.match(/^Status: (.+) → (.+)$/);
			return !!m && m[1] !== m[2];
		}
		if (activeFilter === 'telegram') return log.message.startsWith('Telegram notification sent');
		if (activeFilter === 'errors')   return log.level === 'error';
		return true;
	}));

	function fmt(d: string) {
		return new Date(d).toLocaleString('en-US', {
			month: 'short', day: 'numeric',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
		});
	}
</script>

<svelte:head>
	<title>Logs — MyFlightTracker</title>
</svelte:head>

<div class="page">
	<a href="/" class="back">← All flights</a>

	<div class="page-header">
		<h1>Poll Logs</h1>
		<div class="worker-control">
			<span class="worker-label">
				{workerState === 'running' ? 'Worker running' : workerState === 'stopped' ? 'Worker stopped' : 'Worker unknown'}
			</span>
			<button
				class="toggle"
				class:on={workerState === 'running'}
				class:loading={workerLoading}
				onclick={toggleWorker}
				disabled={workerLoading || workerState === 'unknown'}
				aria-label={workerState === 'running' ? 'Stop worker' : 'Start worker'}
			>
				<span class="toggle-thumb"></span>
			</button>
			{#if workerError}
				<span class="worker-error">{workerError}</span>
			{/if}
		</div>
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
</div>

<style>
	.page {
		max-width: 800px;
	}

	.back {
		display: inline-block;
		margin-bottom: 20px;
		color: #6b7280;
		font-size: 0.9rem;
		transition: color 0.15s;
	}

	.back:hover { color: #111827; }

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.worker-control {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.worker-label {
		font-size: 0.8rem;
		color: #6b7280;
	}

	.toggle {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 999px;
		border: none;
		background: #d1d5db;
		cursor: pointer;
		transition: background 0.25s;
		flex-shrink: 0;
		padding: 0;
	}

	.toggle.on {
		background: #22c55e;
	}

	.toggle:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.toggle.loading {
		opacity: 0.6;
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
		transition: transform 0.25s;
	}

	.toggle.on .toggle-thumb {
		transform: translateX(18px);
	}

	.worker-error {
		font-size: 0.75rem;
		color: #ef4444;
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
