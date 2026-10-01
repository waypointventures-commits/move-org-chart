# MOVE org chart

A team-facing display of the MOVE Private Fitness organisation: who sits where and who reports to whom. Static site, no build step.

- `index.html`, `styles.css`, `app.js`: the page.
- `data/org.json`: the chart itself. Edit this file to change a name, a seat or a reporting line; the page redraws from it.
- `assets/`: brand logo and the Metropolis Bold typeface (public domain). Plus Jakarta Sans is loaded from Google Fonts.

The master record of the structure is the operating-model repo (`architecture/07-org-structure.md`). Change it there first, then mirror the change into `data/org.json` and update the `updated` date.

Hosted with GitHub Pages from the `main` branch. The page carries a `noindex` tag and a `robots.txt` so search engines do not list it, but anyone with the link can open it.
