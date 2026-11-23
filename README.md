# SalonBook Server

REST API backend for **SalonBook**, a role-based salon appointment booking platform. Customers browse salon services, request appointments and pay for confirmed ones through Stripe. Admins manage services, appointments, customers and payments.

## Live Links

- Live Website: https://salonbook-client-bice.vercel.app
- Live API: https://salonbook-server-iota.vercel.app
- Client Repository: https://github.com/rabin-majumdar/salonbook-client
- Server Repository: https://github.com/rabin-majumdar/salonbook-server

## Important Features

- JWT verification middleware (tokens issued by Better Auth, verified against its JWKS endpoint)
- Server-side role verification (admin / customer) on every protected route
- Blocked users are rejected on all protected routes
- Services CRUD for admins with image upload to ImgBB
- Public services API with search by name, category filter and price sorting
- Appointment requests with duplicate time-slot prevention, inactive-service checks and cancel/confirm rules
- Stripe Checkout sessions for confirmed appointments
- Verified Stripe webhook: payment status becomes `paid` and a transaction is saved only after a signed webhook event
- Admin and customer dashboard statistics, user block/unblock, profile updates
- Security headers with Helmet and server-side validation with Zod
- Profile image upload endpoint (ImgBB) for authenticated users

## Technology Stack

Node.js, Express.js, TypeScript, MongoDB with Mongoose, JWT (jose), Stripe, ImgBB, Multer, Zod

## Installation

```bash
git clone https://github.com/rabin-majumdar/salonbook-server.git
cd salonbook-server
npm install
```

## Required Environment Variables

Create a `.env` file in the project root (never commit it). Names only:

```
PORT=
MONGODB_URI=
CLIENT_URL=
IMGBB_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=
```

## How to Run Locally

```bash
npm run dev      # development with auto-reload
npm run build    # compile TypeScript
npm start        # run compiled build
```

The API runs on `http://localhost:5000` by default.

To promote a registered account to admin (admins cannot be created through public sign-up):

```bash
npm run make-admin -- admin@example.com
```

## Stripe Webhook Setup

Payment status is updated only by a verified Stripe webhook event. Create a webhook destination in the Stripe dashboard (test mode) with:

- Endpoint URL: `https://<your-server-domain>/api/payments/webhook`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## Main API Routes

| Method | Route | Access |
|---|---|---|
| GET | `/api/services` | Public (search, category, sort) |
| GET | `/api/services/:id` | Public |
| POST / PUT / DELETE | `/api/services` | Admin |
| POST | `/api/appointments` | Customer |
| GET | `/api/appointments/my` | Customer |
| PATCH | `/api/appointments/:id/cancel` | Customer (own pending) / Admin |
| PATCH | `/api/appointments/:id/confirm` | Admin |
| POST | `/api/payments/checkout` | Customer |
| POST | `/api/payments/webhook` | Stripe (signature verified) |
| GET | `/api/payments/admin/all` | Admin |
| GET | `/api/users` | Admin |
| PATCH | `/api/users/:id/block` | Admin |
| GET | `/api/stats/admin`, `/api/stats/customer` | Admin / Customer |