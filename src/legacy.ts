// @ts-nocheck
/* The original seam is intentionally isolated while screens are migrated one at a time. */

/* The Cold Open lives in src/motion/timeline.ts, outside this file, so the
   seam does not grow. It is the only new dependency onboarding takes. */
import { playColdOpen } from './motion/timeline';
/* The micro-interaction layer: pop, burst, flyTo, countTo, spring. The seam
   marks markup with data-fx; this file owns state, micro owns decoration. */
import { installMicro, microPublic } from './motion/micro';
/* Onboarding scenes: shared-element step transitions, the physics meme deck,
   the live-waveform audio calibration, the growing Fingerprint, the reveal. */
import { stepTransition, physicsStack, waveList, fpGrow, confidence as obConfidence, runReveal } from './motion/onboard';
/* PreviewProvider stub (brief §2.2): resolves nothing offline, says so. */
import { fetchPreview } from './lib/preview';
/* The Duel prompt set — the same list the /d/:id page and the card render. */
import { DUEL_PROMPTS, duelVerdict as duelVerdictLine } from './data/seed/duelPrompts';
import { renderDuelCard } from './duel/card';
/* The shared synth (Settings → Sound gates it here, in one place). */
import { synth } from './motion/audio';
/* The 122 original in-house meme cards. Production content is generated, not
   the real corpus under public/memes, via src/content. */
import { SEED_MEMES } from './data/seed/memes';
/* The seed track catalogue, used only to check whether an id can cross the
   adapter boundary without fabricating a vector. */
import { SEED_TRACKS } from './data/seed/tracks';
/* v5: the single persisted store. Every reaction, save and pin goes through
   it, and every screen reads through its selectors. This is the fix for the
   "You tab shows 0 after I liked and saved" bug — see docs/v5/DECISIONS.md
   D-03. The seam still keeps its own shapes for its own markup, but it no
   longer decides what the numbers are. */
import { getStore } from './store';
import { v5config } from './store/config';
import {
  laughedItemKeys as v5LaughedKeys,
  laughsGivenCount as v5LaughsGiven,
  pinsByKind as v5PinsByKind,
  savedItemKeys as v5SavedKeys,
  LEGACY_LAUGH_EMOJI as V5_LAUGH,
  LEGACY_LIKE as V5_LIKE,
} from './store/selectors';

const V5 = getStore();
/* v5 rollout flags. Off by default, so a build without `?v5=1` (or an explicit
   `window.CULTURED_CONFIG.v5`) renders exactly the pre-v5 app. */
const V5_HOME=v5config.v5.home;
const V5_VAULT=v5config.v5.vault;
const V5_MATRIX=v5config.v5.matrix;
const V5_PEOPLE=v5config.v5.people;
const V5_ARENA=v5config.v5.arena;
const V5_PROFILE=v5config.v5.profile;
let v5VaultHandle=null;
const openV5Vault=async()=>{
  if(v5VaultHandle)return;
  const {mountVault}=await import('./v5/vault');
  const layer=document.createElement('div');layer.id='v5-vault-layer';document.body.appendChild(layer);
  v5VaultHandle=mountVault(layer,{onClose:()=>{v5VaultHandle=null;layer.remove();renderYou()}});
};
/** `kind:id` → a renderable item in this seam: a POST, or a corpus meme. */
const v5Resolve = key => {
  const i = key.indexOf(':');
  if (i < 0) return null;
  const kind = key.slice(0, i), id = key.slice(i + 1);
  if (POSTS[id]) return { kind, post: POSTS[id], id };
  const m = MM.find(x => x.id === id);
  if (m) return { kind, meme: m, id };
  return null;
};

(()=>{
'use strict';
/* ================= helpers ================= */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const ago=ms=>{const m=Math.round((Date.now()-ms)/60000);return m<1?'now':m<60?m+'m':m<1440?Math.round(m/60)+'h':Math.round(m/1440)+'d'};
const repoCall=(method,...args)=>{try{const r=window.Cultured&&window.Cultured.repo;return r&&typeof r[method]==='function'?r[method](...args):Promise.resolve()}catch(e){return Promise.resolve()}};
const store={
  get(k,d){try{const v=localStorage.getItem('cultured2:'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('cultured2:'+k,JSON.stringify(v))}catch(e){}},
  clear(){try{Object.keys(localStorage).filter(k=>k.indexOf('cultured2:')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}}
};
/* ===== v4 production seam: the ONLY places the real backend/analytics plug in ===== */
const CFG=Object.assign({backend:'local',flags:{spotify:false,lastfm:true,appleMusic:false,phoneOtp:false,ugc:false,sound:true,demoData:false,rooms:false},assets:{}},window.CULTURED_CONFIG||{});
/* ------------------------------------------------------------------ honesty
   Two flags decide how much of this build is a demonstration rather than a
   product, and a production build refuses to be a demonstration at all.

   MEMES       the images under public/memes are the real corpus, listed in
               src/content/memes.manifest.json. None of the twenty seed files
               carries a licence yet (see public/memes/sources.json), so
               `npm run content:gate` fails the production build until they are
               replaced with rights-cleared art. Nothing in this file can
               override that, whatever `window.CULTURED_CONFIG` says.
   DEMO_DATA   seeded people, circle posts and chat transcripts. OFF by
               default everywhere, dev included — opt in with `?demo=1` or by
               setting `window.CULTURED_CONFIG.flags.demoData = true`. Mirrors
               the v5 `demo` gate so the invented population is never the
               default path on any build.
   ROOMS       the 15-minute synced listening rooms. Off everywhere for now.
   ------------------------------------------------------------------------- */
/* `import.meta.env.DEV` / `.PROD` are substituted with the literal `true` or
   `false` by the bundler, so these three constants fold to constants at build
   time and the branches they guard are removed. Writing this as
   `!!(typeof import.meta !== 'undefined' && …)` instead left web-image URLs in
   the production bundle, because the `typeof` guard defeated the folding. */
const DEV=import.meta.env.DEV===true;
/* Explicit opt-in only — `?demo=1` or `flags.demoData === true`. Was
   `DEV && CFG.flags.demoData !== false`, which turned the 48 seeded people
   and the PROTOTYPE banner on by default in every dev preview. That is the
   one thing the honesty rules forbid: fabricated social proof shown to
   someone who did not ask for it. Now it costs one query param. */
const DEMO_PARAM=(()=>{try{return typeof location!=='undefined'&&/[?&]demo=1\b/.test(location.search)}catch(_){return false}})();
/* The `DEV &&` prefix must stay: it is what folds DEMO_DATA to the constant
   `false` in a production build, so the 48 seeded personas, the circle posts
   and the transcripts tree-shake out of the shipped bundle (asserted by
   no-fake-people.test.ts). Dropping it would gate them at runtime but still
   ship them. In dev the personas now cost `?demo=1`, or an explicit
   `flags.demoData = true`, instead of being on by default. */
const DEMO_DATA=DEV&&(DEMO_PARAM||CFG.flags.demoData===true);
const FEATURE_ROOMS=CFG.flags.rooms===true;
const track=(ev,p)=>{try{if(window.posthog&&window.posthog.capture)window.posthog.capture(ev,p||{});else if(window.CulturedHooks&&window.CulturedHooks.track)window.CulturedHooks.track(ev,p||{})}catch(e){}};
/* Merge, never replace: `main.ts` installs `Cultured.repo` before this file is
   evaluated, and an assignment here used to wipe the bridge — every repoCall
   silently no-op'd. The seam adds config/track/store to whatever exists. */
/* `duelState` is a getter rather than a snapshot: S.duelLink is reassigned when
   a duel is created and when its verdict lands, and the v5 Arena reads it
   through the same bridge the repo uses. A copied value would go stale and the
   tile would report a duel as waiting after it had been revealed. */
window.Cultured=Object.assign(window.Cultured||{},{config:CFG,track,store,duelState:()=>(S.duelLink&&S.duelLink.id?S.duelLink:null)});
const isObj=o=>o&&typeof o==='object'&&!Array.isArray(o);
const merge=(a,b)=>{for(const k in b){a[k]=isObj(a[k])&&isObj(b[k])?merge(a[k],b[k]):b[k]}return a};
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const hx=n=>n.toString(16).padStart(2,'0');
const toRGB=h=>{const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]};
const mixc=(a,b,t)=>{const x=toRGB(a),y=toRGB(b);return '#'+x.map((v,i)=>hx(Math.round(v+(y[i]-v)*t))).join('')};
function hsl2hex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(v=>hx(Math.round(v*255))).join('')}
const palFrom=str=>{const h=hash(str)%360;return[hsl2hex(h,40,8),hsl2hex(h,80,60),hsl2hex((h+55)%360,75,62),hsl2hex((h+300)%360,55,30)]};
function countTo(el,n,ms){
  if(!el)return;ms=ms||900;const t0=performance.now(),from=0;
  const step=t=>{const k=clamp((t-t0)/ms,0,1),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(n-from)*e);if(k<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
}

/* ================= icons ================= */
const ic=(d,w)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I={
  home:ic('<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>'),
  pair:ic('<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>'),
  chat:ic('<path d="M4 5.5h16v11H9.5L5 20v-3.5H4z"/>'),
  you:ic('<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="9" stroke-dasharray="42 14"/>'),
  heart:ic('<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/>'),
  laugh:ic('<circle cx="12" cy="12" r="9"/><path d="M7.6 10.4c.9-1.1 2.1-1.1 3 0M13.4 10.4c.9-1.1 2.1-1.1 3 0"/><path class="m" d="M7.5 13.6h9a4.5 4.5 0 0 1-9 0z"/>'),
  comment:ic('<path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z"/>'),
  bookmark:ic('<path d="M6.5 4h11v16.5L12 16.8 6.5 20.5z"/>'),
  share:ic('<path d="M12 15.5V4M8 7.8 12 4l4 3.8M5 12v7.5h14V12"/>'),
  play:'<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
  refresh:ic('<path d="M20 11a8 8 0 1 0-2.2 5.6M20 4.5V11h-6.5"/>'),
  gear:ic('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 7.4l2 1.2M17.5 15.4l2 1.2M4.5 16.6l2-1.2M17.5 8.6l2-1.2"/>'),
  back:ic('<path d="M15 5l-7 7 7 7"/>',2),
  x:ic('<path d="M6 6l12 12M18 6L6 18"/>',2.2),
  res:ic('<circle cx="9" cy="12" r="5.8"/><circle cx="15" cy="12" r="5.8"/>',2.1),
  rewind:ic('<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>'),
  sliders:ic('<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>'),
  send:ic('<path d="M4 11.6 20 4l-5.6 16-3.2-6.6z"/>'),
  headphones:ic('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6" rx="1.5"/><rect x="16.5" y="14" width="4" height="6" rx="1.5"/>'),
  check:ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>',2),
  plus:ic('<path d="M12 5v14M5 12h14"/>',2),
  minus:ic('<path d="M5 12h14"/>',2),
  link:ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  dots:ic('<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',2.4),
  note:ic('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
  chevd:ic('<path d="M6 9l6 6 6-6"/>',2),
  chevr:ic('<path d="M9 6l6 6-6 6"/>',2),
  pin:ic('<path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
  star:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.6 5.7 6.2.7-4.6 4.2 1.3 6.1L12 16.6 6.5 19.7l1.3-6.1L3.2 9.4l6.2-.7z"/></svg>'
};
const SEAT='<svg viewBox="0 0 24 24"><path d="M7 11V8.5A2.5 2.5 0 0 1 9.5 6h5A2.5 2.5 0 0 1 17 8.5V11"/><rect x="4.5" y="11" width="15" height="7" rx="2.5"/><path d="M7 18v1.5M17 18v1.5"/></svg>';
const RING_GLYPH=`<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="14" cy="14" r="2.6"/><circle cx="14" cy="14" r="7.6" stroke-dasharray="36 12"/><circle cx="14" cy="14" r="12.2" stroke-dasharray="54 23" transform="rotate(40 14 14)"/></svg>`;
const ASSETS=(window as Window & { CulturedAssets?: Record<string,string> }).CulturedAssets||{};
function mediaKick(){$$('.media-layer.is-video video').forEach(v=>{if(v.paused)v.play().catch(()=>{})})}
const mediaLayer=(key,extra='')=>{const u=ASSETS[key];if(!u)return '';return u.endsWith('.mp4')?`<div class="media-layer ${extra} is-video" aria-hidden="true"><video src="${u}" autoplay muted loop playsinline preload="auto" tabindex="-1"></video></div>`:`<div class="media-layer ${extra}" aria-hidden="true" style="--media-url:url('${u}')"></div>`};

/* ================= data ================= */
const TRACKS={
  route9:{id:'route9',title:'Slow Light on Route 9',artist:'Halcyon Mile',len:214,style:'dusk',genre:'Road rock',rating:'4.8',pal:['#1b1233','#ff8a5b','#7c5cff','#4a2a6e'],desc:'A slow-burn driving song that sounds like the last hour of sun on a long highway. The guitars were recorded in a parked van, and you can hear the room in every note. Your circles keep sending it around 5pm, usually without a caption.'},
  moons:{id:'moons',title:'Paper Moons',artist:'Odessa Vale',len:187,style:'moon',genre:'Dream pop',rating:'4.7',pal:['#0b1626','#58d6c8','#8f7bff','#1d3b6e'],desc:'Odessa Vale builds the whole song around one detuned piano and a drum machine that sounds like rain on a bus window. It’s the track people send when they can’t say they’re thinking about someone.'},
  choir:{id:'choir',title:'Night Bus Choir',artist:'The Lowtides',len:243,style:'wave',genre:'Indie anthem',rating:'4.6',pal:['#180c1c','#ff6fa5','#ffb86b','#7b3aa8'],desc:'The Lowtides stack forty voices on the final chorus and somehow keep it intimate. The key change at 2:40 has started arguments in at least three group chats this week.'},
  cherry:{id:'cherry',title:'Cherry Static',artist:'Nuvia',len:176,style:'bauhaus',genre:'Synth pop',rating:'4.5',pal:['#14081a','#ff3d6e','#c3a6ff','#ffc857'],desc:'Nuvia’s brightest, strangest single: glossy synths over a bassline that never resolves. It’s built for dramatic commutes and deeply unserious karaoke.'},
  soft:{id:'soft',title:'Soft Machine Summer',artist:'Dov and the Echoes',len:229,style:'bloom',genre:'Balearic folk',rating:'4.4',pal:['#0b1a14','#7de3b5','#ffd166','#1f8f78'],desc:'A warm, slightly sad song about a summer that’s already over. Dov and the Echoes recorded it live in one take, and the crowd noise at the end is real.'},
  glass:{id:'glass',title:'Glasshouse',artist:'Imre Tanaka',len:201,style:'dusk',genre:'Ambient',rating:'4.6',pal:['#0e1220','#8fb4ff','#ff9466','#3a2a6e'],desc:'Imre Tanaka layers glass harmonica and field recordings from a greenhouse. Perfect for the last hour before sleep, or the first hour of a hard morning.'}
};
/* the profile's own look: which shared palette the hero, avatar and Fingerprint
   wash borrow. Keys are the tracks' existing palettes — no new colors. */
const PROF_TINTS=[['route9','Sunset drive'],['moons','Moon water'],['choir','Neon dusk'],['soft','Grove'],['glass','Greenhouse']];
const youPal=()=>{const t=TRACKS[S.prof.tint]||TRACKS.moons;return t.pal};
const rgba=(c,a)=>{const v=toRGB(c);return `rgba(${v[0]},${v[1]},${v[2]},${a})`};
const GENRE_TAGS={'Road rock':'golden hour distortion','Dream pop':'rain on a bus window','Indie anthem':'key-change arguments','Synth pop':'dramatic commute fuel','Balearic folk':'the summer that already ended','Ambient':'last hour before sleep'};
const BURST=n=>{const r=rng(n),pts=[];for(let i=0;i<32;i++){const a=i/32*6.2832,rad=i%2?36:49;pts.push((50+Math.cos(a)*rad).toFixed(1)+','+(50+Math.sin(a)*rad).toFixed(1))}return pts.join(' ')};
const MEMES={
  m1:{id:'m1',text:'me: i don’t get emotional about music\n\nalso me: replaying a 14-second outro until 3am',bg:'#EFE9DA',fg:'#141413',ac:'#F26B4E',tag:'Relatable, 3am, emotional damage'},
  m2:{id:'m2',text:'the group chat at 11:59pm on thursday:\n\n“new album friday”',bg:'#F26B4E',fg:'#141413',ac:'#EFE9DA',tag:'Group chat, release day, sleep optional'},
  m3:{id:'m3',text:'my toxic trait is thinking i can read a room and also a shared playlist',bg:'#F2D45C',fg:'#141413',ac:'#141413',tag:'Toxic traits, shared playlists, DJ delusion'},
  m4:{id:'m4',text:'the bridge of the song starts\n\nme: are you okay?? i’m so proud of you',bg:'#9EC5E8',fg:'#141413',ac:'#F2D45C',tag:'Bridge appreciation, parasocial pride'}
};
/* Like/laugh counts and the "saved by N people in your circles" lines are
   fabricated social proof — nobody produced them. They are demo content: in a
   production build every count starts at zero and the only numbers on screen
   are the ones the user's own taps created. Same flag as PEOPLE, ACTIVITY and
   CIRCLE_SOURCE. */
const N=n=>DEMO_DATA?n:0;
const WHY=t=>DEMO_DATA?t:undefined;
const DROPS=[
  {music:{id:'d1a',kind:'music',ref:'route9',likes:N(312),laughs:N(18),why:WHY('Saved by 41 people in your circles this week.')},meme:{id:'d1b',kind:'meme',ref:'m1',likes:N(128),laughs:N(604)}},
  {music:{id:'d2a',kind:'music',ref:'moons',likes:N(274),laughs:N(11),why:WHY('Most replayed in your circles since Friday.')},meme:{id:'d2b',kind:'meme',ref:'m3',likes:N(96),laughs:N(512)}}
];
const CIRCLE=[
  {id:'c1',kind:'music',ref:'choir',by:'ines',note:'the key change at 2:40 is a personality test',likes:N(57),laughs:N(9)},
  {id:'c2',kind:'meme',ref:'m2',by:'kai',likes:N(44),laughs:N(211)},
  {id:'c3',kind:'music',ref:'cherry',by:'dev',note:'for dramatic commutes only',likes:N(82),laughs:N(14)},
  {id:'c4',kind:'meme',ref:'m4',by:'ines',likes:N(63),laughs:N(158)},
  {id:'c5',kind:'music',ref:'soft',by:'kai',note:'summer, but make it a little sad',likes:N(39),laughs:N(3)}
];
const YEST=[
  {id:'y1',kind:'music',ref:'glass',likes:N(201),laughs:N(7),why:WHY('Yesterday’s most saved, from 38 circles.')},
  {id:'y2',kind:'meme',ref:'m4',likes:N(90),laughs:N(340)},
  {id:'y3',kind:'music',ref:'soft',likes:N(166),laughs:N(5),why:WHY('A slow riser. It crept up the charts overnight.')}
];
const POSTS={};[...DROPS.flatMap(d=>[d.music,d.meme]),...CIRCLE,...YEST].forEach(p=>POSTS[p.id]=p);
/* Comments are gone: like, save and share only. The seeded ones went with them. */
const HUMOR=['Deadpan','Absurdist','Dry wit','Chaotic','Wholesome','Niche refs'];
const DEMO_PEOPLE=[
  {id:'ines',name:'Ines',km:.9,intent:['friends','dating'],matched:true,score:88,pal:['#ff6fa5','#ffb86b','#7b3aa8','#180c1c'],seed:3,shared:['choir','cherry'],humor:[.6,.4,.9,.3,.6,.9],bio:'Keeps a spreadsheet of songs that make her want to leave the party.',age:26},
  {id:'kai',name:'Kai',km:2.2,intent:['friends'],matched:true,score:84,pal:['#58d6c8','#7de3b5','#1d3b6e','#0b1626'],seed:5,shared:['soft','moons'],humor:[.5,.8,.4,.8,.5,.6],bio:'Will defend one questionable album forever.',age:29},
  {id:'dev',name:'Dev',km:3.1,intent:['dating','friends'],matched:true,score:81,pal:['#ffb86b','#ff6fa5','#4a2a6e','#14081a'],seed:8,shared:['cherry','glass'],humor:[.7,.5,.6,.6,.4,.8],bio:'Commute DJ. Has been asked to stop.',age:28},
  {id:'noor',name:'Noor',km:1.8,intent:['dating','friends'],score:94,likesYou:true,pal:['#8f7bff','#ff9466','#1d3b6e','#0b1626'],seed:11,shared:['moons','route9','choir'],humor:[.9,.5,.8,.3,.6,.9],bio:'Makes playlists for weather that hasn’t happened yet.',age:27},
  {id:'saoirse',name:'Saoirse',km:4.6,intent:['dating'],score:89,likesYou:true,pal:['#ff6fa5','#c3a6ff','#3a2a6e','#10131f'],seed:14,shared:['cherry','choir'],humor:[.7,.6,.9,.4,.3,.8],bio:'Will explain the lore of a song she heard once on a bus.',age:25},
  {id:'mateo',name:'Mateo',km:5,intent:['friends','dating'],score:83,pal:['#ffd166','#ff8a5b','#7b3aa8','#1b1233'],seed:17,shared:['route9','glass'],humor:[.5,.7,.5,.9,.7,.5],bio:'Group chat DJ. Responsible for three of your saved songs.',age:31},
  {id:'wren',name:'Wren',km:7.3,intent:['friends'],score:77,pal:['#8fb4ff','#58d6c8','#3a2a6e','#0e1220'],seed:20,shared:['soft','glass'],humor:[.4,.6,.6,.5,.9,.7],bio:'Nostalgic for decades she wasn’t alive for.',age:24},
  {id:'idris',name:'Idris',km:8.9,intent:['dating'],score:72,pal:['#c3a6ff','#ff6fa5','#2a1448','#10131f'],seed:23,shared:['moons'],humor:[.95,.3,.9,.2,.4,.8],bio:'Deadpan in three languages.',age:30},
  {id:'lena',name:'Lena',km:11,intent:['dating','friends'],score:68,pal:['#ff9466','#ffd166','#1f8f78','#0b1a14'],seed:26,shared:['route9'],humor:[.4,.5,.7,.7,.8,.4],bio:'Thinks every road trip needs an official opening track.',age:28}
];
/* The Matrix, the People tab and the listening-room seat map all read this.
   In a production build it is empty, because these nine are personas and not
   people: a dating deck with invented strangers in it is the one thing the
   product must never do. `endHTML()` already states the density gate plainly
   ("a dating deck with three people in it is a lie with a nice layout"), so an
   empty list renders an honest screen rather than a broken one.
   Same flag and same reasoning as ACTIVITY and CIRCLE_SOURCE above. */
const PEOPLE=DEMO_DATA?DEMO_PEOPLE:[];
const LIVE=[{id:'dev',track:'glass',since:'2m',n:6},{id:'ines',track:'choir',since:'8m',n:11},{id:'kai',track:'soft',since:'21m',n:4}];
const STARTERS=['What song did you replay five times this week?','Defend your worst-rated favorite album','Send one meme that explains you','Pick a song for waiting on a late bus'];
const REPLIES=['ha. okay. send the track','this is exactly the kind of taste crime i like','you get it. play it loud','be honest, did you cry at the bridge','i have so many opinions about this','adding it to my night bus playlist'];
const EMO=['🔥','😭','💀','✨','👀'];
const ANTI=['Smooth jazz','EDM','Drill','Country','Metal','Reggaeton','Opera','Muzak','Corporate ambient'];
const ARTIST_SUGG=['Marlowe Fen','Sunday Radio','Pale Aviator','Juno Kask','Velvet Harbor','Orla Finch','The Quiet Parade','Nico Brandt'];
const TASTES={Sound:['90s R&B','Bedroom pop','Film scores','Indie folk','Hyperpop','Shoegaze','Anime openings','Jazz standards','Amapiano','Jungle','Neo-soul'],Humor:['Deadpan','Absurdist','Dry wit','Chaotic','Wholesome','Niche refs'],Everything:['Podcast brain','Letterboxd diary','Thrifted band tees','Late-night radio','Zines','Cult sitcoms']};
const ROOMS=['Night bus lounge','Golden hour room','Late shift listening'];
/* The activity feed used to carry "someone nearby resonated" and counted
   statistics nobody produced. In a production build the list is empty because
   that is the truth; under DEMO_DATA the two remaining rows belong to seeded
   demo people and are labelled by the prototype banner above them. */
const ACTIVITY=DEMO_DATA?[
  {id:'a3',type:'culture',t:'Kai saved Night Bus Choir',ago:'3h'},
  {id:'a4',type:'match',t:'Ines sent you a song',ago:'5h'}
]:[];

/* ================= state ================= */
const DEF=()=>({
  onboarded:false,intent:'both',lens:'dating',tastes:[],dropIdx:0,shift:0,cal:0,city:'Lisbon',wait:false,
  react:{},decided:{},history:[],matchedIds:[],threads:null,dismissed:[],
  prof:{name:'Alex',bio:'Collects songs that sound like 4pm in October.',humor:['Deadpan','Niche refs','Dry wit'],humorOpts:HUMOR.concat(['Cringe lover','Pun enjoyer']),artists:['Odessa Vale','Halcyon Mile','Imre Tanaka','Nuvia','The Lowtides'],
    prompts:[{q:'The song I’ll defend forever',a:'Cherry Static. The bridge is a whole personality.'},{q:'My most niche reference',a:'A 2011 forum thread about a song that never got released.'}],vis:'matches',photos:[],pfp:'',tint:'moons',bg:'rings'},
  set:{radius:25,anti:['Smooth jazz','EDM'],invites:true,quiet:true,qFrom:'23:00',qTo:'07:00',locVis:'area',calm:false,haptics:true,sound:true,activity:'all',remind:false},
  pulse:{duel:false,seen:0},duelLink:null
});
const BASE_THREADS=()=>{const n=Date.now();return{
  ines:{unread:2,msgs:[{f:'them',kind:'track',ref:'choir',ts:n-53*6e4},{f:'them',t:'ok but have you heard the key change in this one',ts:n-52*6e4},{f:'them',t:'i need a second opinion immediately',ts:n-51*6e4}]},
  kai:{unread:0,msgs:[{f:'me',t:'defend your worst-rated favorite album',ts:n-1500*6e4},{f:'them',t:'Soft Machine Summer. no notes. you will not change my mind',ts:n-1490*6e4},{f:'me',t:'bold. i respect it a little',ts:n-1480*6e4}]},
  dev:{unread:1,msgs:[{f:'them',t:'up for a 15 minute listen later?',ts:n-300*6e4}]}
}};
let S=merge(DEF(),store.get('state',{}));
/* Demo people come with demo transcripts. A real account starts with zero
   threads — the People tab then shows its empty state, not invented chats. */
if(!S.threads)S.threads=DEMO_DATA?BASE_THREADS():{};
if(!S.pulse)S.pulse=DEF().pulse;
if(S.duelLink===undefined)S.duelLink=null;
if(S.duel)delete S.duel;
const save=()=>store.set('state',S);
let cur='feed',busy=false,refreshing=false,fpDirty=false,SES=null,ROOM=null,UID=0;
const ACT={},SEG={},FT={};
const DK={day:0,order:[],items:[],busy:false};

/* ================= generative posters ================= */
function hill(r,y,amp,n){
  const p=[];for(let i=0;i<=n;i++)p.push([i*300/n,y+(r()-.5)*2*amp]);
  let d=`M${p[0][0]} ${p[0][1].toFixed(1)}`;
  for(let i=1;i<n;i++){const m=[(p[i][0]+p[i+1][0])/2,(p[i][1]+p[i+1][1])/2];d+=`Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`}
  return d+`L300 ${p[n][1].toFixed(1)}L300 400L0 400Z`;
}
function posterSVG(style,pal,seed,lite){
  const r=rng(seed),u='p'+(++UID),c0=pal[0],c1=pal[1],c2=pal[2],c3=pal[3];let b='';
  if(style==='dusk'){
    const sx=80+r()*140,sy=150+r()*40;
    b=`<defs><linearGradient id="${u}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".6" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient><radialGradient id="${u}b"><stop offset="0" stop-color="${mixc(c1,'#ffffff',.6)}" stop-opacity=".95"/><stop offset=".35" stop-color="${c1}" stop-opacity=".5"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient></defs><rect width="300" height="400" fill="url(#${u}a)"/>`;
    if(!lite)for(let i=0;i<34;i++)b+=`<circle cx="${(r()*300).toFixed(0)}" cy="${(r()*150).toFixed(0)}" r="${(.4+r()*.9).toFixed(1)}" fill="#fff" opacity="${(.2+r()*.6).toFixed(2)}"/>`;
    b+=`<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="150" fill="url(#${u}b)"/><circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="38" fill="${mixc(c1,'#ffffff',.65)}"/>`;
    for(let i=0;i<4;i++)b+=`<path d="${hill(r,236+i*40,14+i*5,8)}" fill="${mixc(mixc(c1,c3,.55),c0,.2+i*.25)}" opacity="${(.62+i*.12).toFixed(2)}"/>`;
  }else if(style==='moon'){
    const mx=150+(r()-.5)*70;
    b=`<defs><linearGradient id="${u}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".65" stop-color="${c3}"/></linearGradient><radialGradient id="${u}b" cx=".4" cy=".35"><stop offset="0" stop-color="${mixc(c2,'#ffffff',.7)}"/><stop offset="1" stop-color="${c1}"/></radialGradient><radialGradient id="${u}c"><stop offset="0" stop-color="${c1}" stop-opacity=".5"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient><linearGradient id="${u}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c3}"/><stop offset="1" stop-color="${c0}"/></linearGradient></defs><rect width="300" height="400" fill="url(#${u}a)"/><circle cx="${mx.toFixed(0)}" cy="130" r="140" fill="url(#${u}c)"/><circle cx="${mx.toFixed(0)}" cy="130" r="54" fill="url(#${u}b)"/>`;
    for(let i=0;i<5;i++)b+=`<circle cx="${(mx-30+r()*60).toFixed(0)}" cy="${(105+r()*50).toFixed(0)}" r="${(3+r()*7).toFixed(1)}" fill="${mixc(c1,c0,.4)}" opacity=".25"/>`;
    b+=`<path d="${hill(r,252,10,10)}" fill="${c0}"/><rect y="262" width="300" height="140" fill="url(#${u}d)"/>`;
    for(let i=0;i<9;i++){const w=108*(1-i/10);b+=`<rect x="${(mx-w/2).toFixed(0)}" y="${270+i*13}" width="${w.toFixed(0)}" height="3" rx="1.5" fill="${c2}" opacity="${(.6-i*.06).toFixed(2)}"/>`}
  }else if(style==='wave'){
    b=`<defs><linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient><radialGradient id="${u}b"><stop offset="0" stop-color="${c1}" stop-opacity=".9"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient></defs><rect width="300" height="400" fill="${c0}"/><circle cx="${(60+r()*180).toFixed(0)}" cy="${(110+r()*60).toFixed(0)}" r="95" fill="url(#${u}b)" opacity=".8"/>`;
    const f1=.012+r()*.01,f2=.03+r()*.02,ph=r()*6;
    for(let i=0;i<24;i++){let d='';const y=64+i*13;for(let x=0;x<=300;x+=6){const yy=y+Math.sin(x*f1+ph+i*.22)*(22+i)+Math.sin(x*f2+i*.4)*7;d+=(x?'L':'M')+x+' '+yy.toFixed(1)}b+=`<path d="${d}" fill="none" stroke="url(#${u}a)" stroke-width="${(.8+i/24*1.3).toFixed(1)}" opacity="${(.25+i/24*.7).toFixed(2)}"/>`}
  }else if(style==='bloom'){
    b=`<defs><filter id="${u}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${lite?10:24}"/></filter></defs><rect width="300" height="400" fill="${c0}"/><g filter="url(#${u}f)">`;
    [c1,c2,c3,c1,c2].forEach(c=>{b+=`<circle cx="${(40+r()*220).toFixed(0)}" cy="${(60+r()*280).toFixed(0)}" r="${(60+r()*50).toFixed(0)}" fill="${c}" opacity=".85"/>`});
    b+=`</g>`+[70,100,130].map((rad,i)=>`<circle cx="150" cy="200" r="${rad}" fill="none" stroke="#fff" stroke-width=".8" opacity="${.2-i*.05}"/>`).join('');
  }else{
    b=`<rect width="300" height="400" fill="${c0}"/><path d="M30 230A120 120 0 0 1 270 230Z" fill="${c1}"/><path d="M0 400V250A150 150 0 0 1 150 400Z" fill="${c2}"/>`;
    for(let i=0;i<5;i++)b+=`<rect x="165" y="${255+i*16}" width="135" height="8" fill="${c3}"/>`;
    b+=`<circle cx="${(210+r()*40).toFixed(0)}" cy="110" r="18" fill="#fff" opacity=".9"/><path d="M0 230H300" stroke="#fff" opacity=".25"/>`;
  }
  return `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${b}</svg>`;
}
const poster=(t,lite)=>`<div class="art">${posterSVG(t.style,t.pal,hash(t.id||t.title||'x'),lite)}</div>`;
const cover=poster;
const STY=['dusk','moon','wave','bloom','bauhaus'];
const coverFrom=str=>poster({id:str,style:STY[hash(str)%5],pal:palFrom(str)},true);
function memeArt(m){
  return `<div class="art"><div class="memeart" style="background:${m.bg};color:${m.fg}"><svg class="sticker" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${BURST(hash(m.id))}" fill="${m.ac}"/></svg><p class="mtxt">${esc(m.text)}</p><span class="mtag">cultured meme</span></div></div>`;
}
const artOf=p=>p.kind==='music'?poster(TRACKS[p.ref]):memeArt(MEMES[p.ref]);
function grainInit(){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.4 0 0 0 -.25"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>';
  document.documentElement.style.setProperty('--grain','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');
}
function orb(p,size){const c=p.pal;return `<span class="orb" style="--s:${size||44}px;background:conic-gradient(from 210deg,${c[0]},${c[1]},${c[2]||c[0]},${c[0]})">${esc(p.name[0])}</span>`}
function avatar(name,size){const p=PEOPLE.find(x=>x.name===name);return orb(p||{name:name,pal:palFrom(name).slice(1)},size)}
const person=id=>PEOPLE.find(x=>x.id===id);
/* the Cultural Fingerprint: concentric rings shaped by taste */
const LOB=[3,5,8];
const fpParams=seed=>{const r=rng(seed);return{a:[.4+r()*.6,.3+r()*.7,.2+r()*.8],p:[r()*6.283,r()*6.283,r()*6.283],d:r()}};
const fpBlend=(A,B,s)=>{const m=(x,y)=>y+(x-y)*s;return{a:A.a.map((v,i)=>m(v,B.a[i])),p:A.p.map((v,i)=>m(v,B.p[i])),d:m(A.d,B.d)}};
function fpSVG(P,c1,c2,o){
  o=o||{};const n=o.n||15,w=o.w||1.5;let out='';
  for(let i=0;i<n;i++){
    const f=i/(n-1),base=12+f*70,amp=.8+f*6.4,cx=100+(P.d-.5)*f*14,cy=100+(P.a[2]-.5)*f*12;let d='';
    for(let k=0;k<=110;k++){
      const t=k/110*Math.PI*2;
      const rr=base+amp*(P.a[0]*Math.sin(LOB[0]*t+P.p[0]+f*1.9*P.d)+.7*P.a[1]*Math.sin(LOB[1]*t+P.p[1]-f*2.4)+.45*P.a[2]*Math.sin(LOB[2]*t+P.p[2]+f*3.3));
      d+=(k?'L':'M')+(cx+rr*Math.cos(t)).toFixed(1)+' '+(cy+rr*Math.sin(t)).toFixed(1);
    }
    out+=`<path class="fp-ring" pathLength="1" d="${d}Z" stroke="${mixc(c1,c2,f)}" stroke-width="${w}" opacity="${(.95-f*.42).toFixed(2)}" style="--i:${i}"/>`;
  }
  return `<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round" aria-hidden="true">${out}</svg>`;
}
const mineSeed=()=>hash(S.prof.humor.join()+'|'+S.prof.artists.join()+'|'+S.tastes.join());
const mineHum=()=>HUMOR.map(h=>S.prof.humor.indexOf(h)>-1?.85:.3);
function pairFP(p,anim){
  const me=fpParams(mineSeed()),s=Math.max(.2,(p.score-20)/90),th=fpBlend(me,fpParams(p.seed*7919+13),s);
  return `<div class="pair ${anim===false?'':'draw'}">${fpSVG(me,'#EFE9DA','#ff8a5b')}${fpSVG(th,'#9ee8d2','#ff9466')}</div>`;
}
const sharedTitles=p=>p.shared.slice(0,2).map(id=>TRACKS[id].title).join(' and ');
const personArt=p=>`<div class="art" style="background:radial-gradient(90% 70% at 20% 0,${p.pal[0]}aa,transparent 62%),radial-gradient(80% 80% at 100% 90%,${p.pal[1]}77,transparent 62%),linear-gradient(${p.pal[3]},#0a0a09)"><div class="pfp">${pairFP(p)}</div></div>`;

/* ================= ui primitives ================= */
const haptic=p=>{if(S.set.haptics&&navigator.vibrate){try{navigator.vibrate(p)}catch(e){}}};
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2300)}
function burst(btn,color){
  if(S.set.calm)return;const ri=$('.ri',btn)||btn;const x=ri.offsetLeft+ri.offsetWidth/2,y=ri.offsetTop+ri.offsetHeight/2;
  for(let i=0;i<9;i++){
    const d=document.createElement('i');d.className='bp';d.style.cssText=`left:${x-3}px;top:${y-3}px;background:${color}`;btn.appendChild(d);
    const a=i/9*6.283,dist=30+Math.random()*12;
    d.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(a)*dist}px,${Math.sin(a)*dist}px) scale(0)`,opacity:0}],{duration:680,easing:'cubic-bezier(.2,.8,.2,1)'}).onfinish=()=>d.remove();
  }
}
function setTint(host,art){
  let box=$(':scope>.tint',host);if(!box){box=document.createElement('div');box.className='tint';host.prepend(box)}
  const l=document.createElement('div');l.className='tl';l.innerHTML=art;box.appendChild(l);
  requestAnimationFrame(()=>requestAnimationFrame(()=>l.classList.add('on')));
  const olds=$$(':scope>.tl',box).filter(x=>x!==l);setTimeout(()=>olds.forEach(o=>o.remove()),1000);
}
function openSheet(html,mount){
  const w=$('#sheetwrap');
  w.innerHTML=`<div class="scrim" data-act="closesheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  const sh=$('.sheet',w);
  requestAnimationFrame(()=>requestAnimationFrame(()=>w.classList.add('open')));
  let y0=0,dy=0,on=false;const g=$('.grab',sh);
  g.addEventListener('pointerdown',e=>{on=true;y0=e.clientY;dy=0;sh.style.transition='none';try{g.setPointerCapture(e.pointerId)}catch(_){}});
  g.addEventListener('pointermove',e=>{if(!on)return;dy=Math.max(0,e.clientY-y0);sh.style.transform=`translateY(${dy}px)`});
  const end=()=>{if(!on)return;on=false;sh.style.transition='';sh.style.transform='';if(dy>90)closeSheet()};
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  if(mount)mount(sh);
  return sh;
}
function closeSheet(){const w=$('#sheetwrap');w.classList.remove('open');setTimeout(()=>{if(!w.classList.contains('open'))w.innerHTML=''},560)}
function openPage(html,o){
  o=o||{};const pg=document.createElement('div');pg.className='page'+(o.fade?' fade':'');
  pg.innerHTML=html;$('#pages').appendChild(pg);
  pg.getBoundingClientRect();requestAnimationFrame(()=>pg.classList.add('in'));
  $('#nav').classList.add('hide');
  return pg;
}
function closePage(){
  const pgs=$$('#pages .page:not([data-closing])'),pg=pgs[pgs.length-1];if(!pg)return;
  pg.dataset.closing='1';if(pg.onclose)pg.onclose();pg.classList.remove('in');
  if($$('#pages .page:not([data-closing])').length===0)$('#nav').classList.remove('hide');
  setTimeout(()=>pg.remove(),600);
}
const segHTML=(k,opts,cur)=>`<div class="seg" data-k="${k}" style="--n:${opts.length};--i:${Math.max(0,opts.findIndex(o=>o[0]===cur))}" role="group"><i class="thumb"></i>${opts.map(o=>`<button data-act="seg" data-v="${o[0]}" class="${o[0]===cur?'on':''}" aria-pressed="${o[0]===cur}">${o[1]}</button>`).join('')}</div>`;
function setSeg(seg,v){const bs=$$('button',seg);bs.forEach((b,i)=>{const on=b.dataset.v===v;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);if(on)seg.style.setProperty('--i',i)})}
ACT.seg=b=>{const seg=b.closest('.seg');setSeg(seg,b.dataset.v);haptic(6);if(SEG[seg.dataset.k])SEG[seg.dataset.k](b.dataset.v)};
const swHTML=(act,k,on,label)=>`<button class="sw" role="switch" aria-checked="${!!on}" aria-label="${label}" data-act="${act}" data-fx="toggle" data-k="${k}"></button>`;
/* folder tabs */
const ftabsHTML=(k,items,act)=>`<div class="ftabs" data-k="${k}"><i class="fblob"></i>${items.map(i=>`<button class="ft ${i[0]===act?'on':''}" data-act="ftab" data-v="${i[0]}">${i[1]}</button>`).join('')}</div>`;
function layoutTabs(root){
  $$('.ftabs',root||document).forEach(el=>{
    const on=$('.ft.on',el),bl=$('.fblob',el);if(!on||!on.offsetWidth)return;
    bl.style.left=on.offsetLeft+'px';bl.style.width=on.offsetWidth+'px';
    if(!bl.classList.contains('ready'))requestAnimationFrame(()=>requestAnimationFrame(()=>bl.classList.add('ready')));
  });
}
ACT.ftab=b=>{const el=b.closest('.ftabs');$$('.ft',el).forEach(x=>x.classList.toggle('on',x===b));layoutTabs(el.parentNode);haptic(5);if(FT[el.dataset.k])FT[el.dataset.k](b.dataset.v)};

/* ================= nav ================= */
const NAVI=[['feed','Home',I.home],['arena','Arena',I.star],['match','Matrix',I.pair],['people','People',I.chat],['you','You',I.you]];
const TABS=NAVI.map(n=>n[0]);
function buildNav(){$('#nav').innerHTML=NAVI.map(n=>`<button class="nv ${n[0]===cur?'on':''}" data-act="tab" data-fx="tab" data-t="${n[0]}" aria-label="${n[1]}">${n[2]}<span class="l">${n[1]}</span></button>`).join('')}
function go(t){
  if(t!==cur)stopPlay();
  if(t!=='arena')stopPulseFX();
  cur=t;
  TABS.forEach(x=>$('#s-'+x).classList.toggle('on',x===t));
  $$('.nv').forEach(b=>{const on=b.dataset.t===t;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false')});
  if(t==='arena')renderArena();
  if(t==='people')renderPeople();
  if(t==='you')renderYou();
  if(t==='match'&&fpDirty){renderDeck();fpDirty=false}
  const el=$('#s-'+t);el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');setTimeout(()=>el.classList.remove('enter'),1800);
  layoutTabs(el);mediaKick();
}
ACT.tab=b=>{haptic(5);go(b.dataset.t)};
function updateBadge(){
  const n=Object.values(S.threads).reduce((a,t)=>a+(t.unread||0),0);
  const tab=$('.nv[data-t=people]');if(!tab)return;let b=$('.badge',tab);
  if(n){if(!b){b=document.createElement('span');b.className='badge';tab.appendChild(b)}b.textContent=n}else if(b)b.remove();
}

/* ================= home (drops) ================= */
const refOf=p=>p.kind==='music'?TRACKS[p.ref]:MEMES[p.ref];
const labelOf=p=>p.kind==='music'?TRACKS[p.ref].title:MEMES[p.ref].text.split('\n')[0];
const rs=id=>S.react[id]||(S.react[id]={l:0,h:0,s:0});
const curDrop=()=>DROPS[S.dropIdx%DROPS.length];
/* Seeded circle posts are demonstration content, not real people's posts. */
const CIRCLE_SOURCE=DEMO_DATA?CIRCLE:[];
function circleList(){const n=CIRCLE_SOURCE.length;if(!n)return[];const k=S.shift%n;return CIRCLE_SOURCE.slice(k).concat(CIRCLE_SOURCE.slice(0,k))}
function dateParts(off){const d=new Date();d.setDate(d.getDate()+off);return{d:String(d.getDate()).padStart(2,'0'),m:d.toLocaleDateString('en-US',{month:'short'}).toUpperCase()}}
function bigDateHTML(off){const x=dateParts(off),s=x.d+' '+x.m;return `<div class="bigdate" aria-label="${x.d} ${x.m}">${[...s].map((c,i)=>c===' '?'<span class="sp2"></span>':`<span class="ch"><i style="--d:${i}">${c}</i></span>`).join('')}</div>`}
/* With circles empty (production), the last two cards come from yesterday so
   the drop is still a deck of four rather than a deck of two. */
function deckItems(){if(DK.day===-1)return YEST;const extra=circleList().slice(0,2);return [curDrop().music,curDrop().meme].concat(extra.length?extra:YEST.slice(0,2))}
const FXFOR={like:'like',save:'save',share:'share',laugh:'react'};
const rb=(act,cls,icon,n,on,label)=>`<button class="rb ${cls} ${on?'on':''}" data-act="${act}"${FXFOR[act]?` data-fx="${FXFOR[act]}"`:''} aria-label="${label}" aria-pressed="${!!on}"><span class="ri">${icon}</span>${n!==undefined?`<span class="n">${n}</span>`:''}</button>`;
function reactions(p,col){
  const st=rs(p.id);
  const a=[rb('like','like',I.heart,p.likes+st.l,st.l,'Like')];
  const b=[rb('save','save',I.bookmark,undefined,st.s,'Save'),rb('share','icon',I.share,undefined,0,'Share')];
  return col?a.concat(b).join(''):a.join('')+'<span class="sp"></span>'+b.join('');
}
function dcardHTML(p){
  const r=refOf(p),isM=p.kind==='music',by=p.by&&person(p.by);
  const id=p.id;
  return `<div class="dcard" data-id="${id}">
    ${artOf(p)}${isM?'<div class="shade"></div>':''}
    <div class="dc-top"><span class="chipg">${isM?'Song':'Meme'}</span><span class="chipg">${isM?esc(r.genre):(by?'From '+esc(by.name):'Today’s meme')}</span><div class="eqb" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>
    ${isM?`<div class="dc-bot"><h3>${esc(r.title)}</h3><p>${esc(r.artist)}</p><button class="playp" data-act="play" data-fx="play" aria-label="Play 30-second preview"><span class="i-play">${I.play}</span><span class="i-pause">${I.pause}</span><span>Play preview</span></button></div>`:''}
    <div class="acol">${reactions(p,true)}</div>
    <div class="prog"><i></i></div>
    ${isM?'':`<div class="mm-foot"><button class="mm-l" data-act="mm-open" data-id="${id}" aria-label="Open this meme">${I.chevr}</button></div>`}
  </div>`;
}
function ccardHTML(p,i){
  const r=refOf(p),isM=p.kind==='music',by=person(p.by);
  return `<article class="cc stg" style="--d:${i}" data-id="${p.id}">
    <div class="cc-art" data-act="open-d" data-id="${p.id}" role="button" tabindex="0" aria-label="Open ${esc(labelOf(p))}">${artOf(p)}${isM?'<div class="shade"></div>':''}
      <div class="cc-by glass">${orb(by,30)}<span><b>${esc(by.name)}</b> ${isM?'dropped this':'sent this'}</span></div>
      ${isM?`<div class="cc-bot"><h3>${esc(r.title)}</h3><p>${esc(p.note||r.artist)}</p></div>`:''}</div>
    <div class="arow">${reactions(p,false)}</div></article>`;
}
function tomorrowHTML(){
  /* The locked day is a scene, not an empty stub: the night-drive slot sits
     behind a scrim with a slow ken-burns push, the tease cards float on top,
     and the countdown reads left-aligned like the rest of the drop. If the
     manifest leaves the slot empty the procedural gradient still carries it. */
  return `<div class="drow stg">${bigDateHTML(1)}<span class="cnt">Locked</span></div>
  <div class="tm stg" style="--d:1"><div class="tm-bg" aria-hidden="true"><div class="tm-bg-art">${posterSVG('dusk',palFrom('late-night drive'),1307)}</div>${ASSETS.tomorrowBg?`<i class="tm-bg-photo" style="--media-url:url(${ASSETS.tomorrowBg})"></i>`:''}</div><div class="tm-art"><div class="tm-inner">
    <span class="tm-kicker">Tomorrow’s drop</span>
    <div class="tm-cards" aria-hidden="true"><div class="tmc" style="--r:-8deg;--x:-34px;--dl:-1s">?</div><div class="tmc" style="--r:7deg;--x:34px;--dl:-2.5s">?</div><div class="tmc" style="--r:0deg;--x:0px;--dl:-4s">?</div></div>
    <h2>Drops at 9:00 AM</h2><p class="hint">Tomorrow’s song and meme unlock together. Tonight’s hint: <b>late-night drive</b>.</p>
    <div class="cd" id="cd">00:00:00</div>
    <div class="group"><div class="row"><div class="tx" style="text-align:left"><b>Remind me</b><span>A quiet nudge when it lands.</span></div>${swHTML('tog','remind',S.set.remind,'Remind me')}</div></div>
  </div></div></div>`;
}
function homeBodyHTML(){
  if(DK.day===1){DK.items=[];DK.order=[];return tomorrowHTML()}
  const raw=deckItems();DK.items=raw.slice(0,6);DK.order=DK.items.map(p=>p.id);
  return `<div class="drow stg"><div><span class="eyebrow">Daily drop · ${DK.day===0?'curated for you':'from your circles'}</span>${bigDateHTML(DK.day)}</div><button class="cnt" id="cnt" data-act="nextcard" aria-label="Next drop">1/${DK.items.length}</button></div>
    <div class="deck stg" style="--d:1" id="hdeck">${DK.items.map(dcardHTML).join('')}</div>`+(DK.day===0?mmHTML():'');
}
function renderFeed(){
  if(V5_HOME)return;
  $('#s-feed').innerHTML=`<div class="tint feed-tint">${mediaLayer('feedAmbience','feed-media')}${mediaLayer('feedVideo','feed-video')}</div>
    <header class="topbar"><div class="wordmark">${RING_GLYPH}cultured</div><div class="hr"><button class="ibtn" data-act="refresh" data-fx="spin" aria-label="Refresh today’s drop">${I.refresh}</button></div></header>
    <div class="ptr" id="ptr" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="2.4"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="26 15"/><circle cx="12" cy="12" r="10" stroke-dasharray="40 23" opacity=".6"/></svg></div>
    <div id="feedBody">
      ${ftabsHTML('day',[['-1','Yesterday'],['0','Today'],['1','Tomorrow']],String(DK.day))}
      <div class="sbody" id="hbody">${homeBodyHTML()}</div>
      <section class="circles" id="circles" style="${DK.day===0?'':'display:none'}"><h2 class="sec stg">From your circles</h2>${circleList().slice(2).map((p,i)=>ccardHTML(p,i)).join('')||'<div class="blk tight stg"><div class="empty-stk"><span aria-hidden="true">🎧</span><p class="hint">Circles fill up when you and a match are both online. Nothing is seeded here on your behalf.</p></div></div>'}</section>
    </div>`;
  layoutTabs($('#s-feed'));afterHome();
}
function afterHome(){
  fitMeme($('#s-feed'));
  const d=$('#hdeck');
  if(d){
    $$('.dcard',d).forEach(c=>{
      bindDrag(c,{can:()=>c.classList.contains('top')&&!DK.busy,fly:dir=>deckFly(dir),tap:()=>openDetail(c.dataset.id,c),dbl:()=>{const id=c.dataset.id;if(!rs(id).l){rs(id).l=1;save();syncPost(id)}bigHeart(c);haptic([10,30,10])}});
    });
    layoutDeck();
  }else setTint($('#s-feed'),poster(DK.day===1?TRACKS.route9:TRACKS.moons,true));
  if(cur==='feed')startCountdown();
}
function layoutDeck(){
  const d=$('#hdeck');if(!d)return;
  DK.order.forEach((id,i)=>{const c=$(`.dcard[data-id="${id}"]`,d);if(c){c.style.setProperty('--k',i);c.style.zIndex=20-i;c.classList.toggle('top',i===0);c.classList.toggle('far',i>2)}});
  const n=DK.items.findIndex(p=>p.id===DK.order[0])+1;const cn=$('#cnt');if(cn)cn.textContent=n+'/'+DK.items.length;
  const top=POSTS[DK.order[0]];if(top)setTint($('#s-feed'),artOf(top));
  /* the top card gets a one-shot light-leak sweep as it surfaces (not a loop:
     it fires on the change, then it is done) */
  const tc=$('.dcard.top',d);
  if(tc){tc.classList.remove('leak');void tc.offsetWidth;tc.classList.add('leak');fitMeme(tc)}
}
/* auto-fit kinetic typography: shrink-to-measure, capped iterations, never
   below the readable floor — text memes stop overflowing without a scroll. */
function fitMeme(host){
  if(!host)return;
  $$('.mm-card p, .memeart .mtxt, .dcard .mtxt',host).forEach(pEl=>{
    pEl.style.fontSize='';
    let k=0;
    while(pEl.scrollHeight>pEl.clientHeight+2&&k<6){
      const fs=parseFloat(getComputedStyle(pEl).fontSize)||20;
      if(fs<12)break;
      pEl.style.fontSize=(fs-2)+'px';
      k++;
    }
  });
}
function deckFly(dir){
  if(DK.busy)return;DK.busy=true;stopPlay();haptic(8);
  const id=DK.order[0],card=$(`#hdeck .dcard[data-id="${id}"]`);
  card.style.transition='transform .55s var(--ease),opacity .45s';card.style.transform=`translate3d(${dir*140}%,0,0) rotate(${dir*22}deg)`;card.style.opacity='0';
  setTimeout(()=>{DK.order.push(DK.order.shift());card.style.transition='none';card.style.transform='';card.style.opacity='';layoutDeck();void card.offsetWidth;card.style.transition='';DK.busy=false},420);
}
ACT.nextcard=()=>deckFly(-1);
function bigHeart(host){const h=document.createElement('div');h.className='bigheart';h.innerHTML=I.heart;host.appendChild(h);setTimeout(()=>h.remove(),1000)}
/* swipe + tap + double tap, shared by every deck */
function bindDrag(card,o){
  let x0=0,y0=0,dx=0,t0=0,drag=false,moved=false,last=0;
  card.addEventListener('pointerdown',e=>{if(!o.can()||e.target.closest('button'))return;drag=true;moved=false;x0=e.clientX;y0=e.clientY;dx=0;t0=Date.now();card.style.transition='none';try{card.setPointerCapture(e.pointerId)}catch(_){}});
  card.addEventListener('pointermove',e=>{if(!drag)return;dx=e.clientX-x0;const dy=e.clientY-y0;if(Math.abs(dx)>6||Math.abs(dy)>6)moved=true;card.style.transform=`translate3d(${dx}px,${dy*.15}px,0) rotate(${dx/18}deg) rotateY(${dx/40}deg)`;if(o.drag)o.drag(dx)});
  const end=()=>{
    if(!drag)return;drag=false;card.style.transition='';
    if(Math.abs(dx)>110){o.fly(dx>0?1:-1)}
    else{
      card.style.transform='';if(o.drag)o.drag(0);
      if(!moved&&Date.now()-t0<350){const n=Date.now();if(n-last<320){last=0;if(o.dbl)o.dbl()}else{last=n;setTimeout(()=>{if(last===n){last=0;if(o.tap)o.tap()}},320)}}
    }
  };
  card.addEventListener('pointerup',end);card.addEventListener('pointercancel',end);
}
FT.day=v=>{
  DK.day=+v;stopPlay();const hb=$('#hbody');hb.innerHTML=homeBodyHTML();
  $('#circles').style.display=DK.day===0?'':'none';haptic(6);afterHome();
};
ACT.refresh=()=>{$('#s-feed').scrollTo({top:0,behavior:'smooth'});refresh()};
function skel(n){return `<div class="sk-deck">${Array.from({length:n},(_,i)=>`<div class="sk sk-card" style="--d:${i}"></div>`).join('')}</div>`}
function refresh(){
  if(refreshing)return;refreshing=true;stopPlay();haptic(8);
  const p=$('#ptr');if(p){p.style.opacity=1;p.classList.add('spin')}
  const hb=$('#hbody');if(hb)hb.innerHTML=skel(3);
  setTimeout(()=>{S.dropIdx++;S.shift+=2;save();DK.day=0;renderFeed();refreshing=false;$('#feedBody').classList.add('fresh');toast('A fresh drop just landed')},950);
}
function initPTR(){
  const sc=$('#s-feed');let sy=0,pull=0,on=false;
  const reset=()=>{const b=$('#feedBody');if(b){b.style.transition='transform .5s var(--ease)';b.style.transform=''}const p=$('#ptr');if(p){p.style.opacity=0;p.style.transform=''}pull=0};
  sc.addEventListener('touchstart',e=>{if(sc.scrollTop<=0&&!refreshing&&!e.target.closest('.dcard')){sy=e.touches[0].clientY;on=true;pull=0}},{passive:true});
  sc.addEventListener('touchmove',e=>{
    if(!on)return;const dy=e.touches[0].clientY-sy;
    if(dy>0&&sc.scrollTop<=0){pull=Math.min(dy*.5,90);const b=$('#feedBody'),p=$('#ptr');b.style.transition='none';b.style.transform=`translateY(${pull}px)`;p.style.opacity=Math.min(1,pull/60);p.style.transform=`translateY(${pull*.45}px) rotate(${pull*4}deg)`;if(e.cancelable)e.preventDefault()}
    else if(dy<=0){reset()}
  },{passive:false});
  const end=()=>{if(!on)return;on=false;const fire=pull>=62;reset();if(fire)refresh()};
  sc.addEventListener('touchend',end);sc.addEventListener('touchcancel',end);
  sc.addEventListener('scroll',()=>{const t=$('#s-feed>.tint');if(t)t.style.transform=`translateY(${-sc.scrollTop*.4}px)`},{passive:true});
}
let cdIv;function startCountdown(){
  clearInterval(cdIv);
  const tick=()=>{const el=$('#cd');if(!el){clearInterval(cdIv);return}const n=new Date(),t=new Date();t.setDate(t.getDate()+(n.getHours()>=9?1:0));t.setHours(9,0,0,0);const s=Math.max(0,Math.floor((t-n)/1000));el.textContent=[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,'0')).join(':')};
  tick();cdIv=setInterval(tick,1000);
}
function syncPost(id){
  const p=POSTS[id],st=rs(id);
  $$(`[data-id="${id}"]`).forEach(el=>{
    const l=$('.like',el),h=$('.laugh',el),s=$('.save',el);if(!l)return;
    const nEl=$('.n',l),want=p.likes+st.l;
    l.classList.toggle('on',!!st.l);l.setAttribute('aria-pressed',!!st.l);
    /* the count rolling is decoration; the number itself is the function */
    if(nEl&&nEl.textContent!=String(want))microPublic.countTo(nEl,want);
    s.classList.toggle('on',!!st.s);s.setAttribute('aria-pressed',!!st.s);
    if(h&&p.laughs!==undefined){const hn=$('.n',h);if(hn)hn.textContent=p.laughs+st.h}
  });
}
const idOf=b=>b.closest('[data-id]').dataset.id;
/* Like/save/share also count toward calibration; the Matrix shows its score
   only once there is enough of it to be worth showing. */
const bumpCal=active=>{if(active){S.cal=(S.cal||0)+1;save()}};
/* v5 store writes. The seam's own shapes are mirrored on write so its markup
   keeps working, but the store is what the You tab, the Vault and the pin
   board read. `kindOf(id)` maps the 10 hard-coded POSTS ids to meme|song. */
const kindOf=id=>(POSTS[id]&&POSTS[id].kind==='music')?'song':'meme';
ACT.like=b=>{
  const id=idOf(b),st=rs(id),on=!st.l;st.l=on?1:0;
  if(on)V5.react({kind:kindOf(id),itemId:id,emoji:V5_LIKE,surface:'deck'});else V5.removeReaction(kindOf(id),id);
  save();syncPost(id);renderYou();repoCall('recordReaction',id,'like');bumpCal(on);
};
ACT.laugh=b=>{
  const id=idOf(b),st=rs(id),on=!st.h;st.h=on?1:0;
  if(on)V5.react({kind:kindOf(id),itemId:id,emoji:V5_LAUGH,surface:'deck'});else V5.removeReaction(kindOf(id),id);
  save();syncPost(id);renderYou();repoCall('recordReaction',id,'laugh');bumpCal(on);
};
ACT.save=b=>{
  const id=idOf(b),st=rs(id),on=!st.s;st.s=on?1:0;
  V5.setSaved(kindOf(id),id,on);
  save();syncPost(id);renderYou();repoCall('recordReaction',id,'save');bumpCal(on);
  toast(on?'Kept.':'Let go.');
};
/* The long-press fan emits `micro:laugh` on the heart; the seam decides what
   that means, so the function exists with or without the animation. */
document.addEventListener('micro:laugh',e=>{
  const btn=e.target;if(!btn||!btn.closest)return;
  const host=btn.closest('[data-id]');if(!host)return;
  const id=host.dataset.id,st=rs(id);
  if(!st.h){st.h=1;V5.react({kind:kindOf(id),itemId:id,emoji:V5_LAUGH,surface:'deck'});save();syncPost(id);renderYou();repoCall('recordReaction',id,'laugh');bumpCal(true)}
  burst(btn,'#ffd166');haptic([8,30,8]);
});
ACT.share=b=>openShare(idOf(b));
ACT['open-d']=b=>{openDetail(b.dataset.id,b);trackView(b.dataset.id)};
/* previews */
let PL={id:null,t:0,iv:null};
function stopPlay(){
  clearInterval(PL.iv);
  if(PL.id){$$(`[data-id="${PL.id}"]`).forEach(p=>{p.classList.remove('playing');const bar=$('.prog i',p);if(bar)bar.style.width='0';$$('.playp,.glassb',p).forEach(pb=>pb.style.setProperty('--p','0%'))})}
  PL.id=null;const mp=$('#mini-player');if(mp){mp.classList.remove('on');mp.innerHTML=''}
}
function renderMiniPlayer(id){
  const mp=$('#mini-player'),r=id&&TRACKS[id];if(!mp||!r)return;
  mp.innerHTML=`<div class="mini-art">${poster(r,true)}</div><div class="mini-copy"><b>${esc(r.title)}</b><span>${esc(r.artist)}</span><i><em></em></i></div><button class="mini-toggle" data-act="mini-stop" aria-label="Stop preview">${I.x}</button>`;
  mp.classList.add('on');
}
ACT.play=b=>{
  const host=b.closest('[data-id]'),id=host.dataset.id;
  if(PL.id===id){stopPlay();return}
  stopPlay();PL.id=id;PL.t=0;$$(`[data-id="${id}"]`).forEach(p=>p.classList.add('playing'));haptic(8);
  const p=POSTS[id],r=p&&refOf(p);if(p&&p.kind==='music')renderMiniPlayer(r.id);
  PL.iv=setInterval(()=>{PL.t+=.25;const pctv=(PL.t/30*100).toFixed(1)+'%';$$(`[data-id="${id}"] .prog i`).forEach(bar=>bar.style.width=pctv);$$(`[data-id="${id}"] .playp,[data-id="${id}"] .glassb`).forEach(pb=>pb.style.setProperty('--p',pctv));if(PL.t>=30)stopPlay()},250);
};
ACT['mini-stop']=()=>stopPlay();

/* ================= detail page (shared element) ================= */
const relRect=el=>{const a=el.getBoundingClientRect(),b=$('#phone').getBoundingClientRect();return{x:a.left-b.left,y:a.top-b.top,w:a.width,h:a.height}};
const CREW_ROLES=['Saved it','Laughed hardest','Replayed it 5 times','Sent it first'];
function crewFor(p){return PEOPLE.slice().sort((a,b)=>hash(p.id+a.id)-hash(p.id+b.id)).slice(0,4)}
function detailHTML(p){
  const r=refOf(p),isM=p.kind==='music',cs=[],crew=crewFor(p);
  const chips=isM?`<span class="chipg">${esc(r.genre)}</span><span class="chipg">${esc(GENRE_TAGS[r.genre]||'on heavy rotation')}</span><span class="chipg">${fmt(r.len)}</span><span class="chipg">${I.star}${r.rating}</span>`:`<span class="chipg">Meme</span>${p.likes+p.laughs?`<span class="chipg">${p.likes+p.laughs} reactions</span>`:'<span class="chipg">No reactions yet</span>'}`;
  return `<div class="d-scroll" data-id="${p.id}">
    <div class="d-top stg"><button class="pillb" data-act="back" aria-label="Back">${I.back}<span>Back</span></button><div class="d-chips">${chips}</div></div>
    <div class="d-hero" id="dHero">${artOf(p)}${isM?'<div class="shade" style="height:40%"></div><div class="eqb" aria-hidden="true"><i></i><i></i><i></i><i></i></div>':''}${isM?`<button class="glassb" data-act="play" data-fx="play" aria-label="Play 30-second preview"><span class="i-play">${I.play}</span><span class="i-pause">${I.pause}</span><span>Play preview</span></button>`:''}<div class="prog"><i></i></div></div>
    <h1 class="d-title stg" style="--d:2">${esc(isM?r.title:labelOf(p))}</h1>
    <p class="d-by stg" style="--d:3">${isM?esc(r.artist):'A cultured meme'}</p>
    <div class="arow stg" style="--d:4">${reactions(p,false)}</div>
    <p class="d-desc stg" id="dDesc" style="--d:5">${esc(isM?(p.why?p.why+' ':'')+r.desc:((p.likes+p.laughs)?'Sent '+(p.likes+p.laughs)+' times in your circles this week. Tagged: '+r.tag+'. The kind of post that gets forwarded with no caption at all, because none is needed.':'Tagged: '+r.tag+'. The kind of post that gets forwarded with no caption at all, because none is needed.'))}</p>
    <button class="readm stg" style="--d:5" data-act="readmore">Read more</button>
    ${DEMO_DATA?`<h3 class="d-h stg" style="--d:6">Crew<small>${crew.length} in your circles</small></h3>
    <div class="hs stg" style="--d:6">${crew.map((c,i)=>`<div class="crew-c"><div class="pt" style="background:linear-gradient(160deg,${c.pal[0]},${c.pal[3]})"><div class="fpmini">${fpSVG(fpParams(c.seed*31+hash(p.id)),'#ffffff',c.pal[1],{n:10,w:1.2})}</div><b>${esc(c.name[0])}</b></div><p>${esc(c.name)}</p><span>${CREW_ROLES[i]}</span></div>`).join('')}</div>`:`<h3 class="d-h stg" style="--d:6">Who’s moved this<small>0</small></h3><p class="hint stg" style="--d:6">Nobody yet — and cultured will not invent anybody to fill the row.</p>`}
    <h3 class="d-h stg" style="--d:7">Comments<small>${cs.length}</small></h3>
    <div class="cm-list stg" style="--d:7">${cs.slice(0,2).map(c=>`<div class="cm">${avatar(c.by,32)}<div><b>${esc(c.by)}</b><p>${esc(c.t)}</p></div></div>`).join('')||'<p class="hint">Nobody’s said anything yet.</p>'}</div>
  </div>
  <div class="cta-dock">${isM&&FEATURE_ROOMS?`<button class="split" data-act="to-room" data-id="${r.id}"><b>${ROOM_OFFER_LABEL}</b><span>15 min</span></button>`:`<button class="split" data-act="share" data-id="${p.id}"><b>Send to a friend</b><span>Share</span></button>`}</div>`;
}
function openDetail(id,fromEl){
  const p=POSTS[id];if(!p)return;stopPlay();
  const from=fromEl?relRect(fromEl):null;
  const pg=openPage(detailHTML(p),{fade:true});pg.dataset.detail=id;
  setTint(pg,artOf(p));
  const hero=$('#dHero',pg);
  if(from&&!S.set.calm){
    requestAnimationFrame(()=>{
      const to=relRect(hero);if(!to.w)return;
      const fly=document.createElement('div');fly.className='fly';fly.style.cssText=`left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px`;fly.innerHTML=artOf(p);
      $('#phone').appendChild(fly);hero.style.visibility='hidden';
      requestAnimationFrame(()=>requestAnimationFrame(()=>{fly.style.left=to.x+'px';fly.style.top=to.y+'px';fly.style.width=to.w+'px';fly.style.height=to.h+'px'}));
      setTimeout(()=>{hero.style.visibility='';fly.remove()},800);
    });
  }
  haptic(8);
}
ACT.readmore=b=>{const d=$('#dDesc');const o=d.classList.toggle('open');b.textContent=o?'Show less':'Read more'};
ACT.back=closePage;
/* Rooms are off (FEATURE_ROOMS). Until they ship, the affordance is the honest
   one: send the song to the match as a message with a 30-second clip. */
const ROOM_OFFER_LABEL=FEATURE_ROOMS?'Listen together':'Send this song';
/* Phase 0 event seam: log every meme view, reaction and skip so Phases 1–2 and
   the briefing's event catalog have the data they depend on. `recordReaction`
   already calls `recordEvent`, so we only log views and skips explicitly. */
async function trackEvent(kind, targetType, targetId, extra){try{if(window.Cultured&&Cultured.repo&&typeof Cultured.repo.recordEvent==='function')await Cultured.repo.recordEvent(kind,targetType,targetId,extra||{})}catch(e){}}
ACT['to-room']=b=>{
  const th=$('.page[data-thread]:not([data-closing])');
  const withId=b.dataset.with||(th?th.dataset.thread:null);
  if(FEATURE_ROOMS){openRoom({trackId:b.dataset.id,withId});return}
  if(!withId){toast('Open a match before sending a song');return}
  const ref=b.dataset.id;if(!TRACKS[ref]){toast('Open a match before sending a song');return}
  ensureThread(withId);
  S.threads[withId].msgs.push({f:'me',kind:'track',ref,ts:Date.now()});
  save();closeSheet();toast('Sent with a 30-second clip');haptic(8);reply(withId);track('song_sent',{via:'rooms_off'});
};
/* Only real actions get a button. This sheet used to offer "Messages" and
   "Your story" that did nothing but toast "Sent to Messages" / "Added to your
   story" — a button that lies is worse than no button, because the user walks
   away believing something was sent. The OS share sheet already covers every
   real target, so it is the only alternative to copying the link, and it is
   only offered where it exists. */
const canNativeShare=()=>typeof navigator!=='undefined'&&typeof navigator.share==='function';
function openShare(id){
  const p=POSTS[id],r=refOf(p);
  const actions=[['copy','Copy link',I.link]];
  if(canNativeShare())actions.push(['more','Share',I.dots]);
  openSheet(`<h3 class="sh-t">Share</h3>
    <div class="shp"><div class="tile">${artOf(p)}</div><div><b>${esc(labelOf(p))}</b><span>${p.kind==='music'?esc(r.artist):'A cultured meme'}</span></div></div>
    <div class="share-row">${actions.map(o=>`<button data-act="sharego" data-fx="sharego" data-w="${o[0]}" data-t="${esc(labelOf(p))}"><i>${o[2]}</i>${o[1]}</button>`).join('')}</div>
    ${canNativeShare()?'':'<p class="hint">This browser has no share sheet, so the link is the only way out. Copy it and send it wherever you like.</p>'}`);
}
ACT.sharego=async b=>{
  const w=b.dataset.w;
  if(w==='more'){
    /* A dismissed sheet is not a failure — say nothing rather than a toast
       claiming something happened. */
    try{await navigator.share({title:'cultured',text:b.dataset.t,url:location.href});closeSheet()}catch(e){}
    return;
  }
  let ok=false;
  try{await navigator.clipboard.writeText(location.href);ok=true}catch(e){}
  /* Report what actually happened instead of assuming the clipboard worked. */
  toast(ok?'Link copied':'Couldn’t reach the clipboard — copy the address bar instead');
  closeSheet();
};
ACT.closesheet=closeSheet;

/* ================= matrix ================= */
const MATCH_MIN_SCORE=CFG.matchMinScore??60;
/* The calibration gate: the percentage only exists once there are ten real
   signals behind it. Below that, the Matrix says "calibrating" — a number
   before the math means anything would itself be dishonest. */
const CAL_NEEDED=10;
const calFraction=()=>clamp((S.cal||0)/CAL_NEEDED,0,1);
const calibrating=()=>(S.cal||0)<CAL_NEEDED;
/* The density gate: the Matrix opens in a city at 25 people; the waitlist is
   the honest alternative to inventing a deck. Friends mode is exempt — it
   works from day one. */
const CITY_OPEN_AT=CFG.cityOpenAt??25;
const CITY_POP=CFG.cityPop??0;
function queue(){return PEOPLE.filter(p=>!p.matched&&p.intent.indexOf(S.lens)>-1&&!S.decided[p.id]&&p.km<=S.set.radius&&p.score>=MATCH_MIN_SCORE).sort((a,b)=>b.score-a.score)}
/* How many in-range people the score gate is holding back. Used only to tell
   "nobody is here" apart from "nobody clears your bar yet" — a deck that goes
   empty should say which one it is. */
function gatedCount(){return PEOPLE.filter(p=>!p.matched&&p.intent.indexOf(S.lens)>-1&&!S.decided[p.id]&&p.km<=S.set.radius&&p.score<MATCH_MIN_SCORE).length}
const labelFor=s=>s>=90?'Taste twin':s>=80?'Strong overlap':'Worth a listen';
function renderMatchShell(){
  /* The v5 Matrix owns #s-match when its flag is on. main.ts mounts into the
     same host, so the tab rail, nav and deep links keep working untouched. */
  if(V5_MATRIX)return;
  $('#s-match').innerHTML=`<div class="tint matrix-tint">${mediaLayer('matrixBg','matrix-media')}${mediaLayer('matrixVideo','matrix-video')}</div>
    <header class="topbar"><div class="wordmark">${RING_GLYPH}Matrix</div><div class="hr"><button class="ibtn" data-act="open-settings" aria-label="Discovery settings">${I.sliders}</button></div></header>
    ${ftabsHTML('lens',[['dating','Dating'],['friends','Friends']],S.lens)}
    <div class="sbody mbody">
      <div class="mscore stg"><div class="big"><span id="bigScore">0</span><small>%</small></div><div class="msl"><b id="msLabel"></b><span id="msSub"></span></div></div>
      <div class="deck stg" style="--d:1" id="deck"></div>
      <div class="dock stg" style="--d:2">
        <button class="dbtn sm" data-act="rewind" id="b-rw" aria-label="Rewind last decision">${I.rewind}</button>
        <button class="dbtn" data-act="pass" id="b-pass" aria-label="Pass">${I.x}</button>
        <button class="rbtn" data-act="resonate" id="b-res" aria-label="Resonate">${I.res}<span>Resonate</span></button>
        <button class="dbtn sm" data-act="compare" id="b-cmp" aria-label="See profile and compare">${I.sliders}</button>
      </div>
    </div>`;
  layoutTabs($('#s-match'));renderDeck();
}
function whyChips(p){
  if(calibrating())return `<span class="chipg why cal">${I.star}calibrating — ${Math.max(0,CAL_NEEDED-(S.cal||0))} more signal${(S.cal||0)===1?'':'s'}</span>`;
  const me=mineHum(),humor=(p.humor||[]).map((v,i)=>v>=.6&&(me[i]?me[i]>=.6:true)?HUMOR[i]:null).filter(Boolean).slice(0,1);
  const artist=p.shared[0]?TRACKS[p.shared[0]].title:null;
  const chips=[artist?`<span class="chipg why">${I.note}${esc(artist)}</span>`:'',humor[0]?`<span class="chipg why">${I.laugh}Same topic: ${esc(humor[0])}</span>`:''];
  if(S.duelLink&&S.duelLink.verdict)chips.push(`<span class="chipg why">${I.star}Duel: ${S.duelLink.verdict.score}/${S.duelLink.verdict.of} same damage</span>`);
  return chips.filter(Boolean).join('')||'<span class="chipg why">Two songs in common</span>';
}
function pcardHTML(p,k){
  const cal=calibrating();
  return `<div class="dcard pcard ${k===0?'top':''}" data-id="${p.id}" style="--k:${k};z-index:${20-k}">
    ${personArt(p)}<div class="shade"></div>
    <div class="pc-ovl" aria-hidden="true">${pairFP(p,false)}</div>
    <div class="stamp res">Resonate</div><div class="stamp pas">Pass</div>
    <div class="dc-top"><span class="chipg">${I.pin}${p.km} km away</span><span class="chipg">${S.lens==='dating'?'Dating':'Friends'}</span></div>
    <div class="dc-bot">
      <div class="whyrow" role="list" aria-label="Why you matched">${whyChips(p)}</div>
      <h3>${esc(p.name)}, ${p.age}</h3><p>${esc(p.bio)}</p>
      <div class="covrow">${p.shared.slice(0,3).map(id=>`<div class="cov">${poster(TRACKS[id],true)}</div>`).join('')}<span>${p.shared.length} in common</span>${cal?'':'<span class="cov-pct">'+p.score+'%</span>'}</div></div>
  </div>`;
}
function endHTML(gated){
  const passed=S.history.filter(id=>S.decided[id]==='pass').length;
  const pair=`<div class="pair">${fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:12,w:1.3})}</div>`;
  const actions=`<div class="row2">${passed?`<button class="cta sm" style="width:auto;padding:0 22px" data-act="revisit">Revisit ${passed} passed</button>`:''}<button class="cta sm ghostb" style="width:auto;padding:0 22px;margin:0" data-act="open-settings">Widen radius</button></div>`;
  const wait=`<div class="wait">${S.wait
    ?`<span class="chipg">${I.check}On the waitlist for ${esc(S.city)}</span>`
    :`<button class="cta sm ghostb" style="width:auto;padding:0 22px;margin:0" data-act="waitlist">Join the city waitlist</button>`}</div>`;
  if(gated)return `<div class="endq">${pair}<h2>Still calibrating</h2><p>Nobody nearby clears your resonance bar yet. React to a few more memes and songs — your deck refills as the scores move.</p>${actions}</div>`;
  /* The density gate, stated as a policy rather than a tease. Friends mode is
     never gated: it works from day one, with however many friends are here. */
  if(S.lens==='dating'&&CITY_POP<CITY_OPEN_AT)return `<div class="endq">${pair}
    <h2>The Matrix opens in ${esc(S.city)} at ${CITY_OPEN_AT} people</h2>
    <p>A dating deck with three people in it is a lie with a nice layout. When enough of the city is here, the deck switches on — no queue counter, no invented hype — just the door opening.</p>
    ${wait}
    <p class="hint">Friends mode has no gate: switch tabs and it works today, however small it is.</p>
    ${actions}</div>`;
  return `<div class="endq">${pair}
    <h2>That’s everyone nearby, for now</h2>
    <p>New people show up as they join within ${S.set.radius} km. Widen your radius, or take another look at the ones you passed.${S.lens==='friends'?' Friends mode opens with you, from day one.':''}</p>${actions}</div>`;
}
ACT.waitlist=()=>{S.wait=true;save();renderDeck();toast('On the waitlist for '+S.city+'. We’ll email once the city flips on.');haptic(8);track('city_waitlist_join',{city:S.city})};
function renderDeck(enter){
  const q=queue(),p=q[0],deck=$('#deck');if(!deck)return;
  const gated=!p&&gatedCount()>0;
  deck.innerHTML=p?q.slice(0,3).map((x,i)=>pcardHTML(x,i)).reverse().join(''):endHTML(gated);
  const cal=calibrating();
  $('#msSub').textContent=p?(cal?`calibrating — ${(S.cal||0)}/${CAL_NEEDED} signals`:`${q.length} nearby`):(gated?'No strong overlap yet':(S.lens==='dating'&&!DEMO_DATA?'Opens in your city at '+CITY_OPEN_AT+' people':'Nobody in range'));
  $('#msLabel').textContent=p?(cal?'Still calibrating':labelFor(p.score)):(gated?'Still calibrating':'All caught up');
  if(p&&!cal)countTo($('#bigScore'),p.score,900);else $('#bigScore').textContent='--';
  ['pass','res','cmp'].forEach(x=>$('#b-'+x).disabled=!p);$('#b-rw').disabled=!S.history.length;
  const card=$('.pcard.top',deck);
  if(card){
    const res=$('.stamp.res',card),pas=$('.stamp.pas',card);
    bindDrag(card,{can:()=>!busy,fly:dir=>decide(dir>0?'res':'pass'),tap:()=>openProfile(p.id),drag:dx=>{const k=clamp(Math.abs(dx)/110,0,1);res.style.opacity=dx>0?k:0;pas.style.opacity=dx<0?k:0}});
    if(enter){card.style.transition='none';card.style.transform=`translateX(${enter==='r'?130:-130}%) rotate(${enter==='r'?18:-18}deg)`;card.style.opacity='0';void card.offsetWidth;card.style.transition='';card.style.transform='';card.style.opacity=''}
    else microPublic.pop($('.dc-bot h3',card),1.03);
  }
  const host=$('#s-match');if(p)setTint(host,personArt(p).replace('class="art"','class="art"'));
}
function ensureThread(id){if(!S.threads[id])S.threads[id]={unread:0,msgs:[]}}
function decide(kind){
  const p=queue()[0];if(!p||busy)return;busy=true;
  const card=$('.pcard.top');haptic(kind==='res'?[12,40,12]:10);
  const st=$(kind==='res'?'.stamp.res':'.stamp.pas',card);if(st)st.style.opacity=1;
  /* Resonate: a ripple leaves the button and a light wipe crosses the card.
     Pass: the card tilts out softly. Both are decoration — the decision was
     already written above by the state mutation, never by the animation. */
  if(kind==='res'){microPublic.ringFrom($('#b-res'),'var(--bone)');card.classList.add('fx-wipe');if(S.set.sound!==false)synth.blip('pop')}
  else card.classList.add('fx-tilt-out');
  card.style.transition='transform .55s var(--spring),opacity .5s';
  card.style.transform=`translate3d(${kind==='res'?140:-140}%,0,0) rotate(${kind==='res'?20:-20}deg)`;card.style.opacity='0';
  S.decided[p.id]=kind;S.history.push(p.id);
  /* A mutual is only real if the other person actually acted. The seeded
     `likesYou` flag is a demo affordance, so a production build can never
     manufacture one from it — and it is never rendered as a who-liked-me badge,
     which would be the paywall this product deliberately does not have. */
  const mutual=kind==='res'&&DEMO_DATA&&p.likesYou===true;
  if(mutual&&S.matchedIds.indexOf(p.id)<0){S.matchedIds.push(p.id);ensureThread(p.id)}
  save();
  setTimeout(()=>{busy=false;renderDeck();if(mutual)showMutual(p)},400);
}
ACT.pass=()=>decide('pass');
ACT.resonate=()=>decide('res');
ACT.rewind=()=>{
  if(busy||!S.history.length)return;
  const id=S.history.pop(),kind=S.decided[id],p=person(id);
  delete S.decided[id];
  if(S.matchedIds.indexOf(id)>-1){S.matchedIds=S.matchedIds.filter(x=>x!==id);if(S.threads[id]&&!S.threads[id].msgs.length)delete S.threads[id]}
  if(p.intent.indexOf(S.lens)<0){S.lens=p.intent[0];setSeg($('#s-match .ftabs'),S.lens);$$('#s-match .ft').forEach(b=>b.classList.toggle('on',b.dataset.v===S.lens));layoutTabs($('#s-match'))}
  save();haptic(8);renderDeck(kind==='res'?'r':'l');
  /* Rewind returns the card with a reverse spin — the exit played backwards,
     which is the least you can do after taking someone's decision back. */
  const c=$('.pcard.top');if(c&&!S.set.calm)c.animate([{transform:'rotate(-16deg) scale(1.04)'},{transform:'rotate(0) scale(1)'}],{duration:380,easing:'cubic-bezier(.34,1.56,.64,1)'});
};
ACT.revisit=()=>{S.history.filter(id=>S.decided[id]==='pass').forEach(id=>delete S.decided[id]);S.history=S.history.filter(id=>S.decided[id]);save();renderDeck()};
FT.lens=v=>{S.lens=v;save();renderDeck()};
ACT.compare=()=>{const p=queue()[0];if(p)openProfile(p.id)};
function openProfile(id){
  const p=person(id),me=mineHum();
  const pg=openPage(`<div class="d-scroll" data-pid="${p.id}">
    <div class="d-top stg"><button class="pillb" data-act="back" aria-label="Back">${I.back}<span>Back</span></button><div class="d-chips"><span class="chipg">${I.pin}${p.km} km</span><span class="chipg">${p.age}</span></div></div>
    <div class="d-hero" id="dHero" style="aspect-ratio:1/1.05">${personArt(p)}<div class="pc-ovl live" aria-hidden="true">${pairFP(p)}</div><div class="shade" style="height:45%"></div><div style="position:absolute;left:20px;bottom:18px;z-index:3">${calibrating()?`<div style="font-size:30px;font-weight:800;font-stretch:78%;letter-spacing:-.02em;line-height:1">${I.star} Calibrating</div><div style="color:rgba(255,255,255,.85);font-size:14px;margin-top:6px">${S.cal||0}/${CAL_NEEDED} signals — the number lands when the math means something</div>`:`<div style="font-size:64px;font-weight:800;font-stretch:75%;letter-spacing:-.05em;line-height:.9">${p.score}%</div><div style="color:rgba(255,255,255,.85);font-size:14.5px;margin-top:4px">${labelFor(p.score)}</div>`}</div></div>
    <h1 class="d-title stg" style="--d:2">${esc(p.name)}</h1>
    <p class="d-by stg" style="--d:3">${S.lens==='dating'?'Open to dating':'Looking for friends'}, ${p.km} km away</p>
    <p class="d-desc open stg" style="--d:4">${esc(p.bio)}</p>
    <div class="whyrow stg" style="--d:5;padding:0 20px">${whyChips(p)}</div>
    <h3 class="d-h stg" style="--d:5">You both play<small>${p.shared.length} songs</small></h3>
    <div class="hs stg" style="--d:5">${p.shared.map(sid=>`<button class="cov-c" data-act="open-d-track" data-id="${sid}"><div class="pt">${poster(TRACKS[sid],true)}</div><p>${esc(TRACKS[sid].title)}</p><span>${esc(TRACKS[sid].artist)}</span></button>`).join('')}</div>
    <h3 class="d-h stg" style="--d:6">Fingerprint overlap</h3>
    <div class="pf-fp stg" style="--d:6">${pairFP(p)}</div>
    <p class="hint stg" style="--d:6;margin-top:10px">The closer your rings line up, the more your taste overlaps.</p><button class="cta ghostb stg" style="--d:7;margin-top:22px" data-act="safety" data-id="${p.id}">Something felt off?</button>
    <h3 class="d-h stg" style="--d:7">Humor</h3>
    <div class="stg" style="--d:7">${HUMOR.map((h,i)=>`<div class="hb"><span>${h}</span><div class="bars"><i class="y" style="width:${Math.round(me[i]*100)}%"></i><i class="t" style="width:${Math.round(p.humor[i]*100)}%"></i></div></div>`).join('')}<div class="legend"><span><i class="y"></i>You</span><span><i class="t"></i>${esc(p.name)}</span></div></div>
  </div>
  <div class="cta-dock"><button class="split" data-act="prof-res" data-id="${p.id}"><b>${queue()[0]&&queue()[0].id===p.id?'Resonate':'Say hi'}</b><span>${p.score}%</span></button></div>`,{fade:true});
  pg.dataset.profile=p.id;setTint(pg,personArt(p));haptic(8);
}
ACT['open-d-track']=b=>{const t=TRACKS[b.dataset.id];const post=Object.values(POSTS).find(x=>x.kind==='music'&&x.ref===t.id);if(post)openDetail(post.id,null)};
ACT['prof-res']=b=>{
  const id=b.dataset.id,q=queue()[0];
  if(q&&q.id===id){closePage();setTimeout(()=>decide('res'),520)}
  else if(S.threads[id]){closePage();setTimeout(()=>{go('people');setTimeout(()=>openThread(id),250)},520)}
  else toast('Resonate from the Matrix to say hi');
};
function showMutual(p){
  const o=$('#overlay');
  const sparks=Array.from({length:28},(_,i)=>`<i style="--i:${i};--a:${(i/28*360).toFixed(1)}deg;--d:${34+(i%5)*12}px">${['✦','•','♪','♡'][i%4]}</i>`).join('');
  /* Confetti: 26 shards in brand colors plus 12 glyphs. Pure CSS animation,
     transform/opacity only, self-removing via `forwards`; calm mode shows the
     settled rain instead of the fall (the .calm rules in app.css). */
  const COLORS=['#ff5d7a','#ffd166','#EFE9DA'];
  const confetti=Array.from({length:26},(_,i)=>{const x=Math.round(Math.random()*100),dl=(Math.random()*1.1).toFixed(2),t=(2.1+Math.random()*1.4).toFixed(2),dx=`${Math.round(-60+Math.random()*120)}px`;return `<i style="--x:${x}%;--c:${COLORS[i%3]};--r:${Math.round(Math.random()*360)}deg;--dl:${dl}s;--t:${t}s;--dx:${dx}"></i>`}).join('')
    +Array.from({length:12},(_,i)=>{const x=Math.round(Math.random()*100),dl=(Math.random()*1.2).toFixed(2);return `<i class="glyph" style="--x:${x}%;--c:${i%2?'#ffd166':'#ff5d7a'};--r:${Math.round(Math.random()*360)}deg;--dl:${dl}s;--t:${(2.4+Math.random()).toFixed(2)}s;--dx:${Math.round(-60+Math.random()*120)}px">${['♪','✦','♡'][i%3]}</i>`}).join('');
  /* The mutual moment is one scene: two meme cards tilt in, touch at a corner,
     ripples spread, and the two fingerprints draw toward each other and merge.
     About two seconds, tap anywhere to skip, a chime and haptics if the
     settings allow. None of it is required for the match to exist — the match
     was saved before this function ran. */
  o.innerHTML=`<div class="mut" style="--mc:${p.pal[0]}"><div class="mut-confetti" aria-hidden="true">${confetti}</div><div class="mut-sparks" aria-hidden="true">${sparks}</div>
    <div class="mut-rip" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="mut-cards" aria-hidden="true"><span class="mc a" style="--bg:${p.pal[1]}">${p.pal.length?'':'?'}</span><span class="mc b" style="--bg:${p.pal[2]}">♥</span></div>
    <div class="mut-fp merge">${pairFP(p)}</div>
    <span class="eyebrow">A rare overlap</span><h2>You two resonate.</h2>
    <p>${calibrating()?'Your overlap score is still calibrating.':p.score+'% overlap.'} You both play ${esc(sharedTitles(p))}.</p>
    <button class="cta" data-act="mut-hi" data-id="${p.id}">Say hi to ${esc(p.name)}</button><button class="cta ghostb" data-act="mut-close">Keep browsing</button>
    <button class="duel-chip" data-act="duel-chip" data-id="${p.id}">${I.pair}Duel ${esc(p.name)} first</button>
    <span class="mut-skip">tap anywhere to skip</span></div>`;
  o.classList.add('on');haptic([20,60,20,60,30]);
  if(S.set.sound!==false)synth.chime();
  track('match_created',{source:'matrix',score:p.score});
  /* Tap to skip: one tap anywhere outside the buttons closes the moment. */
  const skip=e=>{if(e.target.closest('button'))return;ACT['mut-close']()};
  o.addEventListener('click',skip,{once:true});
}
ACT['mut-close']=()=>{const o=$('#overlay');o.classList.remove('on');o.innerHTML=''};
ACT['mut-hi']=b=>{ACT['mut-close']();go('people');setTimeout(()=>openThread(b.dataset.id),250)};  /* ================= culture arena ================= */
let PFX=null;
function stopPulseFX(){if(PFX){clearInterval(PFX.r);PFX=null}}

/* Arena shell (Pulse renamed). The duplicate vibe-zone rows and the fabricated
   Pulse stats strip are removed in this phase; the card row, the local-signal card,
   the note rail and the duel entry all remain as the Phase-3 fill-in point. */
function renderArena(){
  /* The v5 Arena owns #s-arena when its flag is on. main.ts mounts into the
     same host, so the tab rail and deep links keep working. */
  if(V5_ARENA)return;
  /* The arena tells the truth about a duel: live, waiting, or revealed — read
     from the same localStorage record the /d/:id tab writes to. */
  const dl=S.duelLink&&S.duelLink.id?S.duelLink:null;
  const dstat=dl?(dl.verdict?`Revealed · ${dl.verdict.score}/${dl.verdict.of}`:'Duel live · waiting'):'Enter the duel';
  /* The week badge is the real ISO week of "now", not a hard-coded number.
     Thursday rule: the week owns the year of its Thursday. */
  const now=new Date(),thu=new Date(now);thu.setDate(now.getDate()+3-((now.getDay()+6)%7));
  const week=`WEEK ${1+Math.round(((thu.getTime()-new Date(thu.getFullYear(),0,1).getTime())/864e5-3+((new Date(thu.getFullYear(),0,1).getDay()+6)%7))/7)}`;
  $('#s-arena').innerHTML=`<div class="tint pulse-tint"><div class="pulse-glow glow-a"></div><div class="pulse-glow glow-b"></div>${PFX&&!S.set.calm?'':'<canvas id="arena-fx" class="pulsefx" aria-hidden="true"></canvas>'}</div>
    <header class="topbar"><div class="wordmark">${RING_GLYPH}Arena</div><div class="hr"><button class="ibtn" data-act="arena-refresh" data-fx="spin" aria-label="Refresh arena">${I.refresh}</button></div></header>
    <div class="pulse-wrap">
      <section class="pulse-hero stg" style="--d:1"><div class="pulse-kicker"><span class="live-dot"></span> CULTURE IS MOVING</div><h1>What the room<br>is feeling <em>now.</em></h1><p>Small signals from the people, sounds and jokes shaping your week.</p><div class="pulse-orbit" aria-hidden="true"><div class="orbit-ring r1"></div><div class="orbit-ring r2"></div><div class="orbit-core">${I.star}</div><i class="orbit-dot d1">♪</i><i class="orbit-dot d2">♡</i><i class="orbit-dot d3">✦</i></div></section>
      <div class="pulse-section-head stg" style="--d:2"><div><span class="eyebrow">Your weekly ritual</span><h2>Pick a little culture</h2></div><span class="pulse-week">${week}</span></div>
      <section class="games-row stg" style="--d:3">
        <article class="g-card duel-card"><div class="g-art duel-art"><span style="--dl:-1s">😂</span><span style="--dl:-2.6s">📝</span><span class="g-glyph">${I.pair}</span></div><div class="g-copy"><span class=\"chipg\">MEME DUEL · REAL LINK</span><h3>Same meme, different damage.</h3><p>Caption five prompts, send the link. The verdict opens only once both sides are in.</p><button class=\"cta sm ${dl?'done':''}\" data-act=\"pulse-duel\">${esc(dstat)} ${dl?I.check:I.chevr}</button></div></article>
        <article class="g-card nhi-card"><div class="g-art nhi-art"><span style="--dl:-.6s">🙈</span><span style="--dl:-3.2s">👀</span><span class="g-glyph">${I.star}</span></div><div class="g-copy"><span class="chipg">NEVER HAVE I EVER · 2 MIN</span><h3>Confess, but funnier.</h3><p>Ten cards, two answers: guilty or innocent. Your picks redraw your humor map — and stay on this device.</p><button class="cta sm ${S.nhi?.done?'done':''}" data-act="nhi-open">${S.nhi?.done?'Round played':'Play a round'} ${S.nhi?.done?I.check:I.chevr}</button></div></article>
        <article class="g-card ice-card-game"><div class="g-art ice-art"><span style="--dl:-1.8s">🫂</span><span class="g-glyph">${I.chat}</span></div><div class="g-copy"><span class="chipg">ICEBREAKER ROULETTE</span><h3>An opener, not “hey”.</h3><p>A question built from what you two actually share. Spin, then send.</p><button class="cta sm ghostb" data-act="nhi-icebreaker">Spin the wheel ${I.chevr}</button></div></article>
      </section>
      <section class="pulse-grid stg" style="--d:4">
        <article class="pulse-card field-card"><div class="pulse-card-art field-art"><div class="mini-fp">${fpSVG(fpParams(42),'#EFE9DA','#ff5d7a',{n:9,w:1.2})}</div></div><div class="pulse-card-copy"><span class="chipg">LOCAL SIGNAL</span><h3>Your city is still quiet.</h3><p>Local signal switches on once enough people in one area are here. We would rather show you nothing than invent a number.</p><button class="cta sm ghostb" data-act="arena-explore">How this works ${I.chevr}</button></div></article>
      </section>
      <section class="pulse-note stg" style="--d:5"><div class="note-icon">${I.note}</div><div><b>Your Fingerprint gets sharper in public.</b><span>React, save, listen. We’ll keep the useful parts.</span></div><button class="ibtn" data-act="tab" data-t="feed" aria-label="Open Culture Feed">${I.chevr}</button></section>
    </div>`;
  layoutTabs($('#s-arena'));loadArenaFX();
}
function loadArenaFX(){const c=$('#arena-fx');if(!c||S.set.calm)return;PFX=null;stopPulseFX();const ctx=c.getContext('2d');const st={r:null,d:[]};
  const fit=()=>{const r=c.getBoundingClientRect();const w=r.width>10?r.width:390,h=r.height>10?r.height:430;const dp=Math.min(2,window.devicePixelRatio||1);if(c.width!==Math.round(w*dp)||c.height!==Math.round(h*dp)){c.width=Math.round(w*dp);c.height=Math.round(h*dp);st.d.length=0;for(let i=0;i<26;i++)st.d.push({x:Math.random()*c.width,y:Math.random()*c.height,r:1+Math.random()*2.6,v:.18+Math.random()*.6,a:.06+Math.random()*.26,g:['\u266A','\u2726','\u2661'][i%3]})}};
  fit();setTimeout(fit,420);
  st.r=setInterval(()=>{fit();ctx.clearRect(0,0,c.width,c.height);const dp=Math.min(2,window.devicePixelRatio||1);
    for(const q of st.d){q.y-=q.v*dp;if(q.y<-12){q.y=c.height+12;q.x=Math.random()*c.width}
      ctx.beginPath();ctx.arc(q.x,q.y,q.r*dp,0,6.2832);ctx.fillStyle=`rgba(239,233,218,${q.a})`;ctx.fill();
      if(q.g){ctx.font=`${11*dp}px serif`;ctx.fillStyle=`rgba(255,209,102,${q.a+.12})`;ctx.fillText(q.g,q.x+9,q.y)}}},33);
  PFX=st;
}
/* ================= meme duel: the real, two-party link flow ============
   There is no deterministic fake partner any more. `duelPartnerPick` — the
   hash that used to invent what your friend would pick — is deleted. A duel is
   created through `repo.duel`, shared as a `/d/:id` link, and the recipient
   answers independently in their own tab. The verdict exists only after both
   sides have submitted; before that the app shows the wait, and nothing else.
   Picks land as real calibration events on both sides. */
const DUI={id:null,step:0,picks:{},rec:null,unsub:null};
function duelLinkUrl(id){
  /* Deep link when the host can route it; query fallback for static hosts. */
  const atRoot=location.pathname==='/'||location.pathname.endsWith('.html');
  return atRoot?location.origin+'/d/'+id:location.origin+location.pathname+'?d='+id;
}
const duelSheetEl=()=>$('#sheetwrap .sheet');
function duelStatusLine(rec){
  if(rec.verdict)return {t:'Revealed · both sides are in',cls:'ok'};
  if(rec.a.submittedAt&&rec.b.submittedAt)return {t:'Locking the reveal…',cls:'wait'};
  if(rec.a.submittedAt)return rec.b.joinedAt?{t:'They’re playing. Your five are locked.',cls:'wait'}:{t:'Link is live. Nobody has opened it yet.',cls:'wait'};
  if(rec.b.joinedAt)return {t:'They’re waiting on your five.',cls:'you'};
  return {t:'Send the link when you’re ready.',cls:'you'};
}
function duelSheetHTML(){
  const rec=DUI.rec;if(!rec)return '';
  const link=duelLinkUrl(rec.id),st=duelStatusLine(rec);
  const head=`<div class="game-sheet-head"><div class="game-sheet-title"><span class="chipg">Meme Duel · two players</span><h3 class="sh-t">Same memes.<br>Different damage.</h3><span class="hint">Five fixed choices each. No typing, so nothing needs moderating.</span></div><button class="ibtn" data-act="closesheet" aria-label="Close">${I.x}</button></div>
    <div class="duel-link"><code>${esc(link)}</code><button class="chip" data-act="duel-copy" data-fx="sharego">${I.link}Copy</button><button class="chip" data-act="duel-share">${I.send}Send link</button></div>
    <div class="duel-status ${st.cls}"><span class="live-dot"></span>${esc(st.t)}</div>`;
  if(rec.verdict){
    const sc=rec.verdict.score,of=rec.verdict.of,C=2*Math.PI*74,off=C*(1-sc/of);
    const v=duelVerdictLine(sc,of);
    return head+`<div class="duel2-verdict">
      <div class="duel2-ring" role="img" aria-label="${sc} of ${of} picks matched">
        <svg viewBox="0 0 168 168" aria-hidden="true"><circle class="track" cx="84" cy="84" r="74" stroke-width="7"/><circle class="fill" cx="84" cy="84" r="74" stroke-width="7" style="--len:${C.toFixed(1)};--to:${off.toFixed(1)}"/></svg>
        <span class="dv-wrap"><span class="dv" id="duelDv">${sc}<small>/${of}</small></span><span class="de">${v.emoji}</span></span>
      </div>
      <b>${esc(v.line)}</b><span class="hint">Both sides submitted independently. ${rec.b.joinedAt?'Your friend answered as “'+esc(rec.b.name||'Your friend')+'”':''}</span>
    </div>
    <div class="duel-cardwrap"><canvas class="duel2-card" aria-label="Your Duel Card preview"></canvas><span class="chipg">1080×1920 · 1080×1080</span></div>
    <div class="game-cta-row">
      <button class="cta" data-act="duel-sharecard" data-fx="sharego">${I.share}Share card</button>
      <button class="cta ghostb" data-act="duel-savecard">Download</button>
    </div>
    <div class="game-cta-row" style="margin-top:10px">
      <button class="cta sm ghostb" data-act="duel-send">Send verdict to a chat</button>
      <button class="cta sm ghostb" data-act="duel-again">New duel</button>
    </div>`;
  }
  const myDone=!!rec.a.submittedAt;
  if(!myDone){
    const prompts=DUEL_PROMPTS,step=DUI.step,cur=prompts[Math.min(step,prompts.length-1)];
    return head+`<div class="duel2-head" style="margin-top:16px"><span class="chipg">${step>=prompts.length?'submitting':'your five'}</span><span class="duel2-step">${Math.min(step+1,prompts.length)} / ${prompts.length}</span></div>
      <div class="duel2-prog" aria-hidden="true">${prompts.map((x,i)=>`<i class="${i<step?'done':i===step?'cur':''}"></i>`).join('')}</div>
      <div class="duel2-stage"><span class="duel2-emoji">${cur.emoji}</span><h3 class="duel2-q">${esc(cur.q)}</h3><span class="duel2-vs">pick your caption</span></div>
      <div class="duel2-opts">${(['a','b']).map(side=>`<button class="duel2-opt opt-${side}" data-act="duel-pick" data-fx="duel-pick" data-q="${cur.id}" data-v="${side}"><b>${side.toUpperCase()}</b><span>${esc(cur.options[side].text)}</span></button>`).join('')}</div>
      ${step?`<button class="linkb" data-act="duel-back">← back one</button>`:''}`;
  }
  return head+`<div class="duel2-stage" style="margin-top:20px"><span class="duel2-emoji">🔒</span><h3 class="duel2-q">Your five are locked.</h3><p class="hint">The reveal opens only after your friend submits theirs. That is the whole game: nobody sees a partial.</p><div class="duel2-prog" aria-hidden="true">${DUEL_PROMPTS.map((x,i)=>`<i class="done"></i>`).join('')}</div><button class="cta ghostb" data-act="duel-again" style="margin-top:14px">Start a fresh duel</button></div>`;
}
function paintDuel(){
  const sh=duelSheetEl();
  if(sh){
    sh.innerHTML=duelSheetHTML();
    const cv=$('.duel2-card',sh);
    if(cv&&DUI.rec&&DUI.rec.verdict){
      renderDuelCard(cv,DUI.rec,{size:'story',external:false});
      microPublic.countTo($('#duelDv',sh),DUI.rec.verdict.score);
      if(S.set.sound!==false)synth.chime();
      haptic([20,60,20]);
    }
  }
  if(DUI.rec){S.duelLink={id:DUI.rec.id,verdict:DUI.rec.verdict?{score:DUI.rec.verdict.score,of:DUI.rec.verdict.of}:null};save()}
  if(cur==='arena')renderArena();
}
async function duelEnsure(){
  const repo=window.Cultured&&window.Cultured.repo;
  if(!repo||!repo.duel)throw new Error('adapter offline');
  let rec=null;
  if(S.duelLink&&S.duelLink.id)rec=await repo.duel.get(S.duelLink.id);
  if(!rec){rec=await repo.duel.create({displayName:S.prof.name});track('duel_created',{source:DEMO_DATA?'demo':'live'})}
  DUI.rec=rec;DUI.id=rec.id;DUI.picks={...(rec.a.picks||{})};DUI.step=Object.keys(DUI.picks).length;
  if(DUI.unsub)DUI.unsub();
  DUI.unsub=repo.duel.watch(rec.id,r=>{if(r){DUI.rec=r;paintDuel()}});
  S.duelLink={id:rec.id,verdict:rec.verdict?{score:rec.verdict.score,of:rec.verdict.of}:null};save();
  return rec;
}
function duelOpen(){duelEnsure().then(()=>{paintDuel()}).catch(()=>toast('The duel adapter is offline in this build'))}
function duelRefresh(){paintDuel()}

/* ================= never have i ever ================= */
/* Ten confession cards. Answering honestly is the point: every “guilty” is a
   real humor-style signal, so the round feeds the same event seam the feed
   uses — but only the participant's own answers, nothing invented. */
/* Ten confession cards. The answers feed the humor map; the copy is allowed to
 be ridiculous — the mechanic never is. No streaks, no loss, no invented crowd:
 just you and a card. */
const NHI_CARDS=[
 {e:'🎧',q:'…gave a song a personality disorder by replaying one 14-second outro',hint:'The replay count is between you and the algorithm.'},
 {e:'🚕',q:'…cried in a cab and quietly blamed the driver’s playlist',hint:'The night bus claims all of us eventually.'},
 {e:'📕',q:'…nodded through a book conversation I had absolutely not read',hint:'The group chat suspects already. The group chat always suspects.'},
 {e:'🎬',q:'…called a fictional character “basically me” at a party',hint:'They stopped making characters like that. So did the party.'},
 {e:'🎤',q:'…performed the full album, air-drum solo included, to an empty room',hint:'Sold out. Every night. The merch table was a cat.'},
 {e:'📱',q:'…followed an artist in 2016 and still think about their side project',hint:'They broke up in a comment section. It got lyrical.'},
 {e:'💸',q:'…bought the merch out of spite for my rent, not love of the music',hint:'Rent is temporary. The tote bag is forever.'},
 {e:'🫥',q:'…left someone on read because the vibe was too good to ruin with words',hint:'A masterpiece needs the right silence.'},
 {e:'🍜',q:'…ranked the city’s late-night food spots and started a real fight',hint:'Third place holds a grudge. Third place is right.'},
 {e:'🌀',q:'…made an entire playlist for a person I never sent it to',hint:'The saddest art form of our generation.'}
];
function nhiBody(){
  const N=S.nhi||(S.nhi={i:0,hits:0,done:false});
  if(N.done){
    const honest=Math.round((N.hits/Math.max(1,N.i))*100);
    const line=honest>=70?'Chaotic. Excellent. Your Fingerprint just got much sharper.':honest>=40?'A healthy amount of damage. The engine thanks you.':'A person of mystery. The engine will ask again someday.';
    return `<div class="game-sheet-head"><span class="chipg">Never Have I Ever</span><span class="duel2-step">done</span></div>
      <div class="duel2-verdict"><div class="duel2-ring" role="img" aria-label="${N.hits} of ${N.i} confessions">
        <svg viewBox="0 0 168 168" aria-hidden="true"><circle class="track" cx="84" cy="84" r="74" stroke-width="7"/><circle class="fill" cx="84" cy="84" r="74" stroke-width="7" style="--len:${(2*Math.PI*74).toFixed(1)};--to:${(2*Math.PI*74*(1-N.hits/Math.max(1,N.i))).toFixed(1)}"/></svg>
        <span class="dv-wrap"><span class="dv">${N.hits}<small>/${N.i}</small></span><span class="de">🙈</span></span>
      </div><b>${line}</b><span class="hint">Confessions stay on your device. Only the humor signal is kept.</span></div>
      <div class="game-cta-row"><button class="cta" data-act="nhi-again">Play again</button><button class="cta ghostb" data-act="closesheet">Done</button></div>`;
  }
  const cur=NHI_CARDS[N.i];
  return `<div class="game-sheet-head"><span class="chipg">Never Have I Ever</span><span class="duel2-step">${N.i+1} / ${NHI_CARDS.length}</span></div>
    <div class="nhi-stage"><span class="nhi-count">card ${N.i+1} of ${NHI_CARDS.length}</span><h3 class="nhi-q">Never have I ever…</h3><p class="nhi-q">${cur.e} ${esc(cur.q)}</p><p class="nhi-hint">${esc(cur.hint)}</p></div>
    <div class="nhi-opts">
      <button class="nhi-opt opt-yes" data-act="nhi-answer" data-v="1"><span>${I.heart} Guilty</span></button>
      <button class="nhi-opt opt-no" data-act="nhi-answer" data-v="0"><span>${I.check} Clean</span></button>
    </div>
    <div class="nhi-meter" aria-hidden="true">${NHI_CARDS.map((_,k)=>`<i class="${k<N.i?'hit':''}"></i>`).join('')}</div>`;
}
function nhiOpen(){openSheet(nhiBody())}
function nhiRefresh(){const sh=$('#sheetwrap .sheet');if(sh)sh.innerHTML=nhiBody()}
ACT['nhi-open']=()=>{nhiOpen();haptic([8,25,8])};
ACT['nhi-answer']=b=>{
  const N=S.nhi;if(!N||N.done)return;
  const guilty=b.dataset.v==='1';
  if(guilty){N.hits++;burst(b,'#ff5d7a');haptic(12)}else haptic(6);
  N.i++;
  if(N.i>=NHI_CARDS.length){N.done=true;track('nhi_round_done',{source:DEMO_DATA?'demo':'live'})}
  save();nhiRefresh();
};
ACT['nhi-again']=()=>{S.nhi={i:0,hits:0,done:false};save();nhiRefresh();haptic(8)};
/* Icebreaker straight from the arena — same honest prompts as the chat one. */
ACT['nhi-icebreaker']=b=>{const id=Object.keys(S.threads||{})[0];if(id)ACT.icebreaker({dataset:{id}});else toast('Opener needs a real match — duel someone first')};
ACT['pulse-duel']=async b=>{
  try{await duelEnsure()}catch(e){toast('The duel adapter is offline in this build');return}
  openSheet(duelSheetHTML());paintDuel();haptic([8,25,8]);
};
ACT['duel-start']=ACT['pulse-duel'];
ACT['duel-pick']=async b=>{
  const q=b.dataset.q,side=b.dataset.v;
  DUI.picks[q]=side;DUI.step=Math.min(DUI.step+1,DUEL_PROMPTS.length);
  const last=DUI.step>=DUEL_PROMPTS.length;
  if(last){
    const repo=window.Cultured&&window.Cultured.repo;
    try{DUI.rec=await repo.duel.submit(DUI.id,'a',DUI.picks);toast(DUI.rec.verdict?'Both in — reveal opened':'Locked. Waiting on your friend.')}
    catch(e){toast('That duel has ended — start a fresh one');return}
  }
  paintDuel();
};
ACT['duel-back']=()=>{
  const prev=DUEL_PROMPTS[DUI.step-1];
  if(prev){delete DUI.picks[prev.id];DUI.step--}
  paintDuel();
};
ACT['duel-again']=async()=>{
  const repo=window.Cultured&&window.Cultured.repo;
  DUI.picks={};DUI.step=0;
  if(repo&&repo.duel){const rec=await repo.duel.create({displayName:S.prof.name});DUI.rec=rec;DUI.id=rec.id;if(DUI.unsub)DUI.unsub();DUI.unsub=repo.duel.watch(rec.id,r=>{if(r){DUI.rec=r;paintDuel()}});S.duelLink={id:rec.id,verdict:null};save()}
  paintDuel();haptic(8);
};
ACT['duel-copy']=async b=>{
  const link=duelLinkUrl(DUI.id);
  try{await navigator.clipboard.writeText(link)}catch(e){}
  toast('Link copied — the reveal waits for both sides');
};
ACT['duel-share']=async()=>{
  const link=duelLinkUrl(DUI.id);
  if(navigator.share){try{await navigator.share({title:'cultured — Meme Duel',text:'Same five prompts. Let’s see who gets my funny.',url:link});return}catch(e){}}
  try{await navigator.clipboard.writeText(link)}catch(e){}
  toast('Link copied — paste it anywhere');
};
ACT['duel-sharecard']=async()=>{
  if(!DUI.rec||!DUI.rec.verdict)return;
  /* An external share carries the watermark + CTA; the in-app preview never does. */
  try{
    const mod=await import('./duel/card');
    const ok=await mod.downloadDuelCard(DUI.rec,'story');
    if(ok)toast('Card saved — watermark included, since it leaves the app');
  }catch(e){toast('Download blocked here — copy the link instead')}
};
ACT['duel-savecard']=async()=>{
  if(!DUI.rec||!DUI.rec.verdict)return;
  try{const mod=await import('./duel/card');await mod.downloadDuelCard(DUI.rec,'square');toast('Square card saved')}catch(e){toast('Download blocked here')}
};
ACT['duel-send']=()=>{
  const v=DUI.rec&&DUI.rec.verdict;if(!v){toast('No verdict yet — the reveal opens after both submit');return}
  const id=Object.keys(S.threads||{})[0];
  if(!id){toast('Open a chat first, then send it there');return}
  ensureThread(id);
  S.threads[id].msgs.push({f:'me',t:`Meme Duel verdict: ${v.score}/${v.of} — ${v.line} (${duelLinkUrl(DUI.id)})`,ts:Date.now()});save();closeSheet();toast('Verdict sent');haptic(10);track('duel_completed',{score:v.score})
};
/* The thread chip: start (or resume) a duel with this person, ready to paste
   the link straight into the chat. */
ACT['duel-chip']=async b=>{
  try{await duelEnsure()}catch(e){toast('The duel adapter is offline in this build');return}
  openSheet(duelSheetHTML());paintDuel();haptic(8);track('duel_chip',{source:'thread'});
};
/* This re-renders from state that is already on the device. It fetches nothing,
   so it cannot claim new signals arrived — saying so would be the same lie the
   share sheet used to tell. The week badge is derived from the real date, so
   that genuinely can change. */
ACT['arena-refresh']=()=>{S.pulse.seen=(S.pulse.seen||0)+1;save();renderArena();toast('Up to date · nothing new since you last looked');haptic(8)};
ACT['arena-explore']=()=>{closeSheet();go('feed');setTimeout(()=>toast('Local signal opens at 25 people in one area'),260)};

/* ================= people + chat ================= */
let PV='chats';
function renderPeople(){
  /* The v5 People screen owns #s-people when its flag is on. main.ts mounts
     into the same host, so the tab rail and deep links keep working. */
  if(V5_PEOPLE)return;
  const items=Object.keys(S.threads).map(id=>({p:person(id),t:S.threads[id]})).filter(x=>x.p);
  const fresh=items.filter(x=>!x.t.msgs.length),chats=items.filter(x=>x.t.msgs.length).sort((a,b)=>b.t.msgs[b.t.msgs.length-1].ts-a.t.msgs[a.t.msgs.length-1].ts);
  const msgPreview=m=>m.kind==='track'?'Sent a song: '+TRACKS[m.ref].title:m.t;
  $('#s-people').innerHTML=`<div class="tint"><i class="aur a1"></i><i class="aur a2"></i><i class="aur a3"></i></div>
    <header class="topbar"><div class="wordmark">${RING_GLYPH}People</div><span></span></header>
    ${ftabsHTML('pv',[['chats','Chats']],PV)}
    <div class="sbody" id="pbody" style="padding-bottom:20px">
    ${!fresh.length&&!chats.length?`<div class="blk tight stg"><div class="empty-stk"><span aria-hidden="true">🫥</span><p class="hint">No conversations yet. A thread opens when you and someone both Resonate — cultured won’t write the first message for you.</p></div></div>`:''}
    ${fresh.length?`<div class="blk tight stg"><h2 style="padding-top:18px">New resonances</h2></div><div class="strip stg" style="--d:1">${fresh.map(x=>`<button class="nr" data-act="open-thread" data-id="${x.p.id}">${orb(x.p,64)}<span>${esc(x.p.name)}</span></button>`).join('')}</div>`:'<div style="height:12px"></div>'}<ul class="inbox">${chats.map((x,i)=>{const m=x.t.msgs[x.t.msgs.length-1];return `<li class="stg" style="--d:${i+1}"><button class="row-chat ${x.t.unread?'un':''}" data-act="open-thread" data-id="${x.p.id}">${orb(x.p,56)}<div class="tx"><div class="nm"><span>${esc(x.p.name)}</span><time>${ago(m.ts)}</time></div><div class="pv">${m.f==='me'?'You: ':''}${esc(msgPreview(m))}</div><div class="ctx">You both play ${esc(sharedTitles(x.p))}</div></div>${x.t.unread?`<span class="unread">${x.t.unread}</span>`:''}</button></li>`}).join('')}</ul></div>`;
  layoutTabs($('#s-people'));updateBadge();
  const t=chats[0]?poster(TRACKS.choir,true):poster(TRACKS.glass,true);setTint($('#s-people'),t);
}
FT.pv=v=>{PV=v;renderPeople();const el=$('#s-people');el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter');setTimeout(()=>el.classList.remove('enter'),1500)};
ACT['open-thread']=b=>openThread(b.dataset.id);
function openThread(id){
  const p=person(id),t=S.threads[id];if(!t)return;
  /* Threads are persisted; the people behind them are not (D-27). Lines 910 and
     944 pass an id straight out of S.threads, so `p` can be undefined even
     though the thread exists, and `orb(p)` / `p.name` would throw. Say so
     rather than opening a broken page. The thread stays on disk. */
  if(!p){toast('That match is no longer here');return}
  t.unread=0;save();updateBadge();
  const pg=openPage(`<div class="page-head"><button class="ibtn" data-act="back" aria-label="Back">${I.back}</button>${orb(p,42)}<div class="ph-t"><b>${esc(p.name)}</b><span>${calibrating()?'calibrating':p.score+'% resonance'}, ${p.km} km away</span></div>${FEATURE_ROOMS?`<button class="ibtn" data-act="to-room" data-id="moons" data-with="${id}" aria-label="${ROOM_OFFER_LABEL}">${I.headphones}</button>`:'<span style="width:42px"></span>'}</div>
    <div class="msgs" id="msgs"></div><div id="starters"></div>
    <div class="composer"><span id="repochip"></span><button class="send alt" data-act="song-pick" aria-label="Send a song">${I.note}</button><button class="send alt" data-act="meme-pick" aria-label="Send a meme">😂</button><input id="msg-in" placeholder="Say something about a song" maxlength="280" autocomplete="off" aria-label="Message"><button class="send" data-act="send" data-fx="send" aria-label="Send">${I.send}</button></div>`);
  pg.dataset.thread=id;pg.onclose=()=>{renderPeople()};
  setTint(pg,poster({id:'t'+id,style:STY[hash(id)%5],pal:p.pal},true));
  renderMsgs(id);
  $('#msg-in',pg).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ACT.send()}});
}
const TYPING={};
/* First lines built from shared evidence, never a canned "hey". */
function evidenceStarters(p){
  const out=[];
  if(p.shared[0])out.push(`Be honest about ${TRACKS[p.shared[0]].title}: bridge or verse?`);
  const topic=(p.humor||[]).findIndex(v=>v>=.8);
  if(topic>-1)out.push(`You both lean ${HUMOR[topic].toLowerCase()} — send the funniest thing you saved this week`);
  if(S.duelLink&&S.duelLink.verdict)out.push(`Your duel landed ${S.duelLink.verdict.score}/${S.duelLink.verdict.of}. Argue your best caption.`);
  out.push('Pick a song for waiting on a late bus');
  return out.slice(0,3);
}
function renderMsgs(id){
  const pg=$(`.page[data-thread="${id}"]`);if(!pg)return;
  const p=person(id),t=S.threads[id],box=$('#msgs',pg);
  /* Day chips group the history the way a real conversation reads. The chip
     only renders when the day actually changes, so old threads stay calm. */
  let lastDay='';
  const dayChip=ts=>{const d=new Date(ts).toDateString();if(d===lastDay)return '';lastDay=d;const today=new Date().toDateString();return `<div class="daychip">${d===today?'today':d}</div>`};
  const replyOf=m=>m.rep!=null&&t.msgs[m.rep]?`<span class="bub-rep">↩ ${esc((t.msgs[m.rep].t||'a meme').slice(0,60))}</span>`:'';
  const rxRow=m=>{
    if(!m.rx)return '';
    const parts=Object.entries(m.rx).filter(x=>x[1]).map(([e,n])=>`<button class="bub-rx on" data-act="bub-react" data-i="${t.msgs.indexOf(m)}" data-e="${e}" aria-label="${e} reaction">${e}<b>${n}</b></button>`);
    return parts.length?`<div class="bub-rxs">${parts.join('')}</div>`:'';
  };
  const bubAct=i=>`<span class="bub-tools"><button data-act="reply-to" data-i="${i}" aria-label="Reply to this message">↩</button></span>`;
  box.innerHTML=`<div class="ctxcard"><div class="top"><div class="ctx-fp">${pairFP(p,false)}</div><div><b>${calibrating()?'You two are still calibrating':'You and '+esc(p.name)+' resonate at '+p.score+'%'}</b><span class="t">You both play ${esc(sharedTitles(p))}.</span></div></div><div class="ctx-actions"><button class="cta sm" data-act="icebreaker" data-id="${id}">Give me an opener</button><button class="cta sm ghostb" data-act="duel-chip">${I.pair}Meme Duel</button>${FEATURE_ROOMS?`<button class="cta sm ghostb" data-act="to-room" data-id="${p.shared[0]}" data-with="${id}">${ROOM_OFFER_LABEL}</button>`:''}</div></div>`
    +t.msgs.map((m,i)=>dayChip(m.ts)+(m.kind==='meme'?memeBub(m,i):m.kind==='track'?`<div class="bub-t ${m.f}"><div class="cv">${poster(TRACKS[m.ref],true)}</div><div><b>${esc(TRACKS[m.ref].title)}</b><span>${esc(TRACKS[m.ref].artist)}</span></div>${m.readAt?`<span class="bub-read" aria-label="Read">✓</span>`:''}${bubAct(i)}</div>`:`<div class="bub ${m.f} ${S.repTo===i?'replying':''}" data-i="${i}">${replyOf(m)}${esc(m.t)}${m.readAt&&m.f==='me'?`<span class="bub-read" aria-label="Read">✓</span>`:''}${bubAct(i)}</div>`)+rxRow(m)).join('')+(TYPING[id]?'<div class="typing"><i></i><i></i><i></i></div>':'');
  $('#starters',pg).innerHTML=t.msgs.length<=1?`<div class="starters">${evidenceStarters(p).map(s=>`<button class="chip" data-act="starter" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>`:'';
  paintRepoChip(id);
  box.scrollTop=box.scrollHeight;
  /* double-tap a bubble for the emoji burst — the reaction is state, the
     burst is the flourish, both work with motion off */
  const lastTap={};
  box.ondblclick=e=>{
    const bub=e.target.closest('.bub,.bub-m,.bub-t');if(!bub)return;
    const idx=bub.dataset.i!==undefined?+bub.dataset.i:Array.from(box.querySelectorAll('.bub,.bub-m,.bub-t')).indexOf(bub);
    const m=t.msgs[idx];if(!m||idx<0)return;
    m.rx=m.rx||{};const k='🔥';m.rx[k]=(m.rx[k]||0)+1;save();
    microPublic.burst(bub,undefined,8);microPublic.pop(bub,1.04);haptic(10);
    renderMsgs(id);
  };
}
function paintRepoChip(id){
  const chip=$('#repochip');if(!chip)return;
  const t=S.threads[id]||{msgs:[]};
  if(S.repTo==null||!t.msgs[S.repTo]){chip.innerHTML='';chip.classList.remove('on');S.repTo=null;return}
  const src=t.msgs[S.repTo];
  chip.innerHTML=`<span class="repo-view">↩ ${(src.t||(src.kind==='meme'?'a meme':'a song')+'').slice(0,48)}<button data-act="reply-x" aria-label="Cancel reply">${I.x}</button></span>`;
  chip.classList.add('on');
}
ACT['reply-to']=b=>{S.repTo=+b.dataset.i;const id=threadId();renderMsgs(id);const inp=$('#msg-in');if(inp)inp.focus();haptic(5)};
ACT['reply-x']=()=>{S.repTo=null;renderMsgs(threadId())};
ACT['bub-react']=b=>{
  const id=threadId(),t=S.threads[id],m=t&&t.msgs[+b.dataset.i];if(!m)return;
  m.rx=m.rx||{};const e=b.dataset.e;m.rx[e]=m.rx[e]?0:(m.rx[e]||0)+1;
  if(!m.rx[e])delete m.rx[e];
  save();haptic(6);renderMsgs(id);
};
function memeBub(m,i){const x=mmOf(m.ref);if(!x)return '';const tools=i!==undefined?`<span class="bub-tools"><button data-act="reply-to" data-i="${i}" aria-label="Reply to this message">↩</button></span>`:'';return `<div class="bub-m ${m.f}" data-i="${i}" style="--bg:${x.bg||'#EFE9DA'};--fg:${x.fg||'#141413'}"><img src="${x.img}" alt="${esc(x.alt||x.t)}" loading="lazy" decoding="async">${tools}</div>`}
function reply(id){
  TYPING[id]=true;renderMsgs(id);const t=S.threads[id];
  setTimeout(()=>{
    TYPING[id]=false;t.msgs.push({f:'them',t:REPLIES[t.msgs.length%REPLIES.length],ts:Date.now()});
    /* the demo side "reads": mark my latest message read so the tick draws */
    const mine=[...t.msgs].reverse().find(x=>x.f==='me'&&!x.readAt);if(mine)mine.readAt=Date.now();
    if(!$(`.page[data-thread="${id}"]`)){t.unread=(t.unread||0)+1;updateBadge()}
    save();renderMsgs(id);
  },1500);
}
function sendMsg(id,text){
  text=text.trim();if(!text)return;const t=S.threads[id];
  const m={f:'me',t:text,ts:Date.now(),readAt:null};
  if(S.repTo!=null&&t.msgs[S.repTo])m.rep=S.repTo;
  t.msgs.push(m);S.repTo=null;save();haptic(6);
  /* the sent bubble rises from the composer (CSS), the read tick draws
     itself when the other side comes back */
  const box=$('#msgs');if(box)box.scrollTop=box.scrollHeight;
  reply(id);
}
const threadId=()=>{const pg=$('.page[data-thread]:not([data-closing])');return pg&&pg.dataset.thread};
ACT.send=()=>{const id=threadId();if(!id)return;const inp=$('#msg-in');const v=inp.value;inp.value='';sendMsg(id,v)};
ACT.starter=b=>{const id=threadId();if(id)sendMsg(id,b.dataset.s)};
ACT.icebreaker=b=>{
  const p=person(b.dataset.id);if(!p)return;
  const prompts=[`What makes ${TRACKS[p.shared[0]]?TRACKS[p.shared[0]].title:'the song you two share'} worth five replays for you?`,`What is the most unhinged thing in your “one more listen” queue?`,`Be honest: what’s your most defensible bad taste?`,`What song are you only into because someone you liked said it was cool?`,`Which of your playlists would genuinely embarrass you in the group chat?`,`What’s the pettiest reason you’ve ever liked a song?`,`Rank your top three ceiling-staring songs, go.`,`What concert behavior do you refuse to apologize for?`,`What meme honestly sums up your taste, no context?`,`Which artist would you leave the fandom for, just out of spite?`,`What’s the correct snack to pair with a full-album listen?`];
  const prompt=prompts[hash(p.id+S.prof.name)%prompts.length];
  openSheet(`<span class="chipg">Icebreaker Roulette</span><h3 class="sh-t" style="margin-top:14px">Start with something real.</h3><div class="ice-card"><span>${I.chat}</span><p>${esc(prompt)}</p></div><button class="cta" data-act="ice-send" data-s="${esc(prompt)}">Use this opener</button><button class="cta ghostb" data-act="ice-again" data-id="${p.id}">Try another</button>`);
};
ACT['ice-send']=b=>{const id=threadId();if(id){sendMsg(id,b.dataset.s);closeSheet()}};
ACT['ice-again']=b=>ACT.icebreaker(b);
ACT['song-pick']=()=>{
  openSheet(`<h3 class="sh-t">Send a song</h3>${Object.values(TRACKS).map(t=>`<button class="trk" data-act="song-send" data-id="${t.id}"><div class="tile">${poster(t,true)}</div><div><b>${esc(t.title)}</b><span>${esc(t.artist)}</span></div></button>`).join('')}`);
};
ACT['song-send']=b=>{const id=threadId();if(!id)return;S.threads[id].msgs.push({f:'me',kind:'track',ref:b.dataset.id,ts:Date.now()});save();closeSheet();haptic(8);reply(id)};

/* ================= listening room (the "seat map") ================= */
const SEATROWS=[8,'s','s','s','s',0,'s','s'];
function openRoom(o){
  const t=TRACKS[o.trackId]||TRACKS.moons;
  const friends=PEOPLE.filter(p=>p.matched||S.matchedIds.indexOf(p.id)>-1);
  /* A room needs somebody to listen with. With the invented population gated
     off this array is legitimately empty, and `friends[0].id` used to throw
     before the page opened. Ask instead of crashing. */
  const withWho=(o.withId&&person(o.withId))?o.withId:(friends[0]&&friends[0].id);
  if(!withWho){toast('Nobody to listen with yet — match with someone first.');haptic(6);return}
  const R=ROOM={t:t,w:withWho,friends:friends.map(f=>f.id),n:2,slot:'Now',day:0,room:0,sel:[],live:{},iv:null};
  const pg=openPage(`<div class="rm-top"><button class="ibtn" data-act="back" aria-label="Back">${I.back}</button><div class="rm-t"><b>${esc(t.title)}</b><button data-act="room-who" aria-label="Change who you listen with"><span id="rWith"></span>${I.chevd}</button></div><span style="width:42px"></span></div>
    <div class="page-body" style="padding-bottom:110px">
    <div class="rm-pills stg"><button class="rpill" data-act="room-day" aria-label="Change day"><span id="rDay">Today</span>${I.chevd}</button><div class="rpill sel2"><button class="stp" data-act="seats-dec" aria-label="Fewer seats">${I.minus}</button><span id="rN">2 Seats</span><button class="stp" data-act="seats-inc" aria-label="More seats">${I.plus}</button></div></div>
    <div class="rm-loc stg" style="--d:1"><button data-act="room-name" aria-label="Change room">${I.pin}<div><b id="rName"></b><span id="rLive"></span></div>${I.chevd}</button></div>
    <div class="rscreen stg" style="--d:2;--glow:${t.pal[1]}88"><div>${poster(t,true)}</div></div>
    <div class="seats stg" style="--d:3" id="seats"></div>
    <div class="rm-slots stg" style="--d:4"><h4>Select slot</h4><div class="slots" id="slots"></div></div>
    </div>
    <div class="cta-dock"><button class="split" id="rGo" data-act="room-go"><b></b><span></span></button></div>`);
  pg.dataset.room='1';setTint(pg,poster(t,true));
  pg.onclose=()=>{clearInterval(R.iv);ROOM=null};
  roomSeed();drawRoom();
  R.iv=setInterval(()=>{const live=$$('#seats .seat.live');if(!live.length)return;const s=live[Math.floor(Math.random()*live.length)];const e=document.createElement('i');e.className='pop';e.textContent=EMO[Math.floor(Math.random()*EMO.length)];s.appendChild(e);setTimeout(()=>e.remove(),1900)},1500);
  haptic(8);
}
function roomSeed(){
  const R=ROOM,r=rng(hash(R.t.id)+R.room*77+R.day*13),names=['Kai','Ines','Dev','Mara','Jo','Theo','Priya','Sol','Nina','Omar'];R.live={};
  let k=0;while(Object.keys(R.live).length<(R.day?4:10)&&k++<200){const row=1+Math.floor(r()*7),col=Math.floor(r()*8);if(SEATROWS[row]===0)continue;R.live[row+'-'+col]=names[Math.floor(r()*names.length)]}
  R.sel=[];
  for(let c=0;c<7&&R.sel.length<R.n;c++){const a=3+'-'+c,b=3+'-'+(c+1);if(!R.live[a]&&!R.live[b]&&c!==3){R.sel=[a,b].slice(0,R.n);break}}
}
const SLOTS=[['Now','8:30 PM','10:00 PM','11:30 PM'],['9:00 AM','12:30 PM','6:00 PM','9:30 PM']];
function drawRoom(){
  const R=ROOM;if(!R)return;
  const rows=SEATROWS.map((cfg,row)=>{
    if(cfg===0)return '<div class="srow gap"></div>';
    const cols=[];for(let c=0;c<8;c++){
      const id=row+'-'+c,st=R.sel.indexOf(id)>-1?'mine':R.live[id]?'live':'';
      if(row>0&&c===4)cols.push('<span class="aisle"></span>');
      cols.push(`<button class="seat ${st}" style="--dl:${(c*.3+row*.2).toFixed(1)}s" data-act="seat" data-id="${id}" aria-label="Seat ${row+1}-${c+1}${R.live[id]?', '+R.live[id]+' is listening':st==='mine'?', yours':''}">${SEAT}</button>`);
    }
    return `<div class="srow">${cols.join('')}</div>`;
  });
  $('#seats').innerHTML=rows.join('');
  $('#rWith').textContent='with '+person(R.w).name;$('#rDay').textContent=R.day?'Tomorrow':'Today';
  $('#rN').textContent=R.n+(R.n===1?' Seat':' Seats');$('#rName').textContent=ROOMS[R.room];$('#rLive').textContent=Object.keys(R.live).length+' listening now';
  const sl=SLOTS[R.day];if(sl.indexOf(R.slot)<0)R.slot=sl[0];
  $('#slots').innerHTML=sl.map(s=>`<button class="slot ${s===R.slot?'on':''}" data-act="slot" data-s="${s}">${s}</button>`).join('');
  paintGo();
}
function paintGo(){
  const R=ROOM,btn=$('#rGo'),ok=R.sel.length===R.n,now=R.slot==='Now';
  $('b',btn).textContent=ok?(now?'Start listening':'Send invite'):'Pick '+R.n+(R.n===1?' seat':' seats');
  $('span',btn).textContent=now?'15 min':R.slot;btn.disabled=!ok;
}
ACT.seat=b=>{
  const R=ROOM,id=b.dataset.id;
  if(R.live[id]){toast(R.live[id]+' is already here');haptic(6);return}
  const i=R.sel.indexOf(id);
  if(i>-1)R.sel.splice(i,1);else{R.sel.push(id);if(R.sel.length>R.n)R.sel.shift()}
  haptic(8);$$('#seats .seat').forEach(s=>s.classList.toggle('mine',R.sel.indexOf(s.dataset.id)>-1));paintGo();
};
ACT['seats-inc']=()=>{const R=ROOM;if(R.n<4){R.n++;haptic(6);$('#rN').textContent=R.n+' Seats';paintGo()}};
ACT['seats-dec']=()=>{const R=ROOM;if(R.n>1){R.n--;while(R.sel.length>R.n)R.sel.shift();haptic(6);drawRoom()}};
ACT['room-day']=()=>{const R=ROOM;R.day=R.day?0:1;R.slot=SLOTS[R.day][0];roomSeed();drawRoom();haptic(6)};
ACT['room-name']=()=>{const R=ROOM;R.room=(R.room+1)%ROOMS.length;roomSeed();drawRoom();haptic(6)};
ACT['room-who']=()=>{const R=ROOM,i=R.friends.indexOf(R.w);R.w=R.friends[(i+1)%R.friends.length];$('#rWith').textContent='with '+person(R.w).name;haptic(6)};
ACT.slot=b=>{ROOM.slot=b.dataset.s;$$('#slots .slot').forEach(s=>s.classList.toggle('on',s===b));paintGo();haptic(5)};
ACT['room-go']=()=>{
  const R=ROOM;if(!R||R.sel.length!==R.n)return;
  const w=R.w,t=R.t,now=R.slot==='Now',slot=R.slot,day=R.day;
  if(now){closePage();setTimeout(()=>openSession(w,t,R.n),520)}
  else{
    ensureThread(w);S.threads[w].msgs.push({f:'me',t:`Listening invite: ${t.title}, ${day?'tomorrow ':''}${slot}`,ts:Date.now()});save();closePage();toast(`Invite sent to ${person(w).name} for ${slot}`);haptic([10,30,10]);reply(w);
  }
};

/* ================= co-listening session ================= */
function openSession(id,track,seats){
  const p=person(id),others=Object.values(TRACKS).filter(x=>x.id!==track.id);
  const Q=[track,others[0],others[1]];
  const L=SES={id:id,p:p,Q:Q,remaining:900,i:0,pos:38,playing:true,moments:[],played:1,done:false,iv:null,guests:Math.max(0,(seats||2)-2)};
  const extras=['kai','dev','ines'].filter(x=>x!==id).slice(0,L.guests);
  const pg=openPage(`<div class="page-head"><button class="ibtn" data-act="back" aria-label="Leave session">${I.back}</button><div class="ph-t"><b>Listening with ${esc(p.name)}</b><span>Shared 15-minute session</span></div></div>
    <div class="page-body ses" id="ses"><div class="ses-fx" id="sfx"></div>
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.6"/><circle id="sArc" cx="50" cy="50" r="47" fill="none" stroke="url(#grad)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="295.3" stroke-dashoffset="0"/></svg><div class="cover" id="sCover"></div></div>
      <div class="guests"><span class="orb" style="--s:32px;background:#EFE9DA">You</span>${orb(p,32)}${extras.map(x=>orb(person(x),32)).join('')}<span>${2+L.guests} listening</span></div>
      <div class="clock"><b id="sTime">15:00</b><span>left in this session</span></div>
      <div class="np"><h3 id="sTitle"></h3><p id="sArtist"></p></div>
      <div class="tl-wrap"><div class="mks" id="mks"></div><div class="tl" id="tl">${Array.from({length:56},(_,k)=>`<i style="height:${Math.round(10+Math.abs(Math.sin(k*1.3)*.6+Math.sin(k*.37+1)*.4)*44)}px"></i>`).join('')}</div><div class="tl-t"><span id="sPos">0:00</span><span id="sLen">0:00</span></div></div>
      <div class="emo" role="group" aria-label="Pin a moment">${EMO.map(e=>`<button data-act="moment" data-e="${e}" aria-label="Pin ${e}">${e}</button>`).join('')}</div>
      <div class="mom" id="sMom"></div>
      <div class="ses-ctl"><button class="cbtn" data-act="s-play" id="sPlay" aria-label="Pause">${I.pause}</button><button class="end-btn" data-act="s-end">End session</button></div>
    </div>`);
  pg.dataset.ses='1';
  pg.onclose=()=>{clearInterval(L.iv);L.done=true;SES=null;const t=$(`.page[data-thread="${id}"]`);if(t)renderMsgs(id)};
  sesTrack();sesPaint();sesMoments();
  L.iv=setInterval(sesTick,1000);haptic([10,30,10]);
}
function sesTrack(){
  const L=SES;if(!L)return;const t=L.Q[L.i],pg=$('.page[data-ses]');
  $('#sCover').innerHTML=poster(t,true);$('#sTitle').textContent=t.title;$('#sArtist').textContent=t.artist;$('#sLen').textContent=fmt(t.len);
  setTint(pg,poster(t,true));sesMarkers();
}
function sesPaint(){
  const L=SES;if(!L)return;const t=L.Q[L.i];
  $('#sTime').textContent=fmt(Math.max(0,L.remaining));
  $('#sArc').setAttribute('stroke-dashoffset',(295.3*(1-L.remaining/900)).toFixed(1));
  $('#sPos').textContent=fmt(L.pos);
  const k=Math.floor(L.pos/t.len*56);$$('#tl i').forEach((b,i)=>b.classList.toggle('p',i<k));
}
function sesMarkers(){
  const L=SES;if(!L)return;const t=L.Q[L.i];
  $('#mks').innerHTML=L.moments.filter(m=>m.i===L.i).map(m=>{const c=m.fresh?'mk new':'mk';m.fresh=false;return `<span class="${c}" style="left:${(m.pos/t.len*100).toFixed(1)}%">${m.e}</span>`}).join('');
}
function sesMoments(){
  const L=SES;if(!L)return;
  $('#sMom').innerHTML=L.moments.length?L.moments.slice(-5).reverse().map(m=>`<span class="mc"><b>${fmt(m.pos)}</b>${m.e} ${m.by==='me'?'You':esc(L.p.name)}</span>`).join(''):'Tap an emoji to pin a moment to the song.';
}
function floatEmoji(e,fromBtn){
  const fx=$('#sfx');if(!fx||S.set.calm)return;
  const el=document.createElement('span');el.className='fe';el.textContent=e;
  const x=fromBtn?(fromBtn.getBoundingClientRect().left-fx.getBoundingClientRect().left+14):(30+Math.random()*(fx.offsetWidth-90));
  el.style.left=x+'px';fx.appendChild(el);
  const dr=(Math.random()-.5)*80;
  el.animate([{transform:'translate(0,0) scale(.5)',opacity:0},{transform:`translate(${dr*.4}px,-90px) scale(1.2)`,opacity:1,offset:.25},{transform:`translate(${dr}px,-380px) scale(1)`,opacity:0}],{duration:2200,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>el.remove();
}
function addMoment(e,by,btn){
  const L=SES;if(!L||L.done)return;L.moments.push({e:e,pos:L.pos,i:L.i,by:by,fresh:true});sesMarkers();sesMoments();floatEmoji(e,by==='me'?btn:null);if(by==='me')haptic(10);
}
function sesTick(){
  const L=SES;if(!L||L.done)return;
  L.remaining--;
  if(L.playing){
    L.pos++;const t=L.Q[L.i];
    if(L.pos>=t.len){L.i=(L.i+1)%L.Q.length;L.pos=0;L.played++;sesTrack()}
    else if(Math.random()<.15)addMoment(EMO[Math.floor(Math.random()*EMO.length)],'them');
  }
  sesPaint();if(L.remaining<=0)sesEnd();
}
ACT.moment=b=>addMoment(b.dataset.e,'me',b);
ACT['s-play']=b=>{const L=SES;if(!L)return;L.playing=!L.playing;b.innerHTML=L.playing?I.pause:I.play;b.setAttribute('aria-label',L.playing?'Pause':'Play');$('#ses').classList.toggle('paused',!L.playing);haptic(6)};
function sesEnd(){
  const L=SES;if(!L||L.done)return;L.done=true;clearInterval(L.iv);
  const pg=$('.page[data-ses]');const o=document.createElement('div');o.className='ses-end';
  o.innerHTML=`<div class="ok">${I.check}</div><h2>That’s your 15 minutes</h2><p>The session is over. Your chat with ${esc(L.p.name)} is still open.</p><div class="recap"><div><b>${L.moments.length}</b><span>moments pinned</span></div><div><b>${L.played}</b><span>${L.played===1?'song':'songs'} played</span></div></div><button class="cta" data-act="s-recap">Share moments in chat</button><button class="cta ghostb" data-act="back">Back to chat</button>`;
  pg.appendChild(o);haptic([20,60,20]);
}
ACT['s-end']=sesEnd;
ACT['s-recap']=()=>{
  const L=SES;if(!L)return;const id=L.id;ensureThread(id);
  const txt=L.moments.length?`We listened together for 15 minutes. Moments: ${L.moments.map(m=>m.e+' '+fmt(m.pos)).join(', ')}`:'We listened together for 15 minutes.';
  S.threads[id].msgs.push({f:'me',t:txt,ts:Date.now()});save();closePage();
};

/* ================= you (Cultural Fingerprint) ================= */
function renderYou(){
  /* The v5 profile owns #s-you when its flag is on (it is, by default). main.ts
     mounts it into the host, same seam as Matrix/People/Arena. */
  if(V5_PROFILE)return;
  const pr=S.prof,mine=fpParams(mineSeed());
  const P=youPal(),bgS=pr.bg||'rings';
  /* v5: both numbers come from the store, so a save made on a corpus meme in
     "Today's memes" lands here too. The old filter dropped everything that was
     not one of the 10 hard-coded POSTS ids — that was the "0" bug. */
  const saved=v5SavedKeys(V5.getState()).map(v5Resolve).filter(Boolean);
  const laughs=v5LaughsGiven(V5.getState());
  $('#s-you').innerHTML=`<div class="tint you-tint">${mediaLayer('profileHeader','profile-media')}<div class="tl on" style="background:radial-gradient(70% 60% at 80% 0,${rgba('#EFE9DA',.24)},transparent 70%),radial-gradient(60% 50% at 0 0,${rgba(P[1],.22)},transparent 70%)"></div></div>
    <header class="topbar"><div class="wordmark">${RING_GLYPH}You</div><div class="hr"><button class="ibtn" data-act="share-fp" aria-label="Share your Fingerprint">${I.share}</button><button class="ibtn" data-act="open-settings" aria-label="Settings and activity">${I.gear}</button></div></header>
    <section class="you-hero${bgS==='quiet'?' no-bleed':''}${bgS==='poster'?' has-art':''}">${bgS==='poster'?`<div class="you-artbg" aria-hidden="true">${posterSVG('bloom',P,1307)}</div>`:''}<button class="fp-bleed" id="fpb" data-act="fp-story" aria-label="Open your Fingerprint story" title="Open the story">${fpSVG(mine,'#EFE9DA',P[1],{n:18,w:1.4})}<span class="fp-story-hint">the story ${I.chevr}</span></button>
      <div class="you-id stg"><div class="you-av">${pr.pfp?`<img src="${pr.pfp}" alt="Your profile photo">`:orb({name:pr.name,pal:P.slice(1)},64)}<button class="av-cam" data-act="pfp-pick" data-fx="chip" aria-label="${pr.pfp?'Change your profile photo':'Add a profile photo'}">${I.plus}</button></div>
        <div class="you-meta"><input class="ghost nm" id="pf-name" value="${esc(pr.name)}" maxlength="24" aria-label="Your name" autocomplete="off"><textarea class="ghost bio" id="pf-bio" rows="2" maxlength="90" aria-label="Your bio">${esc(pr.bio)}</textarea>
        <div class="you-chips">${pr.humor.slice(0,3).map(h=>`<span class="chipg">${esc(h)}</span>`).join('')}</div></div></div></section>
    <div class="stats stg" style="--d:1"><div><b>${Object.keys(S.threads).length}</b><span>Resonances</span></div><div><b>${saved.length}</b><span>Saved</span></div><div><b>${laughs}</b><span>Laughs given</span></div></div>
    <div class="stage2">
    <div class="blk stg" style="--d:2"><h2>Look and feel<small>Changes your wash, not your worth</small></h2>
      <div class="tint-row" role="radiogroup" aria-label="Profile tint">${PROF_TINTS.map(t=>{const TP=(TRACKS[t[0]]||{}).pal||TRACKS.moons.pal;return `<button class="tint-o ${pr.tint===t[0]?'on':''}" role="radio" aria-checked="${pr.tint===t[0]}" data-act="prof-tint" data-fx="chip" data-k="${t[0]}"><i style="background:linear-gradient(150deg,${TP[0]},${TP[1]} 46%,${TP[2]})"></i><span>${t[1]}</span></button>`}).join('')}</div>
      <div class="row"><div class="tx"><b>Profile photo</b><span>Stays on this device. Square crops best.</span></div><span style="display:flex;gap:8px">${pr.pfp?`<button class="chip" data-act="pfp-remove">Remove</button>`:''}<button class="chip on" data-act="pfp-pick">${pr.pfp?'Replace':'Choose'}</button></span></div>
      <div class="row"><div class="tx"><b>On the wall</b><span>The art behind your name. Pick a mood.</span></div><span class="look-row">${[['rings','Rings'],['poster','Poster'],['quiet','Quiet']].map(o=>`<button class="look-o ${bgS===o[0]?'on':''}" data-act="prof-bg" data-fx="chip" data-k="${o[0]}" aria-pressed="${bgS===o[0]}">${o[1]}</button>`).join('')}</span></div>
    </div>
    <div class="blk stg" style="--d:2"><h2>Who sees your Fingerprint</h2><div style="margin-top:12px">${segHTML('vis',[['all','Everyone'],['matches','Matches'],['me','Only me']],pr.vis)}</div></div>
    <div class="blk stg" style="--d:3"><h2>Humor signals</h2><div class="chips" style="margin-top:12px" id="hum">${pr.humorOpts.map(h=>`<button class="chip ${pr.humor.indexOf(h)>-1?'on':''}" data-act="hum" data-fx="chip" data-h="${esc(h)}" aria-pressed="${pr.humor.indexOf(h)>-1}">${esc(h)}</button>`).join('')}<input class="chipin" id="hum-add" placeholder="Add your own" maxlength="16" aria-label="Add a humor signal"></div></div>
    <div class="blk stg" style="--d:4"><h2>Artists</h2><div class="hs" id="arts" style="margin-top:14px">${pr.artists.map(a=>`<div class="art-i"><div class="c">${coverFrom(a)}</div><button class="rm" data-act="rm-art" data-a="${esc(a)}" aria-label="Remove ${esc(a)}">${I.x}</button><p>${esc(a)}</p></div>`).join('')}<button class="art-i art-add" data-act="add-art" aria-label="Add an artist"><div class="c">${I.plus}</div><p>Add</p></button></div></div>
    ${mmShelf()}<div class="blk stg" style="--d:6"><h2>Playlists</h2><div style="margin-top:8px">${[['Weather for tomorrow',24],['Bus window, 5:40pm',31],['Songs I defend at parties',17]].map(x=>`<div class="pl"><div class="mos">${[0,1,2,3].map(k=>`<div>${coverFrom(x[0]+k)}</div>`).join('')}</div><div><b>${x[0]}</b><span>${x[1]} songs</span></div></div>`).join('')}</div></div>
    <div class="blk"><h2>Saved culture<small>${saved.length?saved.length+' saved':''}</small></h2>${V5_VAULT?`<button class="cta ghostb" data-act="open-vault" style="margin-bottom:10px">Open the Vault</button>`:''}${saved.length?`<div class="grid3">${saved.map(id=>`<button class="gt" data-act="saved-open" data-id="${id}" aria-label="Open saved item"><div class="art-wrap">${artOf(POSTS[id])}</div></button>`).join('')}</div>`:'<p class="empty">Nothing saved yet. Tap the bookmark on any drop and it lands here.</p>'}</div>
    <div class="blk"><h2>Prompts</h2>${pr.prompts.map((q,i)=>`<div class="pq"><span>${esc(q.q)}</span><textarea class="ghost" data-pq="${i}" rows="3" maxlength="120" aria-label="${esc(q.q)}">${esc(q.a)}</textarea></div>`).join('')}</div>
    <div class="blk"><h2>Photos<small>Stay on this device</small></h2><div class="grid3" id="photos"></div></div>
    </div>`;
  drawPhotos();shelfWire();
  const sc=$('#s-you');sc.style.setProperty('--acc',P[1]||'#ff8a5b');sc.onscroll=()=>{const f=$('#fpb');if(f)f.style.translate=`0 ${sc.scrollTop*.25}px`};
}
function updateFP(){const b=$('#fpb');if(b){b.innerHTML=fpSVG(fpParams(mineSeed()),'#EFE9DA',(youPal()||[])[1]||'#ff8a5b',{n:18,w:1.4});b.classList.remove('fx-pulse');void b.offsetWidth;b.classList.add('fx-pulse');setTimeout(()=>b.classList.remove('fx-pulse'),900)}fpDirty=true}
function drawPhotos(){
  const g=$('#photos');if(!g)return;
  g.innerHTML=S.prof.photos.map((src,i)=>`<div class="gt"><img src="${src}" alt="Your photo ${i+1}"><button class="rm" data-act="rm-photo" data-i="${i}" aria-label="Remove photo">${I.x}</button></div>`).join('')+(S.prof.photos.length<9?`<button class="gt add" data-act="add-photo" aria-label="Choose photos from your library">${I.plus}</button>`:'');
}
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='pf-name'){S.prof.name=t.value;save()}
  else if(t.id==='pf-bio'){S.prof.bio=t.value;save()}
  else if(t.dataset&&t.dataset.pq!==undefined){S.prof.prompts[+t.dataset.pq].a=t.value;save()}
  else if(t.id==='radius'){S.set.radius=+t.value;t.style.setProperty('--p',((t.value-1)/99*100)+'%');$('#radv').textContent=t.value+' km';save();fpDirty=true;if($('#deck'))renderDeck()}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches&&t.matches('select[data-k]')){S.set[t.dataset.k]=t.value;save()}
  if(t.id==='photoIn')addPhotos(t.files);
});
document.addEventListener('keydown',e=>{
  if(e.target.id==='hum-add'&&e.key==='Enter'){
    const v=e.target.value.trim();if(!v)return;
    if(S.prof.humorOpts.indexOf(v)<0)S.prof.humorOpts.push(v);if(S.prof.humor.indexOf(v)<0)S.prof.humor.push(v);
    save();updateFP();renderYou();
  }
  if(e.key==='Escape'){if($('#sheetwrap').classList.contains('open'))closeSheet();else closePage()}
});
ACT['prof-tint']=b=>{S.prof.tint=b.dataset.k;save();renderYou();haptic(6)};
ACT['prof-bg']=b=>{S.prof.bg=b.dataset.k;save();renderYou();haptic(6)};
ACT['pfp-remove']=()=>{S.prof.pfp='';save();renderYou();toast('Profile photo removed from this device');haptic(6)};
ACT['pfp-pick']=()=>{
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.style.cssText='position:fixed;left:-9999px';
  inp.addEventListener('change',()=>{if(inp.files&&inp.files[0])readPfp(inp.files[0]);setTimeout(()=>inp.remove(),400)});
  document.body.appendChild(inp);inp.click();
};
/* the photo never leaves the device: the resize happens in canvas here, and
   the dataURL lands next to the rest of the profile under the same keys. */
function readPfp(file){
  if(!/^image\//.test(file.type)){toast('That file is not an image');return}
  const fr=new FileReader();
  fr.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const k=Math.min(1,240/Math.max(img.width,img.height,1));
      const c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      const x=c.getContext('2d');if(!x){toast('That image could not be read');return}
      x.drawImage(img,0,0,c.width,c.height);
      S.prof.pfp=c.toDataURL('image/jpeg',.85);
      save();renderYou();haptic(8);toast('Profile photo updated — it stays on this device');
    };
    img.onerror=()=>toast('That file is not an image');
    img.src=fr.result;
  };
  fr.onerror=()=>toast('That file could not be read');
  fr.readAsDataURL(file);
}
ACT.hum=b=>{
  const h=b.dataset.h,i=S.prof.humor.indexOf(h);if(i>-1)S.prof.humor.splice(i,1);else S.prof.humor.push(h);
  b.classList.toggle('on',i<0);b.setAttribute('aria-pressed',i<0);save();updateFP();haptic(6);
};
ACT['rm-art']=b=>{S.prof.artists=S.prof.artists.filter(a=>a!==b.dataset.a);save();updateFP();renderYou()};
ACT['add-art']=()=>{
  const free=ARTIST_SUGG.filter(a=>S.prof.artists.indexOf(a)<0);
  openSheet(`<h3 class="sh-t">Add an artist</h3><div class="chips">${free.map(a=>`<button class="chip" data-act="pick-art" data-a="${esc(a)}">${esc(a)}</button>`).join('')||'<p class="hint">You’ve added everyone on the list.</p>'}</div>`);
};
ACT['pick-art']=b=>{S.prof.artists.push(b.dataset.a);save();closeSheet();updateFP();renderYou();toast('Added to your Fingerprint')};
ACT['add-photo']=()=>$('#photoIn').click();
function addPhotos(files){
  const list=[...files].slice(0,9-S.prof.photos.length);
  list.forEach(f=>{
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const m=720,s=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        S.prof.photos.push(c.toDataURL('image/jpeg',.82));save();drawPhotos();
      };
      img.src=fr.result;
    };
    fr.readAsDataURL(f);
  });
  $('#photoIn').value='';
}
ACT['rm-photo']=b=>{S.prof.photos.splice(+b.dataset.i,1);save();drawPhotos()};
ACT['saved-open']=b=>{
  const id=b.dataset.id,p=POSTS[id],r=refOf(p);
  openSheet(`<div class="shp"><div class="tile">${artOf(p)}</div><div><b>${esc(labelOf(p))}</b><span>${p.kind==='music'?esc(r.artist):'A cultured meme'}</span></div></div><button class="cta" data-act="open-saved" data-id="${id}">Open</button><button class="cta ghostb" data-act="unsave" data-id="${id}">Remove from saved</button>`);
};
ACT['open-vault']=()=>{void openV5Vault()};
ACT['open-saved']=b=>{closeSheet();setTimeout(()=>openDetail(b.dataset.id,null),300);trackEvent('view','meme',b.dataset.id)};
ACT.unsave=b=>{const id=b.dataset.id;rs(id).s=0;V5.setSaved(kindOf(id),id,false);save();syncPost(id);closeSheet();renderYou();toast('Let go.')};
function trackView(id,type){const p=POSTS[id];if(!p)return;trackEvent('view',type||(p.kind==='music'?'track':'meme'),id,{label:p.kind==='music'?TRACKS[p.ref].title:p.text.split('\n')[0]})};
ACT['mm-open']=b=>{trackView(b.dataset.id);openDetail(b.dataset.id,b)};
SEG.vis=v=>{S.prof.vis=v;save();toast({all:'Everyone can see your Fingerprint',matches:'Only matches can see it',me:'Your Fingerprint is private'}[v])};
ACT['share-fp']=()=>{
  const saved=Object.keys(mmS().s).filter(k=>mmS().s[k]).map(k=>mmOf(k)).filter(Boolean).slice(0,3);
  const artists=S.prof.artists.slice(0,3);
  openSheet(`<h3 class="sh-t">Share your Fingerprint</h3>
    <div class="taste-card"><div class="tc-top"><span>my cultural fingerprint</span><b>${esc(S.prof.name)}</b></div><div class="tc-fp">${fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:14,w:1.4})}</div><div class="tc-score"><b>${Math.round((S.prof.humor.reduce((a,h)=>a+(HUMOR.indexOf(h)>-1?.18:.12),0)+76))}%</b><span>Fingerprint clarity</span></div><div class="tc-grid"><div><small>leans</small><strong>${esc(S.prof.humor.slice(0,2).join(' · '))}</strong></div><div><small>on repeat</small><strong>${artists.map(esc).join(' · ')}</strong></div></div>${saved.length?`<div class="tc-memes">${saved.map(m=>`<span style="--bg:${m.bg};--fg:${m.fg}">${m.e}</span>`).join('')}</div>`:''}<footer>cultured · find who else relates</footer></div>
    <p class="hint" style="margin:12px 0 16px">A live preview built from your current signals. Photos and location stay private.</p>
    <div class="share-row">${[['copy','Copy link',I.link],['msg','Messages',I.chat],['story','Your story',I.you],['more','More',I.dots]].map(o=>`<button data-act="sharego" data-fx="sharego" data-w="${o[0]}" data-t="${esc(S.prof.name)}’s Fingerprint"><i>${o[2]}</i>${o[1]}</button>`).join('')}</div>`);
};

/* ================= settings + activity ================= */
function openSettings(tab){
  const pg=openPage(`<div class="page-head"><button class="ibtn" data-act="back" aria-label="Back">${I.back}</button><h1 class="title sm">Settings and activity</h1></div>
    <div class="page-seg">${segHTML('stab',[['set','Settings'],['act','Activity']],tab||'set')}</div><div class="page-body" id="setBody"></div>`);
  pg.dataset.settings='1';pg.onclose=()=>{renderYou();if($('#deck')){fpDirty=true;renderDeck()}};
  setTint(pg,poster({id:'set',style:'wave',pal:['#161513','#EFE9DA','#8e8b83','#3a3935']},true));
  drawSet(tab||'set');
}
ACT['open-settings']=()=>{if(!$('.page[data-settings]:not([data-closing])'))openSettings('set')};
SEG.stab=v=>drawSet(v);
const hrs=Array.from({length:24},(_,i)=>String(i).padStart(2,'0')+':00');
function drawSet(tab){
  const body=$('#setBody');if(!body)return;const s=S.set;
  if(tab==='act'){
    const items=ACTIVITY.filter(a=>S.dismissed.indexOf(a.id)<0&&(s.activity==='all'||(s.activity==='matches'&&a.type==='match')));
    body.innerHTML=`<div class="blk" style="margin-top:6px"><h2>Show activity from</h2><div style="margin-top:12px">${segHTML('activity',[['all','Everyone'],['matches','Matches'],['off','Paused']],s.activity)}</div></div>
      ${s.activity==='off'?'<p class="empty" style="margin:18px 20px 0">Activity is paused. Switch it back on whenever you’re ready.</p>':items.length?`<div class="group">${items.map(a=>`<div class="act-i" data-id="${a.id}"><span class="act-dot">${a.type==='match'?I.pair:I.note}</span><div class="tx">${esc(a.t)}<time>${a.ago} ago</time></div><button class="ibtn" data-act="act-dismiss" data-id="${a.id}" aria-label="Dismiss">${I.x}</button></div>`).join('')}</div>`:`<p class="empty" style="margin:18px 20px 0">You’re caught up. New activity from your circles shows up here.</p><div style="padding:14px 20px 0"><button class="cta sm ghostb" data-act="act-restore">Bring the demo items back</button></div>`}`;
    return;
  }
  body.innerHTML=`
    <div class="blk" style="margin-top:6px"><h2>Discovery</h2></div>
    <div class="group">
      <div class="row col"><div class="tx"><b>Radius</b><span id="radv">${s.radius} km</span></div><input type="range" id="radius" min="1" max="100" value="${s.radius}" style="--p:${(s.radius-1)/99*100}%" aria-label="Discovery radius in kilometers"></div>
      <div class="row col"><div class="tx"><b>Looking for</b></div>${segHTML('intent',[['dating','Dating'],['friends','Friends'],['both','Both']],S.intent)}</div>
    </div>
    <div class="blk"><h2>Anti-genres</h2><p class="hint" style="margin-top:6px">Tap to filter out. You won’t be matched on these.</p><div class="chips" style="margin-top:12px">${ANTI.map(g=>`<button class="chip no ${s.anti.indexOf(g)>-1?'on':''}" data-act="anti" data-fx="chip" data-g="${g}" aria-pressed="${s.anti.indexOf(g)>-1}">${g}</button>`).join('')}</div></div>
    <div class="blk"><h2>Listening sessions</h2></div>
    <div class="group">
      <div class="row"><div class="tx"><b>Co-listening invites</b><span>Matches can ask you to listen together for 15 minutes.</span></div>${swHTML('tog','invites',s.invites,'Co-listening invites')}</div>
      <div class="row"><div class="tx"><b>Quiet hours</b><span>No invites or nudges during this window.</span></div>${swHTML('tog','quiet',s.quiet,'Quiet hours')}</div>
      <div class="row two" id="qrow" style="${s.quiet?'':'display:none'}"><div class="tx"><span>From</span><select class="sel" data-k="qFrom" aria-label="Quiet hours start">${hrs.map(h=>`<option ${h===s.qFrom?'selected':''}>${h}</option>`).join('')}</select></div><div class="tx"><span>Until</span><select class="sel" data-k="qTo" aria-label="Quiet hours end">${hrs.map(h=>`<option ${h===s.qTo?'selected':''}>${h}</option>`).join('')}</select></div></div>
    </div>
    <div class="blk"><h2>Privacy</h2></div>
    <div class="group">
      <div class="row col"><div class="tx"><b>Location</b><span>How precisely people nearby see where you are.</span></div>${segHTML('locVis',[['area','Nearby area'],['city','City only'],['hidden','Hidden']],s.locVis)}</div>
      <div class="row col"><div class="tx"><b>Fingerprint</b><span>Who can open your full Fingerprint.</span></div>${segHTML('vis',[['all','Everyone'],['matches','Matches'],['me','Only me']],S.prof.vis)}</div>
    </div>
    <div class="blk"><h2>Comfort</h2></div>
    <div class="group">
      <div class="row"><div class="tx"><b>Reduce motion</b><span>Calms animations across the app.</span></div>${swHTML('tog','calm',s.calm,'Reduce motion')}</div>
      <div class="row"><div class="tx"><b>Haptics</b><span>Small taps when you pass or resonate.</span></div>${swHTML('tog','haptics',s.haptics,'Haptics')}</div>
      <div class="row"><div class="tx"><b>Sound</b><span>A quiet tick on the things worth confirming.</span></div>${swHTML('tog','sound',s.sound!==false,'Sound')}</div>
    </div>
    <div class="blk"><h2>Trust and data</h2><p class="hint" style="margin-top:6px">Your safety tools are always close. Legal copy is a draft and needs lawyer review.</p></div>
    <div class="group">
      <button class="row" data-act="legal" data-doc="privacy"><div class="tx"><b>Privacy policy</b><span>How cultured handles your data.</span></div></button>
      <button class="row" data-act="legal" data-doc="terms"><div class="tx"><b>Terms of use</b><span>The rules for using cultured.</span></div></button>
      <button class="row" data-act="legal" data-doc="guidelines"><div class="tx"><b>Community guidelines</b><span>Keep the room kind and human.</span></div></button>
      <button class="row" data-act="export"><div class="tx"><b>Export my data</b><span>Request a copy of what you’ve shared.</span></div></button>
      <button class="row" data-act="logout"><div class="tx"><b>Log out</b><span>Ends the session on this device. Nothing is deleted.</span></div></button>
      <button class="row danger" data-act="delete-account"><div class="tx"><b>Delete my account</b><span>Starts a 14-day cooling-off period.</span></div></button>
    </div>
    <div class="blk"><h2>Data on this device</h2></div>
    <div class="group">
      <button class="row" data-act="replay"><div class="tx"><b>Replay onboarding</b><span>See the welcome flow again.</span></div></button>
      <button class="row danger" data-act="reset"><div class="tx"><b>Reset local data</b><span>Clears saves, photos, edits and settings here.</span></div></button>
    </div>`;
}
SEG.intent=v=>{S.intent=v;if(v!=='both'){S.lens=v;fpDirty=true;const el=$('#s-match');$$('.ft',el).forEach(b=>b.classList.toggle('on',b.dataset.v===v));layoutTabs(el)}save()};
SEG.locVis=v=>{S.set.locVis=v;save()};
SEG.activity=v=>{S.set.activity=v;save();drawSet('act')};
ACT.tog=b=>{
  const k=b.dataset.k,on=b.getAttribute('aria-checked')!=='true';S.set[k]=on;b.setAttribute('aria-checked',on);save();haptic(6);
  if(k==='calm')applyCalm();
  if(k==='sound')synth.setEnabled(on);
  if(k==='haptics'&&on)haptic(10);
  if(k==='quiet')$('#qrow').style.display=on?'':'none';
  if(k==='remind')toast(on?'We’ll nudge you at 9:00 AM':'Reminder off');
};
ACT.anti=b=>{const g=b.dataset.g,i=S.set.anti.indexOf(g);if(i>-1)S.set.anti.splice(i,1);else S.set.anti.push(g);b.classList.toggle('on',i<0);b.setAttribute('aria-pressed',i<0);save();haptic(6)};
ACT['act-dismiss']=b=>{const row=b.closest('.act-i');S.dismissed.push(b.dataset.id);save();row.classList.add('gone');setTimeout(()=>{if($('#setBody'))drawSet('act')},480)};
ACT['act-restore']=()=>{S.dismissed=[];save();drawSet('act')};
ACT.replay=()=>{closePage();setTimeout(showOnboarding,450)};
ACT.safety=b=>{const id=b.dataset.id;openSheet(`<h3 class="sh-t">Keep your space comfortable</h3><p class="hint" style="margin:-4px 0 18px;font-size:15px">Choose what you need. Reporting is private. Blocking removes this person from your decks.</p><button class="cta" data-act="safety-go" data-id="${id}" data-reason="report">Report something serious</button><button class="cta ghostb" data-act="safety-go" data-id="${id}" data-reason="vibe-report">This didn’t feel like a match</button><button class="cta ghostb" data-act="safety-go" data-id="${id}" data-reason="block">Block this person</button>`)};
ACT['safety-go']=b=>{repoCall('submitSafetyAction',b.dataset.id,b.dataset.reason);closeSheet();toast(b.dataset.reason==='block'?'Blocked. They’ll disappear from your decks.':'Thanks. We’ll keep this private.');if(b.dataset.reason==='block'){closePage();setTimeout(()=>renderMatchShell(),320)}};
ACT.legal=async b=>{const doc=await repoCall('getLegalDocument',b.dataset.doc);const title=doc&&doc.title?doc.title:b.dataset.doc;const body=doc&&doc.body?doc.body:'Draft for review. This copy needs lawyer review before launch.';openSheet(`<span class="chipg">needs lawyer review</span><h3 class="sh-t" style="margin-top:14px">${esc(title)}</h3><p class="hint" style="font-size:15px;line-height:1.55">${esc(body)}</p><button class="cta ghostb" data-act="closesheet">Close</button>`)};
ACT.export=async()=>{await repoCall('requestDataExport');toast('Your export request is queued.');};
ACT['logout']=()=>openSheet(`<h3 class="sh-t">Log out?</h3><p class="hint" style="margin:-4px 0 18px;font-size:15px">This prototype keeps everything on this device, so logging out simply takes you back to the welcome screen. Nothing is deleted, nothing is uploaded — signing back in lands on the same profile in this browser.</p><button class="cta" data-act="logout-go">Log out</button><button class="cta ghostb" data-act="closesheet">Stay in</button>`);
ACT['logout-go']=async()=>{
  try{await repoCall('logout')}catch(e){/* the offline adapter has no session to revoke */}
  closeSheet();closePage();
  toast('Logged out on this device.');
  setTimeout(showOnboarding,280);
};
ACT['delete-account']=()=>openSheet(`<h3 class="sh-t">Start account deletion?</h3><p class="hint" style="margin:-4px 0 18px;font-size:15px">Your account will enter a 14-day cooling-off period. Sign back in during that window to cancel. After it ends, deletion must purge your profile, messages, photos and push tokens.</p><button class="cta" style="background:var(--bad);color:#1b0509" data-act="delete-go">Start the 14-day period</button><button class="cta ghostb" data-act="closesheet">Keep my account</button>`);
ACT['delete-go']=async()=>{await repoCall('requestAccountDeletion');closeSheet();closePage();toast('Deletion started. You have 14 days to change your mind.');};
ACT.reset=()=>{
  openSheet(`<h3 class="sh-t">Reset local data?</h3><p class="hint" style="margin:-4px 0 18px;font-size:15px">This clears your comments, saved items, photos, profile edits and settings on this device. It doesn’t touch anything else.</p><button class="cta" style="background:var(--bad);color:#1b0509" data-act="reset-go">Reset local data</button><button class="cta ghostb" data-act="closesheet">Cancel</button>`);
};
ACT['reset-go']=()=>{
  store.clear();S=merge(DEF(),{});S.threads=DEMO_DATA?BASE_THREADS():{};S.onboarded=true;save();applyCalm();DK.day=0;
  /* The v5 store owns reactions/saves/pins too — clearing one and not the
     other is how the counts went stale in the first place. */
  shelfSeeded=false;
  V5.clearLocalData().finally(()=>{closeSheet();closePage();renderAll();toast('Local data cleared')});
};
const applyCalm=()=>document.documentElement.classList.toggle('calm',!!S.set.calm);

/* ================= onboarding ================= */
/* Onboarding is a sequence of scenes, not a stack of forms. Every step change
   runs through the View Transitions API (crossfade fallback), the meme deck is
   a physics stack with haptic ticks, the audio step plays 7-second clips with
   a live waveform, the Fingerprint builds itself live as answers land, and
   the ending is a three-beat reveal: Fingerprint, Taste Card, Duel a friend. */
/* `adult` is *computed* from the date of birth and nothing else. `attested` is
   the checkbox — a legal acknowledgement, not evidence of age. They used to be
   the same flag, which let the checkbox stand in for a date of birth that was
   never entered. */
const OB={step:0,adult:false,attested:false,dob:'',intent:'',picks:[],photoChecked:false,music:'manual',memeIndex:0,stackDone:false,memeSignals:[],audioSignals:[],name:'',permissions:false};
let OBSTACK=null,OBWAVE=null;
function showOnboarding(){Object.assign(OB,{step:0,adult:false,attested:false,dob:'',intent:'',picks:[],photoChecked:false,music:'manual',memeIndex:0,stackDone:false,memeSignals:[],audioSignals:[],name:'',permissions:false});OBSTACK=null;OBWAVE=null;$('#onboard').classList.add('on');drawOb()}
/* ---------------- the Cold Open: onboarding scene 0 ----------------
   Step 0 is no longer a hero card with a CTA. It is the ~11-second scripted
   intro from src/motion/timeline.ts, which ends by advancing to step 1. */
let COLD=null,CO_WAIT=0;
function drawColdOpen(){
  if(COLD){try{COLD.destroy()}catch(e){}COLD=null}
  /* `?introCapture=1` renders the visual beats with no words in frame, for
     scripts/export-intro-video.mjs. It is inert in production builds. */
  const capture=DEV&&/[?&]introCapture/.test(location.search);
  if(capture){const sp=$('#splash');if(sp)sp.remove()}
  /* #splash sits at z-index 90, above #onboard at 50. Mounting the intro under
     it would play the whole opening image — the ring drawing itself, the vinyl
     and its grooves — where nobody can see it, and the viewer would join at the
     split. Wait for the splash to leave, then start the clock. Capture mode has
     already removed it, so a recorded plate is intro-only from its first frame. */
  if($('#splash')){clearTimeout(CO_WAIT);CO_WAIT=setTimeout(drawColdOpen,100);return}
  const host=$('#onboard');host.classList.add('on');
  track('intro_start',{v:4});
  COLD=playColdOpen({
    host,
    capture,
    sound:!capture&&S.set.sound!==false&&CFG.flags.sound!==false,
    haptics:!capture&&S.set.haptics!==false,
    heroVideo:capture?null:((window.CulturedAssets&&window.CulturedAssets.heroVideo)||null),
    haptic,
    onDone:()=>{COLD=null;OB.step=1;drawOb();track('intro_complete',{v:4})}
  });
}
/* the shared "growing Fingerprint" rail on the calibration steps */
const obFrac=()=>clamp((OB.memeSignals.length+OB.audioSignals.length)/13,0,1);
function obFpUpdate(){
  fpGrow($('#obFp'),obFrac());
  obConfidence($('#obConf'),obFrac());
}
function obDeckSlice(){
  const startAt=(OB.memeIndex*5)%Math.max(1,MM.length-5);
  return MM.slice(startAt,startAt+5).concat(MM.slice(0,Math.max(0,startAt+5-MM.length)))
    .map(m=>({id:m.id,emoji:m.e||'✨',text:m.t,bg:m.bg||'#EFE9DA',fg:m.fg||'#141413'}));
}
const isSeedMeme=id=>SEED_MEMES.some(m=>m.id===id);
function obSignal(id,kind){
  OB.memeSignals.push({memeId:id,kind});
  if(kind==='laugh'){bumpCal(true);if(isSeedMeme(id))repoCall('recordEvent','laugh','meme',id)}
  else if(kind==='meh'){if(isSeedMeme(id))repoCall('recordEvent','meh','meme',id)}
  else if(isSeedMeme(id))repoCall('recordEvent','skip','meme',id);
  obFpUpdate();
}
function drawOb(transition){
  if(OB.step===0){drawColdOpen();return}
  if(COLD){try{COLD.destroy()}catch(e){}COLD=null}
  /* destroy() takes the intro's shell down with it; every later scene is
     rendered inside #onboard, so the panel has to be re-opened here. */
  $('#onboard').classList.add('on');
  const paint=()=>drawObNow();
  if(transition===false){paint();afterObPaint();return}
  stepTransition($('#onboard'),paint).then(afterObPaint);
}
function afterObPaint(){
  if(OB.step===4){
    const host=$('#obStack');
    if(host){
      if(OBSTACK)OBSTACK.destroy();
      OBSTACK=physicsStack(host,obDeckSlice(),{
        onDecide:(id,kind)=>{obSignal(id,kind)},
        haptic,
        onDone:()=>{OB.memeIndex+=5;OB.step=5;drawOb()}
      });
      obFpUpdate();
    }
  } else if(OBSTACK){OBSTACK.destroy();OBSTACK=null}
  if(OB.step===5){
    const host=$('#obWave');
    if(host){
      if(OBWAVE)OBWAVE.destroy();
      const order=['choir','cherry','soft','moons'];
      OBWAVE=waveList(host,order.map((id,i)=>({id,title:TRACKS[id].title,sub:TRACKS[id].artist})),{
        haptic,
        onRate:(trackId,kind)=>{
          const i=order.indexOf(trackId);
          if(i>-1&&!OB.audioSignals.some(a=>a.i===i)){OB.audioSignals.push({i,track:trackId,kind});bumpCal(kind==='react')}
          if(isSeedTrack(trackId))repoCall('recordEvent',kind==='react'?'like':'skip','track',seedTrackId(trackId));
          obFpUpdate();
        },
        status:()=>'7-second clip · resolving preview…'
      });
      /* Ask the PreviewProvider (brief §2.2) per row; the offline answer is
         "no source connected", and the row says so instead of faking audio. */
      $$('.ob-wave',host).forEach(row=>{
        const r=TRACKS[row.dataset.id];
        fetchPreview('ob:'+row.dataset.id,{artist:r&&r.artist,title:r&&r.title,seconds:7}).then(res=>{
          const el=$('.ob-wave-status',row);if(el)el.textContent=res.ok?'Preview cached · 7-second cut':res.status;
        });
      });
      obFpUpdate();
    }
  } else if(OBWAVE){OBWAVE.destroy();OBWAVE=null}
}
/* legacy keeps short keys (choir); the seed — and the repo — speak t_choir */
const seedTrackId=id=>id.startsWith('t_')?id:'t_'+id;
const isSeedTrack=id=>SEED_TRACKS.some(t=>t.id===seedTrackId(id));
function drawObNow(){
  const o=$('#onboard');let body='';
  const prog=`<div class="ob-prog">${Array.from({length:9},(_,i)=>`<i class="${i<=OB.step?'on':''}"></i>`).join('')}</div>`;
  /* Both are required: a date of birth that actually computes to 18+, and the
     acknowledgement. The checkbox alone used to be enough, which is how the
     server-side age check got bypassed. */
  const ageOk=()=>OB.adult&&OB.attested;
  const foot=label=>`<div class="ob-foot"><button class="cta" data-act="ob-next" ${label==='Continue'&&OB.step===1&&!ageOk()?'disabled':''}>${label}</button></div>`;
  /* the last step finishes on ob-done, not on a capped ob-next */
  const footDone=label=>`<div class="ob-foot"><button class="cta" data-act="ob-done">${label}</button></div>`;
  const calSide=`<div class="ob-cal-side"><div class="ob-fp" id="obFp"></div><div class="ob-conf"><b id="obConf">0</b><span>% Fingerprint clarity</span></div><p class="hint">The contours you’re building now are the ones your first Matrix card will wear.</p></div>`;
  if(OB.step===1){body=`<div class="step"><div class="ob-body"><span class="eyebrow">Your age stays private</span><h1 class="ob-q">A little trust, first.</h1><p class="ob-s">cultured is 18+. Your date of birth is checked server-side and never shown on your profile.</p><label class="field"><span>Date of birth</span><input id="ob-dob" type="date" value="${OB.dob}" max="${new Date().toISOString().slice(0,10)}"></label><button class="agree" data-act="ob-adult" role="switch" aria-checked="${OB.attested}"><span class="sw" data-on="${OB.attested}" aria-hidden="true"></span><span>I’m 18 or older</span></button><div class="auth-rail"><button class="chip on" data-act="ob-auth" data-v="email">Email magic link</button><button class="chip" data-act="ob-auth" data-v="apple">Sign in with Apple</button><button class="chip" data-act="ob-auth" data-v="google">Google</button></div></div>${foot('Continue')}</div>`}
  else if(OB.step===2){body=`<div class="step"><div class="ob-body"><span class="eyebrow">Photo check</span><h1 class="ob-q">Show there’s a real person here.</h1><p class="ob-s">A quick on-device check keeps the Matrix human. This badge says <b>photo checked</b>, not verified identity.</p><div class="verify-orb ${OB.photoChecked?'done':''}">${OB.photoChecked?I.check:RING_GLYPH}</div><button class="cta ghostb" data-act="ob-photo">${OB.photoChecked?'Photo checked':'Run photo check'}</button></div>${foot('Continue')}</div>`}
  else if(OB.step===3){const providers=[['manual','Manual taste chips','Start without connecting anything.'],['lastfm','Last.fm username','Bring in public scrobbles later.'],['apple','Apple Music','Connect when MusicKit is configured.'],['spotify','Spotify · alpha only','Allowlisted testers only.']];body=`<div class="step"><div class="ob-body"><span class="eyebrow">Music signal</span><h1 class="ob-q">Where should your taste come from?</h1><p class="ob-s">Manual is the default. You can reconnect or rebuild this vector later.</p><div class="provider-list">${providers.map(p=>`<button class="provider ${OB.music===p[0]?'on':''}" data-act="ob-music" data-v="${p[0]}"><span>${p[0]==='manual'?I.note:I.link}</span><div><b>${p[1]}</b><small>${p[2]}</small></div>${OB.music===p[0]?I.check:''}</button>`).join('')}</div></div>${foot('Use this source')}</div>`}
  else if(OB.step===4){body=`<div class="step ob-scene-stack"><div class="ob-body"><span class="eyebrow">Meme calibration · ${Math.min(OB.memeSignals.length%5+1,5)}/5 in this deck</span><h1 class="ob-q">What kind of funny are you?</h1><p class="ob-s">Drag the card toward what it is, or use the buttons. Nothing here is shared.</p></div>
    <div class="ob-split">${calSide}
      <div class="ob-right"><div class="ob-stack" id="obStack" aria-label="Meme cards — drag or use the buttons"></div>
      <div class="cal-actions">
        <button class="dbtn" data-act="ob-meme" data-v="meh" aria-label="Meh">${I.minus}<small>Meh</small></button>
        <button class="rbtn" data-act="ob-meme" data-v="laugh" aria-label="That’s me">${I.laugh}<span>That’s me</span></button>
        <button class="dbtn" data-act="ob-meme" data-v="skip" aria-label="Skip">${I.chevr}<small>Skip</small></button>
      </div></div></div></div>`}
  else if(OB.step===5){body=`<div class="step ob-scene-wave"><div class="ob-body"><span class="eyebrow">Sound calibration · 4 clips</span><h1 class="ob-q">Let the music do some talking.</h1><p class="ob-s">Seven-second previews tune the edges of your fingerprint. The waveform is live; the audio adapter is next in line.</p></div>
    <div class="ob-split ob-split-wide">${calSide}<div class="ob-right"><div class="audio-cal" id="obWave"></div></div></div>
    ${foot('Continue')}</div>`}
  else if(OB.step===6){body=`<div class="step"><div class="ob-body"><span class="eyebrow">Your context</span><h1 class="ob-q">A little more than a face.</h1><p class="ob-s">Photos and prompts have equal weight with your Fingerprint. Add them now or later.</p><div class="onboarding-grid"><button class="gt add" data-act="add-photo"><span>${I.plus}</span><b>Add photos</b></button><button class="prompt-tile"><span>Prompt 1</span><b>A song I’ll defend forever…</b></button><button class="prompt-tile"><span>Prompt 2</span><b>My most niche reference…</b></button></div></div>${foot('Continue')}</div>`}
  else if(OB.step===7){const opts=[['dating','Dating'],['friends','Friends'],['both','Both']];body=`<div class="step"><div class="ob-body"><span class="eyebrow">Basics</span><h1 class="ob-q">What should we call you?</h1><label class="field"><span>Name</span><input id="ob-name" maxlength="24" placeholder="Your first name" value="${esc(OB.name)}"></label><h3 class="tg">Looking for</h3><div class="chips">${opts.map(x=>`<button class="chip ${OB.intent===x[0]?'on':''}" data-act="ob-intent" data-fx="chip" data-v="${x[0]}" aria-pressed="${OB.intent===x[0]}">${x[1]}</button>`).join('')}</div></div>${foot('Continue')}</div>`}
  else {body=`<div class="step"><div class="ob-body"><span class="eyebrow">Last step</span><h1 class="ob-q">Keep the ritual close.</h1><p class="ob-s">Choose what you want to hear about. You can change this anytime in Settings.</p><div class="permission-card"><button class="row" data-act="ob-permission"><div class="tx"><b>Daily Drop at 9:00 AM</b><span>One track, one meme, no guilt trips.</span></div><span class="sw" data-on="${OB.permissions}"></span></button><button class="row"><div class="tx"><b>Location</b><span>Used to tune your discovery radius.</span></div><span class="chipg">Later</span></button></div></div>${footDone('Build my Fingerprint')}</div>`}
  o.innerHTML=prog+body;
  const dob=$('#ob-dob');if(dob)dob.oninput=()=>{OB.dob=dob.value;OB.adult=dob.value?((Date.now()-new Date(dob.value).getTime())/31557600000)>=18:false;const c=$('#onboard .step .cta');if(c)c.disabled=!(OB.adult&&OB.attested);drawOb(false)};
  const name=$('#ob-name');if(name)name.oninput=()=>{OB.name=name.value};
}
ACT['ob-adult']=b=>{OB.attested=!OB.attested;b.setAttribute('aria-checked',OB.attested);$('.sw',b).dataset.on=OB.attested;const c=$('#onboard .step .cta');if(c)c.disabled=!(OB.adult&&OB.attested);haptic(6)};
ACT['ob-next']=()=>{OB.step=Math.min(8,OB.step+1);drawOb();haptic(8)};
ACT['ob-auth']=b=>{$$('.auth-rail .chip').forEach(x=>x.classList.toggle('on',x===b));toast('Auth adapter ready for '+b.dataset.v);haptic(5)};
ACT['ob-photo']=b=>{
  OB.photoChecked=true;
  drawOb(false);
  /* the orb completes with a check that draws itself, not a swap */
  const orb=$('.verify-orb');
  if(orb){microPublic.drawCheck(orb);microPublic.burst(orb,'var(--ok)',8)}
  toast('Photo checked on this device');haptic([10,30,10]);
};
ACT['ob-music']=b=>{OB.music=b.dataset.v;drawOb();haptic(6)};
ACT['ob-meme']=b=>{
  const kind=b.dataset.v;
  const items=obDeckSlice();
  const used=OB.memeSignals.map(x=>x.memeId);
  const top=items.find(x=>used.indexOf(x.id)<0)||items[0];
  if(OBSTACK)OBSTACK.decide(top.id,kind);else obSignal(top.id,kind);
  if(OB.memeSignals.length>=5&&!OB.stackDone){OB.stackDone=true;OB.step=5;drawOb()}
};
ACT['ob-permission']=()=>{OB.permissions=!OB.permissions;drawOb(false);haptic(6)};
ACT['ob-intent']=b=>{OB.intent=b.dataset.v;$$('#onboard [data-act="ob-intent"]').forEach(t=>{const on=t===b;t.classList.toggle('on',on);t.setAttribute('aria-pressed',on)});$('#onboard .cta').disabled=false;haptic(6)};
ACT['ob-done']=()=>{
  S.onboarded=true;S.intent=OB.intent||'both';S.lens=S.intent==='friends'?'friends':'dating';S.tastes=OB.picks.slice();
  if(OB.name.trim())S.prof.name=OB.name.trim();
  const hs=OB.picks.filter(x=>HUMOR.indexOf(x)>-1);if(hs.length)S.prof.humor=hs;
  S.cal=(S.cal||0)+OB.memeSignals.length+OB.audioSignals.length;
  S.decided={};S.history=[];save();renderAll();demoBanner();
  /* calibration crosses the adapter boundary: the mock's onboard() folds the
     pending duel picks into the same event stream, so a duel played before
     onboarding is not decoration — it is your fingerprint. */
  const repo=window.Cultured&&window.Cultured.repo;
  if(repo&&repo.onboard){
    repo.onboard({
      /* The real date of birth, or nothing. This used to fall back to a
         fabricated '2000-01-01' whenever the checkbox was ticked, which handed
         the server an adult date of birth for an account that never supplied
         one — defeating the 18+ check the server exists to make. */
      dateOfBirth:OB.dob,displayName:OB.name||S.prof.name,mode:OB.intent||'both',city:S.city,
      musicSource:OB.music,pickedTastes:S.prof.humor,
      memeSignals:OB.memeSignals.filter(x=>isSeedMeme(x.memeId)),
      audioSignals:OB.audioSignals.map(x=>({trackId:seedTrackId(x.track),kind:x.kind})),
      photoChecked:OB.photoChecked,antiGenres:S.set.anti||[]
    }).catch(()=>{/* offline-only: the local fingerprint still stands */});
  }
  const o=$('#onboard');
  /* The reveal: three beats, not a spinner. Fingerprint, then Taste Card, then
     the invitation. Tap jumps ahead; the buttons below do the work. */
  const pct=Math.round(obFrac()*100);
  o.innerHTML=`<div class="reveal">
    <div class="rv rv-fp"><div class="gen-fp draw">${fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:18,w:1.4})}</div><span class="eyebrow">Yours, from your answers</span><h2>Your Fingerprint.</h2><p>${pct}% Fingerprint clarity from ${S.cal||0} calibration events.</p></div>
    <div class="rv rv-tc"><span class="eyebrow">Shareable, with real numbers</span>
      <div class="taste-card"><div class="tc-top"><span>my cultural fingerprint</span><b>${esc(S.prof.name)}</b></div><div class="tc-fp">${fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:14,w:1.4})}</div><div class="tc-score"><b>${76+pct/4|0}%</b><span>Fingerprint clarity</span></div><div class="tc-grid"><div><small>leans</small><strong>${esc(S.prof.humor.slice(0,2).join(' · '))||'unwritten'}</strong></div><div><small>on repeat</small><strong>${S.prof.artists.slice(0,2).map(esc).join(' · ')||'your first saves'}</strong></div></div><footer>cultured · find who else relates</footer></div>
    </div>
    <div class="rv rv-duel"><span class="eyebrow">The only real test</span><h2>Prove it on someone.</h2><p>Duel a friend: same five prompts, no peeking, verdict only when both are in.</p><button class="cta" data-act="ob-duel">${I.pair}Duel a friend</button><button class="cta ghostb" data-act="ob-enter">Enter cultured</button></div>
  </div>`;
  haptic([10,40,10,40,20]);
  RUN_REVEAL=runReveal(o,[
    {id:'fp',el:$('.rv-fp',o)},
    {id:'tc',el:$('.rv-tc',o)},
    {id:'duel',el:$('.rv-duel',o)}
  ],()=>{},{perStep:1600,haptic});
  track('onboarding_complete',{cal:S.cal||0});
};
let RUN_REVEAL=null;
ACT['ob-enter']=()=>{if(RUN_REVEAL){RUN_REVEAL();RUN_REVEAL=null}const o=$('#onboard');o.classList.remove('on');o.innerHTML='';go('feed');toast('Welcome to cultured')};
ACT['ob-duel']=async()=>{
  ACT['ob-enter']();
  await new Promise(r=>setTimeout(r,350));
  ACT['pulse-duel']();
};

/* ================= v3: today's memes ================= */
const STK='<div class="stks" aria-hidden="true">'+['😂','🎧','🔥','💀','✨','🫠'].map((e,i)=>`<i style="--i:${i};--x:${[6,80,14,74,44,90][i]}%;--y:${[2,8,66,60,90,36][i]}%">${e}</i>`).join('')+'</div>';
/* Topic -> sticker. Declared before MM because MM.map runs immediately. */
const TOPIC_EMOJI={work:'🐛',music:'🎧',screen:'📺',life:'🫠',love:'🎵',money:'🧾'};
/* Today's memes is the real image corpus and nothing else.
   The 122 generated typographic text cards and the 13 hand-written ones that
   used to sit here are gone: cultured only shows real image and video memes,
   and only ones the content pipeline has actually built a manifest for. */
const MM=SEED_MEMES.map(m=>({id:m.id,k:m.topic,e:TOPIC_EMOJI[m.topic]||'✨',t:m.text,img:m.img,bg:m.bg,fg:m.fg,alt:m.alt}));
let mmTab='all';
const mmS=()=>S.mm||(S.mm={l:{},s:{}});
const mmOf=id=>MM.find(m=>m.id===id);
const mmList=()=>mmTab==='all'?MM:MM.filter(m=>m.k===mmTab);
function mmVisual(m){return `<div class="mm-photo-wrap"><img class="mm-photo" src="${m.img}" alt="${esc(m.alt||m.t)}" loading="lazy" decoding="async"></div>`}
function mmMini(m,cls=''){return `<div class="mm-mini ${cls}" style="--bg:${m.bg||'#EFE9DA'};--fg:${m.fg||'#141413'}"><img src="${m.img}" alt="${esc(m.alt||m.t)}" loading="lazy" decoding="async"><i>${esc(m.t)}</i></div>`}
function mmCard(m,i){const st=mmS();return `<article class="mm-card has-photo" data-m="${m.id}" style="--bg:${m.bg||'#EFE9DA'};--fg:${m.fg||'#141413'};--i:${i}"><div class="mm-visual">${mmVisual(m)}</div><p class="mm-cap">${esc(m.t)}</p><div class="mm-bar"><span class="mm-k">${m.k}</span><span class="sp"></span><button class="mm-b ${st.l[m.id]?'on':''}" data-act="mm-like" data-fx="like" data-id="${m.id}" aria-label="Like" aria-pressed="${!!st.l[m.id]}">${I.heart}</button><button class="mm-b ${st.s[m.id]?'on':''}" data-act="mm-save" data-fx="pin" data-id="${m.id}" aria-label="Save" aria-pressed="${!!st.s[m.id]}">${I.bookmark}</button><button class="mm-b" data-act="mm-share" data-fx="share" aria-label="Send to a match">${I.share}</button></div></article>`}
function mmHTML(){return `<section class="mm stg" style="--d:2"><div class="mm-h"><h2 class="sec" style="padding:0">Today’s memes</h2><span class="mm-n">${Math.min(MM.length,6)} of ${MM.length} in the gallery</span></div><div class="mm-row" id="mmrow">${mmList().slice(0,6).map(mmCard).join('')}</div></section>`}
ACT['mm-tab']=b=>{toast('Topic tabs are off in this phase');};
const mmId=b=>b.closest('[data-m]').dataset.m;
ACT['mm-like']=b=>{
  const id=mmId(b),st=mmS(),on=!st.l[id];st.l[id]=on?1:0;
  if(on)V5.react({kind:'meme',itemId:id,emoji:V5_LIKE,surface:'deck'});else V5.removeReaction('meme',id);
  b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);save();renderYou();repoCall('recordReaction',id,'like');
  if(on){burst(b,'#ff5d7a');haptic(10)}
};
ACT['mm-save']=b=>{
  const id=mmId(b),st=mmS(),on=!st.s[id];st.s[id]=on?1:0;
  V5.setSaved('meme',id,on);
  if(on)V5.pin('meme',id);else V5.unpin('meme',id);
  b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);save();renderYou();repoCall('recordReaction',id,'save');
  toast(on?'Kept.':'Let go.');haptic(8);
};
ACT['mm-share']=b=>{
  const id=mmId(b);
  /* Thread keys outlive the people behind them: they are persisted, and with
     the invented population gated off (D-27) `person()` legitimately returns
     undefined. Filtering here is what stops `orb(p)` and `p.name` throwing on
     a list that used to be populated. The threads are left in place — this
     filters a view, it does not delete anything. */
  const ids=Object.keys(S.threads||{}).filter(pid=>person(pid));
  openSheet(`<h3 class="sh-t">Send to a match</h3>${ids.length?ids.map(pid=>{const p=person(pid);return `<button class="trk" data-act="mm-send" data-id="${id}" data-to="${pid}"><div class="tile">${orb(p,44)}</div><div><b>${esc(p.name)}</b><span>${p.score}% resonance</span></div></button>`}).join(''):'<p class="hint">Match with someone first, then send them a meme.</p>'}`);
};
ACT['mm-send']=b=>{const pid=b.dataset.to;const who=person(pid);if(!who){toast('That match is no longer here');closeSheet();return}
  ensureThread(pid);S.threads[pid].msgs.push({f:'me',kind:'meme',ref:b.dataset.id,ts:Date.now()});save();closeSheet();toast('Sent to '+who.name);haptic(8);reply(pid);track('prompt_meme_reply_sent',{source:DEMO_DATA?'demo':'live'})};
function memeBub(m){const x=mmOf(m.ref);return x?`<div class="bub-m ${m.f}" style="--bg:${x.bg||'#EFE9DA'};--fg:${x.fg||'#141413'}"><img src="${x.img}" alt="${esc(x.alt||x.t)}" loading="lazy" decoding="async"></div>`:''}
function mmMiniRow(m){return `<button class="mm-mini" data-act="mm-chat" data-id="${m.id}">${mmVisual(m)}<i>${esc(m.t.split('\n')[0])}</i></button>`}
ACT['meme-pick']=()=>{
  const state=V5.getState();
  const strip=k=>k.slice('meme:'.length);
  const savedSet=new Set(v5SavedKeys(state).filter(k=>k.startsWith('meme:')).map(strip));
  const likedSet=new Set(v5LaughedKeys(state).filter(k=>k.startsWith('meme:')).map(strip));
  const saved=MM.filter(m=>savedSet.has(m.id));
  const liked=MM.filter(m=>!savedSet.has(m.id)&&likedSet.has(m.id));
  const rest=MM.filter(m=>!savedSet.has(m.id)&&!likedSet.has(m.id));
  openSheet(`<h3 class="sh-t">Send a meme</h3>
    ${saved.length?`<span class="chipg" style="margin:6px 0 8px">Saved · ${saved.length}</span><div class="mm-grid">${saved.map(mmMiniRow).join('')}</div>`:''}
    ${liked.length?`<span class="chipg" style="margin:12px 0 8px">You laughed at · ${liked.length}</span><div class="mm-grid">${liked.slice(0,10).map(mmMiniRow).join('')}</div>`:''}
    <span class="chipg" style="margin:12px 0 8px">All cards</span><div class="mm-grid">${rest.slice(0,30).map(mmMiniRow).join('')}</div>`);
};
ACT['mm-chat']=b=>{const id=threadId();if(!id)return;S.threads[id].msgs.push({f:'me',kind:'meme',ref:b.dataset.id,ts:Date.now()});save();closeSheet();renderMsgs(id);haptic(8);reply(id);track('prompt_meme_reply_sent',{source:DEMO_DATA?'demo':'live'})};
/* The shelf is the profile's pinned corner: memes AND songs, from saved and
   liked, in an order you can drag. Unpin peels the item off; pinning a card
   from the feed arcs it here (see data-fx="pin"). */
/* v5: the pin board reads the store. `S.shelf` is seeded into it exactly once
   (the migration usually already did this) so unpinning everything cannot
   resurrect the old list. */
let shelfSeeded=false;
function shelfSeedOnce(){
  if(shelfSeeded)return;shelfSeeded=true;
  if(!S.shelf){
    const ids=[];
    Object.keys(S.react).forEach(id=>{if(S.react[id].s&&POSTS[id]&&POSTS[id].kind==='music')ids.push('t:'+POSTS[id].ref)});
    const st=mmS();MM.forEach(m=>{if(st.s[m.id])ids.push('m:'+m.id)});
    S.shelf=ids;
  }
  const pins=v5PinsByKind(V5.getState());
  const have=new Set([...pins.meme,...pins.song].map(p=>(p.kind==='meme'?'m':'t')+':'+p.itemId));
  S.shelf.forEach(k=>{
    if(have.has(k))return;
    const i=k.indexOf(':');if(i<1)return;
    V5.pin(k[0]==='m'?'meme':'song',k.slice(i+1));
  });
}
function shelfIds(){
  shelfSeedOnce();
  const pins=v5PinsByKind(V5.getState());
  return [...pins.meme.map(p=>'m:'+p.itemId),...pins.song.map(p=>'t:'+p.itemId)];
}
function shelfEntry(id){
  const [kind,key]=id.split(':');
  if(kind==='m'){const m=mmOf(key);return m?{kind:'m',m}:null}
  const t=TRACKS[key];return t?{kind:'t',t}:null;
}
function mmShelf(){
  const ids=shelfIds().map(shelfEntry).filter(Boolean);
  const liked=v5LaughsGiven(V5.getState());
  return `<div class="blk stg" style="--d:5"><h2>Pin board<small>drag to reorder</small></h2>
    <div class="mm-shelf" id="shelf">${ids.length?ids.map(x=>x.kind==='m'?
      `<button class="mm-mini sh" data-k="m:${x.m.id}" data-act="shelf-open">${x.m.img?`<img src="${x.m.img}" alt="${esc(x.m.alt||x.m.t)}">`:`<span>${x.m.e}</span>`}<i>${esc(String(x.m.t).split('\n')[0])}</i><em class="pin-x" data-act="shelf-unpin" data-k="m:${x.m.id}" aria-label="Unpin">✕</em></button>`:
      `<button class="mm-mini sh song" data-k="t:${x.t.id}" data-act="shelf-open"><span class="pt">${poster(x.t,true)}</span><i>${esc(x.t.title)}</i><em class="pin-x" data-act="shelf-unpin" data-k="t:${x.t.id}" aria-label="Unpin">✕</em></button>`
      ).join(''):'<p class="hint">Save a meme or a song and pin it here — it becomes the first thing a match sees after your Fingerprint.</p>'}</div>
    <div class="shelf-tray">${ids.length?'':'<span class="chipg">'+liked+' laughs given · save anything from the feed to grow this shelf</span>'}</div>
  </div>`;
}
ACT['shelf-unpin']=b=>{
  const k=b.dataset.k,shelf=shelfIds(),isMeme=k.startsWith('m:'),id=k.slice(2);
  S.shelf=shelf.filter(x=>x!==k);
  if(isMeme){const st=mmS();delete st.s[id];V5.unpin('meme',id);V5.setSaved('meme',id,false)}
  else{const post=Object.values(POSTS).find(p=>p.kind==='music'&&p.ref===id);if(post&&S.react[post.id])S.react[post.id].s=0;V5.unpin('song',id)}
  const item=b.closest('.mm-mini');
  const done=()=>{save();renderYou();renderFeed()};
  if(item&&!S.set.calm){
    const a=item.animate([{transform:'rotate(0) scale(1)',opacity:1},{transform:'rotate(8deg) scale(.6) translateY(24px)',opacity:0}],{duration:260,easing:'cubic-bezier(.22,.61,.36,1)'});
    a.finished.then(done,done);
  } else done()
  haptic(6);
};
ACT['shelf-open']=b=>{
  if(b.closest('.pin-x'))return;
  const k=b.dataset.k;
  if(k.startsWith('m:')){toast('Pinned meme · '+(mmOf(k.slice(2))||{}).t?.split('\n')[0]||'')}
  else toast('Pinned song · '+(TRACKS[k.slice(2)]||{}).title);
};
/* FLIP drag-reorder shared by the shelf and the photo grid. */
function dragReorder(host,items,onDone){
  if(!host)return;
  let dragging=null,ox=0,oy=0;
  host.addEventListener('pointerdown',e=>{
    const it=e.target.closest(items);
    if(!it||e.target.closest('button,.pin-x'))return;
    dragging=it;const r=it.getBoundingClientRect();ox=e.clientX-r.left;oy=e.clientY-r.top;
    it.classList.add('lift');try{it.setPointerCapture(e.pointerId)}catch(_){}
    haptic(6);
  });
  host.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const hr=host.getBoundingClientRect();
    const fr=dragging.getBoundingClientRect();
    dragging.style.transform=`translate3d(${e.clientX-hr.left-ox-fr.left+hr.left}px,${e.clientY-hr.top-oy-fr.top+hr.top}px,0)`;
    [...host.querySelectorAll(items)].forEach(sb=>{
      if(sb===dragging){return}
      const br=sb.getBoundingClientRect();
      const hit=(br.left+br.width/2)> (fr.left+fr.width/2);
      sb.style.transform=hit?`translateX(${fr.width+8}px)`:'';
    });
  });
  const end=()=>{
    if(!dragging)return;
    const it=dragging;dragging=null;
    it.classList.remove('lift');
    [...host.querySelectorAll(items)].forEach(sb=>sb.style.transform='');
    const rectOf=el=>el.getBoundingClientRect().left;
    const ordered=[...host.querySelectorAll(items)].sort((a,b)=>rectOf(a)-rectOf(b)).map(el=>el.dataset.k).filter(Boolean);
    if(ordered.length)onDone(ordered);
  };
  host.addEventListener('pointerup',end);host.addEventListener('pointercancel',end);
}
function shelfWire(){
  const host=$('#shelf');if(!host)return;
  dragReorder(host,'.mm-mini.sh',order=>{S.shelf=order;save();renderYou();haptic([8,20,8])});
}
/* The Fingerprint "story": chapters read straight off the stored vector —
   no invented adjectives, no fabricated percentiles. */
ACT['fp-story']=()=>{
  const ids=shelfIds().map(shelfEntry).filter(Boolean);
  const chapters=[
    ['The drawing',`Built from ${S.cal||0} calibration events and ${Object.keys(S.react).filter(k=>S.react[k].l||S.react[k].h).length} reactions on culture.`],
    ['The lean',`${S.prof.humor.slice(0,3).join(', ')||'unwritten — react to memes to set it'}.`],
    ['The rotation',`${S.prof.artists.slice(0,3).join(', ')||'no artists pinned yet'}.`],
    ['The shelf',ids.length?`${ids.length} pinned: ${ids.map(x=>x.kind==='m'?'a meme':'“'+x.t.title+'”').slice(0,3).join(', ')}.`:'empty — save something and pin it.'],
    ['The duel',S.duelLink&&S.duelLink.verdict?`last verdict ${S.duelLink.verdict.score}/${S.duelLink.verdict.of} against a real opponent.`:'not fought yet. Duel a friend from the Matrix reveal.']
  ];
  const pg=openPage(`<div class="d-scroll">
    <div class="d-top stg"><button class="pillb" data-act="back" aria-label="Back">${I.back}<span>Back</span></button><div class="d-chips"><span class="chipg">${S.cal||0} events</span></div></div>
    <div class="d-hero" style="aspect-ratio:1/1">${fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:20,w:1.3})}</div>
    <h1 class="d-title stg" style="--d:2">Your Fingerprint, in chapters.</h1>
    ${chapters.map((c,i)=>`<h3 class="d-h stg" style="--d:${3+i}">${c[0]}</h3><p class="d-desc open stg" style="--d:${4+i}">${esc(c[1])}</p>`).join('')}
  </div>`,{fade:true});
  setTint(pg,fpSVG(fpParams(mineSeed()),'#EFE9DA','#ff8a5b',{n:8,w:1}));haptic(8);
};
/* ================= boot ================= */
function initMicroInteractions(){
  document.addEventListener('pointermove',e=>{
    const el=e.target.closest?.('.dcard,.mm-card,.pf-fp');if(!el)return;
    const r=el.getBoundingClientRect();el.style.setProperty('--mx',`${((e.clientX-r.left)/r.width)*100}%`);el.style.setProperty('--my',`${((e.clientY-r.top)/r.height)*100}%`);el.classList.add('tracking');
  },{passive:true});
  document.addEventListener('pointerout',e=>{const el=e.target.closest?.('.dcard,.mm-card,.pf-fp');if(el&&!el.contains(e.relatedTarget))el.classList.remove('tracking')},{passive:true});
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest?.('button');if(!b||b.disabled||b.closest('.dcard')&&!b.matches('.glassb'))return;
    const r=b.getBoundingClientRect(),i=document.createElement('i');i.className='ripple';i.style.left=`${e.clientX-r.left}px`;i.style.top=`${e.clientY-r.top}px`;b.appendChild(i);setTimeout(()=>i.remove(),600);
    /* The global press feel: springy shrink on press, release on up/leave.
       Every interactive surface gets it for free; calm mode is honoured by
       the CSS transition duration, and the transform is compositor-only. */
    if(b.matches('.cta,.chip,.duel2-opt,.nhi-opt,.g-card,.mm-b,.ibtn,.pillb,.rpill,.trk,.slot,.seat')){
      b.classList.add('pressable','pressing');
      const lift=()=>b.classList.remove('pressing');
      b.addEventListener('pointerup',lift,{once:true});
      b.addEventListener('pointerleave',lift,{once:true});
      b.addEventListener('pointercancel',lift,{once:true});
    }
  },{passive:true});
}
function renderAll(){renderFeed();renderArena();renderMatchShell();renderPeople();renderYou();updateBadge();mediaKick()}
document.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;const f=ACT[a.dataset.act];if(f)f(a,e)});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.cc-art')){e.preventDefault();ACT['open-d'](e.target)}});
function splashInit(){
  $('#spfp').innerHTML=fpSVG(fpParams(7),'#EFE9DA','#ff8a5b',{n:16,w:1.3});
  $('#spw').innerHTML=[...'cultured'].map((c,i)=>`<span><i style="--d:${i}">${c}</i></span>`).join('');
  setTimeout(()=>{const s=$('#splash');s.classList.add('out');setTimeout(()=>s.remove(),1000)},2300);
}
/* A prototype that contains invented people has to say so on screen, not in a
   README. The banner is the difference between a demo and a deception. */
let bannerShown=false;
function demoBanner(){
  if(!DEMO_DATA||bannerShown)return;
  bannerShown=true;
  const b=document.createElement('div');
  b.className='demo-banner';b.setAttribute('role','note');
  b.innerHTML=`<b>Prototype</b><span>Demo content. The people, posts and counts in this build are invented for local demonstration.</span><button aria-label="Dismiss">${I.x}</button>`;
  b.querySelector('button').onclick=()=>b.remove();
  $('#phone').appendChild(b);
}
function init(){
  grainInit();applyCalm();buildNav();splashInit();initMicroInteractions();
  /* one delegated micro layer over the existing data-act handlers; it decorates
     and never owns state. The synth follows the same Sound setting. */
  installMicro({haptic:p=>haptic(p),sound:()=>S.set.sound!==false,stage:()=>$('#phone')});
  window.CulturedMicro=microPublic;
  synth.setEnabled(S.set.sound!==false);
  initPTR();renderAll();go('feed');
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>layoutTabs(document));
  window.addEventListener('resize',()=>layoutTabs(document));
  track('app_open',{v:4});
  /* The demo label is product chrome, not part of the story, so it appears once
     onboarding is done. Putting it over the Cold Open also swallowed the
     tap-to-skip, because the banner sits above the overlay it labelled. */
  if(S.onboarded)demoBanner();else showOnboarding();
}
init();
})();

export {};

