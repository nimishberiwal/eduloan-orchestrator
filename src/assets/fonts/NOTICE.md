# Font licences

Two variable web fonts are vendored here, latin subset only, so the prototype
has no external dependency and the standalone HTML build works offline.

Both are licensed under the **SIL Open Font License 1.1**, which permits
redistribution and bundling provided this notice travels with them.

| File | Family | Copyright | Licence |
|---|---|---|---|
| `inter-latin-var.woff2` | Inter | Copyright (c) 2016 The Inter Project Authors | [SIL OFL 1.1](https://openfontlicense.org) |
| `source-sans-3-latin-var.woff2` | Source Sans 3 | Copyright (c) 2010–2023 Adobe Systems Incorporated | [SIL OFL 1.1](https://openfontlicense.org) |

Upstream sources:

- Inter — <https://github.com/rsms/inter>
- Source Sans 3 — <https://github.com/adobe-fonts/source-sans>

Neither font is a Reserved Font Name usage: the files are unmodified latin
subsets served under their own family names. The CSS aliases them as
`'Inter Glib'` and `'Source Sans Glib'` purely to avoid colliding with any
system-installed copy — see `src/fonts.css`.

`BUILD_FONTS=none` skips loading them entirely and falls back to the system
stack, which is the mode the standalone build ships.
