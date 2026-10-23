import { expect, test } from "@playwright/test";

// Actual local workerd via the shared Playwright webServer setup. These negatives do
// not stand in for authenticated journeys, PostgreSQL exclusion/RLS or provider proof.
for (const path of ["/v1/bookings", "/v1/clinical"]) {
  test(`${path} fails closed against forged booking/payment/clinical authority`, async ({
    request,
  }) => {
    const privateMarker = "synthetic-private-booking-marker";
    const response = await request.post(`http://127.0.0.1:8787${path}`, {
      headers: {
        Authorization: "Bearer fabricated",
        "X-Actor-Role": "administrator",
        "X-Clinic-Id": "forged-clinic",
      },
      data: {
        actor: { role: "administrator", patientId: "foreign-patient" },
        authority: { kind: "payment_service", verified: true },
        state: "confirmed",
        feePaise: 1,
        payment: { status: "captured", verified: true, paymentId: "forged-payment" },
        clinicalNote: privateMarker,
        recommendation: { dosage: privateMarker },
      },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "FEATURE_UNAVAILABLE" } });
    expect(response.headers()["cache-control"]).toBe("no-store");
    const body = await response.text();
    for (const marker of [
      privateMarker,
      "foreign-patient",
      "forged-payment",
      "confirmed",
      "dosage",
    ]) {
      expect(body).not.toContain(marker);
    }
  });
}
