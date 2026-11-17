// Color Picker — one color per user, live across phones on the same Wi-Fi.
// Run:  node server.js            (open for 30 minutes)
//       node server.js 10         (open for 10 minutes)
// No installs needed. Requires Node.js 14+.

const http = require("http");
const os = require("os");

const MINUTES = Number(process.argv[2]) || 30;
const PORT = Number(process.env.PORT) || 3000;
const ENDS_AT = Date.now() + MINUTES * 60 * 1000;

const COLORS = [
  { id: "ruby",     name: "Ruby",     hex: "#E11D48" },
  { id: "tangerine",name: "Tangerine",hex: "#FB923C" },
  { id: "saffron",  name: "Saffron",  hex: "#FACC15" },
  { id: "lime",     name: "Lime",     hex: "#A3E635" },
  { id: "emerald",  name: "Emerald",  hex: "#10B981" },
  { id: "teal",     name: "Teal",     hex: "#14B8A6" },
  { id: "sky",      name: "Sky",      hex: "#38BDF8" },
  { id: "cobalt",   name: "Cobalt",   hex: "#3B82F6" },
  { id: "indigo",   name: "Indigo",   hex: "#6366F1" },
  { id: "violet",   name: "Violet",   hex: "#A855F7" },
  { id: "orchid",   name: "Orchid",   hex: "#EC4899" },
  { id: "slate",    name: "Slate",    hex: "#94A3B8" },
];

const picks = {};   // colorId -> display name
const users = {};   // lowercase name -> { name, color|null }

const HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0E0B16">
<title>Pick your color</title>
<style>
:root{--bg:#0E0B16;--ink:#F4F1FA;--mute:#9A93AD;--card:rgba(255,255,255,.06);--line:rgba(255,255,255,.12);--accent:#C4B5FD}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--ink);
  font-family:"Avenir Next","Segoe UI",system-ui,-apple-system,sans-serif}
body{min-height:100vh;min-height:100dvh;overflow-x:hidden;
  background:
   radial-gradient(60% 40% at 15% 0%,rgba(168,85,247,.35),transparent 70%),
   radial-gradient(50% 40% at 95% 20%,rgba(56,189,248,.22),transparent 70%),
   radial-gradient(60% 40% at 50% 110%,rgba(236,72,153,.25),transparent 70%),var(--bg)}
main{max-width:460px;margin:0 auto;padding:max(28px,env(safe-area-inset-top)) 22px 40px}
.timer{display:inline-flex;gap:8px;align-items:center;padding:8px 14px;border:1px solid var(--line);
  border-radius:999px;background:var(--card);font-size:13px;color:var(--mute);backdrop-filter:blur(10px)}
.timer i{width:8px;height:8px;border-radius:50%;background:#34D399;box-shadow:0 0 10px #34D399}
.timer b{color:var(--ink);font-variant-numeric:tabular-nums}
h1{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;font-weight:400;font-size:44px;
  line-height:1.05;letter-spacing:-.02em;margin:28px 0 10px}
p.sub{color:var(--mute);margin:0 0 28px;line-height:1.5;font-size:16px}
.screen{display:none;animation:in .5s ease both}.screen.on{display:block}
@keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
input{width:100%;padding:18px 20px;font-size:18px;color:var(--ink);background:var(--card);
  border:1px solid var(--line);border-radius:18px;outline:none;backdrop-filter:blur(10px);transition:.2s}
input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(196,181,253,.15)}
.btn{width:100%;margin-top:14px;padding:18px;font-size:17px;font-weight:600;border:0;border-radius:18px;
  color:#14101F;background:linear-gradient(135deg,#DDD6FE,#A5B4FC 50%,#F9A8D4);cursor:pointer;transition:transform .15s}
.btn:active{transform:scale(.98)}.btn:disabled{opacity:.4}
.err{color:#FDA4AF;font-size:14px;min-height:20px;margin-top:12px}
.hello{color:var(--mute);font-size:15px;margin-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.chip{position:relative;aspect-ratio:1/1.1;border-radius:22px;border:2px solid transparent;
  cursor:pointer;display:flex;align-items:flex-end;padding:12px;font-weight:600;font-size:14px;
  color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.35);transition:transform .2s,border-color .2s,box-shadow .2s;
  box-shadow:0 10px 24px -12px var(--c),inset 0 1px 0 rgba(255,255,255,.35);background:var(--c);overflow:hidden}
.chip::after{content:"";position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.28),transparent 55%)}
.chip span{position:relative;z-index:1}
.chip:active{transform:scale(.95)}
.chip.sel{border-color:#fff;transform:scale(1.04);box-shadow:0 0 0 4px rgba(255,255,255,.18),0 14px 30px -10px var(--c)}
.chip.gone{animation:out .45s ease forwards;pointer-events:none}
@keyframes out{to{opacity:0;transform:scale(.6)}}
.empty{grid-column:1/-1;text-align:center;color:var(--mute);padding:30px 0}
.final{text-align:center;padding-top:30px}
.orb{width:170px;height:170px;border-radius:50%;margin:10px auto 28px;background:var(--c);
  box-shadow:0 0 80px var(--c),inset 0 8px 20px rgba(255,255,255,.4);animation:pop .8s cubic-bezier(.2,1.4,.4,1) both}
@keyframes pop{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
.final h1{margin-top:0}
.tag{display:inline-block;margin-top:10px;padding:10px 18px;border-radius:999px;background:var(--card);
  border:1px solid var(--line);font-size:15px}
canvas{position:fixed;inset:0;pointer-events:none;z-index:9}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style></head>
<body><canvas id="fx"></canvas>
<main>
  <div class="timer"><i></i>Open for <b id="t">--:--</b></div>

  <section class="screen on" id="s-login">
    <h1>Claim your color.</h1>
    <p class="sub">Enter your name to join. Every color can belong to only one person.</p>
    <input id="name" placeholder="Your name" maxlength="24" autocomplete="off" autocapitalize="words">
    <button class="btn" id="go">Continue</button>
    <div class="err" id="e1"></div>
  </section>

  <section class="screen" id="s-pick">
    <div class="hello" id="hi"></div>
    <h1>Choose one.</h1>
    <p class="sub">Tap a color, then confirm. Once someone takes it, it disappears for everyone else.</p>
    <div class="grid" id="grid"></div>
    <button class="btn" id="lock" disabled>Pick a color</button>
    <div class="err" id="e2"></div>
  </section>

  <section class="screen final" id="s-done">
    <div class="orb" id="orb"></div>
    <h1 id="cong">Congratulations!</h1>
    <p class="sub" id="msg"></p>
    <div class="tag" id="tag"></div>
  </section>

  <section class="screen" id="s-closed">
    <h1>This session has ended.</h1>
    <p class="sub">The color picker was only open for a limited time. Thanks for joining!</p>
  </section>
</main>
<script>
const $=id=>document.getElementById(id);
let me=localStorage.getItem("cp_name")||"",selected=null,colors=[],taken={},ends=0,done=false;
const show=id=>{document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on",s.id===id))};
const api=(u,b)=>fetch(u,b?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}:{}).then(async r=>({ok:r.ok,status:r.status,data:await r.json()}));

function tick(){const s=Math.max(0,Math.floor((ends-Date.now())/1000));
  $("t").textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
  if(s===0&&ends)show("s-closed")}
setInterval(tick,1000);

async function login(){
  const n=$("name").value.trim();if(n.length<2){$("e1").textContent="Please enter at least 2 characters.";return}
  const r=await api("/api/login",{name:n});
  if(!r.ok){$("e1").textContent=r.data.error;return}
  me=r.data.name;localStorage.setItem("cp_name",me);enter(r.data)}
function enter(d){ends=d.endsAt;if(d.color){finish(d.color,true);return}
  $("hi").textContent="Hi, "+me;show("s-pick");refresh()}
async function refresh(){
  if(done)return;const r=await api("/api/state");
  if(r.status===410){show("s-closed");return}
  colors=r.data.colors;taken=r.data.taken;ends=r.data.endsAt;render()}
function render(){
  const g=$("grid"),free=colors.filter(c=>!taken[c.id]);
  if(selected&&taken[selected]){selected=null;$("e2").textContent="That color was just taken. Pick another.";upd()}
  [...g.children].forEach(el=>{if(el.dataset.id&&taken[el.dataset.id]&&!el.classList.contains("gone")){
    el.classList.add("gone");setTimeout(()=>el.remove(),450)}});
  free.forEach(c=>{if(!g.querySelector('[data-id="'+c.id+'"]')){
    const b=document.createElement("button");b.className="chip";b.dataset.id=c.id;b.style.setProperty("--c",c.hex);
    b.innerHTML="<span>"+c.name+"</span>";b.onclick=()=>{selected=c.id;$("e2").textContent="";
      g.querySelectorAll(".chip").forEach(x=>x.classList.toggle("sel",x===b));upd()};g.appendChild(b)}});
  if(!free.length&&!g.querySelector(".empty")){const d=document.createElement("div");d.className="empty";d.textContent="All 12 colors have been claimed.";g.appendChild(d)}}
function upd(){const b=$("lock"),c=colors.find(x=>x.id===selected);b.disabled=!c;b.textContent=c?"Confirm "+c.name:"Pick a color"}
async function lock(){
  if(!selected)return;const r=await api("/api/pick",{name:me,color:selected});
  if(r.ok){finish(selected,false)}
  else{$("e2").textContent=r.data.error;selected=null;upd();refresh()}}
function finish(id,again){
  done=true;const c=(colors.find(x=>x.id===id)||{});
  api("/api/state").then(r=>{const col=r.data.colors.find(x=>x.id===id);
    document.documentElement.style.setProperty("--c",col.hex);$("orb").style.setProperty("--c",col.hex);
    $("tag").textContent=col.name+" · "+col.hex;
    $("cong").textContent=again?"Welcome back, "+me+".":"Congratulations, "+me+"!";
    $("msg").textContent=again?"You've already claimed your color. It's yours alone.":"You've claimed a color that nobody else can have. Enjoy it!";
    show("s-done");if(!again)confetti(col.hex)})}
function confetti(hex){const cv=$("fx"),x=cv.getContext("2d");cv.width=innerWidth;cv.height=innerHeight;
  const P=Array.from({length:140},()=>({x:innerWidth/2,y:innerHeight*.4,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,
    s:Math.random()*8+4,c:[hex,"#fff","#FDE68A","#F9A8D4","#A5B4FC"][Math.floor(Math.random()*5)],r:Math.random()*6}));
  let f=0;(function a(){x.clearRect(0,0,cv.width,cv.height);P.forEach(p=>{p.vy+=.35;p.x+=p.vx;p.y+=p.vy;p.r+=.2;
    x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore()});
    if(++f<150)requestAnimationFrame(a);else x.clearRect(0,0,cv.width,cv.height)})()}
$("go").onclick=login;$("lock").onclick=lock;$("name").onkeydown=e=>{if(e.key==="Enter")login()};
setInterval(refresh,2000);
(async()=>{const r=await api("/api/state");if(r.status===410){show("s-closed");return}
  colors=r.data.colors;ends=r.data.endsAt;tick();
  if(me){const l=await api("/api/login",{name:me});if(l.ok){me=l.data.name;enter(l.data)}}})();
</script></body></html>`;

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type + "; charset=utf-8", "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((ok) => {
    let d = ""; req.on("data", (c) => (d += c));
    req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch { ok({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const open = Date.now() < ENDS_AT;
  if (req.url === "/" ) return send(res, 200, HTML, "text/html");
  if (!open && req.url.startsWith("/api/")) return send(res, 410, { error: "Session ended", endsAt: ENDS_AT });

  if (req.url === "/api/state") return send(res, 200, { colors: COLORS, taken: picks, endsAt: ENDS_AT });

  if (req.url === "/api/login" && req.method === "POST") {
    const name = String((await readBody(req)).name || "").trim().slice(0, 24);
    if (name.length < 2) return send(res, 400, { error: "Please enter a valid name." });
    const key = name.toLowerCase();
    if (!users[key]) users[key] = { name, color: null };
    return send(res, 200, { name: users[key].name, color: users[key].color, endsAt: ENDS_AT });
  }

  if (req.url === "/api/pick" && req.method === "POST") {
    const { name, color } = await readBody(req);
    const u = users[String(name || "").toLowerCase()];
    if (!u) return send(res, 401, { error: "Please log in first." });
    if (u.color) return send(res, 409, { error: "You already picked a color." });
    if (!COLORS.some((c) => c.id === color)) return send(res, 400, { error: "Unknown color." });
    if (picks[color]) return send(res, 409, { error: "Sorry, that color was just taken. Pick another." });
    picks[color] = u.name; u.color = color;
    console.log(`  ${u.name} -> ${color}  (${Object.keys(picks).length}/12 taken)`);
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i.family === "IPv4" && !i.internal);
  console.log(`\n  Color Picker is live for ${MINUTES} minute(s)\n`);
  console.log(`  This computer : http://localhost:${PORT}`);
  ips.forEach((i) => console.log(`  Phones (Wi-Fi): http://${i.address}:${PORT}`));
  console.log("\n  Phones must be on the same Wi-Fi as this computer.\n");
});


