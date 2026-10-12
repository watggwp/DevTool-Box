// Pure diff helpers (no DOM). Used by diff.js and by Node tests.

// Myers O(ND) diff on two integer arrays. Returns ops [{t:'='|'-'|'+', a, b}] or null if D > maxD.
export function myers(a, b, maxD = 3000) {
  const N = a.length, M = b.length, MAX = N + M;
  if (MAX === 0) return [];
  const off = MAX + 1;
  const v = new Int32Array(2 * MAX + 3);
  const trace = [];
  const lim = Math.min(MAX, maxD);
  for (let d = 0; d <= lim; d++) {
    // snapshot of state after step d-1 for k in [-(d+1), d+1]
    trace.push({ lo: -(d + 1), arr: v.slice(off - (d + 1), off + d + 2) });
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
      else x = v[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= N && y >= M) return backtrack(trace, N, M);
    }
  }
  return null;
}

function backtrack(trace, N, M) {
  const ops = [];
  let x = N, y = M;
  for (let d = trace.length - 1; d >= 0; d--) {
    const { lo, arr } = trace[d];
    const V = (k) => arr[k - lo];
    const k = x - y;
    const prevK = k === -d || (k !== d && V(k - 1) < V(k + 1)) ? k + 1 : k - 1;
    const prevX = V(prevK), prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push({ t: "=", a: x - 1, b: y - 1 }); x--; y--; }
    if (d > 0) {
      if (x === prevX) ops.push({ t: "+", a: -1, b: y - 1 });
      else ops.push({ t: "-", a: x - 1, b: -1 });
    }
    x = prevX; y = prevY;
  }
  return ops.reverse();
}

export function splitLines(text) {
  if (text === "") return [];
  return text.split(/\r\n|\r|\n/);
}

// Line diff with optional normalisation. Returns { ops, A, B, approx }.
// approx=true means the inputs were too different for maxD and the middle part is shown as replace-all.
export function diffLines(textA, textB, { ignoreWs = false, ignoreCase = false, maxD = 2000 } = {}) {
  const A = splitLines(textA), B = splitLines(textB);
  const norm = (s) => {
    if (ignoreWs) s = s.replace(/\s+/g, " ").trim();
    if (ignoreCase) s = s.toLowerCase();
    return s;
  };
  const ids = new Map();
  const id = (s) => {
    const key = norm(s);
    let n = ids.get(key);
    if (n === undefined) { n = ids.size; ids.set(key, n); }
    return n;
  };
  const a = A.map(id), b = B.map(id);
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const midA = a.slice(pre, a.length - suf), midB = b.slice(pre, b.length - suf);
  let mid = myers(midA, midB, maxD);
  let approx = false;
  if (mid === null) {
    approx = true;
    mid = [];
    for (let i = 0; i < midA.length; i++) mid.push({ t: "-", a: i, b: -1 });
    for (let j = 0; j < midB.length; j++) mid.push({ t: "+", a: -1, b: j });
  }
  const ops = [];
  for (let i = 0; i < pre; i++) ops.push({ t: "=", a: i, b: i });
  for (const o of mid) ops.push({ t: o.t, a: o.a < 0 ? -1 : o.a + pre, b: o.b < 0 ? -1 : o.b + pre });
  for (let i = suf; i > 0; i--) ops.push({ t: "=", a: A.length - i, b: B.length - i });
  return { ops, A, B, approx };
}

export function stats(ops) {
  let add = 0, del = 0, same = 0;
  for (const o of ops) { if (o.t === "+") add++; else if (o.t === "-") del++; else same++; }
  return { add, del, same };
}

// Character-level diff of two strings. Returns {left:[{t,s}], right:[{t,s}]} or null if too long.
export function charDiff(x, y, maxLen = 2000) {
  if (x.length > maxLen || y.length > maxLen) return null;
  const a = Array.from(x, (c) => c.charCodeAt(0));
  const b = Array.from(y, (c) => c.charCodeAt(0));
  const ops = myers(a, b, 400);
  if (!ops) return null;
  const left = [], right = [];
  const push = (arr, t, s) => {
    const last = arr[arr.length - 1];
    if (last && last.t === t) last.s += s; else arr.push({ t, s });
  };
  for (const o of ops) {
    if (o.t === "=") { push(left, "=", x[o.a]); push(right, "=", y[o.b]); }
    else if (o.t === "-") push(left, "-", x[o.a]);
    else push(right, "+", y[o.b]);
  }
  return { left, right };
}

// Unified diff text (like `diff -u`).
export function unified(res, ctx = 3, nameA = "original", nameB = "changed") {
  const { ops, A, B } = res;
  const n = ops.length;
  const aPos = new Int32Array(n + 1), bPos = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    aPos[i + 1] = aPos[i] + (ops[i].t !== "+" ? 1 : 0);
    bPos[i + 1] = bPos[i] + (ops[i].t !== "-" ? 1 : 0);
  }
  const out = [`--- ${nameA}`, `+++ ${nameB}`];
  let idx = 0, hunks = 0;
  while (idx < n) {
    while (idx < n && ops[idx].t === "=") idx++;
    if (idx >= n) break;
    const start = Math.max(0, idx - ctx);
    let last = idx, j = idx;
    while (j < n) {
      if (ops[j].t !== "=") last = j;
      else if (j - last > 2 * ctx) break;
      j++;
    }
    const end = Math.min(n, last + ctx + 1);
    const aLen = aPos[end] - aPos[start], bLen = bPos[end] - bPos[start];
    const aStart = aLen ? aPos[start] + 1 : aPos[start];
    const bStart = bLen ? bPos[start] + 1 : bPos[start];
    out.push(`@@ -${aStart},${aLen} +${bStart},${bLen} @@`);
    for (let i = start; i < end; i++) {
      const o = ops[i];
      if (o.t === "=") out.push(" " + A[o.a]);
      else if (o.t === "-") out.push("-" + A[o.a]);
      else out.push("+" + B[o.b]);
    }
    hunks++;
    idx = end;
  }
  return hunks ? out.join("\n") + "\n" : "";
}

// Group ops into display rows. Pairs consecutive deletions/additions for side-by-side view.
// Row: { t: '='|'-'|'+'|'~', a, b }  ('~' = changed pair)
export function pairRows(ops) {
  const rows = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === "=") { rows.push(ops[i]); i++; continue; }
    const dels = [], adds = [];
    while (i < ops.length && ops[i].t !== "=") {
      if (ops[i].t === "-") dels.push(ops[i]); else adds.push(ops[i]);
      i++;
    }
    const m = Math.max(dels.length, adds.length);
    for (let k = 0; k < m; k++) {
      const d = dels[k], a = adds[k];
      if (d && a) rows.push({ t: "~", a: d.a, b: a.b });
      else if (d) rows.push({ t: "-", a: d.a, b: -1 });
      else rows.push({ t: "+", a: -1, b: a.b });
    }
  }
  return rows;
}
