import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Nudge",
  description: "Nudge refund and cancellation policy, including a 14-day refund window",
};

const APP_NAME = "Nudge";
const COMPANY = "Quantum Leap Co., Ltd";
const COMPANY_ZH = "量子躍遷有限公司";
const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS = "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED = "June 20, 2026";
const LAST_UPDATED_ZH = "2026 年 6 月 20 日";

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold mb-2">Refund &amp; Cancellation Policy</h1>
      <p className="text-sm text-text-dim mb-10">Last updated: {LAST_UPDATED}</p>

      <section className="space-y-4 mb-12">
        <p>
          This Refund Policy applies to all purchases of {APP_NAME} subscriptions
          operated by <strong>{COMPANY}</strong> (&quot;we&quot;, &quot;us&quot;).
          International orders are processed by our online reseller{" "}
          <strong>Paddle.com</strong>, which is the{" "}
          <strong>Merchant of Record</strong> for those orders and provides the
          related customer service and returns. Payments made in Taiwan are
          processed by <strong>NewebPay (藍新金流)</strong>; for those orders,{" "}
          {COMPANY} is the seller of record and issues the invoice.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          14-Day Refund Window
        </h2>
        <p>
          If you change your mind, you can request a refund within{" "}
          <strong>14 days</strong> of your purchase.
        </p>
        <p>
          Because {APP_NAME} is a digital service, this statutory right of
          withdrawal applies to your first purchase and while the Service has not
          yet been used. Under Paddle&apos;s terms, the right to withdraw no longer
          applies once you have started using {APP_NAME} after agreeing to
          immediate access at checkout.
        </p>
        <p>
          For subscriptions, the statutory right covers your first payment. Some
          renewals — for example annual subscriptions purchased in the UK — start a
          fresh 14-day window on renewal. We are also happy to consider good-faith
          refund requests on renewals on a case-by-case basis.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          How to Request a Refund
        </h2>
        <p>How you request a refund depends on how you paid.</p>
        <p>
          <strong>International orders (Paddle):</strong> because Paddle is the
          Merchant of Record, refunds are processed by Paddle. You can:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            Email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
              {CONTACT_EMAIL}
            </a>{" "}
            and we will arrange it with Paddle, or
          </li>
          <li>
            Contact Paddle directly via{" "}
            <a
              href="https://paddle.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              paddle.net
            </a>{" "}
            (the contact details appear on the receipt Paddle emailed you), or
          </li>
          <li>Reply to your Paddle payment receipt.</li>
        </ol>
        <p>
          <strong>Taiwan orders (NewebPay):</strong> email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>{" "}
          and we will process your refund directly through NewebPay.
        </p>
        <p>
          For Paddle orders, Paddle reviews each request on a case-by-case basis.
          Submitting a request within the 14-day window does not by itself guarantee
          a refund.
        </p>
        <p>
          Approved refunds are issued to your original payment method, normally
          within 14 days of approval. The exact time to appear on your statement
          depends on your bank or card issuer.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Cancelling Your Subscription
        </h2>
        <p>You can cancel your subscription at any time:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Monthly plan:</strong> cancellation stops the next monthly
            charge. You keep access until the end of the current paid month. Past
            months are non-refundable except under the 14-day window above.
          </li>
          <li>
            <strong>Annual plan:</strong> cancellation stops the next annual
            renewal. You keep access until the end of the current paid year. After
            the 14-day window, the remaining annual period is non-refundable unless
            required by applicable law.
          </li>
        </ul>
        <p>
          To cancel, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>{" "}
          or use the subscription management link in your Paddle receipt.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Exceptions
        </h2>
        <p>
          Refund requests are reviewed on a case-by-case basis. We may decline
          refunds in cases of suspected fraud, abuse of this policy (e.g. repeated
          refund requests), or violation of our{" "}
          <Link href="/terms" className="text-primary underline">
            Terms of Service
          </Link>
          . If a refund is issued, your access to {APP_NAME} ends.
        </p>
        <p>
          This policy does not affect any statutory rights you may have as a consumer
          under the laws of your country.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className="text-xl font-semibold border-b border-border pb-1">
          Contact
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
        <h2 className="text-2xl font-bold">退款與取消政策</h2>
        <p className="text-sm text-text-dim">最後更新：{LAST_UPDATED_ZH}</p>
        <p>
          本退款政策適用於所有由 <strong>{COMPANY_ZH}</strong>（以下稱「我們」）營運之
          {APP_NAME} 訂閱購買。國際訂單由線上經銷商 <strong>Paddle.com</strong> 處理，
          <strong>Paddle.com 為該等訂單的登記商家（Merchant of Record）</strong>
          ，並負責相關客服與退款事宜。於台灣付款者由 <strong>藍新金流（NewebPay）</strong>
          處理，此類訂單由 {COMPANY_ZH} 為賣方並開立統一發票。
        </p>

        <h3 className="font-semibold mt-6">14 天退款期</h3>
        <p>
          若您改變心意，可於購買後 <strong>14 天內</strong>申請退款。
        </p>
        <p>
          由於 {APP_NAME} 為數位服務，此法定解約權適用於您的首次購買，且以「尚未使用」為前提。依
          Paddle 條款，一旦您在結帳時同意立即開通並開始使用 {APP_NAME}，即不再適用退款解約權。
        </p>
        <p>
          就訂閱而言，法定退款權保障您的首次付款；部分續訂（例如在 UK 購買的年訂閱）會於續訂時另起
          14 天。對於善意的續訂退款個案，我們仍會逐案考量。
        </p>

        <h3 className="font-semibold mt-6">如何申請退款</h3>
        <p>申請方式視您的付款管道而定。</p>
        <p>
          <strong>國際訂單（Paddle）：</strong>由於 Paddle 為登記商家，退款由 Paddle 處理。您可以：
        </p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>
            來信{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
              {CONTACT_EMAIL}
            </a>
            ，我們會協助向 Paddle 安排；或
          </li>
          <li>
            透過{" "}
            <a
              href="https://paddle.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              paddle.net
            </a>{" "}
            直接聯繫 Paddle（聯絡資訊在 Paddle 寄給您的收據上）；或
          </li>
          <li>直接回覆您的 Paddle 付款收據。</li>
        </ol>
        <p>
          <strong>台灣訂單（藍新金流）：</strong>請來信{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>
          ，我們會直接透過藍新金流為您辦理退款。
        </p>
        <p>就 Paddle 訂單而言，Paddle 會逐案審核每筆申請；於 14 天內提出申請本身並不保證一定退款。</p>
        <p>
          退款核准後會退回原付款方式，通常於核准後 14 天內完成，實際入帳時間視您的銀行或發卡機構而定。
        </p>

        <h3 className="font-semibold mt-6">取消訂閱</h3>
        <p>您可隨時取消訂閱：</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>月方案：</strong>
            取消後不再收取下一期月費，並可使用至當期已付月份結束。已扣款月份除符合上述 14 天退款期外，恕不退款。
          </li>
          <li>
            <strong>年方案：</strong>
            取消後不再收取下一年度續訂，並可使用至當期已付年度結束。超過 14 天後，剩餘年度期間除法律另有規定外，恕不退款。
          </li>
        </ul>
        <p>
          取消方式：來信{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
            {CONTACT_EMAIL}
          </a>{" "}
          或使用 Paddle 收據中的訂閱管理連結。
        </p>

        <h3 className="font-semibold mt-6">例外</h3>
        <p>
          所有退款申請將逐案審核。若涉及疑似詐欺、濫用本政策（例如重複申請退款）或違反{" "}
          <Link href="/terms" className="text-primary underline">
            服務條款
          </Link>
          ，我們保留拒絕退款之權利。若退款核准，您對 {APP_NAME} 的存取權將隨之終止。本政策不影響您依所在國家消費者法律所享有的法定權利。
        </p>

        <h3 className="font-semibold mt-6">聯絡我們</h3>
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
