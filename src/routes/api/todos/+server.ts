import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	ApiValidationError,
	parseCreateTodoInput,
	readJsonObject,
} from '$lib/server/apiValidation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const todos = await db.todoItem.findMany({
		orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
	});
	return json(todos);
};

export const POST: RequestHandler = async ({ request }) => {
	let input;
	try {
		input = parseCreateTodoInput(await readJsonObject(request));
	} catch (err) {
		if (err instanceof ApiValidationError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}

	const todo = await db.todoItem.create({ data: input });
	return json(todo, { status: 201 });
};

export const DELETE: RequestHandler = async () => {
	const result = await db.todoItem.deleteMany({ where: { completed: true } });
	return json({ deleted: result.count });
};
