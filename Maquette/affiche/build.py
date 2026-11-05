"""Affiche « correspondances » : story 1080×1920 et publication 1080×1350, à partir d'un seul gabarit.

    python3 build.py        # écrit correspondances-story.html et correspondances-post.html
    node render.js          # (dans ce dossier) → correspondances-story.png et correspondances-post.png
"""
import pathlib

here = pathlib.Path(__file__).parent
logo = (here.parent / 'logo/quelbus-logo-fond-sombre.svg').read_text().replace('<svg ', '<svg class="logo" ', 1)

FORMATS = {
    # nom : (hauteur, réglages) ; la story garde le haut et le bas libres pour l'interface des réseaux
    'story': (1920, 'pad:230px 84px 0; h1:94px; gap:56px; stop:42px; route:44px; sub:36px'),
    'post': (1350, 'pad:60px 72px 0; h1:72px; gap:32px; stop:34px; route:36px; sub:30px'),
}

TEMPLATE = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<!-- Généré par build.py : modifier le gabarit dans ce fichier, pas le HTML. -->
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; }
  :root { --ink: #1a1613; --cream: #faf7f2; --accent: #ce5b22; --accent-ink: #9e4014; --peach: #f0a27a; --muted: #6b6259; --ok: #2f7d4a;
    --pad: PAD; --h1: H1; --gap: GAP; --stop: STOP; --route: ROUTE; --sub: SUB; }
  body { width: 1080px; height: HEIGHTpx; overflow: hidden; position: relative;
    font-family: Archivo, Helvetica, Arial, sans-serif; background: var(--ink); color: var(--cream); }
  .stripes { position: absolute; inset: 0; background: repeating-linear-gradient(-12deg, transparent 0 74px, rgba(255,255,255,.035) 74px 80px); }
  .glow { position: absolute; width: 1100px; height: 1100px; left: 260px; top: 34%; border-radius: 50%;
    background: radial-gradient(circle, rgba(206,91,34,.28), rgba(206,91,34,0) 62%); }
  .wrap { position: relative; height: 100%; padding: var(--pad); display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .logo { height: 54px; width: auto; }
  .new { font-size: 26px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--ink);
    background: var(--peach); padding: 14px 24px; border-radius: 999px; }
  h1 { margin-top: var(--gap); font-size: var(--h1); line-height: 1; font-weight: 900; letter-spacing: -.04em; text-wrap: balance; }
  h1 span { display: block; color: var(--accent); margin-top: 10px; }
  .card { margin-top: var(--gap); background: #fff; color: var(--ink); border-radius: 40px; padding: 40px 44px 36px;
    border: 5px solid var(--accent); box-shadow: 0 40px 80px -30px rgba(0,0,0,.7); }
  .route { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: var(--route); font-weight: 800; letter-spacing: -.02em; }
  .arrow { color: var(--accent); font-weight: 900; }
  .meta { margin-top: 14px; display: flex; gap: 12px; flex-wrap: wrap; }
  .chip { font-size: 24px; font-weight: 700; padding: 10px 18px; border-radius: 999px; background: #f6f1e9; color: var(--muted); }
  .chip.ok { background: #fbefe6; color: var(--accent-ink); }
  .legs { margin-top: 28px; padding-top: 28px; border-top: 3px solid #efe9df; }
  .step, .ride { display: grid; grid-template-columns: 56px 1fr; column-gap: 24px; position: relative; }
  .dot { width: 40px; height: 40px; border-radius: 50%; margin: 6px 8px 0; position: relative; z-index: 1; }
  .board { background: var(--ok); }
  .change { background: #fff; border: 9px solid var(--ink); }
  .end { background: var(--accent); }
  .label { font-size: 22px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .board + div .label { color: var(--ok); }
  .end + div .label { color: var(--accent-ink); }
  .stop { font-size: var(--stop); font-weight: 800; letter-spacing: -.02em; line-height: 1.1; margin-top: 4px; }
  .hint { font-size: 25px; font-weight: 600; color: var(--muted); margin-top: 6px; }
  /* Le trait du trajet relie les arrêts, de la couleur du bus */
  .step.next::after { content: ''; position: absolute; left: 22px; top: 40px; bottom: 0; width: 12px; border-radius: 6px 6px 0 0; background: var(--accent); }
  .bar { width: 12px; margin: 0 auto -14px; border-radius: 0 0 6px 6px; background: var(--accent); }
  .bus { display: flex; align-items: center; gap: 16px; padding: 18px 0 22px; }
  .badge { font-size: 30px; font-weight: 800; padding: 10px 18px; border-radius: 14px; color: #fff; background: var(--accent); }
  .dir { font-size: 27px; font-weight: 600; color: var(--muted); line-height: 1.25; }
  .dir b { color: var(--ink); font-weight: 800; }
  .sub { margin-top: var(--gap); font-size: var(--sub); line-height: 1.3; font-weight: 600; color: #cfc6ba; }
  .sub strong { color: var(--cream); font-weight: 800; }
  .foot { margin-top: 26px; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .url { font-size: 46px; font-weight: 900; letter-spacing: -.02em; color: var(--ink); background: var(--peach); padding: 14px 32px; border-radius: 999px; }
  .free { font-size: 26px; font-weight: 700; color: #cfc6ba; }
</style>
</head>
<body>
  <div class="stripes"></div>
  <div class="glow"></div>
  <div class="wrap">
    <div class="top">LOGO<span class="new">Nouveau</span></div>

    <h1>Pas de bus direct&nbsp;?<span>QuelBus combine les lignes.</span></h1>

    <div class="card">
      <div class="route">Angré <span class="arrow">→</span> Gonzagueville</div>
      <div class="meta">
        <span class="chip ok">1 changement</span>
        <span class="chip">38 arrêts · 107 m à pied</span>
      </div>
      <div class="legs">
        <div class="step next">
          <span class="dot board"></span>
          <div><p class="label">Montez à</p><p class="stop">Petro Ivoire Angré</p></div>
        </div>
        <div class="ride">
          <span class="bar"></span>
          <div class="bus"><span class="badge">775</span><span class="dir"><b>Bus SOTRA</b> direction CHU Treichville · 16&nbsp;arrêts</span></div>
        </div>
        <div class="step next">
          <span class="dot change"></span>
          <div><p class="label">Changez à</p><p class="stop">Pont Lycée Technique</p><p class="hint">Au même arrêt · 45 lignes y passent</p></div>
        </div>
        <div class="ride">
          <span class="bar"></span>
          <div class="bus"><span class="badge">53</span><span class="dir"><b>Bus SOTRA</b> direction Gonzagueville · 22&nbsp;arrêts</span></div>
        </div>
        <div class="step">
          <span class="dot end"></span>
          <div><p class="label">Descendez à</p><p class="stop">Terminus Gonzagueville</p></div>
        </div>
      </div>
    </div>

    <p class="sub">Où monter, <strong>où changer</strong>, où descendre&nbsp;: tout le trajet sur une seule&nbsp;page.</p>
    <div class="foot"><span class="url">quelbus.ci</span><span class="free">Gratuit · sans inscription</span></div>
  </div>
</body>
</html>
'''

for name, (height, settings) in FORMATS.items():
    values = dict(part.split(':', 1) for part in (s.strip() for s in settings.split(';')))
    html = TEMPLATE.replace('LOGO', logo).replace('HEIGHT', str(height))
    for key in ('pad', 'h1', 'gap', 'stop', 'route', 'sub'):
        html = html.replace(key.upper(), values[key], 1) if key != 'h1' else html.replace('H1;', values[key] + ';', 1)
    (here / f'correspondances-{name}.html').write_text(html)
    print(f'correspondances-{name}.html prêt')
