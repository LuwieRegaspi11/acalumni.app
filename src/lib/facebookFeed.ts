// Client side of the facebook-feed Edge Function
// (supabase/functions/facebook-feed/index.ts). The Facebook Page token lives
// only on the server; this just asks for the already-fetched posts.
//
// Fails quietly on purpose: if the function isn't deployed, isn't configured
// yet (no token), or Facebook is unreachable, the homepage simply doesn't show
// the Facebook section.
import { supabase } from './supabaseClient';

export interface FacebookPost {
  id: string;
  message: string;
  createdTime: string;
  url: string;
  image: string | null;
}

export interface FacebookFeed {
  pageUrl: string;
  posts: FacebookPost[];
}

export async function fetchFacebookFeed(): Promise<FacebookFeed | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ configured: boolean; pageUrl?: string; posts?: FacebookPost[] }>('facebook-feed');
    if (error || !data?.configured || !data.posts?.length) return null;
    return { pageUrl: data.pageUrl || '', posts: data.posts };
  } catch {
    return null;
  }
}
