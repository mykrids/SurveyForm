export async function gasWrite(url: string, payload: Record<string, unknown>) {
  const secret = process.env.GAS_SHARED_SECRET;
  if (!url) throw new Error("GAS_WEBAPP_URL missing");
  const urlWithSecret = secret ? `${url}?action=write&secret=${encodeURIComponent(secret)}` : `${url}?action=write`;
  const body = secret ? { ...payload, _secret: secret } : payload;
  const res = await fetch(urlWithSecret, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
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
  const urlWithSecret = secret ? `${url}?action=read&secret=${encodeURIComponent(secret)}` : `${url}?action=read`;
  const res = await fetch(urlWithSecret, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GAS read failed ${res.status}: ${t}`);
  }
  return res.json();
}
