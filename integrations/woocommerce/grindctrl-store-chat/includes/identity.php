<?php
/**
 * Verified shopper identity for GRINDCTRL Store Chat.
 *
 * GET /wp-json/grindctrl/v1/identity?sid=<chat session id>
 *
 * For a logged-in WordPress user (WordPress's REST cookie auth with the
 * wp_rest nonce, printed in window.grindctrlWoo), returns a short-lived token
 * that proves who is signed in on this site. The loader passes it to the
 * chat, and GRINDCTRL's server checks it against this site's pairing secret.
 * The secret never leaves this site; only a signature made with it does.
 *
 *   token   = "gcw1." + payload + "." + signature
 *   payload = base64url( {"v":1,"site":<site uuid>,"wpUserId":<int>,"sid":<session id>,
 *                         "exp":<unix seconds>,"email_hash":<sha256 hex of lowercase email>} )
 *   signature = base64url( HMAC-SHA256( secret, "gc-woo-identity-v1\n" . payload ) )
 *
 * Known-answer vector, also asserted by the server's tests (lib/woo/identity-token.test.ts):
 *   secret    = 43 x "A"
 *   payload   = eyJ2IjoxLCJzaXRlIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIiwid3BVc2VySWQiOjQyLCJzaWQiOiJzaWQtYWJjZGVmZ2giLCJleHAiOjE4MDAwMDA2MDAsImVtYWlsX2hhc2giOiJhODVlOWNhMThmMzQ5MzVhYjliMDM4MWIyNWJmYWQyNDU1NDQ0MTEyYjAxNDkyNzBmZDg4ZTNkYTE3MmZlMTk2In0
 *   signature = ALjdAH_7Yt9HFa83MoWkjpGyOPwJUrwkKSgaaeHLqd4
 */

defined( 'ABSPATH' ) || exit;

define( 'GRINDCTRL_SC_IDENTITY_TTL', 600 );

function grindctrl_sc_rest_identity( $request ) {
	$credentials = grindctrl_sc_connection_credentials();
	$sid         = $request->get_param( 'sid' );
	if ( ! $credentials || ! grindctrl_sc_is_connected() ) {
		return new WP_Error( 'grindctrl_unavailable', 'Unavailable', array( 'status' => 503 ) );
	}
	if ( ! is_string( $sid ) || 1 !== preg_match( '/^[A-Za-z0-9_-]{8,64}$/', $sid ) ) {
		return new WP_Error( 'grindctrl_bad_request', 'Bad request', array( 'status' => 400 ) );
	}
	$user = wp_get_current_user();
	if ( ! $user || ! $user->exists() ) {
		return new WP_Error( 'grindctrl_forbidden', 'Forbidden', array( 'status' => 401 ) );
	}

	$payload = wp_json_encode(
		array(
			'v'          => 1,
			'site'       => $credentials['site_id'],
			'wpUserId'   => (int) $user->ID,
			'sid'        => $sid,
			'exp'        => time() + GRINDCTRL_SC_IDENTITY_TTL,
			'email_hash' => hash( 'sha256', strtolower( trim( (string) $user->user_email ) ) ),
		),
		JSON_UNESCAPED_SLASHES
	);
	if ( false === $payload ) {
		return new WP_Error( 'grindctrl_unavailable', 'Unavailable', array( 'status' => 503 ) );
	}
	$encoded   = grindctrl_sc_base64url( $payload );
	$signature = grindctrl_sc_base64url( hash_hmac( 'sha256', "gc-woo-identity-v1\n" . $encoded, $credentials['secret'], true ) );

	$response = new WP_REST_Response( array( 'token' => 'gcw1.' . $encoded . '.' . $signature ), 200 );
	$response->header( 'Cache-Control', 'no-store' );
	return $response;
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'grindctrl/v1',
			'/identity',
			array(
				'methods'             => 'GET',
				'callback'            => 'grindctrl_sc_rest_identity',
				'permission_callback' => 'is_user_logged_in',
			)
		);
	}
);

/*
 * The wp_rest nonce lets the loader's same-origin request be treated as the
 * logged-in user. It is not a secret and is only printed for logged-in
 * visitors on a connected site, after the loader's own inline data.
 */
add_action(
	'wp_enqueue_scripts',
	function () {
		if (
			! is_user_logged_in()
			|| ! class_exists( 'WooCommerce' )
			|| ! grindctrl_sc_is_connected()
			|| ! wp_script_is( 'grindctrl-store-chat', 'enqueued' )
		) {
			return;
		}
		$data = array(
			'restNonce'   => wp_create_nonce( 'wp_rest' ),
			'identityUrl' => esc_url_raw( rest_url( 'grindctrl/v1/identity' ) ),
		);
		wp_add_inline_script(
			'grindctrl-store-chat',
			'window.grindctrlWoo = Object.assign( window.grindctrlWoo || {}, ' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ' );',
			'before'
		);
	},
	20
);
