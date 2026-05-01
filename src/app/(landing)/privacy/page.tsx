import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Nudge",
  description: "Nudge privacy policy and Google user data handling",
};

const APP_NAME = "Nudge";
const CONTACT_EMAIL = "gv88999@gmail.com";
const EFFECTIVE_DATE = "May 1, 2026";
const HOMEPAGE = "https://nudge.tw";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-text-dim mb-10">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">Overview</h2>
        <p>
          {APP_NAME} is a personal task-management tool that helps users focus
          on one day at a time. This Privacy Policy explains what information{" "}
          {APP_NAME} collects, how it is used, how it is protected, and the
          choices you have. This policy applies to the web application at{" "}
          <a href={HOMEPAGE} className="text-primary underline">
            {HOMEPAGE}
          </a>{" "}
          and the companion mobile application.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Information We Collect
        </h2>
        <h3 className="font-semibold">Account information</h3>
        <p>
          When you sign in with Google we receive your Google account name,
          email address, and profile picture. We use this information solely to
          create and identify your {APP_NAME} account.
        </p>
        <h3 className="font-semibold">Task and note content</h3>
        <p>
          Tasks, notes, cards, tags and other content you create inside{" "}
          {APP_NAME} are stored in our database so we can display them back to
          you across devices.
        </p>
        <h3 className="font-semibold">Google Calendar data (optional)</h3>
        <p>
          If you choose to connect your Google Calendar, we request the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            https://www.googleapis.com/auth/calendar.readonly
          </code>{" "}
          scope. With this permission, {APP_NAME} fetches calendar events for
          the current day (or week) and displays them next to your tasks. We do
          not modify, create, delete, or export any calendar data.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          How We Use Google User Data
        </h2>
        <p>{APP_NAME}&apos;s use of information received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Google Calendar events are fetched on demand each time you view the
            Tasks screen. We read events for the displayed date range only.
          </li>
          <li>
            Events are rendered in the interface and are <strong>not</strong> stored
            in our database or logged.
          </li>
          <li>
            Google user data is <strong>never</strong> sold, shared with third
            parties for advertising, or used to train machine-learning models.
          </li>
          <li>
            Google user data is used only to provide the user-facing calendar
            view feature described above.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          How We Store and Protect Information
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Google OAuth access tokens and refresh tokens are stored in our
            database encrypted with AES-256-GCM before being written to disk.
          </li>
          <li>
            Database connections use TLS. Application traffic is served over
            HTTPS.
          </li>
          <li>
            Access to production infrastructure is restricted to the developer
            and protected by two-factor authentication where available.
          </li>
          <li>
            We do not retain Google Calendar event content on our servers. Only
            the encrypted tokens persist so that future requests can be made on
            your behalf.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Sharing and Third Parties
        </h2>
        <p>
          {APP_NAME} does not sell your personal information. We do not share
          your Google user data with third parties. We use the following
          infrastructure providers to operate the service:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Zeabur</strong> — application hosting and managed
            PostgreSQL database.
          </li>
          <li>
            <strong>Google Identity / Google Calendar API</strong> — sign-in
            and calendar data access.
          </li>
        </ul>
        <p>
          These providers only receive the information strictly necessary to
          operate the service.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Your Choices and Rights
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Disconnect Google Calendar:</strong> you can disconnect at
            any time from Settings → Calendar → Disconnect. This deletes the
            stored OAuth tokens immediately.
          </li>
          <li>
            <strong>Revoke access directly from Google:</strong> visit{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              https://myaccount.google.com/permissions
            </a>{" "}
            to revoke {APP_NAME}&apos;s access.
          </li>
          <li>
            <strong>Delete your account:</strong> email us at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we will permanently delete your account and all associated
            data within 30 days.
          </li>
          <li>
            <strong>Access your data:</strong> email us at the address above to
            request a copy of the data we hold about you.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">Data Retention</h2>
        <p>
          Tasks, notes, cards and other content you create remain in our
          database until you delete them or request account deletion. Encrypted
          Google OAuth tokens remain until you disconnect Google Calendar or
          delete your account.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Children&apos;s Privacy
        </h2>
        <p>
          {APP_NAME} is not directed at children under 13 and we do not
          knowingly collect personal information from children.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be reflected by updating the &quot;Effective date&quot; above. Continued
          use of {APP_NAME} after changes take effect constitutes acceptance of
          the revised policy.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">Contact</h2>
        <p>
          Questions or requests about this Privacy Policy? Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>

      <hr className="border-border my-12" />

      <section className="space-y-4 mb-12">
        <h2 className="text-2xl font-bold">隱私權政策（繁體中文摘要）</h2>
        <p className="text-sm text-text-dim">生效日期：2026 年 5 月 1 日</p>
        <p>
          {APP_NAME} 是一款每日任務管理工具。本政策說明我們收集哪些資訊、如何使用、如何保護，以及你擁有的選擇。
        </p>

        <h3 className="font-semibold mt-6">我們收集的資訊</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Google 帳號資訊（姓名、email、頭像）— 用於建立與識別 {APP_NAME} 帳號</li>
          <li>你在 {APP_NAME} 內建立的任務、日誌、卡片、標籤內容</li>
          <li>
            若你選擇連結 Google Calendar，我們會以{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              calendar.readonly
            </code>{" "}
            權限讀取當日/當週事件顯示在任務頁面。我們不會修改、建立、刪除或匯出任何日曆資料。
          </li>
        </ul>

        <h3 className="font-semibold mt-6">Google 使用者資料的使用方式</h3>
        <p>
          {APP_NAME} 使用 Google API 所取得的使用者資料完全遵守{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google API Services User Data Policy
          </a>
          ，包含 Limited Use 條款。
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>日曆事件僅於你開啟任務頁面時即時取得，讀取顯示日期範圍內的事件</li>
          <li>事件內容<strong>不會</strong>寫入我們的資料庫，也不會被記錄到日誌</li>
          <li>Google 使用者資料<strong>絕不</strong>用於廣告、出售、或訓練機器學習模型</li>
          <li>僅用於使用者自己看到的「今日行事曆」面板功能</li>
        </ul>

        <h3 className="font-semibold mt-6">儲存與保護</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Google OAuth access / refresh token 使用 AES-256-GCM 加密後才寫入資料庫</li>
          <li>DB 連線使用 TLS，應用流量使用 HTTPS</li>
          <li>我們不保留 Google Calendar 事件內容在伺服器上，只有加密後的 token 以便下次代為請求</li>
        </ul>

        <h3 className="font-semibold mt-6">你的權利</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            中斷 Google Calendar 連結：設定 → 行事曆 → 中斷連結，會立即從資料庫清掉 token
          </li>
          <li>
            直接從 Google 撤銷授權：
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline break-all"
            >
              https://myaccount.google.com/permissions
            </a>
          </li>
          <li>
            刪除帳號：寄信到{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline"
            >
              {CONTACT_EMAIL}
            </a>
            ，我們將於 30 天內永久刪除你的帳號及所有相關資料
          </li>
          <li>
            取得資料副本：寄信到上述 email 索取
          </li>
        </ul>

        <h3 className="font-semibold mt-6">聯絡我們</h3>
        <p>
          關於本政策的任何問題，請寄信到{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>
          。
        </p>
      </section>
    </main>
  );
}
