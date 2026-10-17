import { expect, test } from 'bun:test';
import { createEventRefresh } from '../apps/web/src/lib/event-refresh';

test('a replay of 100 claim events triggers one resource refresh rather than 300 API requests', async () => {
  let count = 0;
  const refresh = createEventRefresh(() => { count++; }, 5);
  for (let index = 0; index < 100; index++) refresh.schedule();
  expect(count).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(count).toBe(1);
  refresh.schedule();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(count).toBe(2);
  refresh.cancel();
});
test('closing a claim view cancels a queued refresh', async () => {
  let count = 0;
  const refresh = createEventRefresh(() => { count++; }, 5);
  refresh.schedule(); refresh.cancel();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(count).toBe(0);
});
