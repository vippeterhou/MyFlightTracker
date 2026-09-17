<script lang="ts">
	import { navigating } from '$app/stores';
	import type { LayoutData } from './$types';

	let { children, data }: { children: any; data: LayoutData } = $props();

	let workerRunning = $state(false);

	$effect(() => {
		workerRunning = data.workerState === 'running';
	});

	$effect(() => {
		let mounted = true;
		const refresh = async () => {
			try {
				const res = await fetch('/api/status');
				if (mounted && res.ok) {
					const status = await res.json();
					workerRunning = status.workerState === 'running';
				}
			} catch {}
		};
		void refresh();
		const t = setInterval(refresh, 60000);
		return () => {
			mounted = false;
			clearInterval(t);
		};
	});

	let tooltip = $derived(workerRunning ? 'Worker running' : 'Worker stopped');
</script>

{#if $navigating}
	<div class="navigation-progress" role="progressbar" aria-label="Loading page"></div>
{/if}

<main>
	<header>
		<a href="/" class="brand">
			<img src="/favicon.svg" alt="" class="brand-icon" />
			<span class="brand-text">
				<span class="brand-name">
					Contrail
					<span class="status-dot-wrap" data-tooltip={tooltip}>
						<span class="status-dot" class:active={workerRunning}></span>
					</span>
				</span>
				<span class="tagline">Your Flight. Tracked.</span>
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

	.navigation-progress {
		position: fixed;
		inset: 0 0 auto;
		z-index: 2000;
		height: 3px;
		overflow: hidden;
		background: rgba(59, 130, 246, 0.18);
	}

	.navigation-progress::after {
		content: '';
		display: block;
		width: 35%;
		height: 100%;
		background: #3b82f6;
		animation: navigation-loading 0.9s ease-in-out infinite;
	}

	@keyframes navigation-loading {
		from { transform: translateX(-100%); }
		to { transform: translateX(385%); }
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
		display: inline-flex;
		align-items: center;
		gap: 12px;
		transition: opacity 0.15s;
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	.brand-name {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		font-size: 1.6rem;
		font-weight: 700;
		line-height: 1;
	}

	.tagline {
		font-size: 0.8rem;
		font-weight: 500;
		color: #9ca3af;
		letter-spacing: 0.02em;
	}

	.brand-icon {
		width: 44px;
		height: 44px;
		border-radius: 8px;
		display: block;
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
