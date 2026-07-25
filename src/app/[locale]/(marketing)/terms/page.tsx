import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Terms of Service — Nudge",
  description: "Nudge terms of service",
};

const CONTACT_EMAIL = "mike@nudge.tw";
const ADDRESS =
  "5F., No. 47, Qingfeng Rd. Sec. 1, Zhongli Dist., Taoyuan City 320, Taiwan";
const ADDRESS_ZH = "320 桃園市中壢區青峰路一段 47 號 5 樓";
const LAST_UPDATED_EN = "June 20, 2026";
const LAST_UPDATED_ZH = "2026 年 6 月 20 日";
const LAST_UPDATED_JA = "2026年6月20日";

const h2 = "text-xl font-semibold border-b border-border pb-1";

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
    {CONTACT_EMAIL}
  </a>
);
const refundLink = (label: string) => (
  <Link href="/refund" className="text-primary underline">
    {label}
  </Link>
);
const privacyLink = (label: string) => (
  <Link href="/privacy" className="text-primary underline">
    {label}
  </Link>
);

const CONTENT: Record<string, React.ReactNode> = {
  en: (
    <>
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-text-dim mb-10">
        Last updated: {LAST_UPDATED_EN}
      </p>

      <section className="space-y-4 mb-12">
        <p>
          Welcome to Nudge. These Terms of Service (&quot;Terms&quot;) govern
          your access to and use of the Nudge app and website (the
          &quot;Service&quot;). The Service is operated by{" "}
          <strong>Quantum Leap Co., Ltd</strong> (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;), a company registered in Taiwan. By creating an
          account or using the Service, you agree to these Terms.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. The Service</h2>
        <p>
          Nudge is a personal task and journaling app available on the web, iOS,
          and macOS. We continuously improve the Service and may add, change, or
          remove features over time. We will give reasonable notice of material
          changes that significantly affect paid subscribers.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>2. Your Account</h2>
        <p>
          You must provide accurate information when creating an account and are
          responsible for activity under your account. You must be at least 16
          years old, or the age of digital consent in your country, to use the
          Service. Keep your login credentials secure.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. Subscriptions, Billing &amp; Payment</h2>
        <p>
          Nudge offers <strong>monthly and annual subscriptions</strong>.
          Pricing is shown at checkout.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            For international orders, our order process and payments are handled
            by our online reseller <strong>Paddle.com</strong>.{" "}
            <strong>Paddle.com is the Merchant of Record</strong> for those
            orders, meaning Paddle is the seller of record and handles billing,
            payment, invoicing, and related customer service.
          </li>
          <li>
            For purchases made in Taiwan, payments are processed by{" "}
            <strong>NewebPay (藍新金流)</strong>. For those orders, Quantum Leap
            Co., Ltd is the seller of record, issues the invoice, and handles
            applicable Taiwan taxes.
          </li>
          <li>
            Subscriptions renew automatically at the end of each billing period
            (monthly or annually) unless cancelled before the renewal date.
          </li>
          <li>
            You can cancel at any time; cancellation takes effect at the end of
            your current paid period.
          </li>
          <li>
            Refunds are governed by our {refundLink("Refund Policy")}, which
            includes a 14-day refund window.
          </li>
          <li>
            Applicable taxes (such as VAT or sales tax) are calculated and
            handled by Paddle at checkout.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. Acceptable Use</h2>
        <p>
          You agree not to misuse the Service, including: attempting to access
          other users&apos; data, reverse engineering or disrupting the Service,
          using it for unlawful purposes, or infringing others&apos; rights. We
          may suspend or terminate accounts that violate these Terms.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. Your Content</h2>
        <p>
          You retain ownership of the tasks, notes, and other content you create
          in Nudge (&quot;Your Content&quot;). You grant us a limited licence to
          store and process Your Content solely to provide the Service. We do not
          sell Your Content. Our handling of personal data is described in our{" "}
          {privacyLink("Privacy Policy")}.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. Intellectual Property</h2>
        <p>
          The Service, including its software, design, and branding, is owned by
          Quantum Leap Co., Ltd and protected by applicable laws. These Terms do
          not grant you any rights to our trademarks or branding.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. Availability &amp; Disclaimers</h2>
        <p>
          We aim to keep the Service available and reliable, and we maintain
          backups of your data. However, the Service is provided &quot;as
          is&quot; without warranties of any kind to the maximum extent permitted
          by law. We do not warrant that the Service will be uninterrupted or
          error-free.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Quantum Leap Co., Ltd will not
          be liable for any indirect, incidental, or consequential damages, or
          for loss of data or profits, arising from your use of the Service.
          Nothing in these Terms limits liability that cannot be limited under
          applicable law, including your statutory consumer rights.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. Termination</h2>
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate your access if you breach these Terms. On
          termination, your right to use the Service ends; you may request export
          or deletion of Your Content as described in the Privacy Policy.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. If we make material
          changes, we will notify you by email or in-app. Continued use of the
          Service after changes take effect constitutes acceptance.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of Taiwan (R.O.C.), without regard
          to conflict-of-law rules. This does not deprive you of any mandatory
          consumer protections in your country of residence.
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. Contact</h2>
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
      <h1 className="text-3xl font-bold mb-2">服務條款</h1>
      <p className="text-sm text-text-dim mb-10">最後更新：{LAST_UPDATED_ZH}</p>

      <section className="space-y-4 mb-12">
        <p>
          歡迎使用 Nudge。本服務條款（下稱「條款」）規範您對 Nudge App
          與網站（下稱「本服務」）的使用。本服務由在台灣登記之{" "}
          <strong>量子躍遷有限公司</strong>
          （下稱「我們」）營運。當您建立帳號或使用本服務，即表示同意本條款。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. 本服務</h2>
        <p>
          Nudge 是一款跨 Web、iOS、macOS
          的個人任務與日誌 App。我們會持續改善本服務，並可能新增、變更或移除功能；若有重大且明顯影響付費訂閱者的變更，將提供合理通知。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>2. 您的帳號</h2>
        <p>
          建立帳號時請提供正確資訊，並對帳號下的活動負責。您須年滿 16
          歲（或您所在國家之數位同意年齡）方可使用。請妥善保管登入憑證。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. 訂閱、帳單與付款</h2>
        <p>
          Nudge 提供<strong>月訂閱與年訂閱</strong>，價格於結帳時顯示。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            國際訂單之訂單與付款由線上經銷商 <strong>Paddle.com</strong> 處理，
            <strong>Paddle.com 為該等訂單之登記商家（Merchant of Record）</strong>
            ，負責帳單、付款、發票與相關客服。
          </li>
          <li>
            於台灣付款者，由 <strong>藍新金流（NewebPay）</strong>{" "}
            處理；此類訂單由 量子躍遷有限公司 為賣方、開立統一發票並處理相關台灣稅金。
          </li>
          <li>訂閱於每期（月或年）結束時自動續訂，除非您於續訂日前取消。</li>
          <li>您可隨時取消，取消於當期已付期間結束時生效。</li>
          <li>
            退款依我們的 {refundLink("退款政策")}，包含 14 天退款期。
          </li>
          <li>相關稅金（如 VAT 或銷售稅）由 Paddle 於結帳時計算處理。</li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. 可接受使用</h2>
        <p>
          您同意不濫用本服務，包括：試圖存取他人資料、逆向工程或干擾本服務、用於不法目的、或侵害他人權利。違反者我們得暫停或終止其帳號。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. 您的內容</h2>
        <p>
          您保有在 Nudge
          建立之任務、筆記等內容（下稱「您的內容」）之所有權。您授予我們有限授權，僅為提供本服務而儲存與處理您的內容。我們不會出售您的內容。個資處理方式詳見{" "}
          {privacyLink("隱私權政策")}。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. 智慧財產權</h2>
        <p>
          本服務（含軟體、設計與品牌）為 量子躍遷有限公司
          所有並受法律保護。本條款不授予您任何商標或品牌權利。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. 可用性與免責</h2>
        <p>
          我們致力維持服務穩定可用並保有資料備份。惟在法律允許之最大範圍內，本服務以「現狀」提供、不附任何明示或默示擔保，亦不保證服務不中斷或無錯誤。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. 責任限制</h2>
        <p>
          在法律允許之最大範圍內，量子躍遷有限公司
          不對因使用本服務所生之任何間接、附帶或衍生損害，或資料、利潤之損失負責。本條款不限制依法不得限制之責任，包括您的法定消費者權利。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. 終止</h2>
        <p>
          您可隨時停止使用並刪除帳號。若您違反本條款，我們得暫停或終止您的存取。終止後您使用本服務之權利即終止；您可依隱私權政策要求匯出或刪除您的內容。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. 條款變更</h2>
        <p>
          我們可能不時更新本條款。若有重大變更，將以電子郵件或 App
          內通知您。變更生效後您繼續使用即視為接受。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. 準據法</h2>
        <p>
          本條款依中華民國（台灣）法律解釋，惟不剝奪您所在居住國之強制性消費者保護。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. 聯絡我們</h2>
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
      <h1 className="text-3xl font-bold mb-2">利用規約</h1>
      <p className="text-sm text-text-dim mb-10">最終更新：{LAST_UPDATED_JA}</p>

      <section className="space-y-4 mb-12">
        <p>
          Nudge をご利用いただきありがとうございます。本利用規約（以下「本規約」）は、お客様による
          Nudge のアプリおよびウェブサイト（以下「本サービス」）へのアクセスおよび利用について定めるものです。本サービスは、台湾で登記された{" "}
          <strong>量子躍遷有限公司（Quantum Leap Co., Ltd、以下「当社」）</strong>
          が運営します。アカウントを作成するか本サービスを利用することにより、お客様は本規約に同意したものとみなされます。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>1. 本サービス</h2>
        <p>
          Nudge は、ウェブ、iOS、macOS
          で利用できる個人向けのタスク・ジャーナリングアプリです。当社は本サービスを継続的に改善し、機能を追加、変更、または削除することがあります。有料会員に重大な影響を及ぼす重要な変更については、合理的な事前通知を行います。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>2. アカウント</h2>
        <p>
          アカウント作成時には正確な情報をご提供いただく必要があり、お客様はご自身のアカウントでの活動について責任を負います。本サービスをご利用いただくには、16
          歳以上、またはお住まいの国におけるデジタル同意年齢に達している必要があります。ログイン認証情報は安全に管理してください。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>3. サブスクリプション・請求・お支払い</h2>
        <p>
          Nudge は<strong>月額および年額のサブスクリプション</strong>
          を提供します。価格は決済時に表示されます。
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            海外注文については、注文処理およびお支払いは当社のオンライン再販業者である{" "}
            <strong>Paddle.com</strong> が処理します。
            <strong>Paddle.com がそれらの注文の記録上の販売者（Merchant of Record）</strong>
            であり、請求、支払い、請求書発行、および関連するカスタマーサポートを行います。
          </li>
          <li>
            台湾での購入については、お支払いは{" "}
            <strong>藍新金流（NewebPay）</strong> が処理します。それらの注文については、量子躍遷有限公司
            が販売者として請求書（統一発票）を発行し、該当する台湾の税金を処理します。
          </li>
          <li>
            サブスクリプションは、更新日前に解約されない限り、各請求期間（月次または年次）の終了時に自動的に更新されます。
          </li>
          <li>
            いつでも解約でき、解約は当期の支払い済み期間の終了時に有効となります。
          </li>
          <li>
            返金は、14日間の返金期間を含む当社の {refundLink("返金ポリシー")}{" "}
            に準拠します。
          </li>
          <li>
            該当する税金（VAT や売上税など）は、決済時に Paddle が計算・処理します。
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>4. 許容される利用</h2>
        <p>
          お客様は本サービスを濫用しないことに同意します。これには、他のユーザーのデータへのアクセスの試み、本サービスのリバースエンジニアリングまたは妨害、違法な目的での利用、または他者の権利の侵害が含まれます。当社は本規約に違反するアカウントを停止または終了することがあります。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>5. お客様のコンテンツ</h2>
        <p>
          お客様は、Nudge
          で作成したタスク、ノート、その他のコンテンツ（以下「お客様のコンテンツ」）の所有権を保持します。お客様は当社に対し、本サービスの提供のためにのみお客様のコンテンツを保存・処理する限定的なライセンスを付与します。当社はお客様のコンテンツを販売しません。個人データの取り扱いについては、当社の{" "}
          {privacyLink("プライバシーポリシー")} に記載しています。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>6. 知的財産権</h2>
        <p>
          本サービス（そのソフトウェア、デザイン、ブランディングを含む）は 量子躍遷有限公司
          が所有し、適用される法律により保護されています。本規約は、当社の商標またはブランディングに関するいかなる権利もお客様に付与するものではありません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>7. 可用性および免責事項</h2>
        <p>
          当社は本サービスを利用可能かつ信頼できる状態に保つよう努め、お客様のデータのバックアップを維持します。ただし、法律で認められる最大限の範囲において、本サービスはいかなる種類の保証もなく「現状のまま」提供されます。当社は、本サービスが中断されないこと、またはエラーがないことを保証しません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>8. 責任の制限</h2>
        <p>
          法律で認められる最大限の範囲において、量子躍遷有限公司
          は、お客様による本サービスの利用に起因する間接的、付随的、または結果的な損害、あるいはデータや利益の損失について責任を負いません。本規約のいかなる規定も、お客様の法定消費者権利を含む、適用される法律の下で制限できない責任を制限するものではありません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>9. 終了</h2>
        <p>
          お客様はいつでも本サービスの利用を停止し、アカウントを削除できます。お客様が本規約に違反した場合、当社はアクセスを停止または終了することがあります。終了時には、本サービスを利用する権利は終了します。お客様は、プライバシーポリシーに記載のとおり、お客様のコンテンツのエクスポートまたは削除を請求できます。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>10. 本規約の変更</h2>
        <p>
          当社は本規約を随時更新することがあります。重要な変更を行う場合は、メールまたはアプリ内で通知します。変更が有効になった後も本サービスを継続して利用することは、変更への同意を構成します。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>11. 準拠法</h2>
        <p>
          本規約は、抵触法の規則にかかわらず、台湾（中華民国）の法律に準拠します。これは、お客様の居住国における強行的な消費者保護をお客様から奪うものではありません。
        </p>
      </section>

      <section className="space-y-4 mb-12">
        <h2 className={h2}>12. お問い合わせ</h2>
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

export default async function TermsOfServicePage({
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
