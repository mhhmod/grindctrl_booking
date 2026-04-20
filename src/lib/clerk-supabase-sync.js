import { getSupabase, isSupabaseConfigured, setClerkUserId, getClerkUserId, getSupabaseWithClerkContext } from './supabase.js';

export { isSupabaseConfigured };

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
      console.error('[clerk-sync] Bootstrap RPC failed:', error.message);
      return null;
    }

    if (!data) {
      console.error('[clerk-sync] Bootstrap returned no data');
      return null;
    }

    const profile = data.profile;
    const workspace = data.workspace;

    setClerkUserId(clerkUserId);

    return {
      profile,
      profileCreated: new Date(profile.created_at) > Date.now() - 60000,
      workspace,
      workspaceCreated: workspace ? new Date(workspace.created_at) > Date.now() - 60000 : false,
    };
  } catch (err) {
    console.error('[clerk-sync] Sync error:', err.message);
    return null;
  }
}

export async function getCurrentWorkspace(profile) {
  const client = getSupabaseWithClerkContext();
  if (!client || !profile) return null;

  const clerkUserId = getClerkUserId();
  if (!clerkUserId) return null;

  try {
    const { data, error } = await client.rpc('get_user_workspace', {
      p_clerk_user_id: clerkUserId,
    });

    if (error) {
      console.error('[clerk-sync] get_user_workspace failed:', error.message);
      return null;
    }

    return data?.workspace || null;
  } catch (err) {
    console.error('[clerk-sync] get_user_workspace error:', err.message);
    return null;
  }
}

export async function getWidgetSites(workspaceId) {
  const client = getSupabaseWithClerkContext();
  if (!client || !workspaceId) return [];

  try {
    const { data, error } = await client
      .from('widget_sites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[clerk-sync] getWidgetSites failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[clerk-sync] getWidgetSites error:', err.message);
    return [];
  }
}

export async function createWidgetSite(workspaceId, profileId, name, domain) {
  const client = getSupabaseWithClerkContext();
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

export async function getWorkspaceDomains(workspaceId) {
  const client = getSupabaseWithClerkContext();
  if (!client || !workspaceId) return [];

  try {
    const { data, error } = await client
      .from('widget_domains')
      .select('*')
      .eq('widget_site_id', workspaceId)
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