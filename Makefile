SRCDIR = ./src
UUID = $(shell grep uuid $(SRCDIR)/metadata.json | cut -d '"' -f 4)
VERSION = $(shell grep \"version\" $(SRCDIR)/metadata.json | grep -oP '\d+')
BUILDDIR = ./target/$(UUID)
GSC = glib-compile-schemas --targetdir=$(BUILDDIR)/schemas
RESOURCES = $(SRCDIR)/metadata.json

all: zip

clean:
	rm -rf ./target
	rm $(UUID)-v*.zip

gschemas: $(SRCDIR)/schemas/*
	mkdir -p $(BUILDDIR)/schemas
	cp $(SRCDIR)/schemas/* $(BUILDDIR)/schemas/
	$(GSC) $(SRCDIR)/schemas

resources: $(RESOURCES)
	cp -f $(RESOURCES) $(BUILDDIR)/

sources: $(SRCDIR)/*.js
	cp -f $(SRCDIR)/*.js $(BUILDDIR)/

zip: gschemas resources sources
	cd $(BUILDDIR) ; \
	zip -qr "$(UUID)-v$(VERSION).zip" .
	mv $(BUILDDIR)/$(UUID)-v$(VERSION).zip .

install: zip
	mkdir -p ~/.local/share/gnome-shell/extensions/
	unzip -oq $(UUID)-v$(VERSION).zip -d ~/.local/share/gnome-shell/extensions/$(UUID)

uninstall: 
	rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)

test: install
	env MUTTER_DEBUG_DUMMY_MODE_SPECS=1680x1050 dbus-run-session -- gnome-shell --nested
