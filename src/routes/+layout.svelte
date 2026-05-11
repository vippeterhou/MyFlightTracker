<script lang="ts">
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 60000);
		return () => clearInterval(t);
	});

	let tooltip = $derived.by(() => {
		if (!data.lastChecked) return 'Never polled';
		const mins = Math.round((now - new Date(data.lastChecked).getTime()) / 60000);
		if (mins < 1) return 'Updated just now';
		if (mins === 1) return 'Updated 1 min ago';
		return `Updated ${mins} mins ago`;
	});

	let active = $derived(data.workerState === 'running');
</script>

<main>
	<header>
		<a href="/" class="brand">✈️ MyFlightTracker</a>
		<div class="nav-right">
			<span class="status-dot-wrap" data-tooltip={tooltip}>
				<span class="status-dot" class:active></span>
			</span>
			<a href="/logs" class="nav-logs">Logs</a>
		</div>
	</header>
	{@render children()}
</main>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f3f4f6;
		color: #111827;
		min-height: 100vh;
	}

	:global(a) {
		color: inherit;
		text-decoration: none;
	}

	header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 20px 0 16px;
		margin-bottom: 8px;
	}

	.brand {
		grid-column: 2;
		font-size: 1.6rem;
		font-weight: 700;
		transition: opacity 0.15s;
	}

	.brand:hover {
		opacity: 0.7;
	}

	.nav-right {
		grid-column: 3;
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.status-dot-wrap {
		position: relative;
		display: flex;
		align-items: center;
		cursor: default;
	}

	.status-dot-wrap::after {
		content: attr(data-tooltip);
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		background: #1f2937;
		color: #f9fafb;
		font-size: 0.75rem;
		white-space: nowrap;
		padding: 4px 8px;
		border-radius: 5px;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.status-dot-wrap:hover::after {
		opacity: 1;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #d1d5db;
	}

	.status-dot.active {
		background: #22c55e;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
		50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
	}

	.nav-logs {
		font-size: 0.85rem;
		color: #9ca3af;
		transition: color 0.15s;
	}

	.nav-logs:hover {
		color: #111827;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 16px 28px;
	}
</style>
