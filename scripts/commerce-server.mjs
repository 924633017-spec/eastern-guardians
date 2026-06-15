import http from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.COMMERCE_PORT || 8787);
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
    analyticsEvents: []
  };
}

function readState() {
  if (!existsSync(STORE_PATH)) {
    return createDefaultState();
  }

  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8"));
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

function handleGumroadSale(state, payload) {
  const permalink = String(payload.product_permalink || "").trim().toLowerCase();
  const product = GUMROAD_PRODUCT_MAP[permalink];
  const email = String(payload.email || payload.purchaser_email || "").trim().toLowerCase();

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

  const next = upsertAccount(state, email);
  const purchasedAt = new Date().toISOString();

  return track(
    {
      ...next,
      orders: [
        ...next.orders,
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
      permalink
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

  return {
    sessionId: createId(mode === "subscription" ? "sub" : "pack"),
    provider: PROVIDER,
    mode,
    redirectUrl: `/?checkout=success&mode=${mode}&email=${encodeURIComponent(
      String(input.email).trim().toLowerCase()
    )}&title=${encodeURIComponent(title)}`,
    status: PROVIDER === "manual_waitlist" ? "requires_manual_review" : "pending",
    message:
      PROVIDER === "manual_waitlist"
        ? "Live charging is not active yet. Capture this buyer in the launch list first."
        : "Hosted checkout session created."
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
        const secret = String(params.get("secret") || "").trim();
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
          const next = writeState(
            track(state, "checkout_session_created", {
              provider: PROVIDER,
              mode: "pack",
              guardian: payload.input?.guardian || "Unknown",
              packTitle: payload.input?.title || "Untitled"
            })
          );
          void next;
          json(res, 200, createSession(payload.input || {}, "pack"));
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
