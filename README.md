# Sjósund Nauthólsvík – v24 robust Tide-Forecast parser

Þessi útgáfa lagar villuna þar sem appið datt í gamla 30. júní fallback-töflu.

## Hvað breyttist?
- `server.js` les nú betur núverandi texta frá Tide-Forecast:
  `Low Tide 1:20 AM ... (0.81 m)`
- Appið skilar ekki lengur gamalli fastri flóðatöflu.
- Ef parser nær ekki 4 viðburðum skilar `/api/tides` villu í stað rangra gagna.
- Cache headers eru `no-store`.

## Render
Hlaðið þessum skrám inn á GitHub og deployið nýjasta commit:
- index.html
- server.js
- package.json
- render.yaml
- manifest.json
- README.md
