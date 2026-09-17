import { INPUT_LIMITS } from '$lib/constants';

const FLIGHT_ID_PATTERN = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2,4}\d{1,4}[A-Z]?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CANDIDATE_ID_LENGTH = 500;

type JsonObject = Record<string, unknown>;

export class ApiValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ApiValidationError';
	}
}

export interface CreateFlightInput {
	flightId: string;
	date: Date;
	label: string | null;
	selectedCandidateId: string | null;
}

export interface UpdateFlightInput {
	label: string | null;
}

export interface CreateTodoInput {
	text: string;
}

export interface UpdateTodoInput {
	text?: string;
	completed?: boolean;
}

export async function readJsonObject(request: Request): Promise<JsonObject> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new ApiValidationError('Request body must contain valid JSON');
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new ApiValidationError('Request body must be a JSON object');
	}

	return body as JsonObject;
}

export function parseCreateFlightInput(body: JsonObject): CreateFlightInput {
	if (typeof body.flightId !== 'string' || !body.flightId.trim()) {
		throw new ApiValidationError('flightId is required');
	}

	const flightId = body.flightId.toUpperCase().replace(/\s+/g, '');
	if (!FLIGHT_ID_PATTERN.test(flightId)) {
		throw new ApiValidationError('flightId must be a valid airline flight number');
	}

	if (typeof body.date !== 'string' || !DATE_PATTERN.test(body.date)) {
		throw new ApiValidationError('date must use YYYY-MM-DD format');
	}

	const date = new Date(`${body.date}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) {
		throw new ApiValidationError('date must be a valid calendar date');
	}

	return {
		flightId,
		date,
		label: parseLabel(body.label, false),
		selectedCandidateId: parseSelectedCandidateId(body.selectedCandidateId),
	};
}

export function parseUpdateFlightInput(body: JsonObject): UpdateFlightInput {
	if (!Object.hasOwn(body, 'label')) {
		throw new ApiValidationError('label is required');
	}

	return { label: parseLabel(body.label, true) };
}

export function parseCreateTodoInput(body: JsonObject): CreateTodoInput {
	return { text: parseTodoText(body.text) };
}

export function parseUpdateTodoInput(body: JsonObject): UpdateTodoInput {
	const input: UpdateTodoInput = {};

	if (Object.hasOwn(body, 'text')) {
		input.text = parseTodoText(body.text);
	}
	if (Object.hasOwn(body, 'completed')) {
		if (typeof body.completed !== 'boolean') {
			throw new ApiValidationError('completed must be a boolean');
		}
		input.completed = body.completed;
	}
	if (input.text === undefined && input.completed === undefined) {
		throw new ApiValidationError('text or completed is required');
	}

	return input;
}

function parseLabel(value: unknown, required: boolean): string | null {
	if (value === undefined && !required) return null;
	if (value === null) return null;
	if (typeof value !== 'string') {
		throw new ApiValidationError('label must be a string or null');
	}

	const label = value.trim();
	if (label.length > INPUT_LIMITS.FLIGHT_LABEL) {
		throw new ApiValidationError(
			`label must be ${INPUT_LIMITS.FLIGHT_LABEL} characters or fewer`,
		);
	}

	return label || null;
}

function parseSelectedCandidateId(value: unknown): string | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string') {
		throw new ApiValidationError('selectedCandidateId must be a string');
	}

	const selectedCandidateId = value.trim();
	if (!selectedCandidateId) return null;
	if (selectedCandidateId.length > MAX_CANDIDATE_ID_LENGTH) {
		throw new ApiValidationError(
			`selectedCandidateId must be ${MAX_CANDIDATE_ID_LENGTH} characters or fewer`,
		);
	}

	return selectedCandidateId;
}

function parseTodoText(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new ApiValidationError('text is required');
	}

	const text = value.trim();
	if (text.length > INPUT_LIMITS.TODO_TEXT) {
		throw new ApiValidationError(
			`text must be ${INPUT_LIMITS.TODO_TEXT} characters or fewer`,
		);
	}

	return text;
}
