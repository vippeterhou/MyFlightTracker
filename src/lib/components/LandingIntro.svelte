<script lang="ts">
	import { onMount } from 'svelte';

	let visible = $state(true);
	let finishing = $state(false);
	let motionEl = $state<SVGElement | undefined>(undefined);

	const animationKeyTimes = '0;0.12;0.8;1';
	const animationKeySplines = '0.4 0 0.6 1;0.25 0.1 0.25 1;0.4 0 0.2 1';
	const contrailProgress = '1;0.82;0.3;0';
	const contrailDuration = '2.45s';
	const contrailDelay = '0.08s';
	let restoreBodyOverflow = () => {};

	const handleFadeEnd = (event: AnimationEvent) => {
		if (event.animationName !== 'intro-fade') return;
		visible = false;
		restoreBodyOverflow();
	};

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			visible = false;
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		let overflowRestored = false;
		restoreBodyOverflow = () => {
			if (overflowRestored) return;
			overflowRestored = true;
			document.body.style.overflow = previousOverflow;
		};
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			finishing = true;
		};
		motionEl?.addEventListener('endEvent', finish, { once: true });
		const fallbackTimer = window.setTimeout(finish, 4000);

		return () => {
			motionEl?.removeEventListener('endEvent', finish);
			window.clearTimeout(fallbackTimer);
			restoreBodyOverflow();
		};
	});
</script>

{#if visible}
	<div class="intro" class:finishing aria-hidden="true" onanimationend={handleFadeEnd}>
		<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
			<defs>
				<filter id="plane-shadow" x="-40%" y="-40%" width="180%" height="180%">
					<feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1e3a5f" flood-opacity="0.28" />
				</filter>
			</defs>

			<path
				id="intro-flight-path"
				class="contrail contrail-wide"
				pathLength="1"
				stroke-dasharray="1"
				stroke-dashoffset="1"
				d="M -80 340
					C 120 340 270 360 400 360
					C 441 360 475 326 475 285
					C 475 244 441 210 400 210
					C 359 210 325 244 325 285
					C 325 326 359 360 400 360
					C 555 360 735 120 1080 -30"
			>
				<animate
					attributeName="stroke-dashoffset"
					values={contrailProgress}
					dur={contrailDuration}
					begin={contrailDelay}
					fill="freeze"
					calcMode="spline"
					keyTimes={animationKeyTimes}
					keySplines={animationKeySplines}
				/>
			</path>
			<path
				class="contrail contrail-fine"
				pathLength="1"
				stroke-dasharray="1"
				stroke-dashoffset="1"
				d="M -90 362
					C 110 362 260 375 400 375
					C 450 375 490 335 490 285
					C 490 235 450 195 400 195
					C 350 195 310 235 310 285
					C 310 335 350 375 400 375
					C 555 375 735 138 1120 -39"
			>
				<animate
					attributeName="stroke-dashoffset"
					values={contrailProgress}
					dur={contrailDuration}
					begin={contrailDelay}
					fill="freeze"
					calcMode="spline"
					keyTimes={animationKeyTimes}
					keySplines={animationKeySplines}
				/>
			</path>

			<g opacity="0" filter="url(#plane-shadow)">
				<g transform="rotate(90)">
					<path
						d="M0 -25 C4.6 -25 6.5 -17 6.5 -8 L19 4 L19 10 L6.5 5
							L6.5 16 L12 22 L12 26 L0 23 L-12 26 L-12 22 L-6.5 16
							L-6.5 5 L-19 10 L-19 4 L-6.5 -8 C-6.5 -17 -4.6 -25 0 -25 Z"
						fill="#2f80d8"
					/>
				</g>
				<animateMotion
					bind:this={motionEl}
					dur="2.5s"
					begin="0s"
					rotate="auto"
					fill="freeze"
					calcMode="spline"
					keyPoints="0;0.18;0.7;1"
					keyTimes={animationKeyTimes}
					keySplines={animationKeySplines}
				>
					<mpath href="#intro-flight-path" />
				</animateMotion>
				<animate attributeName="opacity" from="0" to="1" dur="0.01s" begin="0.01s" fill="freeze" />
			</g>
		</svg>
	</div>
{/if}

<style>
	.intro {
		position: fixed;
		inset: 0;
		z-index: 3000;
		overflow: hidden;
		background: #f3f4f6;
	}

	.intro.finishing {
		animation: intro-fade 0.35s ease forwards;
	}

	svg {
		width: 100%;
		height: 100%;
	}

	.contrail {
		fill: none;
		stroke: #6eb7f7;
		stroke-linecap: round;
	}

	.contrail-wide {
		stroke-width: 7;
		opacity: 0.34;
	}

	.contrail-fine {
		stroke-width: 4;
		opacity: 0.2;
	}

	@keyframes intro-fade {
		from { opacity: 1; }
		to { opacity: 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.intro {
			display: none;
		}
	}
</style>
