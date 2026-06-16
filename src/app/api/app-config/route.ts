import { NextResponse } from "next/server";

// 給原生 app 啟動時查詢的公開設定。
//
// minMacBuild / minIosBuild = 「最低支援 build 號」，做版本硬閘用：
// app 自身的 CURRENT_PROJECT_VERSION 低於它就擋住主畫面、強制更新。
// 值來自環境變數，改它不必改 app（Zeabur 改 env 即可生效）；未設 = 0 = 不擋。
//
// Mac 自動更新走 Sparkle（軟更新）；此 endpoint 是硬閘那一層。
export function GET() {
  const minMacBuild = Number(process.env.NUDGE_MIN_MAC_BUILD ?? 0) || 0;
  const minIosBuild = Number(process.env.NUDGE_MIN_IOS_BUILD ?? 0) || 0;

  return NextResponse.json(
    { minMacBuild, minIosBuild },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
