# RavBot

Real app with real functions. Optimize investments, cancel hidden subscriptions, worry less, earn more, etc.

# for devs

make sure you run

npm install

and then npm run dev will work

# testing

npm run dev
node server.cjs

you gyat to do these bc if u dont it doesnt work

# Environment Variables

Before running in production, set the following variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `FROM_EMAIL`
- `VITE_API_ORIGIN` (client-side base URL for API calls)

The server will refuse to start if required variables are missing.


