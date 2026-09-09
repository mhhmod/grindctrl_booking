# PRODUCT.md

register: product

## What this is
GrindCTRL Try-On: a done-for-you AI virtual try-on service for Shopify clothing stores. Shoppers upload a photo on a product page and see themselves wearing the actual product. Sold as self-serve SaaS through Shopify's own billing — merchants pick a plan and activate it themselves, no manual credit grants.

**2026-09-09 update:** earlier production-readiness work confirmed "managed service, operator-only credit grants" as the launch model. That has since been reversed in favor of full self-service; this file reflects the current direction. Building it requires Shopify App Pricing (subscription creation, confirmation redirect, and Partner API billing reconciliation) — not yet implemented (see the production-readiness checkpoint's gate 2).

## Users
- **Shoppers** (end users): on a merchant's product page, mobile-heavy, want a fast "how would this look on me" moment, then buy. English and Arabic.
- **Merchants** (clients): store owners configuring the widget from the Shopify admin. Non-technical. Want brand match and zero maintenance.
- **Owner** (Mahmoud/GrindCTRL): operates everything from the GrindCTRL dashboard: job history, spend, per-shop settings.

## Tone
Warm, confident, done-for-you. Not corporate SaaS. Short sentences. No hype words.

## Anti-references
- Generic SaaS cream landing pages, hero-metric dashboards.
- Cheap "AI magic sparkle" overload; one tasteful sparkle max.
- Anything that makes the widget clash with the merchant's storefront: the widget adapts to the merchant's brand via settings, grindctrl branding stays out of shopper-facing surfaces.

## Strategic principles
- The widget must feel native to each store: merchant-controlled colors, radius, labels, CTAs.
- The post-generation moment is peak purchase intent: conversion first (Add to cart), sharing second.
- Full consistency: dashboard settings, Shopify admin settings, storefront widget, and catalog dialog all read from one settings table.
- Every surface works in English and Arabic (RTL).
