<script lang="ts">
	import { navHint } from '$lib/stores/navHint';
	let { children } = $props();
</script>

<nav>
	<a href="/" class="brand">✈️ MyFlightTracker</a>
	{#if $navHint}
		<span class="nav-hint">{$navHint}</span>
	{/if}
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
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-hint {
		font-size: 0.72rem;
		color: #9ca3af;
	}

	.brand {
		font-size: 1.1rem;
		font-weight: 700;
		transition: opacity 0.15s;
	}

	.brand:hover {
		opacity: 0.7;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 28px 16px;
	}
</style>
