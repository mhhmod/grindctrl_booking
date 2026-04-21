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

export async function updateWidgetSite(siteId, updates) {
  const client = getSupabase();
  if (!client || !siteId) return null;

  try {
    const { data, error } = await client
      .from('widget_sites')
      .update(updates)
      .eq('id', siteId)
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] updateWidgetSite failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] updateWidgetSite error:', err.message);
    return null;
  }
}

export async function deleteWidgetSite(siteId) {
  const client = getSupabase();
  if (!client || !siteId) return false;

  try {
    const { error } = await client
      .from('widget_sites')
      .delete()
      .eq('id', siteId);

    if (error) {
      console.error('[clerk-sync] deleteWidgetSite failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[clerk-sync] deleteWidgetSite error:', err.message);
    return false;
  }
}

export async function regenerateEmbedKey(siteId) {
  const client = getSupabase();
  if (!client || !siteId) return null;

  const newKey = 'gc_' +
    Math.random().toString(36).substring(2, 10) + '_' +
    Math.random().toString(36).substring(2, 10) + '_' +
    Math.random().toString(36).substring(2, 10);

  try {
    const { data, error } = await client
      .from('widget_sites')
      .update({ embed_key: newKey })
      .eq('id', siteId)
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] regenerateEmbedKey failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] regenerateEmbedKey error:', err.message);
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

export async function addDomain(widgetSiteId, domainName) {
  const client = getSupabase();
  if (!client || !widgetSiteId || !domainName) return null;

  try {
    const { data, error } = await client
      .from('widget_domains')
      .insert({
        widget_site_id: widgetSiteId,
        domain: domainName,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] addDomain failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] addDomain error:', err.message);
    return null;
  }
}

export async function updateDomainStatus(domainId, status) {
  const client = getSupabase();
  if (!client || !domainId) return null;

  try {
    const { data, error } = await client
      .from('widget_domains')
      .update({ verification_status: status })
      .eq('id', domainId)
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] updateDomainStatus failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] updateDomainStatus error:', err.message);
    return null;
  }
}

export async function removeDomain(domainId) {
  const client = getSupabase();
  if (!client || !domainId) return false;

  try {
    const { error } = await client
      .from('widget_domains')
      .delete()
      .eq('id', domainId);

    if (error) {
      console.error('[clerk-sync] removeDomain failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[clerk-sync] removeDomain error:', err.message);
    return false;
  }
}

export async function getWidgetIntents(widgetSiteId) {
  const client = getSupabase();
  if (!client || !widgetSiteId) return [];

  try {
    const { data, error } = await client
      .from('widget_intents')
      .select('*')
      .eq('widget_site_id', widgetSiteId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[clerk-sync] getWidgetIntents failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[clerk-sync] getWidgetIntents error:', err.message);
    return [];
  }
}

export async function createIntent(widgetSiteId, intent) {
  const client = getSupabase();
  if (!client || !widgetSiteId || !intent) return null;

  try {
    const { data, error } = await client
      .from('widget_intents')
      .insert({
        widget_site_id: widgetSiteId,
        label: intent.label,
        icon: intent.icon || 'chat',
        action_type: intent.action_type || 'send_message',
        message_text: intent.message_text || null,
        external_url: intent.external_url || null,
        sort_order: intent.sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] createIntent failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] createIntent error:', err.message);
    return null;
  }
}

export async function updateIntent(intentId, updates) {
  const client = getSupabase();
  if (!client || !intentId) return null;

  try {
    const { data, error } = await client
      .from('widget_intents')
      .update(updates)
      .eq('id', intentId)
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] updateIntent failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] updateIntent error:', err.message);
    return null;
  }
}

export async function deleteIntent(intentId) {
  const client = getSupabase();
  if (!client || !intentId) return false;

  try {
    const { error } = await client
      .from('widget_intents')
      .delete()
      .eq('id', intentId);

    if (error) {
      console.error('[clerk-sync] deleteIntent failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[clerk-sync] deleteIntent error:', err.message);
    return false;
  }
}

export async function getWidgetLeads(workspaceId, widgetSiteId) {
  const client = getSupabase();
  if (!client || !workspaceId) return [];

  try {
    let query = client
      .from('widget_leads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (widgetSiteId) {
      query = query.eq('widget_site_id', widgetSiteId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[clerk-sync] getWidgetLeads failed:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[clerk-sync] getWidgetLeads error:', err.message);
    return [];
  }
}

export async function submitLeadFromWidget(lead) {
  const client = getSupabase();
  if (!client || !lead) return null;

  try {
    const { data, error } = await client
      .from('widget_leads')
      .insert({
        widget_site_id: lead.widget_site_id,
        workspace_id: lead.workspace_id,
        name: lead.name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        company: lead.company || null,
        source_domain: lead.source_domain || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[clerk-sync] submitLeadFromWidget failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[clerk-sync] submitLeadFromWidget error:', err.message);
    return null;
  }
}
