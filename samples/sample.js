var sample = {

    // react to color change
    colorChange : function(sel)
    {
        var style = document.getElementById('colorStyle');
        style.href = '../../ui/src/ui.' + ((sel.value == 'neutral')?'yellow':sel.value) + '-theme.css';

		var style = document.getElementById('gridEditorColorStyle');
        style.href = '../src/theme-' + sel.value + '.css';
    },
    
    
    // autoload : write color selection
    writeColorSelection : function()
    {
        var sel = document.getElementById('colorSelect');
        sel.options[0] = new Option('neutral');
        sel.options[1] = new Option('dark');
    },
    
    
    // set theme
    darkTheme : function(sel)
    {
        if ( sel.value == '1' )
        {
            document.body.style.backgroundColor = 'var(--ui-bgColor, white)';
            document.body.style.color = 'var(--ui-color, black)';
        }
        else
        {
            document.body.style.backgroundColor = 'white';
            document.body.style.color = 'black';
        }
    }
};



// autoload
nettools.jscore.registerOnLoadCallback(sample.writeColorSelection);