/**
 * @implements DataInterface
 */
import Logger from './Logger';
import ImageUpload from './ImageUpload';
import PreviewController from './PreviewController';
import FakeAddToCartButton from './view/FakeAddToCartButton';
import UiHelper from './helper/UiHelper';
import MetaDataHelper from './helper/MetaDataHelper';

import $ from './jQueryLoader';
import ImageSelector from './ImageSelector';
import ImageEditorController from './ImageEditorController';
import ImageTabController from './ImageTabController';
import Feature from './Feature';
import Resizing from './fancybox/Resizing';
import SelectImage from './fancybox/SelectImage';
import Dataset from './dataset/Dataset';
import InPreviewEditController from './InPreviewEditController';
import ShapeRepository from './model/ShapeRepository';
import Lightbox from './view/Lightbox';
import LightboxConfiguration from './model/LightboxConfiguration';
import Assert from './helper/Assert';
import ZoomHelper from './helper/ZoomHelper';
import DataHelper from './helper/DataHelper';
import NotificationCenter from './NotificationCenter';
import GlobalEvents from './GlobalEvents';
import ImageSelectionController from './ImageSelectionController';
import TextFieldEditorHelper from './helper/TextFieldEditorHelper';
import TextFieldController from './TextFieldController';
import Environment from './Environment';
import ImageManipulationService from './service/ImageManipulationService';
import RotateLeftButton from './view/RotateLeftButton';
import RotateRightButton from './view/RotateRightButton';

/**
 * @implements DataInterface
 */
export default class PersonalizationForm {
    /**
     * @param {DataInterface} data
     */
    constructor(data) {
        if (arguments.length !== 1) {
            throw new TypeError('Invalid number of arguments, expected 1 got ' + arguments.length);
        }

        PersonalizationForm.shared_instance = this;
        Logger.info('[Web2Print] App version ' + PersonalizationForm.version);

        /** @type {DataInterface} */
        const zp = this.data = data;
        const personalization_form_instance = this;

        this._enlarge_editor_click_handler = this._enlarge_editor_click_handler.bind(this);
        // this.image_field_select_handler = this.image_field_select_handler.bind(this);
        this.add_image_to_gallery = this.add_image_to_gallery.bind(this);
        zp.scroll_strip = this.scroll_strip = this.scroll_strip.bind(this);

        const $add_to_cart_button = this._get_add_to_cart_button();
        const fake_add_to_cart_button = new FakeAddToCartButton($add_to_cart_button);
        this.shape_repository = new ShapeRepository(this);
        /** @type {PreviewController} */
        const preview_controller = this.preview_controller = new PreviewController(this, fake_add_to_cart_button);
        this.image_editor = new ImageEditorController(this);
        this.in_preview_edit_controller = new InPreviewEditController(this);
        this.image_selection_controller = new ImageSelectionController(this);
        this._select_image = new SelectImage(preview_controller);
        this.image_manipulation_service = new ImageManipulationService();

        this._preview_overlay = null;

        const template_details = data.template_details;

        //Set current template page to the first (1-based index)
        zp.current_page = 1;
        const ui_helper = UiHelper.instance();
        const $product_image_box = ui_helper.product_image_box;
        $product_image_box.css('position', 'relative');

        const product_image_gallery = ui_helper.product_image_gallery;
        this._set_has_image_zoomer(this._detect_initial_has_image_zoomer(product_image_gallery));

        ui_helper.product_form.modified = DataHelper.has_changed_fields_on_page(zp.current_page);

        this._register_click_form_button();
        this._register_click_enlarge_editor();

        //If personalization step (for 2-step theme) and base image is set...
        if (zp.is_personalization_step && this.has_image_zoomer) {
            //... then remove zoomer functionality
            this.disable_image_zoomer();
        }

        //If base image is not set...
        if (!this.has_image_zoomer) {
            //then remove all original images placed by M., zoomer and base image
            $(product_image_gallery).empty();

            //Add preview image placeholder
            preview_controller.add_preview_placeholder();
        }

        this._add_hidden_form_fields(template_details);

        //If update_first_preview_on_load parameter was set
        if (zp.update_first_preview_on_load) {
            //Update preview for the first page
            preview_controller.update_preview(this.data, [], zp.preserve_fields);
        }
        // Create array for preview images sharing links
        if (window.place_preview_image_sharing_link) {
            zp.preview_sharing_links = new Array(zp.template_details.pages_number + 1);
        }

        this.preview_controller.add_previews(data);

        let pages = data.template_details.pages;
        this._prepareImageFields(pages);

        if ($.fn.combobox) {
            this._prepareComboBox(pages);
        }

        ui_helper.show('#page-size-page-1');

        zp.is_fields_hidden = true;

        if (!this.has_shapes || !window.place_all_shapes_for_page) {
            ui_helper.show('#stock-images-page-1, #input-fields-page-1');
        }
        if (!this.has_shapes || !Feature.instance().is_activated(Feature.feature.inPreviewEdit)) {
            ui_helper.show('#stock-images-page-1, #input-fields-page-1');
            zp.is_fields_hidden = false;
            ui_helper.hide(ui_helper.editor_button);
            ui_helper.hide(ui_helper.form_button);
            ui_helper.show(ui_helper.enlarge_button);
        }

        $('div.zetaprints-image-tabs, div.zetaprints-preview-button').css('display', 'block');

        $('div.zetaprints-image-tabs li:first').addClass('selected');

        $('div.tab.user-images').each(function () {
            let $this = $(this);

            //It's not empty when it has more than 1 child
            //because first child is template element
            if ($this.find('td').length > 1) {
                $this
                    .parents('.selector-content')
                    .find('> .tab-buttons > .hidden')
                    .removeClass('hidden');
            }
        });

        // this._add_hidden_form_fields(template_details);

        $add_to_cart_button.parent().before(
            '<div id="zp-warning-user-data-changed" class="zetaprints-notice">' +
            window.warning_user_data_changed +
            '</div>'
        );

        if (DataHelper.is_all_pages_updated(template_details)
            || (personalization_form_instance._has_updated_pages(template_details)
                && template_details.missed_pages === '')
            || template_details.missed_pages === 'include') {
            ui_helper.hide('div.zetaprints-notice.to-update-preview');
        } else {
            fake_add_to_cart_button.add(typeof template_details.pages['2'] !== 'undefined');
        }
        //Add resizer for text inputs and text areas for the first page
        if ($.fn.text_field_resizer) {
            $('#input-fields-page-1').find('.zetaprints-text-field-wrapper').text_field_resizer();
        }

        //Set preview images sharing link for the first page
        if (window.place_preview_image_sharing_link) {
            this.set_preview_sharing_link_for_page(1, zp.preview_sharing_links);
        }

        const image_tab_controller = new ImageTabController(this);
        image_tab_controller.register_click();

        Feature.instance().call(Feature.feature.dataset, Dataset.zp_dataset_initialise, zp);

        this._patch_product_add_to_cart();

        this._add_dynamic_methods_to_data();
        this._init_image_upload_buttons();

        this._register_window_load();
        this._register_click_next_page();
        this._register_in_dialog_lightbox();
        this._register_click_edit_thumbnail();
        this._prepare_text_field_editor();
        this._prepareQtip();
        this._register_input_field_events();
        this._register_delete_button_click();
        this._register_image_click();
        this._register_palette_change();
        this._register_notification_listeners();
        this._add_rotate_buttons();

        if (zp.has_shapes) {
            Feature.instance().call(
                Feature.feature.inPreviewEdit,
                this.in_preview_edit_controller.add_in_preview_edit_handlers
            );
        }
    }

    /**
     * @private
     */
    _register_click_enlarge_editor() {
        const ui_helper = UiHelper.instance();
        ui_helper.editor_button.on('click', this._enlarge_editor_click_handler);
        ui_helper.enlarge_button.on('click', this._enlarge_editor_click_handler);
    }

    /**
     * @private
     */
    _register_click_form_button() {
        const data = this.data;
        return UiHelper.instance().form_button.on('click', function () {
            const $fields = $('#input-fields-page-' + data.current_page + ', #stock-images-page-' + data.current_page);
            const ui_helper = UiHelper.instance();

            data.is_fields_hidden = !ui_helper.has_hide_class($fields);
            if (data.is_fields_hidden) {
                $fields.animate({opacity: 0}, 500, function () {
                    ui_helper.hide($fields);
                    // $fields.addClass('zp-hidden');
                    $fields.css('opacity', 1);
                });
            } else {
                $fields.css('opacity', 0);
                ui_helper.show($fields);
                // $fields.removeClass('zp-hidden');
                $fields.animate({opacity: 1}, 500);
            }
        });
    }

    /**
     * @return {SelectImage}
     */
    get select_image() {
        return this._select_image;
    }

    /**
     * @return {TemplateDetail}
     */
    get template_details() {
        return this.data.template_details;
    }

    /**
     * @return {number}
     */
    get current_page() {
        return this.data.current_page;
    }

    /**
     * @return {boolean}
     */
    get is_fields_hidden() {
        return this.data.is_fields_hidden;
    }

    /**
     * @return {Array}
     */
    get preview_sharing_links() {
        return this.data.preview_sharing_links;
    }

    /**
     * @return {boolean}
     */
    get is_personalization_step() {
        return this.data.is_personalization_step;
    }

    /**
     * @return {boolean}
     */
    get update_first_preview_on_load() {
        return this.data.update_first_preview_on_load;
    }

    /**
     * @return {boolean}
     */
    get preserve_fields() {
        return this.data.preserve_fields;
    }

    /**
     * @return {boolean}
     */
    get has_shapes() {
        return this.data.has_shapes;
    }

    /**
     * @return {string}
     */
    get w2p_url() {
        return this.data.w2p_url;
    }

    /**
     * @return {Array}
     */
    get options() {
        return this.data.options;
    }

    /**
     * @return {object}
     */
    get url() {
        return this.data.url;
    }

    /**
     * @return {*}
     */
    get image_edit() {
        return this.data.image_edit;
    }

    /**
     * @return {boolean}
     */
    get has_image_zoomer() {
        return !!this._has_image_zoomer;
    }

    /**
     * @param {string} guid
     * @param {string} url
     * @param {function} [on_image_load]
     */
    add_image_to_gallery(guid, url, on_image_load) {
        const _this = this;
        const data = this.data;
        const trs = $('.tabs-wrapper > .user-images > table > tbody > tr');

        const thumbnail_edit_click_handler = this._get_edit_thumbnail_click_handler();

        const delete_image_click_handle = function (event) {
            event.stopPropagation();
            event.preventDefault();

            if (confirm(delete_this_image_text)) {
                const image_id = $(this).parents('td').children('input').val();
                _this._delete_image(data, image_id);
            }

            return false;
        };

        trs.each(function () {
            const $tr = $(this);
            const $template = $tr.children('.zp-html-template');

            const $td = $template
                .clone()
                .removeClass('zp-html-template')
                .insertAfter($template);

            const fields = $td.children('.zetaprints-field');
            fields.val(guid);
            _this.image_selection_controller.register_fields(fields);

            fields.each(function () {
                const rotate_left_button = new RotateLeftButton(_this, this);
                const rotate_right_button = new RotateRightButton(_this, this);

                // Buttons are floated right. So insert in reverse order
                rotate_right_button.add();
                rotate_left_button.add();
            });

            $td
                .children('.image-edit-thumb')
                .on('click', thumbnail_edit_click_handler);

            const $thumb = $td.children('.image-edit-thumb');

            $thumb
                .find('> .buttons-row > .zp-delete-button')
                .on('click', delete_image_click_handle);

            const $img = $thumb
                .children('img')
                .attr('alt', guid)
                .attr('src', url);

            if (on_image_load) {
                $img.on('load', on_image_load);
            }
        });
    }

    /**
     * @param {number} page_number
     * @param {object} links
     */
    set_preview_sharing_link_for_page(page_number, links) {
        if (links[page_number]) {
            $('span.zetaprints-share-link').removeClass('empty');
            $('#zetaprints-share-link-input').val(links[page_number]);
        } else {
            $('span.zetaprints-share-link').addClass('empty');
            $('#zetaprints-share-link-input').val('');
        }
    }

    /**
     * @param {number} page_number
     * @param {DataInterface} data
     * @return {boolean}
     */
    can_show_next_page_button_for_page(page_number, data) {
        const page = data.template_details.pages[page_number];

        return !!(page_number < data.template_details.pages_number && page['updated-preview-image']);
    }

    /**
     * @param {HTMLElement} panel
     * @return {boolean}
     */
    scroll_strip(panel) {
        if ($(panel).hasClass('images-scroller')) {
            $(panel).scrollLeft(0);
            let position = $('input:checked', panel).parents('td').position();
            if (position) {
                $(panel).scrollLeft(position.left);
            }
        }
        return true;
    }

    /**
     * @param {string} url
     * @api
     */
    upload_image_by_url(url) {
        const zp = this.data;
        const options = {
            type: 'POST',
            dataType: 'json',
            data: {'url': url},
            error: function (request, status, error) {
                alert(status + ' ' + error);
            },
            /**
             * @param {UploadResult} data
             */
            success: (data) => {
                this.add_image_to_gallery(data.guid, data.thumbnail_url);
                this.image_editor.reload_image(data.guid);
            }
        };

        $.ajax(zp.url.upload_by_url, options);
    }

    /**
     * Disable the image zoomer if one exists
     *
     * If there's image zoomer on the page remove it and base image
     *
     * @returns {boolean} Returns if a image zoomer has been disabled
     */
    disable_image_zoomer() {
        if (!this.has_image_zoomer) {
            return false;
        }
        ZoomHelper.disable_zoom();
        this._set_has_image_zoomer(false);

        return true;
    }

    /**
     * @inheritDoc
     */
    show_colorpicker($panel) {
        Assert.assertjQuery($panel);
        if (!($panel.hasClass('color-picker') || $panel.hasClass('colour-picker'))) {
            return;
        }

        const $input = $panel.find('input');

        if (!$input.prop('checked')) {
            $input.colorpicker('open');
        }
    }

    /**
     * @inheritDoc
     */
    hide_colorpicker($panel) {
        Assert.assertjQuery($panel);
        if ($panel.hasClass('color-picker') || $panel.hasClass('colour-picker')) {
            $panel
                .find('input')
                .colorpicker('close', true);
        }
    }

    /**
     * @inheritDoc
     */
    show_user_images($panel) {
        Assert.assertjQuery($panel);
        if ($panel.find('input.zetaprints-images').length > 0) {
            $panel.tabs('option', 'active', 1);
        }
    }

    /**
     * @param {string} name
     * @param {*} value
     */
    input_field_did_change(name, value) {
        const data = this.data;

        if (data.has_shapes && Feature.instance().is_activated(Feature.feature.inPreviewEdit)) {
            const page = data.template_details.pages[data.current_page];

            if (data.has_shapes && Feature.instance().is_activated(Feature.feature.inPreviewEdit)) {
                const shape = this.in_preview_edit_controller.get_shape_by_name(name, page.shapes);

                if (shape) {
                    this._shape_update_state(shape, !!value);
                }
            }
        }

        Feature.instance().call(Feature.feature.dataset, Dataset.zp_dataset_update_state, data, name, false);
    }

    update_preview() {
        this.preview_controller.update_preview(this.data);
    }

    /**
     * @param {boolean} value
     * @private
     */
    _set_has_image_zoomer(value) {
        this._has_image_zoomer = value;
    }

    /**
     * @private
     */
    _add_dynamic_methods_to_data() {
        const _this = this;

        /**
         * @param {MouseEvent} event
         * @param {undefined|*[]} update_pages
         * @param {boolean} preserve_fields
         * @return {boolean}
         */
        const update_preview = function (event, update_pages, preserve_fields) {
            _this.preview_controller.update_preview(_this.data, update_pages, preserve_fields);
            event.preventDefault();

            return false;
        };

        this.data.update_preview = function () {
            Logger.warn('Called update_preview on ZetaPrints data');
            /** @type {function} _update_preview */
            update_preview.apply(this, arguments);
        };

        this.data.show_user_images = ($panel) => {
            Logger.warn('Called show_user_images on ZetaPrints data');
            return this.show_user_images($panel);
        };

        this.data.show_colorpicker = ($panel) => {
            Logger.warn('Called show_colorpicker on ZetaPrints data');

            return this.show_colorpicker($panel);
        };

        this.data.hide_colorpicker = ($panel) => {
            Logger.warn('Called hide_colorpicker on ZetaPrints data');

            return this.hide_colorpicker($panel);
        };
    }

    /**
     * @private
     */
    _init_image_upload_buttons() {
        const personalization_form_instance = this;
        $('div.button.choose-file').each(function () {
            new ImageUpload(this, personalization_form_instance);
        });
    }

    /**
     * @private
     */
    _register_window_load() {
        const personalization_form_instance = this;
        const zp = this.data;
        $(window).on('load', function () {
            if (zp.has_shapes /*&& window.place_all_shapes_for_page && shape_handler*/) {
                Feature.instance().call(
                    Feature.feature.inPreviewEdit,
                    InPreviewEditController.precalculate_shapes,
                    zp.template_details
                );

                //Add all shapes only then there's no base image.
                //Shapes will be added after first preview update then base image exists
                //if (!has_image_zoomer)
                //  place_all_shapes_for_page(zp.template_details.pages[zp.current_page].shapes,
                //                            $product_image_box,
                //                            shape_handler);
            }

            UiHelper.instance().select_image_elements.each(function () {
                new ImageSelector(personalization_form_instance, this);
            });
        });
    }

    /**
     * @private
     */
    _register_click_next_page() {
        UiHelper.instance().next_page_button.on('click', () => {
            const next_page_number = this.current_page + 1;

            $('div.zetaprints-image-tabs li img[rel="page-' + next_page_number + '"]')
                .parent()
                .click();

            return false;
        });
    }

    /**
     * @private
     */
    _register_click_edit_thumbnail() {
        $('.image-edit-thumb').on('click', this._get_edit_thumbnail_click_handler());
    }

    /**
     * Returns the handler callback when a thumbnail's edit button is clicked
     *
     * A stub callback is returned if image editing is not enabled (e.g. because the screen is too small)
     *
     * @return {function}
     * @private
     */
    _get_edit_thumbnail_click_handler() {
        const image_editor = this.image_editor;

        return function (event) {
            event.preventDefault();

            if (!Environment.environment().is_image_editing_enabled()) {
                Logger.log('[PersonalizationForm] Image editing is disabled');

                return false;
            }

            const $target = $(this);
            const $input = $target.parent().children('input');

            const image_name = UiHelper.get_name_for_element($input);
            const image_guid = $input.val();
            const $thumb = $target.children('img');

            image_editor.show(decodeURI(image_name), image_guid, $thumb);

            return false;
        };
    }

    /**
     * @private
     */
    _register_input_field_events() {
        new TextFieldController(this, UiHelper.instance().input_fields);
    }

    /**
     * @private
     */
    _register_delete_button_click() {
        const personalization_form_instance = this;
        const zp = this.data;
        $('.zp-delete-button').on('click', function (event) {
            event.stopPropagation();
            event.preventDefault();

            if (confirm(delete_this_image_text)) {
                const image_id = $(this).parents('td').children('input').val();
                personalization_form_instance._delete_image(zp, image_id);
            }

            return false;
        });
    }

    /**
     * @private
     */
    _add_rotate_buttons() {
        const personalization_form_instance = this;

        UiHelper.instance().select_image_elements_inputs.each(function () {
            const rotate_left_button = new RotateLeftButton(personalization_form_instance, this);
            const rotate_right_button = new RotateRightButton(personalization_form_instance, this);

            // Buttons are floated right. So insert in reverse order
            rotate_right_button.add();
            rotate_left_button.add();
        });
    }

    /**
     * @private
     */
    _register_image_click() {
        const personalization_form_instance = this;
        UiHelper.instance().select_image_elements_inputs.on('click', function (event) {
            const $input = $(this);
            const page = personalization_form_instance.template_details.pages[personalization_form_instance.current_page];
            const field = page.images[UiHelper.get_name_for_element($input)];

            const metadata = $input.data('metadata');
            if (metadata) {
                metadata['img-id'] = $input.val();
                MetaDataHelper.replace_metadata(field, metadata, false);
            } else {
                MetaDataHelper.clear_metadata(field, false);
            }
        });
    }

    /**
     * @private
     */
    _register_palette_change() {
        const personalization_form_instance = this;
        const zp = this.data;

        $('.zetaprints-palettes .zetaprints-field').on('change', function () {
            const $this = $(this);

            const id = $this
                .attr('name')
                .substring(12);

            const colour = $this.val();
            const pages = zp.template_details.pages;

            personalization_form_instance._map_pages(pages, (page) => {
                const fields = pages[page].fields;
                for (const field_name in fields) {
                    if (fields.hasOwnProperty(field_name)) {
                        const field = pages[page].fields[field_name];

                        if ('' + field.palette === '' + id) {
                            MetaDataHelper.replace_metadata(field, {'col-f': colour});
                        }
                    }
                }

                const images = pages[page].images;
                for (const image_name in images) {
                    if (images.hasOwnProperty(image_name)) {
                        const image = pages[page].images[image_name];

                        if ('' + image.palette === '' + id) {
                            MetaDataHelper.replace_metadata(image, {'col-f': colour});
                        }
                    }
                }
            });
        });
    }

    /**
     * @private
     */
    _register_in_dialog_lightbox() {
        if (0 === $('a.in-dialog').length) {
            return;
        }

        Logger.debug('[Form] Register fancyBox on a.in-dialog');
        const personalization_form_instance = this;
        const data = personalization_form_instance.data;

        const lightbox_configuration = new LightboxConfiguration({
            'type': 'image',
            'opacity': true,
            'showOverlay': false,
            'transitionIn': 'elastic',
            'changeSpeed': 200,
            'speedIn': 500,
            'speedOut': 500,
            'showTitle': false,
        });
        lightbox_configuration.willShow = () => {
            let is_in_preview = false;

            if (UiHelper.instance().update_preview_button.length) {
                Feature.instance().call(
                    Feature.feature.fancybox.updatePreview,
                    () => {
                        this.preview_controller._update_preview_button.remove();
                    }
                );
                is_in_preview = true;
            }

            if (UiHelper.instance().fancybox_resize.length) {
                Feature.instance().call(Feature.feature.fancybox.resizing, Resizing.fancybox_resizing_hide);
            }

            Feature.instance().call(Feature.feature.fancybox.selectImage, () => {
                this._select_image.add(data, is_in_preview);
            });
        };

        Feature.instance().call(Feature.feature.fancybox.selectImage, () => {
            lightbox_configuration.didShow = () => {
                this._select_image.update();
            };
            lightbox_configuration.didClose = () => {
                this._select_image.remove();
            };
        });

        const lightbox = new Lightbox();
        lightbox.register('a.in-dialog', lightbox_configuration);
    }

    /**
     * @param {DataInterface} zp
     * @param image_id
     * @private
     */
    _delete_image(zp, image_id) {
        $.ajax({
            url: zp.url.image,
            type: 'POST',
            data: 'zetaprints-action=img-delete&zetaprints-ImageID=' + image_id,
            error: function (request, status) {
                alert(cant_delete_text + ': ' + status);
            },
            success: function () {
                $('input[value="' + image_id + '"]').parent().remove();
            }
        });
    }

    /**
     * @private
     */
    _patch_product_add_to_cart() {
        if (typeof window.productAddToCartForm === 'object' && typeof window.productAddToCartForm.submit === 'function') {
            const original_function = window.productAddToCartForm.submit;

            window.productAddToCartForm.submit = (button, url) => {
                const text = window.notice_update_preview_after_data_changed,
                    pages = this.data.template_details.pages,
                    changed_pages = this._page_get_changed(pages);

                if (changed_pages.length > 0 && confirm(text)) {
                    this.preview_controller.update_preview(this.data, changed_pages, false);
                    return false;
                }

                original_function(button, url);
            };
        } else {
            Logger.warn('Could not patch productAddToCartForm.submit() method');
        }
    }

    /**
     * @param {Page[],object} pages
     * @param {function} callback
     * @private
     */
    _map_pages(pages, callback) {
        if (typeof callback !== 'function') {
            throw new TypeError('Argument "callback" must be a function');
        }
        for (let pageIdentifier in pages) {
            if (pages.hasOwnProperty(pageIdentifier)) {
                callback(pageIdentifier);
            }
        }
    }

    /**
     * @param {HTMLElement} product_image_element
     * @return {boolean}
     * @private
     */
    _detect_initial_has_image_zoomer(product_image_element) {
        return !!($(product_image_element).hasClass('product-image-zoom') || $(product_image_element).parent().hasClass(
            'product-image-zoom'));
    }

    /**
     * @private
     */
    _prepare_text_field_editor() {
        if (!Feature.instance().is_activated(Feature.feature.textFieldEditor)) {
            return;
        }

        const zp = this.data;
        $(UiHelper.instance().input_fields_selector + ' .zetaprints-field')
            .filter(':input:not([type="hidden"])')
            .each(function () {
                    const $text_field = $(this);
                    const page = $text_field.parents(UiHelper.instance().input_fields_selector)
                        .attr('id')
                        .substring(18);

                    const field = zp.template_details.pages[page]
                        .fields[UiHelper.get_name_for_element($text_field)];

                    const cached_value = MetaDataHelper.get_metadata(field, 'col-f', '');

                    //Remove metadata values, so they won't be used in update preview requests
                    //by default
                    MetaDataHelper.set_metadata(field, 'col-f', undefined);

                    if (field['colour-picker'] !== 'RGB') {
                        return;
                    }

                    const $button_container = $text_field.parents('dl').children('dt');

                    TextFieldEditorHelper.init($text_field, {
                        button_parent: $button_container,
                        colour: cached_value,

                        change: function (data) {
                            const metadata = {
                                'col-f': data.color
                            };

                            MetaDataHelper.replace_metadata(field, metadata);
                        }
                    });
                }
            );
    }

    /**
     * @private
     */
    _prepareQtip() {
        if ($.fn.qtip) {
            const input_fields_selector = UiHelper.instance().input_fields_selector;
            $([
                input_fields_selector + ' input[title]',
                input_fields_selector + ' textarea[title]',
            ].join(', ')).qtip({
                position: {corner: {target: 'bottomLeft'}},
                show: {delay: 1, solo: true, when: {event: 'focus'}},
                hide: {when: {event: 'unfocus'}}
            });

            $('div.zetaprints-page-stock-images select[title]').qtip({
                position: {corner: {target: 'topLeft'}, adjust: {y: -30}},
                show: {delay: 1, solo: true, when: {event: 'focus'}},
                hide: {when: {event: 'unfocus'}}
            });
        }
    }

    /**
     * Adds the hidden form fields
     *
     * @param {TemplateDetail} template_details
     * @private
     */
    _add_hidden_form_fields(template_details) {
        /**
         * @type {ProductForm}
         */
        const product_form = UiHelper.instance().product_form;

        const value = DataHelper.export_previews_to_string(template_details);
        product_form.append($('<input type="hidden" name="zetaprints-previews" value="' + value + '" />'));

        const guid = template_details.guid;
        product_form.append($('<input type="hidden" name="zetaprints-TemplateID" value="' + guid + '" />'));
    }

    /**
     * Iterate over all image fields in template details and if image field has a value then mark it as EDITED
     *
     * @param {Object.<string, Page>} pages
     * @private
     */
    _prepareImageFields(pages) {
        //Iterate over all image fields in template details...
        for (let page in pages) {
            if (!pages.hasOwnProperty(page)) {
                continue;
            }
            let images = pages[page].images;
            for (let name in images) {
                //... and if image field has a value then...
                if (images.hasOwnProperty(name) && images[name].value) {
                    //... mark it as EDITED
                    $('#stock-images-page-' + page)
                        .children('[title="' + name + '"]')
                        .removeClass('no-value');
                }
            }
        }
    }

    /**
     * @param pages
     * @private
     */
    _prepareComboBox(pages) {
        //Get all dropdown text fields
        let $selects = UiHelper.instance().input_fields.find('select.zetaprints-field');

        //Iterate over all text fields in template details...
        for (let page in pages) {
            if (pages.hasOwnProperty(page)) {
                let fields = pages[page].fields;
                for (let name in fields) {
                    //... and if text field has combobox flag then...
                    if (fields.hasOwnProperty(name) && fields[name].combobox) {
                        //convert relevant DOM element into a combobox
                        $selects
                            .filter('[name="zetaprints-_' + name + '"]')
                            .wrap('<div class="zetaprints-text-field-wrapper" />')
                            .combobox();
                    }
                }
            }
        }
    }

    /**
     * @private
     */
    _enlarge_editor_click_handler() {
        const current_page = this.data.current_page;

        if (UiHelper.instance().fancybox_wrap.is(':visible')) {
            $.fancybox.close();
        } else {
            Logger.debug(this.preview_controller.get_preview_for_page_number(current_page));
            this.preview_controller.get_preview_for_page_number(current_page).open_lightbox();

            const preview_image_page = document.getElementById('preview-image-page-' + current_page);
            if (preview_image_page) {
                Logger.debug(`[Form] Trigger click on Preview Image Page for current page ${current_page}`);
                $(preview_image_page).click();
            } else {
                Logger.warn(`[Form] Preview Image Page for current page ${current_page} not found`);
            }
        }
    }

    /**
     * @param {TemplateDetail} details
     * @return {boolean}
     * @private
     */
    _has_updated_pages(details) {
        let page_number;
        const pages = details.pages;
        for (page_number in pages) {
            if (pages.hasOwnProperty(page_number) && details.pages[page_number]['updated-preview-image']) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param pages
     * @return {Array}
     * @private
     */
    _page_get_changed(pages) {
        const changed_pages = [];
        for (let n in pages) {
            if (pages.hasOwnProperty(n) && DataHelper.is_user_data_changed(pages[n])) {
                changed_pages[changed_pages.length] = n;
            }
        }

        return changed_pages;
    }

    /**
     * @param {number} page_number
     * @return {object[]}
     */
    _prepare_metadata_from_page_number(page_number) {
        /**
         * @type {Page}
         */
        const page = this.data.template_details.pages[page_number];

        return MetaDataHelper.get_prepared_metadata_from_page(page, page_number);
    }

    /**
     * Magento 1.9 and greater adds its own ID (but not in RWD theme) Zetaprint's ID is left for compatibility with old
     * installations and RWD-based themes
     *
     * @return {*|jQuery|HTMLElement}
     * @private
     */
    _get_add_to_cart_button() {
        return $('#product-addtocart-button, #zetaprints-add-to-cart-button');
    }

    /**
     * @param {string} image_name
     * @param {string} image_guid
     * @param {jQuery|HTMLElement} $thumb
     * @private
     */
    _show_image_edit_dialog(image_name, image_guid, $thumb) {
        this.image_editor.show(decodeURI(image_name), image_guid, $thumb);
    }

    /**
     * @param {Shape} shape
     * @param state
     * @return {*}
     * @private
     */
    _shape_update_state(shape, state) {
        if (state) {
            return this.in_preview_edit_controller.mark_shape_as_edited(shape);
        }
        const names = shape.name.split('; ');

        if (names.length === 1) {
            return this.in_preview_edit_controller.unmark_shape_as_edited(shape);
        }

        const $fields = $('#input-fields-page-' + zp.current_page)
            .find('input, textarea, select')
            .filter('textarea, select, :text, :checked');

        const $images = $('#stock-images-page-' + zp.current_page)
            .find('input')
            .filter(':checked');

        for (let i = 0; i < names.length; i++) {
            const name = names[i];

            if ($fields.filter('[name="zetaprints-_' + name + '"]').val()
                || $images.filter('[name="zetaprints-#' + name + '"]').length) {
                return;
            }
        }

        this.in_preview_edit_controller.unmark_shape_as_edited(shape);
    }

    /**
     * @private
     */
    _register_notification_listeners() {
        NotificationCenter.instance()
            .register(GlobalEvents.USER_DATA_CHANGED, () => {
                this.preview_controller.update_preview(this.data);
            })
            .register(GlobalEvents.USER_DATA_SAVED, () => {
                this.preview_controller.update_preview(this.data);
            });
    }
}

/**
 * @type {PersonalizationForm}
 */
PersonalizationForm.shared_instance = null;

/**
 * @type {string}
 */
PersonalizationForm.version = '1.1.0';
