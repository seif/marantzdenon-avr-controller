/*
 * prefs.js
 * Copyright (C) 2019 Sylvain Terrien <sylvainterrien@orange.fr>
 * 
 * Denon AVR controller is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Denon AVR controller is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class DenonAVRControllerExtensionPreferences extends ExtensionPreferences
{
    fillPreferencesWindow(window)
    {
        const page = new Adw.PreferencesPage({
            title: _('Preferences'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({});
        page.add(group);

        const row = new Adw.EntryRow({
            title: _('URL'),
        });

        group.add(row);

        const apiTypeRow = new Adw.ComboRow({
            title: _('API type'),
            model: new Gtk.StringList({ strings: ['new', 'old'] }),
        });
        group.add(apiTypeRow);

        window._settings = this.getSettings();
        window._settings.bind('avr-url', row, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Bind API type to ComboRow
        const apiType = window._settings.get_string('api-type');
        apiTypeRow.selected = apiType === 'old' ? 1 : 0;

        apiTypeRow.connect('notify::selected', () => {
            const selected = apiTypeRow.selected === 1 ? 'old' : 'new';
            window._settings.set_string('api-type', selected);
        }); 
    }
}

