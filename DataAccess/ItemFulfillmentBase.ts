/**
 * Represents an Item Fulfillment (itemfulfillment) transaction type in NetSuite
 */

import { FieldType } from './Record'
import * as record from 'N/record'
import { TransactionBase } from './Transaction'
import { Sublist, SublistFieldType, SublistLine } from './Sublist'

/**
 * Item Fulfillment Items (item) sublist
 */
export class ItemSublist extends SublistLine {

   @SublistFieldType.freeformtext
   "class":string

   @SublistFieldType.freeformtext
   countryofmanufacture:string

   @SublistFieldType.freeformtext
   item:string

   @SublistFieldType.checkbox
   itemreceive:boolean

   @SublistFieldType.select
   location:number

   @SublistFieldType.float
   onhand:number

   @SublistFieldType.decimalnumber
   quantity:number

   @SublistFieldType.float
   quantityremaining:number

   @SublistFieldType.freeformtext
   units:string
}


/**
 * Item Fulfillment Base Type
 */
export class ItemFulfillmentBase extends TransactionBase {

   static recordType = record.Type.ITEM_FULFILLMENT

   /**
    * This field shows the transaction this fulfillment was created from.
    */
   @FieldType.select
   createdfrom:number


   @FieldType.sublist(ItemSublist)
   item: Sublist<ItemSublist>
}

