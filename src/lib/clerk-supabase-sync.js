import { getSupabase, isSupabaseConfigured } from './supabase.js';

export { isSupabaseConfigured };

const workspaceRequestCache = new Map();

export async function syncClerkUserToSupabase(clerkUser) {
  if (!clerkUser) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const clerkUserId = clerkUser.id;
  const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
  const firstName = clerkUser.firstName || '';
  const lastName = clerkUser.lastName || '';
  const imageUrl = clerkUser.imageUrl || '';

  try {
    const { data, error } = await supabase.rpc('bootstrap_user', {
      p_clerk_user_id: clerkUserId,
      p_email: primaryEmail,
      p_first_name: firstName || null,
      p_last_name: lastName || null,
      p_image_url: imageUrl || null,
    });

    if (error) {
      console.error('[clerk-sync] bootstrap_user failed:', error.message);
      return null;
    }

    if (!data || !data.profile) {
      console.error('[clerk-sync] bootstrap_user returned no profile');
      return null;
    }

    const profile = data.profile;
    const workspace = data.workspace || null;

    return {
      profile,
      profileCreated: new Date(profile.created_at) > Date.now() - 60000,
      workspace,
      workspaceCreated: workspace ? new Date(workspace.created_at) > Date.now() - 60000 : false,
    };
  } catch (err) {
    console.error('[clerk-sync] sync error:', err.message);
    return null;
  }
}

export async function getCurrentWorkspace(clerkUserId) {
  const client = getSupabase();
  if (!client || !clerkUserId) return null;

  if (workspaceRequestCache.has(clerkUserId)) {
    return workspaceRequestCache.get(clerkUserId);
  }

  const request = (async function () {
    try {
      const { data, error } = await client.rpc('get_user_workspace', {
        p_clerk_user_id: clerkUserId,
      });

      if (error) {
        console.error('[clerk-sync] get_user_workspace failed:', error.message);
        return null;
      }

      if (!data || !data.workspace) return null;

      return {
        workspace: data.workspace,
        sites: Array.isArray(data.sites) ? data.sites : [],
      };
    } catch (err) {
      console.error('[clerk-sync] get_user_workspace error:', err.message);
      return null;
    } finally {
      workspaceRequestCache.delete(clerkUserId);
    }
  })();

  workspaceRequestCache.set(clerkUserId, request);
  return request;
}

export async function getWidgetSites(workspaceId, clerkUserId) {
  if (!workspaceId || !clerkUserId) return [];

  const workspaceBundle = await getCurrentWorkspace(clerkUserId);
  if (!workspaceBundle) return [];

  return workspaceBundle.sites.filter(function (site) {
    return site.workspace_id === workspaceId;
  });
}

export async function createWidgetSite(workspaceId, profileId, name, domain) {
  const client = getSupabase();
  if (!client || !workspaceId || !profileId) return null;

  try {
    const { data, error } = await client
      .from('widget_sites')
      .insert({
        workspace_id: workspaceId,
        created_by_profile_id: profileId,
        name: name || 'New Widget Site',
        domain: domain || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] createWidgetSite failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] createWidgetSite error:', err.message);
    return null;
  }
}

export async function getWorkspaceDomains(widgetSiteId) {
  const client = getSupabase();
  if (!client || !widgetSiteId) return [];

  try {
    const { data, error } = await client
      .from('widget_domains')
      .select('*')
      .eq('widget_site_id', widgetSiteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[clerk-sync] getWorkspaceDomains failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[clerk-sync] getWorkspaceDomains error:', err.message);
    return [];
  }
}
