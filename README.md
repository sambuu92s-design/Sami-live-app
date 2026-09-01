# Underground Shift App — live starter

This is the first deployable version of the underground paste pipe / airleg shift workflow.

## What is already wired

- Multi-device Firestore database
- Firestore offline persistence
- Start-of-shift consumables approval
- Inventory deduction only after supervisor approval
- Active shift
- Multiple machinery/assets per shift
- Multiple attachments per asset
- Production, delay and QA notes
- End-of-shift submission
- Final supervisor approval
- Completed/locked status
- PWA app shell/service worker

## Setup

1. Create a Firebase project.
2. Enable Firestore Database.
3. Enable Authentication if you want real user logins.
4. Copy `src/firebase-config.example.js` to `src/firebase-config.js`.
5. Paste your Firebase web app configuration into that file.
6. Run:

   npm install
   npm run dev

7. For deployment:

   npm run build

Then deploy the `dist` folder to Firebase Hosting, Cloudflare Pages, Netlify, Vercel or another HTTPS host.

## Important before real site use

This starter demonstrates the workflow, but the following must be added before production deployment:

- Firebase Authentication and roles
- Firestore security rules
- supervisor / superintendent permissions
- proper inventory transaction ledger
- transaction/locking protection for simultaneous stock approvals
- photo capture and Firebase Storage upload queue
- push notifications
- immutable audit log
- end-of-shift Used / Damaged / Returned reconciliation
- site-configurable QA / ITP requirements
- testing on actual underground devices
- company privacy, retention and cyber-security requirements

## Recommended status flow

DRAFT
→ AWAITING_START_APPROVAL
→ ACTIVE
→ AWAITING_FINAL_APPROVAL
→ COMPLETED

Offline is a connectivity state, not a business status. Firestore keeps local writes and synchronises when connection returns.

## Next implementation milestone

The next milestone should add:
1. Firebase Auth
2. Worker / Leading Hand / Supervisor / Superintendent / Admin roles
3. Real photo queue
4. Push notification when a shift becomes ready for final approval
5. Complete material reconciliation and inventory ledger