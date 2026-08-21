export async function gasWrite(url: string, payload: Record<string, unknown>) {
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url) throw new Error("GAS_WEBAPP_URL missing");
  const res = await fetch(`${url}?action=write`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GAS write failed ${res.status}: ${t}`);
  }
  return res.json().catch(() => ({}));
}

export async function gasRead(url: string) {
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url) throw new Error("GAS_WEBAPP_URL missing");
  const res = await fetch(`${url}?action=read`, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GAS read failed ${res.status}: ${t}`);
  }
  return res.json();
}
