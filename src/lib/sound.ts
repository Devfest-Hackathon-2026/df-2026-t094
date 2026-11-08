// 音のオン・オフ（BGM ボタンと効果音で共通）。最初はオン。オフにしたら localStorage に "off" を覚える
export const SOUND_KEY = "kotoba-robo-sound";

export function soundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

// 効果音（public/sound/{name}.mp3）。音がオフのときは鳴らさない
export function sfx(name: "success" | "fail") {
  if (!soundOn()) return;
  const a = new Audio(`/sound/${name}.mp3`);
  a.volume = 0.6;
  a.play().catch(() => {});
}
