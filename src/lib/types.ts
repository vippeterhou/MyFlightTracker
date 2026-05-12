export type FlightStatusType =
	| 'scheduled'
	| 'boarding'
	| 'departed'
	| 'airborne'
	| 'landed'
	| 'arrived'
	| 'cancelled'
	| 'delayed'
	| 'diverted';

export interface FlightStatus {
	id: string;
	trackedFlightId: string;
	status: FlightStatusType;
	departureAirport: string | null;
	arrivalAirport: string | null;
	departureTz: string | null;
	arrivalTz: string | null;
	departureGate: string | null;
	arrivalGate: string | null;
	boardingAt: string | null;
	scheduledDep: string | null;
	estimatedDep: string | null;
	actualDep: string | null;
	wheelsOff: string | null;
	wheelsOn: string | null;
	scheduledArr: string | null;
	estimatedArr: string | null;
	actualArr: string | null;
	aircraftType: string | null;
	baggageClaim: string | null;
	faFlightId: string | null;
	lastChecked: string;
	updatedAt: string;
}

export interface TrackedFlight {
	id: string;
	flightId: string;
	date: string;
	label: string | null;
	createdAt: string;
	status: FlightStatus | null;
}
