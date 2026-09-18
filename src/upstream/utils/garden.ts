  // src/utils/garden.ts
  export function ifRank(n) {
    if (n >= 20) {
      return 1;
    }
    if (n >= 10) {
      return 1;
    }
    if (n >= 4) {
      return 2;
    }
    if (n >= 2) {
      return 3;
    }
    if (n >= 1) {
      return 4;
    }
    return 5;
  }
  export function zoneRank(v) {
    return Math.min(...String(v).split("").map(Number).filter(d => d >= 1 && d <= 4));
  }
  export var gardenField2Info = {
    IF(v) {
      const n = Number(v);
      const rank = ifRank(n);
      return {
        rank,
        key: "IF",
        value: String(v)
      };
    },
    JCI(v) {
      const n = Number(v);
      const rank = n >= 3 ? 1 : n >= 1 ? 2 : n >= 0.5 ? 3 : 4;
      return {
        rank,
        key: "JCI",
        value: String(v)
      };
    },
    JCR(v) {
      return {
        rank: Number(v) || 4,
        key: "SCI",
        value: `Q${v}`
      };
    },
    "中科院 2025"(v) {
      const rank = zoneRank(v);
      const zone = Math.min(...String(v).split("").map(Number).filter(d => d >= 1 && d <= 4));
      return {
        rank,
        key: "中科院",
        value: `${zone}\u533A`
      };
    },
    CiteScore(v) {
      const n = Number(v);
      const rank = n >= 50 ? 1 : n >= 15 ? 2 : n >= 5 ? 3 : n >= 1 ? 4 : 5;
      return {
        rank,
        key: "CiteScore",
        value: String(v)
      };
    },
    SJR(v) {
      const n = Number(v);
      const rank = n >= 10 ? 1 : n >= 3 ? 2 : n >= 1 ? 3 : n >= 0.3 ? 4 : 5;
      return {
        rank,
        key: "SJR",
        value: String(v)
      };
    },
    "5YIF"(v) {
      const rank = ifRank(Number(v));
      return {
        rank,
        key: "5YIF",
        value: String(v)
      };
    },
    "WOS 子集"(v) {
      const labels = {
        1: "SCIE",
        2: "SSCI",
        3: "ESCI"
      };
      return {
        rank: 2,
        key: labels[Number(v)] ?? "WOS",
        value: ""
      };
    },
    "JIF Rank"(v) {
      const [n, d] = String(v).split("/").map(Number);
      const frac = d ? n / d : 1;
      const rank = frac <= 0.1 ? 1 : frac <= 0.25 ? 2 : frac <= 0.5 ? 3 : 4;
      return {
        rank,
        key: "JIF Rank",
        value: String(v)
      };
    },
    jci(v) {
      const n = Number(v);
      const rank = n >= 3 ? 1 : n >= 1 ? 2 : n >= 0.5 ? 3 : 4;
      return {
        rank,
        key: "jci",
        value: String(v)
      };
    },
    JCAR(v) {
      return {
        rank: Number(v) || 3,
        key: "JCAR",
        value: String(v)
      };
    },
    新锐(v) {
      const rank = zoneRank(v);
      const zone = Math.min(...String(v).split("").map(Number).filter(d => d >= 1 && d <= 4));
      return {
        rank,
        key: "新锐",
        value: `${zone}\u533A`
      };
    },
    "WOS 自引率"(v) {
      return {
        rank: 3,
        key: "自引率",
        value: `${v}%`
      };
    }
  };
  export var garden_default = gardenField2Info;

