/* global Buffer, process */
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyYookassaWebhookSignature } from "../../backend/lib/yookassa.js";

function makeReq() {
  return { headers: {} };
}

function makeRawBody(payload) {
  return Buffer.from(JSON.stringify(payload), "utf-8");
}

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  YOOKASSA_SHOP_ID: process.env.YOOKASSA_SHOP_ID,
  YOOKASSA_SECRET_KEY: process.env.YOOKASSA_SECRET_KEY,
  YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV: process.env.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV,
};

afterEach(() => {
  vi.restoreAllMocks();
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.YOOKASSA_SHOP_ID = ORIGINAL_ENV.YOOKASSA_SHOP_ID;
  process.env.YOOKASSA_SECRET_KEY = ORIGINAL_ENV.YOOKASSA_SECRET_KEY;
  process.env.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV = ORIGINAL_ENV.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV;
});

describe("verifyYookassaWebhookSignature", () => {
  it("accepts webhook when payment data matches YooKassa API", async () => {
    process.env.NODE_ENV = "production";
    process.env.YOOKASSA_SHOP_ID = "shop";
    process.env.YOOKASSA_SECRET_KEY = "secret";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: "payment-1",
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
        }),
      }))
    );

    const ok = await verifyYookassaWebhookSignature(
      makeReq(),
      makeRawBody({
        event: "payment.succeeded",
        object: {
          id: "payment-1",
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
        },
      })
    );

    expect(ok).toBe(true);
  });

  it("rejects webhook when status differs from YooKassa API", async () => {
    process.env.NODE_ENV = "production";
    process.env.YOOKASSA_SHOP_ID = "shop";
    process.env.YOOKASSA_SECRET_KEY = "secret";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: "payment-1",
          status: "pending",
          amount: { value: "990.00", currency: "RUB" },
        }),
      }))
    );

    const ok = await verifyYookassaWebhookSignature(
      makeReq(),
      makeRawBody({
        event: "payment.succeeded",
        object: {
          id: "payment-1",
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
        },
      })
    );

    expect(ok).toBe(false);
  });

  it("rejects without credentials in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.YOOKASSA_SHOP_ID = "";
    process.env.YOOKASSA_SECRET_KEY = "";
    process.env.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV = "1";

    const ok = await verifyYookassaWebhookSignature(
      makeReq(),
      makeRawBody({
        event: "payment.succeeded",
        object: {
          id: "payment-1",
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
        },
      })
    );

    expect(ok).toBe(false);
  });

  it("allows explicit dev bypass without credentials", async () => {
    process.env.NODE_ENV = "development";
    process.env.YOOKASSA_SHOP_ID = "";
    process.env.YOOKASSA_SECRET_KEY = "";
    process.env.YOOKASSA_WEBHOOK_ALLOW_UNVERIFIED_DEV = "1";

    const ok = await verifyYookassaWebhookSignature(
      makeReq(),
      makeRawBody({
        event: "payment.succeeded",
        object: {
          id: "payment-1",
          status: "succeeded",
          amount: { value: "990.00", currency: "RUB" },
        },
      })
    );

    expect(ok).toBe(true);
  });
});
