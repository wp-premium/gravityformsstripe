<?php

/**
 * Gravity Forms Stripe API Library.
 *
 * @since     3.4
 * @package   GravityForms
 * @author    Rocketgenius
 * @copyright Copyright (c) 2020, Rocketgenius
 */
class GF_Stripe_API {
	/**
	 * Stripe API key.
	 *
	 * @since 3.4
	 * @var   string $api_key Stripe API key.
	 */
	protected $api_key;

	/**
	 * Stripe API version.
	 *
	 * @since 3.4
	 * @var   string $api_version Stripe API version.
	 */
	protected $api_version;

	/**
	 * Initialize Stripe API library.
	 *
	 * @since  3.4
	 *
	 * @param string $api_key Stripe API key.
	 */
	public function __construct( $api_key ) {

		$this->api_key     = $api_key;
		$this->api_version = '2020-03-02';

		// If Stripe class does not exist, load Stripe API library.
		if ( ! class_exists( '\Stripe\Stripe' ) ) {
			require_once 'autoload.php';
		}

		require_once 'deprecated.php';

		// Set Stripe API key.
		\Stripe\Stripe::setApiKey( $api_key );
		// Set API version.
		\Stripe\Stripe::setApiVersion( $this->api_version );

		if ( method_exists( '\Stripe\Stripe', 'setAppInfo' ) ) {
			// Send plugin title, version and site url along with API calls.
			\Stripe\Stripe::setAppInfo( gf_stripe()->get_short_title(), gf_stripe()->get_version(), esc_url( site_url() ) );
		}

	}

	/**
	 * Get Stripe account info.
	 *
	 * @since 3.4
	 *
	 * @return bool|WP_Error|\Stripe\Account Return WP_Error if exceptions thrown.
	 */
	public function get_account() {
		try {

			// Attempt to retrieve account details.
			return \Stripe\Account::retrieve();

		} catch ( \Exception $e ) {

			// Log that key validation failed.
			gf_stripe()->log_error( __METHOD__ . '(): ' . $e->getMessage() );

			return new WP_Error( $e->getCode(), $e->getMessage() );
		}
	}

	/**
	 * Create a new charge.
	 *
	 * @since 3.4
	 *
	 * @param array $charge_meta The charge meta.
	 *
	 * @return Stripe\Charge|WP_Error
	 */
	public function create_charge( $charge_meta ) {
		try {
			return \Stripe\Charge::create( $charge_meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Retrieve a charge by transaction ID.
	 *
	 * @since 3.4
	 *
	 * @param string $transaction_id The transaction ID.
	 *
	 * @return \Stripe\Charge|WP_Error
	 */
	public function get_charge( $transaction_id ) {
		try {
			return \Stripe\Charge::retrieve( $transaction_id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Save a charge.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\Charge $charge The charge.
	 *
	 * @return \Stripe\Charge|WP_Error
	 */
	public function save_charge( $charge ) {
		try {
			return $charge->save();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Capture a charge.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\Charge $charge The charge.
	 *
	 * @return \Stripe\Charge|WP_Error
	 */
	public function capture_charge( $charge ) {
		try {
			return $charge->capture();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Create a new plan.
	 *
	 * @since 3.4
	 *
	 * @param array $plan_meta The plan meta.
	 *
	 * @return Stripe\Plan|WP_Error
	 */
	public function create_plan( $plan_meta ) {
		try {
			return \Stripe\Plan::create( $plan_meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the Stripe Plan.
	 *
	 * @since 3.4
	 *
	 * @param string $id The Stripe plan ID.
	 *
	 * @return bool|\Stripe\Plan|WP_Error
	 */
	public function get_plan( $id ) {
		try {
			return \Stripe\Plan::retrieve( $id );
		} catch ( \Exception $e ) {
			/**
			 * There is no error type specific to failing to retrieve a subscription when an invalid plan ID is passed. We assume here
			 * that any 'invalid_request_error' means that the subscription does not exist even though other errors (like providing
			 * incorrect API keys) will also generate the 'invalid_request_error'. There is no way to differentiate these requests
			 * without relying on the error message which is more likely to change and not reliable.
			 */

			// Get error response.
			$response = $e->getJsonBody();

			// If error is an invalid request error, return error message.
			if ( rgars( $response, 'error/type' ) !== 'invalid_request_error' ) {
				return new WP_Error( $e->getCode(), $e->getMessage() );
			}

			return false;
		}
	}

	/**
	 * Create the Stripe Customer.
	 *
	 * @since 3.4
	 *
	 * @param array $customer_meta The customer metadata.
	 *
	 * @return \Stripe\Customer|WP_Error
	 */
	public function create_customer( $customer_meta ) {
		try {
			return \Stripe\Customer::create( $customer_meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the Stripe Customer.
	 *
	 * @since 3.4
	 *
	 * @param string $id The Stripe customer ID.
	 *
	 * @return \Stripe\Customer|WP_Error
	 */
	public function get_customer( $id ) {
		try {
			return \Stripe\Customer::retrieve( $id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Save the Stripe Customer object.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\Customer $customer The Stripe customer object.
	 *
	 * @return \Stripe\Customer|WP_Error
	 */
	public function save_customer( $customer ) {
		try {
			return $customer->save();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Update a Stripe Customer.
	 *
	 * @since 3.4
	 *
	 * @param string $id   The customer ID.
	 * @param array  $meta The customer meta.
	 *
	 * @return \Stripe\Customer|WP_Error
	 */
	public function update_customer( $id, $meta ) {
		try {
			return \Stripe\Customer::update( $id, $meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Create Stripe payment intent.
	 *
	 * @since 3.4
	 *
	 * @param array $data The payment intent data.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function create_payment_intent( $data ) {
		try {
			return \Stripe\PaymentIntent::create( $data );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Update Stripe payment intent.
	 *
	 * @since 3.4
	 *
	 * @param string $id   The payment intent ID.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function get_payment_intent( $id ) {
		try {

			return \Stripe\PaymentIntent::retrieve( $id );

		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Update Stripe payment intent.
	 *
	 * @since 3.4
	 *
	 * @param string $id   The payment intent ID.
	 * @param array  $data The payment intent data.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function update_payment_intent( $id, $data ) {
		try {
			return \Stripe\PaymentIntent::update( $id, $data );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Confirm the payment intent.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\PaymentIntent $intent The payment intent object.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function confirm_payment_intent( $intent ) {
		try {
			return $intent->confirm();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Save the payment intent.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\PaymentIntent $intent The payment intent object.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function save_payment_intent( $intent ) {
		try {
			return $intent->save();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Capture the payment intent.
	 *
	 * @since 3.4
	 *
	 * @param \Stripe\PaymentIntent $intent The payment intent object.
	 *
	 * @return \Stripe\PaymentIntent|WP_Error Return WP_Error if exceptions thrown.
	 */
	public function capture_payment_intent( $intent ) {
		try {
			return $intent->capture();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Create the checkout session.
	 *
	 * @since 3.4
	 *
	 * @param array $data The data to create teh session.
	 *
	 * @return \Stripe\Checkout\Session|WP_Error
	 */
	public function create_checkout_session( $data ) {
		try {
			return \Stripe\Checkout\Session::create( $data );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Create the checkout session.
	 *
	 * @since 3.4
	 *
	 * @param string $id The session ID.
	 *
	 * @return \Stripe\Checkout\Session|WP_Error
	 */
	public function get_checkout_session( $id ) {
		try {
			return \Stripe\Checkout\Session::retrieve( $id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the coupon.
	 *
	 * @since 3.4
	 *
	 * @param string $coupon The coupon code.
	 *
	 * @return \Stripe\Coupon|WP_Error
	 */
	public function get_coupon( $coupon ) {
		try {
			return \Stripe\Coupon::retrieve( $coupon );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Create the subscription.
	 *
	 * @since 3.4
	 *
	 * @param array $meta The subscription metadata.
	 *
	 * @return \Stripe\Subscription|WP_Error
	 */
	public function create_subscription( $meta ) {
		try {
			return \Stripe\Subscription::create( $meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the subscription.
	 *
	 * @since 3.4
	 *
	 * @param string $id The subscription ID.
	 *
	 * @return \Stripe\Subscription|WP_Error
	 */
	public function get_subscription( $id ) {
		try {
			return \Stripe\Subscription::retrieve( $id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Update a Stripe Subscription.
	 *
	 * @since 3.4
	 *
	 * @param string $id   The subscription ID.
	 * @param array  $meta The subscription meta.
	 *
	 * @return \Stripe\Subscription|WP_Error
	 */
	public function update_subscription( $id, $meta ) {
		try {
			return \Stripe\Subscription::update( $id, $meta );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Save a subscription.
	 *
	 * @since 3.5
	 *
	 * @param \Stripe\Subscription $subscription The subscription object.
	 *
	 * @return \Stripe\Subscription|WP_Error
	 */
	public function save_subscription( $subscription ) {
		try {
			return $subscription->save();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Cancel a subscription.
	 *
	 * @since 3.5
	 *
	 * @param \Stripe\Subscription $subscription The subscription object.
	 *
	 * @return \Stripe\Subscription|WP_Error
	 */
	public function cancel_subscription( $subscription ) {
		try {
			return $subscription->cancel();
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the invoice.
	 *
	 * @since 3.4
	 *
	 * @param string $id The invoice ID.
	 *
	 * @return \Stripe\Invoice|WP_Error
	 */
	public function get_invoice( $id ) {
		try {
			return \Stripe\Invoice::retrieve( $id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Pay an invoice.
	 *
	 * @since 3.5
	 *
	 * @param \Stripe\Invoice $invoice The invoice object.
	 * @param array           $params  Params to setup the invoice.
	 *
	 * @return \Stripe\Invoice|WP_Error
	 */
	public function pay_invoice( $invoice, $params = array() ) {
		try {
			return $invoice->pay( $params );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Add invoice item to a customer.
	 *
	 * @since 3.5
	 *
	 * @param array $params The params.
	 *
	 * @return \Stripe\InvoiceItem|WP_Error
	 */
	public function add_invoice_item( $params = array() ) {
		try {
			return \Stripe\InvoiceItem::create( $params );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the event.
	 *
	 * @since 3.4
	 *
	 * @param string $id The event ID.
	 *
	 * @return \Stripe\Event|WP_Error
	 */
	public function get_event( $id ) {
		try {
			return \Stripe\Event::retrieve( $id );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the event.
	 *
	 * @since 3.4
	 *
	 * @param string $body            The body object.
	 * @param string $sig_header      The signature header.
	 * @param string $endpoint_secret The endpoint secret.
	 *
	 * @return \Stripe\Event|WP_Error
	 */
	public function construct_event( $body, $sig_header, $endpoint_secret ) {
		try {
			return \Stripe\Webhook::constructEvent( $body, $sig_header, $endpoint_secret );
		} catch ( \Exception $e ) {

			return $this->get_error( $e );
		}
	}

	/**
	 * Get the exception and return WP_Error.
	 *
	 * @param Exception $e The exception.
	 *
	 * @return WP_Error
	 */
	private function get_error( $e ) {
		$error_code = $e->getCode();

		if ( ! empty( $error_code ) ) {
			// If error code is 0, it means it's a general exception, otherwise, it's a Stripe exception.
			return new WP_Error( $e->getCode(), $e->getMessage() );
		} else {
			return new WP_Error( $e->getError()->code, $e->getError()->message );
		}
	}
}