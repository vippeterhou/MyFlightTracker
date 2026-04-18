import { PrismaClient } from '@prisma/client';
import { getFlightByIdent, mapAeroStatus } from '../src/lib/server/aeroapi.js';
import { sendMessage, buildNotification } from '../src/lib/server/telegram.js';
import { logger } from '../src/lib/server/logger.js';

const db = new PrismaClient();

// Statuses that warrant a Telegram notification on transition
const NOTIFY_STATUSES = new Set([
	'boarding', 'departed', 'airborne', 'landed', 'arrived', 'cancelled', 'delayed', 'diverted',
]);

// Statuses where we stop polling (terminal states)
const TERMINAL_STATUSES = new Set(['arrived', 'cancelled']);

export async function pollFlightStatuses(): Promise<boolean> {
	const flights = await db.trackedFlight.findMany({
		include: { status: true },
	});

	const now = Date.now();
	const active = flights.filter((f) => {
		if (TERMINAL_STATUSES.has(f.status?.status ?? '')) return false;

		// If already in-progress (has a non-scheduled status), always poll
		const s = f.status?.status;
		if (s && s !== 'scheduled') return true;

		// For scheduled/unknown flights: only poll within 4 hours of scheduled departure
		const sched = f.status?.scheduledDep;
		if (sched) {
			const hoursUntil = (sched.getTime() - now) / (1000 * 60 * 60);
			if (hoursUntil > 4) {
				logger.info(`Skipping — departs in ${hoursUntil.toFixed(1)}h`, f.flightId);
				return false;
			}
		}

		return true;
	});

	if (active.length === 0) {
		return false;
	}

	await logger.info(`Polling ${active.map(f => f.flightId).join(', ')}`);

	for (const flight of active) {
		try {
			const aero = await getFlightByIdent(flight.flightId, flight.date);
			if (!aero) {
				await logger.warn('No data returned from AeroAPI', flight.flightId);
				continue;
			}

			const newStatus = mapAeroStatus(aero);
			const prevStatus = flight.status?.status;

			const statusData = {
				status: newStatus,
				boardingAt: newStatus === 'boarding' && prevStatus !== 'boarding'
					? new Date()
					: (flight.status?.boardingAt ?? null),
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
			};

			await db.flightStatus.upsert({
				where: { trackedFlightId: flight.id },
				create: { trackedFlightId: flight.id, ...statusData },
				update: statusData,
			});

			await logger.info(`Status: ${prevStatus ?? 'new'} → ${newStatus}`, flight.flightId);

			if (prevStatus !== newStatus && NOTIFY_STATUSES.has(newStatus)) {
				const msg = buildNotification(flight.flightId, newStatus, {
					label: flight.label,
					from: aero.origin?.code_iata,
					to: aero.destination?.code_iata,
					gate: aero.gate_origin,
					estimatedArr: statusData.estimatedArr,
					actualArr: statusData.actualArr,
					arrivalTz: statusData.arrivalTz,
					baggageClaim: statusData.baggageClaim,
				});
				await sendMessage(msg);
				await logger.info(`Telegram notification sent: ${newStatus}`, flight.flightId);
			}
		} catch (err) {
			await logger.error(`${(err as Error).message}`, flight.flightId);
		}
	}

	return true;
}
