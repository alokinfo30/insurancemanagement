# Security Specification & Threat Model

## 1. Data Invariants
1. **User Identity Invariant**: A user document in `/users/{userId}` can only be created or modified if `request.auth.uid == userId`. Users cannot elevate their own role to `ADMIN`.
2. **Admin Privilege Invariant**: Admin privileges require presence in `/admins/{adminId}` where `request.auth.uid == adminId` and `request.auth.token.email_verified == true`.
3. **Category Integrity**: Only Admins can create, update, or delete categories in `/categories/{categoryId}`.
4. **Policy Integrity**: Only Admins can create, update, or delete insurance policies in `/policies/{policyId}`. All public users can read active policies.
5. **Policy Record Invariant**: A policy record in `/policy_records/{recordId}` must reference a real customer (`customer_id == request.auth.uid`). Customers can only set status to `Pending` on creation. Only Admins can change status to `Approved` or `Disapproved`.
6. **Support Question Invariant**: A customer question in `/questions/{questionId}` must have `customer_id == request.auth.uid` with default comment `Nothing`. Only Admins can update `admin_comment`.
7. **Id Validation Invariant**: All document ID path variables must satisfy `isValidId(id)` (alphanumeric with hyphen/underscore, size <= 128).

## 2. The "Dirty Dozen" Test Payloads
1. **Payload 1 (Self-Role Elevation)**: User attempts to write `{ "role": "ADMIN" }` to their own `/users/{userId}` doc. (Expected: `PERMISSION_DENIED`).
2. **Payload 2 (Admin Directory Spoofing)**: Non-admin attempts to add their UID to `/admins/{uid}`. (Expected: `PERMISSION_DENIED`).
3. **Payload 3 (Unauthenticated Policy Creation)**: Unauthenticated client creates `/policies/pol_hack` with sum_assurance 99999999. (Expected: `PERMISSION_DENIED`).
4. **Payload 4 (Customer Policy Creation)**: Customer attempts to create an insurance policy. (Expected: `PERMISSION_DENIED`).
5. **Payload 5 (Customer Self-Approval)**: Customer submits policy record with `status: "Approved"`. (Expected: `PERMISSION_DENIED`).
6. **Payload 6 (Cross-User Policy Application)**: User A attempts to submit a policy record with `customer_id: "user_B"`. (Expected: `PERMISSION_DENIED`).
7. **Payload 7 (Customer Status Tampering)**: Customer attempts to update `status` on their applied policy from `Pending` to `Approved`. (Expected: `PERMISSION_DENIED`).
8. **Payload 8 (Foreign Record Reading)**: Customer A attempts to read Customer B's policy application in `/policy_records`. (Expected: `PERMISSION_DENIED`).
9. **Payload 9 (Question Comment Hijacking)**: Customer attempts to edit `admin_comment` on `/questions/{qid}`. (Expected: `PERMISSION_DENIED`).
10. **Payload 10 (Path Poisoning Attack)**: Creation request sent to `/policies/{id}` with 2KB junk string ID. (Expected: `PERMISSION_DENIED`).
11. **Payload 11 (Oversized Question Payload)**: Description exceeding 2000 characters to trigger denial-of-wallet. (Expected: `PERMISSION_DENIED`).
12. **Payload 12 (Negative Financial Values)**: Policy creation with negative `premium: -500` or `sum_assurance: -1000`. (Expected: `PERMISSION_DENIED`).

## 3. Test Runner Design
The rules are validated through strict invariant assertion functions in `firestore.rules`.
