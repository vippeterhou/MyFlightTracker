<script lang="ts">
	import BackButton from '$lib/components/BackButton.svelte';
	import FlightDetailPage from '$lib/components/FlightDetailPage.svelte';
	import PageLoadState from '$lib/components/PageLoadState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Flight — Contrail</title></svelte:head>

<BackButton />

{#await data.flight}
	<PageLoadState message="Loading flight details..." />
{:then flight}
	<FlightDetailPage {flight} track={data.track} />
{:catch}
	<PageLoadState message="Flight not found or couldn't be loaded." error />
{/await}
