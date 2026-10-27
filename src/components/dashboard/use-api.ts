"use client";

import { useEffect, useState } from "react";

/** Minimal fetch-JSON hook for client pages. `loading` is true until the current URL's response arrives. */
export function useApi<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? `${r.status}`);
        return body as T;
      })
      .then((data) => alive && setState({ url, data, error: null }))
      .catch((e) => alive && setState({ url, data: null, error: e.message }));
    return () => {
      alive = false;
    };
  }, [url]);
  const current = state.url === url;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!url && !current };
}
