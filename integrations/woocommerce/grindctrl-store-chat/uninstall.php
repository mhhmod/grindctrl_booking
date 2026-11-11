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
		'grindctrl_sc_tryon_product',
		'grindctrl_sc_tryon_catalog',
		'grindctrl_sc_tryon_ip_header',
		'grindctrl_sc_installed_version',
	) as $name ) {
		delete_option( $name );
	}

	// Spent request nonces (see grindctrl_sc_claim_nonce) and Try-On visitor counters.
	global $wpdb;
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( 'gc_sc_n_' ) . '%' ) );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", $wpdb->esc_like( 'gc_sc_tv_' ) . '%' ) );
}

delete_site_transient( 'grindctrl_sc_plugin_release' );
delete_site_option( 'grindctrl_sc_autoupdate_defaulted' );
$grindctrl_sc_auto_updates = (array) get_site_option( 'auto_update_plugins', array() );
update_site_option( 'auto_update_plugins', array_values( array_diff( $grindctrl_sc_auto_updates, array( grindctrl_sc_plugin_basename() ) ) ) );

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
