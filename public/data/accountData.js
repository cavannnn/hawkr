import { login } from "./session.js";

// POST `/user/register`
export async function createAccount(username, password, email = null, role = "customer", phone = null) {
  const res = await fetch("/user/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email, role, phone }),
  });

  if (!res.ok) {
    let message = "Could not create your account. Please try again.";
    try {
      const body = await res.json();
      if (body && body.message) message = body.message;
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return login(username, password);
}
