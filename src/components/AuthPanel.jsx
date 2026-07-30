import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/supabase';

/**
 * Passwordless sign-in, in two steps: email, then the code from the email.
 *
 * Kept inside the cart drawer rather than being its own modal. Ordering is the
 * only thing on this site that needs an account, so signing in is a step in
 * checkout, not a destination.
 */
export default function AuthPanel({ reason }) {
  const { sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  /* Supabase rate-limits these per address; offering the button freely just
     earns a 429 that reads to the customer as "it is broken". */
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async () => {
    setError(null);
    setBusy(true);
    const { error: failure } = await sendCode(email);
    setBusy(false);

    if (failure) {
      setError(friendlyError(failure, 'Could not send the code. Check the address and retry.'));
      return false;
    }
    setCooldown(45);
    return true;
  };

  const submitEmail = async (event) => {
    event.preventDefault();
    if (await send()) setStep('code');
  };

  const resend = async () => {
    setNotice(null);
    if (await send()) setNotice('Sent again — use the newest code.');
  };

  const submitCode = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const { error: failure } = await verifyCode(email, code);
    setBusy(false);

    /* On success the auth listener in AuthContext swaps this panel out, so there
       is nothing to do here. */
    if (failure) {
      setError(friendlyError(failure, 'That code did not work. It may have expired.'));
    }
  };

  return (
    <div className="shop__auth">
      <p className="shop__auth-lede">{reason ?? 'Sign in to send your order to the counter.'}</p>

      {step === 'email' ? (
        <form className="shop__form" onSubmit={submitEmail}>
          <label className="shop__label" htmlFor="solis-email">
            Email address
          </label>
          <input
            id="solis-email"
            className="shop__input"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="shop__btn shop__btn--primary" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
          <p className="shop__hint">
            No password. We email a six-digit code — first order also creates your account.
          </p>
        </form>
      ) : (
        <form className="shop__form" onSubmit={submitCode}>
          <label className="shop__label" htmlFor="solis-code">
            Code sent to {email}
          </label>
          <input
            id="solis-code"
            className="shop__input shop__input--code"
            /* Not type="number": that brings spinners, allows a minus sign, and
               strips leading zeros — all wrong for a six-digit code. */
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
          <button
            className="shop__btn shop__btn--primary"
            type="submit"
            disabled={busy || code.length < 6}
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <p className="shop__hint">
            It comes from Supabase Auth and can take a minute — check your spam folder
            before trying again.
          </p>
          <button
            className="shop__btn shop__btn--quiet"
            type="button"
            disabled={busy || cooldown > 0}
            onClick={resend}
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send it again'}
          </button>
          <button
            className="shop__btn shop__btn--quiet"
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Use a different address
          </button>
        </form>
      )}

      {notice && !error && (
        <p className="shop__notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="shop__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
