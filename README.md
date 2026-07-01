# Sjósund Nauthólsvík – Render-ready útgáfa

Þessi útgáfa er tilbúin fyrir Render.

## Render stillingar

- Service type: Web Service
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: Free eða Starter

## Skrár

- `server.js` — vefþjónn og API
- `index.html` — appið sjálft
- `package.json` — Render notar þetta til að keyra `npm start`
- `render.yaml` — valfrjáls Blueprint-stilling
- `manifest.json` — PWA grunnur

## Prófun local

Ef þú vilt prófa á tölvu:

```bash
npm start
```

Opna:

```text
http://localhost:3050
```

Á Render færðu slóð eins og:

```text
https://sjosund-nautholsvik.onrender.com
```
