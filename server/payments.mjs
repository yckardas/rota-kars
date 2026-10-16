// No provider is enabled until a bank agreement and provider specification exist.
// Browser redirects never confirm a payment. A future adapter must verify the
// provider signature, order amount/currency and idempotent server callback.
export const paymentStatus = {
  enabled: false,
  provider: null,
  currency: "TRY",
  modes: ["deposit", "full"],
  depositPercent: 30,
  message:
    "Online ödeme henüz aktif değil. Ön rezervasyon talebiniz acente tarafından değerlendirilecektir.",
};
export function createPayment() {
  return {
    status: 503,
    body: { code: "PAYMENT_NOT_CONFIGURED", message: paymentStatus.message },
  };
}
