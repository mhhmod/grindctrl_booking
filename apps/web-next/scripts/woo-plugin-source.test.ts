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

describe('GRINDCTRL Store Chat plugin source', () => {
  it('declares one version in the header, the constant and the readme', () => {
    const header = /\* Version:\s+(\S+)/.exec(main)?.[1];
    expect(header).toBe('0.3.2');
    expect(main).toContain(`define( 'GRINDCTRL_SC_VERSION', '${header}' );`);
    expect(read('readme.txt')).toMatch(new RegExp(`Stable tag: ${header}\\b`));
    expect(read('readme.txt')).toContain(`= ${header} =`);
  });

  it('claims each inbound nonce atomically, never read-then-write', () => {
    const claim = orders.slice(orders.indexOf('function grindctrl_sc_claim_nonce'), orders.indexOf('function grindctrl_sc_purge_nonces'));
    expect(claim).toContain('wp_cache_add');
    expect(claim).toMatch(/INSERT IGNORE INTO \{\$wpdb->options\}/);
    expect(claim).toContain('1 === $inserted');
    expect(claim).not.toMatch(/get_transient|set_transient|get_option/);
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

  it('keeps preview-only entries hidden until the loader sees a preview token and forwards the token to the server', () => {
    expect(tryon).toContain("'out_of_looks' === $data['reason']");
    expect(tryon).toContain("$style .= ';display:none'");
    expect(tryon).toContain("' gc-tryon-btn--preview'");
    expect(tryon).toContain("'preview'     => $preview");
    expect(tryon).not.toContain("'test'        =>");
  });
});
