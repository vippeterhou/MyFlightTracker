<script lang="ts">
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let workerRunning = $state(false);

	$effect(() => {
		workerRunning = data.workerState === 'running';
	});

	// Poll every 60s to keep the dot live between page loads
	$effect(() => {
		const t = setInterval(async () => {
			try {
				const res = await fetch('/api/status');
				if (res.ok) {
					const status = await res.json();
					workerRunning = status.workerState === 'running';
				}
			} catch {}
		}, 60000);
		return () => clearInterval(t);
	});

	let tooltip = $derived(workerRunning ? 'Worker running' : 'Worker stopped');
</script>

<main>
	<header>
		<a href="/" class="brand">
			✈️&nbsp; My Flight Tracker
			<span class="status-dot-wrap" data-tooltip={tooltip}>
				<span class="status-dot" class:active={workerRunning}></span>
			</span>
		</a>
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
		display: flex;
		justify-content: center;
		padding: 20px 0 16px;
		margin-bottom: 8px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		font-size: 1.6rem;
		font-weight: 700;
		transition: opacity 0.15s;
	}

	.brand:hover {
		opacity: 0.7;
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
		left: 50%;
		transform: translateX(-50%);
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

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 16px 28px;
	}
</style>
