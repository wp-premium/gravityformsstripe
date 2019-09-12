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

			var GFStripeObj = this, activeFeed = null, feedActivated = false, hidePostalCode = false, apiKey = GFStripeObj.apiKey;

			gform.addAction('gform_frontend_feeds_evaluated', function (feeds, formId) {
				activeFeed = null;
				feedActivated = false;
				hidePostalCode = false;

				for (var i = 0; i < Object.keys(feeds).length; i++) {
					if (feeds[i].addonSlug === 'gravityformsstripe' && feeds[i].isActivated) {
						feedActivated = true;
						activeFeed = GFStripeObj.feeds[i];
						apiKey = activeFeed.hasOwnProperty('apiKey') ? activeFeed.apiKey : GFStripeObj.apiKey;

						switch (GFStripeObj.stripe_payment) {
							case 'elements':
								stripe = Stripe(apiKey);
								elements = stripe.elements();

								hidePostalCode = activeFeed.address_zip !== '';

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
								break;
							case 'stripe.js':
								Stripe.setPublishableKey(apiKey);
								break;
						}

						break; // allow only one active feed.
					}
				}

				if (!feedActivated) {
					if (GFStripeObj.stripe_payment === 'elements') {
						if ( elements !== null && elements._elements.indexOf('card') >= 0 ) {
							card.destroy();
						}

						if (!$(GFCCFieldId).next('.validation_message').length) {
							$(GFCCFieldId).after('<div class="gfield_description validation_message"></div>');
						}

						var cardErrors = $(GFCCFieldId).next('.validation_message');
						cardErrors.html( gforms_stripe_frontend_strings.no_active_frontend_feed );
					}

					// remove Stripe fields and form status when Stripe feed deactivated
					GFStripeObj.form = $('#gform_' + formId);
					GFStripeObj.resetStripeStatus(GFStripeObj.form, formId, GFStripeObj.isLastPage());
					apiKey = GFStripeObj.apiKey;
				}
			});

			switch (GFStripeObj.stripe_payment) {
				case 'elements':
					var stripe = null,
						elements = null,
						GFCCFieldId = '#input_' + GFStripeObj.formId + '_' + GFStripeObj.ccFieldId + '_1',
						card = null,
						skipTokenCreation = false;
					break;
			}

			// bind Stripe functionality to submit event
			$('#gform_' + this.formId).submit(function (event) {
				// feed not activated
				if (!feedActivated) {
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

						// don't create card token if clicking on the Previous button.
						var sourcePage = parseInt($('#gform_source_page_number_' + GFStripeObj.formId).val(), 10),
						    targetPage = parseInt($('#gform_target_page_number_' + GFStripeObj.formId).val(), 10);
						if (sourcePage > targetPage && targetPage !== 0) {
							skipTokenCreation = true;
						}

						if ((GFStripeObj.isLastPage() && !GFStripeObj.isCreditCardOnPage()) || gformIsHidden($(GFCCFieldId)) || skipTokenCreation) {
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
						$(this).submit();
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
				// Hide spinner.
				if ( $('#gform_ajax_spinner_' + this.formId).length > 0 ) {
					$('#gform_ajax_spinner_' + this.formId).remove();
				}
			} else {
				cardErrors.html('');
			}
		};

		this.init();

	}

})(jQuery);