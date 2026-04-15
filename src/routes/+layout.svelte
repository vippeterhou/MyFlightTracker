<script lang="ts">
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	const POLL_INTERVAL_MS = 10 * 60 * 1000;
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	let hint = $derived(() => {
		if (data.activeCount === 0) return 'No active flights';
		if (!data.lastChecked) return null;
		const diff = new Date(data.lastChecked).getTime() + POLL_INTERVAL_MS - now;
		if (diff <= 0) return 'Refresh to update';
		const m = Math.floor(diff / 60000);
		const s = Math.floor((diff % 60000) / 1000);
		return `Next poll in ${m}:${s.toString().padStart(2, '0')}`;
	});
</script>

<nav>
	<div class="nav-center">
		<a href="/" class="brand">✈️ MyFlightTracker</a>
		{#if hint()}
			<span class="nav-hint">{hint()}</span>
		{/if}
	</div>
	<a href="/logs" class="nav-logs">Logs</a>
</nav>

<main>
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

	nav {
		background: white;
		border-bottom: 1px solid #e5e7eb;
		padding: 8px 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		flex: 1;
	}

	.brand {
		font-size: 1.1rem;
		font-weight: 700;
		transition: opacity 0.15s;
	}

	.brand:hover {
		opacity: 0.7;
	}

	.nav-hint {
		font-size: 0.72rem;
		color: #9ca3af;
	}

	.nav-logs {
		font-size: 0.85rem;
		color: #9ca3af;
		position: absolute;
		right: 20px;
		transition: color 0.15s;
	}

	.nav-logs:hover {
		color: #111827;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 28px 16px;
	}
</style>
