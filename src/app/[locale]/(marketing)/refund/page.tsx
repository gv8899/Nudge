import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Nudge",
  description:
    "Nudge refund and cancellation policy, including a 14-day refund window",
};

const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS =
  "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED_EN = "June 20, 2026";
const LAST_UPDATED_ZH = "2026 年 6 月 20 日";
const LAST_UPDATED_JA = "2026年6月20日";

const mailLink = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
    {CONTACT_EMAIL}
  </a>
);

const paddleNet = (
  <a
    href="https://paddle.net"
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary underline"
  >
    paddle.net
  </a>
);

const h2 = "text-xl font-semibold border-b border-border pb-1";

const CONTENT: Record<string, React.ReactNode> = {
  en: (
    <>
      <h1 className="text-3xl font-bold mb-2">Refund &amp; Cancellation Policy</h1>
      <p className="text-sm text-text-dim mb-10">
        Last updated: {LAST_UPDATED_EN}
      </p>

      <section className="space-y-4 mb-12">
        <p>
          This Refund Policy applies to all purchases of Nudge{" "}
          subscriptions operated by <strong>Quantum Leap Co., Ltd</strong> (&quot;we&quot;,
          &quot;us&quot;). International orders are processed by our online
          reseller <strong>Paddle.com</strong>, which is the{" "}
          <strong>Merchant of Record</strong> for those orders and provides the
          related customer service and returns. Payments made in Taiwan are
          processed by <strong>NewebPay (藍新金流)</strong>; for those orders,{" "}
          Quantum Leap Co., Ltd is the seller of record and issues the invoice.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14-Day Refund Window</h2>
        <p>
          If you change your mind, you can request a refund within{" "}
          <strong>14 days</strong> of your purchase.
        </p>
        <p>
          Because Nudge is a digital service, this statutory right of
          withdrawal applies to your first purchase and while the Service has
          not yet been used. Under Paddle&apos;s terms, the right to withdraw no
          longer applies once you have started using Nudge after agreeing
          to immediate access at checkout.
        </p>
        <p>
          For subscriptions, the statutory right covers your first payment. Some
          renewals — for example annual subscriptions purchased in the UK —
          start a fresh 14-day window on renewal. We are also happy to consider
          good-faith refund requests on renewals on a case-by-case basis.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>How to Request a Refund</h2>
        <p>How you request a refund depends on how you paid.</p>
        <p>
          <strong>International orders (Paddle):</strong> because Paddle is the
          Merchant of Record, refunds are processed by Paddle. You can:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Email us at {mailLink} and we will arrange it with Paddle, or</li>
          <li>
            Contact Paddle directly via {paddleNet} (the contact details appear
            on the receipt Paddle emailed you), or
          </li>
          <li>Reply to your Paddle payment receipt.</li>
        </ol>
        <p>
          <strong>Taiwan orders (NewebPay):</strong> email us at {mailLink} and
          we will process your refund directly through NewebPay.
        </p>
        <p>
          For Paddle orders, Paddle reviews each request on a case-by-case
          basis. Submitting a request within the 14-day window does not by
          itself guarantee a refund.
        </p>
        <p>
          Approved refunds are issued to your original payment method, normally
          within 14 days of approval. The exact time to appear on your statement
          depends on your bank or card issuer.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>Cancelling Your Subscription</h2>
        <p>You can cancel your subscription at any time:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Monthly plan:</strong> cancellation stops the next monthly
            charge. You keep access until the end of the current paid month.
            Past months are non-refundable except under the 14-day window above.
          </li>
          <li>
            <strong>Annual plan:</strong> cancellation stops the next annual
            renewal. You keep access until the end of the current paid year.
            After the 14-day window, the remaining annual period is
            non-refundable unless required by applicable law.
          </li>
        </ul>
        <p>
          To cancel, email {mailLink} or use the subscription management link in
          your Paddle receipt.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>Exceptions</h2>
        <p>
          Refund requests are reviewed on a case-by-case basis. We may decline
          refunds in cases of suspected fraud, abuse of this policy (e.g.
          repeated refund requests), or violation of our{" "}
          <Link href="/terms" className="text-primary underline">
            Terms of Service
          </Link>
          . If a refund is issued, your access to Nudge ends.
        </p>
        <p>
          This policy does not affect any statutory rights you may have as a
          consumer under the laws of your country.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>Contact</h2>
        <p>
          <strong>Quantum Leap Co., Ltd</strong>
          <br />
          {ADDRESS}
          <br />
          Email: {mailLink}
        </p>
      </section>
    </>
  ),

  "zh-TW": (
    <>
      <h1 className="text-3xl font-bold mb-2">退款與取消政策</h1>
      <p className="text-sm text-text-dim mb-10">最後更新：{LAST_UPDATED_ZH}</p>

      <section className="space-y-4 mb-12">
        <p>
          本退款政策適用於所有由 <strong>量子躍遷有限公司</strong>
          （以下稱「我們」）營運之 Nudge 訂閱購買。國際訂單由線上經銷商{" "}
          <strong>Paddle.com</strong> 處理，
          <strong>Paddle.com 為該等訂單的登記商家（Merchant of Record）</strong>
          ，並負責相關客服與退款事宜。於台灣付款者由{" "}
          <strong>藍新金流（NewebPay）</strong> 處理，此類訂單由 量子躍遷有限公司{" "}
          為賣方並開立統一發票。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14 天退款期</h2>
        <p>
          若您改變心意，可於購買後 <strong>14 天內</strong>申請退款。
        </p>
        <p>
          由於 Nudge{" "}
          為數位服務，此法定解約權適用於您的首次購買，且以「尚未使用」為前提。依
          Paddle 條款，一旦您在結帳時同意立即開通並開始使用 Nudge
          ，即不再適用退款解約權。
        </p>
        <p>
          就訂閱而言，法定退款權保障您的首次付款；部分續訂（例如在 UK
          購買的年訂閱）會於續訂時另起 14
          天。對於善意的續訂退款個案，我們仍會逐案考量。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>如何申請退款</h2>
        <p>申請方式視您的付款管道而定。</p>
        <p>
          <strong>國際訂單（Paddle）：</strong>由於 Paddle 為登記商家，退款由
          Paddle 處理。您可以：
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>來信 {mailLink}，我們會協助向 Paddle 安排；或</li>
          <li>
            透過 {paddleNet} 直接聯繫 Paddle（聯絡資訊在 Paddle
            寄給您的收據上）；或
          </li>
          <li>直接回覆您的 Paddle 付款收據。</li>
        </ol>
        <p>
          <strong>台灣訂單（藍新金流）：</strong>請來信 {mailLink}
          ，我們會直接透過藍新金流為您辦理退款。
        </p>
        <p>
          就 Paddle 訂單而言，Paddle 會逐案審核每筆申請；於 14
          天內提出申請本身並不保證一定退款。
        </p>
        <p>
          退款核准後會退回原付款方式，通常於核准後 14
          天內完成，實際入帳時間視您的銀行或發卡機構而定。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>取消訂閱</h2>
        <p>您可隨時取消訂閱：</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>月方案：</strong>
            取消後不再收取下一期月費，並可使用至當期已付月份結束。已扣款月份除符合上述
            14 天退款期外，恕不退款。
          </li>
          <li>
            <strong>年方案：</strong>
            取消後不再收取下一年度續訂，並可使用至當期已付年度結束。超過 14
            天後，剩餘年度期間除法律另有規定外，恕不退款。
          </li>
        </ul>
        <p>
          取消方式：來信 {mailLink} 或使用 Paddle 收據中的訂閱管理連結。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>例外</h2>
        <p>
          所有退款申請將逐案審核。若涉及疑似詐欺、濫用本政策（例如重複申請退款）或違反{" "}
          <Link href="/terms" className="text-primary underline">
            服務條款
          </Link>
          ，我們保留拒絕退款之權利。若退款核准，您對 Nudge{" "}
          的存取權將隨之終止。本政策不影響您依所在國家消費者法律所享有的法定權利。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>聯絡我們</h2>
        <p>
          <strong>量子躍遷有限公司</strong>
          <br />
          {ADDRESS_ZH}
          <br />
          Email：{mailLink}
        </p>
      </section>
    </>
  ),

  ja: (
    <>
      <h1 className="text-3xl font-bold mb-2">返金・キャンセルポリシー</h1>
      <p className="text-sm text-text-dim mb-10">最終更新：{LAST_UPDATED_JA}</p>

      <section className="space-y-4 mb-12">
        <p>
          本返金ポリシーは、<strong>量子躍遷有限公司（Quantum Leap Co., Ltd、以下「当社」）</strong>
          が運営する Nudge{" "}
          のサブスクリプション購入すべてに適用されます。海外からの注文はオンライン再販業者{" "}
          <strong>Paddle.com</strong> が処理し、
          <strong>Paddle.com がそれらの注文の記録上の販売者（Merchant of Record）</strong>
          として、関連するカスタマーサポートおよび返金対応を行います。台湾でのお支払いは{" "}
          <strong>藍新金流（NewebPay）</strong> が処理し、それらの注文については{" "}
          量子躍遷有限公司 が販売者として請求書（統一発票）を発行します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>14日間の返金期間</h2>
        <p>
          お気が変わった場合、購入後 <strong>14日以内</strong>{" "}
          であれば返金を請求できます。
        </p>
        <p>
          Nudge{" "}
          はデジタルサービスであるため、この法定解約権は初回購入かつサービス未使用の場合に適用されます。Paddle
          の規約に基づき、チェックアウト時に即時アクセスに同意して Nudge{" "}
          の利用を開始した後は、解約権は適用されなくなります。
        </p>
        <p>
          サブスクリプションについては、法定の権利は初回のお支払いを対象とします。一部の更新（例：英国で購入した年間サブスクリプション）では、更新時に新たに
          14日間が開始します。更新分についても、誠意あるご要望は個別に検討します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>返金の請求方法</h2>
        <p>請求方法はお支払い方法によって異なります。</p>
        <p>
          <strong>海外注文（Paddle）：</strong>Paddle
          が記録上の販売者であるため、返金は Paddle
          が処理します。以下のいずれかが可能です：
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>{mailLink} までメールをお送りいただければ、当社が Paddle と手配します。</li>
          <li>
            {paddleNet} から Paddle に直接お問い合わせください（連絡先は Paddle
            からのレシートに記載されています）。
          </li>
          <li>Paddle の支払いレシートにご返信ください。</li>
        </ol>
        <p>
          <strong>台湾注文（藍新金流）：</strong>
          {mailLink} までメールをお送りください。NewebPay
          を通じて直接返金を処理します。
        </p>
        <p>
          Paddle 注文については、Paddle が各請求を個別に審査します。14日以内に請求しても、それ自体で返金が保証されるわけではありません。
        </p>
        <p>
          承認された返金は、通常、承認後14日以内に元のお支払い方法へ返金されます。明細に反映される正確な時期は、ご利用の銀行またはカード発行会社によります。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>サブスクリプションの解約</h2>
        <p>いつでもサブスクリプションを解約できます：</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>月額プラン：</strong>
            解約すると次回の月額課金が停止します。当期の支払い済み期間の終了までご利用いただけます。過去の月分は、上記の
            14日間の返金期間に該当する場合を除き、返金されません。
          </li>
          <li>
            <strong>年額プラン：</strong>
            解約すると次回の年間更新が停止します。当期の支払い済み年度の終了までご利用いただけます。14日間を過ぎた後は、残りの年間期間は法律で義務付けられる場合を除き返金されません。
          </li>
        </ul>
        <p>
          解約するには、{mailLink} までメールをお送りいただくか、Paddle
          のレシートにあるサブスクリプション管理リンクをご利用ください。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>例外</h2>
        <p>
          すべての返金請求は個別に審査します。詐欺の疑い、本ポリシーの濫用（例：繰り返しの返金請求）、または当社の{" "}
          <Link href="/terms" className="text-primary underline">
            利用規約
          </Link>
          {" "}違反がある場合、返金をお断りすることがあります。返金が行われた場合、Nudge{" "}
          へのアクセス権は終了します。本ポリシーは、お住まいの国の消費者法に基づきお客様が有する法定の権利に影響を与えるものではありません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>お問い合わせ</h2>
        <p>
          <strong>量子躍遷有限公司（Quantum Leap Co., Ltd）</strong>
          <br />
          {ADDRESS_ZH}
          <br />
          Email：{mailLink}
        </p>
      </section>
    </>
  ),
};

export default async function RefundPolicyPage({
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
