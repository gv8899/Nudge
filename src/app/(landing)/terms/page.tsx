import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Nudge",
  description: "Nudge terms of service",
};

const APP_NAME = "Nudge";
const COMPANY = "Quantum Leap Co., Ltd";
const COMPANY_ZH = "量子躍遷有限公司";
const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS = "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED = "June 20, 2026";
const LAST_UPDATED_ZH = "2026 年 6 月 20 日";

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-text-dim mb-10">Last updated: {LAST_UPDATED}</p>

      <section className="space-y-4 mb-12">
        <p>
          Welcome to {APP_NAME}. These Terms of Service (&quot;Terms&quot;) govern
          your access to and use of the {APP_NAME} app and website (the
          &quot;Service&quot;). The Service is operated by <strong>{COMPANY}</strong>{" "}
          (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), a company registered in
          Taiwan. By creating an account or using the Service, you agree to these
          Terms.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          1. The Service
        </h2>
        <p>
          {APP_NAME} is a personal task and journaling app available on the web,
          iOS, and macOS. We continuously improve the Service and may add, change,
          or remove features over time. We will give reasonable notice of material
          changes that significantly affect paid subscribers.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          2. Your Account
        </h2>
        <p>
          You must provide accurate information when creating an account and are
          responsible for activity under your account. You must be at least 16 years
          old, or the age of digital consent in your country, to use the Service.
          Keep your login credentials secure.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          3. Subscriptions, Billing &amp; Payment
        </h2>
        <p>
          {APP_NAME} offers <strong>monthly and annual subscriptions</strong>.
          Pricing is shown at checkout.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            For international orders, our order process and payments are handled by
            our online reseller <strong>Paddle.com</strong>.{" "}
            <strong>Paddle.com is the Merchant of Record</strong> for those orders,
            meaning Paddle is the seller of record and handles billing, payment,
            invoicing, and related customer service.
          </li>
          <li>
            For purchases made in Taiwan, payments are processed by{" "}
            <strong>NewebPay (藍新金流)</strong>. For those orders, {COMPANY} is the
            seller of record, issues the invoice, and handles applicable Taiwan
            taxes.
          </li>
          <li>
            Subscriptions renew automatically at the end of each billing period
            (monthly or annually) unless cancelled before the renewal date.
          </li>
          <li>
            You can cancel at any time; cancellation takes effect at the end of your
            current paid period.
          </li>
          <li>
            Refunds are governed by our{" "}
            <Link href="/refund" className="text-primary underline">
              Refund Policy
            </Link>
            , which includes a 14-day refund window.
          </li>
          <li>
            Applicable taxes (such as VAT or sales tax) are calculated and handled
            by Paddle at checkout.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          4. Acceptable Use
        </h2>
        <p>
          You agree not to misuse the Service, including: attempting to access other
          users&apos; data, reverse engineering or disrupting the Service, using it
          for unlawful purposes, or infringing others&apos; rights. We may suspend or
          terminate accounts that violate these Terms.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          5. Your Content
        </h2>
        <p>
          You retain ownership of the tasks, notes, and other content you create in
          {" "}
          {APP_NAME} (&quot;Your Content&quot;). You grant us a limited licence to
          store and process Your Content solely to provide the Service. We do not
          sell Your Content. Our handling of personal data is described in our{" "}
          <Link href="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          6. Intellectual Property
        </h2>
        <p>
          The Service, including its software, design, and branding, is owned by{" "}
          {COMPANY} and protected by applicable laws. These Terms do not grant you
          any rights to our trademarks or branding.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          7. Availability &amp; Disclaimers
        </h2>
        <p>
          We aim to keep the Service available and reliable, and we maintain backups
          of your data. However, the Service is provided &quot;as is&quot; without
          warranties of any kind to the maximum extent permitted by law. We do not
          warrant that the Service will be uninterrupted or error-free.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          8. Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted by law, {COMPANY} will not be liable for
          any indirect, incidental, or consequential damages, or for loss of data or
          profits, arising from your use of the Service. Nothing in these Terms
          limits liability that cannot be limited under applicable law, including
          your statutory consumer rights.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          9. Termination
        </h2>
        <p>
          You may stop using the Service and delete your account at any time. We may
          suspend or terminate your access if you breach these Terms. On termination,
          your right to use the Service ends; you may request export or deletion of
          Your Content as described in the Privacy Policy.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          10. Changes to These Terms
        </h2>
        <p>
          We may update these Terms from time to time. If we make material changes,
          we will notify you by email or in-app. Continued use of the Service after
          changes take effect constitutes acceptance.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          11. Governing Law
        </h2>
        <p>
          These Terms are governed by the laws of Taiwan (R.O.C.), without regard to
          conflict-of-law rules. This does not deprive you of any mandatory consumer
          protections in your country of residence.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          12. Contact
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
        <h2 className="text-2xl font-bold">服務條款</h2>
        <p className="text-sm text-text-dim">最後更新：{LAST_UPDATED_ZH}</p>
        <p>
          歡迎使用 {APP_NAME}。本服務條款（下稱「條款」）規範您對 {APP_NAME} App
          與網站（下稱「本服務」）的使用。本服務由在台灣登記之 <strong>{COMPANY_ZH}</strong>
          （下稱「我們」）營運。當您建立帳號或使用本服務，即表示同意本條款。
        </p>

        <h3 className="font-semibold mt-6">1. 本服務</h3>
        <p>
          {APP_NAME} 是一款跨 Web、iOS、macOS
          的個人任務與日誌 App。我們會持續改善本服務，並可能新增、變更或移除功能；若有重大且明顯影響付費訂閱者的變更，將提供合理通知。
        </p>

        <h3 className="font-semibold mt-6">2. 您的帳號</h3>
        <p>
          建立帳號時請提供正確資訊，並對帳號下的活動負責。您須年滿 16
          歲（或您所在國家之數位同意年齡）方可使用。請妥善保管登入憑證。
        </p>

        <h3 className="font-semibold mt-6">3. 訂閱、帳單與付款</h3>
        <p>{APP_NAME} 提供<strong>月訂閱與年訂閱</strong>，價格於結帳時顯示。</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            國際訂單之訂單與付款由線上經銷商 <strong>Paddle.com</strong> 處理，
            <strong>Paddle.com 為該等訂單之登記商家（Merchant of Record）</strong>
            ，負責帳單、付款、發票與相關客服。
          </li>
          <li>
            於台灣付款者，由 <strong>藍新金流（NewebPay）</strong> 處理；此類訂單由
            {COMPANY_ZH} 為賣方、開立統一發票並處理相關台灣稅金。
          </li>
          <li>訂閱於每期（月或年）結束時自動續訂，除非您於續訂日前取消。</li>
          <li>您可隨時取消，取消於當期已付期間結束時生效。</li>
          <li>
            退款依我們的{" "}
            <Link href="/refund" className="text-primary underline">
              退款政策
            </Link>
            ，包含 14 天退款期。
          </li>
          <li>相關稅金（如 VAT 或銷售稅）由 Paddle 於結帳時計算處理。</li>
        </ul>

        <h3 className="font-semibold mt-6">4. 可接受使用</h3>
        <p>
          您同意不濫用本服務，包括：試圖存取他人資料、逆向工程或干擾本服務、用於不法目的、或侵害他人權利。違反者我們得暫停或終止其帳號。
        </p>

        <h3 className="font-semibold mt-6">5. 您的內容</h3>
        <p>
          您保有在 {APP_NAME}
          建立之任務、筆記等內容（下稱「您的內容」）之所有權。您授予我們有限授權，僅為提供本服務而儲存與處理您的內容。我們不會出售您的內容。個資處理方式詳見{" "}
          <Link href="/privacy" className="text-primary underline">
            隱私權政策
          </Link>
          。
        </p>

        <h3 className="font-semibold mt-6">6. 智慧財產權</h3>
        <p>
          本服務（含軟體、設計與品牌）為 {COMPANY_ZH}
          所有並受法律保護。本條款不授予您任何商標或品牌權利。
        </p>

        <h3 className="font-semibold mt-6">7. 可用性與免責</h3>
        <p>
          我們致力維持服務穩定可用並保有資料備份。惟在法律允許之最大範圍內，本服務以「現狀」提供、不附任何明示或默示擔保，亦不保證服務不中斷或無錯誤。
        </p>

        <h3 className="font-semibold mt-6">8. 責任限制</h3>
        <p>
          在法律允許之最大範圍內，{COMPANY_ZH}
          不對因使用本服務所生之任何間接、附帶或衍生損害，或資料、利潤之損失負責。本條款不限制依法不得限制之責任，包括您的法定消費者權利。
        </p>

        <h3 className="font-semibold mt-6">9. 終止</h3>
        <p>
          您可隨時停止使用並刪除帳號。若您違反本條款，我們得暫停或終止您的存取。終止後您使用本服務之權利即終止；您可依隱私權政策要求匯出或刪除您的內容。
        </p>

        <h3 className="font-semibold mt-6">10. 條款變更</h3>
        <p>
          我們可能不時更新本條款。若有重大變更，將以電子郵件或 App
          內通知您。變更生效後您繼續使用即視為接受。
        </p>

        <h3 className="font-semibold mt-6">11. 準據法</h3>
        <p>
          本條款依中華民國（台灣）法律解釋，惟不剝奪您所在居住國之強制性消費者保護。
        </p>

        <h3 className="font-semibold mt-6">12. 聯絡我們</h3>
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
