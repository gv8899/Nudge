import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Nudge",
  description: "Nudge terms of service",
};

const APP_NAME = "Nudge";
const CONTACT_EMAIL = "gv88999@gmail.com";
const EFFECTIVE_DATE = "April 15, 2026";
const HOMEPAGE = "https://nudge.tw";
const GOVERNING_LAW = "Taiwan, R.O.C.";

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-text-dim mb-10">
        Effective date: {EFFECTIVE_DATE}
      </p>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          1. Acceptance of Terms
        </h2>
        <p>
          By accessing or using {APP_NAME} (the &quot;Service&quot;) at{" "}
          <a href={HOMEPAGE} className="text-primary underline">
            {HOMEPAGE}
          </a>{" "}
          or the companion mobile application, you agree to be bound by these
          Terms of Service (&quot;Terms&quot;). If you do not agree, do not use
          the Service.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          2. Description of Service
        </h2>
        <p>
          {APP_NAME} is a lightweight personal task management tool that helps
          users organize daily tasks, write notes, and review cards. It offers
          an optional integration with Google Calendar that displays read-only
          calendar events next to your tasks.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          3. User Accounts
        </h2>
        <p>
          You must sign in with a Google account to use the Service. You are
          responsible for maintaining the confidentiality of your Google
          account and for all activities that occur under your Nudge account.
          Notify us immediately at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          of any unauthorized use.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          4. Acceptable Use
        </h2>
        <p>You agree <strong>not</strong> to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Service for any unlawful purpose</li>
          <li>
            Attempt to gain unauthorized access to the Service, other
            users&apos; accounts, or the underlying infrastructure
          </li>
          <li>
            Interfere with or disrupt the Service, servers, or networks
            connected to the Service
          </li>
          <li>
            Reverse engineer, decompile, or disassemble any portion of the
            Service
          </li>
          <li>
            Use automated systems (bots, scrapers) to access the Service
            without our explicit written permission
          </li>
          <li>
            Upload or store content that infringes intellectual property or
            privacy rights, or that is illegal, harmful, or offensive
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          5. User Content
        </h2>
        <p>
          You retain all rights to the tasks, notes, cards, and other content
          you create in {APP_NAME} (&quot;User Content&quot;). By using the
          Service, you grant us a limited license to store and display your
          User Content solely to provide the Service to you across your
          devices.
        </p>
        <p>
          You are responsible for the content you create. We may remove
          content that violates these Terms or applicable law.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          6. Third-Party Services
        </h2>
        <p>
          The Service integrates with third-party services including Google
          Identity and Google Calendar API. Your use of these integrations is
          subject to the respective third parties&apos; terms and privacy
          policies. We are not responsible for any third-party service,
          content, or practices.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          7. Intellectual Property
        </h2>
        <p>
          The Service, including its design, code, and brand assets, is owned
          by the {APP_NAME} developer and protected by copyright and other
          laws. These Terms do not grant you any right, title, or interest in
          the Service other than the limited right to use it as described.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          8. Privacy
        </h2>
        <p>
          Your privacy is important to us. Please review our{" "}
          <Link href="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>{" "}
          to understand what information we collect and how we use it.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          9. Disclaimers
        </h2>
        <p className="uppercase text-sm">
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, whether express or implied, including but
          not limited to merchantability, fitness for a particular purpose,
          non-infringement, or that the Service will be uninterrupted,
          error-free, or secure.
        </p>
        <p>
          {APP_NAME} is a personal project in active development. Features may
          change or be removed without notice. We do not guarantee that your
          data will be permanently preserved, and you should not rely on the
          Service as your sole backup for important information.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          10. Limitation of Liability
        </h2>
        <p className="uppercase text-sm">
          To the maximum extent permitted by law, in no event shall {APP_NAME}{" "}
          or its developer be liable for any indirect, incidental, special,
          consequential, or punitive damages, including without limitation
          loss of profits, data, use, goodwill, or other intangible losses,
          resulting from (a) your access to or use of or inability to access
          or use the Service; (b) any conduct or content of any third party on
          the Service; or (c) unauthorized access, use, or alteration of your
          content.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          11. Termination
        </h2>
        <p>
          You may stop using the Service at any time by emailing{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          to request account deletion. We may suspend or terminate your access
          to the Service at any time if you violate these Terms, without prior
          notice.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          12. Governing Law
        </h2>
        <p>
          These Terms are governed by the laws of {GOVERNING_LAW}, without
          regard to its conflict of law provisions. Any dispute arising out of
          or relating to these Terms or the Service shall be subject to the
          exclusive jurisdiction of the courts located in {GOVERNING_LAW}.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          13. Changes to These Terms
        </h2>
        <p>
          We may update these Terms from time to time. Material changes will
          be reflected by updating the &quot;Effective date&quot; above.
          Continued use of the Service after changes take effect constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          14. Contact
        </h2>
        <p>
          Questions about these Terms? Email{" "}
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
        <h2 className="text-2xl font-bold">服務條款（繁體中文摘要）</h2>
        <p className="text-sm text-text-dim">生效日期：2026 年 4 月 15 日</p>
        <p>
          使用 {APP_NAME} 即代表你同意以下條款。若不同意，請停止使用本服務。
        </p>

        <h3 className="font-semibold mt-6">服務說明</h3>
        <p>
          {APP_NAME} 是一款輕量型個人任務管理工具，協助使用者管理每日任務、撰寫日誌、整理卡片，並提供選擇性的 Google Calendar 連結以唯讀方式顯示日曆事件。
        </p>

        <h3 className="font-semibold mt-6">使用者帳號</h3>
        <p>
          你必須以 Google 帳號登入方可使用本服務。你需自行維護帳號安全，如發生未授權使用，請立即寄信到{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>
          。
        </p>

        <h3 className="font-semibold mt-6">可接受使用</h3>
        <p>你同意不得：</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>將服務用於任何非法目的</li>
          <li>嘗試取得未授權的存取權限</li>
          <li>干擾或破壞服務運作</li>
          <li>對服務進行反組譯、反向工程</li>
          <li>未經許可以自動化程式（bot、爬蟲）存取服務</li>
          <li>上傳侵權、違法、有害或具冒犯性的內容</li>
        </ul>

        <h3 className="font-semibold mt-6">使用者內容</h3>
        <p>
          你保有自己在 {APP_NAME} 建立的任務、日誌、卡片等內容的所有權。使用本服務即授予我們有限的權限儲存與顯示這些內容，以便跨裝置提供服務給你。
        </p>

        <h3 className="font-semibold mt-6">第三方服務</h3>
        <p>
          本服務整合 Google Identity 與 Google Calendar API。你使用這些整合功能時，須同時遵守第三方的條款與隱私權政策。
        </p>

        <h3 className="font-semibold mt-6">免責聲明</h3>
        <p>
          {APP_NAME} 以「現狀」提供，不提供任何形式的明示或默示保證。{APP_NAME} 是個人開發的專案，功能可能在未事先通知的情況下變更或移除。請勿將本服務作為重要資料的唯一備份。
        </p>

        <h3 className="font-semibold mt-6">責任限制</h3>
        <p>
          在法律允許的最大範圍內，{APP_NAME} 及其開發者對任何間接、附帶、特殊、衍生或懲罰性損害（包含但不限於利潤、資料、使用權或商譽損失）概不負責。
        </p>

        <h3 className="font-semibold mt-6">終止</h3>
        <p>
          你可隨時寄信到{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary underline"
          >
            {CONTACT_EMAIL}
          </a>
          {" "}要求刪除帳號以停止使用。若違反本條款，我們可在未事先通知的情況下暫停或終止你的存取權限。
        </p>

        <h3 className="font-semibold mt-6">適用法律</h3>
        <p>
          本條款受中華民國（台灣）法律管轄。因本條款或服務所生之爭議，以中華民國法院為專屬管轄法院。
        </p>

        <h3 className="font-semibold mt-6">聯絡我們</h3>
        <p>
          關於本條款的任何問題，請寄信到{" "}
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
