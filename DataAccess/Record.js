/**
 * Defines the nsdal handling for record body fields.
 *
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "N/record", "N/format", "../EC_Logger", "./Sublist"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.FieldType = exports.numericDescriptor = exports.defaultDescriptor = exports.NetsuiteRecord = exports.NetsuiteCurrentRecord = void 0;
    var record = require("N/record");
    var format = require("N/format");
    var LogManager = require("../EC_Logger");
    var Sublist_1 = require("./Sublist");
    var log = LogManager.getLogger('nsdal');
    /**
     * Since the netsuite defined 'CurrentRecord' type has almost all the same operations as the normal 'Record'
     * we use this as our base class
     */
    var NetsuiteCurrentRecord = /** @class */ (function () {
        function NetsuiteCurrentRecord(rec, isDynamic, defaultValues) {
            var _this = this;
            this.defaultValues = defaultValues;
            /**
             * Defines a descriptor for nsrecord so as to prevent it from being enumerable. Conceptually only the
             * field properties defined on derived classes should be seen when enumerating
             * @param value
             */
            this.makeRecordProp = function (value) { return Object.defineProperty(_this, 'nsrecord', { value: value }); };
            // since the context of this.constructor is the derived class we're instantiating, using the line below we can
            // pull the 'static' recordType from the derived class and remove the need for derived classes to
            // define a constructor to pass the record type to super()
            var type = Object.getPrototypeOf(this).constructor.recordType;
            if (!rec) {
                log.debug('creating new record', "type:" + type + "  isDyanamic:" + isDynamic + " defaultValues:" + defaultValues);
                this.makeRecordProp(record.create({ type: type, isDynamic: isDynamic, defaultValues: defaultValues }));
            }
            else if (typeof rec === 'object') {
                log.debug('using existing record', "type:" + rec.type + ", id:" + rec.id);
                this.makeRecordProp(rec);
                this._id = rec.id;
            }
            // allow
            else if (typeof rec === 'number' || +rec) {
                log.debug('loading existing record', "type:" + type + ", id:" + rec);
                this.makeRecordProp(record.load({
                    type: type,
                    id: rec,
                    isDynamic: isDynamic || false,
                    defaultValues: defaultValues,
                }));
                this._id = this.nsrecord.id;
            }
            else
                throw new Error("invalid value for argument \"rec\": " + rec + ". \n      Must be one of: null/undefined, an internal id, or an existing record");
        }
        Object.defineProperty(NetsuiteCurrentRecord.prototype, "id", {
            get: function () {
                return this._id;
            },
            enumerable: false,
            configurable: true
        });
        NetsuiteCurrentRecord.prototype.toJSON = function () {
            // surface inherited properties on a new object so JSON.stringify() sees them all
            var result = {};
            for (var key in this) { // noinspection JSUnfilteredForInLoop
                result[key] = this[key];
            }
            return result;
        };
        /**
         * Returns NetSuite field metadata. Useful for doing things like disabling a field on the form programmatically.
         * @param field field name for which you want to retrieve the NetSuite field object
         */
        NetsuiteCurrentRecord.prototype.getField = function (field) {
            return this.nsrecord.getField({
                fieldId: field
            });
        };
        return NetsuiteCurrentRecord;
    }());
    exports.NetsuiteCurrentRecord = NetsuiteCurrentRecord;
    /**
     * A regular netsuite record.
     */
    var NetsuiteRecord = /** @class */ (function (_super) {
        __extends(NetsuiteRecord, _super);
        function NetsuiteRecord() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        /**
         * Persists this record to the NS database
         * @param enableSourcing
         * @param ignoreMandatoryFields
         * @returns {number}
         */
        NetsuiteRecord.prototype.save = function (enableSourcing, ignoreMandatoryFields) {
            var id = this.nsrecord.save({
                enableSourcing: enableSourcing,
                ignoreMandatoryFields: ignoreMandatoryFields,
            });
            this._id = id;
            return id;
        };
        return NetsuiteRecord;
    }(NetsuiteCurrentRecord));
    exports.NetsuiteRecord = NetsuiteRecord;
    /**
     * parses a property name from a declaration (supporting 'Text' suffix per our convention)
     * @param propertyKey original property name as declared on class
     * @returns pair consisting of a flag indicating this field wants 'text' behavior and the actual ns field name (with
     * Text suffix removed)
     */
    var parseProp = suffixParser('Text');
    /**
     * returns a function for parsing property names from a declaration (e.g.
     * properties that end with 'Text' or 'Sublist' suffix per convention)
     * @param suffixToSearch string that may be at the end of a property name. this string will be strippped off
     * the end of the property name if it is present.
     * @returns function that takes a property name and returns a pair [flag indicating this field matched the suffix,
     * the stripped property name (with suffix removed)]
     */
    function suffixParser(suffixToSearch) {
        var suffixLength = suffixToSearch.length;
        return function (propertyKey) {
            var endsWithSuffix = propertyKey.slice(-suffixLength) === suffixToSearch;
            return [endsWithSuffix, endsWithSuffix ? propertyKey.slice(0, -suffixLength) : propertyKey];
        };
    }
    /**
     * parses a property name from a declaration (supporting 'Sublist' suffix per convention)
     * @param propertyKey original property name as declared on class
     * @returns pair consisting of a flag indicating this is actually a sublist and the actual ns sublist name (with
     * Sublist suffix removed)
     */
    var parseSublistProp = suffixParser('Sublist');
    /**
     * Generic decorator factory with basic default algorithm that exposes the field value directly with no
     * other processing. If the property name ends with "Text" then the property will use getText()/setText()
     *
     * @returns a decorator that returns a property descriptor to be used
     * with Object.defineProperty
     */
    function defaultDescriptor(target, propertyKey) {
        var _a = parseProp(propertyKey), isTextField = _a[0], nsfield = _a[1];
        return {
            get: function () {
                log.debug('field GET', nsfield + ", as text:" + isTextField);
                return isTextField ? this.nsrecord.getText({ fieldId: nsfield })
                    : this.nsrecord.getValue({ fieldId: nsfield });
            },
            set: function (value) {
                // ignore undefined's
                if (value !== undefined) {
                    if (isTextField)
                        this.nsrecord.setText({ fieldId: nsfield, text: value });
                    else
                        this.nsrecord.setValue({ fieldId: nsfield, value: value });
                }
                else
                    log.info("ignoring field [" + propertyKey + "]", 'field value is undefined');
            },
            enumerable: true //default is false
        };
    }
    exports.defaultDescriptor = defaultDescriptor;
    /**
     * Just like the default decriptor but calls Number() on the value. This exists for numeric types that
     * would blow up if you tried to assign number primitive values to a field. Don't know why - did various checks
     * with lodash and typeof to confirm the raw value was a number but only passing through Number() worked on sets.
     * Reads still seem to return a number.
     * @returns an object property descriptor to be used
     * with Object.defineProperty
     */
    function numericDescriptor(target, propertyKey) {
        var _a = parseProp(propertyKey), isTextField = _a[0], nsfield = _a[1];
        return {
            get: function () {
                return isTextField ? this.nsrecord.getText({ fieldId: nsfield })
                    : this.nsrecord.getValue({ fieldId: nsfield });
            },
            set: function (value) {
                // ignore undefined's
                if (value !== undefined) {
                    if (isTextField)
                        this.nsrecord.setText({ fieldId: nsfield, text: value });
                    else
                        this.nsrecord.setValue({ fieldId: nsfield, value: Number(value) });
                }
                else
                    log.info("ignoring field [" + propertyKey + "]", 'field value is undefined');
            },
            enumerable: true //default is false
        };
    }
    exports.numericDescriptor = numericDescriptor;
    /**
     * Decorator for adding sublists with each line of the sublist represented by a type T which
     * defines the properties you want on the sublist
     * @param ctor Constructor for the type that has the properties you want from each sublist line.
     * e.g. Invoice.ItemSublistLine
     */
    function sublistDescriptor(ctor) {
        return function (target, propertyKey) {
            var _a = parseSublistProp(propertyKey), nssublist = _a[1];
            var privateProp = "_" + nssublist;
            return {
                enumerable: true,
                // sublist is read only for now - if we have a use case where this should be assigned then tackle it
                get: function () {
                    if (!this[privateProp]) {
                        log.debug('initializing sublist', "sublist property named " + propertyKey + ", sublist id " + nssublist);
                        // using defineProperty() here defaults to making the property non-enumerable which is what we want
                        // for this 'private' property so it doesn't appear on serialization (e.g. JSON.stringify())
                        Object.defineProperty(this, privateProp, { value: new Sublist_1.Sublist(ctor, this.nsrecord, nssublist) });
                    }
                    return this[privateProp];
                },
            };
        };
    }
    /**
     * Decorator for *subrecord* fields with the subrecord shape represented by T (which
     * defines the properties you want on the subrecord)
     * @param ctor Constructor for the type that has the properties you want from the subrecord.
     * e.g. AssemblyBuild.InventoryDetail
     */
    function subrecordDescriptor(ctor) {
        return function (target, propertyKey) {
            return {
                enumerable: true,
                // sublist is read only for now - if we have a use case where this should be assigned then tackle it
                get: function () {
                    return new ctor(this.nsrecord.getSubrecord({
                        fieldId: propertyKey
                    }));
                },
            };
        };
    }
    /**
     * Generic property descriptor with algorithm for values that need to go through the NS format module on field
     * write. Returns plain getValue() on reads
     * note: does not take into account timezone
     * @param {string} formatType the NS field type (e.g. 'date')
     * @param target
     * @param propertyKey
     * @returns  an object property descriptor to be used
     * with decorators
     */
    function formattedDescriptor(formatType, target, propertyKey) {
        return {
            get: function () {
                return this.nsrecord.getValue({ fieldId: propertyKey });
            },
            set: function (value) {
                // allow null to flow through, but ignore undefined's
                if (value !== undefined) {
                    var formattedValue = format.format({ type: formatType, value: value });
                    log.debug("setting field [" + propertyKey + ":" + formatType + "]", "to formatted value [" + formattedValue + "] javascript type:" + typeof formattedValue);
                    if (value === null)
                        this.nsrecord.setValue({ fieldId: propertyKey, value: null });
                    else
                        this.nsrecord.setValue({ fieldId: propertyKey, value: formattedValue });
                }
                else
                    log.info("not setting " + propertyKey + " field", 'value was undefined');
            },
            enumerable: true //default is false
        };
    }
    /**
     *  Netsuite field types - decorate your model properties with these to tie netsuite field types to your
     *  model's field type.
     *  To get 'Text' rather than field value, suffix your property name with 'Text' e.g. 'afieldText' for the
     *  field 'afield'.
     */
    var FieldType;
    (function (FieldType) {
        /**
         * use for ns  _address_ field type
         */
        FieldType.address = defaultDescriptor;
        /**
         * use for NS _checkbox_ field type - surfaces as `boolean` in TypeScript
         */
        FieldType.checkbox = defaultDescriptor;
        FieldType.date = defaultDescriptor;
        FieldType.currency = numericDescriptor;
        FieldType.datetime = defaultDescriptor;
        FieldType.document = defaultDescriptor;
        FieldType.email = defaultDescriptor;
        FieldType.freeformtext = defaultDescriptor;
        FieldType.float = numericDescriptor;
        FieldType.decimalnumber = FieldType.float;
        FieldType.hyperlink = defaultDescriptor;
        FieldType.inlinehtml = defaultDescriptor;
        FieldType.image = defaultDescriptor;
        FieldType.integernumber = numericDescriptor;
        FieldType.longtext = defaultDescriptor;
        FieldType.multiselect = defaultDescriptor;
        //@see formattedDescriptor
        FieldType.percent = function (target, propertyKey) { return formattedDescriptor(format.Type.PERCENT, target, propertyKey); };
        /**
         * NetSuite 'Select' field type.
         */
        FieldType.select = defaultDescriptor;
        FieldType.textarea = defaultDescriptor;
        /**
         * this isn't a native NS 'field' type, but rather is used to indicate a property should represent a NS sub-list.
         * Pass a type derived from SublistLine that describes the sublist fields you want. e.g. Invoice.ItemSublistLine
         * @example
         * class MySublistLine extends Invoice.ItemSublistLine { custcol_foo:string }
         * class Invoice {
         * @FieldType.sublist(MySublistLine)
         * item: SublistLine<MySublistLine>
         * }
         */
        FieldType.sublist = sublistDescriptor;
        /**
         * NetSuite _SubRecord_ field type (reference to a subrecord object, usually described as 'summary' in the
         * records browser.
         * Pass in the (TypeScript) type that matches the subrecord this property points to
         * @example the `assemblybuild.inventorydetail` property
         * ```typescript
         * import { InventoryDetail } from './DataAceess/InventoryDetail'
         *
         * class AssemblyBuild {
         *    @FieldType.subrecord(InventoryDetail)
         *    inventorydetail: InventoryDetail
         * }
         * ```
         */
        FieldType.subrecord = subrecordDescriptor;
    })(FieldType = exports.FieldType || (exports.FieldType = {}));
});
