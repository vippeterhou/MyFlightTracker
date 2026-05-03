<script lang="ts">
	import type { FlightStatus } from '$lib/types';

	let { status }: { status: FlightStatus | null } = $props();

	const STEPS = ['boarding', 'departed', 'airborne', 'landed', 'arrived'] as const;

	const ICONS: Record<string, string> = {
		boarding:  '🚶',
		departed:  '🛫',
		airborne:  '✈️',
		landed:    '🛬',
		arrived:   '✅',
	};

	const LABELS: Record<string, string> = {
		boarding:  'Boarding',
		departed:  'Departed',
		airborne:  'Airborne',
		landed:    'Landed',
		arrived:   'Arrived at gate',
	};

	interface StepTimes {
		scheduled?: string | null;
		actual?: string | null;
		tz?: string | null;
	}

	function timesFor(step: string): StepTimes {
		if (!status) return {};
		const dep = status.departureTz;
		const arr = status.arrivalTz;
		switch (step) {
			case 'boarding':  return { actual: status.boardingAt, tz: dep };
			case 'departed':  return { scheduled: status.scheduledDep, actual: status.actualDep, tz: dep };
			case 'airborne':  return { actual: status.wheelsOff, tz: dep };
			case 'landed':    return { actual: status.wheelsOn, tz: arr };
			case 'arrived':   return { scheduled: status.scheduledArr, actual: status.actualArr, tz: arr };
			default:          return {};
		}
	}

	function fmt(d: string | null | undefined, tz?: string | null): string | null {
		if (!d) return null;
		return new Date(d).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short',
			...(tz ? { timeZone: tz } : {}),
		});
	}

	function currentIdx() {
		if (!status) return -1;
		return STEPS.indexOf(status.status as typeof STEPS[number]);
	}

	function isCompleted(step: string) {
		return currentIdx() > STEPS.indexOf(step as typeof STEPS[number]);
	}

	function isCurrent(step: string) {
		return status?.status === step;
	}

	let now = $state(Date.now());
	$effect(() => {
		if (status?.wheelsOff && !status.wheelsOn) {
			const id = setInterval(() => { now = Date.now(); }, 1000);
			return () => clearInterval(id);
		}
	});

	function airDuration(): string | null {
		if (!status?.wheelsOff) return null;
		const off = new Date(status.wheelsOff).getTime();
		const inFlight = !status.wheelsOn;
		const on = inFlight ? now : new Date(status.wheelsOn!).getTime();
		const ms = on - off;
		if (ms <= 0) return null;
		const h = Math.floor(ms / 3600000);
		const m = Math.floor((ms % 3600000) / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		if (inFlight) {
			const time = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
			return `In flight · ${time}`;
		} else {
			const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
			return `Air time · ${time}`;
		}
	}
</script>

{#if status?.status === 'cancelled'}
	<div class="alert alert-red">❌ Flight Cancelled</div>
{:else if status?.status === 'diverted'}
	<div class="alert alert-orange">⚠️ Flight Diverted</div>
{:else if status?.status === 'delayed'}
	<div class="alert alert-yellow">⏰ Delayed</div>
{/if}

<div class="timeline">
	{#each STEPS as step}
		{@const times = timesFor(step)}
		{@const show = isCompleted(step) || isCurrent(step)}
		<div
			class="step"
			class:completed={isCompleted(step)}
			class:current={isCurrent(step)}
		>
			<div class="dot-col">
				<div class="dot"></div>
				{#if step !== 'arrived'}
					<div class="line"></div>
				{/if}
			</div>
			<div class="content">
				<span class="icon">{ICONS[step]}</span>
				<div class="text">
					<span class="step-label">{LABELS[step]}</span>
					{#if show}
						{#if times.scheduled && times.actual}
							<span class="timestamp">
								<span class="t-label">Sched</span> {fmt(times.scheduled, times.tz)}
							</span>
							<span class="timestamp actual">
								<span class="t-label">Actual</span> {fmt(times.actual, times.tz)}
							</span>
						{:else if times.actual}
							<span class="timestamp">{fmt(times.actual, times.tz)}</span>
						{:else if times.scheduled}
							<span class="timestamp">
								<span class="t-label">Sched</span> {fmt(times.scheduled, times.tz)}
							</span>
						{/if}
						{#if step === 'airborne'}
							{@const dur = airDuration()}
							{#if dur}
								<span class="air-duration">{dur}</span>
							{/if}
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.alert {
		padding: 8px 12px;
		border-radius: 8px;
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 16px;
	}

	.alert-red    { background: #fee2e2; color: #b91c1c; }
	.alert-orange { background: #ffedd5; color: #c2410c; }
	.alert-yellow { background: #fef3c7; color: #b45309; }

	.timeline {
		display: flex;
		flex-direction: column;
	}

	.step {
		display: flex;
		gap: 12px;
		opacity: 0.35;
	}

	.step.completed,
	.step.current {
		opacity: 1;
	}

	.dot-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 14px;
		flex-shrink: 0;
	}

	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #d1d5db;
		flex-shrink: 0;
		margin-top: 3px;
	}

	.step.completed .dot {
		background: #10b981;
	}

	.step.current .dot {
		background: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
	}

	.line {
		width: 2px;
		flex: 1;
		min-height: 20px;
		background: #e5e7eb;
		margin: 3px 0;
	}

	.step.completed .line {
		background: #10b981;
	}

	.content {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 2px 0 16px;
		font-size: 0.9rem;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.step-label {
		font-weight: 500;
		line-height: 1.4;
	}

	.step.current .step-label {
		color: #3b82f6;
		font-weight: 600;
	}

	.timestamp {
		font-size: 0.78rem;
		color: #6b7280;
		display: flex;
		gap: 4px;
	}

	.timestamp.actual {
		color: #374151;
		font-weight: 500;
	}

	.step.current .timestamp {
		color: #93c5fd;
	}

	.step.current .timestamp.actual {
		color: #bfdbfe;
	}

	.t-label {
		color: #9ca3af;
		font-weight: 400;
		min-width: 38px;
	}

	.air-duration {
		font-size: 0.78rem;
		color: #6b7280;
		font-style: italic;
		margin-top: 2px;
	}
</style>
