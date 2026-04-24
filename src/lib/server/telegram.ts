const TELEGRAM_API = 'https://api.telegram.org';

export async function sendMessage(text: string): Promise<void> {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;

	if (!token || !chatId) {
		console.warn('[telegram] credentials not configured, skipping notification');
		return;
	}

	const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
	});

	if (!res.ok) {
		throw new Error(`Telegram ${res.status}: ${await res.text()}`);
	}
}

export function buildNotification(
	flightId: string,
	status: string,
	opts: {
		label?: string | null;
		from?: string | null;
		to?: string | null;
		gate?: string | null;
		scheduledDep?: Date | string | null;
		actualDep?: Date | string | null;
		estimatedDep?: Date | string | null;
		departureTz?: string | null;
		wheelsOff?: Date | string | null;
		wheelsOn?: Date | string | null;
		scheduledArr?: Date | string | null;
		estimatedArr?: Date | string | null;
		actualArr?: Date | string | null;
		arrivalTz?: string | null;
		baggageClaim?: string | null;
	}
): string {
	const tag = opts.label ? `${flightId} · ${opts.label}` : flightId;
	const route = opts.from && opts.to ? `${opts.from} → ${opts.to}` : '';
	const arrTime = opts.actualArr ?? opts.estimatedArr;
	const depTime = opts.actualDep ?? opts.estimatedDep;

	const lines: string[] = [];

	const headers: Record<string, string> = {
		boarding: `🚶 <b>[${tag}] Boarding</b>`,
		departed: `🛫 <b>[${tag}] Departed</b>`,
		airborne: `✈️ <b>[${tag}] Airborne</b>`,
		landed:   `🛬 <b>[${tag}] Landed</b>`,
		arrived:  `✅ <b>[${tag}] Arrived at gate</b>`,
		delayed:  `⏰ <b>[${tag}] Delayed</b>`,
		cancelled:`❌ <b>[${tag}] Cancelled</b>`,
		diverted: `⚠️ <b>[${tag}] Diverted</b>`,
	};

	lines.push(headers[status] ?? `ℹ️ <b>[${tag}]</b> ${status}`);

	if (status === 'boarding') {
		if (route) lines.push(route);
		if (opts.gate) lines.push(`Gate ${opts.gate}`);
		if (depTime) lines.push(`Departs at ${formatTime(depTime, opts.departureTz)}`);
	} else if (status === 'departed') {
		if (depTime) lines.push(`Departed at ${formatTime(depTime, opts.departureTz)}`);
		if (route) lines.push(route);
	} else if (status === 'airborne') {
		if (opts.wheelsOff) lines.push(`Wheels off at ${formatTime(opts.wheelsOff, opts.departureTz)}`);
		if (route) lines.push(route);
		if (arrTime) lines.push(`ETA: ${formatTime(arrTime, opts.arrivalTz)}`);
	} else if (status === 'landed') {
		if (opts.wheelsOn) lines.push(`Landed at ${formatTime(opts.wheelsOn, opts.arrivalTz)}`);
		if (route) lines.push(route);
	} else if (status === 'arrived') {
		if (route) lines.push(route);
		if (opts.baggageClaim) lines.push(`Baggage: ${opts.baggageClaim}`);
		const depTime2 = opts.actualDep ?? opts.estimatedDep;
		const actualDep = depTime2 ? formatTime(depTime2, opts.departureTz) : null;
		const actualArr = arrTime ? formatTime(arrTime, opts.arrivalTz) : null;
		const schedDep = opts.scheduledDep ? formatTime(opts.scheduledDep, opts.departureTz) : null;
		const schedArr = opts.scheduledArr ? formatTime(opts.scheduledArr, opts.arrivalTz) : null;
		if (actualDep || actualArr) lines.push(`Actual: ${actualDep ?? '?'} → ${actualArr ?? '?'}`);
		if (schedDep || schedArr) lines.push(`Sched:  ${schedDep ?? '?'} → ${schedArr ?? '?'}`);
	} else {
		if (route) lines.push(route);
	}

	return lines.join('\n');
}

function formatTime(date: Date | string, tz?: string | null): string {
	return new Date(date).toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: tz ?? undefined,
		timeZoneName: 'short',
	});
}
