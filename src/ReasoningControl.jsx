import { useRef, useState } from "react";
import { ChevronDown, RotateCcw, Zap } from "lucide-react";
import { EFFORT_LEVELS, EFFORTS, EFFORT_FORMS, FORMS } from "../desktop/forms.mjs";
import "./reasoning.css";
import { EffortAnimation } from './EffortAnimation.jsx';

const DEFAULT_EFFORT = "high";
const ENGLISH_EFFORTS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "X-High",
  max: "Max",
  ultra: "Ultra",
};
const PREVIEW_MODELS = [
  { name: "GPT-6.1-Sol", levels: EFFORT_LEVELS },
  { name: "GPT-6-Astra", levels: EFFORT_LEVELS },
  { name: "GPT-6.1 Terra", levels: EFFORT_LEVELS },
  { name: "GPT-6-Luna", levels: EFFORT_LEVELS.filter(level => level !== "ultra") },
];

export function FormPortrait({ index, atlas, className = "" }) {
  const form = FORMS[index];
  return <span className={"form-portrait " + className + (atlas ? " has-art" : "")} aria-hidden="true"
    style={{
      "--portrait-x": form.x, "--portrait-y": form.y, "--portrait-color": form.color,
      ...(atlas ? { "--portrait-atlas": "url(" + atlas + ")" } : {}),
    }}>{atlas ? null : <Zap size={13} />}</span>;
}

export function ReasoningControl() {
  const [{ model, selected }, setPreview] = useState({
    model: PREVIEW_MODELS[0],
    selected: DEFAULT_EFFORT,
  });
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const effort = EFFORTS[selected];
  const position = model.levels.indexOf(selected);

  function select(next) {
    setPreview(state => next === state.selected ? state : { ...state, selected: next });
  }

  function selectModel(event) {
    const nextModel = PREVIEW_MODELS.find(item => item.name === event.target.value);
    setPreview(state => {
      if (nextModel.levels.includes(state.selected)) return { ...state, model: nextModel };
      return { model: nextModel, selected: nextModel.levels.at(-1) };
    });
  }

  return <div className="reasoning-control" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="reasoning-trigger" aria-expanded={open}
      aria-label={"推理强度：" + effort.label} onClick={() => setOpen(!open)}>
      <Zap size={14} aria-hidden="true" />
      <span>{effort.label}</span><ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && <section className="reasoning-popover" aria-label="推理强度预览">
      <header className="reasoning-header">
        <div className="reasoning-model-picker">
          <select aria-label="切换预览模型" value={model.name} onChange={selectModel}>
            {PREVIEW_MODELS.map(item => <option key={item.name}>{item.name}</option>)}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </div>
        <b className="reasoning-state" aria-live="polite">{effort.label}</b>
        <button type="button" className="icon-button" aria-label="恢复默认推理强度" onClick={() => select(DEFAULT_EFFORT)}><RotateCcw size={15} /></button>
      </header>
      <div className="reasoning-stage" aria-hidden="true" style={{
        "--effort-color": EFFORT_FORMS[effort.form].color,
      }}>
        <div className="reasoning-floor" />
        <EffortAnimation form={effort.form} />
      </div>
      <input className="reasoning-range" type="range" min={0} max={model.levels.length - 1} value={position}
        aria-label="推理强度档位" aria-valuetext={effort.label}
        onChange={event => select(model.levels[Number(event.target.value)])} />
      <div className="reasoning-marks">
        {model.levels.map(key => <button key={key} type="button" lang="en" aria-pressed={key === selected} onClick={() => select(key)}>{ENGLISH_EFFORTS[key]}</button>)}
      </div>
    </section>}
  </div>;
}

