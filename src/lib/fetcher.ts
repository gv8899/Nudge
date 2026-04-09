export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`API error: ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return res.json();
}
