import { db } from './db';
import { getFlightByIdent, mapAeroStatus } from './aeroapi';

export async function pollOneFlight(id: string): Promise<void> {
	const flight = await db.trackedFlight.findUnique({
		where: { id },
		include: { status: true },
	});
	if (!flight) return;

	const aero = await getFlightByIdent(flight.flightId, flight.date);
	if (!aero) return;

	const newStatus = mapAeroStatus(aero);

	await db.flightStatus.upsert({
		where: { trackedFlightId: flight.id },
		create: {
			trackedFlightId: flight.id,
			status: newStatus,
			boardingAt: newStatus === 'boarding' ? new Date() : null,
			departureAirport: aero.origin?.code_iata ?? null,
			arrivalAirport: aero.destination?.code_iata ?? null,
			departureTz: aero.origin?.timezone ?? null,
			arrivalTz: aero.destination?.timezone ?? null,
			departureGate: aero.gate_origin ?? null,
			arrivalGate: aero.gate_destination ?? null,
			scheduledDep: aero.scheduled_out ? new Date(aero.scheduled_out) : null,
			estimatedDep: aero.estimated_out ? new Date(aero.estimated_out) : null,
			actualDep: aero.actual_out ? new Date(aero.actual_out) : null,
			wheelsOff: aero.actual_off ? new Date(aero.actual_off) : null,
			wheelsOn: aero.actual_on ? new Date(aero.actual_on) : null,
			scheduledArr: aero.scheduled_in ? new Date(aero.scheduled_in) : null,
			estimatedArr: aero.estimated_in ? new Date(aero.estimated_in) : null,
			actualArr: aero.actual_in ? new Date(aero.actual_in) : null,
			aircraftType: aero.aircraft_type ?? null,
			baggageClaim: aero.baggage_claim ?? null,
		},
		update: {
			status: newStatus,
			departureAirport: aero.origin?.code_iata ?? null,
			arrivalAirport: aero.destination?.code_iata ?? null,
			departureTz: aero.origin?.timezone ?? null,
			arrivalTz: aero.destination?.timezone ?? null,
			departureGate: aero.gate_origin ?? null,
			arrivalGate: aero.gate_destination ?? null,
			scheduledDep: aero.scheduled_out ? new Date(aero.scheduled_out) : null,
			estimatedDep: aero.estimated_out ? new Date(aero.estimated_out) : null,
			actualDep: aero.actual_out ? new Date(aero.actual_out) : null,
			wheelsOff: aero.actual_off ? new Date(aero.actual_off) : null,
			wheelsOn: aero.actual_on ? new Date(aero.actual_on) : null,
			scheduledArr: aero.scheduled_in ? new Date(aero.scheduled_in) : null,
			estimatedArr: aero.estimated_in ? new Date(aero.estimated_in) : null,
			actualArr: aero.actual_in ? new Date(aero.actual_in) : null,
			aircraftType: aero.aircraft_type ?? null,
			baggageClaim: aero.baggage_claim ?? null,
			lastChecked: new Date(),
		},
	});
}
