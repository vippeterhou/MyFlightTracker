import { writable } from 'svelte/store';
export const navHint = writable<string | null>(null);
