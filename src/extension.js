/*
 * extension.js
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

import Clutter from "gi://Clutter";
import St from 'gi://St';
import Soup from 'gi://Soup';
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js'
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js'

const IndicatorName = 'DenonAVRindicator';

let baseUrl;

class DenonAPIAdapter {
    constructor(baseUrl, httpSession) {
        this.baseUrl = baseUrl;
        this.httpSession = httpSession;
    }

    async getStatus() {
        throw new Error('getStatus must be implemented');
    }

    runCommand(command, arg) {
        throw new Error('runCommand must be implemented');
    }

    parseStatusResponse(text) {
        throw new Error('parseStatusResponse must be implemented');
    }
}

// Old Denon API (pre-2016)
class OldDenonAPI extends DenonAPIAdapter {
    async getStatus() {
        let url = this.baseUrl + 'goform/formMainZone_MainZoneXml.xml';
        let request = Soup.Message.new('GET', url);

        let data = await this.httpSession.send_and_read_async(request, 0, null);
        const decoder = new TextDecoder();
        let text = decoder.decode(data.get_data());
        return this.parseStatusResponse(text);
    }

    runCommand(command, arg) {
        let url = this.baseUrl + 'MainZone/index.put.asp?cmd0=' + command + '%2F' + arg;

        let request = Soup.Message.new('GET', url);
        this.httpSession.send_async(request, 0, null, null);
    }

    parseStatusResponse(text) {
        let regexName = new RegExp('<FriendlyName><value>(.+)<\/value><\/FriendlyName>', 'g');
        let regexPower = new RegExp('<ZonePower><value>([A-Z]+)<\/value><\/ZonePower>', 'g');
        let regexVolume = new RegExp('<MasterVolume><value>(\-?[0-9.]+)<\/value><\/MasterVolume>', 'g');
        let regexInput = new RegExp('<InputFuncSelect><value>(.+)<\/value><\/InputFuncSelect>', 'g');

        let nameMatch = regexName.exec(text);
        let powerMatch = regexPower.exec(text);
        let volumeMatch = regexVolume.exec(text);
        let inputMatch = regexInput.exec(text);

        if (!nameMatch || !powerMatch || !volumeMatch || !inputMatch) {
            return null;
        }

        return {
            name: nameMatch[1],
            power: powerMatch[1] == 'ON',
            volume: volumeMatch[1],
            input: inputMatch[1]
        };
    }
}

// New Denon API (post-2016)
class NewDenonAPI extends DenonAPIAdapter {
    async getStatus() {
        let url = this.baseUrl + 'goform/AppCommand.xml';
        let request = Soup.Message.new('POST', url);

        let xmlBody = '<?xml version="1.0" encoding="utf-8"?>\n' +
                      '<tx>\n' +
                      '  <cmd id="1">GetZoneName</cmd>\n' +
                      '  <cmd id="1">GetAllZonePowerStatus</cmd>\n' +
                      '  <cmd id="1">GetAllZoneSource</cmd>\n' +
                      '  <cmd id="1">GetAllZoneVolume</cmd>\n' +
                      '  <cmd id="1">GetAllZoneMuteStatus</cmd>\n' +
                      '</tx>';

        request.set_request_body_from_bytes('text/xml', new GLib.Bytes(xmlBody));

        let data = await this.httpSession.send_and_read_async(request, 0, null);
        const decoder = new TextDecoder();
        let text = decoder.decode(data.get_data());
        return this.parseStatusResponse(text);
    }

    runCommand(command, arg) {
        let commandMap = {
            'PutSystem_OnStandby': (value) => 'PW' + value,
            'PutMasterVolumeSet': (value) => {
                // The volume is based on api which has min of -80, convert
                let newApiVolume = Math.round(parseFloat(value) + 80);
                return 'MV' + newApiVolume;
            },
            'PutZone_InputFunction': (value) => 'SI' + value
        };

        let denonCommand = commandMap[command] ? commandMap[command](arg) : command + arg;
        let url = this.baseUrl + 'goform/formiPhoneAppDirect.xml?' + denonCommand;

        let request = Soup.Message.new('GET', url);
        this.httpSession.send_async(request, 0, null, null);
    }

    parseStatusResponse(text) {
        let nameMatch = text.match(/<cmd>[\s\S]*?<zone1>([^<]+)<\/zone1>/);
        let powerMatches = text.match(/<cmd>[\s\S]*?<zone1>([^<]+)<\/zone1>[\s\S]*?<\/cmd>[\s\S]*?<cmd>[\s\S]*?<zone1>([^<]+)<\/zone1>/);
        let powerStatus = powerMatches ? powerMatches[2] : 'OFF';

        let sourceMatch = text.match(/<cmd>[\s\S]*?<zone1>[\s\S]*?<source>([^<]+)<\/source>/);

        let volumeMatch = text.match(/<cmd>[\s\S]*?<zone1>[\s\S]*?<volume>([^<]+)<\/volume>/);

        return {
            name: nameMatch[1].trim(),
            power: powerStatus.toUpperCase() === 'ON',
            volume: parseFloat(volumeMatch[1]),
            input: sourceMatch ? sourceMatch[1] : 'UNKNOWN'
        };
    }
}

const SliderItem = GObject.registerClass(
class SliderItem extends PopupMenu.PopupImageMenuItem
{
    _init(value, icon, params)
    {
        super._init('', icon, params);
        this.slider = new Slider.Slider(value);
        this.add_child(this.slider);
    }

    setValue(value)
    {
        if (this.slider != undefined)
        {
            this.slider.value = value;
        }
    }

    getValue()
    {
        if (this.slider != undefined)
        {
            return this.slider._getCurrentValue();
        }
        else
        {
            return 0;
        }
    }

    connect(signal, callback)
    {
        this.slider?.connect(signal, callback);
    }
});

const VolumeSlider = GObject.registerClass(
class VolumeSlider extends SliderItem
{
    _init(volume, params)
    {
        super._init(0, '', params); // value MUST be specified!

        this._volume_min = -80;
        this._volume_max = 18;

        this.setIcon('audio-volume-medium-symbolic');
        this.setVolume(volume); // Set the real value.
    }

    setVolume(volume)
    {
        this.setValue((volume - this._volume_min) / (this._volume_max - this._volume_min));
    }

    getVolume()
    {
        let value = this.getValue() * (this._volume_max - this._volume_min) + this._volume_min;
        let volume = Math.floor(value);
        if (value - volume >= 0.5)
        {
            volume += 0.5;
        }

        return volume;
    }

    changeIcon()
    {
        let value = this.getValue();

        if (value == 0)
        {
            this.setIcon('audio-volume-muted-symbolic');
        }
        else if (value < 0.3)
        {
            this.setIcon('audio-volume-low-symbolic');
        }
        else if (value < 0.7)
        {
            this.setIcon('audio-volume-medium-symbolic');
        }
        else
        {
            this.setIcon('audio-volume-high-symbolic');
        }
    }
});

const InputMenuItem = GObject.registerClass(
class InputMenuItem extends PopupMenu.PopupBaseMenuItem
{
    _init(extension, name, value, selected)
    {
        super._init();
        this.extension = extension;
        this._text = name;
        this._value = value;
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        if (selected)
        {
            this.icon = new St.Icon({ icon_name: 'radio-checked-symbolic', style_class: 'popup-menu-icon' });
        }
        else
        {
            this.icon = new St.Icon({ icon_name: 'radio-symbolic', style_class: 'popup-menu-icon' });
        }

        this.box.add_child(this.icon);
        this.label = new St.Label({ text: " " + name });
        this.box.add_child(this.label);

        this.add_child(this.box);

        this.connect('activate', () => { this._click(); });
    }

    _click()
    {
        this.extension.sendCommand('PutZone_InputFunction', this._value.replace(' ', '%20'));
    }
});

const DenonAVRindicator = GObject.registerClass(
class DenonAVRindicator extends PanelMenu.Button
{
    _init(extension)
    {
        super._init(0.0, IndicatorName);
        this.extension = extension;

        this.icon = new St.Icon({ icon_name: 'audio-speakers-symbolic', style_class: 'system-status-icon' });
        this.add_child(this.icon);

        this.powerButton = new PopupMenu.PopupSwitchMenuItem('AVR', false);
        this.menu.addMenuItem(this.powerButton);

        this.volumeSlider = new VolumeSlider(-33);
        this.menu.addMenuItem(this.volumeSlider);

        this.inputSubMenu = new PopupMenu.PopupSubMenuMenuItem("", true);
        this.menu.addMenuItem(this.inputSubMenu);

        this.menu.connect('open-state-changed', (menu, open) => { this._updateStatus(menu, open); });

        this.powerButton.connect('toggled', (item, state) => { this._togglePowerButton(item, state); });
        this.volumeSlider.connect('notify::value', () => { this._changeVolume(); });
    }

    _togglePowerButton(item, state)
    {
        if (state)
        {
            this.extension.sendCommand('PutSystem_OnStandby', 'ON');
        }
        else
        {
            this.extension.sendCommand('PutSystem_OnStandby', 'STANDBY');
        }
    }

    _changeVolume()
    {
        let volume = this.volumeSlider.getVolume().toString();

        this.extension.sendCommand('PutMasterVolumeSet', volume);

        this.volumeSlider.changeIcon();
    }

    _updateStatus(menu, open)
    {
        if (open)
        {
            this.loadSettings();

            this.extension.api.getStatus().then(status => {
                this.powerButton.label.text = status.name;
                this.powerButton.setToggleState(status.power);
                this.volumeSlider.setVolume(status.volume);
                this.inputSubMenu.label.text = status.input;

                // called here because it needs this.inputSubMenu.label.text to be set
                this._getInputFuncList();
            });
        }
    }

    _getInputFuncList()
    {
        // values seems impossible to retrive from the AVR, so this list is hardcoded
        let inputs = [
            { name: "CBL/SAT", value: "SAT/CBL" },
            { name: "DVD", value: "DVD" },
            { name: "Blu-ray", value: "BD" },
            { name: "GAME", value: "GAME" },
            { name: "AUX", value: "AUX1" },
            { name: "Media Player", value: "MPLAY" },
            { name: "iPod/USB", value: "USB/IPOD" },
            { name: "TUNER", value: "TUNER" },
            { name: "NETWORK", value: "NET" },
            { name: "TV AUDIO", value: "TV" },
            { name: "Bluetooth", value: "BT" },
            { name: "Internet Radio", value: "IRADIO" },
        ];

        this.inputSubMenu.menu.removeAll();
        for (const input of inputs)
        {
            let menuItem = new InputMenuItem(this.extension, input.name, input.value, input.name == this.inputSubMenu.label.text)
            this.inputSubMenu.menu.addMenuItem(menuItem);
        }
    }

    stop()
    {
        this.menu.removeAll();
    }

    loadSettings()
    {
        this.settings = this.extension.getSettings("org.gnome.shell.extensions.denon-avr-controler");
        baseUrl = this.settings.get_value('avr-url').unpack();
    }
});

export default class DenonAVRControlerExtension extends Extension
{
    enable()
    {
        this.httpSession = new Soup.Session();
        this._indicator = new DenonAVRindicator(this);
        this._indicator.loadSettings();
        this._initializeAPI();
        Main.panel.addToStatusArea(IndicatorName, this._indicator);
    }

    disable()
    {
        this._indicator?.stop();
        this._indicator?.destroy();
        this._indicator = null;

        this.httpSession?.abort();
        this.httpSession = null;
        this.api = null;
    }

    _initializeAPI()
    {
        let settings = this.getSettings("org.gnome.shell.extensions.denon-avr-controler");
        let apiType = settings.get_value('api-type')?.unpack() || 'old';

        if (apiType === 'new') {
            this.api = new NewDenonAPI(baseUrl, this.httpSession);
        } else {
            this.api = new OldDenonAPI(baseUrl, this.httpSession);
        }
    }

    sendCommand(command, arg)
    {
        this.api.runCommand(command, arg);
    }
}
