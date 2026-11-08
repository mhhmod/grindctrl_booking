import type { TryOnSettings } from './settings';

/** Whether shoppers may see the "Try on" pill on product cards: the one rule
 *  every platform's storefront config answer applies (the Shopify App Proxy
 *  config, and the site config the WooCommerce plugin and pasted code read).
 *  The main Try-On switch off hides the pills too, whatever their own switch
 *  says. The loaders add no pill unless their config answer says true. */
export function cardPillsOn(settings: Pick<TryOnSettings, 'showButton' | 'showCardPill'>): boolean {
  return settings.showButton && settings.showCardPill;
}
