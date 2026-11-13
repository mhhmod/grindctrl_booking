'use client';

import { Menu } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { getShellCopy } from '@/lib/dashboard/shell-copy';
import { storeSwitchHref, type ShellStore } from '@/lib/dashboard/shell-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-shell.module.css';

/** Shared by the phone header and sidebar; addresses keep their own direction. */
export function StoreSwitcher({ stores, locale, pathname, compact = false }: {
  stores: readonly ShellStore[]; locale: SiteLocale; pathname: string; compact?: boolean;
}) {
  const copy = getShellCopy(locale);
  const current = stores.find((store) => store.current) ?? stores[0];
  if (!current) return null;
  return (
    <Menu position="bottom-start" width={compact ? undefined : 'target'} withinPortal>
      <Menu.Target>
        <button type="button" className={compact ? classes.topbarStore : classes.storeButton} aria-label={copy.switchStore(current.label)}>
          {!compact && <span className={classes.storeAvatar} aria-hidden="true">{current.initials}</span>}
          <span className={classes.storeText}>
            <span className={classes.storeName}>{current.label}</span>
            {!compact && current.domain && <bdi dir="ltr" className={classes.storeDomain}>{current.domain}</bdi>}
          </span>
          <GcIcon name="sel" size={16} />
        </button>
      </Menu.Target>
      <Menu.Dropdown className={classes.storeDropdown}>
        <Menu.Label>{copy.yourStores}</Menu.Label>
        {stores.map((store) => (
          <Menu.Item key={store.key} component="a" href={storeSwitchHref(pathname, store.choice)}
            leftSection={<span className={classes.storeAvatar} aria-hidden="true">{store.initials}</span>}
            rightSection={store.current ? <GcIcon name="check" size={16} /> : null}
            aria-current={store.current ? 'true' : undefined}>
            <span className={classes.storeText}>
              <span className={classes.storeName}>{store.label}</span>
              {store.domain && <bdi dir="ltr" className={classes.storeDomain}>{store.domain}</bdi>}
            </span>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
