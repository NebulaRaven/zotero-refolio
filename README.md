# Refolio

[![Zotero 10](https://img.shields.io/badge/Zotero-10-CC2936?style=flat-square)](https://www.zotero.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square)](docs/development.md)
[![AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE)

English · [简体中文](README.zh-CN.md)

**Journal metrics, literature graphs, and reading tools for Zotero.**

Refolio is a fully open-source fork of [Ethereal Style](https://github.com/MuiseDestiny/zotero-style) for Zotero 10, with the plugin codebase fully migrated to TypeScript.

[Features](#features) · [Improvements over Style](#improvements-over-style) · [Getting started](#getting-started)

## Features

| Feature | What you can do |
| --- | --- |
| **Journal metrics** | Show impact factors, JCR quartiles, and other journal ratings in your library. Add your own values and choose which labels to display. |
| **Literature graphs** | Explore directed citations, shared authors and tags, and note links. Fetch or add citations, filter by year, and choose which views to show. |
| **Academic genealogy** | Explore mentor–student relationships from Wikidata, or build and edit your own local genealogy. |
| **Library organization** | Organize nested tags, rate papers, mark reading status, customize columns, and switch between saved layouts. |
| **Reading tools** | Adjust PDF appearance, customize annotation colors, and enable reading-time tracking when you need it. |

## Improvements over Style

- **More complete journal matching.** A [built-in directory](data/README.md) connects English and Chinese titles from PKU Core, CSSCI, and CSCD. Set a custom query title when a journal uses a different name in the data service.
- **Control over journal labels.** Add, override, or hide individual ratings. Conflicting query results show their sources and the value being used.
- **More ways to explore connections.** Save directed citations and Zotero related items together, with manual linking and optional updates when adding papers. Explore genealogy, filter connections, and use a resizable canvas in light or dark themes.
- **One place for settings.** Search for features and adjust their switches in a single panel. Reading-time tracking is optional and off by default.
- **A smoother Zotero 10 experience.** Native colors and controls, fewer repeated refreshes, and improved tag editing, dragging, and view switching.

## Getting started

Download the `.xpi` from the [latest release](https://github.com/NebulaRaven/zotero-refolio/releases/latest).

1. In Zotero, open **Tools → Plugins**. Disable Style if it is installed.
2. Click the gear menu, choose **Install Plugin From File…**, and select the Refolio `.xpi` package.
3. Open **Tools → Refolio · Settings** to choose your features.
4. For online journal metrics, select **EasyScholar** or **Garden** and enter the service's API key. Enable the columns you want under **View → Columns**.

Restart Zotero after changing feature switches. Journal and graph settings apply immediately.

To adjust a journal, right-click a paper and choose **Refolio → Edit journal labels…**, or open **Journal settings** in Refolio's settings panel. Use **Manual**, **Automatic**, or **Hide** for each field. The **Query journal name** field lets you choose the name used for online lookup.

## Development

See the [development guide](docs/development.md) for building, testing, and contributing translations.

## Credits and license

Based on Ethereal Style by Polygon / MuiseDestiny and [zotero-addon-template](https://github.com/MuiseDestiny/zotero-addon-template/tree/bootstrap) by windingwind and MuiseDestiny.

Licensed under [AGPL-3.0-or-later](LICENSE).
