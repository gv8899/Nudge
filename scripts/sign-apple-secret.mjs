// AUTH_APPLE_SECRET 簽發：Apple client secret 是用 SIWA .p8 私鑰簽的
// ES256 JWT，效期上限 6 個月 — 到期前重跑本 script 更新 Zeabur env。
// 用法：node scripts/sign-apple-secret.mjs --key AuthKey_XXX.p8 --kid <KeyID> --iss <TeamID> --sub tw.nudge.web
import { SignJWT, importPKCS8 } from "jose";
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);
const missing = ["key", "kid", "iss", "sub"].filter((k) => !args[k]);
if (missing.length) {
  console.error(`缺參數：${missing.map((m) => `--${m}`).join(" ")}`);
  process.exit(1);
}

const pk = await importPKCS8(readFileSync(args.key, "utf8"), "ES256");
const jwt = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: args.kid })
  .setIssuer(args.iss)
  .setIssuedAt()
  .setExpirationTime("180d")
  .setAudience("https://appleid.apple.com")
  .setSubject(args.sub)
  .sign(pk);
console.log(jwt);
