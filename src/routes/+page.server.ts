import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

// Every FlightStatus field except the heavy `trackData` blob (route points). The
// dashboard grid never needs it, and the timeline lazy-loads it per flight via
// /api/flights/[id]/track — so we keep it out of this list to shrink the payload.
const statusSelect = {
	id: true,
	trackedFlightId: true,
	status: true,
	departureAirport: true,
	arrivalAirport: true,
	departureCity: true,
	arrivalCity: true,
	departureTz: true,
	arrivalTz: true,
	departureGate: true,
	arrivalGate: true,
	boardingAt: true,
	scheduledDep: true,
	estimatedDep: true,
	actualDep: true,
	wheelsOff: true,
	wheelsOn: true,
	scheduledArr: true,
	estimatedArr: true,
	actualArr: true,
	aircraftType: true,
	baggageClaim: true,
	faFlightId: true,
	statusChangedAt: true,
	lastChecked: true,
	updatedAt: true,
} as const;

export const load: PageServerLoad = () => {
	const flights = Promise.all([
		db.trackedFlight.findMany({ include: { status: { select: statusSelect } } }),
		db.$queryRaw<{ trackedFlightId: string }[]>`
				SELECT "trackedFlightId"
				FROM "FlightStatus"
				WHERE "trackData" IS NOT NULL
					AND jsonb_typeof("trackData") = 'array'
					AND jsonb_array_length("trackData") >= 2`,
	]).then(([trackedFlights, withTrack]) => {
		const trackSet = new Set(withTrack.map((t) => t.trackedFlightId));
		const flightsWithFlags = trackedFlights.map((f) => ({
			...f,
			status: f.status ? { ...f.status, hasTrack: trackSet.has(f.id) } : null,
		}));

		return JSON.parse(JSON.stringify(flightsWithFlags));
	});

	return { flights };
};
