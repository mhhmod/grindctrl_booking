<?php
/**
 * Plugin Name:       GRINDCTRL Store Chat
 * Plugin URI:        https://grindctrl.cloud
 * Description:       Adds GRINDCTRL Store Chat to your store. On WooCommerce product pages it shares the product the shopper is viewing with the chat.
 * Version:           0.1.0
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

define( 'GRINDCTRL_SC_VERSION', '0.1.0' );
// Overridable from wp-config.php to point a test site at a GRINDCTRL staging server.
defined( 'GRINDCTRL_SC_SCRIPT' ) || define( 'GRINDCTRL_SC_SCRIPT', 'https://grindctrl.cloud/widget/v1/messenger.js' );
defined( 'GRINDCTRL_SC_DASHBOARD' ) || define( 'GRINDCTRL_SC_DASHBOARD', 'https://grindctrl.cloud/dashboard/store-chat/setup' );

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
					'<p>' . __( 'This site uses GRINDCTRL Store Chat, a chat assistant loaded from grindctrl.cloud. When a visitor opens the chat, the messages they write, the page they are on and an anonymous visitor id are sent to GRINDCTRL to answer them.', 'grindctrl-store-chat' ) . ' '
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

function grindctrl_sc_render_settings() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key   = get_option( 'grindctrl_sc_embed_key', '' );
	$scope = grindctrl_sc_scope();
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ); ?></h1>
		<p>
			<?php echo esc_html__( 'Copy your embed key from Store Chat in the GRINDCTRL dashboard, and verify this site’s domain there. Store Chat only answers on a verified domain.', 'grindctrl-store-chat' ); ?>
			<a href="<?php echo esc_url( GRINDCTRL_SC_DASHBOARD ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html__( 'Open the dashboard', 'grindctrl-store-chat' ); ?></a>
		</p>
		<?php settings_errors( 'grindctrl_sc_embed_key' ); ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'grindctrl_sc' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="grindctrl_sc_embed_key"><?php echo esc_html__( 'Embed key', 'grindctrl-store-chat' ); ?></label></th>
					<td>
						<input name="grindctrl_sc_embed_key" id="grindctrl_sc_embed_key" type="text" class="regular-text code" dir="ltr" autocomplete="off" spellcheck="false" value="<?php echo esc_attr( $key ); ?>" />
					</td>
				</tr>
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
			<?php submit_button(); ?>
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
