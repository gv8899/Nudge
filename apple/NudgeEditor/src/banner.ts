// apple/NudgeEditor/src/banner.ts
//
// 編輯器內的錯誤橫幅（純 DOM、--nudge-* token）。同時只有一條，新訊息覆蓋舊的。
type BannerEl = HTMLElement & { __nudgeBannerTimer?: number };

export function showBanner(text: string, ms = 4000) {
  let el = document.querySelector<BannerEl>(".nudge-editor-banner");
  if (!el) {
    el = document.createElement("div") as BannerEl;
    el.className = "nudge-editor-banner";
    el.setAttribute("role", "alert");
    document.body.appendChild(el);
  }
  const target = el;
  target.textContent = text;
  target.classList.add("is-visible");
  window.clearTimeout(target.__nudgeBannerTimer);
  target.__nudgeBannerTimer = window.setTimeout(() => target.classList.remove("is-visible"), ms);
}
