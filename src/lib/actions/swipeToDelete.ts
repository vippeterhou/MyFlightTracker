interface SwipeToDeleteOptions {
	onDelete: () => Promise<boolean>;
}

const SWIPE_LIMIT = 96;
const DELETE_THRESHOLD = 72;
const DIRECTION_THRESHOLD = 8;

export function swipeToDelete(node: HTMLElement, options: SwipeToDeleteOptions) {
	let currentOptions = options;
	let pointerId: number | undefined;
	let startX = 0;
	let startY = 0;
	let offset = 0;
	let horizontalSwipe = false;
	let suppressClick = false;
	let deleting = false;

	function setOffset(value: number, animate: boolean) {
		const progress = Math.min(Math.abs(value) / SWIPE_LIMIT, 1);
		const actionOffset = (1 - progress) * 24;
		const parent = node.parentElement;
		parent?.style.setProperty('--swipe-action-offset', `${actionOffset}px`);
		parent?.style.setProperty('--swipe-action-opacity', `${progress}`);
		parent?.style.setProperty(
			'--swipe-action-transition',
			animate ? 'transform 180ms ease, opacity 180ms ease' : 'none',
		);
		node.style.transition = animate
			? 'transform 180ms ease, box-shadow 150ms ease'
			: 'none';
		node.style.transform = value === 0 ? '' : `translate3d(${value}px, 0, 0)`;
	}

	function reset() {
		pointerId = undefined;
		offset = 0;
		horizontalSwipe = false;
		setOffset(0, true);
	}

	function handlePointerDown(event: PointerEvent) {
		if (deleting || event.pointerType !== 'touch' || event.button !== 0) return;
		pointerId = event.pointerId;
		startX = event.clientX;
		startY = event.clientY;
		offset = 0;
		horizontalSwipe = false;
	}

	function handlePointerMove(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;

		const deltaX = event.clientX - startX;
		const deltaY = event.clientY - startY;

		if (!horizontalSwipe) {
			if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DIRECTION_THRESHOLD) return;
			if (Math.abs(deltaY) >= Math.abs(deltaX)) {
				pointerId = undefined;
				return;
			}
			horizontalSwipe = true;
			node.setPointerCapture(event.pointerId);
		}

		event.preventDefault();
		offset = Math.max(-SWIPE_LIMIT, Math.min(0, deltaX));
		setOffset(offset, false);
	}

	async function handlePointerEnd(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;

		pointerId = undefined;
		if (!horizontalSwipe) return;

		suppressClick = true;
		setTimeout(() => (suppressClick = false), 0);

		if (offset > -DELETE_THRESHOLD) {
			reset();
			return;
		}

		deleting = true;
		setOffset(-node.offsetWidth, true);
		let deleted = false;
		try {
			deleted = await currentOptions.onDelete();
		} finally {
			deleting = false;
			if (!deleted) reset();
		}
	}

	function handlePointerCancel(event: PointerEvent) {
		if (event.pointerId === pointerId) reset();
	}

	function handleClick(event: MouseEvent) {
		if (!suppressClick) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		suppressClick = false;
	}

	node.addEventListener('pointerdown', handlePointerDown, true);
	node.addEventListener('pointermove', handlePointerMove, true);
	node.addEventListener('pointerup', handlePointerEnd, true);
	node.addEventListener('pointercancel', handlePointerCancel, true);
	node.addEventListener('click', handleClick, true);

	return {
		update(nextOptions: SwipeToDeleteOptions) {
			currentOptions = nextOptions;
		},
		destroy() {
			node.removeEventListener('pointerdown', handlePointerDown, true);
			node.removeEventListener('pointermove', handlePointerMove, true);
			node.removeEventListener('pointerup', handlePointerEnd, true);
			node.removeEventListener('pointercancel', handlePointerCancel, true);
			node.removeEventListener('click', handleClick, true);
			node.parentElement?.style.removeProperty('--swipe-action-offset');
			node.parentElement?.style.removeProperty('--swipe-action-opacity');
			node.parentElement?.style.removeProperty('--swipe-action-transition');
		},
	};
}
