<?php
/** WordPress-native updates. Release metadata and package bytes travel over HTTPS. */
defined( 'ABSPATH' ) || exit;

function grindctrl_sc_plugin_basename() {
	return plugin_basename( GRINDCTRL_SC_PLUGIN_FILE );
}

function grindctrl_sc_update_package_allowed( $url ) {
	$package = is_string( $url ) && strlen( $url ) <= 2048 ? wp_parse_url( $url ) : false;
	$api     = wp_parse_url( GRINDCTRL_SC_API_BASE );
	return is_array( $package ) && is_array( $api ) && false !== filter_var( $url, FILTER_VALIDATE_URL )
		&& isset( $package['scheme'], $package['host'], $api['host'] )
		&& 'https' === strtolower( $package['scheme'] )
		&& strtolower( $package['host'] ) === strtolower( $api['host'] )
		&& ! isset( $package['user'] ) && ! isset( $package['pass'] )
		&& ! isset( $package['fragment'] )
		&& ( ! isset( $package['port'] ) || 443 === $package['port'] );
}

/** Validate required fields before either caching or using a cached response. */
function grindctrl_sc_validate_release( $data ) {
	if ( ! is_array( $data ) ) {
		return false;
	}
	foreach ( array( 'version', 'requires', 'requires_php', 'tested', 'wc_tested' ) as $field ) {
		if ( ! isset( $data[ $field ] ) || ! is_string( $data[ $field ] )
			|| strlen( $data[ $field ] ) > 64 || ! grindctrl_sc_valid_version( $data[ $field ] ) ) {
			return false;
		}
	}
	if ( ! isset( $data['package'], $data['sha256'], $data['homepage'], $data['last_updated'], $data['changelog_html'] )
		|| ! grindctrl_sc_update_package_allowed( $data['package'] )
		|| ! is_string( $data['sha256'] ) || 1 !== preg_match( '/^[a-f0-9]{64}$/', $data['sha256'] )
		|| ! is_string( $data['homepage'] ) || strlen( $data['homepage'] ) > 2048
		|| ! filter_var( $data['homepage'], FILTER_VALIDATE_URL )
		|| 'https' !== wp_parse_url( $data['homepage'], PHP_URL_SCHEME )
		|| ! is_string( $data['last_updated'] ) || 1 !== preg_match( '/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $data['last_updated'] )
		|| ! is_string( $data['changelog_html'] ) || strlen( $data['changelog_html'] ) > 65536 ) {
		return false;
	}
	$date = explode( '-', $data['last_updated'] );
	if ( ! checkdate( (int) $date[1], (int) $date[2], (int) $date[0] ) ) {
		return false;
	}
	// Keep only known fields. No remote HTML is used without WordPress sanitization.
	return array(
		'version'        => $data['version'],
		'package'        => $data['package'],
		'sha256'         => $data['sha256'],
		'requires'       => $data['requires'],
		'requires_php'   => $data['requires_php'],
		'tested'         => $data['tested'],
		'wc_tested'      => $data['wc_tested'],
		'homepage'       => esc_url_raw( $data['homepage'], array( 'https' ) ),
		'last_updated'   => $data['last_updated'],
		'changelog_html' => wp_kses_post( $data['changelog_html'] ),
	);
}

function grindctrl_sc_plugin_release() {
	$cached = get_site_transient( 'grindctrl_sc_plugin_release' );
	if ( false !== $cached ) {
		return grindctrl_sc_validate_release( $cached );
	}
	$url  = grindctrl_sc_api_url( '/api/woo/plugin/update' );
	$data = false;
	if ( ! is_wp_error( $url ) ) {
		$response = wp_remote_get( $url, array(
			'timeout'             => 5,
			'redirection'         => 0,
			'cookies'             => array(),
			'user-agent'          => 'GRINDCTRL-Store-Chat/' . GRINDCTRL_SC_VERSION . '; ' . wp_parse_url( home_url( '/' ), PHP_URL_HOST ),
			'limit_response_size' => 131072,
		) );
		if ( ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response ) ) {
			$data = grindctrl_sc_validate_release( json_decode( wp_remote_retrieve_body( $response ), true ) );
		}
	}
	// A non-false sentinel caches failures too, avoiding repeated wp-admin delays.
	set_site_transient( 'grindctrl_sc_plugin_release', $data ? $data : 'unavailable', $data ? 12 * HOUR_IN_SECONDS : HOUR_IN_SECONDS );
	return $data;
}

function grindctrl_sc_plugin_update( $update, $plugin_data, $plugin_file, $locales ) {
	if ( grindctrl_sc_plugin_basename() !== $plugin_file ) {
		return $update;
	}
	$data = grindctrl_sc_plugin_release();
	if ( ! $data ) {
		return false;
	}
	return array(
		'id'           => 'https://grindctrl.cloud',
		'slug'         => 'grindctrl-store-chat',
		'version'      => $data['version'],
		'url'          => $data['homepage'],
		'package'      => $data['package'],
		'tested'       => $data['tested'],
		'requires_php' => $data['requires_php'],
		'requires'     => $data['requires'],
		// WordPress retains this with the advertised URL even if our cache expires
		// or another release is published before the scheduled upgrade runs.
		'sha256'       => $data['sha256'],
	);
}
add_filter( 'update_plugins_grindctrl.cloud', 'grindctrl_sc_plugin_update', 10, 4 );

function grindctrl_sc_plugin_information( $result, $action, $args ) {
	if ( 'plugin_information' !== $action || ! is_object( $args )
		|| ! isset( $args->slug ) || 'grindctrl-store-chat' !== $args->slug ) {
		return $result;
	}
	$data = grindctrl_sc_plugin_release();
	if ( ! $data ) {
		return new WP_Error( 'grindctrl_sc_update_unavailable', __( 'Update details are temporarily unavailable. Try again later.', 'grindctrl-store-chat' ) );
	}
	return (object) array(
		'name'          => 'GRINDCTRL Store Chat',
		'slug'          => 'grindctrl-store-chat',
		'version'       => $data['version'],
		'author'        => 'Grind CTRL',
		'homepage'      => $data['homepage'],
		'requires'      => $data['requires'],
		'requires_php'  => $data['requires_php'],
		'tested'        => $data['tested'],
		'last_updated'  => $data['last_updated'],
		'sections'      => array(
			'description' => '<p>' . esc_html__( 'Adds GRINDCTRL Store Chat and AI Virtual Try-On to your WooCommerce store.', 'grindctrl-store-chat' ) . '</p>',
			'changelog'   => $data['changelog_html'],
		),
		'download_link' => $data['package'],
	);
}
add_filter( 'plugins_api', 'grindctrl_sc_plugin_information', 10, 3 );

function grindctrl_sc_verify_update_download( $reply, $package, $upgrader, $hook_extra ) {
	// Read only already advertised metadata, never fetch for another plugin.
	$updates = get_site_transient( 'update_plugins' );
	$records = array();
	foreach ( array( 'response', 'no_update' ) as $bucket ) {
		if ( is_object( $updates ) && isset( $updates->$bucket[ grindctrl_sc_plugin_basename() ] ) ) {
			$records[] = (array) $updates->$bucket[ grindctrl_sc_plugin_basename() ];
		}
	}
	$records[] = get_site_transient( 'grindctrl_sc_plugin_release' );
	foreach ( $records as $record ) {
		if ( ! is_array( $record ) || ! isset( $record['package'] ) || $package !== $record['package'] ) {
			continue;
		}
		if ( ! grindctrl_sc_update_package_allowed( $package ) || ! isset( $record['sha256'] )
			|| ! is_string( $record['sha256'] ) || 1 !== preg_match( '/^[a-f0-9]{64}$/', $record['sha256'] ) ) {
			return new WP_Error( 'grindctrl_sc_unsigned_update', __( 'The GRINDCTRL update has no valid SHA-256 checksum.', 'grindctrl-store-chat' ) );
		}
		if ( is_wp_error( $reply ) ) {
			return $reply;
		}
		require_once ABSPATH . 'wp-admin/includes/file.php';
		// Always download our own bytes, so another filter cannot bypass verification.
		$file = download_url( $package );
		if ( is_wp_error( $file ) ) {
			return $file;
		}
		$hash = hash_file( 'sha256', $file );
		if ( ! is_string( $hash ) || ! hash_equals( $record['sha256'], $hash ) ) {
			wp_delete_file( $file );
			return new WP_Error( 'grindctrl_sc_update_checksum', __( 'The GRINDCTRL update checksum did not match. The update was not installed.', 'grindctrl-store-chat' ) );
		}
		return $file;
	}
	return $reply;
}
add_filter( 'upgrader_pre_download', 'grindctrl_sc_verify_update_download', 10, 4 );

/** One lifecycle entry point; never resets keys, connection or Try-On preferences. */
function grindctrl_sc_version_changed( $activation = false ) {
	if ( ! $activation && GRINDCTRL_SC_VERSION === get_option( 'grindctrl_sc_installed_version', '' ) ) {
		return;
	}
	if ( false === get_site_option( 'grindctrl_sc_autoupdate_defaulted', false ) ) {
		$plugins = (array) get_site_option( 'auto_update_plugins', array() );
		if ( ! in_array( grindctrl_sc_plugin_basename(), $plugins, true ) ) {
			$plugins[] = grindctrl_sc_plugin_basename();
			update_site_option( 'auto_update_plugins', $plugins );
		}
		update_site_option( 'grindctrl_sc_autoupdate_defaulted', true );
	}
	grindctrl_sc_schedule_heartbeat();
	delete_site_transient( 'grindctrl_sc_plugin_release' );
	grindctrl_sc_update_private_option( 'grindctrl_sc_installed_version', GRINDCTRL_SC_VERSION );
}
add_action( 'plugins_loaded', 'grindctrl_sc_version_changed' );
