# Sjósund Nauthólsvík – v26 loose Tide-Forecast parser

Þessi útgáfa notar víðari parser fyrir Tide-Forecast.

## Hvað breyttist?
Parserinn leitar nú einfaldlega að:
- Low Tide / High Tide
- tíma
- næstu hæð í metrum

Hann er ekki lengur háður nákvæmri röð á `m` og `ft`.

## Prófun eftir deploy

Opna:

```text
/api/tides?v=26
```

Þar á að sjást:

```json
"source": "Tide-Forecast"
```

og `date` dagsins.
