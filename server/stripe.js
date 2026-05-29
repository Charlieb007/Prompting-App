/* Stripe billing (billing phase). Scaffolded to be fully inert until the
 * server has STRIPE_SECRET_KEY set — every entry point checks `stripeEnabled`.
 *
 * Server env needed to activate:
 *   STRIPE_SECRET_KEY          — Stripe secret key (sk_...)
 *   STRIPE_PRICE_ID            — the recurring "Pro" price id (price_...)
 *   STRIPE_WEBHOOK_SECRET      — signing secret for /api/stripe/webhook (whsec_...)
 *   SUPABASE_SERVICE_ROLE_KEY  — lets the webhook update profiles (bypasses RLS;
 *                                the webhook has no user token). Server-only secret.
 *   APP_FRONTEND_URL           — where Checkout/portal return to (defaults below)
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SECRET = process.env.STRIPE_SECRET_KEY;
const PRICE_ID = process.env.STRIPE_PRICE_ID;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';

export const stripeEnabled = Boolean(SECRET);

const stripe = stripeEnabled ? new Stripe(SECRET) : null;

// Admin (service-role) client — only the webhook uses it, to update a user's
// profile when there's no user JWT. Null if the service-role key isn't set.
const admin = (SUPA_URL && SERVICE_ROLE)
  ? createClient(SUPA_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function getCustomerId(user) {
  if (admin) {
    const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    if (data?.stripe_customer_id) return data.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { supabase_user_id: user.id },
  });
  if (admin) await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
  return customer.id;
}

// Create a Checkout session for the Pro subscription; returns the hosted URL.
export async function createCheckout(user) {
  if (!stripe || !PRICE_ID) throw new Error('Billing is not configured.');
  const customer = await getCustomerId(user);
  const sessionObj = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancel`,
    metadata: { supabase_user_id: user.id },
  });
  return sessionObj.url;
}

// Create a Customer Portal session (manage/cancel/update card).
export async function createPortal(user) {
  if (!stripe) throw new Error('Billing is not configured.');
  let customerId = null;
  if (admin) {
    const { data } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    customerId = data?.stripe_customer_id || null;
  }
  if (!customerId) throw new Error('No subscription to manage.');
  const portal = await stripe.billing_portal.sessions.create({ customer: customerId, return_url: APP_URL });
  return portal.url;
}

// Webhook: verify signature, then sync subscription state into profiles.
export async function handleWebhook(req, res) {
  if (!stripe || !WEBHOOK_SECRET) return res.status(503).json({ error: 'Billing not configured.' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type.startsWith('customer.subscription.')) {
      await syncSubscription(event);
    }
  } catch (err) {
    console.error('Stripe webhook handling error:', err.message);
  }
  res.json({ received: true });
}

async function syncSubscription(event) {
  if (!admin) { console.warn('Stripe webhook: SUPABASE_SERVICE_ROLE_KEY not set — cannot update profiles.'); return; }

  let customerId;
  let sub = null;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    customerId = session.customer;
    if (session.subscription) sub = await stripe.subscriptions.retrieve(session.subscription);
  } else {
    sub = event.data.object;
    customerId = sub.customer;
  }

  const updates = { stripe_customer_id: customerId };
  if (sub) {
    const active = ['active', 'trialing'].includes(sub.status);
    updates.subscription_status = sub.status;
    updates.price_id = sub.items?.data?.[0]?.price?.id || null;
    updates.current_period_end = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    updates.plan = active ? 'pro' : 'free';
  }

  // Resolve the user: prefer the supabase_user_id we stored on the Stripe customer.
  let userId = null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    userId = customer && !customer.deleted ? customer.metadata?.supabase_user_id || null : null;
  } catch { /* ignore */ }

  if (userId) await admin.from('profiles').update(updates).eq('id', userId);
  else await admin.from('profiles').update(updates).eq('stripe_customer_id', customerId);
}
