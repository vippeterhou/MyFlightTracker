import type { TrackedFlight } from './types';

type FlightLike = Pick<TrackedFlight, 'date' | 'status'>;

// The departure timestamp (preferring actual over scheduled) and its airport timezone,
// or null when AeroAPI hasn't returned data yet.
function departure(f: FlightLike): { ts: string; tz: string | null } | null {
	const s = f.status;
	if (!s) return null;
	const ts = s.actualDep ?? s.scheduledDep;
	if (!ts) return null;
	return { ts, tz: s.departureTz };
}

// Formats a flight's date. When the departure airport's timezone is known, the date is
// taken from the departure timestamp in that timezone so it matches the times shown on
// the card. Otherwise (e.g. future flights with only schedule data, which lacks a
// timezone) it falls back to the user-entered date (stored midnight UTC), rendered in
// UTC to avoid an off-by-one shift in the browser's local timezone.
export function flightDateLabel(f: FlightLike, opts: Intl.DateTimeFormatOptions): string {
	const dep = departure(f);
	if (dep && dep.tz) {
		return new Date(dep.ts).toLocaleDateString('en-US', { ...opts, timeZone: dep.tz });
	}
	return new Date(f.date).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

// The flight's calendar day as an ISO YYYY-MM-DD string, resolved with the same
// departure-timezone logic as flightDateLabel. Useful for grouping and day-gap math.
export function flightDayISO(f: FlightLike): string {
	const dep = departure(f);
	if (dep && dep.tz) {
		return new Date(dep.ts).toLocaleDateString('en-CA', { timeZone: dep.tz });
	}
	return new Date(f.date).toLocaleDateString('en-CA', { timeZone: 'UTC' });
}
