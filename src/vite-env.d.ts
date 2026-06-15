/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_COMMERCE_BACKEND?: "local" | "remote";
  readonly VITE_COMMERCE_API_BASE?: string;
  readonly VITE_PAYMENT_PROVIDER?: "paypal" | "paddle" | "lemonsqueezy" | "gumroad" | "manual_waitlist";
  readonly VITE_PAYMENT_LINK_MODE?: "demo" | "live";
  readonly VITE_PAYPAL_CHECKOUT_URL?: string;
  readonly VITE_PADDLE_CHECKOUT_URL?: string;
  readonly VITE_LEMONSQUEEZY_CHECKOUT_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_GUANYIN_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_CAISHEN_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_YUELAO_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_WENCHANG_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_MAZU_URL?: string;
  readonly VITE_GUMROAD_UNLOCK_ALL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
