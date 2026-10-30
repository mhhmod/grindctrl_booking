<?php
/**
 * Removes the plugin's settings. Chats and their data live in GRINDCTRL and
 * are managed from the GRINDCTRL dashboard, not from this site.
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

function grindctrl_sc_delete_options() {
	delete_option( 'grindctrl_sc_embed_key' );
	delete_option( 'grindctrl_sc_scope' );
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
