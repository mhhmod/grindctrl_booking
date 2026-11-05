<?php
/**
 * Order lookup for GRINDCTRL Store Chat.
 *
 * POST /wp-json/grindctrl/v1/order-lookup, called only by GRINDCTRL's server.
 * The request must carry a valid signature made with this site's pairing
 * secret (the same canonical string the plugin uses to sign its own calls),
 * and each nonce is accepted once. Only then are orders read, and only the
 * orders that belong to the named customer, or whose billing email matches
 * the one supplied. Nothing here is logged.
 *
 * Request  (JSON): { "mode": "customer", "wpUserId": 12, "limit": 1, "orderNumber": "1027"? }
 *                  { "mode": "guest", "email": "a@b.co", "orderNumber": "1027" }
 * Response (JSON): { "ok": true, "orders": [ { id, number, status, createdAt, paid, total,
 *                    currency, paymentMethod, items[{name,quantity}], shippingMethod,
 *                    tracking{carrier,number,url,shippedAt}|null, destination{city,country}|null } ] }
 * A wrong email answers exactly like a missing order: an empty list.
 *
 * Canonical string (identical to lib/woo/signed-request.ts on the server):
 *   POST \n PATH \n UNIX_SECONDS \n NONCE \n sha256_hex(BODY)
 */

defined( 'ABSPATH' ) || exit;

define( 'GRINDCTRL_SC_ORDER_ROUTE', '/wp-json/grindctrl/v1/order-lookup' );

function grindctrl_sc_forbidden() {
	return new WP_Error( 'grindctrl_forbidden', 'Forbidden', array( 'status' => 401 ) );
}

/* The path GRINDCTRL signs: this site's home path plus the fixed route, so a
   site in a subdirectory and a proxy that rewrites the URL both verify. */
function grindctrl_sc_order_route_path() {
	return (string) wp_parse_url( home_url( GRINDCTRL_SC_ORDER_ROUTE ), PHP_URL_PATH );
}

/*
 * True once per nonce, for ten minutes (twice the accepted clock skew).
 * The claim must be one atomic step: a get-then-set lets two simultaneous
 * copies of a signed request both pass. wp_cache_add is atomic in a
 * persistent object cache; otherwise INSERT IGNORE on the unique option_name
 * lets exactly one request insert the row. Rows are purged by the daily
 * heartbeat.
 */
function grindctrl_sc_claim_nonce( $nonce ) {
	$name = 'gc_sc_n_' . substr( hash( 'sha256', $nonce ), 0, 40 );
	if ( wp_using_ext_object_cache() ) {
		return wp_cache_add( $name, 1, 'grindctrl_sc', 10 * MINUTE_IN_SECONDS );
	}
	global $wpdb;
	$inserted = $wpdb->query(
		$wpdb->prepare(
			"INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, 'no')",
			$name,
			(string) time()
		)
	);
	return 1 === $inserted;
}

/* Drops spent nonces that can no longer be replayed (older than ten minutes). */
function grindctrl_sc_purge_nonces() {
	global $wpdb;
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND CAST(option_value AS UNSIGNED) < %d",
			$wpdb->esc_like( 'gc_sc_n_' ) . '%',
			time() - 10 * MINUTE_IN_SECONDS
		)
	);
}

/* permission_callback for GRINDCTRL's server. Returns true only for a fresh,
   correctly signed request from this site's pairing; the nonce is spent after
   the signature checks out so unsigned callers cannot burn it. */
function grindctrl_sc_verify_inbound( $request ) {
	$credentials = grindctrl_sc_connection_credentials();
	if ( ! $credentials || ! grindctrl_sc_is_connected() ) {
		return grindctrl_sc_forbidden();
	}
	$site      = strtolower( trim( (string) $request->get_header( 'X-GC-Site' ) ) );
	$timestamp = trim( (string) $request->get_header( 'X-GC-Timestamp' ) );
	$nonce     = trim( (string) $request->get_header( 'X-GC-Nonce' ) );
	$signature = trim( (string) $request->get_header( 'X-GC-Signature' ) );

	if (
		! hash_equals( $credentials['site_id'], $site )
		|| 1 !== preg_match( '/^\d{1,12}$/', $timestamp )
		|| 1 !== preg_match( '/^[A-Za-z0-9_-]{22,172}$/', $nonce )
		|| 1 !== preg_match( '/^[A-Za-z0-9_-]{43}$/', $signature )
		|| abs( time() - (int) $timestamp ) > 300
	) {
		return grindctrl_sc_forbidden();
	}

	$canonical = 'POST' . "\n" . grindctrl_sc_order_route_path() . "\n" . $timestamp . "\n" . $nonce . "\n" . hash( 'sha256', (string) $request->get_body() );
	$expected  = grindctrl_sc_base64url( hash_hmac( 'sha256', $canonical, $credentials['secret'], true ) );
	if ( ! hash_equals( $expected, $signature ) ) {
		return grindctrl_sc_forbidden();
	}
	if ( ! grindctrl_sc_claim_nonce( $nonce ) ) {
		return grindctrl_sc_forbidden();
	}
	return true;
}

/* WooCommerce Shipment Tracking's meta, when that plugin is in use. */
function grindctrl_sc_order_tracking( $order ) {
	$items = $order->get_meta( '_wc_shipment_tracking_items' );
	if ( ! is_array( $items ) || empty( $items ) ) {
		return null;
	}
	$item = reset( $items );
	if ( ! is_array( $item ) ) {
		return null;
	}
	$carrier = '';
	if ( ! empty( $item['custom_tracking_provider'] ) ) {
		$carrier = $item['custom_tracking_provider'];
	} elseif ( ! empty( $item['tracking_provider'] ) ) {
		$carrier = $item['tracking_provider'];
	}
	$number = isset( $item['tracking_number'] ) ? $item['tracking_number'] : '';
	$link   = isset( $item['custom_tracking_link'] ) ? esc_url_raw( (string) $item['custom_tracking_link'], array( 'https' ) ) : '';
	$when   = isset( $item['date_shipped'] ) && is_numeric( $item['date_shipped'] ) ? (int) $item['date_shipped'] : 0;
	if ( '' === $number && '' === $link ) {
		return null;
	}
	return array(
		'carrier'   => '' !== $carrier ? wp_strip_all_tags( (string) $carrier ) : null,
		'number'    => '' !== $number ? wp_strip_all_tags( (string) $number ) : null,
		'url'       => '' !== $link ? $link : null,
		'shippedAt' => $when > 0 ? gmdate( 'Y-m-d\TH:i:s\Z', $when ) : null,
	);
}

/* The minimum the chat needs. Customer notes, phone, email and street
   addresses are never included. */
function grindctrl_sc_order_payload( $order ) {
	$items = array();
	foreach ( $order->get_items() as $item ) {
		if ( count( $items ) >= 10 ) {
			break;
		}
		$items[] = array(
			'name'     => wp_strip_all_tags( $item->get_name() ),
			'quantity' => (int) $item->get_quantity(),
		);
	}
	$created = $order->get_date_created();
	$city    = $order->get_shipping_city() ? $order->get_shipping_city() : $order->get_billing_city();
	$country = $order->get_shipping_country() ? $order->get_shipping_country() : $order->get_billing_country();
	$method  = $order->get_shipping_method();

	return array(
		'id'             => (int) $order->get_id(),
		'number'         => (string) $order->get_order_number(),
		'status'         => (string) $order->get_status(),
		'createdAt'      => $created ? gmdate( 'Y-m-d\TH:i:s\Z', $created->getTimestamp() ) : gmdate( 'Y-m-d\TH:i:s\Z', 0 ),
		'paid'           => null !== $order->get_date_paid(),
		'total'          => number_format( (float) $order->get_total(), min( 6, max( 0, (int) wc_get_price_decimals() ) ), '.', '' ),
		'currency'       => (string) $order->get_currency(),
		'paymentMethod'  => (string) $order->get_payment_method(),
		'items'          => $items,
		'shippingMethod' => '' !== $method ? wp_strip_all_tags( $method ) : null,
		'tracking'       => grindctrl_sc_order_tracking( $order ),
		'destination'    => ( $city || $country ) ? array(
			'city'    => $city ? wp_strip_all_tags( $city ) : null,
			'country' => $country ? strtoupper( substr( $country, 0, 2 ) ) : null,
		) : null,
	);
}

function grindctrl_sc_orders_reply( $orders ) {
	$response = new WP_REST_Response(
		array(
			'ok'     => true,
			'orders' => $orders,
		),
		200
	);
	$response->header( 'Cache-Control', 'no-store' );
	return $response;
}

function grindctrl_sc_lookup_customer_orders( $data ) {
	$user_id = isset( $data['wpUserId'] ) && is_int( $data['wpUserId'] ) ? $data['wpUserId'] : 0;
	if ( $user_id < 1 ) {
		return array();
	}
	$limit  = isset( $data['limit'] ) && is_int( $data['limit'] ) ? min( 5, max( 1, $data['limit'] ) ) : 1;
	$number = isset( $data['orderNumber'] ) && is_string( $data['orderNumber'] ) && 1 === preg_match( '/^\d{1,12}$/', $data['orderNumber'] ) ? $data['orderNumber'] : '';

	$found = wc_get_orders(
		array(
			'customer_id' => $user_id,
			'type'        => 'shop_order',
			'limit'       => '' === $number ? $limit : 50,
			'orderby'     => 'date',
			'order'       => 'DESC',
		)
	);
	$orders = array();
	foreach ( $found as $order ) {
		// The customer id is checked again on each order, not trusted from the query.
		if ( ! $order instanceof WC_Order || (int) $order->get_customer_id() !== $user_id ) {
			continue;
		}
		if ( '' !== $number && ! grindctrl_sc_order_shows_number( $order, $number ) ) {
			continue;
		}
		$orders[] = grindctrl_sc_order_payload( $order );
		if ( count( $orders ) >= $limit ) {
			break;
		}
	}
	return $orders;
}

function grindctrl_sc_lookup_guest_orders( $data ) {
	$email  = isset( $data['email'] ) && is_string( $data['email'] ) ? strtolower( trim( sanitize_email( $data['email'] ) ) ) : '';
	$number = isset( $data['orderNumber'] ) && is_string( $data['orderNumber'] ) && 1 === preg_match( '/^\d{1,12}$/', $data['orderNumber'] ) ? $data['orderNumber'] : '';
	if ( '' === $number || ! is_email( $email ) ) {
		return array();
	}
	// Every order the number can name, each judged only by its billing email.
	// A wrong email and a missing order both end in the same empty list.
	foreach ( grindctrl_sc_orders_by_number( $number ) as $order ) {
		$billing = strtolower( trim( (string) $order->get_billing_email() ) );
		if ( '' !== $billing && hash_equals( $billing, $email ) ) {
			return array( grindctrl_sc_order_payload( $order ) );
		}
	}
	return array();
}

/*
 * The orders a shopper's order number can mean. Sequential-number plugins keep
 * the number they show in meta (_order_number, _order_number_formatted) and it
 * differs from the order id; those are tried first. The order id is the plain
 * WooCommerce case, accepted only when it is also the number shown to the
 * shopper, so an id can not be used to probe orders that show another number.
 */
function grindctrl_sc_order_shows_number( $order, $number ) {
	$shown = (string) $order->get_order_number();
	return $shown === $number || preg_replace( '/\D/', '', $shown ) === $number;
}

function grindctrl_sc_orders_by_number( $number ) {
	$candidates = array();
	foreach ( array( '_order_number', '_order_number_formatted' ) as $meta_key ) {
		$found = wc_get_orders(
			array(
				'type'       => 'shop_order',
				'limit'      => 5,
				'meta_query' => array( // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query -- bounded by limit, one lookup per request.
					array(
						'key'   => $meta_key,
						'value' => $number,
					),
				),
			)
		);
		foreach ( $found as $order ) {
			if ( $order instanceof WC_Order ) {
				$candidates[ $order->get_id() ] = $order;
			}
		}
	}
	$by_id = wc_get_order( absint( $number ) );
	if ( $by_id instanceof WC_Order && 'shop_order' === $by_id->get_type() && grindctrl_sc_order_shows_number( $by_id, $number ) ) {
		$candidates[ $by_id->get_id() ] = $by_id;
	}
	return array_values( $candidates );
}

function grindctrl_sc_rest_order_lookup( $request ) {
	$body = (string) $request->get_body();
	if ( strlen( $body ) > 4096 ) {
		return new WP_Error( 'grindctrl_bad_request', 'Bad request', array( 'status' => 400 ) );
	}
	$data = json_decode( $body, true );
	if ( ! is_array( $data ) || ! isset( $data['mode'] ) ) {
		return new WP_Error( 'grindctrl_bad_request', 'Bad request', array( 'status' => 400 ) );
	}
	if ( ! function_exists( 'wc_get_orders' ) || ! class_exists( 'WC_Order' ) ) {
		return new WP_Error( 'grindctrl_unavailable', 'Unavailable', array( 'status' => 503 ) );
	}
	if ( 'customer' === $data['mode'] ) {
		return grindctrl_sc_orders_reply( grindctrl_sc_lookup_customer_orders( $data ) );
	}
	if ( 'guest' === $data['mode'] ) {
		return grindctrl_sc_orders_reply( grindctrl_sc_lookup_guest_orders( $data ) );
	}
	return new WP_Error( 'grindctrl_bad_request', 'Bad request', array( 'status' => 400 ) );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'grindctrl/v1',
			'/order-lookup',
			array(
				'methods'             => 'POST',
				'callback'            => 'grindctrl_sc_rest_order_lookup',
				// The signature is the authorization; there is no WordPress user here.
				'permission_callback' => 'grindctrl_sc_verify_inbound',
			)
		);
	}
);
