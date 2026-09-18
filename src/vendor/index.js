
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    if (!mod) {
      (0, cb[__getOwnPropNames(cb)[0]])((mod = {
        exports: {}
      }).exports, mod);
    }
    return mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from)) {
        if (!__hasOwnProp.call(to, key) && key !== except) {
          __defProp(to, key, {
            get: () => from[key],
            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
          });
        }
      }
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => {
    target = mod != null ? __create(__getProtoOf(mod)) : {};
    return __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
      value: mod,
      enumerable: true
    }) : target, mod);
  };


  // node_modules/runes/index.js
  var require_runes = __commonJS({
    "node_modules/runes/index.js"(exports, module) {
      "use strict";

      var HIGH_SURROGATE_START = 55296;
      var HIGH_SURROGATE_END = 56319;
      var LOW_SURROGATE_START = 56320;
      var REGIONAL_INDICATOR_START = 127462;
      var REGIONAL_INDICATOR_END = 127487;
      var FITZPATRICK_MODIFIER_START = 127995;
      var FITZPATRICK_MODIFIER_END = 127999;
      var VARIATION_MODIFIER_START = 65024;
      var VARIATION_MODIFIER_END = 65039;
      var DIACRITICAL_MARKS_START = 8400;
      var DIACRITICAL_MARKS_END = 8447;
      var ZWJ = 8205;
      var GRAPHEMS = [776,
      // ( ◌̈ ) COMBINING DIAERESIS
      2359,
      // ( ष ) DEVANAGARI LETTER SSA
      2359,
      // ( ष ) DEVANAGARI LETTER SSA
      2367,
      // ( ि ) DEVANAGARI VOWEL SIGN I
      2367,
      // ( ि ) DEVANAGARI VOWEL SIGN I
      2984,
      // ( ந ) TAMIL LETTER NA
      3007,
      // ( ி ) TAMIL VOWEL SIGN I
      3021,
      // ( ◌்) TAMIL SIGN VIRAMA
      3633,
      // ( ◌ั ) THAI CHARACTER MAI HAN-AKAT
      3635,
      // ( ำ ) THAI CHARACTER SARA AM
      3648,
      // ( เ ) THAI CHARACTER SARA E
      3657,
      // ( เ ) THAI CHARACTER MAI THO
      4352,
      // ( ᄀ ) HANGUL CHOSEONG KIYEOK
      4449,
      // ( ᅡ ) HANGUL JUNGSEONG A
      4520
      // ( ᆨ ) HANGUL JONGSEONG KIYEOK
      ];
      function runes2(string) {
        if (typeof string !== "string") {
          throw new Error("string cannot be undefined or null");
        }
        const result = [];
        let i = 0;
        let increment = 0;
        while (i < string.length) {
          increment += nextUnits(i + increment, string);
          if (isGraphem(string[i + increment])) {
            increment++;
          }
          if (isVariationSelector(string[i + increment])) {
            increment++;
          }
          if (isDiacriticalMark(string[i + increment])) {
            increment++;
          }
          if (isZeroWidthJoiner(string[i + increment])) {
            increment++;
            continue;
          }
          result.push(string.substring(i, i + increment));
          i += increment;
          increment = 0;
        }
        return result;
      }
      function nextUnits(i, string) {
        const current = string[i];
        if (!isFirstOfSurrogatePair(current) || i === string.length - 1) {
          return 1;
        }
        const currentPair = current + string[i + 1];
        let nextPair = string.substring(i + 2, i + 5);
        if (isRegionalIndicator(currentPair) && isRegionalIndicator(nextPair)) {
          return 4;
        }
        if (isFitzpatrickModifier(nextPair)) {
          return 4;
        }
        return 2;
      }
      function isFirstOfSurrogatePair(string) {
        return string && betweenInclusive(string[0].charCodeAt(0), HIGH_SURROGATE_START, HIGH_SURROGATE_END);
      }
      function isRegionalIndicator(string) {
        return betweenInclusive(codePointFromSurrogatePair(string), REGIONAL_INDICATOR_START, REGIONAL_INDICATOR_END);
      }
      function isFitzpatrickModifier(string) {
        return betweenInclusive(codePointFromSurrogatePair(string), FITZPATRICK_MODIFIER_START, FITZPATRICK_MODIFIER_END);
      }
      function isVariationSelector(string) {
        return typeof string === "string" && betweenInclusive(string.charCodeAt(0), VARIATION_MODIFIER_START, VARIATION_MODIFIER_END);
      }
      function isDiacriticalMark(string) {
        return typeof string === "string" && betweenInclusive(string.charCodeAt(0), DIACRITICAL_MARKS_START, DIACRITICAL_MARKS_END);
      }
      function isGraphem(string) {
        return typeof string === "string" && GRAPHEMS.indexOf(string.charCodeAt(0)) !== -1;
      }
      function isZeroWidthJoiner(string) {
        return typeof string === "string" && string.charCodeAt(0) === ZWJ;
      }
      function codePointFromSurrogatePair(pair) {
        const highOffset = pair.charCodeAt(0) - HIGH_SURROGATE_START;
        const lowOffset = pair.charCodeAt(1) - LOW_SURROGATE_START;
        return (highOffset << 10) + lowOffset + 65536;
      }
      function betweenInclusive(value, lower, upper) {
        return value >= lower && value <= upper;
      }
      function substring(string, start, width) {
        const chars = runes2(string);
        if (start === undefined) {
          return string;
        }
        if (start >= chars.length) {
          return "";
        }
        const rest = chars.length - start;
        const stringWidth = width === undefined ? rest : width;
        let endIndex = start + stringWidth;
        if (endIndex > start + rest) {
          endIndex = undefined;
        }
        return chars.slice(start, endIndex).join("");
      }
      module.exports = runes2;
      module.exports.substr = substring;
    }
  });


  // node_modules/dayjs/dayjs.min.js
  var require_dayjs_min = __commonJS({
    "node_modules/dayjs/dayjs.min.js"(exports, module) {
      (function (t3, e) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = e();
        } else if (typeof define == "function" && define.amd) {
          define(e);
        } else {
          (t3 = typeof globalThis != "undefined" ? globalThis : t3 || self).dayjs = e();
        }
      })(exports, function () {
        "use strict";

        var t3 = 1000;
        var e = 60000;
        var n = 3600000;
        var r = "millisecond";
        var i = "second";
        var s = "minute";
        var u = "hour";
        var a = "day";
        var o = "week";
        var c = "month";
        var f = "quarter";
        var h = "year";
        var d = "date";
        var l = "Invalid Date";
        var $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/;
        var y = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
        var M = {
          name: "en",
          weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
          months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
          ordinal: function (t4) {
            var e2 = ["th", "st", "nd", "rd"];
            var n2 = t4 % 100;
            return "[" + t4 + (e2[(n2 - 20) % 10] || e2[n2] || e2[0]) + "]";
          }
        };
        function m(t4, e2, n2) {
          var r2 = String(t4);
          if (!r2 || r2.length >= e2) {
            return t4;
          } else {
            return "" + Array(e2 + 1 - r2.length).join(n2) + t4;
          }
        }
        var v = {
          s: m,
          z: function (t4) {
            var e2 = -t4.utcOffset();
            var n2 = Math.abs(e2);
            var r2 = Math.floor(n2 / 60);
            var i2 = n2 % 60;
            return (e2 <= 0 ? "+" : "-") + m(r2, 2, "0") + ":" + m(i2, 2, "0");
          },
          m: function t4(e2, n2) {
            if (e2.date() < n2.date()) {
              return -t4(n2, e2);
            }
            var r2 = (n2.year() - e2.year()) * 12 + (n2.month() - e2.month());
            var i2 = e2.clone().add(r2, c);
            var s2 = n2 - i2 < 0;
            var u2 = e2.clone().add(r2 + (s2 ? -1 : 1), c);
            return +(-(r2 + (n2 - i2) / (s2 ? i2 - u2 : u2 - i2)) || 0);
          },
          a: function (t4) {
            if (t4 < 0) {
              return Math.ceil(t4) || 0;
            } else {
              return Math.floor(t4);
            }
          },
          p: function (t4) {
            return {
              M: c,
              y: h,
              w: o,
              d: a,
              D: d,
              h: u,
              m: s,
              s: i,
              ms: r,
              Q: f
            }[t4] || String(t4 || "").toLowerCase().replace(/s$/, "");
          },
          u: function (t4) {
            return t4 === undefined;
          }
        };
        var g = "en";
        var D = {
          [g]: M
        };
        var p = "$isDayjsObject";
        function S(t4) {
          return t4 instanceof _ || !!t4 && !!t4[p];
        }
        var w = function t4(e2, n2, r2) {
          var i2;
          if (!e2) {
            return g;
          }
          if (typeof e2 == "string") {
            var s2 = e2.toLowerCase();
            if (D[s2]) {
              i2 = s2;
            }
            if (n2) {
              D[s2] = n2;
              i2 = s2;
            }
            var u2 = e2.split("-");
            if (!i2 && u2.length > 1) {
              return t4(u2[0]);
            }
          } else {
            var a2 = e2.name;
            D[a2] = e2;
            i2 = a2;
          }
          if (!r2 && i2) {
            g = i2;
          }
          return i2 || !r2 && g;
        };
        function O(t4, e2) {
          if (S(t4)) {
            return t4.clone();
          }
          var n2 = typeof e2 == "object" ? e2 : {};
          n2.date = t4;
          n2.args = arguments;
          return new _(n2);
        }
        var b = v;
        b.l = w;
        b.i = S;
        b.w = function (t4, e2) {
          return O(t4, {
            locale: e2.$L,
            utc: e2.$u,
            x: e2.$x,
            $offset: e2.$offset
          });
        };
        var _ = function () {
          function M2(t4) {
            this.$L = w(t4.locale, null, true);
            this.parse(t4);
            this.$x = this.$x || t4.x || {};
            this[p] = true;
          }
          var m2 = M2.prototype;
          m2.parse = function (t4) {
            this.$d = function (t5) {
              var e2 = t5.date;
              var n2 = t5.utc;
              if (e2 === null) {
                return /* @__PURE__ */new Date(NaN);
              }
              if (b.u(e2)) {
                return /* @__PURE__ */new Date();
              }
              if (e2 instanceof Date) {
                return new Date(e2);
              }
              if (typeof e2 == "string" && !/Z$/i.test(e2)) {
                var r2 = e2.match($);
                if (r2) {
                  var i2 = r2[2] - 1 || 0;
                  var s2 = (r2[7] || "0").substring(0, 3);
                  if (n2) {
                    return new Date(Date.UTC(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2));
                  } else {
                    return new Date(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2);
                  }
                }
              }
              return new Date(e2);
            }(t4);
            this.init();
          };
          m2.init = function () {
            var t4 = this.$d;
            this.$y = t4.getFullYear();
            this.$M = t4.getMonth();
            this.$D = t4.getDate();
            this.$W = t4.getDay();
            this.$H = t4.getHours();
            this.$m = t4.getMinutes();
            this.$s = t4.getSeconds();
            this.$ms = t4.getMilliseconds();
          };
          m2.$utils = function () {
            return b;
          };
          m2.isValid = function () {
            return this.$d.toString() !== l;
          };
          m2.isSame = function (t4, e2) {
            var n2 = O(t4);
            return this.startOf(e2) <= n2 && n2 <= this.endOf(e2);
          };
          m2.isAfter = function (t4, e2) {
            return O(t4) < this.startOf(e2);
          };
          m2.isBefore = function (t4, e2) {
            return this.endOf(e2) < O(t4);
          };
          m2.$g = function (t4, e2, n2) {
            if (b.u(t4)) {
              return this[e2];
            } else {
              return this.set(n2, t4);
            }
          };
          m2.unix = function () {
            return Math.floor(this.valueOf() / 1000);
          };
          m2.valueOf = function () {
            return this.$d.getTime();
          };
          m2.startOf = function (t4, e2) {
            var n2 = this;
            var r2 = !!b.u(e2) || e2;
            var f2 = b.p(t4);
            function l2(t5, e3) {
              var i2 = b.w(n2.$u ? Date.UTC(n2.$y, e3, t5) : new Date(n2.$y, e3, t5), n2);
              if (r2) {
                return i2;
              } else {
                return i2.endOf(a);
              }
            }
            function $2(t5, e3) {
              return b.w(n2.toDate()[t5].apply(n2.toDate("s"), (r2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e3)), n2);
            }
            var y2 = this.$W;
            var M3 = this.$M;
            var m3 = this.$D;
            var v2 = "set" + (this.$u ? "UTC" : "");
            switch (f2) {
              case h:
                if (r2) {
                  return l2(1, 0);
                } else {
                  return l2(31, 11);
                }
              case c:
                if (r2) {
                  return l2(1, M3);
                } else {
                  return l2(0, M3 + 1);
                }
              case o:
                var g2 = this.$locale().weekStart || 0;
                var D2 = (y2 < g2 ? y2 + 7 : y2) - g2;
                return l2(r2 ? m3 - D2 : m3 + (6 - D2), M3);
              case a:
              case d:
                return $2(v2 + "Hours", 0);
              case u:
                return $2(v2 + "Minutes", 1);
              case s:
                return $2(v2 + "Seconds", 2);
              case i:
                return $2(v2 + "Milliseconds", 3);
              default:
                return this.clone();
            }
          };
          m2.endOf = function (t4) {
            return this.startOf(t4, false);
          };
          m2.$set = function (t4, e2) {
            var n2;
            var o2 = b.p(t4);
            var f2 = "set" + (this.$u ? "UTC" : "");
            var l2 = (n2 = {}, n2[a] = f2 + "Date", n2[d] = f2 + "Date", n2[c] = f2 + "Month", n2[h] = f2 + "FullYear", n2[u] = f2 + "Hours", n2[s] = f2 + "Minutes", n2[i] = f2 + "Seconds", n2[r] = f2 + "Milliseconds", n2)[o2];
            var $2 = o2 === a ? this.$D + (e2 - this.$W) : e2;
            if (o2 === c || o2 === h) {
              var y2 = this.clone().set(d, 1);
              y2.$d[l2]($2);
              y2.init();
              this.$d = y2.set(d, Math.min(this.$D, y2.daysInMonth())).$d;
            } else if (l2) {
              this.$d[l2]($2);
            }
            this.init();
            return this;
          };
          m2.set = function (t4, e2) {
            return this.clone().$set(t4, e2);
          };
          m2.get = function (t4) {
            return this[b.p(t4)]();
          };
          m2.add = function (r2, f2) {
            var d2;
            var l2 = this;
            r2 = Number(r2);
            var $2 = b.p(f2);
            function y2(t4) {
              var e2 = O(l2);
              return b.w(e2.date(e2.date() + Math.round(t4 * r2)), l2);
            }
            if ($2 === c) {
              return this.set(c, this.$M + r2);
            }
            if ($2 === h) {
              return this.set(h, this.$y + r2);
            }
            if ($2 === a) {
              return y2(1);
            }
            if ($2 === o) {
              return y2(7);
            }
            var M3 = (d2 = {}, d2[s] = e, d2[u] = n, d2[i] = t3, d2)[$2] || 1;
            var m3 = this.$d.getTime() + r2 * M3;
            return b.w(m3, this);
          };
          m2.subtract = function (t4, e2) {
            return this.add(t4 * -1, e2);
          };
          m2.format = function (t4) {
            var e2 = this;
            var n2 = this.$locale();
            if (!this.isValid()) {
              return n2.invalidDate || l;
            }
            var r2 = t4 || "YYYY-MM-DDTHH:mm:ssZ";
            var i2 = b.z(this);
            var s2 = this.$H;
            var u2 = this.$m;
            var a2 = this.$M;
            var o2 = n2.weekdays;
            var c2 = n2.months;
            var f2 = n2.meridiem;
            function h2(t5, n3, i3, s3) {
              return t5 && (t5[n3] || t5(e2, r2)) || i3[n3].slice(0, s3);
            }
            function d2(t5) {
              return b.s(s2 % 12 || 12, t5, "0");
            }
            var $2 = f2 || function (t5, e3, n3) {
              var r3 = t5 < 12 ? "AM" : "PM";
              if (n3) {
                return r3.toLowerCase();
              } else {
                return r3;
              }
            };
            return r2.replace(y, function (t5, r3) {
              return r3 || function (t6) {
                switch (t6) {
                  case "YY":
                    return String(e2.$y).slice(-2);
                  case "YYYY":
                    return b.s(e2.$y, 4, "0");
                  case "M":
                    return a2 + 1;
                  case "MM":
                    return b.s(a2 + 1, 2, "0");
                  case "MMM":
                    return h2(n2.monthsShort, a2, c2, 3);
                  case "MMMM":
                    return h2(c2, a2);
                  case "D":
                    return e2.$D;
                  case "DD":
                    return b.s(e2.$D, 2, "0");
                  case "d":
                    return String(e2.$W);
                  case "dd":
                    return h2(n2.weekdaysMin, e2.$W, o2, 2);
                  case "ddd":
                    return h2(n2.weekdaysShort, e2.$W, o2, 3);
                  case "dddd":
                    return o2[e2.$W];
                  case "H":
                    return String(s2);
                  case "HH":
                    return b.s(s2, 2, "0");
                  case "h":
                    return d2(1);
                  case "hh":
                    return d2(2);
                  case "a":
                    return $2(s2, u2, true);
                  case "A":
                    return $2(s2, u2, false);
                  case "m":
                    return String(u2);
                  case "mm":
                    return b.s(u2, 2, "0");
                  case "s":
                    return String(e2.$s);
                  case "ss":
                    return b.s(e2.$s, 2, "0");
                  case "SSS":
                    return b.s(e2.$ms, 3, "0");
                  case "Z":
                    return i2;
                }
                return null;
              }(t5) || i2.replace(":", "");
            });
          };
          m2.utcOffset = function () {
            return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
          };
          m2.diff = function (r2, d2, l2) {
            var $2;
            var y2 = this;
            var M3 = b.p(d2);
            var m3 = O(r2);
            var v2 = (m3.utcOffset() - this.utcOffset()) * e;
            var g2 = this - m3;
            function D2() {
              return b.m(y2, m3);
            }
            switch (M3) {
              case h:
                $2 = D2() / 12;
                break;
              case c:
                $2 = D2();
                break;
              case f:
                $2 = D2() / 3;
                break;
              case o:
                $2 = (g2 - v2) / 604800000;
                break;
              case a:
                $2 = (g2 - v2) / 86400000;
                break;
              case u:
                $2 = g2 / n;
                break;
              case s:
                $2 = g2 / e;
                break;
              case i:
                $2 = g2 / t3;
                break;
              default:
                $2 = g2;
            }
            if (l2) {
              return $2;
            } else {
              return b.a($2);
            }
          };
          m2.daysInMonth = function () {
            return this.endOf(c).$D;
          };
          m2.$locale = function () {
            return D[this.$L];
          };
          m2.locale = function (t4, e2) {
            if (!t4) {
              return this.$L;
            }
            var n2 = this.clone();
            var r2 = w(t4, e2, true);
            if (r2) {
              n2.$L = r2;
            }
            return n2;
          };
          m2.clone = function () {
            return b.w(this.$d, this);
          };
          m2.toDate = function () {
            return new Date(this.valueOf());
          };
          m2.toJSON = function () {
            if (this.isValid()) {
              return this.toISOString();
            } else {
              return null;
            }
          };
          m2.toISOString = function () {
            return this.$d.toISOString();
          };
          m2.toString = function () {
            return this.$d.toUTCString();
          };
          return M2;
        }();
        var k = _.prototype;
        O.prototype = k;
        [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h], ["$D", d]].forEach(function (t4) {
          k[t4[1]] = function (e2) {
            return this.$g(e2, t4[0], t4[1]);
          };
        });
        O.extend = function (t4, e2) {
          if (!t4.$i) {
            t4(e2, _, O);
            t4.$i = true;
          }
          return O;
        };
        O.locale = w;
        O.isDayjs = S;
        O.unix = function (t4) {
          return O(t4 * 1000);
        };
        O.en = D[g];
        O.Ls = D;
        O.p = {};
        return O;
      });
    }
  });


  // node_modules/dayjs/locale/it.js
  var require_it = __commonJS({
    "node_modules/dayjs/locale/it.js"(exports, module) {
      (function (e, o) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = o(require_dayjs_min());
        } else if (typeof define == "function" && define.amd) {
          define(["dayjs"], o);
        } else {
          (e = typeof globalThis != "undefined" ? globalThis : e || self).dayjs_locale_it = o(e.dayjs);
        }
      })(exports, function (e) {
        "use strict";

        function o(e2) {
          if (e2 && typeof e2 == "object" && "default" in e2) {
            return e2;
          } else {
            return {
              default: e2
            };
          }
        }
        var t3 = o(e);
        var n = {
          name: "it",
          weekdays: "domenica_lunedì_martedì_mercoledì_giovedì_venerdì_sabato".split("_"),
          weekdaysShort: "dom_lun_mar_mer_gio_ven_sab".split("_"),
          weekdaysMin: "do_lu_ma_me_gi_ve_sa".split("_"),
          months: "gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre".split("_"),
          weekStart: 1,
          monthsShort: "gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic".split("_"),
          formats: {
            LT: "HH:mm",
            LTS: "HH:mm:ss",
            L: "DD/MM/YYYY",
            LL: "D MMMM YYYY",
            LLL: "D MMMM YYYY HH:mm",
            LLLL: "dddd D MMMM YYYY HH:mm"
          },
          relativeTime: {
            future: "tra %s",
            past: "%s fa",
            s: "qualche secondo",
            m: "un minuto",
            mm: "%d minuti",
            h: "un' ora",
            hh: "%d ore",
            d: "un giorno",
            dd: "%d giorni",
            M: "un mese",
            MM: "%d mesi",
            y: "un anno",
            yy: "%d anni"
          },
          ordinal: function (e2) {
            return e2 + "º";
          }
        };
        t3.default.locale(n, null, true);
        return n;
      });
    }
  });


  // node_modules/dayjs/locale/ru.js
  var require_ru = __commonJS({
    "node_modules/dayjs/locale/ru.js"(exports, module) {
      (function (_, t3) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = t3(require_dayjs_min());
        } else if (typeof define == "function" && define.amd) {
          define(["dayjs"], t3);
        } else {
          (_ = typeof globalThis != "undefined" ? globalThis : _ || self).dayjs_locale_ru = t3(_.dayjs);
        }
      })(exports, function (_) {
        "use strict";

        function t3(_2) {
          if (_2 && typeof _2 == "object" && "default" in _2) {
            return _2;
          } else {
            return {
              default: _2
            };
          }
        }
        var e = t3(_);
        var n = "января_февраля_марта_апреля_мая_июня_июля_августа_сентября_октября_ноября_декабря".split("_");
        var s = "январь_февраль_март_апрель_май_июнь_июль_август_сентябрь_октябрь_ноябрь_декабрь".split("_");
        var r = "янв._февр._мар._апр._мая_июня_июля_авг._сент._окт._нояб._дек.".split("_");
        var o = "янв._февр._март_апр._май_июнь_июль_авг._сент._окт._нояб._дек.".split("_");
        var i = /D[oD]?(\[[^[\]]*\]|\s)+MMMM?/;
        function d(_2, t4, e2) {
          var n2;
          var s2;
          if (e2 === "m") {
            if (t4) {
              return "минута";
            } else {
              return "минуту";
            }
          } else {
            return _2 + " " + (n2 = +_2, s2 = {
              mm: t4 ? "минута_минуты_минут" : "минуту_минуты_минут",
              hh: "час_часа_часов",
              dd: "день_дня_дней",
              MM: "месяц_месяца_месяцев",
              yy: "год_года_лет"
            }[e2].split("_"), n2 % 10 == 1 && n2 % 100 != 11 ? s2[0] : n2 % 10 >= 2 && n2 % 10 <= 4 && (n2 % 100 < 10 || n2 % 100 >= 20) ? s2[1] : s2[2]);
          }
        }
        function u(_2, t4) {
          if (i.test(t4)) {
            return n[_2.month()];
          } else {
            return s[_2.month()];
          }
        }
        u.s = s;
        u.f = n;
        function a(_2, t4) {
          if (i.test(t4)) {
            return r[_2.month()];
          } else {
            return o[_2.month()];
          }
        }
        a.s = o;
        a.f = r;
        var m = {
          name: "ru",
          weekdays: "воскресенье_понедельник_вторник_среда_четверг_пятница_суббота".split("_"),
          weekdaysShort: "вск_пнд_втр_срд_чтв_птн_сбт".split("_"),
          weekdaysMin: "вс_пн_вт_ср_чт_пт_сб".split("_"),
          months: u,
          monthsShort: a,
          weekStart: 1,
          yearStart: 4,
          formats: {
            LT: "H:mm",
            LTS: "H:mm:ss",
            L: "DD.MM.YYYY",
            LL: "D MMMM YYYY г.",
            LLL: "D MMMM YYYY г., H:mm",
            LLLL: "dddd, D MMMM YYYY г., H:mm"
          },
          relativeTime: {
            future: "через %s",
            past: "%s назад",
            s: "несколько секунд",
            m: d,
            mm: d,
            h: "час",
            hh: d,
            d: "день",
            dd: d,
            M: "месяц",
            MM: d,
            y: "год",
            yy: d
          },
          ordinal: function (_2) {
            return _2;
          },
          meridiem: function (_2) {
            if (_2 < 4) {
              return "ночи";
            } else if (_2 < 12) {
              return "утра";
            } else if (_2 < 17) {
              return "дня";
            } else {
              return "вечера";
            }
          }
        };
        e.default.locale(m, null, true);
        return m;
      });
    }
  });


  // node_modules/dayjs/locale/zh-cn.js
  var require_zh_cn = __commonJS({
    "node_modules/dayjs/locale/zh-cn.js"(exports, module) {
      (function (e, _) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = _(require_dayjs_min());
        } else if (typeof define == "function" && define.amd) {
          define(["dayjs"], _);
        } else {
          (e = typeof globalThis != "undefined" ? globalThis : e || self).dayjs_locale_zh_cn = _(e.dayjs);
        }
      })(exports, function (e) {
        "use strict";

        function _(e2) {
          if (e2 && typeof e2 == "object" && "default" in e2) {
            return e2;
          } else {
            return {
              default: e2
            };
          }
        }
        var t3 = _(e);
        var d = {
          name: "zh-cn",
          weekdays: "星期日_星期一_星期二_星期三_星期四_星期五_星期六".split("_"),
          weekdaysShort: "周日_周一_周二_周三_周四_周五_周六".split("_"),
          weekdaysMin: "日_一_二_三_四_五_六".split("_"),
          months: "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_"),
          monthsShort: "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split("_"),
          ordinal: function (e2, _2) {
            if (_2 === "W") {
              return e2 + "周";
            } else {
              return e2 + "日";
            }
          },
          weekStart: 1,
          yearStart: 4,
          formats: {
            LT: "HH:mm",
            LTS: "HH:mm:ss",
            L: "YYYY/MM/DD",
            LL: "YYYY年M月D日",
            LLL: "YYYY年M月D日Ah点mm分",
            LLLL: "YYYY年M月D日ddddAh点mm分",
            l: "YYYY/M/D",
            ll: "YYYY年M月D日",
            lll: "YYYY年M月D日 HH:mm",
            llll: "YYYY年M月D日dddd HH:mm"
          },
          relativeTime: {
            future: "%s内",
            past: "%s前",
            s: "几秒",
            m: "1 分钟",
            mm: "%d 分钟",
            h: "1 小时",
            hh: "%d 小时",
            d: "1 天",
            dd: "%d 天",
            M: "1 个月",
            MM: "%d 个月",
            y: "1 年",
            yy: "%d 年"
          },
          meridiem: function (e2, _2) {
            var t4 = e2 * 100 + _2;
            if (t4 < 600) {
              return "凌晨";
            } else if (t4 < 900) {
              return "早上";
            } else if (t4 < 1100) {
              return "上午";
            } else if (t4 < 1300) {
              return "中午";
            } else if (t4 < 1800) {
              return "下午";
            } else {
              return "晚上";
            }
          }
        };
        t3.default.locale(d, null, true);
        return d;
      });
    }
  });


  // node_modules/dayjs/locale/zh-tw.js
  var require_zh_tw = __commonJS({
    "node_modules/dayjs/locale/zh-tw.js"(exports, module) {
      (function (_, e) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = e(require_dayjs_min());
        } else if (typeof define == "function" && define.amd) {
          define(["dayjs"], e);
        } else {
          (_ = typeof globalThis != "undefined" ? globalThis : _ || self).dayjs_locale_zh_tw = e(_.dayjs);
        }
      })(exports, function (_) {
        "use strict";

        function e(_2) {
          if (_2 && typeof _2 == "object" && "default" in _2) {
            return _2;
          } else {
            return {
              default: _2
            };
          }
        }
        var t3 = e(_);
        var d = {
          name: "zh-tw",
          weekdays: "星期日_星期一_星期二_星期三_星期四_星期五_星期六".split("_"),
          weekdaysShort: "週日_週一_週二_週三_週四_週五_週六".split("_"),
          weekdaysMin: "日_一_二_三_四_五_六".split("_"),
          months: "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_"),
          monthsShort: "1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月".split("_"),
          ordinal: function (_2, e2) {
            if (e2 === "W") {
              return _2 + "週";
            } else {
              return _2 + "日";
            }
          },
          formats: {
            LT: "HH:mm",
            LTS: "HH:mm:ss",
            L: "YYYY/MM/DD",
            LL: "YYYY年M月D日",
            LLL: "YYYY年M月D日 HH:mm",
            LLLL: "YYYY年M月D日dddd HH:mm",
            l: "YYYY/M/D",
            ll: "YYYY年M月D日",
            lll: "YYYY年M月D日 HH:mm",
            llll: "YYYY年M月D日dddd HH:mm"
          },
          relativeTime: {
            future: "%s內",
            past: "%s前",
            s: "幾秒",
            m: "1 分鐘",
            mm: "%d 分鐘",
            h: "1 小時",
            hh: "%d 小時",
            d: "1 天",
            dd: "%d 天",
            M: "1 個月",
            MM: "%d 個月",
            y: "1 年",
            yy: "%d 年"
          },
          meridiem: function (_2, e2) {
            var t4 = _2 * 100 + e2;
            if (t4 < 600) {
              return "凌晨";
            } else if (t4 < 900) {
              return "早上";
            } else if (t4 < 1100) {
              return "上午";
            } else if (t4 < 1300) {
              return "中午";
            } else if (t4 < 1800) {
              return "下午";
            } else {
              return "晚上";
            }
          }
        };
        t3.default.locale(d, null, true);
        return d;
      });
    }
  });


  // node_modules/dayjs/plugin/relativeTime.js
  var require_relativeTime = __commonJS({
    "node_modules/dayjs/plugin/relativeTime.js"(exports, module) {
      (function (r, e) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = e();
        } else if (typeof define == "function" && define.amd) {
          define(e);
        } else {
          (r = typeof globalThis != "undefined" ? globalThis : r || self).dayjs_plugin_relativeTime = e();
        }
      })(exports, function () {
        "use strict";

        return function (r, e, t3) {
          r = r || {};
          var n = e.prototype;
          var o = {
            future: "in %s",
            past: "%s ago",
            s: "a few seconds",
            m: "a minute",
            mm: "%d minutes",
            h: "an hour",
            hh: "%d hours",
            d: "a day",
            dd: "%d days",
            M: "a month",
            MM: "%d months",
            y: "a year",
            yy: "%d years"
          };
          function i(r2, e2, t4, o2) {
            return n.fromToBase(r2, e2, t4, o2);
          }
          t3.en.relativeTime = o;
          n.fromToBase = function (e2, n2, i2, d2, u) {
            var f;
            var a;
            var s;
            var l = i2.$locale().relativeTime || o;
            var h = r.thresholds || [{
              l: "s",
              r: 44,
              d: "second"
            }, {
              l: "m",
              r: 89
            }, {
              l: "mm",
              r: 44,
              d: "minute"
            }, {
              l: "h",
              r: 89
            }, {
              l: "hh",
              r: 21,
              d: "hour"
            }, {
              l: "d",
              r: 35
            }, {
              l: "dd",
              r: 25,
              d: "day"
            }, {
              l: "M",
              r: 45
            }, {
              l: "MM",
              r: 10,
              d: "month"
            }, {
              l: "y",
              r: 17
            }, {
              l: "yy",
              d: "year"
            }];
            for (var m = h.length, c = 0; c < m; c += 1) {
              var y = h[c];
              if (y.d) {
                f = d2 ? t3(e2).diff(i2, y.d, true) : i2.diff(e2, y.d, true);
              }
              var p = (r.rounding || Math.round)(Math.abs(f));
              s = f > 0;
              if (p <= y.r || !y.r) {
                if (p <= 1 && c > 0) {
                  y = h[c - 1];
                }
                var v = l[y.l];
                if (u) {
                  p = u("" + p);
                }
                a = typeof v == "string" ? v.replace("%d", p) : v(p, n2, y.l, s);
                break;
              }
            }
            if (n2) {
              return a;
            }
            var M = s ? l.future : l.past;
            if (typeof M == "function") {
              return M(a);
            } else {
              return M.replace("%s", a);
            }
          };
          n.to = function (r2, e2) {
            return i(r2, e2, this, true);
          };
          n.from = function (r2, e2) {
            return i(r2, e2, this);
          };
          function d(r2) {
            if (r2.$u) {
              return t3.utc();
            } else {
              return t3();
            }
          }
          n.toNow = function (r2) {
            return this.to(d(this), r2);
          };
          n.fromNow = function (r2) {
            return this.from(d(this), r2);
          };
        };
      });
    }
  });


  // node_modules/dayjs/plugin/utc.js
  var require_utc = __commonJS({
    "node_modules/dayjs/plugin/utc.js"(exports, module) {
      (function (t3, i) {
        if (typeof exports == "object" && typeof module != "undefined") {
          module.exports = i();
        } else if (typeof define == "function" && define.amd) {
          define(i);
        } else {
          (t3 = typeof globalThis != "undefined" ? globalThis : t3 || self).dayjs_plugin_utc = i();
        }
      })(exports, function () {
        "use strict";

        var t3 = "minute";
        var i = /[+-]\d\d(?::?\d\d)?/g;
        var e = /([+-]|\d\d)/g;
        return function (s, f, n) {
          var u = f.prototype;
          n.utc = function (t4) {
            var i2 = {
              date: t4,
              utc: true,
              args: arguments
            };
            return new f(i2);
          };
          u.utc = function (i2) {
            var e2 = n(this.toDate(), {
              locale: this.$L,
              utc: true
            });
            if (i2) {
              return e2.add(this.utcOffset(), t3);
            } else {
              return e2;
            }
          };
          u.local = function () {
            return n(this.toDate(), {
              locale: this.$L,
              utc: false
            });
          };
          var o = u.parse;
          u.parse = function (t4) {
            if (t4.utc) {
              this.$u = true;
            }
            if (!this.$utils().u(t4.$offset)) {
              this.$offset = t4.$offset;
            }
            o.call(this, t4);
          };
          var r = u.init;
          u.init = function () {
            if (this.$u) {
              var t4 = this.$d;
              this.$y = t4.getUTCFullYear();
              this.$M = t4.getUTCMonth();
              this.$D = t4.getUTCDate();
              this.$W = t4.getUTCDay();
              this.$H = t4.getUTCHours();
              this.$m = t4.getUTCMinutes();
              this.$s = t4.getUTCSeconds();
              this.$ms = t4.getUTCMilliseconds();
            } else {
              r.call(this);
            }
          };
          var a = u.utcOffset;
          u.utcOffset = function (s2, f2) {
            var n2 = this.$utils().u;
            if (n2(s2)) {
              if (this.$u) {
                return 0;
              } else if (n2(this.$offset)) {
                return a.call(this);
              } else {
                return this.$offset;
              }
            }
            if (typeof s2 == "string" && (s2 = function (t4 = "") {
              var s3 = t4.match(i);
              if (!s3) {
                return null;
              }
              var f3 = ("" + s3[0]).match(e) || ["-", 0, 0];
              var n3 = f3[0];
              var u3 = +f3[1] * 60 + +f3[2];
              if (u3 === 0) {
                return 0;
              } else if (n3 === "+") {
                return u3;
              } else {
                return -u3;
              }
            }(s2), s2 === null)) {
              return this;
            }
            var u2 = Math.abs(s2) <= 16 ? s2 * 60 : s2;
            var o2 = this;
            if (f2) {
              o2.$offset = u2;
              o2.$u = s2 === 0;
              return o2;
            }
            if (s2 !== 0) {
              var r2 = this.$u ? this.toDate().getTimezoneOffset() : this.utcOffset() * -1;
              (o2 = this.local().add(u2 + r2, t3)).$offset = u2;
              o2.$x.$localOffset = r2;
            } else {
              o2 = this.utc();
            }
            return o2;
          };
          var h = u.format;
          u.format = function (t4) {
            var i2 = t4 || (this.$u ? "YYYY-MM-DDTHH:mm:ss[Z]" : "");
            return h.call(this, i2);
          };
          u.valueOf = function () {
            var t4 = this.$utils().u(this.$offset) ? 0 : this.$offset + (this.$x.$localOffset || this.$d.getTimezoneOffset());
            return this.$d.valueOf() - t4 * 60000;
          };
          u.isUTC = function () {
            return !!this.$u;
          };
          u.toISOString = function () {
            return this.toDate().toISOString();
          };
          u.toString = function () {
            return this.toDate().toUTCString();
          };
          var l = u.toDate;
          u.toDate = function (t4) {
            if (t4 === "s" && this.$offset) {
              return n(this.format("YYYY-MM-DD HH:mm:ss:SSS")).toDate();
            } else {
              return l.call(this);
            }
          };
          var c = u.diff;
          u.diff = function (t4, i2, e2) {
            if (t4 && this.$u === t4.$u) {
              return c.call(this, t4, i2, e2);
            }
            var s2 = this.local();
            var f2 = n(t4).local();
            return c.call(s2, f2, i2, e2);
          };
        };
      });
    }
  });


  // node_modules/zotero-plugin-toolkit/dist/chunk-Cl8Af3a2.js
  var __defProp2 = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all) {
      __defProp2(target, name, {
        get: all[name],
        enumerable: true
      });
    }
  };


  // node_modules/zotero-plugin-toolkit/dist/index.js
  var version = "5.1.0-beta.13";
  var DebugBridge = class DebugBridge2 {
    static version = 2;
    static passwordPref = "extensions.zotero.debug-bridge.password";
    get version() {
      return DebugBridge2.version;
    }
    _disableDebugBridgePassword;
    get disableDebugBridgePassword() {
      return this._disableDebugBridgePassword;
    }
    set disableDebugBridgePassword(value) {
      this._disableDebugBridgePassword = value;
    }
    get password() {
      return BasicTool.getZotero().Prefs.get(DebugBridge2.passwordPref, true);
    }
    set password(v) {
      BasicTool.getZotero().Prefs.set(DebugBridge2.passwordPref, v, true);
    }
    constructor() {
      this._disableDebugBridgePassword = false;
      this.initializeDebugBridge();
    }
    static setModule(instance) {
      if (!instance.debugBridge?.version || instance.debugBridge.version < DebugBridge2.version) {
        instance.debugBridge = new DebugBridge2();
      }
    }
    initializeDebugBridge() {
      const debugBridgeExtension = {
        noContent: true,
        doAction: async uri => {
          const Zotero$1 = BasicTool.getZotero();
          const window$1 = Zotero$1.getMainWindow();
          const uriString = uri.spec.split("//").pop();
          if (!uriString) {
            return;
          }
          const params = {};
          uriString.split("?").pop()?.split("&").forEach(p => {
            params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
          });
          const skipPasswordCheck = toolkitGlobal_default.getInstance()?.debugBridge.disableDebugBridgePassword;
          let allowed = false;
          if (skipPasswordCheck) {
            allowed = true;
          } else if (typeof params.password === "undefined" && typeof this.password === "undefined") {
            allowed = window$1.confirm(`External App ${params.app} wants to execute command without password.
Command:
${(params.run || params.file || "").slice(0, 100)}
If you do not know what it is, please click Cancel to deny.`);
          } else {
            allowed = this.password === params.password;
          }
          if (allowed) {
            if (params.run) {
              try {
                const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
                const f = new AsyncFunction("Zotero,window", params.run);
                await f(Zotero$1, window$1);
              } catch (e) {
                Zotero$1.debug(e);
                window$1.console.log(e);
              }
            }
            if (params.file) {
              try {
                Services.scriptloader.loadSubScript(params.file, {
                  Zotero: Zotero$1,
                  window: window$1
                });
              } catch (e) {
                Zotero$1.debug(e);
                window$1.console.log(e);
              }
            }
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://ztoolkit-debug"] = debugBridgeExtension;
    }
  };
  var PluginBridge = class PluginBridge2 {
    static version = 1;
    get version() {
      return PluginBridge2.version;
    }
    constructor() {
      this.initializePluginBridge();
    }
    static setModule(instance) {
      if (!instance.pluginBridge?.version || instance.pluginBridge.version < PluginBridge2.version) {
        instance.pluginBridge = new PluginBridge2();
      }
    }
    initializePluginBridge() {
      const {
        AddonManager
      } = _importESModule("resource://gre/modules/AddonManager.sys.mjs");
      const Zotero$1 = BasicTool.getZotero();
      const pluginBridgeExtension = {
        noContent: true,
        doAction: async uri => {
          try {
            const uriString = uri.spec.split("//").pop();
            if (!uriString) {
              return;
            }
            const params = {};
            uriString.split("?").pop()?.split("&").forEach(p => {
              params[p.split("=")[0]] = decodeURIComponent(p.split("=")[1]);
            });
            if (params.action === "install" && params.url) {
              if (params.minVersion && Services.vc.compare(Zotero$1.version, params.minVersion) < 0 || params.maxVersion && Services.vc.compare(Zotero$1.version, params.maxVersion) > 0) {
                throw new Error(`Plugin is not compatible with Zotero version ${Zotero$1.version}.The plugin requires Zotero version between ${params.minVersion} and ${params.maxVersion}.`);
              }
              const addon2 = await AddonManager.getInstallForURL(params.url);
              if (addon2 && addon2.state === AddonManager.STATE_AVAILABLE) {
                addon2.install();
                hint("Plugin installed successfully.", true);
              } else {
                throw new Error(`Plugin ${params.url} is not available.`);
              }
            }
          } catch (e) {
            Zotero$1.logError(e);
            hint(e.message, false);
          }
        },
        newChannel(uri) {
          this.doAction(uri);
        }
      };
      Services.io.getProtocolHandler("zotero").wrappedJSObject._extensions["zotero://plugin"] = pluginBridgeExtension;
    }
  };
  function hint(content, success) {
    const progressWindow = new Zotero.ProgressWindow({
      closeOnClick: true
    });
    progressWindow.changeHeadline("Plugin Toolkit");
    progressWindow.progress = new progressWindow.ItemProgress(success ? "chrome://zotero/skin/tick.png" : "chrome://zotero/skin/cross.png", content);
    progressWindow.progress.setProgress(100);
    progressWindow.show();
    progressWindow.startCloseTimer(5000);
  }
  var ToolkitGlobal = class ToolkitGlobal2 {
    debugBridge;
    pluginBridge;
    prompt;
    currentWindow;
    constructor() {
      initializeModules(this);
      this.currentWindow = BasicTool.getZotero().getMainWindow();
    }
    /**
    * Get the global unique instance of `class ToolkitGlobal`.
    * @returns An instance of `ToolkitGlobal`.
    */
    static getInstance() {
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = BasicTool.getZotero();
        }
      } catch {}
      if (!_Zotero) {
        return undefined;
      }
      let requireInit = false;
      if (!("_toolkitGlobal" in _Zotero)) {
        _Zotero._toolkitGlobal = new ToolkitGlobal2();
        requireInit = true;
      }
      const currentGlobal = _Zotero._toolkitGlobal;
      if (currentGlobal.currentWindow !== _Zotero.getMainWindow()) {
        checkWindowDependentModules(currentGlobal);
        requireInit = true;
      }
      if (requireInit) {
        initializeModules(currentGlobal);
      }
      return currentGlobal;
    }
  };
  function initializeModules(instance) {
    new BasicTool().log("Initializing ToolkitGlobal modules");
    setModule(instance, "prompt", {
      _ready: false,
      instance: undefined
    });
    DebugBridge.setModule(instance);
    PluginBridge.setModule(instance);
  }
  function setModule(instance, key, module) {
    if (!module) {
      return;
    }
    if (!instance[key]) {
      instance[key] = module;
    }
    for (const moduleKey in module) {
      instance[key][moduleKey] ??= module[moduleKey];
    }
  }
  function checkWindowDependentModules(instance) {
    instance.currentWindow = BasicTool.getZotero().getMainWindow();
    instance.prompt = undefined;
  }
  var toolkitGlobal_default = ToolkitGlobal;
  var BasicTool = class BasicTool2 {
    /**
    * configurations.
    */
    _basicOptions;
    _console;
    /**
    * @deprecated Use `patcherManager` instead.
    */
    patchSign = "zotero-plugin-toolkit@3.0.0";
    static _version = version;
    /**
    * Get version - checks subclass first, then falls back to parent
    */
    get _version() {
      return version;
    }
    get basicOptions() {
      return this._basicOptions;
    }
    /**
    *
    * @param data Pass an BasicTool instance to copy its options.
    */
    constructor(data) {
      this._basicOptions = {
        log: {
          _type: "toolkitlog",
          disableConsole: false,
          disableZLog: false,
          prefix: ""
        },
        get debug() {
          if (this._debug) {
            return this._debug;
          }
          this._debug = toolkitGlobal_default.getInstance()?.debugBridge || {
            disableDebugBridgePassword: false,
            password: ""
          };
          return this._debug;
        },
        api: {
          pluginID: "zotero-plugin-toolkit@windingwind.com"
        },
        listeners: {
          callbacks: {
            onMainWindowLoad: /* @__PURE__ */new Set(),
            onMainWindowUnload: /* @__PURE__ */new Set(),
            onPluginUnload: /* @__PURE__ */new Set()
          },
          _mainWindow: undefined,
          _plugin: undefined
        }
      };
      try {
        if (typeof globalThis.ChromeUtils?.importESModule !== "undefined" || typeof globalThis.ChromeUtils?.import !== "undefined") {
          const {
            ConsoleAPI
          } = _importESModule("resource://gre/modules/Console.sys.mjs");
          this._console = new ConsoleAPI({
            consoleID: `${this._basicOptions.api.pluginID}-${Date.now()}`
          });
        }
      } catch {}
      this.updateOptions(data);
    }
    getGlobal(k) {
      if (typeof globalThis[k] !== "undefined") {
        return globalThis[k];
      }
      const _Zotero = BasicTool2.getZotero();
      try {
        const window$1 = _Zotero.getMainWindow();
        switch (k) {
          case "Zotero":
          case "zotero":
            return _Zotero;
          case "window":
            return window$1;
          case "windows":
            return _Zotero.getMainWindows();
          case "document":
            return window$1.document;
          case "ZoteroPane":
          case "ZoteroPane_Local":
            return _Zotero.getActiveZoteroPane();
          default:
            return window$1[k];
        }
      } catch (e) {
        Zotero.logError(e);
      }
    }
    /**
    * If it's an XUL element
    * @param elem
    */
    isXULElement(elem) {
      return elem.namespaceURI === "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    }
    /**
    * Create an XUL element
    *
    * For Zotero 6, use `createElementNS`;
    *
    * For Zotero 7+, use `createXULElement`.
    * @param doc
    * @param type
    * @example
    * Create a `<menuitem>`:
    * ```ts
    * const compat = new ZoteroCompat();
    * const doc = compat.getWindow().document;
    * const elem = compat.createXULElement(doc, "menuitem");
    * ```
    */
    createXULElement(doc, type) {
      return doc.createXULElement(type);
    }
    /**
    * Output to both Zotero.debug and console.log
    * @param data e.g. string, number, object, ...
    */
    log(...data) {
      if (data.length === 0) {
        return;
      }
      let _Zotero;
      try {
        if (typeof Zotero !== "undefined") {
          _Zotero = Zotero;
        } else {
          _Zotero = BasicTool2.getZotero();
        }
      } catch {}
      let options;
      if (data[data.length - 1]?._type === "toolkitlog") {
        options = data.pop();
      } else {
        options = this._basicOptions.log;
      }
      try {
        if (options.prefix) {
          data.splice(0, 0, options.prefix);
        }
        if (!options.disableConsole) {
          let _console;
          if (typeof console !== "undefined") {
            _console = console;
          } else if (_Zotero) {
            _console = _Zotero.getMainWindow()?.console;
          }
          if (!_console) {
            if (!this._console) {
              return;
            }
            _console = this._console;
          }
          if (_console.groupCollapsed) {
            _console.groupCollapsed(...data);
          } else {
            _console.group(...data);
          }
          _console.trace();
          _console.groupEnd();
        }
        if (!options.disableZLog) {
          if (typeof _Zotero === "undefined") {
            return;
          }
          _Zotero.debug(data.map(d => {
            try {
              if (typeof d === "object") {
                return JSON.stringify(d);
              } else {
                return String(d);
              }
            } catch {
              _Zotero.debug(d);
              return "";
            }
          }).join("\n"));
        }
      } catch (e) {
        if (_Zotero) {
          Zotero.logError(e);
        } else {
          console.error(e);
        }
      }
    }
    /**
    * Patch a function
    * @deprecated Use {@link PatchHelper} instead.
    * @param object The owner of the function
    * @param funcSign The signature of the function(function name)
    * @param ownerSign The signature of patch owner to avoid patching again
    * @param patcher The new wrapper of the patched function
    */
    patch(object, funcSign, ownerSign, patcher) {
      if (object[funcSign][ownerSign]) {
        throw new Error(`${String(funcSign)} re-patched`);
      }
      this.log("patching", funcSign, `by ${ownerSign}`);
      object[funcSign] = patcher(object[funcSign]);
      object[funcSign][ownerSign] = true;
    }
    /**
    * Add a Zotero event listener callback
    * @param type Event type
    * @param callback Event callback
    */
    addListenerCallback(type, callback) {
      if (["onMainWindowLoad", "onMainWindowUnload"].includes(type)) {
        this._ensureMainWindowListener();
      }
      if (type === "onPluginUnload") {
        this._ensurePluginListener();
      }
      this._basicOptions.listeners.callbacks[type].add(callback);
    }
    /**
    * Remove a Zotero event listener callback
    * @param type Event type
    * @param callback Event callback
    */
    removeListenerCallback(type, callback) {
      this._basicOptions.listeners.callbacks[type].delete(callback);
      this._ensureRemoveListener();
    }
    /**
    * Remove all Zotero event listener callbacks when the last callback is removed.
    */
    _ensureRemoveListener() {
      const {
        listeners
      } = this._basicOptions;
      if (listeners._mainWindow && listeners.callbacks.onMainWindowLoad.size === 0 && listeners.callbacks.onMainWindowUnload.size === 0) {
        Services.wm.removeListener(listeners._mainWindow);
        delete listeners._mainWindow;
      }
      if (listeners._plugin && listeners.callbacks.onPluginUnload.size === 0) {
        Zotero.Plugins.removeObserver(listeners._plugin);
        delete listeners._plugin;
      }
    }
    /**
    * Ensure the main window listener is registered.
    */
    _ensureMainWindowListener() {
      if (this._basicOptions.listeners._mainWindow) {
        return;
      }
      const mainWindowListener = {
        onOpenWindow: xulWindow => {
          const domWindow = xulWindow.docShell.domWindow;
          const onload = async () => {
            domWindow.removeEventListener("load", onload, false);
            if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
              return;
            }
            for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowLoad) {
              try {
                cbk(domWindow);
              } catch (e) {
                this.log(e);
              }
            }
          };
          domWindow.addEventListener("load", () => onload(), false);
        },
        onCloseWindow: async xulWindow => {
          const domWindow = xulWindow.docShell.domWindow;
          if (domWindow.location.href !== "chrome://zotero/content/zoteroPane.xhtml") {
            return;
          }
          for (const cbk of this._basicOptions.listeners.callbacks.onMainWindowUnload) {
            try {
              cbk(domWindow);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._mainWindow = mainWindowListener;
      Services.wm.addListener(mainWindowListener);
    }
    /**
    * Ensure the plugin listener is registered.
    */
    _ensurePluginListener() {
      if (this._basicOptions.listeners._plugin) {
        return;
      }
      const pluginListener = {
        shutdown: (...args) => {
          for (const cbk of this._basicOptions.listeners.callbacks.onPluginUnload) {
            try {
              cbk(...args);
            } catch (e) {
              this.log(e);
            }
          }
        }
      };
      this._basicOptions.listeners._plugin = pluginListener;
      Zotero.Plugins.addObserver(pluginListener);
    }
    updateOptions(source) {
      if (!source) {
        return this;
      }
      if (source instanceof BasicTool2) {
        this._basicOptions = source._basicOptions;
      } else {
        this._basicOptions = source;
      }
      return this;
    }
    static getZotero() {
      if (typeof Zotero !== "undefined") {
        return Zotero;
      }
      const {
        Zotero: _Zotero
      } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
      return _Zotero;
    }
  };
  var ManagerTool = class extends BasicTool {
    _ensureAutoUnregisterAll() {
      this.addListenerCallback("onPluginUnload", (params, _reason) => {
        if (params.id !== this.basicOptions.api.pluginID) {
          return;
        }
        this.unregisterAll();
      });
    }
  };
  function unregister(tools) {
    Object.values(tools).forEach(tool => {
      if (tool instanceof ManagerTool || typeof tool?.unregisterAll === "function") {
        tool.unregisterAll();
      }
    });
  }
  function makeHelperTool(cls, options) {
    return new Proxy(cls, {
      construct(target, args) {
        const _origin = new cls(...args);
        if (_origin instanceof BasicTool) {
          _origin.updateOptions(options);
        } else {
          _origin._version = BasicTool._version;
        }
        return _origin;
      }
    });
  }
  function _importESModule(path) {
    if (typeof ChromeUtils.importESModule === "function") {
      return ChromeUtils.importESModule(path, {
        global: "contextual"
      });
    }
    if (typeof ChromeUtils.import === "function") {
      if (path.endsWith(".sys.mjs")) {
        path = path.replace(/\.sys\.mjs$/, ".jsm");
      }
      return ChromeUtils.import(path);
    }
    throw new Error("ChromeUtils module import API is unavailable");
  }
  var ClipboardHelper = class extends BasicTool {
    transferable;
    clipboardService;
    filePath = "";
    constructor() {
      super();
      this.transferable = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
      this.clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
      this.transferable.init(null);
    }
    addText(source, type = "text/plain") {
      const str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
      str.data = source;
      if (type === "text/unicode") {
        type = "text/plain";
      }
      this.transferable.addDataFlavor(type);
      this.transferable.setTransferData(type, str, source.length * 2);
      return this;
    }
    addImage(source) {
      const parts = source.split(",");
      if (!parts[0].includes("base64")) {
        return this;
      }
      const mime = parts[0].match(/:(.*?);/)[1];
      const bstr = this.getGlobal("window").atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const imgTools = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);
      let mimeType;
      let img;
      if (this.getGlobal("Zotero").platformMajorVersion >= 102) {
        img = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mime);
        mimeType = "application/x-moz-nativeimage";
      } else {
        mimeType = `image/png`;
        img = Components.classes["@mozilla.org/supports-interface-pointer;1"].createInstance(Components.interfaces.nsISupportsInterfacePointer);
        img.data = imgTools.decodeImageFromArrayBuffer(u8arr.buffer, mimeType);
      }
      this.transferable.addDataFlavor(mimeType);
      this.transferable.setTransferData(mimeType, img, 0);
      return this;
    }
    addFile(path) {
      const file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      file.initWithPath(path);
      this.transferable.addDataFlavor("application/x-moz-file");
      this.transferable.setTransferData("application/x-moz-file", file);
      this.filePath = path;
      return this;
    }
    copy() {
      try {
        this.clipboardService.setData(this.transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
      } catch (e) {
        if (this.filePath && Zotero.isMac) {
          Zotero.Utilities.Internal.exec(`/usr/bin/osascript`, [`-e`, `set the clipboard to POSIX file "${this.filePath}"`]);
        } else {
          throw e;
        }
      }
      return this;
    }
  };
  var UITool = class extends BasicTool {
    get basicOptions() {
      return this._basicOptions;
    }
    /**
    * Store elements created with this instance
    *
    * @remarks
    * > What is this for?
    *
    * In bootstrap plugins, elements must be manually maintained and removed on exiting.
    *
    * This API does this for you.
    */
    elementCache;
    constructor(base) {
      super(base);
      this.elementCache = [];
      if (!this._basicOptions.ui) {
        this._basicOptions.ui = {
          enableElementRecord: true,
          enableElementJSONLog: false,
          enableElementDOMLog: true
        };
      }
    }
    /**
    * Remove all elements created by `createElement`.
    *
    * @remarks
    * > What is this for?
    *
    * In bootstrap plugins, elements must be manually maintained and removed on exiting.
    *
    * This API does this for you.
    */
    unregisterAll() {
      this.elementCache.forEach(e => {
        try {
          e?.deref()?.remove();
        } catch (e$1) {
          this.log(e$1);
        }
      });
    }
    createElement(...args) {
      const doc = args[0];
      const tagName = args[1].toLowerCase();
      let props = args[2] || {};
      if (!tagName) {
        return;
      }
      if (typeof args[2] === "string") {
        props = {
          namespace: args[2],
          enableElementRecord: args[3]
        };
      }
      if (typeof props.enableElementJSONLog !== "undefined" && props.enableElementJSONLog || this.basicOptions.ui.enableElementJSONLog) {
        this.log(props);
      }
      props.properties = props.properties || props.directAttributes;
      props.children = props.children || props.subElementOptions;
      let elem;
      if (tagName === "fragment") {
        const fragElem = doc.createDocumentFragment();
        elem = fragElem;
      } else {
        let realElem = props.id && (props.checkExistenceParent ? props.checkExistenceParent : doc).querySelector(`#${props.id}`);
        if (realElem && props.ignoreIfExists) {
          return realElem;
        }
        if (realElem && props.removeIfExists) {
          realElem.remove();
          realElem = undefined;
        }
        if (props.customCheck && !props.customCheck(doc, props)) {
          return undefined;
        }
        if (!realElem || !props.skipIfExists) {
          let namespace = props.namespace;
          if (!namespace) {
            const mightHTML = HTMLElementTagNames.includes(tagName);
            const mightXUL = XULElementTagNames.includes(tagName);
            const mightSVG = SVGElementTagNames.includes(tagName);
            if (Number(mightHTML) + Number(mightXUL) + Number(mightSVG) > 1) {
              this.log(`[Warning] Creating element ${tagName} with no namespace specified. Found multiply namespace matches.`);
            }
            if (mightHTML) {
              namespace = "html";
            } else if (mightXUL) {
              namespace = "xul";
            } else if (mightSVG) {
              namespace = "svg";
            } else {
              namespace = "html";
            }
          }
          if (namespace === "xul") {
            realElem = this.createXULElement(doc, tagName);
          } else {
            realElem = doc.createElementNS({
              html: "http://www.w3.org/1999/xhtml",
              svg: "http://www.w3.org/2000/svg"
            }[namespace], tagName);
          }
          if (typeof props.enableElementRecord !== "undefined" ? props.enableElementRecord : this.basicOptions.ui.enableElementRecord) {
            this.elementCache.push(new WeakRef(realElem));
          }
        }
        if (props.id) {
          realElem.id = props.id;
        }
        if (props.styles && Object.keys(props.styles).length) {
          Object.keys(props.styles).forEach(k => {
            const v = props.styles[k];
            if (typeof v !== "undefined") {
              realElem.style[k] = v;
            }
          });
        }
        if (props.properties && Object.keys(props.properties).length) {
          Object.keys(props.properties).forEach(k => {
            const v = props.properties[k];
            if (typeof v !== "undefined") {
              realElem[k] = v;
            }
          });
        }
        if (props.attributes && Object.keys(props.attributes).length) {
          Object.keys(props.attributes).forEach(k => {
            const v = props.attributes[k];
            if (typeof v !== "undefined") {
              realElem.setAttribute(k, String(v));
            }
          });
        }
        if (props.classList?.length) {
          realElem.classList.add(...props.classList);
        }
        if (props.listeners?.length) {
          props.listeners.forEach(({
            type,
            listener,
            options
          }) => {
            if (listener) {
              realElem.addEventListener(type, listener, options);
            }
          });
        }
        elem = realElem;
      }
      if (props.children?.length) {
        const subElements = props.children.map(childProps => {
          childProps.namespace = childProps.namespace || props.namespace;
          return this.createElement(doc, childProps.tag, childProps);
        }).filter(e => e);
        elem.append(...subElements);
      }
      if (typeof props.enableElementDOMLog !== "undefined" ? props.enableElementDOMLog : this.basicOptions.ui.enableElementDOMLog) {
        this.log(elem);
      }
      return elem;
    }
    /**
    * Append element(s) to a node.
    * @param properties See {@link ElementProps}
    * @param container The parent node to append to.
    * @returns A Node that is the appended child (aChild),
    *          except when aChild is a DocumentFragment,
    *          in which case the empty DocumentFragment is returned.
    */
    appendElement(properties, container) {
      return container.appendChild(this.createElement(container.ownerDocument, properties.tag, properties));
    }
    /**
    * Inserts a node before a reference node as a child of its parent node.
    * @param properties See {@link ElementProps}
    * @param referenceNode The node before which newNode is inserted.
    * @returns Node
    */
    insertElementBefore(properties, referenceNode) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(this.createElement(referenceNode.ownerDocument, properties.tag, properties), referenceNode);
      } else {
        this.log(`${referenceNode.tagName} has no parent, cannot insert ${properties.tag}`);
      }
    }
    /**
    * Replace oldNode with a new one.
    * @param properties See {@link ElementProps}
    * @param oldNode The child to be replaced.
    * @returns The replaced Node. This is the same node as oldChild.
    */
    replaceElement(properties, oldNode) {
      if (oldNode.parentNode) {
        return oldNode.parentNode.replaceChild(this.createElement(oldNode.ownerDocument, properties.tag, properties), oldNode);
      } else {
        this.log(`${oldNode.tagName} has no parent, cannot replace it with ${properties.tag}`);
      }
    }
    /**
    * Parse XHTML to XUL fragment. For Zotero 6.
    *
    * To load preferences from a Zotero 7's `.xhtml`, use this method to parse it.
    * @param str xhtml raw text
    * @param entities dtd file list ("chrome://xxx.dtd")
    * @param defaultXUL true for default XUL namespace
    */
    parseXHTMLToFragment(str, entities = [], defaultXUL = true) {
      const parser = new DOMParser();
      const xulns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      const htmlns = "http://www.w3.org/1999/xhtml";
      const wrappedStr = `${entities.length ? `<!DOCTYPE bindings [ ${entities.reduce((preamble, url, index) => {
        return `${preamble}<!ENTITY % _dtd-${index} SYSTEM "${url}"> %_dtd-${index}; `;
      }, "")}]>` : ""}
      <html:div xmlns="${defaultXUL ? xulns : htmlns}"
          xmlns:xul="${xulns}" xmlns:html="${htmlns}">
      ${str}
      </html:div>`;
      this.log(wrappedStr, parser);
      const doc = parser.parseFromString(wrappedStr, "text/xml");
      this.log(doc);
      if (doc.documentElement.localName === "parsererror") {
        throw new Error("not well-formed XHTML");
      }
      const range = doc.createRange();
      range.selectNodeContents(doc.querySelector("div"));
      return range.extractContents();
    }
  };
  var HTMLElementTagNames = ["a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo", "blockquote", "body", "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta", "meter", "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "slot", "small", "source", "span", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u", "ul", "var", "video", "wbr"];
  var XULElementTagNames = ["action", "arrowscrollbox", "bbox", "binding", "bindings", "box", "broadcaster", "broadcasterset", "button", "browser", "checkbox", "caption", "colorpicker", "column", "columns", "commandset", "command", "conditions", "content", "deck", "description", "dialog", "dialogheader", "editor", "grid", "grippy", "groupbox", "hbox", "iframe", "image", "key", "keyset", "label", "listbox", "listcell", "listcol", "listcols", "listhead", "listheader", "listitem", "member", "menu", "menubar", "menuitem", "menulist", "menupopup", "menuseparator", "observes", "overlay", "page", "popup", "popupset", "preference", "preferences", "prefpane", "prefwindow", "progressmeter", "radio", "radiogroup", "resizer", "richlistbox", "richlistitem", "row", "rows", "rule", "script", "scrollbar", "scrollbox", "scrollcorner", "separator", "spacer", "splitter", "stack", "statusbar", "statusbarpanel", "stringbundle", "stringbundleset", "tab", "tabbrowser", "tabbox", "tabpanel", "tabpanels", "tabs", "template", "textnode", "textbox", "titlebar", "toolbar", "toolbarbutton", "toolbargrippy", "toolbaritem", "toolbarpalette", "toolbarseparator", "toolbarset", "toolbarspacer", "toolbarspring", "toolbox", "tooltip", "tree", "treecell", "treechildren", "treecol", "treecols", "treeitem", "treerow", "treeseparator", "triple", "vbox", "window", "wizard", "wizardpage"];
  var SVGElementTagNames = ["a", "animate", "animateMotion", "animateTransform", "circle", "clipPath", "defs", "desc", "ellipse", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "filter", "foreignObject", "g", "image", "line", "linearGradient", "marker", "mask", "metadata", "mpath", "path", "pattern", "polygon", "polyline", "radialGradient", "rect", "script", "set", "stop", "style", "svg", "switch", "symbol", "text", "textPath", "title", "tspan", "use", "view"];
  var DialogHelper = class extends UITool {
    /**
    * Passed to dialog window for data-binding and lifecycle controls. See {@link DialogHelper.setDialogData}
    */
    dialogData;
    /**
    * Dialog window instance
    */
    window;
    elementProps;
    /**
    * Create a dialog helper with row \* column grids.
    * @param row
    * @param column
    */
    constructor(row, column) {
      super();
      if (row <= 0 || column <= 0) {
        throw new Error(`row and column must be positive integers.`);
      }
      this.elementProps = {
        tag: "vbox",
        attributes: {
          flex: 1
        },
        styles: {
          width: "100%",
          height: "100%"
        },
        children: []
      };
      for (let i = 0; i < Math.max(row, 1); i++) {
        this.elementProps.children.push({
          tag: "hbox",
          attributes: {
            flex: 1
          },
          children: []
        });
        for (let j = 0; j < Math.max(column, 1); j++) {
          this.elementProps.children[i].children.push({
            tag: "vbox",
            attributes: {
              flex: 1
            },
            children: []
          });
        }
      }
      this.elementProps.children.push({
        tag: "hbox",
        attributes: {
          flex: 0,
          pack: "end"
        },
        children: []
      });
      this.dialogData = {};
    }
    /**
    * Add a cell at (row, column). Index starts from 0.
    * @param row
    * @param column
    * @param elementProps Cell element props. See {@link ElementProps}
    * @param cellFlex If the cell is flex. Default true.
    */
    addCell(row, column, elementProps, cellFlex = true) {
      if (row >= this.elementProps.children.length || column >= this.elementProps.children[row].children.length) {
        throw new Error(`Cell index (${row}, ${column}) is invalid, maximum (${this.elementProps.children.length}, ${this.elementProps.children[0].children.length})`);
      }
      this.elementProps.children[row].children[column].children = [elementProps];
      this.elementProps.children[row].children[column].attributes.flex = cellFlex ? 1 : 0;
      return this;
    }
    /**
    * Add a control button to the bottom of the dialog.
    * @param label Button label
    * @param id Button id.
    * The corresponding id of the last button user clicks before window exit will be set to `dialogData._lastButtonId`.
    * @param options Options
    * @param [options.noClose] Don't close window when clicking this button.
    * @param [options.callback] Callback of button click event.
    */
    addButton(label, id, options = {}) {
      id = id || `btn-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */new Date()).getTime()}`;
      this.elementProps.children[this.elementProps.children.length - 1].children.push({
        tag: "vbox",
        styles: {
          margin: "10px"
        },
        children: [{
          tag: "button",
          namespace: "html",
          id,
          attributes: {
            type: "button",
            "data-l10n-id": label
          },
          properties: {
            innerHTML: label
          },
          listeners: [{
            type: "click",
            listener: e => {
              this.dialogData._lastButtonId = id;
              if (options.callback) {
                options.callback(e);
              }
              if (!options.noClose) {
                this.window.close();
              }
            }
          }]
        }]
      });
      return this;
    }
    /**
    * Dialog data.
    * @remarks
    * This object is passed to the dialog window.
    *
    * The control button id is in `dialogData._lastButtonId`;
    *
    * The data-binding values are in `dialogData`.
    * ```ts
    * interface DialogData {
    *   [key: string | number | symbol]: any;
    *   loadLock?: { promise: Promise<void>; resolve: () => void; isResolved: () => boolean }; // resolve after window load (auto-generated)
    *   loadCallback?: Function; // called after window load
    *   unloadLock?: { promise: Promise<void>; resolve: () => void }; // resolve after window unload (auto-generated)
    *   unloadCallback?: Function; // called after window unload
    *   beforeUnloadCallback?: Function; // called before window unload when elements are accessable.
    * }
    * ```
    * @param dialogData
    */
    setDialogData(dialogData) {
      this.dialogData = dialogData;
      return this;
    }
    /**
    * Open the dialog
    * @param title Window title
    * @param windowFeatures
    * @param windowFeatures.width Ignored if fitContent is `true`.
    * @param windowFeatures.height Ignored if fitContent is `true`.
    * @param windowFeatures.left
    * @param windowFeatures.top
    * @param windowFeatures.centerscreen Open window at the center of screen.
    * @param windowFeatures.resizable If window is resizable.
    * @param windowFeatures.fitContent Resize the window to content size after elements are loaded.
    * @param windowFeatures.noDialogMode Dialog mode window only has a close button. Set `true` to make maximize and minimize button visible.
    * @param windowFeatures.alwaysRaised Is the window always at the top.
    */
    open(title, windowFeatures = {
      centerscreen: true,
      resizable: true,
      fitContent: true
    }) {
      this.window = openDialog(this, `dialog-${Zotero.Utilities.randomString()}-${(/* @__PURE__ */new Date()).getTime()}`, title, this.elementProps, this.dialogData, windowFeatures);
      return this;
    }
  };
  function openDialog(dialogHelper, targetId, title, elementProps, dialogData, windowFeatures = {
    centerscreen: true,
    resizable: true,
    fitContent: true
  }) {
    dialogData = dialogData || {};
    if (!dialogData.loadLock) {
      let loadResolve;
      let isLoadResolved = false;
      const loadPromise = new Promise(resolve => {
        loadResolve = resolve;
      });
      loadPromise.then(() => {
        isLoadResolved = true;
      });
      dialogData.loadLock = {
        promise: loadPromise,
        resolve: loadResolve,
        isResolved: () => isLoadResolved
      };
    }
    if (!dialogData.unloadLock) {
      let unloadResolve;
      const unloadPromise = new Promise(resolve => {
        unloadResolve = resolve;
      });
      dialogData.unloadLock = {
        promise: unloadPromise,
        resolve: unloadResolve
      };
    }
    let featureString = `resizable=${windowFeatures.resizable ? "yes" : "no"},`;
    if (windowFeatures.width || windowFeatures.height) {
      featureString += `width=${windowFeatures.width || 100},height=${windowFeatures.height || 100},`;
    }
    if (windowFeatures.left) {
      featureString += `left=${windowFeatures.left},`;
    }
    if (windowFeatures.top) {
      featureString += `top=${windowFeatures.top},`;
    }
    if (windowFeatures.centerscreen) {
      featureString += "centerscreen,";
    }
    if (windowFeatures.noDialogMode) {
      featureString += "dialog=no,";
    }
    if (windowFeatures.alwaysRaised) {
      featureString += "alwaysRaised=yes,";
    }
    const win = dialogHelper.getGlobal("openDialog")("about:blank", targetId || "_blank", featureString, dialogData);
    dialogData.loadLock?.promise.then(() => {
      win.document.head.appendChild(dialogHelper.createElement(win.document, "title", {
        properties: {
          innerText: title
        },
        attributes: {
          "data-l10n-id": title
        }
      }));
      let l10nFiles = dialogData.l10nFiles || [];
      if (typeof l10nFiles === "string") {
        l10nFiles = [l10nFiles];
      }
      l10nFiles.forEach(file => {
        win.document.head.appendChild(dialogHelper.createElement(win.document, "link", {
          properties: {
            rel: "localization",
            href: file
          }
        }));
      });
      dialogHelper.appendElement({
        tag: "fragment",
        children: [{
          tag: "style",
          properties: {
            innerHTML: style
          }
        }, {
          tag: "link",
          properties: {
            rel: "stylesheet",
            href: "chrome://global/skin/global.css"
          }
        }, {
          tag: "link",
          properties: {
            rel: "stylesheet",
            href: "chrome://zotero-platform/content/zotero.css"
          }
        }]
      }, win.document.head);
      replaceElement(elementProps, dialogHelper);
      win.document.body.appendChild(dialogHelper.createElement(win.document, "fragment", {
        children: [elementProps]
      }));
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach(elem => {
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData && dialogData[bindKey]) {
          if (bindProp) {
            elem[bindProp] = dialogData[bindKey];
          } else {
            elem.setAttribute(bindAttr || "value", dialogData[bindKey]);
          }
        }
      });
      if (windowFeatures.fitContent) {
        setTimeout(() => {
          win.sizeToContent();
        }, 300);
      }
      win.focus();
    }).then(() => {
      if (dialogData?.loadCallback) {
        dialogData.loadCallback();
      }
    });
    dialogData.unloadLock?.promise.then(() => {
      if (dialogData?.unloadCallback) {
        dialogData.unloadCallback();
      }
    });
    win.addEventListener("DOMContentLoaded", function onWindowLoad(_ev) {
      win.arguments[0]?.loadLock?.resolve();
      win.removeEventListener("DOMContentLoaded", onWindowLoad, false);
    }, false);
    win.addEventListener("beforeunload", function onWindowBeforeUnload(_ev) {
      Array.from(win.document.querySelectorAll("*[data-bind]")).forEach(elem => {
        const dialogData$1 = this.window.arguments[0];
        const bindKey = elem.getAttribute("data-bind");
        const bindAttr = elem.getAttribute("data-attr");
        const bindProp = elem.getAttribute("data-prop");
        if (bindKey && dialogData$1) {
          if (bindProp) {
            dialogData$1[bindKey] = elem[bindProp];
          } else {
            dialogData$1[bindKey] = elem.getAttribute(bindAttr || "value");
          }
        }
      });
      this.window.removeEventListener("beforeunload", onWindowBeforeUnload, false);
      if (dialogData?.beforeUnloadCallback) {
        dialogData.beforeUnloadCallback();
      }
    });
    win.addEventListener("unload", function onWindowUnload(_ev) {
      if (!this.window.arguments[0]?.loadLock?.isResolved()) {
        return;
      }
      this.window.arguments[0]?.unloadLock?.resolve();
      this.window.removeEventListener("unload", onWindowUnload, false);
    });
    if (win.document.readyState === "complete") {
      win.arguments[0]?.loadLock?.resolve();
    }
    return win;
  }
  function replaceElement(elementProps, uiTool) {
    let checkChildren = true;
    if (elementProps.tag === "select") {
      let is140 = false;
      try {
        is140 = Number.parseInt(Services.appinfo.platformVersion.match(/^\d+/)[0]) >= 140;
      } catch {
        is140 = false;
      }
      if (!is140) {
        checkChildren = false;
        const customSelectProps = {
          tag: "div",
          classList: ["dropdown"],
          listeners: [{
            type: "mouseleave",
            listener: ev => {
              const select = ev.target.querySelector("select");
              select?.blur();
            }
          }],
          children: [Object.assign({}, elementProps, {
            tag: "select",
            listeners: [{
              type: "focus",
              listener: ev => {
                const select = ev.target;
                const dropdown = select.parentElement?.querySelector(".dropdown-content");
                if (dropdown) {
                  dropdown.style.display = "block";
                }
                select.setAttribute("focus", "true");
              }
            }, {
              type: "blur",
              listener: ev => {
                const select = ev.target;
                const dropdown = select.parentElement?.querySelector(".dropdown-content");
                if (dropdown) {
                  dropdown.style.display = "none";
                }
                select.removeAttribute("focus");
              }
            }]
          }), {
            tag: "div",
            classList: ["dropdown-content"],
            children: elementProps.children?.map(option => ({
              tag: "p",
              attributes: {
                value: option.properties?.value
              },
              properties: {
                innerHTML: option.properties?.innerHTML || option.properties?.textContent
              },
              classList: ["dropdown-item"],
              listeners: [{
                type: "click",
                listener: ev => {
                  const select = ev.target.parentElement?.previousElementSibling;
                  if (select) {
                    select.value = ev.target.getAttribute("value") || "";
                  }
                  select?.blur();
                }
              }]
            }))
          }]
        };
        for (const key in elementProps) {
          delete elementProps[key];
        }
        Object.assign(elementProps, customSelectProps);
      } else {
        const children = elementProps.children || [];
        const randomString = CSS.escape(`${Zotero.Utilities.randomString()}-${(/* @__PURE__ */new Date()).getTime()}`);
        if (!elementProps.id) {
          elementProps.id = `select-${randomString}`;
        }
        const selectId = elementProps.id;
        const popupId = `popup-${randomString}`;
        const popup = uiTool.appendElement({
          tag: "menupopup",
          namespace: "xul",
          id: popupId,
          children: children.map(option => ({
            tag: "menuitem",
            attributes: {
              value: option.properties?.value,
              label: option.properties?.innerHTML || option.properties?.textContent
            }
          })),
          listeners: [{
            type: "command",
            listener: ev => {
              if (ev.target?.tagName !== "menuitem") {
                return;
              }
              const select = uiTool.window.document.getElementById(selectId);
              const menuitem = ev.target;
              if (select) {
                select.value = menuitem.getAttribute("value") || "";
                select.blur();
              }
              popup.hidePopup();
            }
          }]
        }, uiTool.window.document.body);
        if (!elementProps.listeners) {
          elementProps.listeners = [];
        }
        elementProps.listeners.push(...[{
          type: "click",
          listener: ev => {
            const select = ev.target;
            const rect = select.getBoundingClientRect();
            let left = rect.left + uiTool.window.scrollX;
            let top = rect.bottom + uiTool.window.scrollY;
            if (uiTool.getGlobal("Zotero").isMac) {
              left += uiTool.window.screenLeft;
              top += uiTool.window.screenTop + rect.height;
            }
            fixMenuPopup(popup, uiTool);
            popup.openPopup(null, "", left, top, false, false);
            select.setAttribute("focus", "true");
          }
        }]);
      }
    } else if (elementProps.tag === "a") {
      const href = elementProps?.properties?.href || "";
      elementProps.properties ??= {};
      elementProps.properties.href = "javascript:void(0);";
      elementProps.attributes ??= {};
      elementProps.attributes["zotero-href"] = href;
      elementProps.listeners ??= [];
      elementProps.listeners.push({
        type: "click",
        listener: ev => {
          const href$1 = ev.target?.getAttribute("zotero-href");
          if (href$1) {
            uiTool.getGlobal("Zotero").launchURL(href$1);
          }
        }
      });
      elementProps.classList ??= [];
      elementProps.classList.push("zotero-text-link");
    }
    if (checkChildren) {
      elementProps.children?.forEach(child => replaceElement(child, uiTool));
    }
  }
  var style = `
html {
  color-scheme: light dark;
}
.zotero-text-link {
  -moz-user-focus: normal;
  color: -moz-nativehyperlinktext;
  text-decoration: underline;
  border: 1px solid transparent;
  cursor: pointer;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdown-content {
  display: none;
  position: absolute;
  background-color: var(--material-toolbar);
  min-width: 160px;
  box-shadow: 0px 0px 5px 0px rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  padding: 5px 0 5px 0;
  z-index: 999;
}
.dropdown-item {
  margin: 0px;
  padding: 5px 10px 5px 10px;
}
.dropdown-item:hover {
  background-color: var(--fill-quinary);
}
`;
  function fixMenuPopup(popup, uiTool) {
    for (const item of popup.querySelectorAll("menuitem")) {
      if (!item.innerHTML) {
        uiTool.appendElement({
          tag: "fragment",
          children: [{
            tag: "image",
            namespace: "xul",
            classList: ["menu-icon"],
            attributes: {
              "aria-hidden": "true"
            }
          }, {
            tag: "label",
            namespace: "xul",
            classList: ["menu-text"],
            properties: {
              value: item.getAttribute("label") || ""
            },
            attributes: {
              crop: "end",
              "aria-hidden": "true"
            }
          }, {
            tag: "label",
            namespace: "xul",
            classList: ["menu-highlightable-text"],
            properties: {
              textContent: item.getAttribute("label") || ""
            },
            attributes: {
              crop: "end",
              "aria-hidden": "true"
            }
          }, {
            tag: "label",
            namespace: "xul",
            classList: ["menu-accel"],
            attributes: {
              "aria-hidden": "true"
            }
          }]
        }, item);
      }
    }
  }
  var FilePickerHelper = class extends BasicTool {
    title;
    mode;
    filters;
    suggestion;
    directory;
    window;
    filterMask;
    constructor(title, mode, filters, suggestion, window$1, filterMask, directory) {
      super();
      this.title = title;
      this.mode = mode;
      this.filters = filters;
      this.suggestion = suggestion;
      this.directory = directory;
      this.window = window$1;
      this.filterMask = filterMask;
    }
    async open() {
      const Backend = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs").FilePicker;
      const fp = new Backend();
      fp.init(this.window || this.getGlobal("window"), this.title, this.getMode(fp));
      for (const [label, ext] of this.filters || []) {
        fp.appendFilter(label, ext);
      }
      if (this.filterMask) {
        fp.appendFilters(this.getFilterMask(fp));
      }
      if (this.suggestion) {
        fp.defaultString = this.suggestion;
      }
      if (this.directory) {
        fp.displayDirectory = this.directory;
      }
      const userChoice = await fp.show();
      switch (userChoice) {
        case fp.returnOK:
        case fp.returnReplace:
          if (this.mode === "multiple") {
            return fp.files;
          } else {
            return fp.file;
          }
        default:
          return false;
      }
    }
    getMode(fp) {
      switch (this.mode) {
        case "open":
          return fp.modeOpen;
        case "save":
          return fp.modeSave;
        case "folder":
          return fp.modeGetFolder;
        case "multiple":
          return fp.modeOpenMultiple;
        default:
          return 0;
      }
    }
    getFilterMask(fp) {
      switch (this.filterMask) {
        case "all":
          return fp.filterAll;
        case "html":
          return fp.filterHTML;
        case "text":
          return fp.filterText;
        case "images":
          return fp.filterImages;
        case "xml":
          return fp.filterXML;
        case "apps":
          return fp.filterApps;
        case "urls":
          return fp.filterAllowURLs;
        case "audio":
          return fp.filterAudio;
        case "video":
          return fp.filterVideo;
        default:
          return 1;
      }
    }
  };
  var GuideHelper = class extends BasicTool {
    _steps = [];
    constructor() {
      super();
    }
    addStep(step) {
      this._steps.push(step);
      return this;
    }
    addSteps(steps) {
      this._steps.push(...steps);
      return this;
    }
    async show(doc) {
      if (!doc?.ownerGlobal) {
        throw new Error("Document is required.");
      }
      const guide = new Guide(doc.ownerGlobal);
      await guide.show(this._steps);
      const promise = new Promise(resolve => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
    async highlight(doc, step) {
      if (!doc?.ownerGlobal) {
        throw new Error("Document is required.");
      }
      const guide = new Guide(doc.ownerGlobal);
      await guide.show([step]);
      const promise = new Promise(resolve => {
        guide._panel.addEventListener("guide-finished", () => resolve(guide));
      });
      await promise;
      return guide;
    }
  };
  var Guide = class {
    _window;
    _id = `guide-${Zotero.Utilities.randomString()}`;
    _panel;
    _header;
    _body;
    _footer;
    _progress;
    _closeButton;
    _prevButton;
    _nextButton;
    _steps;
    _noClose;
    _closed;
    _autoNext;
    _currentIndex;
    initialized;
    _cachedMasks = [];
    get content() {
      return this._window.MozXULElement.parseXULToFragment(`
      <panel id="${this._id}" class="guide-panel" type="arrow" align="top" noautohide="true">
          <html:div class="guide-panel-content">
              <html:div class="guide-panel-header"></html:div>
              <html:div class="guide-panel-body"></html:div>
              <html:div class="guide-panel-footer">
                  <html:div class="guide-panel-progress"></html:div>
                  <html:div class="guide-panel-buttons">
                      <button id="prev-button" class="guide-panel-button" hidden="true"></button>
                      <button id="next-button" class="guide-panel-button" hidden="true"></button>
                      <button id="close-button" class="guide-panel-button" hidden="true"></button>
                  </html:div>
              </html:div>
          </html:div>
          <html:style>
              .guide-panel {
                  background-color: var(--material-menu);
                  color: var(--fill-primary);
              }
              .guide-panel-content {
                  display: flex;
                  flex-direction: column;
                  padding: 0;
              }
              .guide-panel-header {
                  font-size: 1.2em;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .guide-panel-header:empty {
                display: none;
              }
              .guide-panel-body {
                  align-items: center;
                  display: flex;
                  flex-direction: column;
                  white-space: pre-wrap;
              }
              .guide-panel-body:empty {
                display: none;
              }
              .guide-panel-footer {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: space-between;
                  margin-top: 10px;
              }
              .guide-panel-progress {
                  font-size: 0.8em;
              }
              .guide-panel-buttons {
                  display: flex;
                  flex-direction: row;
                  flex-grow: 1;
                  justify-content: flex-end;
              }
          </html:style>
      </panel>
  `);
    }
    get currentStep() {
      if (!this._steps) {
        return undefined;
      }
      return this._steps[this._currentIndex];
    }
    get currentTarget() {
      const step = this.currentStep;
      if (!step?.element) {
        return undefined;
      }
      let elem;
      if (typeof step.element === "function") {
        elem = step.element();
      } else if (typeof step.element === "string") {
        elem = this._window.document.querySelector(step.element);
      } else if (!step.element) {
        elem = this._window.document.documentElement || undefined;
      } else {
        elem = step.element;
      }
      return elem;
    }
    get hasNext() {
      return this._steps && this._currentIndex < this._steps.length - 1;
    }
    get hasPrevious() {
      return this._steps && this._currentIndex > 0;
    }
    get hookProps() {
      return {
        config: this.currentStep,
        state: {
          step: this._currentIndex,
          steps: this._steps,
          controller: this
        }
      };
    }
    get panel() {
      return this._panel;
    }
    constructor(win) {
      this._window = win;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      this._currentIndex = 0;
      const doc = win.document;
      const content = this.content;
      if (content) {
        doc.documentElement?.append(doc.importNode(content, true));
      }
      this._panel = doc.querySelector(`#${this._id}`);
      this._header = this._panel.querySelector(".guide-panel-header");
      this._body = this._panel.querySelector(".guide-panel-body");
      this._footer = this._panel.querySelector(".guide-panel-footer");
      this._progress = this._panel.querySelector(".guide-panel-progress");
      this._closeButton = this._panel.querySelector("#close-button");
      this._prevButton = this._panel.querySelector("#prev-button");
      this._nextButton = this._panel.querySelector("#next-button");
      this._closeButton.addEventListener("click", async () => {
        if (this.currentStep?.onCloseClick) {
          await this.currentStep.onCloseClick(this.hookProps);
        }
        this.abort();
      });
      this._prevButton.addEventListener("click", async () => {
        if (this.currentStep?.onPrevClick) {
          await this.currentStep.onPrevClick(this.hookProps);
        }
        this.movePrevious();
      });
      this._nextButton.addEventListener("click", async () => {
        if (this.currentStep?.onNextClick) {
          await this.currentStep.onNextClick(this.hookProps);
        }
        this.moveNext();
      });
      this._panel.addEventListener("popupshown", this._handleShown.bind(this));
      this._panel.addEventListener("popuphidden", this._handleHidden.bind(this));
      this._window.addEventListener("resize", this._centerPanel);
    }
    async show(steps) {
      if (steps) {
        this._steps = steps;
        this._currentIndex = 0;
      }
      const index = this._currentIndex;
      this._noClose = false;
      this._closed = false;
      this._autoNext = true;
      const step = this.currentStep;
      if (!step) {
        return;
      }
      const elem = this.currentTarget;
      if (step.onBeforeRender) {
        await step.onBeforeRender(this.hookProps);
        if (index !== this._currentIndex) {
          await this.show();
          return;
        }
      }
      if (step.onMask) {
        step.onMask({
          mask: _e => this._createMask(_e)
        });
      } else {
        this._createMask(elem);
      }
      let x;
      let y = 0;
      let position = step.position || "after_start";
      if (position === "center") {
        position = "overlap";
        x = this._window.innerWidth / 2;
        y = this._window.innerHeight / 2;
      }
      this._panel.openPopup(elem, step.position || "after_start", x, y, false, false);
    }
    hide() {
      this._panel.hidePopup();
    }
    abort() {
      this._closed = true;
      this.hide();
      this._steps = undefined;
    }
    moveTo(stepIndex) {
      if (!this._steps) {
        this.hide();
        return;
      }
      if (stepIndex < 0) {
        stepIndex = 0;
      }
      if (!this._steps[stepIndex]) {
        this._currentIndex = this._steps.length;
        this.hide();
        return;
      }
      this._autoNext = false;
      this._noClose = true;
      this.hide();
      this._noClose = false;
      this._autoNext = true;
      this._currentIndex = stepIndex;
      this.show();
    }
    moveNext() {
      this.moveTo(this._currentIndex + 1);
    }
    movePrevious() {
      this.moveTo(this._currentIndex - 1);
    }
    _handleShown() {
      if (!this._steps) {
        return;
      }
      const step = this.currentStep;
      if (!step) {
        return;
      }
      this._header.innerHTML = step.title || "";
      this._body.innerHTML = step.description || "";
      this._panel.querySelectorAll(".guide-panel-button").forEach(elem => {
        elem.hidden = true;
        elem.disabled = false;
      });
      let showButtons = step.showButtons;
      if (!showButtons) {
        showButtons = [];
        if (this.hasPrevious) {
          showButtons.push("prev");
        }
        if (this.hasNext) {
          showButtons.push("next");
        } else {
          showButtons.push("close");
        }
      }
      if (showButtons?.length) {
        showButtons.forEach(btn => {
          this._panel.querySelector(`#${btn}-button`).hidden = false;
        });
      }
      if (step.disableButtons) {
        step.disableButtons.forEach(btn => {
          this._panel.querySelector(`#${btn}-button`).disabled = true;
        });
      }
      if (step.showProgress) {
        this._progress.hidden = false;
        this._progress.textContent = step.progressText || `${this._currentIndex + 1}/${this._steps.length}`;
      } else {
        this._progress.hidden = true;
      }
      this._closeButton.label = step.closeBtnText || "Done";
      this._nextButton.label = step.nextBtnText || "Next";
      this._prevButton.label = step.prevBtnText || "Previous";
      if (step.onRender) {
        step.onRender(this.hookProps);
      }
      if (step.position === "center") {
        this._centerPanel();
        this._window.setTimeout(this._centerPanel, 10);
      }
    }
    async _handleHidden() {
      this._removeMask();
      this._header.innerHTML = "";
      this._body.innerHTML = "";
      this._progress.textContent = "";
      if (!this._steps) {
        return;
      }
      const step = this.currentStep;
      if (step && step.onExit) {
        await step.onExit(this.hookProps);
      }
      if (!this._noClose && (this._closed || !this.hasNext)) {
        this._panel.dispatchEvent(new this._window.CustomEvent("guide-finished"));
        this._panel.remove();
        this._window.removeEventListener("resize", this._centerPanel);
        return;
      }
      if (this._autoNext) {
        this.moveNext();
      }
    }
    _centerPanel = () => {
      const win = this._window;
      this._panel.moveTo(win.screenX + win.innerWidth / 2 - this._panel.clientWidth / 2, win.screenY + win.innerHeight / 2 - this._panel.clientHeight / 2);
    };
    _createMask(targetElement) {
      const doc = targetElement?.ownerDocument || this._window.document;
      const NS2 = "http://www.w3.org/2000/svg";
      const svg = doc.createElementNS(NS2, "svg");
      svg.id = "guide-panel-mask";
      svg.style.position = "fixed";
      svg.style.top = "0";
      svg.style.left = "0";
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.zIndex = "9999";
      const mask = doc.createElementNS(NS2, "mask");
      mask.id = "mask";
      const fullRect = doc.createElementNS(NS2, "rect");
      fullRect.setAttribute("x", "0");
      fullRect.setAttribute("y", "0");
      fullRect.setAttribute("width", "100%");
      fullRect.setAttribute("height", "100%");
      fullRect.setAttribute("fill", "white");
      mask.appendChild(fullRect);
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        const targetRect = doc.createElementNS(NS2, "rect");
        targetRect.setAttribute("x", rect.left.toString());
        targetRect.setAttribute("y", rect.top.toString());
        targetRect.setAttribute("width", rect.width.toString());
        targetRect.setAttribute("height", rect.height.toString());
        targetRect.setAttribute("fill", "black");
        mask.appendChild(targetRect);
      }
      const maskedRect = doc.createElementNS(NS2, "rect");
      maskedRect.setAttribute("x", "0");
      maskedRect.setAttribute("y", "0");
      maskedRect.setAttribute("width", "100%");
      maskedRect.setAttribute("height", "100%");
      maskedRect.setAttribute("mask", "url(#mask)");
      maskedRect.setAttribute("opacity", "0.7");
      svg.appendChild(mask);
      svg.appendChild(maskedRect);
      this._cachedMasks.push(new WeakRef(svg));
      doc.documentElement?.appendChild(svg);
    }
    _removeMask() {
      this._cachedMasks.forEach(ref => {
        const mask = ref.deref();
        if (mask) {
          mask.remove();
        }
      });
      this._cachedMasks = [];
    }
  };
  var LargePrefHelper = class extends BasicTool {
    keyPref;
    valuePrefPrefix;
    innerObj;
    hooks;
    /**
    *
    * @param keyPref The preference name for storing the keys of the data.
    * @param valuePrefPrefix The preference name prefix for storing the values of the data.
    * @param hooks Hooks for parsing the values of the data.
    * - `afterGetValue`: A function that takes the value of the data as input and returns the parsed value.
    * - `beforeSetValue`: A function that takes the key and value of the data as input and returns the parsed key and value.
    * If `hooks` is `"default"`, no parsing will be done.
    * If `hooks` is `"parser"`, the values will be parsed as JSON.
    * If `hooks` is an object, the values will be parsed by the hooks.
    */
    constructor(keyPref, valuePrefPrefix, hooks = "default") {
      super();
      this.keyPref = keyPref;
      this.valuePrefPrefix = valuePrefPrefix;
      if (hooks === "default") {
        this.hooks = defaultHooks;
      } else if (hooks === "parser") {
        this.hooks = parserHooks;
      } else {
        this.hooks = {
          ...defaultHooks,
          ...hooks
        };
      }
      this.innerObj = {};
    }
    /**
    * Get the object that stores the data.
    * @returns The object that stores the data.
    */
    asObject() {
      return this.constructTempObj();
    }
    /**
    * Get the Map that stores the data.
    * @returns The Map that stores the data.
    */
    asMapLike() {
      const mapLike = {
        get: key => this.getValue(key),
        set: (key, value) => {
          this.setValue(key, value);
          return mapLike;
        },
        has: key => this.hasKey(key),
        delete: key => this.deleteKey(key),
        clear: () => {
          for (const key of this.getKeys()) {
            this.deleteKey(key);
          }
        },
        forEach: callback => {
          return this.constructTempMap().forEach(callback);
        },
        get size() {
          return this._this.getKeys().length;
        },
        entries: () => {
          return this.constructTempMap().values();
        },
        keys: () => {
          const keys2 = this.getKeys();
          return keys2[Symbol.iterator]();
        },
        values: () => {
          return this.constructTempMap().values();
        },
        [Symbol.iterator]: () => {
          return this.constructTempMap()[Symbol.iterator]();
        },
        [Symbol.toStringTag]: "MapLike",
        _this: this
      };
      return mapLike;
    }
    /**
    * Get the keys of the data.
    * @returns The keys of the data.
    */
    getKeys() {
      const rawKeys = Zotero.Prefs.get(this.keyPref, true);
      const keys2 = rawKeys ? JSON.parse(rawKeys) : [];
      for (const key of keys2) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
      return keys2;
    }
    /**
    * Set the keys of the data.
    * @param keys The keys of the data.
    */
    setKeys(keys2) {
      keys2 = [...new Set(keys2.filter(key => key))];
      Zotero.Prefs.set(this.keyPref, JSON.stringify(keys2), true);
      for (const key of keys2) {
        const value = "placeholder";
        this.innerObj[key] = value;
      }
    }
    /**
    * Get the value of a key.
    * @param key The key of the data.
    * @returns The value of the key.
    */
    getValue(key) {
      const value = Zotero.Prefs.get(`${this.valuePrefPrefix}${key}`, true);
      if (typeof value === "undefined") {
        return;
      }
      const {
        value: newValue
      } = this.hooks.afterGetValue({
        value
      });
      this.innerObj[key] = newValue;
      return newValue;
    }
    /**
    * Set the value of a key.
    * @param key The key of the data.
    * @param value The value of the key.
    */
    setValue(key, value) {
      const {
        key: newKey,
        value: newValue
      } = this.hooks.beforeSetValue({
        key,
        value
      });
      this.setKey(newKey);
      Zotero.Prefs.set(`${this.valuePrefPrefix}${newKey}`, newValue, true);
      this.innerObj[newKey] = newValue;
    }
    /**
    * Check if a key exists.
    * @param key The key of the data.
    * @returns Whether the key exists.
    */
    hasKey(key) {
      return this.getKeys().includes(key);
    }
    /**
    * Add a key.
    * @param key The key of the data.
    */
    setKey(key) {
      const keys2 = this.getKeys();
      if (!keys2.includes(key)) {
        keys2.push(key);
        this.setKeys(keys2);
      }
    }
    /**
    * Delete a key.
    * @param key The key of the data.
    */
    deleteKey(key) {
      const keys2 = this.getKeys();
      const index = keys2.indexOf(key);
      if (index > -1) {
        keys2.splice(index, 1);
        delete this.innerObj[key];
        this.setKeys(keys2);
      }
      Zotero.Prefs.clear(`${this.valuePrefPrefix}${key}`, true);
      return true;
    }
    constructTempObj() {
      return new Proxy(this.innerObj, {
        get: (target, prop, receiver) => {
          this.getKeys();
          if (typeof prop === "string" && prop in target) {
            this.getValue(prop);
          }
          return Reflect.get(target, prop, receiver);
        },
        set: (target, p, newValue, receiver) => {
          if (typeof p === "string") {
            if (newValue === undefined) {
              this.deleteKey(p);
              return true;
            }
            this.setValue(p, newValue);
            return true;
          }
          return Reflect.set(target, p, newValue, receiver);
        },
        has: (target, p) => {
          this.getKeys();
          return Reflect.has(target, p);
        },
        deleteProperty: (target, p) => {
          if (typeof p === "string") {
            this.deleteKey(p);
            return true;
          }
          return Reflect.deleteProperty(target, p);
        }
      });
    }
    constructTempMap() {
      const map = /* @__PURE__ */new Map();
      for (const key of this.getKeys()) {
        map.set(key, this.getValue(key));
      }
      return map;
    }
  };
  var defaultHooks = {
    afterGetValue: ({
      value
    }) => ({
      value
    }),
    beforeSetValue: ({
      key,
      value
    }) => ({
      key,
      value
    })
  };
  var parserHooks = {
    afterGetValue: ({
      value
    }) => {
      try {
        value = JSON.parse(value);
      } catch {
        return {
          value
        };
      }
      return {
        value
      };
    },
    beforeSetValue: ({
      key,
      value
    }) => {
      value = JSON.stringify(value);
      return {
        key,
        value
      };
    }
  };
  var PatchHelper = class extends BasicTool {
    options;
    constructor() {
      super();
      this.options = undefined;
    }
    setData(options) {
      this.options = options;
      const Zotero$1 = this.getGlobal("Zotero");
      const {
        target,
        funcSign,
        patcher
      } = options;
      const origin = target[funcSign];
      this.log("patching ", funcSign);
      target[funcSign] = function (...args) {
        if (options.enabled) {
          try {
            return patcher(origin).apply(this, args);
          } catch (e) {
            Zotero$1.logError(e);
          }
        }
        return origin.apply(this, args);
      };
      return this;
    }
    enable() {
      if (!this.options) {
        throw new Error("No patch data set");
      }
      this.options.enabled = true;
      return this;
    }
    disable() {
      if (!this.options) {
        throw new Error("No patch data set");
      }
      this.options.enabled = false;
      return this;
    }
  };
  var icons = {
    success: "chrome://zotero/skin/tick.png",
    fail: "chrome://zotero/skin/cross.png"
  };
  var ProgressWindowHelper = class {
    win;
    lines;
    closeTime;
    /**
    *
    * @param header window header
    * @param options
    * @param options.window
    * @param options.closeOnClick
    * @param options.closeTime
    * @param options.closeOtherProgressWindows
    */
    constructor(header, options = {
      closeOnClick: true,
      closeTime: 5000
    }) {
      this.win = new (BasicTool.getZotero().ProgressWindow)(options);
      this.lines = [];
      this.closeTime = options.closeTime || 5000;
      this.win.changeHeadline(header);
      if (options.closeOtherProgressWindows) {
        BasicTool.getZotero().ProgressWindowSet.closeAll();
      }
    }
    /**
    * Create a new line
    * @param options
    * @param options.type
    * @param options.icon
    * @param options.text
    * @param options.progress
    * @param options.idx
    */
    createLine(options) {
      const icon = this.getIcon(options.type, options.icon);
      const line = new this.win.ItemProgress(icon || "", options.text || "");
      if (typeof options.progress === "number") {
        line.setProgress(options.progress);
      }
      this.lines.push(line);
      this.updateIcons();
      return this;
    }
    /**
    * Change the line content
    * @param options
    * @param options.type
    * @param options.icon
    * @param options.text
    * @param options.progress
    * @param options.idx
    */
    changeLine(options) {
      if (this.lines?.length === 0) {
        return this;
      }
      const idx = typeof options.idx !== "undefined" && options.idx >= 0 && options.idx < this.lines.length ? options.idx : 0;
      const icon = this.getIcon(options.type, options.icon);
      if (icon) {
        this.lines[idx].setItemTypeAndIcon(icon);
      }
      if (options.text) {
        this.lines[idx].setText(options.text);
      }
      if (typeof options.progress === "number") {
        this.lines[idx].setProgress(options.progress);
      }
      this.updateIcons();
      return this;
    }
    show(closeTime = undefined) {
      this.win.show();
      if (typeof closeTime !== "undefined") {
        this.closeTime = closeTime;
      }
      if (this.closeTime && this.closeTime > 0) {
        this.win.startCloseTimer(this.closeTime);
      }
      setTimeout(this.updateIcons.bind(this), 50);
      return this;
    }
    /**
    * Set custom icon uri for progress window
    * @param key
    * @param uri
    */
    static setIconURI(key, uri) {
      icons[key] = uri;
    }
    getIcon(type, defaultIcon) {
      if (type && type in icons) {
        return icons[type];
      } else {
        return defaultIcon;
      }
    }
    updateIcons() {
      try {
        this.lines.forEach(line => {
          const box = line._image;
          const icon = box.dataset.itemType;
          if (icon && !box.style.backgroundImage.includes("progress_arcs")) {
            box.style.backgroundImage = `url(${box.dataset.itemType})`;
          }
        });
      } catch {}
    }
    changeHeadline(text, icon, postText) {
      this.win.changeHeadline(text, icon, postText);
      return this;
    }
    addLines(labels, icons$1) {
      this.win.addLines(labels, icons$1);
      return this;
    }
    addDescription(text) {
      this.win.addDescription(text);
      return this;
    }
    startCloseTimer(ms, requireMouseOver) {
      this.win.startCloseTimer(ms, requireMouseOver);
      return this;
    }
    close() {
      this.win.close();
      return this;
    }
  };
  var VirtualizedTableHelper = class extends BasicTool {
    props;
    localeStrings;
    containerId;
    treeInstance;
    window;
    React;
    ReactDOM;
    VirtualizedTable;
    IntlProvider;
    constructor(win) {
      super();
      this.window = win;
      const Zotero$1 = this.getGlobal("Zotero");
      const _require = win.require;
      this.React = _require("react");
      this.ReactDOM = _require("react-dom");
      this.VirtualizedTable = _require("components/virtualized-table");
      this.IntlProvider = _require("react-intl").IntlProvider;
      this.props = {
        id: `vtable-${Zotero$1.Utilities.randomString()}-${(/* @__PURE__ */new Date()).getTime()}`,
        getRowCount: () => 0
      };
      this.localeStrings = Zotero$1.Intl.strings;
    }
    setProp(...args) {
      if (args.length === 1) {
        Object.assign(this.props, args[0]);
      } else if (args.length === 2) {
        this.props[args[0]] = args[1];
      }
      return this;
    }
    /**
    * Set locale strings, which replaces the table header's label if matches. Default it's `Zotero.Intl.strings`
    * @param localeStrings
    */
    setLocale(localeStrings) {
      Object.assign(this.localeStrings, localeStrings);
      return this;
    }
    /**
    * Set container element id that the table will be rendered on.
    * @param id element id
    */
    setContainerId(id) {
      this.containerId = id;
      return this;
    }
    /**
    * Render the table.
    * @param selectId Which row to select after rendering
    * @param onfulfilled callback after successfully rendered
    * @param onrejected callback after rendering with error
    */
    render(selectId, onfulfilled, onrejected) {
      const refreshSelection = () => {
        this.treeInstance.invalidate();
        if (typeof selectId !== "undefined" && selectId >= 0) {
          this.treeInstance.selection.select(selectId);
        } else {
          this.treeInstance.selection.clearSelection();
        }
      };
      if (!this.treeInstance) {
        new Promise(resolve => {
          const vtableProps = Object.assign({}, this.props, {
            ref: ref => {
              this.treeInstance = ref;
              resolve(undefined);
            }
          });
          if (vtableProps.getRowData && !vtableProps.renderItem) {
            Object.assign(vtableProps, {
              renderItem: this.VirtualizedTable.makeRowRenderer(vtableProps.getRowData)
            });
          }
          const elem = this.React.createElement(this.IntlProvider, {
            locale: Zotero.locale,
            messages: Zotero.Intl.strings
          }, this.React.createElement(this.VirtualizedTable, vtableProps));
          const container = this.window.document.getElementById(this.containerId);
          this.ReactDOM.createRoot(container).render(elem);
        }).then(() => {
          this.getGlobal("setTimeout")(() => {
            refreshSelection();
          });
        }).then(onfulfilled, onrejected);
      } else {
        refreshSelection();
      }
      return this;
    }
  };
  var FieldHookManager = class extends ManagerTool {
    data = {
      getField: {},
      setField: {},
      isFieldOfBase: {}
    };
    patchHelpers = {
      getField: new PatchHelper(),
      setField: new PatchHelper(),
      isFieldOfBase: new PatchHelper()
    };
    constructor(base) {
      super(base);
      const _thisHelper = this;
      for (const type of Object.keys(this.patchHelpers)) {
        const helper = this.patchHelpers[type];
        helper.setData({
          target: this.getGlobal("Zotero").Item.prototype,
          funcSign: type,
          patcher: original => function (field, ...args) {
            const originalThis = this;
            const handler = _thisHelper.data[type][field];
            if (typeof handler === "function") {
              try {
                return handler(field, args[0], args[1], originalThis, original);
              } catch (e) {
                return field + String(e);
              }
            }
            return original.apply(originalThis, [field, ...args]);
          },
          enabled: true
        });
      }
    }
    register(type, field, hook) {
      this.data[type][field] = hook;
    }
    unregister(type, field) {
      delete this.data[type][field];
    }
    unregisterAll() {
      this.data.getField = {};
      this.data.setField = {};
      this.data.isFieldOfBase = {};
      this.patchHelpers.getField.disable();
      this.patchHelpers.setField.disable();
      this.patchHelpers.isFieldOfBase.disable();
    }
  };
  var wait_exports = {};
  __export(wait_exports, {
    waitForReader: () => waitForReader,
    waitUntil: () => waitUntil,
    waitUntilAsync: () => waitUntilAsync,
    waitUtilAsync: () => waitUtilAsync
  });
  var basicTool = new BasicTool();
  function waitUntil(condition, callback, interval = 100, timeout = 10000) {
    const start = Date.now();
    const intervalId = basicTool.getGlobal("setInterval")(() => {
      if (condition()) {
        basicTool.getGlobal("clearInterval")(intervalId);
        callback();
      } else if (Date.now() - start > timeout) {
        basicTool.getGlobal("clearInterval")(intervalId);
      }
    }, interval);
  }
  var waitUtilAsync = waitUntilAsync;
  function waitUntilAsync(condition, interval = 100, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const intervalId = basicTool.getGlobal("setInterval")(() => {
        if (condition()) {
          basicTool.getGlobal("clearInterval")(intervalId);
          resolve();
        } else if (Date.now() - start > timeout) {
          basicTool.getGlobal("clearInterval")(intervalId);
          reject(/* @__PURE__ */new Error("timeout"));
        }
      }, interval);
    });
  }
  async function waitForReader(reader) {
    await reader._initPromise;
    await reader._lastView.initializedPromise;
    if (reader.type === "pdf") {
      await reader._lastView._iframeWindow.PDFViewerApplication.initializedPromise;
    }
  }
  var KeyboardManager = class extends ManagerTool {
    _keyboardCallbacks = /* @__PURE__ */new Set();
    _cachedKey;
    id;
    constructor(base) {
      super(base);
      this.id = `kbd-${Zotero.Utilities.randomString()}`;
      this._ensureAutoUnregisterAll();
      this.addListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.addListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      this.initReaderKeyboardListener();
      for (const win of Zotero.getMainWindows()) {
        this.initKeyboardListener(win);
      }
    }
    /**
    * Register a keyboard event listener.
    * @param callback The callback function.
    */
    register(callback) {
      this._keyboardCallbacks.add(callback);
    }
    /**
    * Unregister a keyboard event listener.
    * @param callback The callback function.
    */
    unregister(callback) {
      this._keyboardCallbacks.delete(callback);
    }
    /**
    * Unregister all keyboard event listeners.
    */
    unregisterAll() {
      this._keyboardCallbacks.clear();
      this.removeListenerCallback("onMainWindowLoad", this.initKeyboardListener);
      this.removeListenerCallback("onMainWindowUnload", this.unInitKeyboardListener);
      for (const win of Zotero.getMainWindows()) {
        this.unInitKeyboardListener(win);
      }
    }
    initKeyboardListener = this._initKeyboardListener.bind(this);
    unInitKeyboardListener = this._unInitKeyboardListener.bind(this);
    initReaderKeyboardListener() {
      Zotero.Reader.registerEventListener("renderToolbar", event => this.addReaderKeyboardCallback(event), this._basicOptions.api.pluginID);
      Zotero.Reader._readers.forEach(reader => this.addReaderKeyboardCallback({
        reader
      }));
    }
    async addReaderKeyboardCallback(event) {
      const reader = event.reader;
      const initializedKey = `_ztoolkitKeyboard${this.id}Initialized`;
      await waitForReader(reader);
      if (!reader._iframeWindow) {
        return;
      }
      if (reader._iframeWindow[initializedKey]) {
        return;
      }
      this._initKeyboardListener(reader._iframeWindow);
      waitUntil(() => !Components.utils.isDeadWrapper(reader._internalReader) && reader._internalReader?._primaryView?._iframeWindow, () => this._initKeyboardListener(reader._internalReader._primaryView?._iframeWindow));
      reader._iframeWindow[initializedKey] = true;
    }
    _initKeyboardListener(win) {
      if (!win) {
        return;
      }
      win.addEventListener("keydown", this.triggerKeydown);
      win.addEventListener("keyup", this.triggerKeyup);
    }
    _unInitKeyboardListener(win) {
      if (!win) {
        return;
      }
      win.removeEventListener("keydown", this.triggerKeydown);
      win.removeEventListener("keyup", this.triggerKeyup);
    }
    triggerKeydown = e => {
      if (!this._cachedKey) {
        this._cachedKey = new KeyModifier(e);
      } else {
        this._cachedKey.merge(new KeyModifier(e), {
          allowOverwrite: false
        });
      }
      this.dispatchCallback(e, {
        type: "keydown"
      });
    };
    triggerKeyup = async e => {
      if (!this._cachedKey) {
        return;
      }
      const currentShortcut = new KeyModifier(this._cachedKey);
      this._cachedKey = undefined;
      this.dispatchCallback(e, {
        keyboard: currentShortcut,
        type: "keyup"
      });
    };
    dispatchCallback(...args) {
      this._keyboardCallbacks.forEach(cbk => cbk(...args));
    }
  };
  var KeyModifier = class KeyModifier2 {
    accel = false;
    shift = false;
    control = false;
    meta = false;
    alt = false;
    key = "";
    useAccel = false;
    constructor(raw, options) {
      this.useAccel = options?.useAccel || false;
      if (typeof raw === "undefined") {} else if (typeof raw === "string") {
        raw = raw || "";
        raw = this.unLocalized(raw);
        this.accel = raw.includes("accel");
        this.shift = raw.includes("shift");
        this.control = raw.includes("control");
        this.meta = raw.includes("meta");
        this.alt = raw.includes("alt");
        this.key = raw.replace(/(accel|shift|control|meta|alt|[ ,\-])/g, "").toLocaleLowerCase();
        if (!this.key && (raw.includes(",,") || raw === ",")) {
          this.key = ",";
        }
      } else if (raw instanceof KeyModifier2) {
        this.merge(raw, {
          allowOverwrite: true
        });
      } else {
        if (options?.useAccel) {
          if (Zotero.isMac) {
            this.accel = raw.metaKey;
          } else {
            this.accel = raw.ctrlKey;
          }
        }
        this.shift = raw.shiftKey;
        this.control = raw.ctrlKey;
        this.meta = raw.metaKey;
        this.alt = raw.altKey;
        if (!["Shift", "Meta", "Ctrl", "Alt", "Control"].includes(raw.key)) {
          this.key = raw.key;
        }
      }
    }
    /**
    * Merge another KeyModifier into this one.
    * @param newMod the new KeyModifier
    * @param options
    * @param options.allowOverwrite
    * @returns KeyModifier
    */
    merge(newMod, options) {
      const allowOverwrite = options?.allowOverwrite || false;
      this.mergeAttribute("accel", newMod.accel, allowOverwrite);
      this.mergeAttribute("shift", newMod.shift, allowOverwrite);
      this.mergeAttribute("control", newMod.control, allowOverwrite);
      this.mergeAttribute("meta", newMod.meta, allowOverwrite);
      this.mergeAttribute("alt", newMod.alt, allowOverwrite);
      this.mergeAttribute("key", newMod.key, allowOverwrite);
      return this;
    }
    /**
    * Check if the current KeyModifier equals to another KeyModifier.
    * @param newMod the new KeyModifier
    * @returns true if equals
    */
    equals(newMod) {
      if (typeof newMod === "string") {
        newMod = new KeyModifier2(newMod);
      }
      if (this.shift !== newMod.shift || this.alt !== newMod.alt || this.key.toLowerCase() !== newMod.key.toLowerCase()) {
        return false;
      }
      if (this.accel || newMod.accel) {
        if (Zotero.isMac) {
          if ((this.accel || this.meta) !== (newMod.accel || newMod.meta) || this.control !== newMod.control) {
            return false;
          }
        } else if ((this.accel || this.control) !== (newMod.accel || newMod.control) || this.meta !== newMod.meta) {
          return false;
        }
      } else if (this.control !== newMod.control || this.meta !== newMod.meta) {
        return false;
      }
      return true;
    }
    /**
    * Get the raw string representation of the KeyModifier.
    */
    getRaw() {
      const enabled2 = [];
      if (this.accel) {
        enabled2.push("accel");
      }
      if (this.shift) {
        enabled2.push("shift");
      }
      if (this.control) {
        enabled2.push("control");
      }
      if (this.meta) {
        enabled2.push("meta");
      }
      if (this.alt) {
        enabled2.push("alt");
      }
      if (this.key) {
        enabled2.push(this.key);
      }
      return enabled2.join(",");
    }
    /**
    * Get the localized string representation of the KeyModifier.
    */
    getLocalized() {
      const raw = this.getRaw();
      if (Zotero.isMac) {
        return raw.replaceAll("control", "⌃").replaceAll("alt", "⌥").replaceAll("shift", "⇧").replaceAll("meta", "⌘");
      } else {
        return raw.replaceAll("control", "Ctrl").replaceAll("alt", "Alt").replaceAll("shift", "Shift").replaceAll("meta", "Win");
      }
    }
    /**
    * Get the un-localized string representation of the KeyModifier.
    */
    unLocalized(raw) {
      if (Zotero.isMac) {
        return raw.replaceAll("⌃", "control").replaceAll("⌥", "alt").replaceAll("⇧", "shift").replaceAll("⌘", "meta");
      } else {
        return raw.replaceAll("Ctrl", "control").replaceAll("Alt", "alt").replaceAll("Shift", "shift").replaceAll("Win", "meta");
      }
    }
    mergeAttribute(attribute, value, allowOverwrite) {
      if (allowOverwrite || !this[attribute]) {
        this[attribute] = value;
      }
    }
  };
  var MenuManager = class extends ManagerTool {
    ui;
    constructor(base) {
      super(base);
      this.ui = new UITool(this);
    }
    /**
    * Insert an menu item/menu(with popup)/menuseprator into a menupopup
    * @remarks
    * options:
    * ```ts
    * export interface MenuitemOptions {
    *   tag: "menuitem" | "menu" | "menuseparator";
    *   id?: string;
    *   label?: string;
    *   // data url (chrome://xxx.png) or base64 url (data:image/png;base64,xxx)
    *   icon?: string;
    *   class?: string;
    *   styles?: { [key: string]: string };
    *   hidden?: boolean;
    *   disabled?: boolean;
    *   oncommand?: string;
    *   commandListener?: EventListenerOrEventListenerObject;
    *   // Attributes below are used when type === "menu"
    *   popupId?: string;
    *   onpopupshowing?: string;
    *   subElementOptions?: Array<MenuitemOptions>;
    * }
    * ```
    * @param menuPopup
    * @param options
    * @param insertPosition
    * @param anchorElement The menuitem will be put before/after `anchorElement`. If not set, put at start/end of the menupopup.
    * @example
    * Insert menuitem with icon into item menupopup
    * ```ts
    * // base64 or chrome:// url
    * const menuIcon = "chrome://addontemplate/content/icons/favicon@0.5x.png";
    * ztoolkit.Menu.register("item", {
    *   tag: "menuitem",
    *   id: "zotero-itemmenu-addontemplate-test",
    *   label: "Addon Template: Menuitem",
    *   oncommand: "alert('Hello World! Default Menuitem.')",
    *   icon: menuIcon,
    * });
    * ```
    * @example
    * Insert menu into file menupopup
    * ```ts
    * ztoolkit.Menu.register(
    *   "menuFile",
    *   {
    *     tag: "menu",
    *     label: "Addon Template: Menupopup",
    *     subElementOptions: [
    *       {
    *         tag: "menuitem",
    *         label: "Addon Template",
    *         oncommand: "alert('Hello World! Sub Menuitem.')",
    *       },
    *     ],
    *   },
    *   "before",
    *   Zotero.getMainWindow().document.querySelector(
    *     "#zotero-itemmenu-addontemplate-test"
    *   )
    * );
    * ```
    */
    register(menuPopup, options, insertPosition = "after", anchorElement) {
      let popup;
      if (typeof menuPopup === "string") {
        popup = this.getGlobal("document").querySelector(MenuSelector[menuPopup]);
      } else {
        popup = menuPopup;
      }
      if (!popup) {
        return false;
      }
      const doc = popup.ownerDocument;
      const genMenuElement = menuitemOption => {
        const elementOption = {
          tag: menuitemOption.tag,
          id: menuitemOption.id,
          namespace: "xul",
          attributes: {
            label: menuitemOption.label || "",
            hidden: Boolean(menuitemOption.hidden),
            disabled: Boolean(menuitemOption.disabled),
            class: menuitemOption.class || "",
            oncommand: menuitemOption.oncommand || ""
          },
          classList: menuitemOption.classList,
          styles: menuitemOption.styles || {},
          listeners: [],
          children: []
        };
        if (menuitemOption.icon) {
          if (!this.getGlobal("Zotero").isMac) {
            if (menuitemOption.tag === "menu") {
              elementOption.attributes.class += " menu-iconic";
            } else {
              elementOption.attributes.class += " menuitem-iconic";
            }
          }
          elementOption.styles["list-style-image"] = `url(${menuitemOption.icon})`;
        }
        if (menuitemOption.commandListener) {
          elementOption.listeners?.push({
            type: "command",
            listener: menuitemOption.commandListener
          });
        }
        if (menuitemOption.tag === "menuitem") {
          elementOption.attributes.type = menuitemOption.type || "";
          elementOption.attributes.checked = menuitemOption.checked || false;
        }
        const menuItem = this.ui.createElement(doc, menuitemOption.tag, elementOption);
        if (menuitemOption.isHidden || menuitemOption.getVisibility) {
          popup?.addEventListener("popupshowing", async ev => {
            let hidden;
            if (menuitemOption.isHidden) {
              hidden = await menuitemOption.isHidden(menuItem, ev);
            } else if (menuitemOption.getVisibility) {
              const visible = await menuitemOption.getVisibility(menuItem, ev);
              hidden = typeof visible === "undefined" ? undefined : !visible;
            }
            if (typeof hidden === "undefined") {
              return;
            }
            if (hidden) {
              menuItem.setAttribute("hidden", "true");
            } else {
              menuItem.removeAttribute("hidden");
            }
          });
        }
        if (menuitemOption.isDisabled) {
          popup?.addEventListener("popupshowing", async ev => {
            const disabled = await menuitemOption.isDisabled(menuItem, ev);
            if (typeof disabled === "undefined") {
              return;
            }
            if (disabled) {
              menuItem.setAttribute("disabled", "true");
            } else {
              menuItem.removeAttribute("disabled");
            }
          });
        }
        if ((menuitemOption.tag === "menuitem" || menuitemOption.tag === "menuseparator") && menuitemOption.onShowing) {
          popup?.addEventListener("popupshowing", async ev => {
            await menuitemOption.onShowing(menuItem, ev);
          });
        }
        if (menuitemOption.tag === "menu") {
          const subPopup = this.ui.createElement(doc, "menupopup", {
            id: menuitemOption.popupId,
            attributes: {
              onpopupshowing: menuitemOption.onpopupshowing || ""
            }
          });
          menuitemOption.children?.forEach(childOption => {
            subPopup.append(genMenuElement(childOption));
          });
          menuItem.append(subPopup);
        }
        return menuItem;
      };
      const topMenuItem = genMenuElement(options);
      if (popup.childElementCount) {
        if (!anchorElement) {
          anchorElement = insertPosition === "after" ? popup.lastElementChild : popup.firstElementChild;
        }
        anchorElement[insertPosition](topMenuItem);
      } else {
        popup.appendChild(topMenuItem);
      }
    }
    unregister(menuId) {
      this.getGlobal("document").querySelector(`#${menuId}`)?.remove();
    }
    unregisterAll() {
      this.ui.unregisterAll();
    }
  };
  var MenuSelector = /* @__PURE__ */function (MenuSelector$1) {
    MenuSelector$1.menuFile = "#menu_FilePopup";
    MenuSelector$1.menuEdit = "#menu_EditPopup";
    MenuSelector$1.menuView = "#menu_viewPopup";
    MenuSelector$1.menuGo = "#menu_goPopup";
    MenuSelector$1.menuTools = "#menu_ToolsPopup";
    MenuSelector$1.menuHelp = "#menu_HelpPopup";
    MenuSelector$1.collection = "#zotero-collectionmenu";
    MenuSelector$1.item = "#zotero-itemmenu";
    return MenuSelector$1;
  }(MenuSelector || {});
  var Prompt = class {
    ui;
    base;
    get document() {
      return this.base.getGlobal("document");
    }
    /**
    * Record the last text entered
    */
    lastInputText = "";
    /**
    * Default text
    */
    defaultText = {
      placeholder: "Select a command...",
      empty: "No commands found."
    };
    /**
    * It controls the max line number of commands displayed in `commandsNode`.
    */
    maxLineNum = 12;
    /**
    * It controls the max number of suggestions.
    */
    maxSuggestionNum = 100;
    /**
    * The top-level HTML div node of `Prompt`
    */
    promptNode;
    /**
    * The HTML input node of `Prompt`.
    */
    inputNode;
    /**
    * Save all commands registered by all addons.
    */
    commands = [];
    /**
    * Initialize `Prompt` but do not create UI.
    */
    constructor() {
      this.base = new BasicTool();
      this.ui = new UITool();
      this.initializeUI();
    }
    /**
    * Initialize `Prompt` UI and then bind events on it.
    */
    initializeUI() {
      this.addStyle();
      this.createHTML();
      this.initInputEvents();
      this.registerShortcut();
    }
    createHTML() {
      this.promptNode = this.ui.createElement(this.document, "div", {
        styles: {
          display: "none"
        },
        children: [{
          tag: "div",
          styles: {
            position: "fixed",
            left: "0",
            top: "0",
            backgroundColor: "transparent",
            width: "100%",
            height: "100%"
          },
          listeners: [{
            type: "click",
            listener: () => {
              this.promptNode.style.display = "none";
            }
          }]
        }]
      });
      this.promptNode.appendChild(this.ui.createElement(this.document, "div", {
        id: `zotero-plugin-toolkit-prompt`,
        classList: ["prompt-container"],
        children: [{
          tag: "div",
          classList: ["input-container"],
          children: [{
            tag: "input",
            classList: ["prompt-input"],
            attributes: {
              type: "text",
              placeholder: this.defaultText.placeholder
            }
          }, {
            tag: "div",
            classList: ["cta"]
          }]
        }, {
          tag: "div",
          classList: ["commands-containers"]
        }, {
          tag: "div",
          classList: ["instructions"],
          children: [{
            tag: "div",
            classList: ["instruction"],
            children: [{
              tag: "span",
              classList: ["key"],
              properties: {
                innerText: "↑↓"
              }
            }, {
              tag: "span",
              properties: {
                innerText: "to navigate"
              }
            }]
          }, {
            tag: "div",
            classList: ["instruction"],
            children: [{
              tag: "span",
              classList: ["key"],
              properties: {
                innerText: "enter"
              }
            }, {
              tag: "span",
              properties: {
                innerText: "to trigger"
              }
            }]
          }, {
            tag: "div",
            classList: ["instruction"],
            children: [{
              tag: "span",
              classList: ["key"],
              properties: {
                innerText: "esc"
              }
            }, {
              tag: "span",
              properties: {
                innerText: "to exit"
              }
            }]
          }]
        }]
      }));
      this.inputNode = this.promptNode.querySelector("input");
      this.document.documentElement.appendChild(this.promptNode);
    }
    /**
    * Show commands in a new `commandsContainer`
    * All other `commandsContainer` is hidden
    * @param commands Command[]
    * @param clear remove all `commandsContainer` if true
    */
    showCommands(commands, clear = false) {
      if (clear) {
        this.promptNode.querySelectorAll(".commands-container").forEach(e => e.remove());
      }
      this.inputNode.placeholder = this.defaultText.placeholder;
      const commandsContainer = this.createCommandsContainer();
      for (const command of commands) {
        try {
          if (!command.name || command.when && !command.when()) {
            continue;
          }
        } catch {
          continue;
        }
        commandsContainer.appendChild(this.createCommandNode(command));
      }
    }
    /**
    * Create a `commandsContainer` div element, append to `commandsContainer` and hide others.
    * @returns commandsNode
    */
    createCommandsContainer() {
      const commandsContainer = this.ui.createElement(this.document, "div", {
        classList: ["commands-container"]
      });
      this.promptNode.querySelectorAll(".commands-container").forEach(e => {
        e.style.display = "none";
      });
      this.promptNode.querySelector(".commands-containers").appendChild(commandsContainer);
      return commandsContainer;
    }
    /**
    * Return current displayed `commandsContainer`
    * @returns
    */
    getCommandsContainer() {
      return [...Array.from(this.promptNode.querySelectorAll(".commands-container"))].find(e => {
        return e.style.display !== "none";
      });
    }
    /**
    * Create a command item for `Prompt` UI.
    * @param command
    * @returns
    */
    createCommandNode(command) {
      const commandNode = this.ui.createElement(this.document, "div", {
        classList: ["command"],
        children: [{
          tag: "div",
          classList: ["content"],
          children: [{
            tag: "div",
            classList: ["name"],
            children: [{
              tag: "span",
              properties: {
                innerText: command.name
              }
            }]
          }, {
            tag: "div",
            classList: ["aux"],
            children: command.label ? [{
              tag: "span",
              classList: ["label"],
              properties: {
                innerText: command.label
              }
            }] : []
          }]
        }],
        listeners: [{
          type: "mousemove",
          listener: () => {
            this.selectItem(commandNode);
          }
        }, {
          type: "click",
          listener: async () => {
            await this.execCallback(command.callback);
          }
        }]
      });
      commandNode.command = command;
      return commandNode;
    }
    /**
    * Called when `enter` key is pressed.
    */
    trigger() {
      [...Array.from(this.promptNode.querySelectorAll(".commands-container"))].find(e => e.style.display !== "none").querySelector(".selected").click();
    }
    /**
    * Called when `escape` key is pressed.
    */
    exit() {
      this.inputNode.placeholder = this.defaultText.placeholder;
      if (this.promptNode.querySelectorAll(".commands-containers .commands-container").length >= 2) {
        this.promptNode.querySelector(".commands-container:last-child").remove();
        const commandsContainer = this.promptNode.querySelector(".commands-container:last-child");
        commandsContainer.style.display = "";
        commandsContainer.querySelectorAll(".commands").forEach(e => e.style.display = "flex");
        this.inputNode.focus();
      } else {
        this.promptNode.style.display = "none";
      }
    }
    async execCallback(callback) {
      if (Array.isArray(callback)) {
        this.showCommands(callback);
      } else {
        await callback(this);
      }
    }
    /**
    * Match suggestions for user's entered text.
    */
    async showSuggestions(inputText) {
      const _w = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/;
      const jw = /\s/;
      const Ww = /[\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F]/;
      function Yw(e$1, t3, n, i) {
        if (e$1.length === 0) {
          return 0;
        }
        let r = 0;
        r -= Math.max(0, e$1.length - 1);
        r -= i / 10;
        const o = e$1[0][0];
        r -= (e$1[e$1.length - 1][1] - o + 1 - t3) / 100;
        r -= o / 1000;
        return r -= n / 10000;
      }
      function $w(e$1, t3, n, i) {
        if (e$1.length === 0) {
          return null;
        }
        var r = n.toLowerCase();
        var o = 0;
        var a = 0;
        var s = [];
        for (var l = 0; l < e$1.length; l++) {
          const c = e$1[l];
          const u = r.indexOf(c, a);
          if (u === -1) {
            return null;
          }
          const h = n.charAt(u);
          if (u > 0 && !_w.test(h) && !Ww.test(h)) {
            const p = n.charAt(u - 1);
            if (h.toLowerCase() !== h && p.toLowerCase() !== p || h.toUpperCase() !== h && !_w.test(p) && !jw.test(p) && !Ww.test(p)) {
              if (i) {
                if (u !== a) {
                  a += c.length;
                  l--;
                  continue;
                }
              } else {
                o += 1;
              }
            }
          }
          if (s.length === 0) {
            s.push([u, u + c.length]);
          } else {
            const d = s[s.length - 1];
            if (d[1] < u) {
              s.push([u, u + c.length]);
            } else {
              d[1] = u + c.length;
            }
          }
          a = u + c.length;
        }
        return {
          matches: s,
          score: Yw(s, t3.length, r.length, o)
        };
      }
      function Gw(e$1) {
        for (var t3 = e$1.toLowerCase(), n = [], i = 0, r = 0; r < t3.length; r++) {
          const o = t3.charAt(r);
          if (jw.test(o)) {
            if (i !== r) {
              n.push(t3.substring(i, r));
            }
            i = r + 1;
          } else if (_w.test(o) || Ww.test(o)) {
            if (i !== r) {
              n.push(t3.substring(i, r));
            }
            n.push(o);
            i = r + 1;
          }
        }
        if (i !== t3.length) {
          n.push(t3.substring(i, t3.length));
        }
        return {
          query: e$1,
          tokens: n,
          fuzzy: t3.split("")
        };
      }
      function Xw(e$1, t3) {
        if (e$1.query === "") {
          return {
            score: 0,
            matches: []
          };
        }
        const n = $w(e$1.tokens, e$1.query, t3, false);
        return n || $w(e$1.fuzzy, e$1.query, t3, true);
      }
      const e = Gw(inputText);
      let container = this.getCommandsContainer();
      if (container.classList.contains("suggestions")) {
        this.exit();
      }
      if (inputText.trim() == "") {
        return true;
      }
      const suggestions = [];
      this.getCommandsContainer().querySelectorAll(".command").forEach(commandNode => {
        const spanNode = commandNode.querySelector(".name span");
        const spanText = spanNode.innerText;
        const res = Xw(e, spanText);
        if (res) {
          commandNode = this.createCommandNode(commandNode.command);
          let spanHTML = "";
          let i = 0;
          for (let j = 0; j < res.matches.length; j++) {
            const [start, end] = res.matches[j];
            if (start > i) {
              spanHTML += spanText.slice(i, start);
            }
            spanHTML += `<span class="highlight">${spanText.slice(start, end)}</span>`;
            i = end;
          }
          if (i < spanText.length) {
            spanHTML += spanText.slice(i, spanText.length);
          }
          commandNode.querySelector(".name span").innerHTML = spanHTML;
          suggestions.push({
            score: res.score,
            commandNode
          });
        }
      });
      if (suggestions.length > 0) {
        suggestions.sort((a, b) => b.score - a.score).slice(this.maxSuggestionNum);
        container = this.createCommandsContainer();
        container.classList.add("suggestions");
        suggestions.forEach(suggestion => {
          container.appendChild(suggestion.commandNode);
        });
        return true;
      } else {
        const anonymousCommand = this.commands.find(c => !c.name && (!c.when || c.when()));
        if (anonymousCommand) {
          await this.execCallback(anonymousCommand.callback);
        } else {
          this.showTip(this.defaultText.empty);
        }
        return false;
      }
    }
    /**
    * Bind events of pressing `keydown` and `keyup` key.
    */
    initInputEvents() {
      this.promptNode.addEventListener("keydown", event => {
        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          let selectedIndex;
          const allItems = [...Array.from(this.getCommandsContainer().querySelectorAll(".command"))].filter(e => e.style.display != "none");
          selectedIndex = allItems.findIndex(e => e.classList.contains("selected"));
          if (selectedIndex != -1) {
            allItems[selectedIndex].classList.remove("selected");
            selectedIndex += event.key == "ArrowUp" ? -1 : 1;
          } else if (event.key == "ArrowUp") {
            selectedIndex = allItems.length - 1;
          } else {
            selectedIndex = 0;
          }
          if (selectedIndex == -1) {
            selectedIndex = allItems.length - 1;
          } else if (selectedIndex == allItems.length) {
            selectedIndex = 0;
          }
          allItems[selectedIndex].classList.add("selected");
          const commandsContainer = this.getCommandsContainer();
          commandsContainer.scrollTo(0, commandsContainer.querySelector(".selected").offsetTop - commandsContainer.offsetHeight + 7.5);
          allItems[selectedIndex].classList.add("selected");
        }
      });
      this.promptNode.addEventListener("keyup", async event => {
        if (event.key == "Enter") {
          this.trigger();
        } else if (event.key == "Escape") {
          if (this.inputNode.value.length > 0) {
            this.inputNode.value = "";
          } else {
            this.exit();
          }
        } else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
          return;
        }
        const currentInputText = this.inputNode.value;
        if (currentInputText == this.lastInputText) {
          return;
        }
        this.lastInputText = currentInputText;
        window.setTimeout(async () => {
          await this.showSuggestions(currentInputText);
        });
      });
    }
    /**
    * Create a commandsContainer and display a text
    */
    showTip(text) {
      const tipNode = this.ui.createElement(this.document, "div", {
        classList: ["tip"],
        properties: {
          innerText: text
        }
      });
      const container = this.createCommandsContainer();
      container.classList.add("suggestions");
      container.appendChild(tipNode);
      return tipNode;
    }
    /**
    * Mark the selected item with class `selected`.
    * @param item HTMLDivElement
    */
    selectItem(item) {
      this.getCommandsContainer().querySelectorAll(".command").forEach(e => e.classList.remove("selected"));
      item.classList.add("selected");
    }
    addStyle() {
      const style$1 = this.ui.createElement(this.document, "style", {
        namespace: "html",
        id: "prompt-style"
      });
      style$1.innerText = `
      .prompt-container * {
        box-sizing: border-box;
      }
      .prompt-container {
        ---radius---: 10px;
        position: fixed;
        left: 25%;
        top: 10%;
        width: 50%;
        border-radius: var(---radius---);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-size: 18px;
        box-shadow: 0px 1.8px 7.3px rgba(0, 0, 0, 0.071),
                    0px 6.3px 24.7px rgba(0, 0, 0, 0.112),
                    0px 30px 90px rgba(0, 0, 0, 0.2);
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Microsoft YaHei Light", sans-serif;
        background-color: var(--material-background) !important;
        border: var(--material-border-quarternary) !important;
      }
      
      /* input */
      .prompt-container .input-container  {
        width: 100%;
      }

      .input-container input {
        width: -moz-available;
        height: 40px;
        padding: 24px;
        border: none;
        outline: none;
        font-size: 18px;
        margin: 0 !important;
        border-radius: var(---radius---);
        background-color: var(--material-background);
      }
      
      .input-container .cta {
        border-bottom: var(--material-border-quarternary);
        margin: 5px auto;
      }
      
      /* results */
      .commands-containers {
        width: 100%;
        height: 100%;
      }
      .commands-container {
        max-height: calc(${this.maxLineNum} * 35.5px);
        width: calc(100% - 12px);
        margin-left: 12px;
        margin-right: 0%;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .commands-container .command {
        display: flex;
        align-content: baseline;
        justify-content: space-between;
        border-radius: 5px;
        padding: 6px 12px;
        margin-right: 12px;
        margin-top: 2px;
        margin-bottom: 2px;
      }
      .commands-container .command .content {
        display: flex;
        width: 100%;
        justify-content: space-between;
        flex-direction: row;
        overflow: hidden;
      }
      .commands-container .command .content .name {
        white-space: nowrap; 
        text-overflow: ellipsis;
        overflow: hidden;
      }
      .commands-container .command .content .aux {
        display: flex;
        align-items: center;
        align-self: center;
        flex-shrink: 0;
      }
      
      .commands-container .command .content .aux .label {
        font-size: 15px;
        color: var(--fill-primary);
        padding: 2px 6px;
        background-color: var(--color-background);
        border-radius: 5px;
      }
      
      .commands-container .selected {
          background-color: var(--material-mix-quinary);
      }

      .commands-container .highlight {
        font-weight: bold;
      }

      .tip {
        color: var(--fill-primary);
        text-align: center;
        padding: 12px 12px;
        font-size: 18px;
      }

      /* instructions */
      .instructions {
        display: flex;
        align-content: center;
        justify-content: center;
        font-size: 15px;
        height: 2.5em;
        width: 100%;
        border-top: var(--material-border-quarternary);
        color: var(--fill-secondary);
        margin-top: 5px;
      }
      
      .instructions .instruction {
        margin: auto .5em;  
      }
      
      .instructions .key {
        margin-right: .2em;
        font-weight: 600;
      }
    `;
      this.document.documentElement.appendChild(style$1);
    }
    registerShortcut() {
      this.document.addEventListener("keydown", event => {
        if (event.shiftKey && event.key.toLowerCase() == "p") {
          if (event.originalTarget.isContentEditable || "value" in event.originalTarget || this.commands.length == 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (this.promptNode.style.display == "none") {
            this.promptNode.style.display = "flex";
            if (this.promptNode.querySelectorAll(".commands-container").length == 1) {
              this.showCommands(this.commands, true);
            }
            this.promptNode.focus();
            this.inputNode.focus();
          } else {
            this.promptNode.style.display = "none";
          }
        }
      }, true);
    }
  };
  var PromptManager = class extends ManagerTool {
    prompt;
    /**
    * Save the commands registered from this manager
    */
    commands = [];
    constructor(base) {
      super(base);
      const globalCache = toolkitGlobal_default.getInstance()?.prompt;
      if (!globalCache) {
        throw new Error("Prompt is not initialized.");
      }
      if (!globalCache._ready) {
        globalCache._ready = true;
        globalCache.instance = new Prompt();
      }
      this.prompt = globalCache.instance;
    }
    /**
    * Register commands. Don't forget to call `unregister` on plugin exit.
    * @param commands Command[]
    * @example
    * ```ts
    * let getReader = () => {
    *   return BasicTool.getZotero().Reader.getByTabID(
    *     (Zotero.getMainWindow().Zotero_Tabs).selectedID
    *   )
    * }
    *
    * register([
    *   {
    *     name: "Split Horizontally",
    *     label: "Zotero",
    *     when: () => getReader() as boolean,
    *     callback: (prompt: Prompt) => getReader().menuCmd("splitHorizontally")
    *   },
    *   {
    *     name: "Split Vertically",
    *     label: "Zotero",
    *     when: () => getReader() as boolean,
    *     callback: (prompt: Prompt) => getReader().menuCmd("splitVertically")
    *   }
    * ])
    * ```
    */
    register(commands) {
      commands.forEach(c => c.id ??= c.name);
      this.prompt.commands = [...this.prompt.commands, ...commands];
      this.commands = [...this.commands, ...commands];
      this.prompt.showCommands(this.commands, true);
    }
    /**
    * You can delete a command registed before by its name.
    * @remarks
    * There is a premise here that the names of all commands registered by a single plugin are not duplicated.
    * @param id Command.name
    */
    unregister(id) {
      this.prompt.commands = this.prompt.commands.filter(c => c.id != id);
      this.commands = this.commands.filter(c => c.id != id);
    }
    /**
    * Call `unregisterAll` on plugin exit.
    */
    unregisterAll() {
      this.prompt.commands = this.prompt.commands.filter(c => {
        return this.commands.every(_c => _c.id != c.id);
      });
      this.commands = [];
    }
  };
  var ExtraFieldTool = class extends BasicTool {
    getExtraFields(item, parser = "enhanced") {
      const extraFiledRaw = item.getField("extra");
      if (parser === "classical") {
        return this.getGlobal("Zotero").Utilities.Internal.extractExtraFields(extraFiledRaw).fields;
      } else {
        const map = /* @__PURE__ */new Map();
        const nonStandardFields = [];
        extraFiledRaw.split("\n").forEach(line => {
          if (!line) {
            return;
          }
          const split = line.split(": ");
          if (split.length >= 2 && split[0]) {
            const key = split[0];
            const value = split.slice(1).join(": ");
            if (!map.has(key)) {
              map.set(key, []);
            }
            map.get(key).push(value);
          } else {
            nonStandardFields.push(line);
          }
        });
        if (nonStandardFields.length > 0) {
          map.set("__nonStandard__", [nonStandardFields.join("\n")]);
        }
        return map;
      }
    }
    getExtraField(item, key, all = false) {
      const fields = this.getExtraFields(item, "enhanced");
      const values = fields.get(key);
      if (!values) {
        return undefined;
      }
      if (all) {
        return values;
      } else {
        return values[0];
      }
    }
    /**
    * Replace extra field of an item.
    * @param item
    * @param fields
    * @param [options] Additional options.
    * @param [options.save] Whether to save the item, default to true.
    */
    async replaceExtraFields(item, fields, options = {}) {
      const {
        save = true
      } = options;
      const kvs = [];
      fields.forEach((values, key) => {
        if (key === "__nonStandard__") {
          kvs.push(...fields.get("__nonStandard__"));
        } else {
          values.forEach(v => kvs.push(`${key}: ${v}`));
        }
      });
      item.setField("extra", kvs.join("\n"));
      if (save) {
        await item.saveTx();
      }
    }
    /**
    * Set a key-value pair in the item's extra field.
    * If the key already exists, it can be overwritten or appended.
    * @param item Zotero item
    * @param key Field key
    * @param value Field value or list of values
    * @param options Additional options
    * @param [options.append] Whether to append to existing values, default to false
    * @param [options.save] Whether to save the item, default to true
    */
    async setExtraField(item, key, value, options = {}) {
      const {
        append = false,
        save = true
      } = options;
      const fields = this.getExtraFields(item, "enhanced");
      if (value === "" || typeof value === "undefined") {
        fields.delete(key);
      } else {
        const values = Array.isArray(value) ? value : [value];
        if (append && fields.has(key)) {
          fields.get(key).push(...values);
        } else {
          fields.set(key, values);
        }
      }
      await this.replaceExtraFields(item, fields, {
        save
      });
    }
  };
  var ReaderTool = class extends BasicTool {
    /**
    * Get the selected tab reader.
    * @param waitTime Wait for n MS until the reader is ready
    */
    async getReader(waitTime = 5000) {
      const Zotero_Tabs2 = this.getGlobal("Zotero_Tabs");
      if (Zotero_Tabs2.selectedType !== "reader") {
        return undefined;
      }
      let reader = Zotero.Reader.getByTabID(Zotero_Tabs2.selectedID);
      let delayCount = 0;
      const checkPeriod = 50;
      while (!reader && delayCount * checkPeriod < waitTime) {
        await new Promise(resolve => setTimeout(resolve, checkPeriod));
        reader = Zotero.Reader.getByTabID(Zotero_Tabs2.selectedID);
        delayCount++;
      }
      await reader?._initPromise;
      return reader;
    }
    /**
    * Get all window readers.
    */
    getWindowReader() {
      const Zotero_Tabs2 = this.getGlobal("Zotero_Tabs");
      const windowReaders = [];
      const tabs = Zotero_Tabs2._tabs.map(e => e.id);
      for (let i = 0; i < Zotero.Reader._readers.length; i++) {
        let flag = false;
        for (let j = 0; j < tabs.length; j++) {
          if (Zotero.Reader._readers[i].tabID === tabs[j]) {
            flag = true;
            break;
          }
        }
        if (!flag) {
          windowReaders.push(Zotero.Reader._readers[i]);
        }
      }
      return windowReaders;
    }
    /**
    * Get Reader tabpanel deck element.
    * @deprecated - use item pane api
    * @alpha
    */
    getReaderTabPanelDeck() {
      const deck = this.getGlobal("window").document.querySelector(".notes-pane-deck")?.previousElementSibling;
      return deck;
    }
    /**
    * Add a reader tabpanel deck selection change observer.
    * @deprecated - use item pane api
    * @alpha
    * @param callback
    */
    async addReaderTabPanelDeckObserver(callback) {
      await waitUtilAsync(() => !!this.getReaderTabPanelDeck());
      const deck = this.getReaderTabPanelDeck();
      const observer = new (this.getGlobal("MutationObserver"))(async mutations => {
        mutations.forEach(async mutation => {
          const target = mutation.target;
          if (target.classList.contains("zotero-view-tabbox") || target.tagName === "deck") {
            callback();
          }
        });
      });
      observer.observe(deck, {
        attributes: true,
        attributeFilter: ["selectedIndex"],
        subtree: true
      });
      return observer;
    }
    /**
    * Get the selected annotation data.
    * @param reader Target reader
    * @returns The selected annotation data.
    */
    getSelectedAnnotationData(reader) {
      const annotation = reader?._internalReader._lastView._selectionPopup?.annotation;
      return annotation;
    }
    /**
    * Get the text selection of reader.
    * @param reader Target reader
    * @returns The text selection of reader.
    */
    getSelectedText(reader) {
      return this.getSelectedAnnotationData(reader)?.text ?? "";
    }
  };
  var ZoteroToolkit = class extends BasicTool {
    static _version = BasicTool._version;
    UI = new UITool(this);
    Reader = new ReaderTool(this);
    ExtraField = new ExtraFieldTool(this);
    FieldHooks = new FieldHookManager(this);
    Keyboard = new KeyboardManager(this);
    Prompt = new PromptManager(this);
    Menu = new MenuManager(this);
    Clipboard = makeHelperTool(ClipboardHelper, this);
    FilePicker = makeHelperTool(FilePickerHelper, this);
    Patch = makeHelperTool(PatchHelper, this);
    ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    VirtualizedTable = makeHelperTool(VirtualizedTableHelper, this);
    Dialog = makeHelperTool(DialogHelper, this);
    LargePrefObject = makeHelperTool(LargePrefHelper, this);
    Guide = makeHelperTool(GuideHelper, this);
    constructor() {
      super();
    }
    /**
    * Unregister everything created by managers.
    */
    unregisterAll() {
      unregister(this);
    }
  };


  // node_modules/color-rna/src/ColorRNA.js
  function ColorRNA() {
    this._xyz = {
      X: 0,
      Y: 0,
      Z: 0
    };
    this._gamma = -2.2;
    this._colorSpace = "sRGB";
    this._refWhiteName = "D65";
    this._refWhiteNameUSER = "";
    this._adtAlg = "Bradford";
    this._doAdapta = true;
    this._doAdaptaUSER = 0;
    this._dLV = 1;
    this._COLORSPACES = {
      sRGB: "sRGB",
      AdobeRGB: "AdobeRGB",
      AppleRGB: "AppleRGB",
      BestRGB: "BestRGB",
      BetaRGB: "BetaRGB",
      BruceRGB: "BruceRGB",
      CIERGB: "CIERGB",
      ColorMatchRGB: "ColorMatchRGB",
      ECIRGBv2: "ECIRGBv2",
      DonRGB4: "DonRGB4",
      EktaSpacePS5: "EktaSpacePS5",
      NTSCRGB: "NTSCRGB",
      PALSECAMRGB: "PALSECAMRGB",
      ProPhotoRGB: "ProPhotoRGB",
      SMPTECRGB: "SMPTECRGB",
      WideGamutRGB: "WideGamutRGB"
    };
    this._REFWHITES = {
      A: "A",
      B: "B",
      C: "C",
      D50: "D50",
      D55: "D55",
      D65: "D65",
      D75: "D75",
      E: "E",
      F2: "F2",
      F7: "F7",
      F11: "F11"
    };
    this._adt_refWhite = {
      X: 0,
      Y: 0,
      Z: 0
    };
    this._adt_refWhiteRGB = {
      X: 0,
      Y: 0,
      Z: 0
    };
    this._adt_mtxAdaptMa = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this._adt_mtxAdaptMaI = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this._rgbX(arguments, this._COLORSPACES.sRGB);
  }
  ColorRNA.prototype._RGBstring = function () {
    return "#" + this.r.toString(16) + this.g.toString(16) + this.b.toString(16);
  };
  ColorRNA.prototype._arrayProduct = function (inArray, inArray2) {
    var sum = 0;
    for (var z = 0; z < inArray.length; z++) {
      sum += inArray[z] * inArray2[z];
    }
    return sum;
  };
  ColorRNA.prototype._normaliz = function (inNumber, inMin, inMax, newMax) {
    var newNumber = 0;
    if (arguments.length == 4) {
      newNumber = (inNumber - inMin) / (inMax - inMin);
      newNumber = newNumber * newMax;
    } else {
      newNumber = arguments[0] / 255;
    }
    return newNumber;
  };
  ColorRNA.prototype._normalizArray = function (inArray, inMin, inMax, newMax) {
    for (var i = 0; i < inArray.length; i++) {
      inArray[i] = this._normaliz(inArray[i], inMin, inMax, newMax);
    }
    return inArray;
  };
  ColorRNA.prototype._arrayFixed = function (inArray, Number2) {
    for (var z = 0; z < inArray.length; z++) {
      inArray[z] = +inArray[z].toFixed(Number2);
    }
  };
  ColorRNA.prototype._arrayRound = function (inArray) {
    for (var z = 0; z < inArray.length; z++) {
      inArray[z] = Math.round(inArray[z]);
    }
  };
  ColorRNA.prototype._enGamma = function (rgb) {
    var newRGB = 0;
    var sign = 1;
    if (rgb < 0) {
      sign = -1;
      rgb = -rgb;
    }
    if (this._gamma < 0) {
      if (rgb <= 0.0031306684425005883) {
        newRGB = sign * rgb * 12.92;
      } else {
        newRGB = sign * 1.055 * Math.pow(rgb, 0.4166666666666667) - 0.055;
      }
    }
    if (this._gamma == 0) {
      if (rgb <= 216 / 24389) {
        newRGB = sign * (rgb * 24389 / 2700);
      } else {
        newRGB = sign * (Math.pow(rgb, 1 / 3) * 1.16 - 0.16);
      }
    }
    if (this._gamma > 0) {
      newRGB = sign * Math.pow(rgb, 1 / this._gamma);
    }
    return newRGB;
  };
  ColorRNA.prototype._adt_adaptation = function (lightName, algName) {
    this._adt_setRefWhite(lightName);
    this._adt_setAdaptMa(algName);
    var Ad = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][0] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][0] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][0];
    var Bd = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][1] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][1] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][1];
    var Cd = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][2] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][2] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][2];
    var As = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][0] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][0] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][0];
    var Bs = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][1] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][1] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][1];
    var Cs = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][2] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][2] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][2];
    var X = this._xyz.X * this._adt_mtxAdaptMa[0][0] + this._xyz.Y * this._adt_mtxAdaptMa[1][0] + this._xyz.Z * this._adt_mtxAdaptMa[2][0];
    var Y = this._xyz.X * this._adt_mtxAdaptMa[0][1] + this._xyz.Y * this._adt_mtxAdaptMa[1][1] + this._xyz.Z * this._adt_mtxAdaptMa[2][1];
    var Z = this._xyz.X * this._adt_mtxAdaptMa[0][2] + this._xyz.Y * this._adt_mtxAdaptMa[1][2] + this._xyz.Z * this._adt_mtxAdaptMa[2][2];
    X *= Ad / As;
    Y *= Bd / Bs;
    Z *= Cd / Cs;
    var X2 = X * this._adt_mtxAdaptMaI[0][0] + Y * this._adt_mtxAdaptMaI[1][0] + Z * this._adt_mtxAdaptMaI[2][0];
    var Y2 = X * this._adt_mtxAdaptMaI[0][1] + Y * this._adt_mtxAdaptMaI[1][1] + Z * this._adt_mtxAdaptMaI[2][1];
    var Z2 = X * this._adt_mtxAdaptMaI[0][2] + Y * this._adt_mtxAdaptMaI[1][2] + Z * this._adt_mtxAdaptMaI[2][2];
    return [X2, Y2, Z2];
  };
  ColorRNA.prototype._adt_invAdaptation = function (xyz, lightName, algName) {
    this._adt_setRefWhite(lightName);
    this._adt_setAdaptMa(algName);
    var As = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][0] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][0] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][0];
    var Bs = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][1] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][1] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][1];
    var Cs = this._adt_refWhite.X * this._adt_mtxAdaptMa[0][2] + this._adt_refWhite.Y * this._adt_mtxAdaptMa[1][2] + this._adt_refWhite.Z * this._adt_mtxAdaptMa[2][2];
    var Ad = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][0] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][0] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][0];
    var Bd = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][1] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][1] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][1];
    var Cd = this._adt_refWhiteRGB.X * this._adt_mtxAdaptMa[0][2] + this._adt_refWhiteRGB.Y * this._adt_mtxAdaptMa[1][2] + this._adt_refWhiteRGB.Z * this._adt_mtxAdaptMa[2][2];
    var X1 = xyz[0] * this._adt_mtxAdaptMa[0][0] + xyz[1] * this._adt_mtxAdaptMa[1][0] + xyz[2] * this._adt_mtxAdaptMa[2][0];
    var Y1 = xyz[0] * this._adt_mtxAdaptMa[0][1] + xyz[1] * this._adt_mtxAdaptMa[1][1] + xyz[2] * this._adt_mtxAdaptMa[2][1];
    var Z1 = xyz[0] * this._adt_mtxAdaptMa[0][2] + xyz[1] * this._adt_mtxAdaptMa[1][2] + xyz[2] * this._adt_mtxAdaptMa[2][2];
    X1 *= Ad / As;
    Y1 *= Bd / Bs;
    Z1 *= Cd / Cs;
    var X2 = X1 * this._adt_mtxAdaptMaI[0][0] + Y1 * this._adt_mtxAdaptMaI[1][0] + Z1 * this._adt_mtxAdaptMaI[2][0];
    var Y2 = X1 * this._adt_mtxAdaptMaI[0][1] + Y1 * this._adt_mtxAdaptMaI[1][1] + Z1 * this._adt_mtxAdaptMaI[2][1];
    var Z2 = X1 * this._adt_mtxAdaptMaI[0][2] + Y1 * this._adt_mtxAdaptMaI[1][2] + Z1 * this._adt_mtxAdaptMaI[2][2];
    return [X2, Y2, Z2];
  };
  ColorRNA.prototype._adt_setRefWhite = function (lightname) {
    if (this._refWhiteNameUSER.length > 0) {
      lightname = this._refWhiteNameUSER;
    }
    this._adt_refWhite.Y = 1;
    switch (lightname) {
      case "A":
        {
          this._adt_refWhite.X = 1.0985;
          this._adt_refWhite.Z = 0.35585;
          break;
        }
      case "B":
        {
          this._adt_refWhite.X = 0.99072;
          this._adt_refWhite.Z = 0.85223;
          break;
        }
      case "C":
        {
          this._adt_refWhite.X = 0.98074;
          this._adt_refWhite.Z = 1.18232;
          break;
        }
      case "D50":
        {
          this._adt_refWhite.X = 0.96422;
          this._adt_refWhite.Z = 0.82521;
          break;
        }
      case "D55":
        {
          this._adt_refWhite.X = 0.95682;
          this._adt_refWhite.Z = 0.92149;
          break;
        }
      case "D65":
        {
          this._adt_refWhite.X = 0.95047;
          this._adt_refWhite.Z = 1.08883;
          break;
        }
      case "D75":
        {
          this._adt_refWhite.X = 0.94972;
          this._adt_refWhite.Z = 1.22638;
          break;
        }
      case "E":
        {
          this._adt_refWhite.X = 1;
          this._adt_refWhite.Z = 1;
          break;
        }
      case "F2":
        {
          this._adt_refWhite.X = 0.99186;
          this._adt_refWhite.Z = 0.67393;
          break;
        }
      case "F7":
        {
          this._adt_refWhite.X = 0.95041;
          this._adt_refWhite.Z = 1.08747;
          break;
        }
      case "F11":
        {
          this._adt_refWhite.X = 1.00962;
          this._adt_refWhite.Z = 0.6435;
          break;
        }
    }
  };
  ColorRNA.prototype._adt_setAdaptMa = function (aglName) {
    switch (aglName) {
      case "Bradford":
        {
          this._adt_mtxAdaptMa = [[0.8951, -0.7502, 0.0389], [0.2664, 1.7135, -0.0685], [-0.1614, 0.0367, 1.0296]];
          this._adt_mtxAdaptMaI = [[0.9869929054667123, 0.43230526972339456, -0.008528664575177328], [-0.14705425642099013, 0.5183602715367776, 0.04004282165408487], [0.15996265166373125, 0.0492912282128556, 0.9684866957875502]];
          break;
        }
      case "vonKries":
        {
          this._adt_mtxAdaptMa = [[0.40024, -0.2263, 0], [0.7076, 1.16532, 0], [-0.08081, 0.0457, 0.91822]];
          this._adt_mtxAdaptMaI = [[1.8599363874558397, 0.3611914362417676, -0], [-1.1293816185800916, 0.6388124632850422, -0], [0.21989740959619328, -0.000006370596838650885, 1.0890636230968613]];
          break;
        }
      case "none":
        {
          this._adt_mtxAdaptMa = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          this._adt_mtxAdaptMaI = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
          break;
        }
    }
  };
  ColorRNA.prototype._deGamma = function (rgb) {
    var newRGB = 0;
    var sign = 1;
    if (rgb < 0) {
      sign = -1;
      rgb = -rgb;
    }
    if (this._gamma < 0) {
      if (rgb <= 0.0404482362771076) {
        newRGB = sign * rgb / 12.92;
      } else {
        newRGB = sign * Math.pow((rgb + 0.055) / 1.055, 2.4);
      }
    }
    if (this._gamma == 0) {
      if (rgb <= 0.08) {
        newRGB = sign * 2700 * rgb / 24389;
      } else {
        newRGB = sign * ((((rgb * 1000000 + 480000) * rgb + 76800) * rgb + 4096) / 1560896);
      }
    }
    if (this._gamma > 0) {
      newRGB = sign * Math.pow(rgb, this._gamma);
    }
    return newRGB;
  };
  ColorRNA.prototype._getRGBnucleotids = function (rabColorSpaceName, XYZtoRGB) {
    this._adt_refWhiteRGB.Y = 1;
    this._refWhiteName = "D65";
    this._doAdapta = true;
    switch (rabColorSpaceName) {
      case "sRGB":
        {
          this._gamma = -2.2;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[3.2404541621141045, -1.5371385127977166, -0.498531409556016], [-0.9692660305051868, 1.8760108454466942, 0.041556017530349834], [0.055643430959114726, -0.2040259135167538, 1.0572251882231791]];
            } else {
              return [[3.2404542, -1.5371385, -0.4985314], [-0.969266, 1.8760108, 0.041556], [0.0556434, -0.2040259, 1.0572252]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.4124564390896922, 0.357576077643909, 0.18043748326639894], [0.21267285140562253, 0.715152155287818, 0.07217499330655958], [0.0193338955823293, 0.11919202588130297, 0.9503040785363679]];
          } else {
            return [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.072175], [0.0193339, 0.119192, 0.9503041]];
          }
          break;
        }
      case "AdobeRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.041368979260079, -0.5649463871751954, -0.3446943843778483], [-0.9692660305051861, 1.876010845446693, 0.041556017530349786], [0.013447387216170255, -0.11838974235412553, 1.0154095719504164]];
            } else {
              return [[2.041369, -0.5649464, -0.3446944], [-0.969266, 1.8760108, 0.041556], [0.0134474, -0.1183897, 1.0154096]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.5767308871981477, 0.18555395071121408, 0.18818516209063843], [0.29737686371154487, 0.6273490714522, 0.07527406483625537], [0.027034260337413143, 0.0706872193185578, 0.9911085203440292]];
          } else {
            return [[0.5767309, 0.185554, 0.1881852], [0.2973769, 0.6273491, 0.0752741], [0.0270343, 0.0706872, 0.9911085]];
          }
          break;
        }
      case "AppleRGB":
        {
          this._gamma = 1.8;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.951537290948746, -1.2894115658994107, -0.473844478043996], [-1.0851093382231771, 1.9908566080903682, 0.037202561107440836], [0.08549335448914223, -0.26949635273220945, 1.0912975249496382]];
            } else {
              return [[2.9515373, -1.2894116, -0.4738445], [-1.0851093, 1.9908566, 0.0372026], [0.0854934, -0.2694964, 1.0912975]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.4497288365610329, 0.31624860938967136, 0.1844925540492957], [0.24465248708920193, 0.6720282949530516, 0.08331921795774647], [0.025184814847417827, 0.14118241490610328, 0.9224627702464786]];
          } else {
            return [[0.4497288, 0.3162486, 0.1844926], [0.2446525, 0.6720283, 0.0833192], [0.0251848, 0.1411824, 0.9224628]];
          }
          break;
        }
      case "BestRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.7552599329466554, -0.4836785613998958, -0.25300004986116026], [-0.5441336296844771, 1.5068789209543363, 0.021552825898898505], [0.00634673971374007, -0.01757613896601896, 1.225695866021057]];
            } else {
              return [[1.7552599, -0.4836786, -0.253], [-0.5441336, 1.5068789, 0.0215528], [0.0063467, -0.0175761, 1.2256959]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.6326696499956765, 0.20455579792131387, 0.12699455208300955], [0.22845686422193134, 0.7373522948326431, 0.034190840945425655], [0, 0.009514223159130886, 0.8156957768408691]];
          } else {
            return [[0.6326696, 0.2045558, 0.1269946], [0.2284569, 0.7373523, 0.0341908], [0, 0.0095142, 0.8156958]];
          }
          break;
        }
      case "BetaRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.6832269542614402, -0.4282362832078967, -0.2360184809079736], [-0.7710228944287557, 1.7065571005222588, 0.04468995133824896], [0.04000128943944507, -0.08853755837368198, 1.272364022576533]];
            } else {
              return [[1.683227, -0.4282363, -0.2360185], [-0.7710229, 1.7065571, 0.04469], [0.0400013, -0.0885376, 1.272364]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.671253700292543, 0.17458338980154234, 0.11838290990591456], [0.30327257771637545, 0.6637860908315439, 0.03294133145208057], [5.409707559738789e-17, 0.040700961469342455, 0.7845090385306573]];
          } else {
            return [[0.6712537, 0.1745834, 0.1183829], [0.3032726, 0.6637861, 0.0329413], [0, 0.040701, 0.784509]];
          }
          break;
        }
      case "BruceRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.745466866559799, -1.1358136045241505, -0.4350268528006593], [-0.9692660305051869, 1.8760108454466942, 0.04155601753034985], [0.011272295190850611, -0.1139754291519338, 1.0132540899331266]];
            } else {
              return [[2.7454669, -1.1358136, -0.4350269], [-0.969266, 1.8760108, 0.041556], [0.0112723, -0.1139754, 1.0132541]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.4674161637795275, 0.2944512299212599, 0.18860260629921258], [0.24101145944881885, 0.6835474980314961, 0.07544104251968503], [0.021910132677165326, 0.0736128074803149, 0.9933070598425197]];
          } else {
            return [[0.4674162, 0.2944512, 0.1886026], [0.2410115, 0.6835475, 0.075441], [0.0219101, 0.0736128, 0.9933071]];
          }
          break;
        }
      case "CIERGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 1;
          this._adt_refWhiteRGB.Z = 1;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.370674329102138, -0.9000405327854051, -0.4706337963167336], [-0.513884966581945, 1.42530358655747, 0.08858138002447524], [0.005298175073030407, -0.0146949384101032, 1.0093967633370728]];
            } else {
              return [[2.3706743, -0.9000405, -0.4706338], [-0.513885, 1.4253036, 0.0885814], [0.0052982, -0.0146949, 1.0093968]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.48871796548117163, 0.31068034326701394, 0.20060169125181454], [0.1762044365340279, 0.8129846938775509, 0.010810869588421142], [0, 0.010204828793442072, 0.9897951712065579]];
          } else {
            return [[0.488718, 0.3106803, 0.2006017], [0.1762044, 0.8129847, 0.0108109], [0, 0.0102048, 0.9897952]];
          }
          break;
        }
      case "ColorMatchRGB":
        {
          this._gamma = 1.8;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.6422874096694384, -1.2234270341709754, -0.39301430179044206], [-1.1119762771300263, 2.059018273920192, 0.01596138196837363], [0.08216985846755141, -0.2807254155216341, 1.4559876814266082]];
            } else {
              return [[2.6422874, -1.223427, -0.3930143], [-1.1119763, 2.0590183, 0.0159614], [0.0821699, -0.2807254, 1.4559877]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.509343853397384, 0.3209070884940387, 0.13396905810857737], [0.2748839843731914, 0.6581314865725201, 0.06698452905428869], [0.024254469209399214, 0.1087820638962844, 0.6921734668943165]];
          } else {
            return [[0.5093439, 0.3209071, 0.1339691], [0.274884, 0.6581315, 0.0669845], [0.0242545, 0.1087821, 0.6921735]];
          }
          break;
        }
      case "ECIRGBv2":
        {
          this._gamma = 0;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.7827617697270912, -0.49698473887532724, -0.2690100880150854], [-0.9593623286322266, 1.9477962429805813, -0.027580735166583017], [0.08593169513496947, -0.17446738103160447, 1.322827306926194]];
            } else {
              return [[1.7827618, -0.4969847, -0.2690101], [-0.9593623, 1.9477962, -0.0275807], [0.0859317, -0.1744674, 1.3228273]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.650204257079646, 0.1780773570796461, 0.13593838584070797], [0.32024985796460176, 0.6020710644121368, 0.07767907762326169], [-5.3871025143217717e-17, 0.06783899317319857, 0.7573710068268015]];
          } else {
            return [[0.6502043, 0.1780774, 0.1359384], [0.3202499, 0.6020711, 0.0776791], [-0, 0.067839, 0.757371]];
          }
          break;
        }
      case "DonRGB4":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.7603902333031187, -0.48811980100639313, -0.25361261951399006], [-0.7126287844544976, 1.6527431594729967, 0.041671534607820124], [0.00782073858032594, -0.03474110403369325, 1.244774289550262]];
            } else {
              return [[1.7603902, -0.4881198, -0.2536126], [-0.7126288, 1.6527432, 0.0416715], [0.0078207, -0.0347411, 1.2447743]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.645771138436728, 0.19335110357732524, 0.12509775798594666], [0.2783496286365207, 0.6879702057518782, 0.033680165611601025], [0.0037113283818203304, 0.01798614916998376, 0.8035125224481958]];
          } else {
            return [[0.6457711, 0.1933511, 0.1250978], [0.2783496, 0.6879702, 0.0336802], [0.0037113, 0.0179861, 0.8035125]];
          }
          break;
        }
      case "EktaSpacePS5":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[2.0043819420638203, -0.7304844248729281, -0.24500518813859393], [-0.7110285484718862, 1.6202125940588885, 0.07922268628430854], [0.038126311068521795, -0.0868779875167958, 1.2725437595985338]];
            } else {
              return [[2.0043819, -0.7304844, -0.2450052], [-0.7110285, 1.6202126, 0.0792227], [0.0381263, -0.086878, 1.2725438]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.5938913615570769, 0.2729801227546152, 0.09734851568830809], [0.26062858312936465, 0.7349464843393485, 0.004424932531286731], [4.743538587961513e-17, 0.04199694196224853, 0.7832130580377514]];
          } else {
            return [[0.5938914, 0.2729801, 0.0973485], [0.2606286, 0.7349465, 0.0044249], [0, 0.0419969, 0.7832131]];
          }
          break;
        }
      case "NTSCRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.98074;
          this._adt_refWhiteRGB.Z = 1.18232;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.9099960989184541, -0.5324541554529706, -0.2882091300158282], [-0.9846663050051847, 1.9991709828893145, -0.02830819991079395], [0.0583056402155416, -0.11837811801337218, 0.8975534918028807]];
            } else {
              return [[1.9099961, -0.5324542, -0.2882091], [-0.9846663, 1.999171, -0.0283082], [0.0583056, -0.1183781, 0.8975535]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.6068909212389378, 0.1735011212389381, 0.20034795752212392], [0.2989164238938052, 0.5865990289506955, 0.11448454715549937], [-5.028240852204785e-17, 0.06609566523388125, 1.116224334766119]];
          } else {
            return [[0.6068909, 0.1735011, 0.200348], [0.2989164, 0.586599, 0.1144845], [-0, 0.0660957, 1.1162243]];
          }
          break;
        }
      case "PALSECAMRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[3.0628971232226965, -1.393179136493678, -0.4757516712579541], [-0.9692660305051867, 1.876010845446694, 0.04155601753034983], [0.06787750995175175, -0.22885477399033227, 1.0693489682562851]];
            } else {
              return [[3.0628971, -1.3931791, -0.4757517], [-0.969266, 1.8760108, 0.041556], [0.0678775, -0.2288548, 1.069349]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.4306190335097004, 0.3415419122574957, 0.17830905423280421], [0.22203793915343925, 0.7066384391534394, 0.07132362169312169], [0.020185267195767184, 0.12955038051146386, 0.9390943522927689]];
          } else {
            return [[0.430619, 0.3415419, 0.1783091], [0.2220379, 0.7066384, 0.0713236], [0.0201853, 0.1295504, 0.9390944]];
          }
          break;
        }
      case "ProPhotoRGB":
        {
          this._gamma = 1.8;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.3459433009386654, -0.25560750931676696, -0.05111176587088495], [-0.544598869458717, 1.508167317720767, 0.020535141586646915], [0, -0, 1.2118127506937628]];
            } else {
              return [[1.3459433, -0.2556075, -0.0511118], [-0.5445989, 1.5081673, 0.0205351], [0, 0, 1.2118128]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.7976749444306044, 0.13519170147409815, 0.031353354095297416], [0.2880402378623102, 0.7118740972357901, 0.00008566490189971971], [0, 0, 0.82521]];
          } else {
            return [[0.7976749, 0.1351917, 0.0313534], [0.2880402, 0.7118741, 0.0000857], [0, 0, 0.82521]];
          }
          break;
        }
      case "SMPTECRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.95047;
          this._adt_refWhiteRGB.Z = 1.08883;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[3.505395974670056, -1.7394893606633242, -0.543964026874098], [-1.0690722072799321, 1.9778244814100043, 0.035172230231857005], [0.056320014767146896, -0.1970226122130985, 1.0502026283050325]];
            } else {
              return [[3.505396, -1.7394894, -0.543964], [-1.0690722, 1.9778245, 0.0351722], [0.05632, -0.1970226, 1.0502026]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.3935890809541021, 0.365249655704132, 0.19163126334176603], [0.21241315480062656, 0.7010436940127694, 0.08654315118660402], [0.018742337188290558, 0.11193134610287912, 0.9581563167088301]];
          } else {
            return [[0.3935891, 0.3652497, 0.1916313], [0.2124132, 0.7010437, 0.0865432], [0.0187423, 0.1119313, 0.9581563]];
          }
          break;
        }
      case "WideGamutRGB":
        {
          this._gamma = 2.2;
          this._adt_refWhiteRGB.X = 0.96422;
          this._adt_refWhiteRGB.Z = 0.82521;
          if (XYZtoRGB == true) {
            if (this._dLV == 2) {
              return [[1.4628067131216802, -0.18406234137547003, -0.27436064462466103], [-0.5217933153765428, 1.447238063402864, 0.06772274590650387], [0.034934211112166366, -0.09689300063185764, 1.2884099024409357]];
            } else {
              return [[1.4628067, -0.1840623, -0.2743606], [-0.5217933, 1.4472381, 0.0677227], [0.0349342, -0.096893, 1.2884099]];
            }
            break;
          }
          if (this._dLV == 2) {
            return [[0.7161045686144476, 0.10092960102210317, 0.1471858303634494], [0.25818736147323623, 0.7249378299500627, 0.016874808576701202], [0, 0.05178127356786167, 0.7734287264321384]];
          } else {
            return [[0.7161046, 0.1009296, 0.1471858], [0.2581874, 0.7249378, 0.0168748], [0, 0.0517813, 0.7734287]];
          }
          break;
        }
    }
  };
  ColorRNA.prototype._RGB_to_YPbPr = function (rgb) {
    rgb = this._normalizArray(rgb, 0, 255, 1);
    var Y = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    var Pb = rgb[0] * -0.1687367 - rgb[1] * 0.331264 + rgb[2] * 0.5;
    var Pr = rgb[0] * 0.5 - rgb[1] * 0.418688 - rgb[2] * 0.081312;
    return [Y, Pb, Pr];
  };
  ColorRNA.prototype._YPbPr_to_RGB_ = function (YPbPr) {
    var r = YPbPr[0] * 0.9999999999991468 - YPbPr[1] * 0.0000012188941887145875 + YPbPr[2] * 1.401999588656144;
    var g = YPbPr[0] * 0.9999997591050251 - YPbPr[1] * 0.34413567816504304 - YPbPr[2] * 0.7141364933164679;
    var b = YPbPr[0] * 1.0000012404000462 + YPbPr[1] * 1.772000066072304 + YPbPr[2] * 0.0000021453384174593273;
    return this._normalizArray([r, g, b], 0, 1, 255);
  };
  ColorRNA.prototype._RGB_to_YCbCr = function (rgb) {
    rgb = this._normalizArray(rgb, 0, 255, 1);
    var Y = rgb[0] * 65.481 + rgb[1] * 128.553 + rgb[2] * 24.966 + 16;
    var Cb = rgb[0] * -37.797 - rgb[1] * 74.203 + rgb[2] * 112 + 128;
    var Cr = rgb[0] * 112 - rgb[1] * 93.786 - rgb[2] * 18.214 + 128;
    return [Y, Cb, Cr];
  };
  ColorRNA.prototype._YCbCr_to_RGB = function (YCbCr) {
    YCbCr[0] -= 16;
    YCbCr[1] -= 128;
    YCbCr[2] -= 128;
    var r = YCbCr[0] * 0.004566210045662101 + YCbCr[1] * 1.1808799897946416e-9 + YCbCr[2] * 0.006258928969943936;
    var g = YCbCr[0] * 0.004566210045662101 - YCbCr[1] * 0.0015363236860449021 - YCbCr[2] * 0.003188110949655707;
    var b = YCbCr[0] * 0.004566210045662101 + YCbCr[1] * 0.007910716233554741 + YCbCr[2] * 1.1977497040190077e-8;
    return this._normalizArray([r, g, b], 0, 1, 255);
  };
  ColorRNA.prototype._RGB_to_JpegYCbCr = function (rgb) {
    var YPbPr = this._RGB_to_YPbPr(rgb);
    var Y = YPbPr[0];
    var Cb = YPbPr[1] + 0.5;
    var Cr = YPbPr[2] + 0.5;
    return [Y, Cb, Cr];
  };
  ColorRNA.prototype._JpegYCbCr_to_RGB = function (YCbCr) {
    var rgb = this._YPbPr_to_RGB_([YCbCr[0], YCbCr[1] - 0.5, YCbCr[2] - 0.5]);
    return rgb;
  };
  ColorRNA.prototype._RGB_to_YIQ = function (rgb) {
    rgb = this._normalizArray(rgb, 0, 255, 1);
    var Y = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    var I = rgb[0] * 0.595716 - rgb[1] * 0.274453 - rgb[2] * 0.321263;
    var Q = rgb[0] * 0.211456 - rgb[1] * 0.522591 + rgb[2] * 0.311135;
    return [Y, I, Q];
  };
  ColorRNA.prototype._YIQ_to_RGB = function (YIQ) {
    var r = YIQ[0] + YIQ[1] * 0.9562957197589482 + YIQ[2] * 0.6210244164652611;
    var g = YIQ[0] - YIQ[1] * 0.27212209931851045 - YIQ[2] * 0.647380596825695;
    var b = YIQ[0] - YIQ[1] * 1.1069890167364902 + YIQ[2] * 1.7046149983646481;
    return this._normalizArray([r, g, b], 0, 1, 255);
  };
  ColorRNA.prototype._RGB_to_YUV = function (rgb) {
    rgb = this._normalizArray(rgb, 0, 255, 1);
    var Y = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    var U = rgb[0] * -0.147 - rgb[1] * 0.289 + rgb[2] * 0.436;
    var V = rgb[0] * 0.615 - rgb[1] * 0.515 - rgb[2] * 0.1;
    return [Y, U, V];
  };
  ColorRNA.prototype._YUV_to_RGB = function (YUV) {
    var r = YUV[0] - YUV[1] * 0.00003945707070708279 + YUV[2] * 1.139827967171717;
    var g = YUV[0] - YUV[1] * 0.39461016414141414 - YUV[2] * 0.5805003156565657;
    var b = YUV[0] + YUV[1] * 2.0319996843434343 - YUV[2] * 0.0004813762626262513;
    return this._normalizArray([r, g, b], 0, 1, 255);
  };
  ColorRNA.prototype._RGB_to_HSL = function (rgb, outFloat) {
    rgb = this._normalizArray(rgb, 0, 255, 1);
    var r;
    var g;
    var b;
    var h;
    var s;
    var l;
    var d;
    var max;
    var min;
    r = rgb[0];
    g = rgb[1];
    b = rgb[2];
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    h = h * 360;
    s = s * 100;
    l = l * 100;
    if (outFloat != true) {
      h = Math.round(h);
      s = Math.round(s);
      l = Math.round(l);
    }
    return [h, s, l];
  };
  ColorRNA.prototype._HSL_to_RGB = function (HSL) {
    var h = HSL[0];
    var s = this._normaliz(HSL[1], 0, 100, 1);
    var l = this._normaliz(HSL[2], 0, 100, 1);
    if (h == 360) {
      h = 0;
    }
    if (h == undefined) {
      return [0, 0, 0];
    }
    var C = (1 - Math.abs(l * 2 - 1)) * s;
    var hh = h / 60;
    var temp = C * (1 - Math.abs(hh % 2 - 1));
    hh = Math.floor(hh);
    var r;
    var g;
    var b;
    if (hh === 0) {
      r = C;
      g = temp;
      b = 0;
    } else if (hh === 1) {
      r = temp;
      g = C;
      b = 0;
    } else if (hh === 2) {
      r = 0;
      g = C;
      b = temp;
    } else if (hh === 3) {
      r = 0;
      g = temp;
      b = C;
    } else if (hh === 4) {
      r = temp;
      g = 0;
      b = C;
    } else if (hh === 5) {
      r = C;
      g = 0;
      b = temp;
    }
    var CC = l - C / 2;
    r += CC;
    g += CC;
    b += CC;
    return this._normaOutRGB(this._normalizArray([r, g, b], 0, 1, 255));
  };
  ColorRNA.prototype._RGB_to_HSL_255 = function (rgb) {
    var hsl = this._RGB_to_HSL(rgb, true);
    hsl[0] = Math.round(this._normaliz(hsl[0], 0, 360, 255));
    hsl[1] = Math.round(this._normaliz(hsl[1], 0, 100, 255));
    hsl[2] = Math.round(this._normaliz(hsl[2], 0, 100, 255));
    return hsl;
  };
  ColorRNA.prototype._HSL_to_RGB_255 = function (inHSL) {
    var hsl = [0, 0, 0];
    hsl[0] = Math.round(this._normaliz(inHSL[0], 0, 255, 360));
    hsl[1] = Math.round(this._normaliz(inHSL[1], 0, 255, 100));
    hsl[2] = Math.round(this._normaliz(inHSL[2], 0, 255, 100));
    var rgb = this._HSL_to_RGB(hsl);
    return rgb;
  };
  ColorRNA.prototype._RGB_to_HSL_win239 = function (rgb) {
    var hsl = this._RGB_to_HSL(rgb, true);
    hsl[0] = Math.round(this._normaliz(hsl[0], 0, 360, 239));
    hsl[1] = Math.round(this._normaliz(hsl[1], 0, 100, 240));
    hsl[2] = Math.round(this._normaliz(hsl[2], 0, 100, 240));
    return hsl;
  };
  ColorRNA.prototype._HSL_to_RGB_win240 = function (inHSL) {
    var hsl = [0, 0, 0];
    hsl[0] = Math.round(this._normaliz(inHSL[0], 0, 239, 360));
    hsl[1] = Math.round(this._normaliz(inHSL[1], 0, 240, 100));
    hsl[2] = Math.round(this._normaliz(inHSL[2], 0, 240, 100));
    var rgb = this._HSL_to_RGB(hsl);
    return rgb;
  };
  ColorRNA.prototype._RGB_to_HSV = function (rgb) {
    var max;
    var min;
    var h;
    var s;
    var v;
    var d;
    var r = this._normaliz(rgb[0], 0, 255, 1);
    var g = this._normaliz(rgb[1], 0, 255, 1);
    var b = this._normaliz(rgb[2], 0, 255, 1);
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    v = max;
    d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    v = Math.round(v * 100);
    return [h, s, v];
  };
  ColorRNA.prototype._HSV_to_RGB = function (HSV) {
    var r;
    var g;
    var b;
    var i;
    var f;
    var p;
    var q;
    var t3;
    if (v === 0) {
      return [0, 0, 0];
    }
    var s = this._normaliz(HSV[1], 0, 100, 1);
    var v = this._normaliz(HSV[2], 0, 100, 1);
    var h = HSV[0] / 60;
    i = Math.floor(h);
    f = h - i;
    p = v * (1 - s);
    q = v * (1 - s * f);
    t3 = v * (1 - s * (1 - f));
    switch (i) {
      case 0:
        {
          r = v;
          g = t3;
          b = p;
          break;
        }
      case 1:
        {
          r = q;
          g = v;
          b = p;
          break;
        }
      case 2:
        {
          r = p;
          g = v;
          b = t3;
          break;
        }
      case 3:
        {
          r = p;
          g = q;
          b = v;
          break;
        }
      case 4:
        {
          r = t3;
          g = p;
          b = v;
          break;
        }
      case 5:
        {
          r = v;
          g = p;
          b = q;
          break;
        }
    }
    return this._normaOutRGB(this._normalizArray([r, g, b], 0, 1, 255));
  };
  ColorRNA.prototype._RGB_to_HWB = function (rgb) {
    var HSV = this._RGB_to_HSV(rgb);
    var H;
    var W;
    var B;
    H = HSV[0];
    W = Math.round((100 - HSV[1]) * HSV[2] / 100);
    B = Math.round(100 - HSV[2]);
    return [H, W, B];
  };
  ColorRNA.prototype._HWB_to_RGB = function (HWB) {
    var H;
    var S;
    var V;
    H = HWB[0];
    S = 100 - HWB[1] / (100 - HWB[2]) * 100;
    V = 100 - HWB[2];
    var rgb = this._HSV_to_RGB([H, S, V]);
    return rgb;
  };
  ColorRNA.prototype._RGB_to_CMY = function (rgb) {
    var C = 1 - rgb[0] / 255;
    var M = 1 - rgb[1] / 255;
    var Y = 1 - rgb[2] / 255;
    C = Math.round(C * 100);
    M = Math.round(M * 100);
    Y = Math.round(Y * 100);
    return [C, M, Y];
  };
  ColorRNA.prototype._CMY_to_RGB = function (CMY) {
    var C = CMY[0] / 100;
    var M = CMY[1] / 100;
    var Y = CMY[2] / 100;
    var R = Math.round(Math.max(0, (1 - C) * 255));
    var G = Math.round(Math.max(0, (1 - M) * 255));
    var B = Math.round(Math.max(0, (1 - Y) * 255));
    return [R, G, B];
  };
  ColorRNA.prototype._CMY_to_CMYK = function (CMY) {
    var C = CMY[0] / 100;
    var M = CMY[1] / 100;
    var Y = CMY[2] / 100;
    var K = Math.min(Y, Math.min(M, Math.min(C, 1)));
    C = Math.round((C - K) / (1 - K) * 100);
    M = Math.round((M - K) / (1 - K) * 100);
    Y = Math.round((Y - K) / (1 - K) * 100);
    K = Math.round(K * 100);
    return [C, M, Y, K];
  };
  ColorRNA.prototype._CMYK_to_CMY = function (CMYK) {
    var C = CMYK[0] / 100 * (1 - CMYK[3] / 100) + CMYK[3] / 100;
    var M = CMYK[1] / 100 * (1 - CMYK[3] / 100) + CMYK[3] / 100;
    var Y = CMYK[2] / 100 * (1 - CMYK[3] / 100) + CMYK[3] / 100;
    return [Math.round(C * 100), Math.round(M * 100), Math.round(Y * 100)];
  };
  ColorRNA.prototype._RGB_to_CMYK = function (rgb) {
    return this._CMY_to_CMYK(this._RGB_to_CMY(rgb));
  };
  ColorRNA.prototype._CMYK_to_RGB = function (CMYK) {
    return this._CMY_to_RGB(this._CMYK_to_CMY(CMYK));
  };
  ColorRNA.prototype._RGB_to_XYZ = function () {
    var x;
    var y;
    var z;
    var nucleotids = this._getRGBnucleotids(this._colorSpace);
    var rgbs = [this._deGamma(this._normaliz(this.r)), this._deGamma(this._normaliz(this.g)), this._deGamma(this._normaliz(this.b))];
    x = this._arrayProduct(rgbs, nucleotids[0]);
    y = this._arrayProduct(rgbs, nucleotids[1]);
    z = this._arrayProduct(rgbs, nucleotids[2]);
    this._xyz.X = x;
    this._xyz.Y = y;
    this._xyz.Z = z;
    if ((this._doAdapta == true || this._doAdaptaUSER == 1) && this._doAdaptaUSER != -1) {
      var xyz2 = this._adt_adaptation(this._refWhiteName, this._adtAlg);
      this._xyz.X = xyz2[0];
      this._xyz.Y = xyz2[1];
      this._xyz.Z = xyz2[2];
    }
    return [this._xyz.X, this._xyz.Y, this._xyz.Z];
  };
  ColorRNA.prototype._XYZ_to_RGB = function () {
    var nucleotids = this._getRGBnucleotids(this._colorSpace, true);
    var xyzs = [this._xyz.X, this._xyz.Y, this._xyz.Z];
    if ((this._doAdapta == true || this._doAdaptaUSER == 1) && this._doAdaptaUSER != -1) {
      xyzs = this._adt_invAdaptation(xyzs, this._refWhiteName, this._adtAlg);
    }
    var _r;
    var _g;
    var _b;
    _r = this._arrayProduct(xyzs, nucleotids[0]);
    _g = this._arrayProduct(xyzs, nucleotids[1]);
    _b = this._arrayProduct(xyzs, nucleotids[2]);
    var rgbs = [this._normaliz(this._enGamma(_r), 0, 1, 255), this._normaliz(this._enGamma(_g), 0, 1, 255), this._normaliz(this._enGamma(_b), 0, 1, 255)];
    this._arrayRound(rgbs);
    return rgbs;
  };
  ColorRNA.prototype._XYZ_to_Lab = function (psMod) {
    var xyz = [this._xyz.X, this._xyz.Y, this._xyz.Z];
    var kE = 0.008856451679;
    var kK = 903.2962962963;
    this._adt_setRefWhite("D65");
    if (psMod === true) {
      this._getRGBnucleotids("sRGB");
      xyz = this._adt_adaptation("D50", this._adtAlg);
    }
    var xr = xyz[0] / this._adt_refWhite.X;
    var yr = xyz[1] / this._adt_refWhite.Y;
    var zr = xyz[2] / this._adt_refWhite.Z;
    var fx = xr > kE ? Math.pow(xr, 1 / 3) : (kK * xr + 16) / 116;
    var fy = yr > kE ? Math.pow(yr, 1 / 3) : (kK * yr + 16) / 116;
    var fz = zr > kE ? Math.pow(zr, 1 / 3) : (kK * zr + 16) / 116;
    var Lab = [fy * 116 - 16, (fx - fy) * 500, (fy - fz) * 200];
    return Lab;
  };
  ColorRNA.prototype._LCHab_to_XYZ = function (LCH) {
    var Lab = [0, 0, 0];
    Lab[0] = LCH[0];
    Lab[1] = LCH[1] * Math.cos(LCH[2] * Math.PI / 180);
    Lab[2] = LCH[1] * Math.sin(LCH[2] * Math.PI / 180);
    return this._Lab_to_XYZ(Lab, false);
  };
  ColorRNA.prototype._XYZ_to_LCHab = function () {
    var Lab = this._XYZ_to_Lab(Lab, false);
    var LCH = [0, 0, 0];
    LCH[0] = Lab[0];
    LCH[1] = Math.sqrt(Lab[1] * Lab[1] + Lab[2] * Lab[2]);
    LCH[2] = Math.atan2(Lab[2], Lab[1]) * 180 / Math.PI;
    if (LCH[2] < 0) {
      LCH[2] += 360;
    }
    return LCH;
  };
  ColorRNA.prototype._Lab_to_XYZ = function (Labs, psMod) {
    var xyz = [0, 0, 0];
    var kE = 0.008856451679;
    var kK = 903.2962962963;
    var kKE = 8;
    var Lab = {
      L: Labs[0],
      a: Labs[1],
      b: Labs[2]
    };
    var fy = (Lab.L + 16) / 116;
    var fx = Lab.a * 0.002 + fy;
    var fz = fy - Lab.b * 0.005;
    var fx3 = fx * fx * fx;
    var fz3 = fz * fz * fz;
    var xr = fx3 > kE ? fx3 : (fx * 116 - 16) / kK;
    var yr = Lab.L > kKE ? Math.pow((Lab.L + 16) / 116, 3) : Lab.L / kK;
    var zr = fz3 > kE ? fz3 : (fz * 116 - 16) / kK;
    if (psMod === true) {
      this._adt_setRefWhite("D50");
    } else {
      this._adt_setRefWhite("D65");
    }
    xyz[0] = xr * this._adt_refWhite.X;
    xyz[1] = yr * this._adt_refWhite.Y;
    xyz[2] = zr * this._adt_refWhite.Z;
    this._xyz.X = xyz[0];
    this._xyz.Y = xyz[1];
    this._xyz.Z = xyz[2];
    if (psMod === true) {
      this._getRGBnucleotids("sRGB");
      xyz = this._adt_invAdaptation(xyz, "D50", this._adtAlg);
    }
    this._xyz.X = xyz[0];
    this._xyz.Y = xyz[1];
    this._xyz.Z = xyz[2];
    return [this._xyz.X, this._xyz.Y, this._xyz.Z];
  };
  ColorRNA.prototype._XYZ_to_xyY = function () {
    var xyY = [0, 0, 0];
    var Den = this._xyz.X + this._xyz.Y + this._xyz.Z;
    if (Den > 0) {
      xyY[0] = this._xyz.X / Den;
      xyY[1] = this._xyz.Y / Den;
    } else {
      this._adt_setRefWhite(this._refWhiteName);
      xyY[0] = this._adt_refWhite.X / (this._adt_refWhite.X + this._adt_refWhite.Y + this._adt_refWhite.Z);
      xyY[1] = this._adt_refWhite.Y / (this._adt_refWhite.X + this._adt_refWhite.Y + this._adt_refWhite.Z);
    }
    xyY[2] = this._xyz.Y;
    return xyY;
  };
  ColorRNA.prototype._xyY_to_XYZ = function (xyY) {
    var XYZ = [0, 0, 0];
    if (xyY[1] < 0.000001) {
      XYZ[0] = XYZ[1] = XYZ[2] = 0;
    } else {
      XYZ[0] = xyY[0] * xyY[2] / xyY[1];
      XYZ[1] = xyY[2];
      XYZ[2] = (1 - xyY[0] - xyY[1]) * xyY[2] / xyY[1];
    }
    this._xyz.X = XYZ[0];
    this._xyz.Y = XYZ[1];
    this._xyz.Z = XYZ[2];
    return XYZ;
  };
  ColorRNA.prototype._xyY_to_Wavelength = function (xyY) {
    var x = xyY[0];
    var y = xyY[1];
    var xr = this._adt_refWhite.X / (this._adt_refWhite.X + this._adt_refWhite.Y + this._adt_refWhite.Z);
    var yr = this._adt_refWhite.Y / (this._adt_refWhite.X + this._adt_refWhite.Y + this._adt_refWhite.Z);
    var dominantWavelength;
    var count = 0;
    var tArray = [0, 0];
    var wArray = [0, 0];
    var cArray = [0, 0];
    var nm;
    var a = x - xr;
    var b = y - yr;
    if (a >= -0.000001 && a <= 0.000001 && b >= -0.000001 && b <= 0.000001) {
      return 0;
    }
    for (nm = 360; nm <= 830; nm += 5) {
      var i1 = (nm - 360) / 5;
      var i2 = nm == 830 ? 0 : i1 + 1;
      var nm2 = i2 * 5 + 360;
      var CIE1931StdObs_x = [0.0001299, 0.0002321, 0.0004149, 0.0007416, 0.001368, 0.002236, 0.004243, 0.00765, 0.01431, 0.02319, 0.04351, 0.07763, 0.13438, 0.21477, 0.2839, 0.3285, 0.34828, 0.34806, 0.3362, 0.3187, 0.2908, 0.2511, 0.19536, 0.1421, 0.09564, 0.05795001, 0.03201, 0.0147, 0.0049, 0.0024, 0.0093, 0.0291, 0.06327, 0.1096, 0.1655, 0.2257499, 0.2904, 0.3597, 0.4334499, 0.5120501, 0.5945, 0.6784, 0.7621, 0.8425, 0.9163, 0.9786, 1.0263, 1.0567, 1.0622, 1.0456, 1.0026, 0.9384, 0.8544499, 0.7514, 0.6424, 0.5419, 0.4479, 0.3608, 0.2835, 0.2187, 0.1649, 0.1212, 0.0874, 0.0636, 0.04677, 0.0329, 0.0227, 0.01584, 0.01135916, 0.008110916, 0.005790346, 0.004109457, 0.002899327, 0.00204919, 0.001439971, 0.0009999493, 0.0006900786, 0.0004760213, 0.0003323011, 0.0002348261, 0.0001661505, 0.000117413, 0.00008307527, 0.00005870652, 0.00004150994, 0.00002935326, 0.00002067383, 0.00001455977, 0.00001025398, 0.000007221456, 0.000005085868, 0.000003581652, 0.000002522525, 0.000001776509, 0.000001251141];
      var CIE1931StdObs_y = [0.000003917, 0.000006965, 0.00001239, 0.00002202, 0.000039, 0.000064, 0.00012, 0.000217, 0.000396, 0.00064, 0.00121, 0.00218, 0.004, 0.0073, 0.0116, 0.01684, 0.023, 0.0298, 0.038, 0.048, 0.06, 0.0739, 0.09098, 0.1126, 0.13902, 0.1693, 0.20802, 0.2586, 0.323, 0.4073, 0.503, 0.6082, 0.71, 0.7932, 0.862, 0.9148501, 0.954, 0.9803, 0.9949501, 1, 0.995, 0.9786, 0.952, 0.9154, 0.87, 0.8163, 0.757, 0.6949, 0.631, 0.5668, 0.503, 0.4412, 0.381, 0.321, 0.265, 0.217, 0.175, 0.1382, 0.107, 0.0816, 0.061, 0.04458, 0.032, 0.0232, 0.017, 0.01192, 0.00821, 0.005723, 0.004102, 0.002929, 0.002091, 0.001484, 0.001047, 0.00074, 0.00052, 0.0003611, 0.0002492, 0.0001719, 0.00012, 0.0000848, 0.00006, 0.0000424, 0.00003, 0.0000212, 0.00001499, 0.0000106, 0.0000074657, 0.0000052578, 0.0000037029, 0.0000026078, 0.0000018366, 0.0000012934, 9.1093e-7, 6.4153e-7, 4.5181e-7];
      var CIE1931StdObs_z = [0.0006061, 0.001086, 0.001946, 0.003486, 0.006450001, 0.01054999, 0.02005001, 0.03621, 0.06785001, 0.1102, 0.2074, 0.3713, 0.6456, 1.0390501, 1.3856, 1.62296, 1.74706, 1.7826, 1.77211, 1.7441, 1.6692, 1.5281, 1.28764, 1.0419, 0.8129501, 0.6162, 0.46518, 0.3533, 0.272, 0.2123, 0.1582, 0.1117, 0.07824999, 0.05725001, 0.04216, 0.02984, 0.0203, 0.0134, 0.008749999, 0.005749999, 0.0039, 0.002749999, 0.0021, 0.0018, 0.001650001, 0.0014, 0.0011, 0.001, 0.0008, 0.0006, 0.00034, 0.00024, 0.00019, 0.0001, 0.00004999999, 0.00003, 0.00002, 0.00001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      var x1 = CIE1931StdObs_x[i1] / (CIE1931StdObs_x[i1] + CIE1931StdObs_y[i1] + CIE1931StdObs_z[i1]);
      var y1 = CIE1931StdObs_y[i1] / (CIE1931StdObs_x[i1] + CIE1931StdObs_y[i1] + CIE1931StdObs_z[i1]);
      var x2 = CIE1931StdObs_x[i2] / (CIE1931StdObs_x[i2] + CIE1931StdObs_y[i2] + CIE1931StdObs_z[i2]);
      var y2 = CIE1931StdObs_y[i2] / (CIE1931StdObs_x[i2] + CIE1931StdObs_y[i2] + CIE1931StdObs_z[i2]);
      var c = x1 - xr;
      var d = y1 - yr;
      var e = x2 - x1;
      var f = y2 - y1;
      var s = (a * d - b * c) / (b * e - a * f);
      if (s < 0 || s >= 1) {
        continue;
      }
      var t3 = Math.abs(a) >= Math.abs(b) ? (e * s + c) / a : (f * s + d) / b;
      tArray[count] = t3;
      cArray[count] = nm;
      wArray[count] = (nm2 - nm) * s + nm;
      count += 1;
    }
    if (cArray[1] == 830 && tArray[1] > 0) {
      dominantWavelength = -wArray[0];
    } else {
      dominantWavelength = tArray[0] >= 0 ? wArray[0] : wArray[1];
    }
    return dominantWavelength;
  };
  ColorRNA.prototype._XYZ_to_Luv = function () {
    var Luv = [0, 0, 0];
    var kE = 216 / 24389;
    var kK = 24389 / 27;
    var kKE = 8;
    this._adt_setRefWhite("D65");
    var Den = this._xyz.X + this._xyz.Y * 15 + this._xyz.Z * 3;
    var up = Den > 0 ? this._xyz.X * 4 / (this._xyz.X + this._xyz.Y * 15 + this._xyz.Z * 3) : 0;
    var vp = Den > 0 ? this._xyz.Y * 9 / (this._xyz.X + this._xyz.Y * 15 + this._xyz.Z * 3) : 0;
    var urp = this._adt_refWhite.X * 4 / (this._adt_refWhite.X + this._adt_refWhite.Y * 15 + this._adt_refWhite.Z * 3);
    var vrp = this._adt_refWhite.Y * 9 / (this._adt_refWhite.X + this._adt_refWhite.Y * 15 + this._adt_refWhite.Z * 3);
    var yr = this._xyz.Y / this._adt_refWhite.Y;
    Luv[0] = yr > kE ? Math.pow(yr, 1 / 3) * 116 - 16 : kK * yr;
    Luv[1] = Luv[0] * 13 * (up - urp);
    Luv[2] = Luv[0] * 13 * (vp - vrp);
    return Luv;
  };
  ColorRNA.prototype._Luv_to_XYZ = function (Luv) {
    var kK = 24389 / 27;
    var kKE = 8;
    var XYZ = {
      X: 0,
      Y: 0,
      Z: 0
    };
    this._adt_setRefWhite("D65");
    XYZ.Y = Luv[0] > kKE ? Math.pow((Luv[0] + 16) / 116, 3) : Luv[0] / kK;
    var u0 = this._adt_refWhite.X * 4 / (this._adt_refWhite.X + this._adt_refWhite.Y * 15 + this._adt_refWhite.Z * 3);
    var v0 = this._adt_refWhite.Y * 9 / (this._adt_refWhite.X + this._adt_refWhite.Y * 15 + this._adt_refWhite.Z * 3);
    var a = (Luv[0] * 52 / (Luv[1] + Luv[0] * 13 * u0) - 1) / 3;
    var b = XYZ.Y * -5;
    var c = -1 / 3;
    var d = XYZ.Y * (Luv[0] * 39 / (Luv[2] + Luv[0] * 13 * v0) - 5);
    XYZ.X = (d - b) / (a - c);
    XYZ.Z = XYZ.X * a + b;
    this._xyz.X = XYZ.X;
    this._xyz.Y = XYZ.Y;
    this._xyz.Z = XYZ.Z;
  };
  ColorRNA.prototype._hex_to_rgb = function (hex) {
    var r;
    var g;
    var b;
    if (hex.length == 3) {
      r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
    } else if (hex.length == 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return [r, g, b];
  };
  ColorRNA.prototype._rgb_to_hex = function (rgb) {
    var hex = rgb[0] * 65536 + rgb[1] * 256 + rgb[2];
    hex = hex.toString(16).toUpperCase();
    while (hex.length < 6) {
      hex = "0" + hex;
    }
    return hex.toString(16).toUpperCase();
  };
  ColorRNA.prototype._normaInputRGB = function (inArray) {
    var modeFloat = false;
    var z = 0;
    var flTest = "";
    if (inArray.length == 3) {
      if (inArray[1] > 1 && inArray[1] > 1 && inArray[1] > 1) {
        return inArray;
      }
      for (z = 0; z < inArray.length; z++) {
        if (String(inArray[z]).indexOf(".") > -1) {
          modeFloat = true;
        }
      }
      if (modeFloat == true) {
        for (z = 0; z < inArray.length; z++) {
          inArray[z] = this._normaliz(inArray[z], 0, 1, 255);
        }
      }
    }
    return inArray;
  };
  ColorRNA.prototype._normaOutRGB = function (inArray) {
    var z = 0;
    for (z = 0; z < inArray.length; z++) {
      inArray[z] = Math.round(inArray[z]);
      if (inArray[z] < 0 || inArray[z] == -0) {
        inArray[z] = 0;
      }
    }
    return inArray;
  };
  ColorRNA.prototype._normaOutLab = function (inArray, PSMod) {
    var z = 0;
    for (z = 0; z < inArray.length; z++) {
      if (PSMod) {
        inArray[z] = Math.round(inArray[z]);
      } else {
        inArray[z] = +inArray[z].toFixed(4);
      }
    }
    return inArray;
  };
  ColorRNA.prototype._normaOutX = function (inArray, X) {
    var z = 0;
    for (z = 0; z < inArray.length; z++) {
      inArray[z] = +inArray[z].toFixed(X);
    }
    return inArray;
  };
  ColorRNA.prototype._normaInputXYZ = function (inArray) {
    var z = 0;
    if (inArray[0] > 1 || inArray[1] > 1 || inArray[2] > 1) {
      for (z = 0; z < inArray.length; z++) {
        inArray[z] = inArray[z] / 100;
      }
    }
    return inArray;
  };
  ColorRNA.prototype.setRefWhite = function (inRefWhiteName) {
    if (arguments.length == 0) {
      this._refWhiteNameUSER = "";
    } else {
      this._refWhiteNameUSER = inRefWhiteName;
    }
    return this;
  };
  ColorRNA.prototype.getRefWhite = function () {
    if (this._refWhiteNameUSER.length > 0) {
      return this._refWhiteNameUSER;
    }
    return this._refWhiteName;
  };
  ColorRNA.prototype.rgb = function () {
    return this._rgbX(arguments, this._COLORSPACES.sRGB);
  };
  ColorRNA.prototype._rgbX = function (argus, colorSpace) {
    var rgb = [0, 0, 0];
    this._colorSpace = colorSpace;
    if (argus.length == 0) {
      rgb = this._XYZ_to_RGB();
      return this._normaOutRGB(rgb);
    }
    if (argus.length == 1) {
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          rgb = argus[0];
        }
      } else if (argus[0].slice(0, 1) == "#") {
        rgb = this._hex_to_rgb(argus[0].slice(1, argus[0].length));
      }
    }
    if (argus.length == 3) {
      rgb[0] = argus[0];
      rgb[1] = argus[1];
      rgb[2] = argus[2];
    }
    this._normaInputRGB(rgb);
    this.r = rgb[0];
    this.g = rgb[1];
    this.b = rgb[2];
    this._RGB_to_XYZ();
    return this;
  };
  ColorRNA.prototype._LabX = function (argus, PhotoShopMod) {
    var Lab = [0, 0, 0];
    if (argus.length == 0) {
      Lab = this._XYZ_to_Lab(PhotoShopMod);
      this._normaOutLab(Lab, PhotoShopMod);
      return Lab;
    }
    if (argus.length == 1) {
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          Lab = argus[0];
        }
      }
    }
    if (argus.length == 3) {
      Lab[0] = argus[0];
      Lab[1] = argus[1];
      Lab[2] = argus[2];
    }
    this._Lab_to_XYZ(Lab, PhotoShopMod);
    return this;
  };
  ColorRNA.prototype._xyYX = function (argus) {
    var xyY = [0, 0, 0];
    if (argus.length == 0) {
      xyY = this._XYZ_to_xyY();
      this._normaOutX(xyY, 4);
      return xyY;
    }
    if (argus.length == 1) {
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          xyY = argus[0];
        }
      }
    }
    if (argus.length == 3) {
      xyY[0] = argus[0];
      xyY[1] = argus[1];
      xyY[2] = argus[2];
    }
    this._xyY_to_XYZ(xyY);
    return this;
  };
  ColorRNA.prototype._LCHabX = function (argus) {
    var LCH = [0, 0, 0];
    if (argus.length == 0) {
      LCH = this._XYZ_to_LCHab();
      this._normaOutX(LCH, 4);
      return LCH;
    }
    if (argus.length == 1) {
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          LCH = argus[0];
        }
      }
    }
    if (argus.length == 3) {
      LCH[0] = argus[0];
      LCH[1] = argus[1];
      LCH[2] = argus[2];
    }
    this._LCHab_to_XYZ(LCH);
    return this;
  };
  ColorRNA.prototype._LuvX = function (argus) {
    var Luv = [0, 0, 0];
    if (argus.length == 0) {
      Luv = this._XYZ_to_Luv();
      this._normaOutX(Luv, 4);
      return Luv;
    }
    if (argus.length == 1) {
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          Luv = argus[0];
        }
      }
    }
    if (argus.length == 3) {
      Luv[0] = argus[0];
      Luv[1] = argus[1];
      Luv[2] = argus[2];
    }
    this._Luv_to_XYZ(Luv);
    return this;
  };
  ColorRNA.prototype._baseRGB_XXXx = function (argus, mode) {
    var XXX = [0, 0, 0];
    if (argus.length == 0 || typeof argus[0] == "string") {
      if (typeof argus[0] == "string") {
        this._colorSpace = argus[0];
      }
      var rgb = this._XYZ_to_RGB();
      if (mode == "HSL") {
        return this._RGB_to_HSL(rgb);
      } else if (mode == "HSL255") {
        return this._RGB_to_HSL_255(rgb);
      } else if (mode == "HSLwin") {
        return this._RGB_to_HSL_win239(rgb);
      } else if (mode == "HSV" || mode == "HSB") {
        return this._RGB_to_HSV(rgb);
      } else if (mode == "HWB") {
        return this._RGB_to_HWB(rgb);
      } else if (mode == "YUV") {
        return this._RGB_to_YUV(rgb);
      } else if (mode == "YCbCr") {
        return this._RGB_to_YCbCr(rgb);
      } else if (mode == "JpegYCbCr") {
        return this._RGB_to_JpegYCbCr(rgb);
      } else if (mode == "YIQ") {
        return this._RGB_to_YIQ(rgb);
      } else if (mode == "YPbPr") {
        return this._RGB_to_YPbPr(rgb);
      } else if (mode == "CMY") {
        return this._RGB_to_CMY(rgb);
      } else if (mode == "CMYK") {
        return this._RGB_to_CMYK(rgb);
      }
    }
    if (argus.length == 1 || argus.length == 2) {
      this._colorSpace = "sRGB";
      if (typeof argus[1] == "string") {
        this._colorSpace = argus[3];
      }
      if (Array.isArray(argus[0])) {
        if (argus[0].length == 3) {
          XXX = argus[0];
        }
      }
    }
    if (argus.length >= 3 || typeof argus[3] == "string") {
      this._colorSpace = "sRGB";
      if (typeof argus[3] == "string") {
        this._colorSpace = argus[3];
      }
      XXX[0] = argus[0];
      XXX[1] = argus[1];
      XXX[2] = argus[2];
      if (typeof argus[3] == "number") {
        XXX[3] = argus[3];
      }
    }
    var rgb2 = [0, 0, 0];
    if (mode == "HSL") {
      rgb2 = this._HSL_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "HSL255") {
      rgb2 = this._HSL_to_RGB_255([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "HSLwin") {
      rgb2 = this._HSL_to_RGB_win240([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "HSV" || mode == "HSB") {
      rgb2 = this._HSV_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "HWB") {
      rgb2 = this._HWB_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "CMY") {
      rgb2 = this._CMY_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "YUV") {
      rgb2 = this._YUV_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "YCbCr") {
      rgb2 = this._YCbCr_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "JpegYCbCr") {
      rgb2 = this._JpegYCbCr_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "YIQ") {
      rgb2 = this._YIQ_to_RGB([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "YPbPr") {
      rgb2 = this._YPbPr_to_RGB_([XXX[0], XXX[1], XXX[2]]);
    } else if (mode == "CMYK") {
      rgb2 = this._CMYK_to_RGB([XXX[0], XXX[1], XXX[2], XXX[3]]);
    }
    this.r = rgb2[0];
    this.g = rgb2[1];
    this.b = rgb2[2];
    this._RGB_to_XYZ();
    return this;
  };
  ColorRNA.prototype.Luv = function () {
    return this._LuvX(arguments);
  };
  ColorRNA.prototype.xyY = function () {
    return this._xyYX(arguments);
  };
  ColorRNA.prototype.LabPS = function () {
    return this._LabX(arguments, true);
  };
  ColorRNA.prototype.Lab = function () {
    return this._LabX(arguments, false);
  };
  ColorRNA.prototype.LCHab = function () {
    return this._LCHabX(arguments, false);
  };
  ColorRNA.prototype.HSL = function () {
    return this._baseRGB_XXXx(arguments, "HSL");
  };
  ColorRNA.prototype.HSL255 = function () {
    return this._baseRGB_XXXx(arguments, "HSL255");
  };
  ColorRNA.prototype.HSL240 = function () {
    return this._baseRGB_XXXx(arguments, "HSLwin");
  };
  ColorRNA.prototype.HSV = function () {
    return this._baseRGB_XXXx(arguments, "HSV");
  };
  ColorRNA.prototype.HSB = function () {
    return this._baseRGB_XXXx(arguments, "HSV");
  };
  ColorRNA.prototype.HWB = function () {
    return this._baseRGB_XXXx(arguments, "HWB");
  };
  ColorRNA.prototype.YPbPr = function () {
    return this._baseRGB_XXXx(arguments, "YPbPr");
  };
  ColorRNA.prototype.YIQ = function () {
    return this._baseRGB_XXXx(arguments, "YIQ");
  };
  ColorRNA.prototype.JpegYCbCr = function () {
    return this._baseRGB_XXXx(arguments, "JpegYCbCr");
  };
  ColorRNA.prototype.YCbCr = function () {
    return this._baseRGB_XXXx(arguments, "YCbCr");
  };
  ColorRNA.prototype.YUV = function () {
    return this._baseRGB_XXXx(arguments, "YUV");
  };
  ColorRNA.prototype.CMYK = function () {
    return this._baseRGB_XXXx(arguments, "CMYK");
  };
  ColorRNA.prototype.CMY = function () {
    return this._baseRGB_XXXx(arguments, "CMY");
  };
  ColorRNA.prototype.sRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.sRGB);
  };
  ColorRNA.prototype.AdobeRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.AdobeRGB);
  };
  ColorRNA.prototype.AppleRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.AppleRGB);
  };
  ColorRNA.prototype.BestRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.BestRGB);
  };
  ColorRNA.prototype.BetaRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.BetaRGB);
  };
  ColorRNA.prototype.BruceRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.BruceRGB);
  };
  ColorRNA.prototype.CIERGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.CIERGB);
  };
  ColorRNA.prototype.ColorMatchRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.ColorMatchRGB);
  };
  ColorRNA.prototype.DonRGB4 = function () {
    return this._rgbX(arguments, this._COLORSPACES.DonRGB4);
  };
  ColorRNA.prototype.ECIRGBv2 = function () {
    return this._rgbX(arguments, this._COLORSPACES.ECIRGBv2);
  };
  ColorRNA.prototype.EktaSpacePS5 = function () {
    return this._rgbX(arguments, this._COLORSPACES.EktaSpacePS5);
  };
  ColorRNA.prototype.NTSCRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.NTSCRGB);
  };
  ColorRNA.prototype.PALSECAMRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.PALSECAMRGB);
  };
  ColorRNA.prototype.ProPhotoRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.ProPhotoRGB);
  };
  ColorRNA.prototype.SMPTECRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.SMPTECRGB);
  };
  ColorRNA.prototype.WideGamutRGB = function () {
    return this._rgbX(arguments, this._COLORSPACES.WideGamutRGB);
  };
  ColorRNA.prototype.getWavelength = function (alg) {
    return +this._xyY_to_Wavelength(this.xyY()).toFixed(4);
  };
  ColorRNA.prototype.getLuma = function (alg) {
    var luma = 0;
    var rgb = this._XYZ_to_RGB();
    this._normalizArray(rgb, 0, 255, 1);
    if (alg == "601") {
      luma = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114;
    } else if (alg == "HSP") {
      luma = Math.sqrt(Math.pow(rgb[0], 2) * 0.241 + Math.pow(rgb[1], 2) * 0.691 + Math.pow(rgb[2], 2) * 0.068);
    } else {
      luma = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    }
    return luma;
  };
  ColorRNA.prototype.getWCAGluma = function () {
    var rgb = this._XYZ_to_RGB();
    var luma = [];
    for (var i = 0; i < rgb.length; i++) {
      var chan = rgb[i] / 255;
      luma[i] = chan <= 0.03928 ? chan / 12.92 : Math.pow((chan + 0.055) / 1.055, 2.4);
    }
    return luma[0] * 0.2126 + luma[1] * 0.7152 + luma[2] * 0.0722;
  };
  ColorRNA.prototype.getWCAGcontrastThan = function (inColor) {
    var luma1 = this.getWCAGluma();
    var luma2 = inColor.getWCAGluma();
    if (luma1 > luma2) {
      return (luma1 + 0.05) / (luma2 + 0.05);
    }
    ;
    return (luma2 + 0.05) / (luma1 + 0.05);
  };
  ColorRNA.prototype.getHex = function () {
    var rgb = this._XYZ_to_RGB();
    var hex = this._rgb_to_hex([rgb[0], rgb[1], rgb[2]]);
    return "#" + hex;
  };
  ColorRNA.prototype.XYZ = function () {
    var xyz = [0, 0, 0];
    if (arguments.length == 0) {
      xyz = [this._xyz.X, this._xyz.Y, this._xyz.Z];
      return xyz;
    }
    if (arguments.length == 1) {
      if (Array.isArray(arguments[0])) {
        if (arguments[0].length == 3) {
          xyz = arguments[0];
        }
      }
    }
    if (arguments.length == 3) {
      xyz[0] = arguments[0];
      xyz[1] = arguments[1];
      xyz[2] = arguments[2];
    }
    this._normaInputXYZ(xyz);
    this._xyz.X = xyz[0];
    this._xyz.Y = xyz[1];
    this._xyz.Z = xyz[2];
    return this;
  };
  ColorRNA.prototype.colorDiff = function (color1, color2, alg) {
    var ca1 = color1.Lab();
    var Lab1 = {
      L: ca1[0],
      a: ca1[1],
      b: ca1[2]
    };
    var ca2 = color2.Lab();
    var Lab2 = {
      L: ca2[0],
      a: ca2[1],
      b: ca2[2]
    };
    var deltaE = 0;
    if (alg == "DeltaE1976") {
      var delL = Lab1.L - Lab2.L;
      var dela = Lab1.a - Lab2.a;
      var delb = Lab1.b - Lab2.b;
      deltaE = Math.sqrt(delL * delL + dela * dela + delb * delb);
    }
    if (alg == "DeltaE1994_T" || alg == "DeltaE1994_G") {
      var k1 = alg == "DeltaE1994_T" ? 0.048 : 0.045;
      var k2 = alg == "DeltaE1994_T" ? 0.014 : 0.015;
      var kL = alg == "DeltaE1994_T" ? 2 : 1;
      var kC = 1;
      var kH = 1;
      var C1 = Math.sqrt(Lab1.a * Lab1.a + Lab1.b * Lab1.b);
      var C2 = Math.sqrt(Lab2.a * Lab2.a + Lab2.b * Lab2.b);
      var delA = Lab1.a - Lab2.a;
      var delB = Lab1.b - Lab2.b;
      var delC = C1 - C2;
      var delH2 = delA * delA + delB * delB - delC * delC;
      var delH = delH2 > 0 ? Math.sqrt(delH2) : 0;
      var delL = Lab1.L - Lab2.L;
      var sL = 1;
      var sC = 1 + k1 * C1;
      var sH = 1 + k2 * C1;
      var vL = delL / (kL * sL);
      var vC = delC / (kC * sC);
      var vH = delH / (kH * sH);
      if (alg == "DeltaE1994_T") {
        deltaE = Math.sqrt(vL * vL + vC * vC + vH * vH);
      } else {
        deltaE = Math.sqrt(vL * vL + vC * vC + vH * vH);
      }
    }
    if (alg == "DeltaE2000") {
      var kL = 1;
      var kC = 1;
      var kH = 1;
      var lBarPrime = (Lab1.L + Lab2.L) * 0.5;
      var c1 = Math.sqrt(Lab1.a * Lab1.a + Lab1.b * Lab1.b);
      var c2 = Math.sqrt(Lab2.a * Lab2.a + Lab2.b * Lab2.b);
      var cBar = (c1 + c2) * 0.5;
      var cBar7 = cBar * cBar * cBar * cBar * cBar * cBar * cBar;
      var g = (1 - Math.sqrt(cBar7 / (cBar7 + 6103515625))) * 0.5;
      var a1Prime = Lab1.a * (1 + g);
      var a2Prime = Lab2.a * (1 + g);
      var c1Prime = Math.sqrt(a1Prime * a1Prime + Lab1.b * Lab1.b);
      var c2Prime = Math.sqrt(a2Prime * a2Prime + Lab2.b * Lab2.b);
      var cBarPrime = (c1Prime + c2Prime) * 0.5;
      var h1Prime = Math.atan2(Lab1.b, a1Prime) * 180 / Math.PI;
      if (h1Prime < 0) {
        h1Prime += 360;
      }
      var h2Prime = Math.atan2(Lab2.b, a2Prime) * 180 / Math.PI;
      if (h2Prime < 0) {
        h2Prime += 360;
      }
      var hBarPrime = Math.abs(h1Prime - h2Prime) > 180 ? (h1Prime + h2Prime + 360) * 0.5 : (h1Prime + h2Prime) * 0.5;
      var t3 = 1 - Math.cos(Math.PI * (hBarPrime - 30) / 180) * 0.17 + Math.cos(Math.PI * (hBarPrime * 2) / 180) * 0.24 + Math.cos(Math.PI * (hBarPrime * 3 + 6) / 180) * 0.32 - Math.cos(Math.PI * (hBarPrime * 4 - 63) / 180) * 0.2;
      if (Math.abs(h2Prime - h1Prime) <= 180) {
        var dhPrime = h2Prime - h1Prime;
      } else {
        var dhPrime = h2Prime <= h1Prime ? h2Prime - h1Prime + 360 : h2Prime - h1Prime - 360;
      }
      var dLPrime = Lab2.L - Lab1.L;
      var dCPrime = c2Prime - c1Prime;
      var dHPrime = Math.sqrt(c1Prime * c2Prime) * 2 * Math.sin(Math.PI * (dhPrime * 0.5) / 180);
      var sL = 1 + (lBarPrime - 50) * 0.015 * (lBarPrime - 50) / Math.sqrt(20 + (lBarPrime - 50) * (lBarPrime - 50));
      var sC = 1 + cBarPrime * 0.045;
      var sH = 1 + cBarPrime * 0.015 * t3;
      var dTheta = Math.exp(-((hBarPrime - 275) / 25) * ((hBarPrime - 275) / 25)) * 30;
      var cBarPrime7 = cBarPrime * cBarPrime * cBarPrime * cBarPrime * cBarPrime * cBarPrime * cBarPrime;
      var rC = Math.sqrt(cBarPrime7 / (cBarPrime7 + 6103515625));
      var rT = rC * -2 * Math.sin(Math.PI * (dTheta * 2) / 180);
      deltaE = Math.sqrt(dLPrime / (kL * sL) * (dLPrime / (kL * sL)) + dCPrime / (kC * sC) * (dCPrime / (kC * sC)) + dHPrime / (kH * sH) * (dHPrime / (kH * sH)) + dCPrime / (kC * sC) * (dHPrime / (kH * sH)) * rT);
    }
    if (alg == "DeltaECMC_11" || alg == "DeltaECMC_21") {
      if (alg == "DeltaECMC_11") {
        var L = 1;
        var C = 1;
      } else if (alg == "DeltaECMC_21") {
        var L = 2;
        var C = 1;
      }
      var c1 = Math.sqrt(Lab1.a * Lab1.a + Lab1.b * Lab1.b);
      var c2 = Math.sqrt(Lab2.a * Lab2.a + Lab2.b * Lab2.b);
      var sl = Lab1.L < 16 ? 0.511 : Lab1.L * 0.040975 / (1 + Lab1.L * 0.01765);
      var sc = c1 * 0.0638 / (1 + c1 * 0.0131) + 0.638;
      var h1 = c1 < 0.000001 ? 0 : Math.atan2(Lab1.b, Lab1.a) * 180 / Math.PI;
      while (h1 < 0) {
        h1 += 360;
      }
      while (h1 >= 360) {
        h1 -= 360;
      }
      var t3 = h1 >= 164 && h1 <= 345 ? 0.56 + Math.abs(Math.cos(Math.PI * (h1 + 168) / 180) * 0.2) : 0.36 + Math.abs(Math.cos(Math.PI * (h1 + 35) / 180) * 0.4);
      var c4 = c1 * c1 * c1 * c1;
      var f = Math.sqrt(c4 / (c4 + 1900));
      var sh = sc * (f * t3 + 1 - f);
      var delL = Lab1.L - Lab2.L;
      var delC = c1 - c2;
      var delA = Lab1.a - Lab2.a;
      var delB = Lab1.b - Lab2.b;
      var dH2 = delA * delA + delB * delB - delC * delC;
      var v1 = delL / (L * sl);
      var v2 = delC / (C * sc);
      var v3 = sh;
      if (L == 2) {
        deltaE = Math.sqrt(v1 * v1 + v2 * v2 + dH2 / (v3 * v3));
      } else {
        deltaE = Math.sqrt(v1 * v1 + v2 * v2 + dH2 / (v3 * v3));
      }
    }
    return +deltaE.toFixed(2);
  };
  ColorRNA.prototype.diff_ECMC11_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaECMC_11");
  };
  ColorRNA.prototype.diff_ECMC21_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaECMC_21");
  };
  ColorRNA.prototype.diff_DE2000_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaE2000");
  };
  ColorRNA.prototype.diff_DE1976_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaE1976");
  };
  ColorRNA.prototype.diff_DE1994_GraphicArts_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaE1994_G");
  };
  ColorRNA.prototype.diff_DE1994_Textiles_Than = function (color2) {
    return this.colorDiff(this, color2, "DeltaE1994_T");
  };
  var ColorRNA_default = ColorRNA;


  // node_modules/lucide/dist/esm/icons/app-window.mjs
  var AppWindow = [["rect", {
    x: "2",
    y: "4",
    width: "20",
    height: "16",
    rx: "2"
  }], ["path", {
    d: "M10 4v4"
  }], ["path", {
    d: "M2 8h20"
  }], ["path", {
    d: "M6 4v4"
  }]];


  // node_modules/lucide/dist/esm/icons/book-open.mjs
  var BookOpen = [["path", {
    d: "M12 7v14"
  }], ["path", {
    d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
  }]];


  // node_modules/lucide/dist/esm/icons/compass.mjs
  var Compass = [["circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }], ["path", {
    d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"
  }]];


  // node_modules/lucide/dist/esm/icons/database.mjs
  var Database = [["ellipse", {
    cx: "12",
    cy: "5",
    rx: "9",
    ry: "3"
  }], ["path", {
    d: "M3 5V19A9 3 0 0 0 21 19V5"
  }], ["path", {
    d: "M3 12A9 3 0 0 0 21 12"
  }]];


  // node_modules/lucide/dist/esm/icons/eye.mjs
  var Eye = [["path", {
    d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
  }], ["circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }]];


  // node_modules/lucide/dist/esm/icons/folder-plus.mjs
  var FolderPlus = [["path", {
    d: "M12 10v6"
  }], ["path", {
    d: "M9 13h6"
  }], ["path", {
    d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
  }]];


  // node_modules/lucide/dist/esm/icons/highlighter.mjs
  var Highlighter = [["path", {
    d: "m9 11-6 6v3h9l3-3"
  }], ["path", {
    d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"
  }]];


  // node_modules/lucide/dist/esm/icons/layers.mjs
  var Layers = [["path", {
    d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
  }], ["path", {
    d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
  }], ["path", {
    d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
  }]];


  // node_modules/lucide/dist/esm/icons/link-2.mjs
  var Link2 = [["path", {
    d: "M9 17H7A5 5 0 0 1 7 7h2"
  }], ["path", {
    d: "M15 7h2a5 5 0 1 1 0 10h-2"
  }], ["line", {
    x1: "8",
    x2: "16",
    y1: "12",
    y2: "12"
  }]];


  // node_modules/lucide/dist/esm/icons/menu.mjs
  var Menu = [["path", {
    d: "M4 5h16"
  }], ["path", {
    d: "M4 12h16"
  }], ["path", {
    d: "M4 19h16"
  }]];


  // node_modules/lucide/dist/esm/icons/notebook-pen.mjs
  var NotebookPen = [["path", {
    d: "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"
  }], ["path", {
    d: "M2 6h4"
  }], ["path", {
    d: "M2 10h4"
  }], ["path", {
    d: "M2 14h4"
  }], ["path", {
    d: "M2 18h4"
  }], ["path", {
    d: "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"
  }]];


  // node_modules/lucide/dist/esm/icons/panel-left.mjs
  var PanelLeft = [["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }], ["path", {
    d: "M9 3v18"
  }]];


  // node_modules/lucide/dist/esm/icons/quote.mjs
  var Quote = [["path", {
    d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
  }], ["path", {
    d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"
  }]];


  // node_modules/lucide/dist/esm/icons/settings-2.mjs
  var Settings2 = [["path", {
    d: "M14 17H5"
  }], ["path", {
    d: "M19 7h-9"
  }], ["circle", {
    cx: "17",
    cy: "17",
    r: "3"
  }], ["circle", {
    cx: "7",
    cy: "7",
    r: "3"
  }]];


  // node_modules/lucide/dist/esm/icons/table-properties.mjs
  var TableProperties = [["path", {
    d: "M15 3v18"
  }], ["rect", {
    width: "18",
    height: "18",
    x: "3",
    y: "3",
    rx: "2"
  }], ["path", {
    d: "M21 9H3"
  }], ["path", {
    d: "M21 15H3"
  }]];


  // node_modules/lucide/dist/esm/icons/tags.mjs
  var Tags2 = [["path", {
    d: "M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"
  }], ["path", {
    d: "M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"
  }], ["circle", {
    cx: "10.5",
    cy: "6.5",
    r: ".5",
    fill: "currentColor"
  }]];


export { BasicTool, ColorRNA_default, ZoteroToolkit, __toESM, require_dayjs_min, require_it, require_relativeTime, require_ru, require_runes, require_utc, require_zh_cn, require_zh_tw };
