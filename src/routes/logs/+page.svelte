<script lang="ts">
	import BackButton from '$lib/components/BackButton.svelte';
	import LogsPageContent from '$lib/components/LogsPageContent.svelte';
	import PageLoadState from '$lib/components/PageLoadState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Logs — Contrail</title>
</svelte:head>

<BackButton />

{#await data.content}
	<PageLoadState message="Loading logs..." />
{:then content}
	<LogsPageContent {...content} routes={data.routes} />
{:catch}
	<PageLoadState message="Couldn't load logs. Please refresh to try again." error />
{/await}
