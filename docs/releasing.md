# Releasing

1. Set the version in `package.json`, `addon/manifest.json`, and `src/upstream/config.ts`.
2. Run the checks in [Development](development.md), build, and test the package in Zotero.
3. Tag the tested source as `v<version>` and create a GitHub Release from that tag.
4. Upload `refolio-<version>.xpi`, `refolio-source-<version>.zip`, `updates.json`, and `SHA256SUMS.txt` from `dist/`. Use `application/x-xpinstall` for the XPI asset.
5. Publish the release as the latest stable version and verify the [update manifest](https://github.com/NebulaRaven/zotero-refolio/releases/latest/download/updates.json) and its XPI download.

The build generates the update manifest from the packaged version, compatibility range, and XPI checksum. Keep the plugin ID stable across releases. Zotero uses the user's automatic-update preference.

## Community catalog

Register the public repository in [Zotero Addons Scraper](https://github.com/syt2/zotero-addons-scraper) with `addons/NebulaRaven@zotero-refolio`:

```json
{"tags": ["metadata", "interface"]}
```

After the entry is merged, the scraper collects later releases automatically. The XPI content type above lets it distinguish the plugin from the source ZIP.

The Chinese store's documentation comes from [Zotero Chinese Wiki](https://github.com/zotero-chinese/wiki). The documentation page uses `plugin: NebulaRaven/zotero-refolio` in its frontmatter to link it to the store entry.
