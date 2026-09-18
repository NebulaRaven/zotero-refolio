  // src/utils/easyscholar.ts
  export var field2Info = {
    sci(s) {
      let rank;
      const key = "SCI";
      const value = s;
      if (s == "Q1") {
        rank = 1;
      } else if (s == "Q2") {
        rank = 2;
      } else if (s == "Q3") {
        rank = 3;
      } else if (s == "Q4") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    sciif(s) {
      const key = "SCIIF";
      const value = s;
      const number = Number(s);
      let rank;
      if (number >= 10) {
        rank = 1;
      } else if (number >= 4 && number < 10) {
        rank = 2;
      } else if (number >= 2 && number < 4) {
        rank = 3;
      } else if (number >= 1 && number < 2) {
        rank = 4;
      } else if (number >= 0 && number < 1) {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    sciif5(s) {
      const number = parseFloat(s);
      const key = "SCIIF(5)";
      const value = s;
      let rank;
      if (number >= 10) {
        rank = 1;
      } else if (number >= 4 && number < 10) {
        rank = 2;
      } else if (number >= 2 && number < 4) {
        rank = 3;
      } else if (number >= 1 && number < 2) {
        rank = 4;
      } else if (number >= 0 && number < 1) {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    sciBase(s) {
      const key = "SCI基础版";
      const value = s;
      s = s.substring(s.length - 2);
      let rank;
      if (s == "1区") {
        rank = 1;
      } else if (s == "2区") {
        rank = 2;
      } else if (s == "3区") {
        rank = 3;
      } else if (s == "4区") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    sciUp(s) {
      const key = "SCI升级版";
      const value = s;
      s = s.substring(s.length - 2);
      let rank;
      if (s == "1区") {
        rank = 1;
      } else if (s == "2区") {
        rank = 2;
      } else if (s == "3区") {
        rank = 3;
      } else if (s == "4区") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    ssci(s) {
      const key = "SSCI";
      const value = s;
      let rank;
      if (s == "Q1") {
        rank = 1;
      } else if (s == "Q2") {
        rank = 2;
      } else if (s == "Q3") {
        rank = 3;
      } else if (s == "Q4") {
        rank = 4;
      } else if (s == "SSCI") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    eii(s) {
      const key = "EI检索";
      const value = "";
      const rank = 2;
      return {
        rank,
        key,
        value: ""
      };
    },
    cssci(s) {
      const key = s;
      const value = "";
      let rank;
      if (s == "CSSCI") {
        rank = 1;
      } else if (s == "CSSCI扩展版") {
        rank = 2;
      }
      return {
        rank,
        key,
        value
      };
    },
    nju(s) {
      const key = "NJU";
      const value = s;
      let rank;
      if (s == "超一流期刊" || s == "学科群一流期刊") {
        rank = 1;
      } else if (s == "A") {
        rank = 2;
      } else if (s == "B") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    pku(s) {
      const key = "北大中文核心";
      const value = "";
      const rank = 1;
      return {
        rank,
        key,
        value
      };
    },
    xju(s) {
      const key = "XJU";
      const value = s;
      let rank;
      if (s == "一区") {
        rank = 1;
      } else if (s == "二区") {
        rank = 2;
      } else if (s == "三区") {
        rank = 3;
      } else if (s == "四区") {
        rank = 4;
      } else if (s == "五区") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    ccf(s) {
      const key = "CCF";
      const value = s;
      let rank;
      if (s == "A") {
        rank = 1;
      } else if (s == "B") {
        rank = 2;
      } else if (s == "C") {
        rank = 3;
      } else if (s == "T1") {
        rank = 1;
      } else if (s == "T2") {
        rank = 2;
      } else if (s == "T3") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    ahci(s) {
      const rank = 2;
      const key = "A&HCI 检索";
      const value = "";
      return {
        rank,
        key,
        value
      };
    },
    ajg(s) {
      const key = "AJG";
      const value = s;
      let rank;
      if (s == "4*") {
        rank = 1;
      } else if (s == "4") {
        rank = 2;
      } else if (s == "3") {
        rank = 3;
      } else if (s == "2") {
        rank = 4;
      } else if (s == "1") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    cqu(s) {
      const key = "CQU";
      const value = s;
      let rank;
      if (s == "A" || s == "权威期刊") {
        rank = 2;
      } else if (s == "B" || s == "重要期刊") {
        rank = 3;
      } else if (s == "C") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    cscd(s) {
      const key = "CSCD";
      const value = s;
      let rank;
      if (s == "扩展库") {
        rank = 3;
      } else if (s == "核心库") {
        rank = 2;
      }
      return {
        rank,
        key,
        value
      };
    },
    cufe(s) {
      const key = "CUFE";
      const value = s;
      let rank;
      if (s == "AAA") {
        rank = 2;
      } else if (s == "AA") {
        rank = 3;
      } else if (s == "A") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    cug(s) {
      const key = "CUG";
      const value = s;
      let rank;
      s = s.substring(s.length - 2);
      if (s == "T1") {
        rank = 1;
      } else if (s == "T2") {
        rank = 2;
      } else if (s == "T3") {
        rank = 3;
      } else if (s == "T4") {
        rank = 4;
      } else if (s == "T5") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    fdu(s) {
      const key = "FDU";
      const value = s;
      let rank;
      if (s == "A") {
        rank = 2;
      } else if (s == "B") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    hhu(s) {
      const key = "HHU";
      const value = s;
      let rank;
      if (s.startsWith("A+")) {
        rank = 1;
      } else if (s.startsWith("A")) {
        rank = 2;
      } else if (s.startsWith("B")) {
        rank = 3;
      } else if (s.startsWith("C")) {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    ruc(s) {
      const key = "RUC";
      const value = s;
      let rank;
      if (s == "A+") {
        rank = 1;
      } else if (s == "A") {
        rank = 2;
      } else if (s == "A-") {
        rank = 3;
      } else if (s == "B") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    jci(s) {
      const key = "JCI";
      const value = s;
      let rank;
      const number = parseFloat(s);
      if (number >= 3) {
        rank = 1;
      } else if (number >= 1 && number < 3) {
        rank = 2;
      } else if (number >= 0.5 && number < 1) {
        rank = 3;
      } else if (number >= 0 && number < 0.5) {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    sdufe(s) {
      const key = "SDUFE";
      const value = s;
      let rank;
      if (s == "特类期刊") {
        rank = 1;
      } else if (s == "A1") {
        rank = 2;
      } else if (s == "A2") {
        rank = 3;
      } else if (s == "B") {
        rank = 4;
      } else if (s == "C") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    sjtu(s) {
      const key = "SJTU";
      const value = s;
      let rank;
      if (s == "A") {
        rank = 2;
      } else if (s == "B") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    swjtu(s) {
      const key = "SWJTU";
      const value = s;
      let rank;
      if (s == "A++") {
        rank = 1;
      } else if (s == "A+") {
        rank = 2;
      } else if (s == "A") {
        rank = 3;
      } else if (s == "B+") {
        rank = 4;
      } else if (s == "B") {
        rank = 5;
      } else if (s == "C") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    uibe(s) {
      const key = "UIBE";
      const value = s;
      let rank;
      if (s == "A") {
        rank = 1;
      } else if (s == "A-") {
        rank = 2;
      } else if (s == "B") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    xmu(s) {
      let key;
      let value;
      let rank;
      if (s == "XMU一类") {
        key = s;
        value = "";
        rank = 2;
      }
      return {
        rank,
        key,
        value
      };
    },
    xdu(s) {
      const key = "XDU";
      const value = s;
      let rank;
      if (s == "1类贡献度") {
        rank = 1;
      } else if (s == "2类贡献度") {
        rank = 2;
      }
      return {
        rank,
        key,
        value
      };
    },
    zhongguokejihexin(s) {
      let key;
      let value;
      let rank;
      if (s == "中国科技核心期刊") {
        rank = 1;
        key = s;
        value = "";
      }
      return {
        rank,
        key,
        value
      };
    },
    fms(s) {
      const key = "FMS";
      const value = s;
      let rank;
      if (s == "A" || s == "T1") {
        rank = 1;
      } else if (s == "B" || s == "T2") {
        rank = 2;
      } else if (s == "C") {
        rank = 3;
      } else if (s == "D") {
        rank = 4;
      }
      return {
        rank,
        key,
        value
      };
    },
    scu(s) {
      const key = "SCU";
      const value = s;
      let rank;
      s = s.slice(-1);
      if (s == "A") {
        rank = 1;
      } else if (s == "-") {
        rank = 2;
      } else if (s == "B") {
        rank = 3;
      } else if (s == "C") {
        rank = 4;
      } else if (s == "D") {
        rank = 5;
      } else if (s == "E") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
    sciwarn(s) {
      const key = "SCIWARN";
      const value = s;
      const rank = 1;
      return {
        rank,
        key,
        value
      };
    },
    zju(s) {
      if (s == "国内一级学术期刊") {
        s = "国内一级";
      } else if (s == "国内核心期刊") {
        s = "国内核心";
      }
      const key = "ZJU";
      const value = s;
      let rank;
      if (s == "国内一级") {
        rank = 1;
      } else if (s == "国内核心") {
        rank = 2;
      }
      return {
        rank,
        key,
        value
      };
    },
    cju(s) {
      const key = "YangtzeU";
      const value = s;
      let rank;
      s = s.slice(0, 2);
      if (s == "T1") {
        rank = 1;
      } else if (s == "T2") {
        rank = 2;
      } else if (s == "T3") {
        rank = 3;
      }
      return {
        rank,
        key,
        value
      };
    },
    ft50(s) {
      let key;
      let value;
      let rank;
      if (s == "FT50") {
        key = "FT50";
        value = "";
        rank = 1;
      }
      return {
        rank,
        key,
        value
      };
    },
    utd24(s) {
      let key;
      let value;
      let rank;
      if (s == "UTD24") {
        key = "UTD24";
        value = "";
        rank = 1;
      }
      return {
        rank,
        key,
        value
      };
    },
    CPU(s) {
      const key = "CPU";
      const value = s;
      let rank;
      if (s == "一流") {
        rank = 1;
      } else if (s == "权威") {
        rank = 2;
      } else if (s == "学科顶尖") {
        rank = 3;
      } else if (s == "学科一流") {
        rank = 4;
      } else if (s == "学科重要") {
        rank = 5;
      }
      return {
        rank,
        key,
        value
      };
    },
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

