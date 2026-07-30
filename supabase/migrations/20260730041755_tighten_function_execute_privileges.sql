-- `revoke ... from public` is not sufficient here. This project has default
-- privileges that grant EXECUTE on every new function in public directly to
-- anon, authenticated and service_role, so those grants survive a revoke aimed
-- at PUBLIC. They have to be revoked by name.

-- place_order already refuses a null auth.uid(), but an unauthenticated caller
-- has no business reaching a SECURITY DEFINER function at all.
revoke execute on function public.place_order(jsonb, text, text, text, text, text) from anon;

-- Trigger functions are invoked by the trigger, never over the API.
revoke execute on function public.touch_updated_at() from anon, authenticated;

-- Answering "am I staff?" is meaningless before signing in.
revoke execute on function public.is_staff() from anon;
