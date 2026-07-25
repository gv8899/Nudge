import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ipInCidr,
  ipAllowed,
  clientIpFromForwarded,
  paddleAllowedCidrs,
  checkPaddleSourceIp,
  __resetAllowlistCache,
} from "./allowlist";

// 對照真實 live IP（api.paddle.com/ips 抓到的其中幾個，全 /32）。
const LIVE = ["34.237.3.244/32", "34.195.105.136/32", "52.11.166.252/32"];

function mockFetch(payload: unknown, ok = true, status = 200) {
  let calls = 0;
  const fn = async () => {
    calls++;
    return { ok, status, json: async () => payload };
  };
  return Object.assign(fn, { calls: () => calls });
}

describe("ipInCidr", () => {
  it("/32 精確比對", () => {
    expect(ipInCidr("34.237.3.244", "34.237.3.244/32")).toBe(true);
    expect(ipInCidr("34.237.3.245", "34.237.3.244/32")).toBe(false);
  });
  it("較寬的前綴涵蓋範圍", () => {
    expect(ipInCidr("10.1.2.3", "10.1.0.0/16")).toBe(true);
    expect(ipInCidr("10.2.2.3", "10.1.0.0/16")).toBe(false);
    expect(ipInCidr("192.168.1.5", "192.168.1.0/24")).toBe(true);
    expect(ipInCidr("192.168.2.5", "192.168.1.0/24")).toBe(false);
  });
  it("/0 涵蓋全部", () => {
    expect(ipInCidr("1.2.3.4", "0.0.0.0/0")).toBe(true);
  });
  it("無 mask 視為 /32", () => {
    expect(ipInCidr("34.237.3.244", "34.237.3.244")).toBe(true);
  });
  it("壞輸入回 false，不丟例外", () => {
    expect(ipInCidr("not-an-ip", "34.237.3.244/32")).toBe(false);
    expect(ipInCidr("34.237.3.244", "garbage")).toBe(false);
    expect(ipInCidr("999.1.1.1", "0.0.0.0/0")).toBe(false);
    expect(ipInCidr("34.237.3.244", "34.237.3.244/40")).toBe(false);
  });
});

describe("ipAllowed", () => {
  it("命中清單任一 CIDR 即 true", () => {
    expect(ipAllowed("52.11.166.252", LIVE)).toBe(true);
    expect(ipAllowed("8.8.8.8", LIVE)).toBe(false);
  });
});

describe("clientIpFromForwarded", () => {
  it("取最左 IP 並 trim", () => {
    expect(clientIpFromForwarded("34.237.3.244, 10.0.0.1, 10.0.0.2")).toBe("34.237.3.244");
    expect(clientIpFromForwarded(" 52.11.166.252 ")).toBe("52.11.166.252");
  });
  it("空/ null 回 null", () => {
    expect(clientIpFromForwarded(null)).toBe(null);
    expect(clientIpFromForwarded("")).toBe(null);
  });
});

describe("paddleAllowedCidrs 快取", () => {
  beforeEach(() => {
    __resetAllowlistCache();
    process.env.PADDLE_ENV = "production";
  });
  afterEach(() => {
    __resetAllowlistCache();
    delete process.env.PADDLE_ENV;
  });

  it("回傳 data.ipv4_cidrs 並快取（第二次不再打 fetch）", async () => {
    const f = mockFetch({ data: { ipv4_cidrs: LIVE } });
    const a = await paddleAllowedCidrs(f);
    const b = await paddleAllowedCidrs(f);
    expect(a).toEqual(LIVE);
    expect(b).toEqual(LIVE);
    expect(f.calls()).toBe(1);
  });

  it("fetch 非 2xx 丟錯", async () => {
    const f = mockFetch({}, false, 503);
    await expect(paddleAllowedCidrs(f)).rejects.toThrow(/503/);
  });
});

describe("checkPaddleSourceIp", () => {
  beforeEach(() => {
    __resetAllowlistCache();
    process.env.PADDLE_ENV = "production";
  });
  afterEach(() => {
    __resetAllowlistCache();
    delete process.env.PADDLE_ENV;
  });

  it("清單內 → allowed", async () => {
    const f = mockFetch({ data: { ipv4_cidrs: LIVE } });
    expect(await checkPaddleSourceIp("34.237.3.244, 10.0.0.1", f)).toBe("allowed");
  });
  it("清單外 → denied", async () => {
    const f = mockFetch({ data: { ipv4_cidrs: LIVE } });
    expect(await checkPaddleSourceIp("8.8.8.8", f)).toBe("denied");
  });
  it("無 forwarded header → skipped（交給驗簽）", async () => {
    const f = mockFetch({ data: { ipv4_cidrs: LIVE } });
    expect(await checkPaddleSourceIp(null, f)).toBe("skipped");
  });
  it("IP 端點抓失敗 → skipped（fail-open）", async () => {
    const f = mockFetch({}, false, 500);
    expect(await checkPaddleSourceIp("8.8.8.8", f)).toBe("skipped");
  });
  it("清單為空 → skipped", async () => {
    const f = mockFetch({ data: { ipv4_cidrs: [] } });
    expect(await checkPaddleSourceIp("8.8.8.8", f)).toBe("skipped");
  });
});
