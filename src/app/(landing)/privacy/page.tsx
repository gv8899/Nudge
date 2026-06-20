import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Nudge",
  description: "Nudge privacy policy, payments, and Google user data handling",
};

const APP_NAME = "Nudge";
const COMPANY = "Quantum Leap Co., Ltd";
const COMPANY_ZH = "量子躍遷有限公司";
const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS = "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED = "June 20, 2026";
const LAST_UPDATED_ZH = "2026 年 6 月 20 日";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-text-dim mb-10">Last updated: {LAST_UPDATED}</p>

      <section className="space-y-4 mb-12">
        <p>
          This Privacy Policy explains how <strong>{COMPANY}</strong> (&quot;we&quot;,
          &quot;us&quot;, &quot;our&quot;), a company registered in Taiwan, collects,
          uses, and protects your personal data when you use the {APP_NAME} app and
          website (the &quot;Service&quot;). We are the data controller for your
          personal data.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          1. Information We Collect
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Account information:</strong> your email address and basic
            profile details, provided when you sign in (e.g. via Google).
          </li>
          <li>
            <strong>Your content:</strong> the tasks, notes, tags, and related data
            you create in {APP_NAME}.
          </li>
          <li>
            <strong>Usage and device data:</strong> basic technical information
            needed to operate and secure the Service (e.g. log data, device/OS
            type).
          </li>
          <li>
            <strong>Payment information:</strong> when you subscribe, payment is
            processed by <strong>Paddle.com</strong> (international orders) or{" "}
            <strong>NewebPay (藍新金流)</strong> (payments made in Taiwan). We do{" "}
            <strong>not</strong> collect or store your full card details — see
            &quot;Payments&quot; below.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          2. How We Use Your Data
        </h2>
        <p>
          We use your data to: provide and maintain the Service; sync your content
          across your devices; authenticate your account; respond to support
          requests; send essential service notices; and comply with legal
          obligations. We do <strong>not</strong> sell your personal data.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          3. Legal Bases (for EU/EEA/UK users)
        </h2>
        <p>
          Where the GDPR or UK GDPR applies, we process your data on these legal
          bases: <strong>performance of a contract</strong> (to provide the Service
          you signed up for), <strong>legitimate interests</strong> (to keep the
          Service secure and improve it), <strong>consent</strong> (where required),
          and <strong>legal obligation</strong>.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          4. Payments
        </h2>
        <p>
          Subscription payments are handled by our reseller{" "}
          <strong>Paddle.com, which acts as the Merchant of Record</strong>. Paddle
          processes your payment details and applicable taxes. We receive
          transaction records (such as the fact of payment, plan, and country) but{" "}
          <strong>not your full card number</strong>. Paddle&apos;s handling of your
          data is governed by Paddle&apos;s own privacy policy.
        </p>
        <p>
          For payments made in Taiwan, payment is processed by{" "}
          <strong>NewebPay (藍新金流)</strong> as our payment service provider. For
          those orders, {COMPANY} is the seller of record and issues the invoice. We
          receive transaction records but <strong>not your full card number</strong>.
          NewebPay&apos;s handling of your data is governed by NewebPay&apos;s own
          privacy policy.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          5. Google Calendar Data &amp; Google User Data
        </h2>
        <p>
          If you choose to connect your Google Calendar, we request the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            https://www.googleapis.com/auth/calendar.readonly
          </code>{" "}
          scope. With this permission, {APP_NAME} fetches calendar events for the
          current day (or week) and displays them next to your tasks. We do not
          modify, create, delete, or export any calendar data.
        </p>
        <p>
          {APP_NAME}&apos;s use of information received from Google APIs will adhere
          to the{" "}
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
            Google user data is used only to provide the user-facing calendar view
            feature described above.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          6. Third-Party Services
        </h2>
        <p>We use a limited set of providers to run the Service, including:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Zeabur</strong> — hosting and database infrastructure.
          </li>
          <li>
            <strong>Google</strong> — sign-in and (if you connect it) calendar
            integration.
          </li>
          <li>
            <strong>Paddle</strong> — payment processing (international orders).
          </li>
          <li>
            <strong>NewebPay (藍新金流)</strong> — payment processing (orders made
            in Taiwan).
          </li>
          <li>
            <strong>Apple</strong> — app distribution and push notifications
            (iOS/macOS).
          </li>
        </ul>
        <p>
          These providers process data only as needed to provide their part of the
          Service.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          7. Data Retention
        </h2>
        <p>
          We keep your data for as long as your account is active. If you delete
          your account, we permanently delete your account and associated content
          within <strong>30 days</strong>, except where we must retain limited
          records to meet legal or accounting obligations (e.g. transaction records
          held by Paddle).
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          8. Your Rights
        </h2>
        <p>
          You have the right to access, correct, export, or delete your personal
          data, and (for EU/EEA/UK users) to object to or restrict certain
          processing and to lodge a complaint with your local data protection
          authority. To exercise any of these, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
          . To delete your account and all associated data, email us and we will
          action it within 30 days. You can also disconnect Google Calendar at any
          time from Settings → Calendar → Disconnect, which deletes the stored OAuth
          tokens immediately, or revoke access directly at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          9. International Transfers
        </h2>
        <p>
          We operate from Taiwan and use providers that may process data outside
          your country. Where required, we rely on appropriate safeguards for such
          transfers.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          10. Security
        </h2>
        <p>
          We use reasonable technical and organisational measures to protect your
          data, including encryption in transit and access controls. Google OAuth
          access and refresh tokens are encrypted with AES-256-GCM before being
          written to disk. No method of transmission or storage is completely
          secure, but we work to protect your information and maintain backups.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          11. Children
        </h2>
        <p>
          The Service is not directed to children under 16. We do not knowingly
          collect data from children under 16.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          12. Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will
          be notified by email or in-app, and reflected by updating the &quot;Last
          updated&quot; date above.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          13. Contact
        </h2>
        <p>
          <strong>{COMPANY}</strong>
          <br />
          {ADDRESS}
          <br />
          Email:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>

      <hr className="border-border my-12" />

      <section className="space-y-4 mb-12">
        <h2 className="text-2xl font-bold">隱私權政策</h2>
        <p className="text-sm text-text-dim">最後更新：{LAST_UPDATED_ZH}</p>
        <p>
          本隱私權政策說明在台灣登記之 <strong>{COMPANY_ZH}</strong>（下稱「我們」）於您使用
          {APP_NAME} App 與網站（下稱「本服務」）時，如何蒐集、使用與保護您的個人資料。我們為您個人資料之控管者。
        </p>

        <h3 className="font-semibold mt-6">1. 我們蒐集的資料</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>帳號資料</strong>：您登入時（如透過 Google）提供的電子郵件與基本個人資料。
          </li>
          <li>
            <strong>您的內容</strong>：您在 {APP_NAME} 建立的任務、筆記、標籤等資料。
          </li>
          <li>
            <strong>使用與裝置資料</strong>：營運與保護服務所需的基本技術資訊（如日誌、裝置/OS 類型）。
          </li>
          <li>
            <strong>付款資料</strong>：訂閱時付款由 <strong>Paddle.com</strong>（國際訂單）或
            <strong>藍新金流（NewebPay）</strong>（台灣付款）處理，我們
            <strong>不</strong>蒐集或儲存您的完整信用卡資料（詳見「付款」）。
          </li>
        </ul>

        <h3 className="font-semibold mt-6">2. 我們如何使用資料</h3>
        <p>
          用於：提供與維護本服務、跨裝置同步您的內容、驗證帳號、回應客服、寄送必要服務通知，以及遵循法律義務。我們
          <strong>不</strong>出售您的個人資料。
        </p>

        <h3 className="font-semibold mt-6">3. 法律依據（適用歐盟／EEA／英國使用者）</h3>
        <p>
          於 GDPR 或 UK GDPR 適用時，我們依下列依據處理資料：<strong>履行契約</strong>（提供您註冊之服務）、
          <strong>正當利益</strong>（維護安全與改善服務）、<strong>同意</strong>（必要時），以及
          <strong>法律義務</strong>。
        </p>

        <h3 className="font-semibold mt-6">4. 付款</h3>
        <p>
          訂閱付款由經銷商 <strong>Paddle.com 處理，其為登記商家（Merchant of Record）</strong>
          ，負責處理您的付款資訊與相關稅金。我們會收到交易紀錄（如付款事實、方案、國別），但
          <strong>不會取得您的完整卡號</strong>。Paddle 對您資料之處理依其自身隱私權政策。
        </p>
        <p>
          於台灣付款者，付款由 <strong>藍新金流（NewebPay）</strong> 作為我方之金流服務商處理；此類訂單由
          {COMPANY_ZH} 為賣方並開立統一發票。我們會收到交易紀錄，但
          <strong>不會取得您的完整卡號</strong>。藍新金流對您資料之處理依其自身隱私權政策。
        </p>

        <h3 className="font-semibold mt-6">5. Google Calendar 與 Google 使用者資料</h3>
        <p>
          若您選擇連結 Google Calendar，我們會以{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">calendar.readonly</code>{" "}
          權限讀取當日/當週事件顯示在任務頁面，我們不會修改、建立、刪除或匯出任何日曆資料。
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
          <li>日曆事件僅於您開啟任務頁面時即時取得，讀取顯示日期範圍內的事件</li>
          <li>事件內容<strong>不會</strong>寫入我們的資料庫，也不會被記錄到日誌</li>
          <li>Google 使用者資料<strong>絕不</strong>用於廣告、出售、或訓練機器學習模型</li>
          <li>僅用於使用者自己看到的「今日行事曆」面板功能</li>
        </ul>

        <h3 className="font-semibold mt-6">6. 第三方服務</h3>
        <p>
          我們使用有限的服務商營運本服務：<strong>Zeabur</strong>（主機與資料庫）、
          <strong>Google</strong>（登入與選用的行事曆整合）、<strong>Paddle</strong>（國際金流）、
          <strong>藍新金流（NewebPay）</strong>（台灣金流）、<strong>Apple</strong>（App 派送與推播）。這些服務商僅於提供其服務所需範圍內處理資料。
        </p>

        <h3 className="font-semibold mt-6">7. 資料保存</h3>
        <p>
          帳號有效期間我們會保存您的資料。若您刪除帳號，我們將於 <strong>30 天內</strong>
          永久刪除您的帳號與相關內容，惟為遵循法律或會計義務須保留之有限紀錄（如 Paddle 保有之交易紀錄）除外。
        </p>

        <h3 className="font-semibold mt-6">8. 您的權利</h3>
        <p>
          您有權存取、更正、匯出或刪除您的個人資料；（歐盟／EEA／英國使用者）並有權反對或限制特定處理、向當地資料保護機關申訴。如欲行使，請來信{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
          。您也可隨時於「設定 → 行事曆 → 中斷連結」中斷 Google Calendar（會立即刪除已儲存的 OAuth token），或直接於{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all"
          >
            myaccount.google.com/permissions
          </a>{" "}
          撤銷授權。
        </p>

        <h3 className="font-semibold mt-6">9. 國際傳輸</h3>
        <p>
          我們於台灣營運，並使用可能在您所在國以外處理資料之服務商。於必要時，我們就此類傳輸採取適當保護措施。
        </p>

        <h3 className="font-semibold mt-6">10. 安全</h3>
        <p>
          我們採取合理之技術與組織措施保護您的資料，包括傳輸加密與存取控制；Google OAuth access /
          refresh token 以 AES-256-GCM 加密後才寫入資料庫。沒有任何傳輸或儲存方式為絕對安全，但我們持續致力保護您的資訊並保有備份。
        </p>

        <h3 className="font-semibold mt-6">11. 兒童</h3>
        <p>本服務不針對 16 歲以下兒童，我們不會在知情下蒐集其資料。</p>

        <h3 className="font-semibold mt-6">12. 政策變更</h3>
        <p>我們可能不時更新本政策，重大變更將以電子郵件或 App 內通知，並更新上方「最後更新」日期。</p>

        <h3 className="font-semibold mt-6">13. 聯絡我們</h3>
        <p>
          <strong>{COMPANY_ZH}</strong>
          <br />
          {ADDRESS_ZH}
          <br />
          Email：
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
