# Development

## Build

Requires Node.js 24 or later and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm run build
```

The XPI, source archive, update manifest, checksums, and runtime bundle are written to `dist/`.

## Test

```sh
pnpm run typecheck
pnpm test
pnpm run check
```

These commands check types, run tests, and validate the bundled source without installing a plugin.

On Windows, `scripts/test-in-zotero.cmd` starts native tests in a separate Zotero profile and empty library. Results are saved in the test directory recorded by `native-test-location.json`. To update an open test instance, run:

```sh
node scripts/native-smoke.mts --update
```

## Translations

Interface strings use Zotero's Fluent system. Edit `addon/locale/<locale>/stylepersonal-addon.ftl` and call `getString()` from `src/upstream/utils/locale.ts`. Use variables for dynamic values and keep message keys and variables in sync across all locales.

Refolio follows Zotero's interface language and falls back to `en-US`.

Run the tests after changing translations; they check Fluent syntax, message coverage, interpolation variables, and fallback behavior.

For release preparation and community catalog registration, see [Releasing](releasing.md).
