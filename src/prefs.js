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

import Gio from "gi://Gio";
import Adw from "gi://Adw";
import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class DenonAVRControlerExtensionPreferences extends ExtensionPreferences
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

        window._settings = this.getSettings();
        window._settings.bind('avr-url', row, 'text', Gio.SettingsBindFlags.DEFAULT);
    }
}

