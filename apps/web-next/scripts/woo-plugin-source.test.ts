// @vitest-environment node
/* PHP is not run in CI, so these read the plugin source for the invariants
   that matter and that a refactor could silently drop. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLUGIN_DIR } from './build-woo-plugin-zip.mjs';

const read = (file: string) => fs.readFileSync(path.join(PLUGIN_DIR, file), 'utf8');
const main = read('grindctrl-store-chat.php');
const orders = read('includes/orders.php');
const tryon = read('includes/tryon.php');
const updates = read('includes/updates.php');

describe('GRINDCTRL Store Chat plugin source', () => {
  it('declares one version in the header, the constant and the readme', () => {
    const header = /\* Version:\s+(\S+)/.exec(main)?.[1];
    expect(header).toBe('0.4.0');
    expect(main).toContain(`define( 'GRINDCTRL_SC_VERSION', '${header}' );`);
    expect(read('readme.txt')).toMatch(new RegExp(`Stable tag: ${header}\\b`));
    expect(read('readme.txt')).toContain(`= ${header} =`);
  });

  it('uses the native private update URI and scopes both metadata hooks to our plugin', () => {
    expect(main).toMatch(/\* Update URI:\s+https:\/\/grindctrl\.cloud\s/);
    expect(main).toContain("require_once __DIR__ . '/includes/updates.php'");
    expect(updates).toContain("add_filter( 'update_plugins_grindctrl.cloud', 'grindctrl_sc_plugin_update', 10, 4 )");
    expect(updates).toContain("add_filter( 'plugins_api', 'grindctrl_sc_plugin_information', 10, 3 )");
    expect(updates).toContain('function grindctrl_sc_plugin_update( $update, $plugin_data, $plugin_file, $locales )');
    expect(updates).toContain('grindctrl_sc_plugin_basename() !== $plugin_file');
    expect(updates).toContain("'plugin_information' !== $action");
    expect(updates).toContain("'grindctrl-store-chat' !== $args->slug");
    for (const field of ['id', 'slug', 'version', 'url', 'package', 'tested', 'requires_php', 'requires', 'sha256', 'sections', 'download_link']) {
      expect(updates).toContain(`'${field}'`);
    }
  });

  it('validates release metadata and accepts only HTTPS packages from the configured API host', () => {
    const allowed = updates.slice(updates.indexOf('function grindctrl_sc_update_package_allowed'), updates.indexOf('function grindctrl_sc_validate_release'));
    expect(allowed).toContain('wp_parse_url( GRINDCTRL_SC_API_BASE )');
    expect(allowed).toContain("'https' === strtolower( $package['scheme'] )");
    expect(allowed).toContain("strtolower( $package['host'] ) === strtolower( $api['host'] )");
    for (const field of ['user', 'pass', 'fragment']) expect(allowed).toContain(`! isset( $package['${field}'] )`);
    expect(updates).toContain('grindctrl_sc_valid_version( $data[ $field ] )');
    expect(updates).toContain("'/^[a-f0-9]{64}$/'");
    expect(updates).toContain("wp_kses_post( $data['changelog_html'] )");
    expect(updates).toContain('checkdate(');
  });

  it('bounds anonymous metadata requests and negatively caches failures', () => {
    expect(updates).toContain("grindctrl_sc_api_url( '/api/woo/plugin/update' )");
    expect(updates).toMatch(/'timeout'\s+=> 5/);
    expect(updates).toMatch(/'cookies'\s+=> array\(\)/);
    expect(updates).toMatch(/'redirection'\s+=> 0/);
    expect(updates).toContain("'GRINDCTRL-Store-Chat/' . GRINDCTRL_SC_VERSION . '; '");
    expect(updates).toContain("$data ? $data : 'unavailable', $data ? 12 * HOUR_IN_SECONDS : HOUR_IN_SECONDS");
    expect(updates).toContain('return grindctrl_sc_validate_release( $cached )');
  });

  it('verifies the exact advertised package with SHA-256 before handing it to the upgrader', () => {
    expect(updates).toContain("add_filter( 'upgrader_pre_download', 'grindctrl_sc_verify_update_download', 10, 4 )");
    const download = updates.slice(updates.indexOf('function grindctrl_sc_verify_update_download'), updates.indexOf('function grindctrl_sc_version_changed'));
    expect(download).toContain("get_site_transient( 'update_plugins' )");
    expect(download).toContain("array( 'response', 'no_update' )");
    expect(download).toContain("$package !== $record['package']");
    expect(download).toContain("new WP_Error( 'grindctrl_sc_unsigned_update'");
    expect(download).toContain('download_url( $package )');
    expect(download).toContain("hash_file( 'sha256', $file )");
    expect(download).toContain("hash_equals( $record['sha256'], $hash )");
    expect(download).toMatch(/wp_delete_file\( \$file \);\s+return new WP_Error\( 'grindctrl_sc_update_checksum'/);
    expect(download).toContain('return $file;');
  });

  it('defaults auto-updates once and keeps upgrades separate from connection and Try-On settings', () => {
    const lifecycle = updates.slice(updates.indexOf('function grindctrl_sc_version_changed'));
    expect(lifecycle).toContain("GRINDCTRL_SC_VERSION === get_option( 'grindctrl_sc_installed_version', '' )");
    expect(lifecycle).toContain("false === get_site_option( 'grindctrl_sc_autoupdate_defaulted', false )");
    expect(lifecycle).toContain("get_site_option( 'auto_update_plugins', array() )");
    expect(lifecycle).toContain("update_site_option( 'auto_update_plugins', $plugins )");
    expect(lifecycle).toContain("update_site_option( 'grindctrl_sc_autoupdate_defaulted', true )");
    expect(lifecycle).toContain('grindctrl_sc_schedule_heartbeat();');
    expect(lifecycle).not.toMatch(/forget_connection|disconnect_remote|grindctrl_sc_secret|grindctrl_sc_embed_key|grindctrl_sc_tryon_/);
    expect(main).toContain('grindctrl_sc_version_changed( true )');
    expect(lifecycle).toContain("add_action( 'plugins_loaded', 'grindctrl_sc_version_changed' )");
    expect(updates).not.toContain("add_filter( 'auto_update_plugin'");
    const uninstall = read('uninstall.php');
    expect(uninstall).toContain("delete_site_transient( 'grindctrl_sc_plugin_release' )");
    expect(uninstall).toContain("delete_site_option( 'grindctrl_sc_autoupdate_defaulted' )");
    expect(uninstall).toContain("'grindctrl_sc_installed_version'");
  });

  it('claims each inbound nonce atomically, never read-then-write', () => {
    const claim = orders.slice(orders.indexOf('function grindctrl_sc_claim_nonce'), orders.indexOf('function grindctrl_sc_purge_nonces'));
    expect(claim).toContain('wp_cache_add');
    expect(claim).toMatch(/INSERT IGNORE INTO \{\$wpdb->options\}/);
    expect(claim).toContain('1 === $inserted');
    expect(claim).not.toMatch(/get_transient|set_transient|get_option/);
  });

  it('keys the Try-On visitor cap by the connection address and counts it atomically', () => {
    const ip = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_client_ip'), tryon.indexOf('function grindctrl_sc_tryon_visitor_hash'));
    expect(ip).toContain("$_SERVER['REMOTE_ADDR']");
    expect(ip).toContain('FILTER_FLAG_IPV6');
    expect(ip).toContain("'/64'");
    expect(ip).toContain("'' === $choice && grindctrl_sc_tryon_local_proxy( $ip )");
    expect(ip).toContain("array( 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP' )");
    expect(ip).toContain('array_reverse( $parts )');
    expect(ip).toContain('FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE');
    expect(ip).toContain('break 2;');
    expect(ip).toContain('return inet_ntop( substr( $packed, 12 ) );');
    // Public peers cannot enter automatic forwarding, and all local ranges,
    // including mapped IPv4, are recognized independently of header contents.
    for (const range of ['10 ===', '127 ===', '172 ===', '192 ===', '169 ===', '0xfc', '0x80', 'str_repeat( "\\0", 15 )', 'str_repeat( "\\0", 10 )']) {
      expect(ip).toContain(range);
    }
    const hash = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_visitor_hash'), tryon.indexOf('function grindctrl_sc_tryon_visitor_allowed'));
    expect(hash).not.toMatch(/HTTP_USER_AGENT|WC_Geolocation|X_FORWARDED/);
    const cap = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_visitor_allowed'), tryon.indexOf('function grindctrl_sc_tryon_purge_visitors'));
    expect(cap).toContain('wp_cache_incr');
    expect(cap).toMatch(/INSERT IGNORE INTO \{\$wpdb->options\}/);
    expect(cap).toContain('1 === $updated');
    expect(cap).not.toMatch(/get_transient|set_transient|get_option/);
    expect(cap).toContain("$name . '_' . $window");
    expect(cap).toMatch(/\$name,\r?\n/);
    expect(main).toContain('grindctrl_sc_tryon_purge_visitors();');
    expect(read('uninstall.php')).toContain("'grindctrl_sc_tryon_ip_header'");
  });

  it('shows catalog cards only while the dashboard card pill switch allows them, on every catalog hook', () => {
    expect(tryon).toMatch(/'cardPill'\s+=> ! isset\( \$data\['showCardPill'\] \) \|\| false !== \$data\['showCardPill'\]/);
    const gate = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_cards_on'), tryon.indexOf('/* ── Storefront script'));
    expect(gate).toContain("'yes' !== get_option( 'grindctrl_sc_tryon_catalog', 'no' )");
    expect(gate).toMatch(/! isset\( \$config\['cardPill'\] \) \|\| true === \$config\['cardPill'\]/);
    // The classic loop, the product grid block and the Product Collection block.
    for (const hook of ["'woocommerce_after_shop_loop_item'", "'woocommerce_blocks_product_grid_item_html'", "'render_block_woocommerce/product-button'"]) {
      const start = tryon.indexOf(hook);
      expect(start).toBeGreaterThan(-1);
      expect(tryon.slice(start, tryon.indexOf("'card'", start))).toContain('grindctrl_sc_tryon_cards_on()');
    }
    // The option is read in one place only: the gate.
    expect(tryon.match(/get_option\( 'grindctrl_sc_tryon_catalog'/g)).toHaveLength(1);
  });

  it('reports the REST root so plain permalinks work', () => {
    expect(main).toMatch(/'restUrl'\s+=> rest_url\(\)/);
  });

  it('finds orders by sequential number meta before the order id, and still needs the billing email', () => {
    expect(orders).toContain("'_order_number'");
    expect(orders).toContain("'_order_number_formatted'");
    expect(orders).toMatch(/hash_equals\( \$billing, \$email \)/);
  });

  it('offers the size picker its variations and adds a Product Collection pill once', () => {
    expect(tryon).toContain("'/tryon-product'");
    expect(tryon).toContain('render_block_woocommerce/product-button');
    expect(tryon).toContain("strpos( $content, 'gc-tryon-btn' )");
  });

  it('chooses an existing registered uncropped garment derivative above thumbnail size with a full fallback', () => {
    const image = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_attachment_image'), tryon.indexOf('function grindctrl_sc_tryon_image'));
    expect(image).toContain('wp_get_attachment_metadata( $image_id )');
    expect(image).toContain('wp_get_registered_image_subsizes()');
    expect(image).toContain("! isset( $registered[ $name ] )");
    expect(image).toContain("! empty( $registered[ $name ]['crop'] )");
    expect(image).toContain('$edge >= 1024 && $edge < $best_edge');
    expect(image).toContain("wp_get_attachment_image_url( $image_id, 'full' )");
  });

  it('prints the animated icon and its settings on product page buttons only, escaped, with a clipPath id per icon', () => {
    const icon = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_icon_html'), tryon.indexOf('function grindctrl_sc_tryon_button_html'));
    // The Shopify app block's markup (tryon.liquid).
    for (const part of ['class="gc-tryon-ic" aria-hidden="true"', 'class="gc-ic-scan"', 'class="gc-ic-spark"', '<g opacity="0.5">']) expect(icon).toContain(part);
    expect(icon).toContain('static $count = 0;');
    expect(icon).toContain("'gc-tryon-wp-clip-' . ( ++$count )");
    expect(icon.match(/esc_attr\( \$clip \)/g)).toHaveLength(2);
    // The same sanitizer as the button colors; the size clamped to the dashboard's range.
    expect(tryon).toMatch(/'icFrom'\s+=> grindctrl_sc_tryon_color\( isset\( \$data\['iconBgFrom'\] \)/);
    expect(tryon).toMatch(/'icTo'\s+=> grindctrl_sc_tryon_color\( isset\( \$data\['iconBgTo'\] \)/);
    expect(tryon).toContain("max( 18, min( 40, (int) round( (float) $data['buttonIconPx'] ) ) )");
    const button = tryon.slice(tryon.indexOf('function grindctrl_sc_tryon_button_html'), tryon.indexOf('function grindctrl_sc_tryon_current_product'));
    expect(button).toContain("! $is_card && isset( $config['icFrom'], $config['icTo'], $config['icSize'] )");
    expect(button).toContain("';--gc-ic-from:%s;--gc-ic-to:%s;--gc-ic-size:%dpx'");
    expect(button).toContain('esc_attr( $style )');
    expect(button).toContain("$is_card ? esc_html( $label ) : grindctrl_sc_tryon_icon_html() . '<span class=\"gc-tryon-label\">' . esc_html( $label ) . '</span>'");
  });

  it('keeps preview-only entries hidden until the loader sees a preview token and forwards the token to the server', () => {
    expect(tryon).toContain("'out_of_looks' === $data['reason']");
    expect(tryon).toContain("$style .= ';display:none'");
    expect(tryon).toContain("' gc-tryon-btn--preview'");
    expect(tryon).toContain("'preview'     => $preview");
    expect(tryon).not.toContain("'test'        =>");
  });
});
