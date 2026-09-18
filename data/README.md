# Journal-name directory

`journals.json` contains English and Chinese journal names, aliases, ISSNs, and source records. The name directory is bundled with the plugin. Ratings come from the selected online provider or manual settings.

## Coverage

| Directory | Edition | Source entries |
| --- | --- | ---: |
| PKU Chinese Core | 2023 | 1,987 |
| CSSCI source journals | 2025–2026 | 674 |
| CSCD core | 2025–2026 | 1,120 |
| CSCD extended | 2025–2026 | 384 |

After merging overlaps, the directory contains 2,683 records: 2,512 bilingual, 30 Chinese-only, and 141 English-only. CSSCI uses a university-hosted compilation that includes Hong Kong, Macao, and Taiwan journals; the CSSCI extended list is not included. CSCD core and extended membership are recorded separately.

## Sources

- [PKU Core 2023, university mirror](https://kyc.zjitc.edu.cn/beidazhongwenhexinqikanmulu2023ban.pdf)
- [CSSCI 2025–2026 compilation, Zhejiang University of Science and Technology](https://rwskc.zust.edu.cn/__local/3/CB/3F/ADA3D8675FEDE867F8F7B11E39E_8198B043_2A396.pdf?e=.pdf)
- [CSCD 2025–2026 official directory](https://sciencechina.cn/scichina2/style/sourcelist25_26.pdf), obtained from the [Harbin Medical University library mirror](https://lib.hrbmu.edu.cn/CSCD2025-2026.pdf)
- [CNKI bilingual journal directory mirror](https://www.spsl.nsc.ru/download/ChinaAcadJrnls.pdf) and [WanFang journal navigation](https://c.wanfangdata.com.cn/periodical)
- [Taiwan humanities and social-science journal list](https://www.epc.ntnu.edu.tw/Download.aspx?dir=News&file=50-89-AD-C7-8A-D0-9C-47-A0-74-31-18-13-1F-B0-14.PDF), used to verify names

Each record's `indexes` preserve directory membership, edition, and source row. `nameSources` record name evidence. Missing language names use `null`; distinct journal editions remain separate.

## Matching and maintenance

Lookup starts with the manually configured query title, or the item's publication title when none is set, then adds matching aliases. Custom aliases take priority over the built-in directory. A name matching several distinct journals is not automatically expanded. ISSNs identify directory records; online queries use journal names.

Update the source references alongside name changes and run the project tests.
