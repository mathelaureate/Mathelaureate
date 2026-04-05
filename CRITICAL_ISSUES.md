# Critical Issues Register

## 1) Payment Access Can Be Client-Spoofed (Temporary Free-Plan Mode)

- **Severity:** Critical
- **Status:** Accepted temporary risk (active)
- **Reason:** Current free-plan-compatible rules allow client writes to `userPayments/{uid}`.
- **Impact:** A malicious user could self-grant paid access by writing entitlement data directly from the browser.
- **Mitigation currently in place:**
  - Razorpay checkout UI flow is integrated.
  - Optional server verification path exists in code when `VITE_PAYMENT_API_BASE_URL` is configured.
- **Required permanent fix:**
  1. Deploy backend verification endpoints (`createOrder`, `verifyPayment`).
  2. Enforce strict Firestore rules:
     - deny client writes to `userPayments`
     - admin-only writes for `appData` and `courseContentItems`
  3. Keep Razorpay secret/server key only on backend.
- **Owner:** Engineering
- **Date logged:** 2026-04-01
