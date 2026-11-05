import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Privacy Policy — Nudge",
  description: "Nudge privacy policy, payments, and Google user data handling",
};

const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS =
  "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED_EN = "October 29, 2026";
const LAST_UPDATED_ZH = "2026 年 10 月 29 日";
const LAST_UPDATED_JA = "2026年10月29日";

const h2 = "text-xl font-semibold border-b border-border pb-1";

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
    {CONTACT_EMAIL}
  </a>
);
const googleUDP = (
  <a
    href="https://developers.google.com/terms/api-services-user-data-policy"
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline"
  >
    Google API Services User Data Policy
  </a>
);
const googlePerms = (
  <a
    href="https://myaccount.google.com/permissions"
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline break-all"
  >
    myaccount.google.com/permissions
  </a>
);

const CONTENT: Record<string, React.ReactNode> = {
  en: (
    <>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-text-dim mb-10">
        Last updated: {LAST_UPDATED_EN}
      </p>

      <section className="space-y-4 mb-12">
        <p>
          This Privacy Policy explains how{" "}
          <strong>Quantum Leap Co., Ltd</strong> (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;), a company registered in Taiwan, collects, uses, and
          protects your personal data when you use the Nudge app and website (the
          &quot;Service&quot;). We are the data controller for your personal
          data.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Account information:</strong> your email address and basic
            profile details, provided when you sign in (e.g. via Google).
          </li>
          <li>
            <strong>Your content:</strong> the tasks, notes, tags, and related
            data you create in Nudge.
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
        <h2 className={h2}>2. How We Use Your Data</h2>
        <p>
          We use your data to: provide and maintain the Service; sync your
          content across your devices; authenticate your account; respond to
          support requests; send essential service notices; and comply with
          legal obligations. We do <strong>not</strong> sell your personal data.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. Legal Bases (for EU/EEA/UK users)</h2>
        <p>
          Where the GDPR or UK GDPR applies, we process your data on these legal
          bases: <strong>performance of a contract</strong> (to provide the
          Service you signed up for), <strong>legitimate interests</strong> (to
          keep the Service secure and improve it), <strong>consent</strong>{" "}
          (where required), and <strong>legal obligation</strong>.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. Payments</h2>
        <p>
          Subscription payments are handled by our reseller{" "}
          <strong>Paddle.com, which acts as the Merchant of Record</strong>.
          Paddle processes your payment details and applicable taxes. We receive
          transaction records (such as the fact of payment, plan, and country)
          but <strong>not your full card number</strong>. Paddle&apos;s handling
          of your data is governed by Paddle&apos;s own privacy policy.
        </p>
        <p>
          For payments made in Taiwan, payment is processed by{" "}
          <strong>NewebPay (藍新金流)</strong> as our payment service provider.
          For those orders, Quantum Leap Co., Ltd is the seller of record and
          issues the invoice. We receive transaction records but{" "}
          <strong>not your full card number</strong>. NewebPay&apos;s handling of
          your data is governed by NewebPay&apos;s own privacy policy.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. Google Calendar Data &amp; Google User Data</h2>
        <p>
          If you choose to connect your Google Calendar, we request the{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            https://www.googleapis.com/auth/calendar.readonly
          </code>{" "}
          scope. With this permission, Nudge fetches calendar events for the
          current day (or week) and displays them next to your tasks. We do not
          modify, create, delete, or export any calendar data.
        </p>
        <p>
          Nudge&apos;s use of information received from Google APIs will adhere
          to the {googleUDP}, including the Limited Use requirements.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Google Calendar events are fetched on demand each time you view the
            Tasks screen. We read events for the displayed date range only.
          </li>
          <li>
            Events are rendered in the interface and are <strong>not</strong>{" "}
            stored in our database or logged.
          </li>
          <li>
            Google user data is <strong>never</strong> sold, shared with third
            parties for advertising, or used to train machine-learning models.
          </li>
          <li>
            Google user data is used only to provide user-facing features: the
            calendar view described above and, if you authorize one, an AI
            connector (see Section 6). An AI service you authorize can read
            calendar events only when it makes a request on your behalf, and only
            for the dates in that request. This transfer happens only with your
            consent on the Nudge authorization page.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. AI Connectors (Claude, ChatGPT and Similar Services)</h2>
        <p>
          You can choose to let a third-party AI service, such as Claude or
          ChatGPT (an &quot;AI service&quot;), access your Nudge account through
          the Nudge connector.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Your authorization is required.</strong> A connection is
            created only after you sign in on the Nudge authorization page and
            select &quot;Allow&quot;. Without it, an AI service cannot access any
            of your data.
          </li>
          <li>
            <strong>What the AI service can do.</strong> Following your
            instructions in that service, it can read your tasks, cards, daily
            notes, tags and, if you connected it, your Google Calendar events;
            and it can create, change or delete tasks, cards, notes and tags.
            Most AI services ask you to confirm before changing or deleting
            data, but that confirmation is provided by the AI service and we
            cannot guarantee it.
          </li>
          <li>
            <strong>When data is sent.</strong> We send data to an AI service
            only when it makes a request on your behalf, and only the data that
            request needs. We never send your data to an AI service on our own
            initiative.
          </li>
          <li>
            <strong>After data is sent.</strong> Data received by an AI service
            is handled under that service&apos;s own privacy policy and terms,
            including whether conversations are stored or used to train models.
            Please review that service&apos;s settings. We do not use your data
            to train AI models.
          </li>
          <li>
            <strong>Images.</strong> If you ask an AI service to add an image
            from the web to a card, our servers download that image and store it
            as an attachment of your card, together with a link to its source.
          </li>
          <li>
            <strong>What we store.</strong> The connection record (the AI
            service&apos;s name, when it was connected and last used) and hashed
            access credentials. We do not store your conversations with the AI
            service.
          </li>
          <li>
            <strong>Disconnecting.</strong> You can disconnect an AI service at
            any time in Settings → AI connector; its access ends immediately.
            Connections are also deleted when you delete your account.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. Third-Party Services</h2>
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
            <strong>NewebPay (藍新金流)</strong> — payment processing (orders
            made in Taiwan).
          </li>
          <li>
            <strong>Apple</strong> — app distribution and push notifications
            (iOS/macOS).
          </li>
          <li>
            <strong>AI services you connect</strong> (such as Claude or ChatGPT)
            — only if you authorize them; see Section 6.
          </li>
        </ul>
        <p>
          These providers process data only as needed to provide their part of
          the Service.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. Data Retention</h2>
        <p>
          We keep your data for as long as your account is active. If you delete
          your account, we permanently delete your account and associated
          content within <strong>30 days</strong>, except where we must retain
          limited records to meet legal or accounting obligations (e.g.
          transaction records held by Paddle).
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. Your Rights</h2>
        <p>
          You have the right to access, correct, export, or delete your personal
          data, and (for EU/EEA/UK users) to object to or restrict certain
          processing and to lodge a complaint with your local data protection
          authority. To exercise any of these, email {mail}. To delete your
          account and all associated data, email us and we will action it within
          30 days. You can also disconnect Google Calendar at any time from
          Settings → Calendar → Disconnect, which deletes the stored OAuth tokens
          immediately, or revoke access directly at {googlePerms}.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. International Transfers</h2>
        <p>
          We operate from Taiwan and use providers that may process data outside
          your country. Where required, we rely on appropriate safeguards for
          such transfers.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. Security</h2>
        <p>
          We use reasonable technical and organisational measures to protect
          your data, including encryption in transit and access controls. Google
          OAuth access and refresh tokens are encrypted with AES-256-GCM before
          being written to disk. No method of transmission or storage is
          completely secure, but we work to protect your information and maintain
          backups.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. Children</h2>
        <p>
          The Service is not directed to children under 16. We do not knowingly
          collect data from children under 16.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be notified by email or in-app, and reflected by updating the
          &quot;Last updated&quot; date above.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14. Contact</h2>
        <p>
          <strong>Quantum Leap Co., Ltd</strong>
          <br />
          {ADDRESS}
          <br />
          Email: {mail}
        </p>
      </section>
    </>
  ),

  "zh-TW": (
    <>
      <h1 className="text-3xl font-bold mb-2">隱私權政策</h1>
      <p className="text-sm text-text-dim mb-10">最後更新：{LAST_UPDATED_ZH}</p>

      <section className="space-y-4 mb-12">
        <p>
          本隱私權政策說明在台灣登記之 <strong>量子躍遷有限公司</strong>
          （下稱「我們」）於您使用 Nudge App
          與網站（下稱「本服務」）時，如何蒐集、使用與保護您的個人資料。我們為您個人資料之控管者。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. 我們蒐集的資料</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>帳號資料</strong>：您登入時（如透過 Google）提供的電子郵件與基本個人資料。
          </li>
          <li>
            <strong>您的內容</strong>：您在 Nudge 建立的任務、筆記、標籤等資料。
          </li>
          <li>
            <strong>使用與裝置資料</strong>：營運與保護服務所需的基本技術資訊（如日誌、裝置/OS 類型）。
          </li>
          <li>
            <strong>付款資料</strong>：訂閱時付款由 <strong>Paddle.com</strong>
            （國際訂單）或 <strong>藍新金流（NewebPay）</strong>（台灣付款）處理，我們
            <strong>不</strong>蒐集或儲存您的完整信用卡資料（詳見「付款」）。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>2. 我們如何使用資料</h2>
        <p>
          用於：提供與維護本服務、跨裝置同步您的內容、驗證帳號、回應客服、寄送必要服務通知，以及遵循法律義務。我們
          <strong>不</strong>出售您的個人資料。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. 法律依據（適用歐盟／EEA／英國使用者）</h2>
        <p>
          於 GDPR 或 UK GDPR 適用時，我們依下列依據處理資料：
          <strong>履行契約</strong>（提供您註冊之服務）、
          <strong>正當利益</strong>（維護安全與改善服務）、
          <strong>同意</strong>（必要時），以及 <strong>法律義務</strong>。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. 付款</h2>
        <p>
          訂閱付款由經銷商{" "}
          <strong>Paddle.com 處理，其為登記商家（Merchant of Record）</strong>
          ，負責處理您的付款資訊與相關稅金。我們會收到交易紀錄（如付款事實、方案、國別），但
          <strong>不會取得您的完整卡號</strong>。Paddle
          對您資料之處理依其自身隱私權政策。
        </p>
        <p>
          於台灣付款者，付款由 <strong>藍新金流（NewebPay）</strong>{" "}
          作為我方之金流服務商處理；此類訂單由 量子躍遷有限公司
          為賣方並開立統一發票。我們會收到交易紀錄，但
          <strong>不會取得您的完整卡號</strong>
          。藍新金流對您資料之處理依其自身隱私權政策。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. Google Calendar 與 Google 使用者資料</h2>
        <p>
          若您選擇連結 Google Calendar，我們會以{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            calendar.readonly
          </code>{" "}
          權限讀取當日/當週事件顯示在任務頁面，我們不會修改、建立、刪除或匯出任何日曆資料。Nudge
          使用 Google API 所取得的使用者資料完全遵守 {googleUDP}，包含 Limited Use
          條款。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>日曆事件僅於您開啟任務頁面時即時取得，讀取顯示日期範圍內的事件</li>
          <li>
            事件內容<strong>不會</strong>寫入我們的資料庫，也不會被記錄到日誌
          </li>
          <li>
            Google 使用者資料<strong>絕不</strong>用於廣告、出售、或訓練機器學習模型
          </li>
          <li>
            僅用於提供您使用的功能：任務頁面的行事曆面板，以及您授權的 AI
            連接器（見第 6 節）。您授權的 AI
            服務只有在代您提出請求時，才能讀取該次請求日期範圍內的事件；此傳輸僅在您於
            Nudge 授權頁面同意後進行
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. AI 連接器（Claude、ChatGPT 等服務）</h2>
        <p>
          您可以選擇授權 Claude、ChatGPT 等第三方 AI 服務（下稱「AI 服務」）透過
          Nudge 連接器存取您的帳號。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>須經您授權：</strong>您在 Nudge 授權頁面登入並按下「允許」後才會建立連線；未授權時，AI
            服務無法存取您的任何資料。
          </li>
          <li>
            <strong>AI 服務可以做的事：</strong>依您在該服務中的指示，讀取您的任務、卡片、每日筆記、標籤，以及（若您已連結）Google
            行事曆事件；並可新增、修改或刪除任務、卡片、筆記與標籤。多數 AI
            服務在修改或刪除前會先請您確認，但該確認機制由 AI 服務提供，我們無法保證。
          </li>
          <li>
            <strong>何時傳送資料：</strong>只有在 AI
            服務代您提出請求時，我們才傳送該次請求所需的資料。我們不會主動把您的資料傳給任何
            AI 服務。
          </li>
          <li>
            <strong>傳送之後：</strong>AI 服務收到的資料，依該服務自身的隱私權政策與條款處理，包括是否保存對話、是否用於訓練模型，請參閱該服務的設定。我們不會將您的資料用於訓練
            AI 模型。
          </li>
          <li>
            <strong>圖片：</strong>若您請 AI
            服務把網路上的圖片加入卡片，我們的伺服器會下載該圖片並存為您卡片的附件，同時附上來源網址。
          </li>
          <li>
            <strong>我們保存的資料：</strong>連線紀錄（AI
            服務名稱、建立與最後使用時間）與經雜湊處理的存取憑證。我們不保存您與 AI
            服務之間的對話內容。
          </li>
          <li>
            <strong>中斷連線：</strong>您可隨時在「設定 → AI
            連接器」中斷連線，存取權立即失效。刪除帳號時，連線紀錄一併刪除。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. 第三方服務</h2>
        <p>
          我們使用有限的服務商營運本服務：<strong>Zeabur</strong>
          （主機與資料庫）、<strong>Google</strong>（登入與選用的行事曆整合）、
          <strong>Paddle</strong>（國際金流）、
          <strong>藍新金流（NewebPay）</strong>（台灣金流）、
          <strong>Apple</strong>
          （App 派送與推播）；以及您自行授權的 <strong>AI 服務</strong>（如
          Claude、ChatGPT，僅在您連線後，見第 6 節）。這些服務商僅於提供其服務所需範圍內處理資料。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. 資料保存</h2>
        <p>
          帳號有效期間我們會保存您的資料。若您刪除帳號，我們將於{" "}
          <strong>30 天內</strong>
          永久刪除您的帳號與相關內容，惟為遵循法律或會計義務須保留之有限紀錄（如
          Paddle 保有之交易紀錄）除外。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. 您的權利</h2>
        <p>
          您有權存取、更正、匯出或刪除您的個人資料；（歐盟／EEA／英國使用者）並有權反對或限制特定處理、向當地資料保護機關申訴。如欲行使，請來信{" "}
          {mail}
          。您也可隨時於「設定 → 行事曆 → 中斷連結」中斷 Google Calendar（會立即刪除已儲存的
          OAuth token），或直接於 {googlePerms} 撤銷授權。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. 國際傳輸</h2>
        <p>
          我們於台灣營運，並使用可能在您所在國以外處理資料之服務商。於必要時，我們就此類傳輸採取適當保護措施。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. 安全</h2>
        <p>
          我們採取合理之技術與組織措施保護您的資料，包括傳輸加密與存取控制；Google
          OAuth access / refresh token 以 AES-256-GCM
          加密後才寫入資料庫。沒有任何傳輸或儲存方式為絕對安全，但我們持續致力保護您的資訊並保有備份。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. 兒童</h2>
        <p>本服務不針對 16 歲以下兒童，我們不會在知情下蒐集其資料。</p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>13. 政策變更</h2>
        <p>
          我們可能不時更新本政策，重大變更將以電子郵件或 App
          內通知，並更新上方「最後更新」日期。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14. 聯絡我們</h2>
        <p>
          <strong>量子躍遷有限公司</strong>
          <br />
          {ADDRESS_ZH}
          <br />
          Email：{mail}
        </p>
      </section>
    </>
  ),

  ja: (
    <>
      <h1 className="text-3xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-sm text-text-dim mb-10">最終更新：{LAST_UPDATED_JA}</p>

      <section className="space-y-4 mb-12">
        <p>
          本プライバシーポリシーは、台湾で登記された{" "}
          <strong>量子躍遷有限公司（Quantum Leap Co., Ltd、以下「当社」）</strong>
          が、お客様が Nudge のアプリおよびウェブサイト（以下「本サービス」）を利用する際に、どのように個人データを収集・使用・保護するかを説明します。当社はお客様の個人データの管理者です。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. 収集する情報</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>アカウント情報：</strong>
            サインイン時（例：Google 経由）に提供されるメールアドレスおよび基本的なプロフィール情報。
          </li>
          <li>
            <strong>お客様のコンテンツ：</strong>Nudge
            で作成したタスク、ノート、タグおよび関連データ。
          </li>
          <li>
            <strong>利用・デバイスデータ：</strong>
            本サービスの運用とセキュリティ確保に必要な基本的な技術情報（例：ログデータ、デバイス／OS の種類）。
          </li>
          <li>
            <strong>決済情報：</strong>サブスクリプションのお支払いは{" "}
            <strong>Paddle.com</strong>（海外注文）または{" "}
            <strong>藍新金流（NewebPay）</strong>
            （台湾でのお支払い）が処理します。当社はお客様の完全なカード情報を収集・保存
            <strong>しません</strong>（下記「決済」参照）。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>2. データの利用目的</h2>
        <p>
          当社は、本サービスの提供・維持、デバイス間でのコンテンツ同期、アカウントの認証、サポートへの対応、必要不可欠なサービス通知の送信、および法的義務の遵守のためにお客様のデータを利用します。当社はお客様の個人データを販売
          <strong>しません</strong>。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. 法的根拠（EU／EEA／英国のユーザー向け）</h2>
        <p>
          GDPR または UK GDPR
          が適用される場合、当社は次の法的根拠に基づいてデータを処理します：
          <strong>契約の履行</strong>（お申し込みいただいた本サービスの提供）、
          <strong>正当な利益</strong>（本サービスの安全確保と改善）、
          <strong>同意</strong>（必要な場合）、および <strong>法的義務</strong>。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. 決済</h2>
        <p>
          サブスクリプションのお支払いは、当社の再販業者である{" "}
          <strong>
            Paddle.com が記録上の販売者（Merchant of Record）として
          </strong>
          処理します。Paddle
          がお支払いの詳細および適用される税金を処理します。当社は取引記録（支払いの事実、プラン、国など）を受領しますが、
          <strong>完全なカード番号は受領しません</strong>。Paddle
          によるお客様のデータの取り扱いは、Paddle
          自身のプライバシーポリシーに準拠します。
        </p>
        <p>
          台湾でのお支払いについては、当社の決済サービスプロバイダーである{" "}
          <strong>藍新金流（NewebPay）</strong>
          が処理します。それらの注文については、量子躍遷有限公司
          が販売者として請求書（統一発票）を発行します。当社は取引記録を受領しますが、
          <strong>完全なカード番号は受領しません</strong>。NewebPay
          によるお客様のデータの取り扱いは、NewebPay
          自身のプライバシーポリシーに準拠します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. Google カレンダーデータおよび Google ユーザーデータ</h2>
        <p>
          お客様が Google カレンダーの連携を選択した場合、当社は{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            https://www.googleapis.com/auth/calendar.readonly
          </code>{" "}
          スコープを要求します。この許可により、Nudge
          は当日（または当週）のカレンダーイベントを取得し、タスクの横に表示します。当社はカレンダーデータの変更、作成、削除、エクスポートを一切行いません。
        </p>
        <p>
          Nudge が Google API から受領する情報の利用は、Limited Use
          の要件を含む {googleUDP} に準拠します。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Google
            カレンダーのイベントは、タスク画面を表示するたびにその都度取得されます。表示される日付範囲のイベントのみを読み取ります。
          </li>
          <li>
            イベントはインターフェース上に表示されるのみで、当社のデータベースに保存されることも、ログに記録されることも
            <strong>ありません</strong>。
          </li>
          <li>
            Google ユーザーデータは、販売、広告目的での第三者との共有、機械学習モデルの学習に
            <strong>一切使用されません</strong>。
          </li>
          <li>
            Google
            ユーザーデータは、ユーザー向け機能（上記のカレンダー表示、およびお客様が許可した
            AI コネクタ〔第 6 節参照〕）の提供にのみ使用されます。お客様が許可した AI
            サービスは、お客様に代わってリクエストを行った場合にのみ、そのリクエストの日付範囲のイベントを読み取ることができます。この移転は、Nudge
            の認可ページでお客様が同意した場合にのみ行われます。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. AI コネクタ（Claude、ChatGPT などのサービス）</h2>
        <p>
          お客様は、Claude や ChatGPT などの第三者 AI サービス（以下「AI
          サービス」）に、Nudge コネクタを通じてお客様のアカウントへのアクセスを許可することができます。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>お客様の許可が必要です：</strong>Nudge
            の認可ページでログインし「許可」を選択した場合にのみ接続が作成されます。許可がない限り、AI
            サービスはお客様のデータに一切アクセスできません。
          </li>
          <li>
            <strong>AI サービスができること：</strong>当該サービスでのお客様の指示に従い、タスク、カード、デイリーノート、タグ、および（連携している場合）Google
            カレンダーのイベントを読み取り、タスク、カード、ノート、タグを作成・変更・削除できます。多くの
            AI サービスは変更・削除の前に確認を求めますが、その確認機能は AI
            サービス側が提供するものであり、当社は保証できません。
          </li>
          <li>
            <strong>データを送信するとき：</strong>AI
            サービスがお客様に代わってリクエストを行った場合にのみ、そのリクエストに必要なデータを送信します。当社が自らお客様のデータを
            AI サービスに送信することはありません。
          </li>
          <li>
            <strong>送信後の取り扱い：</strong>AI
            サービスが受け取ったデータは、会話の保存やモデルの学習への利用の有無を含め、当該サービス自身のプライバシーポリシーおよび規約に従って取り扱われます。当該サービスの設定をご確認ください。当社はお客様のデータを
            AI モデルの学習に使用しません。
          </li>
          <li>
            <strong>画像：</strong>AI
            サービスにウェブ上の画像をカードへ追加するよう依頼した場合、当社のサーバーはその画像をダウンロードし、出典 URL
            とともにお客様のカードの添付ファイルとして保存します。
          </li>
          <li>
            <strong>当社が保存するデータ：</strong>接続記録（AI
            サービス名、接続日時および最終利用日時）と、ハッシュ化したアクセス認証情報。お客様と AI
            サービスとの会話内容は保存しません。
          </li>
          <li>
            <strong>接続の解除：</strong>「設定 → AI
            コネクタ」からいつでも接続を解除でき、アクセスは直ちに無効になります。アカウントを削除した場合も接続記録は削除されます。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. 第三者サービス</h2>
        <p>当社は本サービスの運用のために、限られたプロバイダーを利用しています：</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Zeabur</strong> — ホスティングおよびデータベース基盤。
          </li>
          <li>
            <strong>Google</strong> —
            サインインおよび（連携する場合）カレンダー連携。
          </li>
          <li>
            <strong>Paddle</strong> — 決済処理（海外注文）。
          </li>
          <li>
            <strong>藍新金流（NewebPay）</strong> — 決済処理（台湾での注文）。
          </li>
          <li>
            <strong>Apple</strong> — アプリ配信およびプッシュ通知（iOS／macOS）。
          </li>
          <li>
            <strong>お客様が接続した AI サービス</strong>（Claude、ChatGPT
            など）— お客様が許可した場合のみ。第 6 節を参照。
          </li>
        </ul>
        <p>
          これらのプロバイダーは、本サービスの各機能を提供するために必要な範囲でのみデータを処理します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. データの保存</h2>
        <p>
          アカウントが有効である限り、当社はお客様のデータを保存します。アカウントを削除された場合、当社は{" "}
          <strong>30日以内</strong>
          にアカウントおよび関連コンテンツを完全に削除します。ただし、法的または会計上の義務を満たすために保持しなければならない限定的な記録（例：Paddle
          が保有する取引記録）は除きます。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. お客様の権利</h2>
        <p>
          お客様には、個人データへのアクセス、訂正、エクスポート、削除を行う権利があり、（EU／EEA／英国のユーザーの場合）特定の処理に異議を唱えまたは制限する権利、および現地のデータ保護機関に苦情を申し立てる権利があります。これらを行使するには、
          {mail}{" "}
          までメールをお送りください。アカウントおよび関連データの削除をご希望の場合は当社にご連絡いただければ、30日以内に対応します。また、「設定
          → カレンダー → 連携解除」からいつでも Google
          カレンダーの連携を解除でき（保存された OAuth
          トークンは即座に削除されます）、または {googlePerms}{" "}
          で直接アクセスを取り消すことができます。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. 国際的なデータ移転</h2>
        <p>
          当社は台湾で事業を運営しており、お客様の国外でデータを処理する可能性のあるプロバイダーを利用しています。必要な場合、当社はそうした移転について適切な保護措置を講じます。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. セキュリティ</h2>
        <p>
          当社は、通信の暗号化やアクセス制御を含む、合理的な技術的・組織的措置を講じてお客様のデータを保護します。Google
          OAuth
          のアクセストークンおよびリフレッシュトークンは、ディスクに書き込む前に
          AES-256-GCM
          で暗号化されます。通信または保存の方法で完全に安全なものはありませんが、当社はお客様の情報の保護に努め、バックアップを維持します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. 児童</h2>
        <p>
          本サービスは 16 歳未満の児童を対象としていません。当社は 16
          歳未満の児童から意図的にデータを収集することはありません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>13. 本ポリシーの変更</h2>
        <p>
          当社は本プライバシーポリシーを随時更新することがあります。重要な変更はメールまたはアプリ内で通知し、上記の「最終更新」日を更新することで反映します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14. お問い合わせ</h2>
        <p>
          <strong>量子躍遷有限公司（Quantum Leap Co., Ltd）</strong>
          <br />
          {ADDRESS_ZH}
          <br />
          Email：{mail}
        </p>
      </section>
    </>
  ),
};

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto max-w-3xl px-6 pt-24 pb-16 text-foreground">
      {CONTENT[locale] ?? CONTENT.en}
    </main>
  );
}
