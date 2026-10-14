CREATE TABLE public.guest_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  user_agent text,
  ip text,
  country text,
  region text,
  city text,
  isp text,
  revoked boolean NOT NULL DEFAULT false,
  uses integer NOT NULL DEFAULT 0,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.guest_devices TO service_role;
ALTER TABLE public.guest_devices ENABLE ROW LEVEL SECURITY;