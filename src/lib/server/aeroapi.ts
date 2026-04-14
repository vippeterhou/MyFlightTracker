const AEROAPI_BASE = 'https://aeroapi.flightaware.com/aeroapi';

// Rate limiter: max 10 QPM → enforce ≥6.5 s between calls
let _lastAeroCall = 0;
async function aeroFetch(url: string, apiKey: string): Promise<Response> {
	const gap = 6500 - (Date.now() - _lastAeroCall);
	if (gap > 0) await new Promise((r) => setTimeout(r, gap));
	_lastAeroCall = Date.now();
	return fetch(url, { headers: { 'x-apikey': apiKey } });
}

export interface AeroFlight {
	ident: string;
	ident_icao: string | null;
	ident_iata: string | null;
	fa_flight_id: string;
	status: string;
	cancelled: boolean;
	diverted: boolean;
	origin: { code_iata: string; name: string; city: string; timezone: string; latitude: number | null; longitude: number | null } | null;
	destination: { code_iata: string; name: string; city: string; timezone: string; latitude: number | null; longitude: number | null } | null;
	gate_origin: string | null;
	gate_destination: string | null;
	aircraft_type: string | null;
	baggage_claim: string | null;
	scheduled_out: string | null;
	estimated_out: string | null;
	actual_out: string | null;
	scheduled_off: string | null;
	estimated_off: string | null;
	actual_off: string | null;
	scheduled_on: string | null;
	estimated_on: string | null;
	actual_on: string | null;
	scheduled_in: string | null;
	estimated_in: string | null;
	actual_in: string | null;
}

export async function getFlightByIdent(flightId: string, date: Date): Promise<AeroFlight | null> {
	const apiKey = process.env.AEROAPI_KEY;
	if (!apiKey) throw new Error('AEROAPI_KEY not set');

	const dateStr = date.toISOString().split('T')[0];
	// Search a window: from midnight to end of that day
	const start = `${dateStr}T00:00:00Z`;
	const end = `${dateStr}T23:59:59Z`;

	const url = `${AEROAPI_BASE}/flights/${encodeURIComponent(flightId)}?start=${start}&end=${end}`;

	const res = await aeroFetch(url, apiKey);

	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${await res.text()}`);

	const data = await res.json();
	return (data.flights as AeroFlight[])[0] ?? null;
}


export function mapAeroStatus(flight: AeroFlight): string {
	if (flight.cancelled) return 'cancelled';
	if (flight.diverted) return 'diverted';

	// If wheels-on recorded and gate-in not yet: landed
	if (flight.actual_on && !flight.actual_in) return 'landed';
	// If gate-in recorded: arrived
	if (flight.actual_in) return 'arrived';
	// If wheels-off recorded: airborne
	if (flight.actual_off) return 'airborne';
	// If gate-out recorded (pushed back): departed
	if (flight.actual_out) return 'departed';

	const s = (flight.status ?? '').toLowerCase();
	if (s.includes('boarding')) return 'boarding';
	if (s.includes('delay')) return 'delayed';
	if (s.includes('en route') || s.includes('airborne')) return 'airborne';
	if (s.includes('landed')) return 'landed';
	if (s.includes('arrived')) return 'arrived';
	if (s.includes('taxiing')) return 'departed';

	return 'scheduled';
}
