<?php
/**
 * Removes the plugin's settings and connection credentials, after telling
 * GRINDCTRL this site is gone (best effort, short timeout; an unreachable
 * GRINDCTRL never blocks the uninstall). Chats and their data live in
 * GRINDCTRL and are managed from the GRINDCTRL dashboard, not from this site.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// The plugin is inactive here, so load its signer rather than copying it.
if ( ! function_exists( 'grindctrl_sc_disconnect_remote' ) ) {
	require_once __DIR__ . '/grindctrl-store-chat.php';
}

function grindctrl_sc_delete_options() {
	grindctrl_sc_disconnect_remote( 3, 'uninstall' );
	wp_clear_scheduled_hook( GRINDCTRL_SC_HEARTBEAT_HOOK );

	foreach ( array(
		'grindctrl_sc_embed_key',
		'grindctrl_sc_scope',
		'grindctrl_sc_site_id',
		'grindctrl_sc_secret',
		'grindctrl_sc_secret_version',
		'grindctrl_sc_connection_status',
		'grindctrl_sc_min_plugin_version',
		'grindctrl_sc_last_error',
	) as $name ) {
		delete_option( $name );
	}
}

if ( is_multisite() ) {
	$grindctrl_sc_sites = get_sites(
		array(
			'fields' => 'ids',
			'number' => 10000,
		)
	);
	foreach ( $grindctrl_sc_sites as $grindctrl_sc_site_id ) {
		switch_to_blog( $grindctrl_sc_site_id );
		grindctrl_sc_delete_options();
		restore_current_blog();
	}
} else {
	grindctrl_sc_delete_options();
}
