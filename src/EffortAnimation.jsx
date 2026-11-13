import { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import { createEffortPlayer, effortAnimationSources } from './effort-animation.mjs';

const sources = effortAnimationSources();

export function EffortAnimation({ form }) {
  const surface = useRef(null);
  const player = useRef(null);
  const initial = useRef(form);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const instance = createEffortPlayer(surface.current, sources, initial.current);
    player.current = instance;
    let alive = true;
    instance.ready.then(() => { if (alive) setReady(true); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; instance.destroy(); player.current = null; };
  }, []);
  useEffect(() => { player.current?.setTarget(form, Boolean(surface.current.closest('.reduce-motion'))); }, [form]);
  return <>
    <canvas ref={surface} className="effort-animation" aria-hidden="true" style={{ visibility: 'hidden' }} />
    {!ready && <Zap size={24} className="reasoning-stage-fallback" aria-label={failed ? '本地角色动画不可用' : '角色动画载入中'} />}
  </>;
}
