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

const Lang = imports.lang;
const { Clutter, St, Soup, GObject, Gio } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

// Other javascript files in the Denon_AVR_controler@sylter.fr directory are
// accesible via Me.<file name>
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const IndicatorName = 'DenonAVRindicator';

let denonAVRindicator;
let httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());

let baseUrl;

var SliderItem = GObject.registerClass(
class SliderItem extends PopupMenu.PopupImageMenuItem
{
    _init(value, icon, params)
    {
        super._init('', icon, params);
        this.slider = new Slider.Slider(value);

        let layout = new Clutter.TableLayout();
        this._box = new St.Widget({
            style_class: 'slider-item',
            layout_manager: layout
        });

        layout.pack(this.slider.actor, 2, 0);
        this.actor.add(this._box, {span: -1, expand: true});
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
        if (this.slider != undefined)
        {
            this.slider.connect(signal, callback);
        }
    }
});

var VolumeSlider = GObject.registerClass(
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

/**
 * A simple label which only displays the given text.
 *
 * @type {Lang.Class}
 */
var LabelWidget = GObject.registerClass(
class LabelWidget extends PopupMenu.PopupBaseMenuItem
{
    _init(text)
    {
        super._init({reactive: false});

        this._label = new St.Label({text: text});

        this.actor.add_child(this._label);
    }

    /**
     * Set the text for this label.
     *
     * @param text
     *            the new text.
     */
    setText(text)
    {
        this._label.text = text;
    }
});

var DenonAVRindicator = GObject.registerClass(
class DenonAVRindicator extends PanelMenu.Button
{
    _init()
    {
        super._init(0.0, IndicatorName);

        this.icon = new St.Icon({icon_name: 'audio-speakers-symbolic', style_class: 'system-status-icon'});
        this.actor.add_child(this.icon);

        this.powerButton = new PopupMenu.PopupSwitchMenuItem('AVR', false);
        this.volumeSlider = new VolumeSlider(-33);
        this.volumeLabel = new LabelWidget(this.volumeSlider.getVolume().toString());

        this.menu.addMenuItem(this.powerButton);
        this.menu.addMenuItem(this.volumeSlider);
        this.menu.addMenuItem(this.volumeLabel);
        this.menu.connect('open-state-changed', Lang.bind(this, this._updateStatus));

        this.powerButton.connect('toggled', Lang.bind(this, this._togglePowerButton));
        this.volumeSlider.connect('notify::value', Lang.bind(this, this._changeVolume));
    }

    _togglePowerButton(item, state)
    {
        if (state)
        {
            this._sendCommand('PutSystem_OnStandby', 'ON');
        }
        else
        {
            this._sendCommand('PutSystem_OnStandby', 'STANDBY');
        }
    }

    _changeVolume()
    {
        let volume = this.volumeSlider.getVolume().toString();

        this._sendCommand('PutMasterVolumeSet', volume);

        this.volumeLabel.setText(volume);
        this.volumeSlider.changeIcon();
    }

    _sendCommand(command, arg)
    {
        let url = baseUrl + 'MainZone/index.put.asp?cmd0=' + command + '%2F' + arg;

        // create an http message
        let request = Soup.Message.new('GET', url);
        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {}));
    }

    _updateStatus(menu, open)
    {
        if (open)
        {
            this.loadSettings();

            let url = baseUrl + 'goform/formMainZone_MainZoneXml.xml';
            let request = Soup.Message.new('GET', url);
            httpSession.queue_message(request, Lang.bind(this, this._parseResponse));
        }
    }

    _parseResponse(httpSession, message)
    {
        if (message.status_code == 200)
        {
            let data = message.response_body.data;

            let regexName = new RegExp('<FriendlyName><value>(.+)<\/value><\/FriendlyName>', 'g');
            let regexPower = new RegExp('<ZonePower><value>([A-Z]+)<\/value><\/ZonePower>', 'g');
            let regexVolume = new RegExp('<MasterVolume><value>(\-?[0-9.]+)<\/value><\/MasterVolume>', 'g');

            let name = regexName.exec(data)[1];
            let state = regexPower.exec(data)[1] == 'ON';
            let volume = regexVolume.exec(data)[1];

            this.powerButton.label.text = name;
            this.powerButton.setToggleState(state);
            this.volumeSlider.setVolume(volume);
            this.volumeLabel.setText(this.volumeSlider.getVolume().toString());
        }
    }

    stop()
    {
        this.menu.removeAll();
    }

    loadSettings()
    {
        let gschema = Gio.SettingsSchemaSource.new_from_directory(Me.dir.get_child('schemas').get_path(),
                Gio.SettingsSchemaSource.get_default(), false);

        this.settings = new Gio.Settings({
            settings_schema: gschema.lookup('org.gnome.shell.extensions.denon-avr-controler', true)
        });

        baseUrl = this.settings.get_value('avr-url').unpack();
    }
});

function enable()
{
    denonAVRindicator = new DenonAVRindicator();
    denonAVRindicator.loadSettings();
    Main.panel.addToStatusArea(IndicatorName, denonAVRindicator);
}

function disable()
{
    denonAVRindicator.stop();
    denonAVRindicator.destroy();
}
