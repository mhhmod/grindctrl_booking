# Dashboard Data API Contract

**Version**: 1.0.0  
**Date**: 2026-04-21  
**Consumer**: Dashboard (`app.js`)  
**Provider**: Supabase (authenticated via Clerk)

## Overview

All dashboard data operations go through the authenticated Supabase client with Clerk user context. RLS policies enforce workspace-based access control.

## Authentication

Every request includes the Clerk user ID in the Postgres session via `app.clerk_user_id` setting. RLS policies check workspace membership.

## Operations

### 1. List Widget Sites

```javascript
const { data, error } = await supabase
  .from('widget_sites')
  .select('id, name, status, embed_key, created_at, updated_at')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });
```

**RLS**: User must be a member of the workspace.

### 2. Create Widget Site

```javascript
const { data, error } = await supabase
  .from('widget_sites')
  .insert({
    workspace_id: workspaceId,
    created_by_profile_id: profileId,
    name: siteName,
    status: 'draft'
  })
  .select()
  .single();
```

**RLS**: User must be a member of the workspace. `embed_key` is auto-generated.

### 3. Update Widget Site (name, status, config)

```javascript
const { data, error } = await supabase
  .from('widget_sites')
  .update({
    name: newName,
    status: newStatus,
    config_json: { ... },
    branding_json: { ... },
    lead_capture_json: { ... }
  })
  .eq('id', siteId)
  .select()
  .single();
```

**RLS**: User must be a member of the workspace containing the site.

### 4. Regenerate Embed Key

```javascript
const { data, error } = await supabase
  .from('widget_sites')
  .update({ embed_key: generateEmbedKey() })
  .eq('id', siteId)
  .select()
  .single();
```

**RLS**: User must be workspace owner or admin.

### 5. List Domains

```javascript
const { data, error } = await supabase
  .from('widget_domains')
  .select('*')
  .eq('widget_site_id', siteId)
  .order('created_at', { ascending: false });
```

**RLS**: User must be a member of the workspace containing the site.

### 6. Add Domain

```javascript
const { data, error } = await supabase
  .from('widget_domains')
  .insert({
    widget_site_id: siteId,
    domain: domainName,
    verification_status: 'pending'
  })
  .select()
  .single();
```

**RLS**: User must be a member of the workspace.

### 7. Update Domain Status (Verify/Reject)

```javascript
const { data, error } = await supabase
  .from('widget_domains')
  .update({ verification_status: 'verified' })  // or 'failed'
  .eq('id', domainId)
  .select()
  .single();
```

**RLS**: User must be workspace owner or admin.

### 8. Delete Domain

```javascript
const { data, error } = await supabase
  .from('widget_domains')
  .delete()
  .eq('id', domainId);
```

**RLS**: User must be workspace owner or admin.

### 9. List Intents

```javascript
const { data, error } = await supabase
  .from('widget_intents')
  .select('*')
  .eq('widget_site_id', siteId)
  .order('sort_order', { ascending: true });
```

**RLS**: User must be a member of the workspace containing the site.

### 10. Create/Update/Delete Intent

Standard Supabase CRUD operations on `widget_intents` table.

**RLS**: User must be a member of the workspace.

### 11. List Leads

```javascript
const { data, error } = await supabase
  .from('widget_leads')
  .select('*')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });
```

**RLS**: User must be a member of the workspace.

## Error Handling

| Error Code | Meaning | Dashboard Action |
|------------|---------|------------------|
| 403 | RLS violation | Show auth error; redirect to sign-in |
| 409 | Unique violation (embed_key) | Retry with new key (extremely unlikely) |
| 23514 | Check constraint violation | Show validation error on the field |

## Data Sync Strategy

- **Optimistic UI**: Dashboard updates local state immediately, then sends to Supabase
- **Error rollback**: If Supabase update fails, revert local state and show inline error
- **Real-time**: Not required in MVP; manual refresh acceptable
