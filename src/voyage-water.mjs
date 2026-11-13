const TAU = Math.PI * 2;
const fract = (value) => value - Math.floor(value);

// Keep the wave field stable between frames. The motion comes from changing phase.
function noise(index) {
  return fract(Math.sin(index * 91.73 + 17.19) * 17353.1);
}

const ribbons = Array.from({ length: 25 }, (_, row) => {
  const depth = ((row + 0.45 + noise(row + 7) * 0.6) / 24) ** 1.52;
  return {
    depth,
    phase: row * 0.31 + noise(row + 1) * 1.4,
    segments: Array.from({ length: Math.round(12 - depth * 5) }, (_, segment) => ({
      position: segment + noise(row * 17 + segment) * 0.84,
      length: 0.33 + noise(row * 23 + segment + 23) * 0.62,
      opacity: noise(row * 27 + segment + 52),
    })),
  };
});

export function hullMotion(seconds, width) {
  const surge = seconds * 2.9;
  return {
    heave: (Math.sin(surge) + Math.sin(surge * 1.64 + 1.2) * 0.25) * Math.min(5, width * 0.019),
    roll: Math.cos(surge + 0.8) * 1.6 + Math.sin(surge * 0.57) * 0.45,
  };
}

export function paintVoyageWater(ctx, width, height, seconds, ship) {
  ctx.clearRect(0, 0, width, height);
  let wakePainted = false;

  for (const { depth, phase, segments } of ribbons) {
    if (!wakePainted && depth * height > ship.y) {
      paintWake(ctx, seconds, ship);
      wakePainted = true;
    }
    const span = width / segments.length;
    const amplitude = Math.min(11, height * 0.035) * (0.12 + depth * 0.88);
    const frequency = TAU / Math.max(110, width * (0.18 + depth * 0.37));
    const drift = seconds * (6 + depth * 36);
    const center = depth * height;
    const curve = (x) => center + amplitude * (
      Math.sin((x + drift) * frequency + phase)
      + Math.sin((x + drift * 0.72) * frequency * 2.08 + phase * 1.7) * 0.27
    );

    for (const segment of segments) {
      const length = span * segment.length;
      const left = fract((segment.position * span + seconds * (9 + depth * 31)) / width + length / width) * width - length;
      const right = left + length;
      if (right < 0 || left > width) continue;
      const thickness = Math.min(11, height * 0.035) * (0.13 + depth * 0.87);
      const points = [];
      const steps = Math.min(15, Math.max(5, Math.ceil(length / 14)));
      for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        const x = left + length * progress;
        points.push([x, curve(x), Math.sin(progress * Math.PI) ** 1.2 * thickness]);
      }
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      for (let i = points.length - 1; i >= 0; i--) {
        const [x, y, taper] = points[i];
        ctx.lineTo(x, y + taper);
      }
      ctx.closePath();
      ctx.fillStyle = segment.opacity < 0.34
        ? `rgba(9, 64, 108, ${0.07 + depth * 0.14})`
        : `rgba(130, 221, 238, ${0.11 + depth * 0.25})`;
      ctx.fill();

      if (segment.opacity < 0.47) continue;
      ctx.beginPath();
      ctx.moveTo(points[1][0], points[1][1]);
      const limit = Math.floor(steps * (0.42 + segment.opacity * 0.48));
      for (let i = 2; i <= limit; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.lineWidth = 0.45 + depth * (0.8 + segment.opacity * 0.9);
      ctx.lineCap = "round";
      const sparkle = 0.62 + Math.sin(seconds * 1.95 + phase + segment.position * 2.3) * 0.38;
      ctx.strokeStyle = `rgba(227, 252, 255, ${(0.2 + depth * 0.42) * sparkle})`;
      ctx.stroke();
    }
  }
  if (!wakePainted) paintWake(ctx, seconds, ship);
}

function paintWake(ctx, seconds, { x, y, width }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width, width);

  // The low, dark contact patch under the keel anchors the cutout in the sea.
  const contact = ctx.createLinearGradient(0, -0.04, 0, 0.09);
  contact.addColorStop(0, "#0e4a6d66");
  contact.addColorStop(1, "#0e4a6d00");
  ctx.fillStyle = contact;
  ctx.beginPath();
  ctx.ellipse(-0.04, 0.017, 0.42, 0.039, 0, 0, TAU);
  ctx.fill();

  ctx.lineCap = "round";
  for (const side of [-1, 1]) {
    // The two diverging arms thin out into short, receding streaks.
    for (let i = 0; i < 8; i++) {
      const age = fract(seconds * 0.59 + i / 8);
      const dx = 0.30 - 1.53 * age;
      const dy = side * (0.012 + age ** 1.22 * 0.19);
      const alpha = (1 - age) * (0.42 + noise(i + side) * 0.28);
      ctx.beginPath();
      ctx.moveTo(dx + 0.04, dy - 0.014);
      ctx.bezierCurveTo(dx - 0.02, dy + 0.015, dx - 0.09, dy - 0.021, dx - 0.16 - age * 0.08, dy + 0.01);
      ctx.strokeStyle = `rgba(233, 252, 255, ${alpha})`;
      ctx.lineWidth = 0.004 + (1 - age) * 0.014;
      ctx.stroke();
    }
  }

  for (let i = 0; i < 28; i++) {
    const age = fract(seconds * (0.68 + noise(i + 22) * 0.30) + noise(i + 4));
    const dx = 0.38 - age * (0.31 + noise(i + 9) * 0.91);
    const dy = 0.019 + age * 0.16 * (noise(i + 37) - 0.27);
    const radius = (1 - age) * (0.005 + noise(i + 17) * 0.01);
    ctx.fillStyle = `rgba(239, 253, 255, ${(1 - age) * 0.71})`;
    ctx.beginPath();
    ctx.ellipse(dx, dy, radius * 1.8, radius * 0.45, -0.12, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
