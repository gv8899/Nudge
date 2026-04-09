export function LandingPhilosophy() {
  return (
    <section className="py-32 md:py-40 px-6 md:px-12 border-t border-border text-center">
      <div className="max-w-4xl mx-auto">
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
          我想要一個不催促的工具，
          <br />
          它在我打開的時候才存在。
        </blockquote>
        <div className="mt-8 text-xs tracking-[0.15em] uppercase text-text-dim">
          — NUDGE 的設計哲學
        </div>
      </div>
    </section>
  );
}
