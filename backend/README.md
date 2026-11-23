# WaterFlow API

Express API with MongoDB-backed customer and vendor authentication.

## Setup

1. Install MongoDB Community Server 9.0.4 and make sure its service is running on `localhost:27017`.
   Use Node.js 20 or newer.
2. From this directory, install dependencies and create your local environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env
   ```

3. Replace `JWT_SECRET` in `.env` with a private random value of at least 32 characters. Set `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 16 characters for the first admin account.
4. Start MongoDB, then provision the admin account with `npm run seed:admin`. Re-running this command rotates the configured admin password; it never promotes a user/vendor account.
5. Start the API with `npm run dev`. The API listens on port 5000 and creates the `water_supply_management` database when the first account is registered.

## Runtime and operations

- `npm test` runs isolated service tests. `npm start` starts the production process; `npm run dev` restarts on source changes.
- `GET /api/health/live` is a liveness check. `GET /api/health/ready` checks MongoDB readiness; `/api/health` remains an alias.
- The service validates configuration before startup, logs structured JSON with request IDs, redacts credentials, verifies indexes, and drains requests before disconnecting from MongoDB on shutdown.
- MongoDB connection pool size and timeouts are configurable in `.env`. Tune `MONGO_MAX_POOL_SIZE` against the MongoDB connection budget and the number of API processes.
- The authentication rate limiter uses in-memory storage and is appropriate for a single API process. Use a shared Redis-backed limiter before running multiple API instances.
- The configured standalone MongoDB host has no replica redundancy. Use a replica set plus scheduled, restore-tested backups for production high availability and disaster recovery.

## Routes

- `GET /api/health` checks the API and MongoDB connection.
- `POST /api/auth/register` creates a customer or vendor account. JSON fields: `name`, `phone`, `email`, `password`, and optional `role` (`user` or `vendor`). Vendor registration also requires `businessName`; vendor applications remain pending and do not receive a login session until approved.
- `POST /api/auth/login` authenticates with `email`, `password`, and `role` (`user`, `vendor`, or `admin`). Pending/rejected vendors receive an explicit approval status response.
- `GET /api/auth/me` returns the authenticated account. Send `Authorization: Bearer <token>`.
- `GET /api/admin/vendors?status=pending&page=1` lists vendor applications (100 per page). Status can be `pending`, `approved`, `rejected`, or `all`; the response includes pagination metadata.
- `PATCH /api/admin/vendors/:id/approval` accepts `{ "decision": "approve" }` or `{ "decision": "reject" }`. Admin authentication is required for all `/api/admin` routes.
- `PUT /api/vendor/push-token` registers an Expo push token for the authenticated vendor. `DELETE /api/vendor/push-token` removes that device token.
- `GET /api/vendors/nearby?latitude=12.9&longitude=77.6` returns one offer per capacity within 10 km. Each offer shows the highest current price and eligible-vendor count; candidate identities and prices stay server-side.
- `POST /api/payments/razorpay/orders` creates a Razorpay order for a capacity variant and delivery coordinates. The API recomputes the highest price and snapshots eligible vendors; customer authentication is required.
- `POST /api/payments/razorpay/verify` verifies the Razorpay signature and captured payment before creating a paid booking. Customer authentication is required.
- `GET /api/orders` lists the authenticated customer's bookings. `DELETE /api/orders/:orderId` cancels a booking while it is waiting for a vendor and starts a payment refund.
- `PATCH /api/vendor/orders/:orderId/status` accepts `{ "status": "approved"|"rejected", "requestId": "..." }` for the vendor's current request. Accepted orders stop assignment; rejection advances immediately.
- `POST /api/payments/razorpay/webhook` verifies Razorpay webhook signatures and reconciles captured payments.

## Smart tanker booking and assignment

- Nearby listings are limited to 10 km regardless of a larger admin radius setting. Variants are grouped by capacity; each displays the maximum eligible vendor price, while the full candidate list is retained in the payment attempt and order.
- Checkout charges that displayed price upfront. After a verified capture, the API contacts eligible vendors one at a time in nearest-first order. A vendor's listing, approval, work mode, location, capacity, availability, and current price are revalidated before contact; a price above the captured amount is skipped.
- Each active request expires 30 minutes after it is sent. Rejections advance immediately; expired requests advance on the next background-worker pass. An acceptance confirms the order and stops assignment. If no vendor accepts, the order becomes `no_vendor_available` and the payment is refunded.
- The persisted assignment and refund worker runs every 15 seconds and resumes after restart. Atomic conditional updates and per-order leases prevent multiple API processes from advancing the same booking or creating concurrent refunds. Order indexes are created by the existing startup index verification.
- Customers and vendors can register Expo push tokens. Booking status is also available from order history, so assignment does not depend on the customer keeping the app open.

## Admin web portal

The admin portal has a separate frontend in `../admin-web` and a separate API in `../admin-backend`. The admin API connects to the same MongoDB database and `users` collection as this service. Start and configure it using `../admin-backend/README.md`; it defaults to port 5001, while this customer/vendor API remains on port 5000.

The admin routes in this API remain available for compatibility, but the separate admin frontend uses the independent admin API. Admin accounts are created only by an admin seed script; public registration cannot create admins.

Passwords are hashed with bcrypt and access tokens are signed JWTs. Vendor registration creates a pending application and does not issue a vendor session until an admin approves it.

## Razorpay payments

1. Generate **Test Mode** API keys in the Razorpay Dashboard and set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`. The key secret is only used by the API and must never be added to the app.
2. Configure a Razorpay webhook pointing to `https://<your-api-host>/api/payments/razorpay/webhook`, subscribe to `payment.captured`, and set the webhook signing secret as `RAZORPAY_WEBHOOK_SECRET`.
3. Restart the backend. The mobile app displays the highest eligible price for the selected capacity, opens Razorpay Checkout, verifies the returned signature and captured payment on the API, and only then starts sequential vendor assignment. If no vendor accepts, the captured amount is refunded. Do not use live keys until test payments and webhook delivery have been validated.

Web Checkout works in the Expo web app. Native Android/iOS builds use `react-native-razorpay`; after installing dependencies, run `npx expo prebuild` and build/install a development or production app. Native Razorpay checkout is not available in Expo Go.

## Vendor order push notifications

New orders notify registered vendor devices through Expo Push Notifications, including when the app is backgrounded or closed. The app does not run a permanent background polling service; delivery and sound are controlled by Android/iOS notification settings.

1. Sign in to the Expo account that owns this app and run `npx eas-cli@latest init` from `frontend` to associate an EAS project and add its project ID to the Expo config.
2. Configure Android FCM v1 credentials and iOS APNs credentials for that EAS project with `npx eas-cli@latest credentials`.
3. Build and install a native preview app with `npx eas-cli@latest build --profile preview --platform all`. iOS internal builds require an Apple developer account and registered test devices. Expo Go and the browser build cannot receive these native vendor push alerts. Vendors must allow notifications in device settings.

The app registers the vendor device token after vendor sign-in, removes it on sign-out, and sends a high-priority notification with the bundled order buzzer when an order is created or paid. In the foreground, the vendor app repeats the buzzer while there are pending orders and stops it when all are approved or rejected. In the background or when closed, the operating system plays the push notification sound once; standard push notifications cannot keep looping until the vendor responds. A notification tap opens the vendor order overview. Android notification-channel sound settings can be changed by the vendor in system settings.

## Connect the Expo app

The app defaults to `http://localhost:5000/api` on web and iOS Simulator, and `http://10.0.2.2:5000/api` on the Android Emulator. For a physical phone, set `EXPO_PUBLIC_API_URL` to `http://<your-computer-LAN-IP>:5000/api` before starting Expo, and allow port 5000 through the computer firewall. The phone and computer must be on the same network.