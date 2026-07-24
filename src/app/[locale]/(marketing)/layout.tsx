import { LandingNav } from "@/components/landing/landing-nav";

/**
 * 行銷／法務頁共用外框：全局 header（LandingNav）+ 暖米色 landing 色系。
 * 涵蓋 pricing / download / privacy / terms / refund。
 * 首頁 (/) 不在此 group，其 header 由 LandingPage 自帶。
 * App 頁在 [locale]/(app) 下，不套此外框。
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-landing
      className="min-h-screen flex flex-col bg-background text-foreground"
    >
      <LandingNav />
      {children}
    </div>
  );
}
