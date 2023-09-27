// ==ClosureCompiler==
// @compilation_level SIMPLE_OPTIMIZATIONS
// @output_file_name default.js
// @language_out ECMASCRIPT_2017
// ==/ClosureCompiler==



// namespace
window.nettools = window['nettools'] || {};









nettools.jsGridEditor = class {
	
	/**
	 * Class constructor
	 *
	 * @param HTMLElement node DOM element to put grid content into
	 * @param object options Object litteral with parameters and grid data
	 *
	 * options may define :
	 * - columns : [ 
	 *				{ 
	 * 					id : string,						ex. 'col1'										Column ID
	 *					title : string,						ex. 'Column n1'									Title that will appear in table header
	 *					subTitle : string,					ex. 'Currency:$'								Subtitle that will appear in table header
	 *					type : string,						ex. string|int|float|bool|list					Data type of each column
	 *					required : bool,					1 or 0											Is the column value mandatory ?
	 *					format : string|RegExp,				ex. /^0[67][0-9]{8}$/ or '^0[67][0-9]{8}$'		Custom format to validate with
	 *					readonly : bool,					1 or 0                                          If set to true, this column can't be modified, even if table is editable
	 * 					datalist : string[]					ex. ['on', 'off', 'unknown']					If type = 'list', defines the accepted values
	 *					validator : function(string):bool													Check column value with user callback returning true(ok) or false(rejected value)
	 *				}
	 *				,
	 *				{...} 
	 *			]
	 * - data : object[] ; an array of object litterals for table content. ex. [ { col1 : string('col1 row1 value'), col2 : string('col2 row1 value') }, {...} ]
	 * - editable : bool (are table rows editable ?)
	 * - defaultValues : object ; an object litteral containing default values for new lines
	 * - rowToStringColumns : int|'first'|'all' : default onRowToString event implements row to string convert by returning a single column key=value string (the column key is given by 'first' or an int, 0 being the first value), or a string with all row columns key1=value1, key2=value2, ... (default behavior)
	 * - onRowValidate : function(int rowNumber, object rowData):bool ; called to accept or deny row updates (rowData may be updated during call) ; return true to accept, false to deny updates
	 * - onRowChange : function(int rowNumber, object rowData):Promise ; called to notify that a row content has changed
	 * - onRowToString : function(int rowNumber, object rowData):string ; called to get a string value for a row
	 * - onRowDelete : function(int rowNumber, object rowData):Promise ; called to notify the client the row has been deleted, returning a Promise when done ; the Promise is resolved with rowNumber
	 * - onRowInsert : function(int rowNumber, object rowData):Promise ; called to notify that a row has been inserted at offset rowNumber (usually 0), returning a Promise when done ; the Promise is resolved with rowNumber
	 */
	constructor(node, options)
	{
		this.node = node;
		this.options = options || {};


		// normalize parameters
		this.setDefaultValues();

		// check parameters
		this.checkParameters();

		// Output grid data to DOM tree
		this.output();
	}



	/**
	 * Apply CSS format
	 */
	applyCSS()
	{
		this.node.classList.add('uiForm');
		this.node.querySelector('table').classList.add('jsGridEditor');
	}



	/**
	 * Check parameters 
	 */
	checkParameters()
	{
		if ( !this.options.columns || !this.options.columns.length )
			throw new Error('`options.Columns` not set or empty');

		for ( var i = 0 ; i < this.options.columns.length ; i++ )
			if ( !this.options.columns[i].id )
				throw new Error(`\`id\` property for column definition at index ${i} is mandatory`);


		if ( this.options.onRowValidate && (typeof(this.options.onRowValidate) != 'function') )
			throw new Error('`onRowValidate` event is not a function');

		if ( this.options.onRowChange && (typeof(this.options.onRowChange) != 'function') )
			throw new Error('`onRowChange` event is not a function');

		if ( this.options.onRowToString && (typeof(this.options.onRowToString) != 'function') )
			throw new Error('`onRowToString` event is not a function');

		if ( this.options.onRowDelete && (typeof(this.options.onRowDelete) != 'function') )
			throw new Error('`onRowDelete` event is not a function');

		if ( this.options.onRowInsert && (typeof(this.options.onRowInsert) != 'function') )
			throw new Error('`onRowInsert` event is not a function');
	}



	/**
	 * Set parameters default values for missing ones 
	 */
	setDefaultValues()
	{
		for ( var i = 0 ; i < this.options.columns.length ; i++ )
		{
			// if no title, use id
			if ( !this.options.columns[i].title )
				this.options.columns[i].title = this.options.columns[i].id;


			// if no column type, set 'string'
			if ( !this.options.columns[i].type )
				this.options.columns[i].type = 'string';

			// if column type list and no datalist, set an empty one
			if ( (this.options.columns[i].type == 'list') && !this.options.columns[i].datalist )
				this.options.columns[i].datalist = [];


			// if type format a string, converting to RegExp
			if ( this.options.columns[i].format && (typeof(this.options.columns[i].format) == 'string') )
				this.options.columns[i].format = new RegExp(this.options.columns[i].format);		
		}


		// no data : empty list
		if ( !this.options.data )
			this.options.data = [];
		
		
		// no default values
		if ( this.options.defaultValues == null )
			this.options.defaultValues = {};


		this.options.rowToStringColumns = this.options.rowToStringColumns || 'all';	
		this.options.rowToStringColumns = (this.options.rowToStringColumns == 'first') ? 0 : this.options.rowToStringColumns;

		this.options.onRowValidate = (this.options.onRowValidate || function(row, data){ return true; }).bind(this);
		this.options.onRowChange = (this.options.onRowChange || function(row, data){ return Promise.resolve(row); }).bind(this);
		this.options.onRowInsert = (this.options.onRowInsert || function(row, data){ return Promise.resolve(row); }).bind(this);
		this.options.onRowDelete = (this.options.onRowDelete || function(row, data){ return Promise.resolve(row); }).bind(this);
		this.options.onRowToString = (this.options.onRowToString || function(row, data){ 

				// if row to string conversion must return all columns dataset
				if ( this.options.rowToStringColumns == 'all' )
				{
					var ret = [];
					for ( var k in data )
						ret.push(`${k} = ${data[k]}`);

					return ret.join(', ');				
				}

				// if row to string conversion is implemented with only returning key = value for a column
				else
				{
					var entries = Object.entries(data);
					if ( entries.length )
						return `${entries[this.options.rowToStringColumns][0]} = ${entries[this.options.rowToStringColumns][1]}`;
					else
						throw new Error(`No column data found at column \`${this.options.rowToStringColumns}\``);
				}
			}).bind(this);
	}



	/**
	 * Get number of reserved columns
	 *
	 * @return int
	 */
	getReservedColumnsCount()
	{
		return 1;
	}



	/**
	 * Get string output for reserved columns in header line (left side)
	 *
	 * @return string
	 */
	getHeaderLineReservedColumns()
	{
		return '<th></th>'.repeat(this.getReservedColumnsCount());
	}



	/**
	 * Get string output for reserved columns in row (left side)
	 *
	 * @return string
	 */
	getRowReservedColumns()
	{
		return '<td></td>'.repeat(this.getReservedColumnsCount());
	}



	/**
	 * During an event handling, go up the DOM tree until finding the TR node
	 *
	 * @param HTMLElement eventTarget DOM element being the event target
	 * @return HTMLTableRowElement
	 */
	getTRNode(eventTarget)
	{
		while ( eventTarget && eventTarget.nodeName != 'TR' )
			eventTarget = eventTarget.parentNode;

		if ( !eventTarget )
			throw new Error('Can\'t find TR parent node up the DOM tree');

		return eventTarget;
	}



	/**
	 * Define row reserved columns content 
	 *
	 * @param HTMLTableRowElement tr
	 */
	setRowReservedColumnsContent(tr, insertRow = false)
	{
		// set HTML
		tr.firstChild.innerHTML = `<div><span>${nettools.jsGridEditor.i18n.BUTTON_EDIT}</span><span>${nettools.jsGridEditor.i18n.BUTTON_DELETE}</span></div><div class="rowEdit"><span>${nettools.jsGridEditor.i18n.BUTTON_ACCEPT}</span><span>${nettools.jsGridEditor.i18n.BUTTON_CANCEL}</span></div>` + (insertRow ? `<div class="rowInsert"><span>${nettools.jsGridEditor.i18n.BUTTON_INSERT}</span><span>${nettools.jsGridEditor.i18n.BUTTON_CANCEL}</span></div>`:'');

		var divs = tr.firstChild.querySelectorAll('div');

		// set event for edit, delete, accept, cancel buttons
		var that = this;

		if ( this.options.editable )
			divs[0].firstChild.onclick = function() { that.editRow(that.getTRNode(this).row); };
		else
			divs[0].firstChild.style.display = 'none';
		divs[0].lastChild.onclick = function() { that.deleteRow(that.getTRNode(this).row); };
		divs[1].firstChild.onclick = function() { that.endEditRow(that.getTRNode(this).row); };
		divs[1].lastChild.onclick = function() { that.cancelEditRow(that.getTRNode(this).row); };


		if ( insertRow )
		{
			divs[2].firstChild.onclick = function() { that.endInsertRow(); };
			divs[2].lastChild.onclick = function() { that.cancelInsertRow(); };
		}
	}



	/**
	 * Output header line 
	 *
	 * @param HTMLTableElement table

	 */
	outputHeaderLine(table)
	{
		var tr = document.createElement('tr');
		var tmp = this.getHeaderLineReservedColumns();

		for ( var i = 0 ; i < this.options.columns.length ; i++ )
		{
			if ( this.options.columns[i].subTitle )
				tmp += `<th data-column='${this.options.columns[i].title}'>${this.options.columns[i].title}<span>${this.options.columns[i].subTitle}</span></th>`;
			else
				tmp += "<th>" + this.options.columns[i].title + "</th>";
		}

		tr.innerHTML = tmp; 
		
		
		// insert '+' link to topleft cell
		var a = document.createElement('a');
		var that = this;
		a.href = "javascript:void(0)";
		a.innerHTML = '+';
		a.title = nettools.jsGridEditor.i18n.CMD_INSERT_ROW;
		a.onclick = function(){ that.insertRow(); return true; };
		tr.querySelector('th:first-child').appendChild(a);
		
		table.appendChild(tr);
	}



	/**
	 * Get line template
	 *
	 * @return string
	 */
	getLineTemplate()
	{
		return this.getRowReservedColumns() + '<td></td>'.repeat(this.options.columns.length);
	}



	/**
	 * Output rows
	 *
	 * @param HTMLTableElement table
	 */
	outputRows(table)
	{
		var template_line = this.getLineTemplate();

		for ( var irow = 0 ; irow < this.options.data.length ; irow++ )
		{
			var tr = document.createElement('tr');
			tr.innerHTML = template_line;
			tr.row = irow;

			this.setRowReservedColumnsContent(tr);
			this.setRowContentValues(tr, this.options.data[irow]);		

			table.appendChild(tr);
		}
		/*
		table.insertAdjacentHTML('beforeend', ('<tr>' + template_line + '</tr>').repeat(this.options.data.length));

		// get first TR for data (second TR in table, the first one being the header line)
		var tr = table.querySelector('tr:nth-of-type(2)');
		if ( !tr )
			return;	// no data to output

		var irow = 0;
		while ( tr )
		{
			tr.row = irow;
			this.setRowReservedColumnsContent(tr);
			this.setRowContentValues(tr, this.options.data[irow]);

			tr = tr.nextSibling;
			irow++;
		}*/
	}
	
	
	
	/**
	 * Output command line above table
	 */
	/*outputCommandLine()
	{
		var that = this;
		
		var div = document.createElement('div');
		div.className = 'jsGridEditorCommandLine';
		div.innerHTML = `<a href="javascript:void(0)">${nettools.jsGridEditor.i18n.CMD_INSERT_ROW}</a>`;
		div.firstChild.onclick = function(event){ that.insertRow(); return true; };
		
		var table = this.node.querySelector('table');
		this.node.insertBefore(div, table);
	}*/



	/**
	 * Output content to DOM tree inside node 
	 */
	output()
	{
		var table = document.createElement('table');


		// output headers
		this.outputHeaderLine(table);


		// output rows
		this.outputRows(table);


		// table content with rows
		this.node.innerHTML = "";
		this.node.appendChild(table);
		
		
		// command line
		//this.outputCommandLine();
		

		// apply CSS
		this.applyCSS();
	}



	/**
	 * Set table data (array of object litterals)
	 *
	 * @param object[] data
	 */
	setData(data)
	{
		this.options.data = data;
		this.output();
	}   



	/**
	 * Fire a onRowChange event when a row has been updated
	 *
	 * @param int row 0-index row offset
	 * @param object values New values
	 * @return Promise Returns a Promise resolved when the update is processed client-side
	 */
	fireOnRowChange(row, values)
	{
		try
		{
			return this.options.onRowChange(row, values);
		}
		catch ( e )
		{
			return Promise.reject(e);
		}
	}



	/**
	 * Fire a onRowInsert event when a row has been inserted
	 *
	 * @param int row 0-index row offset
	 * @param object values New values
	 * @return Promise Returns a Promise resolved when the insert is done client-side
	 */
	fireOnRowInsert(row, values)
	{
		try
		{
			return this.options.onRowInsert(row, values);
		}
		catch ( e )
		{
			return Promise.reject(e);
		}
	}



	/**
	 * Fire a onRowValidate event when row edits must be validated
	 *
	 * @param int row 0-index row offset or -1 if new inserted row being validated
	 * @param object values Row values as an object litteral from contentEditable cells
	 * @return bool Must return true is validation is ok, false otherwise (in that case, updates are reverted)
	 */
	fireOnRowValidate(row, values)
	{
		return this.options.onRowValidate(row, values);
	}



	/**
	 * Fire a onRowToString to get a string value for a row
	 *
	 * @param int row 0-index row offset
	 * @param object values Row values as an object litteral
	 * @return string
	 */
	fireOnRowToString(row, values)
	{
		return this.options.onRowToString(row, values);
	}



	/**
	 * Fire a onRowDelete event
	 *
	 * @param int row 0-index row offset
	 * @param object values Row values as an object litteral
	 * @return Promise Returns a Promise resolved when the deletion is done client-side
	 */
	fireOnRowDelete(row, values)
	{
		try
		{
			return this.options.onRowDelete(row, values);
		}
		catch ( e )
		{
			return Promise.reject(e);
		}
	}



	/**
	 * Test if a line is being inserted
	 *
	 * @return bool Returns True if a line is being inserted
	 */
	isInserting()
	{
		// can't do some stuff when a row is inserted
		return this.node.querySelector('table.jsGridEditor[data-insert=\'1\']');
	}



	/**
	 * Set contentEditable property of cells in a row
	 *
	 * @param int row 0-index of row to set edit mode on or off
	 * @param bool editable
	 */
	setRowContentEditable(row, editable)
	{
		// get TR at offset row+1 (+1 since we have header line and +1 since rows are indexed beginning at 1 when using nth-child)
		var tr = this.node.querySelector(`tr:nth-of-type(${row+2})`);
		if ( !tr )
			throw new Error(`TR at offset ${row} not found`);


		// set contentEditable attributes
		var tds = tr.querySelectorAll('td');
		var tdsl = tds.length;
		var reservedCols = this.getReservedColumnsCount();

		for ( var i = reservedCols ; i < tdsl ; i++ )
			if ( !this.options.columns[i-reservedCols].readonly )
				tds[i].contentEditable = editable;


		// reset td content for row ; may remove checkboxes for bool values (for contentEditable = true) or add checkboxes (for contentEditable = false)
		if ( !editable )
		{
			this.setRowContentValues(tr, this.options.data[row]);
			tr.removeAttribute('data-edit');
		}
		else
		{
			this.setRowEditableValues(tr, this.options.data[row]);
			tr.setAttribute('data-edit', 'edit');
		}
	}



	/**
	 * Insert one row at the beginning of the table
	 *
	 * @param object defaultValues Object litteral with default values
	 */
	insertRow(defaultValues)
	{
		if ( !this.options.editable )
			throw new Error('Table config prevents editing (set `editable` option to `true`)');


		// get line template
		var line = this.getLineTemplate();
		var tr = document.createElement('tr');
		tr.innerHTML = line;


		// output stuff to reserved columns
		this.setRowReservedColumnsContent(tr, true);


		// set contentEditable attributes
		var tds = tr.querySelectorAll('td');
		var tdsl = tds.length;
		var reservedCols = this.getReservedColumnsCount();

		for ( var i = reservedCols ; i < tdsl ; i++ )
			if ( !this.options.columns[i-reservedCols].readonly )
				tds[i].contentEditable = true;


		// set default values for inserted row
		if ( !defaultValues )
			defaultValues = this.options.defaultValues;
		this.setRowEditableValues(tr, defaultValues);


		// line and table in insert mode
		var table = this.node.querySelector('table');

		tr.setAttribute('data-edit', 'insert');
		table.setAttribute('data-insert', 1);

		if ( table.firstChild.nextElementSibling )
			table.insertBefore(tr, table.firstChild.nextElementSibling);
		else
			table.appendChild(tr);
	}



	/**
	 * Set one row in edit-mode
	 *
	 * @param int row 0-index of row to set edit mode on
	 */
	editRow(row)
	{
		if ( !this.options.editable )
			throw new Error('Table config prevents editing (set `editable` option to `true`)');

		if ( typeof(row) != 'number' )
			throw new Error('`row` parameter is not an int value');

		// can't edit when a row is inserted
		if ( this.isInserting() )
			return false;


		// set contentEditable property of each row cell
		this.setRowContentEditable(row, true);
	}



	/**
	 * Get editable row content as object litteral
	 *
	 * @param int row 0-index of row to accept updates and stop edit mode
	 * @return object Returns an object litteral with column ids as properties and cell content as values
	 */
	getEditableRowValues(row)
	{
		// get TR at offset row+1 (+1 since we have header line and +1 since rows are indexed beginning at 1 when using nth-child)
		var tr = this.node.querySelector(`tr:nth-of-type(${row+2})`);
		if ( !tr )
			throw new Error(`TR at offset ${row} not found`);


		// creating object litteral with row content
		var tds = tr.querySelectorAll('td');
		var tdsl = tds.length;
		var reservedCols = this.getReservedColumnsCount();
		var values = {};
		for ( var i = reservedCols ; i < tdsl ; i++ )
			switch ( this.options.columns[i-reservedCols].type )
			{
				case 'list':
					values[this.options.columns[i-reservedCols].id] = tds[i].querySelector('select').value;
					break;

				case 'int':
				case 'bool':
				case 'float':
				case 'number':
				default:
					values[this.options.columns[i-reservedCols].id] = tds[i].innerText.trim();
					break;
			}


		return values;
	}



	/**
	 * Transform row content object litteral with string properties to an object litteral with expected data types
	 *
	 * @param object values The object litteral returned by `getEditableRowValues` with string values
	 * @return object Returns an object litteral with values converted to columns types
	 */
	getTypedRowValues(row)
	{
		for ( var i = 0 ; i < this.options.columns.length ; i++ )
			switch ( this.options.columns[i].type )
			{
				case 'int':
				case 'bool':
					row[this.options.columns[i].id] = parseInt(row[this.options.columns[i].id]);
					break;

				case 'float':
				case 'number':
					row[this.options.columns[i].id] = parseFloat(row[this.options.columns[i].id]);
					break;

				default:
					// nothing to do
					break;
			}


		return row;
	}



	/**
	 * Handle onchange event on checkboxes for bool columns.
	 *
	 * Is called as a checkbox event handler, so THIS refers to the checkbox, not the editor object
	 */
	boolCheckboxChange()
	{
		// prevent checkbox change
		if ( this.editor.isInserting() )
			return false;


		// get row index, going up the DOM tree from the event target to the TR node
		var row = this.editor.getTRNode(this).row;

		// update dataset for row and column ID ; cloning object litteral so that the update can be canceled if client event fails
		var dataclone = Object.assign({}, this.editor.options.data[row]);
		dataclone[this.columnId] = this.checked ? 1 : 0;

		// fire onchange event for this row
		var that = this;
		this.editor.fireOnRowChange(row, dataclone).then(
			function(row)
			{
				that.editor.options.data[row][that.columnId] = that.checked ? 1 : 0;
			})
			.catch(function(e)
				{
					// revert checkbox status
					that.checked = !that.checked;
					alert(e.message ? e.message : e);
				}
			);
	}



	/**
	 * Handle onclick event on checkboxes for bool columns : prevent clicks when inserting line
	 *
	 * Is called as a checkbox event handler, so THIS refers to the checkbox, not the editor object
	 */
	boolCheckboxClick(event)
	{
		// prevent checkbox change
		if ( this.editor.isInserting() )
		{
			event.preventDefault();
			return false;
		}
		else
			return true;
	}



	/**
	 * Set column content, maybe decorated with some HTML (ex. checkbox for bool values)
	 *
	 * @param int row 0-index of row to put content into 
	 * @param HTMLTableCellElement TD node to put content into
	 * @param object columnDef Object litteral from options.columns describing the column
	 * @param string value Content to display
	 */
	setRowContentColumn(row, td, columnDef, value)
	{
		if ( columnDef.type == 'bool' )
		{
			td.innerHTML = `<input type="checkbox" ${(value=='1')?'checked':''}>`;
			var cb = td.firstChild;
			cb.editor = this;
			cb.columnId = columnDef.id;
			cb.onclick = this.boolCheckboxClick;
			cb.onchange = this.boolCheckboxChange;
		}
		else
			td.innerText = (value === undefined) ? '' : value;
	}



	/**
	 * Set grid row values at offset row from an object litteral
	 *
	 * @param HTMLTableRowElement tr TR node
	 * @param object values Object litteral with row content
	 */
	setRowContentValues(tr, values)
	{
		// creating object litteral with row content
		var tds = tr.querySelectorAll('td');
		var tdsl = tds.length;
		var reservedCols = this.getReservedColumnsCount();
		for ( var i = reservedCols ; i < tdsl ; i++ )
			this.setRowContentColumn(tr.row, tds[i], this.options.columns[i-reservedCols], values[this.options.columns[i-reservedCols].id]);
	}



	/**
	 * Set an editable column value
	 *
	 * @param HTMLTableCellElement TD node to put editable value into
	 * @param object columnDef Object litteral from options.columns describing the column
	 * @param string value Content to edit
	 */
	setRowEditableColumn(td, columnDef, value)
	{
		// render an editable column with appropriate stuff ; type 'list' columns have a choice list to pick values from
		switch ( columnDef.type )
		{
			case 'list':
				td.innerHTML = `<select><option></option>${columnDef.datalist.map(x => `<option ${(x == value)?'selected':''}>${x}</option>`).join()}</select>`;
				break;

			default:
				td.innerText = (value === undefined) ? '' : value;			
		}
	}



	/**
	 * Set row editable values at offset row from an object litteral
	 *
	 * @param HTMLTableRowElement tr TR node to put editable values into
	 * @param object values Object litteral with row content
	 */
	setRowEditableValues(tr, values)
	{
		// creating object litteral with row content
		var tds = tr.querySelectorAll('td');
		var tdsl = tds.length;
		var reservedCols = this.getReservedColumnsCount();
		for ( var i = reservedCols ; i < tdsl ; i++ )
			this.setRowEditableColumn(tds[i], this.options.columns[i-reservedCols], values[this.options.columns[i-reservedCols].id]);
	}



	/**
	 * Test if an editable row content has been updated
	 *
	 * @param int row 0-index of row to test
	 * @param object values Object litteral with row key/values
	 * @return bool
	 */
	hasRowChanged(row, values)
	{
		if ( row >= this.options.data.length )
			throw new Error(`TR at offset ${row} not found`);


		var colsl = this.options.columns.length;
		for ( var i = 0 ; i < colsl ; i++ )
			// test if update
			if ( this.options.data[row][this.options.columns[i].id] != values[this.options.columns[i].id] )
				return true;

		return false;
	}



	/**
	 * Commit editable row updates to dataset options.data
	 *
	 * @param int row 0-index of row to commit editable data updates to internal dataset options.data
	 * @param object values Object litteral with row key/values
	 */
	commitRowToDataset(row, values)
	{
		if ( row >= this.options.data.length )
			throw new Error(`TR at offset ${row} not found`);


		var colsl = this.options.columns.length;
		for ( var i = 0 ; i < colsl ; i++ )
			// setting internal dataset with updates in editable row cells
			this.options.data[row][this.options.columns[i].id] = values[this.options.columns[i].id];
	}



	/**
	 * Ask for row deletion confirmation
	 *
	 * @param int row 0-index of row to confirm deletion
	 * @param object values Object litteral with row key/values
	 * @return Promise Returns a promise resolved if row deletion is confirmed
	 */
	confirmRowDeletion(row, values)
	{
		// get a string value for this row and confirm deletion
		if ( confirm(nettools.jsGridEditor.i18n.CONFIRM_DELETE.replace(/%/, this.fireOnRowToString(row, values))) )
			return Promise.resolve(row);
		else
			return Promise.reject(`Row deletion at offset ${row} canceled`);
	}



	/**
	 * Delete a row
	 *
	 * @param int row 0-index of row to delete
	 */
	deleteRow(row)
	{
		if ( row >= this.options.data.length )
			throw new Error(`TR at offset ${row} not found`);

		// can't delete when a row is inserted
		if ( this.isInserting() )
			return false;


		var that = this;


		// ask for confirm
		this.confirmRowDeletion(row, this.options.data[row]).then(
			function(row)
			{
				// fire onRowDelete event so that client side can acknowledge row deletion, doing any required adjustments
				that.fireOnRowDelete(row, that.options.data[row]).then(
					function(row)
					{
						// remove row from dataset, then filter array to remove empty values
						delete that.options.data[row];
						that.options.data = that.options.data.filter(x=>true);


						// get TR at offset row+1 (+1 since we have header line and +1 since rows are indexed beginning at 1 when using nth-child)
						var tr = that.node.querySelector(`tr:nth-of-type(${row+2})`);
						if ( !tr )
							throw new Error(`TR at offset ${row} not found`);


						// update row number after row deleted
						var next = tr.nextElementSibling;
						while ( next )
						{
							if ( next.nodeName == 'TR' )
								next.row--;

							next = next.nextElementSibling;
						}


						// delete row in DOM tree
						tr.parentNode.removeChild(tr);
					})
					.catch(function(e)
						{
							alert(e.message ? e.message : e);
						}
					);
			})

			// doing nothing if row deletion canceled
			.catch(function(e)
				{
					if ( (typeof e === 'object') && (e instanceof Error) )
						alert(e.message);
				}
			);

	}

	

	/**
	 * Terminate row edit, accepting any change, only if changes are validated
	 *
	 * If updates are refused, the edit mode is still on ; if updates must be discarded, cancelEditRow should be called
	 *
	 * @param int row 0-index of row to accept updates and stop edit mode
	 */
	endEditRow(row)
	{
		if ( !this.options.editable )
			throw new Error('Table config prevents editing (set `editable` option to `true`)');

		if ( typeof(row) != 'number' )
			throw new Error('`row` parameter is not an int value');	

		// can't end edit when a row is inserted
		if ( this.isInserting() )
			return false;


		// get editable row content as object litteral
		var values = this.getEditableRowValues(row);	


		// validate row columns with their data type, then validate with global custom event ; values may be corrected during call
		if ( this.validateRow(values) && this.fireOnRowValidate(row, this.getTypedRowValues(values)) )
		{
			// if update found in editable row
			if ( this.hasRowChanged(row, values) )
			{
				var that = this;
				
				// fire onRowChange event
				this.fireOnRowChange(row, values).then(
					function(row)
					{
						// commit values to internal dataset options.data
						that.commitRowToDataset(row, values);

						// removing contentEditable
						that.setRowContentEditable(row, false);
					})
					.catch(function(e)
						{
							alert(e.message ? e.message : e);
						}
					);
			}
			else
				// removing contentEditable
				this.setRowContentEditable(row, false);
		}
	}



	/**
	 * Terminate row insert, accepting any change, only if changes are validated
	 *
	 * If updates are refused, the insert mode is still on ; if updates must be discarded, cancelInsertRow should be called
	 */
	endInsertRow()
	{
		// get inserted row content as object litteral ; always at offset 0
		var values = this.getEditableRowValues(0);

		var that = this;


		// validate row columns with their data type, then validate with global custom event ; values may be corrected during call
		if ( this.validateRow(values) && this.fireOnRowValidate(-1, this.getTypedRowValues(values)) )
		{
			// fire onRowInsert event
			this.fireOnRowInsert(0, values)
				.then(function(row)
					{
						// commit values to internal dataset options.data, at the array beginning
						that.options.data.unshift({});
						that.commitRowToDataset(row, values);


						// get TR for insert line (line 1 = headers, line 2 = insert line , nth-of-type requires a item number from 1)
						var tr = that.node.querySelector('tr:nth-of-type(2)');
						if ( !tr )
							throw new Error('TR at offset 1 not found');


						// set row index
						tr.row = 0;


						// renumbering row indexes from TR following edit line to the table end
						var next = tr.nextElementSibling;
						while ( next )
						{
							if ( next.nodeName == 'TR' )
								next.row++;

							next = next.nextElementSibling;
						}


						// remove un-necessary buttons
						var div = tr.querySelector('div.rowInsert');
						div.parentNode.removeChild(div);


						// removing contentEditable
						that.setRowContentEditable(row, false);

						// removing insert mode from table (thus removing css filter on other lines)
						tr.parentNode.removeAttribute('data-insert');
					}
				).catch(function(e)
					{
						alert(e.message ? e.message : e);
					}
				);
		}
	}



	/**
	 * Cancel row insert
	 */
	cancelInsertRow()
	{
		// get second TR (first is header line)
		var tr = this.node.querySelector('tr:nth-of-type(2)');
		if ( !tr )
			throw new Error('Insert line not found at offset 1 not found');

		if ( tr.getAttribute('data-edit') != 'insert' )
			throw new Error('Insert line not found');


		tr.parentNode.removeAttribute('data-insert');
		tr.parentNode.removeChild(tr);
	}



	/**
	 * Cancel row edit, reverting any change
	 *
	 * @param int row 0-index of row to cancel edit
	 */
	cancelEditRow(row)
	{
		if ( !this.options.editable )
			throw new Error('Table config prevents editing (set `editable` option to `true`)');

		if ( typeof(row) != 'number' )
			throw new Error('`row` parameter is not an int value');


		// get TR at offset row+1 (+1 since we have header line and +1 since rows are indexed beginning at 1 when using nth-child)
		var tr = this.node.querySelector(`tr:nth-of-type(${row+2})`);
		if ( !tr )
			throw new Error(`TR at offset ${row} not found`);


		// reverting to data in internal dataset
		this.setRowContentEditable(row, false);
	}



	/**
	 * Validate a row values according to their data type and required flag
	 *
	 * @param object values Object litteral of row values
	 * @return bool Returns true if value complies with data type
	 */
	validateRow(values)
	{
		var colsl = this.options.columns.length;
		for ( var i = 0 ; i < colsl ; i++ )
			if ( !this.validateValue(values[this.options.columns[i].id], this.options.columns[i]) )
				return false;


		return true;
	}



	/**
	 * Validate a value with data type
	 *
	 * @param string value
	 * @param object columnDef Object litteral from options.columns[] describing this value
	 * @return bool Returns true if value complies with data type
	 */
	validateValue(value, columnDef)
	{
		// if not required and empty, value is OK
		if ( !columnDef.required && (value === '') )
			return true;

		// if required and empty, error
		if ( columnDef.required && (value === '') )
		{
			alert(nettools.jsGridEditor.i18n.VALUE_MISSING.replace(/%/, columnDef.title));
			return false;
		}


		// if custom format, prefer validation with it than with type
		if ( columnDef.format )
		{
			if ( !columnDef.format.test(value) )
			{
				alert(nettools.jsGridEditor.i18n.VALUE_FORMAT_ERR.replace(/%/, columnDef.title));
				return false;
			}
		}
		else
		{
			// checking value according to its type
			var regexp = null;
			switch ( columnDef.type )
			{
				case 'int' :
					regexp = /^[0-9]+$/;
					break;

				case 'float' :
					regexp = /^[0-9]*[0-9](\.[0-9]+)?$/;
					break;

				case 'bool' :
					regexp = /^[01]$/;
					break;

				case 'mail' :
					regexp = /^[a-z0-9]+([_|\.|-]{1}[a-z0-9]+)*@[a-z0-9]+([_|\.|-]{1}[a-z0-9]+)*[\.]{1}[a-z]{2,6}$/;
					break;
			}


			// checking type format
			if ( regexp && !regexp.test(value) )
			{
				alert(nettools.jsGridEditor.i18n.VALUE_TYPE_ERR.replace(/%1/, columnDef.title).replace(/%2/, columnDef.type));
				return false;
			}
		}		
		
		
		// check value with column validator
		if ( typeof columnDef.validator === 'function' )
			if ( !columnDef.validator(value) )
			{
				alert(nettools.jsGridEditor.i18n.VALUE_INVALID.replace(/%/, columnDef.title));
				return false;
			}


		return true;
	}
}





/**
 * Translations
 */
nettools.jsGridEditor.i18n = {
	VALUE_TYPE_ERR : 'Value does not comply with type `%2` for column `%1`',
	VALUE_FORMAT_ERR : 'Value does not comply with format for column `%`',
	VALUE_INVALID : 'Value is not valid for column `%`',
	VALUE_MISSING : 'Value is mandatory for column `%`',
	
	CONFIRM_DELETE : 'Please confirm row deletion : `%`',
    
    BUTTON_ACCEPT : 'Accept',
    BUTTON_INSERT : 'Insert',
    BUTTON_CANCEL : 'Cancel',
    BUTTON_EDIT : 'Edit',
    BUTTON_DELETE : 'Delete',
	
	CMD_INSERT_ROW : 'Insert new line'
}