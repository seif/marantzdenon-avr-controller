
const Gtk = imports.gi.Gtk;
const Extension = imports.misc.extensionUtils.getCurrentExtension();

function buildPrefsWidget()
{
    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Extension.dir.get_path() + '/Settings.ui', ['prefs_widget']);
    
    let grid = buildable.get_object('prefs_widget');
    grid.show_all();
    
    return grid;
}
function init()
{
	// rien pour l'instant
}