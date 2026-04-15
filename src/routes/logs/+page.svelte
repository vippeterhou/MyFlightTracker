<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const LEVEL_COLOR: Record<string, string> = {
		info:  '#6b7280',
		warn:  '#d97706',
		error: '#ef4444',
	};

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
	<h1>Poll Logs</h1>

	{#if data.logs.length === 0}
		<p class="empty">No logs yet — the worker hasn't run.</p>
	{:else}
		<div class="log-list">
			{#each data.logs as log}
				<div class="row">
					<span class="ts">{fmt(log.timestamp)}</span>
					{#if log.flightId}
						<span class="flight">{log.flightId}</span>
					{/if}
					<span class="msg" style="color: {LEVEL_COLOR[log.level] ?? '#111827'}">{log.message}</span>
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

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 20px;
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
		gap: 12px;
		align-items: baseline;
		background: white;
		padding: 8px 12px;
		border-radius: 6px;
	}

	.ts {
		color: #9ca3af;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.flight {
		color: #3b82f6;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
		min-width: 60px;
	}

	.msg {
		flex: 1;
	}

	.empty {
		color: #9ca3af;
	}
</style>
