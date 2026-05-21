'use client';

import { useEffect } from 'react';

const DINO_SRCS: Record<"flaco" | "normal" | "jacked", string> = {
  flaco:  "/images/rex-state-one.png",
  normal: "/images/rex-state-two.png",
  jacked: "/images/rex-state-final.png",
};

const DINO_ANIMS: Record<"flaco" | "normal" | "jacked", string> = {
  flaco:  "rex-sad",
  normal: "rex-fight",
  jacked: "rex-celebrate",
};

const DINO_CSS = `
  @keyframes rex-sad {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50%       { transform: translateY(-3px) rotate(1deg); }
  }
  @keyframes rex-fight {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25%      { transform: translateY(-5px) rotate(2deg); }
    75%      { transform: translateY(-3px) rotate(-2deg); }
  }
  @keyframes rex-celebrate {
    0%, 100% { transform: translateY(0) scale(1); }
    30%      { transform: translateY(-10px) scale(1.06) rotate(-3deg); }
    60%      { transform: translateY(-5px) scale(1.03) rotate(3deg); }
  }
  .rex-sad      { animation: rex-sad      2.4s ease-in-out 1 forwards; }
  .rex-fight    { animation: rex-fight    1.1s ease-in-out 1 forwards; }
  .rex-celebrate{ animation: rex-celebrate 0.75s ease-in-out 1 forwards; }
`;

const DINO_ANIM_KEY = "dino_anim_done";

export function DinoSVG({
  state,
  pixelSize = 6,
}: {
  state: "flaco" | "normal" | "jacked";
  pixelSize?: number;
}) {
  useEffect(() => {
    if (typeof localStorage === "undefined") return;

    const alreadyPlayed = localStorage.getItem(DINO_ANIM_KEY) === state;
    if (!alreadyPlayed) {
      localStorage.setItem(DINO_ANIM_KEY, state);
    }
  }, [state]);

  const size = pixelSize * 16;
  const alreadyPlayed = typeof localStorage !== "undefined" && localStorage.getItem(DINO_ANIM_KEY) === state;
  const animClass = alreadyPlayed ? "" : DINO_ANIMS[state];

  return (
    <>
      <style>{DINO_CSS}</style>
      <div className={animClass} style={{ width: size, height: size, flexShrink: 0 }}>
        <img
          src={DINO_SRCS[state]}
          alt="Rex"
          style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }}
        />
      </div>
    </>
  );
}
