import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  Deity,
  Intention,
  deities,
  getDeityForZodiac,
  getSupportDeity,
  getLuckyNumber,
  getZodiacIntention,
  getZodiacFromBirthDate,
  intentionOptions,
  parseBirthDate,
  pickRecommendedDeity,
  rotateByDate,
  rotateByDay,
  zodiacOptions
} from "./data";
import { getDeityCutoutSrc, getDeityPosterSrc } from "./assets";
import {
  CommerceState,
  SubscriptionPlanId,
  createDefaultCommerceState,
  deriveCommerceEntitlements,
  getBillingLabel,
  getPackPurchaseCount,
  getRecentCustomerEmail,
  getSubscriptionAccessLabel,
  getSubscriptionCount,
  trackCommerceEvent
} from "./commerce";
import {
  CheckoutSession,
  createCommerceGateway
} from "./commerceGateway";
import { ShrineScene } from "./ShrineScene";

type ShrineProfile = {
  name: string;
  birthDate: string;
  currentConcern: string;
  zodiac: string;
  intention: Intention;
  deityId: Deity["id"];
  membershipTier: PremiumTier["id"];
  cardFinish: CardFinishId;
  unlockedPacks: string[];
  companions: CompanionStateByDeity;
};

type RitualRecord = {
  day: string;
  deityId: Deity["id"];
  offering: string;
  wish: string;
  resonance: number;
  omen: string;
  blessing: string;
};

type CompanionState = {
  wishes: string[];
  streak: number;
  lastRitualDay: string | null;
  guardianBond: number;
  lastQuestDay: string | null;
  ritualHistory: RitualRecord[];
  latestOffering: string | null;
  latestResonance: number | null;
  latestOmen: string | null;
  latestBlessing: string | null;
};

type CompanionStateByDeity = Record<Deity["id"], CompanionState>;

type WeeklyForecastDay = {
  day: string;
  guardian: string;
  focus: string;
};

type MilestoneReward = {
  title: string;
  description: string;
  complete: boolean;
};

type PremiumBenefit = {
  title: string;
  description: string;
  state: "preview" | "unlocked";
};

type CompatibilityMode = "romantic" | "friendship" | "creative";

type CompatibilityReading = {
  title: string;
  counterpartName: string;
  counterpartZodiac: string;
  counterpartGuardian: string;
  summary: string;
  reflectionFocus: string;
  tensionMirror: string;
  sharedPractice: string;
  shareLine: string;
};

type ViralProfileSignal = {
  archetype: string;
  headline: string;
  shareLine: string;
};

type CardFinishId = "standard" | "silk" | "obsidian";

type CardFinish = {
  id: CardFinishId;
  label: string;
  hint: string;
  unlockLabel: string;
  unlocked: (stats: { awakenedCount: number; totalBond: number }) => boolean;
  shellFill: string;
  shellStroke: string;
  frameFill: string;
  panelOverlay: string;
  textColor: string;
};

type PremiumTier = {
  id: "free" | "plus" | "oracle";
  name: string;
  price: string;
  badge: string;
  highlight: string;
  features: string[];
};

type RitualPack = {
  title: string;
  price: string;
  guardian: string;
  trigger: string;
  promise: string;
  description: string;
  outcomes: string[];
};

type ConcernMatch = {
  intention: Intention;
  confidence: "low" | "medium" | "high";
  signals: string[];
  summary: string;
};

type UpgradeTarget = "plus" | "oracle";
type UpgradeStep = "overview" | "checkout";
type PackCheckoutStep = "details" | "checkout";

type StaticPageId = "trust" | "privacy" | "terms" | "refund";
type CheckoutReturnState = "idle" | "processing" | "success" | "error";
type PendingGumroadCheckout = {
  sessionId: string;
  email: string;
  title: string;
  guardian: string;
  createdAt: string;
};

const STORAGE_KEY = "digital-shrine-profile";
const GUMROAD_PENDING_CHECKOUT_KEY = "digital-shrine-gumroad-pending-checkout";
const commerceGateway = createCommerceGateway();

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultCheckoutEmail() {
  return "hello@mythicguardian.app";
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readPendingGumroadCheckout(): PendingGumroadCheckout | null {
  try {
    const raw = localStorage.getItem(GUMROAD_PENDING_CHECKOUT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PendingGumroadCheckout>;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.guardian !== "string" ||
      typeof parsed.createdAt !== "string"
    ) {
      localStorage.removeItem(GUMROAD_PENDING_CHECKOUT_KEY);
      return null;
    }

    return {
      sessionId: parsed.sessionId,
      email: parsed.email.trim().toLowerCase(),
      title: parsed.title,
      guardian: parsed.guardian,
      createdAt: parsed.createdAt
    };
  } catch {
    localStorage.removeItem(GUMROAD_PENDING_CHECKOUT_KEY);
    return null;
  }
}

function writePendingGumroadCheckout(checkout: PendingGumroadCheckout) {
  localStorage.setItem(GUMROAD_PENDING_CHECKOUT_KEY, JSON.stringify(checkout));
}

function clearPendingGumroadCheckout(sessionId?: string) {
  const pending = readPendingGumroadCheckout();
  if (!pending) {
    return;
  }

  if (!sessionId || pending.sessionId === sessionId) {
    localStorage.removeItem(GUMROAD_PENDING_CHECKOUT_KEY);
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getStaticPagePath(page: StaticPageId) {
  switch (page) {
    case "trust":
      return "/trust";
    case "privacy":
      return "/privacy";
    case "terms":
      return "/terms";
    case "refund":
      return "/refund-policy";
  }
}

function getStaticPageFromPath(pathname: string): StaticPageId | null {
  switch (pathname.replace(/\/+$/, "") || "/") {
    case "/trust":
      return "trust";
    case "/privacy":
      return "privacy";
    case "/terms":
      return "terms";
    case "/refund-policy":
      return "refund";
    default:
      return null;
  }
}

function formatShortDay(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function createDefaultCompanionState(): CompanionState {
  return {
    wishes: [],
    streak: 0,
    lastRitualDay: null,
    guardianBond: 0,
    lastQuestDay: null,
    ritualHistory: [],
    latestOffering: null,
    latestResonance: null,
    latestOmen: null,
    latestBlessing: null
  };
}

function createDefaultCompanions(): CompanionStateByDeity {
  return deities.reduce((companions, deity) => {
    companions[deity.id] = createDefaultCompanionState();
    return companions;
  }, {} as CompanionStateByDeity);
}

const defaultProfile: ShrineProfile = {
  name: "",
  birthDate: "",
  currentConcern: "",
  zodiac: "Pisces",
  intention: "healing",
  deityId: "guanyin",
  membershipTier: "free",
  cardFinish: "standard",
  unlockedPacks: [],
  companions: createDefaultCompanions()
};

const cardFinishes: CardFinish[] = [
  {
    id: "standard",
    label: "Standard Aura",
    hint: "Default cinematic guardian card.",
    unlockLabel: "Available now",
    unlocked: () => true,
    shellFill: "#090611",
    shellStroke: "rgba(255,255,255,0.14)",
    frameFill: "rgba(255,255,255,0.04)",
    panelOverlay: "rgba(8,6,14,0.5)",
    textColor: "#F4EDE6"
  },
  {
    id: "silk",
    label: "Silk Archive",
    hint: "A softer collector finish for returning users.",
    unlockLabel: "Unlock at 3 awakened guardians or 60 total bond",
    unlocked: ({ awakenedCount, totalBond }) => awakenedCount >= 3 || totalBond >= 60,
    shellFill: "#10070f",
    shellStroke: "rgba(255,228,202,0.2)",
    frameFill: "rgba(255,244,233,0.05)",
    panelOverlay: "rgba(20,10,12,0.58)",
    textColor: "#FFF2E5"
  },
  {
    id: "obsidian",
    label: "Obsidian Court",
    hint: "A high-tier finish for a fully awakened constellation.",
    unlockLabel: "Unlock at all 5 guardians or 180 total bond",
    unlocked: ({ awakenedCount, totalBond }) => awakenedCount === deities.length || totalBond >= 180,
    shellFill: "#04050a",
    shellStroke: "rgba(188,228,255,0.22)",
    frameFill: "rgba(229,242,255,0.04)",
    panelOverlay: "rgba(6,9,16,0.58)",
    textColor: "#EEF6FF"
  }
];

const compatibilityModes: { id: CompatibilityMode; label: string; description: string }[] = [
  {
    id: "romantic",
    label: "Closeness",
    description: "For warmth, vulnerability, and how closeness is being carried."
  },
  {
    id: "friendship",
    label: "Care",
    description: "For trust, steadiness, and how two people hold care between them."
  },
  {
    id: "creative",
    label: "Collaboration",
    description: "For shared work, creative tension, and how energy moves between two people."
  }
];

const premiumTiers: PremiumTier[] = [
  {
    id: "free",
    name: "Free Shrine",
    price: "$0",
    badge: "Start free",
    highlight: "Meet your first guardian fast, get a strong first impression, and keep the experience easy to share.",
    features: ["1 daily ritual", "First guardian reveal", "Basic share card"]
  },
  {
    id: "plus",
    name: "Circle Access",
    price: "Opens later",
    badge: "Later layer",
    highlight: "A softer continuity layer for people who want their guardian to stay closer across the week.",
    features: ["Deeper daily guidance", "Shared reflection depth", "Weekly guardian rhythm"]
  },
  {
    id: "oracle",
    name: "Archive Circle",
    price: "Opens later",
    badge: "Later archive",
    highlight: "A deeper memory layer for people who want their full guardian path, keepsakes, and reflections held together.",
    features: ["Long-form readings", "Full memory archive", "Collector editions"]
  }
];

const ritualPacks: RitualPack[] = [
  {
    title: "Unlock Guanyin",
    price: "$7.99",
    guardian: "Guanyin",
    trigger: "For peace, healing, and emotional comfort",
    promise: "Unlock Guanyin to keep this gentle blessing close.",
    description: "Best when you want softness, health, relief, and a calm presence close by.",
    outcomes: ["Permanent guardian access", "Blessing card", "Personal shrine access"]
  },
  {
    title: "Unlock Caishen",
    price: "$7.99",
    guardian: "Caishen",
    trigger: "For prosperity, confidence, and steadier support",
    promise: "Unlock Caishen to keep this prosperity blessing close.",
    description: "Best when you want abundance, steadier fortune, and a sense of support around work and money.",
    outcomes: ["Permanent guardian access", "Blessing card", "Personal shrine access"]
  },
  {
    title: "Unlock Yuelao",
    price: "$7.99",
    guardian: "Yuelao",
    trigger: "For warmth, closeness, and emotional sincerity",
    promise: "Unlock Yuelao to keep this blessing for connection close.",
    description: "Best when you want love, warmth, repair, or a more open heart.",
    outcomes: ["Permanent guardian access", "Blessing card", "Personal shrine access"]
  },
  {
    title: "Unlock Wenchang",
    price: "$7.99",
    guardian: "Wenchang",
    trigger: "For focus, study, and steady thought",
    promise: "Unlock Wenchang to keep this clarity blessing close.",
    description: "Best when you want concentration, discipline, and a calmer mind for study or work.",
    outcomes: ["Permanent guardian access", "Blessing card", "Personal shrine access"]
  },
  {
    title: "Unlock Mazu",
    price: "$7.99",
    guardian: "Mazu",
    trigger: "For protection, travel, and steadiness through change",
    promise: "Unlock Mazu to keep this protection blessing close.",
    description: "Best when you want safety, guidance, and a steadier feeling during transitions.",
    outcomes: ["Permanent guardian access", "Blessing card", "Personal shrine access"]
  }
];

const allGuardiansPack: RitualPack = {
  title: "Unlock All Guardians",
  price: "$19.99",
  guardian: "All guardians",
  trigger: "For people who want the full Eastern Guardians collection at once",
  promise: "Unlock all five guardians and keep every blessing path close.",
  description: "Best when you want the full guardian set available from day one, without unlocking each one separately later.",
  outcomes: [
    "Permanent access to all five guardians",
    "All blessing cards unlocked",
    "Full personal shrine access across every guardian"
  ]
};

function hasAllGuardiansUnlocked(unlockedPacks: string[]) {
  return unlockedPacks.includes(allGuardiansPack.title);
}

function normalizeProfile(raw: Partial<ShrineProfile> | null | undefined): ShrineProfile {
  const legacyProfile = raw as Partial<ShrineProfile & CompanionState> | null | undefined;
  const companions = createDefaultCompanions();

  for (const deity of deities) {
    const savedCompanion = raw?.companions?.[deity.id];
    const legacyHistory = Array.isArray(legacyProfile?.ritualHistory)
      ? legacyProfile.ritualHistory.filter((entry) => entry.deityId === deity.id)
      : [];
    companions[deity.id] = {
      ...companions[deity.id],
      ...savedCompanion,
      wishes: Array.isArray(savedCompanion?.wishes)
        ? savedCompanion.wishes.slice(0, 5)
        : deity.id === legacyProfile?.deityId && Array.isArray(legacyProfile?.wishes)
          ? legacyProfile.wishes.slice(0, 5)
          : [],
      ritualHistory: Array.isArray(savedCompanion?.ritualHistory)
        ? savedCompanion.ritualHistory.slice(0, 8)
        : legacyHistory.slice(0, 8),
      streak: savedCompanion?.streak ?? (deity.id === legacyProfile?.deityId ? legacyProfile?.streak ?? 0 : 0),
      lastRitualDay:
        savedCompanion?.lastRitualDay ??
        (deity.id === legacyProfile?.deityId ? legacyProfile?.lastRitualDay ?? null : null),
      guardianBond:
        savedCompanion?.guardianBond ??
        (deity.id === legacyProfile?.deityId ? legacyProfile?.guardianBond ?? 0 : 0),
      lastQuestDay:
        savedCompanion?.lastQuestDay ??
        (deity.id === legacyProfile?.deityId ? legacyProfile?.lastQuestDay ?? null : null),
      latestOffering:
        sanitizeLegacyOffering(
          savedCompanion?.latestOffering ??
            (deity.id === legacyProfile?.deityId ? legacyProfile?.latestOffering ?? null : null),
          deity
        ),
      latestResonance:
        savedCompanion?.latestResonance ??
        (deity.id === legacyProfile?.deityId ? legacyProfile?.latestResonance ?? null : null),
      latestOmen:
        savedCompanion?.latestOmen ??
        (deity.id === legacyProfile?.deityId ? legacyProfile?.latestOmen ?? null : null),
      latestBlessing:
        savedCompanion?.latestBlessing ??
        (deity.id === legacyProfile?.deityId ? (legacyProfile as Partial<CompanionState>)?.latestBlessing ?? null : null)
    };
  }

  return {
    ...defaultProfile,
    ...raw,
    companions
  };
}

function realignProfileGuardian(profile: ShrineProfile): ShrineProfile {
  if (!profile.currentConcern.trim() || !isPreRitualProfile(profile)) {
    return profile;
  }

  const detectedIntention = analyzeConcern(profile.currentConcern, profile.intention).intention;
  const correctedGuardian = pickRecommendedDeity(profile.zodiac, detectedIntention);

  return {
    ...profile,
    intention: detectedIntention,
    deityId: correctedGuardian.id
  };
}

function getBondTier(bond: number) {
  if (bond >= 120) {
    return {
      label: "Deep Trust",
      description: "The guardian now reads like a trusted personal force.",
      progressFloor: 120,
      progressCeil: 180
    };
  }
  if (bond >= 72) {
    return {
      label: "Steady Companion",
      description: "Your returns are shaping a steady companion pattern.",
      progressFloor: 72,
      progressCeil: 120
    };
  }
  if (bond >= 28) {
    return {
      label: "Warm Bond",
      description: "The companion has started to answer with recognizable warmth.",
      progressFloor: 28,
      progressCeil: 72
    };
  }
  return {
    label: "First Spark",
    description: "A new guardian connection is still learning your rhythm.",
    progressFloor: 0,
    progressCeil: 28
  };
}

function getBondProgress(bond: number) {
  const tier = getBondTier(bond);
  const span = Math.max(1, tier.progressCeil - tier.progressFloor);
  return Math.min(100, Math.max(0, ((bond - tier.progressFloor) / span) * 100));
}

function getDayPhase() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { label: "Morning Opening", prompt: "Use your guardian to set direction before noise rushes in." };
  }
  if (hour < 18) {
    return { label: "Midday Alignment", prompt: "Use the companion to narrow focus and keep energy from scattering." };
  }
  return { label: "Evening Closing", prompt: "Use the companion to close loops, soften tension, and return with less residue." };
}

function buildRitualOutcome({
  deity,
  offering,
  wish,
  streak
}: {
  deity: Deity;
  offering: string;
  wish: string;
  streak: number;
}) {
  const seed = `${deity.id}${offering}${wish}${streak}${getTodayKey()}`;
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const resonance = 62 + (total % 39);
  const tone = resonance > 87 ? "strongly" : resonance > 74 ? "clearly" : "softly";
  const focus = deity.watchwords[total % deity.watchwords.length].toLowerCase();
  const omen = `The ${deity.sigil.toLowerCase()} responds ${tone}. ${offering} is drawing ${focus} closer today.`;
  const blessing = buildDailyBlessing({ deity, offering, wish, resonance, total });
  return { resonance, omen, blessing };
}

function buildDailyBlessing({
  deity,
  offering,
  wish,
  resonance,
  total
}: {
  deity: Deity;
  offering: string;
  wish: string;
  resonance: number;
  total: number;
}) {
  const focusWord = deity.watchwords[total % deity.watchwords.length].toLowerCase();
  const trimmedWish = wish.trim().replace(/\s+/g, " ");

  switch (deity.id) {
    case "guanyin":
      return resonance > 84
        ? `May ${offering.toLowerCase()} soften today's noise and let ${focusWord} settle gently around you.`
        : `May a quieter breath find you today, and may ${focusWord} stay close to what your heart is holding.`;
    case "caishen":
      return resonance > 84
        ? `May ${offering.toLowerCase()} open a steadier path today, with ${focusWord} gathering around your next practical move.`
        : `May today's blessing bring calmer support, clearer momentum, and enough ${focusWord} for the step ahead.`;
    case "yuelao":
      return resonance > 84
        ? `May ${offering.toLowerCase()} warm the thread around you today, and let ${focusWord} return with honesty and ease.`
        : `May the heart soften a little today, and may ${focusWord} guide the warmth you are ready to receive.`;
    case "wenchang":
      return resonance > 84
        ? `May ${offering.toLowerCase()} clear the noise around your mind today, so ${focusWord} can stay with your next line of work.`
        : `May your thoughts gather into one clear path today, and may ${focusWord} hold steady where distraction fades.`;
    case "mazu":
      return resonance > 84
        ? `May ${offering.toLowerCase()} steady your passage today, with ${focusWord} walking quietly beside your next crossing.`
        : `May the road feel safer today, and may ${focusWord} stay near wherever life is asking you to move.`;
    default:
      return trimmedWish
        ? `May today's offering hold ${focusWord} close to: ${trimmedWish}.`
        : `May today's offering keep ${focusWord} close to you.`;
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildShareCardMotif(deity: Deity, finish: CardFinish) {
  switch (deity.id) {
    case "guanyin":
      return `
        <ellipse cx="858" cy="350" rx="328" ry="328" fill="none" stroke="${finish.shellStroke}" stroke-opacity="0.26" stroke-width="2"/>
        <ellipse cx="858" cy="350" rx="368" ry="214" fill="none" stroke="${finish.shellStroke}" stroke-opacity="0.18" stroke-width="2"/>
        <path d="M772 846C804 796 834 782 858 782C882 782 912 796 944 846" stroke="${deity.palette[0]}" stroke-opacity="0.72" stroke-width="8" stroke-linecap="round"/>
        <path d="M734 846C774 770 816 736 858 736C900 736 942 770 982 846" stroke="${deity.palette[1]}" stroke-opacity="0.34" stroke-width="4" stroke-linecap="round"/>
        <circle cx="628" cy="252" r="7" fill="${deity.palette[0]}" fill-opacity="0.72"/>
        <circle cx="1086" cy="288" r="6" fill="${deity.palette[0]}" fill-opacity="0.62"/>
      `;
    case "caishen":
      return `
        <circle cx="672" cy="246" r="44" fill="none" stroke="${deity.palette[0]}" stroke-opacity="0.52" stroke-width="10"/>
        <circle cx="1042" cy="246" r="44" fill="none" stroke="${deity.palette[0]}" stroke-opacity="0.52" stroke-width="10"/>
        <rect x="656" y="230" width="32" height="32" rx="8" fill="${deity.palette[2]}" fill-opacity="0.65"/>
        <rect x="1026" y="230" width="32" height="32" rx="8" fill="${deity.palette[2]}" fill-opacity="0.65"/>
        <path d="M620 166C696 126 772 108 858 108C944 108 1022 126 1096 166" stroke="${deity.palette[0]}" stroke-opacity="0.22" stroke-width="14" stroke-linecap="round"/>
        <path d="M642 194C710 158 780 142 858 142C936 142 1008 158 1074 194" stroke="${deity.palette[1]}" stroke-opacity="0.2" stroke-width="8" stroke-linecap="round"/>
      `;
    case "yuelao":
      return `
        <path d="M616 212C700 154 776 134 856 134C940 134 1018 160 1102 228" stroke="${deity.palette[1]}" stroke-opacity="0.56" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M610 318C694 260 774 238 856 238C938 238 1016 266 1102 334" stroke="${deity.palette[1]}" stroke-opacity="0.34" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="678" cy="208" r="9" fill="${deity.palette[0]}" fill-opacity="0.84"/>
        <circle cx="1030" cy="332" r="7" fill="${deity.palette[0]}" fill-opacity="0.72"/>
        <path d="M856 820C882 790 914 780 944 780C916 804 902 834 902 864C876 844 860 832 856 820Z" fill="${deity.palette[0]}" fill-opacity="0.24"/>
      `;
    case "wenchang":
      return `
        <path d="M646 188L1078 188" stroke="${finish.shellStroke}" stroke-opacity="0.16" stroke-width="2"/>
        <path d="M646 292L1078 292" stroke="${finish.shellStroke}" stroke-opacity="0.12" stroke-width="2"/>
        <path d="M724 110L724 754" stroke="${finish.shellStroke}" stroke-opacity="0.12" stroke-width="2"/>
        <path d="M994 110L994 754" stroke="${finish.shellStroke}" stroke-opacity="0.12" stroke-width="2"/>
        <circle cx="688" cy="146" r="8" fill="${deity.palette[0]}" fill-opacity="0.82"/>
        <circle cx="956" cy="334" r="8" fill="${deity.palette[0]}" fill-opacity="0.7"/>
        <path d="M646 814C750 790 830 790 920 814" stroke="${deity.palette[1]}" stroke-opacity="0.24" stroke-width="8" stroke-linecap="round"/>
      `;
    case "mazu":
      return `
        <circle cx="858" cy="352" r="308" fill="none" stroke="${finish.shellStroke}" stroke-opacity="0.22" stroke-width="2"/>
        <path d="M858 72V632" stroke="${finish.shellStroke}" stroke-opacity="0.18" stroke-width="2"/>
        <path d="M578 352H1138" stroke="${finish.shellStroke}" stroke-opacity="0.16" stroke-width="2"/>
        <path d="M628 820C716 790 794 786 858 786C922 786 1000 790 1088 820" stroke="${deity.palette[1]}" stroke-opacity="0.3" stroke-width="8" stroke-linecap="round"/>
        <path d="M656 854C736 828 802 824 858 824C914 824 982 828 1060 854" stroke="${deity.palette[0]}" stroke-opacity="0.2" stroke-width="5" stroke-linecap="round"/>
        <circle cx="652" cy="218" r="8" fill="${deity.palette[0]}" fill-opacity="0.76"/>
        <circle cx="1060" cy="438" r="8" fill="${deity.palette[0]}" fill-opacity="0.6"/>
      `;
    default:
      return "";
  }
}

function buildShareCardSvg({
  profile,
  deity,
  oracle,
  luckyNumber,
  deityImageDataUrl,
  finish,
  viralSignal
}: {
  profile: ShrineProfile;
  deity: Deity;
  oracle: string;
  luckyNumber: number;
  deityImageDataUrl: string;
  finish: CardFinish;
  viralSignal: ViralProfileSignal;
}) {
  const modeLabel = getDeityLifeAreaLabel(deity.id);
  const insightLines = wrapText(oracle, 24).slice(0, 3);
  const headlineLines = wrapText(viralSignal.headline, 34).slice(0, 2);
  const blessingLines = wrapText(deity.blessing, 34).slice(0, 2);
  const motifMarkup = buildShareCardMotif(deity, finish);
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600" fill="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${finish.shellFill}"/>
        <stop offset="50%" stop-color="${deity.palette[2]}"/>
        <stop offset="100%" stop-color="${deity.palette[1]}"/>
      </linearGradient>
      <linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${deity.palette[2]}" stop-opacity="0.34"/>
        <stop offset="45%" stop-color="${deity.palette[1]}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${deity.palette[0]}" stop-opacity="0.08"/>
      </linearGradient>
      <radialGradient id="orb" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stop-color="${deity.palette[0]}"/>
        <stop offset="45%" stop-color="${deity.palette[1]}"/>
        <stop offset="100%" stop-color="${deity.palette[2]}"/>
      </radialGradient>
      <radialGradient id="figureGlow" cx="50%" cy="35%" r="65%">
        <stop offset="0%" stop-color="${deity.palette[0]}" stop-opacity="0.78"/>
        <stop offset="62%" stop-color="${deity.palette[1]}" stop-opacity="0.26"/>
        <stop offset="100%" stop-color="${deity.palette[2]}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="mistBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${deity.palette[0]}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${deity.palette[0]}" stop-opacity="0.52"/>
        <stop offset="100%" stop-color="${deity.palette[0]}" stop-opacity="0"/>
      </linearGradient>
      <filter id="blur">
        <feGaussianBlur stdDeviation="34"/>
      </filter>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
      <clipPath id="figureClip">
        <rect x="600" y="96" width="518" height="788" rx="56"/>
      </clipPath>
    </defs>
    <rect width="1200" height="1600" rx="56" fill="url(#bg)"/>
    <rect x="20" y="20" width="1160" height="1560" rx="48" fill="url(#surface)" stroke="${finish.shellStroke}"/>
    <rect x="40" y="40" width="1120" height="1520" rx="40" fill="none" stroke="${finish.shellStroke}" stroke-opacity="0.55"/>
    <rect x="600" y="96" width="518" height="788" rx="56" fill="${finish.frameFill}" stroke="${finish.shellStroke}"/>
    <circle cx="858" cy="352" r="300" fill="url(#orb)" filter="url(#blur)" opacity="0.96"/>
    <circle cx="858" cy="352" r="236" fill="url(#figureGlow)" opacity="0.92"/>
    <circle cx="858" cy="352" r="224" stroke="${finish.shellStroke}" stroke-width="2"/>
    <circle cx="858" cy="352" r="280" stroke="${finish.shellStroke}" stroke-opacity="0.55" stroke-width="2"/>
    ${motifMarkup}
    <rect x="612" y="362" width="494" height="24" rx="999" fill="url(#mistBar)" opacity="0.9"/>
    <g clip-path="url(#figureClip)" filter="url(#softShadow)">
      <image href="${deityImageDataUrl}" x="600" y="108" width="518" height="770" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <text x="88" y="118" fill="${finish.textColor}" font-family="Arial, sans-serif" font-size="24" letter-spacing="8">MYTHIC GUARDIAN</text>
    <rect x="84" y="150" width="248" height="54" rx="27" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="124" y="185" fill="${finish.textColor}" font-family="Arial, sans-serif" font-size="24" letter-spacing="4">${escapeXml(
      viralSignal.archetype.toUpperCase()
    )}</text>
    <text x="1112" y="164" fill="${finish.textColor}" fill-opacity="0.72" text-anchor="end" font-family="Arial, sans-serif" font-size="22" letter-spacing="6">${escapeXml(
      deity.sigil.toUpperCase()
    )}</text>
    <text x="84" y="284" fill="${finish.textColor}" font-family="Georgia, serif" font-size="100" font-weight="700">${escapeXml(
      deity.name
    )}</text>
    <text x="84" y="340" fill="${finish.textColor}" fill-opacity="0.78" font-family="Arial, sans-serif" font-size="30">${escapeXml(
      deity.title
    )}</text>
    ${headlineLines
      .map(
        (line, index) =>
          `<text x="84" y="${424 + index * 48}" fill="${finish.textColor}" fill-opacity="0.82" font-family="Arial, sans-serif" font-size="30">${escapeXml(
            line
          )}</text>`
      )
      .join("")}
    <rect x="84" y="548" width="1032" height="434" rx="40" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="128" y="624" fill="${finish.textColor}" fill-opacity="0.64" font-family="Arial, sans-serif" font-size="24" letter-spacing="4">TODAY&apos;S INSIGHT</text>
    ${insightLines
      .map(
        (line, index) =>
          `<text x="128" y="${716 + index * 86}" fill="${finish.textColor}" font-family="Georgia, serif" font-size="66" font-weight="700">${escapeXml(
            line
          )}</text>`
      )
      .join("")}
    <rect x="84" y="1024" width="332" height="214" rx="30" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="116" y="1090" fill="${finish.textColor}" fill-opacity="0.62" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">PROFILE</text>
    <text x="116" y="1144" fill="${finish.textColor}" font-family="Arial, sans-serif" font-size="38">${escapeXml(
      profile.name || "Keeper"
    )}</text>
    <text x="116" y="1194" fill="${finish.textColor}" fill-opacity="0.8" font-family="Arial, sans-serif" font-size="26">${escapeXml(
      profile.zodiac
    )} aligned with ${escapeXml(modeLabel)}</text>
    <rect x="444" y="1024" width="260" height="214" rx="30" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="478" y="1090" fill="${finish.textColor}" fill-opacity="0.62" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">LUCKY NUMBER</text>
    <text x="478" y="1198" fill="${finish.textColor}" font-family="Georgia, serif" font-size="118">${String(luckyNumber)}</text>
    <rect x="732" y="1024" width="384" height="214" rx="30" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="766" y="1090" fill="${finish.textColor}" fill-opacity="0.62" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">SIGIL</text>
    <text x="766" y="1148" fill="${finish.textColor}" font-family="Georgia, serif" font-size="42">${escapeXml(deity.sigil)}</text>
    <text x="766" y="1202" fill="${finish.textColor}" fill-opacity="0.8" font-family="Arial, sans-serif" font-size="24">${escapeXml(
      deity.watchwords.join(" • ")
    )}</text>
    <rect x="84" y="1264" width="1032" height="220" rx="34" fill="${finish.panelOverlay}" stroke="${finish.shellStroke}"/>
    <text x="124" y="1332" fill="${finish.textColor}" fill-opacity="0.62" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">BLESSING</text>
    ${blessingLines
      .map(
        (line, index) =>
          `<text x="124" y="${1402 + index * 48}" fill="${finish.textColor}" font-family="Georgia, serif" font-size="42">${escapeXml(
            line
          )}</text>`
      )
      .join("")}
    <text x="84" y="1530" fill="${finish.textColor}" fill-opacity="0.76" font-family="Arial, sans-serif" font-size="22">${escapeXml(
      `${viralSignal.archetype} • ${modeLabel} • ${activeDeityShareFooter(deity)}`
    )}</text>
  </svg>
  `.trim();
}

function activeDeityShareFooter(deity: Deity) {
  return deity.themes.slice(0, 2).join(" • ");
}

function wrapText(value: string, maxLength: number) {
  const words = value.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (`${currentLine} ${word}`.trim().length <= maxLength) {
      currentLine = `${currentLine} ${word}`.trim();
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function buildThemeStyle(deity: Deity): CSSProperties {
  return {
    ["--accent-a" as any]: deity.palette[0],
    ["--accent-b" as any]: deity.palette[1],
    ["--accent-c" as any]: deity.palette[2]
  } as CSSProperties;
}

function sanitizeLegacyOmen(omen: string, deity: Deity) {
  let next = omen;

  if (deity.id === "caishen") {
    next = next.replace(/golden seal/gi, "prosperity seal");
    next = next.replace(/amplifying/gi, "drawing");
    next = next.replace(/multiply/gi, "steadiness");
    next = next.replace(/momentum/gi, "prosperity");
    next = next.replace(/visible action/gi, "practical support");
    next = next.replace(/clear priority/gi, "steady intention");
  }

  return next;
}

function sanitizeLegacyOffering(offering: string | null, deity: Deity) {
  if (!offering) {
    return null;
  }

  if (deity.id === "caishen") {
    const normalized = offering.toLowerCase();
    if (normalized === "clear priority") return "Steady Intention";
    if (normalized === "focused time") return "Practical Step";
    if (normalized === "bold ask") return "Honest Ask";
  }

  return offering;
}

function getDeityLifeAreaLabel(deityId: Deity["id"]) {
  const labels: Record<Deity["id"], string> = {
    guanyin: "Healing",
    caishen: "Prosperity",
    yuelao: "Love",
    wenchang: "Focus",
    mazu: "Protection"
  };

  return labels[deityId];
}

function getGuardianStatusLabel(companion: CompanionState, todayKey: string) {
  if (companion.lastRitualDay === todayKey) {
    return "Checked in today";
  }

  if (companion.guardianBond > 0) {
    return "Ready to return";
  }

  return "New guardian";
}

function getIntentionAccent(intention: Intention) {
  switch (intention) {
    case "healing":
      return "Soft calm";
    case "wealth":
      return "Steady support";
    case "love":
      return "Warmth & heart";
    case "focus":
      return "Clear mind";
    case "protection":
      return "Safe passage";
    default:
      return "Guardian path";
  }
}

function analyzeConcern(concern: string, fallback: Intention): ConcernMatch {
  const normalized = concern.toLowerCase();
  if (!normalized.trim()) {
    return {
      intention: fallback,
      confidence: "low",
      signals: [],
      summary: "No live situation is written yet, so the match is leaning on your selected need."
    };
  }

  const keywordGroups: {
    intention: Intention;
    summary: string;
    strongKeywords: string[];
    keywords: string[];
  }[] = [
    {
      intention: "wealth",
      strongKeywords: ["赚钱", "发财", "暴富", "money", "wealth", "salary", "income", "cash", "profit", "raise"],
      keywords: ["career", "job", "work", "business", "client", "offer", "project", "pitch", "debt", "钱", "事业", "工作", "客户", "项目", "财务", "收入", "订单", "成交", "奖金", "副业", "offer", "promotion"],
      summary: "Your wording sounds most like a pressure around money, work, value, or forward movement."
    },
    {
      intention: "healing",
      strongKeywords: ["生病", "住院", "hospital", "ill", "sick", "healing", "recovery"],
      keywords: ["heal", "anxious", "anxiety", "stress", "sleep", "overwhelmed", "family", "grief", "健康", "焦虑", "压力", "失眠", "家人", "难过", "疗愈", "恢复", "崩溃", "痛苦", "情绪", "panic", "burnout"],
      summary: "Your wording sounds most like emotional strain, recovery, or worry that wants relief first."
    },
    {
      intention: "love",
      strongKeywords: ["relationship", "love", "复合", "感情", "爱情", "partner"],
      keywords: ["someone", "friend", "reconnect", "message", "repair", "lonely", "connection", "closeness", "关系", "喜欢", "修复", "朋友", "联系", "对方", "暧昧", "沟通", "婚姻", "heart", "romance"],
      summary: "Your wording sounds most like a pull toward connection, repair, or emotional clarity with someone."
    },
    {
      intention: "focus",
      strongKeywords: ["考试", "exam", "study", "focus", "专注", "论文"],
      keywords: ["write", "writing", "creative", "thesis", "discipline", "finish", "attention", "学习", "写作", "创作", "完成", "效率", "deadline", "presentation", "research", "面试准备"],
      summary: "Your wording sounds most like a concentration, study, or output problem that needs steadier discipline."
    },
    {
      intention: "protection",
      strongKeywords: ["平安", "safety", "safe", "visa", "travel", "trip"],
      keywords: ["moving", "move", "transition", "crossing", "flight", "road", "relocation", "旅行", "出行", "搬家", "转变", "过渡", "安全", "远行", "上路", "出国", "航班", "navigation"],
      summary: "Your wording sounds most like a transition, safety concern, or unstable period that needs steadier passage."
    }
  ];

  let bestGroup = keywordGroups.find((group) => group.intention === fallback) ?? keywordGroups[0];
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const group of keywordGroups) {
    const strongSignals = group.strongKeywords.filter((keyword) => normalized.includes(keyword));
    const regularSignals = group.keywords.filter((keyword) => normalized.includes(keyword));
    const matchedSignals = [...strongSignals, ...regularSignals];
    const score = strongSignals.length * 3 + regularSignals.length;
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
      bestSignals = matchedSignals;
    }
  }

  const confidence = bestScore >= 4 ? "high" : bestScore >= 1 ? "medium" : "low";

  return {
    intention: bestScore > 0 ? bestGroup.intention : fallback,
    confidence,
    signals: bestSignals.slice(0, 3),
    summary: bestScore > 0 ? bestGroup.summary : "The written concern is still broad, so the match is leaning more heavily on your selected need."
  };
}

function getConcernDisplayLine(match: ConcernMatch, deity: Deity) {
  switch (match.intention) {
    case "wealth":
      return "Wishing for steadier fortune, livelihood support, and relief from money pressure.";
    case "healing":
      return "Wishing for healing, emotional relief, and a gentler inner climate.";
    case "love":
      return "Wishing for warmth, clarity, and a steadier connection with someone meaningful.";
    case "focus":
      return "Wishing for clarity, concentration, and steadier follow-through.";
    case "protection":
      return "Wishing for protection, steadier passage, and calm through uncertainty.";
    default:
      return `${deity.name} answered a wish that wants comfort and support.`;
  }
}

function getRitualWishDisplayLine(deity: Deity) {
  switch (deity.id) {
    case "caishen":
      return "Your wish for prosperity has been placed in your personal shrine.";
    case "guanyin":
      return "Your wish for peace and healing has been placed in your personal shrine.";
    case "yuelao":
      return "Your wish for warmth and connection has been placed in your personal shrine.";
    case "wenchang":
      return "Your wish for clarity and focus has been placed in your personal shrine.";
    case "mazu":
      return "Your wish for protection has been placed in your personal shrine.";
    default:
      return "Your wish has been placed in your personal shrine.";
  }
}

function getIntentArchiveDisplayLine(deity: Deity, index: number) {
  const order =
    index === 0
      ? "Most recent"
      : index === 1
        ? "Previous"
        : index === 2
          ? "Earlier"
          : `Archive ${index + 1}`;

  switch (deity.id) {
    case "caishen":
      return `${order} prosperity intention stored in the archive.`;
    case "guanyin":
      return `${order} healing intention stored in the archive.`;
    case "yuelao":
      return `${order} connection intention stored in the archive.`;
    case "wenchang":
      return `${order} focus intention stored in the archive.`;
    case "mazu":
      return `${order} protection intention stored in the archive.`;
    default:
      return `${order} ritual intention stored in the archive.`;
  }
}

function getStoredWishArchiveLine(deity: Deity) {
  switch (deity.id) {
    case "caishen":
      return "Prosperity intention sealed for steadier fortune and livelihood support.";
    case "guanyin":
      return "Healing intention sealed for relief and inner softness.";
    case "yuelao":
      return "Connection intention sealed for warmth and clearer closeness.";
    case "wenchang":
      return "Focus intention sealed for completion and steadier discipline.";
    case "mazu":
      return "Protection intention sealed for steadier passage and safety.";
    default:
      return "Ritual intention sealed and stored in the archive.";
  }
}

function getCopyInsightLine(deity: Deity) {
  switch (deity.id) {
    case "caishen":
      return "I invited Caishen to stay with me.";
    case "guanyin":
      return "I invited Guanyin to stay with me.";
    case "yuelao":
      return "I invited Yuelao to stay with me.";
    case "wenchang":
      return "I invited Wenchang to stay with me.";
    case "mazu":
      return "I invited Mazu to stay with me.";
    default:
      return "I invited an Eastern guardian to stay with me.";
  }
}

function isPreRitualProfile(profile: ShrineProfile) {
  return deities.every((deity) => {
    const companion = profile.companions[deity.id];
    return (
      companion.guardianBond === 0 &&
      companion.streak === 0 &&
      companion.wishes.length === 0 &&
      companion.ritualHistory.length === 0 &&
      companion.lastRitualDay === null &&
      companion.lastQuestDay === null
    );
  });
}

function getUnlockedKeepsakes(deity: Deity, bond: number) {
  return deity.keepsakes.filter((keepsake) => bond >= keepsake.bond);
}

function getNextKeepsake(deity: Deity, bond: number) {
  return deity.keepsakes.find((keepsake) => bond < keepsake.bond) ?? null;
}

function getCompanionEnergy(streak: number, bond: number) {
  const total = streak * 8 + bond;
  if (total >= 120) {
    return "Radiant";
  }
  if (total >= 72) {
    return "Steady";
  }
  if (total >= 28) {
    return "Waking";
  }
  return "Dormant";
}

function getUnlockedCardFinishes(stats: { awakenedCount: number; totalBond: number }) {
  return cardFinishes.filter((finish) => finish.unlocked(stats));
}

function getCardFinishById(cardFinishId: CardFinishId) {
  return cardFinishes.find((finish) => finish.id === cardFinishId) ?? cardFinishes[0];
}

function getMilestoneRewards(stats: { awakenedCount: number; totalBond: number }): MilestoneReward[] {
  return [
    {
      title: "First Orbit",
      description: "Awaken your first guardian to start the companion return loop.",
      complete: stats.awakenedCount >= 1
    },
    {
      title: "Silk Archive",
      description: "Awaken 3 guardians or reach 60 total bond to unlock collector-grade card finishes.",
      complete: stats.awakenedCount >= 3 || stats.totalBond >= 60
    },
    {
      title: "Inner Court",
      description: "Awaken all 5 guardians or reach 180 total bond to complete the constellation system.",
      complete: stats.awakenedCount === deities.length || stats.totalBond >= 180
    }
  ];
}

function getPremiumBenefits(stats: { awakenedCount: number; totalBond: number; allAwakened: boolean }): PremiumBenefit[] {
  return [
    {
      title: "Extended Forecast",
      description: "Expand from a short constellation preview into a deeper multi-day guidance map.",
      state: stats.totalBond >= 60 ? "unlocked" : "preview"
    },
    {
      title: "Deep Memory Archive",
      description: "Store a longer history of signals, intentions, keepsakes, and companion growth.",
      state: stats.totalBond >= 120 ? "unlocked" : "preview"
    },
    {
      title: "Collector Card Editions",
      description: "Unlock rarer guardian card finishes, future seasonal skins, and premium share outputs.",
      state: stats.allAwakened || stats.totalBond >= 180 ? "unlocked" : "preview"
    }
  ];
}

function getRecommendedTier(stats: { awakenedCount: number; totalBond: number }) {
  if (stats.awakenedCount >= 3 || stats.totalBond >= 90) {
    return "oracle";
  }

  if (stats.awakenedCount >= 1 || stats.totalBond >= 24) {
    return "plus";
  }

  return "free";
}

function buildCompatibilityReading({
  profile,
  activeDeity,
  supportGuardian,
  otherBirthDate,
  otherName,
  mode
}: {
  profile: ShrineProfile;
  activeDeity: Deity;
  supportGuardian: Deity;
  otherBirthDate: string;
  otherName: string;
  mode: CompatibilityMode;
}): CompatibilityReading | null {
  const counterpartZodiac = getZodiacFromBirthDate(otherBirthDate);
  if (!counterpartZodiac) {
    return null;
  }

  const counterpartGuardian = getDeityForZodiac(counterpartZodiac);
  const counterpartIntention = getZodiacIntention(counterpartZodiac);
  const sharedWords = Array.from(new Set([...activeDeity.watchwords, ...counterpartGuardian.watchwords]));
  const counterpartNameLabel = otherName.trim() || "This person";
  const titleMap: Record<CompatibilityMode, string> = {
    romantic: "Shared Closeness Mirror",
    friendship: "Shared Care Mirror",
    creative: "Shared Work Mirror"
  };
  const summary =
    activeDeity.id === counterpartGuardian.id
      ? `${counterpartNameLabel} mirrors your dominant guardian energy, so this reflection highlights what becomes louder when two similar temperaments meet.`
      : `${activeDeity.name} leads with ${activeDeity.watchwords[0].toLowerCase()}, while ${counterpartGuardian.name} answers through ${counterpartGuardian.watchwords[0].toLowerCase()}, giving you two different emotional languages to notice.`;
  const reflectionFocus =
    mode === "romantic"
      ? `Notice what happens when both of you choose ${sharedWords[0].toLowerCase()} before intensity or performance.`
      : mode === "friendship"
        ? `Notice how ${sharedWords[0].toLowerCase()} and ${sharedWords[1].toLowerCase()} shape trust more than constant contact does.`
        : `Notice how ${sharedWords[0].toLowerCase()} needs structure while ${sharedWords[1].toLowerCase()} needs visibility in shared work.`;
  const tensionMirror =
    activeDeity.id === counterpartGuardian.id
      ? "When both people bring the same energy, the connection can intensify quickly. The reflection here is about pace, not judgment."
      : `${activeDeity.name} reaches through ${activeDeity.watchwords[1].toLowerCase()}, while ${counterpartGuardian.name} often protects through ${counterpartGuardian.watchwords[1].toLowerCase()}. The difference is something to observe, not score.`;
  const sharedPractice =
    counterpartGuardian.id === supportGuardian.id || counterpartIntention === profile.intention
      ? `A useful shared practice this week is ${sharedWords[0].toLowerCase()} with clearer naming and calmer timing.`
      : `A useful shared practice this week is slowing down enough to notice when ${sharedWords[0].toLowerCase()} and ${sharedWords[1].toLowerCase()} are asking for different things.`;
  const shareLine = `${counterpartNameLabel} and I used Mythic Guardian as a shared mirror, not a verdict or prediction. ${titleMap[mode]} under ${activeDeity.name} and ${counterpartGuardian.name}.`;

  return {
    title: titleMap[mode],
    counterpartName: counterpartNameLabel,
    counterpartZodiac,
    counterpartGuardian: counterpartGuardian.name,
    summary,
    reflectionFocus,
    tensionMirror,
    sharedPractice,
    shareLine
  };
}

function getViralProfileSignal(profile: ShrineProfile, deity: Deity): ViralProfileSignal {
  const map: Record<Deity["id"], Record<string, ViralProfileSignal>> = {
    guanyin: {
      healing: {
        archetype: "Soft Power",
        headline: "You are the kind of person whose calm changes the room before your words do.",
        shareLine: "I invited Guanyin to stay with me for peace and healing."
      },
      protection: {
        archetype: "Quiet Harbor",
        headline: "You move like a refuge for people who are tired of chaos.",
        shareLine: "I invited Guanyin to stay with me as a gentle shelter."
      },
      default: {
        archetype: "Moon Reset",
        headline: "You recover by going inward, then returning clearer than before.",
        shareLine: "Guanyin is the Eastern guardian staying with me right now."
      }
    },
    caishen: {
      wealth: {
        archetype: "Golden Shelter",
        headline: "You are looking for steadier fortune, calmer money energy, and the feeling that your effort is being held.",
        shareLine: "I invited Caishen to stay with me for prosperity and support."
      },
      focus: {
        archetype: "Steady Builder",
        headline: "Your strength grows when practical effort meets inner steadiness instead of urgency alone.",
        shareLine: "I invited Caishen to stay with me and bless my path forward."
      },
      default: {
        archetype: "Fortune Lantern",
        headline: "You are being asked to meet uncertainty with steadier courage, not with panic.",
        shareLine: "Caishen is the Eastern guardian staying with me right now."
      }
    },
    yuelao: {
      love: {
        archetype: "Red Thread",
        headline: "You are built for deep, intentional connections rather than casual noise.",
        shareLine: "I invited Yuelao to stay with me for warmth and connection."
      },
      healing: {
        archetype: "Heart Repairer",
        headline: "You do not just seek closeness. You want warmth that can actually last.",
        shareLine: "I invited Yuelao to stay with me and keep my heart warm."
      },
      default: {
        archetype: "Lantern Heart",
        headline: "Your strongest connections form where tenderness feels safe, not dramatic.",
        shareLine: "Yuelao is the Eastern guardian staying with me right now."
      }
    },
    wenchang: {
      focus: {
        archetype: "Celestial Mind",
        headline: "You are meant to turn raw thought into craft, language, and mastery.",
        shareLine: "I invited Wenchang to stay with me for clarity and focus."
      },
      wealth: {
        archetype: "Strategic Scholar",
        headline: "Your edge is not speed alone. It is disciplined clarity under pressure.",
        shareLine: "I invited Wenchang to stay with me and steady my mind."
      },
      default: {
        archetype: "Ink Discipline",
        headline: "You move furthest when your attention stops splitting in five directions.",
        shareLine: "Wenchang is the Eastern guardian staying with me right now."
      }
    },
    mazu: {
      protection: {
        archetype: "Safe Passage",
        headline: "You are built to survive change without losing your center.",
        shareLine: "I invited Mazu to stay with me for protection and safe passage."
      },
      healing: {
        archetype: "Tide Keeper",
        headline: "You know how to keep moving even when the emotional weather turns rough.",
        shareLine: "I invited Mazu to stay with me and keep my path steady."
      },
      default: {
        archetype: "Harbor Soul",
        headline: "You trust the steady route more than the loud one, and that protects you.",
        shareLine: "Mazu is the Eastern guardian staying with me right now."
      }
    }
  };

  return map[deity.id][profile.intention] ?? map[deity.id].default;
}

function getInsightMoodLine(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Receive this slowly. Guanyin answers best when the room inside you quiets first.";
    case "caishen":
      return "Receive this as steadiness before action. Caishen answers best when fear softens enough for one practical step.";
    case "yuelao":
      return "Hold this close to the heart. Yuelao responds when honesty feels warmer than performance.";
    case "wenchang":
      return "Read this slowly. Wenchang answers when the mind is given enough quiet to gather itself again.";
    case "mazu":
      return "Take this as a directional light. Mazu answers through steadiness, not drama.";
    default:
      return deity.idleSceneCaption;
  }
}

function getActionPanelLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Keep & Share";
    case "caishen":
      return "Keep & Share";
    case "yuelao":
      return "Keep & Share";
    case "wenchang":
      return "Keep & Share";
    case "mazu":
      return "Keep & Share";
    default:
      return "Keep & Share";
  }
}

function getActionPanelSupportLine(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Keep this blessing close, or share it with someone who may need a little comfort.";
    case "caishen":
      return "Keep this blessing close, or share it with someone who may need a little support.";
    case "yuelao":
      return "Keep this blessing close, or share it with someone who may need a little warmth.";
    case "wenchang":
      return "Keep this blessing close, or share it with someone who may need a little clarity.";
    case "mazu":
      return "Keep this blessing close, or share it with someone who may need a little protection.";
    default:
      return "Keep this blessing close, or share it with someone who may need it.";
  }
}

function getShareCardSpiritLine(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "A soft guardian for healing, release, and emotional clarity.";
    case "caishen":
      return "A golden guardian for prosperity, steadier fortune, and calmer courage under pressure.";
    case "yuelao":
      return "A lantern guardian for warmth, honesty, and returned affection.";
    case "wenchang":
      return "A study guardian for discipline, craft, and follow-through.";
    case "mazu":
      return "A harbor guardian for protection, guidance, and steadier crossings.";
    default:
      return deity.essence;
  }
}

function getGuidancePanelLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Stay Close";
    case "caishen":
      return "Stay Close";
    case "yuelao":
      return "Stay Close";
    case "wenchang":
      return "Stay Close";
    case "mazu":
      return "Stay Close";
    default:
      return "Stay Close";
  }
}

function getGuidancePanelTitle(deity: Deity, ritualComplete: boolean) {
  if (ritualComplete) {
    switch (deity.id) {
      case "guanyin":
        return "Guanyin stayed close to you today";
      case "caishen":
        return "Caishen stayed close to you today";
      case "yuelao":
        return "Yuelao stayed close to you today";
      case "wenchang":
        return "Wenchang stayed close to you today";
      case "mazu":
        return "Mazu stayed close to you today";
      default:
        return "Your guardian stayed close today";
    }
  }

  switch (deity.id) {
    case "guanyin":
      return "Keep Guanyin close today";
    case "caishen":
      return "Keep Caishen close today";
    case "yuelao":
      return "Keep Yuelao close today";
    case "wenchang":
      return "Keep Wenchang close today";
    case "mazu":
      return "Keep Mazu close today";
    default:
      return "Keep your guardian close today";
  }
}

function getGuidancePanelSupport(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Write one quiet wish and let Guanyin stay beside it with calm and softness.";
    case "caishen":
      return "Write one practical wish and let Caishen stay beside it with steadiness and support.";
    case "yuelao":
      return "Write one wish from the heart and let Yuelao stay beside it with warmth and closeness.";
    case "wenchang":
      return "Write one clear intention and let Wenchang stay beside it with focus and clarity.";
    case "mazu":
      return "Write one wish for safety or steadiness and let Mazu stay beside it through change.";
    default:
      return "Write one wish and let your guardian stay close to it.";
  }
}

function getGuidanceButtonLabel(deity: Deity, ritualComplete: boolean) {
  if (ritualComplete) {
    switch (deity.id) {
      case "guanyin":
        return "Already with you today";
      case "caishen":
        return "Already with you today";
      case "yuelao":
        return "Already with you today";
      case "wenchang":
        return "Already with you today";
      case "mazu":
        return "Already with you today";
      default:
        return "Done for today";
    }
  }

  switch (deity.id) {
    case "guanyin":
      return "Keep Guanyin with me";
    case "caishen":
      return "Keep Caishen with me";
    case "yuelao":
      return "Keep Yuelao with me";
    case "wenchang":
      return "Keep Wenchang with me";
    case "mazu":
      return "Keep Mazu with me";
    default:
      return "Keep this guardian with me";
  }
}

function getLatestWishLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Your latest wish";
    case "caishen":
      return "Your latest wish";
    case "yuelao":
      return "Your latest wish";
    case "wenchang":
      return "Your latest wish";
    case "mazu":
      return "Your latest wish";
    default:
      return "Your latest wish";
  }
}

function getLatestResponseLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Blessing response";
    case "caishen":
      return "Blessing response";
    case "yuelao":
      return "Blessing response";
    case "wenchang":
      return "Blessing response";
    case "mazu":
      return "Blessing response";
    default:
      return "Blessing response";
  }
}

function getKeepsakesLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Shrine memories";
    case "caishen":
      return "Shrine memories";
    case "yuelao":
      return "Shrine memories";
    case "wenchang":
      return "Shrine memories";
    case "mazu":
      return "Shrine memories";
    default:
      return "Shrine memories";
  }
}

function getKeepsakesEmptyLine(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "The first mercy keepsake appears once softness starts building into a real return pattern.";
    case "caishen":
      return "The first prosperity keepsake appears once steadier money choices begin to feel real and supported.";
    case "yuelao":
      return "The first thread keepsake appears once honesty begins to warm the connection.";
    case "wenchang":
      return "The first study keepsake appears once disciplined return starts to hold.";
    case "mazu":
      return "The first harbor keepsake appears once steadiness begins to guide the crossing.";
    default:
      return "The first collectible memory unlocks as your connection with this guardian grows.";
  }
}

function getRitualStepLabels(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return { invite: "Soften", receive: "Receive", act: "Release" };
    case "caishen":
      return { invite: "Call", receive: "Receive", act: "Move" };
    case "yuelao":
      return { invite: "Reveal", receive: "Receive", act: "Reach" };
    case "wenchang":
      return { invite: "Focus", receive: "Receive", act: "Finish" };
    case "mazu":
      return { invite: "Anchor", receive: "Receive", act: "Cross" };
    default:
      return { invite: "Invite", receive: "Receive", act: "Act" };
  }
}

function getGuidancePlaceholder(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "What do you want to soften, release, or forgive today?";
    case "caishen":
      return "What money worry, livelihood pressure, or practical need do you want support with today?";
    case "yuelao":
      return "What connection, feeling, or truth is asking to be named today?";
    case "wenchang":
      return "What work, page, or task deserves your full mind today?";
    case "mazu":
      return "What crossing, transition, or uncertainty needs steadier guidance today?";
    default:
      return "What support do you want today?";
  }
}

function getUpgradeOfferLine(target: UpgradeTarget) {
  return target === "plus"
    ? "Best if you want this guardian to stay close across the week, not disappear after one result."
    : "Best if you want your full guardian path remembered, expanded, and held in a deeper archive.";
}

function getUpgradeImmediateUnlocks(target: UpgradeTarget) {
  return target === "plus"
    ? [
        "Deeper daily guidance that grows more personal as you return",
        "A fuller shared reflection layer when you want more emotional nuance",
        "A weekly guardian rhythm with richer card finishes and more continuity"
      ]
    : [
        "A full ritual archive with longer memory and signal history",
        "Collector editions and prestige exports across your full guardian journey",
        "Long-form interpretation for people who want a deeper, more memorable archive"
      ];
}

function getRecommendedRitualPack(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return ritualPacks[0];
    case "caishen":
      return ritualPacks[1];
    case "yuelao":
      return ritualPacks[2];
    case "wenchang":
      return ritualPacks[3];
    case "mazu":
      return ritualPacks[4];
    default:
      return ritualPacks[0];
  }
}

function getShareCardIdentityLine(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "For people choosing softness over collapse.";
    case "caishen":
      return "For people asking for steadier fortune without losing heart.";
    case "yuelao":
      return "For people ready to name what the heart already knows.";
    case "wenchang":
      return "For people protecting attention like sacred ground.";
    case "mazu":
      return "For people crossing uncertainty without losing direction.";
    default:
      return "A symbolic guardian for the season you are in.";
  }
}

function getShareCardCollectibleLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Mercy Edition";
    case "caishen":
      return "Prosperity Edition";
    case "yuelao":
      return "Connection Edition";
    case "wenchang":
      return "Scholar Edition";
    case "mazu":
      return "Harbor Edition";
    default:
      return "Guardian Edition";
  }
}

function getGuardianRoleTitle(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Peace & Healing";
    case "caishen":
      return "Prosperity & Support";
    case "yuelao":
      return "Love & Warmth";
    case "wenchang":
      return "Focus & Clarity";
    case "mazu":
      return "Protection & Safe Passage";
    default:
      return "Eastern Guardian";
  }
}

function getGuardianRoleSupport(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "For emotional recovery, softer decisions, and the kind of clarity that arrives after pressure drops.";
    case "caishen":
      return "For livelihood pressure, steadier money choices, and the kind of reassurance that helps you keep going.";
    case "yuelao":
      return "For warmth, honest attraction, and connections that become clearer when someone finally reaches.";
    case "wenchang":
      return "For disciplined attention, better output, and the quiet pride of finishing what matters.";
    case "mazu":
      return "For transitions, uncertain crossings, and the steadier route that keeps panic from taking over.";
    default:
      return deity.essence;
  }
}

function getGuardianSwitchHook(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Release, recovery, and inner quiet.";
    case "caishen":
      return "Prosperity, practical support, and steadier courage.";
    case "yuelao":
      return "Closeness, repair, and emotional honesty.";
    case "wenchang":
      return "Study, writing, and disciplined output.";
    case "mazu":
      return "Travel, transitions, and safe crossings.";
    default:
      return deity.companionStyle;
  }
}

function getGuardianAccessLabel({
  deity,
  primaryDeityId,
  unlockedPacks,
  companion
}: {
  deity: Deity;
  primaryDeityId: Deity["id"];
  unlockedPacks: string[];
  companion: CompanionState;
}) {
  if (deity.id === primaryDeityId) {
    return "Free now";
  }

  if (
    hasAllGuardiansUnlocked(unlockedPacks) ||
    companion.guardianBond > 0 ||
    unlockedPacks.includes(getRecommendedRitualPack(deity).title)
  ) {
    return "Unlocked";
  }

  return "One-time unlock";
}

function isGuardianUnlocked({
  deity,
  primaryDeityId,
  unlockedPacks,
  companion
}: {
  deity: Deity;
  primaryDeityId: Deity["id"];
  unlockedPacks: string[];
  companion: CompanionState;
}) {
  return (
    deity.id === primaryDeityId ||
    hasAllGuardiansUnlocked(unlockedPacks) ||
    companion.guardianBond > 0 ||
    unlockedPacks.includes(getRecommendedRitualPack(deity).title)
  );
}

function getRevealEyebrow(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Your first guardian";
    case "caishen":
      return "Your first guardian";
    case "yuelao":
      return "Your first guardian";
    case "wenchang":
      return "Your first guardian";
    case "mazu":
      return "Your first guardian";
    default:
      return "First guardian revealed";
  }
}

function getRevealHeading(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Guanyin is with you now.";
    case "caishen":
      return "Caishen is with you now.";
    case "yuelao":
      return "Yuelao is with you now.";
    case "wenchang":
      return "Wenchang is with you now.";
    case "mazu":
      return "Mazu is with you now.";
    default:
      return `Your first guardian is ${deity.name}.`;
  }
}

function getPrimaryHeroLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Why Guanyin is with you";
    case "caishen":
      return "Why Caishen is with you";
    case "yuelao":
      return "Why Yuelao is with you";
    case "wenchang":
      return "Why Wenchang is with you";
    case "mazu":
      return "Why Mazu is with you";
    default:
      return `Why ${deity.name} answered first`;
  }
}

function getRitualMapLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "What this guardian softens around you";
    case "caishen":
      return "What this guardian steadies around you";
    case "yuelao":
      return "What this guardian warms around you";
    case "wenchang":
      return "What this guardian sharpens around you";
    case "mazu":
      return "What this guardian steadies around you";
    default:
      return "Your current ritual map";
  }
}

function getShareCardLabel(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Mercy Guardian Card";
    case "caishen":
      return "Prosperity Guardian Card";
    case "yuelao":
      return "Connection Guardian Card";
    case "wenchang":
      return "Scholar Guardian Card";
    case "mazu":
      return "Harbor Guardian Card";
    default:
      return "Shareable Guardian Card";
  }
}

function getLandingPosterHook(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "A symbol of peace, safety, and blessings for well-being.";
    case "caishen":
      return "A symbol of prosperity, support, and better fortune ahead.";
    case "yuelao":
      return "A symbol of warmth, closeness, and heartfelt connection.";
    case "wenchang":
      return "A symbol of clarity, focus, and steady growth.";
    case "mazu":
      return "A symbol of protection, safe passage, and calm through change.";
    default:
      return deity.essence;
  }
}

function getUpgradeReasonNow(deity: Deity) {
  switch (deity.id) {
    case "guanyin":
      return "Best when you want comfort that lasts longer than a single reading.";
    case "caishen":
      return "Best when you want this sense of support to stay with you beyond one reading.";
    case "yuelao":
      return "Best when one connection needs more honesty, nuance, and emotional clarity.";
    case "wenchang":
      return "Best when you want focus that carries into tomorrow, not just tonight.";
    case "mazu":
      return "Best when this transition is still unfolding and you want steadier guidance beyond today.";
    default:
      return "Best when you want the ritual to stay with you longer.";
  }
}

function getLaunchUpgradeAngle(deity: Deity, recommendedTier: PremiumTier["id"]) {
  if (recommendedTier === "free") {
    switch (deity.id) {
      case "guanyin":
        return "Keep Guanyin with you for a softer, steadier healing rhythm across the week.";
      case "caishen":
        return "Keep Caishen close when money pressure is not over and you want steadier support around your next steps.";
      case "yuelao":
        return "Keep Yuelao close when a connection needs more warmth, care, or repair.";
      case "wenchang":
        return "Keep Wenchang active when you want a clarity ritual you can return to all week.";
      case "mazu":
        return "Keep Mazu near when this crossing will not be solved in a single night.";
      default:
        return "Stay with this guardian longer if the first result already feels personal.";
    }
  }

  if (recommendedTier === "plus") {
    switch (deity.id) {
      case "guanyin":
        return "Circle Access fits best when emotional clarity is already your reason to come back.";
      case "caishen":
        return "Circle Access fits best when livelihood pressure keeps returning and you want a calmer prosperity ritual to come back to.";
      case "yuelao":
        return "Circle Access fits best when closeness and emotional reflection are bringing you back.";
      case "wenchang":
        return "Circle Access fits best when disciplined return is starting to become a habit.";
      case "mazu":
        return "Circle Access fits best when protection and transition both need a longer runway.";
      default:
        return "Circle Access fits best when each return deserves more depth.";
    }
  }

  switch (deity.id) {
    case "guanyin":
      return "Archive Circle is for keeping Guanyin's full healing trail, not losing it after one session.";
    case "caishen":
      return "Archive Circle is for keeping your prosperity path, emotional pressure, and practical support trail in one place.";
    case "yuelao":
      return "Archive Circle is for keeping emotional memory and connection patterns in one place.";
    case "wenchang":
      return "Archive Circle is for turning progress, drafts, and discipline into a lasting archive.";
    case "mazu":
      return "Archive Circle is for long crossings that deserve memory, continuity, and keepsakes.";
    default:
      return "Archive Circle is for people who want the full archive, not just the latest reading.";
  }
}

function buildWeeklyForecast(profile: ShrineProfile, primary: Deity, support: Deity, zodiacGuardian: Deity) {
  const focusPool = Array.from(new Set([...primary.watchwords, ...support.watchwords]));
  const guidePool = Array.from(new Map([primary, support, zodiacGuardian].map((deity) => [deity.id, deity])).values());
  const offsetSeed = `${profile.birthDate}${profile.zodiac}${profile.intention}`;
  const offset =
    offsetSeed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % Math.max(1, guidePool.length);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index);
    const guardian = guidePool[(index + offset) % guidePool.length];
    const focus = rotateByDate(focusPool, `${guardian.id}${profile.intention}${index}-focus`, date);

    return {
      day: formatShortDay(date),
      guardian: guardian.name,
      focus
    };
  });
}

function App() {
  const [profile, setProfile] = useState<ShrineProfile>(defaultProfile);
  const [commerceState, setCommerceState] = useState<CommerceState>(createDefaultCommerceState());
  const [hasProfile, setHasProfile] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState(deities[0].offerings[0]);
  const [compatibilityName, setCompatibilityName] = useState("");
  const [compatibilityBirthDate, setCompatibilityBirthDate] = useState("");
  const [compatibilityMode, setCompatibilityMode] = useState<CompatibilityMode>("romantic");
  const [activeView, setActiveView] = useState<"landing" | "onboarding" | "shrine">("landing");
  const [staticPage, setStaticPage] = useState<StaticPageId | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [upgradeTarget, setUpgradeTarget] = useState<null | UpgradeTarget>(null);
  const [upgradeStep, setUpgradeStep] = useState<UpgradeStep>("overview");
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>("plus-monthly");
  const [selectedPack, setSelectedPack] = useState<null | RitualPack>(null);
  const [packCheckoutStep, setPackCheckoutStep] = useState<PackCheckoutStep>("details");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [pendingCheckoutSession, setPendingCheckoutSession] = useState<CheckoutSession | null>(null);
  const [checkoutReturnState, setCheckoutReturnState] = useState<CheckoutReturnState>("idle");
  const [checkoutReturnMessage, setCheckoutReturnMessage] = useState("");
  const [shareCardDeityImages, setShareCardDeityImages] = useState<Partial<Record<Deity["id"], string>>>({});
  const [sceneState, setSceneState] = useState<"idle" | "switching" | "blessing">("idle");
  const [sceneVersion, setSceneVersion] = useState(0);
  const [todayKey, setTodayKey] = useState(getTodayKey());
  const [viewedDeityId, setViewedDeityId] = useState<Deity["id"]>(defaultProfile.deityId);

  useEffect(() => {
    const syncTodayKey = () => setTodayKey(getTodayKey());
    syncTodayKey();
    const timer = window.setInterval(syncTodayKey, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncRouteState = () => {
      const matchedStaticPage = getStaticPageFromPath(window.location.pathname);
      setStaticPage(matchedStaticPage);

      if (matchedStaticPage) {
        setActiveView("landing");
      }
    };

    syncRouteState();
    window.addEventListener("popstate", syncRouteState);
    return () => window.removeEventListener("popstate", syncRouteState);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const parsed = realignProfileGuardian(normalizeProfile(JSON.parse(saved) as ShrineProfile));
      setProfile(parsed);
      setSelectedOffering(
        parsed.companions[parsed.deityId].latestOffering ??
          (deities.find((deity) => deity.id === parsed.deityId)?.offerings[0] ?? deities[0].offerings[0])
      );
      setViewedDeityId(parsed.deityId);
      setHasProfile(true);
      setActiveView("shrine");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    void commerceGateway.load().then((state) => {
      setCommerceState(state);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const checkoutSessionId = params.get("checkout_session");
    const checkoutProvider = params.get("provider");
    const checkoutMode = params.get("mode");
    const checkoutEmail = params.get("email");
    const checkoutTitle = params.get("title");

    if (checkoutStatus !== "success" || !checkoutMode || !checkoutEmail) {
      return;
    }

    const normalizedCheckoutEmail = checkoutEmail.trim().toLowerCase();
    const pendingGumroadCheckout =
      checkoutMode === "pack" && checkoutSessionId ? readPendingGumroadCheckout() : null;
    const hasMatchingPendingGumroadCheckout =
      checkoutProvider === "gumroad" &&
      checkoutMode === "pack" &&
      checkoutSessionId &&
      pendingGumroadCheckout?.sessionId === checkoutSessionId &&
      pendingGumroadCheckout.email === normalizedCheckoutEmail &&
      pendingGumroadCheckout.title === checkoutTitle;

    if (
      checkoutMode === "pack" &&
      checkoutProvider === "gumroad" &&
      !hasMatchingPendingGumroadCheckout
    ) {
      params.delete("checkout");
      params.delete("checkout_session");
      params.delete("mode");
      params.delete("provider");
      params.delete("email");
      params.delete("title");
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
      return;
    }

    async function confirmReturnedCheckout() {
      setCheckoutReturnState("processing");
      setCheckoutReturnMessage(
        checkoutProvider === "gumroad"
          ? "Payment return detected. Confirming your Gumroad unlock now..."
          : "Payment received. Unlocking your guardian now..."
      );
      try {
        if (checkoutMode === "subscription") {
          const inferredTarget = checkoutTitle === "Oracle Circle" ? "oracle" : "plus";
          const planId =
            inferredTarget === "oracle"
              ? "oracle-monthly"
              : selectedPlanId === "plus-annual"
                ? "plus-annual"
                : "plus-monthly";

          const nextCommerceState = await commerceGateway.confirmSubscriptionCheckout({
            email: normalizedCheckoutEmail,
            tier: inferredTarget,
            planId,
            priceLabel: inferredTarget === "oracle" ? "$19/mo" : planId === "plus-annual" ? "$58/yr" : "$7/mo"
          });
          const nextEntitlements = deriveCommerceEntitlements(nextCommerceState);
          setCommerceState(nextCommerceState);
          applyCommerceEntitlements(nextEntitlements.membershipTier, nextEntitlements.unlockedPacks);
          setRestoreEmail(normalizedCheckoutEmail);
          setShareMessage(`Payment confirmed for ${normalizedCheckoutEmail}.`);
          setCheckoutReturnState("success");
          setCheckoutReturnMessage("Payment confirmed. Your access is now unlocked.");
        } else if (checkoutMode === "pack" && checkoutTitle) {
          const pack = [...ritualPacks, allGuardiansPack].find((item) => item.title === checkoutTitle);
          if (!pack) {
            setCheckoutReturnState("error");
            setCheckoutReturnMessage("Payment returned, but we could not identify the guardian unlock.");
            return;
          }

          if (checkoutProvider === "gumroad" && checkoutSessionId) {
            let sessionCompleted = false;

            for (let attempt = 0; attempt < 5; attempt += 1) {
              const sessionStatus = await commerceGateway.getCheckoutSessionStatus(checkoutSessionId);
              if (sessionStatus.found && sessionStatus.status === "completed") {
                sessionCompleted = true;
                break;
              }

              if (attempt < 4) {
                setCheckoutReturnMessage("Payment return detected. Waiting for Gumroad confirmation...");
                await wait(1500);
              }
            }

            if (!sessionCompleted) {
              const restoredState = await commerceGateway.restorePurchases({
                email: normalizedCheckoutEmail
              });
              const restoredEntitlements = deriveCommerceEntitlements(restoredState);
              const restoredPackUnlocked = restoredEntitlements.unlockedPacks.includes(pack.title);

              if (restoredPackUnlocked) {
                setCommerceState(restoredState);
                applyCommerceEntitlements(restoredEntitlements.membershipTier, restoredEntitlements.unlockedPacks);
                setRestoreEmail(normalizedCheckoutEmail);
                setShareMessage(`${pack.title} confirmed for ${normalizedCheckoutEmail}.`);
                setCheckoutReturnState("success");
                setCheckoutReturnMessage(
                  pack.title === allGuardiansPack.title
                    ? "Payment confirmed. All five guardians are now unlocked."
                    : `Payment confirmed. ${pack.guardian} is now unlocked.`
                );
                setSelectedPack(null);
                clearPendingGumroadCheckout(checkoutSessionId);
                return;
              }

              setRestoreEmail(normalizedCheckoutEmail);
              setCheckoutReturnState("error");
              setCheckoutReturnMessage(
                "We have not received Gumroad's payment confirmation yet. Please wait a moment, then tap Restore access with the same checkout email."
              );
              return;
            }
          }

          const nextCommerceState = await commerceGateway.confirmPackCheckout({
            email: normalizedCheckoutEmail,
            title: pack.title,
            guardian: pack.guardian,
            priceLabel: pack.price
          });
          const nextEntitlements = deriveCommerceEntitlements(nextCommerceState);
          setCommerceState(nextCommerceState);
          applyCommerceEntitlements(nextEntitlements.membershipTier, nextEntitlements.unlockedPacks);
          setRestoreEmail(normalizedCheckoutEmail);
          setShareMessage(`${pack.title} confirmed for ${normalizedCheckoutEmail}.`);
          setCheckoutReturnState("success");
          setCheckoutReturnMessage(
            pack.title === allGuardiansPack.title
              ? "Payment confirmed. All five guardians are now unlocked."
              : `Payment confirmed. ${pack.guardian} is now unlocked.`
          );
          setSelectedPack(null);
        }
        setPendingCheckoutSession((current) => (current && checkoutSessionId && current.sessionId === checkoutSessionId ? null : current));
      } catch {
        setCheckoutReturnState("error");
        setCheckoutReturnMessage("Payment returned, but unlock confirmation did not finish. Please tap restore access once.");
      } finally {
        params.delete("checkout");
        params.delete("checkout_session");
        params.delete("mode");
        params.delete("provider");
        params.delete("email");
        params.delete("title");
        const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", nextUrl);
      }
    }

    void confirmReturnedCheckout();
  }, [selectedPlanId]);

  useEffect(() => {
    if (!hasProfile) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile, hasProfile]);

  useEffect(() => {
    if (!shareMessage) {
      return;
    }
    const timer = window.setTimeout(() => setShareMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  useEffect(() => {
    if (sceneState === "idle") {
      return;
    }
    const timer = window.setTimeout(() => setSceneState("idle"), sceneState === "blessing" ? 2200 : 1450);
    return () => window.clearTimeout(timer);
  }, [sceneState]);

  const activeDeity = useMemo(
    () => deities.find((deity) => deity.id === viewedDeityId) ?? deities[0],
    [viewedDeityId]
  );
  const commerceEntitlements = useMemo(() => deriveCommerceEntitlements(commerceState), [commerceState]);
  const effectiveMembershipTier = commerceEntitlements.membershipTier;
  const effectiveUnlockedPacks = commerceEntitlements.unlockedPacks;
  const recentCommerceEmail = useMemo(() => getRecentCustomerEmail(commerceState), [commerceState]);
  const providerReadiness = useMemo(() => commerceGateway.getProviderReadiness(), []);

  const activeCompanion = useMemo(
    () => profile.companions[activeDeity.id] ?? createDefaultCompanionState(),
    [activeDeity.id, profile.companions]
  );

  const ritualComplete = activeCompanion.lastRitualDay === todayKey;
  const questComplete = activeCompanion.lastQuestDay === todayKey;

  useEffect(() => {
    if (shareCardDeityImages[activeDeity.id]) {
      return;
    }

    async function loadShareCardImage() {
      try {
        const response = await fetch(getDeityCutoutSrc(activeDeity.id));
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setShareCardDeityImages((current) => ({
            ...current,
            [activeDeity.id]: typeof reader.result === "string" ? reader.result : ""
          }));
        };
        reader.readAsDataURL(blob);
      } catch {
        setShareCardDeityImages((current) => ({
          ...current,
          [activeDeity.id]: ""
        }));
      }
    }

    void loadShareCardImage();
  }, [activeDeity.id, shareCardDeityImages]);

  useEffect(() => {
    if (!activeDeity.offerings.includes(selectedOffering)) {
      setSelectedOffering(activeCompanion.latestOffering ?? activeDeity.offerings[0]);
    }
  }, [activeCompanion.latestOffering, activeDeity, selectedOffering]);

  const concernMatch = useMemo(
    () => analyzeConcern("", profile.intention),
    [profile.intention]
  );
  const concernDisplayLine = useMemo(
    () => getConcernDisplayLine(concernMatch, activeDeity),
    [activeDeity, concernMatch]
  );
  const latestWishDisplayLine = useMemo(
    () => getRitualWishDisplayLine(activeDeity),
    [activeDeity]
  );
  const copyInsightLine = useMemo(
    () => getCopyInsightLine(activeDeity),
    [activeDeity]
  );
  const concernIntention = concernMatch.intention;
  const onboardingDeity = useMemo(
    () => pickRecommendedDeity(profile.zodiac, concernIntention),
    [concernIntention, profile.zodiac]
  );
  const zodiacGuardian = useMemo(() => getDeityForZodiac(profile.zodiac), [profile.zodiac]);
  const supportGuardian = useMemo(
    () => getSupportDeity(profile.zodiac, concernIntention),
    [concernIntention, profile.zodiac]
  );
  const zodiacIntention = useMemo(() => getZodiacIntention(profile.zodiac), [profile.zodiac]);
  const birthDateParsed = useMemo(() => parseBirthDate(profile.birthDate), [profile.birthDate]);
  const derivedZodiac = useMemo(() => getZodiacFromBirthDate(profile.birthDate), [profile.birthDate]);
  const birthDateError = useMemo(() => {
    if (!profile.birthDate || birthDateParsed) {
      return "";
    }

    return "Use YYYY-MM-DD with a real calendar date.";
  }, [birthDateParsed, profile.birthDate]);
  const onboardingReady = true;
  const recommendationReason = useMemo(() => {
    const selectedIntentionLabel =
      intentionOptions.find((option) => option.id === concernIntention)?.label ?? concernIntention;
    return `${onboardingDeity.name} matches your current need for ${selectedIntentionLabel.toLowerCase()} and is the clearest guardian to invite right now.`;
  }, [concernIntention, onboardingDeity.name]);

  const oracle = useMemo(
    () => rotateByDay(activeDeity.oracleLines, `${profile.birthDate}${activeDeity.id}`),
    [activeDeity, profile.birthDate]
  );

  const actionPrompt = useMemo(
    () => rotateByDay(activeDeity.actionPrompts, `${profile.zodiac}${profile.intention}${activeDeity.id}`),
    [activeDeity, profile.intention, profile.zodiac]
  );

  const luckyNumber = useMemo(
    () => getLuckyNumber(profile.birthDate || "1999-01-01", activeDeity.id),
    [activeDeity.id, profile.birthDate]
  );

  const luckyColorToday = useMemo(
    () => rotateByDay(activeDeity.luckyColors, `${profile.birthDate}${profile.zodiac}${activeDeity.id}-color`),
    [activeDeity.id, activeDeity.luckyColors, profile.birthDate, profile.zodiac]
  );

  const dayPhase = useMemo(() => getDayPhase(), [todayKey]);
  const bondTier = useMemo(() => getBondTier(activeCompanion.guardianBond), [activeCompanion.guardianBond]);
  const bondProgress = useMemo(() => getBondProgress(activeCompanion.guardianBond), [activeCompanion.guardianBond]);
  const companionEnergy = useMemo(
    () => getCompanionEnergy(activeCompanion.streak, activeCompanion.guardianBond),
    [activeCompanion.guardianBond, activeCompanion.streak]
  );

  const activeModeLabel = useMemo(() => getDeityLifeAreaLabel(activeDeity.id), [activeDeity.id]);
  const primaryDeity = useMemo(
    () => deities.find((deity) => deity.id === profile.deityId) ?? deities[0],
    [profile.deityId]
  );
  const isViewingPrimaryGuardian = activeDeity.id === primaryDeity.id;
  const viralSignal = useMemo(() => getViralProfileSignal(profile, activeDeity), [activeDeity, profile]);
  const guardianPlusTier = premiumTiers.find((tier) => tier.id === "plus") ?? premiumTiers[1];
  const oracleTier = premiumTiers.find((tier) => tier.id === "oracle") ?? premiumTiers[2];
  const resultHeroLine = useMemo(() => {
    switch (activeDeity.id) {
      case "caishen":
        return "Let prosperity, support, and steadier luck stay a little closer today.";
      case "guanyin":
        return "Let peace, softness, and healing stay a little closer today.";
      case "yuelao":
        return "Let warmth, love, and connection stay a little closer today.";
      case "wenchang":
        return "Let clarity, focus, and steadiness stay a little closer today.";
      case "mazu":
        return "Let protection, safety, and steadier passage stay a little closer today.";
      default:
        return activeDeity.companionStyle;
    }
  }, [activeDeity.companionStyle, activeDeity.id]);
  const premiumHook = useMemo(() => {
    switch (activeDeity.id) {
      case "caishen":
        return "Open the focused prosperity pack for steadier support around money pressure and practical next steps.";
      case "guanyin":
        return "Open the focused healing pack for a softer recovery path.";
      case "yuelao":
        return "Open the focused connection pack for warmth, repair, and honest reach-outs.";
      case "wenchang":
        return "Open the focused discipline pack for study, writing, and calmer follow-through.";
      case "mazu":
        return "Open the focused transition pack for steadiness, travel, and life change.";
      default:
        return "Open the support pack that matches the need you are already carrying.";
    }
  }, [activeDeity.id]);
  const insightMoodLine = useMemo(() => getInsightMoodLine(activeDeity), [activeDeity]);
  const actionPanelLabel = useMemo(() => getActionPanelLabel(activeDeity), [activeDeity]);
  const actionPanelSupportLine = useMemo(() => getActionPanelSupportLine(activeDeity), [activeDeity]);
  const shareCardSpiritLine = useMemo(() => getShareCardSpiritLine(activeDeity), [activeDeity]);
  const guidancePanelLabel = useMemo(() => getGuidancePanelLabel(activeDeity), [activeDeity]);
  const guidancePanelTitle = useMemo(
    () => getGuidancePanelTitle(activeDeity, ritualComplete),
    [activeDeity, ritualComplete]
  );
  const guidancePanelSupport = useMemo(() => getGuidancePanelSupport(activeDeity), [activeDeity]);
  const guidanceButtonLabel = useMemo(
    () => getGuidanceButtonLabel(activeDeity, ritualComplete),
    [activeDeity, ritualComplete]
  );
  const latestWishLabel = useMemo(() => getLatestWishLabel(activeDeity), [activeDeity]);
  const latestResponseLabel = useMemo(() => getLatestResponseLabel(activeDeity), [activeDeity]);
  const keepsakesLabel = useMemo(() => getKeepsakesLabel(activeDeity), [activeDeity]);
  const keepsakesEmptyLine = useMemo(() => getKeepsakesEmptyLine(activeDeity), [activeDeity]);
  const ritualStepLabels = useMemo(() => getRitualStepLabels(activeDeity), [activeDeity]);
  const upgradeOfferLine = useMemo(
    () => (upgradeTarget ? getUpgradeOfferLine(upgradeTarget) : getUpgradeOfferLine("plus")),
    [upgradeTarget]
  );
  const upgradeImmediateUnlocks = useMemo(
    () => getUpgradeImmediateUnlocks(upgradeTarget ?? "plus"),
    [upgradeTarget]
  );

  const latestWish = activeCompanion.wishes[0];
  const shareCardDeityImage = shareCardDeityImages[activeDeity.id] ?? "";
  const shareCardReady = Boolean(shareCardDeityImage);
  const collectionSummary = useMemo(() => {
    const awakenedCount = deities.filter((deity) => profile.companions[deity.id].guardianBond > 0).length;
    return `${awakenedCount}/5 guardians awakened • ${viralSignal.archetype}`;
  }, [profile.companions, viralSignal.archetype]);
  const journeyStats = useMemo(() => {
    const awakened = deities.filter((deity) => profile.companions[deity.id].guardianBond > 0);
    const totalBond = deities.reduce((sum, deity) => sum + profile.companions[deity.id].guardianBond, 0);
    const strongest =
      awakened.length === 0
        ? null
        : deities.reduce((current, deity) => {
            if (!current) {
              return deity;
            }

            return profile.companions[deity.id].guardianBond > profile.companions[current.id].guardianBond ? deity : current;
          }, null as Deity | null);
    const nextAwaken =
      deities.find((deity) => profile.companions[deity.id].guardianBond === 0) ?? null;

    return {
      awakenedCount: awakened.length,
      totalBond,
      strongest,
      nextAwaken
    };
  }, [activeDeity.id, profile.companions]);
  const journeyPrompt = useMemo(() => {
    if (journeyStats.awakenedCount === 0) {
      return "Begin with one guardian today, then expand your constellation as each bond starts to answer back.";
    }

    if (journeyStats.awakenedCount < deities.length) {
      return `Your next expansion path points toward ${journeyStats.nextAwaken?.name ?? "another guardian"}. Broaden the collection to unlock a fuller emotional range.`;
    }

    return `All five guardians are awake. Strengthen the quieter bonds so your constellation feels balanced, not just complete.`;
  }, [journeyStats]);
  const unlockedKeepsakes = useMemo(
    () => getUnlockedKeepsakes(activeDeity, activeCompanion.guardianBond),
    [activeCompanion.guardianBond, activeDeity]
  );
  const nextKeepsake = useMemo(
    () => getNextKeepsake(activeDeity, activeCompanion.guardianBond),
    [activeCompanion.guardianBond, activeDeity]
  );
  const awakenedGuardians = useMemo(
    () => deities.filter((deity) => profile.companions[deity.id].guardianBond > 0),
    [profile.companions]
  );
  const constellationState = useMemo(() => {
    const awakenedCount = awakenedGuardians.length;
    if (awakenedCount === deities.length) {
      return {
        label: "Full Circle",
        description: "All five guardians are awake. Your support system now feels complete, varied, and emotionally balanced."
      };
    }
    if (awakenedCount >= 3) {
      return {
        label: "Circle Expanding",
        description: "You now have multiple guardians to lean on across different kinds of emotional weather."
      };
    }
    if (awakenedCount >= 1) {
      return {
        label: "First Bond Forming",
        description: "One guardian is awake. Keep returning if you want your circle of support to grow around your primary need."
      };
    }
    return {
      label: "Waiting Shrine",
      description: "Your guardian circle has not started yet. The first ritual wakes the first bond."
    };
  }, [awakenedGuardians.length]);
  const weeklyForecast = useMemo(
    () => buildWeeklyForecast(profile, onboardingDeity, supportGuardian, zodiacGuardian),
    [onboardingDeity, profile, supportGuardian, zodiacGuardian]
  );
  const nextCardFinish = useMemo(
    () => cardFinishes.find((finish) => !finish.unlocked({ awakenedCount: journeyStats.awakenedCount, totalBond: journeyStats.totalBond })) ?? null,
    [journeyStats.awakenedCount, journeyStats.totalBond]
  );
  const milestoneRewards = useMemo(
    () => getMilestoneRewards({ awakenedCount: journeyStats.awakenedCount, totalBond: journeyStats.totalBond }),
    [journeyStats.awakenedCount, journeyStats.totalBond]
  );
  const premiumBenefits = useMemo(
    () =>
      getPremiumBenefits({
        awakenedCount: journeyStats.awakenedCount,
        totalBond: journeyStats.totalBond,
        allAwakened: journeyStats.awakenedCount === deities.length
      }),
    [journeyStats.awakenedCount, journeyStats.totalBond]
  );
  const nextPremiumBenefit = useMemo(
    () => premiumBenefits.find((benefit) => benefit.state === "preview") ?? null,
    [premiumBenefits]
  );
  const recommendedTier = useMemo(
    () => getRecommendedTier({ awakenedCount: journeyStats.awakenedCount, totalBond: journeyStats.totalBond }),
    [journeyStats.awakenedCount, journeyStats.totalBond]
  );
  const unlockedCardFinishes = useMemo(
    () => getUnlockedCardFinishes({ awakenedCount: journeyStats.awakenedCount, totalBond: journeyStats.totalBond }),
    [journeyStats.awakenedCount, journeyStats.totalBond]
  );
  const activeCardFinish = useMemo(() => getCardFinishById(profile.cardFinish), [profile.cardFinish]);
  const premiumPaywallMessage = useMemo(() => {
    return getLaunchUpgradeAngle(activeDeity, recommendedTier);
  }, [activeDeity, recommendedTier]);
  const hasGuardianPlus = effectiveMembershipTier === "plus" || effectiveMembershipTier === "oracle";
  const hasOracleAccess = effectiveMembershipTier === "oracle";
  const visibleWeeklyForecast = hasGuardianPlus ? weeklyForecast.slice(0, 3) : weeklyForecast.slice(0, 1);
  const activeUpgradeTier = upgradeTarget === "oracle" ? oracleTier : guardianPlusTier;
  const shareCardIdentityLine = useMemo(() => getShareCardIdentityLine(activeDeity), [activeDeity]);
  const shareCardCollectibleLabel = useMemo(() => getShareCardCollectibleLabel(activeDeity), [activeDeity]);
  const upgradeReasonNow = useMemo(() => getUpgradeReasonNow(activeDeity), [activeDeity]);
  const recommendedPack = useMemo(() => getRecommendedRitualPack(activeDeity), [activeDeity]);
  const allGuardiansUnlocked = useMemo(
    () => hasAllGuardiansUnlocked(effectiveUnlockedPacks),
    [effectiveUnlockedPacks]
  );
  const lockedGuardianPacks = useMemo(
    () =>
      deities
        .filter((deity) =>
          !isGuardianUnlocked({
            deity,
            primaryDeityId: profile.deityId,
            unlockedPacks: effectiveUnlockedPacks,
            companion: profile.companions[deity.id]
          })
        )
        .map((deity) => getRecommendedRitualPack(deity)),
    [effectiveUnlockedPacks, profile.companions, profile.deityId]
  );
  const guardianRoleTitle = useMemo(() => getGuardianRoleTitle(activeDeity), [activeDeity]);
  const guardianRoleSupport = useMemo(() => getGuardianRoleSupport(activeDeity), [activeDeity]);
  const revealEyebrow = useMemo(() => getRevealEyebrow(activeDeity), [activeDeity]);
  const revealHeading = useMemo(() => getRevealHeading(activeDeity), [activeDeity]);
  const primaryHeroLabel = useMemo(() => getPrimaryHeroLabel(activeDeity), [activeDeity]);
  const ritualMapLabel = useMemo(() => getRitualMapLabel(activeDeity), [activeDeity]);
  const shareCardLabel = useMemo(() => getShareCardLabel(activeDeity), [activeDeity]);
  const shareCardSvg = useMemo(
    () =>
      buildShareCardSvg({
        profile,
        deity: activeDeity,
        oracle,
        luckyNumber,
        deityImageDataUrl: shareCardDeityImage,
        finish: activeCardFinish,
        viralSignal
      }),
    [activeCardFinish, activeDeity, luckyNumber, oracle, profile, shareCardDeityImage, viralSignal]
  );
  const shareCardPreview = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shareCardSvg)}`,
    [shareCardSvg]
  );

  useEffect(() => {
    if (activeCardFinish.unlocked({ awakenedCount: journeyStats.awakenedCount, totalBond: journeyStats.totalBond })) {
      return;
    }

    const fallbackFinish = unlockedCardFinishes[unlockedCardFinishes.length - 1] ?? cardFinishes[0];
    setProfile((current) => ({ ...current, cardFinish: fallbackFinish.id }));
  }, [activeCardFinish, journeyStats.awakenedCount, journeyStats.totalBond, unlockedCardFinishes]);

  const sceneBadge = useMemo(() => {
    if (sceneState === "switching") {
      return `${activeDeity.name} descending`;
    }
    if (sceneState === "blessing") {
      return `${activeDeity.sigil} received`;
    }
    return activeDeity.idleSceneLabel;
  }, [activeDeity.idleSceneLabel, activeDeity.name, activeDeity.sigil, sceneState]);

  const sceneCaption = useMemo(() => {
    if (sceneState === "switching") {
      return activeDeity.arrivalLine;
    }
    if (sceneState === "blessing") {
      return activeDeity.blessingResponse;
    }
    return activeDeity.idleSceneCaption;
  }, [activeDeity.arrivalLine, activeDeity.blessingResponse, activeDeity.idleSceneCaption, sceneState]);

  const ritualTrack = useMemo(
    () => [
      {
        label: ritualStepLabels.invite,
        detail: `Open ${activeDeity.watchwords[0].toLowerCase()} through ${selectedOffering.toLowerCase()}.`,
        complete: true
      },
      {
        label: ritualStepLabels.receive,
        detail: ritualComplete ? activeDeity.blessingResponse : activeDeity.invocation,
        complete: ritualComplete
      },
      {
        label: ritualStepLabels.act,
        detail: actionPrompt,
        complete: ritualComplete
      }
    ],
    [actionPrompt, activeDeity, ritualComplete, ritualStepLabels, selectedOffering]
  );

  const ritualOutcome = useMemo(() => {
    if (!activeCompanion.latestOmen || !activeCompanion.latestOffering) {
      return null;
    }
    return {
      resonance: activeCompanion.latestResonance ?? 0,
      offering: sanitizeLegacyOffering(activeCompanion.latestOffering, activeDeity) ?? activeCompanion.latestOffering,
      omen: sanitizeLegacyOmen(activeCompanion.latestOmen, activeDeity),
      blessing:
        activeCompanion.latestBlessing ??
        buildDailyBlessing({
          deity: activeDeity,
          offering: sanitizeLegacyOffering(activeCompanion.latestOffering, activeDeity) ?? activeCompanion.latestOffering,
          wish: latestWish ?? activeDeity.invocation,
          resonance: activeCompanion.latestResonance ?? 0,
          total: `${activeDeity.id}${activeCompanion.latestOffering}${latestWish ?? activeDeity.invocation}${activeCompanion.streak}${getTodayKey()}`
            .split("")
            .reduce((sum, char) => sum + char.charCodeAt(0), 0)
        })
    };
  }, [activeCompanion.latestBlessing, activeCompanion.latestOffering, activeCompanion.latestOmen, activeCompanion.latestResonance, activeCompanion.streak, activeDeity, latestWish]);

  const recentHistory = useMemo(
    () =>
      activeCompanion.ritualHistory.slice(0, 3).map((entry) => ({
        ...entry,
        offering: sanitizeLegacyOffering(entry.offering, activeDeity) ?? entry.offering,
        omen: sanitizeLegacyOmen(entry.omen, activeDeity)
      })),
    [activeCompanion.ritualHistory, activeDeity]
  );
  const visibleRecentHistory = useMemo(
    () => (hasOracleAccess ? recentHistory : recentHistory.slice(0, 1)),
    [hasOracleAccess, recentHistory]
  );
  const compatibilityBirthDateError = useMemo(() => {
    if (!compatibilityBirthDate || parseBirthDate(compatibilityBirthDate)) {
      return "";
    }

    return "Use YYYY-MM-DD to open the shared reflection mirror.";
  }, [compatibilityBirthDate]);
  const compatibilityReading = useMemo(
    () =>
      buildCompatibilityReading({
        profile,
        activeDeity,
        supportGuardian,
        otherBirthDate: compatibilityBirthDate,
        otherName: compatibilityName,
        mode: compatibilityMode
      }),
    [activeDeity, compatibilityBirthDate, compatibilityMode, compatibilityName, profile, supportGuardian]
  );
  const compatibilityFieldNote = useMemo(() => {
    if (compatibilityBirthDateError) {
      return compatibilityBirthDateError;
    }

    if (compatibilityReading) {
      return `Derived ${compatibilityReading.counterpartZodiac} with ${compatibilityReading.counterpartGuardian} as the counterpart guardian.`;
    }

    return "Enter a second birth date to open the shared reflection mirror.";
  }, [compatibilityBirthDateError, compatibilityReading]);

  const triggerScene = (nextState: "switching" | "blessing") => {
    setSceneVersion((current) => current + 1);
    setSceneState(nextState);
  };

  const startOnboarding = () => {
    void commerceGateway.track("onboarding_started", {
      source: activeView
    }).then((state) => {
      setCommerceState(state);
    });
    setStaticPage(null);
    setActiveView("onboarding");
    scrollToTop();
  };

  const completeOnboarding = () => {
    const derivedIntention = profile.intention;
    const selectedDeity = pickRecommendedDeity(profile.zodiac, derivedIntention);
    const nextProfile = {
      ...profile,
      deityId: selectedDeity.id,
      currentConcern: getConcernDisplayLine({ intention: derivedIntention, confidence: "high", signals: [], summary: "" }, selectedDeity)
    };
    void commerceGateway.track("guardian_revealed", {
      guardian: selectedDeity.name,
      intention: derivedIntention
    }).then((state) => {
      setCommerceState(state);
    });
    setProfile(nextProfile);
    setViewedDeityId(selectedDeity.id);
    setSelectedOffering(nextProfile.companions[selectedDeity.id].latestOffering ?? selectedDeity.offerings[0]);
    setHasProfile(true);
    setStaticPage(null);
    setActiveView("shrine");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfile));
    scrollToTop();
  };

  const performRitual = () => {
    if (ritualComplete) {
      return;
    }
    const storedWishLine = getStoredWishArchiveLine(activeDeity);
    const nextWishes = [storedWishLine, ...activeCompanion.wishes].slice(0, 5);
    const outcome = buildRitualOutcome({
      deity: activeDeity,
      offering: selectedOffering,
      wish: storedWishLine,
      streak: activeCompanion.streak
    });
    setProfile((current) => ({
      ...current,
      companions: {
        ...current.companions,
        [activeDeity.id]: {
          ...current.companions[activeDeity.id],
          wishes: nextWishes,
          streak:
            current.companions[activeDeity.id].lastRitualDay === todayKey
              ? current.companions[activeDeity.id].streak
              : current.companions[activeDeity.id].streak + 1,
          lastRitualDay: todayKey,
          guardianBond: Math.min(
            180,
            current.companions[activeDeity.id].guardianBond + 6 + Math.floor(outcome.resonance / 18)
          ),
          latestOffering: selectedOffering,
          latestResonance: outcome.resonance,
          latestOmen: outcome.omen,
          latestBlessing: outcome.blessing,
          ritualHistory: [
            {
              day: todayKey,
              deityId: activeDeity.id,
              offering: selectedOffering,
              wish: storedWishLine,
              resonance: outcome.resonance,
              omen: outcome.omen,
              blessing: outcome.blessing
            },
            ...current.companions[activeDeity.id].ritualHistory
          ].slice(0, 8)
        }
      }
    }));
    void commerceGateway.track("ritual_completed", {
      guardian: activeDeity.name,
      offering: selectedOffering
    }).then((state) => {
      setCommerceState(state);
    });
    triggerScene("blessing");
  };

  const sealActionPrompt = () => {
    if (questComplete) {
      return;
    }
    setProfile((current) => ({
      ...current,
      companions: {
        ...current.companions,
        [activeDeity.id]: {
          ...current.companions[activeDeity.id],
          guardianBond: Math.min(180, current.companions[activeDeity.id].guardianBond + 5),
          lastQuestDay: todayKey
        }
      }
    }));
    setShareMessage("Action sealed. Guardian bond increased.");
    triggerScene("blessing");
  };

  const switchDeity = (deityId: Deity["id"]) => {
    if (deityId === viewedDeityId) {
      return;
    }
    const nextDeity = deities.find((deity) => deity.id === deityId);
    setViewedDeityId(deityId);
    if (nextDeity) {
      setSelectedOffering(profile.companions[deityId].latestOffering ?? nextDeity.offerings[0]);
    }
    triggerScene("switching");
  };

  const resetExperience = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfile(defaultProfile);
    setHasProfile(false);
    setSelectedOffering(deities[0].offerings[0]);
    setViewedDeityId(defaultProfile.deityId);
    setStaticPage(null);
    setActiveView("landing");
    setShareMessage("");
    scrollToTop();
  };

  const openUpgradeSheet = (target: UpgradeTarget) => {
    void commerceGateway.track("upgrade_sheet_opened", {
      target
    }).then((state) => {
      setCommerceState(state);
    });
    setUpgradeTarget(target);
    setUpgradeStep("overview");
    setSelectedPlanId(target === "plus" ? "plus-monthly" : "oracle-monthly");
  };

  const closeUpgradeSheet = () => {
    setUpgradeTarget(null);
    setUpgradeStep("overview");
  };

  const openPackSheet = (pack: RitualPack) => {
    void commerceGateway.track("pack_sheet_opened", {
      packTitle: pack.title,
      guardian: pack.guardian
    }).then((state) => {
      setCommerceState(state);
    });
    setSelectedPack(pack);
    setPackCheckoutStep("details");
  };

  const closePackSheet = () => {
    setSelectedPack(null);
    setPackCheckoutStep("details");
  };

  const isDirectGumroadLaunch = providerReadiness.provider === "gumroad" && providerReadiness.mode === "live";

  const applyCommerceEntitlements = (nextMembershipTier = effectiveMembershipTier, nextUnlockedPacks = effectiveUnlockedPacks) => {
    setProfile((current) => ({
      ...current,
      membershipTier: nextMembershipTier,
      unlockedPacks: nextUnlockedPacks
    }));
  };

  const handleStartCheckout = () => {
    setUpgradeStep("checkout");
    void commerceGateway.track("checkout_started", {
      target: upgradeTarget ?? "plus",
      planId: selectedPlanId
    }).then((state) => {
      setCommerceState(state);
    });
  };

  const handleActivateSubscription = async () => {
    if (!upgradeTarget) {
      return;
    }

    const nextTier = upgradeTarget === "oracle" ? "oracle" : "plus";
    const checkoutEmail = recentCommerceEmail || restoreEmail || getDefaultCheckoutEmail();
    const session = await commerceGateway.createSubscriptionCheckoutSession({
      email: checkoutEmail,
      tier: nextTier,
      planId: selectedPlanId,
      priceLabel: activeUpgradeTier.price
    });
    setPendingCheckoutSession(session);
    setCheckoutReturnState("idle");
    setCheckoutReturnMessage("");
    setRestoreEmail(checkoutEmail.trim().toLowerCase());
    setShareMessage(
      session.status === "requires_manual_review"
        ? "Launch list captured. Turn on a live payout route before charging this buyer."
        : "Opening secure checkout. After payment, access returns here."
    );
    if (session.status === "pending" && session.redirectUrl) {
      window.location.href = session.redirectUrl;
      return;
    }
    closeUpgradeSheet();
  };

  const startPackCheckout = async (pack: RitualPack, options?: { closeSheet?: boolean }) => {
    const checkoutEmail = recentCommerceEmail || restoreEmail || getDefaultCheckoutEmail();
    const session = await commerceGateway.createPackCheckoutSession({
      email: checkoutEmail,
      title: pack.title,
      guardian: pack.guardian,
      priceLabel: pack.price
    });
    setPendingCheckoutSession(session);
    setCheckoutReturnState("idle");
    setCheckoutReturnMessage("");
    setRestoreEmail(checkoutEmail.trim().toLowerCase());
    setShareMessage(
      session.status === "requires_manual_review"
        ? "Pack demand captured for launch prep. Enable live checkout before fulfillment."
        : session.provider === "gumroad"
          ? "Opening Gumroad checkout. After payment, you will return here to continue access setup."
          : "Opening secure checkout. After payment, this guardian unlocks here."
    );
    if (session.status === "pending" && session.redirectUrl) {
      if (session.provider === "gumroad") {
        writePendingGumroadCheckout({
          sessionId: session.sessionId,
          email: checkoutEmail.trim().toLowerCase(),
          title: pack.title,
          guardian: pack.guardian,
          createdAt: new Date().toISOString()
        });
        if (options?.closeSheet) {
          closePackSheet();
        }
        window.location.href = session.redirectUrl;
        return;
      }
      window.location.href = session.redirectUrl;
      return;
    }
    if (options?.closeSheet) {
      closePackSheet();
    }
  };

  const handleUnlockPackPurchase = async () => {
    if (!selectedPack) {
      return;
    }

    await startPackCheckout(selectedPack, { closeSheet: true });
  };

  const handlePackLaunchAction = (pack: RitualPack) => {
    if (isDirectGumroadLaunch) {
      void startPackCheckout(pack);
      return;
    }

    openPackSheet(pack);
  };

  useEffect(() => {
    if (providerReadiness.provider !== "gumroad") {
      return;
    }

    const pendingCheckout = readPendingGumroadCheckout();
    if (!pendingCheckout) {
      return;
    }

    const pending = pendingCheckout;
    const pendingAgeMs = Date.now() - Date.parse(pending.createdAt);
    if (!Number.isFinite(pendingAgeMs) || pendingAgeMs > 1000 * 60 * 60 * 24) {
      clearPendingGumroadCheckout();
      return;
    }

    let cancelled = false;

    async function reconcilePendingGumroadCheckout() {
      try {
        const sessionStatus = await commerceGateway.getCheckoutSessionStatus(pending.sessionId);
        if (cancelled || !sessionStatus.found || sessionStatus.status !== "completed") {
          return;
        }

        const restoredState = await commerceGateway.restorePurchases({
          email: pending.email
        });
        if (cancelled) {
          return;
        }

        const nextEntitlements = deriveCommerceEntitlements(restoredState);
        setCommerceState(restoredState);
        setProfile((current) => ({
          ...current,
          membershipTier: nextEntitlements.membershipTier,
          unlockedPacks: nextEntitlements.unlockedPacks
        }));
        setRestoreEmail(pending.email);
        setShareMessage(`${pending.title} confirmed for ${pending.email}.`);
        setCheckoutReturnState("success");
        setCheckoutReturnMessage(
          pending.title === allGuardiansPack.title
            ? "Payment confirmed. All five guardians are now unlocked."
            : `Payment confirmed. ${pending.guardian} is now unlocked.`
        );
        setSelectedPack(null);
        setPendingCheckoutSession((current) =>
          current && current.sessionId === pending.sessionId ? null : current
        );
        clearPendingGumroadCheckout(pending.sessionId);
      } catch {
        // Keep the pending record so restore can still succeed after the webhook arrives.
      }
    }

    void reconcilePendingGumroadCheckout();

    return () => {
      cancelled = true;
    };
  }, [providerReadiness.provider, allGuardiansPack.title]);

  const handleRestorePurchases = async () => {
    const recoveryEmail = restoreEmail || recentCommerceEmail || getDefaultCheckoutEmail();

    const restoredState = await commerceGateway.restorePurchases({
      email: recoveryEmail
    });
    const nextEntitlements = deriveCommerceEntitlements(restoredState);

    setCommerceState(restoredState);
    applyCommerceEntitlements(nextEntitlements.membershipTier, nextEntitlements.unlockedPacks);
    setRestoreEmail(recoveryEmail.trim().toLowerCase());
    if (
      providerReadiness.provider === "gumroad" &&
      nextEntitlements.membershipTier === effectiveMembershipTier &&
      nextEntitlements.unlockedPacks.length === effectiveUnlockedPacks.length
    ) {
      setShareMessage("No verified Gumroad unlock was found on this browser yet.");
      setCheckoutReturnState("error");
      setCheckoutReturnMessage("Gumroad payment verification for automatic unlock is not fully connected yet in this launch build.");
      return;
    }

    setShareMessage(`Purchases restored for ${recoveryEmail.trim().toLowerCase()}.`);
    setCheckoutReturnState("success");
    setCheckoutReturnMessage("Restore complete. Your paid guardian access has been refreshed on this page.");
  };

  const scrollToGuidanceSection = () => {
    const guidanceSection = document.getElementById("daily-guidance");
    if (guidanceSection) {
      guidanceSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToCompatibilitySection = () => {
    const compatibilitySection = document.getElementById("compatibility-studio");
    if (compatibilitySection) {
      compatibilitySection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openStaticPage = (page: StaticPageId) => {
    setStaticPage(page);
    setActiveView("landing");
    window.history.pushState({}, "", getStaticPagePath(page));
    scrollToTop();
  };

  const closeStaticPage = () => {
    setStaticPage(null);
    window.history.pushState({}, "", "/");
    scrollToTop();
  };

  const exportShareCard = () => {
    if (!shareCardReady) {
      setShareMessage("Guardian card is still rendering.");
      return;
    }

    const blob = new Blob([shareCardSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDeity.id}-${activeCardFinish.id}-guardian-card.svg`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage("Guardian card exported.");
  };

  const copyOracle = async () => {
    const text = `${copyInsightLine} Today's blessing: ${oracle} Lucky number: ${luckyNumber}. If you've been going through something lately, maybe invite one too.`;
    await navigator.clipboard.writeText(text);
    setShareMessage("Share line copied.");
  };

  const copyCompatibilityReading = async () => {
    if (!compatibilityReading) {
      setShareMessage("Add a second birth date to open the shared reflection mirror.");
      return;
    }

    await navigator.clipboard.writeText(
      `${compatibilityReading.shareLine} ${compatibilityReading.summary} ${compatibilityReading.sharedPractice}`
    );
    setShareMessage("Shared reflection copied.");
  };

  const handleBirthDateChange = (value: string) => {
    const normalized = value.replace(/[^\d-]/g, "").slice(0, 10);
    const nextZodiac = getZodiacFromBirthDate(normalized);

    setProfile((current) => ({
      ...current,
      birthDate: normalized,
      zodiac: nextZodiac ?? current.zodiac
    }));
  };

  if (staticPage) {
    const pageMeta: Record<StaticPageId, { eyebrow: string; title: string; intro: string }> = {
      trust: {
        eyebrow: "Trust & Safety",
        title: "How Mythic Guardian should be understood and used.",
        intro: "This product is designed as a mythology-inspired ritual companion. It should feel meaningful and emotionally resonant, but it should never be interpreted as guaranteed truth, hard advice, or crisis support."
      },
      privacy: {
        eyebrow: "Privacy",
        title: "What this launch version stores and how to think about it.",
        intro: "This launch version is intentionally lightweight. Most ritual data stays in the browser on the device using local storage so the experience can work fast without requiring an account."
      },
      terms: {
        eyebrow: "Terms",
        title: "The operating rules for using this launch version.",
        intro: "These terms are written for a launch-stage product and focus on clear expectations: symbolic use, no guarantees, respectful behavior, and the fact that pricing and features may evolve."
      },
      refund: {
        eyebrow: "Refund Policy",
        title: "How refunds are handled for Eastern Guardians.",
        intro: "This launch version sells symbolic digital unlocks. We keep the refund policy simple, visible, and tied to whether the digital access worked as described."
      }
    };

    const meta = pageMeta[staticPage];

    return (
      <main className={`app-shell theme-${deities[0].id}`} style={buildThemeStyle(deities[0])}>
        <div className="background-grid" />
        <section className="static-page">
          <div className="static-page-header">
            <p className="eyebrow">{meta.eyebrow}</p>
            <h1>{meta.title}</h1>
            <p className="lead compact">{meta.intro}</p>
            <div className="hero-actions hero-actions-inline">
              <button className="ghost-button" onClick={closeStaticPage}>
                Back to launch page
              </button>
              <button className="primary-button" onClick={startOnboarding}>
                Start the first petition
              </button>
            </div>
          </div>

          {staticPage === "trust" ? (
            <div className="static-sections">
              <article className="static-card">
                <strong>1. Symbolic use only</strong>
                <p>The readings, deity mappings, and shared-reflection outputs in Mythic Guardian are symbolic and reflective. They are not statements of objective fact and should not be treated as certain predictions.</p>
              </article>
              <article className="static-card">
                <strong>2. Not advice or guaranteed outcomes</strong>
                <p>This product does not provide medical, legal, financial, or mental-health advice. It also does not promise that progress, romance, safety, or success outcomes will occur.</p>
              </article>
              <article className="static-card">
                <strong>3. Crisis boundary</strong>
                <p>If a user is in crisis, at risk of self-harm, or facing urgent safety concerns, Mythic Guardian is not the right tool. Emergency services, licensed professionals, or local crisis resources should be used instead.</p>
              </article>
              <article className="static-card">
                <strong>4. Shared reflection mirror</strong>
                <p>Shared reflections are for emotional observation and storytelling. They are not interpersonal verdicts, psychological assessments, or professional counseling.</p>
              </article>
            </div>
          ) : null}

          {staticPage === "privacy" ? (
            <div className="static-sections">
              <article className="static-card">
                <strong>1. Local ritual data</strong>
                <p>In the current launch version, petition text, birth date, bond state, streaks, and ritual history are stored locally in the browser on the user’s device so the experience can continue between sessions.</p>
              </article>
              <article className="static-card">
                <strong>2. No account required yet</strong>
                <p>The launch version does not require a permanent account to begin using the product. That keeps the first experience simple and reduces collection pressure.</p>
              </article>
              <article className="static-card">
                <strong>3. What may change later</strong>
                <p>If accounts, payments, analytics, or email capture are added later, this page should be updated before those systems go live, and users should be clearly informed.</p>
              </article>
              <article className="static-card">
                <strong>4. User control</strong>
                <p>Users can currently clear their local state by resetting the profile in the product. Future versions should add a more explicit data-controls panel if synced accounts are introduced.</p>
              </article>
            </div>
          ) : null}

          {staticPage === "terms" ? (
            <div className="static-sections">
              <article className="static-card">
                <strong>1. Launch-stage software</strong>
                <p>Mythic Guardian is a launch-stage product. Features, pricing, shared-reflection outputs, ritual wording, and availability may change as the product evolves.</p>
              </article>
              <article className="static-card">
                <strong>2. Acceptable use</strong>
                <p>Users should not use the product to harass others, impersonate others, or present symbolic readings as professional advice, verified diagnosis, or guaranteed supernatural outcomes.</p>
              </article>
              <article className="static-card">
                <strong>3. Payments and premium access</strong>
                <p>If paid features are activated in the launch version, one-time ritual packs are the preferred first offer. Refund handling, fulfillment scope, and any future recurring billing terms must be clearly disclosed in checkout before charging users.</p>
              </article>
              <article className="static-card">
                <strong>4. Intellectual framing</strong>
                <p>The product is inspired by Chinese guardian mythology and cultural comfort traditions, presented as a modern reflective ritual product rather than a religious authority or institutional service.</p>
              </article>
            </div>
          ) : null}

          {staticPage === "refund" ? (
            <div className="static-sections">
              <article className="static-card">
                <strong>1. Digital unlock scope</strong>
                <p>Paid access in Eastern Guardians is for digital guardian unlocks and related symbolic features only. There is no shipping, no physical item, and no promise of real-world outcomes.</p>
              </article>
              <article className="static-card">
                <strong>2. When a refund may be granted</strong>
                <p>If a customer is charged but the purchased guardian unlock is not delivered, cannot be accessed, or fails materially because of a product-side issue, they can contact support to request a refund review.</p>
              </article>
              <article className="static-card">
                <strong>3. When refunds are usually not granted</strong>
                <p>Refunds are usually not granted for personal preference, changed feelings, or disappointment with symbolic wording after the digital unlock has been successfully delivered and used as described.</p>
              </article>
              <article className="static-card">
                <strong>4. Support window</strong>
                <p>Customers should contact support within 7 days of purchase and include the checkout email plus a short description of the issue so the request can be reviewed quickly.</p>
              </article>
            </div>
          ) : null}

          <footer className="site-footer">
            <button className="footer-link" onClick={() => openStaticPage("trust")}>Trust & Safety</button>
            <button className="footer-link" onClick={() => openStaticPage("privacy")}>Privacy</button>
            <button className="footer-link" onClick={() => openStaticPage("terms")}>Terms</button>
            <button className="footer-link" onClick={() => openStaticPage("refund")}>Refund Policy</button>
          </footer>
        </section>
      </main>
    );
  }

  if (activeView === "landing") {
    return (
      <main className={`app-shell theme-${deities[0].id}`} style={buildThemeStyle(deities[0])}>
        <div className="background-grid" />
        <section className="landing">
          <div className="landing-copy">
            <p className="eyebrow">Eastern Guardians</p>
            <h1>Keep an Eastern guardian close.</h1>
            <p className="lead">
              Choose the kind of blessing you want to keep close. Invite one Eastern guardian as a symbol of comfort, protection, and support.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={startOnboarding}>
                Choose my guardian
              </button>
              <span className="micro-copy">Choose one guardian. Keep the blessing close. Share it with someone you care about.</span>
            </div>
            <div className="landing-simple-note">
              <span>Simple guardian ritual</span>
              <strong>Your first guardian is free. Keep one symbol of blessing close, then unlock others only when life asks for a different kind of support.</strong>
            </div>
          </div>

          <div className="constellation-panel landing-guardian-stage">
            {deities.map((deity) => (
              <article
                key={deity.id}
                className="deity-preview"
                style={{
                  background: `linear-gradient(145deg, ${deity.palette[0]}22, ${deity.palette[2]}66)`
                }}
              >
                <div
                  className={`deity-orb aura-${deity.aura}`}
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${deity.palette[0]}, ${deity.palette[1]} 55%, ${deity.palette[2]})`
                  }}
                >
                  <img className="deity-poster-image" src={getDeityCutoutSrc(deity.id)} alt="" aria-hidden="true" />
                </div>
                <div>
                  <span className="deity-preview-role">{getGuardianRoleTitle(deity)}</span>
                  <h2>{deity.name}</h2>
                  <p>{getLandingPosterHook(deity)}</p>
                  <small>{deity.themes[0]} · {deity.themes[1]}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <footer className="site-footer">
          <button className="footer-link" onClick={() => openStaticPage("trust")}>Trust & Safety</button>
          <button className="footer-link" onClick={() => openStaticPage("privacy")}>Privacy</button>
          <button className="footer-link" onClick={() => openStaticPage("terms")}>Terms</button>
          <button className="footer-link" onClick={() => openStaticPage("refund")}>Refund Policy</button>
        </footer>
      </main>
    );
  }

  if (activeView === "onboarding") {
    return (
      <main className={`app-shell theme-${onboardingDeity.id}`} style={buildThemeStyle(onboardingDeity)}>
        <div className="background-grid" />
        <section className="onboarding-page">
          <div className="form-card onboarding-card">
            <div className="onboarding-header">
              <div>
                <p className="eyebrow">Match A Guardian</p>
                <h1>Choose the kind of blessing you need today.</h1>
                <p className="lead compact">
                  Pick one path. We will match the guardian that fits it best.
                </p>
              </div>
            </div>

            <div className="intention-grid">
              {intentionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`intent-card intent-card-${option.id} ${profile.intention === option.id ? "selected" : ""}`}
                  onClick={() => setProfile((current) => ({ ...current, intention: option.id }))}
                >
                  <small>{getIntentionAccent(option.id)}</small>
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>

            <div className="preview-band">
              <span>Matched guardian</span>
              <strong>{onboardingDeity.name} is your matched guardian for this blessing.</strong>
            </div>
            <div className="recommendation-note recommendation-note-stronger">
              <span>Why this guardian</span>
              <p>{recommendationReason}</p>
            </div>

            <div className="deity-list deity-list-onboarding">
              <article className={`deity-switch deity-card-${onboardingDeity.id} active`}>
                <div className="deity-switch-top">
                  <div className={`deity-switch-portrait aura-${onboardingDeity.aura}`}>
                    <img src={getDeityCutoutSrc(onboardingDeity.id)} alt="" aria-hidden="true" />
                  </div>
                  <div className="deity-switch-copy">
                    <strong>{onboardingDeity.name}</strong>
                    <span>{getGuardianRoleTitle(onboardingDeity)}</span>
                    <small>{onboardingDeity.sigil}</small>
                  </div>
                </div>
                <div className="deity-switch-meta">
                  <em>{onboardingDeity.essence}</em>
                  <b className="guardian-access-pill guardian-access-pill-free-now">Free first guardian</b>
                </div>
              </article>
            </div>

            <button className="primary-button" onClick={completeOnboarding} disabled={!onboardingReady}>
              Keep this guardian for free
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell theme-${activeDeity.id}`} style={buildThemeStyle(activeDeity)}>
      <div className="background-grid" />
      <section className={`shrine-page shrine-page-${activeDeity.id}`}>
        <aside className="control-column">
          <div className="panel profile-panel">
            <p className="eyebrow">Your Guardian</p>
            <div className="profile-hero">
              <div className={`profile-hero-figure aura-${activeDeity.aura}`}>
                <img src={getDeityCutoutSrc(activeDeity.id)} alt="" aria-hidden="true" />
              </div>
              <div>
                <h1>{activeDeity.name}</h1>
                <p className="muted">
                  {activeDeity.name} is staying with you
                </p>
              </div>
            </div>
            <div className="profile-focus-band">
              <span>{guardianRoleTitle}</span>
              <strong>{activeDeity.name}</strong>
              <p>{activeDeity.essence}</p>
            </div>
            <div className="compact-meta-row">
              <div className="energy-badge">
                <span>Incense days</span>
                <strong>{activeCompanion.streak}</strong>
              </div>
              <div className="sigil-band">
                <span>Protects</span>
                <strong>{getDeityLifeAreaLabel(activeDeity.id)}</strong>
              </div>
            </div>
            <div className="petition-summary petition-summary-compact">
              <span>Your chosen blessing</span>
              <strong>{profile.currentConcern.trim() ? profile.currentConcern : "Your first blessing will appear here."}</strong>
            </div>
            <div className="compact-stats-grid">
              <article>
                <span>Main blessing</span>
                <strong>{activeDeity.themes[0]}</strong>
              </article>
              <article>
                <span>Supports</span>
                <strong>{activeDeity.themes[1]}</strong>
              </article>
            </div>
            <p className="blessing-line compact">{activeDeity.blessing}</p>
          </div>

          <div className="panel lineup-panel">
            <p className="eyebrow">Other Guardians</p>
            <p className="lineup-summary">Your first guardian stays free. Unlock another only when you need a different kind of blessing.</p>
            <div className="deity-list">
              {deities.map((deity) => (
                <button
                  key={deity.id}
                  className={`deity-switch deity-card-${deity.id} ${activeDeity.id === deity.id ? "active" : ""}`}
                  onClick={() => {
                    const unlocked = isGuardianUnlocked({
                      deity,
                      primaryDeityId: profile.deityId,
                      unlockedPacks: effectiveUnlockedPacks,
                      companion: profile.companions[deity.id]
                    });

                    if (unlocked) {
                      switchDeity(deity.id);
                      return;
                    }

                    openPackSheet(getRecommendedRitualPack(deity));
                  }}
                >
                  <div className="deity-switch-top">
                    <div className={`deity-switch-portrait aura-${deity.aura}`}>
                      <img src={getDeityCutoutSrc(deity.id)} alt="" aria-hidden="true" />
                    </div>
                    <div className="deity-switch-copy">
                      <strong>{deity.name}</strong>
                      <span>{getGuardianRoleTitle(deity)}</span>
                      <small>{deity.sigil}</small>
                    </div>
                  </div>
                  <div className="deity-switch-meta">
                    <em>{getGuardianSwitchHook(deity)}</em>
                    <b className={`guardian-access-pill guardian-access-pill-${getGuardianAccessLabel({
                      deity,
                      primaryDeityId: profile.deityId,
                      unlockedPacks: effectiveUnlockedPacks,
                      companion: profile.companions[deity.id]
                    }).toLowerCase().replace(/\s+/g, "-")}`}>
                      {getGuardianAccessLabel({
                        deity,
                        primaryDeityId: profile.deityId,
                        unlockedPacks: effectiveUnlockedPacks,
                        companion: profile.companions[deity.id]
                      })}
                    </b>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel small-panel journey-panel journey-panel-compact">
            <p className="eyebrow">Offer Incense</p>
            <div className="constellation-state incense-quick-panel">
              <span>{activeCompanion.streak === 0 ? "No incense yet" : `${activeCompanion.streak} day${activeCompanion.streak > 1 ? "s" : ""} offered`}</span>
              <strong>{ritualComplete ? "Today's incense is already lit." : "Light one incense to keep this guardian close today."}</strong>
              <p>{ritualComplete ? "The altar is glowing and the blessing is staying with you." : "Tap below and go to the altar to light today's incense."}</p>
            </div>
            <button className="ghost-button" onClick={scrollToGuidanceSection}>
              Offer incense
            </button>
          </div>

        </aside>

        <section className="shrine-stage">
          <div
            className={`shrine-chamber aura-${activeDeity.aura}`}
            style={{
              background: `radial-gradient(circle at top, ${activeDeity.palette[0]}33, transparent 42%), linear-gradient(180deg, ${activeDeity.palette[2]}66, #0d0a16 65%)`
            }}
          >
            <div className="shrine-header">
              <div>
                <p className="eyebrow">{revealEyebrow}</p>
                <h2>{revealHeading}</h2>
                <p className="lead compact">{resultHeroLine}</p>
              </div>
              <button className="ghost-button" onClick={resetExperience}>
                Start over
              </button>
            </div>
            <div className="altar-visual">
              <ShrineScene deity={activeDeity} sceneState={sceneState} sceneVersion={sceneVersion} />
            </div>

            <div className="result-hero-grid">
              <article className="result-hero-card result-hero-card-primary">
                <span className="detail-label">Your matched guardian</span>
                <h3>{activeDeity.name}</h3>
                <p>{activeDeity.essence}</p>
                <div className="result-hero-actions">
                  <button className="primary-button" onClick={scrollToGuidanceSection}>
                    Keep this blessing close
                  </button>
                <small>Save it, read it, or keep it quietly with you today.</small>
              </div>
            </article>
            </div>
          </div>

          <div className="ritual-grid">
            <article id="daily-guidance" className="panel ritual-panel ritual-panel-guidance">
              <p className="eyebrow">Offer Incense</p>
              <h3>{activeCompanion.streak === 0 ? `Light incense for ${activeDeity.name}` : `${activeDeity.name} is already with you today`}</h3>
              <p className="muted">Choose one offering and keep this guardian close today.</p>
              <div className={`incense-ritual-banner ${ritualComplete ? "lit" : ""}`}>
                <div className="incense-ritual-copy">
                  <span>Incense days</span>
                  <strong>{activeCompanion.streak}</strong>
                  <p>{ritualComplete ? "Today's incense is burning at the altar." : "Light today's incense and the altar will begin to glow."}</p>
                </div>
                <button className={`incense-action-button ${ritualComplete ? "lit" : ""}`} onClick={performRitual} disabled={ritualComplete}>
                  <i className="incense-action-aura" aria-hidden="true" />
                  <i className="incense-action-tray" aria-hidden="true" />
                  <i className="incense-action-icon" aria-hidden="true">
                    <b className="incense-stick-icon incense-stick-icon-left" />
                    <b className="incense-stick-icon incense-stick-icon-center" />
                    <b className="incense-stick-icon incense-stick-icon-right" />
                    <span className="incense-smoke-icon smoke-icon-a" />
                    <span className="incense-smoke-icon smoke-icon-b" />
                    <span className="incense-smoke-icon smoke-icon-c" />
                  </i>
                  <span>{ritualComplete ? "Incense offered today" : "Light incense now"}</span>
                </button>
              </div>
              <div className="offering-picker">
                {activeDeity.offerings.map((offering) => (
                  <button
                    key={offering}
                    type="button"
                    className={`offering-chip ${selectedOffering === offering ? "active" : ""}`}
                    onClick={() => setSelectedOffering(offering)}
                  >
                    {offering}
                  </button>
                ))}
              </div>
              {latestWish ? (
                <div className={`ritual-receipt ritual-receipt-${activeDeity.id}`}>
                  <span>Today's offering</span>
                  <strong>{latestWishDisplayLine}</strong>
                </div>
              ) : null}
              {ritualOutcome ? (
                <div className={`ritual-outcome ritual-outcome-${activeDeity.id}`}>
                  <div className="ritual-outcome-header">
                    <span>Today's blessing</span>
                    <em>{activeDeity.name}</em>
                  </div>
                  <strong>{ritualOutcome.blessing}</strong>
                  <p>{ritualOutcome.offering}</p>
                  <small>{ritualOutcome.omen}</small>
                </div>
              ) : null}
            </article>

            <article className="panel ritual-panel ritual-panel-share">
              <p className="eyebrow">Share Card</p>
              <h3>Save your guardian card or send it to a friend.</h3>
              <p className="muted">Your card includes the guardian you invited and a blessing message you can share.</p>

              <div className="share-card">
                <span className="share-label">{shareCardLabel}</span>
                <strong>{activeDeity.name}</strong>
                <p>
                  {activeDeity.themes[0]} • Lucky {luckyNumber}
                </p>
                <p className="share-spirit-line">{shareCardSpiritLine}</p>
                <div className="share-signal-row">
                  <span>Save it for yourself</span>
                  <span>Send a blessing to a friend</span>
                </div>
                <small>{oracle}</small>
                <small className="share-legal-note">Mythology-inspired and symbolic, not guaranteed advice or outcomes.</small>
              </div>
              <div className={`share-preview-shell finish-${activeCardFinish.id}`}>
                <div className="share-preview-meta">
                  <span>Blessing card preview</span>
                  <strong>{activeDeity.name}</strong>
                </div>
                <img className="share-preview-image" src={shareCardPreview} alt={`${activeDeity.name} guardian card preview`} />
              </div>

              <div className="share-actions">
                <button className="primary-button share-button" onClick={exportShareCard} disabled={!shareCardReady}>
                  {shareCardReady ? "Save blessing card" : "Rendering blessing card"}
                </button>
                <button className="ghost-button share-button" onClick={() => void copyOracle()}>
                  Copy share text
                </button>
              </div>
              {shareMessage ? <p className="share-feedback">{shareMessage}</p> : null}
            </article>
          </div>

          <div className="growth-grid">
            <section className="panel stage-panel launch-panel">
              {checkoutReturnState !== "idle" ? (
                <div className={`checkout-return-banner checkout-return-banner-${checkoutReturnState}`}>
                  <span>
                    {checkoutReturnState === "processing"
                      ? "Completing unlock"
                      : checkoutReturnState === "success"
                        ? "Unlock complete"
                        : "Unlock needs attention"}
                  </span>
                  <strong>{checkoutReturnMessage}</strong>
                </div>
              ) : null}
              <p className="eyebrow">Unlock Other Guardians</p>
              <div className="launch-panel-copy">
                <h3>Your matched guardian is free. The other four unlock separately, or you can open all five at once.</h3>
                <p className="muted">
                  All five guardians are part of the product. Your first guardian is free based on your chosen blessing. The remaining four unlock one by one, and a full collection unlock is also available.
                </p>
                <p className="muted">
                  The experience stays on this website. Payment only opens a secure checkout page, then returns here so the unlock can continue inside your shrine.
                </p>
              </div>
              {providerReadiness.provider === "gumroad" ? (
                <div className="checkout-urgency-note commerce-status-grid">
                  <span>Gumroad checkout flow</span>
                  <strong>Pay on Gumroad in a new tab, then return here with the same email so your unlock can be confirmed and opened inside the website.</strong>
                  <small className="checkout-helper-line">Current restore email: {restoreEmail || recentCommerceEmail || getDefaultCheckoutEmail()}</small>
                  <button className="ghost-button commerce-restore-button" onClick={() => void handleRestorePurchases()}>
                    Restore access
                  </button>
                </div>
              ) : null}
              {!allGuardiansUnlocked && lockedGuardianPacks.length > 1 ? (
                <div className="full-unlock-card">
                  <div className="full-unlock-header">
                    <div className="full-unlock-copy">
                      <span className="full-unlock-badge">Full collection unlock</span>
                      <strong>Unlock all five guardians in one step</strong>
                      <p>
                        Your matched guardian stays free. If you want every blessing path available right away, you can unlock the full Eastern Guardians collection here.
                      </p>
                    </div>
                    <div className="full-unlock-meta">
                      <span>One-time unlock</span>
                      <strong>{allGuardiansPack.price}</strong>
                      <em>Five guardians together</em>
                    </div>
                  </div>
                  <div className="full-unlock-guardian-row" aria-label="All guardians included">
                    {deities.map((deity) => (
                      <span key={deity.id} className="full-unlock-guardian-chip">
                        {deity.name}
                      </span>
                    ))}
                  </div>
                  <div className="tier-feature-list">
                    {allGuardiansPack.outcomes.map((outcome) => (
                      <span key={outcome}>{outcome}</span>
                    ))}
                  </div>
                  <button className="primary-button full-unlock-action" onClick={() => handlePackLaunchAction(allGuardiansPack)}>
                    {providerReadiness.provider === "gumroad" ? "Pay on Gumroad" : "Unlock all guardians"}
                  </button>
                </div>
              ) : null}
              {lockedGuardianPacks.length > 0 ? (
                <div className="single-unlock-block">
                  <div className="single-unlock-copy">
                    <span className="single-unlock-label">Single guardian unlocks</span>
                    <p>Prefer to keep it simple? You can unlock the remaining guardians one by one below.</p>
                  </div>
                  <div className="deity-list deity-list-commerce">
                  {lockedGuardianPacks.map((pack) => (
                    <div key={pack.title} className="launch-note launch-note-pack">
                      <span>Paid unlock</span>
                      <strong>{pack.guardian} • {pack.price}</strong>
                      <em>{pack.trigger}</em>
                      <p>Your matched first guardian is free. This guardian unlocks separately as a one-time purchase.</p>
                      <div className="tier-feature-list">
                        {pack.outcomes.map((outcome) => (
                          <span key={outcome}>{outcome}</span>
                        ))}
                      </div>
                      <button className="primary-button" onClick={() => handlePackLaunchAction(pack)}>
                        {providerReadiness.provider === "gumroad" ? `Pay for ${pack.guardian}` : `Unlock ${pack.guardian}`}
                      </button>
                    </div>
                  ))}
                </div>
                </div>
              ) : (
                <div className="launch-note launch-note-pack">
                  <span>All guardians unlocked</span>
                  <strong>Your full guardian collection is already open.</strong>
                  <p>You now have all five guardians available and can return to any blessing whenever you need it.</p>
                </div>
              )}
            </section>
          </div>
        </section>
      </section>
      {selectedPack ? (
        <div className="upgrade-sheet-overlay" role="presentation" onClick={closePackSheet}>
          <div className="upgrade-sheet" role="dialog" aria-modal="true" aria-label={`${selectedPack.title} pack`} onClick={(event) => event.stopPropagation()}>
            <div className="upgrade-sheet-header">
              <div>
                <span className="section-label">{selectedPack.guardian} guardian</span>
                <h3>{selectedPack.title}</h3>
                <strong className="pack-hero-line">{selectedPack.promise}</strong>
                <p>{selectedPack.description}</p>
              </div>
              <button className="ghost-button upgrade-sheet-close" onClick={closePackSheet}>
                Close
              </button>
            </div>
            <div className="upgrade-sheet-body upgrade-sheet-body-checkout">
              <div className="upgrade-sheet-price">
                <span>One-time guardian unlock</span>
                <strong>{selectedPack.price}</strong>
                <small className="pack-trigger-line">{selectedPack.trigger}</small>
                <p>
                  {selectedPack.title === allGuardiansPack.title
                    ? "Your matched first guardian is free. This unlock opens the full five-guardian collection in one purchase."
                    : "Your matched first guardian is free. This unlock pays once for this guardian only."}
                </p>
              </div>
              <div className="checkout-sheet-card">
                {providerReadiness.mode !== "live" ? (
                  <div className="checkout-urgency-note">
                    <span>Launch prep status</span>
                    <strong>Live checkout is not turned on yet. This flow is currently in launch-prep mode.</strong>
                  </div>
                ) : null}
                <div className="checkout-summary">
                  <div>
                    <span>Selected guardian</span>
                    <strong>{selectedPack.title}</strong>
                  </div>
                  <div>
                    <span>{selectedPack.title === allGuardiansPack.title ? "Collection" : "Guardian"}</span>
                    <strong>{selectedPack.guardian}</strong>
                  </div>
                  <div>
                    <span>Billing</span>
                    <strong>One-time payment</strong>
                  </div>
                </div>
                <div className="checkout-summary-note">
                  <span>How it works</span>
                  <strong>
                    {selectedPack.title === allGuardiansPack.title
                      ? "All five guardians are part of the product. Your matched first guardian is free, and this option unlocks the remaining collection at once."
                      : "All five guardians are part of the product. Your matched first guardian is free, and each additional guardian can unlock separately."}
                  </strong>
                </div>
                <div className="checkout-urgency-note">
                  <span>After payment</span>
                  <strong>
                    {providerReadiness.provider === "gumroad"
                      ? "Gumroad opens directly from this page. After payment, return here and your guardian unlock will be confirmed with the same checkout email."
                      : selectedPack.title === allGuardiansPack.title
                        ? "Checkout opens in a secure payment page, then returns here so your full guardian collection can unlock inside the website."
                        : "Checkout opens in a secure payment page, then returns here so this guardian can unlock inside the website."}
                  </strong>
                </div>
                {providerReadiness.provider === "gumroad" ? (
                  <div className="checkout-urgency-note">
                    <span>Restore access</span>
                    <strong>Use the same email you pay with on Gumroad. If the webhook arrives a little late, Restore access will pull the unlock back into your shrine.</strong>
                    <small className="checkout-helper-line">Current restore email: {restoreEmail || recentCommerceEmail || getDefaultCheckoutEmail()}</small>
                  </div>
                ) : null}
                {providerReadiness.provider === "gumroad" ? (
                  <div className="checkout-summary-note">
                    <span>Simple flow</span>
                    <strong>1. Pay on Gumroad. 2. Return here. 3. We confirm the payment from your checkout email. 4. If confirmation is delayed, tap Restore access.</strong>
                  </div>
                ) : null}
                <div className="upgrade-sheet-benefits">
                  <span>Included</span>
                  <ul>
                    {selectedPack.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </div>
                <div className="checkout-urgency-note">
                  <span>Why it works</span>
                  <strong>People can simply invite the blessing they need right now, without complexity.</strong>
                </div>
                <p className="checkout-legal-note">
                  Symbolic and cultural comfort only. This product does not promise outcomes.
                </p>
              </div>
            </div>
            <div className="upgrade-sheet-actions">
              <button className="primary-button" onClick={handleUnlockPackPurchase}>
                {providerReadiness.provider === "gumroad"
                  ? selectedPack.title === allGuardiansPack.title
                    ? "Pay on Gumroad"
                    : `Pay for ${selectedPack.guardian} on Gumroad`
                  : selectedPack.title === allGuardiansPack.title
                    ? "Unlock all guardians"
                    : `Unlock ${selectedPack.guardian}`}
              </button>
              {providerReadiness.provider === "gumroad" ? (
                <button className="ghost-button" onClick={() => void handleRestorePurchases()}>
                  Restore access
                </button>
              ) : null}
              <button className="ghost-button" onClick={closePackSheet}>
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
