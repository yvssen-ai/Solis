import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadSupabase,
  isSupabaseConfigured,
  hasStoredSession,
  hasAuthInUrl,
} from '../lib/supabase';

/**
 * Who is signed in, and how they get there.
 *
 * This provider also owns the lifetime of the Supabase client, which is loaded
 * on demand rather than at startup (see src/lib/supabase.js for why). It is
 * fetched eagerly in exactly two cases:
 *
 *   - there is already a session in localStorage, so this is a returning
 *     customer who will want their orders; or
 *   - the URL carries an auth response, which means a magic link was just
 *     tapped and `detectSessionInUrl` has to run now.
 *
 * Otherwise nothing is downloaded until the customer opens the cart.
 *
 * Sign-in is passwordless email. Supabase serves magic links and six-digit codes
 * through the same endpoint — which one arrives depends only on whether the
 * project's Magic Link template contains `{{ .ConfirmationURL }}` or
 * `{{ .Token }}` — so both are handled: a typed code goes through `verifyOtp`,
 * and a tapped link comes back to the site and is picked up by the listener
 * below. The code path is the one the UI leads with, because it needs no
 * redirect configuration and keeps the customer on the page they were ordering
 * from.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [isStaff, setIsStaff] = useState(false);
  /* True only while a client is being loaded that might report a session. A
     visitor who has never signed in is not "loading" — they are signed out, and
     nothing should spin at them. */
  const [loading, setLoading] = useState(
    isSupabaseConfigured && (hasStoredSession() || hasAuthInUrl())
  );

  /* loadSupabase() memoizes the client, so calling this repeatedly is cheap and
     always yields the same instance. */
  const pending = useRef(null);
  const ensureClient = useCallback(() => {
    pending.current ??= loadSupabase().then((loaded) => {
      setClient(loaded);
      if (!loaded) setLoading(false);
      return loaded;
    });
    return pending.current;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!hasStoredSession() && !hasAuthInUrl()) return;
    ensureClient();
  }, [ensureClient]);

  /* Wire the auth listener once, whenever the client turns up. */
  useEffect(() => {
    if (!client) return;

    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  /* Staff get an extra column in the drawer. This flag is a convenience for the
     UI only — the real authorization is in the RLS policies, which consult the
     staff table directly and do not care what this says. */
  useEffect(() => {
    if (!client || !session) {
      setIsStaff(false);
      return;
    }

    let active = true;
    client
      .from('staff')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsStaff(Boolean(data));
      });

    return () => {
      active = false;
    };
  }, [client, session]);

  const sendCode = useCallback(
    async (email) => {
      const active = await ensureClient();
      if (!active) return { error: new Error('Ordering is not available right now.') };

      const { error } = await active.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          /* Only used if the project sends links rather than codes. Coming back
             to the same origin means the cart is still there. */
          emailRedirectTo: window.location.origin,
        },
      });
      return { error };
    },
    [ensureClient]
  );

  const verifyCode = useCallback(
    async (email, token) => {
      const active = await ensureClient();
      if (!active) return { error: new Error('Ordering is not available right now.') };

      const { error } = await active.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });
      return { error };
    },
    [ensureClient]
  );

  const signOut = useCallback(async () => {
    if (client) await client.auth.signOut();
  }, [client]);

  const value = useMemo(
    () => ({
      client,
      ensureClient,
      session,
      user: session?.user ?? null,
      email: session?.user?.email ?? null,
      isSignedIn: Boolean(session),
      isStaff,
      loading,
      available: isSupabaseConfigured,
      sendCode,
      verifyCode,
      signOut,
    }),
    [client, ensureClient, session, isStaff, loading, sendCode, verifyCode, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
