import { useEffect, useRef, useState } from "react";
import { Compass, SkipForward } from "lucide-react";
import { VoyageScenery } from "./VoyageScenery.jsx";
import { CHAPTER_ART, CHAPTER_WIDE_ART } from "./chapter-art.mjs";
import { BOOT_MS, VOYAGE, voyageFrame } from "./voyage.mjs";
import { hullMotion, paintVoyageWater } from "./voyage-water.mjs";
import "./voyage.css";

export function BootScene({ startedAt, ships, refinedShips = ships?.endsWith("/ships-v2.png"), chapterArt, onSkip }) {
  const stage = useRef(null);
  const water = useRef(null);
  const hull = useRef(null);
  const skip = useRef(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapter = VOYAGE[chapterIndex];
  const previous = VOYAGE[chapterIndex - 1];
  const art = chapterArt[CHAPTER_ART[chapter.id].file];

  useEffect(() => {
    skip.current?.focus();
    const surface = stage.current;
    const canvas = water.current;
    const context = canvas.getContext("2d");
    let width, height, waterline, shipWidth;
    let lastWaterFrame;
    let frame;
    let index = 0;
    function drawWater() {
      if (!context || !width || !height || !shipWidth || !lastWaterFrame) return;
      const { seconds, shipX, heave } = lastWaterFrame;
      paintVoyageWater(context, width, height, seconds, {
        x: width * shipX / 100, y: waterline + heave, width: shipWidth,
      });
    }
    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      waterline = hull.current.offsetTop - canvas.offsetTop;
      shipWidth = hull.current.offsetWidth;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawWater();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    function draw(now) {
      const elapsed = now - startedAt;
      const current = voyageFrame(elapsed);
      const seconds = Math.min(BOOT_MS, Math.max(0, elapsed)) / 1000;
      const { heave, roll } = hullMotion(seconds, shipWidth);
      surface.style.setProperty("--ship-x", current.shipX + "%");
      surface.style.setProperty("--sunny", current.sunnyMix);
      surface.style.setProperty("--progress", current.progress);
      surface.style.setProperty("--ship-heave", heave + "px");
      surface.style.setProperty("--ship-roll", roll + "deg");
      lastWaterFrame = { seconds, shipX: current.shipX, heave };
      drawWater();
      if (index !== current.index) {
        index = current.index;
        setChapterIndex(index);
      }
      if (elapsed < BOOT_MS) frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [startedAt]);

  return (
    <section ref={stage} className={"boot-scene voyage" + (art ? " voyage-illustrated" : "")} role="dialog" aria-modal="true" aria-label="草帽团航海启动动画">
      <div className="voyage-world" aria-hidden="true">
        <div className="voyage-sun" />
        <div className="voyage-clouds" />
        {art ? <div className="voyage-painting" data-chapter={chapter.id}>
          <ChapterPlate key={chapter.id} id={chapter.id} art={chapterArt} />
        </div> : <svg className="voyage-islands" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
          {previous && <VoyageScenery scene={previous.id} />}
          <g key={chapter.id} className={previous ? "voyage-chapter-layer" : undefined}><VoyageScenery scene={chapter.id} /></g>
        </svg>}
        <div className="voyage-sea" />
        <canvas ref={water} className="voyage-water" />
        <div ref={hull} className={"voyage-ship" + (refinedShips ? " voyage-ship-refined" : "")}>
          {ships
            ? <><i className="ship-sprite merry" style={{backgroundImage:'url("'+ships+'")'}} /><i className="ship-sprite sunny" style={{backgroundImage:'url("'+ships+'")'}} /></>
            : <><Sailboat /><Sailboat sunny /></>}
        </div>
        <svg className="voyage-bow-spray" viewBox="0 0 160 24">
          <path d="M155 5c-12 0-12 6-23 7s-15-4-24 1m43 0c-12-1-16 5-31 4m-25 1c-12 3-22 0-29 1m-14 1c-10-1-20 1-27 1" />
          <path d="M148 5c4-3 6-3 9-3m-18 5 4-2" />
        </svg>
      </div>

      <div className="voyage-interface">
        <div className="voyage-brand">
          <Compass size={22} strokeWidth={1.5} />
          <span>CODEX</span>
          <span className="voyage-divider" />
          <span>航海日志</span>
        </div>
        <div className="voyage-compass" aria-hidden="true">N <Compass size={36} strokeWidth={1} /></div>
        <div className="voyage-caption" key={chapter.id}>
          {chapter.detour && <div className="voyage-kicker">船员分散 · 回顾</div>}
          <h2>{chapter.title}</h2>
          <p>{chapter.detail}</p>
        </div>
        <div className="voyage-footer">
          <div className="voyage-track" aria-hidden="true">
            <div className="voyage-track-label"><span>东海</span><span>新世界</span></div>
            <div className="voyage-track-line"><i /></div>
          </div>
          <button ref={skip} className="boot-skip" onClick={onSkip}><SkipForward size={15} /> 跳过 <kbd>Esc</kbd></button>
        </div>
      </div>
    </section>
  );
}

function ChapterPlate({ id, art }) {
  const wide = CHAPTER_WIDE_ART[id];
  const hasWide = wide && art[wide.file];
  const frames = hasWide ? [CHAPTER_ART[id], wide] : [CHAPTER_ART[id]];
  return <div className={"voyage-shot" + (hasWide ? " has-wide" : "")}>
    {frames.map(({ file, viewBox, width, height }, index) =>
      <svg key={file} className={"voyage-plate" + (index ? " wide" : "")} viewBox={viewBox} preserveAspectRatio="xMidYMid slice">
        <image href={art[file]} width={width} height={height} preserveAspectRatio="none" />
      </svg>)}
  </div>;
}

function Sailboat({ sunny = false }) {
  return <svg className={"ship-fallback " + (sunny ? "sunny" : "merry")} viewBox="0 0 160 200" aria-hidden="true">
    <path d={sunny ? "M10 154h147l-18 28H27Z" : "M17 158h136l-28 22H39Z"} fill="#75584c" />
    <path d="M16 157h137m-81-2V52m40 103V76" fill="none" stroke="#a5896f" strokeWidth="5" />
    <path d={sunny ? "M25 64h75q-12 40 0 74H25q16-42 0-74Zm73 23h44q-10 30 0 58H98Z" : "M36 65h80q-16 40 0 77H36q13-37 0-77Z"} fill="#fbfbec" stroke="#839dad" strokeWidth="2" />
    <path d="M72 55V39l32 9-32 7" fill={sunny ? "#6a98b2" : "#af8c76"} />
    <path d="M40 167h86" stroke="#dbb99c" strokeWidth="3" />
  </svg>;
}
