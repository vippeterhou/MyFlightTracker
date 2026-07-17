const RESEND_EMAILS_API = 'https://api.resend.com/emails';

export async function sendEmail(subject: string, message: string): Promise<boolean> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.EMAIL_FROM;
	const recipients = process.env.EMAIL_TO
		?.split(',')
		.map((address) => address.trim())
		.filter(Boolean);

	if (!apiKey || !from || !recipients?.length) {
		console.warn('[email] credentials not configured, skipping notification');
		return false;
	}

	// Notification content uses Telegram's <b> markup. Send plain text email so labels
	// and other user-provided values are never interpreted as HTML.
	const text = message.replace(/<\/?b>/g, '');
	const res = await fetch(RESEND_EMAILS_API, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to: recipients, subject, text }),
	});

	if (!res.ok) {
		throw new Error(`Resend ${res.status}: ${await res.text()}`);
	}

	return true;
}
