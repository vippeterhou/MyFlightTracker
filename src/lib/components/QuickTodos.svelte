<script lang="ts">
	import { onMount } from 'svelte';
	import { TODO_TEXT_MAX_LENGTH } from '$lib/inputLimits';

	interface TodoItem {
		id: string;
		text: string;
		completed: boolean;
	}

	let sectionEl = $state<HTMLElement | undefined>(undefined);
	let todos = $state<TodoItem[]>([]);
	let draft = $state('');
	let adding = $state(false);
	let loading = $state(false);
	let loaded = $state(false);
	let error = $state('');
	let remaining = $derived(todos.filter((todo) => !todo.completed).length);
	let completed = $derived(todos.length - remaining);

	onMount(() => {
		if (!sectionEl || !('IntersectionObserver' in window)) {
			void loadTodos();
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				void loadTodos();
			},
			{ rootMargin: '200px' },
		);
		observer.observe(sectionEl);
		return () => observer.disconnect();
	});

	async function loadTodos() {
		if (loading || loaded) return;
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/todos');
			const body = await res.json();
			if (!res.ok) {
				error = body.error ?? 'Unable to load ideas';
				return;
			}
			todos = body as TodoItem[];
		} catch {
			error = 'Unable to reach the server';
		} finally {
			loading = false;
			loaded = true;
		}
	}

	async function addTodo(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || adding || !loaded) return;

		adding = true;
		error = '';
		try {
			const res = await fetch('/api/todos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
			});
			const body = await res.json();
			if (!res.ok) {
				error = body.error ?? 'Unable to add this idea';
				return;
			}

			todos = [body as TodoItem, ...todos];
			draft = '';
		} catch {
			error = 'Unable to reach the server';
		} finally {
			adding = false;
		}
	}

	async function toggleTodo(todo: TodoItem) {
		const previous = todo.completed;
		todos = todos.map((item) =>
			item.id === todo.id ? { ...item, completed: !previous } : item,
		);

		if (!(await updateTodo(todo.id, { completed: !previous }))) {
			todos = todos.map((item) =>
				item.id === todo.id ? { ...item, completed: previous } : item,
			);
		}
	}

	async function saveText(todo: TodoItem, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const text = input.value.trim();
		if (!text) {
			input.value = todo.text;
			error = 'Ideas cannot be empty';
			return;
		}
		if (text === todo.text) return;

		const previous = todo.text;
		todos = todos.map((item) => (item.id === todo.id ? { ...item, text } : item));
		if (!(await updateTodo(todo.id, { text }))) {
			todos = todos.map((item) =>
				item.id === todo.id ? { ...item, text: previous } : item,
			);
		}
	}

	function finishEditing(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		(event.currentTarget as HTMLInputElement).blur();
	}

	async function updateTodo(
		id: string,
		changes: { text?: string; completed?: boolean },
	): Promise<boolean> {
		error = '';
		try {
			const res = await fetch(`/api/todos/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(changes),
			});
			const body = await res.json();
			if (!res.ok) {
				error = body.error ?? 'Unable to save this idea';
				return false;
			}

			todos = todos.map((todo) => (todo.id === id ? (body as TodoItem) : todo));
			return true;
		} catch {
			error = 'Unable to reach the server';
			return false;
		}
	}

	async function deleteTodo(id: string) {
		error = '';
		try {
			const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
			if (!res.ok) {
				error = 'Unable to delete this idea';
				return;
			}
			todos = todos.filter((todo) => todo.id !== id);
		} catch {
			error = 'Unable to reach the server';
		}
	}

	async function clearCompleted() {
		error = '';
		try {
			const res = await fetch('/api/todos', { method: 'DELETE' });
			if (!res.ok) {
				error = 'Unable to clear completed ideas';
				return;
			}
			todos = todos.filter((todo) => !todo.completed);
		} catch {
			error = 'Unable to reach the server';
		}
	}
</script>

<section class="ideas" bind:this={sectionEl} aria-busy={loading}>
	<div class="ideas-header">
		<div>
			<div class="title-row">
				<h2>Ideas</h2>
				{#if todos.length > 0}
					<span class="count">{remaining} open</span>
				{/if}
			</div>
			<p>Saved with your flight data. Click any idea to edit it.</p>
		</div>
		{#if completed > 0}
			<button type="button" class="clear-button" onclick={clearCompleted}>Clear completed</button>
		{/if}
	</div>

	<form class="add-form" onsubmit={addTodo}>
		<input
			bind:value={draft}
			maxlength={TODO_TEXT_MAX_LENGTH}
			placeholder="Add an idea or reminder..."
			aria-label="New idea"
		/>
		<button type="submit" disabled={!draft.trim() || adding || !loaded}>
			{adding ? 'Adding...' : 'Add'}
		</button>
	</form>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if loading}
		<p class="empty">Loading ideas...</p>
	{:else if loaded && todos.length === 0}
		<p class="empty">No ideas yet.</p>
	{:else if todos.length > 0}
		<ul>
			{#each todos as todo (todo.id)}
				<li class:completed={todo.completed}>
					<input
						class="checkbox"
						type="checkbox"
						checked={todo.completed}
						onchange={() => toggleTodo(todo)}
						aria-label={todo.completed ? `Mark ${todo.text} as open` : `Complete ${todo.text}`}
					/>
					<input
						class="todo-text"
						value={todo.text}
						maxlength={TODO_TEXT_MAX_LENGTH}
						onblur={(event) => saveText(todo, event)}
						onkeydown={finishEditing}
						aria-label={`Edit ${todo.text}`}
					/>
					<button
						type="button"
						class="delete-button"
						onclick={() => deleteTodo(todo.id)}
						aria-label={`Delete ${todo.text}`}
					>×</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.ideas {
		margin-top: 28px;
		padding: 20px;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		background: white;
	}

	.ideas-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 14px;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	h2 {
		margin: 0;
		color: #1f2937;
		font-size: 1rem;
		font-weight: 700;
	}

	.ideas-header p {
		margin-top: 4px;
		color: #6b7280;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	.count {
		padding: 2px 9px;
		border-radius: 999px;
		background: #eff6ff;
		color: #2563eb;
		font-size: 0.72rem;
		font-weight: 600;
	}

	.clear-button,
	.delete-button {
		border: 0;
		background: transparent;
		color: #9ca3af;
		cursor: pointer;
	}

	.clear-button {
		padding: 3px 0;
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.clear-button:hover,
	.delete-button:hover {
		color: #374151;
	}

	.add-form {
		display: flex;
		gap: 9px;
	}

	.add-form input {
		min-width: 0;
		flex: 1;
		padding: 11px 13px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		outline: none;
		color: #1f2937;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.45;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.add-form input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.add-form button {
		padding: 9px 17px;
		border: 0;
		border-radius: 8px;
		background: #2563eb;
		color: white;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}

	.add-form button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.error {
		margin-top: 9px;
		color: #dc2626;
		font-size: 0.8rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 320px;
		margin-top: 14px;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 42px;
		padding: 5px 8px;
		border-radius: 8px;
	}

	li:hover,
	li:focus-within {
		background: #f8fafc;
	}

	.checkbox {
		flex: 0 0 auto;
		width: 17px;
		height: 17px;
		accent-color: #2563eb;
		cursor: pointer;
	}

	.todo-text {
		min-width: 0;
		flex: 1;
		padding: 6px 7px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: #1f2937;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.5;
		outline: none;
	}

	.todo-text:hover {
		border-color: #e5e7eb;
	}

	.todo-text:focus {
		border-color: #93c5fd;
		background: white;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
	}

	.completed .todo-text {
		color: #9ca3af;
		text-decoration: line-through;
	}

	.delete-button {
		padding: 2px 4px;
		font-size: 1.15rem;
		line-height: 1;
		opacity: 0;
	}

	li:hover .delete-button,
	li:focus-within .delete-button,
	.delete-button:focus-visible {
		opacity: 1;
	}

	.empty {
		margin-top: 14px;
		color: #9ca3af;
		font-size: 0.85rem;
	}

	@media (max-width: 520px) {
		.ideas {
			padding: 16px;
		}

		.add-form button {
			padding-inline: 14px;
		}

		.delete-button {
			opacity: 1;
		}
	}
</style>
