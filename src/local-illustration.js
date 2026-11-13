import { useEffect, useState } from "react";
import { CHAPTER_BOARDS } from "./chapter-art.mjs";

const localVoyage = "/local-themes/voyage/";

export function useLocalIllustration(name) {
  const [asset, setAsset] = useState("");
  useEffect(() => {
    if (!import.meta.env.DEV && !window.moonlight) return;
    const image = new Image();
    image.onload = () => setAsset(image.src);
    image.src = localVoyage + name + ".png";
    return () => { image.onload = null; };
  }, [name]);
  return asset;
}

export function useChapterArt() {
  const [art, setArt] = useState({});
  useEffect(() => {
    if (!import.meta.env.DEV && !window.moonlight) return;
    const pending = CHAPTER_BOARDS.map(file => {
      const image = new Image();
      image.onload = () => setArt(previous => ({ ...previous, [file]: image.src }));
      image.src = localVoyage + file;
      return image;
    });
    return () => { pending.forEach(image => { image.onload = null; }); };
  }, []);
  return art;
}
