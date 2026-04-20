import { getSupabase, isSupabaseConfigured } from './supabase.js';

export { isSupabaseConfigured };

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace';
}

export async function getOrCreateProfileFromClerkUser(clerkUser) {
  const supabase = getSupabase();
  if (!supabase || !clerkUser) return null;

  const clerkUserId = clerkUser.id;
  const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
  const firstName = clerkUser.firstName || '';
  const lastName = clerkUser.lastName || '';
  const imageUrl = clerkUser.imageUrl || '';

  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (existing) {
    return { profile: existing, created: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({
      clerk_user_id: clerkUserId,
      email: primaryEmail,
      first_name: firstName,
      last_name: lastName,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retry } = await supabase
        .from('profiles')
        .select('*')
        .eq('clerk_user_id', clerkUserId)
        .single();
      return { profile: retry, created: false };
    }
    console.error('[clerk-sync] Failed to create profile:', insertError.message);
    return null;
  }

  return { profile: inserted, created: true };
}

export async function getOrCreateDefaultWorkspace(profile) {
  const supabase = getSupabase();
  if (!supabase || !profile) return null;

  const { data: existing, error: fetchError } = await supabase
    .from('workspaces')
    .select('*, workspace_members!inner(role)')
    .eq('owner_profile_id', profile.id)
    .single();

  if (existing) {
    return { workspace: existing, created: false };
  }

  const name = (profile.first_name && profile.last_name)
    ? `${profile.first_name}'s Workspace`
    : (profile.first_name || profile.email.split('@')[0]) + "'s Workspace";

  const slug = slugify(name) + '-' + Math.random().toString(36).slice(2, 6);

  const { data: inserted, error: insertError } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug,
      owner_profile_id: profile.id,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: retry } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_profile_id', profile.id)
        .single();
      return { workspace: retry, created: false };
    }
    console.error('[clerk-sync] Failed to create workspace:', insertError.message);
    return null;
  }

  return { workspace: inserted, created: true };
}

export async function getCurrentWorkspace(profile) {
  const supabase = getSupabase();
  if (!supabase || !profile) return null;

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_profile_id', profile.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

export async function getWidgetSites(workspaceId) {
  const supabase = getSupabase();
  if (!supabase || !workspaceId) return [];

  const { data, error } = await supabase
    .from('widget_sites')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[clerk-sync] Failed to fetch widget sites:', error.message);
    return [];
  }
  return data || [];
}

export async function createWidgetSite(workspaceId, profileId, name, domain) {
  const supabase = getSupabase();
  if (!supabase || !workspaceId || !profileId) return null;

  const { data, error } = await supabase
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
    console.error('[clerk-sync] Failed to create widget site:', error.message);
    return null;
  }
  return data;
}

export async function syncClerkUserToSupabase(clerkUser) {
  if (!clerkUser) return null;

  const profileResult = await getOrCreateProfileFromClerkUser(clerkUser);
  if (!profileResult || !profileResult.profile) return null;

  const workspaceResult = await getOrCreateDefaultWorkspace(profileResult.profile);

  return {
    profile: profileResult.profile,
    profileCreated: profileResult.created,
    workspace: workspaceResult?.workspace || null,
    workspaceCreated: workspaceResult?.created || false,
  };
}
