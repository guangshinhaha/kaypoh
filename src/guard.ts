// Live-run guard. A live run against a real site needs N1 (#2) closed and a person's say-so.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function assertRunnable(startUrl: string, liveApproved: boolean): void {
  if (!isLocalUrl(startUrl) && !liveApproved) {
    throw new Error(
      `refusing live run against ${startUrl}: needs N1 (#2) closed and a person's explicit approval (liveApproved)`,
    );
  }
}

/** One session per site: runs on the same host queue up, so a site never sees parallel load. */
const tails = new Map<string, Promise<unknown>>();

export async function withSiteLock<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = new URL(url).host;
  const prev = tails.get(host) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  tails.set(host, next);
  try {
    return await next;
  } finally {
    if (tails.get(host) === next) tails.delete(host);
  }
}
