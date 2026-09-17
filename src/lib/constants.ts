export const INPUT_LIMITS = {
	FLIGHT_LABEL: 30,
	TODO_TEXT: 200,
} as const;

export const DATABASE_POOL = {
	CONNECTION_LIMIT: 2,
	TIMEOUT_SECONDS: 10,
} as const;

export const MAP_OPTIONS = {
	INTERACTIVE: {
		zoomSnap: 0.1,
		zoomAnimation: false,
		wheelDebounceTime: 0,
		wheelPxPerZoomLevel: 40,
	},
} as const;

export const POLL_SNAPSHOT = {
	PREFIX: 'Poll snapshot:',
	EMPTY: 'no flights required polling',
	SEPARATOR: ' | ',
} as const;
