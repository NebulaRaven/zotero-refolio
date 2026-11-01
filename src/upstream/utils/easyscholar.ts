  type RankInfo = { rank: number | undefined; key: string | undefined; value: string | undefined };
  type RankRule = (value: string) => RankInfo;
  const lookup = (ranks: Record<string, number>, label: string) => Object.hasOwn(ranks, label) ? ranks[label] : undefined;
  /** Rank by the first threshold the number reaches; NaN and negative numbers have no rank. */
  const byThreshold = (key: string, parse: (value: string) => number, thresholds: number[]): RankRule => value => {
    const index = thresholds.findIndex(threshold => parse(value) >= threshold);
    return { rank: index < 0 ? undefined : index + 1, key, value };
  };
  /** Rank by label; part() picks the piece of the provider value that holds the label. */
  const byLabel = (key: string, ranks: Record<string, number>, part = (value: string) => value): RankRule =>
    value => ({ rank: lookup(ranks, part(value)), key, value });
  const byPrefix = (key: string, prefixes: Array<[string, number]>): RankRule =>
    value => ({ rank: prefixes.find(([prefix]) => value.startsWith(prefix))?.[1], key, value });
  /** An index without levels: listed journals always get the same rank. */
  const listed = (key: string, rank: number, showValue = false): RankRule => value => ({ rank, key, value: showValue ? value : "" });
  /** A single-label list: anything other than its label is not a match. */
  const only = (label: string, rank: number): RankRule =>
    value => value === label ? { rank, key: label, value: "" } : { rank: undefined, key: undefined, value: undefined };
  const quartiles = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
  const zones = { "1区": 1, "2区": 2, "3区": 3, "4区": 4 };
  const tiers = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`T${index + 1}`, index + 1]));
  const lastTwo = (value: string) => value.substring(value.length - 2);
  const zjuAliases = { "国内一级学术期刊": "国内一级", "国内核心期刊": "国内核心" };
  export var field2Info = {
    sci: byLabel("SCI", quartiles),
    sciif: byThreshold("SCIIF", Number, [10, 4, 2, 1, 0]),
    sciif5: byThreshold("SCIIF(5)", parseFloat, [10, 4, 2, 1, 0]),
    sciBase: byLabel("SCI基础版", zones, lastTwo),
    sciUp: byLabel("SCI升级版", zones, lastTwo),
    ssci: byLabel("SSCI", { ...quartiles, SSCI: 5 }),
    eii: listed("EI检索", 2),
    cssci: (value: string): RankInfo => ({ rank: lookup({ CSSCI: 1, "CSSCI扩展版": 2 }, value), key: value, value: "" }),
    nju: byLabel("NJU", { "超一流期刊": 1, "学科群一流期刊": 1, A: 2, B: 3 }),
    pku: listed("北大中文核心", 1),
    xju: byLabel("XJU", { "一区": 1, "二区": 2, "三区": 3, "四区": 4, "五区": 5 }),
    ccf: byLabel("CCF", { A: 1, B: 2, C: 3, T1: 1, T2: 2, T3: 3 }),
    ahci: listed("A&HCI 检索", 2),
    ajg: byLabel("AJG", { "4*": 1, "4": 2, "3": 3, "2": 4, "1": 5 }),
    cqu: byLabel("CQU", { A: 2, "权威期刊": 2, B: 3, "重要期刊": 3, C: 4 }),
    cscd: byLabel("CSCD", { "核心库": 2, "扩展库": 3 }),
    cufe: byLabel("CUFE", { AAA: 2, AA: 3, A: 4 }),
    cug: byLabel("CUG", tiers(5), lastTwo),
    fdu: byLabel("FDU", { A: 2, B: 3 }),
    hhu: byPrefix("HHU", [["A+", 1], ["A", 2], ["B", 3], ["C", 4]]),
    ruc: byLabel("RUC", { "A+": 1, A: 2, "A-": 3, B: 4 }),
    jci: byThreshold("JCI", parseFloat, [3, 1, 0.5, 0]),
    sdufe: byLabel("SDUFE", { "特类期刊": 1, A1: 2, A2: 3, B: 4, C: 5 }),
    sjtu: byLabel("SJTU", { A: 2, B: 3 }),
    swjtu: byLabel("SWJTU", { "A++": 1, "A+": 2, A: 3, "B+": 4, B: 5, C: 5 }),
    uibe: byLabel("UIBE", { A: 1, "A-": 2, B: 3 }),
    xmu: only("XMU一类", 2),
    xdu: byLabel("XDU", { "1类贡献度": 1, "2类贡献度": 2 }),
    zhongguokejihexin: only("中国科技核心期刊", 1),
    fms: byLabel("FMS", { A: 1, T1: 1, B: 2, T2: 2, C: 3, D: 4 }),
    scu: byLabel("SCU", { A: 1, "-": 2, B: 3, C: 4, D: 5, E: 5 }, value => value.slice(-1)),
    sciwarn: listed("SCIWARN", 1, true),
    zju: (value: string): RankInfo => {
      const label = Object.hasOwn(zjuAliases, value) ? zjuAliases[value] : value;
      return { rank: lookup({ "国内一级": 1, "国内核心": 2 }, label), key: "ZJU", value: label };
    },
    cju: byLabel("YangtzeU", tiers(3), value => value.slice(0, 2)),
    ft50: only("FT50", 1),
    utd24: only("UTD24", 1),
    CPU: byLabel("CPU", { "一流": 1, "权威": 2, "学科顶尖": 3, "学科一流": 4, "学科重要": 5 }),
    custom(key, value) {
      value = value.replace("类", "");
      let rank = 1;
      if (["A", "B", "C", "D"].indexOf(value) >= 0) {
        switch (value) {
          case "A":
            rank = 1;
            break;
          case "B":
            rank = 2;
            break;
          case "C":
            rank = 3;
            break;
          case "D":
            rank = 4;
            break;
          default:
            rank = 5;
            break;
        }
      } else if (value.match(/(.+)\[rank=(\d)\]/)) {
        const res = value.match(/(.+)\[rank=(\d)\]/);
        if (res) {
          value = res[1];
          rank = Number(res[2]);
        }
      } else if (value.match(/[1-5]/)) {
        rank = Number(value.match(/[1-5]/)[0]);
      }
      if (rank) {
        return {
          rank,
          key,
          value
        };
      } else if (key.toUpperCase() == value.toUpperCase()) {
        value = "";
        rank = 1;
        return {
          rank,
          key,
          value
        };
      }
    }
  };
  export var easyscholar_default = field2Info;
