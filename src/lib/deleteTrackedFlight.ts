export async function deleteTrackedFlight(
	flight: { id: string; flightId: string },
	onDelete: (id: string) => void,
): Promise<boolean> {
	if (!confirm(`Stop tracking ${flight.flightId}?`)) return false;

	let response: Response;
	try {
		response = await fetch(`/api/flights/${flight.id}`, { method: 'DELETE' });
	} catch {
		alert('Unable to stop tracking this flight.');
		return false;
	}

	if (!response.ok) {
		alert('Unable to stop tracking this flight.');
		return false;
	}

	onDelete(flight.id);
	return true;
}
