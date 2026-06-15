import http from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.PORT || process.env.COMMERCE_PORT || 8787);
const STORE_PATH = resolve(process.cwd(), ".local-commerce-state.json");
const PROVIDER = process.env.PAYMENT_PROVIDER || "paddle";
const GUMROAD_WEBHOOK_SECRET = process.env.GUMROAD_WEBHOOK_SECRET || "";
const GUMROAD_PRODUCT_MAP = {
  exlzpj: { title: "Unlock All Guardians", guardian: "All guardians", priceLabel: "$19.99" },
  dxvtoa: { title: "Unlock Mazu", guardian: "Mazu", priceLabel: "$7.99" },
  utmjtd: { title: "Unlock Wenchang", guardian: "Wenchang", priceLabel: "$7.99" },
  rikiky: { title: "Unlock Yuelao", guardian: "Yuelao", priceLabel: "$7.99" },
  rvlpyw: { title: "Unlock Caishen", guardian: "Caishen", priceLabel: "$7.99" },
  nudiz: { title: "Unlock Guanyin", guardian: "Guanyin", priceLabel: "$7.99" }
};

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function createDefaultState() {
  return {
    account: null,
    subscription: null,
    orders: [],
    analyticsEvents: [],
    checkoutSessions: []
  };
}

function normalizeCheckoutSessions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((session) => session && typeof session === "object")
    .map((session) => ({
      sessionId: String(session.sessionId || "").trim(),
      provider: String(session.provider || "").trim() || "manual_waitlist",
      mode: session.mode === "subscription" ? "subscription" : "pack",
      email: String(session.email || "").trim().toLowerCase(),
      title: String(session.title || "").trim(),
      guardian: typeof session.guardian === "string" ? session.guardian : undefined,
      priceLabel: typeof session.priceLabel === "string" ? session.priceLabel : "",
      status:
        session.status === "completed" || session.status === "expired"
          ? session.status
          : "pending",
      createdAt:
        typeof session.createdAt === "string" && !Number.isNaN(Date.parse(session.createdAt))
          ? session.createdAt
          : new Date().toISOString(),
      completedAt:
        typeof session.completedAt === "string" && !Number.isNaN(Date.parse(session.completedAt))
          ? session.completedAt
          : null,
      gumroadPermalink:
        typeof session.gumroadPermalink === "string" ? session.gumroadPermalink : undefined,
      gumroadSaleId: typeof session.gumroadSaleId === "string" ? session.gumroadSaleId : undefined
    }))
    .filter((session) => session.sessionId);
}

function readState() {
  if (!existsSync(STORE_PATH)) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      ...createDefaultState(),
      ...parsed,
      checkoutSessions: normalizeCheckoutSessions(parsed?.checkoutSessions)
    };
  } catch {
    return createDefaultState();
  }
}

function writeState(state) {
  writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
  return state;
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function upsertAccount(state, email) {
  const now = new Date().toISOString();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return state;
  }

  if (state.account?.email === normalizedEmail) {
    return {
      ...state,
      account: {
        ...state.account,
        lastSeenAt: now
      }
    };
  }

  return {
    ...state,
    account: {
      id: state.account?.id || createId("acct"),
      email: normalizedEmail,
      createdAt: state.account?.createdAt || now,
      lastSeenAt: now
    }
  };
}

function track(state, type, meta = {}) {
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
    ].slice(-180)
  };
}

function handleConfirmSubscription(state, input) {
  const next = upsertAccount(state, input.email);
  const startedAt = new Date().toISOString();
  const renewalAt = addDaysIso(input.planId === "plus-annual" ? 365 : 30);
  const tier = input.tier === "oracle" ? "oracle" : "plus";

  return track(
    {
      ...next,
      subscription: {
        id: next.subscription?.id || createId("sub"),
        email: String(input.email).trim().toLowerCase(),
        tier,
        planId: input.planId,
        priceLabel: input.priceLabel,
        startedAt,
        renewalAt,
        status: "active"
      },
      orders: [
        ...next.orders,
        {
          id: createId("ord"),
          email: String(input.email).trim().toLowerCase(),
          kind: "subscription",
          title: tier === "plus" ? "Guardian Plus" : "Oracle Circle",
          priceLabel: input.priceLabel,
          purchasedAt: startedAt,
          status: "active",
          planId: input.planId
        }
      ]
    },
    "checkout_confirmed",
    {
      provider: PROVIDER,
      mode: "subscription",
      tier,
      planId: input.planId
    }
  );
}

function handleConfirmPack(state, input) {
  const next = upsertAccount(state, input.email);
  const purchasedAt = new Date().toISOString();

  if (hasExistingPackOrder(next, String(input.email).trim().toLowerCase(), input.title)) {
    return track(next, "checkout_confirmed", {
      provider: PROVIDER,
      mode: "pack",
      guardian: input.guardian,
      packTitle: input.title
    });
  }

  return track(
    {
      ...next,
      orders: [
        ...next.orders,
        {
          id: createId("ord"),
          email: String(input.email).trim().toLowerCase(),
          kind: "pack",
          title: input.title,
          guardian: input.guardian,
          priceLabel: input.priceLabel,
          purchasedAt,
          status: "fulfilled"
        }
      ]
    },
    "checkout_confirmed",
    {
      provider: PROVIDER,
      mode: "pack",
      guardian: input.guardian,
      packTitle: input.title
    }
  );
}

function handleRestore(state, input) {
  const normalizedEmail = String(input.email || "").trim().toLowerCase();
  const matchingOrders = state.orders.filter((order) => order.email === normalizedEmail);
  if (matchingOrders.length === 0 && state.subscription?.email !== normalizedEmail) {
    return state;
  }

  return track(upsertAccount(state, normalizedEmail), "remote_restore_completed", {
    email: normalizedEmail
  });
}

function hasExistingPackOrder(state, email, title) {
  return state.orders.some(
    (order) =>
      order.kind === "pack" &&
      order.email === email &&
      order.title === title &&
      order.status !== "canceled"
  );
}

function upsertCheckoutSession(state, session) {
  const checkoutSessions = normalizeCheckoutSessions(state.checkoutSessions);
  const existingIndex = checkoutSessions.findIndex(
    (entry) => entry.sessionId === session.sessionId
  );

  if (existingIndex >= 0) {
    const nextSessions = [...checkoutSessions];
    nextSessions[existingIndex] = {
      ...nextSessions[existingIndex],
      ...session
    };
    return {
      ...state,
      checkoutSessions: nextSessions
    };
  }

  return {
    ...state,
    checkoutSessions: [...checkoutSessions, session].slice(-300)
  };
}

function findMatchingCheckoutSession(state, { email, title, guardian }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedTitle = String(title || "").trim();
  const normalizedGuardian = String(guardian || "").trim();

  return normalizeCheckoutSessions(state.checkoutSessions)
    .filter(
      (session) =>
        session.status === "pending" &&
        session.mode === "pack" &&
        session.provider === "gumroad" &&
        session.email === normalizedEmail
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .find(
      (session) =>
        session.title === normalizedTitle &&
        (!normalizedGuardian || !session.guardian || session.guardian === normalizedGuardian)
    );
}

function markCheckoutSessionCompleted(state, sessionId, details = {}) {
  if (!sessionId) {
    return state;
  }

  const existing = normalizeCheckoutSessions(state.checkoutSessions).find(
    (session) => session.sessionId === sessionId
  );

  if (!existing) {
    return state;
  }

  return upsertCheckoutSession(state, {
    ...existing,
    status: "completed",
    completedAt: new Date().toISOString(),
    ...details
  });
}

function handleGumroadSale(state, payload) {
  const permalink = String(payload.product_permalink || "").trim().toLowerCase();
  const product = GUMROAD_PRODUCT_MAP[permalink];
  const email = String(payload.email || payload.purchaser_email || "").trim().toLowerCase();
  const gumroadSaleId = String(payload.sale_id || payload.purchase_id || "").trim();

  if (!product || !email) {
    return track(state, "gumroad_sale_ignored", {
      permalink,
      email
    });
  }

  if (hasExistingPackOrder(state, email, product.title)) {
    return track(state, "gumroad_sale_duplicate_ignored", {
      permalink,
      email,
      packTitle: product.title
    });
  }

  const matchedSession = findMatchingCheckoutSession(state, {
    email,
    title: product.title,
    guardian: product.guardian
  });
  const next = upsertAccount(state, email);
  const purchasedAt = new Date().toISOString();
  const withCompletedSession = matchedSession
    ? markCheckoutSessionCompleted(next, matchedSession.sessionId, {
        gumroadPermalink: permalink,
        gumroadSaleId
      })
    : next;

  return track(
    {
      ...withCompletedSession,
      orders: [
        ...withCompletedSession.orders,
        {
          id: createId("ord"),
          email,
          kind: "pack",
          title: product.title,
          guardian: product.guardian,
          priceLabel: product.priceLabel,
          purchasedAt,
          status: "fulfilled"
        }
      ]
    },
    "gumroad_sale_recorded",
    {
      provider: "gumroad",
      email,
      packTitle: product.title,
      guardian: product.guardian,
      permalink,
      sessionId: matchedSession?.sessionId || "",
      gumroadSaleId
    }
  );
}

function createSession(input, mode) {
  const title =
    mode === "subscription"
      ? input.tier === "oracle"
        ? "Oracle Circle"
        : "Guardian Plus"
      : input.title;

  const sessionId = createId(mode === "subscription" ? "sub" : "pack");

  return {
    sessionId,
    provider: PROVIDER,
    mode,
    redirectUrl: `/?checkout=success&mode=${mode}&email=${encodeURIComponent(
      String(input.email).trim().toLowerCase()
    )}&title=${encodeURIComponent(title)}&checkout_session=${encodeURIComponent(sessionId)}`,
    status: PROVIDER === "manual_waitlist" ? "requires_manual_review" : "pending",
    message:
      PROVIDER === "manual_waitlist"
        ? "Live charging is not active yet. Capture this buyer in the launch list first."
        : "Hosted checkout session created."
  };
}

function createPackSession(state, input) {
  const session = createSession(input, "pack");

  if (PROVIDER !== "gumroad") {
    return { nextState: state, session };
  }

  const nextState = upsertCheckoutSession(state, {
    sessionId: session.sessionId,
    provider: "gumroad",
    mode: "pack",
    email: String(input.email || "").trim().toLowerCase(),
    title: String(input.title || "").trim(),
    guardian: typeof input.guardian === "string" ? input.guardian : undefined,
    priceLabel: typeof input.priceLabel === "string" ? input.priceLabel : "",
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null
  });

  return { nextState, session };
}

function getCheckoutSessionStatus(state, input) {
  const sessionId = String(input.sessionId || "").trim();

  if (!sessionId) {
    return { found: false, status: "missing" };
  }

  const session = normalizeCheckoutSessions(state.checkoutSessions).find(
    (entry) => entry.sessionId === sessionId
  );

  if (!session) {
    return { found: false, status: "missing" };
  }

  return {
    found: true,
    status: session.status,
    session
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/gumroad/webhook") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const params = new URLSearchParams(body);
        const requestUrl = new URL(req.url || "/gumroad/webhook", `http://${req.headers.host || "localhost"}`);
        const secret = String(params.get("secret") || requestUrl.searchParams.get("secret") || "").trim();
        if (GUMROAD_WEBHOOK_SECRET && secret !== GUMROAD_WEBHOOK_SECRET) {
          json(res, 403, { error: "Invalid Gumroad webhook secret" });
          return;
        }

        const payload = Object.fromEntries(params.entries());
        const state = readState();
        const next = writeState(handleGumroadSale(state, payload));
        json(res, 200, { ok: true, orders: next.orders.length });
      } catch (error) {
        json(res, 500, {
          error: "Gumroad webhook failure",
          detail: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/commerce") {
    json(res, 404, { error: "Not found" });
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const payload = body ? JSON.parse(body) : {};
      const state = readState();

      switch (payload.action) {
        case "load": {
          json(res, 200, state);
          return;
        }
        case "track": {
          const next = writeState(track(state, payload.type || "unknown", payload.meta || {}));
          json(res, 200, next);
          return;
        }
        case "create_subscription_checkout_session": {
          const next = writeState(
            track(state, "checkout_session_created", {
              provider: PROVIDER,
              mode: "subscription",
              tier: payload.input?.tier || "plus",
              planId: payload.input?.planId || "plus-monthly"
            })
          );
          void next;
          json(res, 200, createSession(payload.input || {}, "subscription"));
          return;
        }
        case "create_pack_checkout_session": {
          const trackedState = track(state, "checkout_session_created", {
            provider: PROVIDER,
            mode: "pack",
            guardian: payload.input?.guardian || "Unknown",
            packTitle: payload.input?.title || "Untitled"
          });
          const { nextState, session } = createPackSession(trackedState, payload.input || {});
          writeState(nextState);
          json(res, 200, session);
          return;
        }
        case "confirm_subscription_checkout": {
          const next = writeState(handleConfirmSubscription(state, payload.input || {}));
          json(res, 200, next);
          return;
        }
        case "confirm_pack_checkout": {
          const next = writeState(handleConfirmPack(state, payload.input || {}));
          json(res, 200, next);
          return;
        }
        case "restore_purchases": {
          const next = writeState(handleRestore(state, payload.input || {}));
          json(res, 200, next);
          return;
        }
        case "get_checkout_session_status": {
          json(res, 200, getCheckoutSessionStatus(state, payload.input || {}));
          return;
        }
        default: {
          json(res, 400, { error: "Unsupported action" });
        }
      }
    } catch (error) {
      json(res, 500, {
        error: "Commerce server failure",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Commerce server listening on http://127.0.0.1:${PORT} with provider=${PROVIDER}`);
});
