// build/dev/javascript/prelude.mjs
var CustomType = class {
  withFields(fields) {
    let properties = Object.keys(this).map(
      (label2) => label2 in fields ? fields[label2] : this[label2]
    );
    return new this.constructor(...properties);
  }
};
var List = class {
  static fromArray(array3, tail) {
    let t = tail || new Empty();
    for (let i = array3.length - 1; i >= 0; --i) {
      t = new NonEmpty(array3[i], t);
    }
    return t;
  }
  [Symbol.iterator]() {
    return new ListIterator(this);
  }
  toArray() {
    return [...this];
  }
  // @internal
  atLeastLength(desired) {
    let current = this;
    while (desired-- > 0 && current) current = current.tail;
    return current !== void 0;
  }
  // @internal
  hasLength(desired) {
    let current = this;
    while (desired-- > 0 && current) current = current.tail;
    return desired === -1 && current instanceof Empty;
  }
  // @internal
  countLength() {
    let current = this;
    let length5 = 0;
    while (current) {
      current = current.tail;
      length5++;
    }
    return length5 - 1;
  }
};
function prepend(element2, tail) {
  return new NonEmpty(element2, tail);
}
function toList(elements2, tail) {
  return List.fromArray(elements2, tail);
}
var ListIterator = class {
  #current;
  constructor(current) {
    this.#current = current;
  }
  next() {
    if (this.#current instanceof Empty) {
      return { done: true };
    } else {
      let { head, tail } = this.#current;
      this.#current = tail;
      return { value: head, done: false };
    }
  }
};
var Empty = class extends List {
};
var NonEmpty = class extends List {
  constructor(head, tail) {
    super();
    this.head = head;
    this.tail = tail;
  }
};
var BitArray = class {
  /**
   * The size in bits of this bit array's data.
   *
   * @type {number}
   */
  bitSize;
  /**
   * The size in bytes of this bit array's data. If this bit array doesn't store
   * a whole number of bytes then this value is rounded up.
   *
   * @type {number}
   */
  byteSize;
  /**
   * The number of unused high bits in the first byte of this bit array's
   * buffer prior to the start of its data. The value of any unused high bits is
   * undefined.
   *
   * The bit offset will be in the range 0-7.
   *
   * @type {number}
   */
  bitOffset;
  /**
   * The raw bytes that hold this bit array's data.
   *
   * If `bitOffset` is not zero then there are unused high bits in the first
   * byte of this buffer.
   *
   * If `bitOffset + bitSize` is not a multiple of 8 then there are unused low
   * bits in the last byte of this buffer.
   *
   * @type {Uint8Array}
   */
  rawBuffer;
  /**
   * Constructs a new bit array from a `Uint8Array`, an optional size in
   * bits, and an optional bit offset.
   *
   * If no bit size is specified it is taken as `buffer.length * 8`, i.e. all
   * bytes in the buffer make up the new bit array's data.
   *
   * If no bit offset is specified it defaults to zero, i.e. there are no unused
   * high bits in the first byte of the buffer.
   *
   * @param {Uint8Array} buffer
   * @param {number} [bitSize]
   * @param {number} [bitOffset]
   */
  constructor(buffer, bitSize, bitOffset) {
    if (!(buffer instanceof Uint8Array)) {
      throw globalThis.Error(
        "BitArray can only be constructed from a Uint8Array"
      );
    }
    this.bitSize = bitSize ?? buffer.length * 8;
    this.byteSize = Math.trunc((this.bitSize + 7) / 8);
    this.bitOffset = bitOffset ?? 0;
    if (this.bitSize < 0) {
      throw globalThis.Error(`BitArray bit size is invalid: ${this.bitSize}`);
    }
    if (this.bitOffset < 0 || this.bitOffset > 7) {
      throw globalThis.Error(
        `BitArray bit offset is invalid: ${this.bitOffset}`
      );
    }
    if (buffer.length !== Math.trunc((this.bitOffset + this.bitSize + 7) / 8)) {
      throw globalThis.Error("BitArray buffer length is invalid");
    }
    this.rawBuffer = buffer;
  }
  /**
   * Returns a specific byte in this bit array. If the byte index is out of
   * range then `undefined` is returned.
   *
   * When returning the final byte of a bit array with a bit size that's not a
   * multiple of 8, the content of the unused low bits are undefined.
   *
   * @param {number} index
   * @returns {number | undefined}
   */
  byteAt(index5) {
    if (index5 < 0 || index5 >= this.byteSize) {
      return void 0;
    }
    return bitArrayByteAt(this.rawBuffer, this.bitOffset, index5);
  }
  /** @internal */
  equals(other) {
    if (this.bitSize !== other.bitSize) {
      return false;
    }
    const wholeByteCount = Math.trunc(this.bitSize / 8);
    if (this.bitOffset === 0 && other.bitOffset === 0) {
      for (let i = 0; i < wholeByteCount; i++) {
        if (this.rawBuffer[i] !== other.rawBuffer[i]) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (this.rawBuffer[wholeByteCount] >> unusedLowBitCount !== other.rawBuffer[wholeByteCount] >> unusedLowBitCount) {
          return false;
        }
      }
    } else {
      for (let i = 0; i < wholeByteCount; i++) {
        const a2 = bitArrayByteAt(this.rawBuffer, this.bitOffset, i);
        const b = bitArrayByteAt(other.rawBuffer, other.bitOffset, i);
        if (a2 !== b) {
          return false;
        }
      }
      const trailingBitsCount = this.bitSize % 8;
      if (trailingBitsCount) {
        const a2 = bitArrayByteAt(
          this.rawBuffer,
          this.bitOffset,
          wholeByteCount
        );
        const b = bitArrayByteAt(
          other.rawBuffer,
          other.bitOffset,
          wholeByteCount
        );
        const unusedLowBitCount = 8 - trailingBitsCount;
        if (a2 >> unusedLowBitCount !== b >> unusedLowBitCount) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Returns this bit array's internal buffer.
   *
   * @deprecated Use `BitArray.byteAt()` or `BitArray.rawBuffer` instead.
   *
   * @returns {Uint8Array}
   */
  get buffer() {
    bitArrayPrintDeprecationWarning(
      "buffer",
      "Use BitArray.byteAt() or BitArray.rawBuffer instead"
    );
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error(
        "BitArray.buffer does not support unaligned bit arrays"
      );
    }
    return this.rawBuffer;
  }
  /**
   * Returns the length in bytes of this bit array's internal buffer.
   *
   * @deprecated Use `BitArray.bitSize` or `BitArray.byteSize` instead.
   *
   * @returns {number}
   */
  get length() {
    bitArrayPrintDeprecationWarning(
      "length",
      "Use BitArray.bitSize or BitArray.byteSize instead"
    );
    if (this.bitOffset !== 0 || this.bitSize % 8 !== 0) {
      throw new globalThis.Error(
        "BitArray.length does not support unaligned bit arrays"
      );
    }
    return this.rawBuffer.length;
  }
};
function bitArrayByteAt(buffer, bitOffset, index5) {
  if (bitOffset === 0) {
    return buffer[index5] ?? 0;
  } else {
    const a2 = buffer[index5] << bitOffset & 255;
    const b = buffer[index5 + 1] >> 8 - bitOffset;
    return a2 | b;
  }
}
var UtfCodepoint = class {
  constructor(value3) {
    this.value = value3;
  }
};
var isBitArrayDeprecationMessagePrinted = {};
function bitArrayPrintDeprecationWarning(name, message) {
  if (isBitArrayDeprecationMessagePrinted[name]) {
    return;
  }
  console.warn(
    `Deprecated BitArray.${name} property used in JavaScript FFI code. ${message}.`
  );
  isBitArrayDeprecationMessagePrinted[name] = true;
}
function bitArraySlice(bitArray, start3, end) {
  end ??= bitArray.bitSize;
  bitArrayValidateRange(bitArray, start3, end);
  if (start3 === end) {
    return new BitArray(new Uint8Array());
  }
  if (start3 === 0 && end === bitArray.bitSize) {
    return bitArray;
  }
  start3 += bitArray.bitOffset;
  end += bitArray.bitOffset;
  const startByteIndex = Math.trunc(start3 / 8);
  const endByteIndex = Math.trunc((end + 7) / 8);
  const byteLength = endByteIndex - startByteIndex;
  let buffer;
  if (startByteIndex === 0 && byteLength === bitArray.rawBuffer.byteLength) {
    buffer = bitArray.rawBuffer;
  } else {
    buffer = new Uint8Array(
      bitArray.rawBuffer.buffer,
      bitArray.rawBuffer.byteOffset + startByteIndex,
      byteLength
    );
  }
  return new BitArray(buffer, end - start3, start3 % 8);
}
function bitArraySliceToInt(bitArray, start3, end, isBigEndian, isSigned) {
  bitArrayValidateRange(bitArray, start3, end);
  if (start3 === end) {
    return 0;
  }
  start3 += bitArray.bitOffset;
  end += bitArray.bitOffset;
  const isStartByteAligned = start3 % 8 === 0;
  const isEndByteAligned = end % 8 === 0;
  if (isStartByteAligned && isEndByteAligned) {
    return intFromAlignedSlice(
      bitArray,
      start3 / 8,
      end / 8,
      isBigEndian,
      isSigned
    );
  }
  const size = end - start3;
  const startByteIndex = Math.trunc(start3 / 8);
  const endByteIndex = Math.trunc((end - 1) / 8);
  if (startByteIndex == endByteIndex) {
    const mask2 = 255 >> start3 % 8;
    const unusedLowBitCount = (8 - end % 8) % 8;
    let value3 = (bitArray.rawBuffer[startByteIndex] & mask2) >> unusedLowBitCount;
    if (isSigned) {
      const highBit = 2 ** (size - 1);
      if (value3 >= highBit) {
        value3 -= highBit * 2;
      }
    }
    return value3;
  }
  if (size <= 53) {
    return intFromUnalignedSliceUsingNumber(
      bitArray.rawBuffer,
      start3,
      end,
      isBigEndian,
      isSigned
    );
  } else {
    return intFromUnalignedSliceUsingBigInt(
      bitArray.rawBuffer,
      start3,
      end,
      isBigEndian,
      isSigned
    );
  }
}
function intFromAlignedSlice(bitArray, start3, end, isBigEndian, isSigned) {
  const byteSize = end - start3;
  if (byteSize <= 6) {
    return intFromAlignedSliceUsingNumber(
      bitArray.rawBuffer,
      start3,
      end,
      isBigEndian,
      isSigned
    );
  } else {
    return intFromAlignedSliceUsingBigInt(
      bitArray.rawBuffer,
      start3,
      end,
      isBigEndian,
      isSigned
    );
  }
}
function intFromAlignedSliceUsingNumber(buffer, start3, end, isBigEndian, isSigned) {
  const byteSize = end - start3;
  let value3 = 0;
  if (isBigEndian) {
    for (let i = start3; i < end; i++) {
      value3 *= 256;
      value3 += buffer[i];
    }
  } else {
    for (let i = end - 1; i >= start3; i--) {
      value3 *= 256;
      value3 += buffer[i];
    }
  }
  if (isSigned) {
    const highBit = 2 ** (byteSize * 8 - 1);
    if (value3 >= highBit) {
      value3 -= highBit * 2;
    }
  }
  return value3;
}
function intFromAlignedSliceUsingBigInt(buffer, start3, end, isBigEndian, isSigned) {
  const byteSize = end - start3;
  let value3 = 0n;
  if (isBigEndian) {
    for (let i = start3; i < end; i++) {
      value3 *= 256n;
      value3 += BigInt(buffer[i]);
    }
  } else {
    for (let i = end - 1; i >= start3; i--) {
      value3 *= 256n;
      value3 += BigInt(buffer[i]);
    }
  }
  if (isSigned) {
    const highBit = 1n << BigInt(byteSize * 8 - 1);
    if (value3 >= highBit) {
      value3 -= highBit * 2n;
    }
  }
  return Number(value3);
}
function intFromUnalignedSliceUsingNumber(buffer, start3, end, isBigEndian, isSigned) {
  const isStartByteAligned = start3 % 8 === 0;
  let size = end - start3;
  let byteIndex = Math.trunc(start3 / 8);
  let value3 = 0;
  if (isBigEndian) {
    if (!isStartByteAligned) {
      const leadingBitsCount = 8 - start3 % 8;
      value3 = buffer[byteIndex++] & (1 << leadingBitsCount) - 1;
      size -= leadingBitsCount;
    }
    while (size >= 8) {
      value3 *= 256;
      value3 += buffer[byteIndex++];
      size -= 8;
    }
    if (size > 0) {
      value3 *= 2 ** size;
      value3 += buffer[byteIndex] >> 8 - size;
    }
  } else {
    if (isStartByteAligned) {
      let size2 = end - start3;
      let scale = 1;
      while (size2 >= 8) {
        value3 += buffer[byteIndex++] * scale;
        scale *= 256;
        size2 -= 8;
      }
      value3 += (buffer[byteIndex] >> 8 - size2) * scale;
    } else {
      const highBitsCount = start3 % 8;
      const lowBitsCount = 8 - highBitsCount;
      let size2 = end - start3;
      let scale = 1;
      while (size2 >= 8) {
        const byte = buffer[byteIndex] << highBitsCount | buffer[byteIndex + 1] >> lowBitsCount;
        value3 += (byte & 255) * scale;
        scale *= 256;
        size2 -= 8;
        byteIndex++;
      }
      if (size2 > 0) {
        const lowBitsUsed = size2 - Math.max(0, size2 - lowBitsCount);
        let trailingByte = (buffer[byteIndex] & (1 << lowBitsCount) - 1) >> lowBitsCount - lowBitsUsed;
        size2 -= lowBitsUsed;
        if (size2 > 0) {
          trailingByte *= 2 ** size2;
          trailingByte += buffer[byteIndex + 1] >> 8 - size2;
        }
        value3 += trailingByte * scale;
      }
    }
  }
  if (isSigned) {
    const highBit = 2 ** (end - start3 - 1);
    if (value3 >= highBit) {
      value3 -= highBit * 2;
    }
  }
  return value3;
}
function intFromUnalignedSliceUsingBigInt(buffer, start3, end, isBigEndian, isSigned) {
  const isStartByteAligned = start3 % 8 === 0;
  let size = end - start3;
  let byteIndex = Math.trunc(start3 / 8);
  let value3 = 0n;
  if (isBigEndian) {
    if (!isStartByteAligned) {
      const leadingBitsCount = 8 - start3 % 8;
      value3 = BigInt(buffer[byteIndex++] & (1 << leadingBitsCount) - 1);
      size -= leadingBitsCount;
    }
    while (size >= 8) {
      value3 *= 256n;
      value3 += BigInt(buffer[byteIndex++]);
      size -= 8;
    }
    if (size > 0) {
      value3 <<= BigInt(size);
      value3 += BigInt(buffer[byteIndex] >> 8 - size);
    }
  } else {
    if (isStartByteAligned) {
      let size2 = end - start3;
      let shift = 0n;
      while (size2 >= 8) {
        value3 += BigInt(buffer[byteIndex++]) << shift;
        shift += 8n;
        size2 -= 8;
      }
      value3 += BigInt(buffer[byteIndex] >> 8 - size2) << shift;
    } else {
      const highBitsCount = start3 % 8;
      const lowBitsCount = 8 - highBitsCount;
      let size2 = end - start3;
      let shift = 0n;
      while (size2 >= 8) {
        const byte = buffer[byteIndex] << highBitsCount | buffer[byteIndex + 1] >> lowBitsCount;
        value3 += BigInt(byte & 255) << shift;
        shift += 8n;
        size2 -= 8;
        byteIndex++;
      }
      if (size2 > 0) {
        const lowBitsUsed = size2 - Math.max(0, size2 - lowBitsCount);
        let trailingByte = (buffer[byteIndex] & (1 << lowBitsCount) - 1) >> lowBitsCount - lowBitsUsed;
        size2 -= lowBitsUsed;
        if (size2 > 0) {
          trailingByte <<= size2;
          trailingByte += buffer[byteIndex + 1] >> 8 - size2;
        }
        value3 += BigInt(trailingByte) << shift;
      }
    }
  }
  if (isSigned) {
    const highBit = 2n ** BigInt(end - start3 - 1);
    if (value3 >= highBit) {
      value3 -= highBit * 2n;
    }
  }
  return Number(value3);
}
function bitArrayValidateRange(bitArray, start3, end) {
  if (start3 < 0 || start3 > bitArray.bitSize || end < start3 || end > bitArray.bitSize) {
    const msg = `Invalid bit array slice: start = ${start3}, end = ${end}, bit size = ${bitArray.bitSize}`;
    throw new globalThis.Error(msg);
  }
}
var Result = class _Result extends CustomType {
  // @internal
  static isResult(data) {
    return data instanceof _Result;
  }
};
var Ok = class extends Result {
  constructor(value3) {
    super();
    this[0] = value3;
  }
  // @internal
  isOk() {
    return true;
  }
};
var Error = class extends Result {
  constructor(detail) {
    super();
    this[0] = detail;
  }
  // @internal
  isOk() {
    return false;
  }
};
function isEqual(x2, y) {
  let values2 = [x2, y];
  while (values2.length) {
    let a2 = values2.pop();
    let b = values2.pop();
    if (a2 === b) continue;
    if (!isObject(a2) || !isObject(b)) return false;
    let unequal = !structurallyCompatibleObjects(a2, b) || unequalDates(a2, b) || unequalBuffers(a2, b) || unequalArrays(a2, b) || unequalMaps(a2, b) || unequalSets(a2, b) || unequalRegExps(a2, b);
    if (unequal) return false;
    const proto = Object.getPrototypeOf(a2);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a2.equals(b)) continue;
        else return false;
      } catch {
      }
    }
    let [keys2, get2] = getters(a2);
    for (let k of keys2(a2)) {
      values2.push(get2(a2, k), get2(b, k));
    }
  }
  return true;
}
function getters(object3) {
  if (object3 instanceof Map) {
    return [(x2) => x2.keys(), (x2, y) => x2.get(y)];
  } else {
    let extra = object3 instanceof globalThis.Error ? ["message"] : [];
    return [(x2) => [...extra, ...Object.keys(x2)], (x2, y) => x2[y]];
  }
}
function unequalDates(a2, b) {
  return a2 instanceof Date && (a2 > b || a2 < b);
}
function unequalBuffers(a2, b) {
  return !(a2 instanceof BitArray) && a2.buffer instanceof ArrayBuffer && a2.BYTES_PER_ELEMENT && !(a2.byteLength === b.byteLength && a2.every((n, i) => n === b[i]));
}
function unequalArrays(a2, b) {
  return Array.isArray(a2) && a2.length !== b.length;
}
function unequalMaps(a2, b) {
  return a2 instanceof Map && a2.size !== b.size;
}
function unequalSets(a2, b) {
  return a2 instanceof Set && (a2.size != b.size || [...a2].some((e) => !b.has(e)));
}
function unequalRegExps(a2, b) {
  return a2 instanceof RegExp && (a2.source !== b.source || a2.flags !== b.flags);
}
function isObject(a2) {
  return typeof a2 === "object" && a2 !== null;
}
function structurallyCompatibleObjects(a2, b) {
  if (typeof a2 !== "object" && typeof b !== "object" && (!a2 || !b))
    return false;
  let nonstructural = [Promise, WeakSet, WeakMap, Function];
  if (nonstructural.some((c) => a2 instanceof c)) return false;
  return a2.constructor === b.constructor;
}
function makeError(variant, module, line2, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.module = module;
  error.line = line2;
  error.function = fn;
  error.fn = fn;
  for (let k in extra) error[k] = extra[k];
  return error;
}

// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap();
var tempDataView = /* @__PURE__ */ new DataView(
  /* @__PURE__ */ new ArrayBuffer(8)
);
var referenceUID = 0;
function hashByReference(o) {
  const known = referenceMap.get(o);
  if (known !== void 0) {
    return known;
  }
  const hash = referenceUID++;
  if (referenceUID === 2147483647) {
    referenceUID = 0;
  }
  referenceMap.set(o, hash);
  return hash;
}
function hashMerge(a2, b) {
  return a2 ^ b + 2654435769 + (a2 << 6) + (a2 >> 2) | 0;
}
function hashString(s) {
  let hash = 0;
  const len = s.length;
  for (let i = 0; i < len; i++) {
    hash = Math.imul(31, hash) + s.charCodeAt(i) | 0;
  }
  return hash;
}
function hashNumber(n) {
  tempDataView.setFloat64(0, n);
  const i = tempDataView.getInt32(0);
  const j = tempDataView.getInt32(4);
  return Math.imul(73244475, i >> 16 ^ i) ^ j;
}
function hashBigInt(n) {
  return hashString(n.toString());
}
function hashObject(o) {
  const proto = Object.getPrototypeOf(o);
  if (proto !== null && typeof proto.hashCode === "function") {
    try {
      const code2 = o.hashCode(o);
      if (typeof code2 === "number") {
        return code2;
      }
    } catch {
    }
  }
  if (o instanceof Promise || o instanceof WeakSet || o instanceof WeakMap) {
    return hashByReference(o);
  }
  if (o instanceof Date) {
    return hashNumber(o.getTime());
  }
  let h = 0;
  if (o instanceof ArrayBuffer) {
    o = new Uint8Array(o);
  }
  if (Array.isArray(o) || o instanceof Uint8Array) {
    for (let i = 0; i < o.length; i++) {
      h = Math.imul(31, h) + getHash(o[i]) | 0;
    }
  } else if (o instanceof Set) {
    o.forEach((v) => {
      h = h + getHash(v) | 0;
    });
  } else if (o instanceof Map) {
    o.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
  } else {
    const keys2 = Object.keys(o);
    for (let i = 0; i < keys2.length; i++) {
      const k = keys2[i];
      const v = o[k];
      h = h + hashMerge(getHash(v), hashString(k)) | 0;
    }
  }
  return h;
}
function getHash(u) {
  if (u === null) return 1108378658;
  if (u === void 0) return 1108378659;
  if (u === true) return 1108378657;
  if (u === false) return 1108378656;
  switch (typeof u) {
    case "number":
      return hashNumber(u);
    case "string":
      return hashString(u);
    case "bigint":
      return hashBigInt(u);
    case "object":
      return hashObject(u);
    case "symbol":
      return hashByReference(u);
    case "function":
      return hashByReference(u);
    default:
      return 0;
  }
}
var SHIFT = 5;
var BUCKET_SIZE = Math.pow(2, SHIFT);
var MASK = BUCKET_SIZE - 1;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;
var ENTRY = 0;
var ARRAY_NODE = 1;
var INDEX_NODE = 2;
var COLLISION_NODE = 3;
var EMPTY = {
  type: INDEX_NODE,
  bitmap: 0,
  array: []
};
function mask(hash, shift) {
  return hash >>> shift & MASK;
}
function bitpos(hash, shift) {
  return 1 << mask(hash, shift);
}
function bitcount(x2) {
  x2 -= x2 >> 1 & 1431655765;
  x2 = (x2 & 858993459) + (x2 >> 2 & 858993459);
  x2 = x2 + (x2 >> 4) & 252645135;
  x2 += x2 >> 8;
  x2 += x2 >> 16;
  return x2 & 127;
}
function index(bitmap, bit) {
  return bitcount(bitmap & bit - 1);
}
function cloneAndSet(arr, at, val) {
  const len = arr.length;
  const out = new Array(len);
  for (let i = 0; i < len; ++i) {
    out[i] = arr[i];
  }
  out[at] = val;
  return out;
}
function spliceIn(arr, at, val) {
  const len = arr.length;
  const out = new Array(len + 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  out[g++] = val;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function spliceOut(arr, at) {
  const len = arr.length;
  const out = new Array(len - 1);
  let i = 0;
  let g = 0;
  while (i < at) {
    out[g++] = arr[i++];
  }
  ++i;
  while (i < len) {
    out[g++] = arr[i++];
  }
  return out;
}
function createNode(shift, key1, val1, key2hash, key2, val2) {
  const key1hash = getHash(key1);
  if (key1hash === key2hash) {
    return {
      type: COLLISION_NODE,
      hash: key1hash,
      array: [
        { type: ENTRY, k: key1, v: val1 },
        { type: ENTRY, k: key2, v: val2 }
      ]
    };
  }
  const addedLeaf = { val: false };
  return assoc(
    assocIndex(EMPTY, shift, key1hash, key1, val1, addedLeaf),
    shift,
    key2hash,
    key2,
    val2,
    addedLeaf
  );
}
function assoc(root, shift, hash, key2, val, addedLeaf) {
  switch (root.type) {
    case ARRAY_NODE:
      return assocArray(root, shift, hash, key2, val, addedLeaf);
    case INDEX_NODE:
      return assocIndex(root, shift, hash, key2, val, addedLeaf);
    case COLLISION_NODE:
      return assocCollision(root, shift, hash, key2, val, addedLeaf);
  }
}
function assocArray(root, shift, hash, key2, val, addedLeaf) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root.size + 1,
      array: cloneAndSet(root.array, idx, { type: ENTRY, k: key2, v: val })
    };
  }
  if (node.type === ENTRY) {
    if (isEqual(key2, node.k)) {
      if (val === node.v) {
        return root;
      }
      return {
        type: ARRAY_NODE,
        size: root.size,
        array: cloneAndSet(root.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root.size,
      array: cloneAndSet(
        root.array,
        idx,
        createNode(shift + SHIFT, node.k, node.v, hash, key2, val)
      )
    };
  }
  const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
  if (n === node) {
    return root;
  }
  return {
    type: ARRAY_NODE,
    size: root.size,
    array: cloneAndSet(root.array, idx, n)
  };
}
function assocIndex(root, shift, hash, key2, val, addedLeaf) {
  const bit = bitpos(hash, shift);
  const idx = index(root.bitmap, bit);
  if ((root.bitmap & bit) !== 0) {
    const node = root.array[idx];
    if (node.type !== ENTRY) {
      const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
      if (n === node) {
        return root;
      }
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, n)
      };
    }
    const nodeKey = node.k;
    if (isEqual(key2, nodeKey)) {
      if (val === node.v) {
        return root;
      }
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap,
      array: cloneAndSet(
        root.array,
        idx,
        createNode(shift + SHIFT, nodeKey, node.v, hash, key2, val)
      )
    };
  } else {
    const n = root.array.length;
    if (n >= MAX_INDEX_NODE) {
      const nodes = new Array(32);
      const jdx = mask(hash, shift);
      nodes[jdx] = assocIndex(EMPTY, shift + SHIFT, hash, key2, val, addedLeaf);
      let j = 0;
      let bitmap = root.bitmap;
      for (let i = 0; i < 32; i++) {
        if ((bitmap & 1) !== 0) {
          const node = root.array[j++];
          nodes[i] = node;
        }
        bitmap = bitmap >>> 1;
      }
      return {
        type: ARRAY_NODE,
        size: n + 1,
        array: nodes
      };
    } else {
      const newArray = spliceIn(root.array, idx, {
        type: ENTRY,
        k: key2,
        v: val
      });
      addedLeaf.val = true;
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap | bit,
        array: newArray
      };
    }
  }
}
function assocCollision(root, shift, hash, key2, val, addedLeaf) {
  if (hash === root.hash) {
    const idx = collisionIndexOf(root, key2);
    if (idx !== -1) {
      const entry = root.array[idx];
      if (entry.v === val) {
        return root;
      }
      return {
        type: COLLISION_NODE,
        hash,
        array: cloneAndSet(root.array, idx, { type: ENTRY, k: key2, v: val })
      };
    }
    const size = root.array.length;
    addedLeaf.val = true;
    return {
      type: COLLISION_NODE,
      hash,
      array: cloneAndSet(root.array, size, { type: ENTRY, k: key2, v: val })
    };
  }
  return assoc(
    {
      type: INDEX_NODE,
      bitmap: bitpos(root.hash, shift),
      array: [root]
    },
    shift,
    hash,
    key2,
    val,
    addedLeaf
  );
}
function collisionIndexOf(root, key2) {
  const size = root.array.length;
  for (let i = 0; i < size; i++) {
    if (isEqual(key2, root.array[i].k)) {
      return i;
    }
  }
  return -1;
}
function find(root, shift, hash, key2) {
  switch (root.type) {
    case ARRAY_NODE:
      return findArray(root, shift, hash, key2);
    case INDEX_NODE:
      return findIndex(root, shift, hash, key2);
    case COLLISION_NODE:
      return findCollision(root, key2);
  }
}
function findArray(root, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    return void 0;
  }
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findIndex(root, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root.bitmap & bit) === 0) {
    return void 0;
  }
  const idx = index(root.bitmap, bit);
  const node = root.array[idx];
  if (node.type !== ENTRY) {
    return find(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findCollision(root, key2) {
  const idx = collisionIndexOf(root, key2);
  if (idx < 0) {
    return void 0;
  }
  return root.array[idx];
}
function without(root, shift, hash, key2) {
  switch (root.type) {
    case ARRAY_NODE:
      return withoutArray(root, shift, hash, key2);
    case INDEX_NODE:
      return withoutIndex(root, shift, hash, key2);
    case COLLISION_NODE:
      return withoutCollision(root, key2);
  }
}
function withoutArray(root, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root.array[idx];
  if (node === void 0) {
    return root;
  }
  let n = void 0;
  if (node.type === ENTRY) {
    if (!isEqual(node.k, key2)) {
      return root;
    }
  } else {
    n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root;
    }
  }
  if (n === void 0) {
    if (root.size <= MIN_ARRAY_NODE) {
      const arr = root.array;
      const out = new Array(root.size - 1);
      let i = 0;
      let j = 0;
      let bitmap = 0;
      while (i < idx) {
        const nv = arr[i];
        if (nv !== void 0) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      ++i;
      while (i < arr.length) {
        const nv = arr[i];
        if (nv !== void 0) {
          out[j] = nv;
          bitmap |= 1 << i;
          ++j;
        }
        ++i;
      }
      return {
        type: INDEX_NODE,
        bitmap,
        array: out
      };
    }
    return {
      type: ARRAY_NODE,
      size: root.size - 1,
      array: cloneAndSet(root.array, idx, n)
    };
  }
  return {
    type: ARRAY_NODE,
    size: root.size,
    array: cloneAndSet(root.array, idx, n)
  };
}
function withoutIndex(root, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root.bitmap & bit) === 0) {
    return root;
  }
  const idx = index(root.bitmap, bit);
  const node = root.array[idx];
  if (node.type !== ENTRY) {
    const n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root;
    }
    if (n !== void 0) {
      return {
        type: INDEX_NODE,
        bitmap: root.bitmap,
        array: cloneAndSet(root.array, idx, n)
      };
    }
    if (root.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap ^ bit,
      array: spliceOut(root.array, idx)
    };
  }
  if (isEqual(key2, node.k)) {
    if (root.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root.bitmap ^ bit,
      array: spliceOut(root.array, idx)
    };
  }
  return root;
}
function withoutCollision(root, key2) {
  const idx = collisionIndexOf(root, key2);
  if (idx < 0) {
    return root;
  }
  if (root.array.length === 1) {
    return void 0;
  }
  return {
    type: COLLISION_NODE,
    hash: root.hash,
    array: spliceOut(root.array, idx)
  };
}
function forEach(root, fn) {
  if (root === void 0) {
    return;
  }
  const items = root.array;
  const size = items.length;
  for (let i = 0; i < size; i++) {
    const item = items[i];
    if (item === void 0) {
      continue;
    }
    if (item.type === ENTRY) {
      fn(item.v, item.k);
      continue;
    }
    forEach(item, fn);
  }
}
var Dict = class _Dict {
  /**
   * @template V
   * @param {Record<string,V>} o
   * @returns {Dict<string,V>}
   */
  static fromObject(o) {
    const keys2 = Object.keys(o);
    let m = _Dict.new();
    for (let i = 0; i < keys2.length; i++) {
      const k = keys2[i];
      m = m.set(k, o[k]);
    }
    return m;
  }
  /**
   * @template K,V
   * @param {Map<K,V>} o
   * @returns {Dict<K,V>}
   */
  static fromMap(o) {
    let m = _Dict.new();
    o.forEach((v, k) => {
      m = m.set(k, v);
    });
    return m;
  }
  static new() {
    return new _Dict(void 0, 0);
  }
  /**
   * @param {undefined | Node<K,V>} root
   * @param {number} size
   */
  constructor(root, size) {
    this.root = root;
    this.size = size;
  }
  /**
   * @template NotFound
   * @param {K} key
   * @param {NotFound} notFound
   * @returns {NotFound | V}
   */
  get(key2, notFound) {
    if (this.root === void 0) {
      return notFound;
    }
    const found = find(this.root, 0, getHash(key2), key2);
    if (found === void 0) {
      return notFound;
    }
    return found.v;
  }
  /**
   * @param {K} key
   * @param {V} val
   * @returns {Dict<K,V>}
   */
  set(key2, val) {
    const addedLeaf = { val: false };
    const root = this.root === void 0 ? EMPTY : this.root;
    const newRoot = assoc(root, 0, getHash(key2), key2, val, addedLeaf);
    if (newRoot === this.root) {
      return this;
    }
    return new _Dict(newRoot, addedLeaf.val ? this.size + 1 : this.size);
  }
  /**
   * @param {K} key
   * @returns {Dict<K,V>}
   */
  delete(key2) {
    if (this.root === void 0) {
      return this;
    }
    const newRoot = without(this.root, 0, getHash(key2), key2);
    if (newRoot === this.root) {
      return this;
    }
    if (newRoot === void 0) {
      return _Dict.new();
    }
    return new _Dict(newRoot, this.size - 1);
  }
  /**
   * @param {K} key
   * @returns {boolean}
   */
  has(key2) {
    if (this.root === void 0) {
      return false;
    }
    return find(this.root, 0, getHash(key2), key2) !== void 0;
  }
  /**
   * @returns {[K,V][]}
   */
  entries() {
    if (this.root === void 0) {
      return [];
    }
    const result = [];
    this.forEach((v, k) => result.push([k, v]));
    return result;
  }
  /**
   *
   * @param {(val:V,key:K)=>void} fn
   */
  forEach(fn) {
    forEach(this.root, fn);
  }
  hashCode() {
    let h = 0;
    this.forEach((v, k) => {
      h = h + hashMerge(getHash(v), getHash(k)) | 0;
    });
    return h;
  }
  /**
   * @param {unknown} o
   * @returns {boolean}
   */
  equals(o) {
    if (!(o instanceof _Dict) || this.size !== o.size) {
      return false;
    }
    try {
      this.forEach((v, k) => {
        if (!isEqual(o.get(k, !v), v)) {
          throw unequalDictSymbol;
        }
      });
      return true;
    } catch (e) {
      if (e === unequalDictSymbol) {
        return false;
      }
      throw e;
    }
  }
};
var unequalDictSymbol = /* @__PURE__ */ Symbol();

// build/dev/javascript/gleam_stdlib/gleam/order.mjs
var Lt = class extends CustomType {
};
var Eq = class extends CustomType {
};
var Gt = class extends CustomType {
};

// build/dev/javascript/gleam_stdlib/gleam/option.mjs
var Some = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var None = class extends CustomType {
};
function is_some(option) {
  return !isEqual(option, new None());
}
function to_result(option, e) {
  if (option instanceof Some) {
    let a2 = option[0];
    return new Ok(a2);
  } else {
    return new Error(e);
  }
}
function unwrap(option, default$) {
  if (option instanceof Some) {
    let x2 = option[0];
    return x2;
  } else {
    return default$;
  }
}
function map(option, fun) {
  if (option instanceof Some) {
    let x2 = option[0];
    return new Some(fun(x2));
  } else {
    return new None();
  }
}
function then$(option, fun) {
  if (option instanceof Some) {
    let x2 = option[0];
    return fun(x2);
  } else {
    return new None();
  }
}
function or(first2, second) {
  if (first2 instanceof Some) {
    return first2;
  } else {
    return second;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/dict.mjs
function insert(dict2, key2, value3) {
  return map_insert(key2, value3, dict2);
}
function reverse_and_concat(loop$remaining, loop$accumulator) {
  while (true) {
    let remaining = loop$remaining;
    let accumulator = loop$accumulator;
    if (remaining.hasLength(0)) {
      return accumulator;
    } else {
      let first2 = remaining.head;
      let rest = remaining.tail;
      loop$remaining = rest;
      loop$accumulator = prepend(first2, accumulator);
    }
  }
}
function do_keys_loop(loop$list, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse_and_concat(acc, toList([]));
    } else {
      let key2 = list3.head[0];
      let rest = list3.tail;
      loop$list = rest;
      loop$acc = prepend(key2, acc);
    }
  }
}
function keys(dict2) {
  return do_keys_loop(map_to_list(dict2), toList([]));
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
var Ascending = class extends CustomType {
};
var Descending = class extends CustomType {
};
function length_loop(loop$list, loop$count) {
  while (true) {
    let list3 = loop$list;
    let count = loop$count;
    if (list3.atLeastLength(1)) {
      let list$1 = list3.tail;
      loop$list = list$1;
      loop$count = count + 1;
    } else {
      return count;
    }
  }
}
function length(list3) {
  return length_loop(list3, 0);
}
function reverse_and_prepend(loop$prefix, loop$suffix) {
  while (true) {
    let prefix = loop$prefix;
    let suffix = loop$suffix;
    if (prefix.hasLength(0)) {
      return suffix;
    } else {
      let first$1 = prefix.head;
      let rest$1 = prefix.tail;
      loop$prefix = rest$1;
      loop$suffix = prepend(first$1, suffix);
    }
  }
}
function reverse(list3) {
  return reverse_and_prepend(list3, toList([]));
}
function contains(loop$list, loop$elem) {
  while (true) {
    let list3 = loop$list;
    let elem = loop$elem;
    if (list3.hasLength(0)) {
      return false;
    } else if (list3.atLeastLength(1) && isEqual(list3.head, elem)) {
      let first$1 = list3.head;
      return true;
    } else {
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$elem = elem;
    }
  }
}
function filter_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let new_acc = (() => {
        let $ = fun(first$1);
        if ($) {
          return prepend(first$1, acc);
        } else {
          return acc;
        }
      })();
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter(list3, predicate) {
  return filter_loop(list3, predicate, toList([]));
}
function filter_map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let new_acc = (() => {
        let $ = fun(first$1);
        if ($.isOk()) {
          let first$2 = $[0];
          return prepend(first$2, acc);
        } else {
          return acc;
        }
      })();
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter_map(list3, fun) {
  return filter_map_loop(list3, fun, toList([]));
}
function map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$fun = fun;
      loop$acc = prepend(fun(first$1), acc);
    }
  }
}
function map2(list3, fun) {
  return map_loop(list3, fun, toList([]));
}
function index_map_loop(loop$list, loop$fun, loop$index, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let index5 = loop$index;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let acc$1 = prepend(fun(first$1, index5), acc);
      loop$list = rest$1;
      loop$fun = fun;
      loop$index = index5 + 1;
      loop$acc = acc$1;
    }
  }
}
function index_map(list3, fun) {
  return index_map_loop(list3, fun, 0, toList([]));
}
function try_map_loop(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return new Ok(reverse(acc));
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let $ = fun(first$1);
      if ($.isOk()) {
        let first$2 = $[0];
        loop$list = rest$1;
        loop$fun = fun;
        loop$acc = prepend(first$2, acc);
      } else {
        let error = $[0];
        return new Error(error);
      }
    }
  }
}
function try_map(list3, fun) {
  return try_map_loop(list3, fun, toList([]));
}
function take_loop(loop$list, loop$n, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let n = loop$n;
    let acc = loop$acc;
    let $ = n <= 0;
    if ($) {
      return reverse(acc);
    } else {
      if (list3.hasLength(0)) {
        return reverse(acc);
      } else {
        let first$1 = list3.head;
        let rest$1 = list3.tail;
        loop$list = rest$1;
        loop$n = n - 1;
        loop$acc = prepend(first$1, acc);
      }
    }
  }
}
function take(list3, n) {
  return take_loop(list3, n, toList([]));
}
function append_loop(loop$first, loop$second) {
  while (true) {
    let first2 = loop$first;
    let second = loop$second;
    if (first2.hasLength(0)) {
      return second;
    } else {
      let first$1 = first2.head;
      let rest$1 = first2.tail;
      loop$first = rest$1;
      loop$second = prepend(first$1, second);
    }
  }
}
function append(first2, second) {
  return append_loop(reverse(first2), second);
}
function fold(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list3 = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list3.hasLength(0)) {
      return initial;
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, first$1);
      loop$fun = fun;
    }
  }
}
function index_fold_loop(loop$over, loop$acc, loop$with, loop$index) {
  while (true) {
    let over = loop$over;
    let acc = loop$acc;
    let with$ = loop$with;
    let index5 = loop$index;
    if (over.hasLength(0)) {
      return acc;
    } else {
      let first$1 = over.head;
      let rest$1 = over.tail;
      loop$over = rest$1;
      loop$acc = with$(acc, first$1, index5);
      loop$with = with$;
      loop$index = index5 + 1;
    }
  }
}
function index_fold(list3, initial, fun) {
  return index_fold_loop(list3, initial, fun, 0);
}
function find2(loop$list, loop$is_desired) {
  while (true) {
    let list3 = loop$list;
    let is_desired = loop$is_desired;
    if (list3.hasLength(0)) {
      return new Error(void 0);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      let $ = is_desired(first$1);
      if ($) {
        return new Ok(first$1);
      } else {
        loop$list = rest$1;
        loop$is_desired = is_desired;
      }
    }
  }
}
function intersperse_loop(loop$list, loop$separator, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let separator = loop$separator;
    let acc = loop$acc;
    if (list3.hasLength(0)) {
      return reverse(acc);
    } else {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$separator = separator;
      loop$acc = prepend(first$1, prepend(separator, acc));
    }
  }
}
function intersperse(list3, elem) {
  if (list3.hasLength(0)) {
    return list3;
  } else if (list3.hasLength(1)) {
    return list3;
  } else {
    let first$1 = list3.head;
    let rest$1 = list3.tail;
    return intersperse_loop(rest$1, elem, toList([first$1]));
  }
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list3 = loop$list;
    let compare3 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list3.hasLength(0)) {
      if (direction instanceof Ascending) {
        return prepend(reverse(growing$1), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list3.head;
      let rest$1 = list3.tail;
      let $ = compare3(prev, new$1);
      if ($ instanceof Gt && direction instanceof Descending) {
        loop$list = rest$1;
        loop$compare = compare3;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Lt && direction instanceof Ascending) {
        loop$list = rest$1;
        loop$compare = compare3;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Eq && direction instanceof Ascending) {
        loop$list = rest$1;
        loop$compare = compare3;
        loop$growing = growing$1;
        loop$direction = direction;
        loop$prev = new$1;
        loop$acc = acc;
      } else if ($ instanceof Gt && direction instanceof Ascending) {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse(growing$1), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare3(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare3;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else if ($ instanceof Lt && direction instanceof Descending) {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse(growing$1), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare3(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare3;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      } else {
        let acc$1 = (() => {
          if (direction instanceof Ascending) {
            return prepend(reverse(growing$1), acc);
          } else {
            return prepend(growing$1, acc);
          }
        })();
        if (rest$1.hasLength(0)) {
          return prepend(toList([new$1]), acc$1);
        } else {
          let next = rest$1.head;
          let rest$2 = rest$1.tail;
          let direction$1 = (() => {
            let $1 = compare3(new$1, next);
            if ($1 instanceof Lt) {
              return new Ascending();
            } else if ($1 instanceof Eq) {
              return new Ascending();
            } else {
              return new Descending();
            }
          })();
          loop$list = rest$2;
          loop$compare = compare3;
          loop$growing = toList([new$1]);
          loop$direction = direction$1;
          loop$prev = next;
          loop$acc = acc$1;
        }
      }
    }
  }
}
function merge_ascendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list3 = list22;
      return reverse_and_prepend(list3, acc);
    } else if (list22.hasLength(0)) {
      let list3 = list1;
      return reverse_and_prepend(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list22.head;
      let rest2 = list22.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      } else if ($ instanceof Gt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      } else {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      }
    }
  }
}
function merge_ascending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (sequences2.hasLength(0)) {
      return reverse(acc);
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return reverse(prepend(reverse(sequence), acc));
    } else {
      let ascending1 = sequences2.head;
      let ascending2 = sequences2.tail.head;
      let rest$1 = sequences2.tail.tail;
      let descending = merge_ascendings(
        ascending1,
        ascending2,
        compare3,
        toList([])
      );
      loop$sequences = rest$1;
      loop$compare = compare3;
      loop$acc = prepend(descending, acc);
    }
  }
}
function merge_descendings(loop$list1, loop$list2, loop$compare, loop$acc) {
  while (true) {
    let list1 = loop$list1;
    let list22 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list3 = list22;
      return reverse_and_prepend(list3, acc);
    } else if (list22.hasLength(0)) {
      let list3 = list1;
      return reverse_and_prepend(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list22.head;
      let rest2 = list22.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      } else if ($ instanceof Gt) {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list22;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      }
    }
  }
}
function merge_descending_pairs(loop$sequences, loop$compare, loop$acc) {
  while (true) {
    let sequences2 = loop$sequences;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (sequences2.hasLength(0)) {
      return reverse(acc);
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return reverse(prepend(reverse(sequence), acc));
    } else {
      let descending1 = sequences2.head;
      let descending2 = sequences2.tail.head;
      let rest$1 = sequences2.tail.tail;
      let ascending = merge_descendings(
        descending1,
        descending2,
        compare3,
        toList([])
      );
      loop$sequences = rest$1;
      loop$compare = compare3;
      loop$acc = prepend(ascending, acc);
    }
  }
}
function merge_all(loop$sequences, loop$direction, loop$compare) {
  while (true) {
    let sequences2 = loop$sequences;
    let direction = loop$direction;
    let compare3 = loop$compare;
    if (sequences2.hasLength(0)) {
      return toList([]);
    } else if (sequences2.hasLength(1) && direction instanceof Ascending) {
      let sequence = sequences2.head;
      return sequence;
    } else if (sequences2.hasLength(1) && direction instanceof Descending) {
      let sequence = sequences2.head;
      return reverse(sequence);
    } else if (direction instanceof Ascending) {
      let sequences$1 = merge_ascending_pairs(sequences2, compare3, toList([]));
      loop$sequences = sequences$1;
      loop$direction = new Descending();
      loop$compare = compare3;
    } else {
      let sequences$1 = merge_descending_pairs(sequences2, compare3, toList([]));
      loop$sequences = sequences$1;
      loop$direction = new Ascending();
      loop$compare = compare3;
    }
  }
}
function sort(list3, compare3) {
  if (list3.hasLength(0)) {
    return toList([]);
  } else if (list3.hasLength(1)) {
    let x2 = list3.head;
    return toList([x2]);
  } else {
    let x2 = list3.head;
    let y = list3.tail.head;
    let rest$1 = list3.tail.tail;
    let direction = (() => {
      let $ = compare3(x2, y);
      if ($ instanceof Lt) {
        return new Ascending();
      } else if ($ instanceof Eq) {
        return new Ascending();
      } else {
        return new Descending();
      }
    })();
    let sequences$1 = sequences(
      rest$1,
      compare3,
      toList([x2]),
      direction,
      y,
      toList([])
    );
    return merge_all(sequences$1, new Ascending(), compare3);
  }
}
function key_set_loop(loop$list, loop$key, loop$value, loop$inspected) {
  while (true) {
    let list3 = loop$list;
    let key2 = loop$key;
    let value3 = loop$value;
    let inspected = loop$inspected;
    if (list3.atLeastLength(1) && isEqual(list3.head[0], key2)) {
      let k = list3.head[0];
      let rest$1 = list3.tail;
      return reverse_and_prepend(inspected, prepend([k, value3], rest$1));
    } else if (list3.atLeastLength(1)) {
      let first$1 = list3.head;
      let rest$1 = list3.tail;
      loop$list = rest$1;
      loop$key = key2;
      loop$value = value3;
      loop$inspected = prepend(first$1, inspected);
    } else {
      return reverse(prepend([key2, value3], inspected));
    }
  }
}
function key_set(list3, key2, value3) {
  return key_set_loop(list3, key2, value3, toList([]));
}

// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function map3(result, fun) {
  if (result.isOk()) {
    let x2 = result[0];
    return new Ok(fun(x2));
  } else {
    let e = result[0];
    return new Error(e);
  }
}
function map_error(result, fun) {
  if (result.isOk()) {
    let x2 = result[0];
    return new Ok(x2);
  } else {
    let error = result[0];
    return new Error(fun(error));
  }
}
function try$(result, fun) {
  if (result.isOk()) {
    let x2 = result[0];
    return fun(x2);
  } else {
    let e = result[0];
    return new Error(e);
  }
}
function then$2(result, fun) {
  return try$(result, fun);
}
function unwrap2(result, default$) {
  if (result.isOk()) {
    let v = result[0];
    return v;
  } else {
    return default$;
  }
}
function all(results) {
  return try_map(results, (x2) => {
    return x2;
  });
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic.mjs
var DecodeError = class extends CustomType {
  constructor(expected, found, path2) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path2;
  }
};
function map_errors(result, f) {
  return map_error(
    result,
    (_capture) => {
      return map2(_capture, f);
    }
  );
}
function string(data) {
  return decode_string(data);
}
function do_any(decoders) {
  return (data) => {
    if (decoders.hasLength(0)) {
      return new Error(
        toList([new DecodeError("another type", classify_dynamic(data), toList([]))])
      );
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder(data);
      if ($.isOk()) {
        let decoded = $[0];
        return new Ok(decoded);
      } else {
        return do_any(decoders$1)(data);
      }
    }
  };
}
function push_path(error, name) {
  let name$1 = identity(name);
  let decoder = do_any(
    toList([
      decode_string,
      (x2) => {
        return map3(decode_int(x2), to_string);
      }
    ])
  );
  let name$2 = (() => {
    let $ = decoder(name$1);
    if ($.isOk()) {
      let name$22 = $[0];
      return name$22;
    } else {
      let _pipe = toList(["<", classify_dynamic(name$1), ">"]);
      let _pipe$1 = concat(_pipe);
      return identity(_pipe$1);
    }
  })();
  let _record = error;
  return new DecodeError(
    _record.expected,
    _record.found,
    prepend(name$2, error.path)
  );
}
function field(name, inner_type) {
  return (value3) => {
    let missing_field_error = new DecodeError("field", "nothing", toList([]));
    return try$(
      decode_field(value3, name),
      (maybe_inner) => {
        let _pipe = maybe_inner;
        let _pipe$1 = to_result(_pipe, toList([missing_field_error]));
        let _pipe$2 = try$(_pipe$1, inner_type);
        return map_errors(
          _pipe$2,
          (_capture) => {
            return push_path(_capture, name);
          }
        );
      }
    );
  };
}

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
var Nil = void 0;
var NOT_FOUND = {};
function identity(x2) {
  return x2;
}
function to_string(term) {
  return term.toString();
}
function string_length(string5) {
  if (string5 === "") {
    return 0;
  }
  const iterator = graphemes_iterator(string5);
  if (iterator) {
    let i = 0;
    for (const _ of iterator) {
      i++;
    }
    return i;
  } else {
    return string5.match(/./gsu).length;
  }
}
function graphemes(string5) {
  const iterator = graphemes_iterator(string5);
  if (iterator) {
    return List.fromArray(Array.from(iterator).map((item) => item.segment));
  } else {
    return List.fromArray(string5.match(/./gsu));
  }
}
var segmenter = void 0;
function graphemes_iterator(string5) {
  if (globalThis.Intl && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter();
    return segmenter.segment(string5)[Symbol.iterator]();
  }
}
function pop_grapheme(string5) {
  let first2;
  const iterator = graphemes_iterator(string5);
  if (iterator) {
    first2 = iterator.next().value?.segment;
  } else {
    first2 = string5.match(/./su)?.[0];
  }
  if (first2) {
    return new Ok([first2, string5.slice(first2.length)]);
  } else {
    return new Error(Nil);
  }
}
function pop_codeunit(str) {
  return [str.charCodeAt(0) | 0, str.slice(1)];
}
function lowercase(string5) {
  return string5.toLowerCase();
}
function uppercase(string5) {
  return string5.toUpperCase();
}
function split(xs, pattern) {
  return List.fromArray(xs.split(pattern));
}
function concat(xs) {
  let result = "";
  for (const x2 of xs) {
    result = result + x2;
  }
  return result;
}
function string_codeunit_slice(str, from2, length5) {
  return str.slice(from2, from2 + length5);
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
var unicode_whitespaces = [
  " ",
  // Space
  "	",
  // Horizontal tab
  "\n",
  // Line feed
  "\v",
  // Vertical tab
  "\f",
  // Form feed
  "\r",
  // Carriage return
  "\x85",
  // Next line
  "\u2028",
  // Line separator
  "\u2029"
  // Paragraph separator
].join("");
var trim_start_regex = /* @__PURE__ */ new RegExp(
  `^[${unicode_whitespaces}]*`
);
var trim_end_regex = /* @__PURE__ */ new RegExp(`[${unicode_whitespaces}]*$`);
function trim_start(string5) {
  return string5.replace(trim_start_regex, "");
}
function trim_end(string5) {
  return string5.replace(trim_end_regex, "");
}
function bit_array_to_string(bit_array2) {
  if (bit_array2.bitSize % 8 !== 0) {
    return new Error(Nil);
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    if (bit_array2.bitOffset === 0) {
      return new Ok(decoder.decode(bit_array2.rawBuffer));
    } else {
      const buffer = new Uint8Array(bit_array2.byteSize);
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = bit_array2.byteAt(i);
      }
      return new Ok(decoder.decode(buffer));
    }
  } catch {
    return new Error(Nil);
  }
}
function new_map() {
  return Dict.new();
}
function map_to_list(map7) {
  return List.fromArray(map7.entries());
}
function map_get(map7, key2) {
  const value3 = map7.get(key2, NOT_FOUND);
  if (value3 === NOT_FOUND) {
    return new Error(Nil);
  }
  return new Ok(value3);
}
function map_insert(key2, value3, map7) {
  return map7.set(key2, value3);
}
function unsafe_percent_decode_query(string5) {
  return decodeURIComponent((string5 || "").replace("+", " "));
}
function percent_encode(string5) {
  return encodeURIComponent(string5).replace("%2B", "+");
}
function parse_query(query) {
  try {
    const pairs = [];
    for (const section of query.split("&")) {
      const [key2, value3] = section.split("=");
      if (!key2) continue;
      const decodedKey = unsafe_percent_decode_query(key2);
      const decodedValue = unsafe_percent_decode_query(value3);
      pairs.push([decodedKey, decodedValue]);
    }
    return new Ok(List.fromArray(pairs));
  } catch {
    return new Error(Nil);
  }
}
function classify_dynamic(data) {
  if (typeof data === "string") {
    return "String";
  } else if (typeof data === "boolean") {
    return "Bool";
  } else if (data instanceof Result) {
    return "Result";
  } else if (data instanceof List) {
    return "List";
  } else if (data instanceof BitArray) {
    return "BitArray";
  } else if (data instanceof Dict) {
    return "Dict";
  } else if (Number.isInteger(data)) {
    return "Int";
  } else if (Array.isArray(data)) {
    return `Tuple of ${data.length} elements`;
  } else if (typeof data === "number") {
    return "Float";
  } else if (data === null) {
    return "Null";
  } else if (data === void 0) {
    return "Nil";
  } else {
    const type = typeof data;
    return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
function decoder_error(expected, got) {
  return decoder_error_no_classify(expected, classify_dynamic(got));
}
function decoder_error_no_classify(expected, got) {
  return new Error(
    List.fromArray([new DecodeError(expected, got, List.fromArray([]))])
  );
}
function decode_string(data) {
  return typeof data === "string" ? new Ok(data) : decoder_error("String", data);
}
function decode_int(data) {
  return Number.isInteger(data) ? new Ok(data) : decoder_error("Int", data);
}
function decode_field(value3, name) {
  const not_a_map_error = () => decoder_error("Dict", value3);
  if (value3 instanceof Dict || value3 instanceof WeakMap || value3 instanceof Map) {
    const entry = map_get(value3, name);
    return new Ok(entry.isOk() ? new Some(entry[0]) : new None());
  } else if (value3 === null) {
    return not_a_map_error();
  } else if (Object.getPrototypeOf(value3) == Object.prototype) {
    return try_get_field(value3, name, () => new Ok(new None()));
  } else {
    return try_get_field(value3, name, not_a_map_error);
  }
}
function try_get_field(value3, field3, or_else) {
  try {
    return field3 in value3 ? new Ok(new Some(value3[field3])) : or_else();
  } catch {
    return or_else();
  }
}

// build/dev/javascript/gleam_stdlib/gleam/int.mjs
function compare2(a2, b) {
  let $ = a2 === b;
  if ($) {
    return new Eq();
  } else {
    let $1 = a2 < b;
    if ($1) {
      return new Lt();
    } else {
      return new Gt();
    }
  }
}

// build/dev/javascript/gleam_stdlib/gleam/string.mjs
function concat_loop(loop$strings, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let accumulator = loop$accumulator;
    if (strings.atLeastLength(1)) {
      let string5 = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$accumulator = accumulator + string5;
    } else {
      return accumulator;
    }
  }
}
function concat2(strings) {
  return concat_loop(strings, "");
}
function join_loop(loop$strings, loop$separator, loop$accumulator) {
  while (true) {
    let strings = loop$strings;
    let separator = loop$separator;
    let accumulator = loop$accumulator;
    if (strings.hasLength(0)) {
      return accumulator;
    } else {
      let string5 = strings.head;
      let strings$1 = strings.tail;
      loop$strings = strings$1;
      loop$separator = separator;
      loop$accumulator = accumulator + separator + string5;
    }
  }
}
function join(strings, separator) {
  if (strings.hasLength(0)) {
    return "";
  } else {
    let first$1 = strings.head;
    let rest = strings.tail;
    return join_loop(rest, separator, first$1);
  }
}
function trim(string5) {
  let _pipe = string5;
  let _pipe$1 = trim_start(_pipe);
  return trim_end(_pipe$1);
}
function drop_start(loop$string, loop$num_graphemes) {
  while (true) {
    let string5 = loop$string;
    let num_graphemes = loop$num_graphemes;
    let $ = num_graphemes > 0;
    if (!$) {
      return string5;
    } else {
      let $1 = pop_grapheme(string5);
      if ($1.isOk()) {
        let string$1 = $1[0][1];
        loop$string = string$1;
        loop$num_graphemes = num_graphemes - 1;
      } else {
        return string5;
      }
    }
  }
}
function split2(x2, substring) {
  if (substring === "") {
    return graphemes(x2);
  } else {
    let _pipe = x2;
    let _pipe$1 = identity(_pipe);
    let _pipe$2 = split(_pipe$1, substring);
    return map2(_pipe$2, identity);
  }
}

// build/dev/javascript/gleam_stdlib/gleam/uri.mjs
var Uri = class extends CustomType {
  constructor(scheme, userinfo, host, port, path2, query, fragment) {
    super();
    this.scheme = scheme;
    this.userinfo = userinfo;
    this.host = host;
    this.port = port;
    this.path = path2;
    this.query = query;
    this.fragment = fragment;
  }
};
function is_valid_host_within_brackets_char(char) {
  return 48 >= char && char <= 57 || 65 >= char && char <= 90 || 97 >= char && char <= 122 || char === 58 || char === 46;
}
function parse_fragment(rest, pieces) {
  return new Ok(
    (() => {
      let _record = pieces;
      return new Uri(
        _record.scheme,
        _record.userinfo,
        _record.host,
        _record.port,
        _record.path,
        _record.query,
        new Some(rest)
      );
    })()
  );
}
function parse_query_with_question_mark_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string.startsWith("#") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_fragment(rest, pieces);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let query = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          _record.port,
          _record.path,
          new Some(query),
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            _record.host,
            _record.port,
            _record.path,
            new Some(original),
            _record.fragment
          );
        })()
      );
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size + 1;
    }
  }
}
function parse_query_with_question_mark(uri_string, pieces) {
  return parse_query_with_question_mark_loop(uri_string, uri_string, pieces, 0);
}
function parse_path_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string.startsWith("?")) {
      let rest = uri_string.slice(1);
      let path2 = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          _record.port,
          path2,
          _record.query,
          _record.fragment
        );
      })();
      return parse_query_with_question_mark(rest, pieces$1);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let path2 = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          _record.port,
          path2,
          _record.query,
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            _record.host,
            _record.port,
            original,
            _record.query,
            _record.fragment
          );
        })()
      );
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size + 1;
    }
  }
}
function parse_path(uri_string, pieces) {
  return parse_path_loop(uri_string, uri_string, pieces, 0);
}
function parse_port_loop(loop$uri_string, loop$pieces, loop$port) {
  while (true) {
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let port = loop$port;
    if (uri_string.startsWith("0")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10;
    } else if (uri_string.startsWith("1")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 1;
    } else if (uri_string.startsWith("2")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 2;
    } else if (uri_string.startsWith("3")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 3;
    } else if (uri_string.startsWith("4")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 4;
    } else if (uri_string.startsWith("5")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 5;
    } else if (uri_string.startsWith("6")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 6;
    } else if (uri_string.startsWith("7")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 7;
    } else if (uri_string.startsWith("8")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 8;
    } else if (uri_string.startsWith("9")) {
      let rest = uri_string.slice(1);
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$port = port * 10 + 9;
    } else if (uri_string.startsWith("?")) {
      let rest = uri_string.slice(1);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          new Some(port),
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_query_with_question_mark(rest, pieces$1);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          new Some(port),
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else if (uri_string.startsWith("/")) {
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          _record.host,
          new Some(port),
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_path(uri_string, pieces$1);
    } else if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            _record.host,
            new Some(port),
            _record.path,
            _record.query,
            _record.fragment
          );
        })()
      );
    } else {
      return new Error(void 0);
    }
  }
}
function parse_port(uri_string, pieces) {
  if (uri_string.startsWith(":0")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 0);
  } else if (uri_string.startsWith(":1")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 1);
  } else if (uri_string.startsWith(":2")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 2);
  } else if (uri_string.startsWith(":3")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 3);
  } else if (uri_string.startsWith(":4")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 4);
  } else if (uri_string.startsWith(":5")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 5);
  } else if (uri_string.startsWith(":6")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 6);
  } else if (uri_string.startsWith(":7")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 7);
  } else if (uri_string.startsWith(":8")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 8);
  } else if (uri_string.startsWith(":9")) {
    let rest = uri_string.slice(2);
    return parse_port_loop(rest, pieces, 9);
  } else if (uri_string.startsWith(":")) {
    return new Error(void 0);
  } else if (uri_string.startsWith("?")) {
    let rest = uri_string.slice(1);
    return parse_query_with_question_mark(rest, pieces);
  } else if (uri_string.startsWith("#")) {
    let rest = uri_string.slice(1);
    return parse_fragment(rest, pieces);
  } else if (uri_string.startsWith("/")) {
    return parse_path(uri_string, pieces);
  } else if (uri_string === "") {
    return new Ok(pieces);
  } else {
    return new Error(void 0);
  }
}
function parse_host_outside_of_brackets_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            new Some(original),
            _record.port,
            _record.path,
            _record.query,
            _record.fragment
          );
        })()
      );
    } else if (uri_string.startsWith(":")) {
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_port(uri_string, pieces$1);
    } else if (uri_string.startsWith("/")) {
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_path(uri_string, pieces$1);
    } else if (uri_string.startsWith("?")) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_query_with_question_mark(rest, pieces$1);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size + 1;
    }
  }
}
function parse_host_within_brackets_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            new Some(uri_string),
            _record.port,
            _record.path,
            _record.query,
            _record.fragment
          );
        })()
      );
    } else if (uri_string.startsWith("]") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_port(rest, pieces);
    } else if (uri_string.startsWith("]")) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size + 1);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_port(rest, pieces$1);
    } else if (uri_string.startsWith("/") && size === 0) {
      return parse_path(uri_string, pieces);
    } else if (uri_string.startsWith("/")) {
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_path(uri_string, pieces$1);
    } else if (uri_string.startsWith("?") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_query_with_question_mark(rest, pieces);
    } else if (uri_string.startsWith("?")) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_query_with_question_mark(rest, pieces$1);
    } else if (uri_string.startsWith("#") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_fragment(rest, pieces);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let host = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(host),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else {
      let $ = pop_codeunit(uri_string);
      let char = $[0];
      let rest = $[1];
      let $1 = is_valid_host_within_brackets_char(char);
      if ($1) {
        loop$original = original;
        loop$uri_string = rest;
        loop$pieces = pieces;
        loop$size = size + 1;
      } else {
        return parse_host_outside_of_brackets_loop(
          original,
          original,
          pieces,
          0
        );
      }
    }
  }
}
function parse_host_within_brackets(uri_string, pieces) {
  return parse_host_within_brackets_loop(uri_string, uri_string, pieces, 0);
}
function parse_host_outside_of_brackets(uri_string, pieces) {
  return parse_host_outside_of_brackets_loop(uri_string, uri_string, pieces, 0);
}
function parse_host(uri_string, pieces) {
  if (uri_string.startsWith("[")) {
    return parse_host_within_brackets(uri_string, pieces);
  } else if (uri_string.startsWith(":")) {
    let pieces$1 = (() => {
      let _record = pieces;
      return new Uri(
        _record.scheme,
        _record.userinfo,
        new Some(""),
        _record.port,
        _record.path,
        _record.query,
        _record.fragment
      );
    })();
    return parse_port(uri_string, pieces$1);
  } else if (uri_string === "") {
    return new Ok(
      (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(""),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })()
    );
  } else {
    return parse_host_outside_of_brackets(uri_string, pieces);
  }
}
function parse_userinfo_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string.startsWith("@") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_host(rest, pieces);
    } else if (uri_string.startsWith("@")) {
      let rest = uri_string.slice(1);
      let userinfo = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          new Some(userinfo),
          _record.host,
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_host(rest, pieces$1);
    } else if (uri_string === "") {
      return parse_host(original, pieces);
    } else if (uri_string.startsWith("/")) {
      return parse_host(original, pieces);
    } else if (uri_string.startsWith("?")) {
      return parse_host(original, pieces);
    } else if (uri_string.startsWith("#")) {
      return parse_host(original, pieces);
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size + 1;
    }
  }
}
function parse_authority_pieces(string5, pieces) {
  return parse_userinfo_loop(string5, string5, pieces, 0);
}
function parse_authority_with_slashes(uri_string, pieces) {
  if (uri_string === "//") {
    return new Ok(
      (() => {
        let _record = pieces;
        return new Uri(
          _record.scheme,
          _record.userinfo,
          new Some(""),
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })()
    );
  } else if (uri_string.startsWith("//")) {
    let rest = uri_string.slice(2);
    return parse_authority_pieces(rest, pieces);
  } else {
    return parse_path(uri_string, pieces);
  }
}
function parse_scheme_loop(loop$original, loop$uri_string, loop$pieces, loop$size) {
  while (true) {
    let original = loop$original;
    let uri_string = loop$uri_string;
    let pieces = loop$pieces;
    let size = loop$size;
    if (uri_string.startsWith("/") && size === 0) {
      return parse_authority_with_slashes(uri_string, pieces);
    } else if (uri_string.startsWith("/")) {
      let scheme = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          new Some(lowercase(scheme)),
          _record.userinfo,
          _record.host,
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_authority_with_slashes(uri_string, pieces$1);
    } else if (uri_string.startsWith("?") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_query_with_question_mark(rest, pieces);
    } else if (uri_string.startsWith("?")) {
      let rest = uri_string.slice(1);
      let scheme = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          new Some(lowercase(scheme)),
          _record.userinfo,
          _record.host,
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_query_with_question_mark(rest, pieces$1);
    } else if (uri_string.startsWith("#") && size === 0) {
      let rest = uri_string.slice(1);
      return parse_fragment(rest, pieces);
    } else if (uri_string.startsWith("#")) {
      let rest = uri_string.slice(1);
      let scheme = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          new Some(lowercase(scheme)),
          _record.userinfo,
          _record.host,
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_fragment(rest, pieces$1);
    } else if (uri_string.startsWith(":") && size === 0) {
      return new Error(void 0);
    } else if (uri_string.startsWith(":")) {
      let rest = uri_string.slice(1);
      let scheme = string_codeunit_slice(original, 0, size);
      let pieces$1 = (() => {
        let _record = pieces;
        return new Uri(
          new Some(lowercase(scheme)),
          _record.userinfo,
          _record.host,
          _record.port,
          _record.path,
          _record.query,
          _record.fragment
        );
      })();
      return parse_authority_with_slashes(rest, pieces$1);
    } else if (uri_string === "") {
      return new Ok(
        (() => {
          let _record = pieces;
          return new Uri(
            _record.scheme,
            _record.userinfo,
            _record.host,
            _record.port,
            original,
            _record.query,
            _record.fragment
          );
        })()
      );
    } else {
      let $ = pop_codeunit(uri_string);
      let rest = $[1];
      loop$original = original;
      loop$uri_string = rest;
      loop$pieces = pieces;
      loop$size = size + 1;
    }
  }
}
function query_pair(pair) {
  return concat(
    toList([percent_encode(pair[0]), "=", percent_encode(pair[1])])
  );
}
function query_to_string(query) {
  let _pipe = query;
  let _pipe$1 = map2(_pipe, query_pair);
  let _pipe$2 = intersperse(_pipe$1, identity("&"));
  let _pipe$3 = concat(_pipe$2);
  return identity(_pipe$3);
}
function remove_dot_segments_loop(loop$input, loop$accumulator) {
  while (true) {
    let input2 = loop$input;
    let accumulator = loop$accumulator;
    if (input2.hasLength(0)) {
      return reverse(accumulator);
    } else {
      let segment = input2.head;
      let rest = input2.tail;
      let accumulator$1 = (() => {
        if (segment === "") {
          let accumulator$12 = accumulator;
          return accumulator$12;
        } else if (segment === ".") {
          let accumulator$12 = accumulator;
          return accumulator$12;
        } else if (segment === ".." && accumulator.hasLength(0)) {
          return toList([]);
        } else if (segment === ".." && accumulator.atLeastLength(1)) {
          let accumulator$12 = accumulator.tail;
          return accumulator$12;
        } else {
          let segment$1 = segment;
          let accumulator$12 = accumulator;
          return prepend(segment$1, accumulator$12);
        }
      })();
      loop$input = rest;
      loop$accumulator = accumulator$1;
    }
  }
}
function remove_dot_segments(input2) {
  return remove_dot_segments_loop(input2, toList([]));
}
function path_segments(path2) {
  return remove_dot_segments(split2(path2, "/"));
}
function to_string2(uri) {
  let parts = (() => {
    let $ = uri.fragment;
    if ($ instanceof Some) {
      let fragment = $[0];
      return toList(["#", fragment]);
    } else {
      return toList([]);
    }
  })();
  let parts$1 = (() => {
    let $ = uri.query;
    if ($ instanceof Some) {
      let query = $[0];
      return prepend("?", prepend(query, parts));
    } else {
      return parts;
    }
  })();
  let parts$2 = prepend(uri.path, parts$1);
  let parts$3 = (() => {
    let $ = uri.host;
    let $1 = starts_with(uri.path, "/");
    if ($ instanceof Some && !$1 && $[0] !== "") {
      let host = $[0];
      return prepend("/", parts$2);
    } else {
      return parts$2;
    }
  })();
  let parts$4 = (() => {
    let $ = uri.host;
    let $1 = uri.port;
    if ($ instanceof Some && $1 instanceof Some) {
      let port = $1[0];
      return prepend(":", prepend(to_string(port), parts$3));
    } else {
      return parts$3;
    }
  })();
  let parts$5 = (() => {
    let $ = uri.scheme;
    let $1 = uri.userinfo;
    let $2 = uri.host;
    if ($ instanceof Some && $1 instanceof Some && $2 instanceof Some) {
      let s = $[0];
      let u = $1[0];
      let h = $2[0];
      return prepend(
        s,
        prepend(
          "://",
          prepend(u, prepend("@", prepend(h, parts$4)))
        )
      );
    } else if ($ instanceof Some && $1 instanceof None && $2 instanceof Some) {
      let s = $[0];
      let h = $2[0];
      return prepend(s, prepend("://", prepend(h, parts$4)));
    } else if ($ instanceof Some && $1 instanceof Some && $2 instanceof None) {
      let s = $[0];
      return prepend(s, prepend(":", parts$4));
    } else if ($ instanceof Some && $1 instanceof None && $2 instanceof None) {
      let s = $[0];
      return prepend(s, prepend(":", parts$4));
    } else if ($ instanceof None && $1 instanceof None && $2 instanceof Some) {
      let h = $2[0];
      return prepend("//", prepend(h, parts$4));
    } else {
      return parts$4;
    }
  })();
  return concat2(parts$5);
}
function drop_last(elements2) {
  return take(elements2, length(elements2) - 1);
}
function join_segments(segments) {
  return join(prepend("", segments), "/");
}
function merge(base, relative3) {
  if (base instanceof Uri && base.scheme instanceof Some && base.host instanceof Some) {
    if (relative3 instanceof Uri && relative3.host instanceof Some) {
      let path2 = (() => {
        let _pipe = split2(relative3.path, "/");
        let _pipe$1 = remove_dot_segments(_pipe);
        return join_segments(_pipe$1);
      })();
      let resolved = new Uri(
        or(relative3.scheme, base.scheme),
        new None(),
        relative3.host,
        or(relative3.port, base.port),
        path2,
        relative3.query,
        relative3.fragment
      );
      return new Ok(resolved);
    } else {
      let $ = (() => {
        let $1 = relative3.path;
        if ($1 === "") {
          return [base.path, or(relative3.query, base.query)];
        } else {
          let path_segments$1 = (() => {
            let $2 = starts_with(relative3.path, "/");
            if ($2) {
              return split2(relative3.path, "/");
            } else {
              let _pipe = split2(base.path, "/");
              let _pipe$1 = drop_last(_pipe);
              return append(_pipe$1, split2(relative3.path, "/"));
            }
          })();
          let path2 = (() => {
            let _pipe = path_segments$1;
            let _pipe$1 = remove_dot_segments(_pipe);
            return join_segments(_pipe$1);
          })();
          return [path2, relative3.query];
        }
      })();
      let new_path = $[0];
      let new_query = $[1];
      let resolved = new Uri(
        base.scheme,
        new None(),
        base.host,
        base.port,
        new_path,
        new_query,
        relative3.fragment
      );
      return new Ok(resolved);
    }
  } else {
    return new Error(void 0);
  }
}
var empty = /* @__PURE__ */ new Uri(
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  "",
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None()
);
function parse(uri_string) {
  return parse_scheme_loop(uri_string, uri_string, empty, 0);
}

// build/dev/javascript/gleam_stdlib/gleam_stdlib_decode_ffi.mjs
function index2(data, key2) {
  if (data instanceof Dict || data instanceof WeakMap || data instanceof Map) {
    const token = {};
    const entry = data.get(key2, token);
    if (entry === token) return new Ok(new None());
    return new Ok(new Some(entry));
  }
  const key_is_int = Number.isInteger(key2);
  if (key_is_int && key2 >= 0 && key2 < 8 && data instanceof List) {
    let i = 0;
    for (const value3 of data) {
      if (i === key2) return new Ok(new Some(value3));
      i++;
    }
    return new Error("Indexable");
  }
  if (key_is_int && Array.isArray(data) || data && typeof data === "object" || data && Object.getPrototypeOf(data) === Object.prototype) {
    if (key2 in data) return new Ok(new Some(data[key2]));
    return new Ok(new None());
  }
  return new Error(key_is_int ? "Indexable" : "Dict");
}
function list(data, decode3, pushPath, index5, emptyList) {
  if (!(data instanceof List || Array.isArray(data))) {
    const error = new DecodeError2("List", classify_dynamic(data), emptyList);
    return [emptyList, List.fromArray([error])];
  }
  const decoded = [];
  for (const element2 of data) {
    const layer = decode3(element2);
    const [out, errors] = layer;
    if (errors instanceof NonEmpty) {
      const [_, errors2] = pushPath(layer, index5.toString());
      return [emptyList, errors2];
    }
    decoded.push(out);
    index5++;
  }
  return [List.fromArray(decoded), emptyList];
}
function int(data) {
  if (Number.isInteger(data)) return new Ok(data);
  return new Error(0);
}
function string2(data) {
  if (typeof data === "string") return new Ok(data);
  return new Error("");
}
function is_null(data) {
  return data === null || data === void 0;
}

// build/dev/javascript/gleam_stdlib/gleam/dynamic/decode.mjs
var DecodeError2 = class extends CustomType {
  constructor(expected, found, path2) {
    super();
    this.expected = expected;
    this.found = found;
    this.path = path2;
  }
};
var Decoder = class extends CustomType {
  constructor(function$) {
    super();
    this.function = function$;
  }
};
function run(data, decoder) {
  let $ = decoder.function(data);
  let maybe_invalid_data = $[0];
  let errors = $[1];
  if (errors.hasLength(0)) {
    return new Ok(maybe_invalid_data);
  } else {
    return new Error(errors);
  }
}
function success(data) {
  return new Decoder((_) => {
    return [data, toList([])];
  });
}
function map4(decoder, transformer) {
  return new Decoder(
    (d) => {
      let $ = decoder.function(d);
      let data = $[0];
      let errors = $[1];
      return [transformer(data), errors];
    }
  );
}
function then$3(decoder, next) {
  return new Decoder(
    (dynamic_data) => {
      let $ = decoder.function(dynamic_data);
      let data = $[0];
      let errors = $[1];
      let decoder$1 = next(data);
      let $1 = decoder$1.function(dynamic_data);
      let layer = $1;
      let data$1 = $1[0];
      if (errors.hasLength(0)) {
        return layer;
      } else {
        return [data$1, errors];
      }
    }
  );
}
function run_decoders(loop$data, loop$failure, loop$decoders) {
  while (true) {
    let data = loop$data;
    let failure2 = loop$failure;
    let decoders = loop$decoders;
    if (decoders.hasLength(0)) {
      return failure2;
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder.function(data);
      let layer = $;
      let errors = $[1];
      if (errors.hasLength(0)) {
        return layer;
      } else {
        loop$data = data;
        loop$failure = failure2;
        loop$decoders = decoders$1;
      }
    }
  }
}
function one_of(first2, alternatives) {
  return new Decoder(
    (dynamic_data) => {
      let $ = first2.function(dynamic_data);
      let layer = $;
      let errors = $[1];
      if (errors.hasLength(0)) {
        return layer;
      } else {
        return run_decoders(dynamic_data, layer, alternatives);
      }
    }
  );
}
function optional(inner) {
  return new Decoder(
    (data) => {
      let $ = is_null(data);
      if ($) {
        return [new None(), toList([])];
      } else {
        let $1 = inner.function(data);
        let data$1 = $1[0];
        let errors = $1[1];
        return [new Some(data$1), errors];
      }
    }
  );
}
function decode_error(expected, found) {
  return toList([
    new DecodeError2(expected, classify_dynamic(found), toList([]))
  ]);
}
function run_dynamic_function(data, name, f) {
  let $ = f(data);
  if ($.isOk()) {
    let data$1 = $[0];
    return [data$1, toList([])];
  } else {
    let zero = $[0];
    return [
      zero,
      toList([new DecodeError2(name, classify_dynamic(data), toList([]))])
    ];
  }
}
function decode_bool2(data) {
  let $ = isEqual(identity(true), data);
  if ($) {
    return [true, toList([])];
  } else {
    let $1 = isEqual(identity(false), data);
    if ($1) {
      return [false, toList([])];
    } else {
      return [false, decode_error("Bool", data)];
    }
  }
}
function decode_int2(data) {
  return run_dynamic_function(data, "Int", int);
}
function failure(zero, expected) {
  return new Decoder((d) => {
    return [zero, decode_error(expected, d)];
  });
}
var bool = /* @__PURE__ */ new Decoder(decode_bool2);
var int2 = /* @__PURE__ */ new Decoder(decode_int2);
function decode_string2(data) {
  return run_dynamic_function(data, "String", string2);
}
var string3 = /* @__PURE__ */ new Decoder(decode_string2);
function list2(inner) {
  return new Decoder(
    (data) => {
      return list(
        data,
        inner.function,
        (p2, k) => {
          return push_path2(p2, toList([k]));
        },
        0,
        toList([])
      );
    }
  );
}
function push_path2(layer, path2) {
  let decoder = one_of(
    string3,
    toList([
      (() => {
        let _pipe = int2;
        return map4(_pipe, to_string);
      })()
    ])
  );
  let path$1 = map2(
    path2,
    (key2) => {
      let key$1 = identity(key2);
      let $ = run(key$1, decoder);
      if ($.isOk()) {
        let key$2 = $[0];
        return key$2;
      } else {
        return "<" + classify_dynamic(key$1) + ">";
      }
    }
  );
  let errors = map2(
    layer[1],
    (error) => {
      let _record = error;
      return new DecodeError2(
        _record.expected,
        _record.found,
        append(path$1, error.path)
      );
    }
  );
  return [layer[0], errors];
}
function index3(loop$path, loop$position, loop$inner, loop$data, loop$handle_miss) {
  while (true) {
    let path2 = loop$path;
    let position = loop$position;
    let inner = loop$inner;
    let data = loop$data;
    let handle_miss = loop$handle_miss;
    if (path2.hasLength(0)) {
      let _pipe = inner(data);
      return push_path2(_pipe, reverse(position));
    } else {
      let key2 = path2.head;
      let path$1 = path2.tail;
      let $ = index2(data, key2);
      if ($.isOk() && $[0] instanceof Some) {
        let data$1 = $[0][0];
        loop$path = path$1;
        loop$position = prepend(key2, position);
        loop$inner = inner;
        loop$data = data$1;
        loop$handle_miss = handle_miss;
      } else if ($.isOk() && $[0] instanceof None) {
        return handle_miss(data, prepend(key2, position));
      } else {
        let kind = $[0];
        let $1 = inner(data);
        let default$ = $1[0];
        let _pipe = [
          default$,
          toList([new DecodeError2(kind, classify_dynamic(data), toList([]))])
        ];
        return push_path2(_pipe, reverse(position));
      }
    }
  }
}
function subfield(field_path, field_decoder, next) {
  return new Decoder(
    (data) => {
      let $ = index3(
        field_path,
        toList([]),
        field_decoder.function,
        data,
        (data2, position) => {
          let $12 = field_decoder.function(data2);
          let default$ = $12[0];
          let _pipe = [
            default$,
            toList([new DecodeError2("Field", "Nothing", toList([]))])
          ];
          return push_path2(_pipe, reverse(position));
        }
      );
      let out = $[0];
      let errors1 = $[1];
      let $1 = next(out).function(data);
      let out$1 = $1[0];
      let errors2 = $1[1];
      return [out$1, append(errors1, errors2)];
    }
  );
}
function field2(field_name, field_decoder, next) {
  return subfield(toList([field_name]), field_decoder, next);
}

// build/dev/javascript/gleam_stdlib/gleam/bool.mjs
function guard(requirement, consequence, alternative) {
  if (requirement) {
    return consequence;
  } else {
    return alternative();
  }
}

// build/dev/javascript/gleam_json/gleam_json_ffi.mjs
function json_to_string(json) {
  return JSON.stringify(json);
}
function object(entries) {
  return Object.fromEntries(entries);
}
function identity2(x2) {
  return x2;
}
function array(list3) {
  return list3.toArray();
}
function decode(string5) {
  try {
    const result = JSON.parse(string5);
    return new Ok(result);
  } catch (err) {
    return new Error(getJsonDecodeError(err, string5));
  }
}
function getJsonDecodeError(stdErr, json) {
  if (isUnexpectedEndOfInput(stdErr)) return new UnexpectedEndOfInput();
  return toUnexpectedByteError(stdErr, json);
}
function isUnexpectedEndOfInput(err) {
  const unexpectedEndOfInputRegex = /((unexpected (end|eof))|(end of data)|(unterminated string)|(json( parse error|\.parse)\: expected '(\:|\}|\])'))/i;
  return unexpectedEndOfInputRegex.test(err.message);
}
function toUnexpectedByteError(err, json) {
  let converters = [
    v8UnexpectedByteError,
    oldV8UnexpectedByteError,
    jsCoreUnexpectedByteError,
    spidermonkeyUnexpectedByteError
  ];
  for (let converter of converters) {
    let result = converter(err, json);
    if (result) return result;
  }
  return new UnexpectedByte("", 0);
}
function v8UnexpectedByteError(err) {
  const regex = /unexpected token '(.)', ".+" is not valid JSON/i;
  const match = regex.exec(err.message);
  if (!match) return null;
  const byte = toHex(match[1]);
  return new UnexpectedByte(byte, -1);
}
function oldV8UnexpectedByteError(err) {
  const regex = /unexpected token (.) in JSON at position (\d+)/i;
  const match = regex.exec(err.message);
  if (!match) return null;
  const byte = toHex(match[1]);
  const position = Number(match[2]);
  return new UnexpectedByte(byte, position);
}
function spidermonkeyUnexpectedByteError(err, json) {
  const regex = /(unexpected character|expected .*) at line (\d+) column (\d+)/i;
  const match = regex.exec(err.message);
  if (!match) return null;
  const line2 = Number(match[2]);
  const column = Number(match[3]);
  const position = getPositionFromMultiline(line2, column, json);
  const byte = toHex(json[position]);
  return new UnexpectedByte(byte, position);
}
function jsCoreUnexpectedByteError(err) {
  const regex = /unexpected (identifier|token) "(.)"/i;
  const match = regex.exec(err.message);
  if (!match) return null;
  const byte = toHex(match[2]);
  return new UnexpectedByte(byte, 0);
}
function toHex(char) {
  return "0x" + char.charCodeAt(0).toString(16).toUpperCase();
}
function getPositionFromMultiline(line2, column, string5) {
  if (line2 === 1) return column - 1;
  let currentLn = 1;
  let position = 0;
  string5.split("").find((char, idx) => {
    if (char === "\n") currentLn += 1;
    if (currentLn === line2) {
      position = idx + column;
      return true;
    }
    return false;
  });
  return position;
}

// build/dev/javascript/gleam_json/gleam/json.mjs
var UnexpectedEndOfInput = class extends CustomType {
};
var UnexpectedByte = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UnexpectedFormat = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UnableToDecode = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
function do_parse(json, decoder) {
  return then$2(
    decode(json),
    (dynamic_value) => {
      let _pipe = run(dynamic_value, decoder);
      return map_error(
        _pipe,
        (var0) => {
          return new UnableToDecode(var0);
        }
      );
    }
  );
}
function parse2(json, decoder) {
  return do_parse(json, decoder);
}
function to_string3(json) {
  return json_to_string(json);
}
function string4(input2) {
  return identity2(input2);
}
function object2(entries) {
  return object(entries);
}
function preprocessed_array(from2) {
  return array(from2);
}
function array2(entries, inner_type) {
  let _pipe = entries;
  let _pipe$1 = map2(_pipe, inner_type);
  return preprocessed_array(_pipe$1);
}

// build/dev/javascript/lustre/lustre/effect.mjs
var Effect = class extends CustomType {
  constructor(all2) {
    super();
    this.all = all2;
  }
};
function custom(run2) {
  return new Effect(
    toList([
      (actions) => {
        return run2(actions.dispatch, actions.emit, actions.select, actions.root);
      }
    ])
  );
}
function from(effect) {
  return custom((dispatch, _, _1, _2) => {
    return effect(dispatch);
  });
}
function none() {
  return new Effect(toList([]));
}
function batch(effects) {
  return new Effect(
    fold(
      effects,
      toList([]),
      (b, _use1) => {
        let a2 = _use1.all;
        return append(b, a2);
      }
    )
  );
}

// build/dev/javascript/lustre/lustre/internals/vdom.mjs
var Text = class extends CustomType {
  constructor(content2) {
    super();
    this.content = content2;
  }
};
var Element = class extends CustomType {
  constructor(key2, namespace2, tag, attrs, children2, self_closing, void$) {
    super();
    this.key = key2;
    this.namespace = namespace2;
    this.tag = tag;
    this.attrs = attrs;
    this.children = children2;
    this.self_closing = self_closing;
    this.void = void$;
  }
};
var Map2 = class extends CustomType {
  constructor(subtree) {
    super();
    this.subtree = subtree;
  }
};
var Attribute = class extends CustomType {
  constructor(x0, x1, as_property) {
    super();
    this[0] = x0;
    this[1] = x1;
    this.as_property = as_property;
  }
};
var Event = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
function attribute_to_event_handler(attribute2) {
  if (attribute2 instanceof Attribute) {
    return new Error(void 0);
  } else {
    let name = attribute2[0];
    let handler = attribute2[1];
    let name$1 = drop_start(name, 2);
    return new Ok([name$1, handler]);
  }
}
function do_element_list_handlers(elements2, handlers2, key2) {
  return index_fold(
    elements2,
    handlers2,
    (handlers3, element2, index5) => {
      let key$1 = key2 + "-" + to_string(index5);
      return do_handlers(element2, handlers3, key$1);
    }
  );
}
function do_handlers(loop$element, loop$handlers, loop$key) {
  while (true) {
    let element2 = loop$element;
    let handlers2 = loop$handlers;
    let key2 = loop$key;
    if (element2 instanceof Text) {
      return handlers2;
    } else if (element2 instanceof Map2) {
      let subtree = element2.subtree;
      loop$element = subtree();
      loop$handlers = handlers2;
      loop$key = key2;
    } else {
      let attrs = element2.attrs;
      let children2 = element2.children;
      let handlers$1 = fold(
        attrs,
        handlers2,
        (handlers3, attr) => {
          let $ = attribute_to_event_handler(attr);
          if ($.isOk()) {
            let name = $[0][0];
            let handler = $[0][1];
            return insert(handlers3, key2 + "-" + name, handler);
          } else {
            return handlers3;
          }
        }
      );
      return do_element_list_handlers(children2, handlers$1, key2);
    }
  }
}
function handlers(element2) {
  return do_handlers(element2, new_map(), "0");
}

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute(name, value3) {
  return new Attribute(name, identity(value3), false);
}
function property(name, value3) {
  return new Attribute(name, identity(value3), true);
}
function on(name, handler) {
  return new Event("on" + name, handler);
}
function class$(name) {
  return attribute("class", name);
}
function id(name) {
  return attribute("id", name);
}
function type_(name) {
  return attribute("type", name);
}
function value(val) {
  return attribute("value", val);
}
function placeholder(text2) {
  return attribute("placeholder", text2);
}
function disabled(is_disabled) {
  return property("disabled", is_disabled);
}
function for$(id2) {
  return attribute("for", id2);
}
function href(uri) {
  return attribute("href", uri);
}

// build/dev/javascript/lustre/lustre/element.mjs
function element(tag, attrs, children2) {
  if (tag === "area") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "base") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "br") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "col") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "embed") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "hr") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "img") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "input") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "link") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "meta") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "param") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "source") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "track") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else if (tag === "wbr") {
    return new Element("", "", tag, attrs, toList([]), false, true);
  } else {
    return new Element("", "", tag, attrs, children2, false, false);
  }
}
function namespaced(namespace2, tag, attrs, children2) {
  return new Element("", namespace2, tag, attrs, children2, false, false);
}
function text(content2) {
  return new Text(content2);
}
function none2() {
  return new Text("");
}

// build/dev/javascript/gleam_stdlib/gleam/set.mjs
var Set2 = class extends CustomType {
  constructor(dict2) {
    super();
    this.dict = dict2;
  }
};
function new$2() {
  return new Set2(new_map());
}

// build/dev/javascript/lustre/lustre/internals/patch.mjs
var Diff = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Emit = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Init = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
function is_empty_element_diff(diff2) {
  return isEqual(diff2.created, new_map()) && isEqual(
    diff2.removed,
    new$2()
  ) && isEqual(diff2.updated, new_map());
}

// build/dev/javascript/lustre/lustre/internals/runtime.mjs
var Attrs = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Batch = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Debug = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Dispatch = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var Emit2 = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Event2 = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Shutdown = class extends CustomType {
};
var Subscribe = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Unsubscribe = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ForceModel = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};

// build/dev/javascript/lustre/vdom.ffi.mjs
if (globalThis.customElements && !globalThis.customElements.get("lustre-fragment")) {
  globalThis.customElements.define(
    "lustre-fragment",
    class LustreFragment extends HTMLElement {
      constructor() {
        super();
      }
    }
  );
}
function morph(prev, next, dispatch) {
  let out;
  let stack = [{ prev, next, parent: prev.parentNode }];
  while (stack.length) {
    let { prev: prev2, next: next2, parent } = stack.pop();
    while (next2.subtree !== void 0) next2 = next2.subtree();
    if (next2.content !== void 0) {
      if (!prev2) {
        const created = document.createTextNode(next2.content);
        parent.appendChild(created);
        out ??= created;
      } else if (prev2.nodeType === Node.TEXT_NODE) {
        if (prev2.textContent !== next2.content) prev2.textContent = next2.content;
        out ??= prev2;
      } else {
        const created = document.createTextNode(next2.content);
        parent.replaceChild(created, prev2);
        out ??= created;
      }
    } else if (next2.tag !== void 0) {
      const created = createElementNode({
        prev: prev2,
        next: next2,
        dispatch,
        stack
      });
      if (!prev2) {
        parent.appendChild(created);
      } else if (prev2 !== created) {
        parent.replaceChild(created, prev2);
      }
      out ??= created;
    }
  }
  return out;
}
function createElementNode({ prev, next, dispatch, stack }) {
  const namespace2 = next.namespace || "http://www.w3.org/1999/xhtml";
  const canMorph = prev && prev.nodeType === Node.ELEMENT_NODE && prev.localName === next.tag && prev.namespaceURI === (next.namespace || "http://www.w3.org/1999/xhtml");
  const el = canMorph ? prev : namespace2 ? document.createElementNS(namespace2, next.tag) : document.createElement(next.tag);
  let handlersForEl;
  if (!registeredHandlers.has(el)) {
    const emptyHandlers = /* @__PURE__ */ new Map();
    registeredHandlers.set(el, emptyHandlers);
    handlersForEl = emptyHandlers;
  } else {
    handlersForEl = registeredHandlers.get(el);
  }
  const prevHandlers = canMorph ? new Set(handlersForEl.keys()) : null;
  const prevAttributes = canMorph ? new Set(Array.from(prev.attributes, (a2) => a2.name)) : null;
  let className = null;
  let style2 = null;
  let innerHTML = null;
  if (canMorph && next.tag === "textarea") {
    const innertText = next.children[Symbol.iterator]().next().value?.content;
    if (innertText !== void 0) el.value = innertText;
  }
  const delegated = [];
  for (const attr of next.attrs) {
    const name = attr[0];
    const value3 = attr[1];
    if (attr.as_property) {
      if (el[name] !== value3) el[name] = value3;
      if (canMorph) prevAttributes.delete(name);
    } else if (name.startsWith("on")) {
      const eventName = name.slice(2);
      const callback = dispatch(value3, eventName === "input");
      if (!handlersForEl.has(eventName)) {
        el.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      if (canMorph) prevHandlers.delete(eventName);
    } else if (name.startsWith("data-lustre-on-")) {
      const eventName = name.slice(15);
      const callback = dispatch(lustreServerEventHandler);
      if (!handlersForEl.has(eventName)) {
        el.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      el.setAttribute(name, value3);
      if (canMorph) {
        prevHandlers.delete(eventName);
        prevAttributes.delete(name);
      }
    } else if (name.startsWith("delegate:data-") || name.startsWith("delegate:aria-")) {
      el.setAttribute(name, value3);
      delegated.push([name.slice(10), value3]);
    } else if (name === "class") {
      className = className === null ? value3 : className + " " + value3;
    } else if (name === "style") {
      style2 = style2 === null ? value3 : style2 + value3;
    } else if (name === "dangerous-unescaped-html") {
      innerHTML = value3;
    } else {
      if (el.getAttribute(name) !== value3) el.setAttribute(name, value3);
      if (name === "value" || name === "selected") el[name] = value3;
      if (canMorph) prevAttributes.delete(name);
    }
  }
  if (className !== null) {
    el.setAttribute("class", className);
    if (canMorph) prevAttributes.delete("class");
  }
  if (style2 !== null) {
    el.setAttribute("style", style2);
    if (canMorph) prevAttributes.delete("style");
  }
  if (canMorph) {
    for (const attr of prevAttributes) {
      el.removeAttribute(attr);
    }
    for (const eventName of prevHandlers) {
      handlersForEl.delete(eventName);
      el.removeEventListener(eventName, lustreGenericEventHandler);
    }
  }
  if (next.tag === "slot") {
    window.queueMicrotask(() => {
      for (const child of el.assignedElements()) {
        for (const [name, value3] of delegated) {
          if (!child.hasAttribute(name)) {
            child.setAttribute(name, value3);
          }
        }
      }
    });
  }
  if (next.key !== void 0 && next.key !== "") {
    el.setAttribute("data-lustre-key", next.key);
  } else if (innerHTML !== null) {
    el.innerHTML = innerHTML;
    return el;
  }
  let prevChild = el.firstChild;
  let seenKeys = null;
  let keyedChildren = null;
  let incomingKeyedChildren = null;
  let firstChild = children(next).next().value;
  if (canMorph && firstChild !== void 0 && // Explicit checks are more verbose but truthy checks force a bunch of comparisons
  // we don't care about: it's never gonna be a number etc.
  firstChild.key !== void 0 && firstChild.key !== "") {
    seenKeys = /* @__PURE__ */ new Set();
    keyedChildren = getKeyedChildren(prev);
    incomingKeyedChildren = getKeyedChildren(next);
    for (const child of children(next)) {
      prevChild = diffKeyedChild(
        prevChild,
        child,
        el,
        stack,
        incomingKeyedChildren,
        keyedChildren,
        seenKeys
      );
    }
  } else {
    for (const child of children(next)) {
      stack.unshift({ prev: prevChild, next: child, parent: el });
      prevChild = prevChild?.nextSibling;
    }
  }
  while (prevChild) {
    const next2 = prevChild.nextSibling;
    el.removeChild(prevChild);
    prevChild = next2;
  }
  return el;
}
var registeredHandlers = /* @__PURE__ */ new WeakMap();
function lustreGenericEventHandler(event2) {
  const target = event2.currentTarget;
  if (!registeredHandlers.has(target)) {
    target.removeEventListener(event2.type, lustreGenericEventHandler);
    return;
  }
  const handlersForEventTarget = registeredHandlers.get(target);
  if (!handlersForEventTarget.has(event2.type)) {
    target.removeEventListener(event2.type, lustreGenericEventHandler);
    return;
  }
  handlersForEventTarget.get(event2.type)(event2);
}
function lustreServerEventHandler(event2) {
  const el = event2.currentTarget;
  const tag = el.getAttribute(`data-lustre-on-${event2.type}`);
  const data = JSON.parse(el.getAttribute("data-lustre-data") || "{}");
  const include = JSON.parse(el.getAttribute("data-lustre-include") || "[]");
  switch (event2.type) {
    case "input":
    case "change":
      include.push("target.value");
      break;
  }
  return {
    tag,
    data: include.reduce(
      (data2, property2) => {
        const path2 = property2.split(".");
        for (let i = 0, o = data2, e = event2; i < path2.length; i++) {
          if (i === path2.length - 1) {
            o[path2[i]] = e[path2[i]];
          } else {
            o[path2[i]] ??= {};
            e = e[path2[i]];
            o = o[path2[i]];
          }
        }
        return data2;
      },
      { data }
    )
  };
}
function getKeyedChildren(el) {
  const keyedChildren = /* @__PURE__ */ new Map();
  if (el) {
    for (const child of children(el)) {
      const key2 = child?.key || child?.getAttribute?.("data-lustre-key");
      if (key2) keyedChildren.set(key2, child);
    }
  }
  return keyedChildren;
}
function diffKeyedChild(prevChild, child, el, stack, incomingKeyedChildren, keyedChildren, seenKeys) {
  while (prevChild && !incomingKeyedChildren.has(prevChild.getAttribute("data-lustre-key"))) {
    const nextChild = prevChild.nextSibling;
    el.removeChild(prevChild);
    prevChild = nextChild;
  }
  if (keyedChildren.size === 0) {
    stack.unshift({ prev: prevChild, next: child, parent: el });
    prevChild = prevChild?.nextSibling;
    return prevChild;
  }
  if (seenKeys.has(child.key)) {
    console.warn(`Duplicate key found in Lustre vnode: ${child.key}`);
    stack.unshift({ prev: null, next: child, parent: el });
    return prevChild;
  }
  seenKeys.add(child.key);
  const keyedChild = keyedChildren.get(child.key);
  if (!keyedChild && !prevChild) {
    stack.unshift({ prev: null, next: child, parent: el });
    return prevChild;
  }
  if (!keyedChild && prevChild !== null) {
    const placeholder2 = document.createTextNode("");
    el.insertBefore(placeholder2, prevChild);
    stack.unshift({ prev: placeholder2, next: child, parent: el });
    return prevChild;
  }
  if (!keyedChild || keyedChild === prevChild) {
    stack.unshift({ prev: prevChild, next: child, parent: el });
    prevChild = prevChild?.nextSibling;
    return prevChild;
  }
  el.insertBefore(keyedChild, prevChild);
  stack.unshift({ prev: keyedChild, next: child, parent: el });
  return prevChild;
}
function* children(element2) {
  for (const child of element2.children) {
    yield* forceChild(child);
  }
}
function* forceChild(element2) {
  if (element2.subtree !== void 0) {
    yield* forceChild(element2.subtree());
  } else {
    yield element2;
  }
}

// build/dev/javascript/lustre/lustre.ffi.mjs
var LustreClientApplication = class _LustreClientApplication {
  /**
   * @template Flags
   *
   * @param {object} app
   * @param {(flags: Flags) => [Model, Lustre.Effect<Msg>]} app.init
   * @param {(msg: Msg, model: Model) => [Model, Lustre.Effect<Msg>]} app.update
   * @param {(model: Model) => Lustre.Element<Msg>} app.view
   * @param {string | HTMLElement} selector
   * @param {Flags} flags
   *
   * @returns {Gleam.Ok<(action: Lustre.Action<Lustre.Client, Msg>>) => void>}
   */
  static start({ init: init5, update: update2, view: view2 }, selector, flags) {
    if (!is_browser()) return new Error(new NotABrowser());
    const root = selector instanceof HTMLElement ? selector : document.querySelector(selector);
    if (!root) return new Error(new ElementNotFound(selector));
    const app = new _LustreClientApplication(root, init5(flags), update2, view2);
    return new Ok((action) => app.send(action));
  }
  /**
   * @param {Element} root
   * @param {[Model, Lustre.Effect<Msg>]} init
   * @param {(model: Model, msg: Msg) => [Model, Lustre.Effect<Msg>]} update
   * @param {(model: Model) => Lustre.Element<Msg>} view
   *
   * @returns {LustreClientApplication}
   */
  constructor(root, [init5, effects], update2, view2) {
    this.root = root;
    this.#model = init5;
    this.#update = update2;
    this.#view = view2;
    this.#tickScheduled = window.setTimeout(
      () => this.#tick(effects.all.toArray(), true),
      0
    );
  }
  /** @type {Element} */
  root;
  /**
   * @param {Lustre.Action<Lustre.Client, Msg>} action
   *
   * @returns {void}
   */
  send(action) {
    if (action instanceof Debug) {
      if (action[0] instanceof ForceModel) {
        this.#tickScheduled = window.clearTimeout(this.#tickScheduled);
        this.#queue = [];
        this.#model = action[0][0];
        const vdom = this.#view(this.#model);
        const dispatch = (handler, immediate = false) => (event2) => {
          const result = handler(event2);
          if (result instanceof Ok) {
            this.send(new Dispatch(result[0], immediate));
          }
        };
        const prev = this.root.firstChild ?? this.root.appendChild(document.createTextNode(""));
        morph(prev, vdom, dispatch);
      }
    } else if (action instanceof Dispatch) {
      const msg = action[0];
      const immediate = action[1] ?? false;
      this.#queue.push(msg);
      if (immediate) {
        this.#tickScheduled = window.clearTimeout(this.#tickScheduled);
        this.#tick();
      } else if (!this.#tickScheduled) {
        this.#tickScheduled = window.setTimeout(() => this.#tick());
      }
    } else if (action instanceof Emit2) {
      const event2 = action[0];
      const data = action[1];
      this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
    } else if (action instanceof Shutdown) {
      this.#tickScheduled = window.clearTimeout(this.#tickScheduled);
      this.#model = null;
      this.#update = null;
      this.#view = null;
      this.#queue = null;
      while (this.root.firstChild) {
        this.root.firstChild.remove();
      }
    }
  }
  /** @type {Model} */
  #model;
  /** @type {(model: Model, msg: Msg) => [Model, Lustre.Effect<Msg>]} */
  #update;
  /** @type {(model: Model) => Lustre.Element<Msg>} */
  #view;
  /** @type {Array<Msg>} */
  #queue = [];
  /** @type {number | undefined} */
  #tickScheduled;
  /**
   * @param {Lustre.Effect<Msg>[]} effects
   */
  #tick(effects = []) {
    this.#tickScheduled = void 0;
    this.#flush(effects);
    const vdom = this.#view(this.#model);
    const dispatch = (handler, immediate = false) => (event2) => {
      const result = handler(event2);
      if (result instanceof Ok) {
        this.send(new Dispatch(result[0], immediate));
      }
    };
    const prev = this.root.firstChild ?? this.root.appendChild(document.createTextNode(""));
    morph(prev, vdom, dispatch);
  }
  #flush(effects = []) {
    while (this.#queue.length > 0) {
      const msg = this.#queue.shift();
      const [next, effect] = this.#update(this.#model, msg);
      effects = effects.concat(effect.all.toArray());
      this.#model = next;
    }
    while (effects.length > 0) {
      const effect = effects.shift();
      const dispatch = (msg) => this.send(new Dispatch(msg));
      const emit2 = (event2, data) => this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
      const select = () => {
      };
      const root = this.root;
      effect({ dispatch, emit: emit2, select, root });
    }
    if (this.#queue.length > 0) {
      this.#flush(effects);
    }
  }
};
var start = LustreClientApplication.start;
var LustreServerApplication = class _LustreServerApplication {
  static start({ init: init5, update: update2, view: view2, on_attribute_change }, flags) {
    const app = new _LustreServerApplication(
      init5(flags),
      update2,
      view2,
      on_attribute_change
    );
    return new Ok((action) => app.send(action));
  }
  constructor([model, effects], update2, view2, on_attribute_change) {
    this.#model = model;
    this.#update = update2;
    this.#view = view2;
    this.#html = view2(model);
    this.#onAttributeChange = on_attribute_change;
    this.#renderers = /* @__PURE__ */ new Map();
    this.#handlers = handlers(this.#html);
    this.#tick(effects.all.toArray());
  }
  send(action) {
    if (action instanceof Attrs) {
      for (const attr of action[0]) {
        const decoder = this.#onAttributeChange.get(attr[0]);
        if (!decoder) continue;
        const msg = decoder(attr[1]);
        if (msg instanceof Error) continue;
        this.#queue.push(msg);
      }
      this.#tick();
    } else if (action instanceof Batch) {
      this.#queue = this.#queue.concat(action[0].toArray());
      this.#tick(action[1].all.toArray());
    } else if (action instanceof Debug) {
    } else if (action instanceof Dispatch) {
      this.#queue.push(action[0]);
      this.#tick();
    } else if (action instanceof Emit2) {
      const event2 = new Emit(action[0], action[1]);
      for (const [_, renderer] of this.#renderers) {
        renderer(event2);
      }
    } else if (action instanceof Event2) {
      const handler = this.#handlers.get(action[0]);
      if (!handler) return;
      const msg = handler(action[1]);
      if (msg instanceof Error) return;
      this.#queue.push(msg[0]);
      this.#tick();
    } else if (action instanceof Subscribe) {
      const attrs = keys(this.#onAttributeChange);
      const patch = new Init(attrs, this.#html);
      this.#renderers = this.#renderers.set(action[0], action[1]);
      action[1](patch);
    } else if (action instanceof Unsubscribe) {
      this.#renderers = this.#renderers.delete(action[0]);
    }
  }
  #model;
  #update;
  #queue;
  #view;
  #html;
  #renderers;
  #handlers;
  #onAttributeChange;
  #tick(effects = []) {
    this.#flush(effects);
    const vdom = this.#view(this.#model);
    const diff2 = elements(this.#html, vdom);
    if (!is_empty_element_diff(diff2)) {
      const patch = new Diff(diff2);
      for (const [_, renderer] of this.#renderers) {
        renderer(patch);
      }
    }
    this.#html = vdom;
    this.#handlers = diff2.handlers;
  }
  #flush(effects = []) {
    while (this.#queue.length > 0) {
      const msg = this.#queue.shift();
      const [next, effect] = this.#update(this.#model, msg);
      effects = effects.concat(effect.all.toArray());
      this.#model = next;
    }
    while (effects.length > 0) {
      const effect = effects.shift();
      const dispatch = (msg) => this.send(new Dispatch(msg));
      const emit2 = (event2, data) => this.root.dispatchEvent(
        new CustomEvent(event2, {
          detail: data,
          bubbles: true,
          composed: true
        })
      );
      const select = () => {
      };
      const root = null;
      effect({ dispatch, emit: emit2, select, root });
    }
    if (this.#queue.length > 0) {
      this.#flush(effects);
    }
  }
};
var start_server_application = LustreServerApplication.start;
var is_browser = () => globalThis.window && window.document;
var prevent_default = (event2) => event2.preventDefault();

// build/dev/javascript/lustre/lustre.mjs
var App = class extends CustomType {
  constructor(init5, update2, view2, on_attribute_change) {
    super();
    this.init = init5;
    this.update = update2;
    this.view = view2;
    this.on_attribute_change = on_attribute_change;
  }
};
var ElementNotFound = class extends CustomType {
  constructor(selector) {
    super();
    this.selector = selector;
  }
};
var NotABrowser = class extends CustomType {
};
function application(init5, update2, view2) {
  return new App(init5, update2, view2, new None());
}
function start2(app, selector, flags) {
  return guard(
    !is_browser(),
    new Error(new NotABrowser()),
    () => {
      return start(app, selector, flags);
    }
  );
}

// build/dev/javascript/lustre/lustre/element/html.mjs
function h1(attrs, children2) {
  return element("h1", attrs, children2);
}
function h2(attrs, children2) {
  return element("h2", attrs, children2);
}
function h3(attrs, children2) {
  return element("h3", attrs, children2);
}
function h4(attrs, children2) {
  return element("h4", attrs, children2);
}
function h6(attrs, children2) {
  return element("h6", attrs, children2);
}
function nav(attrs, children2) {
  return element("nav", attrs, children2);
}
function div(attrs, children2) {
  return element("div", attrs, children2);
}
function hr(attrs) {
  return element("hr", attrs, toList([]));
}
function li(attrs, children2) {
  return element("li", attrs, children2);
}
function ol(attrs, children2) {
  return element("ol", attrs, children2);
}
function p(attrs, children2) {
  return element("p", attrs, children2);
}
function ul(attrs, children2) {
  return element("ul", attrs, children2);
}
function a(attrs, children2) {
  return element("a", attrs, children2);
}
function code(attrs, children2) {
  return element("code", attrs, children2);
}
function span(attrs, children2) {
  return element("span", attrs, children2);
}
function strong(attrs, children2) {
  return element("strong", attrs, children2);
}
function button(attrs, children2) {
  return element("button", attrs, children2);
}
function form(attrs, children2) {
  return element("form", attrs, children2);
}
function input(attrs) {
  return element("input", attrs, toList([]));
}
function label(attrs, children2) {
  return element("label", attrs, children2);
}

// build/dev/javascript/lustre/lustre/event.mjs
function on2(name, handler) {
  return on(name, handler);
}
function on_click(msg) {
  return on2("click", (_) => {
    return new Ok(msg);
  });
}
function value2(event2) {
  let _pipe = event2;
  return field("target", field("value", string))(
    _pipe
  );
}
function on_input(msg) {
  return on2(
    "input",
    (event2) => {
      let _pipe = value2(event2);
      return map3(_pipe, msg);
    }
  );
}
function on_submit(msg) {
  return on2(
    "submit",
    (event2) => {
      let $ = prevent_default(event2);
      return new Ok(msg);
    }
  );
}

// build/dev/javascript/gleam_http/gleam/http.mjs
var Get = class extends CustomType {
};
var Post = class extends CustomType {
};
var Head = class extends CustomType {
};
var Put = class extends CustomType {
};
var Delete = class extends CustomType {
};
var Trace = class extends CustomType {
};
var Connect = class extends CustomType {
};
var Options = class extends CustomType {
};
var Patch = class extends CustomType {
};
var Http = class extends CustomType {
};
var Https = class extends CustomType {
};
function method_to_string(method) {
  if (method instanceof Connect) {
    return "connect";
  } else if (method instanceof Delete) {
    return "delete";
  } else if (method instanceof Get) {
    return "get";
  } else if (method instanceof Head) {
    return "head";
  } else if (method instanceof Options) {
    return "options";
  } else if (method instanceof Patch) {
    return "patch";
  } else if (method instanceof Post) {
    return "post";
  } else if (method instanceof Put) {
    return "put";
  } else if (method instanceof Trace) {
    return "trace";
  } else {
    let s = method[0];
    return s;
  }
}
function scheme_to_string(scheme) {
  if (scheme instanceof Http) {
    return "http";
  } else {
    return "https";
  }
}
function scheme_from_string(scheme) {
  let $ = lowercase(scheme);
  if ($ === "http") {
    return new Ok(new Http());
  } else if ($ === "https") {
    return new Ok(new Https());
  } else {
    return new Error(void 0);
  }
}

// build/dev/javascript/gleam_http/gleam/http/request.mjs
var Request = class extends CustomType {
  constructor(method, headers, body, scheme, host, port, path2, query) {
    super();
    this.method = method;
    this.headers = headers;
    this.body = body;
    this.scheme = scheme;
    this.host = host;
    this.port = port;
    this.path = path2;
    this.query = query;
  }
};
function to_uri(request) {
  return new Uri(
    new Some(scheme_to_string(request.scheme)),
    new None(),
    new Some(request.host),
    request.port,
    request.path,
    request.query,
    new None()
  );
}
function from_uri(uri) {
  return then$2(
    (() => {
      let _pipe = uri.scheme;
      let _pipe$1 = unwrap(_pipe, "");
      return scheme_from_string(_pipe$1);
    })(),
    (scheme) => {
      return then$2(
        (() => {
          let _pipe = uri.host;
          return to_result(_pipe, void 0);
        })(),
        (host) => {
          let req = new Request(
            new Get(),
            toList([]),
            "",
            scheme,
            host,
            uri.port,
            uri.path,
            uri.query
          );
          return new Ok(req);
        }
      );
    }
  );
}
function set_header(request, key2, value3) {
  let headers = key_set(request.headers, lowercase(key2), value3);
  let _record = request;
  return new Request(
    _record.method,
    headers,
    _record.body,
    _record.scheme,
    _record.host,
    _record.port,
    _record.path,
    _record.query
  );
}
function set_body(req, body) {
  let method = req.method;
  let headers = req.headers;
  let scheme = req.scheme;
  let host = req.host;
  let port = req.port;
  let path2 = req.path;
  let query = req.query;
  return new Request(method, headers, body, scheme, host, port, path2, query);
}
function set_method(req, method) {
  let _record = req;
  return new Request(
    method,
    _record.headers,
    _record.body,
    _record.scheme,
    _record.host,
    _record.port,
    _record.path,
    _record.query
  );
}
function to(url) {
  let _pipe = url;
  let _pipe$1 = parse(_pipe);
  return then$2(_pipe$1, from_uri);
}

// build/dev/javascript/gleam_http/gleam/http/response.mjs
var Response = class extends CustomType {
  constructor(status, headers, body) {
    super();
    this.status = status;
    this.headers = headers;
    this.body = body;
  }
};

// build/dev/javascript/gleam_javascript/gleam_javascript_ffi.mjs
var PromiseLayer = class _PromiseLayer {
  constructor(promise) {
    this.promise = promise;
  }
  static wrap(value3) {
    return value3 instanceof Promise ? new _PromiseLayer(value3) : value3;
  }
  static unwrap(value3) {
    return value3 instanceof _PromiseLayer ? value3.promise : value3;
  }
};
function resolve(value3) {
  return Promise.resolve(PromiseLayer.wrap(value3));
}
function then_await(promise, fn) {
  return promise.then((value3) => fn(PromiseLayer.unwrap(value3)));
}
function map_promise(promise, fn) {
  return promise.then(
    (value3) => PromiseLayer.wrap(fn(PromiseLayer.unwrap(value3)))
  );
}
function rescue(promise, fn) {
  return promise.catch((error) => fn(error));
}

// build/dev/javascript/gleam_javascript/gleam/javascript/promise.mjs
function tap(promise, callback) {
  let _pipe = promise;
  return map_promise(
    _pipe,
    (a2) => {
      callback(a2);
      return a2;
    }
  );
}
function try_await(promise, callback) {
  let _pipe = promise;
  return then_await(
    _pipe,
    (result) => {
      if (result.isOk()) {
        let a2 = result[0];
        return callback(a2);
      } else {
        let e = result[0];
        return resolve(new Error(e));
      }
    }
  );
}

// build/dev/javascript/gleam_fetch/gleam_fetch_ffi.mjs
async function raw_send(request) {
  try {
    return new Ok(await fetch(request));
  } catch (error) {
    return new Error(new NetworkError(error.toString()));
  }
}
function from_fetch_response(response) {
  return new Response(
    response.status,
    List.fromArray([...response.headers]),
    response
  );
}
function request_common(request) {
  let url = to_string2(to_uri(request));
  let method = method_to_string(request.method).toUpperCase();
  let options = {
    headers: make_headers(request.headers),
    method
  };
  return [url, options];
}
function to_fetch_request(request) {
  let [url, options] = request_common(request);
  if (options.method !== "GET" && options.method !== "HEAD") options.body = request.body;
  return new globalThis.Request(url, options);
}
function make_headers(headersList) {
  let headers = new globalThis.Headers();
  for (let [k, v] of headersList) headers.append(k.toLowerCase(), v);
  return headers;
}
async function read_text_body(response) {
  let body;
  try {
    body = await response.body.text();
  } catch (error) {
    return new Error(new UnableToReadBody());
  }
  return new Ok(response.withFields({ body }));
}

// build/dev/javascript/gleam_fetch/gleam/fetch.mjs
var NetworkError = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UnableToReadBody = class extends CustomType {
};
function send(request) {
  let _pipe = request;
  let _pipe$1 = to_fetch_request(_pipe);
  let _pipe$2 = raw_send(_pipe$1);
  return try_await(
    _pipe$2,
    (resp) => {
      return resolve(new Ok(from_fetch_response(resp)));
    }
  );
}

// build/dev/javascript/lustre_http/lustre_http.mjs
var BadUrl = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var InternalServerError = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var JsonError = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var NetworkError2 = class extends CustomType {
};
var NotFound = class extends CustomType {
};
var OtherError = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var Unauthorized = class extends CustomType {
};
var ExpectTextResponse = class extends CustomType {
  constructor(run2) {
    super();
    this.run = run2;
  }
};
function do_send(req, expect, dispatch) {
  let _pipe = send(req);
  let _pipe$1 = try_await(_pipe, read_text_body);
  let _pipe$2 = map_promise(
    _pipe$1,
    (response) => {
      if (response.isOk()) {
        let res = response[0];
        return expect.run(new Ok(res));
      } else {
        return expect.run(new Error(new NetworkError2()));
      }
    }
  );
  let _pipe$3 = rescue(
    _pipe$2,
    (_) => {
      return expect.run(new Error(new NetworkError2()));
    }
  );
  tap(_pipe$3, dispatch);
  return void 0;
}
function get(url, expect) {
  return from(
    (dispatch) => {
      let $ = to(url);
      if ($.isOk()) {
        let req = $[0];
        return do_send(req, expect, dispatch);
      } else {
        return dispatch(expect.run(new Error(new BadUrl(url))));
      }
    }
  );
}
function post(url, body, expect) {
  return from(
    (dispatch) => {
      let $ = to(url);
      if ($.isOk()) {
        let req = $[0];
        let _pipe = req;
        let _pipe$1 = set_method(_pipe, new Post());
        let _pipe$2 = set_header(
          _pipe$1,
          "Content-Type",
          "application/json"
        );
        let _pipe$3 = set_body(_pipe$2, to_string3(body));
        return do_send(_pipe$3, expect, dispatch);
      } else {
        return dispatch(expect.run(new Error(new BadUrl(url))));
      }
    }
  );
}
function response_to_result(response) {
  if (response instanceof Response && (200 <= response.status && response.status <= 299)) {
    let status = response.status;
    let body = response.body;
    return new Ok(body);
  } else if (response instanceof Response && response.status === 401) {
    return new Error(new Unauthorized());
  } else if (response instanceof Response && response.status === 404) {
    return new Error(new NotFound());
  } else if (response instanceof Response && response.status === 500) {
    let body = response.body;
    return new Error(new InternalServerError(body));
  } else {
    let code2 = response.status;
    let body = response.body;
    return new Error(new OtherError(code2, body));
  }
}
function expect_json(decoder, to_msg) {
  return new ExpectTextResponse(
    (response) => {
      let _pipe = response;
      let _pipe$1 = then$2(_pipe, response_to_result);
      let _pipe$2 = then$2(
        _pipe$1,
        (body) => {
          let $ = parse2(body, decoder);
          if ($.isOk()) {
            let json = $[0];
            return new Ok(json);
          } else {
            let json_error = $[0];
            return new Error(new JsonError(json_error));
          }
        }
      );
      return to_msg(_pipe$2);
    }
  );
}

// build/dev/javascript/lustre_websocket/ffi.mjs
var init_websocket = (url, on_open, on_text, on_binary, on_close) => {
  let ws;
  if (typeof WebSocket === "function") {
    ws = new WebSocket(url);
  } else {
    ws = {};
  }
  ws.onopen = (_) => on_open(ws);
  ws.onmessage = (event2) => {
    if (typeof event2.data === "string") {
      on_text(event2.data);
    } else {
      on_binary(event2.data);
    }
  };
  ws.onclose = (event2) => on_close(event2.code);
};
var send_over_websocket = (ws, msg) => ws.send(msg);
var get_page_url = () => document.URL;

// build/dev/javascript/lustre_websocket/lustre_websocket.mjs
var Normal = class extends CustomType {
};
var GoingAway = class extends CustomType {
};
var ProtocolError = class extends CustomType {
};
var UnexpectedTypeOfData = class extends CustomType {
};
var NoCodeFromServer = class extends CustomType {
};
var AbnormalClose = class extends CustomType {
};
var IncomprehensibleFrame = class extends CustomType {
};
var PolicyViolated = class extends CustomType {
};
var MessageTooBig = class extends CustomType {
};
var FailedExtensionNegotation = class extends CustomType {
};
var UnexpectedFailure = class extends CustomType {
};
var FailedTLSHandshake = class extends CustomType {
};
var OtherCloseReason = class extends CustomType {
};
var InvalidUrl = class extends CustomType {
};
var OnOpen = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var OnTextMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var OnBinaryMessage = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var OnClose = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
function code_to_reason(code2) {
  if (code2 === 1e3) {
    return new Normal();
  } else if (code2 === 1001) {
    return new GoingAway();
  } else if (code2 === 1002) {
    return new ProtocolError();
  } else if (code2 === 1003) {
    return new UnexpectedTypeOfData();
  } else if (code2 === 1005) {
    return new NoCodeFromServer();
  } else if (code2 === 1006) {
    return new AbnormalClose();
  } else if (code2 === 1007) {
    return new IncomprehensibleFrame();
  } else if (code2 === 1008) {
    return new PolicyViolated();
  } else if (code2 === 1009) {
    return new MessageTooBig();
  } else if (code2 === 1010) {
    return new FailedExtensionNegotation();
  } else if (code2 === 1011) {
    return new UnexpectedFailure();
  } else if (code2 === 1015) {
    return new FailedTLSHandshake();
  } else {
    return new OtherCloseReason();
  }
}
function convert_scheme(scheme) {
  if (scheme === "https") {
    return new Ok("wss");
  } else if (scheme === "http") {
    return new Ok("ws");
  } else if (scheme === "ws") {
    return new Ok(scheme);
  } else if (scheme === "wss") {
    return new Ok(scheme);
  } else {
    return new Error(void 0);
  }
}
function do_get_websocket_path(path2, page_uri2) {
  let path_uri = (() => {
    let _pipe = parse(path2);
    return unwrap2(
      _pipe,
      new Uri(
        new None(),
        new None(),
        new None(),
        new None(),
        path2,
        new None(),
        new None()
      )
    );
  })();
  return try$(
    merge(page_uri2, path_uri),
    (merged) => {
      return try$(
        to_result(merged.scheme, void 0),
        (merged_scheme) => {
          return try$(
            convert_scheme(merged_scheme),
            (ws_scheme) => {
              let _pipe = (() => {
                let _record = merged;
                return new Uri(
                  new Some(ws_scheme),
                  _record.userinfo,
                  _record.host,
                  _record.port,
                  _record.path,
                  _record.query,
                  _record.fragment
                );
              })();
              let _pipe$1 = to_string2(_pipe);
              return new Ok(_pipe$1);
            }
          );
        }
      );
    }
  );
}
function send2(ws, msg) {
  return from((_) => {
    return send_over_websocket(ws, msg);
  });
}
function page_uri() {
  let _pipe = get_page_url();
  return parse(_pipe);
}
function get_websocket_path(path2) {
  let _pipe = page_uri();
  return try$(
    _pipe,
    (_capture) => {
      return do_get_websocket_path(path2, _capture);
    }
  );
}
function init2(path2, wrapper) {
  let _pipe = (dispatch) => {
    let $ = get_websocket_path(path2);
    if ($.isOk()) {
      let url = $[0];
      return init_websocket(
        url,
        (ws) => {
          return dispatch(wrapper(new OnOpen(ws)));
        },
        (text2) => {
          return dispatch(wrapper(new OnTextMessage(text2)));
        },
        (data) => {
          return dispatch(wrapper(new OnBinaryMessage(data)));
        },
        (code2) => {
          let _pipe2 = code2;
          let _pipe$1 = code_to_reason(_pipe2);
          let _pipe$2 = new OnClose(_pipe$1);
          let _pipe$3 = wrapper(_pipe$2);
          return dispatch(_pipe$3);
        }
      );
    } else {
      let _pipe2 = new InvalidUrl();
      let _pipe$1 = wrapper(_pipe2);
      return dispatch(_pipe$1);
    }
  };
  return from(_pipe);
}

// build/dev/javascript/modem/modem.ffi.mjs
var defaults = {
  handle_external_links: false,
  handle_internal_links: true
};
var initial_location = window?.location?.href;
var do_initial_uri = () => {
  if (!initial_location) {
    return new Error(void 0);
  } else {
    return new Ok(uri_from_url(new URL(initial_location)));
  }
};
var do_init = (dispatch, options = defaults) => {
  document.addEventListener("click", (event2) => {
    const a2 = find_anchor(event2.target);
    if (!a2) return;
    try {
      const url = new URL(a2.href);
      const uri = uri_from_url(url);
      const is_external = url.host !== window.location.host;
      if (!options.handle_external_links && is_external) return;
      if (!options.handle_internal_links && !is_external) return;
      event2.preventDefault();
      if (!is_external) {
        window.history.pushState({}, "", a2.href);
        window.requestAnimationFrame(() => {
          if (url.hash) {
            document.getElementById(url.hash.slice(1))?.scrollIntoView();
          }
        });
      }
      return dispatch(uri);
    } catch {
      return;
    }
  });
  window.addEventListener("popstate", (e) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    const uri = uri_from_url(url);
    window.requestAnimationFrame(() => {
      if (url.hash) {
        document.getElementById(url.hash.slice(1))?.scrollIntoView();
      }
    });
    dispatch(uri);
  });
  window.addEventListener("modem-push", ({ detail }) => {
    dispatch(detail);
  });
  window.addEventListener("modem-replace", ({ detail }) => {
    dispatch(detail);
  });
};
var do_push = (uri) => {
  window.history.pushState({}, "", to_string2(uri));
  window.requestAnimationFrame(() => {
    if (uri.fragment[0]) {
      document.getElementById(uri.fragment[0])?.scrollIntoView();
    }
  });
  window.dispatchEvent(new CustomEvent("modem-push", { detail: uri }));
};
var find_anchor = (el) => {
  if (!el || el.tagName === "BODY") {
    return null;
  } else if (el.tagName === "A") {
    return el;
  } else {
    return find_anchor(el.parentElement);
  }
};
var uri_from_url = (url) => {
  return new Uri(
    /* scheme   */
    url.protocol ? new Some(url.protocol.slice(0, -1)) : new None(),
    /* userinfo */
    new None(),
    /* host     */
    url.hostname ? new Some(url.hostname) : new None(),
    /* port     */
    url.port ? new Some(Number(url.port)) : new None(),
    /* path     */
    url.pathname,
    /* query    */
    url.search ? new Some(url.search.slice(1)) : new None(),
    /* fragment */
    url.hash ? new Some(url.hash.slice(1)) : new None()
  );
};

// build/dev/javascript/modem/modem.mjs
function init3(handler) {
  return from(
    (dispatch) => {
      return guard(
        !is_browser(),
        void 0,
        () => {
          return do_init(
            (uri) => {
              let _pipe = uri;
              let _pipe$1 = handler(_pipe);
              return dispatch(_pipe$1);
            }
          );
        }
      );
    }
  );
}
var relative = /* @__PURE__ */ new Uri(
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None(),
  "",
  /* @__PURE__ */ new None(),
  /* @__PURE__ */ new None()
);
function push(path2, query, fragment) {
  return from(
    (_) => {
      return guard(
        !is_browser(),
        void 0,
        () => {
          return do_push(
            (() => {
              let _record = relative;
              return new Uri(
                _record.scheme,
                _record.userinfo,
                _record.host,
                _record.port,
                path2,
                query,
                fragment
              );
            })()
          );
        }
      );
    }
  );
}

// build/dev/javascript/plinth/clipboard_ffi.mjs
async function writeText(clipText) {
  try {
    return new Ok(await globalThis.navigator.clipboard.writeText(clipText));
  } catch (error) {
    return new Error(error.toString());
  }
}

// build/dev/javascript/plinth/storage_ffi.mjs
function sessionStorage() {
  try {
    if (globalThis.Storage && globalThis.sessionStorage instanceof globalThis.Storage) {
      return new Ok(globalThis.sessionStorage);
    } else {
      return new Error(null);
    }
  } catch {
    return new Error(null);
  }
}
function getItem(storage, keyName) {
  return null_or(storage.getItem(keyName));
}
function setItem(storage, keyName, keyValue) {
  try {
    storage.setItem(keyName, keyValue);
    return new Ok(null);
  } catch {
    return new Error(null);
  }
}
function clear(storage) {
  storage.clear();
}
function null_or(val) {
  if (val !== null) {
    return new Ok(val);
  } else {
    return new Error(null);
  }
}

// build/dev/javascript/shared/shared.mjs
var PlayerName = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var PlayerId = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var RoomCode = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var CreateRoomRequest = class extends CustomType {
};
var JoinRoomRequest = class extends CustomType {
  constructor(room_code) {
    super();
    this.room_code = room_code;
  }
};
var ValidateNameRequest = class extends CustomType {
  constructor(player_id, name) {
    super();
    this.player_id = player_id;
    this.name = name;
  }
};
var RoomResponse = class extends CustomType {
  constructor(room_code, player_id) {
    super();
    this.room_code = room_code;
    this.player_id = player_id;
  }
};
var ValidateNameResponse = class extends CustomType {
  constructor(valid) {
    super();
    this.valid = valid;
  }
};
var AddWord = class extends CustomType {
  constructor(word) {
    super();
    this.word = word;
  }
};
var AddRandomWord = class extends CustomType {
};
var RemoveWord = class extends CustomType {
  constructor(word) {
    super();
    this.word = word;
  }
};
var ListWords = class extends CustomType {
};
var StartRound = class extends CustomType {
};
var SubmitOrderedWords = class extends CustomType {
  constructor(words) {
    super();
    this.words = words;
  }
};
var RemovePlayer = class extends CustomType {
  constructor(player_id) {
    super();
    this.player_id = player_id;
  }
};
var UnknownResponse = class extends CustomType {
  constructor(response_type) {
    super();
    this.response_type = response_type;
  }
};
var InitialRoomState = class extends CustomType {
  constructor(room) {
    super();
    this.room = room;
  }
};
var PlayersInRoom = class extends CustomType {
  constructor(players) {
    super();
    this.players = players;
  }
};
var WordList = class extends CustomType {
  constructor(word_list) {
    super();
    this.word_list = word_list;
  }
};
var RoundInfo = class extends CustomType {
  constructor(round3) {
    super();
    this.round = round3;
  }
};
var RoundResult = class extends CustomType {
  constructor(finished_round) {
    super();
    this.finished_round = finished_round;
  }
};
var ServerError = class extends CustomType {
  constructor(reason) {
    super();
    this.reason = reason;
  }
};
var Player = class extends CustomType {
  constructor(id2, name, connected) {
    super();
    this.id = id2;
    this.name = name;
    this.connected = connected;
  }
};
var Round = class extends CustomType {
  constructor(words, leading_player_id, submitted) {
    super();
    this.words = words;
    this.leading_player_id = leading_player_id;
    this.submitted = submitted;
  }
};
var FinishedRound = class extends CustomType {
  constructor(words, leading_player_id, player_scores) {
    super();
    this.words = words;
    this.leading_player_id = leading_player_id;
    this.player_scores = player_scores;
  }
};
var PlayerScore = class extends CustomType {
  constructor(player, words, score) {
    super();
    this.player = player;
    this.words = words;
    this.score = score;
  }
};
var ExactMatch = class extends CustomType {
};
var EqualPositions = class extends CustomType {
};
var Smart = class extends CustomType {
};
var Room = class extends CustomType {
  constructor(room_code, players, word_list, round3, finished_rounds, scoring_method) {
    super();
    this.room_code = room_code;
    this.players = players;
    this.word_list = word_list;
    this.round = round3;
    this.finished_rounds = finished_rounds;
    this.scoring_method = scoring_method;
  }
};
function player_name_to_string(player_name) {
  let name = player_name[0];
  return name;
}
function player_id_to_string(player_id) {
  let id2 = player_id[0];
  return id2;
}
function string_encoder(to_string4) {
  return (str) => {
    let _pipe = to_string4(str);
    return string4(_pipe);
  };
}
function encode_websocket_request(websocket_request) {
  if (websocket_request instanceof AddWord) {
    return object2(
      toList([
        ["type", string4("add_word")],
        ["word", string4(websocket_request.word)]
      ])
    );
  } else if (websocket_request instanceof AddRandomWord) {
    return object2(toList([["type", string4("add_random_word")]]));
  } else if (websocket_request instanceof RemoveWord) {
    return object2(
      toList([
        ["type", string4("remove_word")],
        ["word", string4(websocket_request.word)]
      ])
    );
  } else if (websocket_request instanceof ListWords) {
    return object2(toList([["type", string4("list_words")]]));
  } else if (websocket_request instanceof StartRound) {
    return object2(toList([["type", string4("start_round")]]));
  } else if (websocket_request instanceof SubmitOrderedWords) {
    return object2(
      toList([
        ["type", string4("submit_ordered_words")],
        ["words", array2(websocket_request.words, string4)]
      ])
    );
  } else {
    let player_id = websocket_request.player_id;
    return object2(
      toList([
        ["type", string4("remove_player")],
        [
          "player_id",
          (() => {
            let _pipe = player_id;
            return string_encoder(player_id_to_string)(_pipe);
          })()
        ]
      ])
    );
  }
}
function room_code_to_string(room_code) {
  let code2 = room_code[0];
  return code2;
}
function encode_http_request(http_request) {
  if (http_request instanceof CreateRoomRequest) {
    return object2(toList([["type", string4("create_room_request")]]));
  } else if (http_request instanceof JoinRoomRequest) {
    let room_code = http_request.room_code;
    return object2(
      toList([
        ["type", string4("join_room_request")],
        [
          "room_code",
          (() => {
            let _pipe = room_code;
            return string_encoder(room_code_to_string)(_pipe);
          })()
        ]
      ])
    );
  } else {
    let player_id = http_request.player_id;
    let name = http_request.name;
    return object2(
      toList([
        ["type", string4("validate_name_request")],
        [
          "player_id",
          (() => {
            let _pipe = player_id;
            return string_encoder(player_id_to_string)(_pipe);
          })()
        ],
        [
          "name",
          (() => {
            let _pipe = name;
            return string_encoder(player_name_to_string)(_pipe);
          })()
        ]
      ])
    );
  }
}
function encode(a2, encoder) {
  let _pipe = encoder(a2);
  return to_string3(_pipe);
}
function json_decode_err_to_string(err) {
  if (err instanceof UnableToDecode) {
    return "UnableToDecode";
  } else if (err instanceof UnexpectedByte) {
    let x2 = err[0];
    return "UnexpectedByte: " + x2;
  } else if (err instanceof UnexpectedEndOfInput) {
    return "UnexpectedEndOfInput";
  } else if (err instanceof UnexpectedFormat) {
    return "UnexpectedFormat";
  } else {
    let x2 = err[0];
    return "UnexpectedSequence: " + x2;
  }
}
function decode2(str, decoder) {
  let _pipe = parse2(str, decoder);
  return map_error(_pipe, json_decode_err_to_string);
}
function player_decoder() {
  return field2(
    "id",
    string3,
    (id2) => {
      return field2(
        "name",
        string3,
        (name) => {
          return field2(
            "connected",
            bool,
            (connected) => {
              return success(
                new Player(new PlayerId(id2), new PlayerName(name), connected)
              );
            }
          );
        }
      );
    }
  );
}
function player_score_decoder() {
  return field2(
    "player",
    player_decoder(),
    (player) => {
      return field2(
        "words",
        list2(string3),
        (words) => {
          return field2(
            "score",
            int2,
            (score) => {
              return success(new PlayerScore(player, words, score));
            }
          );
        }
      );
    }
  );
}
function scoring_method_decoder() {
  return then$3(
    string3,
    (variant) => {
      if (variant === "exact_match") {
        return success(new ExactMatch());
      } else if (variant === "equal_positions") {
        return success(new EqualPositions());
      } else if (variant === "smart") {
        return success(new Smart());
      } else {
        let str = variant;
        return failure(
          new ExactMatch(),
          "ScoringMethod unknown: " + str
        );
      }
    }
  );
}
function string_decoder(constructor) {
  return then$3(
    string3,
    (str) => {
      return success(constructor(str));
    }
  );
}
function http_response_decoder() {
  return field2(
    "type",
    string3,
    (variant) => {
      if (variant === "room_response") {
        return field2(
          "room_code",
          string_decoder((var0) => {
            return new RoomCode(var0);
          }),
          (room_code) => {
            return field2(
              "player_id",
              string_decoder((var0) => {
                return new PlayerId(var0);
              }),
              (player_id) => {
                return success(new RoomResponse(room_code, player_id));
              }
            );
          }
        );
      } else if (variant === "validate_name_response") {
        return field2(
          "valid",
          bool,
          (valid) => {
            return success(new ValidateNameResponse(valid));
          }
        );
      } else {
        let str = variant;
        return failure(
          new ValidateNameResponse(false),
          "HttpResponse: unknown response: " + str
        );
      }
    }
  );
}
function round_decoder() {
  return field2(
    "words",
    list2(string3),
    (words) => {
      return field2(
        "leading_player_id",
        string_decoder((var0) => {
          return new PlayerId(var0);
        }),
        (leading_player_id) => {
          return field2(
            "submitted",
            list2(
              string_decoder((var0) => {
                return new PlayerId(var0);
              })
            ),
            (submitted) => {
              return success(
                new Round(words, leading_player_id, submitted)
              );
            }
          );
        }
      );
    }
  );
}
function finished_round_decoder() {
  return field2(
    "words",
    list2(string3),
    (words) => {
      return field2(
        "leading_player_id",
        string_decoder((var0) => {
          return new PlayerId(var0);
        }),
        (leading_player_id) => {
          return field2(
            "player_scores",
            list2(player_score_decoder()),
            (player_scores) => {
              return success(
                new FinishedRound(words, leading_player_id, player_scores)
              );
            }
          );
        }
      );
    }
  );
}
function room_decoder() {
  return field2(
    "room_code",
    string_decoder((var0) => {
      return new RoomCode(var0);
    }),
    (room_code) => {
      return field2(
        "players",
        list2(player_decoder()),
        (players) => {
          return field2(
            "word_list",
            list2(string3),
            (word_list) => {
              return field2(
                "round",
                optional(round_decoder()),
                (round3) => {
                  return field2(
                    "finished_rounds",
                    list2(finished_round_decoder()),
                    (finished_rounds) => {
                      return field2(
                        "scoring_method",
                        scoring_method_decoder(),
                        (scoring_method) => {
                          return success(
                            new Room(
                              room_code,
                              players,
                              word_list,
                              round3,
                              finished_rounds,
                              scoring_method
                            )
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}
function websocket_response_decoder() {
  return field2(
    "type",
    string3,
    (variant) => {
      if (variant === "initial_room_state") {
        return field2(
          "room",
          room_decoder(),
          (room) => {
            return success(new InitialRoomState(room));
          }
        );
      } else if (variant === "players_in_room") {
        return field2(
          "players",
          list2(player_decoder()),
          (players) => {
            return success(new PlayersInRoom(players));
          }
        );
      } else if (variant === "word_list") {
        return field2(
          "word_list",
          list2(string3),
          (word_list) => {
            return success(new WordList(word_list));
          }
        );
      } else if (variant === "round_info") {
        return field2(
          "round",
          round_decoder(),
          (round3) => {
            return success(new RoundInfo(round3));
          }
        );
      } else if (variant === "round_result") {
        return field2(
          "finished_round",
          finished_round_decoder(),
          (finished_round) => {
            return success(new RoundResult(finished_round));
          }
        );
      } else if (variant === "server_error") {
        return field2(
          "reason",
          string3,
          (reason) => {
            return success(new ServerError(reason));
          }
        );
      } else {
        let response_type = variant;
        return failure(
          new UnknownResponse(response_type),
          "WebsocketResponse"
        );
      }
    }
  );
}

// build/dev/javascript/lustre/lustre/element/svg.mjs
var namespace = "http://www.w3.org/2000/svg";
function line(attrs) {
  return namespaced(namespace, "line", attrs, toList([]));
}
function polyline(attrs) {
  return namespaced(namespace, "polyline", attrs, toList([]));
}
function svg(attrs, children2) {
  return namespaced(namespace, "svg", attrs, children2);
}
function path(attrs) {
  return namespaced(namespace, "path", attrs, toList([]));
}

// build/dev/javascript/client/icon.mjs
function menu(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([
      line(
        toList([
          attribute("y2", "12"),
          attribute("y1", "12"),
          attribute("x2", "20"),
          attribute("x1", "4")
        ])
      ),
      line(
        toList([
          attribute("y2", "6"),
          attribute("y1", "6"),
          attribute("x2", "20"),
          attribute("x1", "4")
        ])
      ),
      line(
        toList([
          attribute("y2", "18"),
          attribute("y1", "18"),
          attribute("x2", "20"),
          attribute("x1", "4")
        ])
      )
    ])
  );
}
function check(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([path(toList([attribute("d", "M20 6 9 17l-5-5")]))])
  );
}
function x(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([
      path(toList([attribute("d", "M18 6 6 18")])),
      path(toList([attribute("d", "m6 6 12 12")]))
    ])
  );
}
function log_out(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([
      path(
        toList([attribute("d", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4")])
      ),
      polyline(toList([attribute("points", "16 17 21 12 16 7")])),
      line(
        toList([
          attribute("y2", "12"),
          attribute("y1", "12"),
          attribute("x2", "9"),
          attribute("x1", "21")
        ])
      )
    ])
  );
}
function plus(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([
      path(toList([attribute("d", "M5 12h14")])),
      path(toList([attribute("d", "M12 5v14")]))
    ])
  );
}
function house(attributes) {
  return svg(
    prepend(
      attribute("stroke-linejoin", "round"),
      prepend(
        attribute("stroke-linecap", "round"),
        prepend(
          attribute("stroke-width", "2"),
          prepend(
            attribute("stroke", "currentColor"),
            prepend(
              attribute("fill", "none"),
              prepend(
                attribute("viewBox", "0 0 24 24"),
                prepend(
                  attribute("height", "24"),
                  prepend(attribute("width", "24"), attributes)
                )
              )
            )
          )
        )
      )
    ),
    toList([
      path(
        toList([attribute("d", "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8")])
      ),
      path(
        toList([
          attribute(
            "d",
            "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          )
        ])
      )
    ])
  );
}

// build/dev/javascript/client/client.mjs
var NotInRoom = class extends CustomType {
  constructor(uri, route, room_code_input, join_room_err) {
    super();
    this.uri = uri;
    this.route = route;
    this.room_code_input = room_code_input;
    this.join_room_err = join_room_err;
  }
};
var InRoom = class extends CustomType {
  constructor(uri, player_id, room_code, player_name, active_game, display_state, error) {
    super();
    this.uri = uri;
    this.player_id = player_id;
    this.room_code = room_code;
    this.player_name = player_name;
    this.active_game = active_game;
    this.display_state = display_state;
    this.error = error;
  }
};
var ActiveGame = class extends CustomType {
  constructor(ws, room, round3, add_word_input) {
    super();
    this.ws = ws;
    this.room = room;
    this.round = round3;
    this.add_word_input = add_word_input;
  }
};
var Round2 = class extends CustomType {
};
var Scores = class extends CustomType {
};
var WordList2 = class extends CustomType {
};
var DisplayState = class extends CustomType {
  constructor(view2, menu_open) {
    super();
    this.view = view2;
    this.menu_open = menu_open;
  }
};
var RoundState = class extends CustomType {
  constructor(round3, ordered_words, submitted) {
    super();
    this.round = round3;
    this.ordered_words = ordered_words;
    this.submitted = submitted;
  }
};
var Home = class extends CustomType {
};
var Play = class extends CustomType {
  constructor(room_code) {
    super();
    this.room_code = room_code;
  }
};
var NotFound2 = class extends CustomType {
};
var OnRouteChange = class extends CustomType {
  constructor(x0, x1) {
    super();
    this[0] = x0;
    this[1] = x1;
  }
};
var WebSocketEvent = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var StartGame = class extends CustomType {
};
var JoinGame = class extends CustomType {
};
var JoinedRoom = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var NameIsValid = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var LeaveGame = class extends CustomType {
};
var ShowMenu = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var SetView = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var CopyRoomCode = class extends CustomType {
};
var UpdateRoomCode = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var UpdatePlayerName = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var SetPlayerName = class extends CustomType {
};
var UpdateAddWordInput = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var AddWord2 = class extends CustomType {
};
var AddRandomWord2 = class extends CustomType {
};
var RemoveWord2 = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var StartRound2 = class extends CustomType {
};
var AddNextPreferedWord = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ClearOrderedWords = class extends CustomType {
};
var SubmitOrderedWords2 = class extends CustomType {
};
function new_uri() {
  return new Uri(
    new None(),
    new None(),
    new None(),
    new None(),
    "",
    new None(),
    new None()
  );
}
function relative2(path2) {
  let _record = new_uri();
  return new Uri(
    _record.scheme,
    _record.userinfo,
    _record.host,
    _record.port,
    path2,
    _record.query,
    _record.fragment
  );
}
function handle_ws_message(model, msg) {
  if (model instanceof NotInRoom) {
    return [model, none()];
  } else if (model instanceof InRoom && model.active_game instanceof None) {
    return [model, none()];
  } else {
    let active_game = model.active_game[0];
    let $ = decode2(msg, websocket_response_decoder());
    if ($.isOk() && $[0] instanceof InitialRoomState) {
      let room = $[0].room;
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(
              (() => {
                let _record$1 = active_game;
                return new ActiveGame(
                  _record$1.ws,
                  new Some(room),
                  or(
                    (() => {
                      let _pipe = room.round;
                      return map(
                        _pipe,
                        (round3) => {
                          return new RoundState(round3, toList([]), false);
                        }
                      );
                    })(),
                    active_game.round
                  ),
                  _record$1.add_word_input
                );
              })()
            ),
            _record.display_state,
            _record.error
          );
        })(),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof PlayersInRoom) {
      let player_list = $[0].players;
      let room = map(
        active_game.room,
        (room2) => {
          let _record = room2;
          return new Room(
            _record.room_code,
            player_list,
            _record.word_list,
            _record.round,
            _record.finished_rounds,
            _record.scoring_method
          );
        }
      );
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(
              (() => {
                let _record$1 = active_game;
                return new ActiveGame(
                  _record$1.ws,
                  room,
                  _record$1.round,
                  _record$1.add_word_input
                );
              })()
            ),
            _record.display_state,
            _record.error
          );
        })(),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof WordList) {
      let word_list = $[0].word_list;
      let room = map(
        active_game.room,
        (room2) => {
          let _record = room2;
          return new Room(
            _record.room_code,
            _record.players,
            word_list,
            _record.round,
            _record.finished_rounds,
            _record.scoring_method
          );
        }
      );
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(
              (() => {
                let _record$1 = active_game;
                return new ActiveGame(
                  _record$1.ws,
                  room,
                  _record$1.round,
                  _record$1.add_word_input
                );
              })()
            ),
            _record.display_state,
            _record.error
          );
        })(),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof RoundInfo) {
      let round3 = $[0].round;
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(
              (() => {
                let _record$1 = active_game;
                return new ActiveGame(
                  _record$1.ws,
                  _record$1.room,
                  (() => {
                    let _pipe = then$(
                      active_game.round,
                      (active_game_round) => {
                        return new Some(
                          (() => {
                            let _record$2 = active_game_round;
                            return new RoundState(
                              round3,
                              _record$2.ordered_words,
                              _record$2.submitted
                            );
                          })()
                        );
                      }
                    );
                    return or(
                      _pipe,
                      new Some(new RoundState(round3, toList([]), false))
                    );
                  })(),
                  _record$1.add_word_input
                );
              })()
            ),
            _record.display_state,
            _record.error
          );
        })(),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof RoundResult) {
      let finished_round = $[0].finished_round;
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(
              (() => {
                let _record$1 = active_game;
                return new ActiveGame(
                  _record$1.ws,
                  (() => {
                    let _pipe = active_game.room;
                    return map(
                      _pipe,
                      (room) => {
                        let _record$2 = room;
                        return new Room(
                          _record$2.room_code,
                          _record$2.players,
                          _record$2.word_list,
                          _record$2.round,
                          prepend(finished_round, room.finished_rounds),
                          _record$2.scoring_method
                        );
                      }
                    );
                  })(),
                  new None(),
                  _record$1.add_word_input
                );
              })()
            ),
            new DisplayState(new Scores(), false),
            _record.error
          );
        })(),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof ServerError) {
      let reason = $[0].reason;
      echo(reason, "src/client.gleam", 718);
      return [model, none()];
    } else if ($.isOk() && $[0] instanceof UnknownResponse) {
      let reason = $[0].response_type;
      echo(reason, "src/client.gleam", 718);
      return [model, none()];
    } else {
      let err = $[0];
      echo(err, "src/client.gleam", 722);
      return [model, none()];
    }
  }
}
function get_route_from_uri(uri) {
  let room_code = (() => {
    let _pipe = uri.query;
    let _pipe$1 = map(_pipe, parse_query);
    return then$(
      _pipe$1,
      (query) => {
        if (query.isOk() && query[0].hasLength(1) && query[0].head[0] === "game") {
          let room_code2 = query[0].head[1];
          return new Some(room_code2);
        } else {
          return new None();
        }
      }
    );
  })();
  let $ = path_segments(uri.path);
  if ($.hasLength(1) && $.head === "") {
    return new Home();
  } else if ($.hasLength(0)) {
    return new Home();
  } else if ($.hasLength(1) && $.head === "play") {
    let room_code$1 = room_code;
    return new Play(room_code$1);
  } else {
    return new NotFound2();
  }
}
function on_url_change(uri) {
  let _pipe = get_route_from_uri(uri);
  return ((_capture) => {
    return new OnRouteChange(uri, _capture);
  })(_pipe);
}
function link(href2, content2, class_name) {
  return a(
    toList([
      class$("p-2 underline border-solid rounded m-2 " + class_name),
      href(href2)
    ]),
    content2
  );
}
function header(model) {
  if (model instanceof NotInRoom && model.route instanceof Home) {
    return h1(
      toList([class$("text-4xl my-10 text-center")]),
      toList([text("A Full Fridge")])
    );
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof Some) {
    return div(
      toList([]),
      toList([
        nav(
          toList([class$("flex items-center bg-sky-100 text-blue-900")]),
          toList([
            link(
              "/",
              toList([
                house(toList([class$("mr-2 inline")])),
                text("Home")
              ]),
              ""
            )
          ])
        ),
        h1(
          toList([class$("text-2xl my-5")]),
          toList([text("Joining game...")])
        )
      ])
    );
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof None) {
    return div(
      toList([]),
      toList([
        nav(
          toList([class$("flex items-center bg-sky-100 text-blue-900")]),
          toList([
            link(
              "/",
              toList([
                house(toList([class$("mr-2 inline")])),
                text("Home")
              ]),
              ""
            )
          ])
        ),
        h1(
          toList([class$("text-2xl my-5 mx-4")]),
          toList([text("Join game")])
        )
      ])
    );
  } else if (model instanceof InRoom && model.display_state instanceof DisplayState && !model.display_state.menu_open) {
    let room_code = model.room_code;
    return div(
      toList([class$("flex bg-green-700 text-gray-100")]),
      toList([
        h1(
          toList([class$("text-xl my-5 mx-2")]),
          toList([
            text("Game:"),
            code(
              toList([
                on_click(new CopyRoomCode()),
                attribute("title", "Copy"),
                class$(
                  "mx-1 px-1 text-gray-100 border-dashed border-2 rounded-sm border-transparent hover:border-slate-500 hover:bg-green-200 hover:text-gray-800 cursor-pointer"
                )
              ]),
              toList([text(room_code_to_string(room_code))])
            )
          ])
        ),
        button(
          toList([
            on_click(new ShowMenu(true)),
            class$("ml-auto px-3 py-2")
          ]),
          toList([
            text("Menu"),
            menu(toList([class$("ml-2 inline")]))
          ])
        )
      ])
    );
  } else if (model instanceof InRoom && model.display_state instanceof DisplayState && model.display_state.menu_open) {
    let room_code = model.room_code;
    return div(
      toList([class$("flex bg-green-700 text-gray-100")]),
      toList([
        h1(
          toList([class$("text-xl my-5 mx-2")]),
          toList([
            text("Game:"),
            code(
              toList([
                on_click(new CopyRoomCode()),
                attribute("title", "Copy"),
                class$(
                  "mx-1 px-1 text-gray-100 border-dashed border-2 rounded-sm border-transparent hover:border-slate-500 hover:bg-green-200 hover:text-gray-800 cursor-pointer"
                )
              ]),
              toList([text(room_code_to_string(room_code))])
            )
          ])
        ),
        button(
          toList([
            on_click(new ShowMenu(false)),
            class$("ml-auto px-3 py-2")
          ]),
          toList([
            text("Close"),
            x(toList([class$("ml-2 inline")]))
          ])
        )
      ])
    );
  } else {
    return div(
      toList([]),
      toList([
        nav(
          toList([class$("flex items-center")]),
          toList([link("/", toList([text("Home")]), "")])
        ),
        h1(
          toList([class$("text-2xl my-5")]),
          toList([text("Page not found")])
        )
      ])
    );
  }
}
function footer(model) {
  if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof None) {
    return button(
      toList([
        on_click(new StartRound2()),
        class$(
          "mt-auto py-3 border-t-2 border-green-400 bg-green-50 text-green-900 hover:bg-green-100"
        )
      ]),
      toList([text("Start game \u{1F680}")])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof Some && model.display_state instanceof DisplayState && model.display_state.view instanceof Scores) {
    return button(
      toList([
        on_click(new SetView(new Round2())),
        class$(
          "mt-auto py-3 border-t-2 border-green-400 bg-green-50 text-green-900 hover:bg-green-100"
        )
      ]),
      toList([text("Back to game")])
    );
  } else {
    return div(toList([]), toList([]));
  }
}
function choosing_player_heading(players, self_player_id, leading_player_id) {
  let _pipe = find2(
    players,
    (player) => {
      return isEqual(player.id, leading_player_id);
    }
  );
  let _pipe$1 = map3(
    _pipe,
    (player) => {
      let $ = isEqual(player.id, self_player_id);
      if (!$) {
        return "You are guessing " + player_name_to_string(player.name) + "'s order of preference";
      } else {
        return "It's your turn! Select the things below in your preference order";
      }
    }
  );
  return unwrap2(_pipe$1, "Select the options below in order");
}
function display_players(players, leading_player_id, finished_rounds) {
  let scores = fold(
    finished_rounds,
    toList([]),
    (scores2, round3) => {
      let round_scores = (() => {
        let _pipe = round3.player_scores;
        return map2(_pipe, (score) => {
          return [score.player.id, score];
        });
      })();
      return fold(
        round_scores,
        scores2,
        (scores3, round_score) => {
          let $ = find2(
            scores3,
            (s) => {
              return isEqual(s[0], round_score[0]);
            }
          );
          if ($.isOk()) {
            let score = $[0];
            let rest = (() => {
              let _pipe = scores3;
              return filter(
                _pipe,
                (s) => {
                  return !isEqual(s[0], score[0]);
                }
              );
            })();
            return prepend(
              [
                score[0],
                new PlayerScore(
                  score[1].player,
                  toList([]),
                  score[1].score + round_score[1].score
                )
              ],
              rest
            );
          } else {
            return prepend(round_score, scores3);
          }
        }
      );
    }
  );
  return div(
    toList([class$("flex flex-col")]),
    (() => {
      let _pipe = reverse(players);
      return map2(
        _pipe,
        (player) => {
          let score = (() => {
            let _pipe$1 = find2(
              scores,
              (score2) => {
                return isEqual(score2[0], player.id);
              }
            );
            let _pipe$2 = map3(_pipe$1, (s) => {
              return s[1].score;
            });
            let _pipe$3 = unwrap2(_pipe$2, 0);
            return to_string(_pipe$3);
          })();
          let extra_class = (() => {
            let $ = isEqual(player.id, leading_player_id);
            if ($) {
              return " border border-gray-200 shadow";
            } else {
              return "";
            }
          })();
          return div(
            toList([
              class$("my-1 p-2 rounded flex justify-between" + extra_class)
            ]),
            toList([
              text(player_name_to_string(player.name)),
              strong(toList([]), toList([text(score)]))
            ])
          );
        }
      );
    })()
  );
}
function display_finished_round(player_id) {
  return (finished_round, round_index) => {
    let player_text = (player, score) => {
      let $ = isEqual(player.id, finished_round.leading_player_id);
      if ($) {
        return player_name_to_string(player.name) + "'s ranking";
      } else {
        return player_name_to_string(player.name) + "'s guess - " + to_string(
          score
        ) + " points";
      }
    };
    return div(
      toList([class$("my-3 py-1 border-solid border-l-2 p-2 border-gray-300")]),
      toList([
        h3(
          toList([class$("text-xl mb-2 font-bold")]),
          toList([text("Round " + to_string(round_index + 1))])
        ),
        div(
          toList([]),
          (() => {
            let _pipe = sort(
              finished_round.player_scores,
              (a2, b) => {
                let $ = isEqual(a2.player.id, finished_round.leading_player_id);
                let $1 = isEqual(b.player.id, finished_round.leading_player_id);
                let $2 = isEqual(a2.player.id, player_id);
                let $3 = isEqual(b.player.id, player_id);
                if ($) {
                  return new Lt();
                } else if ($1) {
                  return new Gt();
                } else if ($2) {
                  return new Lt();
                } else if ($3) {
                  return new Gt();
                } else {
                  return compare2(b.score, a2.score);
                }
              }
            );
            return map2(
              _pipe,
              (player_score) => {
                return div(
                  toList([]),
                  toList([
                    h4(
                      toList([class$("text-lg")]),
                      toList([
                        text(
                          player_text(player_score.player, player_score.score)
                        )
                      ])
                    ),
                    ol(
                      toList([class$("list-decimal list-inside p-2")]),
                      (() => {
                        let _pipe$1 = reverse(player_score.words);
                        return map2(
                          _pipe$1,
                          (word) => {
                            return li(
                              toList([]),
                              toList([text(word)])
                            );
                          }
                        );
                      })()
                    )
                  ])
                );
              }
            );
          })()
        )
      ])
    );
  };
}
function display_menu(current_view, game_started) {
  return div(
    toList([class$("my-4 mx-2 max-w-90 flex flex-col items-center")]),
    toList([
      button(
        toList([
          on_click(new SetView(new Round2())),
          disabled(
            isEqual(current_view, new Round2()) || !game_started
          ),
          class$("underline p-2 disabled:no-underline disabled:text-slate-600")
        ]),
        toList([text("Current round")])
      ),
      button(
        toList([
          on_click(new SetView(new Scores())),
          disabled(
            isEqual(current_view, new Scores()) || !game_started
          ),
          class$("underline p-2 disabled:no-underline disabled:text-slate-600")
        ]),
        toList([text("View scores")])
      ),
      button(
        toList([
          on_click(new SetView(new WordList2())),
          disabled(
            isEqual(current_view, new WordList2()) || !game_started
          ),
          class$("underline p-2 disabled:no-underline disabled:text-slate-600")
        ]),
        toList([text("Update list")])
      ),
      hr(toList([class$("mt-4 mb-2 mx-2 w-4/5")])),
      button(
        toList([
          on_click(new LeaveGame()),
          class$(
            "underline p-2 disabled:no-underline disabled:text-slate-600 flex items-center p-2"
          )
        ]),
        toList([
          log_out(toList([class$("mr-2 inline")])),
          text("Leave game")
        ])
      )
    ])
  );
}
function display_full_word_list(room, add_word_input) {
  return toList([
    form(
      toList([
        on_submit(new AddWord2()),
        class$("my-2 flex items-center flex-wrap")
      ]),
      toList([
        label(
          toList([for$("add-word-input"), class$("mr-2")]),
          toList([text("Add to list")])
        ),
        div(
          toList([class$("flex max-w-80 min-w-56 flex-auto")]),
          toList([
            input(
              toList([
                id("add-word-input"),
                type_("text"),
                placeholder("A full fridge"),
                class$(
                  "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:opacity-50 flex-auto w-24"
                ),
                on_input(
                  (var0) => {
                    return new UpdateAddWordInput(var0);
                  }
                ),
                value(add_word_input)
              ])
            ),
            button(
              toList([
                type_("submit"),
                class$(
                  "py-2 px-3 ml-2 bg-green-200 hover:bg-green-300 rounded flex-none self-center"
                )
              ]),
              toList([
                text("Add"),
                plus(toList([class$("ml-2 inline")]))
              ])
            )
          ])
        )
      ])
    ),
    button(
      toList([
        on_click(new AddRandomWord2()),
        class$(
          "p-2 rounded border-solid border border-gray-200 hover:bg-emerald-50"
        )
      ]),
      toList([text("Add random \u{1F3B2}")])
    ),
    div(
      toList([]),
      toList([
        h2(
          toList([class$("text-lg my-2")]),
          toList([text("List of words:")])
        ),
        ul(
          toList([]),
          map2(
            room.word_list,
            (word) => {
              return li(
                toList([
                  class$(
                    "flex justify-between items-center hover:bg-slate-100 pl-3 my-1"
                  )
                ]),
                toList([
                  text(word),
                  button(
                    toList([
                      on_click(new RemoveWord2(word)),
                      class$(
                        "rounded text-red-800 bg-red-50 border border-solid border-red-100 py-1 px-2 hover:bg-red-100"
                      )
                    ]),
                    toList([x(toList([class$("inline")]))])
                  )
                ])
              );
            }
          )
        )
      ])
    )
  ]);
}
function content(model) {
  if (model instanceof NotInRoom && model.route instanceof Home) {
    let join_room_err = model.join_room_err;
    return div(
      toList([class$("text-center")]),
      toList([
        (() => {
          if (join_room_err instanceof Some) {
            let err = join_room_err[0];
            return div(
              toList([class$("bg-red-50")]),
              toList([text(err)])
            );
          } else {
            return none2();
          }
        })(),
        p(
          toList([class$("mx-4 text-lg mb-8")]),
          toList([
            text("A game about preferences best played with friends.")
          ])
        ),
        div(
          toList([class$("flex flex-col items-center")]),
          toList([
            button(
              toList([
                on_click(new StartGame()),
                class$(
                  "w-36 p-2 bg-green-700 text-white rounded hover:bg-green-600"
                )
              ]),
              toList([text("Start new game")])
            ),
            link(
              "/play",
              toList([text("Join a game")]),
              "w-36 text-white bg-sky-600 rounded hover:bg-sky-500 no-underline"
            )
          ])
        )
      ])
    );
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof Some && model.join_room_err instanceof None) {
    let room_code = model.route.room_code[0];
    return text("Joining room " + room_code + "...");
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof None) {
    let room_code_input = model.room_code_input;
    let err = model.join_room_err;
    return form(
      toList([
        on_submit(new JoinGame()),
        class$("flex flex-wrap items-center mx-4")
      ]),
      toList([
        label(
          toList([
            for$("room-code-input"),
            class$("flex-initial mr-2 mb-2")
          ]),
          toList([text("Enter game code:")])
        ),
        div(
          toList([class$("mb-2")]),
          toList([
            input(
              toList([
                id("room-code-input"),
                placeholder("ABCD"),
                type_("text"),
                class$(
                  "mr-2 p-2 w-16 border-2 rounded placeholder:text-slate-300 placeholder:tracking-widest font-mono placeholder:opacity-50 tracking-widest"
                ),
                on_input((var0) => {
                  return new UpdateRoomCode(var0);
                }),
                value(room_code_input)
              ])
            ),
            button(
              toList([
                type_("submit"),
                disabled(
                  string_length(trim(room_code_input)) !== 4
                ),
                class$(
                  "rounded px-3 py-2 border bg-sky-600 hover:bg-sky-500 text-white hover:shadow-md disabled:opacity-50 disabled:bg-sky-600 disabled:shadow-none"
                )
              ]),
              toList([text("Join")])
            )
          ])
        ),
        (() => {
          if (err instanceof Some) {
            let err$1 = err[0];
            return div(
              toList([class$("ml-2 text-red-800")]),
              toList([text(err$1)])
            );
          } else {
            return none2();
          }
        })()
      ])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof Some && model.display_state instanceof DisplayState && model.display_state.view instanceof Round2 && !model.display_state.menu_open) {
    let player_id = model.player_id;
    let room = model.active_game[0].room[0];
    let round_state = model.active_game[0].round[0];
    return div(
      toList([class$("flex flex-col max-w-2xl mx-auto")]),
      toList([
        div(
          toList([class$("m-4")]),
          toList([
            h2(
              toList([class$("text-lg mb-2")]),
              toList([
                text(
                  choosing_player_heading(
                    room.players,
                    player_id,
                    round_state.round.leading_player_id
                  )
                )
              ])
            ),
            div(
              toList([class$("flex flex-col flex-wrap")]),
              map2(
                round_state.round.words,
                (word) => {
                  let bg_colour = (() => {
                    let $ = find2(
                      round_state.ordered_words,
                      (w) => {
                        return w === word;
                      }
                    );
                    if ($.isOk()) {
                      return "bg-green-50";
                    } else {
                      return "";
                    }
                  })();
                  return button(
                    toList([
                      on_click(new AddNextPreferedWord(word)),
                      class$(
                        "p-2 m-1 rounded border border-slate-200 hover:shadow-md " + bg_colour
                      )
                    ]),
                    toList([text(word)])
                  );
                }
              )
            ),
            ol(
              toList([class$("list-decimal list-inside p-3")]),
              (() => {
                let _pipe = reverse(round_state.ordered_words);
                return map2(
                  _pipe,
                  (word) => {
                    return li(toList([]), toList([text(word)]));
                  }
                );
              })()
            ),
            div(
              toList([class$("mb-4 flex items-center justify-between")]),
              toList([
                button(
                  toList([
                    on_click(new ClearOrderedWords()),
                    disabled(
                      isEqual(round_state.ordered_words, toList([])) || round_state.submitted
                    ),
                    class$(
                      "py-2 px-3 rounded m-2 bg-red-100 text-red-800 hover:shadow-md hover:bg-red-200 disabled:bg-red-100 disabled:opacity-50 disabled:shadow-none"
                    )
                  ]),
                  toList([
                    text("Clear"),
                    x(toList([class$("ml-2 inline")]))
                  ])
                ),
                button(
                  toList([
                    on_click(new SubmitOrderedWords2()),
                    disabled(
                      length(round_state.ordered_words) !== length(
                        round_state.round.words
                      ) || round_state.submitted
                    ),
                    class$(
                      "py-2 px-3 m-2 rounded bg-green-100 text-green-900 hover:shadow-md hover:bg-green-200 disabled:green-50 disabled:opacity-50 disabled:shadow-none"
                    )
                  ]),
                  toList([
                    text("Submit"),
                    check(toList([class$("ml-2 inline")]))
                  ])
                )
              ])
            ),
            (() => {
              let $ = round_state.submitted;
              if ($) {
                return div(
                  toList([]),
                  toList([
                    h6(
                      toList([]),
                      toList([text("Waiting for other players:")])
                    ),
                    ul(
                      toList([class$("list-disc list-inside p-2")]),
                      filter_map(
                        room.players,
                        (player) => {
                          let $1 = contains(
                            round_state.round.submitted,
                            player.id
                          );
                          if (!$1) {
                            return new Ok(
                              li(
                                toList([]),
                                toList([
                                  (() => {
                                    let _pipe = player.name;
                                    let _pipe$1 = player_name_to_string(
                                      _pipe
                                    );
                                    return text(_pipe$1);
                                  })()
                                ])
                              )
                            );
                          } else {
                            return new Error(void 0);
                          }
                        }
                      )
                    )
                  ])
                );
              } else {
                return none2();
              }
            })()
          ])
        )
      ])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof Some && model.display_state instanceof DisplayState && model.display_state.view instanceof Scores && !model.display_state.menu_open) {
    let player_id = model.player_id;
    let room = model.active_game[0].room[0];
    let round_state = model.active_game[0].round[0];
    return div(
      toList([class$("max-w-2xl mx-auto")]),
      toList([
        div(
          toList([class$("flex flex-col m-4")]),
          prepend(
            display_players(
              room.players,
              round_state.round.leading_player_id,
              room.finished_rounds
            ),
            prepend(
              hr(toList([class$("my-4 text-gray-400")])),
              prepend(
                h2(
                  toList([class$("text-2xl mt-1 mb-3 font-bold")]),
                  toList([
                    text("Previous rounds"),
                    span(
                      toList([class$("font-normal")]),
                      toList([text(" (latest first)")])
                    )
                  ])
                ),
                (() => {
                  let _pipe = reverse(room.finished_rounds);
                  let _pipe$1 = index_map(
                    _pipe,
                    display_finished_round(player_id)
                  );
                  return reverse(_pipe$1);
                })()
              )
            )
          )
        )
      ])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof Some && model.display_state instanceof DisplayState && model.display_state.view instanceof WordList2 && !model.display_state.menu_open) {
    let room = model.active_game[0].room[0];
    let add_word_input = model.active_game[0].add_word_input;
    return div(
      toList([class$("flex flex-col p-4 max-w-2xl mx-auto")]),
      display_full_word_list(room, add_word_input)
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.display_state instanceof DisplayState && model.display_state.menu_open) {
    let round_state = model.active_game[0].round;
    let view$1 = model.display_state.view;
    return display_menu(view$1, is_some(round_state));
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof Some && model.active_game[0].round instanceof None) {
    let player_id = model.player_id;
    let room = model.active_game[0].room[0];
    let add_word_input = model.active_game[0].add_word_input;
    return div(
      toList([class$("flex flex-col p-4 max-w-2xl mx-auto")]),
      prepend(
        div(
          toList([]),
          toList([
            h2(
              toList([class$("text-lg")]),
              toList([text("Players:")])
            ),
            ul(
              toList([class$("ml-3")]),
              (() => {
                let _pipe = reverse(room.players);
                return map2(
                  _pipe,
                  (player) => {
                    let connected = (() => {
                      let $ = player.connected;
                      if ($) {
                        return "";
                      } else {
                        return " - (disconnected)";
                      }
                    })();
                    let display = (() => {
                      let _pipe$1 = (() => {
                        let $ = player.name;
                        let $1 = player.id;
                        if ($ instanceof PlayerName && $[0] === "" && isEqual($1, player_id)) {
                          let id2 = $1;
                          return player_id_to_string(id2) + " (you)";
                        } else if ($ instanceof PlayerName && isEqual($1, player_id)) {
                          let name = $[0];
                          let id2 = $1;
                          return name + " (you)";
                        } else if ($ instanceof PlayerName && $[0] === "") {
                          let id2 = $1;
                          return player_id_to_string(id2);
                        } else {
                          let name = $[0];
                          return name;
                        }
                      })();
                      let _pipe$2 = ((name) => {
                        return name + connected;
                      })(
                        _pipe$1
                      );
                      return text(_pipe$2);
                    })();
                    return li(toList([]), toList([display]));
                  }
                );
              })()
            )
          ])
        ),
        prepend(
          hr(toList([class$("my-2 text-gray-300")])),
          prepend(
            p(
              toList([]),
              toList([
                text("Please add some things to the list. "),
                text(
                  "Each round, 5 things will be picked at random from this list."
                )
              ])
            ),
            display_full_word_list(room, add_word_input)
          )
        )
      )
    );
  } else if (model instanceof InRoom && model.active_game instanceof None) {
    let player_name = model.player_name;
    let error = model.error;
    return div(
      toList([class$("flex flex-col m-4 max-w-2xl mx-auto")]),
      toList([
        form(
          toList([
            on_submit(new SetPlayerName()),
            class$("flex flex-col m-4")
          ]),
          toList([
            label(
              toList([for$("name-input")]),
              toList([text("Name:")])
            ),
            input(
              toList([
                id("name-input"),
                placeholder("Enter name..."),
                on_input(
                  (var0) => {
                    return new UpdatePlayerName(var0);
                  }
                ),
                value(player_name_to_string(player_name)),
                type_("text"),
                class$(
                  "my-2 p-2 border-2 rounded placeholder:text-slate-300 placeholder:opacity-50"
                )
              ])
            ),
            button(
              toList([
                type_("submit"),
                disabled(
                  trim(player_name_to_string(player_name)) === ""
                ),
                class$(
                  "p-2 text-lime-900 bg-emerald-100 hover:bg-emerald-200 rounded disabled:bg-emerald-100 disabled:text-lime-700 disabled:opacity-50"
                )
              ]),
              toList([text("Join room")])
            ),
            (() => {
              if (error instanceof Some) {
                let error$1 = error[0];
                return div(
                  toList([class$("ml-2 text-red-800")]),
                  toList([text(error$1)])
                );
              } else {
                return none2();
              }
            })()
          ])
        )
      ])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof None) {
    let room_code = model.room_code;
    let player_name = model.player_name;
    let error = model.error;
    return div(
      toList([class$("flex flex-col m-4")]),
      toList([
        div(
          toList([]),
          toList([
            h2(
              toList([]),
              toList([text(player_name_to_string(player_name))])
            ),
            (() => {
              if (error instanceof Some) {
                let error$1 = error[0];
                return text(error$1);
              } else {
                return text(
                  "Connecting to room " + room_code_to_string(
                    room_code
                  ) + "..."
                );
              }
            })()
          ])
        )
      ])
    );
  } else if (model instanceof NotInRoom && model.route instanceof NotFound2) {
    return text("Page not found");
  } else {
    return text("Page not found");
  }
}
function view(model) {
  return div(
    toList([]),
    toList([
      div(
        toList([class$("flex flex-col h-dvh max-h-dvh")]),
        toList([
          header(model),
          div(
            toList([class$("max-h-full overflow-y-auto")]),
            toList([content(model)])
          ),
          footer(model)
        ])
      )
    ])
  );
}
var dev_mode = true;
function server(uri, path2) {
  let host = unwrap(uri.host, "localhost");
  let $ = dev_mode;
  if ($) {
    return "http://localhost:8080" + path2;
  } else {
    return "https://" + host + (() => {
      let _pipe = map(
        uri.port,
        (port) => {
          return ":" + to_string(port);
        }
      );
      return unwrap(_pipe, "");
    })() + path2;
  }
}
function start_game(uri) {
  return get(
    server(uri, "/createroom"),
    expect_json(
      http_response_decoder(),
      (var0) => {
        return new JoinedRoom(var0);
      }
    )
  );
}
function join_game(uri, room_code) {
  echo("joining room", "src/client.gleam", 737);
  return post(
    server(uri, "/joinroom"),
    encode_http_request(new JoinRoomRequest(room_code)),
    expect_json(
      http_response_decoder(),
      (var0) => {
        return new JoinedRoom(var0);
      }
    )
  );
}
function init4(_) {
  let uri = do_initial_uri();
  let $ = (() => {
    let _pipe = uri;
    return map3(_pipe, get_route_from_uri);
  })();
  if (uri.isOk() && $.isOk() && $[0] instanceof Play && $[0].room_code instanceof Some) {
    let uri$1 = uri[0];
    let room_code = $[0].room_code[0];
    let rejoin = (() => {
      let _pipe = sessionStorage();
      return try$(
        _pipe,
        (session_storage) => {
          return try$(
            getItem(session_storage, "connection_id"),
            (id2) => {
              return try$(
                getItem(session_storage, "player_name"),
                (name) => {
                  return try$(
                    getItem(session_storage, "room_code"),
                    (stored_room_code) => {
                      let $1 = room_code === stored_room_code;
                      if ($1) {
                        return new Ok(
                          [
                            id2,
                            name,
                            init2(
                              server(uri$1, "/ws/" + id2 + "/" + name),
                              (var0) => {
                                return new WebSocketEvent(var0);
                              }
                            )
                          ]
                        );
                      } else {
                        clear(session_storage);
                        return new Error(void 0);
                      }
                    }
                  );
                }
              );
            }
          );
        }
      );
    })();
    if (rejoin.isOk()) {
      let id2 = rejoin[0][0];
      let name = rejoin[0][1];
      let msg = rejoin[0][2];
      return [
        new InRoom(
          uri$1,
          new PlayerId(id2),
          new RoomCode(room_code),
          new PlayerName(name),
          new None(),
          new DisplayState(new Round2(), false),
          new None()
        ),
        msg
      ];
    } else {
      return [
        new NotInRoom(
          uri$1,
          new Play(new Some(room_code)),
          room_code,
          new Some("Sorry, please try joining again.")
        ),
        batch(
          toList([
            join_game(uri$1, new RoomCode(room_code)),
            init3(on_url_change)
          ])
        )
      ];
    }
  } else if (uri.isOk() && $.isOk()) {
    let uri$1 = uri[0];
    let route = $[0];
    return [
      new NotInRoom(uri$1, route, "", new None()),
      init3(on_url_change)
    ];
  } else if (!uri.isOk() && !uri[0]) {
    return [
      new NotInRoom(relative2(""), new Home(), "", new None()),
      init3(on_url_change)
    ];
  } else {
    return [
      new NotInRoom(relative2(""), new Home(), "", new None()),
      init3(on_url_change)
    ];
  }
}
function update(model, msg) {
  if (model instanceof NotInRoom && msg instanceof StartGame) {
    let uri = model.uri;
    return [model, start_game(uri)];
  } else if (model instanceof NotInRoom && msg instanceof JoinedRoom && msg[0].isOk() && msg[0][0] instanceof RoomResponse) {
    let uri = model.uri;
    let room_code = msg[0][0].room_code;
    let player_id = msg[0][0].player_id;
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        new PlayerName(""),
        new None(),
        new DisplayState(new Round2(), false),
        new None()
      ),
      push(
        "/play",
        new Some(
          query_to_string(
            toList([["game", room_code_to_string(room_code)]])
          )
        ),
        new None()
      )
    ];
  } else if (model instanceof NotInRoom && msg instanceof JoinedRoom && !msg[0].isOk() && msg[0][0] instanceof NotFound) {
    let uri = model.uri;
    let room_code_input = model.room_code_input;
    return [
      new NotInRoom(
        uri,
        new Play(new None()),
        room_code_input,
        new Some("No game found with that room code.")
      ),
      none()
    ];
  } else if (model instanceof NotInRoom && msg instanceof OnRouteChange && msg[1] instanceof Play && msg[1].room_code instanceof Some) {
    let room_code_input = model.room_code_input;
    let uri = msg[0];
    let room_code = msg[1].room_code[0];
    return [
      new NotInRoom(
        uri,
        new Play(new Some(room_code)),
        room_code_input,
        new None()
      ),
      join_game(uri, new RoomCode(room_code))
    ];
  } else if (model instanceof NotInRoom && msg instanceof OnRouteChange) {
    let room_code_input = model.room_code_input;
    let uri = msg[0];
    let route = msg[1];
    return [
      new NotInRoom(uri, route, room_code_input, new None()),
      none()
    ];
  } else if (model instanceof NotInRoom && msg instanceof UpdateRoomCode) {
    let uri = model.uri;
    let route = model.route;
    let room_code = msg[0];
    return [
      new NotInRoom(uri, route, uppercase(room_code), new None()),
      none()
    ];
  } else if (model instanceof NotInRoom && msg instanceof JoinGame) {
    let uri = model.uri;
    let room_code_input = model.room_code_input;
    return [model, join_game(uri, new RoomCode(room_code_input))];
  } else if (model instanceof NotInRoom && msg instanceof UpdatePlayerName) {
    return [model, none()];
  } else if (model instanceof NotInRoom) {
    return [model, none()];
  } else if (model instanceof InRoom && msg instanceof CopyRoomCode) {
    let room_code = model.room_code;
    let $ = writeText(room_code_to_string(room_code));
    return [model, none()];
  } else if (model instanceof InRoom && msg instanceof ShowMenu) {
    let val = msg[0];
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          _record.active_game,
          (() => {
            let _record$1 = model.display_state;
            return new DisplayState(_record$1.view, val);
          })(),
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && msg instanceof SetView) {
    let view$1 = msg[0];
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          _record.active_game,
          new DisplayState(view$1, false),
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && model.room_code instanceof RoomCode && msg instanceof OnRouteChange && msg[1] instanceof Play && msg[1].room_code instanceof Some && model.room_code[0] !== msg[1].room_code[0]) {
    let uri = model.uri;
    let room_code = model.room_code[0];
    let new_room_code = msg[1].room_code[0];
    return [
      new NotInRoom(
        uri,
        new Play(new Some(new_room_code)),
        new_room_code,
        new None()
      ),
      join_game(uri, new RoomCode(room_code))
    ];
  } else if (model instanceof InRoom && msg instanceof OnRouteChange && msg[1] instanceof Play && msg[1].room_code instanceof Some) {
    return [model, none()];
  } else if (model instanceof InRoom && msg instanceof OnRouteChange) {
    let uri = msg[0];
    let route = msg[1];
    return [new NotInRoom(uri, route, "", new None()), none()];
  } else if (model instanceof InRoom && msg instanceof UpdatePlayerName) {
    let player_name = msg[0];
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          new PlayerName(player_name),
          _record.active_game,
          _record.display_state,
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof None && msg instanceof SetPlayerName) {
    let uri = model.uri;
    let player_id = model.player_id;
    let player_name = model.player_name;
    return [
      model,
      post(
        server(uri, "/validatename"),
        encode_http_request(
          new ValidateNameRequest(player_id, player_name)
        ),
        expect_json(
          http_response_decoder(),
          (var0) => {
            return new NameIsValid(var0);
          }
        )
      )
    ];
  } else if (model instanceof InRoom && model.player_id instanceof PlayerId && model.room_code instanceof RoomCode && model.player_name instanceof PlayerName && model.active_game instanceof None && msg instanceof NameIsValid) {
    let uri = model.uri;
    let player_id = model.player_id[0];
    let room_code = model.room_code[0];
    let player_name = model.player_name[0];
    let response = msg[0];
    if (response.isOk() && response[0] instanceof ValidateNameResponse && response[0].valid) {
      let $ = (() => {
        let _pipe = sessionStorage();
        return try$(
          _pipe,
          (session_storage) => {
            return all(
              toList([
                setItem(session_storage, "connection_id", player_id),
                setItem(session_storage, "player_name", player_name),
                setItem(session_storage, "room_code", room_code)
              ])
            );
          }
        );
      })();
      return [
        model,
        init2(
          server(uri, "/ws/" + player_id + "/" + player_name),
          (var0) => {
            return new WebSocketEvent(var0);
          }
        )
      ];
    } else if (response.isOk()) {
      echo(
        "received incorrect response from validate name",
        "src/client.gleam",
        358
      );
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            _record.active_game,
            _record.display_state,
            new Some("An error occurred, please try again")
          );
        })(),
        none()
      ];
    } else if (!response.isOk() && response[0] instanceof OtherError && response[0][0] === 412) {
      let reason = response[0][1];
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            _record.active_game,
            _record.display_state,
            new Some(reason)
          );
        })(),
        none()
      ];
    } else {
      let error = response[0];
      echo("failed to validate name", "src/client.gleam", 368);
      echo(error, "src/client.gleam", 369);
      return [model, none()];
    }
  } else if (model instanceof InRoom && msg instanceof WebSocketEvent) {
    let ws_event = msg[0];
    if (ws_event instanceof InvalidUrl) {
      throw makeError(
        "panic",
        "client",
        376,
        "update",
        "`panic` expression evaluated.",
        {}
      );
    } else if (ws_event instanceof OnOpen) {
      let socket = ws_event[0];
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new Some(new ActiveGame(socket, new None(), new None(), "")),
            _record.display_state,
            _record.error
          );
        })(),
        none()
      ];
    } else if (ws_event instanceof OnTextMessage) {
      let msg$1 = ws_event[0];
      return handle_ws_message(model, msg$1);
    } else if (ws_event instanceof OnBinaryMessage) {
      let msg$1 = ws_event[0];
      let $ = bit_array_to_string(msg$1);
      if ($.isOk()) {
        let msg$2 = $[0];
        return handle_ws_message(model, msg$2);
      } else {
        return [model, none()];
      }
    } else {
      return [
        (() => {
          let _record = model;
          return new InRoom(
            _record.uri,
            _record.player_id,
            _record.room_code,
            _record.player_name,
            new None(),
            new DisplayState(new Round2(), false),
            new Some("Lost connection")
          );
        })(),
        none()
      ];
    }
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && msg instanceof AddWord2 && model.active_game[0].add_word_input !== "") {
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round3 = model.active_game[0].round;
    let add_word_input = model.active_game[0].add_word_input;
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          new Some(new ActiveGame(ws, room, round3, "")),
          _record.display_state,
          _record.error
        );
      })(),
      send2(
        ws,
        encode(
          new AddWord(add_word_input),
          encode_websocket_request
        )
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof AddRandomWord2) {
    let active_game = model.active_game[0];
    return [
      model,
      send2(
        active_game.ws,
        encode(
          new AddRandomWord(),
          encode_websocket_request
        )
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof RemoveWord2) {
    let active_game = model.active_game[0];
    let word = msg[0];
    return [
      model,
      send2(
        active_game.ws,
        encode(
          new RemoveWord(word),
          encode_websocket_request
        )
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof UpdateAddWordInput) {
    let active_game = model.active_game[0];
    let value3 = msg[0];
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          new Some(
            (() => {
              let _record$1 = active_game;
              return new ActiveGame(
                _record$1.ws,
                _record$1.room,
                _record$1.round,
                value3
              );
            })()
          ),
          _record.display_state,
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof StartRound2) {
    let active_game = model.active_game[0];
    return [
      model,
      send2(
        active_game.ws,
        encode(
          new StartRound(),
          encode_websocket_request
        )
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof AddNextPreferedWord) {
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    let word = msg[0];
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          new Some(
            new ActiveGame(
              ws,
              room,
              new Some(
                (() => {
                  let _record$1 = round_state;
                  return new RoundState(
                    _record$1.round,
                    prepend(
                      word,
                      (() => {
                        let _pipe = round_state.ordered_words;
                        return filter(
                          _pipe,
                          (existing_word) => {
                            return existing_word !== word;
                          }
                        );
                      })()
                    ),
                    _record$1.submitted
                  );
                })()
              ),
              add_word_input
            )
          ),
          _record.display_state,
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof ClearOrderedWords) {
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          new Some(
            new ActiveGame(
              ws,
              room,
              new Some(
                (() => {
                  let _record$1 = round_state;
                  return new RoundState(
                    _record$1.round,
                    toList([]),
                    _record$1.submitted
                  );
                })()
              ),
              add_word_input
            )
          ),
          _record.display_state,
          _record.error
        );
      })(),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof SubmitOrderedWords2) {
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    return [
      (() => {
        let _record = model;
        return new InRoom(
          _record.uri,
          _record.player_id,
          _record.room_code,
          _record.player_name,
          new Some(
            new ActiveGame(
              ws,
              room,
              new Some(
                (() => {
                  let _record$1 = round_state;
                  return new RoundState(
                    _record$1.round,
                    _record$1.ordered_words,
                    true
                  );
                })()
              ),
              add_word_input
            )
          ),
          _record.display_state,
          _record.error
        );
      })(),
      send2(
        ws,
        encode(
          new SubmitOrderedWords(round_state.ordered_words),
          encode_websocket_request
        )
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && msg instanceof LeaveGame) {
    let player_id = model.player_id;
    let ws = model.active_game[0].ws;
    return [
      model,
      send2(
        ws,
        encode(
          new RemovePlayer(player_id),
          encode_websocket_request
        )
      )
    ];
  } else {
    return [model, none()];
  }
}
function main() {
  let app = application(init4, update, view);
  let $ = start2(app, "#app", void 0);
  if (!$.isOk()) {
    throw makeError(
      "let_assert",
      "client",
      120,
      "main",
      "Pattern match failed, no pattern matched the value.",
      { value: $ }
    );
  }
  return void 0;
}
function echo(value3, file, line2) {
  const grey = "\x1B[90m";
  const reset_color = "\x1B[39m";
  const file_line = `${file}:${line2}`;
  const string_value = echo$inspect(value3);
  if (typeof process === "object" && process.stderr?.write) {
    const string5 = `${grey}${file_line}${reset_color}
${string_value}
`;
    process.stderr.write(string5);
  } else if (typeof Deno === "object") {
    const string5 = `${grey}${file_line}${reset_color}
${string_value}
`;
    Deno.stderr.writeSync(new TextEncoder().encode(string5));
  } else {
    const string5 = `${file_line}
${string_value}`;
    console.log(string5);
  }
  return value3;
}
function echo$inspectString(str) {
  let new_str = '"';
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    if (char == "\n") new_str += "\\n";
    else if (char == "\r") new_str += "\\r";
    else if (char == "	") new_str += "\\t";
    else if (char == "\f") new_str += "\\f";
    else if (char == "\\") new_str += "\\\\";
    else if (char == '"') new_str += '\\"';
    else if (char < " " || char > "~" && char < "\xA0") {
      new_str += "\\u{" + char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "}";
    } else {
      new_str += char;
    }
  }
  new_str += '"';
  return new_str;
}
function echo$inspectDict(map7) {
  let body = "dict.from_list([";
  let first2 = true;
  let key_value_pairs = [];
  map7.forEach((value3, key2) => {
    key_value_pairs.push([key2, value3]);
  });
  key_value_pairs.sort();
  key_value_pairs.forEach(([key2, value3]) => {
    if (!first2) body = body + ", ";
    body = body + "#(" + echo$inspect(key2) + ", " + echo$inspect(value3) + ")";
    first2 = false;
  });
  return body + "])";
}
function echo$inspectCustomType(record) {
  const props = Object.keys(record).map((label2) => {
    const value3 = echo$inspect(record[label2]);
    return isNaN(parseInt(label2)) ? `${label2}: ${value3}` : value3;
  }).join(", ");
  return props ? `${record.constructor.name}(${props})` : record.constructor.name;
}
function echo$inspectObject(v) {
  const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
  const props = [];
  for (const k of Object.keys(v)) {
    props.push(`${echo$inspect(k)}: ${echo$inspect(v[k])}`);
  }
  const body = props.length ? " " + props.join(", ") + " " : "";
  const head = name === "Object" ? "" : name + " ";
  return `//js(${head}{${body}})`;
}
function echo$inspect(v) {
  const t = typeof v;
  if (v === true) return "True";
  if (v === false) return "False";
  if (v === null) return "//js(null)";
  if (v === void 0) return "Nil";
  if (t === "string") return echo$inspectString(v);
  if (t === "bigint" || t === "number") return v.toString();
  if (Array.isArray(v)) return `#(${v.map(echo$inspect).join(", ")})`;
  if (v instanceof List) return `[${v.toArray().map(echo$inspect).join(", ")}]`;
  if (v instanceof UtfCodepoint) return `//utfcodepoint(${String.fromCodePoint(v.value)})`;
  if (v instanceof BitArray) return echo$inspectBitArray(v);
  if (v instanceof CustomType) return echo$inspectCustomType(v);
  if (echo$isDict(v)) return echo$inspectDict(v);
  if (v instanceof Set) return `//js(Set(${[...v].map(echo$inspect).join(", ")}))`;
  if (v instanceof RegExp) return `//js(${v})`;
  if (v instanceof Date) return `//js(Date("${v.toISOString()}"))`;
  if (v instanceof Function) {
    const args = [];
    for (const i of Array(v.length).keys()) args.push(String.fromCharCode(i + 97));
    return `//fn(${args.join(", ")}) { ... }`;
  }
  return echo$inspectObject(v);
}
function echo$inspectBitArray(bitArray) {
  let endOfAlignedBytes = bitArray.bitOffset + 8 * Math.trunc(bitArray.bitSize / 8);
  let alignedBytes = bitArraySlice(bitArray, bitArray.bitOffset, endOfAlignedBytes);
  let remainingUnalignedBits = bitArray.bitSize % 8;
  if (remainingUnalignedBits > 0) {
    let remainingBits = bitArraySliceToInt(bitArray, endOfAlignedBytes, bitArray.bitSize, false, false);
    let alignedBytesArray = Array.from(alignedBytes.rawBuffer);
    let suffix = `${remainingBits}:size(${remainingUnalignedBits})`;
    if (alignedBytesArray.length === 0) {
      return `<<${suffix}>>`;
    } else {
      return `<<${Array.from(alignedBytes.rawBuffer).join(", ")}, ${suffix}>>`;
    }
  } else {
    return `<<${Array.from(alignedBytes.rawBuffer).join(", ")}>>`;
  }
}
function echo$isDict(value3) {
  try {
    return value3 instanceof Dict;
  } catch {
    return false;
  }
}

// build/.lustre/entry.mjs
main();
