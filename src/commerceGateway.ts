import {
  CommerceState,
  SubscriptionPlanId,
  activateSubscription,
  createDefaultCommerceState,
  normalizeCommerceState,
  restoreCommerceAccount,
  trackCommerceEvent,
  unlockPackPurchase
} from "./commerce";

export type MerchantOfRecordProvider = "paypal" | "paddle" | "lemonsqueezy" | "gumroad" | "manual_waitlist";

export type SubscriptionCheckoutRequest = {
  email: string;
  tier: "plus" | "oracle";
  planId: SubscriptionPlanId;
  priceLabel: string;
};

export type PackCheckoutRequest = {
  email: string;
  title: string;
  guardian: string;
  priceLabel: string;
};

export type RestorePurchasesRequest = {
  email: string;
};

export type CheckoutSessionStatusRequest = {
  sessionId: string;
};

export type CheckoutSession = {
  sessionId: string;
  provider: MerchantOfRecordProvider;
  mode: "subscription" | "pack";
  redirectUrl: string;
  status: "pending" | "requires_manual_review" | "completed";
  message: string;
};

export type CheckoutSessionStatus = {
  found: boolean;
  status: "pending" | "completed" | "expired" | "missing";
  session?: {
    sessionId: string;
    provider: MerchantOfRecordProvider;
    mode: "subscription" | "pack";
    email: string;
    title: string;
    guardian?: string;
    priceLabel: string;
    status: "pending" | "completed" | "expired";
    createdAt: string;
    completedAt: string | null;
  };
};

export type ProviderReadiness = {
  provider: MerchantOfRecordProvider;
  mode: "demo" | "launch_prep" | "live";
  recommendedForMainlandChinaSolo: boolean;
  summary: string;
};

export type CommerceGateway = {
  load(): Promise<CommerceState>;
  createSubscriptionCheckoutSession(input: SubscriptionCheckoutRequest): Promise<CheckoutSession>;
  createPackCheckoutSession(input: PackCheckoutRequest): Promise<CheckoutSession>;
  getCheckoutSessionStatus(sessionId: string): Promise<CheckoutSessionStatus>;
  confirmSubscriptionCheckout(input: SubscriptionCheckoutRequest): Promise<CommerceState>;
  confirmPackCheckout(input: PackCheckoutRequest): Promise<CommerceState>;
  restorePurchases(input: RestorePurchasesRequest): Promise<CommerceState>;
  track(type: string, meta?: Record<string, string>): Promise<CommerceState>;
  getProviderReadiness(): ProviderReadiness;
};

const STORAGE_KEY = "digital-shrine-commerce";

type RemoteGatewayPayload = {
  action:
    | "load"
    | "track"
    | "create_subscription_checkout_session"
    | "create_pack_checkout_session"
    | "get_checkout_session_status"
    | "confirm_subscription_checkout"
    | "confirm_pack_checkout"
    | "restore_purchases";
  type?: string;
  meta?: Record<string, string>;
  input?:
    | SubscriptionCheckoutRequest
    | PackCheckoutRequest
    | RestorePurchasesRequest
    | CheckoutSessionStatusRequest;
};

function createSessionId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function readStoredCommerce() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultCommerceState();
  }

  try {
    return normalizeCommerceState(JSON.parse(raw));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return createDefaultCommerceState();
  }
}

function persistCommerce(state: CommerceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function getRemoteGatewayBaseUrl() {
  const configured = import.meta.env.VITE_COMMERCE_API_BASE?.trim();
  return configured ? configured.replace(/\/$/, "") : "";
}

function getConfiguredProvider(): MerchantOfRecordProvider {
  const provider = import.meta.env.VITE_PAYMENT_PROVIDER?.trim();
  if (provider === "paypal" || provider === "paddle" || provider === "lemonsqueezy" || provider === "gumroad") {
    return provider;
  }

  return "manual_waitlist";
}

function getProviderReadiness(): ProviderReadiness {
  const provider = getConfiguredProvider();

  if (provider === "paypal") {
    return {
      provider,
      mode: import.meta.env.VITE_PAYMENT_LINK_MODE === "live" ? "live" : "launch_prep",
      recommendedForMainlandChinaSolo: true,
      summary:
        "Best first live path for a mainland China solo founder: simpler onboarding, realistic payout access, and a fast way to validate paid demand before adding a more complex provider."
    };
  }

  if (provider === "paddle") {
    return {
      provider,
      mode: import.meta.env.VITE_PAYMENT_LINK_MODE === "live" ? "live" : "launch_prep",
      recommendedForMainlandChinaSolo: true,
      summary:
        "Recommended primary path for a mainland China solo founder: Merchant of Record structure, hosted checkout, tax handling, and a cleaner overseas buyer experience."
    };
  }

  if (provider === "lemonsqueezy") {
    return {
      provider,
      mode: import.meta.env.VITE_PAYMENT_LINK_MODE === "live" ? "live" : "launch_prep",
      recommendedForMainlandChinaSolo: false,
      summary:
        "Good Merchant of Record product, but do not use it as the default first launch assumption for a mainland China individual account without confirming payout eligibility first."
    };
  }

  if (provider === "gumroad") {
    return {
      provider,
      mode: import.meta.env.VITE_PAYMENT_LINK_MODE === "live" ? "live" : "launch_prep",
      recommendedForMainlandChinaSolo: true,
      summary:
        "Practical launch path for a mainland China solo founder: simple digital-product checkout, easy public links, and fast validation while the full website remains the real product experience."
    };
  }

  return {
    provider,
    mode: "demo",
    recommendedForMainlandChinaSolo: true,
    summary:
      "Safe temporary mode for launch prep: collect qualified buyers, validate demand, and only turn on live checkout after the payout route is confirmed."
  };
}

function createHostedCheckoutUrl(params: {
  mode: "subscription" | "pack";
  email: string;
  priceLabel: string;
  sessionId: string;
  guardian?: string;
  title: string;
  provider: MerchantOfRecordProvider;
}) {
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.set("checkout", "success");
  returnUrl.searchParams.set("checkout_session", params.sessionId);
  returnUrl.searchParams.set("provider", params.provider);
  returnUrl.searchParams.set("mode", params.mode);
  returnUrl.searchParams.set("email", params.email.trim().toLowerCase());
  returnUrl.searchParams.set("title", params.title);

  const gumroadPackLinks: Record<string, string> = {
    "Unlock All Guardians": import.meta.env.VITE_GUMROAD_UNLOCK_ALL_URL?.trim() ?? "",
    "Unlock Mazu": import.meta.env.VITE_GUMROAD_UNLOCK_MAZU_URL?.trim() ?? "",
    "Unlock Wenchang": import.meta.env.VITE_GUMROAD_UNLOCK_WENCHANG_URL?.trim() ?? "",
    "Unlock Yuelao": import.meta.env.VITE_GUMROAD_UNLOCK_YUELAO_URL?.trim() ?? "",
    "Unlock Caishen": import.meta.env.VITE_GUMROAD_UNLOCK_CAISHEN_URL?.trim() ?? "",
    "Unlock Guanyin": import.meta.env.VITE_GUMROAD_UNLOCK_GUANYIN_URL?.trim() ?? ""
  };

  const externalLink =
    params.provider === "paypal"
      ? import.meta.env.VITE_PAYPAL_CHECKOUT_URL?.trim()
      : params.provider === "paddle"
      ? import.meta.env.VITE_PADDLE_CHECKOUT_URL?.trim()
      : params.provider === "lemonsqueezy"
        ? import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL?.trim()
        : params.provider === "gumroad"
          ? gumroadPackLinks[params.title] ?? ""
        : "";

  if (externalLink) {
    const checkoutUrl = new URL(externalLink);
    if (params.provider === "paypal") {
      checkoutUrl.searchParams.set("email", params.email.trim().toLowerCase());
      checkoutUrl.searchParams.set("utm_source", "eastern-guardians");
      checkoutUrl.searchParams.set("utm_medium", "app");
      checkoutUrl.searchParams.set("utm_campaign", params.mode);
      checkoutUrl.searchParams.set("item_name", params.title);
      checkoutUrl.searchParams.set("custom", returnUrl.toString());
    } else if (params.provider === "gumroad") {
      checkoutUrl.searchParams.set("wanted", "true");
      checkoutUrl.searchParams.set("email", params.email.trim().toLowerCase());
      checkoutUrl.searchParams.set("recommended_by", "eastern-guardians");
      checkoutUrl.searchParams.set("session_id", params.sessionId);
    } else {
      checkoutUrl.searchParams.set("checkout[email]", params.email.trim().toLowerCase());
      checkoutUrl.searchParams.set("utm_source", "digital-shrine");
      checkoutUrl.searchParams.set("utm_medium", "app");
      checkoutUrl.searchParams.set("utm_campaign", params.mode);
      checkoutUrl.searchParams.set("checkout[custom][ritual_title]", params.title);
      checkoutUrl.searchParams.set("checkout[custom][price_label]", params.priceLabel);
      checkoutUrl.searchParams.set("checkout[custom][return_to]", returnUrl.toString());
    }
    return checkoutUrl.toString();
  }

  return returnUrl.toString();
}

function hasConfiguredCheckoutUrl(provider: MerchantOfRecordProvider) {
  if (provider === "paypal") {
    return Boolean(import.meta.env.VITE_PAYPAL_CHECKOUT_URL?.trim());
  }

  if (provider === "paddle") {
    return Boolean(import.meta.env.VITE_PADDLE_CHECKOUT_URL?.trim());
  }

  if (provider === "lemonsqueezy") {
    return Boolean(import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL?.trim());
  }

  if (provider === "gumroad") {
    return true;
  }

  return false;
}

async function postRemoteGateway(payload: RemoteGatewayPayload) {
  const baseUrl = getRemoteGatewayBaseUrl();
  const response = await fetch(`${baseUrl}/commerce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Remote commerce gateway failed with ${response.status}`);
  }

  return response.json();
}

export function createLocalCommerceGateway(): CommerceGateway {
  return {
    async load() {
      return readStoredCommerce();
    },

    async createSubscriptionCheckoutSession(input) {
      const provider = getConfiguredProvider();
      const checkoutReady = hasConfiguredCheckoutUrl(provider);
      const sessionId = createSessionId("sub");
      const nextState = trackCommerceEvent(readStoredCommerce(), "checkout_session_created", {
        provider,
        mode: "subscription",
        tier: input.tier,
        planId: input.planId
      });
      persistCommerce(nextState);

      return {
        sessionId,
        provider,
        mode: "subscription",
        redirectUrl: createHostedCheckoutUrl({
          mode: "subscription",
          email: input.email,
          priceLabel: input.priceLabel,
          sessionId,
          title: input.tier === "plus" ? "Guardian Plus" : "Oracle Circle",
          provider
        }),
        status: !checkoutReady ? "requires_manual_review" : "pending",
        message:
          !checkoutReady
            ? "Live checkout is not configured yet. Add a verified checkout URL before charging this buyer."
            : "Hosted checkout session created."
      };
    },

    async createPackCheckoutSession(input) {
      const provider = getConfiguredProvider();
      const checkoutReady = hasConfiguredCheckoutUrl(provider);
      const sessionId = createSessionId("pack");
      const nextState = trackCommerceEvent(readStoredCommerce(), "checkout_session_created", {
        provider,
        mode: "pack",
        guardian: input.guardian,
        packTitle: input.title
      });
      persistCommerce(nextState);

      return {
        sessionId,
        provider,
        mode: "pack",
        redirectUrl: createHostedCheckoutUrl({
          mode: "pack",
          email: input.email,
          priceLabel: input.priceLabel,
          sessionId,
          guardian: input.guardian,
          title: input.title,
          provider
        }),
        status: !checkoutReady ? "requires_manual_review" : "pending",
        message:
          !checkoutReady
            ? "Live checkout is not configured yet. Add a verified checkout URL before fulfilling this unlock."
            : "Hosted checkout session created."
      };
    },

    async confirmSubscriptionCheckout(input) {
      const nextState = trackCommerceEvent(
        activateSubscription(readStoredCommerce(), input),
        "checkout_confirmed",
        {
          provider: getConfiguredProvider(),
          mode: "subscription",
          tier: input.tier,
          planId: input.planId
        }
      );

      return persistCommerce(nextState);
    },

    async getCheckoutSessionStatus(sessionId) {
      return {
        found: false,
        status: "missing"
      };
    },

    async confirmPackCheckout(input) {
      const nextState = trackCommerceEvent(
        unlockPackPurchase(readStoredCommerce(), input),
        "checkout_confirmed",
        {
          provider: getConfiguredProvider(),
          mode: "pack",
          guardian: input.guardian,
          packTitle: input.title
        }
      );

      return persistCommerce(nextState);
    },

    async restorePurchases(input) {
      const nextState = trackCommerceEvent(
        restoreCommerceAccount(readStoredCommerce(), input.email),
        "gateway_restore_completed",
        { email: input.email.trim().toLowerCase() }
      );

      return persistCommerce(nextState);
    },

    async track(type, meta = {}) {
      const nextState = trackCommerceEvent(readStoredCommerce(), type, meta);
      return persistCommerce(nextState);
    },

    getProviderReadiness() {
      return getProviderReadiness();
    }
  };
}

export function createRemoteCommerceGateway(): CommerceGateway {
  return {
    async load() {
      return normalizeCommerceState(await postRemoteGateway({ action: "load" }));
    },

    async createSubscriptionCheckoutSession(input) {
      const session = (await postRemoteGateway({
        action: "create_subscription_checkout_session",
        input
      })) as CheckoutSession;

      if (session.provider === "gumroad" && session.status === "pending") {
        return {
          ...session,
          redirectUrl: createHostedCheckoutUrl({
            mode: "subscription",
            email: input.email,
            priceLabel: input.priceLabel,
            sessionId: session.sessionId,
            title: input.tier === "plus" ? "Guardian Plus" : "Oracle Circle",
            provider: session.provider
          })
        };
      }

      return session;
    },

    async createPackCheckoutSession(input) {
      const session = (await postRemoteGateway({
        action: "create_pack_checkout_session",
        input
      })) as CheckoutSession;

      if (session.provider === "gumroad" && session.status === "pending") {
        return {
          ...session,
          redirectUrl: createHostedCheckoutUrl({
            mode: "pack",
            email: input.email,
            priceLabel: input.priceLabel,
            sessionId: session.sessionId,
            guardian: input.guardian,
            title: input.title,
            provider: session.provider
          })
        };
      }

      return session;
    },

    async getCheckoutSessionStatus(sessionId) {
      return postRemoteGateway({
        action: "get_checkout_session_status",
        input: { sessionId }
      }) as Promise<CheckoutSessionStatus>;
    },

    async confirmSubscriptionCheckout(input) {
      return normalizeCommerceState(
        await postRemoteGateway({
          action: "confirm_subscription_checkout",
          input
        })
      );
    },

    async confirmPackCheckout(input) {
      return normalizeCommerceState(
        await postRemoteGateway({
          action: "confirm_pack_checkout",
          input
        })
      );
    },

    async restorePurchases(input) {
      return normalizeCommerceState(
        await postRemoteGateway({
          action: "restore_purchases",
          input
        })
      );
    },

    async track(type, meta = {}) {
      return normalizeCommerceState(
        await postRemoteGateway({
          action: "track",
          type,
          meta
        })
      );
    },

    getProviderReadiness() {
      return getProviderReadiness();
    }
  };
}

export function createCommerceGateway(): CommerceGateway {
  return import.meta.env.VITE_COMMERCE_BACKEND === "remote"
    ? createRemoteCommerceGateway()
    : createLocalCommerceGateway();
}
