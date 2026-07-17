import { sendEmail } from './email';
import { logger } from './logger';
import { sendMessage } from './telegram';

const STATUS_TITLES: Record<string, string> = {
	'tracking-started': 'Tracking started',
	boarding: 'Boarding',
	departed: 'Departed',
	airborne: 'Airborne',
	landed: 'Landed',
	arrived: 'Arrived at gate',
	delayed: 'Delayed',
	cancelled: 'Cancelled',
	diverted: 'Diverted',
};

export function buildNotificationSubject(
	flightId: string,
	status: string,
	label?: string | null,
): string {
	const tag = label ? `${flightId} · ${label}` : flightId;
	return `[${tag}] ${STATUS_TITLES[status] ?? status}`;
}

export async function sendNotifications(
	subject: string,
	message: string,
	flightId?: string | null,
): Promise<void> {
	const channels = [
		{ name: 'Telegram', send: sendMessage(message) },
		{ name: 'Email', send: sendEmail(subject, message) },
	];
	const results = await Promise.allSettled(channels.map((channel) => channel.send));

	for (const [index, result] of results.entries()) {
		const channel = channels[index];
		if (result.status === 'rejected') {
			await logger.warn(
				`${channel.name} notification failed: ${String(result.reason)}`,
				flightId,
			);
		} else if (result.value) {
			await logger.info(`${channel.name} notification sent: ${subject}`, flightId);
		}
	}
}
