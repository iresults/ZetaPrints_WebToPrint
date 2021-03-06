export default class Assert {
    /**
     * Asserts that given value is of the given type
     *
     * @param {*} value
     * @param {string} type
     * @param {string} argumentName
     */
    static assertType(value, type, argumentName = '') {
        if (typeof value !== '' + type) {
            if (argumentName) {
                throw new TypeError(`Expected argument ${argumentName} to be of type "${type}", "${typeof value}" given`);
            }
            throw new TypeError(`Expected value to be of type "${type}", "${typeof value}" given`);
        }
    }

    /**
     * Asserts that the given value is of type function
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertFunction(value, argumentName = '') {
        Assert.assertType(value, 'function', argumentName);
    }

    /**
     * Asserts that the given value is of type object
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertObject(value, argumentName = '') {
        Assert.assertType(value, 'object', argumentName);
    }

    /**
     * Asserts that the given value is a jQuery object
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertjQuery(value, argumentName = '') {
        const actual_type = typeof value;

        if (actual_type !== 'object' || typeof value.jquery === 'undefined') {
            if (argumentName) {
                throw new TypeError(`Expected argument ${argumentName} to be a jQuery object, "${actual_type}" given`);
            }
            throw new TypeError(`Expected value to be a jQuery object, "${actual_type}" given`);
        }
    }

    /**
     * Asserts that the given value is a jQuery object or DOM element
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertjQueryOrDomElement(value, argumentName = '') {
        const actual_type = typeof value;
        if (actual_type === 'object' && (typeof value.jquery !== 'undefined' || value.tagName)) {
            return;
        }

        if (argumentName) {
            throw new TypeError(`Expected argument ${argumentName} to be a jQuery object or DOM element, "${actual_type}" given`);
        }
        throw new TypeError(`Expected value to be a jQuery object or DOM element, "${actual_type}" given`);
    }

    /**
     * Asserts that the given value is of type string
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertString(value, argumentName = '') {
        Assert.assertType(value, 'string', argumentName);
    }

    /**
     * Asserts that the given value is of type number
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertNumber(value, argumentName = '') {
        Assert.assertType(value, 'number', argumentName);
    }

    /**
     * Asserts that the given value is of type number or can successfully be transformed into one
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertNumeric(value, argumentName = '') {
        if (isNaN(parseFloat(value))) {
            if (argumentName) {
                throw new TypeError(`Argument ${argumentName} can not be converted into number, "${value}" given`);
            }
            throw new TypeError(`Value can not be converted into number, "${value}" given`);
        }
    }

    /**
     * Asserts that the given value is a Date
     *
     * @param {Date} value
     * @param {string} argumentName
     */
    static assertDate(value, argumentName = '') {
        if (!(value instanceof Date)) {
            if (argumentName) {
                throw new TypeError(`Expected argument ${argumentName} to be an instance of "Date", "${typeof value}" given`);
            }
            throw new TypeError(`Expected value to be an instance of "Date", "${typeof value}" given`);
        }
    }

    /**
     * Asserts that the given value is an instance of the given class
     *
     * @param {*} value
     * @param {class} expected
     * @param {string} argumentName
     */
    static assertInstanceOf(value, expected, argumentName = '') {
        if (!(value instanceof expected)) {
            const class_name = Assert._get_class_name_from_impl(expected);
            const description = Assert._get_value_description(value);
            if (argumentName) {
                throw new TypeError(`Expected argument ${argumentName} to be an instance of "${class_name}", "${description}" given`);
            }
            throw new TypeError(`Expected value to be an instance of "${class_name}", "${description}" given`);
        }
    }

    /**
     * Assert that the given value is a DOM element
     *
     * @param {*} value
     * @param {string} argumentName
     */
    static assertDomElement(value, argumentName = '') {
        if (!value.tagName) {
            if (argumentName) {
                throw new TypeError(`Expected argument ${argumentName} to be a DOM element, "${typeof value}" given`);
            }
            throw new TypeError(`Expected value to be a DOM element, "${typeof value}" given`);
        }
    }

    /**
     * @param {*} value
     * @return {string}
     * @private
     */
    static _get_value_description(value) {
        const type = typeof value;
        if (type !== 'object') {
            return type;
        }

        return value.constructor && value.constructor.name
            ? value.constructor.name
            : Assert._get_class_name_from_impl(value.constructor);
    }

    /**
     * @param {class} class_impl
     * @return {string}
     * @private
     */
    static _get_class_name_from_impl(class_impl) {
        const signature = ('' + class_impl);

        if (signature.substr(0, 11) === 'function ()') {
            return signature;
        }

        return signature.substring(9, signature.indexOf(' {'));
    }
}
