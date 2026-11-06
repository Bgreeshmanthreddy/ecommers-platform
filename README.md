# Everyday Market

A full-stack e-commerce starter built with React, Vite, Express, and MongoDB. It includes a customer storefront, account registration and login, product search and categories, a persistent cart, checkout, inventory-aware orders, order history, an admin dashboard, cash on delivery, and optional Stripe and Razorpay checkout.

## Requirements

- Node.js 18 or newer
- MongoDB running locally or a MongoDB connection string

## Local setup

On Windows, after completing the backend configuration below, you can start both servers and open the storefront by double-clicking `start-store.bat` in the project folder. MongoDB must be running. Keep both server terminal windows open while using the store.

1. Configure the backend:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

   If `backend/.env` already exists, merge the settings from `.env.example` into it rather than overwriting your current database settings. Set `MONGO_URI` and a long, unique `JWT_SECRET`. Keep this file private and do not commit real credentials.

2. Install backend dependencies and seed starter products:

   ```powershell
   npm install
   npm run seed
   ```

   To create the first administrator, also set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `backend/.env` before running the seed command. The seed command does not change an existing account's role or password.

3. Start the API in a terminal:

   ```powershell
   npm run dev
   ```

   The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health` for server and database status.

4. Start the frontend in a second terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

   Open the Vite URL, normally `http://localhost:5173`. In development, Vite proxies `/api` requests to the backend.

## Payment setup

Cash on delivery works without payment-provider credentials. To enable online checkout, add the provider's test credentials to `backend/.env`:

- **Razorpay:** `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `FRONTEND_URL`

The store only exposes a provider in checkout when its required configuration is present. Use test-mode credentials while developing. For Stripe webhooks, configure the endpoint `https://your-api-host/api/payments/stripe/webhook` for `checkout.session.completed`. Online payment orders reserve inventory for 30 minutes and release it if payment is not completed.

Set `STORE_CURRENCY` to the ISO currency code used for product prices. The default is `INR`. Confirm that your payment account supports the selected currency before enabling online payments.

## Deploy with Render, Vercel, and MongoDB Atlas

The repository includes a Render Blueprint in `render.yaml` for the API and Vercel build settings in `frontend/vercel.json` for the storefront.

1. Push the project to a GitHub repository. Keep the repository's environment files private; `.env` files are excluded by `.gitignore`.
2. Create a MongoDB Atlas cluster and database user. In Atlas Network Access, allow the outbound IP addresses shown for your Render service. Do not commit the Atlas connection string.
3. In Render, create a Blueprint from the repository and select `render.yaml`. Set `MONGO_URI` to the Atlas connection string and `FRONTEND_URL` to the Vercel site origin. Render generates `JWT_SECRET`.
4. In Vercel, import the same repository and set the project root directory to `frontend`. Add `VITE_API_BASE` with the Render API URL ending in `/api`, for example `https://your-api.onrender.com/api`, then deploy.
5. If the Vercel domain was not available when configuring Render, set `FRONTEND_URL` to the final Vercel site origin in the Render dashboard and redeploy the API.
6. Confirm the API is healthy at `https://your-api.onrender.com/api/health`. Add optional payment-provider credentials through the Render service's environment settings, never through source files.

The frontend's `VITE_API_BASE` is embedded during the Vercel build, so redeploy the frontend after changing it. The API's `FRONTEND_URL` must be the exact deployed frontend origin (without an `/api` path).

## Admin

Create the initial admin using `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the local backend environment, then run `npm run seed`. Registering through the storefront always creates a customer account; the admin role cannot be assigned by the public registration endpoint. Sign in with the seeded administrator to manage products, stock, categories, and order status.

## Production notes

- Use HTTPS, a production MongoDB deployment, a strong unique JWT secret, and payment-provider live credentials only in the deployment's secret manager.
- Set backend `FRONTEND_URL` to the deployed frontend origin and configure CORS accordingly.
- When frontend and API are on different hosts, set `VITE_API_BASE` at frontend build time to the API base URL ending in `/api`.
- Configure a same-origin reverse proxy for `/api` if `VITE_API_BASE` is not set.
- The sample admin credentials in `.env.example` are placeholders and must be replaced before use.
