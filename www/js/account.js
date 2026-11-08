/* Ascend accounts: on-device accounts, optional Firebase cloud accounts, profile and inactivity helper. */
const ACC = (() => {
  const SK = "ascend_sess", AK = "ascend_accts", GK = "ascend_guest", LEG = "ascend_v1";
  const AVC = ["#4cc9ff", "#b48cff", "#3ddc97", "#ff7a45", "#ffd34d", "#ff5470"];
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} };
  let sess = jget(SK, null), mode = "in", err = "", busy = false, form = { id: "", nm: "" }, delC = false, st = "not synced yet", pushT = 0, open = false;
  const lsg = k => { try { return localStorage.getItem(k) } catch (e) { return null } };
  if (!sess && lsg(LEG)) { try { localStorage.setItem(GK, "1") } catch (e) {} }
  const fbOn = () => !!(window.FB && FB.apiKey && FB.projectId);
  const ACT = new Set(["go", "bonus", "dq", "rt", "siCk", "siClaim", "claim", "penq", "trial", "set", "fb"]);
  const E = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const day = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") };
  const key = () => sess ? sess.k : LEG;
  const need = () => !sess && !lsg(GK);

  /* ---------- passwords for on-device accounts ---------- */
  const b64 = u8 => btoa(String.fromCharCode(...u8));
  const rnd = () => b64(crypto.getRandomValues(new Uint8Array(16)));
  async function hash(pw, salt) {
    if (window.crypto && crypto.subtle) {
      const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
      const b = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 150000, hash: "SHA-256" }, k, 256);
      return b64(new Uint8Array(b));
    }
    let h = 5381; const s = salt + pw; for (let i = 0; i < 20000; i++) for (let j = 0; j < s.length; j++) h = ((h << 5) + h + s.charCodeAt(j)) | 0; return "f" + h;
  }

  /* ---------- Firebase (REST, no extra libraries) ---------- */
  const fbMsg = m => /EMAIL_EXISTS/.test(m) ? "This email already has an account. Try signing in." : /INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m) ? "Wrong email or password." : /WEAK_PASSWORD/.test(m) ? "Password must be at least 6 characters." : /INVALID_EMAIL/.test(m) ? "That email does not look right." : /TOO_MANY/.test(m) ? "Too many attempts. Try again later." : /OPERATION_NOT_ALLOWED/.test(m) ? "Email sign-in is not switched on in Firebase yet." : "Something went wrong. Try again.";
  async function fbCall(path, body) {
    let r; try { r = await fetch("https://identitytoolkit.googleapis.com/v1/" + path + "?key=" + FB.apiKey, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) } catch (e) { throw new Error("No internet connection.") }
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(fbMsg(j.error && j.error.message || "")); return j;
  }
  const base = () => "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents";
  async function tok() {
    if (Date.now() < sess.exp - 60000) return sess.idt;
    const r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + FB.apiKey, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(sess.rt) });
    const j = await r.json(); if (!r.ok) throw new Error("expired");
    sess.idt = j.id_token; sess.rt = j.refresh_token; sess.exp = Date.now() + (+j.expires_in) * 1000; jset(SK, sess); return sess.idt;
  }
  async function fsr(method, path, body, t) {
    const r = await fetch(base() + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: body ? JSON.stringify(body) : undefined });
    if (r.status == 404) return null; const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("fs"); return j;
  }
  const sv = x => ({ stringValue: String(x) }), iv = x => ({ integerValue: String(Math.round(x)) });
  async function push() {
    if (!sess || sess.mode != "fb" || !S) return;
    const t = await tok(), lv = lvl(S.xp);
    await fsr("PATCH", "/users/" + sess.uid + "?updateMask.fieldPaths=data&updateMask.fieldPaths=ts", { fields: { data: sv(JSON.stringify(S)), ts: iv(S.ts || Date.now()) } }, t);
    await fsr("PATCH", "/board/" + sess.uid + "?" + ["n", "t", "w", "r", "l", "u"].map(f => "updateMask.fieldPaths=" + f).join("&"), { fields: { n: sv(S.p.name), t: iv(S.xp), w: iv(wk()), r: sv(rank(lv.l)), l: iv(lv.l), u: iv(Date.now()) } }, t);
  }
  async function pull(t) {
    const j = await fsr("GET", "/users/" + sess.uid, null, t);
    if (!j || !j.fields || !j.fields.data) return null;
    return { data: j.fields.data.stringValue, ts: +(j.fields.ts && j.fields.ts.integerValue || 0) };
  }
  async function board() {
    const t = await tok(), j = await fsr("GET", "/board?pageSize=100&orderBy=t%20desc", null, t);
    return ((j && j.documents) || []).map(d => {
      const f = d.fields || {}, id = d.name.split("/").pop(), g = k => f[k] && (f[k].integerValue != null ? +f[k].integerValue : f[k].stringValue);
      return { n: String(g("n") || "Player"), t: +g("t") || 0, w: +g("w") || 0, r: g("r"), me: id == sess.uid };
    });
  }
  function sync() {
    if (!sess || sess.mode != "fb") return; clearTimeout(pushT);
    pushT = setTimeout(() => { push().then(() => { st = "synced " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }).catch(() => { st = "offline, will sync later" }) }, 4000);
  }
  async function boot() {
    if (!sess || sess.mode != "fb" || !fbOn()) return;
    try { const t = await tok(), c = await pull(t); if (c && c.ts > ((S && S.ts) || 0) + 1000) { localStorage.setItem(sess.k, c.data); location.reload(); return } if (S) sync() } catch (e) { st = "offline, will sync later" }
  }

  /* ---------- sign in / sign up ---------- */
  function start(s, adopt) {
    if (adopt && typeof S !== "undefined" && S && !sess && !lsg(s.k)) { try { localStorage.setItem(s.k, JSON.stringify(S)) } catch (e) {} }
    jset(SK, s); try { localStorage.removeItem(GK) } catch (e) {} location.reload();
  }
  async function go() {
    const id = ($("#au_id").value || "").trim(), pw = $("#au_pw").value || "", nm = $("#au_nm") ? $("#au_nm").value.trim() : "";
    form = { id, nm }; err = "";
    if (mode == "up" && pw != ($("#au_pw2").value || "")) { err = "Passwords do not match."; return render() }
    busy = true; render();
    try { fbOn() ? await fbGo(id, pw, nm) : await localGo(id.toLowerCase(), pw, nm) } catch (e) { err = e.message || "Something went wrong."; busy = false; render() }
  }
  async function localGo(id, pw, nm) {
    if (!/^[a-z0-9_.@-]{3,40}$/.test(id)) throw new Error("Use 3 to 40 letters, numbers or _ . - characters.");
    if (pw.length < 6) throw new Error("Password must be at least 6 characters.");
    const list = jget(AK, []), a = list.find(x => x.id == id);
    if (mode == "up") {
      if (a) throw new Error("That username is already used on this device.");
      const salt = rnd(); list.push({ id, salt, h: await hash(pw, salt), created: Date.now() }); jset(AK, list);
      if (nm && typeof S !== "undefined" && S) S.p.name = nm;
      start({ k: "ascend_u_" + id, id, mode: "local" }, true);
    } else {
      if (!a || a.h != await hash(pw, a.salt)) throw new Error("Wrong username or password.");
      start({ k: "ascend_u_" + id, id, mode: "local" }, false);
    }
  }
  async function fbGo(id, pw, nm) {
    if (!/^\S+@\S+\.\S+$/.test(id)) throw new Error("Enter a valid email address.");
    if (pw.length < 6) throw new Error("Password must be at least 6 characters.");
    const j = await fbCall(mode == "up" ? "accounts:signUp" : "accounts:signInWithPassword", { email: id, password: pw, returnSecureToken: true });
    const s = { k: "ascend_f_" + j.localId, id: j.email, uid: j.localId, mode: "fb", idt: j.idToken, rt: j.refreshToken, exp: Date.now() + (+j.expiresIn) * 1000 };
    if (mode == "up" && nm && typeof S !== "undefined" && S) S.p.name = nm;
    try { sess = s; const c = await pull(await tok()); sess = null; if (c) { try { localStorage.setItem(s.k, c.data) } catch (e) {} } } catch (e) { sess = null }
    start(s, true);
  }

  /* ---------- screens ---------- */
  function view() {
    const up = mode == "up", fb = fbOn();
    return `<div class="lbg"></div><div class="lbox" style="margin:7vh auto 20px;max-width:440px"><h1>${up ? "Create account" : "Sign in"}</h1>
<p class="mu" style="margin:0 0 12px;font-size:13px">${fb ? "Your progress is saved to the cloud, so you can use it on any phone." : "Accounts are saved on this device. Cloud sync can be switched on in the app settings."}</p>
<div class="g" style="margin-bottom:10px"><button class="btn ${up ? "ghost" : ""}" style="margin:0;padding:10px" data-a="authMode" data-v="in">Sign in</button><button class="btn ${up ? "" : "ghost"}" style="margin:0;padding:10px" data-a="authMode" data-v="up">Create account</button></div>
<label class="fl2"><span>${fb ? "Email" : "Username"}</span><input type="text" id="au_id" autocomplete="username" value="${E(form.id)}"></label>
${up ? `<label class="fl2"><span>Display name</span><input type="text" id="au_nm" maxlength="20" value="${E(form.nm)}"></label>` : ""}
<label class="fl2"><span>Password</span><input type="password" id="au_pw" autocomplete="${up ? "new-password" : "current-password"}"></label>
${up ? `<label class="fl2"><span>Repeat password</span><input type="password" id="au_pw2" autocomplete="new-password"></label>` : ""}
<p class="be">${E(err)}</p><button class="btn" data-a="authGo" ${busy ? "disabled" : ""}>${busy ? "Please wait" : up ? "Create account" : "Sign in"}</button>
${fb && !up ? `<button class="btn ghost" data-a="authReset">Forgot password</button>` : ""}
${open ? `<button class="btn ghost" data-a="authClose">Cancel</button>` : `<button class="btn ghost" data-a="guest">Continue as guest</button>`}</div>`;
  }
  const modal = () => `<div class="pn"><div style="width:100%;max-width:440px">${view().replace('<div class="lbg"></div>', "")}</div></div>`;
  function card() {
    const nm = S.p.name, ini = (nm || "?").trim().charAt(0).toUpperCase(), col = AVC[S.av || 0];
    return `<div class="card"><div class="acc"><div class="av" style="background:${col}">${E(ini)}</div><div style="min-width:0"><b>${E(nm)}</b><br><span class="mu">${sess ? E(sess.id) : "Guest, not signed in"}</span><br><span class="mu" style="font-size:12px">${sess ? (sess.mode == "fb" ? "Cloud account \u00b7 " + st : "Saved on this device") : "Progress is saved on this device only"}</span></div></div>
<div class="avs">${AVC.map((c, i) => `<button class="avd ${(S.av || 0) == i ? "on" : ""}" style="background:${c}" data-a="avatar" data-v="${i}" aria-label="Avatar colour ${i + 1}"></button>`).join("")}</div>
<div class="g" style="margin-top:10px"><input type="text" id="pf_name" maxlength="20" value="${E(nm)}" aria-label="Display name"><button class="btn ghost" style="margin:0" data-a="profSave">Save name</button></div>
${sess ? `<button class="btn ghost" data-a="signout">Sign out</button><button class="btn ghost" style="color:var(--rd);border-color:var(--rd)" data-a="acctDel">${delC ? "Tap again to delete everything" : "Delete account"}</button>` : `<button class="btn" data-a="authOpen">Create account or sign in</button>`}</div>`;
  }
  const gapDays = () => (S && S.la) ? Math.round((new Date(day() + "T00:00") - new Date(S.la + "T00:00")) / 864e5) : 0;
  function idle() {
    const g = gapDays(); if (g < 2) return "";
    const per = Math.min(200, Math.max(25, Math.round(S.xp * .015)));
    return `<div class="warn">${g <= 3 ? "Inactive for " + g + " days. In " + (4 - g) + " day" + (4 - g > 1 ? "s" : "") + " you start losing XP. Do any quest, workout or check-in today." : "Inactive for " + g + " days. You lose about " + per + " XP every day until you train again."}</div>`;
  }

  /* ---------- actions ---------- */
  function act(a, v) {
    if (typeof S !== "undefined" && S && ACT.has(a)) S.la = day();
    if (a == "authMode") { mode = v; err = ""; render(); return true }
    if (a == "authGo") { go(); return true }
    if (a == "authOpen") { open = true; err = ""; render(); return true }
    if (a == "authClose") { open = false; render(); return true }
    if (a == "guest") { try { localStorage.setItem(GK, "1") } catch (e) {} render(); return true }
    if (a == "avatar") { S.av = +v; save(); render(); return true }
    if (a == "profSave") { const n = ($("#pf_name").value || "").trim().slice(0, 20); if (n) { S.p.name = n; save(); render() } return true }
    if (a == "authReset") { const em = ($("#au_id").value || "").trim(); form.id = em; fbCall("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: em }).then(() => { err = "If that email has an account, a reset link was sent."; render() }).catch(e => { err = e.message; render() }); return true }
    if (a == "signout") { try { localStorage.removeItem(SK) } catch (e) {} Promise.race([push().catch(() => {}), new Promise(r => setTimeout(r, 1500))]).then(() => location.reload()); return true }
    if (a == "acctDel") {
      if (!delC) { delC = true; render(); return true }
      (async () => {
        try { if (sess.mode == "fb") { const t = await tok(); await fsr("DELETE", "/users/" + sess.uid, null, t).catch(() => {}); await fsr("DELETE", "/board/" + sess.uid, null, t).catch(() => {}); await fbCall("accounts:delete", { idToken: t }) } else jset(AK, jget(AK, []).filter(x => x.id != sess.id)) } catch (e) {}
        try { localStorage.removeItem(sess.k); localStorage.removeItem(SK) } catch (e) {} location.reload();
      })(); return true;
    }
    return false;
  }
  return { key, need, view, modal, card, idle, act, boot, sync, board, isOpen: () => open, fbBoard: () => !!(sess && sess.mode == "fb" && fbOn()) };
})();
