import { getTranslations } from "next-intl/server";
import { SettingsContent } from "@/components/settings/settings-content";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });

  return (
    <div className="max-w-[720px] mx-auto px-4 md:px-6 py-8">
      <h1 className="text-column-detail-title text-foreground mb-6">{t("title")}</h1>
      <SettingsContent />
    </div>
  );
}
