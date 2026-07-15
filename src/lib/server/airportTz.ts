import airports from 'airport-timezone/airports.json';

interface AirportTzEntry {
	code: string;
	countryCode?: string;
	timezone: string;
}

// AeroAPI's /schedules feed returns airport codes but no timezone (unlike the live
// /flights endpoint). This bundled dataset maps IATA code → IANA timezone name, which
// lets toLocaleString resolve DST correctly. Airport timezones are effectively static,
// so no API calls or maintenance are needed. Built once at module load.
const tzByCode = new Map<string, string>();
for (const a of airports as AirportTzEntry[]) {
	if (a.code && a.timezone && !tzByCode.has(a.code)) {
		tzByCode.set(a.code, a.timezone);
	}
}

// Resolves an IATA airport code to its IANA timezone (e.g. "SFO" → "America/Los_Angeles"),
// or null if unknown.
export function lookupAirportTz(code: string | null | undefined): string | null {
	if (!code) return null;
	return tzByCode.get(code.toUpperCase()) ?? null;
}
