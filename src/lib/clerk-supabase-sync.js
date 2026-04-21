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

export async function getUserRole(clerkUserId, workspaceId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !workspaceId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_get_user_role', {
      p_clerk_user_id: clerkUserId,
      p_workspace_id: workspaceId,
    });

    if (error) {
      console.error('[clerk-sync] getUserRole failed:', error.message);
      return null;
    }
    return data || null;
  } catch (err) {
    console.error('[clerk-sync] getUserRole error:', err.message);
    return null;
  }
}

export async function createWidgetSite(clerkUserId, workspaceId, name) {
  const client = getSupabase();
  if (!client || !clerkUserId || !workspaceId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_create_widget_site', {
      p_clerk_user_id: clerkUserId,
      p_workspace_id: workspaceId,
      p_name: name || 'New Widget Site',
    });

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

export async function updateWidgetSite(clerkUserId, siteId, updates) {
  const client = getSupabase();
  if (!client || !clerkUserId || !siteId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_update_widget_site', {
      p_clerk_user_id: clerkUserId,
      p_site_id: siteId,
      p_name: updates.name || null,
      p_status: updates.status || null,
      p_config_json: updates.config_json || null,
      p_branding_json: updates.branding_json || null,
      p_lead_capture_json: updates.lead_capture_json || null,
    });

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

export async function deleteWidgetSite(clerkUserId, siteId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !siteId) return false;

  try {
    const { error } = await client.rpc('dashboard_delete_widget_site', {
      p_clerk_user_id: clerkUserId,
      p_site_id: siteId,
    });

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

export async function regenerateEmbedKey(clerkUserId, siteId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !siteId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_regenerate_embed_key', {
      p_clerk_user_id: clerkUserId,
      p_site_id: siteId,
    });

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

export async function getWorkspaceDomains(clerkUserId, widgetSiteId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !widgetSiteId) return [];

  try {
    const { data, error } = await client.rpc('dashboard_list_domains', {
      p_clerk_user_id: clerkUserId,
      p_site_id: widgetSiteId,
    });

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

export async function addDomain(clerkUserId, widgetSiteId, domainName) {
  const client = getSupabase();
  if (!client || !clerkUserId || !widgetSiteId || !domainName) return null;

  try {
    const { data, error } = await client.rpc('dashboard_add_domain', {
      p_clerk_user_id: clerkUserId,
      p_site_id: widgetSiteId,
      p_domain: domainName,
    });

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

export async function updateDomainStatus(clerkUserId, domainId, status) {
  const client = getSupabase();
  if (!client || !clerkUserId || !domainId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_update_domain_status', {
      p_clerk_user_id: clerkUserId,
      p_domain_id: domainId,
      p_status: status,
    });

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

export async function removeDomain(clerkUserId, domainId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !domainId) return false;

  try {
    const { error } = await client.rpc('dashboard_remove_domain', {
      p_clerk_user_id: clerkUserId,
      p_domain_id: domainId,
    });

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

export async function getWidgetIntents(clerkUserId, widgetSiteId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !widgetSiteId) return [];

  try {
    const { data, error } = await client.rpc('dashboard_list_intents', {
      p_clerk_user_id: clerkUserId,
      p_site_id: widgetSiteId,
    });

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

export async function createIntent(clerkUserId, widgetSiteId, intent) {
  const client = getSupabase();
  if (!client || !clerkUserId || !widgetSiteId || !intent) return null;

  try {
    const { data, error } = await client.rpc('dashboard_create_intent', {
      p_clerk_user_id: clerkUserId,
      p_site_id: widgetSiteId,
      p_label: intent.label,
      p_icon: intent.icon || 'chat',
      p_action_type: intent.action_type || 'send_message',
      p_message_text: intent.message_text || null,
      p_external_url: intent.external_url || null,
      p_sort_order: intent.sort_order || 0,
    });

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

export async function updateIntent(clerkUserId, intentId, updates) {
  const client = getSupabase();
  if (!client || !clerkUserId || !intentId) return null;

  try {
    const { data, error } = await client.rpc('dashboard_update_intent', {
      p_clerk_user_id: clerkUserId,
      p_intent_id: intentId,
      p_label: updates.label || null,
      p_icon: updates.icon || null,
      p_action_type: updates.action_type || null,
      p_message_text: updates.message_text || null,
      p_external_url: updates.external_url || null,
      p_sort_order: updates.sort_order !== undefined ? updates.sort_order : null,
    });

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

export async function deleteIntent(clerkUserId, intentId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !intentId) return false;

  try {
    const { error } = await client.rpc('dashboard_delete_intent', {
      p_clerk_user_id: clerkUserId,
      p_intent_id: intentId,
    });

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

export async function getWidgetLeads(clerkUserId, workspaceId, widgetSiteId) {
  const client = getSupabase();
  if (!client || !clerkUserId || !workspaceId) return [];

  try {
    const { data, error } = await client.rpc('dashboard_list_leads', {
      p_clerk_user_id: clerkUserId,
      p_workspace_id: workspaceId,
      p_site_id: widgetSiteId || null,
    });

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
    const { data, error } = await client.rpc('submit_widget_lead', {
      p_widget_site_id: lead.widget_site_id,
      p_workspace_id: lead.workspace_id,
      p_name: lead.name || null,
      p_email: lead.email || null,
      p_phone: lead.phone || null,
      p_company: lead.company || null,
      p_source_domain: lead.source_domain || null,
    });

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
