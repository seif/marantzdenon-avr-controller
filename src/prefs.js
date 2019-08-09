/*
 * prefs.js
 * Copyright (C) 2019 Sylvain Terrien <sylvainterrien@orange.fr>
 * 
 * Denon AVR controler is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Denon AVR controler is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
