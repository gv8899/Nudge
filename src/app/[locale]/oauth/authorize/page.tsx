import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirectUriMatches } from "@/lib/oauth/core";
import { createAuthorizationCode, oauthBaseUrl, resolveClient } from "@/lib/oauth/store";
import { mcpResourceUrl } from "@/lib/oauth/metadata";

/**
 * OAuth 授權同意頁：AI 服務（Claude / ChatGPT…）要求連接 Nudge 時，使用者
 * 在這裡登入並按「允許」。允許 → 發一次性授權碼、導回 AI 服務的 redirect_uri。
 *
 * 安全：表單只帶原始 query string，按下後在 server action 內**重新驗證全部
 * 參數**，不信任任何隱藏欄位的其他值。
 */

type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string | null;
  resource: string | null;
};

type Validation =
  | { kind: "ok"; params: AuthorizeParams; clientName: string | null }
  // client / redirect_uri 不可信 → 不能導回去，只能在本頁顯示錯誤
  | { kind: "fatal" }
  // client 可信但請求有誤 → 依規格導回 redirect_uri 帶 error
  | { kind: "redirect_error"; redirectUri: string; state: string | null; error: string };

async function validate(query: URLSearchParams): Promise<Validation> {
  const clientId = query.get("client_id");
  const redirectUri = query.get("redirect_uri");
  if (!clientId || !redirectUri) return { kind: "fatal" };
  const client = await resolveClient(clientId);
  if (!client || !redirectUriMatches(redirectUri, client.redirectUris)) return { kind: "fatal" };

  const state = query.get("state");
  const fail = (error: string): Validation => ({ kind: "redirect_error", redirectUri, state, error });
  if (query.get("response_type") !== "code") return fail("unsupported_response_type");
  const codeChallenge = query.get("code_challenge");
  if (!codeChallenge || query.get("code_challenge_method") !== "S256") return fail("invalid_request");
  const resource = query.get("resource");
  if (resource && resource.replace(/\/$/, "") !== mcpResourceUrl() && resource.replace(/\/$/, "") !== oauthBaseUrl()) {
    return fail("invalid_target");
  }
  return {
    kind: "ok",
    clientName: client.clientName,
    params: { clientId, redirectUri, state, codeChallenge, scope: query.get("scope"), resource },
  };
}

function withParams(uri: string, params: Record<string, string | null>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== null) u.searchParams.set(k, v);
  return u.toString();
}

async function currentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

async function decide(formData: FormData) {
  "use server";
  const query = new URLSearchParams(String(formData.get("query") ?? ""));
  const v = await validate(query);
  if (v.kind === "fatal") redirect("/");
  if (v.kind === "redirect_error") {
    redirect(withParams(v.redirectUri, { error: v.error, state: v.state }));
  }
  const user = await currentUser();
  if (!user) redirect("/");
  const { params } = v;
  if (formData.get("decision") !== "allow") {
    redirect(withParams(params.redirectUri, { error: "access_denied", state: params.state }));
  }
  const code = await createAuthorizationCode({
    clientId: params.clientId,
    userId: user.id,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: params.scope,
    resource: params.resource,
  });
  redirect(withParams(params.redirectUri, { code, state: params.state, iss: oauthBaseUrl() }));
}

export default async function AuthorizePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "oauth" });

  const raw = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") query.set(k, v);

  const v = await validate(query);
  if (v.kind === "redirect_error") {
    redirect(withParams(v.redirectUri, { error: v.error, state: v.state }));
  }

  // 沒登入才導去登入頁；有 session 卻對不到使用者就停在本頁（避免與登入頁互相導來導去）。
  if (v.kind === "ok" && !(await auth())?.user) {
    const next = `/${locale}/oauth/authorize?${query.toString()}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }
  const user = v.kind === "ok" ? await currentUser() : null;

  const clientName = v.kind === "ok" ? (v.clientName ?? t("unknownClient")) : "";
  const host = v.kind === "ok" ? new URL(v.params.redirectUri).host : "";

  return (
    // data-landing：沿用行銷頁的暖米色 token（不寫死色碼）
    <div
      data-landing
      className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <Image
            src="/nudge-icon.png"
            alt="Nudge"
            width={64}
            height={64}
            priority
            className="mx-auto rounded-2xl shadow-md"
          />
          {v.kind === "fatal" || !user ? (
            <>
              <h1 className="text-2xl font-semibold text-foreground">{t("errorTitle")}</h1>
              <p className="text-text-dim">{t("errorBody")}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-foreground">
                {t("title", { client: clientName })}
              </h1>
              <p className="text-text-dim">{t("subtitle", { client: clientName })}</p>
            </>
          )}
        </div>

        {v.kind === "ok" && user && (
          <>
            <div className="rounded-2xl border border-border bg-[var(--surface)] p-5 space-y-4 text-sm text-foreground">
              <p className="text-text-dim">{t("account", { email: user.email })}</p>
              <div className="space-y-2">
                <p className="font-medium">{t("permissionsTitle", { client: clientName })}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t("permRead")}</li>
                  <li>{t("permCreate")}</li>
                  <li>{t("permChange")}</li>
                </ul>
              </div>
              <p className="text-text-dim">{t("redirectNotice", { host })}</p>
            </div>

            <form action={decide} className="flex gap-3">
              <input type="hidden" name="query" value={query.toString()} />
              <button
                type="submit"
                name="decision"
                value="deny"
                className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-[var(--surface)] transition-colors"
              >
                {t("deny")}
              </button>
              <button
                type="submit"
                name="decision"
                value="allow"
                className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow hover:opacity-90 transition-opacity"
              >
                {t("allow")}
              </button>
            </form>

            <p className="text-center text-xs text-text-dim">{t("revokeHint")}</p>
          </>
        )}
      </div>
    </div>
  );
}
