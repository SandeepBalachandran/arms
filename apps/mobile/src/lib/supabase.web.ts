import type { Database } from '@gymos/shared';
import { createBrowserClient } from '@supabase/ssr';

// On the web the session lives in cookies, exactly like the admin site's
// (apps/web, @supabase/ssr). The member app and the admin share one origin,
// so signing in to either signs in to both.
export const supabase = createBrowserClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { detectSessionInUrl: false } },
);
