/* -*- Mode: js2; indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*-  */
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

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

// Other javascript files in the Denon_AVR_controler@sylter.fr directory are accesible via Extension.<file name>
const Extension = imports.ui.extensionSystem.extensions['Denon_AVR_controler@sylter.fr'];

const IndicatorName = "DenonAVRindicator";

let denonAVRindicator;
let httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());

// borrowed from: https://github.com/eonpatapon/gnome-shell-extensions-mediaplayer
const SliderItem = new Lang.Class(
{
    Name: 'SliderItem',
    Extends: PopupMenu.PopupImageMenuItem,

    _init: function(value, icon)
    {
        this.parent("", icon);
        var layout = new Clutter.TableLayout();
        this._box = new St.Widget({
							style_class: 'slider-item',
							layout_manager: layout});

        this._slider = new Slider.Slider(value);

        layout.pack(this._slider.actor, 2, 0);
        this.actor.add(this._box, {span: -1, expand: true});
    },

    setValue: function(value)
    {
        this._slider.setValue(value);
    },

    getValue: function()
    {
        return this._slider._getCurrentValue();
    },

    connect: function(signal, callback)
    {
        this._slider.connect(signal, callback);
    }
});

const VolumeSlider = new Lang.Class(
{
    Name: 'VolumeSlider',
    Extends: SliderItem,

    _VOLUME_MIN: -80,
    _VOLUME_MAX: 18,

    _init: function(volume)
    {
        this.parent(0, ''); // value MUST be specified!
        this.setVolume(volume); // Set the real value.
        this.setIcon("audio-volume-medium-symbolic");
    },

    setVolume: function(volume)
    {
        this.setValue((volume - this._VOLUME_MIN) / (this._VOLUME_MAX - this._VOLUME_MIN));
    },

    getVolume: function()
    {
        let value = this.getValue() * (this._VOLUME_MAX - this._VOLUME_MIN) + this._VOLUME_MIN;
        let volume = Math.floor(value);
        if (value - volume >= 0.5)
        {
            volume += 0.5;
        }
        
        return volume;
    },

    changeIcon()
    {
        let value = this.getValue();
        if (value == 0)
        {
            this.setIcon("audio-volume-muted-symbolic");
        }
        else if (value < 0.3)
        {
            this.setIcon("audio-volume-low-symbolic");
        }
        else if (value < 0.7)
        {
            this.setIcon("audio-volume-medium-symbolic");
        }
        else
        {
            this.setIcon("audio-volume-high-symbolic");
        }
    }
});

/**
 * A simple label which only displays the given text.
 * @type {Lang.Class}
 */
const LabelWidget = new Lang.Class({
    Name: "LabelWidget",
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function(text){
        this.parent({
            reactive: false // Can't be focused/clicked.
        });

        this._label = new St.Label({
            text: text
        });

        this.actor.add_child(this._label);
    },

    /**
     * Set the text for this label.
     * @param text the new text.
     */
    setText: function(text){
        this._label.text = text;
    }
});

const DenonAVRindicator = new Lang.Class(
{
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _init: function()
    {
        this.parent(0.0, IndicatorName);

        this.icon = new St.Icon({icon_name: 'audio-speakers-symbolic', style_class: 'system-status-icon'});
        this.actor.add_child(this.icon);

        this.powerButton = new PopupMenu.PopupSwitchMenuItem("AVR", false);
        this.volumeSlider = new VolumeSlider(-33);
        this.volumeLabel = new LabelWidget(this.volumeSlider.getVolume().toString());
        
        this.menu.addMenuItem(this.powerButton);
        this.menu.addMenuItem(this.volumeSlider);
        this.menu.addMenuItem(this.volumeLabel);
        this.menu.connect('open-state-changed', Lang.bind(this, this._updateStatus));

        this.powerButton.connect("toggled", Lang.bind(this, this._togglePowerButton));
        this.volumeSlider.connect('value-changed', Lang.bind(this, this._changeVolume));
    },

    _togglePowerButton: function(item, state)
    {
        if (state)
        {
            this._sendCommand("PutSystem_OnStandby", "ON");
        }
        else
        {
            this._sendCommand("PutSystem_OnStandby", "STANDBY");
        }
    },

    _changeVolume: function()
    {
        let volume = this.volumeSlider.getVolume().toString();

        this._sendCommand("PutMasterVolumeSet", volume);
        
        this.volumeLabel.setText(volume);
        this.volumeSlider.changeIcon();
    },

    _sendCommand: function(command, arg)
    {
        let url = 'http://192.168.1.6/MainZone/index.put.asp?cmd0=' + command + '%2F' + arg;
            
        // create an http message
        let request = Soup.Message.new('GET', url);
        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {}));
    },

    _updateStatus: function(menu, open)
    {
        if (open)
        {
            let url = 'http://192.168.1.6/goform/formMainZone_MainZoneXml.xml';
            let request = Soup.Message.new('GET', url);
            httpSession.queue_message(request, Lang.bind(this, this._parseResponse));
        }
    },

    _parseResponse: function (httpSession, message)
    {
        if (message.status_code = 200)
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
            this.volumeLabel.setText(this.volumeSlider.getVolume().toString())
        }
    },

    stop: function()
    {
        this.menu.removeAll();
    }
});

function enable()
{
    denonAVRindicator = new DenonAVRindicator();
    Main.panel.addToStatusArea(IndicatorName, denonAVRindicator);
}

function disable()
{
    denonAVRindicator.stop();
    denonAVRindicator.destroy();
}