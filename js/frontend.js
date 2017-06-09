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

			if (!this.isCreditCardOnPage())
				return;

			var GFStripeObj = this;
			Stripe.setPublishableKey(this.apiKey);

			// bind Stripe functionality to submit event
			$('#gform_' + this.formId).submit(function (event) {
				if ($(this).data('gfstripesubmitting') || $('#gform_save_' + GFStripeObj.formId).val() == 1 || !GFStripeObj.isLastPage()) {
					return;
				} else {
					event.preventDefault();
					$(this).data('gfstripesubmitting', true);
					GFStripeObj.maybeAddSpinner();
				}

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

			});

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

		this.init();

	}

})(jQuery);