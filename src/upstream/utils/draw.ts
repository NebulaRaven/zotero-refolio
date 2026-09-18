  // src/utils/draw.ts
  export function getRGB2(color) {
    let sColor = color.toLowerCase();
    const reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;
    if (sColor && reg.test(sColor)) {
      if (sColor.length === 4) {
        let sColorNew = "#";
        for (let i = 1; i < 4; i += 1) {
          sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1));
        }
        sColor = sColorNew;
      }
      const sColorChange = [];
      for (let i = 1; i < 7; i += 2) {
        sColorChange.push(parseInt("0x" + sColor.slice(i, i + 2)));
      }
      return sColorChange;
    }
    return sColor;
  }
  export function drawOpacityProgress(values, color = "#62b6b7", opacity = "1", limit = -1) {
    const span = ztoolkit.UI.createElement(document, "span", {
      styles: {
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        justifyContent: "space-around",
        opacity
      },
      classList: ["opacity-progress"]
    });
    const sortedValues = [...values].sort((a, b2) => b2 - a);
    const meanValue = [...values].reduce((a, b2) => a + b2) / values.length;
    let maxValue = meanValue + (sortedValues[0] - meanValue) * 0.5;
    if (limit > 0) {
      maxValue = maxValue > limit ? maxValue : limit;
    }
    const [r, g, b] = getRGB2(color);
    for (const value of values) {
      span.appendChild(ztoolkit.UI.createElement(document, "span", {
        styles: {
          height: "100%",
          width: `${100 / values.length}%`,
          margin: "0",
          backgroundColor: `rgba(${r}, ${g}, ${b}, ${value / maxValue})`
        }
      }));
    }
    return span;
  }

