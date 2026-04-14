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
		estimatedArr?: Date | string | null;
		actualArr?: Date | string | null;
		arrivalTz?: string | null;
		baggageClaim?: string | null;
	}
): string {
	const tag = opts.label ? `${flightId} · ${opts.label}` : flightId;
	const route = opts.from && opts.to ? `${opts.from} → ${opts.to}` : '';
	const arrTime = opts.actualArr ?? opts.estimatedArr;

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
	if (route) lines.push(route);
	if (opts.gate && status === 'boarding') lines.push(`Gate ${opts.gate}`);
	if (arrTime && ['airborne', 'landed'].includes(status)) {
		lines.push(`ETA: ${formatTime(arrTime, opts.arrivalTz)}`);
	}
	if (opts.baggageClaim && status === 'arrived') {
		lines.push(`Baggage: ${opts.baggageClaim}`);
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
