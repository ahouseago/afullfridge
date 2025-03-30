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
    while (desired-- > 0 && current)
      current = current.tail;
    return current !== void 0;
  }
  // @internal
  hasLength(desired) {
    let current = this;
    while (desired-- > 0 && current)
      current = current.tail;
    return desired === -1 && current instanceof Empty;
  }
  // @internal
  countLength() {
    let current = this;
    let length6 = 0;
    while (current) {
      current = current.tail;
      length6++;
    }
    return length6 - 1;
  }
};
function prepend(element2, tail) {
  return new NonEmpty(element2, tail);
}
function toList(elements, tail) {
  return List.fromArray(elements, tail);
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
  byteAt(index3) {
    if (index3 < 0 || index3 >= this.byteSize) {
      return void 0;
    }
    return bitArrayByteAt(this.rawBuffer, this.bitOffset, index3);
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
function bitArrayByteAt(buffer, bitOffset, index3) {
  if (bitOffset === 0) {
    return buffer[index3] ?? 0;
  } else {
    const a2 = buffer[index3] << bitOffset & 255;
    const b = buffer[index3 + 1] >> 8 - bitOffset;
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
function isEqual(x, y) {
  let values = [x, y];
  while (values.length) {
    let a2 = values.pop();
    let b = values.pop();
    if (a2 === b)
      continue;
    if (!isObject(a2) || !isObject(b))
      return false;
    let unequal = !structurallyCompatibleObjects(a2, b) || unequalDates(a2, b) || unequalBuffers(a2, b) || unequalArrays(a2, b) || unequalMaps(a2, b) || unequalSets(a2, b) || unequalRegExps(a2, b);
    if (unequal)
      return false;
    const proto = Object.getPrototypeOf(a2);
    if (proto !== null && typeof proto.equals === "function") {
      try {
        if (a2.equals(b))
          continue;
        else
          return false;
      } catch {
      }
    }
    let [keys2, get3] = getters(a2);
    for (let k of keys2(a2)) {
      values.push(get3(a2, k), get3(b, k));
    }
  }
  return true;
}
function getters(object3) {
  if (object3 instanceof Map) {
    return [(x) => x.keys(), (x, y) => x.get(y)];
  } else {
    let extra = object3 instanceof globalThis.Error ? ["message"] : [];
    return [(x) => [...extra, ...Object.keys(x)], (x, y) => x[y]];
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
  if (nonstructural.some((c) => a2 instanceof c))
    return false;
  return a2.constructor === b.constructor;
}
function makeError(variant, module, line, fn, message, extra) {
  let error = new globalThis.Error(message);
  error.gleam_error = variant;
  error.module = module;
  error.line = line;
  error.function = fn;
  error.fn = fn;
  for (let k in extra)
    error[k] = extra[k];
  return error;
}

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
function from_result(result) {
  if (result.isOk()) {
    let a2 = result[0];
    return new Some(a2);
  } else {
    return new None();
  }
}
function unwrap(option, default$) {
  if (option instanceof Some) {
    let x = option[0];
    return x;
  } else {
    return default$;
  }
}
function map(option, fun) {
  if (option instanceof Some) {
    let x = option[0];
    return new Some(fun(x));
  } else {
    return new None();
  }
}
function then$(option, fun) {
  if (option instanceof Some) {
    let x = option[0];
    return fun(x);
  } else {
    return new None();
  }
}
function or(first2, second2) {
  if (first2 instanceof Some) {
    return first2;
  } else {
    return second2;
  }
}

// build/dev/javascript/gleam_stdlib/gleam/regex.mjs
var Match = class extends CustomType {
  constructor(content2, submatches) {
    super();
    this.content = content2;
    this.submatches = submatches;
  }
};
var CompileError = class extends CustomType {
  constructor(error, byte_index) {
    super();
    this.error = error;
    this.byte_index = byte_index;
  }
};
var Options = class extends CustomType {
  constructor(case_insensitive, multi_line) {
    super();
    this.case_insensitive = case_insensitive;
    this.multi_line = multi_line;
  }
};
function compile(pattern, options) {
  return compile_regex(pattern, options);
}
function scan(regex, string3) {
  return regex_scan(regex, string3);
}

// build/dev/javascript/gleam_stdlib/gleam/pair.mjs
function second(pair) {
  let a2 = pair[1];
  return a2;
}
function map_first(pair, fun) {
  let a2 = pair[0];
  let b = pair[1];
  return [fun(a2), b];
}

// build/dev/javascript/gleam_stdlib/gleam/list.mjs
var Ascending = class extends CustomType {
};
var Descending = class extends CustomType {
};
function count_length(loop$list, loop$count) {
  while (true) {
    let list2 = loop$list;
    let count = loop$count;
    if (list2.atLeastLength(1)) {
      let list$1 = list2.tail;
      loop$list = list$1;
      loop$count = count + 1;
    } else {
      return count;
    }
  }
}
function length(list2) {
  return count_length(list2, 0);
}
function do_reverse(loop$remaining, loop$accumulator) {
  while (true) {
    let remaining = loop$remaining;
    let accumulator = loop$accumulator;
    if (remaining.hasLength(0)) {
      return accumulator;
    } else {
      let item = remaining.head;
      let rest$1 = remaining.tail;
      loop$remaining = rest$1;
      loop$accumulator = prepend(item, accumulator);
    }
  }
}
function reverse(xs) {
  return do_reverse(xs, toList([]));
}
function contains(loop$list, loop$elem) {
  while (true) {
    let list2 = loop$list;
    let elem = loop$elem;
    if (list2.hasLength(0)) {
      return false;
    } else if (list2.atLeastLength(1) && isEqual(list2.head, elem)) {
      let first$1 = list2.head;
      return true;
    } else {
      let rest$1 = list2.tail;
      loop$list = rest$1;
      loop$elem = elem;
    }
  }
}
function first(list2) {
  if (list2.hasLength(0)) {
    return new Error(void 0);
  } else {
    let x = list2.head;
    return new Ok(x);
  }
}
function do_filter(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return reverse(acc);
    } else {
      let x = list2.head;
      let xs = list2.tail;
      let new_acc = (() => {
        let $ = fun(x);
        if ($) {
          return prepend(x, acc);
        } else {
          return acc;
        }
      })();
      loop$list = xs;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter(list2, predicate) {
  return do_filter(list2, predicate, toList([]));
}
function do_filter_map(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return reverse(acc);
    } else {
      let x = list2.head;
      let xs = list2.tail;
      let new_acc = (() => {
        let $ = fun(x);
        if ($.isOk()) {
          let x$1 = $[0];
          return prepend(x$1, acc);
        } else {
          return acc;
        }
      })();
      loop$list = xs;
      loop$fun = fun;
      loop$acc = new_acc;
    }
  }
}
function filter_map(list2, fun) {
  return do_filter_map(list2, fun, toList([]));
}
function do_map(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return reverse(acc);
    } else {
      let x = list2.head;
      let xs = list2.tail;
      loop$list = xs;
      loop$fun = fun;
      loop$acc = prepend(fun(x), acc);
    }
  }
}
function map2(list2, fun) {
  return do_map(list2, fun, toList([]));
}
function do_index_map(loop$list, loop$fun, loop$index, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let fun = loop$fun;
    let index3 = loop$index;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return reverse(acc);
    } else {
      let x = list2.head;
      let xs = list2.tail;
      let acc$1 = prepend(fun(x, index3), acc);
      loop$list = xs;
      loop$fun = fun;
      loop$index = index3 + 1;
      loop$acc = acc$1;
    }
  }
}
function index_map(list2, fun) {
  return do_index_map(list2, fun, 0, toList([]));
}
function do_try_map(loop$list, loop$fun, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let fun = loop$fun;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return new Ok(reverse(acc));
    } else {
      let x = list2.head;
      let xs = list2.tail;
      let $ = fun(x);
      if ($.isOk()) {
        let y = $[0];
        loop$list = xs;
        loop$fun = fun;
        loop$acc = prepend(y, acc);
      } else {
        let error = $[0];
        return new Error(error);
      }
    }
  }
}
function try_map(list2, fun) {
  return do_try_map(list2, fun, toList([]));
}
function do_take(loop$list, loop$n, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let n = loop$n;
    let acc = loop$acc;
    let $ = n <= 0;
    if ($) {
      return reverse(acc);
    } else {
      if (list2.hasLength(0)) {
        return reverse(acc);
      } else {
        let x = list2.head;
        let xs = list2.tail;
        loop$list = xs;
        loop$n = n - 1;
        loop$acc = prepend(x, acc);
      }
    }
  }
}
function take(list2, n) {
  return do_take(list2, n, toList([]));
}
function do_append(loop$first, loop$second) {
  while (true) {
    let first2 = loop$first;
    let second2 = loop$second;
    if (first2.hasLength(0)) {
      return second2;
    } else {
      let item = first2.head;
      let rest$1 = first2.tail;
      loop$first = rest$1;
      loop$second = prepend(item, second2);
    }
  }
}
function append(first2, second2) {
  return do_append(reverse(first2), second2);
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
function do_concat(loop$lists, loop$acc) {
  while (true) {
    let lists = loop$lists;
    let acc = loop$acc;
    if (lists.hasLength(0)) {
      return reverse(acc);
    } else {
      let list2 = lists.head;
      let further_lists = lists.tail;
      loop$lists = further_lists;
      loop$acc = reverse_and_prepend(list2, acc);
    }
  }
}
function concat(lists) {
  return do_concat(lists, toList([]));
}
function fold(loop$list, loop$initial, loop$fun) {
  while (true) {
    let list2 = loop$list;
    let initial = loop$initial;
    let fun = loop$fun;
    if (list2.hasLength(0)) {
      return initial;
    } else {
      let x = list2.head;
      let rest$1 = list2.tail;
      loop$list = rest$1;
      loop$initial = fun(initial, x);
      loop$fun = fun;
    }
  }
}
function find(loop$haystack, loop$is_desired) {
  while (true) {
    let haystack = loop$haystack;
    let is_desired = loop$is_desired;
    if (haystack.hasLength(0)) {
      return new Error(void 0);
    } else {
      let x = haystack.head;
      let rest$1 = haystack.tail;
      let $ = is_desired(x);
      if ($) {
        return new Ok(x);
      } else {
        loop$haystack = rest$1;
        loop$is_desired = is_desired;
      }
    }
  }
}
function do_intersperse(loop$list, loop$separator, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let separator = loop$separator;
    let acc = loop$acc;
    if (list2.hasLength(0)) {
      return reverse(acc);
    } else {
      let x = list2.head;
      let rest$1 = list2.tail;
      loop$list = rest$1;
      loop$separator = separator;
      loop$acc = prepend(x, prepend(separator, acc));
    }
  }
}
function intersperse(list2, elem) {
  if (list2.hasLength(0)) {
    return list2;
  } else if (list2.hasLength(1)) {
    return list2;
  } else {
    let x = list2.head;
    let rest$1 = list2.tail;
    return do_intersperse(rest$1, elem, toList([x]));
  }
}
function sequences(loop$list, loop$compare, loop$growing, loop$direction, loop$prev, loop$acc) {
  while (true) {
    let list2 = loop$list;
    let compare3 = loop$compare;
    let growing = loop$growing;
    let direction = loop$direction;
    let prev = loop$prev;
    let acc = loop$acc;
    let growing$1 = prepend(prev, growing);
    if (list2.hasLength(0)) {
      if (direction instanceof Ascending) {
        return prepend(do_reverse(growing$1, toList([])), acc);
      } else {
        return prepend(growing$1, acc);
      }
    } else {
      let new$1 = list2.head;
      let rest$1 = list2.tail;
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
            return prepend(do_reverse(growing$1, toList([])), acc);
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
            return prepend(do_reverse(growing$1, toList([])), acc);
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
            return prepend(do_reverse(growing$1, toList([])), acc);
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
    let list2 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list3 = list2;
      return do_reverse(list3, acc);
    } else if (list2.hasLength(0)) {
      let list3 = list1;
      return do_reverse(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = rest1;
        loop$list2 = list2;
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
      return do_reverse(acc, toList([]));
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return do_reverse(
        prepend(do_reverse(sequence, toList([])), acc),
        toList([])
      );
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
    let list2 = loop$list2;
    let compare3 = loop$compare;
    let acc = loop$acc;
    if (list1.hasLength(0)) {
      let list3 = list2;
      return do_reverse(list3, acc);
    } else if (list2.hasLength(0)) {
      let list3 = list1;
      return do_reverse(list3, acc);
    } else {
      let first1 = list1.head;
      let rest1 = list1.tail;
      let first2 = list2.head;
      let rest2 = list2.tail;
      let $ = compare3(first1, first2);
      if ($ instanceof Lt) {
        loop$list1 = list1;
        loop$list2 = rest2;
        loop$compare = compare3;
        loop$acc = prepend(first2, acc);
      } else if ($ instanceof Gt) {
        loop$list1 = rest1;
        loop$list2 = list2;
        loop$compare = compare3;
        loop$acc = prepend(first1, acc);
      } else {
        loop$list1 = rest1;
        loop$list2 = list2;
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
      return do_reverse(acc, toList([]));
    } else if (sequences2.hasLength(1)) {
      let sequence = sequences2.head;
      return do_reverse(
        prepend(do_reverse(sequence, toList([])), acc),
        toList([])
      );
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
      return do_reverse(sequence, toList([]));
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
function sort(list2, compare3) {
  if (list2.hasLength(0)) {
    return toList([]);
  } else if (list2.hasLength(1)) {
    let x = list2.head;
    return toList([x]);
  } else {
    let x = list2.head;
    let y = list2.tail.head;
    let rest$1 = list2.tail.tail;
    let direction = (() => {
      let $ = compare3(x, y);
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
      toList([x]),
      direction,
      y,
      toList([])
    );
    return merge_all(sequences$1, new Ascending(), compare3);
  }
}
function do_repeat(loop$a, loop$times, loop$acc) {
  while (true) {
    let a2 = loop$a;
    let times = loop$times;
    let acc = loop$acc;
    let $ = times <= 0;
    if ($) {
      return acc;
    } else {
      loop$a = a2;
      loop$times = times - 1;
      loop$acc = prepend(a2, acc);
    }
  }
}
function repeat(a2, times) {
  return do_repeat(a2, times, toList([]));
}
function key_set(list2, key2, value3) {
  if (list2.hasLength(0)) {
    return toList([[key2, value3]]);
  } else if (list2.atLeastLength(1) && isEqual(list2.head[0], key2)) {
    let k = list2.head[0];
    let rest$1 = list2.tail;
    return prepend([key2, value3], rest$1);
  } else {
    let first$1 = list2.head;
    let rest$1 = list2.tail;
    return prepend(first$1, key_set(rest$1, key2, value3));
  }
}

// build/dev/javascript/gleam_stdlib/gleam/result.mjs
function map3(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return new Ok(fun(x));
  } else {
    let e = result[0];
    return new Error(e);
  }
}
function map_error(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return new Ok(x);
  } else {
    let error = result[0];
    return new Error(fun(error));
  }
}
function try$(result, fun) {
  if (result.isOk()) {
    let x = result[0];
    return fun(x);
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
function nil_error(result) {
  return map_error(result, (_) => {
    return void 0;
  });
}
function all(results) {
  return try_map(results, (x) => {
    return x;
  });
}

// build/dev/javascript/gleam_stdlib/gleam/string_builder.mjs
function from_strings(strings) {
  return concat2(strings);
}
function concat3(builders) {
  return concat2(builders);
}
function from_string(string3) {
  return identity(string3);
}
function to_string(builder) {
  return identity(builder);
}
function split2(iodata, pattern) {
  return split(iodata, pattern);
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
function from(a2) {
  return identity(a2);
}
function dynamic(value3) {
  return new Ok(value3);
}
function string(data) {
  return decode_string(data);
}
function classify(data) {
  return classify_dynamic(data);
}
function int(data) {
  return decode_int(data);
}
function bool(data) {
  return decode_bool(data);
}
function shallow_list(value3) {
  return decode_list(value3);
}
function any(decoders) {
  return (data) => {
    if (decoders.hasLength(0)) {
      return new Error(
        toList([new DecodeError("another type", classify(data), toList([]))])
      );
    } else {
      let decoder = decoders.head;
      let decoders$1 = decoders.tail;
      let $ = decoder(data);
      if ($.isOk()) {
        let decoded = $[0];
        return new Ok(decoded);
      } else {
        return any(decoders$1)(data);
      }
    }
  };
}
function all_errors(result) {
  if (result.isOk()) {
    return toList([]);
  } else {
    let errors = result[0];
    return errors;
  }
}
function decode1(constructor, t1) {
  return (value3) => {
    let $ = t1(value3);
    if ($.isOk()) {
      let a2 = $[0];
      return new Ok(constructor(a2));
    } else {
      let a2 = $;
      return new Error(all_errors(a2));
    }
  };
}
function push_path(error, name) {
  let name$1 = from(name);
  let decoder = any(
    toList([string, (x) => {
      return map3(int(x), to_string2);
    }])
  );
  let name$2 = (() => {
    let $ = decoder(name$1);
    if ($.isOk()) {
      let name$22 = $[0];
      return name$22;
    } else {
      let _pipe = toList(["<", classify(name$1), ">"]);
      let _pipe$1 = from_strings(_pipe);
      return to_string(_pipe$1);
    }
  })();
  let _record = error;
  return new DecodeError(
    _record.expected,
    _record.found,
    prepend(name$2, error.path)
  );
}
function list(decoder_type) {
  return (dynamic2) => {
    return try$(
      shallow_list(dynamic2),
      (list2) => {
        let _pipe = list2;
        let _pipe$1 = try_map(_pipe, decoder_type);
        return map_errors(
          _pipe$1,
          (_capture) => {
            return push_path(_capture, "*");
          }
        );
      }
    );
  };
}
function map_errors(result, f) {
  return map_error(
    result,
    (_capture) => {
      return map2(_capture, f);
    }
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
function optional_field(name, inner_type) {
  return (value3) => {
    return try$(
      decode_field(value3, name),
      (maybe_inner) => {
        if (maybe_inner instanceof None) {
          return new Ok(new None());
        } else {
          let dynamic_inner = maybe_inner[0];
          let _pipe = dynamic_inner;
          let _pipe$1 = decode_option(_pipe, inner_type);
          return map_errors(
            _pipe$1,
            (_capture) => {
              return push_path(_capture, name);
            }
          );
        }
      }
    );
  };
}
function decode2(constructor, t1, t2) {
  return (value3) => {
    let $ = t1(value3);
    let $1 = t2(value3);
    if ($.isOk() && $1.isOk()) {
      let a2 = $[0];
      let b = $1[0];
      return new Ok(constructor(a2, b));
    } else {
      let a2 = $;
      let b = $1;
      return new Error(concat(toList([all_errors(a2), all_errors(b)])));
    }
  };
}
function decode3(constructor, t1, t2, t3) {
  return (value3) => {
    let $ = t1(value3);
    let $1 = t2(value3);
    let $2 = t3(value3);
    if ($.isOk() && $1.isOk() && $2.isOk()) {
      let a2 = $[0];
      let b = $1[0];
      let c = $2[0];
      return new Ok(constructor(a2, b, c));
    } else {
      let a2 = $;
      let b = $1;
      let c = $2;
      return new Error(
        concat(toList([all_errors(a2), all_errors(b), all_errors(c)]))
      );
    }
  };
}
function decode6(constructor, t1, t2, t3, t4, t5, t6) {
  return (x) => {
    let $ = t1(x);
    let $1 = t2(x);
    let $2 = t3(x);
    let $3 = t4(x);
    let $4 = t5(x);
    let $5 = t6(x);
    if ($.isOk() && $1.isOk() && $2.isOk() && $3.isOk() && $4.isOk() && $5.isOk()) {
      let a2 = $[0];
      let b = $1[0];
      let c = $2[0];
      let d = $3[0];
      let e = $4[0];
      let f = $5[0];
      return new Ok(constructor(a2, b, c, d, e, f));
    } else {
      let a2 = $;
      let b = $1;
      let c = $2;
      let d = $3;
      let e = $4;
      let f = $5;
      return new Error(
        concat(
          toList([
            all_errors(a2),
            all_errors(b),
            all_errors(c),
            all_errors(d),
            all_errors(e),
            all_errors(f)
          ])
        )
      );
    }
  };
}

// build/dev/javascript/gleam_stdlib/dict.mjs
var referenceMap = /* @__PURE__ */ new WeakMap();
var tempDataView = new DataView(new ArrayBuffer(8));
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
  if (u === null)
    return 1108378658;
  if (u === void 0)
    return 1108378659;
  if (u === true)
    return 1108378657;
  if (u === false)
    return 1108378656;
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
function bitcount(x) {
  x -= x >> 1 & 1431655765;
  x = (x & 858993459) + (x >> 2 & 858993459);
  x = x + (x >> 4) & 252645135;
  x += x >> 8;
  x += x >> 16;
  return x & 127;
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
function assoc(root2, shift, hash, key2, val, addedLeaf) {
  switch (root2.type) {
    case ARRAY_NODE:
      return assocArray(root2, shift, hash, key2, val, addedLeaf);
    case INDEX_NODE:
      return assocIndex(root2, shift, hash, key2, val, addedLeaf);
    case COLLISION_NODE:
      return assocCollision(root2, shift, hash, key2, val, addedLeaf);
  }
}
function assocArray(root2, shift, hash, key2, val, addedLeaf) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === void 0) {
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root2.size + 1,
      array: cloneAndSet(root2.array, idx, { type: ENTRY, k: key2, v: val })
    };
  }
  if (node.type === ENTRY) {
    if (isEqual(key2, node.k)) {
      if (val === node.v) {
        return root2;
      }
      return {
        type: ARRAY_NODE,
        size: root2.size,
        array: cloneAndSet(root2.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: ARRAY_NODE,
      size: root2.size,
      array: cloneAndSet(
        root2.array,
        idx,
        createNode(shift + SHIFT, node.k, node.v, hash, key2, val)
      )
    };
  }
  const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
  if (n === node) {
    return root2;
  }
  return {
    type: ARRAY_NODE,
    size: root2.size,
    array: cloneAndSet(root2.array, idx, n)
  };
}
function assocIndex(root2, shift, hash, key2, val, addedLeaf) {
  const bit = bitpos(hash, shift);
  const idx = index(root2.bitmap, bit);
  if ((root2.bitmap & bit) !== 0) {
    const node = root2.array[idx];
    if (node.type !== ENTRY) {
      const n = assoc(node, shift + SHIFT, hash, key2, val, addedLeaf);
      if (n === node) {
        return root2;
      }
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, n)
      };
    }
    const nodeKey = node.k;
    if (isEqual(key2, nodeKey)) {
      if (val === node.v) {
        return root2;
      }
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, {
          type: ENTRY,
          k: key2,
          v: val
        })
      };
    }
    addedLeaf.val = true;
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap,
      array: cloneAndSet(
        root2.array,
        idx,
        createNode(shift + SHIFT, nodeKey, node.v, hash, key2, val)
      )
    };
  } else {
    const n = root2.array.length;
    if (n >= MAX_INDEX_NODE) {
      const nodes = new Array(32);
      const jdx = mask(hash, shift);
      nodes[jdx] = assocIndex(EMPTY, shift + SHIFT, hash, key2, val, addedLeaf);
      let j = 0;
      let bitmap = root2.bitmap;
      for (let i = 0; i < 32; i++) {
        if ((bitmap & 1) !== 0) {
          const node = root2.array[j++];
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
      const newArray = spliceIn(root2.array, idx, {
        type: ENTRY,
        k: key2,
        v: val
      });
      addedLeaf.val = true;
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap | bit,
        array: newArray
      };
    }
  }
}
function assocCollision(root2, shift, hash, key2, val, addedLeaf) {
  if (hash === root2.hash) {
    const idx = collisionIndexOf(root2, key2);
    if (idx !== -1) {
      const entry = root2.array[idx];
      if (entry.v === val) {
        return root2;
      }
      return {
        type: COLLISION_NODE,
        hash,
        array: cloneAndSet(root2.array, idx, { type: ENTRY, k: key2, v: val })
      };
    }
    const size = root2.array.length;
    addedLeaf.val = true;
    return {
      type: COLLISION_NODE,
      hash,
      array: cloneAndSet(root2.array, size, { type: ENTRY, k: key2, v: val })
    };
  }
  return assoc(
    {
      type: INDEX_NODE,
      bitmap: bitpos(root2.hash, shift),
      array: [root2]
    },
    shift,
    hash,
    key2,
    val,
    addedLeaf
  );
}
function collisionIndexOf(root2, key2) {
  const size = root2.array.length;
  for (let i = 0; i < size; i++) {
    if (isEqual(key2, root2.array[i].k)) {
      return i;
    }
  }
  return -1;
}
function find2(root2, shift, hash, key2) {
  switch (root2.type) {
    case ARRAY_NODE:
      return findArray(root2, shift, hash, key2);
    case INDEX_NODE:
      return findIndex(root2, shift, hash, key2);
    case COLLISION_NODE:
      return findCollision(root2, key2);
  }
}
function findArray(root2, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === void 0) {
    return void 0;
  }
  if (node.type !== ENTRY) {
    return find2(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findIndex(root2, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root2.bitmap & bit) === 0) {
    return void 0;
  }
  const idx = index(root2.bitmap, bit);
  const node = root2.array[idx];
  if (node.type !== ENTRY) {
    return find2(node, shift + SHIFT, hash, key2);
  }
  if (isEqual(key2, node.k)) {
    return node;
  }
  return void 0;
}
function findCollision(root2, key2) {
  const idx = collisionIndexOf(root2, key2);
  if (idx < 0) {
    return void 0;
  }
  return root2.array[idx];
}
function without(root2, shift, hash, key2) {
  switch (root2.type) {
    case ARRAY_NODE:
      return withoutArray(root2, shift, hash, key2);
    case INDEX_NODE:
      return withoutIndex(root2, shift, hash, key2);
    case COLLISION_NODE:
      return withoutCollision(root2, key2);
  }
}
function withoutArray(root2, shift, hash, key2) {
  const idx = mask(hash, shift);
  const node = root2.array[idx];
  if (node === void 0) {
    return root2;
  }
  let n = void 0;
  if (node.type === ENTRY) {
    if (!isEqual(node.k, key2)) {
      return root2;
    }
  } else {
    n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root2;
    }
  }
  if (n === void 0) {
    if (root2.size <= MIN_ARRAY_NODE) {
      const arr = root2.array;
      const out = new Array(root2.size - 1);
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
      size: root2.size - 1,
      array: cloneAndSet(root2.array, idx, n)
    };
  }
  return {
    type: ARRAY_NODE,
    size: root2.size,
    array: cloneAndSet(root2.array, idx, n)
  };
}
function withoutIndex(root2, shift, hash, key2) {
  const bit = bitpos(hash, shift);
  if ((root2.bitmap & bit) === 0) {
    return root2;
  }
  const idx = index(root2.bitmap, bit);
  const node = root2.array[idx];
  if (node.type !== ENTRY) {
    const n = without(node, shift + SHIFT, hash, key2);
    if (n === node) {
      return root2;
    }
    if (n !== void 0) {
      return {
        type: INDEX_NODE,
        bitmap: root2.bitmap,
        array: cloneAndSet(root2.array, idx, n)
      };
    }
    if (root2.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap ^ bit,
      array: spliceOut(root2.array, idx)
    };
  }
  if (isEqual(key2, node.k)) {
    if (root2.bitmap === bit) {
      return void 0;
    }
    return {
      type: INDEX_NODE,
      bitmap: root2.bitmap ^ bit,
      array: spliceOut(root2.array, idx)
    };
  }
  return root2;
}
function withoutCollision(root2, key2) {
  const idx = collisionIndexOf(root2, key2);
  if (idx < 0) {
    return root2;
  }
  if (root2.array.length === 1) {
    return void 0;
  }
  return {
    type: COLLISION_NODE,
    hash: root2.hash,
    array: spliceOut(root2.array, idx)
  };
}
function forEach(root2, fn) {
  if (root2 === void 0) {
    return;
  }
  const items = root2.array;
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
  constructor(root2, size) {
    this.root = root2;
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
    const found = find2(this.root, 0, getHash(key2), key2);
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
    const root2 = this.root === void 0 ? EMPTY : this.root;
    const newRoot = assoc(root2, 0, getHash(key2), key2, val, addedLeaf);
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
    return find2(this.root, 0, getHash(key2), key2) !== void 0;
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
    let equal = true;
    this.forEach((v, k) => {
      equal = equal && isEqual(o.get(k, !v), v);
    });
    return equal;
  }
};

// build/dev/javascript/gleam_stdlib/gleam_stdlib.mjs
var Nil = void 0;
var NOT_FOUND = {};
function identity(x) {
  return x;
}
function parse_int(value3) {
  if (/^[-+]?(\d+)$/.test(value3)) {
    return new Ok(parseInt(value3));
  } else {
    return new Error(Nil);
  }
}
function to_string3(term) {
  return term.toString();
}
function string_length(string3) {
  if (string3 === "") {
    return 0;
  }
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    let i = 0;
    for (const _ of iterator) {
      i++;
    }
    return i;
  } else {
    return string3.match(/./gsu).length;
  }
}
function graphemes(string3) {
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    return List.fromArray(Array.from(iterator).map((item) => item.segment));
  } else {
    return List.fromArray(string3.match(/./gsu));
  }
}
function graphemes_iterator(string3) {
  if (Intl && Intl.Segmenter) {
    return new Intl.Segmenter().segment(string3)[Symbol.iterator]();
  }
}
function pop_grapheme(string3) {
  let first2;
  const iterator = graphemes_iterator(string3);
  if (iterator) {
    first2 = iterator.next().value?.segment;
  } else {
    first2 = string3.match(/./su)?.[0];
  }
  if (first2) {
    return new Ok([first2, string3.slice(first2.length)]);
  } else {
    return new Error(Nil);
  }
}
function lowercase(string3) {
  return string3.toLowerCase();
}
function uppercase(string3) {
  return string3.toUpperCase();
}
function split(xs, pattern) {
  return List.fromArray(xs.split(pattern));
}
function join(xs, separator) {
  const iterator = xs[Symbol.iterator]();
  let result = iterator.next().value || "";
  let current = iterator.next();
  while (!current.done) {
    result = result + separator + current.value;
    current = iterator.next();
  }
  return result;
}
function concat2(xs) {
  let result = "";
  for (const x of xs) {
    result = result + x;
  }
  return result;
}
function starts_with(haystack, needle) {
  return haystack.startsWith(needle);
}
function trim(string3) {
  return string3.trim();
}
function print_debug(string3) {
  if (typeof process === "object" && process.stderr?.write) {
    process.stderr.write(string3 + "\n");
  } else if (typeof Deno === "object") {
    Deno.stderr.writeSync(new TextEncoder().encode(string3 + "\n"));
  } else {
    console.log(string3);
  }
}
function compile_regex(pattern, options) {
  try {
    let flags = "gu";
    if (options.case_insensitive)
      flags += "i";
    if (options.multi_line)
      flags += "m";
    return new Ok(new RegExp(pattern, flags));
  } catch (error) {
    const number = (error.columnNumber || 0) | 0;
    return new Error(new CompileError(error.message, number));
  }
}
function regex_scan(regex, string3) {
  const matches = Array.from(string3.matchAll(regex)).map((match) => {
    const content2 = match[0];
    const submatches = [];
    for (let n = match.length - 1; n > 0; n--) {
      if (match[n]) {
        submatches[n - 1] = new Some(match[n]);
        continue;
      }
      if (submatches.length > 0) {
        submatches[n - 1] = new None();
      }
    }
    return new Match(content2, List.fromArray(submatches));
  });
  return List.fromArray(matches);
}
function map_get(map6, key2) {
  const value3 = map6.get(key2, NOT_FOUND);
  if (value3 === NOT_FOUND) {
    return new Error(Nil);
  }
  return new Ok(value3);
}
function unsafe_percent_decode(string3) {
  return decodeURIComponent((string3 || "").replace("+", " "));
}
function percent_encode(string3) {
  return encodeURIComponent(string3);
}
function parse_query(query) {
  try {
    const pairs = [];
    for (const section of query.split("&")) {
      const [key2, value3] = section.split("=");
      if (!key2)
        continue;
      pairs.push([unsafe_percent_decode(key2), unsafe_percent_decode(value3)]);
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
function decode_bool(data) {
  return typeof data === "boolean" ? new Ok(data) : decoder_error("Bool", data);
}
function decode_list(data) {
  if (Array.isArray(data)) {
    return new Ok(List.fromArray(data));
  }
  return data instanceof List ? new Ok(data) : decoder_error("List", data);
}
function decode_option(data, decoder) {
  if (data === null || data === void 0 || data instanceof None)
    return new Ok(new None());
  if (data instanceof Some)
    data = data[0];
  const result = decoder(data);
  if (result.isOk()) {
    return new Ok(new Some(result[0]));
  } else {
    return result;
  }
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
function try_get_field(value3, field2, or_else) {
  try {
    return field2 in value3 ? new Ok(new Some(value3[field2])) : or_else();
  } catch {
    return or_else();
  }
}
function inspect(v) {
  const t = typeof v;
  if (v === true)
    return "True";
  if (v === false)
    return "False";
  if (v === null)
    return "//js(null)";
  if (v === void 0)
    return "Nil";
  if (t === "string")
    return JSON.stringify(v);
  if (t === "bigint" || t === "number")
    return v.toString();
  if (Array.isArray(v))
    return `#(${v.map(inspect).join(", ")})`;
  if (v instanceof List)
    return inspectList(v);
  if (v instanceof UtfCodepoint)
    return inspectUtfCodepoint(v);
  if (v instanceof BitArray)
    return inspectBitArray(v);
  if (v instanceof CustomType)
    return inspectCustomType(v);
  if (v instanceof Dict)
    return inspectDict(v);
  if (v instanceof Set)
    return `//js(Set(${[...v].map(inspect).join(", ")}))`;
  if (v instanceof RegExp)
    return `//js(${v})`;
  if (v instanceof Date)
    return `//js(Date("${v.toISOString()}"))`;
  if (v instanceof Function) {
    const args = [];
    for (const i of Array(v.length).keys())
      args.push(String.fromCharCode(i + 97));
    return `//fn(${args.join(", ")}) { ... }`;
  }
  return inspectObject(v);
}
function inspectDict(map6) {
  let body = "dict.from_list([";
  let first2 = true;
  map6.forEach((value3, key2) => {
    if (!first2)
      body = body + ", ";
    body = body + "#(" + inspect(key2) + ", " + inspect(value3) + ")";
    first2 = false;
  });
  return body + "])";
}
function inspectObject(v) {
  const name = Object.getPrototypeOf(v)?.constructor?.name || "Object";
  const props = [];
  for (const k of Object.keys(v)) {
    props.push(`${inspect(k)}: ${inspect(v[k])}`);
  }
  const body = props.length ? " " + props.join(", ") + " " : "";
  const head = name === "Object" ? "" : name + " ";
  return `//js(${head}{${body}})`;
}
function inspectCustomType(record) {
  const props = Object.keys(record).map((label2) => {
    const value3 = inspect(record[label2]);
    return isNaN(parseInt(label2)) ? `${label2}: ${value3}` : value3;
  }).join(", ");
  return props ? `${record.constructor.name}(${props})` : record.constructor.name;
}
function inspectList(list2) {
  return `[${list2.toArray().map(inspect).join(", ")}]`;
}
function inspectBitArray(bits) {
  return `<<${Array.from(bits.buffer).join(", ")}>>`;
}
function inspectUtfCodepoint(codepoint2) {
  return `//utfcodepoint(${String.fromCodePoint(codepoint2.value)})`;
}

// build/dev/javascript/gleam_stdlib/gleam/int.mjs
function parse(string3) {
  return parse_int(string3);
}
function to_string2(x) {
  return to_string3(x);
}
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
function length3(string3) {
  return string_length(string3);
}
function lowercase2(string3) {
  return lowercase(string3);
}
function uppercase2(string3) {
  return uppercase(string3);
}
function starts_with2(string3, prefix) {
  return starts_with(string3, prefix);
}
function concat4(strings) {
  let _pipe = strings;
  let _pipe$1 = from_strings(_pipe);
  return to_string(_pipe$1);
}
function join2(strings, separator) {
  return join(strings, separator);
}
function trim2(string3) {
  return trim(string3);
}
function pop_grapheme2(string3) {
  return pop_grapheme(string3);
}
function split3(x, substring) {
  if (substring === "") {
    return graphemes(x);
  } else {
    let _pipe = x;
    let _pipe$1 = from_string(_pipe);
    let _pipe$2 = split2(_pipe$1, substring);
    return map2(_pipe$2, to_string);
  }
}
function inspect2(term) {
  let _pipe = inspect(term);
  return to_string(_pipe);
}

// build/dev/javascript/gleam_stdlib/gleam/io.mjs
function debug(term) {
  let _pipe = term;
  let _pipe$1 = inspect2(_pipe);
  print_debug(_pipe$1);
  return term;
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
function regex_submatches(pattern, string3) {
  let _pipe = pattern;
  let _pipe$1 = compile(_pipe, new Options(true, false));
  let _pipe$2 = nil_error(_pipe$1);
  let _pipe$3 = map3(
    _pipe$2,
    (_capture) => {
      return scan(_capture, string3);
    }
  );
  let _pipe$4 = try$(_pipe$3, first);
  let _pipe$5 = map3(_pipe$4, (m) => {
    return m.submatches;
  });
  return unwrap2(_pipe$5, toList([]));
}
function noneify_query(x) {
  if (x instanceof None) {
    return new None();
  } else {
    let x$1 = x[0];
    let $ = pop_grapheme2(x$1);
    if ($.isOk() && $[0][0] === "?") {
      let query = $[0][1];
      return new Some(query);
    } else {
      return new None();
    }
  }
}
function noneify_empty_string(x) {
  if (x instanceof Some && x[0] === "") {
    return new None();
  } else if (x instanceof None) {
    return new None();
  } else {
    return x;
  }
}
function extra_required(loop$list, loop$remaining) {
  while (true) {
    let list2 = loop$list;
    let remaining = loop$remaining;
    if (remaining === 0) {
      return 0;
    } else if (list2.hasLength(0)) {
      return remaining;
    } else {
      let xs = list2.tail;
      loop$list = xs;
      loop$remaining = remaining - 1;
    }
  }
}
function pad_list(list2, size) {
  let _pipe = list2;
  return append(
    _pipe,
    repeat(new None(), extra_required(list2, size))
  );
}
function split_authority(authority) {
  let $ = unwrap(authority, "");
  if ($ === "") {
    return [new None(), new None(), new None()];
  } else if ($ === "//") {
    return [new None(), new Some(""), new None()];
  } else {
    let authority$1 = $;
    let matches = (() => {
      let _pipe = "^(//)?((.*)@)?(\\[[a-zA-Z0-9:.]*\\]|[^:]*)(:(\\d*))?";
      let _pipe$1 = regex_submatches(_pipe, authority$1);
      return pad_list(_pipe$1, 6);
    })();
    if (matches.hasLength(6)) {
      let userinfo = matches.tail.tail.head;
      let host = matches.tail.tail.tail.head;
      let port = matches.tail.tail.tail.tail.tail.head;
      let userinfo$1 = noneify_empty_string(userinfo);
      let host$1 = noneify_empty_string(host);
      let port$1 = (() => {
        let _pipe = port;
        let _pipe$1 = unwrap(_pipe, "");
        let _pipe$2 = parse(_pipe$1);
        return from_result(_pipe$2);
      })();
      return [userinfo$1, host$1, port$1];
    } else {
      return [new None(), new None(), new None()];
    }
  }
}
function do_parse(uri_string) {
  let pattern = "^(([a-z][a-z0-9\\+\\-\\.]*):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#.*)?";
  let matches = (() => {
    let _pipe = pattern;
    let _pipe$1 = regex_submatches(_pipe, uri_string);
    return pad_list(_pipe$1, 8);
  })();
  let $ = (() => {
    if (matches.hasLength(8)) {
      let scheme2 = matches.tail.head;
      let authority_with_slashes = matches.tail.tail.head;
      let path3 = matches.tail.tail.tail.tail.head;
      let query_with_question_mark = matches.tail.tail.tail.tail.tail.head;
      let fragment2 = matches.tail.tail.tail.tail.tail.tail.tail.head;
      return [
        scheme2,
        authority_with_slashes,
        path3,
        query_with_question_mark,
        fragment2
      ];
    } else {
      return [new None(), new None(), new None(), new None(), new None()];
    }
  })();
  let scheme = $[0];
  let authority = $[1];
  let path2 = $[2];
  let query = $[3];
  let fragment = $[4];
  let scheme$1 = noneify_empty_string(scheme);
  let path$1 = unwrap(path2, "");
  let query$1 = noneify_query(query);
  let $1 = split_authority(authority);
  let userinfo = $1[0];
  let host = $1[1];
  let port = $1[2];
  let fragment$1 = (() => {
    let _pipe = fragment;
    let _pipe$1 = to_result(_pipe, void 0);
    let _pipe$2 = try$(_pipe$1, pop_grapheme2);
    let _pipe$3 = map3(_pipe$2, second);
    return from_result(_pipe$3);
  })();
  let scheme$2 = (() => {
    let _pipe = scheme$1;
    let _pipe$1 = noneify_empty_string(_pipe);
    return map(_pipe$1, lowercase2);
  })();
  return new Ok(
    new Uri(scheme$2, userinfo, host, port, path$1, query$1, fragment$1)
  );
}
function parse2(uri_string) {
  return do_parse(uri_string);
}
function parse_query2(query) {
  return parse_query(query);
}
function percent_encode2(value3) {
  return percent_encode(value3);
}
function query_pair(pair) {
  return from_strings(
    toList([percent_encode2(pair[0]), "=", percent_encode2(pair[1])])
  );
}
function query_to_string(query) {
  let _pipe = query;
  let _pipe$1 = map2(_pipe, query_pair);
  let _pipe$2 = intersperse(_pipe$1, from_string("&"));
  let _pipe$3 = concat3(_pipe$2);
  return to_string(_pipe$3);
}
function do_remove_dot_segments(loop$input, loop$accumulator) {
  while (true) {
    let input3 = loop$input;
    let accumulator = loop$accumulator;
    if (input3.hasLength(0)) {
      return reverse(accumulator);
    } else {
      let segment = input3.head;
      let rest = input3.tail;
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
function remove_dot_segments(input3) {
  return do_remove_dot_segments(input3, toList([]));
}
function path_segments(path2) {
  return remove_dot_segments(split3(path2, "/"));
}
function to_string4(uri) {
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
    let $1 = starts_with2(uri.path, "/");
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
      return prepend(":", prepend(to_string2(port), parts$3));
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
  return concat4(parts$5);
}
function drop_last(elements) {
  return take(elements, length(elements) - 1);
}
function join_segments(segments) {
  return join2(prepend("", segments), "/");
}
function merge(base, relative2) {
  if (base instanceof Uri && base.scheme instanceof Some && base.host instanceof Some) {
    if (relative2 instanceof Uri && relative2.host instanceof Some) {
      let path2 = (() => {
        let _pipe = split3(relative2.path, "/");
        let _pipe$1 = remove_dot_segments(_pipe);
        return join_segments(_pipe$1);
      })();
      let resolved = new Uri(
        or(relative2.scheme, base.scheme),
        new None(),
        relative2.host,
        or(relative2.port, base.port),
        path2,
        relative2.query,
        relative2.fragment
      );
      return new Ok(resolved);
    } else {
      let $ = (() => {
        let $1 = relative2.path;
        if ($1 === "") {
          return [base.path, or(relative2.query, base.query)];
        } else {
          let path_segments$1 = (() => {
            let $2 = starts_with2(relative2.path, "/");
            if ($2) {
              return split3(relative2.path, "/");
            } else {
              let _pipe = split3(base.path, "/");
              let _pipe$1 = drop_last(_pipe);
              return append(_pipe$1, split3(relative2.path, "/"));
            }
          })();
          let path2 = (() => {
            let _pipe = path_segments$1;
            let _pipe$1 = remove_dot_segments(_pipe);
            return join_segments(_pipe$1);
          })();
          return [path2, relative2.query];
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
        relative2.fragment
      );
      return new Ok(resolved);
    }
  } else {
    return new Error(void 0);
  }
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
function identity2(x) {
  return x;
}
function array(list2) {
  return list2.toArray();
}
function do_null() {
  return null;
}
function decode(string3) {
  try {
    const result = JSON.parse(string3);
    return new Ok(result);
  } catch (err) {
    return new Error(getJsonDecodeError(err, string3));
  }
}
function getJsonDecodeError(stdErr, json) {
  if (isUnexpectedEndOfInput(stdErr))
    return new UnexpectedEndOfInput();
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
    if (result)
      return result;
  }
  return new UnexpectedByte("", 0);
}
function v8UnexpectedByteError(err) {
  const regex = /unexpected token '(.)', ".+" is not valid JSON/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  return new UnexpectedByte(byte, -1);
}
function oldV8UnexpectedByteError(err) {
  const regex = /unexpected token (.) in JSON at position (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[1]);
  const position = Number(match[2]);
  return new UnexpectedByte(byte, position);
}
function spidermonkeyUnexpectedByteError(err, json) {
  const regex = /(unexpected character|expected .*) at line (\d+) column (\d+)/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const line = Number(match[2]);
  const column = Number(match[3]);
  const position = getPositionFromMultiline(line, column, json);
  const byte = toHex(json[position]);
  return new UnexpectedByte(byte, position);
}
function jsCoreUnexpectedByteError(err) {
  const regex = /unexpected (identifier|token) "(.)"/i;
  const match = regex.exec(err.message);
  if (!match)
    return null;
  const byte = toHex(match[2]);
  return new UnexpectedByte(byte, 0);
}
function toHex(char) {
  return "0x" + char.charCodeAt(0).toString(16).toUpperCase();
}
function getPositionFromMultiline(line, column, string3) {
  if (line === 1)
    return column - 1;
  let currentLn = 1;
  let position = 0;
  string3.split("").find((char, idx) => {
    if (char === "\n")
      currentLn += 1;
    if (currentLn === line) {
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
  constructor(byte, position) {
    super();
    this.byte = byte;
    this.position = position;
  }
};
var UnexpectedSequence = class extends CustomType {
  constructor(byte, position) {
    super();
    this.byte = byte;
    this.position = position;
  }
};
var UnexpectedFormat = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
function do_decode(json, decoder) {
  return then$2(
    decode(json),
    (dynamic_value) => {
      let _pipe = decoder(dynamic_value);
      return map_error(
        _pipe,
        (var0) => {
          return new UnexpectedFormat(var0);
        }
      );
    }
  );
}
function decode4(json, decoder) {
  return do_decode(json, decoder);
}
function to_string6(json) {
  return json_to_string(json);
}
function string2(input3) {
  return identity2(input3);
}
function null$() {
  return do_null();
}
function object2(entries) {
  return object(entries);
}
function preprocessed_array(from3) {
  return array(from3);
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
function from2(effect) {
  return new Effect(toList([(dispatch, _) => {
    return effect(dispatch);
  }]));
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
  constructor(key2, namespace2, tag, attrs, children, self_closing, void$) {
    super();
    this.key = key2;
    this.namespace = namespace2;
    this.tag = tag;
    this.attrs = attrs;
    this.children = children;
    this.self_closing = self_closing;
    this.void = void$;
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

// build/dev/javascript/lustre/lustre/attribute.mjs
function attribute(name, value3) {
  return new Attribute(name, from(value3), false);
}
function property(name, value3) {
  return new Attribute(name, from(value3), true);
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
function element(tag, attrs, children) {
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
    return new Element("", "", tag, attrs, children, false, false);
  }
}
function namespaced(namespace2, tag, attrs, children) {
  return new Element("", namespace2, tag, attrs, children, false, false);
}
function text(content2) {
  return new Text(content2);
}
function none2() {
  return new Text("");
}

// build/dev/javascript/lustre/lustre/internals/runtime.mjs
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
var Shutdown = class extends CustomType {
};
var ForceModel = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};

// build/dev/javascript/lustre/vdom.ffi.mjs
function morph(prev, next, dispatch, isComponent = false) {
  let out;
  let stack = [{ prev, next, parent: prev.parentNode }];
  while (stack.length) {
    let { prev: prev2, next: next2, parent } = stack.pop();
    if (next2.subtree !== void 0)
      next2 = next2.subtree();
    if (next2.content !== void 0) {
      if (!prev2) {
        const created = document.createTextNode(next2.content);
        parent.appendChild(created);
        out ??= created;
      } else if (prev2.nodeType === Node.TEXT_NODE) {
        if (prev2.textContent !== next2.content)
          prev2.textContent = next2.content;
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
        stack,
        isComponent
      });
      if (!prev2) {
        parent.appendChild(created);
      } else if (prev2 !== created) {
        parent.replaceChild(created, prev2);
      }
      out ??= created;
    } else if (next2.elements !== void 0) {
      iterateElement(next2, (fragmentElement) => {
        stack.unshift({ prev: prev2, next: fragmentElement, parent });
        prev2 = prev2?.nextSibling;
      });
    } else if (next2.subtree !== void 0) {
      stack.push({ prev: prev2, next: next2, parent });
    }
  }
  return out;
}
function createElementNode({ prev, next, dispatch, stack }) {
  const namespace2 = next.namespace || "http://www.w3.org/1999/xhtml";
  const canMorph = prev && prev.nodeType === Node.ELEMENT_NODE && prev.localName === next.tag && prev.namespaceURI === (next.namespace || "http://www.w3.org/1999/xhtml");
  const el2 = canMorph ? prev : namespace2 ? document.createElementNS(namespace2, next.tag) : document.createElement(next.tag);
  let handlersForEl;
  if (!registeredHandlers.has(el2)) {
    const emptyHandlers = /* @__PURE__ */ new Map();
    registeredHandlers.set(el2, emptyHandlers);
    handlersForEl = emptyHandlers;
  } else {
    handlersForEl = registeredHandlers.get(el2);
  }
  const prevHandlers = canMorph ? new Set(handlersForEl.keys()) : null;
  const prevAttributes = canMorph ? new Set(Array.from(prev.attributes, (a2) => a2.name)) : null;
  let className = null;
  let style = null;
  let innerHTML = null;
  for (const attr of next.attrs) {
    const name = attr[0];
    const value3 = attr[1];
    if (attr.as_property) {
      if (el2[name] !== value3)
        el2[name] = value3;
      if (canMorph)
        prevAttributes.delete(name);
    } else if (name.startsWith("on")) {
      const eventName = name.slice(2);
      const callback = dispatch(value3);
      if (!handlersForEl.has(eventName)) {
        el2.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      if (canMorph)
        prevHandlers.delete(eventName);
    } else if (name.startsWith("data-lustre-on-")) {
      const eventName = name.slice(15);
      const callback = dispatch(lustreServerEventHandler);
      if (!handlersForEl.has(eventName)) {
        el2.addEventListener(eventName, lustreGenericEventHandler);
      }
      handlersForEl.set(eventName, callback);
      el2.setAttribute(name, value3);
    } else if (name === "class") {
      className = className === null ? value3 : className + " " + value3;
    } else if (name === "style") {
      style = style === null ? value3 : style + value3;
    } else if (name === "dangerous-unescaped-html") {
      innerHTML = value3;
    } else {
      if (typeof value3 === "string")
        el2.setAttribute(name, value3);
      if (name === "value" || name === "selected")
        el2[name] = value3;
      if (canMorph)
        prevAttributes.delete(name);
    }
  }
  if (className !== null) {
    el2.setAttribute("class", className);
    if (canMorph)
      prevAttributes.delete("class");
  }
  if (style !== null) {
    el2.setAttribute("style", style);
    if (canMorph)
      prevAttributes.delete("style");
  }
  if (canMorph) {
    for (const attr of prevAttributes) {
      el2.removeAttribute(attr);
    }
    for (const eventName of prevHandlers) {
      handlersForEl.delete(eventName);
      el2.removeEventListener(eventName, lustreGenericEventHandler);
    }
  }
  if (next.key !== void 0 && next.key !== "") {
    el2.setAttribute("data-lustre-key", next.key);
  } else if (innerHTML !== null) {
    el2.innerHTML = innerHTML;
    return el2;
  }
  let prevChild = el2.firstChild;
  let seenKeys = null;
  let keyedChildren = null;
  let incomingKeyedChildren = null;
  let firstChild = next.children[Symbol.iterator]().next().value;
  if (canMorph && firstChild !== void 0 && // Explicit checks are more verbose but truthy checks force a bunch of comparisons
  // we don't care about: it's never gonna be a number etc.
  firstChild.key !== void 0 && firstChild.key !== "") {
    seenKeys = /* @__PURE__ */ new Set();
    keyedChildren = getKeyedChildren(prev);
    incomingKeyedChildren = getKeyedChildren(next);
  }
  for (const child of next.children) {
    iterateElement(child, (currElement) => {
      if (currElement.key !== void 0 && seenKeys !== null) {
        prevChild = diffKeyedChild(
          prevChild,
          currElement,
          el2,
          stack,
          incomingKeyedChildren,
          keyedChildren,
          seenKeys
        );
      } else {
        stack.unshift({ prev: prevChild, next: currElement, parent: el2 });
        prevChild = prevChild?.nextSibling;
      }
    });
  }
  while (prevChild) {
    const next2 = prevChild.nextSibling;
    el2.removeChild(prevChild);
    prevChild = next2;
  }
  return el2;
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
  const el2 = event2.target;
  const tag = el2.getAttribute(`data-lustre-on-${event2.type}`);
  const data = JSON.parse(el2.getAttribute("data-lustre-data") || "{}");
  const include = JSON.parse(el2.getAttribute("data-lustre-include") || "[]");
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
function getKeyedChildren(el2) {
  const keyedChildren = /* @__PURE__ */ new Map();
  if (el2) {
    for (const child of el2.children) {
      iterateElement(child, (currElement) => {
        const key2 = currElement?.key || currElement?.getAttribute?.("data-lustre-key");
        if (key2)
          keyedChildren.set(key2, currElement);
      });
    }
  }
  return keyedChildren;
}
function diffKeyedChild(prevChild, child, el2, stack, incomingKeyedChildren, keyedChildren, seenKeys) {
  while (prevChild && !incomingKeyedChildren.has(prevChild.getAttribute("data-lustre-key"))) {
    const nextChild = prevChild.nextSibling;
    el2.removeChild(prevChild);
    prevChild = nextChild;
  }
  if (keyedChildren.size === 0) {
    iterateElement(child, (currChild) => {
      stack.unshift({ prev: prevChild, next: currChild, parent: el2 });
      prevChild = prevChild?.nextSibling;
    });
    return prevChild;
  }
  if (seenKeys.has(child.key)) {
    console.warn(`Duplicate key found in Lustre vnode: ${child.key}`);
    stack.unshift({ prev: null, next: child, parent: el2 });
    return prevChild;
  }
  seenKeys.add(child.key);
  const keyedChild = keyedChildren.get(child.key);
  if (!keyedChild && !prevChild) {
    stack.unshift({ prev: null, next: child, parent: el2 });
    return prevChild;
  }
  if (!keyedChild && prevChild !== null) {
    const placeholder2 = document.createTextNode("");
    el2.insertBefore(placeholder2, prevChild);
    stack.unshift({ prev: placeholder2, next: child, parent: el2 });
    return prevChild;
  }
  if (!keyedChild || keyedChild === prevChild) {
    stack.unshift({ prev: prevChild, next: child, parent: el2 });
    prevChild = prevChild?.nextSibling;
    return prevChild;
  }
  el2.insertBefore(keyedChild, prevChild);
  stack.unshift({ prev: keyedChild, next: child, parent: el2 });
  return prevChild;
}
function iterateElement(element2, processElement) {
  if (element2.elements !== void 0) {
    for (const currElement of element2.elements) {
      processElement(currElement);
    }
  } else {
    processElement(element2);
  }
}

// build/dev/javascript/lustre/client-runtime.ffi.mjs
var LustreClientApplication2 = class _LustreClientApplication {
  #root = null;
  #queue = [];
  #effects = [];
  #didUpdate = false;
  #isComponent = false;
  #model = null;
  #update = null;
  #view = null;
  static start(flags, selector, init5, update3, view2) {
    if (!is_browser())
      return new Error(new NotABrowser());
    const root2 = selector instanceof HTMLElement ? selector : document.querySelector(selector);
    if (!root2)
      return new Error(new ElementNotFound(selector));
    const app = new _LustreClientApplication(init5(flags), update3, view2, root2);
    return new Ok((msg) => app.send(msg));
  }
  constructor([model, effects], update3, view2, root2 = document.body, isComponent = false) {
    this.#model = model;
    this.#update = update3;
    this.#view = view2;
    this.#root = root2;
    this.#effects = effects.all.toArray();
    this.#didUpdate = true;
    this.#isComponent = isComponent;
    window.requestAnimationFrame(() => this.#tick());
  }
  send(action) {
    switch (true) {
      case action instanceof Dispatch: {
        this.#queue.push(action[0]);
        this.#tick();
        return;
      }
      case action instanceof Shutdown: {
        this.#shutdown();
        return;
      }
      case action instanceof Debug: {
        this.#debug(action[0]);
        return;
      }
      default:
        return;
    }
  }
  emit(event2, data) {
    this.#root.dispatchEvent(
      new CustomEvent(event2, {
        bubbles: true,
        detail: data,
        composed: true
      })
    );
  }
  #tick() {
    this.#flush_queue();
    const vdom = this.#view(this.#model);
    const dispatch = (handler) => (e) => {
      const result = handler(e);
      if (result instanceof Ok) {
        this.send(new Dispatch(result[0]));
      }
    };
    this.#didUpdate = false;
    this.#root = morph(this.#root, vdom, dispatch, this.#isComponent);
  }
  #flush_queue(iterations = 0) {
    while (this.#queue.length) {
      const [next, effects] = this.#update(this.#model, this.#queue.shift());
      this.#didUpdate ||= !isEqual(this.#model, next);
      this.#model = next;
      this.#effects = this.#effects.concat(effects.all.toArray());
    }
    while (this.#effects.length) {
      this.#effects.shift()(
        (msg) => this.send(new Dispatch(msg)),
        (event2, data) => this.emit(event2, data)
      );
    }
    if (this.#queue.length) {
      if (iterations < 5) {
        this.#flush_queue(++iterations);
      } else {
        window.requestAnimationFrame(() => this.#tick());
      }
    }
  }
  #debug(action) {
    switch (true) {
      case action instanceof ForceModel: {
        const vdom = this.#view(action[0]);
        const dispatch = (handler) => (e) => {
          const result = handler(e);
          if (result instanceof Ok) {
            this.send(new Dispatch(result[0]));
          }
        };
        this.#queue = [];
        this.#effects = [];
        this.#didUpdate = false;
        this.#root = morph(this.#root, vdom, dispatch, this.#isComponent);
      }
    }
  }
  #shutdown() {
    this.#root.remove();
    this.#root = null;
    this.#model = null;
    this.#queue = [];
    this.#effects = [];
    this.#didUpdate = false;
    this.#update = () => {
    };
    this.#view = () => {
    };
  }
};
var start = (app, selector, flags) => LustreClientApplication2.start(
  flags,
  selector,
  app.init,
  app.update,
  app.view
);
var is_browser = () => window && window.document;
var prevent_default = (event2) => event2.preventDefault();

// build/dev/javascript/lustre/lustre.mjs
var App = class extends CustomType {
  constructor(init5, update3, view2, on_attribute_change) {
    super();
    this.init = init5;
    this.update = update3;
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
function application(init5, update3, view2) {
  return new App(init5, update3, view2, new None());
}
function start3(app, selector, flags) {
  return guard(
    !is_browser(),
    new Error(new NotABrowser()),
    () => {
      return start(app, selector, flags);
    }
  );
}

// build/dev/javascript/lustre/lustre/element/html.mjs
function h1(attrs, children) {
  return element("h1", attrs, children);
}
function h2(attrs, children) {
  return element("h2", attrs, children);
}
function h3(attrs, children) {
  return element("h3", attrs, children);
}
function h4(attrs, children) {
  return element("h4", attrs, children);
}
function h6(attrs, children) {
  return element("h6", attrs, children);
}
function nav(attrs, children) {
  return element("nav", attrs, children);
}
function div(attrs, children) {
  return element("div", attrs, children);
}
function hr(attrs) {
  return element("hr", attrs, toList([]));
}
function li(attrs, children) {
  return element("li", attrs, children);
}
function ol(attrs, children) {
  return element("ol", attrs, children);
}
function p(attrs, children) {
  return element("p", attrs, children);
}
function ul(attrs, children) {
  return element("ul", attrs, children);
}
function a(attrs, children) {
  return element("a", attrs, children);
}
function code(attrs, children) {
  return element("code", attrs, children);
}
function span(attrs, children) {
  return element("span", attrs, children);
}
function strong(attrs, children) {
  return element("strong", attrs, children);
}
function svg(attrs, children) {
  return namespaced("http://www.w3.org/2000/svg", "svg", attrs, children);
}
function button(attrs, children) {
  return element("button", attrs, children);
}
function form(attrs, children) {
  return element("form", attrs, children);
}
function input(attrs) {
  return element("input", attrs, toList([]));
}
function label(attrs, children) {
  return element("label", attrs, children);
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
var Options2 = class extends CustomType {
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
  } else if (method instanceof Options2) {
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
  let $ = lowercase2(scheme);
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
  let headers = key_set(request.headers, lowercase2(key2), value3);
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
  let _pipe$1 = parse2(_pipe);
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

// build/dev/javascript/gleam_javascript/ffi.mjs
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
function then(promise, fn) {
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
  return then(
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

// build/dev/javascript/gleam_fetch/ffi.mjs
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
function to_fetch_request(request) {
  let url = to_string4(to_uri(request));
  let method = method_to_string(request.method).toUpperCase();
  let options = {
    headers: make_headers(request.headers),
    method
  };
  if (method !== "GET" && method !== "HEAD")
    options.body = request.body;
  return new globalThis.Request(url, options);
}
function make_headers(headersList) {
  let headers = new globalThis.Headers();
  for (let [k, v] of headersList)
    headers.append(k.toLowerCase(), v);
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
  constructor(run) {
    super();
    this.run = run;
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
function get2(url, expect) {
  return from2(
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
  return from2(
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
        let _pipe$3 = set_body(_pipe$2, to_string6(body));
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
          let $ = decode4(body, decoder);
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

// build/dev/javascript/lustre/lustre/element/svg.mjs
var namespace = "http://www.w3.org/2000/svg";
function path(attrs) {
  return namespaced(namespace, "path", attrs, toList([]));
}

// build/dev/javascript/lustre_ui/lustre/ui/icon.mjs
function icon(attrs, path2) {
  return svg(
    prepend(
      class$("lustre-ui-icon"),
      prepend(
        attribute("viewBox", "0 0 15 15"),
        prepend(attribute("fill", "none"), attrs)
      )
    ),
    toList([
      path(
        toList([
          attribute("d", path2),
          attribute("fill", "currentColor"),
          attribute("fill-rule", "evenodd"),
          attribute("clip-rule", "evenodd")
        ])
      )
    ])
  );
}
function hamburger_menu(attrs) {
  return icon(
    attrs,
    "M1.5 3C1.22386 3 1 3.22386 1 3.5C1 3.77614 1.22386 4 1.5 4H13.5C13.7761 4 14 3.77614 14 3.5C14 3.22386 13.7761 3 13.5 3H1.5ZM1 7.5C1 7.22386 1.22386 7 1.5 7H13.5C13.7761 7 14 7.22386 14 7.5C14 7.77614 13.7761 8 13.5 8H1.5C1.22386 8 1 7.77614 1 7.5ZM1 11.5C1 11.2239 1.22386 11 1.5 11H13.5C13.7761 11 14 11.2239 14 11.5C14 11.7761 13.7761 12 13.5 12H1.5C1.22386 12 1 11.7761 1 11.5Z"
  );
}
function close(attrs) {
  return icon(
    attrs,
    "M12.8536 2.85355C13.0488 2.65829 13.0488 2.34171 12.8536 2.14645C12.6583 1.95118 12.3417 1.95118 12.1464 2.14645L7.5 6.79289L2.85355 2.14645C2.65829 1.95118 2.34171 1.95118 2.14645 2.14645C1.95118 2.34171 1.95118 2.65829 2.14645 2.85355L6.79289 7.5L2.14645 12.1464C1.95118 12.3417 1.95118 12.6583 2.14645 12.8536C2.34171 13.0488 2.65829 13.0488 2.85355 12.8536L7.5 8.20711L12.1464 12.8536C12.3417 13.0488 12.6583 13.0488 12.8536 12.8536C13.0488 12.6583 13.0488 12.3417 12.8536 12.1464L8.20711 7.5L12.8536 2.85355Z"
  );
}
function plus(attrs) {
  return icon(
    attrs,
    "M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z"
  );
}
function check(attrs) {
  return icon(
    attrs,
    "M11.4669 3.72684C11.7558 3.91574 11.8369 4.30308 11.648 4.59198L7.39799 11.092C7.29783 11.2452 7.13556 11.3467 6.95402 11.3699C6.77247 11.3931 6.58989 11.3355 6.45446 11.2124L3.70446 8.71241C3.44905 8.48022 3.43023 8.08494 3.66242 7.82953C3.89461 7.57412 4.28989 7.55529 4.5453 7.78749L6.75292 9.79441L10.6018 3.90792C10.7907 3.61902 11.178 3.53795 11.4669 3.72684Z"
  );
}
function cross(attrs) {
  return icon(
    attrs,
    "M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
  );
}
function exit(attrs) {
  return icon(
    attrs,
    "M3 1C2.44771 1 2 1.44772 2 2V13C2 13.5523 2.44772 14 3 14H10.5C10.7761 14 11 13.7761 11 13.5C11 13.2239 10.7761 13 10.5 13H3V2L10.5 2C10.7761 2 11 1.77614 11 1.5C11 1.22386 10.7761 1 10.5 1H3ZM12.6036 4.89645C12.4083 4.70118 12.0917 4.70118 11.8964 4.89645C11.7012 5.09171 11.7012 5.40829 11.8964 5.60355L13.2929 7H6.5C6.22386 7 6 7.22386 6 7.5C6 7.77614 6.22386 8 6.5 8H13.2929L11.8964 9.39645C11.7012 9.59171 11.7012 9.90829 11.8964 10.1036C12.0917 10.2988 12.4083 10.2988 12.6036 10.1036L14.8536 7.85355C15.0488 7.65829 15.0488 7.34171 14.8536 7.14645L12.6036 4.89645Z"
  );
}
function home(attrs) {
  return icon(
    attrs,
    "M7.07926 0.222253C7.31275 -0.007434 7.6873 -0.007434 7.92079 0.222253L14.6708 6.86227C14.907 7.09465 14.9101 7.47453 14.6778 7.71076C14.4454 7.947 14.0655 7.95012 13.8293 7.71773L13 6.90201V12.5C13 12.7761 12.7762 13 12.5 13H2.50002C2.22388 13 2.00002 12.7761 2.00002 12.5V6.90201L1.17079 7.71773C0.934558 7.95012 0.554672 7.947 0.32229 7.71076C0.0899079 7.47453 0.0930283 7.09465 0.32926 6.86227L7.07926 0.222253ZM7.50002 1.49163L12 5.91831V12H10V8.49999C10 8.22385 9.77617 7.99999 9.50002 7.99999H6.50002C6.22388 7.99999 6.00002 8.22385 6.00002 8.49999V12H3.00002V5.91831L7.50002 1.49163ZM7.00002 12H9.00002V8.99999H7.00002V12Z"
  );
}

// build/dev/javascript/lustre_ui/lustre/ui/input.mjs
function input2(attributes) {
  return input(
    prepend(class$("lustre-ui-input"), attributes)
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
    let _pipe = parse2(path2);
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
              let _pipe$1 = to_string4(_pipe);
              return new Ok(_pipe$1);
            }
          );
        }
      );
    }
  );
}
function send2(ws, msg) {
  return from2((_) => {
    return send_over_websocket(ws, msg);
  });
}
function page_uri() {
  let _pipe = get_page_url();
  return parse2(_pipe);
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
  return from2(_pipe);
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
  document.body.addEventListener("click", (event2) => {
    const a2 = find_anchor(event2.target);
    if (!a2)
      return;
    try {
      const url = new URL(a2.href);
      const uri = uri_from_url(url);
      const is_external = url.host !== window.location.host;
      if (!options.handle_external_links && is_external)
        return;
      if (!options.handle_internal_links && !is_external)
        return;
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
};
var do_push = (uri) => {
  window.history.pushState({}, "", to_string4(uri));
  window.requestAnimationFrame(() => {
    if (uri.fragment[0]) {
      document.getElementById(uri.fragment[0])?.scrollIntoView();
    }
  });
};
var find_anchor = (el2) => {
  if (el2.tagName === "BODY") {
    return null;
  } else if (el2.tagName === "A") {
    return el2;
  } else {
    return find_anchor(el2.parentElement);
  }
};
var uri_from_url = (url) => {
  return new Uri(
    /* scheme   */
    url.protocol ? new Some(url.protocol) : new None(),
    /* userinfo */
    new None(),
    /* host     */
    url.host ? new Some(url.host) : new None(),
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
  return from2(
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
function push(uri) {
  return from2(
    (_) => {
      return guard(
        !is_browser(),
        void 0,
        () => {
          return do_push(uri);
        }
      );
    }
  );
}

// build/dev/javascript/plinth/clipboard_ffi.mjs
async function writeText(clipText) {
  try {
    return new Ok(await window.navigator.clipboard.writeText(clipText));
  } catch (error) {
    return new Error(error.toString());
  }
}

// build/dev/javascript/plinth/storage_ffi.mjs
function localStorage() {
  try {
    if (globalThis.Storage && globalThis.localStorage instanceof globalThis.Storage) {
      return new Ok(globalThis.localStorage);
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
var RoomResponse = class extends CustomType {
  constructor(room_code, player_id) {
    super();
    this.room_code = room_code;
    this.player_id = player_id;
  }
};
var AddWord = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var AddRandomWord = class extends CustomType {
};
var RemoveWord = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var ListWords = class extends CustomType {
};
var StartRound = class extends CustomType {
};
var SubmitOrderedWords = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var InitialRoomState = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var PlayersInRoom = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var WordList = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var RoundInfo = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
  }
};
var RoundResult = class extends CustomType {
  constructor(x0) {
    super();
    this[0] = x0;
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
function room_code_to_string(room_code) {
  let code2 = room_code[0];
  return code2;
}
function room_code_to_json(room_code) {
  let _pipe = room_code_to_string(room_code);
  return string2(_pipe);
}
function from_dynamic_string(constructor) {
  return (str) => {
    let _pipe = str;
    return decode1(constructor, string)(_pipe);
  };
}
function player_from_json(player) {
  let _pipe = player;
  return decode3(
    (var0, var1, var2) => {
      return new Player(var0, var1, var2);
    },
    field(
      "id",
      from_dynamic_string((var0) => {
        return new PlayerId(var0);
      })
    ),
    field(
      "name",
      from_dynamic_string((var0) => {
        return new PlayerName(var0);
      })
    ),
    field("connected", bool)
  )(_pipe);
}
function round_from_json(round3) {
  let _pipe = round3;
  return decode3(
    (var0, var1, var2) => {
      return new Round(var0, var1, var2);
    },
    field("words", list(string)),
    field(
      "leadingPlayerId",
      from_dynamic_string((var0) => {
        return new PlayerId(var0);
      })
    ),
    field(
      "submitted",
      list(
        from_dynamic_string((var0) => {
          return new PlayerId(var0);
        })
      )
    )
  )(_pipe);
}
function player_score_from_json(player_score) {
  let _pipe = player_score;
  return decode3(
    (var0, var1, var2) => {
      return new PlayerScore(var0, var1, var2);
    },
    field("player", player_from_json),
    field("words", list(string)),
    field("score", int)
  )(_pipe);
}
function finished_round_from_json(round3) {
  let _pipe = round3;
  return decode3(
    (var0, var1, var2) => {
      return new FinishedRound(var0, var1, var2);
    },
    field("words", list(string)),
    field(
      "leadingPlayerId",
      from_dynamic_string((var0) => {
        return new PlayerId(var0);
      })
    ),
    field("scores", list(player_score_from_json))
  )(_pipe);
}
function scoring_method_from_json(scoring_method) {
  let $ = string(scoring_method);
  if ($.isOk() && $[0] === "EXACT_MATCH") {
    return new Ok(new ExactMatch());
  } else if ($.isOk() && $[0] === "EQUAL_POSITIONS") {
    return new Ok(new EqualPositions());
  } else if ($.isOk() && $[0] === "SMART") {
    return new Ok(new Smart());
  } else if ($.isOk()) {
    let method = $[0];
    return new Error(
      toList([new DecodeError("scoring method", method, toList([]))])
    );
  } else {
    let a2 = $[0];
    return new Error(a2);
  }
}
function room_from_json(room) {
  let _pipe = room;
  return decode6(
    (var0, var1, var2, var3, var4, var5) => {
      return new Room(var0, var1, var2, var3, var4, var5);
    },
    field(
      "roomCode",
      from_dynamic_string((var0) => {
        return new RoomCode(var0);
      })
    ),
    field("players", list(player_from_json)),
    field("wordList", list(string)),
    optional_field("round", round_from_json),
    field("finishedRounds", list(finished_round_from_json)),
    field("scoringMethod", scoring_method_from_json)
  )(_pipe);
}
function encode_http_request(request) {
  let $ = (() => {
    let _pipe = (() => {
      if (request instanceof CreateRoomRequest) {
        return ["createRoom", null$()];
      } else {
        let room_code = request.room_code;
        return ["joinRoom", room_code_to_json(room_code)];
      }
    })();
    return map_first(_pipe, string2);
  })();
  let t = $[0];
  let message = $[1];
  return object2(toList([["type", t], ["message", message]]));
}
function encode_request(request) {
  let $ = (() => {
    let _pipe2 = (() => {
      if (request instanceof AddWord) {
        let word = request[0];
        return ["addWord", string2(word)];
      } else if (request instanceof AddRandomWord) {
        return ["addRandomWord", null$()];
      } else if (request instanceof RemoveWord) {
        let word = request[0];
        return ["removeWord", string2(word)];
      } else if (request instanceof ListWords) {
        return ["listWords", null$()];
      } else if (request instanceof StartRound) {
        return ["startRound", null$()];
      } else {
        let ordered_words = request[0];
        return ["submitOrderedWords", array2(ordered_words, string2)];
      }
    })();
    return map_first(_pipe2, string2);
  })();
  let t = $[0];
  let message = $[1];
  let _pipe = object2(toList([["type", t], ["message", message]]));
  return to_string6(_pipe);
}
function decode_http_response_json(response) {
  let type_decoder = decode2(
    (t, msg) => {
      return [t, msg];
    },
    field("type", string),
    field("message", dynamic)
  );
  let $ = type_decoder(response);
  if ($.isOk() && $[0][0] === "joinedRoom") {
    let msg = $[0][1];
    let _pipe = msg;
    return decode2(
      (var0, var1) => {
        return new RoomResponse(var0, var1);
      },
      field(
        "roomCode",
        from_dynamic_string((var0) => {
          return new RoomCode(var0);
        })
      ),
      field(
        "playerId",
        from_dynamic_string((var0) => {
          return new PlayerId(var0);
        })
      )
    )(_pipe);
  } else if ($.isOk()) {
    let request_type = $[0][0];
    return new Error(
      toList([
        new DecodeError(
          "unknown request type",
          request_type,
          toList([])
        )
      ])
    );
  } else {
    let e = $[0];
    return new Error(e);
  }
}
function decode_errs_to_string(errs) {
  return fold(
    errs,
    "Error decoding message:",
    (err_string, err) => {
      let expected = err.expected;
      let found = err.found;
      return err_string + " expected: " + expected + ", found: " + found + ";";
    }
  );
}
function decode_websocket_response(text2) {
  let type_decoder = decode2(
    (t, msg) => {
      return [t, msg];
    },
    field("type", string),
    field("message", dynamic)
  );
  let response_with_type = decode4(text2, type_decoder);
  let _pipe = (() => {
    if (response_with_type.isOk() && response_with_type[0][0] === "room") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new InitialRoomState(var0);
        },
        room_from_json
      )(_pipe2);
    } else if (response_with_type.isOk() && response_with_type[0][0] === "playersInRoom") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new PlayersInRoom(var0);
        },
        list(player_from_json)
      )(_pipe2);
    } else if (response_with_type.isOk() && response_with_type[0][0] === "wordList") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new WordList(var0);
        },
        list(string)
      )(_pipe2);
    } else if (response_with_type.isOk() && response_with_type[0][0] === "roundInfo") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new RoundInfo(var0);
        },
        round_from_json
      )(_pipe2);
    } else if (response_with_type.isOk() && response_with_type[0][0] === "roundResult") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new RoundResult(var0);
        },
        finished_round_from_json
      )(_pipe2);
    } else if (response_with_type.isOk() && response_with_type[0][0] === "error") {
      let msg = response_with_type[0][1];
      let _pipe2 = msg;
      return decode1(
        (var0) => {
          return new ServerError(var0);
        },
        string
      )(_pipe2);
    } else if (response_with_type.isOk()) {
      let request_type = response_with_type[0][0];
      return new Error(
        toList([
          new DecodeError(
            "unknown request type",
            request_type,
            toList([])
          )
        ])
      );
    } else if (!response_with_type.isOk() && response_with_type[0] instanceof UnexpectedFormat) {
      let e = response_with_type[0][0];
      return new Error(e);
    } else if (!response_with_type.isOk() && response_with_type[0] instanceof UnexpectedByte) {
      let byte = response_with_type[0].byte;
      return new Error(
        toList([new DecodeError("invalid request", byte, toList([]))])
      );
    } else if (!response_with_type.isOk() && response_with_type[0] instanceof UnexpectedSequence) {
      let byte = response_with_type[0].byte;
      return new Error(
        toList([new DecodeError("invalid request", byte, toList([]))])
      );
    } else {
      return new Error(
        toList([
          new DecodeError(
            "bad request: unexpected end of input",
            "",
            toList([])
          )
        ])
      );
    }
  })();
  return map_error(_pipe, decode_errs_to_string);
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
  constructor(uri, player_id, room_code, player_name, active_game, display_state) {
    super();
    this.uri = uri;
    this.player_id = player_id;
    this.room_code = room_code;
    this.player_name = player_name;
    this.active_game = active_game;
    this.display_state = display_state;
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
function relative(path2) {
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
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let active_game = model.active_game[0];
    let display_state = model.display_state;
    let $ = decode_websocket_response(msg);
    if ($.isOk() && $[0] instanceof InitialRoomState) {
      let room = $[0][0];
      return [
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(
            (() => {
              let _record = active_game;
              return new ActiveGame(
                _record.ws,
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
                _record.add_word_input
              );
            })()
          ),
          display_state
        ),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof PlayersInRoom) {
      let player_list = $[0][0];
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
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(
            (() => {
              let _record = active_game;
              return new ActiveGame(
                _record.ws,
                room,
                _record.round,
                _record.add_word_input
              );
            })()
          ),
          display_state
        ),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof WordList) {
      let word_list = $[0][0];
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
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(
            (() => {
              let _record = active_game;
              return new ActiveGame(
                _record.ws,
                room,
                _record.round,
                _record.add_word_input
              );
            })()
          ),
          display_state
        ),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof RoundInfo) {
      let round3 = $[0][0];
      return [
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(
            (() => {
              let _record = active_game;
              return new ActiveGame(
                _record.ws,
                _record.room,
                (() => {
                  let _pipe = then$(
                    active_game.round,
                    (active_game_round) => {
                      return new Some(
                        (() => {
                          let _record$1 = active_game_round;
                          return new RoundState(
                            round3,
                            _record$1.ordered_words,
                            _record$1.submitted
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
                _record.add_word_input
              );
            })()
          ),
          display_state
        ),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof RoundResult) {
      let finished_round = $[0][0];
      return [
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(
            (() => {
              let _record = active_game;
              return new ActiveGame(
                _record.ws,
                (() => {
                  let _pipe = active_game.room;
                  return map(
                    _pipe,
                    (room) => {
                      let _record$1 = room;
                      return new Room(
                        _record$1.room_code,
                        _record$1.players,
                        _record$1.word_list,
                        _record$1.round,
                        prepend(finished_round, room.finished_rounds),
                        _record$1.scoring_method
                      );
                    }
                  );
                })(),
                new None(),
                _record.add_word_input
              );
            })()
          ),
          new DisplayState(new Scores(), false)
        ),
        none()
      ];
    } else if ($.isOk() && $[0] instanceof ServerError) {
      let reason = $[0].reason;
      debug(reason);
      return [model, none()];
    } else {
      let reason = $[0];
      debug(reason);
      return [model, none()];
    }
  }
}
function get_route_from_uri(uri) {
  let room_code = (() => {
    let _pipe = uri.query;
    let _pipe$1 = map(_pipe, parse_query2);
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
                home(toList([class$("mr-2")])),
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
                home(toList([class$("mr-2")])),
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
            hamburger_menu(toList([class$("ml-2")]))
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
          toList([text("Close"), close(toList([class$("ml-2")]))])
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
  let _pipe = find(
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
          let $ = find(
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
            let _pipe$1 = find(
              scores,
              (score2) => {
                return isEqual(score2[0], player.id);
              }
            );
            let _pipe$2 = map3(_pipe$1, (s) => {
              return s[1].score;
            });
            let _pipe$3 = unwrap2(_pipe$2, 0);
            return to_string2(_pipe$3);
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
        return player_name_to_string(player.name) + "'s guess - " + to_string2(
          score
        ) + " points";
      }
    };
    return div(
      toList([class$("my-3 py-1 border-solid border-l-2 p-2 border-gray-300")]),
      toList([
        h3(
          toList([class$("text-xl mb-2 font-bold")]),
          toList([text("Round " + to_string2(round_index + 1))])
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
      link(
        "/",
        toList([
          exit(toList([class$("mr-2")])),
          text("Leave game")
        ]),
        "flex items-center p-2"
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
            input2(
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
                plus(toList([class$("ml-2")]))
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
                    toList([cross(toList([]))])
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
    return div(
      toList([class$("text-center")]),
      toList([
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
  } else if (model instanceof NotInRoom && model.join_room_err instanceof Some) {
    let err = model.join_room_err[0];
    return text(err);
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof Some && model.join_room_err instanceof None) {
    let room_code = model.route.room_code[0];
    return text("Joining room " + room_code + "...");
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof None && model.join_room_err instanceof None) {
    let room_code_input = model.room_code_input;
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
                  length3(trim2(room_code_input)) !== 4
                ),
                class$(
                  "rounded px-3 py-2 border bg-sky-600 hover:bg-sky-500 text-white hover:shadow-md disabled:opacity-50 disabled:bg-sky-600 disabled:shadow-none"
                )
              ]),
              toList([text("Join")])
            )
          ])
        )
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
                    let $ = find(
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
                    cross(toList([class$("ml-2")]))
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
                    check(toList([class$("ml-2")]))
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
            input2(
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
                  trim2(player_name_to_string(player_name)) === ""
                ),
                class$(
                  "p-2 text-lime-900 bg-emerald-100 hover:bg-emerald-200 rounded disabled:bg-emerald-100 disabled:text-lime-700 disabled:opacity-50"
                )
              ]),
              toList([text("Join room")])
            )
          ])
        )
      ])
    );
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].room instanceof None) {
    let room_code = model.room_code;
    let player_name = model.player_name;
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
            text(
              "Connecting to room " + room_code_to_string(room_code) + "..."
            )
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
function server(protocol, uri, path2) {
  let host = unwrap(uri.host, "localhost");
  let $ = dev_mode;
  if ($) {
    return protocol + "://localhost:8080" + path2;
  } else {
    return protocol + "s://" + host + (() => {
      let _pipe = map(
        uri.port,
        (port) => {
          return ":" + to_string2(port);
        }
      );
      return unwrap(_pipe, "");
    })() + path2;
  }
}
function start_game(uri) {
  return get2(
    server("http", uri, "/createroom"),
    expect_json(
      decode_http_response_json,
      (var0) => {
        return new JoinedRoom(var0);
      }
    )
  );
}
function join_game(uri, room_code) {
  return post(
    server("http", uri, "/joinroom"),
    encode_http_request(new JoinRoomRequest(room_code)),
    expect_json(
      decode_http_response_json,
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
      let _pipe = localStorage();
      return try$(
        _pipe,
        (local_storage) => {
          return try$(
            getItem(local_storage, "connection_id"),
            (id2) => {
              return try$(
                getItem(local_storage, "player_name"),
                (name) => {
                  return try$(
                    getItem(local_storage, "room_code"),
                    (stored_room_code) => {
                      let $1 = room_code === stored_room_code;
                      if ($1) {
                        return new Ok(
                          [
                            id2,
                            name,
                            init2(
                              server("ws", uri$1, "/ws/" + id2 + "/" + name),
                              (var0) => {
                                return new WebSocketEvent(var0);
                              }
                            )
                          ]
                        );
                      } else {
                        clear(local_storage);
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
          new DisplayState(new Round2(), false)
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
      new NotInRoom(relative(""), new Home(), "", new None()),
      init3(on_url_change)
    ];
  } else {
    return [
      new NotInRoom(relative(""), new Home(), "", new None()),
      init3(on_url_change)
    ];
  }
}
function update2(model, msg) {
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
        new DisplayState(new Round2(), false)
      ),
      push(
        (() => {
          let _record = relative("/play");
          return new Uri(
            _record.scheme,
            _record.userinfo,
            _record.host,
            _record.port,
            _record.path,
            new Some(
              query_to_string(
                toList([["game", room_code_to_string(room_code)]])
              )
            ),
            _record.fragment
          );
        })()
      )
    ];
  } else if (model instanceof NotInRoom && model.route instanceof Play && model.route.room_code instanceof Some && msg instanceof JoinedRoom && !msg[0].isOk() && msg[0][0] instanceof NotFound) {
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
      new NotInRoom(uri, route, uppercase2(room_code), new None()),
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
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let active_game = model.active_game;
    let display_state = model.display_state;
    let val = msg[0];
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        active_game,
        (() => {
          let _record = display_state;
          return new DisplayState(_record.view, val);
        })()
      ),
      none()
    ];
  } else if (model instanceof InRoom && msg instanceof SetView) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let active_game = model.active_game;
    let view$1 = msg[0];
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        active_game,
        new DisplayState(view$1, false)
      ),
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
  } else if (model instanceof InRoom && model.active_game instanceof None && msg instanceof UpdatePlayerName) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let display = model.display_state;
    let player_name = msg[0];
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        new PlayerName(player_name),
        new None(),
        display
      ),
      none()
    ];
  } else if (model instanceof InRoom && model.player_id instanceof PlayerId && model.room_code instanceof RoomCode && model.player_name instanceof PlayerName && model.active_game instanceof None && msg instanceof SetPlayerName) {
    let uri = model.uri;
    let player_id = model.player_id[0];
    let room_code = model.room_code[0];
    let player_name = model.player_name[0];
    let $ = (() => {
      let _pipe = localStorage();
      return try$(
        _pipe,
        (local_storage) => {
          return all(
            toList([
              setItem(local_storage, "connection_id", player_id),
              setItem(local_storage, "player_name", player_name),
              setItem(local_storage, "room_code", room_code)
            ])
          );
        }
      );
    })();
    return [
      model,
      init2(
        server("ws", uri, "/ws/" + player_id + "/" + player_name),
        (var0) => {
          return new WebSocketEvent(var0);
        }
      )
    ];
  } else if (model instanceof InRoom && msg instanceof WebSocketEvent) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let display = model.display_state;
    let ws_event = msg[0];
    if (ws_event instanceof InvalidUrl) {
      throw makeError(
        "panic",
        "client",
        353,
        "update",
        "`panic` expression evaluated.",
        {}
      );
    } else if (ws_event instanceof OnOpen) {
      let socket = ws_event[0];
      return [
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new Some(new ActiveGame(socket, new None(), new None(), "")),
          display
        ),
        none()
      ];
    } else if (ws_event instanceof OnTextMessage) {
      let msg$1 = ws_event[0];
      return handle_ws_message(model, msg$1);
    } else if (ws_event instanceof OnBinaryMessage) {
      return [model, none()];
    } else {
      return [
        new InRoom(
          uri,
          player_id,
          room_code,
          player_name,
          new None(),
          new DisplayState(new Round2(), false)
        ),
        none()
      ];
    }
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && msg instanceof AddWord2 && model.active_game[0].add_word_input !== "") {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round3 = model.active_game[0].round;
    let add_word_input = model.active_game[0].add_word_input;
    let display_state = model.display_state;
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        new Some(new ActiveGame(ws, room, round3, "")),
        display_state
      ),
      send2(ws, encode_request(new AddWord(add_word_input)))
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof AddRandomWord2) {
    let active_game = model.active_game[0];
    return [
      model,
      send2(
        active_game.ws,
        encode_request(new AddRandomWord())
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof RemoveWord2) {
    let active_game = model.active_game[0];
    let word = msg[0];
    return [
      model,
      send2(
        active_game.ws,
        encode_request(new RemoveWord(word))
      )
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof UpdateAddWordInput) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let active_game = model.active_game[0];
    let display_state = model.display_state;
    let value3 = msg[0];
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        new Some(
          (() => {
            let _record = active_game;
            return new ActiveGame(
              _record.ws,
              _record.room,
              _record.round,
              value3
            );
          })()
        ),
        display_state
      ),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && msg instanceof StartRound2) {
    let active_game = model.active_game[0];
    return [
      model,
      send2(active_game.ws, encode_request(new StartRound()))
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof AddNextPreferedWord) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    let display_state = model.display_state;
    let word = msg[0];
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        new Some(
          new ActiveGame(
            ws,
            room,
            new Some(
              (() => {
                let _record = round_state;
                return new RoundState(
                  _record.round,
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
                  _record.submitted
                );
              })()
            ),
            add_word_input
          )
        ),
        display_state
      ),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof ClearOrderedWords) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    let display_state = model.display_state;
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        new Some(
          new ActiveGame(
            ws,
            room,
            new Some(
              (() => {
                let _record = round_state;
                return new RoundState(
                  _record.round,
                  toList([]),
                  _record.submitted
                );
              })()
            ),
            add_word_input
          )
        ),
        display_state
      ),
      none()
    ];
  } else if (model instanceof InRoom && model.active_game instanceof Some && model.active_game[0] instanceof ActiveGame && model.active_game[0].round instanceof Some && msg instanceof SubmitOrderedWords2) {
    let uri = model.uri;
    let player_id = model.player_id;
    let room_code = model.room_code;
    let player_name = model.player_name;
    let ws = model.active_game[0].ws;
    let room = model.active_game[0].room;
    let round_state = model.active_game[0].round[0];
    let add_word_input = model.active_game[0].add_word_input;
    let display_state = model.display_state;
    return [
      new InRoom(
        uri,
        player_id,
        room_code,
        player_name,
        new Some(
          new ActiveGame(
            ws,
            room,
            new Some(
              (() => {
                let _record = round_state;
                return new RoundState(
                  _record.round,
                  _record.ordered_words,
                  true
                );
              })()
            ),
            add_word_input
          )
        ),
        display_state
      ),
      send2(
        ws,
        encode_request(
          new SubmitOrderedWords(round_state.ordered_words)
        )
      )
    ];
  } else {
    return [model, none()];
  }
}
function main() {
  let app = application(init4, update2, view);
  let $ = start3(app, "#app", void 0);
  if (!$.isOk()) {
    throw makeError(
      "let_assert",
      "client",
      119,
      "main",
      "Pattern match failed, no pattern matched the value.",
      { value: $ }
    );
  }
  return void 0;
}

// build/.lustre/entry.mjs
main();
