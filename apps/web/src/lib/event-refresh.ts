export function createEventRefresh(refresh: () => void, delay = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule() {
      if (timer !== undefined) return;
      timer = setTimeout(() => { timer = undefined; refresh(); }, delay);
    },
    cancel() { clearTimeout(timer); timer = undefined; },
  };
}
