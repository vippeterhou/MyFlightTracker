import { PrismaClient } from '@prisma/client';
import { DATABASE_POOL } from '../constants.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function databaseUrl(): string | undefined {
	const value = process.env.DATABASE_URL;
	if (!value) return undefined;

	const url = new URL(value);
	if (!url.searchParams.has('connection_limit')) {
		url.searchParams.set('connection_limit', String(DATABASE_POOL.CONNECTION_LIMIT));
	}
	if (!url.searchParams.has('pool_timeout')) {
		url.searchParams.set('pool_timeout', String(DATABASE_POOL.TIMEOUT_SECONDS));
	}
	return url.toString();
}

const url = databaseUrl();
export const db = globalForPrisma.prisma ?? new PrismaClient(
	url ? { datasources: { db: { url } } } : undefined,
);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
