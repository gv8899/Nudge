import { InkSparkle } from "./landing-doodles";

export function LandingPhilosophy() {
  return (
    <section className="relative py-32 md:py-40 px-6 md:px-12 border-t border-border text-center overflow-hidden">
      {/* 裝飾墨點 — 左上角 */}
      <InkSparkle
        className="landing-twinkle absolute left-[12%] top-[22%] w-6 h-6 text-primary hidden md:block"
        style={{
          ["--twinkle-min" as string]: "0.3",
          ["--twinkle-max" as string]: "0.6",
          animationDelay: "0s",
        }}
      />
      {/* 裝飾墨點 — 右下角 */}
      <InkSparkle
        className="landing-twinkle absolute right-[14%] bottom-[28%] w-4 h-4 text-primary hidden md:block"
        style={{
          ["--twinkle-min" as string]: "0.35",
          ["--twinkle-max" as string]: "0.7",
          animationDelay: "0.9s",
        }}
      />
      {/* 裝飾墨點 — 左下小 */}
      <InkSparkle
        className="landing-twinkle absolute left-[22%] bottom-[20%] w-3 h-3 text-primary hidden md:block"
        style={{
          ["--twinkle-min" as string]: "0.2",
          ["--twinkle-max" as string]: "0.5",
          animationDelay: "1.6s",
        }}
      />
      {/* 裝飾墨點 — 右上角新增 */}
      <InkSparkle
        className="landing-twinkle absolute right-[20%] top-[35%] w-4 h-4 text-primary hidden md:block"
        style={{
          ["--twinkle-min" as string]: "0.25",
          ["--twinkle-max" as string]: "0.55",
          animationDelay: "2.2s",
        }}
      />

      <div className="relative max-w-4xl mx-auto">
        <div
          className="text-[80px] text-primary mb-5"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            lineHeight: 0.5,
          }}
          aria-hidden="true"
        >
          &ldquo;
        </div>
        <blockquote
          className="text-[32px] md:text-[42px] font-medium italic leading-[1.3] max-w-[760px] mx-auto text-foreground"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          工具該等你，
          <br />
          不是追你。
        </blockquote>
        <div className="mt-8 text-xs tracking-[0.15em] text-text-dim">
          — Nudge 的設計哲學
        </div>
      </div>
    </section>
  );
}
