import { useEffect, useRef } from "react";

const WIDTH = 180;
const HEIGHT = 205;
const radians = Math.PI / 180;
const parts = {
  head: [9, 82, 383, 337], body: [436, 105, 284, 342],
  arm: [888, 115, 121, 299], hand: [1270, 119, 129, 304],
  thigh: [88, 616, 201, 328], foot: [462, 609, 215, 334],
  mouth: [755, 589, 382, 344], eyes: [1141, 588, 386, 343],
};

function poseFor(kind, time) {
  const breath = Math.sin(time * 2.7);
  const pose = { x: 0, y: breath * .7, lean: breath, scale: 1 + breath * .014,
    head: -breath * 1.6, farArm: -12, farElbow: -16, arm: 14, elbow: -18,
    farLeg: 4, farKnee: -4, leg: -5, knee: 4, open: 0, eyes: 0 };
  if (kind === "walk") {
    const step = Math.sin(time * 10.8);
    Object.assign(pose, { y: -Math.abs(step) * 4, lean: 8, head: -6 + step * 2,
      farArm: step * 34 - 8, farElbow: -25, arm: -step * 35 + 5, elbow: -26,
      farLeg: -step * 30, farKnee: Math.max(0, -step) * 42,
      leg: step * 30, knee: Math.max(0, step) * 42 });
  } else if (kind === "wave") {
    Object.assign(pose, { arm: -112, elbow: -43 + Math.sin(time * 18) * 26, head: -9, lean: 4 });
  } else if (kind === "stretch") {
    Object.assign(pose, { y: -4, scale: 1.07, arm: -144, elbow: -15, farArm: 148, farElbow: 26, head: -9, eyes: .9 });
  } else if (kind === "jump") {
    const t = Math.min(1, time / .9);
    Object.assign(pose, { y: -Math.sin(t * Math.PI) * 41, lean: 9, arm: -93, farArm: 71,
      leg: -24, farLeg: 31, knee: 43, farKnee: 33 });
  } else if (kind === "sleep") {
    Object.assign(pose, { x: -22, y: 35, lean: -66, head: -10, eyes: 1, arm: -34, elbow: -78,
      farArm: -39, farElbow: -60, leg: -53, knee: 104, farLeg: -44, farKnee: 93 });
  } else if (["drool", "sniff", "morph"].includes(kind)) {
    Object.assign(pose, { x: 7, lean: 13, head: 3 + breath * 3, arm: -16, elbow: -34, open: .22 });
  } else if (kind === "bite" || kind === "eat") {
    const chew = Math.max(0, Math.sin(time * 22));
    Object.assign(pose, { x: kind === "bite" ? 12 : 2, lean: kind === "bite" ? 17 : 3,
      head: -9 + chew * 12, open: kind === "bite" ? 1 : chew * .74,
      arm: -84, elbow: -63, farArm: -45, farElbow: -42 });
  } else if (kind === "happy") {
    Object.assign(pose, { y: -Math.abs(Math.sin(time * 8)) * 6, head: -10, arm: -88, farArm: 62, open: .55 });
  } else if (time % 4.7 > 4.52) {
    pose.eyes = .85;
  }
  return pose;
}

function paint(ctx, atlas, pose, direction, kind, time) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.fillStyle = "rgba(17, 11, 28, .24)";
  ctx.beginPath();
  ctx.ellipse(90, 194, kind === "sleep" ? 54 : 30, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(90, 131);
  ctx.scale(direction, 1);
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.lean * radians);
  ctx.scale(1 / pose.scale, pose.scale);

  function part(name, x, y, width, height) {
    ctx.drawImage(atlas, ...parts[name], x, y, width, height);
  }
  function limb(x, y, angle, bend, upper, lower, length, far = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * radians);
    if (far) ctx.filter = "brightness(.83)";
    if (upper === "arm") part(upper, -8, -4, 16, 27);
    else part(upper, -11, -4, 22, 34);
    ctx.translate(0, length);
    ctx.rotate(bend * radians);
    if (lower === "hand") part(lower, -6, -4, 13, 24);
    else part(lower, -9, -5, 26, 36);
    ctx.restore();
  }
  limb(11, -32, pose.farArm, pose.farElbow, "arm", "hand", 17, true);
  limb(10, 1, pose.farLeg, pose.farKnee, "thigh", "foot", 26, true);
  limb(-9, 2, pose.leg, pose.knee, "thigh", "foot", 26);
  part("body", -25, -48, 51, 58);
  limb(-17, -30, pose.arm, pose.elbow, "arm", "hand", 17);
  ctx.translate(0, -42);
  ctx.rotate(pose.head * radians);
  part("head", -51, -76, 106, 91);
  if (pose.open > .02 || pose.eyes > .02) {
    ctx.globalAlpha = Math.max(pose.open, pose.eyes);
    part(pose.eyes > pose.open ? "eyes" : "mouth", -51, -76, 106, 91);
    ctx.globalAlpha = 1;
  }
  if (kind === "drool") {
    const drop = (time * 1.8) % 1;
    ctx.strokeStyle = "#a9efff";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(32, 4);
    ctx.quadraticCurveTo(39, 13, 37, 11 + drop * 11);
    ctx.stroke();
    ctx.fillStyle = "#c2f6ff";
    ctx.beginPath();
    ctx.ellipse(37, 13 + drop * 15, 2.4, 3.8, .16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function PetMotion({ atlas, kind, direction, motion }) {
  const canvas = useRef(null);
  const action = useRef({ kind, direction, started: 0 });
  useEffect(() => {
    action.current = { kind, direction, started: performance.now() };
  }, [kind, direction]);

  useEffect(() => {
    const surface = canvas.current;
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    const image = new Image();
    let handle;
    let lastTime;
    let pose;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    function animate(now) {
      const { kind, direction, started } = action.current;
      const elapsed = motion ? (now - started) / 1000 : 0;
      const next = poseFor(kind, elapsed);
      const blend = motion && lastTime ? 1 - Math.exp(-(now - lastTime) / 62) : 1;
      if (!pose) pose = next;
      else for (const key of Object.keys(next)) pose[key] += (next[key] - pose[key]) * blend;
      lastTime = now;
      paint(ctx, image, pose, direction, kind, elapsed);
      if (motion) handle = requestAnimationFrame(animate);
    }
    image.onload = () => { handle = requestAnimationFrame(animate); };
    image.src = atlas;
    return () => { image.onload = null; cancelAnimationFrame(handle); };
  }, [atlas, motion, motion ? null : kind, motion ? null : direction]);

  return <canvas className="pet-motion" ref={canvas} width={WIDTH * 2} height={HEIGHT * 2} aria-hidden="true" />;
}
