import type { ClientSession } from "../../packages/contracts/src/client";
import type {
  Appointment,
  Consent,
  Payment,
  SecurityContext,
  VideoGrant,
} from "../../packages/contracts/src/sensitive";

// Synthetic records only. These fixtures are never imported by production applications.
export const reference = "10000000-0000-4000-8000-000000000001";
export const otherReference = "20000000-0000-4000-8000-000000000002";
export const session: ClientSession = {
  userId: reference,
  expiresAt: "2099-01-01T00:00:00Z",
  workspaces: ["customer"],
};
export const context: SecurityContext = {
  userId: reference,
  sessionId: otherReference,
  expiresAt: session.expiresAt,
  csrfToken: "synthetic_csrf_012345678901234567890123456789",
};
export const consents: Consent = {
  signupVersion: "account-1",
  privacyVersion: "privacy-1",
  consultationVersion: "consultation-1",
  signupAccepted: false,
  privacyAccepted: false,
  consultationAccepted: false,
  marketingAccepted: false,
  signupText: "Synthetic account terms for test coverage.",
  privacyText: "Synthetic privacy policy for test coverage.",
  consultationText: "Synthetic consultation consent for test coverage.",
};
export const choices = {
  signupVersion: "account-1",
  privacyVersion: "privacy-1",
  consultationVersion: "consultation-1",
  signupAccepted: true,
  privacyAccepted: true,
  consultationAccepted: false,
  marketingAccepted: false,
};
export const payment: Payment = {
  id: reference,
  revision: "quote-1",
  status: "requires_payment",
  amountPaise: 19900,
  currency: "INR",
  expiresAt: session.expiresAt,
  checkout: {
    key: "rzp_test_synthetic",
    order_id: "order_synthetic",
    amount: 19900,
    currency: "INR",
  },
};
export const receipt = {
  razorpay_order_id: "order_synthetic",
  razorpay_payment_id: "pay_synthetic",
  razorpay_signature: "a".repeat(64),
};
export const appointment: Appointment = {
  id: reference,
  revision: "booking-1",
  role: "customer",
  doctor: "Synthetic physician",
  clinic: "Synthetic clinic",
  service: "Synthetic consultation",
  startsAt: "2020-01-01T00:00:00Z",
  endsAt: "2099-01-01T00:00:00Z",
  holdExpiresAt: null,
  status: "confirmed",
  identityVerified: true,
  consentCurrent: true,
  intake: {
    policyVersion: "physician-1",
    physicianApproved: true,
    status: "accepted",
    questions: [
      { id: "age", label: "Synthetic age question", required: true },
      { id: "medication", label: "Synthetic medication question", required: true },
      { id: "pregnancy", label: "Synthetic pregnancy question", required: true },
      { id: "child", label: "Synthetic child question", required: true },
      { id: "red_flags", label: "Synthetic red-flag question", required: true },
    ],
  },
};
export const grant: VideoGrant = {
  appointmentId: reference,
  revision: appointment.revision,
  expiresAt: new Date(Date.now() + 120000).toISOString(),
  ticket: "synthetic_membership_012345678901234567890123456789",
};
