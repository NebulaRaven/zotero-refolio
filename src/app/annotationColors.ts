import { setPref,getPref } from "../upstream/utils/prefs.ts";
import { getString } from "../upstream/utils/locale.ts";
import { getElements } from "../upstream/utils/dom.ts";
import { modifyAnnotationColors } from "../upstream/features/annotations/annotationColors.ts";
export async function editAnnotationColors() {
    const deleteSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M202.666667 256h-42.666667a32 32 0 0 1 0-64h704a32 32 0 0 1 0 64H266.666667v565.333333a53.333333 53.333333 0 0 0 53.333333 53.333334h384a53.333333 53.333333 0 0 0 53.333333-53.333334V352a32 32 0 0 1 64 0v469.333333c0 64.8-52.533333 117.333333-117.333333 117.333334H320c-64.8 0-117.333333-52.533333-117.333333-117.333334V256z m224-106.666667a32 32 0 0 1 0-64h170.666666a32 32 0 0 1 0 64H426.666667z m-32 288a32 32 0 0 1 64 0v256a32 32 0 0 1-64 0V437.333333z m170.666666 0a32 32 0 0 1 64 0v256a32 32 0 0 1-64 0V437.333333z" fill="currentColor" p-id="4287"></path></svg>`;
    const renameSVG = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4719" width="16" height="16"><path d="M0 0h1024v1024H0z" fill="#FF4949" fill-opacity="0" p-id="4720"></path><path d="M426.666667 128v0.768a40.426667 40.426667 0 1 1 0 79.317333v0.746667h-136.981334a80.853333 80.853333 0 0 0-80.853333 80.853333V734.293333a80.853333 80.853333 0 0 0 80.853333 80.853334H734.293333a80.853333 80.853333 0 0 0 80.853334-80.853334L815.146667 554.666667c0.064-1.109333 0-2.24 0-3.370667a40.426667 40.426667 0 1 1 80.704 3.370667H896v179.648A161.685333 161.685333 0 0 1 734.314667 896H289.706667A161.685333 161.685333 0 0 1 128 734.314667V289.706667A161.685333 161.685333 0 0 1 289.685333 128H426.666667z m421.034666 20.053333l3.349334 3.370667a42.666667 42.666667 0 0 1 0 60.330667l-316.8 316.8a42.666667 42.666667 0 0 1-60.330667 0l-3.349333-3.370667a42.666667 42.666667 0 0 1 0-60.330667l316.8-316.8a42.666667 42.666667 0 0 1 60.330666 0z" fill="currentColor" ></path></svg>`;
    const dialog = new ztoolkit.Dialog(1, 1).addCell(0, 0, {
      tag: "div",
      styles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "800px",
        height: "620px"
      },
      children: [
      // 上半部分
      {
        tag: "div",
        styles: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          alignItems: "center"
        },
        children: [
        // 颜色设置主区域
        {
          tag: "div",
          styles: {
            display: "flex",
            flexDirection: "row",
            width: "100%"
          },
          children: [
          // 颜色组名称
          {
            tag: "div",
            styles: {
              width: "30%",
              height: "100%",
              padding: ".5em"
            },
            children: [{
              tag: "div",
              styles: {
                display: "flex",
                justifyContent: "space-between",
                marginBottom: ".5em"
              },
              children: [{
                tag: "div",
                properties: {
                  innerText: getString("ui-annotation-groups")
                },
                styles: {
                  fontWeight: "bold",
                  color: "var(--fill-secondary)"
                }
              }, {
                tag: "div",
                id: "new-group",
                classList: ["new"],
                properties: {
                  innerText: getString("ui-new")
                }
              }]
            }, {
              tag: "div",
              id: "groups-container",
              classList: ["container"],
              styles: {
                width: "100%",
                height: "400px",
                backgroundColor: "var(--material-background50)",
                overflowY: "scroll"
              }
            }]
          },
          // 主要配置区域
          {
            tag: "div",
            styles: {
              width: "70%",
              height: "100%",
              padding: ".5em"
            },
            children: [{
              tag: "div",
              styles: {
                display: "flex",
                justifyContent: "space-between",
                marginBottom: ".5em"
              },
              children: [{
                tag: "div",
                properties: {
                  innerText: getString("ui-colors")
                },
                styles: {
                  fontWeight: "bold",
                  color: "var(--fill-secondary)"
                }
              }, {
                tag: "div",
                styles: {
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center"
                },
                children: [{
                  tag: "div",
                  id: "export-colors",
                  classList: ["export"],
                  properties: {
                    innerText: getString("ui-export")
                  }
                }, {
                  tag: "div",
                  id: "import-colors",
                  classList: ["import"],
                  properties: {
                    innerText: getString("ui-import")
                  }
                }, {
                  tag: "div",
                  id: "new-color",
                  classList: ["new"],
                  properties: {
                    innerText: getString("ui-new")
                  }
                }]
              }]
            }, {
              tag: "div",
              id: "colors-container",
              classList: ["container"],
              styles: {
                width: "100%",
                height: "400px",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "var(--material-background50)",
                overflowY: "scroll"
              }
            }]
          }]
        },
        // 设置名称显示区域
        {
          tag: "div",
          id: "color-name-setting",
          styles: {
            display: "flex",
            flexDirection: "row",
            width: "98%",
            justifyContent: "space-between"
          }
        }]
      },
      // 下半部分预览区域
      {
        tag: "div",
        styles: {
          height: "30%",
          width: "100%",
          position: "absoluted",
          overflowY: "auto"
        },
        children: [{
          tag: "span",
          styles: {
            display: "inline-block",
            position: "relative",
            left: "calc(50% - 250px)",
            top: "10px",
            width: "500px",
            fontSize: "2em",
            textAlign: "center"
          },
          properties: {
            innerHTML: `<span style='background-color: #71adfd;'>${getString("prefs-annotation-color-preview")}</span>`
          }
        }, {
          tag: "div",
          id: "preview-colors-container",
          styles: {
            display: "flex",
            position: "relative",
            left: "calc(50% - 205px)",
            top: "1.5em",
            textAlign: "center",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-around",
            fontSize: "18px",
            width: "400px",
            backgroundColor: "var(--material-background)",
            padding: "10px",
            borderRadius: "5px"
          },
          children: []
        }]
      }]
    }).open(getString("ui-annotation-colors"), {
      centerscreen: true,
      noDialogMode: true,
      fitContent: true
    });
    dialog.window.addEventListener("load", () => {
      const doc = dialog.window.document;
      ztoolkit.UI.appendElement({
        tag: "style",
        namespace: "html",
        properties: {
          innerHTML: `
          #groups-container {
            color: currentColor;
          }
          #groups-container .item.selected {
            color: var(--material-background);
            background-color: #2383e2 !important;
          }
          #groups-container .item #more {
            display: none;
          }

          #groups-container .item:hover #more {
            display: inline-block;
          }
          #groups-container .item:hover {
            background-color: var(--accent-blue10);
          }
          .new {
            border-radius: 3px;
            background-color: #2383e2;
            height: 1.5em;
            line-height: 1.5em;
            padding: 0 .5em;
            color: #fff;
            cursor: pointer;
          }
          #import-colors, #export-colors {
            border-radius: 3px;
            background-color: #55AD9B;
            height: 1.5em;
            line-height: 1.5em;
            padding: 0 .5em;
            color: #fff;
            cursor: pointer;
            margin-right: 1em
          }
          #colors-container .item {
            height: 2em;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-around;
            padding: .5em;
          }
          #colors-container .item:nth-child(2n) {
            background-color: var(--material-mix-quinary);
          }
          input[type=text] {
            padding: 0 7px;
            background: var(--material-background) !important;
            border-radius: 5px;
            border: var(--material-border-quinary) !important;
            height: 28px;
            width: 8em;
          }
          input[type=text]:focus {
            outline: none !important;
            border-color: rgba(0,0,0,0) !important;
            box-shadow: 0 0 0 2px #779aeb;
          }
          .container {
            border: var(--material-border);
          }
          #preview-colors-container::before {
            content: "";
            position: absolute;
            border: solid rgba(0,0,0,0);
              border-top-width: medium;
              border-right-width: medium;
              border-bottom-color: rgba(0, 0, 0, 0);
              border-bottom-width: medium;
              border-left-width: medium;
            border-width: 8px 8px;
              border-top-width: 8px;
            top: -15px;
            border-bottom-color: var(--material-background);
            transform: translateX(-8px);
          }
        `
        }
      }, doc.head);
      const groupsContainer = doc.querySelector("#groups-container");
      const colorsContainer = doc.querySelector("#colors-container");
      const previewColorsContainer = doc.querySelector("#preview-colors-container");
      const colorNameSettingContainer = doc.querySelector("#color-name-setting");
      const updatePrefs = () => {
        const groups = [];
        getElements(groupsContainer.querySelectorAll(".item")).forEach(e => {
          const gName = e.querySelector<HTMLElement>(".name").innerText;
          const groupIdx = e.getAttribute("index");
          const colors = [];
          for (const e2 of getElements(colorsContainer.querySelectorAll(`.item.group-${groupIdx}`))) {
            const name = e2.querySelector<HTMLInputElement>("input.name").value;
            const color = e2.querySelector<HTMLInputElement>("input.color").value;
            colors.push([name, color]);
          }
          groups.push([gName, colors]);
        });
        setPref(`annotationColorsGroups`, JSON.stringify(groups));
      };
      const updatePreview = () => {
        const colorNameDirection = getPref(`annotationColorNameDirection`);
        const isShowColorName = getPref(`function.showAnnotationColorName.enable`);
        const items = getElements(colorsContainer.querySelectorAll(".item")).filter(e => e.style.display == "flex");
        const colors = [];
        for (const item of items) {
          const color = item.querySelector<HTMLInputElement>("input.color").value;
          const name = item.querySelector<HTMLInputElement>("input.name").value;
          colors.push([name, color]);
        }
        let width = items.length * 50;
        if (isShowColorName && colorNameDirection == "horizontal") {
          width += colors.map(i => {
            const zhRes = i[0].match(/[\u4e00-\u9fa5]+/g);
            const zhWidth = 20;
            const enWidth = 8;
            if (zhRes) {
              return zhRes.length * zhWidth + (i[0].length - zhRes.length) * enWidth;
            } else {
              return i[0].length * enWidth;
            }
          }).reduce((a, b) => a + b, 0);
        }
        previewColorsContainer.style.left = `calc(50% - ${width / 2}px)`;
        previewColorsContainer.style.width = `${width}px`;
        previewColorsContainer.innerHTML = "";
        ztoolkit.log(items);
        for (const arr of colors) {
          const color = arr[1];
          const name = arr[0];
          ztoolkit.UI.appendElement({
            tag: "div",
            styles: {
              display: "flex",
              flexDirection: colorNameDirection == "horizontal" ? "row" : "column",
              alignItems: "center"
            },
            children: [{
              tag: "span",
              styles: {
                display: "inline-block",
                width: "1em",
                height: "1em",
                backgroundColor: color,
                borderRadius: "3px"
              }
            }, {
              tag: "span",
              styles: {
                display: isShowColorName ? "inline-block" : "none",
                marginLeft: colorNameDirection == "horizontal" ? "5px" : "0px",
                textOrientation: colorNameDirection == "vertical" ? "upright" : "auto",
                writingMode: colorNameDirection == "vertical" ? "vertical-rl" : "auto",
                marginTop: colorNameDirection == "vertical" ? "5px" : "0"
              },
              properties: {
                innerText: name
              }
            }]
          }, previewColorsContainer);
        }
        setPref(`annotationColors`, JSON.stringify(colors));
        updatePrefs();
        window.setTimeout(async () => {
          const reader = await ztoolkit.Reader.getReader();
          if (reader) {
            modifyAnnotationColors(reader);
          }
        });
      };
      const createColorItemNode = (cName, cValue, groupIdx, visible = false) => {
        const colorItemNode = ztoolkit.UI.appendElement({
          tag: "div",
          classList: ["item", `group-${groupIdx}`],
          styles: {
            display: visible ? "flex" : "none"
          },
          children: [{
            tag: "div",
            id: "color-dot",
            styles: {
              width: "1em",
              height: "1em",
              borderRadius: "3px",
              backgroundColor: cValue
            }
          }, {
            tag: "div",
            children: [{
              tag: "span",
              properties: {
                innerText: getString("ui-name")
              },
              styles: {
                marginRight: "10px"
              }
            }, {
              tag: "input",
              attributes: {
                type: "text"
              },
              classList: ["name"],
              properties: {
                value: cName
              },
              listeners: [{
                type: "keyup",
                listener: function () {
                  updatePreview();
                }
              }]
            }]
          }, {
            tag: "div",
            styles: {},
            children: [{
              tag: "span",
              properties: {
                innerText: getString("ui-color")
              },
              styles: {
                marginRight: "10px"
              }
            }, {
              tag: "input",
              attributes: {
                type: "text"
              },
              classList: ["color"],
              properties: {
                value: cValue
              },
              listeners: [{
                type: "keyup",
                listener: function (event) {
                  const input = event.currentTarget;
                  colorItemNode.querySelector("#color-dot").style.backgroundColor = input.value;
                  updatePreview();
                }
              }]
            }]
          },
          // buttons
          {
            tag: "div",
            styles: {
              display: "flex",
              flexDirection: "row"
            },
            children: [{
              tag: "button",
              classList: ["move-up"],
              properties: {
                innerText: "↑"
              },
              styles: {
                marginRight: "10px"
              },
              listeners: [{
                type: "click",
                listener: () => {
                  const node = colorItemNode.previousElementSibling;
                  if (node) {
                    node.before(colorItemNode);
                  }
                  updatePreview();
                }
              }]
            }, {
              tag: "button",
              classList: ["move-down"],
              properties: {
                innerText: "↓"
              },
              styles: {
                marginRight: "10px"
              },
              listeners: [{
                type: "click",
                listener: () => {
                  const node = colorItemNode.nextSibling;
                  if (node) {
                    colorItemNode.before(node);
                  }
                  updatePreview();
                }
              }]
            }, {
              tag: "button",
              classList: ["add"],
              properties: {
                innerHTML: "+"
              },
              styles: {
                marginRight: "10px"
              },
              listeners: [{
                type: "click",
                listener: () => {
                  const newNode = createColorItemNode(cName, cValue, groupIdx, true);
                  if (colorItemNode.nextSibling) {
                    colorItemNode.nextSibling.before(newNode);
                  }
                  updatePreview();
                }
              }]
            }, {
              tag: "button",
              classList: ["delete"],
              properties: {
                innerHTML: deleteSVG
              },
              styles: {
                marginRight: "10px"
              },
              listeners: [{
                type: "click",
                listener: () => {
                  colorItemNode.remove();
                  updatePreview();
                }
              }]
            }]
          }]
        }, colorsContainer);
        return colorItemNode;
      };
      const refresh = () => {
        const colorNameDirection = getPref(`annotationColorNameDirection`);
        const isShowColorName = getPref(`function.showAnnotationColorName.enable`);
        const isAddColorNameTag = getPref(`function.addColorNameTag.enable`);
        const groups = JSON.parse(getPref(`annotationColorsGroups`) || "[]");
        const colors = JSON.parse(getPref(`annotationColors`) || "[]");
        groupsContainer.innerHTML = "";
        colorsContainer.innerHTML = "";
        previewColorsContainer.innerHTML = "";
        colorNameSettingContainer.innerHTML = "";
        let selectedRendered = false;
        for (const group of groups) {
          const gName = group[0];
          const gColors = group[1];
          const selected = JSON.stringify(gColors) == JSON.stringify(colors);
          const groupItemNode = ztoolkit.UI.appendElement({
            tag: "div",
            classList: (selected && !selectedRendered ? ["selected"] : []).concat(["item", `group-${groups.indexOf(group)}`]),
            attributes: {
              index: String(groups.indexOf(group))
            },
            styles: {
              padding: ".5em",
              display: "flex",
              justifyContent: "space-between"
            },
            children: [{
              tag: "span",
              classList: ["name"],
              properties: {
                innerText: gName
              }
            }, {
              tag: "div",
              styles: {
                display: "flex",
                flexDirection: "row",
                alignItems: "center"
              },
              children: [{
                tag: "span",
                id: "more",
                styles: {
                  cursor: "pointer",
                  color: "currentColor",
                  padding: "0 .5em",
                  borderRadius: "3px",
                  height: "1.3em",
                  lineHeight: "1.3em"
                },
                properties: {
                  innerHTML: renameSVG
                },
                listeners: [{
                  type: "click",
                  listener: async () => {
                    const nameNode = groupItemNode.querySelector(".name");
                    const newName = window.prompt(getString("prefs-enter-new-name"), nameNode.innerText);
                    if (!newName) {
                      return;
                    }
                    nameNode.innerText = newName;
                    updatePrefs();
                    dialog.window.focus();
                  }
                }]
              }, {
                tag: "span",
                id: "more",
                styles: {
                  cursor: "pointer",
                  color: "currentColor",
                  padding: "0 .5em",
                  borderRadius: "3px",
                  height: "1.3em",
                  lineHeight: "1.3em"
                },
                properties: {
                  innerHTML: deleteSVG
                },
                listeners: [{
                  type: "click",
                  listener: e => {
                    e.stopPropagation();
                    groupItemNode.remove();
                    updatePrefs();
                  }
                }]
              }]
            }],
            listeners: [{
              type: "click",
              listener: () => {
                if (groups.length > 1) {
                  setPref(`annotationColors`, JSON.stringify(group[1]));
                  refresh();
                }
              }
            }]
          }, groupsContainer);
          for (const color of gColors) {
            const cName = color[0];
            const cValue = color[1];
            createColorItemNode(cName, cValue, groups.indexOf(group), selected && !selectedRendered);
          }
          if (selected && !selectedRendered) {
            selectedRendered = true;
          }
        }
        ztoolkit.UI.appendElement({
          tag: "div",
          styles: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center"
          },
          children: [{
            tag: "input",
            id: "show-color-name",
            attributes: {
              type: "checkbox"
            },
            properties: {
              checked: isShowColorName
            },
            styles: {
              width: "1em",
              height: "1em"
            },
            listeners: [{
              type: "change",
              listener: function (event) {
                const input = event.currentTarget;
                setPref(`function.showAnnotationColorName.enable`, input.checked);
                updatePreview();
              }
            }]
          }, {
            tag: "label",
            attributes: {
              for: "show-color-name"
            },
            properties: {
              innerText: getString("ui-show-color-name")
            }
          }]
        }, colorNameSettingContainer);
        ztoolkit.UI.appendElement({
          tag: "div",
          styles: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center"
          },
          children: [{
            tag: "input",
            id: "add-color-name-tag",
            attributes: {
              type: "checkbox"
            },
            properties: {
              checked: isAddColorNameTag
            },
            styles: {
              width: "1em",
              height: "1em"
            },
            listeners: [{
              type: "change",
              listener: function (event) {
                const input = event.currentTarget;
                setPref(`function.addColorNameTag.enable`, input.checked);
                updatePreview();
              }
            }]
          }, {
            tag: "label",
            attributes: {
              for: "add-color-name-tag"
            },
            properties: {
              innerText: getString("ui-color-name-tag")
            }
          }]
        }, colorNameSettingContainer);
        ztoolkit.UI.appendElement({
          tag: "div",
          styles: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center"
          },
          children: [{
            tag: "label",
            properties: {
              innerText: getString("ui-color-name-direction")
            },
            styles: {
              marginRight: "1em"
            }
          }, {
            tag: "div",
            styles: {
              display: "flex",
              flexDirection: "row",
              alignItems: "center"
            },
            children: [{
              tag: "input",
              attributes: {
                type: "radio",
                id: "color-name-horizontal",
                name: "color-name-direction",
                value: "horizontal"
              },
              properties: {
                checked: colorNameDirection == "horizontal"
              },
              styles: {
                marginRight: "0.5em"
              },
              listeners: [{
                type: "change",
                listener: function () {
                  if (this.checked) {
                    setPref(`annotationColorNameDirection`, "horizontal");
                    updatePreview();
                  }
                }
              }]
            }, {
              tag: "label",
              attributes: {
                for: "color-name-horizontal"
              },
              properties: {
                innerText: getString("ui-horizontal")
              },
              styles: {
                marginRight: "1em"
              }
            }, {
              tag: "input",
              attributes: {
                type: "radio",
                id: "color-name-vertical",
                name: "color-name-direction",
                value: "vertical"
              },
              properties: {
                checked: colorNameDirection == "vertical"
              },
              styles: {
                marginRight: "0.5em"
              },
              listeners: [{
                type: "change",
                listener: function () {
                  if (this.checked) {
                    setPref(`annotationColorNameDirection`, "vertical");
                    updatePreview();
                  }
                }
              }]
            }, {
              tag: "label",
              attributes: {
                for: "color-name-vertical"
              },
              properties: {
                innerText: getString("ui-vertical")
              }
            }]
          }]
        }, colorNameSettingContainer);
        updatePreview();
      };
      doc.querySelector("#new-group")?.addEventListener("click", () => {
        const groups = JSON.parse(getPref(`annotationColorsGroups`) || "[]");
        const colors = JSON.parse(getPref(`annotationColors`) || "[]");
        groups.push([getString("untitled"), [[getString("prefs-color-example"), "#ffd400"]]]);
        setPref(`annotationColorsGroups`, JSON.stringify(groups));
        refresh();
      });
      doc.querySelector("#new-color")?.addEventListener("click", () => {
        const groupIdx = groupsContainer.querySelector(".item.selected")?.getAttribute("index");
        createColorItemNode(getString("prefs-color-example"), "#ffd400", Number(groupIdx), true);
        updatePreview();
      });
      doc.querySelector("#export-colors")?.addEventListener("click", () => {
        const items = getElements(colorsContainer.querySelectorAll(".item")).filter(e => e.style.display == "flex");
        const colors = [];
        for (const item of items) {
          const color = item.querySelector<HTMLInputElement>("input.color").value;
          const name = item.querySelector<HTMLInputElement>("input.name").value;
          colors.push([name, color]);
        }
        new ztoolkit.Clipboard().addText(JSON.stringify(colors), "text/plain").copy();
        new ztoolkit.ProgressWindow(getString("prefs-colors-export-success")).createLine({
          text: getString("prefs-colors-copied", {
            args: {
              count: colors.length
            }
          }),
          type: "success"
        }).show();
      });
      doc.querySelector("#import-colors")?.addEventListener("click", () => {
        const copiedText = Zotero.Utilities.Internal.getClipboard("text/plain").replace(/【/g, "[").replace(/】/g, "]");
        let data = [];
        try {
          data = JSON.parse(copiedText);
        } catch {
          window.alert(getString("prefs-colors-invalid-json", {
            args: {
              content: copiedText
            }
          }));
          return;
        }
        const colors = [];
        ztoolkit.log("data", data);
        if (data instanceof Array) {
          for (const i of data) {
            if (typeof i[0] == "string" && typeof i[1] == "string" && i[1].startsWith("#")) {
              colors.push([i[0], i[1]]);
            }
          }
        }
        if (colors.length == 0) {
          window.alert(getString("prefs-colors-invalid-data", {
            args: {
              content: copiedText
            }
          }));
          return;
        }
        const groupName = window.prompt(getString("prefs-color-group-name"), getString("untitled"));
        if (groupName) {
          dialog.window.focus();
          ztoolkit.log("colors", colors);
          const groups = JSON.parse(getPref(`annotationColorsGroups`) || "[]");
          setPref(`annotationColors`, JSON.stringify(colors));
          groups.push([groupName, colors]);
          setPref(`annotationColorsGroups`, JSON.stringify(groups));
          ztoolkit.log(groups);
          refresh();
          new ztoolkit.ProgressWindow(getString("prefs-colors-import-success")).createLine({
            text: getString("prefs-colors-imported", {
              args: {
                count: colors.length
              }
            }),
            type: "success"
          }).show();
        }
      });
      refresh();
    });
  }