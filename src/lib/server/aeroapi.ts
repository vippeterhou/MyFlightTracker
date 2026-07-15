import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { lookupAirportTz } from './airportTz';

const AEROAPI_BASE = 'https://aeroapi.flightaware.com/aeroapi';
const _db = new PrismaClient();

function logApiCall(endpoint: string, flightId: string | null, durationMs: number, success: boolean, httpStatus: number | null) {
	_db.apiCall.create({
		data: { endpoint, flightId, durationMs, success, httpStatus },
	}).catch((err) => {
		console.error('[aeroapi] Failed to log API call:', err);
	});
}

// Capture native fetch at module load time so SvelteKit's DEV-mode SSR patch
// (applied during options.root.render) never intercepts server-side AeroAPI calls.
const _fetch = fetch;

// Rate limiter: max 10 QPM → enforce ≥6.5 s between calls
let _lastAeroCall = 0;
async function aeroFetch(url: string, apiKey: string): Promise<Response> {
	const gap = 6500 - (Date.now() - _lastAeroCall);
	if (gap > 0) await new Promise((r) => setTimeout(r, gap));
	_lastAeroCall = Date.now();
	return _fetch(url, { headers: { 'x-apikey': apiKey } });
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

	await logger.info(`[API] Status: ${flightId}`, flightId);
	const t0 = Date.now();
	const res = await aeroFetch(url, apiKey);
	logApiCall('status', flightId, Date.now() - t0, res.ok || res.status === 404, res.status);

	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${await res.text()}`);

	const data = await res.json();
	return (data.flights as AeroFlight[])[0] ?? null;
}

export interface AeroSchedule {
	ident: string;
	ident_icao: string | null;
	ident_iata: string | null;
	actual_ident: string | null;
	origin: string | null;
	origin_iata: string | null;
	destination: string | null;
	destination_iata: string | null;
	scheduled_out: string | null;
	scheduled_in: string | null;
	aircraft_type: string | null;
	fa_flight_id: string | null;
}

// Published airline schedules, available up to ~1 year ahead (unlike /flights/{ident},
// which only has data ~2 days out). Returns airport CODES and scheduled times only — no
// city names or timezones. Used to populate route info for far-future flights.
export async function getFlightSchedule(flightId: string, date: Date): Promise<AeroSchedule | null> {
	const apiKey = process.env.AEROAPI_KEY;
	if (!apiKey) throw new Error('AEROAPI_KEY not set');

	// The schedules endpoint has no ident filter — split "UA2402" into carrier + number.
	const m = flightId.match(/^([A-Za-z]+)0*(\d+)$/);
	if (!m) return null;
	const airline = m[1].toUpperCase();
	const flightNumber = m[2];

	// The user's entered date is a LOCAL calendar day, but the schedules endpoint filters
	// by UTC day. A local-day departure can land on the UTC day before or after (e.g. an
	// evening Americas departure at 00:50Z shows on the next UTC date; an early Asia
	// departure on the previous one), so query a widened window (day-1 … day+2) and select
	// the instance whose origin-LOCAL date matches. Results are paginated (15 per page) and
	// bloated by codeshares, so follow pages until we find a match, capped to bound quota.
	const wantDay = date.toISOString().split('T')[0];
	const startStr = new Date(date.getTime() - 86400000).toISOString().split('T')[0];
	const endStr = new Date(date.getTime() + 2 * 86400000).toISOString().split('T')[0];

	const isThisFlight = (s: AeroSchedule) =>
		[s.ident, s.ident_iata, s.ident_icao, s.actual_ident].includes(flightId);

	const localDay = (s: AeroSchedule) => {
		if (!s.scheduled_out) return null;
		const tz = lookupAirportTz(s.origin_iata ?? s.origin);
		return new Date(s.scheduled_out).toLocaleDateString('en-CA', { timeZone: tz ?? 'UTC' });
	};

	const MAX_PAGES = 4;
	let nextPath: string | null =
		`/schedules/${startStr}/${endStr}?airline=${encodeURIComponent(airline)}&flight_number=${flightNumber}`;
	let firstMatch: AeroSchedule | null = null;

	for (let page = 0; page < MAX_PAGES && nextPath; page++) {
		await logger.info(`[API] Schedule: ${flightId}`, flightId);
		const t0 = Date.now();
		const res: Response = await aeroFetch(`${AEROAPI_BASE}${nextPath}`, apiKey);
		logApiCall('schedule', flightId, Date.now() - t0, res.ok || res.status === 404, res.status);

		if (res.status === 404) return firstMatch;
		if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${await res.text()}`);

		const data = await res.json();
		const list = (data.scheduled ?? []) as AeroSchedule[];
		const candidates = list.filter(isThisFlight);

		// Prefer the instance whose origin-local departure date matches the entered date.
		const exact = candidates.find((s) => localDay(s) === wantDay);
		if (exact) return exact;

		// Remember the first candidate seen as a fallback if no exact local-date match exists.
		if (!firstMatch && candidates.length > 0) firstMatch = candidates[0];

		nextPath = (data.links?.next as string | undefined) ?? null;
	}

	return firstMatch;
}


export interface TrackPoint {
	timestamp: string;
	lat: number;
	lon: number;
	altitude: number;
	groundspeed: number;
	heading: number;
}

export async function getFlightTrack(faFlightId: string, flightId?: string): Promise<TrackPoint[]> {
	const apiKey = process.env.AEROAPI_KEY;
	if (!apiKey) throw new Error('AEROAPI_KEY not set');

	await logger.info(`[API] Route: ${flightId ?? faFlightId}`, flightId ?? faFlightId);
	const url = `${AEROAPI_BASE}/flights/${encodeURIComponent(faFlightId)}/track`;

	const t0 = Date.now();
	const res = await aeroFetch(url, apiKey);
	logApiCall('route', flightId ?? faFlightId, Date.now() - t0, res.ok || res.status === 404, res.status);

	if (res.status === 404) return [];
	if (!res.ok) throw new Error(`AeroAPI ${res.status}: ${await res.text()}`);

	const data = await res.json();
	return (data.positions ?? []).map((p: Record<string, unknown>) => ({
		timestamp: p.timestamp as string,
		lat: p.latitude as number,
		lon: p.longitude as number,
		altitude: p.altitude as number,
		groundspeed: p.groundspeed as number,
		heading: p.heading as number,
	}));
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
