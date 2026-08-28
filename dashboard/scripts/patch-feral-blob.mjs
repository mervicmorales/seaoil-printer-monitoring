import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve("node_modules/feral-blob/dist/feral-blob.js");
const declarationTarget = resolve(
  "node_modules/feral-blob/dist/JellyBlobMascot.d.ts",
);

const replacements = [
  [
    `function JellyBlobMascot({ mood = "neutral", className, onOverpoke, happyEyes = "star", gaze = { x: 0, y: 0 }, mouth, nod = false }) {
  const reduce = useReducedMotion();`,
    `function JellyBlobMascot({ mood = "neutral", className, onOverpoke, happyEyes = "star", gaze = { x: 0, y: 0 }, mouth, nod = false, respectReducedMotion = true }) {
  const systemReducedMotion = useReducedMotion();
  const reduce = respectReducedMotion && systemReducedMotion;`,
  ],
  [
    'jsx(MotionConfig, { reducedMotion: "user", children:',
    'jsx(MotionConfig, { reducedMotion: respectReducedMotion ? "user" : "never", children:',
  ],
  [
    `  const armRest = useRef(null);
  if (!armRest.current) {
    const p = ARM_REST_POSES[Math.floor(Math.random() * ARM_REST_POSES.length)];
    armRest.current = {
      left: \`translate(\${p.l.dx} \${p.l.dy}) rotate(\${p.l.rot} \${LEFT_ARM_PIVOT})\`,
      right: \`translate(\${p.r.dx} \${p.r.dy}) rotate(\${p.r.rot} \${RIGHT_ARM_PIVOT})\`
    };
  }`,
    `  const armRest = useRef(null);
  if (!armRest.current) {
    let poseSeed = 0;
    for (const character of uid) poseSeed = (poseSeed * 31 + character.charCodeAt(0)) >>> 0;
    const p = ARM_REST_POSES[poseSeed % ARM_REST_POSES.length];
    armRest.current = {
      left: \`translate(\${p.l.dx} \${p.l.dy}) rotate(\${p.l.rot} \${LEFT_ARM_PIVOT})\`,
      right: \`translate(\${p.r.dx} \${p.r.dy}) rotate(\${p.r.rot} \${RIGHT_ARM_PIVOT})\`
    };
  }`,
  ],
  [
    'transition: { type: "spring", stiffness: 220, damping: 9, mass: 0.7 }',
    'transition: { duration: 0.58, ease: "easeOut" }',
  ],
  [
    'transition: { delay: 0.05, type: "spring", stiffness: 220, damping: 9, mass: 0.7 }',
    'transition: { delay: 0.05, duration: 0.58, ease: "easeOut" }',
  ],
  [
    'transition: { delay: 0.1, type: "spring", stiffness: 210, damping: 11, mass: 0.8 }',
    'transition: { delay: 0.1, duration: 0.54, ease: "easeOut" }',
  ],
  [
    'transition: { delay: 0.12, type: "spring", stiffness: 210, damping: 11, mass: 0.8 }',
    'transition: { delay: 0.12, duration: 0.54, ease: "easeOut" }',
  ],
  [
    'happy: { y: [0, -16, -5, -9], rotate: [0, -1.5, 0], ty: { delay: 0.1, type: "spring", stiffness: 200, damping: 11, mass: 0.8 }, tr: { delay: 0.1, type: "spring", stiffness: 180, damping: 14 } }',
    'happy: { y: [0, -16, -5, -9], rotate: [0, -1.5, 0], ty: { delay: 0.1, duration: 0.54, ease: "easeOut" }, tr: { delay: 0.1, duration: 0.48, ease: "easeOut" } }',
  ],
];

let source = await readFile(target, "utf8");
let changed = false;

for (const [invalidTransition, validTransition] of replacements) {
  if (source.includes(validTransition)) continue;
  if (!source.includes(invalidTransition)) {
    throw new Error(
      "feral-blob changed upstream; review the Motion keyframe compatibility patch before continuing.",
    );
  }
  source = source.replace(invalidTransition, validTransition);
  changed = true;
}

if (changed) {
  await writeFile(target, source, "utf8");
  console.log("Applied feral-blob Motion keyframe compatibility patch.");
}

const declarationReplacement = [
  `    /** Subtle talking wobble for host-driven moments like typing into a watched field. */
    nod?: boolean;`,
  `    /** Subtle talking wobble for host-driven moments like typing into a watched field. */
    nod?: boolean;
    /** Honor the device's reduced-motion preference. Defaults to true. */
    respectReducedMotion?: boolean;`,
];

let declarations = await readFile(declarationTarget, "utf8");
if (!declarations.includes(declarationReplacement[1])) {
  if (!declarations.includes(declarationReplacement[0])) {
    throw new Error(
      "feral-blob changed upstream; review the reduced-motion type patch before continuing.",
    );
  }
  declarations = declarations.replace(...declarationReplacement);
  await writeFile(declarationTarget, declarations, "utf8");
  console.log("Applied feral-blob reduced-motion type patch.");
}
