export type CommerceMembershipTier = "free" | "plus" | "oracle";

export type SubscriptionPlanId = "plus-monthly" | "plus-annual" | "oracle-monthly";

export type OrderKind = "subscription" | "pack";

export type OrderStatus = "active" | "fulfilled" | "canceled";

export type CommerceAccount = {
  id: string;
  email: string;
  createdAt: string;
  lastSeenAt: string;
};

export type CommerceSubscription = {
  id: string;
  email: string;
  tier: Exclude<CommerceMembershipTier, "free">;
  planId: SubscriptionPlanId;
  priceLabel: string;
  startedAt: string;
  renewalAt: string;
  status: "active" | "canceled";
};

export type CommerceOrder = {
  id: string;
  email: string;
  kind: OrderKind;
  title: string;
  priceLabel: string;
  guardian?: string;
  purchasedAt: string;
  status: OrderStatus;
  planId?: SubscriptionPlanId;
};

export type AnalyticsEvent = {
  id: string;
  type: string;
  occurredAt: string;
  meta: Record<string, string>;
};

export type CommerceState = {
  account: CommerceAccount | null;
  subscription: CommerceSubscription | null;
  orders: CommerceOrder[];
  analyticsEvents: AnalyticsEvent[];
};

export type CommerceEntitlements = {
  membershipTier: CommerceMembershipTier;
  unlockedPacks: string[];
};

type SubscriptionInput = {
  email: string;
  tier: Exclude<CommerceMembershipTier, "free">;
  planId: SubscriptionPlanId;
  priceLabel: string;
};

type PackPurchaseInput = {
  email: string;
  title: string;
  guardian: string;
  priceLabel: string;
};

const MAX_ANALYTICS_EVENTS = 180;

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function upsertAccount(current: CommerceState, email: string) {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  if (current.account?.email === normalizedEmail) {
    return {
      ...current,
      account: {
        ...current.account,
        lastSeenAt: now
      }
    };
  }

  return {
    ...current,
    account: {
      id: current.account?.id ?? createId("acct"),
      email: normalizedEmail,
      createdAt: current.account?.createdAt ?? now,
      lastSeenAt: now
    }
  };
}

export function createDefaultCommerceState(): CommerceState {
  return {
    account: null,
    subscription: null,
    orders: [],
    analyticsEvents: []
  };
}

export function normalizeCommerceState(raw: unknown): CommerceState {
  if (!raw || typeof raw !== "object") {
    return createDefaultCommerceState();
  }

  const candidate = raw as Partial<CommerceState>;
  const account =
    candidate.account &&
    typeof candidate.account === "object" &&
    typeof candidate.account.email === "string"
      ? {
          id:
            typeof candidate.account.id === "string" && candidate.account.id
              ? candidate.account.id
              : createId("acct"),
          email: candidate.account.email.trim().toLowerCase(),
          createdAt: isValidDate(candidate.account.createdAt)
            ? candidate.account.createdAt
            : new Date().toISOString(),
          lastSeenAt: isValidDate(candidate.account.lastSeenAt)
            ? candidate.account.lastSeenAt
            : new Date().toISOString()
        }
      : null;

  const subscription =
    candidate.subscription &&
    typeof candidate.subscription === "object" &&
    typeof candidate.subscription.email === "string" &&
    (candidate.subscription.tier === "plus" || candidate.subscription.tier === "oracle")
      ? {
          id:
            typeof candidate.subscription.id === "string" && candidate.subscription.id
              ? candidate.subscription.id
              : createId("sub"),
          email: candidate.subscription.email.trim().toLowerCase(),
          tier: candidate.subscription.tier,
          planId: (
            candidate.subscription.planId === "plus-annual" ||
            candidate.subscription.planId === "oracle-monthly"
              ? candidate.subscription.planId
              : "plus-monthly"
          ) as SubscriptionPlanId,
          priceLabel:
            typeof candidate.subscription.priceLabel === "string" && candidate.subscription.priceLabel
              ? candidate.subscription.priceLabel
              : "",
          startedAt: isValidDate(candidate.subscription.startedAt)
            ? candidate.subscription.startedAt
            : new Date().toISOString(),
          renewalAt: isValidDate(candidate.subscription.renewalAt)
            ? candidate.subscription.renewalAt
            : addDaysIso(30),
          status: (candidate.subscription.status === "canceled" ? "canceled" : "active") as
            | "active"
            | "canceled"
        }
      : null;

  const orders = Array.isArray(candidate.orders)
    ? candidate.orders
        .filter((order): order is CommerceOrder => Boolean(order && typeof order === "object"))
        .map((order) => ({
          id: typeof order.id === "string" && order.id ? order.id : createId("ord"),
          email: typeof order.email === "string" ? order.email.trim().toLowerCase() : "",
          kind: (order.kind === "pack" ? "pack" : "subscription") as OrderKind,
          title: typeof order.title === "string" ? order.title : "Untitled",
          priceLabel: typeof order.priceLabel === "string" ? order.priceLabel : "",
          guardian: typeof order.guardian === "string" ? order.guardian : undefined,
          purchasedAt: isValidDate(order.purchasedAt) ? order.purchasedAt : new Date().toISOString(),
          status: (
            order.status === "canceled" ? "canceled" : order.status === "fulfilled" ? "fulfilled" : "active"
          ) as OrderStatus,
          planId:
            order.planId === "plus-monthly" || order.planId === "plus-annual" || order.planId === "oracle-monthly"
              ? order.planId
              : undefined
        }))
    : [];

  const analyticsEvents = Array.isArray(candidate.analyticsEvents)
    ? candidate.analyticsEvents
        .filter((event): event is AnalyticsEvent => Boolean(event && typeof event === "object"))
        .map((event) => ({
          id: typeof event.id === "string" && event.id ? event.id : createId("evt"),
          type: typeof event.type === "string" ? event.type : "unknown",
          occurredAt: isValidDate(event.occurredAt) ? event.occurredAt : new Date().toISOString(),
          meta:
            event.meta && typeof event.meta === "object"
              ? Object.fromEntries(
                  Object.entries(event.meta).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[0] === "string" && typeof entry[1] === "string"
                  )
                )
              : {}
        }))
        .slice(-MAX_ANALYTICS_EVENTS)
    : [];

  return {
    account,
    subscription,
    orders,
    analyticsEvents
  };
}

export function validateCheckoutEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function deriveCommerceEntitlements(state: CommerceState): CommerceEntitlements {
  const membershipTier =
    state.subscription?.status === "active" ? state.subscription.tier : "free";
  const unlockedPacks = Array.from(
    new Set(
      state.orders
        .filter((order) => order.kind === "pack" && order.status !== "canceled")
        .map((order) => order.title)
    )
  );

  return {
    membershipTier,
    unlockedPacks
  };
}

export function trackCommerceEvent(
  state: CommerceState,
  type: string,
  meta: Record<string, string> = {}
) {
  return {
    ...state,
    analyticsEvents: [
      ...state.analyticsEvents,
      {
        id: createId("evt"),
        type,
        occurredAt: new Date().toISOString(),
        meta
      }
    ].slice(-MAX_ANALYTICS_EVENTS)
  };
}

export function activateSubscription(state: CommerceState, input: SubscriptionInput): CommerceState {
  const nextState = upsertAccount(state, input.email);
  const startedAt = new Date().toISOString();
  const renewalAt = addDaysIso(input.planId === "plus-annual" ? 365 : 30);

  return {
    ...nextState,
    subscription: {
      id: nextState.subscription?.id ?? createId("sub"),
      email: input.email.trim().toLowerCase(),
      tier: input.tier,
      planId: input.planId,
      priceLabel: input.priceLabel,
      startedAt,
      renewalAt,
      status: "active"
    },
    orders: [
      ...nextState.orders,
      {
        id: createId("ord"),
        email: input.email.trim().toLowerCase(),
        kind: "subscription",
        title: input.tier === "plus" ? "Guardian Plus" : "Oracle Circle",
        priceLabel: input.priceLabel,
        purchasedAt: startedAt,
        status: "active",
        planId: input.planId
      }
    ]
  };
}

export function unlockPackPurchase(state: CommerceState, input: PackPurchaseInput): CommerceState {
  const nextState = upsertAccount(state, input.email);
  const purchasedAt = new Date().toISOString();

  const existingOrder = nextState.orders.some(
    (order) =>
      order.kind === "pack" &&
      order.email === input.email.trim().toLowerCase() &&
      order.title === input.title &&
      order.status !== "canceled"
  );

  if (existingOrder) {
    return nextState;
  }

  return {
    ...nextState,
    orders: [
      ...nextState.orders,
      {
        id: createId("ord"),
        email: input.email.trim().toLowerCase(),
        kind: "pack",
        title: input.title,
        guardian: input.guardian,
        priceLabel: input.priceLabel,
        purchasedAt,
        status: "fulfilled"
      }
    ]
  };
}

export function restoreCommerceAccount(state: CommerceState, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const matchingOrderExists = state.orders.some((order) => order.email === normalizedEmail);
  const matchingSubscriptionExists = state.subscription?.email === normalizedEmail;

  if (!matchingOrderExists && !matchingSubscriptionExists) {
    return state;
  }

  return upsertAccount(state, normalizedEmail);
}

export function getBillingLabel(planId: SubscriptionPlanId) {
  if (planId === "plus-annual") {
    return "Annual billing";
  }

  return "Monthly billing";
}

export function getSubscriptionAccessLabel(planId: SubscriptionPlanId) {
  if (planId === "oracle-monthly") {
    return "Archive + collector continuity";
  }

  return "Continuity + shared reflection";
}

export function getRecentCustomerEmail(state: CommerceState) {
  if (state.account?.email) {
    return state.account.email;
  }

  const latestEmail = state.orders[state.orders.length - 1]?.email;
  return latestEmail ?? "";
}

export function getPackTitlesForEmail(state: CommerceState, email: string) {
  return Array.from(
    new Set(
      state.orders
        .filter((order) => order.kind === "pack" && order.email === email.trim().toLowerCase())
        .map((order) => order.title)
    )
  );
}

export function getSubscriptionCount(state: CommerceState) {
  return state.orders.filter((order) => order.kind === "subscription").length;
}

export function getPackPurchaseCount(state: CommerceState) {
  return state.orders.filter((order) => order.kind === "pack").length;
}

export function getEventTypes(state: CommerceState) {
  return normalizeStringArray(state.analyticsEvents.map((event) => event.type));
}
