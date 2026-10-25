"""Génère scene.html à partir du gabarit, en y injectant le logotype QuelBus."""
import pathlib
import re

here = pathlib.Path(__file__).parent
logo = (here.parent / 'Maquette/logo/quelbus-logo.svg').read_text()
transform, d = re.findall(r'<path fill="#1A1613" transform="([^"]+)" d="([^"]+)"', logo)[0]
html = (here / 'scene.template.html').read_text().replace('{{WM_T}}', transform).replace('{{WM_D}}', d)
(here / 'scene.html').write_text(html)
print('scene.html prêt')
