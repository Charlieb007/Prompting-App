/* Client billing helpers — call the server Stripe endpoints and redirect.
 * No Stripe.js; the server returns a hosted Checkout/Portal URL. */

import { API_URL } from './constants.js';

async function postBilling(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Billing request failed.');
  return data;
}

// Redirect to Stripe Checkout for the Pro subscription.
export async function startCheckout(token) {
  const { url } = await postBilling('/api/billing/checkout', token);
  if (url) window.location.href = url;
  else throw new Error('Could not start checkout.');
}

// Redirect to the Stripe Customer Portal (manage/cancel).
export async function openBillingPortal(token) {
  const { url } = await postBilling('/api/billing/portal', token);
  if (url) window.location.href = url;
  else throw new Error('Could not open the billing portal.');
}
