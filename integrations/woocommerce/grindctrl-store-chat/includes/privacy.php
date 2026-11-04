<?php
/**
 * WordPress privacy tools for GRINDCTRL Store Chat.
 *
 * Chats live in GRINDCTRL, not in this site's database, so the exporter and
 * eraser ask GRINDCTRL for the shopper's records for this site only. Requests
 * are signed with the site's own secret; GRINDCTRL never accepts an email for
 * a site that did not sign the call.
 */

defined( 'ABSPATH' ) || exit;

/*
 * A request that cannot be completed returns a WP_Error. WordPress then shows
 * an error on the request instead of treating an empty answer as "no data",
 * and the administrator can retry.
 */
function grindctrl_sc_privacy_call( $path, $email, $page ) {
	$result = grindctrl_sc_response_result(
		grindctrl_sc_post_json(
			$path,
			array(
				'email' => $email,
				'page'  => max( 1, (int) $page ),
			),
			true,
			20
		)
	);
	if ( is_wp_error( $result ) ) {
		return $result;
	}
	return isset( $result['ok'] ) && true === $result['ok'] ? $result : new WP_Error( 'invalid_response' );
}

function grindctrl_sc_privacy_text( $value ) {
	return wp_check_invalid_utf8( is_scalar( $value ) ? (string) $value : '' );
}

function grindctrl_sc_privacy_export( $email_address, $page = 1 ) {
	// A site that was never connected holds no GRINDCTRL records.
	if ( null === grindctrl_sc_connection_credentials() ) {
		return array(
			'data' => array(),
			'done' => true,
		);
	}
	$result = grindctrl_sc_privacy_call( '/api/woo/privacy/export', $email_address, $page );
	if ( is_wp_error( $result ) || ! isset( $result['items'], $result['done'] ) || ! is_array( $result['items'] ) ) {
		return new WP_Error( 'grindctrl_privacy_export_failed' );
	}

	$data = array();
	foreach ( $result['items'] as $item ) {
		if ( ! is_array( $item ) || ! isset( $item['group_id'], $item['group_label'], $item['item_id'], $item['data'] ) || ! is_array( $item['data'] ) ) {
			continue;
		}
		$rows = array();
		foreach ( $item['data'] as $row ) {
			if ( is_array( $row ) && isset( $row['name'], $row['value'] ) ) {
				$rows[] = array(
					'name'  => grindctrl_sc_privacy_text( $row['name'] ),
					'value' => grindctrl_sc_privacy_text( $row['value'] ),
				);
			}
		}
		$data[] = array(
			'group_id'    => sanitize_key( $item['group_id'] ),
			'group_label' => grindctrl_sc_privacy_text( $item['group_label'] ),
			'item_id'     => sanitize_text_field( $item['item_id'] ),
			'data'        => $rows,
		);
	}
	return array(
		'data' => $data,
		'done' => true === $result['done'],
	);
}

function grindctrl_sc_privacy_erase( $email_address, $page = 1 ) {
	if ( null === grindctrl_sc_connection_credentials() ) {
		return array(
			'items_removed'  => false,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => true,
		);
	}
	$result = grindctrl_sc_privacy_call( '/api/woo/privacy/erase', $email_address, $page );
	if ( is_wp_error( $result ) || ! isset( $result['removed'], $result['done'] ) || ! is_int( $result['removed'] ) ) {
		return new WP_Error( 'grindctrl_privacy_erase_failed' );
	}

	$removed  = max( 0, $result['removed'] );
	$messages = array();
	if ( $removed > 0 ) {
		$messages[] = sprintf(
			/* translators: %d: number of GRINDCTRL Store Chat records removed. */
			_n( 'GRINDCTRL Store Chat: removed %d chat record.', 'GRINDCTRL Store Chat: removed %d chat records.', $removed, 'grindctrl-store-chat' ),
			$removed
		);
	}
	return array(
		'items_removed'  => $removed > 0,
		'items_retained' => false,
		'messages'       => $messages,
		'done'           => true === $result['done'],
	);
}

add_filter(
	'wp_privacy_personal_data_exporters',
	function ( $exporters ) {
		$exporters['grindctrl-store-chat'] = array(
			'exporter_friendly_name' => __( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ),
			'callback'               => 'grindctrl_sc_privacy_export',
		);
		return $exporters;
	}
);

add_filter(
	'wp_privacy_personal_data_erasers',
	function ( $erasers ) {
		$erasers['grindctrl-store-chat'] = array(
			'eraser_friendly_name' => __( 'GRINDCTRL Store Chat', 'grindctrl-store-chat' ),
			'callback'             => 'grindctrl_sc_privacy_erase',
		);
		return $erasers;
	}
);

add_action(
	'admin_init',
	function () {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'GRINDCTRL Store Chat',
				wp_kses_post(
					'<p>' . __( 'Chat conversations, any name or email address a visitor gives in the chat, and images they attach are kept by GRINDCTRL, not in this site’s database, and are deleted after twelve months without activity. To export or erase a visitor’s chats, use Tools, then Export Personal Data or Erase Personal Data, with the email address they gave in the chat. If you uninstall the plugin, GRINDCTRL deletes this site’s chat records 48 hours later.', 'grindctrl-store-chat' ) . '</p>'
				)
			);
		}
	}
);
