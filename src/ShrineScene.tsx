import { Deity } from "./data";
import { getDeityCutoutSrc } from "./assets";

type ShrineSceneProps = {
  deity: Deity;
  sceneState: "idle" | "switching" | "blessing";
  sceneVersion: number;
};

function renderDeityEffects(deityId: Deity["id"]) {
  switch (deityId) {
    case "guanyin":
      return (
        <>
          <div className="companion-ribbon ribbon-left" />
          <div className="companion-ribbon ribbon-right" />
          <div className="companion-orbit orbit-a" />
          <div className="companion-orbit orbit-b" />
          <div className="companion-orb-mark pearl-a" />
          <div className="companion-orb-mark pearl-b" />
        </>
      );
    case "caishen":
      return (
        <>
          <div className="companion-ribbon ribbon-gold-left" />
          <div className="companion-ribbon ribbon-gold-right" />
          <div className="companion-burst burst-a" />
          <div className="companion-burst burst-b" />
          <div className="companion-caishen-sigil sigil-a" />
          <div className="companion-caishen-sigil sigil-b" />
          <div className="companion-caishen-mote mote-a" />
          <div className="companion-caishen-mote mote-b" />
        </>
      );
    case "yuelao":
      return (
        <>
          <div className="companion-thread thread-a" />
          <div className="companion-thread thread-b" />
          <div className="companion-thread thread-c" />
          <div className="companion-knot knot-a" />
          <div className="companion-knot knot-b" />
        </>
      );
    case "wenchang":
      return (
        <>
          <div className="companion-calligraphy calligraphy-a" />
          <div className="companion-calligraphy calligraphy-b" />
          <div className="companion-orbit orbit-ink" />
          <div className="companion-star-note note-a" />
          <div className="companion-star-note note-b" />
        </>
      );
    case "mazu":
      return (
        <>
          <div className="companion-wave wave-a" />
          <div className="companion-wave wave-b" />
          <div className="companion-ribbon ribbon-sea-left" />
          <div className="companion-ribbon ribbon-sea-right" />
          <div className="companion-beacon beacon-a" />
          <div className="companion-beacon beacon-b" />
        </>
      );
    default:
      return null;
  }
}

export function ShrineScene({ deity, sceneState, sceneVersion }: ShrineSceneProps) {
  return (
    <div
      key={`${deity.id}-${sceneState}-${sceneVersion}`}
      className={`scene-layer scene-layer-cutout companion-${deity.id} scene-state-${sceneState}`}
    >
      <div className="companion-backlight" />
      <div className="companion-soft-glow glow-a" />
      <div className="companion-soft-glow glow-b" />
      <div className="companion-transition-flare" />
      <div className="companion-blessing-ring blessing-ring-a" />
      <div className="companion-blessing-ring blessing-ring-b" />
      <div className="companion-status-breath" />
      {renderDeityEffects(deity.id)}
      <div className="companion-particles particles-a" />
      <div className="companion-particles particles-b" />
      <div className="companion-chamber-veil" />
      <div className="companion-chamber-floor" />
      <div className="companion-halo-arch arch-a" />
      <div className="companion-halo-arch arch-b" />
      <div className="companion-avatar-shell">
        <img
          className="companion-avatar"
          src={getDeityCutoutSrc(deity.id)}
          alt=""
          aria-hidden="true"
        />
        <img
          className="companion-avatar echo"
          src={getDeityCutoutSrc(deity.id)}
          alt=""
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
