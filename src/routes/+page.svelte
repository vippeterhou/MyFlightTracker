<script lang="ts">
	import HomePageContent from '$lib/components/HomePageContent.svelte';
	import LandingIntro from '$lib/components/LandingIntro.svelte';
	import PageLoadState from '$lib/components/PageLoadState.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Contrail</title>
</svelte:head>

{#if data.showLandingIntro}
	<LandingIntro />
{/if}

{#await data.flights}
	<PageLoadState message="Loading flights..." />
{:then flights}
	<HomePageContent {flights} />
{:catch}
	<PageLoadState message="Couldn't load flights. Please refresh to try again." error />
{/await}
