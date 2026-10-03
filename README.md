# Finance Club PSTU — Certificate Verification (Vercel)

A reusable Vercel verification frontend for the **WORKSHOP Automation** Apps Script backend.

The important design rule is:

> **Vercel is the public verification page. Apps Script is the data/backend source.**

The Vercel project does not store certificate records itself. It forwards the certificate ID to the configured Apps Script Web App and returns the result.

## Public URLs

- `https://financeclubpstu.vercel.app/verify`
- `https://financeclubpstu.vercel.app/verify/<CERTIFICATE_ID>`
- `https://financeclubpstu.vercel.app/verify?certificateId=<CERTIFICATE_ID>`

## How data is extracted

The request flow is:

```text
Browser
  ↓
https://financeclubpstu.vercel.app/verify/<CERTIFICATE_ID>
  ↓
Vercel: /api/verify-api
  ↓
Apps Script Web App: /exec?page=verify-api&certificateId=<CERTIFICATE_ID>
  ↓
WORKSHOP Certificates sheet
  ↓
JSON verification result
  ↓
Vercel
  ↓
Browser
```

The browser never reads the Google Sheet directly.

## The issue that caused the recent failure

The repository had an **old Apps Script `/exec` URL hard-coded** in `api/verify-api.js`.

So even when a new Apps Script Web App was deployed, Vercel could still send the request to the old backend unless `WORKSHOP_WEB_APP_URL` was updated in Vercel.

The previous page branding URL is **not** the backend URL. Changing this line in `public/Verify.html` only changes the visible verification URL/branding:

```javascript
window.BRAND.verificationUrl = "https://financeclubpstu.vercel.app/verify";
```

The actual backend is selected here:

```javascript
process.env.WORKSHOP_WEB_APP_URL || DEFAULT_WEB_APP_URL
```

This version updates the built-in fallback to the current Finance Club PSTU Apps Script deployment:

```text
https://script.google.com/macros/s/AKfycbwGUpohTALTcSXKOEKM8rQW32myItCcukGOMNZ0rJozVXFrs0x1T-ku0omWVtqZIbK9kQ/exec
```

For future projects/accounts, **do not edit the source code every time**. Use the Vercel environment variable described below.

## Required Apps Script Web App settings

For the backend deployment:

- Deployment type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- Use the production URL ending in `/exec`, not the `/dev` test URL.
- The Apps Script `doGet(e)` must support `page=verify-api`.

Google's deployment model uses a versioned deployment. When code changes, create a new version and edit the existing deployment to point to that version; this keeps the same deployment URL/ID. citehttps://developers.google.com/apps-script/concepts/deployments

## FIRST SETUP — One Apps Script project / one account

1. Deploy the Apps Script project as a Web App.
2. Copy the production `/exec` URL.
3. In Vercel open:
   `Project → Settings → Environment Variables`
4. Create/update:

```text
Name:  WORKSHOP_WEB_APP_URL
Value: https://script.google.com/macros/s/XXXXXXXX/exec
Environment: Production
```

5. Save it.
6. **Redeploy the Vercel project.**

Vercel environment-variable changes are applied to deployments when you redeploy, so changing the variable without a new deployment can leave the running deployment using the previous value. citehttps://vercel.com/academy/vercel-foundations/vercel-settings

## Every time Apps Script code is updated

### Same Apps Script project

Usually **do not change the Vercel URL**.

Use:

```text
Apps Script
  → Deploy
  → Manage deployments
  → Edit existing Web App deployment
  → Select the new version
  → Deploy
```

The existing `/exec` deployment URL remains the same. Vercel does not need to be changed just because the Apps Script code version changed. citehttps://developers.google.com/apps-script/concepts/deployments

### New Apps Script project in the same Google account

This creates a new Web App deployment URL.

Do this:

```text
1. Create/deploy the new Apps Script project.
2. Copy the new /exec URL.
3. Vercel → Settings → Environment Variables.
4. Update WORKSHOP_WEB_APP_URL.
5. Redeploy Vercel.
6. Test /api/verify-api?certificateId=<NEW_TEST_CERT_ID>.
```

You **do not need a new Vercel project** when you are replacing the backend and only one backend needs to be active.

### New Apps Script project in a DIFFERENT Google account

Treat it as a **new backend**.

```text
New Google account
  ↓
New Apps Script project
  ↓
New Web App /exec URL
  ↓
Set WORKSHOP_WEB_APP_URL in the Vercel project
  ↓
Redeploy Vercel
```

The verification frontend is reusable; the Apps Script backend is account/project specific.

Google notes that web apps can be affected when ownership moves across domains/accounts, so for a new independent account/project it is cleaner to deploy the Web App from that account rather than relying on an ownership transfer. citehttps://developers.google.com/apps-script/guides/web

## IMPORTANT — One Vercel project vs multiple independent workshops

There are two different situations.

### A. Only ONE backend is active at a time

Use **one Vercel project**.

Each time a completely new Apps Script project becomes the active backend:

```text
Change WORKSHOP_WEB_APP_URL
        ↓
Redeploy Vercel
        ↓
All verification requests use the new backend
```

This is the simplest setup.

**Warning:** old certificate links can stop verifying after you switch to a backend that does not contain those old certificate records.

### B. Multiple accounts/workshops must remain verifiable at the same time

Do **not** keep changing one Vercel backend URL back and forth.

Use either:

- one Vercel project per independent Apps Script backend/account, or
- a future multi-backend routing system that maps an event/account key to the correct Apps Script Web App.

For the current architecture, **one Vercel project per independent backend is the safest simple option** when old certificates must continue to work.

Example:

```text
Finance Club PSTU Account A
  → Apps Script A
  → Vercel Verify A

Another Account B
  → Apps Script B
  → Vercel Verify B
```

The page design/code can be identical; only the backend URL differs.

## Recommended workflow for every NEW workshop/account

```text
STEP 1
Create/open the WORKSHOP Apps Script project

STEP 2
Run the system setup/repair

STEP 3
Create the Workshop/Event

STEP 4
Confirm the Certificates sheet exists

STEP 5
Deploy Apps Script as Web App
Execute as: Me
Who has access: Anyone

STEP 6
Copy the new /exec URL

STEP 7
Open the Vercel project used by this backend

STEP 8
Set:
WORKSHOP_WEB_APP_URL = new /exec URL

STEP 9
Redeploy Vercel

STEP 10
Open:
/api/verify-api?certificateId=<TEST_CERTIFICATE_ID>

STEP 11
Then test:
/verify/<TEST_CERTIFICATE_ID>

STEP 12
Only after that, use the verification URL in certificate emails.
```

## Do NOT use the Apps Script `/dev` URL in production

Use:

```text
.../exec
```

Not:

```text
.../dev
```

Google documents `/dev` as the development/test deployment URL, while `/exec` is the deployed web-app endpoint. citehttps://developers.google.com/apps-script/guides/web

## Troubleshooting

### `BACKEND_NON_JSON`

Vercel reached something, but Apps Script returned HTML or another non-JSON response.

Check:

1. `WORKSHOP_WEB_APP_URL` is the correct `/exec` URL.
2. Apps Script Web App access is **Anyone**.
3. Vercel was redeployed after changing the environment variable.
4. The backend supports `page=verify-api`.

### `BACKEND_ERROR`

The Vercel server could not reach the Apps Script backend or the request timed out.

Check the Apps Script deployment first, then test the endpoint directly.

### `NOT_FOUND`

The backend answered correctly but the certificate ID was not found in that backend's certificate data.

This is different from a connection/configuration error.

### Direct backend test

Open this pattern in a browser:

```text
https://script.google.com/macros/s/XXXXXXXX/exec?page=verify-api&certificateId=TEST-CERT-XXXXXXXX
```

Expected result is JSON.

Then test the Vercel proxy:

```text
https://YOUR-VERCEL-DOMAIN/api/verify-api?certificateId=TEST-CERT-XXXXXXXX
```

If the Apps Script URL works but the Vercel API does not, check the Vercel environment variable and redeployment.

## Files

```text
api/
  verify-api.js     # Server-side proxy to Apps Script
  verify-page.js    # Serves verification page and injects certificate ID

public/
  Verify.html       # Verification UI

vercel.json         # Routes + function configuration
```

## Important rule

**Never put a Google Sheet ID, participant data, service-account key, or other private credential in `public/Verify.html`.**

Only the public verification request should be exposed to the browser. The Apps Script endpoint is the authoritative certificate data source.
