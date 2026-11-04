"""Génère scene.html à partir du gabarit, en y injectant les logos QuelBus."""
import pathlib

here = pathlib.Path(__file__).parent
logos = here.parent.parent / 'Maquette/logo'
html = (here / 'scene.template.html').read_text()
html = html.replace('{{LOGO}}', (logos / 'quelbus-logo.svg').read_text())
html = html.replace('{{LOGO_DARK}}', (logos / 'quelbus-logo-fond-sombre.svg').read_text())
(here / 'scene.html').write_text(html)
print('scene.html prêt')
