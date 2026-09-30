# Refolio

[![Zotero 10](https://img.shields.io/badge/Zotero-10-CC2936?style=flat-square)](https://www.zotero.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square)](docs/development.md)
[![AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE)

[English](README.md) · 简体中文

**在 Zotero 中查看期刊评级、探索文献关系、辅助阅读。**

Refolio 是面向 Zotero 10 的 [Ethereal Style](https://github.com/MuiseDestiny/zotero-style) 完全开源分支，插件代码已完整迁移至 TypeScript。

[主要功能](#主要功能) · [相较-style-的改进](#相较-style-的改进) · [开始使用](#开始使用)

## 主要功能

| 功能 | 用途 |
| --- | --- |
| **期刊评级** | 在文献列表显示影响因子、JCR 分区和其他评级，支持手动补充与选择显示字段。 |
| **文献图谱** | 查看有方向的引用关系、共同作者与标签和笔记链接；支持查询或手动添加引用、按年份筛选，并选择显示的分类。 |
| **学术谱系** | 查询 Wikidata 中的导师与学生关系，也可以在本地建立和编辑谱系。 |
| **文献整理** | 管理层级标签、文献评分和阅读状态，自定义列表列，并切换已保存的布局。 |
| **阅读辅助** | 调整 PDF 样式与批注颜色，按需开启阅读时间记录。 |

## 相较 Style 的改进

- **期刊匹配更完整。** 内置北大核心、CSSCI 和 CSCD 的[中英文刊名目录](data/README.md)；数据服务使用不同刊名时，可以手动指定查询名称。
- **期刊标签可以自行调整。** 支持补充、覆盖或隐藏单项评级；查询结果有冲突时，显示各来源及采用值。
- **文献关系更便于探索。** 引用方向与 Zotero 关联条目一并保存，支持手动建立引用关系，也可在新增文献时更新。提供学术谱系、关系筛选和画布大小调整，适配深浅主题。
- **设置集中管理。** 每个功能的开关和参数放在一起，并附一句说明；可以直接用 Zotero 设置窗口的搜索框查找任何一项。阅读时间记录按需启用，默认关闭。
- **更贴合 Zotero 10。** 使用原生颜色与控件，减少重复刷新，改进标签编辑、拖拽和视图切换。

## 开始使用

从[最新版本](https://github.com/NebulaRaven/zotero-refolio/releases/latest)下载 `.xpi` 安装包。

1. 在 Zotero 中打开 **工具 → 插件**。如果已安装 Style，先将其停用。
2. 点击齿轮菜单，选择 **从文件安装插件…**，选中 Refolio 的 `.xpi` 安装包。
3. 打开 **工具 → Refolio · 功能设置**，选择需要的功能。
4. 查询在线期刊评级时，选择 **EasyScholar** 或 **Garden** 并填写对应的 API 密钥；在 **查看 → 列** 中启用需要显示的列。

功能开关更改后需重启 Zotero，期刊和图谱设置即时生效。

需要调整期刊标签时，右键文献，选择 **Refolio → 编辑期刊评级…**，也可以在设置面板中打开 **期刊设置**。每个字段可选择 **手动**、**自动** 或 **隐藏**；**查询刊名** 用于指定在线检索使用的名称。

## 参与开发

构建、测试和翻译说明见[开发指南](docs/development.md)。

## 致谢与许可证

基于 Polygon / MuiseDestiny 的 Ethereal Style，以及 windingwind 和 MuiseDestiny 的 [zotero-addon-template](https://github.com/MuiseDestiny/zotero-addon-template/tree/bootstrap)。

使用 [AGPL-3.0-or-later](LICENSE) 许可证。
