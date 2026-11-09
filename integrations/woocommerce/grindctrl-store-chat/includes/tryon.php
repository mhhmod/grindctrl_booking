<?php
/**
 * GRINDCTRL Try-On for WooCommerce.
 *
 * Renders the "Try it on" button (product page hook, [grindctrl_tryon]
 * shortcode, grindctrl/tryon block, optional catalog cards) and mints each
 * Try-On session through a REST route of this site. The route reads the
 * product from WooCommerce, signs the call with the site's secret and asks
 * GRINDCTRL for a short-lived embed URL, so the secret never reaches a
 * browser. Loaded from grindctrl-store-chat.php.
 */

defined( 'ABSPATH' ) || exit;

const GRINDCTRL_SC_TRYON_CONFIG_TTL   = 300;
const GRINDCTRL_SC_TRYON_FAILURE_TTL  = 60;
const GRINDCTRL_SC_TRYON_VISITOR_MAX  = 12;
const GRINDCTRL_SC_TRYON_VISITOR_SPAN = 60;

/** The dashboard preview first opens the home page, which may have no Try-On or chat loader. */
function grindctrl_sc_tryon_remember_preview() {
	if ( is_admin() || ! grindctrl_sc_is_connected() ) {
		return;
	}
	// Generic script only: never print a request token into cacheable page HTML.
	$script = <<<'JS'
try {
  var gcPreview = new URLSearchParams(window.location.search).get('gc_preview');
  if (gcPreview && /^[A-Za-z0-9_.-]{20,512}$/.test(gcPreview)) {
    window.localStorage.setItem('gc_preview', JSON.stringify({ token: gcPreview, savedAt: Date.now() }));
  }
} catch (_) {}
JS;
	wp_print_inline_script_tag( $script, array( 'id' => 'grindctrl-preview' ) );
}
add_action( 'wp_head', 'grindctrl_sc_tryon_remember_preview' );

/* ── Configuration ────────────────────────────────────────────────────── */

/**
 * The Try-On script follows the chat script's server (a wp-config override of
 * GRINDCTRL_SC_SCRIPT for a staging server moves both), unless
 * GRINDCTRL_SC_TRYON_SCRIPT is set in wp-config.php itself.
 */
function grindctrl_sc_tryon_script_url() {
	if ( defined( 'GRINDCTRL_SC_TRYON_SCRIPT' ) && is_string( GRINDCTRL_SC_TRYON_SCRIPT ) ) {
		return GRINDCTRL_SC_TRYON_SCRIPT;
	}
	$derived = is_string( GRINDCTRL_SC_SCRIPT ) ? preg_replace( '#/messenger\.js(?:\?.*)?$#', '/tryon-woo.js', GRINDCTRL_SC_SCRIPT ) : null;
	return is_string( $derived ) && $derived !== GRINDCTRL_SC_SCRIPT ? $derived : 'https://grindctrl.cloud/widget/v1/tryon-woo.js';
}

function grindctrl_sc_tryon_locale() {
	return 0 === strpos( strtolower( determine_locale() ), 'ar' ) ? 'ar' : 'en';
}

function grindctrl_sc_tryon_color( $value, $fallback ) {
	return is_string( $value ) && 1 === preg_match( '/^#[0-9a-f]{3,8}$/i', $value ) ? $value : $fallback;
}

/**
 * Button label, colors and on/off from GRINDCTRL (public, cached). A failed
 * read hides the button for a minute instead of showing one that may not work.
 */
function grindctrl_sc_tryon_config() {
	static $memo = array();
	$key = grindctrl_sc_key();
	if ( '' === $key || ! grindctrl_sc_is_connected() ) {
		return array( 'enabled' => false );
	}
	$locale = grindctrl_sc_tryon_locale();
	if ( isset( $memo[ $locale ] ) ) {
		return $memo[ $locale ];
	}
	$transient = 'grindctrl_sc_tryon_cfg_' . $locale;
	$cached    = get_transient( $transient );
	if ( is_array( $cached ) ) {
		$memo[ $locale ] = $cached;
		return $cached;
	}

	$config = array( 'enabled' => false );
	$url    = grindctrl_sc_api_url( '/api/woo/tryon-config?' . http_build_query( array(
		'key'    => $key,
		'locale' => $locale,
	) ) );
	if ( ! is_wp_error( $url ) ) {
		$response = wp_remote_get( $url, array( 'timeout' => 3, 'redirection' => 0 ) );
		if ( ! is_wp_error( $response ) && 200 === (int) wp_remote_retrieve_response_code( $response ) ) {
			$data = json_decode( wp_remote_retrieve_body( $response ), true );
			$preview_only = is_array( $data ) && isset( $data['reason'] ) && 'out_of_looks' === $data['reason'];
			if ( is_array( $data ) && isset( $data['enabled'] ) && ( true === $data['enabled'] || $preview_only ) ) {
				$label  = isset( $data['buttonLabel'] ) && is_string( $data['buttonLabel'] ) ? trim( wp_strip_all_tags( $data['buttonLabel'] ) ) : '';
				$radius = isset( $data['radiusPx'] ) && is_numeric( $data['radiusPx'] ) ? max( 0, min( 999, (int) $data['radiusPx'] ) ) : 10;
				$catalog = isset( $data['catalogLabel'] ) && is_string( $data['catalogLabel'] ) ? trim( wp_strip_all_tags( $data['catalogLabel'] ) ) : '';
				$config = array(
					'enabled'      => true === $data['enabled'],
					'previewOnly'  => $preview_only,
					'label'        => '' !== $label ? mb_substr( $label, 0, 60 ) : ( 'ar' === $locale ? 'جرّبها' : 'Try it on' ),
					'catalogLabel' => '' !== $catalog ? mb_substr( $catalog, 0, 60 ) : '',
					// The dashboard's card pill switch. A server that predates it sends nothing: keep the cards.
					'cardPill'     => ! isset( $data['showCardPill'] ) || false !== $data['showCardPill'],
					'bg'           => grindctrl_sc_tryon_color( isset( $data['accentBg'] ) ? $data['accentBg'] : '', '#1f1d1a' ),
					'fg'           => grindctrl_sc_tryon_color( isset( $data['accentFg'] ) ? $data['accentFg'] : '', '#f6f1e7' ),
					'radius'       => $radius,
					// The product page button's animated icon: its gradient and size (the dashboard's 18-40px).
					'icFrom'       => grindctrl_sc_tryon_color( isset( $data['iconBgFrom'] ) ? $data['iconBgFrom'] : '', '#ff9a3d' ),
					'icTo'         => grindctrl_sc_tryon_color( isset( $data['iconBgTo'] ) ? $data['iconBgTo'] : '', '#ffd76e' ),
					'icSize'       => isset( $data['buttonIconPx'] ) && is_numeric( $data['buttonIconPx'] ) ? max( 18, min( 40, (int) round( (float) $data['buttonIconPx'] ) ) ) : 28,
				);
			}
		}
	}
	set_transient( $transient, $config, $config['enabled'] ? GRINDCTRL_SC_TRYON_CONFIG_TTL : GRINDCTRL_SC_TRYON_FAILURE_TTL );
	$memo[ $locale ] = $config;
	return $config;
}

function grindctrl_sc_tryon_enabled() {
	$config = grindctrl_sc_tryon_config();
	return ! empty( $config['enabled'] );
}

/**
 * Catalog cards need both switches: this site's own "Product listings" option
 * and the card pill switch in the GRINDCTRL dashboard (off when Try-On itself
 * is switched off there too).
 */
function grindctrl_sc_tryon_cards_on() {
	if ( 'yes' !== get_option( 'grindctrl_sc_tryon_catalog', 'no' ) ) {
		return false;
	}
	$config = grindctrl_sc_tryon_config();
	// A config cached by the previous plugin version has no cardPill: keep the cards.
	return ! isset( $config['cardPill'] ) || true === $config['cardPill'];
}

/* ── Storefront script ────────────────────────────────────────────────── */

/**
 * Enqueued only when a button is rendered. The page settings hold no secret:
 * the Store API nonce is the standard WooCommerce cart nonce, and the script
 * refreshes it from the cart response if a page cache froze it.
 */
function grindctrl_sc_tryon_enqueue() {
	static $done = false;
	if ( $done ) {
		return;
	}
	$done = true;

	wp_enqueue_script(
		'grindctrl-tryon',
		grindctrl_sc_tryon_script_url(),
		array(),
		null, // Versioned by its URL and served with its own cache headers.
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);

	$nonce = wp_create_nonce( 'wc_store_api' );
	$page  = array(
		'restUrl'       => esc_url_raw( rest_url( 'grindctrl/v1/' ) ),
		'storeApi'      => esc_url_raw( rest_url( 'wc/store/v1/' ) ),
		'storeApiNonce' => $nonce,
		'cartUrl'       => function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : '',
		'checkoutUrl'   => function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : '',
		'locale'        => grindctrl_sc_tryon_locale(),
		'rtl'           => is_rtl(),
	);
	wp_add_inline_script(
		'grindctrl-tryon',
		'window.grindctrlTryOn = ' . wp_json_encode( $page, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ) . ';',
		'before'
	);

	// The chat script reads the same nonce from window.grindctrlWoo when it is on the page.
	if ( wp_script_is( 'grindctrl-store-chat', 'enqueued' ) ) {
		wp_add_inline_script(
			'grindctrl-store-chat',
			'if(window.grindctrlWoo){window.grindctrlWoo.storeApiNonce=' . wp_json_encode( $nonce ) . ';}',
			'before'
		);
	}
}

/* ── Button ───────────────────────────────────────────────────────────── */

/** A product the button can start a look for: published, purchasable, simple or variable, with an image. */
function grindctrl_sc_tryon_eligible( $product ) {
	if ( ! $product instanceof WC_Product ) {
		return false;
	}
	if ( 'publish' !== $product->get_status() || post_password_required( $product->get_id() ) ) {
		return false;
	}
	if ( ! $product->is_type( array( 'simple', 'variable' ) ) || ! $product->is_purchasable() ) {
		return false;
	}
	return (bool) $product->get_image_id();
}

/**
 * The Shopify app block's animated icon (scan beam, ring, sparkle), the same
 * markup the hosted engine adds to a button without one. Printed with the
 * button so it never pops in; sized inline until the engine's styles load.
 * Every icon on the page gets its own clipPath id.
 */
function grindctrl_sc_tryon_icon_html() {
	static $count = 0;
	$clip   = 'gc-tryon-wp-clip-' . ( ++$count );
	$figure = '<circle cx="12" cy="6.6" r="3.2"/><path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z"/>';
	return '<span class="gc-tryon-ic" aria-hidden="true" style="display:inline-flex;inline-size:var(--gc-ic-size,28px);block-size:var(--gc-ic-size,28px)">'
		. '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" stroke="none" focusable="false">'
		. '<defs><clipPath id="' . esc_attr( $clip ) . '">' . $figure . '</clipPath></defs>'
		. '<g opacity="0.5">' . $figure . '</g>'
		. '<g clip-path="url(#' . esc_attr( $clip ) . ')"><rect class="gc-ic-scan" x="2" y="1" width="20" height="2.4" rx="1.2"/></g>'
		. '<path class="gc-ic-spark" d="m20 2.6.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z"/>'
		. '</svg></span>';
}

/**
 * @param WC_Product $product Product to try on.
 * @param string     $variant 'page' for a product page button, 'card' for a catalog card.
 * @param string     $label   Optional label override.
 */
function grindctrl_sc_tryon_button_html( $product, $variant = 'page', $label = '' ) {
	$config = grindctrl_sc_tryon_config();
	if ( ( empty( $config['enabled'] ) && empty( $config['previewOnly'] ) ) || ! grindctrl_sc_tryon_eligible( $product ) ) {
		return '';
	}
	grindctrl_sc_tryon_enqueue();

	$is_card = 'card' === $variant;
	if ( '' === $label ) {
		$label = $is_card && ! empty( $config['catalogLabel'] ) ? $config['catalogLabel'] : $config['label'];
	}
	$style = sprintf( '--gc-bg:%s;--gc-fg:%s;--gc-radius:%dpx', $config['bg'], $config['fg'], $config['radius'] );
	// Card buttons have no icon. A config cached by 0.3.3 has no icon fields: the engine's defaults apply.
	if ( ! $is_card && isset( $config['icFrom'], $config['icTo'], $config['icSize'] ) ) {
		$style .= sprintf( ';--gc-ic-from:%s;--gc-ic-to:%s;--gc-ic-size:%dpx', $config['icFrom'], $config['icTo'], $config['icSize'] );
	}
	if ( ! empty( $config['previewOnly'] ) ) {
		$style .= ';display:none'; // Hidden before the deferred loader runs too.
	}

	return sprintf(
		'<button type="button" class="gc-tryon-btn%1$s" data-product-id="%2$d" data-product-type="%3$s"%4$s style="%5$s">%6$s</button>',
		( $is_card ? ' gc-tryon-btn--card' : '' ) . ( ! empty( $config['previewOnly'] ) ? ' gc-tryon-btn--preview' : '' ),
		(int) $product->get_id(),
		esc_attr( $product->get_type() ),
		$is_card ? '' : ' data-gc-page="1"',
		esc_attr( $style ),
		$is_card ? esc_html( $label ) : grindctrl_sc_tryon_icon_html() . '<span class="gc-tryon-label">' . esc_html( $label ) . '</span>'
	);
}

function grindctrl_sc_tryon_current_product( $product_id = 0 ) {
	if ( $product_id > 0 ) {
		return wc_get_product( $product_id );
	}
	global $product;
	if ( $product instanceof WC_Product ) {
		return $product;
	}
	return wc_get_product( get_the_ID() );
}

/* Merchant switches live under WooCommerce > Settings > Products. */
add_filter(
	'woocommerce_product_settings',
	function ( $settings ) {
		$settings[] = array(
			'title' => __( 'GRINDCTRL Try-On', 'grindctrl-store-chat' ),
			'type'  => 'title',
			'id'    => 'grindctrl_sc_tryon_options',
			'desc'  => __( 'Shows a Try it on button once your site is connected and Try-On is on in your GRINDCTRL dashboard.', 'grindctrl-store-chat' ),
		);
		$settings[] = array(
			'title'   => __( 'Product pages', 'grindctrl-store-chat' ),
			'desc'    => __( 'Show Try it on after the Add to cart button', 'grindctrl-store-chat' ),
			'id'      => 'grindctrl_sc_tryon_product',
			'type'    => 'checkbox',
			'default' => 'yes',
		);
		$settings[] = array(
			'title'   => __( 'Product listings', 'grindctrl-store-chat' ),
			'desc'    => __( 'Show a Try it on button on product cards in shop and category pages', 'grindctrl-store-chat' ),
			'id'      => 'grindctrl_sc_tryon_catalog',
			'type'    => 'checkbox',
			'default' => 'no',
		);
		$settings[] = array(
			'type' => 'sectionend',
			'id'   => 'grindctrl_sc_tryon_options',
		);
		return $settings;
	}
);

add_action(
	'woocommerce_after_add_to_cart_button',
	function () {
		if ( 'yes' !== get_option( 'grindctrl_sc_tryon_product', 'yes' ) ) {
			return;
		}
		$html = grindctrl_sc_tryon_button_html( grindctrl_sc_tryon_current_product(), 'page' );
		if ( '' !== $html ) {
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in grindctrl_sc_tryon_button_html().
		}
	},
	20
);

/* Catalog cards (classic loop). Off until the merchant turns it on. */
add_action(
	'woocommerce_after_shop_loop_item',
	function () {
		if ( ! grindctrl_sc_tryon_cards_on() ) {
			return;
		}
		$html = grindctrl_sc_tryon_button_html( grindctrl_sc_tryon_current_product(), 'card' );
		if ( '' !== $html ) {
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in grindctrl_sc_tryon_button_html().
		}
	},
	15
);

/* Catalog cards (product collection blocks render the same product loop item markup). */
add_filter(
	'woocommerce_blocks_product_grid_item_html',
	function ( $html, $data, $product ) {
		if ( ! $product instanceof WC_Product || ! grindctrl_sc_tryon_cards_on() ) {
			return $html;
		}
		$button = grindctrl_sc_tryon_button_html( $product, 'card' );
		if ( '' === $button ) {
			return $html;
		}
		$position = strrpos( $html, '</li>' );
		return false === $position ? $html : substr_replace( $html, $button, $position, 0 );
	},
	10,
	3
);

/*
 * Catalog cards (Product Collection block). Its cards are inner blocks, not a
 * loop item, so the pill follows each card's own button block. queryId is only
 * set inside a collection, which keeps single-product blocks out.
 */
add_filter(
	'render_block_woocommerce/product-button',
	function ( $content, $block, $instance ) {
		if (
			! grindctrl_sc_tryon_cards_on()
			|| ! function_exists( 'wc_get_product' )
			|| ! $instance instanceof WP_Block
			|| empty( $instance->context['queryId'] )
			|| empty( $instance->context['postId'] )
			|| false !== strpos( $content, 'gc-tryon-btn' )
		) {
			return $content;
		}
		return $content . grindctrl_sc_tryon_button_html( wc_get_product( absint( $instance->context['postId'] ) ), 'card' );
	},
	10,
	3
);

/* [grindctrl_tryon id="123" label="Try it on"] */
add_shortcode(
	'grindctrl_tryon',
	function ( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'    => 0,
				'label' => '',
			),
			$atts,
			'grindctrl_tryon'
		);
		if ( ! function_exists( 'wc_get_product' ) ) {
			return '';
		}
		return grindctrl_sc_tryon_button_html(
			grindctrl_sc_tryon_current_product( absint( $atts['id'] ) ),
			'page',
			sanitize_text_field( $atts['label'] )
		);
	}
);

/* Block grindctrl/tryon: server-rendered; the editor script only previews it. */
add_action(
	'init',
	function () {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}
		register_block_type(
			'grindctrl/tryon',
			array(
				'api_version'     => 3,
				'title'           => __( 'GRINDCTRL Try-On button', 'grindctrl-store-chat' ),
				'description'     => __( 'A Try it on button for a product. Shows nothing until your site is connected and Try-On is on.', 'grindctrl-store-chat' ),
				'category'        => 'widgets',
				'attributes'      => array(
					'productId' => array(
						'type'    => 'integer',
						'default' => 0,
					),
				),
				'render_callback' => function ( $attributes ) {
					if ( ! function_exists( 'wc_get_product' ) ) {
						return '';
					}
					$product_id = isset( $attributes['productId'] ) ? absint( $attributes['productId'] ) : 0;
					return grindctrl_sc_tryon_button_html( grindctrl_sc_tryon_current_product( $product_id ), 'page' );
				},
			)
		);
	}
);

add_action(
	'enqueue_block_editor_assets',
	function () {
		wp_register_script(
			'grindctrl-tryon-editor',
			'',
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-server-side-render' ),
			GRINDCTRL_SC_VERSION,
			true
		);
		wp_enqueue_script( 'grindctrl-tryon-editor' );
		wp_add_inline_script(
			'grindctrl-tryon-editor',
			'( function ( wp ) {'
			. 'var el = wp.element.createElement;'
			. "wp.blocks.registerBlockType( 'grindctrl/tryon', {"
			. 'edit: function ( props ) {'
			. 'return el( "div", wp.blockEditor.useBlockProps(),'
			. "el( wp.serverSideRender, { block: 'grindctrl/tryon', attributes: props.attributes } ) );"
			. '},'
			. 'save: function () { return null; }'
			. '} );'
			. '} )( window.wp );'
		);
	}
);

/* ── REST: mint a Try-On session ──────────────────────────────────────── */

function grindctrl_sc_tryon_visitor_hash() {
	$ip = '';
	if ( class_exists( 'WC_Geolocation' ) ) {
		$ip = (string) WC_Geolocation::get_ip_address();
	}
	if ( '' === $ip && isset( $_SERVER['REMOTE_ADDR'] ) ) {
		$ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	}
	$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
	// Salted and one-way: GRINDCTRL receives a rate-limit key, never an address.
	return grindctrl_sc_base64url( hash_hmac( 'sha256', $ip . '|' . $agent, wp_salt( 'auth' ) . '|grindctrl-tryon', true ) );
}

/** A short per-visitor cap so one client cannot spend the whole site's budget. */
function grindctrl_sc_tryon_visitor_allowed( $visitor_hash ) {
	$key   = 'grindctrl_sc_tryon_v_' . substr( md5( $visitor_hash ), 0, 20 );
	$count = (int) get_transient( $key );
	if ( $count >= GRINDCTRL_SC_TRYON_VISITOR_MAX ) {
		return false;
	}
	set_transient( $key, $count + 1, GRINDCTRL_SC_TRYON_VISITOR_SPAN );
	return true;
}

function grindctrl_sc_tryon_error( $code, $status, $headers = array() ) {
	$response = new WP_REST_Response( array( 'error' => $code ), $status );
	$response->header( 'Cache-Control', 'no-store, max-age=0' );
	foreach ( $headers as $name => $value ) {
		$response->header( $name, $value );
	}
	return $response;
}

/** The nearest existing, uncropped derivative at least 1024px on its long side. */
function grindctrl_sc_tryon_attachment_image( $image_id ) {
	$metadata   = wp_get_attachment_metadata( $image_id );
	$registered = wp_get_registered_image_subsizes();
	$best_size  = 'full';
	$best_edge  = PHP_INT_MAX;
	$sizes      = is_array( $metadata ) && isset( $metadata['sizes'] ) && is_array( $metadata['sizes'] ) ? $metadata['sizes'] : array();
	foreach ( $sizes as $name => $size ) {
		// Never substitute a cropped garment or an unregistered/stale thumbnail.
		if ( ! isset( $registered[ $name ] ) || ! empty( $registered[ $name ]['crop'] ) || ! is_array( $size ) ) {
			continue;
		}
		$edge = max( isset( $size['width'] ) ? (int) $size['width'] : 0, isset( $size['height'] ) ? (int) $size['height'] : 0 );
		if ( $edge >= 1024 && $edge < $best_edge ) {
			$best_size = $name;
			$best_edge = $edge;
		}
	}
	$src = wp_get_attachment_image_url( $image_id, $best_size );
	if ( ! is_string( $src ) || 0 !== strpos( $src, 'https://' ) ) {
		$src = wp_get_attachment_image_url( $image_id, 'full' );
	}
	return is_string( $src ) && 0 === strpos( $src, 'https://' ) ? $src : null;
}

/** The product's own image, or its parent's, using a bounded derivative when present. */
function grindctrl_sc_tryon_image( $product, $parent ) {
	foreach ( array( $product, $parent ) as $candidate ) {
		if ( $candidate instanceof WC_Product && $candidate->get_image_id() ) {
			$src = grindctrl_sc_tryon_attachment_image( $candidate->get_image_id() );
			if ( null !== $src ) {
				return $src;
			}
		}
	}
	return null;
}

function grindctrl_sc_tryon_context_route( WP_REST_Request $request ) {
	$preview = $request->get_param( 'preview' );
	$preview = is_string( $preview ) && 1 === preg_match( '/^[A-Za-z0-9_.-]{20,512}$/', $preview ) ? $preview : '';
	$config  = grindctrl_sc_tryon_config();
	if ( ! function_exists( 'wc_get_product' ) || ! grindctrl_sc_is_connected()
		|| ( empty( $config['enabled'] ) && ( empty( $config['previewOnly'] ) || '' === $preview ) ) ) {
		return grindctrl_sc_tryon_error( 'unavailable', 503 );
	}

	$product_id   = absint( $request->get_param( 'product_id' ) );
	$variation_id = absint( $request->get_param( 'variation_id' ) );
	$parent       = $product_id ? wc_get_product( $product_id ) : null;
	if ( ! grindctrl_sc_tryon_eligible( $parent ) ) {
		return grindctrl_sc_tryon_error( 'product_unavailable', 404 );
	}

	$variation = null;
	if ( $variation_id > 0 ) {
		$variation = wc_get_product( $variation_id );
		if (
			! $variation instanceof WC_Product_Variation
			|| (int) $variation->get_parent_id() !== (int) $parent->get_id()
			|| 'publish' !== $variation->get_status()
			|| ! $variation->is_purchasable()
		) {
			return grindctrl_sc_tryon_error( 'variation_unavailable', 400 );
		}
	}

	$image = grindctrl_sc_tryon_image( $variation, $parent );
	if ( null === $image ) {
		return grindctrl_sc_tryon_error( 'no_image', 422 );
	}

	$visitor_hash = grindctrl_sc_tryon_visitor_hash();
	if ( ! grindctrl_sc_tryon_visitor_allowed( $visitor_hash ) ) {
		return grindctrl_sc_tryon_error( 'rate_limited', 429, array( 'Retry-After' => (string) GRINDCTRL_SC_TRYON_VISITOR_SPAN ) );
	}

	$path     = '/api/woo/tryon-context';
	// An untrusted browser can forward a token, never choose the signed test flag.
	$response = grindctrl_sc_post_json(
		$path,
		array(
			'productId'   => (int) $parent->get_id(),
			'variationId' => $variation ? (int) $variation->get_id() : 0,
			'title'       => mb_substr( wp_strip_all_tags( $parent->get_name() ), 0, 200 ),
			'imageUrl'    => $image,
			'pageUrl'     => get_permalink( $parent->get_id() ),
			'locale'      => grindctrl_sc_tryon_locale(),
			'visitorHash' => $visitor_hash,
			'preview'     => $preview,
		),
		true,
		15
	);
	if ( is_wp_error( $response ) ) {
		return grindctrl_sc_tryon_error( 'unavailable', 503 );
	}

	$status = (int) wp_remote_retrieve_response_code( $response );
	$data   = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( 200 !== $status || ! is_array( $data ) ) {
		$code = is_array( $data ) && isset( $data['error'] ) && is_string( $data['error'] ) ? $data['error'] : 'unavailable';
		// Reasons this store cannot start a look right now hide the button; auth and outage errors do not.
		$hidden = array( 'out_of_looks', 'plan_inactive', 'not_installed', 'free_plan_taken', 'no_verified_domain', 'page_not_verified', 'site_disconnected', 'preview', 'holdout' );
		if ( in_array( $code, $hidden, true ) ) {
			// A hidden state outlives a page load: refresh the cached config sooner.
			delete_transient( 'grindctrl_sc_tryon_cfg_' . grindctrl_sc_tryon_locale() );
			return grindctrl_sc_tryon_error( preg_replace( '/[^a-z_]/', '', $code ), 409 );
		}
		if ( 429 === $status ) {
			return grindctrl_sc_tryon_error( 'rate_limited', 429, array( 'Retry-After' => '10' ) );
		}
		return grindctrl_sc_tryon_error( 422 === $status ? 'garment_unsafe' : 'unavailable', 422 === $status ? 422 : 503 );
	}

	// The embed must live on the GRINDCTRL server this site talks to.
	$embed      = isset( $data['embedUrl'] ) && is_string( $data['embedUrl'] ) ? wp_parse_url( $data['embedUrl'] ) : null;
	$api_parts  = wp_parse_url( GRINDCTRL_SC_API_BASE );
	if (
		! is_array( $embed )
		|| ! is_array( $api_parts )
		|| 'https' !== ( isset( $embed['scheme'] ) ? $embed['scheme'] : '' )
		|| empty( $embed['host'] )
		|| empty( $api_parts['host'] )
		|| strtolower( $embed['host'] ) !== strtolower( $api_parts['host'] )
		|| isset( $embed['port'] )
		|| isset( $embed['user'] )
	) {
		return grindctrl_sc_tryon_error( 'unavailable', 503 );
	}

	$result = new WP_REST_Response(
		array(
			'embedUrl' => $data['embedUrl'],
			'context'  => isset( $data['context'] ) && is_array( $data['context'] ) ? $data['context'] : new stdClass(),
			'settings' => isset( $data['settings'] ) && is_array( $data['settings'] ) ? $data['settings'] : new stdClass(),
		),
		200
	);
	$result->header( 'Cache-Control', 'no-store, max-age=0' );
	return $result;
}

/*
 * The variations behind the sheet's size picker, in the shape the Shopify
 * loader sends: options, variants (id, title, option values, availability,
 * price in hundredths) and, per variant, the attributes the Store API needs.
 * Only variations with every attribute fixed are listed; an "any" variation
 * cannot say which size it is. Public product data, read-only.
 */
function grindctrl_sc_tryon_product_route( WP_REST_Request $request ) {
	$config  = grindctrl_sc_tryon_config();
	$preview = $request->get_param( 'preview' );
	$preview = is_string( $preview ) && 1 === preg_match( '/^[A-Za-z0-9_.-]{20,512}$/', $preview );
	// Public product options may serve the preview entry too; this grants no look.
	if ( ! function_exists( 'wc_get_product' ) || ! grindctrl_sc_is_connected()
		|| ( empty( $config['enabled'] ) && ( empty( $config['previewOnly'] ) || ! $preview ) ) ) {
		return grindctrl_sc_tryon_error( 'unavailable', 503 );
	}
	$parent = wc_get_product( absint( $request->get_param( 'product_id' ) ) );
	if ( ! grindctrl_sc_tryon_eligible( $parent ) ) {
		return grindctrl_sc_tryon_error( 'product_unavailable', 404 );
	}

	$options  = array();
	$variants = array();
	if ( $parent->is_type( 'variable' ) ) {
		$names = array_slice( array_keys( $parent->get_variation_attributes() ), 0, 3 );
		foreach ( $names as $name ) {
			$options[] = wp_strip_all_tags( wc_attribute_label( $name, $parent ) );
		}
		foreach ( array_slice( $parent->get_children(), 0, 250 ) as $child_id ) {
			$child = wc_get_product( $child_id );
			if ( ! $child instanceof WC_Product_Variation || 'publish' !== $child->get_status() || ! $child->is_purchasable() ) {
				continue;
			}
			$chosen     = $child->get_variation_attributes();
			$values     = array();
			$attributes = array();
			foreach ( $names as $name ) {
				$key  = sanitize_title( $name );
				$slug = isset( $chosen[ 'attribute_' . $key ] ) ? (string) $chosen[ 'attribute_' . $key ] : '';
				if ( '' === $slug ) {
					continue 2;
				}
				$term         = taxonomy_exists( $name ) ? get_term_by( 'slug', $slug, $name ) : false;
				$values[]     = wp_strip_all_tags( $term instanceof WP_Term ? $term->name : $slug );
				$attributes[] = array(
					'attribute' => $key,
					'value'     => $slug,
				);
			}
			$variants[] = array(
				'id'         => (int) $child->get_id(),
				'title'      => implode( ' / ', $values ),
				'options'    => $values,
				'available'  => $child->is_in_stock(),
				'price'      => (int) round( (float) wc_get_price_to_display( $child ) * 100 ),
				'attributes' => $attributes,
			);
		}
	}

	$result = new WP_REST_Response(
		array(
			'product' => array(
				'options'  => $options,
				'currency' => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : null,
				'variants' => $variants,
			),
		),
		200
	);
	$result->header( 'Cache-Control', 'no-store, max-age=0' );
	return $result;
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'grindctrl/v1',
			'/tryon-product',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'grindctrl_sc_tryon_product_route',
				'permission_callback' => '__return_true',
				'args'                => array(
					'product_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}
);

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'grindctrl/v1',
			'/tryon-context',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'grindctrl_sc_tryon_context_route',
				/*
				 * Public on purpose: shoppers are anonymous. The route reads only public
				 * product data, checks the product is published and purchasable, caps each
				 * visitor, and every call to GRINDCTRL is signed with the site secret and
				 * rate-limited again on the server.
				 */
				'permission_callback' => '__return_true',
				'args'                => array(
					'product_id'   => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					),
					'variation_id' => array(
						'type'              => 'integer',
						'default'           => 0,
						'minimum'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}
);
