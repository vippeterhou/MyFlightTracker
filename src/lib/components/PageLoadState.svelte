<script lang="ts">
	let {
		message,
		error = false,
	}: {
		message: string;
		error?: boolean;
	} = $props();
</script>

{#if !error}
	<div class="page-progress" role="progressbar" aria-label={message}></div>
{/if}

<div class="loading" class:error aria-live="polite">
	{#if !error}
		<span class="spinner"></span>
	{/if}
	{message}
</div>

<style>
	.page-progress {
		position: fixed;
		inset: 0 0 auto;
		z-index: 2000;
		height: 3px;
		overflow: hidden;
		background: rgba(59, 130, 246, 0.18);
	}

	.page-progress::after {
		content: '';
		display: block;
		width: 35%;
		height: 100%;
		background: #3b82f6;
		animation: progress 0.9s ease-in-out infinite;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 240px;
		color: #6b7280;
	}

	.loading.error {
		color: #ef4444;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #e5e7eb;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes progress {
		from { transform: translateX(-100%); }
		to { transform: translateX(385%); }
	}
</style>
