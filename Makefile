SRCDIR = ./src
UUID = $(shell grep uuid $(SRCDIR)/metadata.json | cut -d '"' -f 4)
BUILDDIR = ./target/$(UUID)
GSC = glib-compile-schemas --targetdir=$(BUILDDIR)/schemas
RESOURCES = $(SRCDIR)/metadata.json $(SRCDIR)/Settings.ui $(SRCDIR)/stylesheet.css

all: zip

clean:
	rm -rf ./target
	rm $(UUID).zip

gschemas: $(SRCDIR)/schemas/*
	mkdir -p $(BUILDDIR)/schemas
	$(GSC) $(SRCDIR)/schemas

resources: $(RESOURCES)
	cp -f $(RESOURCES) $(BUILDDIR)/

sources: $(SRCDIR)/*.js
	cp -f $(SRCDIR)/*.js $(BUILDDIR)/

zip: gschemas resources sources
	cd $(BUILDDIR) ; \
	zip -qr "$(UUID).zip" .
	mv $(BUILDDIR)/$(UUID).zip .

install: zip
	mkdir -p ~/.local/share/gnome-shell/extensions/
	unzip -q $(UUID).zip -d ~/.local/share/gnome-shell/extensions/$(UUID)

uninstall: 
	rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)

test:
	env MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080 dbus-run-session -- gnome-shell --nested
