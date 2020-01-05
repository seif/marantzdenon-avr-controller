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

'use strict';

const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function buildPrefsWidget()
{
    let gschema = Gio.SettingsSchemaSource.new_from_directory(Me.dir.get_child('schemas').get_path(),
            Gio.SettingsSchemaSource.get_default(), false);

    this.settings = new Gio.Settings({
        settings_schema : gschema.lookup('org.gnome.shell.extensions.denon-avr-controler', true)
    });

    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', [ 'prefs_widget' ]);

    let grid = buildable.get_object('prefs_widget');
    let entry = buildable.get_object('gtkEntryUrl');
    entry.set_text(this.settings.get_value('avr-url').unpack());
    entry.connect('changed', () =>
    {
        this.settings.set_value('avr-url', new GLib.Variant('s', entry.get_text()));
    });

    grid.show_all();

    return grid;
}

function init()
{
    // nothing to do, but this function have to exist
}
