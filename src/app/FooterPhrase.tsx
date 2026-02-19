"use client";

import { useSyncExternalStore } from "react";

const phrases = [
  "Born from the genius of my wife — the best Valentine's gift is the one she inspires. 💜",
  "Inspired by my wife's brilliant idea. Built with 💜 as a Valentine's Day gift for her.",
  "This began as my wife's genius idea — I just wrote the code. Happy Valentine's Day, my love! 💜",
  "A Valentine's gift brought to life by her vision. Every line of code, for her. 💜",
  "Dreamed by her, built for her. A Valentine's Day gift born from her genius. 💜",
  "Her idea. Her inspiration. My Valentine's gift to the most brilliant woman I know. 💜",
  "Created as a Valentine's Day gift, inspired by my wife's genius — because the best ideas come from love. 💜",
  "She had the vision, I wrote the code. A Valentine's gift for the genius I married. 💜",
];

const emptySubscribe = () => () => {};
const getClientPhrase = () =>
  phrases[Math.floor(Math.random() * phrases.length)];
const getServerPhrase = () => "\u00A0";

export default function FooterPhrase() {
  const phrase = useSyncExternalStore(
    emptySubscribe,
    getClientPhrase,
    getServerPhrase,
  );
  return <>{phrase}</>;
}
