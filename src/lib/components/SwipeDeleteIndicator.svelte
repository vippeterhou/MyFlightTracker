<div class="swipe-delete" aria-hidden="true">
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
		<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
		<path d="M10 11v6M14 11v6" />
	</svg>
</div>

<style>
	.swipe-delete {
		display: none;
	}

	@media (hover: none), (pointer: coarse) {
		.swipe-delete {
			position: absolute;
			top: 50%;
			right: 26px;
			z-index: 0;
			display: flex;
			width: 44px;
			height: 44px;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			background: #ef4444;
			color: white;
			opacity: var(--swipe-action-opacity, 0);
			transform: translateY(-50%) translateX(var(--swipe-action-offset, 24px));
			transition: var(--swipe-action-transition, none);
		}
	}
</style>
