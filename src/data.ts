export type Intention =
  | "healing"
  | "wealth"
  | "love"
  | "focus"
  | "protection";

export type DeityId = "guanyin" | "caishen" | "yuelao" | "wenchang" | "mazu";

export type Deity = {
  id: DeityId;
  name: string;
  title: string;
  essence: string;
  sigil: string;
  blessing: string;
  invocation: string;
  arrivalLine: string;
  blessingResponse: string;
  chamberNote: string;
  themes: string[];
  offerings: string[];
  palette: [string, string, string];
  luckyColors: string[];
  watchwords: [string, string, string];
  idealMoments: string[];
  companionStyle: string;
  oracleLines: string[];
  actionPrompts: string[];
  keepsakes: { bond: number; title: string; description: string }[];
  chamberLabel: string;
  aura: string;
  shrineSeat: string;
  chamberGlyphs: [string, string];
  iconography: [string, string, string];
  idleSceneLabel: string;
  idleSceneCaption: string;
};

export const intentionOptions: { id: Intention; label: string; description: string }[] = [
  { id: "healing", label: "Healing", description: "For emotional calm and gentler days." },
  { id: "wealth", label: "Prosperity", description: "For livelihood pressure, resources, and steadier fortune." },
  { id: "love", label: "Love", description: "For warmth, closeness, and repair." },
  { id: "focus", label: "Focus", description: "For study, writing, and creative discipline." },
  { id: "protection", label: "Protection", description: "For travel, transitions, and steadiness." }
];

export const zodiacOptions = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
];

export function parseBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getZodiacFromBirthDate(value: string) {
  const parsed = parseBirthDate(value);
  if (!parsed) {
    return null;
  }

  const { month, day } = parsed;
  const monthDay = month * 100 + day;

  if (monthDay >= 321 && monthDay <= 419) return "Aries";
  if (monthDay >= 420 && monthDay <= 520) return "Taurus";
  if (monthDay >= 521 && monthDay <= 620) return "Gemini";
  if (monthDay >= 621 && monthDay <= 722) return "Cancer";
  if (monthDay >= 723 && monthDay <= 822) return "Leo";
  if (monthDay >= 823 && monthDay <= 922) return "Virgo";
  if (monthDay >= 923 && monthDay <= 1022) return "Libra";
  if (monthDay >= 1023 && monthDay <= 1121) return "Scorpio";
  if (monthDay >= 1122 && monthDay <= 1221) return "Sagittarius";
  if (monthDay >= 1222 || monthDay <= 119) return "Capricorn";
  if (monthDay >= 120 && monthDay <= 218) return "Aquarius";
  return "Pisces";
}

export const deities: Deity[] = [
  {
    id: "guanyin",
    name: "Guanyin",
    title: "Guardian of Mercy",
    essence: "A moonwater shrine for release, compassion, and a return to inner quiet.",
    sigil: "Lotus Tide",
    blessing: "May softness reveal the path that force concealed.",
    invocation: "Guide me back to the soft path that still moves me forward.",
    arrivalLine: "Guanyin arrives with low tides, moon breath, and a quiet reset.",
    blessingResponse: "Your blessing settles like calm water. Move gently and let clarity surface.",
    chamberNote: "Porcelain arches, lotus basins, suspended mist, and silver waterlight held in still balance.",
    themes: ["Compassion", "Soft Reset", "Emotional Clarity"],
    offerings: ["Quiet Breath", "Moon Water", "Release Note"],
    palette: ["#f6efe4", "#9dd9db", "#d3caee"],
    luckyColors: ["Moon Pearl", "Sea Glass", "Mist Lavender"],
    watchwords: ["Soothe", "Release", "Restore"],
    idealMoments: ["After emotional overload", "Before sleep", "When you need self-kindness"],
    companionStyle: "Still, low-motion, and emotionally cooling, like moonlight settling over water.",
    oracleLines: [
      "What softens is not weaker. It is becoming possible again.",
      "You do not need to solve the entire storm to step into calmer water.",
      "A gentler rhythm will reveal what force has hidden."
    ],
    actionPrompts: [
      "Take three slow breaths before answering any difficult message today.",
      "Clear one emotional burden by writing it down and closing the page.",
      "Create ten quiet minutes with no task attached to them."
    ],
    keepsakes: [
      { bond: 28, title: "Lotus Note", description: "A memory of the first time calm replaced urgency." },
      { bond: 72, title: "Moon Basin", description: "A deeper healing archive that holds what you no longer need to carry alone." },
      { bond: 120, title: "Soft Tide Seal", description: "A signature keepsake for emotional recovery, gentleness, and return." }
    ],
    chamberLabel: "Moonwater Mercy Court",
    aura: "silver-mist",
    shrineSeat: "White Lotus Seat",
    chamberGlyphs: ["Mercy Field", "Moonwater Release"],
    iconography: ["Willow Branch", "Porcelain Vase", "Lotus Basin"],
    idleSceneLabel: "Mercy field open",
    idleSceneCaption: "Guanyin remains in still presence, keeping your petition cool enough for clarity to surface."
  },
  {
    id: "caishen",
    name: "Caishen",
    title: "Guardian of Prosperity",
    essence: "A vermilion court for money worries, livelihood pressure, and the wish to feel supported while building a steadier life.",
    sigil: "Prosperity Seal",
    blessing: "May your efforts find steadier ground, kinder timing, and enough support to keep going.",
    invocation: "Help me meet money pressure with steadier courage, clearer choices, and room to breathe.",
    arrivalLine: "Caishen arrives in warm gold stillness, holding both ambition and unease without judgment.",
    blessingResponse: "The blessing settles around your next practical step. Move with calm and protect what supports your life.",
    chamberNote: "Cinnabar lacquer, prosperity tablets, warm light, and ceremonial calm that steadies the heart before action.",
    themes: ["Prosperity", "Security", "Courage"],
    offerings: ["Practical Step", "Honest Ask", "Steady Intention"],
    palette: ["#ffde8c", "#e8593f", "#4d0f16"],
    luckyColors: ["Cinnabar Gold", "Vermilion", "Treasure Amber"],
    watchwords: ["Steady", "Receive", "Build"],
    idealMoments: ["When money stress is rising", "Before an important ask", "When work and livelihood feel uncertain"],
    companionStyle: "Warm, reassuring, and grounding, like being reminded that practical effort and inner steadiness can exist together.",
    oracleLines: [
      "Prosperity begins by calming the fear that everything rests on one moment.",
      "A steadier life is often built through one clear decision made without panic.",
      "Support can arrive through practical effort, honest asks, and calmer timing."
    ],
    actionPrompts: [
      "Take one practical step that reduces today's money stress, even if it is small.",
      "Send the ask, follow-up, or message that could open support without forcing the outcome.",
      "Protect one choice today that supports your livelihood instead of feeding panic."
    ],
    keepsakes: [
      { bond: 28, title: "Prosperity Slip", description: "A first token from choosing steadiness while money pressure is active." },
      { bond: 72, title: "Livelihood Ledger", description: "A keepsake for calmer money choices, practical support, and restored confidence." },
      { bond: 120, title: "Prosperity Seal", description: "A signature marker for courage, grounded effort, and a life that feels better held." }
    ],
    chamberLabel: "Vermilion Prosperity Court",
    aura: "ember-gold",
    shrineSeat: "Prosperity Seat",
    chamberGlyphs: ["Prosperity Edict", "Steady Fortune"],
    iconography: ["Gold Ingot", "Golden Tablet", "Imperial Crown"],
    idleSceneLabel: "Prosperity court awake",
    idleSceneCaption: "Caishen holds the court in warm readiness, keeping your petition company while fear softens and practical hope returns."
  },
  {
    id: "yuelao",
    name: "Yuelao",
    title: "Guardian of Connection",
    essence: "A lantern court of red silk, tenderness, and the wish to feel closer, clearer, and more honestly met.",
    sigil: "Thread Knot",
    blessing: "May the connections you nourish become clearer, warmer, and more mutual.",
    invocation: "Call in the connection that feels warm, true, and returned.",
    arrivalLine: "Yuelao appears with patient red threads and a lantern-soft pull.",
    blessingResponse: "Your thread is lit. Reach out while the heart is clear and honest.",
    chamberNote: "Velvet dusk, lantern halos, silk cords, and a register of threads moving slowly through the air.",
    themes: ["Connection", "Repair", "Tenderness"],
    offerings: ["Honest Reach", "Warmth", "Repaired Thread"],
    palette: ["#f7d0d3", "#d64f7d", "#752145"],
    luckyColors: ["Rose Silk", "Lantern Coral", "Blush Thread"],
    watchwords: ["Reveal", "Reach", "Repair"],
    idealMoments: ["Before messaging someone", "When healing a connection", "During connection reflection"],
    companionStyle: "Lantern-warm, emotionally magnetic, and attentive to sincerity over performance.",
    oracleLines: [
      "The right connection often begins with honesty, not performance.",
      "Affection deepens where attention lingers with care.",
      "What you are calling in should feel warm, not confusing."
    ],
    actionPrompts: [
      "Reach out to someone you miss with one sincere sentence.",
      "Name the kind of love you want without apologizing for it.",
      "Repair one thread today by listening before explaining."
    ],
    keepsakes: [
      { bond: 28, title: "Red Thread Slip", description: "A first keepsake from choosing honesty over performance." },
      { bond: 72, title: "Lantern Letter", description: "A warmer record of tenderness, repair, and mutual clarity." },
      { bond: 120, title: "Heart Knot Emblem", description: "A signature symbol of chosen bonds and returned affection." }
    ],
    chamberLabel: "Red Thread Lantern Court",
    aura: "rose-glow",
    shrineSeat: "Lantern Thread Seat",
    chamberGlyphs: ["Lantern Oath", "Thread Archive"],
    iconography: ["Red Thread Spool", "Lantern Register", "Blush Silk Cord"],
    idleSceneLabel: "Thread court listening",
    idleSceneCaption: "Yuelao keeps the lanterns lit, holding your petition where honesty can find the right thread."
  },
  {
    id: "wenchang",
    name: "Wenchang",
    title: "Guardian of Clarity",
    essence: "A starlit study court for concentration, language, and the kind of mental steadiness that helps thought come back into form.",
    sigil: "Celestial Brush",
    blessing: "May your mind hold steady long enough for thought to become clear again.",
    invocation: "Steady my mind long enough to return to what matters without scattering.",
    arrivalLine: "Wenchang arrives like a lamp over paper: cool, exact, and focused.",
    blessingResponse: "Your study field is open. Stay with one clear line longer than distraction asks.",
    chamberNote: "Inkstone shadows, celestial registers, cool paper light, and disciplined lines that pull thought into form.",
    themes: ["Scholarship", "Expression", "Discipline"],
    offerings: ["Single Task", "Draft Page", "Study Block"],
    palette: ["#d9dcc8", "#7d8c6b", "#1f2537"],
    luckyColors: ["Brush Ink", "Bamboo Sage", "Paper Light"],
    watchwords: ["Focus", "Shape", "Finish"],
    idealMoments: ["Before studying", "While writing", "When you need deep work"],
    companionStyle: "Precise, upright, and quietly steadying, like a study lamp that helps a crowded mind settle back into focus.",
    oracleLines: [
      "Clarity returns by coming back to the page, not by waiting to feel perfect first.",
      "Thought grows steadier when it is given shape, time, and quiet.",
      "Your attention is a fragile resource. Protect it gently."
    ],
    actionPrompts: [
      "Set one protected focus block and let it be enough for today.",
      "Finish one paragraph, one section, or one proof before changing direction.",
      "Put your next idea into words before doubt talks you out of it."
    ],
    keepsakes: [
      { bond: 28, title: "Brush Fragment", description: "A first proof that structure can hold your attention steady." },
      { bond: 72, title: "Study Page", description: "A keepsake of disciplined craft, repetition, and finished thought." },
      { bond: 120, title: "Celestial Draft Seal", description: "A signature archive mark for mastery, articulation, and deep work." }
    ],
    chamberLabel: "Starlit Brush Court",
    aura: "ink-starlight",
    shrineSeat: "Celestial Brush Seat",
    chamberGlyphs: ["Scholar's Register", "Brush Constellation"],
    iconography: ["Scholar Cap", "Scroll Register", "Celestial Brush"],
    idleSceneLabel: "Study court open",
    idleSceneCaption: "Wenchang holds the room in exact stillness, asking your attention to gather before it scatters again."
  },
  {
    id: "mazu",
    name: "Mazu",
    title: "Guardian of Safe Passage",
    essence: "A harbor shrine of tide light, protection, and steadiness through uncertain crossings.",
    sigil: "Harbor Compass",
    blessing: "May what carries you onward feel guided, anchored, and protected.",
    invocation: "Keep my crossing steady, guided, and free from needless fear.",
    arrivalLine: "Mazu enters like a harbor light: calm, directional, and watchful.",
    blessingResponse: "The passage is protected. Choose the steadier route and keep going.",
    chamberNote: "Sea haze, beacon glass, tidal reflections, and horizon lines that make movement feel guided.",
    themes: ["Protection", "Transition", "Guidance"],
    offerings: ["Steady Choice", "Travel Note", "Anchored Step"],
    palette: ["#dff2f0", "#4aa7b8", "#10364f"],
    luckyColors: ["Harbor Blue", "Sea Salt", "Tidal Jade"],
    watchwords: ["Anchor", "Guide", "Cross"],
    idealMoments: ["Before travel", "During transitions", "When life feels unsteady"],
    companionStyle: "Protective, sea-borne, and quietly directional, like a beacon holding through weather.",
    oracleLines: [
      "You do not need to see the whole route to trust the next crossing.",
      "Protection can feel like steadiness more than certainty.",
      "What carries you forward may be quieter than what frightened you."
    ],
    actionPrompts: [
      "Prepare one part of an upcoming transition before the day ends.",
      "Check in with the version of you that feels far from shore.",
      "Choose the steadier path over the more dramatic one."
    ],
    keepsakes: [
      { bond: 28, title: "Harbor Pin", description: "A first keepsake for choosing steadiness during movement." },
      { bond: 72, title: "Sea Route Token", description: "A trusted marker for transitions handled with more calm than fear." },
      { bond: 120, title: "Safe Passage Crest", description: "A signature emblem of protection, trust, and onward movement." }
    ],
    chamberLabel: "Harbor Lantern Court",
    aura: "tide-lamp",
    shrineSeat: "Harbor Beacon Seat",
    chamberGlyphs: ["Tide Beacon", "Safe Crossing"],
    iconography: ["Beacon Lamp", "Tide Compass", "Sea Ribbon"],
    idleSceneLabel: "Harbor ward lit",
    idleSceneCaption: "Mazu keeps the harbor lamp raised, letting your petition move forward without panic."
  }
];

const zodiacToIntention: Record<string, Intention> = {
  Aries: "wealth",
  Taurus: "wealth",
  Gemini: "love",
  Cancer: "healing",
  Leo: "wealth",
  Virgo: "focus",
  Libra: "love",
  Scorpio: "protection",
  Sagittarius: "protection",
  Capricorn: "focus",
  Aquarius: "focus",
  Pisces: "healing"
};

const intentionToDeity: Record<Intention, DeityId> = {
  healing: "guanyin",
  wealth: "caishen",
  love: "yuelao",
  focus: "wenchang",
  protection: "mazu"
};

const complementaryIntention: Record<Intention, Intention> = {
  healing: "protection",
  wealth: "focus",
  love: "healing",
  focus: "wealth",
  protection: "healing"
};

export function getZodiacIntention(zodiac: string): Intention {
  return zodiacToIntention[zodiac] ?? "healing";
}

export function getDeityById(deityId: DeityId): Deity {
  return deities.find((deity) => deity.id === deityId) ?? deities[0];
}

export function getDeityForIntention(intention: Intention): Deity {
  return getDeityById(intentionToDeity[intention]);
}

export function getDeityForZodiac(zodiac: string): Deity {
  return getDeityForIntention(getZodiacIntention(zodiac));
}

export function getSupportDeity(zodiac: string, intention: Intention): Deity {
  const primary = getDeityForIntention(intention);
  const zodiacGuardian = getDeityForZodiac(zodiac);

  if (zodiacGuardian.id !== primary.id) {
    return zodiacGuardian;
  }

  return getDeityForIntention(complementaryIntention[intention]);
}

export function pickRecommendedDeity(zodiac: string, intention: Intention): Deity {
  return getDeityForIntention(intention || getZodiacIntention(zodiac));
}

export function getLuckyNumber(birthDate: string, deityId: DeityId): number {
  const parsed = parseBirthDate(birthDate);
  const normalized = parsed
    ? `${String(parsed.year).padStart(4, "0")}${String(parsed.month).padStart(2, "0")}${String(parsed.day).padStart(2, "0")}`
    : "19990101";
  const digits = normalized.split("").map(Number);
  const total = digits.reduce((sum, digit) => sum + digit, 0) + deityId.length;
  return (total % 9) + 1;
}

export function rotateByDate<T>(items: T[], seed: string, date: Date): T {
  const daySeed = `${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}${seed}`;
  const total = daySeed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[total % items.length];
}

export function rotateByDay<T>(items: T[], seed: string): T {
  return rotateByDate(items, seed, new Date());
}
