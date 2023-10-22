# net-tools/js-grid-editor

## Composer library with a Javascript grid editor

The library defines a Javascript `nettools.jsGridEditor` class which makes it possible to edit data stored as rows and columns.


## Setup instructions

To install net-tools/js-grid-editor package, just require it through composer : `require net-tools/js-grid-editor:^1.0.0`.




## How to use ?

The `nettools.jsGridEditor` class constructor expects the following parameters :
- the `HTMLElement` node where the editor must be rendered (usually a DIV)
- an object litteral with options :
  + `columns` : an array of object litterals defining columns (see below)
  + `data` : an array of object litterals containing data (see below)
  + `editable` : a boolean value ; if set to false, the grid data can't be edited
  + `disableDblClick` : a boolean value ; if set to true, a double-click can't switch the row to edit mode
  + `defaultValues` : an object litteral containing default values for new lines
  + `dialog` : an object inheriting from `nettools.jsGridEditor.Dialog` with `alert` and `confirm` methods ; by default, Javasript `alert` and `confirm` functions are used
  + `rowToStringColumns` : an event to help convert column values for a given row to a string ; if a numeric (starting at 0) or 'first' is given, the conversion is a key=value string for the corresponding column. If 'all' is given, the conversion returns all key values separated with commas
  + `onRowValidate` : an event called to validate row data before exiting edit mode (rowData may be updated during call) ; return a resolved Promise to accept changes, or a rejected Promise with error message to reject updates
  + `onRowToString` : an event called to get a string value for a row (the default code for this event use `rowToStringColumns` value to generate the string)
  + `onRowChange` : an event called to notify the client that a row content has changed ; the client code must return a resolved Promise if he acknowledges the update, or a rejected Promise otherwise
  + `onRowDelete` : an event called to notify the client that a row has been deleted ; the client code must acknowledge the deletion and return a resolved Promise when done, or a rejected Promise if an error occured
  + `onRowInsert` : an event called to notify the client that a row has been inserted ; the client code must return a Promise when done, or a rejected Promise if an error occured
  + `onCellHtml` : an event called for 'html' columns to set some rich GUI inside TD node
  + `onGetCellHtmlValue` : an event called for 'html' columns in edit-mode to get edited value to store in dataset when committing row edits


The `columns` object litteral array defines all columns ; the allowed parameters for a column are (also, see sample below) :
- `id` : the column ID as a string ; will be used in `data` parameter as property name
- `title` : the title that will appear in table header for this column
- `subTitle` : the subtitle in table header for the column
- `type` : defines the type for the column (string, int, float, bool, list or html)
- `required` : bool value to enforce column mandatory status
- `hidden` : a bool value to hide the column
- `format` : regular expression to valide column data
- `readonly` : the column can't be edited
- `readonlyEdit` : the column can't be edited except when creating a new line
- `datalist` : if `type` property is *list*, defines an array of string values accepted as values
- `validator` : a custom function to validate column value (return *true* if value is accepted or *false* if value is rejected)


The `data` array of object litterals contains grid data : one object litteral per row, each object property is a column value. See sample below.


```javascript
var grid = new nettools.jsGridEditor(document.getElementById('grid'),
	{
		// defining columns
		columns : [ 
			{ id : 'key', subTitle:'string(2)', format:/^[A-Z][A-Z0-9]$/, required : true, validator:function(v){ return v!='RU'; } },
			{ id : 'country', title : 'Country name', subTitle:'string', readonly : true }, 
			{ id : 'region', title : 'World area',  subTitle:'list', required : true, type:'list', datalist:['Europe', 'America', 'North-America', 'South-America', 'Asia', 'Africa'] },
			{ id : 'order', type : 'int', subTitle:'int'  },
            { id : 'english', title : 'Speak English ?',  subTitle:'bool(0/1)', required : true, type : 'bool' }
		],
	
		// data to edit
		data : [
			{ key : 'FR', country : 'France', region : 'Europe', order : 1, english : 0 },
			{ key : 'US', country : 'USA', region : 'North-America', order : 2, english : 1 },
			{ key : 'UK', country : 'United Kingdom', region : 'Europe', order : 3, english : 1 }
		],
	
		// grid is editable
		editable : true,
	
		// a row is converted to a string by return key=value for column 1 (second column)
		rowToStringColumns : 1,
	
		// default values for new lines
		defaultValues : {
			region : 'Asia',
			english : 1
		},
		
		// output in console values to validate
		onRowValidate : function(row, values)
			{
				console.log('Values to validate at row ' + row);
				console.log(values);
				return true;
			},
	
		// accepting updates in rows only for even one
		onRowChange : function(row, values)
			{
				console.log('Row changed at offset ' + row);
				console.log(values);
				
				if ( row % 2 == 0 )
					return Promise.resolve(row);
				else
					return Promise.reject('Row commit failed at row ' + row);
			},
	
		// processing deletion client-side ; if the user acknowledges deletion, the row is removed from dataset
		onRowDelete : function(row, values)
			{
				return new Promise(function(resolve, reject){
					if ( confirm('Confirm deletion has been processed client-side ?') )
						resolve(row);
					else
						reject('Deletion at row ' + row + ' denied');
				});
			},
	
		// procession new line ; if the user acknowledges insert, the row is inserted in the dataset
		onRowInsert : function(row, values)
			{
					return new Promise(function(resolve, reject){
						if ( confirm('Confirm insert has been processed client-side ?') )
							resolve(row);
						else
							reject('Insert at row ' + row + ' denied');
					});
			}
	}
);
```

There are several object methods that can be called :
- `setData` : if `data` options parameter is not set during constructor call, the data can be assigned to grid editor later by calling `setData` method with an array of object litterals.
- `isInserting` : returns *true* if the editor is currently inserting a new line
- `insertRow` : switch the editor to insert mode, filling the empty new line with default values provided
- `editRow` : edit the row at offset in parameter
- `deleteRow` : delete the row at offset in parameter ; the user is asked to confirm row deletion ; the `onRowDelete` event is called to notify client-side



## Samples

There are one sample inside `/samples` subdirectory :

- **editor.html**

