/**
 * Front-end Script
 */

window.GFStripe = null;

(function ($) {

	GFStripe = function (args) {

		for (var prop in args) {
			if (args.hasOwnProperty(prop))
				this[prop] = args[prop];
		}

		this.form = null;

		this.init = function () {

			// Stripe Checkout doesn't required a CC field on page
			if (!this.isCreditCardOnPage() && this.stripe_payment !== 'checkout')
				return;

			var GFStripeObj = this;

			if (GFStripeObj.stripe_payment !== 'stripe.js') {
				var activatedFeedId = 0, activeFeed = null, feedActivated = false, hidePostalCode = false;
				gform.addAction('gform_frontend_feed_activated', function (feed, formId) {
					if (feed.addonSlug === 'gravityformsstripe' && feed.isActivated) {
						feedActivated = true;
						activatedFeedId = feed.feedId;
						for (var i = 0; i < Object.keys(GFStripeObj.feeds).length; i++) {
							if (GFStripeObj.feeds[i].feedId === activatedFeedId) {
								activeFeed = GFStripeObj.feeds[i];
								if (GFStripeObj.stripe_payment === 'elements') {
									hidePostalCode = activeFeed.address_zip !== '';
								}
								break;
							}
						}
					}
				});
				gform.addAction('gform_frontend_feed_deactivated', function (feed, formId) {
					if (feed.addonSlug === 'gravityformsstripe' && !feed.isActivated && (activatedFeedId === feed.feedId)) {
						feedActivated = false;
						if (GFStripeObj.stripe_payment === 'elements') {
							hidePostalCode = false;
						}
						// remove Stripe fields and form status when Stripe feed deactivated
						GFStripeObj.form = $('#gform_' + formId);
						GFStripeObj.resetStripeStatus(GFStripeObj.form, formId, GFStripeObj.isLastPage());
					}
				});
			}

			switch (GFStripeObj.stripe_payment) {
				case 'elements':
					var stripe = Stripe(this.apiKey),
						elements = stripe.elements(),
						GFCCFieldId = '#input_' + GFStripeObj.formId + '_' + GFStripeObj.ccFieldId + '_1',
						card = null;

					gform.addAction('gform_frontend_feeds_evaluated', function () {
						if ( feedActivated ) {
							// If Stripe Card is already on the page (AJAX failed validation, or switch frontend feeds),
							// Destroy the card field so we can re-initiate it.
							if ( elements._elements.indexOf('card') >= 0 ) {
								card.destroy();
							}

							// Clear card field errors before initiate it.
							if ($(GFCCFieldId).next('.validation_message').length) {
								$(GFCCFieldId).next('.validation_message').html('');
							}

							card = elements.create(
									'card',
									{
										classes: GFStripeObj.cardClasses,
										style: GFStripeObj.cardStyle,
										hidePostalCode: hidePostalCode
									}
								);

							card.mount(GFCCFieldId);

							card.on('change', function (event) {
								GFStripeObj.displayStripeCardError(event);
							});
						} else {
							if ( elements._elements.indexOf('card') >= 0 ) {
								card.destroy();
							}

							if (!$(GFCCFieldId).next('.validation_message').length) {
								$(GFCCFieldId).after('<div class="gfield_description validation_message"></div>');
							}

							var cardErrors = $(GFCCFieldId).next('.validation_message');
							cardErrors.html( gforms_stripe_frontend_strings.no_active_frontend_feed );
						}
					});
					break;
				case 'checkout':
					var form = $('#gform_' + this.formId),
						options = {
							key: this.apiKey,
							token: function (response) {
								// append Stripe checkout response
								if ($('#gf_stripe_response').length) {
									$('#gf_stripe_response').val($.toJSON(response));
								} else {
									form.append($('<input type="hidden" name="stripe_response" id="gf_stripe_response" />').val($.toJSON(response)));
								}
								form.submit();
							}
						},
						handler;

					// Set priority to 51 so it will be triggered after the coupons add-on
					gform.addFilter('gform_product_total', function (total, formId) {
						window['gform_stripe_checkout_amount_' + formId] = total;
						return total;
					}, 51);

					handler = StripeCheckout.configure(options);

					// clear Stripe response when total changed, so Stripe Checkout would be triggered again
					$(document).on('gform_price_change', function(){
						if ($('#gf_stripe_response').length) {
							$('#gf_stripe_response').val('');
						}
					});

					// on form submit button clicked
					$('#gform_submit_button_' + this.formId).on('click', function (event) {
						if (!feedActivated || form.data('gfstripesubmitting'))
							return;

						// Must not has the card type error
						if ($('#gf_stripe_response').length && $('#gf_stripe_response').val() !== '') {
							var response = $.parseJSON($('#gf_stripe_response').val());
							if (response.id) {
								form.submit();
								return;
							}
						}

						// Open Checkout with further options:
						options = {
							amount: (0 === gf_global.gf_currency_config.decimals) ? window['gform_stripe_checkout_amount_' + GFStripeObj.formId] : window['gform_stripe_checkout_amount_' + GFStripeObj.formId] * 100,
							currency: gform.applyFilters( 'gform_stripe_currency', GFStripeObj.currency, GFStripeObj.formId ),
							locale: 'auto',
							image: activeFeed.logoUrl,
							name: GFMergeTag.replaceMergeTags( GFStripeObj.formId, activeFeed.name ),
							description: GFMergeTag.replaceMergeTags( GFStripeObj.formId, activeFeed.description ),
							'zipCode': true
						};

						options.billingAddress = activeFeed.billingAddress;

						options = gform.applyFilters( 'gform_stripe_checkout_options', options, GFStripeObj.formId );

						if ( options.amount > 0 ) {
							event.preventDefault();
							options.amount = Math.round(options.amount);
							handler.open(options);
						}
					});

					// Close Checkout on page navigation:
					window.addEventListener('popstate', function () {
						handler.close();
					});
					break;
				case 'stripe.js':
					Stripe.setPublishableKey(this.apiKey);
					break;
			}

			// bind Stripe functionality to submit event
			$('#gform_' + this.formId).submit(function (event) {
				// Stripe Checkout/Elements && feed not activated
				if (GFStripeObj.stripe_payment !== 'stripe.js' && !feedActivated) {
					return;
				}
				// by checking if $(GFCCFieldId) is hidden, we can continue to the next page in a multi-page form
				if ($(this).data('gfstripesubmitting') || $('#gform_save_' + GFStripeObj.formId).val() == 1 || (!GFStripeObj.isLastPage() && 'elements' !== GFStripeObj.stripe_payment) || gformIsHidden($(GFCCFieldId))) {
					return;
				} else {
					event.preventDefault();
					$(this).data('gfstripesubmitting', true);
					GFStripeObj.maybeAddSpinner();
				}

				switch (GFStripeObj.stripe_payment) {
					case 'elements':
						GFStripeObj.form = $(this);

						if ((GFStripeObj.isLastPage() && !GFStripeObj.isCreditCardOnPage()) || gformIsHidden($(GFCCFieldId))) {
							$(this).submit();
							return;
						}

						var cardholderName = $( '#input_' + GFStripeObj.formId + '_' + GFStripeObj.ccFieldId + '_5' ).val();
						var tokenData = {
							name: cardholderName,
							address_line1: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_line1)),
							address_line2: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_line2)),
							address_city: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_city)),
							address_state: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_state)),
							address_zip: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_zip)),
							address_country: GFMergeTag.replaceMergeTags(GFStripeObj.formId, GFStripeObj.getBillingAddressMergeTag(activeFeed.address_country)),
							currency: gform.applyFilters( 'gform_stripe_currency', GFStripeObj.currency, GFStripeObj.formId )
						};
						stripe.createToken(card, tokenData).then(function (response) {
							GFStripeObj.elementsResponseHandler(response);
						});
						break;
					case 'checkout':
						if (window['gform_stripe_checkout_amount_' + GFStripeObj.formId] > 0) {
							GFStripeObj.form = $(this);
							GFStripeObj.checkoutResponseHandler();
						} else {
							$(this).submit();
						}
						break;
					case 'stripe.js':
						var form = $(this),
							ccInputPrefix = 'input_' + GFStripeObj.formId + '_' + GFStripeObj.ccFieldId + '_',
							cc = {
								number: form.find('#' + ccInputPrefix + '1').val(),
								exp_month: form.find('#' + ccInputPrefix + '2_month').val(),
								exp_year: form.find('#' + ccInputPrefix + '2_year').val(),
								cvc: form.find('#' + ccInputPrefix + '3').val(),
								name: form.find('#' + ccInputPrefix + '5').val()
							};


						GFStripeObj.form = form;

						Stripe.card.createToken(cc, function (status, response) {
							GFStripeObj.responseHandler(status, response);
						});
						break;
				}

			});

		};

		this.getBillingAddressMergeTag = function (field) {
			if (field === '') {
				return '';
			} else {
				return '{:' + field + '}';
			}
		};

		this.responseHandler = function (status, response) {

			var form = this.form,
				ccInputPrefix = 'input_' + this.formId + '_' + this.ccFieldId + '_',
				ccInputSuffixes = ['1', '2_month', '2_year', '3', '5'];

			// remove "name" attribute from credit card inputs
			for (var i = 0; i < ccInputSuffixes.length; i++) {

				var input = form.find('#' + ccInputPrefix + ccInputSuffixes[i]);

				if (ccInputSuffixes[i] == '1') {

					var ccNumber = $.trim(input.val()),
						cardType = gformFindCardType(ccNumber);

					if (typeof this.cardLabels[cardType] != 'undefined')
						cardType = this.cardLabels[cardType];

					form.append($('<input type="hidden" name="stripe_credit_card_last_four" />').val(ccNumber.slice(-4)));
					form.append($('<input type="hidden" name="stripe_credit_card_type" />').val(cardType));

				}

				// name attribute is now removed from markup in GFStripe::add_stripe_inputs()
				//input.attr( 'name', null );

			}

			// append stripe.js response
			form.append($('<input type="hidden" name="stripe_response" />').val($.toJSON(response)));

			// submit the form
			form.submit();

		};

		this.elementsResponseHandler = function (response) {

			var form = this.form;

			// append stripe.js response
			if (!$('#gf_stripe_response').length) {
				form.append($('<input type="hidden" name="stripe_response" id="gf_stripe_response" />').val($.toJSON(response)));
			} else {
				$('#gf_stripe_response').val($.toJSON(response));
			}

			if (!response.error) {
				//set last 4
				form.append($('<input type="hidden" name="stripe_credit_card_last_four" id="gf_stripe_credit_card_last_four" />').val(response.token.card.last4));

				// set card type
				form.append($('<input type="hidden" name="stripe_credit_card_type" id="stripe_credit_card_type" />').val(response.token.card.brand));

				// submit the form
				form.submit();
			} else {
				// display error below the card field.
				this.displayStripeCardError(response);
				// when Stripe response contains errors, stay on page
				// but remove some elements so the form can be submitted again
				// also remove last_4 and card type if that already exists (this happens when people navigate back to previous page and submit an empty CC field)
				this.resetStripeStatus(form, this.formId, this.isLastPage());
			}

		};

		this.checkoutResponseHandler = function () {

			var form = this.form;

			var response = $.parseJSON($('#gf_stripe_response').val());

			if (!response.error && response !== '') {
				//set last 4
				form.append($('<input type="hidden" name="stripe_credit_card_last_four" id="gf_stripe_credit_card_last_four" />').val(response.card.last4));

				// set card type
				form.append($('<input type="hidden" name="stripe_credit_card_type" id="stripe_credit_card_type" />').val(response.card.brand));

				// submit the form
				form.submit();
			} else {
				// remove Stripe fields and form status when Stripe feed deactivated
				this.resetStripeStatus(form, this.formId, this.isLastPage());
			}

		};

		this.isLastPage = function () {

			var targetPageInput = $('#gform_target_page_number_' + this.formId);
			if (targetPageInput.length > 0)
				return targetPageInput.val() == 0;

			return true;
		};

		this.isCreditCardOnPage = function () {

			var currentPage = this.getCurrentPageNumber();

			// if current page is false or no credit card page number, assume this is not a multi-page form
			if (!this.ccPage || !currentPage)
				return true;

			return this.ccPage == currentPage;
		};

		this.getCurrentPageNumber = function () {
			var currentPageInput = $('#gform_source_page_number_' + this.formId);
			return currentPageInput.length > 0 ? currentPageInput.val() : false;
		};

		this.maybeAddSpinner = function () {
			if (this.isAjax)
				return;

			if (typeof gformAddSpinner === 'function') {
				gformAddSpinner(this.formId);
			} else {
				// Can be removed after min Gravity Forms version passes 2.1.3.2.
				var formId = this.formId;

				if (jQuery('#gform_ajax_spinner_' + formId).length == 0) {
					var spinnerUrl = gform.applyFilters('gform_spinner_url', gf_global.spinnerUrl, formId),
						$spinnerTarget = gform.applyFilters('gform_spinner_target_elem', jQuery('#gform_submit_button_' + formId + ', #gform_wrapper_' + formId + ' .gform_next_button, #gform_send_resume_link_button_' + formId), formId);
					$spinnerTarget.after('<img id="gform_ajax_spinner_' + formId + '"  class="gform_ajax_spinner" src="' + spinnerUrl + '" alt="" />');
				}
			}

		};

		this.resetStripeStatus = function(form, formId, isLastPage) {
			$('#gf_stripe_response, #gf_stripe_credit_card_last_four, #stripe_credit_card_type').remove();
			form.data('gfstripesubmitting', false);
            $('#gform_ajax_spinner_' + formId).remove();

			// must do this or the form cannot be submitted again
			if (isLastPage) {
				window["gf_submitting_" + formId] = false;
			}
		};

		this.displayStripeCardError = function (event) {
			var GFCCFieldId = '#input_' + this.formId + '_' + this.ccFieldId + '_1';

			if (!$(GFCCFieldId).next('.validation_message').length) {
				$(GFCCFieldId).after('<div class="gfield_description validation_message"></div>');
			}

			var cardErrors = $(GFCCFieldId).next('.validation_message');

			if (event.error) {
				cardErrors.html(event.error.message);
			} else {
				cardErrors.html('');
			}
		};

		this.init();

	}

})(jQuery);