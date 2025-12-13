/* Minimal QR code generator (based on qrcode-generator by Kazuhiko Arase, MIT) */
/* eslint-disable @typescript-eslint/no-explicit-any */

type QRErrorCorrectLevelKey = "L" | "M" | "Q" | "H";

const QRPolynomial = function (num: number[], shift: number) {
  let offset = 0;
  while (offset < num.length && num[offset] === 0) offset++;
  this.num = new Array(num.length - offset + shift);
  for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
};
 
QRPolynomial.prototype = {
  get: function (index: number) {
    return this.num[index];
  },
  getLength: function () {
    return this.num.length;
  },
  multiply: function (e: any) {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new (QRPolynomial as any)(num, 0);
  },
  mod: function (e: any) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = this.num.slice();
    for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    return new (QRPolynomial as any)(num, 0).mod(e);
  },
};

const QRMath = {
  glog: function (n: number) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return LOG_TABLE[n];
  },
  gexp: function (n: number) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP_TABLE[n];
  },
};

const EXP_TABLE = new Array(256).fill(0);
const LOG_TABLE = new Array(256).fill(0);
for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;

const QRRSBlocks = {
  getRSBlocks: function (typeNumber: number, errorCorrectLevel: number) {
    // RS_BLOCK_TABLE stores triplets (count, totalCount, dataCount) sequentially
    // Each version has 4 entries (L/M/Q/H), each entry has 3 values
    const baseIndex = ((typeNumber - 1) * 4 + errorCorrectLevel) * 3;
    const count = RS_BLOCK_TABLE[baseIndex];
    const totalCount = RS_BLOCK_TABLE[baseIndex + 1];
    const dataCount = RS_BLOCK_TABLE[baseIndex + 2];
    const list: number[][] = [];
    for (let j = 0; j < count; j++) list.push([totalCount, dataCount]);
    return list;
  },
};

const QRBitBuffer = function () {
  this.buffer = [];
  this.length = 0;
};
QRBitBuffer.prototype = {
  get: function (index: number) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  },
  put: function (num: number, length: number) {
    for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
  },
  putBit: function (bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  },
};

function QR8bitByte(data: string) {
  this.data = data;
}
QR8bitByte.prototype = {
  getLength: function () {
    return this.data.length;
  },
  write: function (buffer: any) {
    for (let i = 0; i < this.data.length; i++) buffer.put(this.data.charCodeAt(i), 8);
  },
};

const QRCodeModel = function (typeNumber: number, errorCorrectLevel: number) {
  this.typeNumber = typeNumber;
  this.errorCorrectLevel = errorCorrectLevel;
  this.modules = null;
  this.moduleCount = 0;
  this.dataCache = null;
  this.dataList = [];
};
QRCodeModel.prototype = {
  addData: function (data: string) {
    this.dataList.push(new (QR8bitByte as any)(data));
    this.dataCache = null;
  },
  isDark: function (row: number, col: number) {
    if (this.modules[row][col] == null) return false;
    return this.modules[row][col];
  },
  getModuleCount: function () {
    return this.moduleCount;
  },
  make: function () {
    this.makeImpl(false, this.getBestMaskPattern());
  },
  makeImpl: function (test: boolean, maskPattern: number) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount);
      for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
    }
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(test);
    if (this.dataCache == null) this.dataCache = (QRCodeModel as any).createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    this.mapData(this.dataCache, maskPattern);
  },
  setupPositionProbePattern: function (row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  },
  getBestMaskPattern: function () {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(this);
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  },
  createMovieClip: function () {
    throw new Error("unused");
  },
  setupTimingPattern: function () {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] != null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] != null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  },
  setupPositionAdjustPattern: function () {
    const pos = QRUtil.getPatternPosition(this.typeNumber);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] != null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  },
  setupTypeNumber: function (test: boolean) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
    }
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  },
  setupTypeInfo: function (test: boolean, maskPattern: number) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  },
  mapData: function (data: number[], maskPattern: number) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            const mask = QRUtil.getMask(maskPattern, row, col - c);
            if (mask) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  },
};

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66],
    [6, 26, 48, 70],
    [6, 26, 50, 74],
    [6, 30, 54, 78],
    [6, 30, 56, 82],
    [6, 30, 58, 86],
    [6, 34, 62, 90],
    [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114],
    [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170],
  ],
  G15: 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0,
  G18: 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0,
  G15_MASK: 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1,
  getBCHTypeInfo: function (data: number) {
    let d = data << 10;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
      d ^= QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15));
    }
    return (data << 10) | d ^ QRUtil.G15_MASK;
  },
  getBCHTypeNumber: function (data: number) {
    let d = data << 12;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18));
    return (data << 12) | d;
  },
  getBCHDigit: function (data: number) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  },
  getPatternPosition: function (typeNumber: number) {
    return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
  },
  getMask: function (maskPattern: number, i: number, j: number) {
    switch (maskPattern) {
      case 0:
        return (i + j) % 2 === 0;
      case 1:
        return i % 2 === 0;
      case 2:
        return j % 3 === 0;
      case 3:
        return (i + j) % 3 === 0;
      case 4:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5:
        return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6:
        return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7:
        return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
      default:
        throw new Error("bad maskPattern:" + maskPattern);
    }
  },
  getErrorCorrectPolynomial: function (errorCorrectLength: number) {
    let a = new (QRPolynomial as any)([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) a = a.multiply(new (QRPolynomial as any)([1, QRMath.gexp(i)], 0));
    return a;
  },
  getLengthInBits: function (mode: number, type: number) {
    if (1 <= type && type < 10) {
      switch (mode) {
        case 1:
          return 10;
        case 2:
          return 9;
        case 4:
          return 8;
        case 8:
          return 8;
        default:
          throw new Error("mode:" + mode);
      }
    } else if (type < 27) {
      switch (mode) {
        case 1:
          return 12;
        case 2:
          return 11;
        case 4:
          return 16;
        case 8:
          return 10;
        default:
          throw new Error("mode:" + mode);
      }
    } else if (type < 41) {
      switch (mode) {
        case 1:
          return 14;
        case 2:
          return 13;
        case 4:
          return 16;
        case 8:
          return 12;
        default:
          throw new Error("mode:" + mode);
      }
    } else {
      throw new Error("type:" + type);
    }
  },
  getLostPoint: function (qrCode: any) {
    const moduleCount = qrCode.getModuleCount();
    let lostPoint = 0;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        let sameCount = 0;
        const dark = qrCode.isDark(row, col);
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || moduleCount <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || moduleCount <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === qrCode.isDark(row + r, col + c)) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += 3 + sameCount - 5;
      }
    }
    for (let row = 0; row < moduleCount - 1; row++) {
      for (let col = 0; col < moduleCount - 1; col++) {
        let count = 0;
        if (qrCode.isDark(row, col)) count++;
        if (qrCode.isDark(row + 1, col)) count++;
        if (qrCode.isDark(row, col + 1)) count++;
        if (qrCode.isDark(row + 1, col + 1)) count++;
        if (count === 0 || count === 4) lostPoint += 3;
      }
    }
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount - 6; col++) {
        if (
          qrCode.isDark(row, col) &&
          !qrCode.isDark(row, col + 1) &&
          qrCode.isDark(row, col + 2) &&
          qrCode.isDark(row, col + 3) &&
          qrCode.isDark(row, col + 4) &&
          !qrCode.isDark(row, col + 5) &&
          qrCode.isDark(row, col + 6)
        )
          lostPoint += 40;
      }
    }
    for (let col = 0; col < moduleCount; col++) {
      for (let row = 0; row < moduleCount - 6; row++) {
        if (
          qrCode.isDark(row, col) &&
          !qrCode.isDark(row + 1, col) &&
          qrCode.isDark(row + 2, col) &&
          qrCode.isDark(row + 3, col) &&
          qrCode.isDark(row + 4, col) &&
          !qrCode.isDark(row + 5, col) &&
          qrCode.isDark(row + 6, col)
        )
          lostPoint += 40;
      }
    }
    let darkCount = 0;
    for (let col = 0; col < moduleCount; col++) {
      for (let row = 0; row < moduleCount; row++) {
        if (qrCode.isDark(row, col)) darkCount++;
      }
    }
    const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5;
    lostPoint += ratio * 10;
    return lostPoint;
  },
};

// Support versions 1-6 (enough for join URLs up to ~100 bytes)
const RS_BLOCK_TABLE = [
  1, 26, 19, 1, 26, 16, 1, 26, 13, 1, 26, 9, // v1 L/M/Q/H
  1, 44, 34, 1, 44, 28, 1, 44, 22, 1, 44, 16, // v2
  1, 70, 55, 1, 70, 44, 2, 35, 17, 2, 35, 13, // v3
  1, 100, 80, 2, 50, 32, 2, 50, 24, 4, 25, 9, // v4
  1, 134, 108, 2, 67, 43, 2, 33, 15, 2, 33, 11, // v5 (adds ~108 bytes for L)
  2, 86, 68, 4, 43, 27, 4, 43, 19, 4, 43, 15, // v6 (adds more capacity)
];

// Helper to create QR code with automatic typeNumber selection
function createQRCode(text: string, errorCorrectLevel: QRErrorCorrectLevelKey) {
  let typeNumber = 1;
  const errorLevelMap: Record<QRErrorCorrectLevelKey, number> = { L: 1, M: 0, Q: 3, H: 2 };
  for (typeNumber = 1; typeNumber <= 6; typeNumber++) {
    const qr = new (QRCodeModel as any)(typeNumber, errorLevelMap[errorCorrectLevel]);
    qr.addData(text);
    try {
      qr.make();
      return qr;
    } catch {
      continue;
    }
  }
  const qr = new (QRCodeModel as any)(6, errorLevelMap[errorCorrectLevel]);
  qr.addData(text);
  qr.make();
  return qr;
}

export function generateQrSvgData(text: string, size = 256) {
  const qr = createQRCode(text, "L"); // L = low error correction, more capacity
  const count = qr.getModuleCount();
  const cell = size / count;
  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        const x = Math.round(c * cell * 10) / 10;
        const y = Math.round(r * cell * 10) / 10;
        const w = Math.ceil(cell * 10) / 10;
        const h = Math.ceil(cell * 10) / 10;
        path += `M${x} ${y}h${w}v${h}h-${w}z `;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#0f172a"/><path d="${path.trim()}" fill="#e2e8f0"/></svg>`;
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}
