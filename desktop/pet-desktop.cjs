const movesByVariant = require("./pet-moves.json");

const PET_WIDTH = 300;
const PET_HEIGHT = 450;
const FEED_INTERVAL = 60_000;
const MOUTH = { x: PET_WIDTH / 2 + 16, y: PET_HEIGHT - 101 };
// Match the floating character's 144 × 164 button, inset 9px from the bottom.
const BODY = { x: (PET_WIDTH - 144) / 2, y: PET_HEIGHT - 173, width: 144, height: 164 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const attackDelay = () => 11_000 + Math.random() * 16_000;

function containPet(x, y, area) {
  return {
    x: Math.round(clamp(x, area.x - BODY.x, area.x + area.width - BODY.x - BODY.width)),
    y: Math.round(clamp(y, area.y - BODY.y, area.y + area.height - BODY.y - BODY.height)),
  };
}

function petWindowOrigin(position, area) {
  return {
    x: clamp(position.x, area.x, Math.max(area.x, area.x + area.width - PET_WIDTH)),
    y: clamp(position.y, area.y, Math.max(area.y, area.y + area.height - PET_HEIGHT)),
  };
}

function feedingPosition(icon, area, bounds) {
  const centerX = bounds.x + PET_WIDTH / 2;
  const offset = 76 + (icon.size ?? 40) / 4;
  const placeRight = icon.x < area.x + offset + BODY.width / 2
    || (icon.x < area.x + area.width - offset - BODY.width / 2 && centerX > icon.x);
  return { ...containPet(icon.x + (placeRight ? offset : -offset) - PET_WIDTH / 2, icon.y - MOUTH.y, area),
    direction: placeRight ? -1 : 1 };
}

function createDesktopPet(window, screen, findIcons, origin = window.getBounds()) {
  let settings = { roam: true, feed: true, drool: true, food: "random", attacks: true, moves: [] };
  let paused = true;
  let visible = true;
  let drag;
  let lastDragMoved = false;
  let position = { x: origin.x, y: origin.y };
  let lastOffset;
  let nextMeal = Date.now() + FEED_INTERVAL;
  let nextRoam = Date.now() + 2500;
  let nextAttack = Date.now() + attackDelay();
  let sequence = 0;
  let busy = false;
  let moving;
  let lastIcon;
  let pendingClip;

  function show(kind, detail) {
    if (!window.isDestroyed()) window.webContents.send("moonlight:pet-scene", { kind, sequence, ...detail });
  }

  function sendPosition(force = false) {
    if (window.isDestroyed()) return;
    const bounds = window.getContentBounds();
    const offset = { x: position.x - bounds.x, y: position.y - bounds.y };
    if (force || offset.x !== lastOffset?.x || offset.y !== lastOffset?.y) {
      lastOffset = offset;
      window.webContents.send("moonlight:pet-position", offset);
    }
  }

  function setPosition(next, area) {
    if (window.isDestroyed()) return;
    position = next;
    const frame = petWindowOrigin(next, area);
    const bounds = window.getBounds();
    if (frame.x !== bounds.x || frame.y !== bounds.y || bounds.width !== PET_WIDTH || bounds.height !== PET_HEIGHT) {
      window.setBounds({ ...frame, width: PET_WIDTH, height: PET_HEIGHT }, false);
    }
    sendPosition();
  }

  function currentDisplay() {
    return screen.getDisplayNearestPoint({ x: position.x + PET_WIDTH / 2, y: position.y + MOUTH.y });
  }

  function followPointer(point = screen.getCursorScreenPoint()) {
    if (!drag || !visible) return;
    if (point.x === drag.last.x && point.y === drag.last.y) return;
    if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 4) return;
    drag.moved = true;
    drag.last = point;
    const area = screen.getDisplayNearestPoint(point).workArea;
    setPosition(containPet(point.x - drag.offsetX, point.y - drag.offsetY, area), area);
  }

  function releaseDrag() {
    if (!drag) return false;
    const moved = drag.moved;
    clearInterval(drag.timer);
    drag = undefined;
    lastDragMoved = moved;
    return moved;
  }

  function stop() {
    sequence++;
    if (pendingClip) { clearTimeout(pendingClip.timer); pendingClip.resolve(); pendingClip = undefined; }
    moving?.();
    busy = false;
    nextRoam = Date.now() + 2800;
    nextAttack = Date.now() + attackDelay();
  }

  function moveTo(x, y, area) {
    const from = position;
    const distance = Math.hypot(x - from.x, y - from.y);
    if (distance < 2) return Promise.resolve();
    const duration = Math.max(260, distance / 64 * 1000);
    const started = Date.now();
    return new Promise(resolve => {
      moving = () => {
        clearInterval(timer);
        moving = undefined;
        resolve();
      };
      const timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - started) / duration);
        // Match the full gait cycle: constant travel while the animation transfers weight.
        setPosition({ x: Math.round(from.x + (x - from.x) * t), y: Math.round(from.y + (y - from.y) * t) }, area);
        if (t === 1) moving();
      }, 16);
    });
  }

  async function roam() {
    if (busy || window.isDestroyed()) return;
    busy = true;
    const run = ++sequence;
    const from = position;
    const area = currentDisplay().workArea;
    const angle = Math.random() * Math.PI * 2;
    const distance = 105 + Math.random() * 125;
    let target = containPet(from.x + Math.cos(angle) * distance, from.y + Math.sin(angle) * distance, area);
    if (Math.hypot(target.x - from.x, target.y - from.y) < 30) {
      target = containPet(from.x - Math.cos(angle) * distance, from.y - Math.sin(angle) * distance, area);
    }
    const { x, y } = target;
    show("walk", { direction: x < from.x ? -1 : 1 });
    await moveTo(x, y, area);
    if (sequence !== run) return;
    busy = false;
    nextRoam = Date.now() + 4500 + Math.random() * 5000;
    show("idle");
  }

  async function feed(manual = false) {
    if (busy || window.isDestroyed()) return;
    busy = true;
    const run = ++sequence;
    if (!manual) nextMeal = Date.now() + FEED_INTERVAL;
    const start = position;
    const fromX = start.x + PET_WIDTH / 2;
    const fromY = start.y + MOUTH.y;
    const icons = await findIcons({ x: fromX, y: fromY }).catch(() => []);
    if (sequence !== run) return;
    const display = currentDisplay();
    const local = icons.filter(icon => screen.getDisplayNearestPoint(icon).id === display.id);
    const candidates = local.filter(icon => !lastIcon || icon.x !== lastIcon.x || icon.y !== lastIcon.y);
    const icon = (candidates.length ? candidates : local).sort((a, b) =>
      Math.hypot(a.x - fromX, a.y - fromY) - Math.hypot(b.x - fromX, b.y - fromY))[0];
    if (!icon && !manual) {
      busy = false;
      return;
    }

    let direction = 1;
    if (icon) {
      const spot = feedingPosition(icon, display.workArea, start);
      show("walk", { direction: spot.x < start.x ? -1 : 1 });
      await moveTo(spot.x, spot.y, display.workArea);
      if (sequence !== run) return;
      direction = spot.direction;
      lastIcon = icon;
    }
    const bounds = position;
    const snack = {
      x: icon ? icon.x - bounds.x : PET_WIDTH / 2 + 68,
      y: icon ? icon.y - bounds.y : MOUTH.y + 34,
      toX: direction < 0 ? PET_WIDTH - MOUTH.x : MOUTH.x,
      toY: MOUTH.y,
      food: settings.food === "random" ? (Math.random() < .66 ? "meat" : "cookie") : settings.food,
      icon: Boolean(icon),
      iconImage: icon?.image,
      iconSize: icon?.size,
    };
    const phases = settings.drool ? [["drool", 950]] : [["sniff", 460]];
    phases.push(["morph", 700], ["bite", 680], ["eat", 950], ["happy", 700]);
    for (const [kind, duration] of phases) {
      if (sequence !== run) return;
      show(kind, { direction, snack });
      await wait(duration);
    }
    if (sequence !== run) return;
    busy = false;
    nextRoam = Date.now() + 3400;
    show("idle");
  }

  async function attack(move) {
    if (!move || !visible || busy || drag || window.isDestroyed()) return;
    busy = true;
    const run = ++sequence;
    const { x, width } = currentDisplay().workArea;
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        if (pendingClip?.run === run) pendingClip = undefined;
        resolve();
      }, move.duration + 1200);
      pendingClip = { run, kind: move.id, resolve, timer };
      show(move.id, { direction: position.x + PET_WIDTH / 2 < x + width / 2 ? 1 : -1 });
    });
    if (sequence !== run) return;
    busy = false;
    nextRoam = Date.now() + 2800;
    nextAttack = Date.now() + attackDelay();
    show("idle");
  }

  const scheduler = setInterval(() => {
    if (!visible || paused || drag || busy) return;
    const now = Date.now();
    if (settings.feed && now >= nextMeal) void feed();
    else if (settings.attacks && settings.moves.length && now >= nextAttack) {
      void attack(settings.moves[Math.floor(Math.random() * settings.moves.length)]);
    }
    else if (settings.roam && now >= nextRoam) void roam();
  }, 250);

  return {
    finishAction(value) {
      if (!pendingClip || value?.sequence !== pendingClip.run || value.kind !== pendingClip.kind) return false;
      const pending = pendingClip; pendingClip = undefined;
      clearTimeout(pending.timer); pending.resolve();
      return true;
    },
    setVisible(next) {
      visible = next;
      if (!visible) {
        releaseDrag();
        stop();
        show("idle");
      } else {
        const area = currentDisplay().workArea;
        setPosition(containPet(position.x, position.y, area), area);
      }
    },
    drag(action, point) {
      if (action === "drag-end") {
        if (!drag) return lastDragMoved;
        followPointer(point);
        const moved = releaseDrag();
        nextRoam = Date.now() + 2800;
        nextAttack = Date.now() + attackDelay();
        return moved;
      }
      if (!visible) return;
      if (action === "drag-start") {
        const pointer = screen.getCursorScreenPoint();
        releaseDrag();
        lastDragMoved = false;
        stop();
        show("idle");
        drag = { start: pointer, last: pointer, offsetX: pointer.x - position.x, offsetY: pointer.y - position.y,
          moved: false, timer: setInterval(() => followPointer(), 16) };
      }
    },
    isDragging: () => Boolean(drag),
    isAtBody({ x, y }) {
      const left = position.x + BODY.x;
      const top = position.y + BODY.y;
      return x >= left && x < left + BODY.width && y >= top && y < top + BODY.height;
    },
    sync(value) {
      const variant = Object.hasOwn(movesByVariant, value?.variant) ? value.variant : "";
      const next = {
        roam: value?.roam === true, feed: value?.feed === true, drool: value?.drool === true,
        food: ["meat", "cookie"].includes(value?.food) ? value.food : "random",
        attacks: value?.attacks !== false,
        variant,
        moves: Array.isArray(value?.moves) ? (movesByVariant[variant] ?? []).filter(move => value.moves.includes(move.id)) : [],
      };
      if (next.feed !== settings.feed) nextMeal = Date.now() + FEED_INTERVAL;
      const shouldPause = value?.paused !== false;
      if ((!paused && shouldPause) || (settings.feed && !next.feed) || (settings.roam && !next.roam)
          || (settings.variant && settings.variant !== next.variant)) {
        stop();
        show("idle");
      }
      paused = shouldPause;
      settings = next;
    },
    menu() {
      stop();
      show("idle");
    },
    layout() { sendPosition(true); },
    action(action, value) {
      if (action === "walk") return roam();
      if (action === "feed") return feed(true);
      if (action === "attack") return attack(settings.moves.find(move => move.id === value));
      if (action === "stop") stop();
    },
    close() {
      releaseDrag();
      stop();
      clearInterval(scheduler);
    },
  };
}

module.exports = { createDesktopPet, containPet, petWindowOrigin, PET_WIDTH, PET_HEIGHT };
