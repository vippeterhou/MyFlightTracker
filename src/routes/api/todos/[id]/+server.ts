import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	ApiValidationError,
	parseUpdateTodoInput,
	readJsonObject,
} from '$lib/server/apiValidation';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const existing = await db.todoItem.findUnique({ where: { id: params.id } });
	if (!existing) throw error(404, 'Todo not found');

	let input;
	try {
		input = parseUpdateTodoInput(await readJsonObject(request));
	} catch (err) {
		if (err instanceof ApiValidationError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}

	const todo = await db.todoItem.update({
		where: { id: params.id },
		data: input,
	});
	return json(todo);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = await db.todoItem.findUnique({ where: { id: params.id } });
	if (!existing) throw error(404, 'Todo not found');

	await db.todoItem.delete({ where: { id: params.id } });
	return json({ success: true });
};
