<?php
/**
 * Plugin Name:       GRINDCTRL Store Chat
 * Plugin URI:        https://grindctrl.cloud
 * Description:       Adds GRINDCTRL Store Chat to your store. On WooCommerce product pages it shares the product the shopper is viewing with the chat.
 * Version:           0.3.5
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Grind CTRL
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       grindctrl-store-chat
 * WC requires at least: 8.0
 * WC tested up to:   10.3
 */

defined( 'ABSPATH' ) || exit;

define( 'GRINDCTRL_SC_VERSION', '0.3.5' );
// Overridable from wp-config.php to point a test site at a GRINDCTRL staging server.
defined( 'GRINDCTRL_SC_SCRIPT' ) || define( 'GRINDCTRL_SC_SCRIPT', 'https://grindctrl.cloud/widget/v1/messenger.js' );
defined( 'GRINDCTRL_SC_DASHBOARD' ) || define( 'GRINDCTRL_SC_DASHBOARD', 'https://grindctrl.cloud/dashboard/store-chat/setup' );
defined( 'GRINDCTRL_SC_API_BASE' ) || define( 'GRINDCTRL_SC_API_BASE', 'https://grindctrl.cloud' );
define( 'GRINDCTRL_SC_HEARTBEAT_HOOK', 'grindctrl_sc_daily_heartbeat' );
require_once __DIR__ . '/includes/orders.php';
require_once __DIR__ . '/includes/identity.php';
require_once __DIR__ . '/includes/tryon.php';
require_once __DIR__ . '/includes/privacy.php';

/*
 * The embed key names the store's Store Chat. It is public: it ships in the
 * page, like any chat widget's app id. Store Chat only answers on a domain
 * the merchant has verified in the GRINDCTRL dashboard, so a copied key does
 * not work on anyone else's site.
 */
function grindctrl_sc_valid_key( $key ) {
	return is_string( $key ) && 1 === preg_match( '/^[a-z0-9_]{6,80}$/i', $key );
}

function grindctrl_sc_key() {
	$key = get_option( 'grindctrl_sc_embed_key', '' );
	return grindctrl_sc_valid_key( $key ) ? $key : '';
}

function grindctrl_sc_scope() {
	return 'woocommerce' === get_option( 'grindctrl_sc_scope', 'all' ) ? 'woocommerce' : 'all';
}

/* Connection and signed lifecycle calls. */

function grindctrl_sc_update_private_option( $name, $value ) {
	if ( false === get_option( $name, false ) ) {
		return add_option( $name, $value, '', 'no' );
	}
	return update_option( $name, $value );
}

/* Same shape the server accepts, so a valid site id is never refused here. */
function grindctrl_sc_valid_uuid( $value ) {
	return is_string( $value ) && 1 === preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value );
}

function grindctrl_sc_valid_secret( $value ) {
	return is_string( $value ) && 1 === preg_match( '/^[A-Za-z0-9_-]{43}$/', $value );
}

function grindctrl_sc_valid_version( $value ) {
	return is_string( $value ) && 1 === preg_match( '/^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/', $value );
}

/* GRINDCTRL requires a WooCommerce version for a WooCommerce site, so the
   platform is only "woocommerce" when that version is known. */
function grindctrl_sc_platform() {
	return defined( 'WC_VERSION' ) ? 'woocommerce' : 'wordpress';
}

function grindctrl_sc_site_payload() {
	$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : null;
	return array(
		'homeUrl'       => home_url( '/' ),
		'restUrl'       => rest_url(),
		'pluginVersion' => GRINDCTRL_SC_VERSION,
		'wpVersion'     => get_bloginfo( 'version' ),
		'wcVersion'     => defined( 'WC_VERSION' ) ? WC_VERSION : null,
		'timezone'      => wp_timezone_string(),
		'currency'      => is_string( $currency ) && '' !== $currency ? $currency : null,
		'platform'      => grindctrl_sc_platform(),
	);
}

function grindctrl_sc_api_url( $path ) {
	$base  = is_string( GRINDCTRL_SC_API_BASE ) ? trim( GRINDCTRL_SC_API_BASE ) : '';
	$parts = wp_parse_url( $base );
	if (
		! is_array( $parts )
		|| 'https' !== ( isset( $parts['scheme'] ) ? strtolower( $parts['scheme'] ) : '' )
		|| empty( $parts['host'] )
		|| ! empty( $parts['user'] )
		|| ! empty( $parts['pass'] )
		|| ! empty( $parts['query'] )
		|| ! empty( $parts['fragment'] )
		|| ( ! empty( $parts['path'] ) && '/' !== $parts['path'] )
	) {
		return new WP_Error( 'unavailable' );
	}
	return untrailingslashit( $base ) . $path;
}

function grindctrl_sc_base64url( $bytes ) {
	return rtrim( strtr( base64_encode( $bytes ), '+/', '-_' ), '=' );
}

function grindctrl_sc_connection_credentials() {
	$site_id = get_option( 'grindctrl_sc_site_id', '' );
	$secret  = get_option( 'grindctrl_sc_secret', '' );
	if ( ! grindctrl_sc_valid_uuid( $site_id ) || ! grindctrl_sc_valid_secret( $secret ) ) {
		return null;
	}
	return array(
		'site_id' => strtolower( $site_id ),
		'secret'  => $secret,
	);
}

function grindctrl_sc_signed_headers( $method, $path, $body ) {
	$credentials = grindctrl_sc_connection_credentials();
	if ( ! $credentials ) {
		return new WP_Error( 'site_disconnected' );
	}
	try {
		$nonce = grindctrl_sc_base64url( random_bytes( 18 ) );
	} catch ( Exception $error ) {
		return new WP_Error( 'unavailable' );
	}
	$timestamp = time();
	/*
	 * Canonical string, identical to lib/woo/signed-request.ts on the server:
	 *
	 *   UPPERCASE_METHOD \n PATH \n UNIX_SECONDS \n NONCE \n sha256_hex(BODY)
	 *
	 * PATH is the URL path without host or query (for example
	 * /api/woo/heartbeat). BODY is the exact JSON bytes sent. The signature
	 * is base64url (no padding) of HMAC-SHA256 over that string, keyed with
	 * the secret text exactly as stored (not decoded).
	 *
	 * Known-answer vector, also asserted by the server's tests:
	 *   secret    = 43 x "A"
	 *   method    = POST
	 *   path      = /api/woo/heartbeat
	 *   timestamp = 1799999999
	 *   nonce     = AAECAwQFBgcICQoLDA0ODxAR
	 *   body      = {"pluginVersion":"0.2.0"}
	 *   signature = vxmbLCq5jIPVvzPOqL5kALGMKfA47r-PaVdXOHPD6A8
	 */
	$canonical = strtoupper( $method ) . "\n" . $path . "\n" . $timestamp . "\n" . $nonce . "\n" . hash( 'sha256', $body );
	$signature = grindctrl_sc_base64url( hash_hmac( 'sha256', $canonical, $credentials['secret'], true ) );
	return array(
		'Content-Type'   => 'application/json',
		'X-GC-Site'      => $credentials['site_id'],
		'X-GC-Timestamp' => (string) $timestamp,
		'X-GC-Nonce'     => $nonce,
		'X-GC-Signature' => $signature,
	);
}

function grindctrl_sc_post_json( $path, $payload, $signed = false, $timeout = 10 ) {
	$url = grindctrl_sc_api_url( $path );
	if ( is_wp_error( $url ) ) {
		return $url;
	}
	$body = wp_json_encode( $payload );
	if ( false === $body ) {
		return new WP_Error( 'unavailable' );
	}
	$headers = array( 'Content-Type' => 'application/json' );
	if ( $signed ) {
		$headers = grindctrl_sc_signed_headers( 'POST', $path, $body );
		if ( is_wp_error( $headers ) ) {
			return $headers;
		}
	}
	return wp_remote_post(
		$url,
		array(
			'body'        => $body,
			'headers'     => $headers,
			'timeout'     => $timeout,
			'redirection' => 0,
			'data_format' => 'body',
		)
	);
}

function grindctrl_sc_known_error_code( $code ) {
	$known = array(
		'invalid_code',
		'expired_code',
		'bad_signature',
		'stale_timestamp',
		'replayed',
		'site_disconnected',
		'rate_limited',
		'unavailable',
		'invalid_request',
		'invalid_home_url',
		'invalid_response',
		'home_url_mismatch',
	);
	return is_string( $code ) && in_array( $code, $known, true ) ? $code : 'unavailable';
}

function grindctrl_sc_response_result( $response ) {
	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'unavailable' );
	}
	$status = (int) wp_remote_retrieve_response_code( $response );
	$data   = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( $status >= 200 && $status < 300 ) {
		return is_array( $data ) ? $data : array();
	}
	$code        = is_array( $data ) && isset( $data['error'] ) ? grindctrl_sc_known_error_code( $data['error'] ) : 'unavailable';
	$server_time = is_array( $data ) && isset( $data['serverTime'] ) && is_numeric( $data['serverTime'] ) ? (int) $data['serverTime'] : 0;
	return new WP_Error( $code, '', array( 'server_time' => $server_time ) );
}

function grindctrl_sc_set_last_error( $error ) {
	$code        = is_wp_error( $error ) ? $error->get_error_code() : $error;
	$error_data  = is_wp_error( $error ) ? $error->get_error_data() : array();
	$server_time = is_array( $error_data ) && isset( $error_data['server_time'] ) ? absint( $error_data['server_time'] ) : 0;
	grindctrl_sc_update_private_option(
		'grindctrl_sc_last_error',
		array(
			'code'        => grindctrl_sc_known_error_code( $code ),
			'server_time' => $server_time,
		)
	);
}

function grindctrl_sc_clear_last_error() {
	delete_option( 'grindctrl_sc_last_error' );
}

function grindctrl_sc_store_min_plugin_version( $data ) {
	if ( isset( $data['minPluginVersion'] ) && grindctrl_sc_valid_version( $data['minPluginVersion'] ) ) {
		grindctrl_sc_update_private_option( 'grindctrl_sc_min_plugin_version', $data['minPluginVersion'] );
	}
}

function grindctrl_sc_is_connected() {
	return 'active' === get_option( 'grindctrl_sc_connection_status', '' ) && null !== grindctrl_sc_connection_credentials();
}

function grindctrl_sc_pair( $code ) {
	$payload = grindctrl_sc_site_payload();
	if ( 'https' !== strtolower( (string) wp_parse_url( $payload['homeUrl'], PHP_URL_SCHEME ) ) ) {
		return new WP_Error( 'invalid_home_url' );
	}
	$payload['code'] = $code;
	$result          = grindctrl_sc_response_result( grindctrl_sc_post_json( '/api/woo/pair', $payload ) );
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	$secret_version = isset( $result['secretVersion'] ) && is_int( $result['secretVersion'] ) ? $result['secretVersion'] : 0;
	if (
		! isset( $result['siteId'], $result['embedKey'], $result['secret'], $result['minPluginVersion'] )
		|| ! grindctrl_sc_valid_uuid( $result['siteId'] )
		|| ! grindctrl_sc_valid_key( $result['embedKey'] )
		|| ! grindctrl_sc_valid_secret( $result['secret'] )
		|| $secret_version < 1
		|| ! grindctrl_sc_valid_version( $result['minPluginVersion'] )
	) {
		return new WP_Error( 'invalid_response' );
	}

	update_option( 'grindctrl_sc_embed_key', $result['embedKey'] );
	grindctrl_sc_update_private_option( 'grindctrl_sc_site_id', strtolower( $result['siteId'] ) );
	grindctrl_sc_update_private_option( 'grindctrl_sc_secret', $result['secret'] );
	grindctrl_sc_update_private_option( 'grindctrl_sc_secret_version', $secret_version );
	grindctrl_sc_update_private_option( 'grindctrl_sc_connection_status', 'active' );
	grindctrl_sc_store_min_plugin_version( $result );
	grindctrl_sc_clear_last_error();
	grindctrl_sc_schedule_heartbeat();
	return true;
}

function grindctrl_sc_send_heartbeat() {
	if ( ! grindctrl_sc_is_connected() ) {
		return;
	}
	grindctrl_sc_purge_nonces();
	grindctrl_sc_tryon_purge_visitors();
	$result = grindctrl_sc_response_result( grindctrl_sc_post_json( '/api/woo/heartbeat', grindctrl_sc_site_payload(), true ) );
	if ( is_wp_error( $result ) ) {
		if ( 'site_disconnected' === $result->get_error_code() ) {
			grindctrl_sc_update_private_option( 'grindctrl_sc_connection_status', 'disconnected' );
		}
		grindctrl_sc_set_last_error( $result );
		return;
	}
	if ( ! isset( $result['ok'] ) || true !== $result['ok'] ) {
		grindctrl_sc_set_last_error( 'invalid_response' );
		return;
	}
	grindctrl_sc_store_min_plugin_version( $result );
	if ( ! empty( $result['homeUrlMismatch'] ) ) {
		grindctrl_sc_set_last_error( 'home_url_mismatch' );
		return;
	}
	grindctrl_sc_clear_last_error();
}

function grindctrl_sc_disconnect_remote( $timeout = 3, $reason = 'manual' ) {
	if ( null === grindctrl_sc_connection_credentials() ) {
		return true;
	}
	$result = grindctrl_sc_response_result(
		grindctrl_sc_post_json(
			'/api/woo/disconnect',
			array(
				'homeUrl'       => home_url( '/' ),
				'pluginVersion' => GRINDCTRL_SC_VERSION,
				'reason'        => $reason,
			),
			true,
			$timeout
		)
	);
	if ( is_wp_error( $result ) ) {
		return 'site_disconnected' === $result->get_error_code() ? true : $result;
	}
	return isset( $result['ok'] ) && true === $result['ok'] ? true : new WP_Error( 'invalid_response' );
}

function grindctrl_sc_schedule_heartbeat() {
	if ( ! wp_next_scheduled( GRINDCTRL_SC_HEARTBEAT_HOOK ) ) {
		wp_schedule_event( time() + MINUTE_IN_SECONDS, 'daily', GRINDCTRL_SC_HEARTBEAT_HOOK );
	}
}

function grindctrl_sc_activate() {
	grindctrl_sc_schedule_heartbeat();
}

/* Removes the credentials and the lifecycle state. The embed key and the
   display scope are chat settings, not credentials, and stay. */
function grindctrl_sc_forget_connection() {
	foreach ( array(
		'grindctrl_sc_site_id',
		'grindctrl_sc_secret',
		'grindctrl_sc_secret_version',
		'grindctrl_sc_connection_status',
		'grindctrl_sc_min_plugin_version',
		'grindctrl_sc_last_error',
	) as $name ) {
		delete_option( $name );
	}
	wp_clear_scheduled_hook( GRINDCTRL_SC_HEARTBEAT_HOOK );
}

function grindctrl_sc_deactivate() {
	$result = grindctrl_sc_disconnect_remote( 3, 'deactivate' );
	if ( is_wp_error( $result ) ) {
		grindctrl_sc_set_last_error( $result );
	} else {
		grindctrl_sc_clear_last_error();
	}
	if ( null !== grindctrl_sc_connection_credentials() ) {
		grindctrl_sc_update_private_option( 'grindctrl_sc_connection_status', 'disconnected' );
	}
	wp_clear_scheduled_hook( GRINDCTRL_SC_HEARTBEAT_HOOK );
}

register_activation_hook( __FILE__, 'grindctrl_sc_activate' );
register_deactivation_hook( __FILE__, 'grindctrl_sc_deactivate' );
add_action( GRINDCTRL_SC_HEARTBEAT_HOOK, 'grindctrl_sc_send_heartbeat' );

/* ── Settings ─────────────────────────────────────────────────────────── */

function grindctrl_sc_sanitize_key( $value ) {
	$value = is_string( $value ) ? trim( sanitize_text_field( $value ) ) : '';
	if ( '' === $value || grindctrl_sc_valid_key( $value ) ) {
		return $value;
	}
	add_settings_error(
		'grindctrl_sc_embed_key',
		'grindctrl_sc_invalid_key',
		__( 'That embed key is not valid. Copy it again from your GRINDCTRL dashboard.', 'grindctrl-store-chat' )
	);
	return get_option( 'grindctrl_sc_embed_key', '' );
}

function grindctrl_sc_sanitize_scope( $value ) {
	return 'woocommerce' === $value ? 'woocommerce' : 'all';
}

add_action(
	'admin_init',
	function () {
		register_setting(
			'grindctrl_sc',
			'grindctrl_sc_embed_key',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'grindctrl_sc_sanitize_key',
				'default'           => '',
			)
		);
		register_setting(
			'grindctrl_sc',
			'grindctrl_sc_scope',
			array(
				'type'              => 'string',
				'sanitize_callback' => 'grindctrl_sc_sanitize_scope',
				'default'           => 'all',
			)
		);

		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'GRINDCTRL Store Chat',
				wp_kses_post(
					'<p>' . __( 'This site uses GRINDCTRL Store Chat, a chat assistant loaded from grindctrl.cloud. When a visitor opens the chat, the messages they write, the page they are on and an anonymous visitor id are sent to GRINDCTRL to answer them. When the plugin is connected, it also sends this site’s URL, software versions, timezone and store currency to maintain the connection.', 'grindctrl-store-chat' ) . ' '
					. sprintf(
						/* translators: %s: GRINDCTRL privacy policy URL. */
						__( 'See the GRINDCTRL privacy policy: %s', 'grindctrl-store-chat' ),
						'<a href="https://grindctrl.cloud/privacy">https://grindctrl.cloud/privacy</a>'
					) . '</p>'
				)
			);
		}
	}
);

add_action(
	'admin_menu',
	function () {
		add_options_page(
			__( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ),
			__( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ),
			'manage_options',
			'grindctrl-store-chat',
			'grindctrl_sc_render_settings'
		);
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		$url = admin_url( 'options-general.php?page=grindctrl-store-chat' );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'grindctrl-store-chat' ) . '</a>' );
		return $links;
	}
);

function grindctrl_sc_require_admin_action( $action ) {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to manage GRINDCTRL Store Chat.', 'grindctrl-store-chat' ), '', array( 'response' => 403 ) );
	}
	$nonce = isset( $_POST['grindctrl_sc_nonce'] ) && is_string( $_POST['grindctrl_sc_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['grindctrl_sc_nonce'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, $action ) ) {
		wp_die( esc_html__( 'Security check failed. Reload the settings page and try again.', 'grindctrl-store-chat' ), '', array( 'response' => 403 ) );
	}
}

function grindctrl_sc_settings_redirect( $notice ) {
	wp_safe_redirect(
		add_query_arg(
			array(
				'page'                => 'grindctrl-store-chat',
				'grindctrl_sc_notice' => $notice,
			),
			admin_url( 'options-general.php' )
		)
	);
	exit;
}

add_action(
	'admin_post_grindctrl_sc_connect',
	function () {
		grindctrl_sc_require_admin_action( 'grindctrl_sc_connect' );
		$raw_code = isset( $_POST['grindctrl_sc_connection_code'] ) && is_string( $_POST['grindctrl_sc_connection_code'] ) ? sanitize_text_field( wp_unslash( $_POST['grindctrl_sc_connection_code'] ) ) : '';
		$code     = strtoupper( (string) preg_replace( '/[\s-]+/', '', $raw_code ) );
		if ( 1 !== preg_match( '/^[A-HJ-NP-Z2-9]{8}$/', $code ) ) {
			grindctrl_sc_set_last_error( 'invalid_code' );
			grindctrl_sc_settings_redirect( 'connection_failed' );
		}
		$result = grindctrl_sc_pair( $code );
		if ( is_wp_error( $result ) ) {
			grindctrl_sc_set_last_error( $result );
			grindctrl_sc_settings_redirect( 'connection_failed' );
		}
		grindctrl_sc_settings_redirect( 'connected' );
	}
);

add_action(
	'admin_post_grindctrl_sc_disconnect',
	function () {
		grindctrl_sc_require_admin_action( 'grindctrl_sc_disconnect' );
		$result = grindctrl_sc_disconnect_remote();
		/*
		 * The secret leaves this site only once GRINDCTRL has confirmed the
		 * disconnect, or no longer accepts these credentials. On any other
		 * failure it is kept, so the button can be pressed again.
		 */
		if ( is_wp_error( $result ) && 'bad_signature' !== $result->get_error_code() ) {
			grindctrl_sc_set_last_error( $result );
			grindctrl_sc_settings_redirect( 'disconnect_failed' );
		}
		grindctrl_sc_forget_connection();
		grindctrl_sc_settings_redirect( 'disconnected' );
	}
);

function grindctrl_sc_error_message( $error ) {
	$code        = is_array( $error ) && isset( $error['code'] ) ? grindctrl_sc_known_error_code( $error['code'] ) : 'unavailable';
	$server_time = is_array( $error ) && isset( $error['server_time'] ) ? absint( $error['server_time'] ) : 0;
	switch ( $code ) {
		case 'invalid_code':
			return __( 'The connection code is invalid or has already been used. Generate a new code in the GRINDCTRL dashboard.', 'grindctrl-store-chat' );
		case 'expired_code':
			return __( 'The connection code expired. Generate a new code in the GRINDCTRL dashboard.', 'grindctrl-store-chat' );
		case 'bad_signature':
			return __( 'GRINDCTRL could not verify this site. Reconnect with a new connection code.', 'grindctrl-store-chat' );
		case 'stale_timestamp':
			if ( $server_time > 0 ) {
				return sprintf(
					/* translators: %s: GRINDCTRL server time in UTC. */
					__( 'This server’s clock is out of sync. GRINDCTRL server time is %s. Correct the clock and try again.', 'grindctrl-store-chat' ),
					gmdate( 'Y-m-d H:i:s \U\T\C', $server_time )
				);
			}
			return __( 'This server’s clock is out of sync. Correct the clock and try again.', 'grindctrl-store-chat' );
		case 'replayed':
			return __( 'GRINDCTRL rejected a repeated request. Try again.', 'grindctrl-store-chat' );
		case 'site_disconnected':
			return __( 'This site is disconnected. Generate a new connection code to reconnect it.', 'grindctrl-store-chat' );
		case 'rate_limited':
			return __( 'Too many connection attempts were made. Wait a few minutes and try again.', 'grindctrl-store-chat' );
		case 'invalid_request':
			return __( 'GRINDCTRL could not read this site’s details. Update the plugin to the current version, then try again.', 'grindctrl-store-chat' );
		case 'invalid_home_url':
			return __( 'This site must use an HTTPS home URL before it can connect to GRINDCTRL.', 'grindctrl-store-chat' );
		case 'invalid_response':
			return __( 'GRINDCTRL returned an invalid response. Try again later.', 'grindctrl-store-chat' );
		case 'home_url_mismatch':
			return __( 'This WordPress home URL differs from the URL that was paired. Reconnect the site or contact GRINDCTRL support before using this copy.', 'grindctrl-store-chat' );
		default:
			return __( 'GRINDCTRL is temporarily unavailable. Try again later.', 'grindctrl-store-chat' );
	}
}

function grindctrl_sc_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key         = get_option( 'grindctrl_sc_embed_key', '' );
	$scope       = grindctrl_sc_scope();
	$connected   = grindctrl_sc_is_connected();
	$status      = get_option( 'grindctrl_sc_connection_status', '' );
	$last_error  = get_option( 'grindctrl_sc_last_error', null );
	$min_version = get_option( 'grindctrl_sc_min_plugin_version', '' );
	$notice      = isset( $_GET['grindctrl_sc_notice'] ) && is_string( $_GET['grindctrl_sc_notice'] ) ? sanitize_key( wp_unslash( $_GET['grindctrl_sc_notice'] ) ) : '';
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ); ?></h1>
		<p>
			<?php echo esc_html__( 'Connect this site with a one-time code from Store Chat in the GRINDCTRL dashboard.', 'grindctrl-store-chat' ); ?>
			<a href="<?php echo esc_url( GRINDCTRL_SC_DASHBOARD ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__( 'Open the dashboard', 'grindctrl-store-chat' ); ?></a>
		</p>
		<?php if ( 'connected' === $notice ) : ?>
			<div class="notice notice-success inline"><p><?php echo esc_html__( 'This site is connected to GRINDCTRL.', 'grindctrl-store-chat' ); ?></p></div>
		<?php elseif ( 'disconnected' === $notice ) : ?>
			<div class="notice notice-info inline"><p><?php echo esc_html__( 'This site is disconnected from GRINDCTRL.', 'grindctrl-store-chat' ); ?></p></div>
		<?php endif; ?>
		<?php if ( is_array( $last_error ) ) : ?>
			<div class="notice notice-error inline"><p><strong><?php echo esc_html__( 'Last connection error:', 'grindctrl-store-chat' ); ?></strong> <?php echo esc_html( grindctrl_sc_error_message( $last_error ) ); ?></p></div>
		<?php endif; ?>
		<?php if ( grindctrl_sc_valid_version( $min_version ) && version_compare( GRINDCTRL_SC_VERSION, $min_version, '<' ) ) : ?>
			<div class="notice notice-warning inline"><p><?php echo esc_html__( 'A newer GRINDCTRL Store Chat plugin is required. Download the current version from the dashboard.', 'grindctrl-store-chat' ); ?></p></div>
		<?php endif; ?>

		<h2><?php echo esc_html__( 'Connection', 'grindctrl-store-chat' ); ?></h2>
		<?php if ( $connected ) : ?>
			<p><strong><?php echo esc_html__( 'Status: Connected', 'grindctrl-store-chat' ); ?></strong></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="grindctrl_sc_disconnect" />
				<?php wp_nonce_field( 'grindctrl_sc_disconnect', 'grindctrl_sc_nonce' ); ?>
				<?php submit_button( __( 'Disconnect', 'grindctrl-store-chat' ), 'secondary', 'submit', false ); ?>
			</form>
		<?php else : ?>
			<p><strong><?php echo esc_html( 'disconnected' === $status ? __( 'Status: Disconnected', 'grindctrl-store-chat' ) : __( 'Status: Not connected', 'grindctrl-store-chat' ) ); ?></strong></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="grindctrl_sc_connect" />
				<?php wp_nonce_field( 'grindctrl_sc_connect', 'grindctrl_sc_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="grindctrl_sc_connection_code"><?php echo esc_html__( 'Connection code', 'grindctrl-store-chat' ); ?></label></th>
						<td>
							<input name="grindctrl_sc_connection_code" id="grindctrl_sc_connection_code" type="text" class="regular-text code" dir="ltr" inputmode="text" autocomplete="one-time-code" spellcheck="false" minlength="8" maxlength="11" required />
							<p class="description"><?php echo esc_html__( 'Paste the 8-character code from the GRINDCTRL dashboard. It expires after 15 minutes and works once.', 'grindctrl-store-chat' ); ?></p>
						</td>
					</tr>
				</table>
				<?php submit_button( __( 'Connect', 'grindctrl-store-chat' ) ); ?>
			</form>
		<?php endif; ?>

		<h2><?php echo esc_html__( 'Chat display', 'grindctrl-store-chat' ); ?></h2>
		<?php settings_errors( 'grindctrl_sc_embed_key' ); ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'grindctrl_sc' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php echo esc_html__( 'Show the chat on', 'grindctrl-store-chat' ); ?></th>
					<td>
						<fieldset>
							<label><input type="radio" name="grindctrl_sc_scope" value="all" <?php checked( $scope, 'all' ); ?> /> <?php echo esc_html__( 'Every page', 'grindctrl-store-chat' ); ?></label><br />
							<label><input type="radio" name="grindctrl_sc_scope" value="woocommerce" <?php checked( $scope, 'woocommerce' ); ?> /> <?php echo esc_html__( 'Shop, product, cart and checkout pages only', 'grindctrl-store-chat' ); ?></label>
						</fieldset>
					</td>
				</tr>
			</table>
			<details>
				<summary><strong><?php echo esc_html__( 'Advanced: manual embed key', 'grindctrl-store-chat' ); ?></strong></summary>
				<p><?php echo esc_html__( 'Use this fallback only when GRINDCTRL support asks you to connect without a connection code.', 'grindctrl-store-chat' ); ?></p>
				<label for="grindctrl_sc_embed_key"><?php echo esc_html__( 'Embed key', 'grindctrl-store-chat' ); ?></label><br />
				<input name="grindctrl_sc_embed_key" id="grindctrl_sc_embed_key" type="text" class="regular-text code" dir="ltr" autocomplete="off" spellcheck="false" value="<?php echo esc_attr( $key ); ?>" />
			</details>
			<?php submit_button( __( 'Save chat display', 'grindctrl-store-chat' ) ); ?>
		</form>
	</div>
	<?php
}

/* ── Storefront ───────────────────────────────────────────────────────── */

function grindctrl_sc_on_shop_page() {
	return ( function_exists( 'is_woocommerce' ) && is_woocommerce() )
		|| ( function_exists( 'is_cart' ) && is_cart() )
		|| ( function_exists( 'is_checkout' ) && is_checkout() );
}

/* The product the shopper is viewing, for the chat's "You're viewing" line.
   Display data only: Store Chat never prices or sells from it. */
function grindctrl_sc_image_url( $image_id ) {
	if ( ! $image_id ) {
		return null;
	}
	$src = wp_get_attachment_image_url( $image_id, 'full' );
	return ( is_string( $src ) && 0 === strpos( $src, 'https://' ) ) ? $src : null;
}

function grindctrl_sc_product_context( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return null;
	}
	$context = array(
		'id'         => $product->get_id(),
		'type'       => $product->get_type(),
		'name'       => wp_strip_all_tags( $product->get_name() ),
		'url'        => get_permalink( $product->get_id() ),
		'image'      => grindctrl_sc_image_url( $product->get_image_id() ),
		'price'      => (string) wc_get_price_to_display( $product ),
		'currency'   => get_woocommerce_currency(),
		'variations' => array(),
	);
	if ( $product->is_type( 'variable' ) ) {
		$ids = array_slice( $product->get_children(), 0, 50 );
		foreach ( $ids as $variation_id ) {
			$variation = wc_get_product( $variation_id );
			if ( ! $variation || ! $variation->is_purchasable() ) {
				continue;
			}
			$attributes = array();
			foreach ( $variation->get_variation_attributes() as $name => $value ) {
				$attributes[ sanitize_key( $name ) ] = wp_strip_all_tags( (string) $value );
			}
			$context['variations'][] = array(
				'id'         => $variation->get_id(),
				'attributes' => $attributes,
				'image'      => grindctrl_sc_image_url( $variation->get_image_id() ),
				'price'      => (string) wc_get_price_to_display( $variation ),
				'in_stock'   => $variation->is_in_stock(),
			);
		}
	}
	return $context;
}

add_action(
	'wp_enqueue_scripts',
	function () {
		$key = grindctrl_sc_key();
		if ( '' === $key || is_admin() ) {
			return;
		}
		if ( 'woocommerce' === grindctrl_sc_scope() && ! grindctrl_sc_on_shop_page() ) {
			return;
		}

		wp_enqueue_script(
			'grindctrl-store-chat',
			GRINDCTRL_SC_SCRIPT,
			array(),
			null, // The script is versioned by its URL and served with its own cache headers.
			array(
				'in_footer' => true,
				'strategy'  => 'async',
			)
		);

		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$context = array(
			'platform'    => 'woocommerce',
			'storeApi'    => esc_url_raw( rest_url( 'wc/store/v1/' ) ),
			'cartUrl'     => wc_get_cart_url(),
			'checkoutUrl' => wc_get_checkout_url(),
		);
		if ( function_exists( 'is_product' ) && is_product() ) {
			$product = grindctrl_sc_product_context( wc_get_product( get_queried_object_id() ) );
			if ( $product ) {
				$context['product'] = $product;
			}
		}
		wp_add_inline_script(
			'grindctrl-store-chat',
			'window.grindctrlWoo = ' . wp_json_encode( $context, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';',
			'before'
		);
	}
);

/* The loader reads its key from its own tag (document.currentScript). */
add_filter(
	'script_loader_tag',
	function ( $tag, $handle ) {
		if ( 'grindctrl-store-chat' !== $handle || false !== strpos( $tag, 'data-key=' ) ) {
			return $tag;
		}
		return str_replace( ' src=', ' data-key="' . esc_attr( grindctrl_sc_key() ) . '" src=', $tag );
	},
	10,
	2
);

add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
		}
	}
);
