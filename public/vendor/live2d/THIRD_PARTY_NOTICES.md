# Live2D browser runtime notices

These three unmodified browser distributions were copied from the existing local
white-haired Mio 1.1.2 release package, `web/vendor/`, on 2026-11-08. They are third
party runtime distributions, not handwritten application code.

- `pixi.min.js`: PixiJS 6.5.10. MIT license, Mathew Groves and Chad Engler.
  See `PIXI-LICENSE.txt`; the original distribution's header is retained.
- `cubism4.min.js`: pixi-live2d-display Cubism 4 browser distribution. MIT license,
  Guan. See `PIXI-LIVE2D-DISPLAY-LICENSE.txt`. It also contains the Cubism Web
  framework adapter, subject to the Live2D Open Software License agreement:
  https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html
- `live2dcubismcore.min.js`: Live2D Cubism Core. Copyright Live2D Inc. The original
  header designates this file as Redistributable Code under the Live2D Proprietary
  Software License Agreement. See `LIVE2D-CORE-LICENSE.md` and its agreement links.

The character model previously distributed under `/live2d/mio/` was removed from
this client on 2026-11-08. Character assets remain separate from these runtimes
and retain their existing ownership and licensing; this project does not relicense
the character or Cubism Core under MIT.

Asset checksums and source notes are maintained in `docs/brand/agent-appearance-*`.
