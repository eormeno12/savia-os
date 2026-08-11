"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionDto } from "@savia-os/legacy-contracts";
import { api } from "@/lib/api";

/**
 * Freemium gate state (SB1). Organizing memory is free; connecting IAs needs a
 * subscription. The materialized `plan` on the user is the source of truth —
 * the Mercado Pago webhook flips it to `pro` after a successful payment — so we
 * read it from `api.me()` and expose `refresh()` for when the user returns from
 * checkout.
 */
export function useSubscription() {
  const [active, setActive] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDto | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setActive(me.plan === "pro");
      // The detailed status (renewal date, grace, failure) is best-effort; the
      // gate only needs the boolean, so a failure here never blocks.
      api.billing.subscription().then(setSubscription).catch(() => setSubscription(null));
    } catch {
      setActive(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { active, subscription, ready, refresh };
}
