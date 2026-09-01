<script lang="ts">
	let {
		href = '/',
		label = 'All flights',
	}: {
		href?: string;
		label?: string;
	} = $props();
</script>

<a {href} class="back"><span class="arrow">←</span> {label}</a>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 20px;
		padding: 8px 16px;
		color: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		background: #3b82f6;
		border-radius: 999px;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
		transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
	}

	.back:hover {
		background: #2563eb;
		box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
		transform: translateY(-1px);
	}

	.back:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
	}

	.back .arrow {
		display: inline-block;
		font-size: 1.3rem;
		line-height: 1;
		transition: transform 0.15s;
	}

	.back:hover .arrow {
		transform: translateX(-3px);
	}
</style>
