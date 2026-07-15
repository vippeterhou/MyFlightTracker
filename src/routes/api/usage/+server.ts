import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const VALID_GRANULARITIES = ['day', 'week', 'month'] as const;
type Granularity = (typeof VALID_GRANULARITIES)[number];

const LOOKBACK_DAYS: Record<Granularity, number> = {
	day: 30,
	week: 90,
	month: 365,
};

export const GET: RequestHandler = async ({ url }) => {
	const gran = url.searchParams.get('granularity') ?? 'day';
	const granularity: Granularity = VALID_GRANULARITIES.includes(gran as Granularity)
		? (gran as Granularity)
		: 'day';

	if (url.searchParams.has('summary')) {
		return getMonthlySummary();
	}

	const drilldown = url.searchParams.get('drilldown');
	if (drilldown) {
		return getDrilldown(drilldown, granularity);
	}

	return getAggregated(granularity);
};

async function getAggregated(granularity: Granularity) {
	const since = new Date(Date.now() - LOOKBACK_DAYS[granularity] * 24 * 60 * 60 * 1000);

	const rows = await db.$queryRawUnsafe<{ bucket: Date; endpoint: string; count: number }[]>(
		`SELECT date_trunc('${granularity}', timestamp) as bucket, endpoint, COUNT(*)::int as count
		 FROM "ApiCall"
		 WHERE timestamp >= $1
		 GROUP BY bucket, endpoint
		 ORDER BY bucket ASC`,
		since,
	);

	return json(rows);
}

async function getMonthlySummary() {
	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

	const rows = await db.$queryRawUnsafe<{ endpoint: string; count: number }[]>(
		`SELECT endpoint, COUNT(*)::int as count
		 FROM "ApiCall"
		 WHERE timestamp >= $1
		 GROUP BY endpoint`,
		monthStart,
	);

	const status = rows.find((r) => r.endpoint === 'status')?.count ?? 0;
	const route = rows.find((r) => r.endpoint === 'route')?.count ?? 0;
	const schedule = rows.find((r) => r.endpoint === 'schedule')?.count ?? 0;

	return json({
		status,
		route,
		schedule,
		total: status + route + schedule,
		month: monthStart.toISOString(),
	});
}

async function getDrilldown(bucketStart: string, granularity: Granularity) {
	const start = new Date(bucketStart);
	const end = new Date(start);

	if (granularity === 'month') end.setMonth(end.getMonth() + 1);
	else if (granularity === 'week') end.setDate(end.getDate() + 7);
	else end.setDate(end.getDate() + 1);

	const calls = await db.apiCall.findMany({
		where: { timestamp: { gte: start, lt: end } },
		orderBy: { timestamp: 'desc' },
	});

	return json(calls);
}
