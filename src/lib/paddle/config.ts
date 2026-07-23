// Paddle 設定 —— 全 lazy：缺 env 只在「用到時」throw PaddleConfigError（呼叫端
// 轉 503），server 啟動與未開通金流的部署不受影響。金額不進 code，只有 price id。

import { Paddle, Environment } from "@paddle/paddle-node-sdk";

export class PaddleConfigError extends Error {}

export function paddleEnv(): "sandbox" | "production" {
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new PaddleConfigError(`${name} not configured`);
  return v;
}

export type PaddlePriceIds = {
  monthlyTrial: string;
  annualTrial: string;
  monthlyNoTrial: string;
  annualNoTrial: string;
};

export function paddlePriceIds(): PaddlePriceIds {
  return {
    monthlyTrial: required("PADDLE_PRICE_MONTHLY_TRIAL"),
    annualTrial: required("PADDLE_PRICE_ANNUAL_TRIAL"),
    monthlyNoTrial: required("PADDLE_PRICE_MONTHLY_NOTRIAL"),
    annualNoTrial: required("PADDLE_PRICE_ANNUAL_NOTRIAL"),
  };
}

export function paddleClientToken(): string {
  return required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
}

export function paddleWebhookSecret(): string {
  return required("PADDLE_WEBHOOK_SECRET");
}

let _paddle: Paddle | null = null;

export function getPaddle(): Paddle {
  if (!_paddle) {
    _paddle = new Paddle(required("PADDLE_API_KEY"), {
      environment:
        paddleEnv() === "production" ? Environment.production : Environment.sandbox,
    });
  }
  return _paddle;
}
