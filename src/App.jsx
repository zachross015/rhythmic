import { useState, useEffect, useCallback, useRef } from "react";

// ─── Brand ────────────────────────────────────────────────────────────────────
const C={softLinen:"#F2EEE6",tan:"#C6A585",granite:"#405147",ashGrey:"#9CB7B1",drySage:"#BEC9A6",azureMist:"#D1E1DD"};
const NOTES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const toDay=()=>new Date().toISOString().split("T")[0];
const MAX_SCORED=25; const MAX_FAILS=3; const TIME_LIMIT=60;

// ─── Storage ──────────────────────────────────────────────────────────────────
const S={
  async get(k,sh=false){try{const r=await localStorage.getItem(k,sh);return r?JSON.parse(r):null}catch{return null}},
  async set(k,v,sh=false){try{await localStorage.setItem(k,JSON.stringify(v),sh)}catch{}},
};
async function loadProfile(){let p=await S.get("rt2:profile");if(!p){p={id:Math.random().toString(36).slice(2,9),name:null,etXp:0};await S.set("rt2:profile",p);}return p;}
async function saveProfile(p){await S.set("rt2:profile",p);}
async function loadHistory(uid){try{return(await S.get(`rt2:hist:${uid}`))||[]}catch{return[];}}
async function saveHistory(uid,entry){try{const h=(await S.get(`rt2:hist:${uid}`))||[];const i=h.findIndex(e=>e.date===entry.date);i>=0?(h[i].total=Math.max(h[i].total,entry.total)):h.push(entry);await S.set(`rt2:hist:${uid}`,h.slice(-60));}catch{}}
async function loadLB(){try{return(await S.get(`rt2:lb:${toDay()}`,true))||[]}catch{return[];}}
async function submitLB(p,total){if(!p?.name)return;try{const b=(await S.get(`rt2:lb:${toDay()}`,true))||[];const i=b.findIndex(e=>e.id===p.id);const e={id:p.id,name:p.name,total,ts:Date.now()};i>=0?b[i]=e:b.push(e);b.sort((a,b)=>b.total-a.total);await S.set(`rt2:lb:${toDay()}`,b.slice(0,100),true);}catch{}}

// ─── XP / Level ───────────────────────────────────────────────────────────────
function xpForLevel(n){return n<=1?0:20*n*(n+1)-40;}
function levelFromXp(xp){let n=1;while(xpForLevel(n+1)<=xp)n++;return Math.min(n,50);}
function xpToNext(xp){const lv=levelFromXp(xp);if(lv>=50)return{pct:100,need:0,cur:0,lv:50};const need=xpForLevel(lv+1)-xpForLevel(lv);const cur=xp-xpForLevel(lv);return{pct:Math.round(cur/need*100),need,cur,lv};}

// ─── Keys ─────────────────────────────────────────────────────────────────────
const KEY_STAGES=[[0],[0,7,5],[0,7,5,2,10],[0,7,5,2,10,9,3],[0,7,5,2,10,9,3,4,8],[0,7,5,2,10,9,3,4,8,11,1],[0,1,2,3,4,5,6,7,8,9,10,11]];
const KEY_INFO={0:{name:"C Major",acc:0,notes:[]},7:{name:"G Major",acc:1,notes:["F#"]},5:{name:"F Major",acc:-1,notes:["B♭"]},2:{name:"D Major",acc:2,notes:["F#","C#"]},10:{name:"B♭ Major",acc:-2,notes:["B♭","E♭"]},9:{name:"A Major",acc:3,notes:["F#","C#","G#"]},3:{name:"E♭ Major",acc:-3,notes:["B♭","E♭","A♭"]},4:{name:"E Major",acc:4,notes:["F#","C#","G#","D#"]},8:{name:"A♭ Major",acc:-4,notes:["B♭","E♭","A♭","D♭"]},11:{name:"B Major",acc:5,notes:["F#","C#","G#","D#","A#"]},1:{name:"D♭ Major",acc:-5,notes:["B♭","E♭","A♭","D♭","G♭"]},6:{name:"F#/G♭",acc:6,notes:["F#","C#","G#","D#","A#","E#"]}};

// ─── Unlocks ──────────────────────────────────────────────────────────────────
const UNLOCKS=[
  {lv:1, type:"intervals",add:[7,12],choices:2,ivKeys:0,tier:2,name:"Perfect 5th & Octave",desc:"Your first two intervals — the open 5th and the unison octave.",tutKey:"multi-iv-7-12"},
  {lv:2, type:"intervals",add:[5],choices:3,tier:2,name:"Perfect 4th",desc:"The open, foundational 4th — feel the lift.",tutKey:"iv-5"},
  {lv:3, type:"intervals",add:[3,4],choices:3,tier:2,name:"Minor & Major 3rds",desc:"The emotional heart of harmony — dark vs. bright.",tutKey:"multi-iv-3-4"},
  {lv:4, type:"intervals",add:[9],choices:4,ivKeys:1,tier:2,name:"Major 6th + G & F Keys",desc:"Warm and lyrical, plus your first key signatures.",tutKey:"iv-9"},
  {lv:5, type:"intervals",add:[2,10],choices:4,tier:2,name:"Major 2nd & Minor 7th",desc:"Stepwise motion and dominant tension.",tutKey:"multi-iv-2-10"},
  {lv:6, type:"intervals",add:[1,11],choices:5,ivKeys:2,tier:2,name:"Minor 2nd & Major 7th + D & B♭",desc:"The extremes — sharp tension on both ends.",tutKey:"multi-iv-1-11"},
  {lv:7, type:"intervals",add:[6,8],choices:5,tier:2,name:"Tritone & Minor 6th",desc:"All 12 intervals now unlocked!",tutKey:"multi-iv-6-8"},
  {lv:8, type:"direction",tier:3,name:"Descending Intervals",desc:"Train both directions — your ear doubles in range.",tutKey:"feature-descending"},
  {lv:9, type:"ivKeys",stage:3,tier:1,name:"A & E♭ (Intervals)",desc:"Three sharps, three flats. The circle expands.",tutKey:"key-stage-3"},
  {lv:10,type:"fixedRoot",tier:3,name:"Fixed Root Practice",desc:"Lock a root note to drill specific interval colours.",tutKey:"feature-fixedroot"},
  {lv:11,type:"chords",add:["maj","min"],choices:2,chKeys:0,tier:4,name:"Chords Unlocked!",desc:"You've trained intervals — now hear what happens when you stack them.",tutKey:"mode-chords"},
  {lv:12,type:"ivKeys",stage:4,tier:1,name:"E & A♭ (Intervals)",desc:"Four sharps and flats for interval training.",tutKey:"key-stage-4"},
  {lv:13,type:"chords",add:["dom7"],choices:3,tier:2,name:"Dominant 7th Chord",desc:"The jazz workhorse — strong pull to resolve.",tutKey:"ch-dom7"},
  {lv:14,type:"chKeys",stage:1,tier:1,name:"G & F (Chords)",desc:"Expand chord training into the first key signatures.",tutKey:"key-stage-1"},
  {lv:15,type:"chords",add:["maj7"],choices:3,tier:2,name:"Major 7th Chord",desc:"Lush and dreamy — the ballad sound.",tutKey:"ch-maj7"},
  {lv:16,type:"scales",add:["major","natMin"],choices:2,scKeys:0,tier:4,name:"Scales Unlocked!",desc:"Scales are where chords come from — hear the full palette.",tutKey:"mode-scales"},
  {lv:17,type:"chords",add:["min7"],choices:4,chKeys:2,tier:2,name:"Minor 7th + D & B♭",desc:"Cool and mellow — plus D and B♭ for chords.",tutKey:"ch-min7"},
  {lv:18,type:"scales",add:["majPent","minPent"],choices:3,tier:2,name:"Pentatonic Scales",desc:"5 notes — universal, tension-free, pure melody.",tutKey:"sc-majPent"},
  {lv:19,type:"ivKeys",stage:5,tier:1,name:"B & D♭ (Intervals)",desc:"Five sharps and flats for interval training.",tutKey:"key-stage-5"},
  {lv:20,type:"chords",add:["dim","aug"],choices:4,tier:2,name:"Dim & Aug Chords",desc:"Unstable and mysterious — extreme symmetry.",tutKey:"ch-dim"},
  {lv:21,type:"scales",add:["blues"],choices:3,tier:2,name:"Blues Scale",desc:"Minor pentatonic + blue note — raw expressiveness.",tutKey:"sc-blues"},
  {lv:22,type:"scKeys",stage:1,tier:1,name:"G & F (Scales)",desc:"Expand scale training into the first key signatures.",tutKey:"key-stage-1"},
  {lv:23,type:"chords",add:["hdim7","dim7"],choices:5,chKeys:3,tier:2,name:"Half-Dim & Dim 7",desc:"Sophisticated jazz harmony.",tutKey:"ch-hdim7"},
  {lv:24,type:"scales",add:["dorian","mixolyd"],choices:4,tier:2,name:"Dorian & Mixolydian",desc:"The essential jazz modes.",tutKey:"sc-dorian"},
  {lv:25,type:"ivKeys",stage:6,tier:1,name:"All Keys (Intervals)",desc:"Every key now active for interval training.",tutKey:"key-stage-6"},
  {lv:26,type:"chords",add:["sus2","sus4"],choices:5,tier:2,name:"Suspended Chords",desc:"Ambiguous and floating — no third.",tutKey:"ch-sus2"},
  {lv:27,type:"scaleDir",tier:3,name:"Descending Scales",desc:"Hear scales falling — your ear expands again.",tutKey:"feature-descending"},
  {lv:28,type:"scKeys",stage:2,tier:1,name:"D & B♭ (Scales)",desc:"Two sharps and flats for scale training.",tutKey:"key-stage-2"},
  {lv:29,type:"chKeys",stage:4,tier:1,name:"E & A♭ (Chords)",desc:"Four sharps and flats for chord training.",tutKey:"key-stage-4"},
  {lv:30,type:"scales",add:["harmMin","melMin"],choices:5,tier:2,name:"Harmonic & Melodic Minor",desc:"Classical tension and jazz melodic motion.",tutKey:"sc-harmMin"},
  {lv:31,type:"progressions",add:["I_IV_V_I","I_vi_IV_V"],choices:2,pgKeys:0,tier:4,name:"Progressions Unlocked!",desc:"Scales gave you the notes. Progressions are the story they tell.",tutKey:"mode-progressions"},
  {lv:32,type:"scKeys",stage:3,tier:1,name:"A & E♭ (Scales)",desc:"Three sharps and flats for scale training.",tutKey:"key-stage-3"},
  {lv:33,type:"progressions",add:["I_V_vi_IV"],choices:3,tier:2,name:"I – V – vi – IV",desc:"The axis progression — omnipresent in modern music.",tutKey:"pg-I_V_vi_IV"},
  {lv:34,type:"chKeys",stage:5,tier:1,name:"B & D♭ (Chords)",desc:"Five sharps and flats for chord training.",tutKey:"key-stage-5"},
  {lv:35,type:"progressions",add:["ii_V_I"],choices:3,pgKeys:1,tier:2,name:"ii – V – I + G & F",desc:"The fundamental jazz cadence — the DNA of bebop.",tutKey:"pg-ii_V_I"},
  {lv:36,type:"scKeys",stage:4,tier:1,name:"E & A♭ (Scales)",desc:"Four sharps and flats for scale training.",tutKey:"key-stage-4"},
  {lv:37,type:"scales",add:["lydian","phrygian"],choices:5,tier:2,name:"Lydian & Phrygian",desc:"Dreamy raised 4th and moody flat 2nd.",tutKey:"sc-lydian"},
  {lv:38,type:"progressions",add:["iii_VI_ii_V"],choices:4,pgKeys:2,tier:2,name:"Jazz Turnaround",desc:"The classic cycle-of-5ths turnaround.",tutKey:"pg-iii_VI_ii_V"},
  {lv:39,type:"chKeys",stage:6,tier:1,name:"All Keys (Chords)",desc:"Every key active for chord training.",tutKey:"key-stage-6"},
  {lv:40,type:"progressions",add:["i_iv_V","blues"],choices:4,pgKeys:3,tier:2,name:"Minor & Blues Progressions",desc:"Raw emotion and 12-bar soul.",tutKey:"pg-blues"},
  {lv:41,type:"scales",add:["locrian","wholeTone"],choices:6,tier:2,name:"Exotic Scales",desc:"Locrian and Whole Tone — the outer edges of tonality.",tutKey:"sc-locrian"},
  {lv:42,type:"scKeys",stage:5,tier:1,name:"B & D♭ (Scales)",desc:"Five sharps and flats for scale training.",tutKey:"key-stage-5"},
  {lv:43,type:"progressions",add:["tritone"],choices:5,pgKeys:4,tier:2,name:"Tritone Substitution",desc:"Sophisticated jazz motion — the art of reharmonisation.",tutKey:"pg-tritone"},
  {lv:44,type:"tempo",tier:4,name:"Tempo Mode Unlocked!",desc:"The pulse is the foundation. Every note you've learned lives inside rhythm.",tutKey:"mode-tempo"},
  {lv:45,type:"scKeys",stage:6,tier:1,name:"All Keys (Scales)",desc:"Every key now active for scale training.",tutKey:"key-stage-6"},
  {lv:46,type:"pgKeys",stage:5,tier:1,name:"B & D♭ (Progressions)",desc:"Five sharps and flats for progression training.",tutKey:"key-stage-5"},
  {lv:47,type:"intervals",add:[13,14,15,16],choices:6,tier:2,name:"Compound Intervals",desc:"Beyond the octave — 9ths and 10ths.",tutKey:"multi-iv-13-14"},
  {lv:48,type:"pgKeys",stage:6,tier:1,name:"All Keys (Progressions)",desc:"Every key active for progression training.",tutKey:"key-stage-6"},
  {lv:49,type:"chords",add:["min9","maj9"],choices:6,tier:2,name:"9th Chords",desc:"The full jazz extension — rich and luminous.",tutKey:"ch-min9"},
  {lv:50,type:"intervals",add:[17,18,19,20,21,24],tier:2,name:"Master: Wide Intervals",desc:"11ths through two octaves. You've reached the summit.",tutKey:"multi-iv-17-21"},
];

function getContent(lv){
  const c={intervals:{pool:[],choices:2,keyStage:0},chords:{pool:[],choices:2,keyStage:0,on:false},scales:{pool:[],choices:2,keyStage:0,on:false},progressions:{pool:[],choices:2,keyStage:0,on:false},tempo:{on:false},dirOn:false,scaleDirOn:false,rootOn:false};
  for(const u of UNLOCKS){
    if(u.lv>lv)break;
    if(u.type==="intervals"){c.intervals.pool.push(...(u.add||[]));if(u.choices)c.intervals.choices=u.choices;if(u.ivKeys!==undefined)c.intervals.keyStage=u.ivKeys;}
    if(u.type==="ivKeys")    c.intervals.keyStage=u.stage;
    if(u.type==="chords"){c.chords.pool.push(...(u.add||[]));if(u.choices)c.chords.choices=u.choices;if(u.chKeys!==undefined)c.chords.keyStage=u.chKeys;c.chords.on=true;}
    if(u.type==="chKeys")    c.chords.keyStage=u.stage;
    if(u.type==="scales"){c.scales.pool.push(...(u.add||[]));if(u.choices)c.scales.choices=u.choices;if(u.scKeys!==undefined)c.scales.keyStage=u.scKeys;c.scales.on=true;}
    if(u.type==="scKeys")    c.scales.keyStage=u.stage;
    if(u.type==="progressions"){c.progressions.pool.push(...(u.add||[]));if(u.choices)c.progressions.choices=u.choices;if(u.pgKeys!==undefined)c.progressions.keyStage=u.pgKeys;c.progressions.on=true;}
    if(u.type==="pgKeys")    c.progressions.keyStage=u.stage;
    if(u.type==="tempo")     c.tempo.on=true;
    if(u.type==="direction") c.dirOn=true;
    if(u.type==="scaleDir")  c.scaleDirOn=true;
    if(u.type==="fixedRoot") c.rootOn=true;
  }
  return c;
}

// ─── Music Data ───────────────────────────────────────────────────────────────
const IV=[
  {id:1, abbr:"m2",name:"Minor 2nd",   q:"Half step — sharp, biting dissonance.",      ref:"Jaws theme (da-dum)"},
  {id:2, abbr:"M2",name:"Major 2nd",   q:"Whole step — smooth, stepwise motion.",       ref:"Happy Birthday (first two notes)"},
  {id:3, abbr:"m3",name:"Minor 3rd",   q:"Dark and introspective — the blues third.",   ref:"Smoke on the Water (opening)"},
  {id:4, abbr:"M3",name:"Major 3rd",   q:"Bright and stable — the sunny third.",        ref:"Oh! Susanna"},
  {id:5, abbr:"P4",name:"Perfect 4th", q:"Open and strong — foundational movement.",    ref:"Here Comes the Bride"},
  {id:6, abbr:"TT",name:"Tritone",     q:"Maximum tension — the devil's interval.",     ref:"The Simpsons (first two notes)"},
  {id:7, abbr:"P5",name:"Perfect 5th", q:"Pure power — the backbone of harmony.",       ref:"Star Wars main theme"},
  {id:8, abbr:"m6",name:"Minor 6th",   q:"Tender and bittersweet.",                     ref:"The Entertainer (opening)"},
  {id:9, abbr:"M6",name:"Major 6th",   q:"Warm and lyrical — jazz loves this one.",     ref:"My Bonnie Lies Over the Ocean"},
  {id:10,abbr:"m7",name:"Minor 7th",   q:"Dominant tension — irresistible pull to resolve.",ref:"Somewhere (West Side Story)"},
  {id:11,abbr:"M7",name:"Major 7th",   q:"Luminous and searching — almost resolved.",   ref:"Take On Me (chorus leap)"},
  {id:12,abbr:"P8",name:"Octave",      q:"Perfect unity — same note, new register.",    ref:"Somewhere Over the Rainbow"},
  {id:13,abbr:"m9",name:"Minor 9th",   q:"Like a minor 2nd — wider and more open.",    ref:"A minor 2nd stretched over an octave"},
  {id:14,abbr:"M9",name:"Major 9th",   q:"The classic jazz extension — expansive.",     ref:"A major 2nd over an octave"},
  {id:15,abbr:"m10",name:"Minor 10th", q:"A minor 3rd stretched across an octave.",     ref:"Sweet melancholy with extra depth"},
  {id:16,abbr:"M10",name:"Major 10th", q:"A major 3rd with extra warmth and space.",    ref:"Bright sunshine, expanded register"},
  {id:17,abbr:"P11",name:"Perf 11th",  q:"Like a 4th — open, floating.",               ref:"A 4th placed an octave higher"},
  {id:18,abbr:"A11",name:"Aug 11th",   q:"The Lydian sound — bright and elevated.",     ref:"Dreamy — Debussy or film scores"},
  {id:19,abbr:"P12",name:"Perf 12th",  q:"A 5th stretched — pure and resonant.",        ref:"Power and space — orchestral music"},
  {id:20,abbr:"m13",name:"Minor 13th", q:"Moody and complex — rich jazz colour.",       ref:"Deep jazz voicings"},
  {id:21,abbr:"M13",name:"Major 13th", q:"The full jazz extension — bright and complete.",ref:"Lush jazz chords and arrangements"},
  {id:24,abbr:"2P8",name:"Two Octaves",q:"Double the distance — perfectly unified.",    ref:"The outer edge of vocal range"},
];
const CH={
  maj:  {id:"maj",  name:"Major",       abbr:"Maj", ivs:[0,4,7],       q:"Bright and stable.",               formula:"Root + Major 3rd + Perfect 5th"},
  min:  {id:"min",  name:"Minor",       abbr:"min", ivs:[0,3,7],       q:"Dark and introspective.",           formula:"Root + Minor 3rd + Perfect 5th"},
  dim:  {id:"dim",  name:"Diminished",  abbr:"dim", ivs:[0,3,6],       q:"Tense and unstable.",               formula:"Root + Minor 3rd + Diminished 5th"},
  aug:  {id:"aug",  name:"Augmented",   abbr:"aug", ivs:[0,4,8],       q:"Mysterious and unresolved.",        formula:"Root + Major 3rd + Augmented 5th"},
  dom7: {id:"dom7", name:"Dominant 7",  abbr:"7",   ivs:[0,4,7,10],    q:"Strong pull to resolve — jazz workhorse.",formula:"Major chord + Minor 7th"},
  maj7: {id:"maj7", name:"Major 7",     abbr:"Maj7",ivs:[0,4,7,11],    q:"Lush and dreamy.",                  formula:"Major chord + Major 7th"},
  min7: {id:"min7", name:"Minor 7",     abbr:"m7",  ivs:[0,3,7,10],    q:"Cool and mellow.",                  formula:"Minor chord + Minor 7th"},
  hdim7:{id:"hdim7",name:"Half-Dim 7",  abbr:"ø7",  ivs:[0,3,6,10],    q:"Moody — the ii chord in minor.",    formula:"Diminished chord + Minor 7th"},
  dim7: {id:"dim7", name:"Dim 7",       abbr:"°7",  ivs:[0,3,6,9],     q:"Fully symmetric — maximum instability.",formula:"Diminished chord + Diminished 7th"},
  sus2: {id:"sus2", name:"Sus 2",       abbr:"sus2",ivs:[0,2,7],       q:"Open and floating — no third.",     formula:"Root + Major 2nd + Perfect 5th"},
  sus4: {id:"sus4", name:"Sus 4",       abbr:"sus4",ivs:[0,5,7],       q:"Ambiguous tension — suspended.",    formula:"Root + Perfect 4th + Perfect 5th"},
  min9: {id:"min9", name:"Minor 9",     abbr:"m9",  ivs:[0,3,7,10,14], q:"Rich jazz minor colour.",            formula:"Minor 7th chord + Major 9th"},
  maj9: {id:"maj9", name:"Major 9",     abbr:"Maj9",ivs:[0,4,7,11,14], q:"Expansive and luminous.",            formula:"Major 7th chord + Major 9th"},
};
const SC=[
  {id:"major",    name:"Major",           ivs:[0,2,4,5,7,9,11], q:"The universal bright scale.",         steps:"W–W–H–W–W–W–H", char:"Leading tone (M7) pulls home"},
  {id:"natMin",   name:"Natural Minor",   ivs:[0,2,3,5,7,8,10], q:"Dark and expressive Aeolian mode.",  steps:"W–H–W–W–H–W–W", char:"Flat 3, 6, and 7 give the dark tone"},
  {id:"harmMin",  name:"Harmonic Minor",  ivs:[0,2,3,5,7,8,11], q:"Classical tension, flamenco fire.",  steps:"W–H–W–W–H–A2–H", char:"Raised 7 creates exotic augmented 2nd"},
  {id:"melMin",   name:"Melodic Minor",   ivs:[0,2,3,5,7,9,11], q:"Jazz minor — smooth ascending.",     steps:"W–H–W–W–W–W–H", char:"Raised 6&7 smooth the melodic line"},
  {id:"dorian",   name:"Dorian",          ivs:[0,2,3,5,7,9,10], q:"Minor with raised 6th — jazz minor.",steps:"W–H–W–W–W–H–W", char:"Raised 6th is the Dorian fingerprint"},
  {id:"phrygian", name:"Phrygian",        ivs:[0,1,3,5,7,8,10], q:"Spanish/flamenco — flat 2nd rules.", steps:"H–W–W–W–H–W–W", char:"Flat 2nd creates the Spanish flavour"},
  {id:"lydian",   name:"Lydian",          ivs:[0,2,4,6,7,9,11], q:"Raised 4th — dreamy and floating.",  steps:"W–W–W–H–W–W–H", char:"Raised 4th (#4) is its magical colour"},
  {id:"mixolyd",  name:"Mixolydian",      ivs:[0,2,4,5,7,9,10], q:"Major with flat 7 — dominant mode.", steps:"W–W–H–W–W–H–W", char:"Flat 7 is the blues/rock fingerprint"},
  {id:"locrian",  name:"Locrian",         ivs:[0,1,3,5,6,8,10], q:"Flat 2nd & 5th — diminished feel.",  steps:"H–W–W–H–W–W–W", char:"Diminished 5th makes it most unstable"},
  {id:"majPent",  name:"Major Pentatonic",ivs:[0,2,4,7,9],       q:"5 notes, zero tension.",             steps:"W–W–m3–W–m3", char:"No semitones — universally singable"},
  {id:"minPent",  name:"Minor Pentatonic",ivs:[0,3,5,7,10],      q:"Rock and blues backbone.",           steps:"m3–W–W–m3–W", char:"Foundation of almost all rock guitar"},
  {id:"blues",    name:"Blues Scale",     ivs:[0,3,5,6,7,10],    q:"Minor pent + blue note.",            steps:"m3–W–H–H–m3–W",char:"Blue note (b5) is the soul of the blues"},
  {id:"wholeTone",name:"Whole Tone",      ivs:[0,2,4,6,8,10],    q:"Symmetric — Debussy-like.",          steps:"W–W–W–W–W–W", char:"All whole steps — completely symmetric"},
];
const SC_BY=Object.fromEntries(SC.map(s=>[s.id,s]));
const PG=[
  {id:"I_IV_V_I",   name:"I – IV – V – I",   chs:[{o:0,t:"maj"},{o:5,t:"maj"},{o:7,t:"maj"},{o:0,t:"maj"}],   q:"Western harmony's foundation."},
  {id:"I_vi_IV_V",  name:"I – vi – IV – V",  chs:[{o:0,t:"maj"},{o:9,t:"min"},{o:5,t:"maj"},{o:7,t:"maj"}],   q:"The 50s progression — timeless pop."},
  {id:"I_V_vi_IV",  name:"I – V – vi – IV",  chs:[{o:0,t:"maj"},{o:7,t:"maj"},{o:9,t:"min"},{o:5,t:"maj"}],   q:"Axis progression — modern pop DNA."},
  {id:"ii_V_I",     name:"ii – V – I",        chs:[{o:2,t:"min7"},{o:7,t:"dom7"},{o:0,t:"maj7"}],             q:"The fundamental jazz cadence."},
  {id:"iii_VI_ii_V",name:"iii – VI – ii – V", chs:[{o:4,t:"min7"},{o:9,t:"dom7"},{o:2,t:"min7"},{o:7,t:"dom7"}],q:"Classic cycle-of-5ths turnaround."},
  {id:"i_iv_V",     name:"i – iv – V",        chs:[{o:0,t:"min"},{o:5,t:"min"},{o:7,t:"maj"}],                q:"Minor blues — raw emotional pull."},
  {id:"blues",      name:"12-bar Blues",       chs:[{o:0,t:"dom7"},{o:5,t:"dom7"},{o:0,t:"dom7"},{o:7,t:"dom7"}],q:"The heartbeat of blues and rock."},
  {id:"tritone",    name:"ii – ♭VII – I",      chs:[{o:2,t:"min7"},{o:10,t:"dom7"},{o:0,t:"maj7"}],            q:"Tritone substitution — advanced jazz."},
];
const PG_BY=Object.fromEntries(PG.map(p=>[p.id,p]));

// ─── Mode intro text ──────────────────────────────────────────────────────────
const MODE_INTRO={
  chords:{headline:"From Intervals to Chords",icon:"♪",color:C.tan,body:"You've been hearing the distance between two individual notes. Chords are what happens when you stack those distances together — three or more notes sounding simultaneously. A major chord is built from a major 3rd (4 semitones) stacked on top of a perfect 5th (7 semitones). Your ear already knows those intervals. Now we're combining them into harmony.",tips:["A major chord = Root + Major 3rd + Perfect 5th","A minor chord = Root + Minor 3rd + Perfect 5th","The only difference is one semitone — yet the emotional shift is enormous"]},
  scales:{headline:"From Chords to Scales",icon:"〜",color:C.ashGrey,body:"Chords don't come from nowhere — they grow out of scales. A 7-note scale is a set of notes that feel natural together in a key. Every chord you know is built from every other note of a scale. The major scale (W–W–H–W–W–W–H) is where most Western harmony begins. Once you hear the scale, the chords make sense.",tips:["Scales are the vocabulary; chords are the sentences","The major scale uses: Whole–Whole–Half–Whole–Whole–Whole–Half","Every degree of a scale produces a different chord quality"]},
  progressions:{headline:"From Scales to Progressions",icon:"♫",color:C.drySage,body:"A chord progression is music in motion — chords moving through time in a pattern. Each chord in a scale has a Roman numeral (I, ii, iii…). Progressions are sequences of these numbered chords. The ii–V–I is the DNA of jazz. The I–IV–V–I is the heartbeat of the blues.",tips:["Roman numerals label the chord's position in the scale","Uppercase = major chord, lowercase = minor chord","The ii–V–I is the most important progression in jazz"]},
  tempo:{headline:"The Rhythmic Foundation",icon:"♩",color:C.azureMist,body:"Every interval, chord, scale, and progression you've trained on lives inside a rhythmic frame. Tempo is the heartbeat — the pulse that gives music its sense of time and motion. Training your internal metronome is one of the most overlooked yet transformative skills.",tips:["Listen for the beat, not just the first click","Count beats in groups of four — tap your foot on beat 1","A strong inner pulse means you can play anywhere, with anyone"]},
};

// ─── Audio ────────────────────────────────────────────────────────────────────
function sf(s){return 261.6256*Math.pow(2,s/12);}
function tone(ctx,freq,t,dur,vol=0.2,type="triangle"){const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.03);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.start(t);o.stop(t+dur);}
function clk(ctx,t,acc){const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type="sine";o.frequency.value=acc?1100:880;g.gain.setValueAtTime(acc?.35:.2,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.06);o.start(t);o.stop(t+0.1);}
function playOK(ctx){const n=ctx.currentTime;[0,4,7,12].forEach((s,i)=>tone(ctx,sf(s),n+i*.07,.25,.18));}
function playNG(ctx){const n=ctx.currentTime;tone(ctx,sf(-12),n,.45,.28);tone(ctx,sf(-11),n+.03,.4,.18);}
function scheduleAudio(ctx,q,dir){
  const n=ctx.currentTime;
  if(q.type==="interval"){const[a,b]=dir==="desc"?[q.nb,q.na]:[q.na,q.nb];tone(ctx,sf(a),n,.85);tone(ctx,sf(b),n+.75,.85);return 1700;}
  if(q.type==="chord"){CH[q.cid].ivs.forEach((iv,i)=>tone(ctx,sf(q.root+iv),n+i*.02,1.2));return 1600;}
  if(q.type==="scale"){const notes=[...SC_BY[q.cid].ivs,12];const ord=dir==="desc"?[...notes].reverse():notes;ord.forEach((iv,i)=>tone(ctx,sf(q.root+iv),n+i*.2,.28,.18));return ord.length*200+400;}
  if(q.type==="progression"){let t=n;PG_BY[q.cid].chs.forEach(ch=>{CH[ch.t].ivs.forEach((iv,i)=>tone(ctx,sf(q.root+ch.o+iv),t+i*.02,.9,.16));t+=1.25;});return PG_BY[q.cid].chs.length*1250+400;}
  if(q.type==="tempo"){const bMs=60000/q.cid;for(let i=0;i<q.beats;i++)clk(ctx,n+(i*bMs)/1000,i%4===0);return q.beats*bMs+300;}
  return 1000;
}
function playTutorialSound(ctx,tutKey){
  const n=ctx.currentTime;
  const ivMatch=tutKey?.match(/^(?:multi-)?iv-(.+)$/);
  if(ivMatch){const id=parseInt(ivMatch[1]);tone(ctx,sf(0),n,.85);tone(ctx,sf(id),n+.75,.85);return;}
  const chMatch=tutKey?.match(/^ch-(.+)$/);
  if(chMatch&&CH[chMatch[1]]){CH[chMatch[1]].ivs.forEach((iv,i)=>tone(ctx,sf(iv),n+i*.02,1.2));return;}
  const scMatch=tutKey?.match(/^sc-(.+)$/);
  if(scMatch&&SC_BY[scMatch[1]]){const notes=[...SC_BY[scMatch[1]].ivs,12];notes.forEach((iv,i)=>tone(ctx,sf(iv),n+i*.2,.28,.18));}
}

// ─── Adaptive ─────────────────────────────────────────────────────────────────
function initW(pool){const w={};pool.forEach(id=>{w[String(id)]=3;});return w;}
function wPick(pool,w){const tot=pool.reduce((s,id)=>s+(w[String(id)]||1),0);let r=Math.random()*tot;for(const id of pool){r-=(w[String(id)]||1);if(r<=0)return id;}return pool[pool.length-1];}
function wUpd(w,id,ok){const nw={...w},k=String(id);nw[k]=ok?Math.max(.4,(nw[k]||3)*.72):Math.min(9,(nw[k]||3)*1.5);return nw;}
function shuf(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function confChoices(pool,cid,n,cRow={}){
  const others=pool.filter(id=>String(id)!==String(cid));
  const sc=others.map(id=>({id,score:1+(cRow[String(id)]||0)*5}));
  const sel=[],rem=[...sc];
  for(let i=0;i<Math.min(n-1,rem.length);i++){const tot=rem.reduce((s,x)=>s+x.score,0);let r=Math.random()*tot;let ix=rem.length-1;for(let j=0;j<rem.length;j++){r-=rem[j].score;if(r<=0){ix=j;break;}}sel.push(rem[ix].id);rem.splice(ix,1);}
  return shuf([cid,...sel]);
}
function buildQ(mode,content,weights,confMatrix,fixedRoot,dir,playerLv){
  const keyPool=KEY_STAGES[content[mode]?.keyStage||0]||[0];
  const root=fixedRoot!==null?fixedRoot:keyPool[Math.floor(Math.random()*keyPool.length)];
  if(mode==="tempo"){const pool=playerLv>=47?[60,72,80,88,96,104,112,120,132,144,160]:[72,96,120,144];const cid=pool[Math.floor(Math.random()*pool.length)]||96;return{type:"tempo",cid,beats:8};}
  const cfg=content[mode];const cid=wPick(cfg.pool,weights[mode]||initW(cfg.pool));
  const cRow=(confMatrix[mode]||{})[String(cid)]||{};const choices=confChoices(cfg.pool,cid,cfg.choices,cRow);
  if(mode==="intervals") return{type:"interval",cid,na:root,nb:root+cid,oct:cfg.choices>=6?2:1,choices:choices.map(id=>IV.find(x=>x.id===id))};
  if(mode==="chords")    return{type:"chord",cid,root,choices:choices.map(id=>CH[id])};
  if(mode==="scales")    return{type:"scale",cid,root,choices:choices.map(id=>SC_BY[id])};
  return{type:"progression",cid,root,choices:choices.map(id=>PG_BY[id])};
}
function getLabel(q){
  if(!q)return null;
  if(q.type==="interval")    return IV.find(x=>x.id===q.cid);
  if(q.type==="chord")       return CH[q.cid];
  if(q.type==="scale")       return SC_BY[q.cid];
  if(q.type==="progression") return PG_BY[q.cid];
  if(q.type==="tempo")       return{name:`${q.cid} BPM`,q:"Feel the pulse."};
}
function calcXp(streak,ms){const spd=ms<3000?5:ms<8000?3:ms<18000?1:0;return 10+Math.min(streak,10)+spd;}
function calcTempoXp(streak,ms,acc){return Math.round(calcXp(streak,ms)*Math.exp(-3*acc));}

// ─── Piano ────────────────────────────────────────────────────────────────────
function Piano({na,nb,octs=1}){
  const WW=28,GAP=2,BW=16,BH=54,WH=88,U=WW+GAP;
  const WK=[0,2,4,5,7,9,11],BK=[[1,0],[3,1],[6,3],[8,4],[10,5]];
  const ws=[],bs=[];
  for(let o=0;o<octs;o++){
    WK.forEach((s,wi)=>{const abs=o*12+s;ws.push({abs,x:(o*7+wi)*U,a:abs===na,b:abs===nb});});
    BK.forEach(([s,aw])=>{const abs=o*12+s,x=(o*7+aw+1)*U-BW/2-1;bs.push({abs,x,a:abs===na,b:abs===nb});});
  }
  const tw=octs*7*U-GAP;
  return(
    <div style={{overflowX:"auto",margin:"2px 0 10px",display:"flex",justifyContent:"center"}}>
      <svg width={Math.min(tw,370)} height={WH} viewBox={`0 0 ${tw} ${WH}`} style={{display:"block",flexShrink:0}}>
        {ws.map(k=><rect key={k.abs} x={k.x} y={0} width={WW} height={WH} rx={3} fill={k.a?C.azureMist:k.b?"rgba(198,165,133,.35)":"white"} stroke={k.a?C.ashGrey:k.b?C.tan:C.drySage} strokeWidth={1.5}/>)}
        {bs.map(k=><rect key={k.abs} x={k.x} y={0} width={BW} height={BH} rx={2} fill={k.a?C.ashGrey:k.b?C.tan:C.granite}/>)}
        {ws.filter(k=>k.a||k.b).map(k=><circle key={`d${k.abs}`} cx={k.x+WW/2} cy={WH-10} r={4} fill={k.a?C.granite:C.tan}/>)}
        {bs.filter(k=>k.a||k.b).map(k=><circle key={`d${k.abs}`} cx={k.x+BW/2} cy={BH-9} r={3} fill={C.softLinen}/>)}
      </svg>
    </div>
  );
}
function ScalePiano({root,ivs}){
  const tones=new Set(ivs.map(iv=>(root+iv)%12));
  const WW=24,GAP=2,BW=14,BH=50,WH=80,U=WW+GAP;
  const WK=[0,2,4,5,7,9,11],BK=[[1,0],[3,1],[6,3],[8,4],[10,5]];
  const ws=WK.map((s,wi)=>({s,x:wi*U,on:tones.has(s)}));
  const bs=BK.map(([s,aw])=>({s,x:(aw+1)*U-BW/2-1,on:tones.has(s)}));
  const tw=7*U-GAP;
  return(
    <svg width={tw} height={WH} viewBox={`0 0 ${tw} ${WH}`}>
      {ws.map(k=><rect key={k.s} x={k.x} y={0} width={WW} height={WH} rx={3} fill={k.on?C.azureMist:"white"} stroke={k.on?C.ashGrey:C.drySage} strokeWidth={1.5}/>)}
      {bs.map(k=><rect key={k.s} x={k.x} y={0} width={BW} height={BH} rx={2} fill={k.on?C.ashGrey:C.granite}/>)}
    </svg>
  );
}

// ─── Tutorial Sheet ───────────────────────────────────────────────────────────
function TutorialSheet({tutKey,onClose}){
  const[playing,setPlaying]=useState(false);
  const audioRef=useRef(null);
  const getCtx=()=>{if(!audioRef.current)audioRef.current=new(window.AudioContext||window.webkitAudioContext)();return audioRef.current;};
  const playSound=async()=>{setPlaying(true);try{const ctx=getCtx();if(ctx.state==="suspended")await ctx.resume();playTutorialSound(ctx,tutKey);}catch{}setTimeout(()=>setPlaying(false),2000);};
  const ivMatch=tutKey?.match(/^(?:multi-)?iv-(.+)$/);
  const chMatch=tutKey?.match(/^ch-(.+)$/);
  const scMatch=tutKey?.match(/^sc-(.+)$/);
  const modeMatch=tutKey?.match(/^mode-(.+)$/);
  const pgMatch=tutKey?.match(/^pg-(.+)$/);
  const keyMatch=tutKey?.match(/^key-stage-(\d)$/);
  const featMatch=tutKey?.match(/^feature-(.+)$/);
  let content=null;
  if(modeMatch){const m=MODE_INTRO[modeMatch[1]];if(m)content={type:"mode",data:m};}
  else if(ivMatch){const ids=ivMatch[1].split("-").map(Number);const items=ids.map(id=>IV.find(x=>x.id===id)).filter(Boolean);content={type:"interval",items};}
  else if(chMatch){const ch=CH[chMatch[1]];if(ch)content={type:"chord",data:ch};}
  else if(scMatch){const sc=SC_BY[scMatch[1]];if(sc)content={type:"scale",data:sc};}
  else if(pgMatch){const pg=PG_BY[pgMatch[1]];if(pg)content={type:"progression",data:pg};}
  else if(keyMatch){const stage=parseInt(keyMatch[1]);const newKeys=KEY_STAGES[stage]?.filter(k=>!KEY_STAGES[stage-1]?.includes(k))||[];content={type:"key",keys:newKeys.map(k=>({root:k,...KEY_INFO[k]}))};}
  else if(featMatch){content={type:"feature",id:featMatch[1]};}
  const canPlay=ivMatch||chMatch||scMatch;
  const headings={mode:content?.data?.headline,interval:content?.items?.map(i=>i.name).join(" & "),chord:content?.data?.name,scale:content?.data?.name,key:"Key Signatures",feature:featMatch?.[1]==="descending"?"Descending Direction":"Fixed Root",progression:content?.data?.name};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.55)",zIndex:60,display:"flex",alignItems:"flex-end",animation:"ri_fadeIn .2s"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.softLinen,width:"100%",maxWidth:430,margin:"0 auto",borderRadius:"22px 22px 0 0",maxHeight:"88vh",display:"flex",flexDirection:"column",animation:"ri_slideSheet .3s ease"}}>
        <div style={{width:34,height:4,background:C.drySage,borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 18px 8px"}}>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:C.granite}}>{headings[content?.type]||"Learn"}</span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {canPlay&&<button onClick={playSound} disabled={playing} style={{background:C.granite,border:"none",borderRadius:8,padding:"5px 12px",color:C.softLinen,fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:700,cursor:playing?"default":"pointer",opacity:playing?.6:1}}>{playing?"Playing…":"▶ Play"}</button>}
            <button onClick={onClose} style={{background:"transparent",border:`1.5px solid ${C.drySage}`,borderRadius:7,padding:"4px 10px",fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:600,color:C.granite,cursor:"pointer"}}>Close</button>
          </div>
        </div>
        <div style={{overflowY:"auto",padding:"4px 18px 28px"}}>
          {content?.type==="mode"&&(<div><div style={{fontSize:48,textAlign:"center",marginBottom:10}}>{content.data.icon}</div><div style={{fontSize:13,color:C.granite,lineHeight:1.7,marginBottom:16}}>{content.data.body}</div><div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:600,color:C.granite,marginBottom:8}}>Key Principles</div>{content.data.tips.map((t,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}><div style={{width:6,height:6,borderRadius:"50%",background:content.data.color,flexShrink:0,marginTop:5}}/><div style={{fontSize:12,color:C.granite,lineHeight:1.5}}>{t}</div></div>))}</div>)}
          {content?.type==="interval"&&content.items.map((iv,idx)=>(<div key={iv.id} style={{marginBottom:idx<content.items.length-1?20:0}}>{content.items.length>1&&<div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite,marginBottom:8}}>{iv.name} ({iv.abbr})</div>}<Piano na={0} nb={iv.id<=12?iv.id:12} octs={iv.id>12?2:1}/><div style={{fontSize:13,color:C.granite,lineHeight:1.6,marginBottom:8}}>{iv.q}</div><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}><span style={{background:C.azureMist,borderRadius:6,padding:"3px 8px",fontSize:11,color:C.granite,fontWeight:600}}>{iv.id} semitone{iv.id!==1?"s":""}</span><span style={{background:C.drySage,borderRadius:6,padding:"3px 8px",fontSize:11,color:C.granite,fontWeight:600}}>Ref: {iv.ref}</span></div></div>))}
          {content?.type==="chord"&&(<div><Piano na={0} nb={content.data.ivs[content.data.ivs.length-1]} octs={content.data.ivs[content.data.ivs.length-1]>12?2:1}/><div style={{fontSize:13,color:C.granite,lineHeight:1.6,marginBottom:10}}>{content.data.q}</div><div style={{fontFamily:"'Fraunces',serif",fontSize:12,fontWeight:600,color:C.granite,marginBottom:6}}>Formula</div><div style={{background:"white",borderRadius:10,padding:"10px 12px",marginBottom:10,fontSize:12,color:C.granite,lineHeight:1.6}}>{content.data.formula}</div><div style={{fontFamily:"'Fraunces',serif",fontSize:12,fontWeight:600,color:C.granite,marginBottom:6}}>Intervals</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{content.data.ivs.map((iv,i)=>{const ivName=IV.find(x=>x.id===iv);return(<span key={i} style={{background:i===0?C.granite:C.azureMist,color:i===0?C.softLinen:C.granite,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>{i===0?"Root":ivName?`+${ivName.abbr}`:iv+"st"}</span>);})}</div></div>)}
          {content?.type==="scale"&&(<div><div style={{display:"flex",justifyContent:"center",marginBottom:10}}><ScalePiano root={0} ivs={content.data.ivs}/></div><div style={{fontSize:13,color:C.granite,lineHeight:1.6,marginBottom:10}}>{content.data.q}</div><div style={{background:"white",borderRadius:10,padding:"10px 12px",marginBottom:10}}><div style={{fontSize:10,fontWeight:600,color:C.ashGrey,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Step Pattern</div><div style={{fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:700,color:C.granite}}>{content.data.steps}</div><div style={{fontSize:10,color:C.ashGrey,marginTop:2}}>W = Whole step · H = Half step</div></div><div style={{background:C.azureMist,borderRadius:10,padding:"9px 12px",fontSize:12,color:C.granite,lineHeight:1.5}}><strong>Characteristic sound:</strong> {content.data.char}</div></div>)}
          {content?.type==="key"&&content.keys.map((k,i)=>(<div key={i} style={{marginBottom:i<content.keys.length-1?18:0,background:"white",borderRadius:12,padding:"12px 14px"}}><div style={{fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:700,color:C.granite,marginBottom:4}}>{k.name}</div><div style={{marginBottom:8}}><ScalePiano root={k.root} ivs={[0,2,4,5,7,9,11]}/></div>{k.notes.length===0?<div style={{fontSize:12,color:C.ashGrey}}>No sharps or flats.</div>:<div><div style={{fontSize:11,fontWeight:600,color:C.ashGrey,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>{k.acc>0?"Sharps":"Flats"}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{k.notes.map(n=><span key={n} style={{background:k.acc>0?"rgba(198,165,133,.2)":C.azureMist,borderRadius:5,padding:"2px 8px",fontSize:12,fontWeight:700,color:C.granite}}>{n}</span>)}</div></div>}</div>))}
          {content?.type==="feature"&&(<div>{featMatch[1]==="descending"&&<><div style={{fontSize:13,color:C.granite,lineHeight:1.7,marginBottom:12}}>Most beginners only train ascending — lowest to highest. But music moves in both directions. Adding descending practice forces your ear to identify intervals without relying on the upward direction as a cue.</div><div style={{background:C.azureMist,borderRadius:10,padding:"10px 12px",fontSize:12,color:C.granite,lineHeight:1.5}}>Tip: Sing the interval back in both directions after hearing it.</div></>}{featMatch[1]==="fixedroot"&&<><div style={{fontSize:13,color:C.granite,lineHeight:1.7,marginBottom:12}}>Locking a root note lets you drill the same interval from the same starting pitch repeatedly. This builds a deep "colour memory" for each interval from a specific root.</div><div style={{background:C.azureMist,borderRadius:10,padding:"10px 12px",fontSize:12,color:C.granite,lineHeight:1.5}}>Suggestion: Spend a session locked on C, then try the same intervals from G.</div></>}</div>)}
          {content?.type==="progression"&&(<div><div style={{fontSize:13,color:C.granite,lineHeight:1.6,marginBottom:10}}>{content.data.q}</div><div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:600,color:C.granite,marginBottom:8}}>Chord Movement (in C)</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{content.data.chs.map((ch,i)=>(<div key={i} style={{background:C.granite,borderRadius:8,padding:"6px 10px",textAlign:"center",minWidth:44}}><div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.softLinen}}>{NOTES[ch.o]}</div><div style={{fontSize:9,color:C.ashGrey,fontWeight:600}}>{CH[ch.t]?.abbr}</div></div>))}</div></div>)}
        </div>
      </div>
    </div>
  );
}

// ─── Tiered Level-Up overlay ──────────────────────────────────────────────────
function LevelUp({data,onDone}){
  const[showTut,setShowTut]=useState(false);
  const[tutKey,setTutKey]=useState(null);
  const tier=data.unlocks[0]?.tier||2;
  useEffect(()=>{
    if(tier>=4)return;
    const t=setTimeout(onDone,tier===1?2500:tier===3?6000:5000);
    return()=>clearTimeout(t);
  },[]);
  if(showTut)return <TutorialSheet tutKey={tutKey} onClose={()=>{setShowTut(false);onDone();}}/>;
  const named=data.unlocks.filter(u=>u.name);
  const mainUnlock=named[0];
  // TIER 1 — toast
  if(tier===1)return(
    <div style={{position:"fixed",bottom:90,right:16,zIndex:100,maxWidth:240,animation:"ri_slideIn .4s ease"}} onClick={onDone}>
      <div style={{background:C.granite,borderRadius:14,padding:"10px 14px",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:C.ashGrey,marginBottom:2}}>Level {data.level} · Unlocked</div>
        {named.map((u,i)=><div key={i} style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.softLinen}}>🗝 {u.name}</div>)}
      </div>
    </div>
  );
  // TIER 2 — standard modal
  if(tier===2)return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"ri_fadeIn .3s"}} onClick={onDone}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.softLinen,borderRadius:20,padding:"24px 20px",textAlign:"center",maxWidth:320,width:"100%",animation:"ri_bounceIn .5s cubic-bezier(.17,.67,.47,1.4)",position:"relative",overflow:"hidden"}}>
        {[...Array(8)].map((_,i)=><div key={i} style={{position:"absolute",width:6,height:6,borderRadius:"50%",background:[C.tan,C.granite,C.ashGrey][i%3],top:`${15+Math.floor(i/4)*30}%`,left:`${5+i*12}%`,animation:`ri_confetti ${1+Math.random()*.6}s ease ${Math.random()*.3}s forwards`,opacity:0,pointerEvents:"none"}}/>)}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",color:C.ashGrey,marginBottom:4}}>Level {data.level}</div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:700,color:C.granite,lineHeight:1,marginBottom:10}}>🔓 Unlocked</div>
        {named.map((u,i)=>(<div key={i} style={{marginBottom:8}}><div style={{fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:700,color:C.granite}}>{u.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2,lineHeight:1.4}}>{u.desc}</div></div>))}
        {mainUnlock?.tutKey&&<button onClick={()=>{setTutKey(mainUnlock.tutKey);setShowTut(true);}} style={{marginTop:10,background:C.granite,border:"none",borderRadius:9,padding:"8px 18px",fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,color:C.softLinen,cursor:"pointer"}}>Learn More →</button>}
        <div style={{marginTop:10,fontSize:10,color:C.ashGrey,fontStyle:"italic"}}>Tap anywhere to continue</div>
      </div>
    </div>
  );
  // TIER 3 — feature unlock
  if(tier===3)return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.85)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"ri_fadeIn .3s"}} onClick={onDone}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.softLinen,borderRadius:22,padding:"28px 22px",textAlign:"center",maxWidth:330,width:"100%",border:`3px solid ${C.tan}`,boxShadow:`0 0 40px rgba(198,165,133,.3)`,animation:"ri_bounceIn .5s cubic-bezier(.17,.67,.47,1.4)"}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:2.5,textTransform:"uppercase",color:C.ashGrey,marginBottom:6}}>Feature Unlocked · Level {data.level}</div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:34,fontWeight:700,color:C.granite,lineHeight:1,animation:"ri_pulse 1.5s ease infinite",marginBottom:4}}>✦</div>
        {named.map((u,i)=>(<div key={i} style={{marginBottom:10}}><div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:700,color:C.granite}}>{u.name}</div><div style={{fontSize:12,color:C.ashGrey,marginTop:3,lineHeight:1.5}}>{u.desc}</div></div>))}
        {mainUnlock?.tutKey&&<button onClick={()=>{setTutKey(mainUnlock.tutKey);setShowTut(true);}} style={{background:C.tan,border:"none",borderRadius:9,padding:"9px 20px",fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,color:"white",cursor:"pointer",marginTop:6}}>Learn More →</button>}
        <div style={{marginTop:10,fontSize:10,color:C.ashGrey,fontStyle:"italic"}}>Tap anywhere to continue</div>
      </div>
    </div>
  );
  // TIER 4 — epic mode unlock
  const mMode=mainUnlock?.tutKey?.replace("mode-","");
  const mInfo=mMode&&MODE_INTRO[mMode];
  const accentColor=mInfo?.color||C.tan;
  return(
    <div style={{position:"fixed",inset:0,background:`radial-gradient(ellipse at center,rgba(64,81,71,.95) 0%,rgba(20,30,20,.98) 100%)`,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"ri_fadeIn .4s"}} onClick={onDone}>
      {[...Array(22)].map((_,i)=><div key={i} style={{position:"fixed",width:Math.random()*8+4,height:Math.random()*8+4,borderRadius:"50%",background:[accentColor,C.softLinen,C.ashGrey,C.azureMist][i%4],top:`${Math.random()*100}%`,left:`${Math.random()*100}%`,animation:`ri_confetti ${1.5+Math.random()*1.5}s ease ${Math.random()*.6}s forwards`,opacity:0,pointerEvents:"none"}}/>)}
      <div onClick={e=>e.stopPropagation()} style={{background:"rgba(242,238,230,.04)",border:`2px solid ${accentColor}`,borderRadius:24,padding:"30px 22px",textAlign:"center",maxWidth:340,width:"100%",backdropFilter:"blur(10px)",boxShadow:`0 0 60px rgba(198,165,133,.25),0 0 120px rgba(64,81,71,.4)`,animation:"ri_bounceIn .6s cubic-bezier(.17,.67,.47,1.4)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:3,textTransform:"uppercase",color:accentColor,marginBottom:6}}>Level {data.level} · Major Unlock</div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:72,fontWeight:700,color:C.softLinen,lineHeight:1,animation:"ri_pulse 1.2s ease infinite",textShadow:`0 0 30px ${accentColor}`}}>{mInfo?.icon||"✦"}</div>
        {named.map((u,i)=>(<div key={i} style={{marginBottom:6}}><div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:700,color:C.softLinen,marginTop:10}}>{u.name}</div><div style={{fontSize:12,color:"rgba(242,238,230,.7)",marginTop:5,lineHeight:1.5}}>{u.desc}</div></div>))}
        <div style={{height:1,background:`rgba(198,165,133,.3)`,margin:"16px 0"}}/>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <button onClick={onDone} style={{background:"transparent",border:`1.5px solid rgba(242,238,230,.3)`,borderRadius:10,padding:"10px 18px",fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,color:C.softLinen,cursor:"pointer"}}>Start Practising</button>
          {mainUnlock?.tutKey&&<button onClick={()=>{setTutKey(mainUnlock.tutKey);setShowTut(true);}} style={{background:accentColor,border:"none",borderRadius:10,padding:"10px 18px",fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,color:"white",cursor:"pointer"}}>Learn More →</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Library (gated by playerLv) ──────────────────────────────────────────────
const LIB_TABS=[{id:"intervals",label:"Intervals",icon:"↔"},{id:"chords",label:"Chords",icon:"♪"},{id:"scales",label:"Scales",icon:"〜"},{id:"keys",label:"Keys",icon:"🗝"},{id:"progressions",label:"Progs",icon:"♫"}];
function LibraryScreen({playerLv,onBack}){
  const[tab,setTab]=useState("intervals");
  const[openTut,setOpenTut]=useState(null);
  const uc=getContent(playerLv);
  const ivSet=new Set(uc.intervals.pool);
  const chSet=new Set(uc.chords.pool);
  const scSet=new Set(uc.scales.pool);
  const pgSet=new Set(uc.progressions.pool);
  const maxKeyStage=Math.max(uc.intervals.keyStage,uc.chords.keyStage,uc.scales.keyStage,uc.progressions.keyStage);
  const keySet=new Set(KEY_STAGES[maxKeyStage]||[0]);
  const LockedMsg=({children})=>(<div style={{textAlign:"center",padding:"40px 20px",color:C.ashGrey}}><div style={{fontSize:36,marginBottom:10}}>🔒</div><div style={{fontSize:13,fontFamily:"'Fraunces',serif",fontWeight:600,color:C.granite,marginBottom:6}}>{children}</div><div style={{fontSize:11}}>Keep practising to unlock this section.</div></div>);
  return(
    <div style={{background:C.softLinen,minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:C.granite,padding:"24px 20px 14px"}}>
        <button onClick={onBack} style={{background:"transparent",border:"none",color:C.ashGrey,fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",padding:0,marginBottom:6}}>← Back</button>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:700,color:C.softLinen,lineHeight:1}}>Music <em style={{fontStyle:"italic",color:C.tan}}>Library</em></div>
        <div style={{fontSize:11,color:C.ashGrey,marginTop:3}}>Content unlocks as you level up</div>
      </div>
      <div style={{display:"flex",background:"white",borderBottom:`1.5px solid ${C.drySage}`,overflowX:"auto"}}>
        {LIB_TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{flex:"0 0 auto",padding:"9px 12px",border:"none",background:"transparent",fontFamily:"'Work Sans',sans-serif",fontSize:10,fontWeight:600,color:tab===t.id?C.granite:C.ashGrey,cursor:"pointer",borderBottom:`2.5px solid ${tab===t.id?C.granite:"transparent"}`,whiteSpace:"nowrap"}}>{t.icon} {t.label}</button>))}
      </div>
      <div style={{overflowY:"auto",padding:"14px 16px 28px",flex:1}}>
        {tab==="intervals"&&(<>
          {ivSet.size===0?<LockedMsg>No intervals unlocked yet</LockedMsg>:IV.filter(iv=>ivSet.has(iv.id)).map(iv=>(<div key={iv.id} onClick={()=>setOpenTut(`iv-${iv.id}`)} style={{display:"flex",alignItems:"center",background:"white",borderRadius:12,padding:"11px 14px",marginBottom:8,border:`1.5px solid ${C.drySage}`,cursor:"pointer"}}><div style={{flex:1}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{iv.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2}}>{iv.id} semitone{iv.id!==1?"s":""}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{background:C.azureMist,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,color:C.granite}}>{iv.abbr}</span><span style={{color:C.ashGrey,fontSize:12}}>›</span></div></div>))}
        </>)}
        {tab==="chords"&&(<>
          {!uc.chords.on?<LockedMsg>Chords unlock at Level 11</LockedMsg>:Object.values(CH).filter(ch=>chSet.has(ch.id)).map(ch=>(<div key={ch.id} onClick={()=>setOpenTut(`ch-${ch.id}`)} style={{display:"flex",alignItems:"center",background:"white",borderRadius:12,padding:"11px 14px",marginBottom:8,border:`1.5px solid ${C.drySage}`,cursor:"pointer"}}><div style={{flex:1}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{ch.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2}}>{ch.formula}</div></div><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{background:C.azureMist,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,color:C.granite}}>{ch.abbr}</span><span style={{color:C.ashGrey,fontSize:12}}>›</span></div></div>))}
        </>)}
        {tab==="scales"&&(<>
          {!uc.scales.on?<LockedMsg>Scales unlock at Level 16</LockedMsg>:SC.filter(sc=>scSet.has(sc.id)).map(sc=>(<div key={sc.id} onClick={()=>setOpenTut(`sc-${sc.id}`)} style={{display:"flex",alignItems:"center",background:"white",borderRadius:12,padding:"11px 14px",marginBottom:8,border:`1.5px solid ${C.drySage}`,cursor:"pointer"}}><div style={{flex:1}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{sc.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2,fontFamily:"monospace"}}>{sc.steps}</div></div><span style={{color:C.ashGrey,fontSize:12}}>›</span></div>))}
        </>)}
        {tab==="keys"&&(<>
          {maxKeyStage===0&&playerLv<4?<LockedMsg>Key signatures unlock at Level 4</LockedMsg>:KEY_STAGES[maxKeyStage].map(k=>{const ki=KEY_INFO[k];if(!ki)return null;return(<div key={k} onClick={()=>{const stage=KEY_STAGES.findIndex(s=>s.includes(k));setOpenTut(`key-stage-${Math.max(1,stage)}`);}} style={{display:"flex",alignItems:"center",background:"white",borderRadius:12,padding:"11px 14px",marginBottom:8,border:`1.5px solid ${C.drySage}`,cursor:"pointer"}}><div style={{flex:1}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{ki.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2}}>{ki.acc===0?"No sharps or flats":ki.acc>0?`${ki.acc} sharp${ki.acc>1?"s":""}: ${ki.notes.join(", ")}`:`${Math.abs(ki.acc)} flat${Math.abs(ki.acc)>1?"s":""}: ${ki.notes.join(", ")}`}</div></div><span style={{color:C.ashGrey,fontSize:12}}>›</span></div>);})}
        </>)}
        {tab==="progressions"&&(<>
          {!uc.progressions.on?<LockedMsg>Progressions unlock at Level 31</LockedMsg>:PG.filter(pg=>pgSet.has(pg.id)).map(pg=>(<div key={pg.id} onClick={()=>setOpenTut(`pg-${pg.id}`)} style={{display:"flex",alignItems:"center",background:"white",borderRadius:12,padding:"11px 14px",marginBottom:8,border:`1.5px solid ${C.drySage}`,cursor:"pointer"}}><div style={{flex:1}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{pg.name}</div><div style={{fontSize:11,color:C.ashGrey,marginTop:2}}>{pg.q}</div></div><span style={{color:C.ashGrey,fontSize:12}}>›</span></div>))}
        </>)}
      </div>
      {openTut&&<TutorialSheet tutKey={openTut} onClose={()=>setOpenTut(null)}/>}
    </div>
  );
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
function RoadmapSheet({currentLevel,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.5)",zIndex:40,display:"flex",alignItems:"flex-end",animation:"ri_fadeIn .2s"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.softLinen,width:"100%",maxWidth:430,margin:"0 auto",borderRadius:"22px 22px 0 0",maxHeight:"88vh",display:"flex",flexDirection:"column",animation:"ri_slideSheet .3s"}}>
        <div style={{width:34,height:4,background:C.drySage,borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px 8px"}}>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:C.granite}}>Level Roadmap</span>
          <button onClick={onClose} style={{background:"transparent",border:`1.5px solid ${C.drySage}`,borderRadius:7,padding:"4px 10px",fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:600,color:C.granite,cursor:"pointer"}}>Close</button>
        </div>
        <div style={{overflowY:"auto",padding:"8px 18px 28px"}}>
          {Array.from({length:50},(_,i)=>i+1).map(lv=>{
            const items=UNLOCKS.filter(u=>u.lv===lv&&u.name);
            const passed=lv<currentLevel,current=lv===currentLevel;
            return(
              <div key={lv} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:passed?C.granite:current?C.tan:C.drySage,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:11,fontWeight:700,color:passed||current?"white":C.ashGrey}}>{passed?"✓":lv}</span>
                </div>
                <div style={{flex:1,background:current?"white":passed?"rgba(64,81,71,.06)":C.softLinen,border:current?`2px solid ${C.granite}`:`1.5px solid ${passed?"transparent":C.drySage}`,borderRadius:12,padding:"8px 12px"}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:11,fontWeight:700,color:passed?C.ashGrey:C.granite}}>Lv {lv}{current?" — You are here":""}</div>
                  {items.map((u,i)=>(<div key={i} style={{marginTop:3}}><span style={{fontSize:11,fontWeight:600,color:u.tier===4?C.tan:u.tier===3?C.granite:passed?C.ashGrey:C.granite}}>{u.tier===4?"🔓 ":u.tier===3?"✦ ":"· "}{u.name}</span></div>))}
                  {!items.length&&<div style={{fontSize:10,color:C.ashGrey,marginTop:2}}>Practice and refinement</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Graph({history}){
  if(!Array.isArray(history)||!history.length)return (<div style={{textAlign:"center",padding:"20px 0",color:C.ashGrey,fontSize:12,fontStyle:"italic"}}>Play sessions will appear here.</div>);
  try{
    const data=history.slice(-14);const maxScore=Math.max(...data.map(d=>typeof d.total==="number"?d.total:0),1);
    const W=330,H=120,PB=24,PT=12,bSlot=(W-12)/data.length,bW=Math.max(6,bSlot-4);
    return(<svg width="100%" viewBox={`0 0 ${W} ${H}`}>{data.map((d,i)=>{const val=typeof d.total==="number"?d.total:0;const pct=val/maxScore,bH=Math.max(4,pct*(H-PT-PB));const x=6+i*bSlot+(bSlot-bW)/2,y=H-PB-bH;return(<g key={i}><rect x={x} y={y} width={bW} height={bH} fill={C.granite} rx={2} opacity={.82}/><text x={x+bW/2} y={H-PB+13} textAnchor="middle" fontSize={7} fill={C.ashGrey}>{(d.date||"").toString().slice(5).replace("-","/")}</text>{pct>.2&&<text x={x+bW/2} y={y-3} textAnchor="middle" fontSize={7} fill={C.granite} fontWeight="bold">{val}</text>}</g>);})}
    </svg>);
  }catch{return (<div style={{textAlign:"center",color:C.ashGrey,fontSize:12}}>Unable to render.</div>);}
}
const SMODES=[{id:"intervals",label:"Intervals",icon:"↔"},{id:"chords",label:"Chords",icon:"♪"},{id:"scales",label:"Scales",icon:"〜"},{id:"progressions",label:"Progs",icon:"♫"},{id:"tempo",label:"Tempo",icon:"♩"}];
function getItemName(mode,id){if(mode==="intervals"){const iv=IV.find(x=>x.id===Number(id));return iv?.abbr||id;}if(mode==="chords")return CH[id]?.name||id;if(mode==="scales")return SC_BY[id]?.name||id;if(mode==="progressions")return PG_BY[id]?.name||id;return`${id}bpm`;}
function bCol(p){return p>=75?C.granite:p>=45?C.ashGrey:C.tan;}
function StatsModal({stats,confMatrix,history,lb,profile,sessionScore,onClose}){
  const[tab,setTab]=useState("stats");const[am,setAm]=useState("intervals");
  const mAcc=m=>{const e=Object.values(stats[m]||{});if(!e.length)return null;const t=e.reduce((s,x)=>s+x.attempts,0),c=e.reduce((s,x)=>s+x.correct,0);return t>0?Math.round(c/t*100):null;};
  const rows=()=>Object.entries(stats[am]||{}).map(([id,e])=>({id,name:getItemName(am,id),...e,pct:e.attempts>0?Math.round(e.correct/e.attempts*100):0})).sort((a,b)=>a.pct-b.pct);
  const pairs=()=>{const p=[];for(const[cId,picks]of Object.entries(confMatrix[am]||{}))for(const[pId,cnt]of Object.entries(picks))if(String(cId)!==String(pId)&&cnt>0)p.push({cn:getItemName(am,cId),pn:getItemName(am,pId),count:cnt});return p.sort((a,b)=>b.count-a.count).slice(0,8);};
  const myRank=Array.isArray(lb)?lb.findIndex(e=>e.id===profile?.id)+1||null:null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.5)",zIndex:40,display:"flex",alignItems:"flex-end",animation:"ri_fadeIn .2s"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.softLinen,width:"100%",maxWidth:430,margin:"0 auto",borderRadius:"22px 22px 0 0",maxHeight:"90vh",display:"flex",flexDirection:"column",animation:"ri_slideSheet .3s"}}>
        <div style={{width:34,height:4,background:C.drySage,borderRadius:2,margin:"10px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px 8px"}}>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:C.granite}}>Progress</span>
          <button onClick={onClose} style={{background:"transparent",border:`1.5px solid ${C.drySage}`,borderRadius:7,padding:"4px 10px",fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:600,color:C.granite,cursor:"pointer"}}>Close</button>
        </div>
        <div style={{display:"flex",borderBottom:`1.5px solid ${C.drySage}`,padding:"0 18px"}}>
          {[["stats","Practice"],["board","Leaderboard"],["history","History"]].map(([t,l])=>(<button key={t} onClick={()=>setTab(t)} style={{padding:"8px 12px",border:"none",background:"transparent",fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:600,color:tab===t?C.granite:C.ashGrey,cursor:"pointer",borderBottom:`2px solid ${tab===t?C.granite:"transparent"}`}}>{l}</button>))}
        </div>
        <div style={{overflowY:"auto",padding:"14px 18px 24px",flex:1}}>
          {tab==="stats"&&(<>
            <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
              {SMODES.map(m=>{const acc=mAcc(m.id);return(<div key={m.id} onClick={()=>setAm(m.id)} style={{background:am===m.id?C.granite:"white",borderRadius:12,padding:"9px 10px",minWidth:66,textAlign:"center",border:`1.5px solid ${am===m.id?C.granite:C.drySage}`,cursor:"pointer",flexShrink:0}}><div style={{fontSize:16,marginBottom:2}}>{m.icon}</div><div style={{fontSize:8,fontWeight:600,letterSpacing:.6,textTransform:"uppercase",color:am===m.id?C.azureMist:C.ashGrey}}>{m.label}</div><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:am===m.id?C.softLinen:C.granite}}>{acc!==null?`${acc}%`:"—"}</div></div>);})}
            </div>
            {rows().length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.ashGrey,fontSize:12,fontStyle:"italic"}}>No data yet.</div>:rows().map(r=>(<div key={r.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{fontSize:10,fontWeight:600,color:C.granite,width:70,flexShrink:0}}>{r.name}</div><div style={{flex:1,height:5,background:C.softLinen,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${r.pct}%`,background:bCol(r.pct),borderRadius:3}}/></div><div style={{fontSize:10,fontWeight:700,color:bCol(r.pct),width:28,textAlign:"right"}}>{r.pct}%</div><div style={{fontSize:9,color:C.ashGrey,width:20}}>{r.attempts}×</div></div>))}
            {pairs().length>0&&<><div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:600,color:C.granite,margin:"14px 0 8px"}}>Most Confused</div>{pairs().map((p,i)=>(<div key={i} style={{background:"white",borderRadius:10,padding:"8px 12px",marginBottom:7,display:"flex",gap:8,alignItems:"center"}}><div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.tan,minWidth:22}}>{p.count}×</div><div style={{fontSize:11,color:C.granite}}>Picked <strong>{p.pn}</strong> · was <strong>{p.cn}</strong></div></div>))}</>}
          </>)}
          {tab==="board"&&(<>
            <div style={{fontSize:10,color:C.ashGrey,marginBottom:12,fontStyle:"italic"}}>Today · {toDay()}{myRank?` · Rank: #${myRank}`:""}</div>
            {sessionScore>0&&<div style={{background:C.azureMist,borderRadius:10,padding:"9px 12px",marginBottom:12,fontSize:11,color:C.granite}}>Session: <strong>{sessionScore.toLocaleString()} pts</strong> · Auto-saved</div>}
            {!Array.isArray(lb)||lb.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.ashGrey,fontSize:12,fontStyle:"italic"}}>No scores yet today.</div>:lb.slice(0,20).map((e,i)=>(<div key={e.id||i} style={{display:"flex",alignItems:"center",gap:10,background:e.id===profile?.id?"rgba(198,165,133,.1)":"white",border:`1.5px solid ${e.id===profile?.id?C.tan:C.drySage}`,borderRadius:10,padding:"9px 12px",marginBottom:7}}><span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:i===0?"#c9a227":i===1?C.ashGrey:i===2?C.tan:`#999`,minWidth:20}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span><span style={{flex:1,fontSize:12,fontWeight:600,color:C.granite}}>{e.name}{e.id===profile?.id?" (you)":""}</span><span style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{(e.total||0).toLocaleString()}</span></div>))}
          </>)}
          {tab==="history"&&(<>
            <div style={{background:"white",borderRadius:14,padding:14,marginBottom:12}}><Graph history={history}/></div>
            {Array.isArray(history)&&history.slice(-7).reverse().map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",background:"white",borderRadius:10,padding:"8px 12px",marginBottom:7,border:`1.5px solid ${C.drySage}`}}><span style={{flex:1,fontSize:12,fontWeight:600,color:C.granite}}>{d.date||"—"}</span><span style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{(d.total||0).toLocaleString()} pts</span></div>))}
          </>)}
        </div>
      </div>
    </div>
  );
}

// ─── Name Prompt ──────────────────────────────────────────────────────────────
function NamePrompt({onDone}){
  const[n,setN]=useState("");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(64,81,71,.7)",zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"white",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:340}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:C.granite,marginBottom:6}}>What's your name?</div>
        <div style={{fontSize:12,color:C.ashGrey,lineHeight:1.5,marginBottom:18}}>Appears on the leaderboard and in your score history.</div>
        <input value={n} onChange={e=>setN(e.target.value)} onKeyDown={e=>e.key==="Enter"&&n.trim()&&onDone(n.trim())} placeholder="Your name or alias…" autoFocus
          style={{width:"100%",padding:"11px 14px",border:`1.5px solid ${C.drySage}`,borderRadius:11,fontFamily:"'Work Sans',sans-serif",fontSize:16,color:C.granite,outline:"none",marginBottom:12}}/>
        <button onClick={()=>n.trim()&&onDone(n.trim())} disabled={!n.trim()} style={{width:"100%",padding:13,background:C.granite,border:"none",borderRadius:11,fontFamily:"'Work Sans',sans-serif",fontSize:13,fontWeight:700,color:C.softLinen,cursor:"pointer"}}>Start Tracking →</button>
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const Styles=()=>(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Work+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.softLinen};font-family:'Work Sans',sans-serif}
    .r-app{background:${C.softLinen};min-height:100dvh;max-width:430px;margin:0 auto;display:flex;flex-direction:column;padding-bottom:20px;overflow-x:hidden;transition:background .6s}
    .sk3{animation:ri_bgp3 2.5s ease infinite}.sk5{animation:ri_bgp5 2s ease infinite}.sk10{animation:ri_bgp10 1.4s ease infinite}
    @keyframes ri_bgp3{0%,100%{background:${C.softLinen}}50%{background:#ede8de}}@keyframes ri_bgp5{0%,100%{background:${C.softLinen}}50%{background:#e2dace}}@keyframes ri_bgp10{0%,100%{background:${C.softLinen}}50%{background:#d6d0c3}}
    /* Header — no ::after, clean bottom edge */
    .r-hdr{background:${C.granite};box-shadow:0 2px 12px rgba(64,81,71,.18)}
    .r-hdr-inner{padding:20px 16px 14px}
    .r-h-top{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}
    .r-brand{font-family:'Fraunces',serif;font-size:17px;font-weight:700;color:${C.softLinen};line-height:1;white-space:nowrap;cursor:pointer;border:none;background:transparent;padding:0}
    .r-brand em{font-style:italic;color:${C.tan}}
    .r-hbtn{background:transparent;border:1.5px solid rgba(242,238,230,.28);border-radius:7px;padding:3px 8px;color:${C.softLinen};font-family:'Work Sans',sans-serif;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0}
    .r-score-wrap{display:flex;align-items:baseline;gap:2px;position:relative;margin-left:auto;flex-shrink:0}
    .r-score-lbl{font-size:8px;color:${C.ashGrey};font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .r-score{font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:${C.tan}}
    .r-pts-flash{position:absolute;top:-12px;right:0;font-size:11px;font-weight:700;color:${C.tan};pointer-events:none;animation:ri_ptsUp 1.4s ease forwards;white-space:nowrap}
    @keyframes ri_ptsUp{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-22px)}}
    .sk-badge{display:inline-flex;align-items:center;gap:2px;border-radius:20px;padding:2px 7px;font-size:11px;font-weight:700;flex-shrink:0}
    .sk-badge.s3{background:rgba(198,165,133,.25);border:1px solid ${C.tan};color:${C.softLinen};animation:ri_badgePop .4s cubic-bezier(.17,.67,.47,1.4)}
    .sk-badge.s5{background:${C.tan};color:white;animation:ri_badgePop .4s cubic-bezier(.17,.67,.47,1.4),ri_glow5 1.5s ease infinite .4s;font-size:12px}
    .sk-badge.s10{background:linear-gradient(135deg,${C.tan},#e07b30);color:white;animation:ri_badgePop .4s cubic-bezier(.17,.67,.47,1.4),ri_glow10 1s ease infinite .4s;font-size:13px;box-shadow:0 0 16px rgba(198,165,133,.5)}
    @keyframes ri_badgePop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
    @keyframes ri_glow5{0%,100%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 10px rgba(198,165,133,.6)}}
    @keyframes ri_glow10{0%,100%{box-shadow:0 0 8px rgba(198,165,133,.4)}50%{box-shadow:0 0 22px rgba(198,165,133,.9)}}
    .r-xp-row{display:flex;align-items:center;gap:5px;margin-top:8px}
    .r-xp-lv{font-family:'Fraunces',serif;font-size:11px;font-weight:700;color:${C.softLinen};white-space:nowrap}
    .r-xp-track{flex:1;height:3px;background:rgba(255,255,255,.15);border-radius:2px;overflow:hidden}
    .r-xp-fill{height:100%;background:${C.tan};border-radius:2px;transition:width .6s ease}
    .r-xp-txt{font-size:9px;color:${C.ashGrey};font-weight:600;white-space:nowrap}
    .r-lives{display:flex;align-items:center;gap:3px;margin-left:8px}
    .r-pip{width:7px;height:7px;border-radius:50%;border:1.5px solid rgba(255,255,255,.2);background:transparent;transition:all .3s}
    .r-pip.hit{background:${C.tan};border-color:${C.tan}}
    .r-pip.dead{background:#e74c3c;border-color:#e74c3c;box-shadow:0 0 4px rgba(231,76,60,.6)}
    /* Mode nav — sits cleanly below header, no margin gap */
    .r-nav{display:flex;background:white;border-bottom:1.5px solid ${C.drySage}}
    .r-tab{flex:1;padding:8px 2px 6px;border:none;background:transparent;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;border-bottom:2.5px solid transparent;opacity:.4;transition:all .2s}
    .r-tab.on{border-bottom-color:${C.granite};opacity:1}
    .r-tab.locked{cursor:default;opacity:.18}
    .r-tab .mi{font-size:13px;line-height:1}
    .r-tab .ml{font-size:7.5px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:${C.ashGrey}}
    .r-tab.on .ml{color:${C.granite}}
    /* Timer bar */
    .r-tbar-wrap{margin:10px 16px 0;height:4px;background:${C.drySage};border-radius:2px;overflow:hidden}
    .r-tbar-fill{height:100%;border-radius:2px;transition:width 1s linear}
    .r-settings{display:flex;gap:5px;padding:8px 16px 0;flex-wrap:wrap}
    .r-pill{display:flex;align-items:center;gap:4px;background:white;border:1.5px solid ${C.drySage};border-radius:9px;padding:4px 8px}
    .r-pill label{font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${C.ashGrey}}
    .r-pill select{background:transparent;border:none;outline:none;font-family:'Work Sans',sans-serif;font-size:10px;font-weight:600;color:${C.granite};cursor:pointer}
    /* Question card */
    .r-card{margin:10px 16px 0;background:white;border-radius:18px;padding:16px;box-shadow:0 4px 20px rgba(64,81,71,.09);position:relative;overflow:hidden;animation:ri_fadeIn .2s ease}
    .r-card::before{content:'';position:absolute;top:0;right:0;width:52px;height:52px;background:${C.azureMist};border-radius:0 18px 0 52px;opacity:.5}
    .r-qlbl{font-size:9px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${C.ashGrey};margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
    .timer-chip{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px}
    .tf{background:rgba(64,81,71,.1);color:${C.granite}}.tm{background:rgba(198,165,133,.2);color:${C.tan}}.ts{background:rgba(192,57,43,.1);color:#c0392b}
    .info-chip{background:${C.softLinen};border-radius:8px;padding:5px 11px;font-size:11px;color:${C.granite};font-weight:500;text-align:center;margin-bottom:8px}
    .notes-row{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}
    .npill{border-radius:9px;padding:6px 11px;text-align:center;min-width:52px}
    .npa{background:${C.azureMist}}.npb{background:rgba(198,165,133,.2);border:1.5px solid ${C.tan}}
    .nnm{font-family:'Fraunces',serif;font-size:16px;font-weight:700;color:${C.granite};line-height:1}
    .nsub{font-size:9px;color:${C.ashGrey};font-weight:500}
    .m-icon{font-size:28px;text-align:center;margin:3px 0 7px;display:block}
    /* Play button with progress fill */
    .play-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:11px;background:${C.granite};color:${C.softLinen};border:none;border-radius:10px;font-family:'Work Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;margin-top:10px;position:relative;overflow:hidden}
    .play-btn:disabled{cursor:default;opacity:.7}
    .play-fill{position:absolute;left:0;top:0;height:100%;background:rgba(255,255,255,.18);pointer-events:none}
    @keyframes ri_playFill{from{width:0%}to{width:100%}}
    .play-btn-lbl{position:relative;z-index:1;display:flex;align-items:center;gap:6px}
    .wave-bars{display:flex;align-items:center;gap:2px;height:10px}
    .wave-bar{width:2px;border-radius:2px;background:${C.softLinen};animation:ri_wave .8s ease-in-out infinite}
    .wb1{animation-delay:0s;height:4px}.wb2{animation-delay:.15s;height:9px}.wb3{animation-delay:.3s;height:5px}.wb4{animation-delay:.1s;height:10px}.wb5{animation-delay:.25s;height:4px}
    @keyframes ri_wave{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.8)}}
    /* Choices */
    .r-choices{padding:10px 16px 0;position:relative}
    .choices-lbl{font-size:9px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${C.ashGrey};margin-bottom:7px}
    .choices-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .cbtn{padding:10px 7px;border:1.5px solid ${C.drySage};border-radius:11px;background:white;font-family:'Work Sans',sans-serif;font-size:11px;font-weight:500;color:${C.granite};cursor:pointer;transition:all .15s;text-align:center;line-height:1.3;animation:ri_fadeIn .2s ease}
    .cbtn:hover:not(:disabled){border-color:${C.ashGrey};background:${C.azureMist}}
    .cbtn:disabled{cursor:default}
    .cbtn.correct{background:${C.granite};border-color:${C.granite};color:${C.softLinen}}
    .cbtn.wrong{background:rgba(198,165,133,.18);border-color:${C.tan};color:${C.tan}}
    .cabbr{font-family:'Fraunces',serif;font-size:13px;font-weight:700;display:block;margin-bottom:1px}
    .bounce-msg{position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);font-family:'Fraunces',serif;font-size:16px;font-weight:700;pointer-events:none;animation:ri_bounce 1.1s ease forwards;z-index:10;white-space:nowrap}
    @keyframes ri_bounce{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}20%{transform:translateX(-50%) translateY(-10px) scale(1.2)}100%{opacity:0;transform:translateX(-50%) translateY(-40px) scale(0.85)}}
    /* Timeout announce bar */
    .timeout-bar{margin:8px 16px 0;background:rgba(198,165,133,.18);border:1.5px solid ${C.tan};border-radius:10px;padding:9px 13px;display:flex;align-items:center;gap:7px;animation:ri_slideUp .2s ease}
    @keyframes ri_slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    /* Tempo */
    .tempo-wrap{margin-top:10px;display:flex;gap:7px}
    .tempo-in{flex:1;padding:9px 12px;border:1.5px solid ${C.drySage};border-radius:10px;font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:${C.granite};background:white;outline:none;text-align:center}
    .tempo-in:focus{border-color:${C.ashGrey}}.tempo-in:disabled{opacity:.6;background:${C.softLinen}}
    .tempo-sub{padding:9px 12px;background:${C.granite};color:${C.softLinen};border:none;border-radius:10px;font-family:'Work Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
    .tempo-sub:disabled{opacity:.4;cursor:default}
    /* Session end */
    .end-overlay{position:fixed;inset:0;background:rgba(64,81,71,.6);z-index:35;display:flex;align-items:flex-end;animation:ri_fadeIn .25s}
    .end-sheet{background:${C.softLinen};width:100%;max-width:430px;margin:0 auto;border-radius:22px 22px 0 0;padding:18px 20px 24px;animation:ri_slideSheet .3s}
    .end-handle{width:34px;height:4px;background:${C.drySage};border-radius:2px;margin:0 auto 14px}
    .end-stats{display:flex;gap:7px;margin:12px 0 16px}
    .end-stat{flex:1;background:white;border-radius:10px;padding:9px;text-align:center;border:1.5px solid ${C.drySage}}
    .end-stat-val{font-family:'Fraunces',serif;font-size:19px;font-weight:700;color:${C.granite};line-height:1}
    .end-stat-lbl{font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${C.ashGrey};margin-top:2px}
    .end-btns{display:flex;gap:7px}
    .end-btn{flex:1;padding:12px;border:none;border-radius:12px;font-family:'Work Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer}
    .end-btn.p{background:${C.granite};color:${C.softLinen}}.end-btn.s{background:white;border:1.5px solid ${C.drySage};color:${C.granite}}
    /* Global */
    @keyframes ri_fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes ri_bounceIn{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
    @keyframes ri_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
    @keyframes ri_slideSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes ri_slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    @keyframes ri_confetti{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(120px) rotate(360deg)}}
  `}</style>
);

// ─── Hub ──────────────────────────────────────────────────────────────────────
function SubjectHub({xp,profile,lb,onSelect}){
  const{lv,pct}=xpToNext(xp);
  const myRank=Array.isArray(lb)?lb.findIndex(e=>e.id===profile?.id)+1:0;
  const myScore=Array.isArray(lb)?lb.find(e=>e.id===profile?.id)?.total||0:0;
  return(
    <div style={{background:C.softLinen,minHeight:"100dvh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      <div style={{background:C.granite,padding:"24px 20px 18px",boxShadow:"0 2px 12px rgba(64,81,71,.18)"}}>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:700,color:C.softLinen,lineHeight:1}}>Rhythmic<em style={{fontStyle:"italic",color:C.tan}}>.</em></div>
        <div style={{fontSize:11,color:C.ashGrey,marginTop:4}}>What would you like to work on?</div>
      </div>
      <div style={{padding:"20px 20px 0",display:"flex",flexDirection:"column",gap:12}}>
        {/* Ear Training */}
        <div onClick={()=>onSelect("earTraining")} style={{background:"white",borderRadius:20,padding:"20px",boxShadow:"0 4px 20px rgba(64,81,71,.09)",cursor:"pointer",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,right:0,width:80,height:80,background:C.azureMist,borderRadius:"0 20px 0 80px",opacity:.5}}/>
          <div style={{fontSize:28,marginBottom:8}}>🎵</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:C.granite,marginBottom:3}}>Ear Training</div>
          <div style={{fontSize:11,color:C.ashGrey,lineHeight:1.5,marginBottom:12}}>Identify intervals, chords, scales, progressions, and tempo by ear alone.</div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{flex:1,height:4,background:C.drySage,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:C.tan,borderRadius:2}}/></div>
            <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.granite}}>Lv {lv}</span>
          </div>
          <div style={{display:"inline-flex",alignItems:"center",background:C.granite,borderRadius:8,padding:"7px 14px"}}><span style={{fontSize:11,fontWeight:700,color:C.softLinen}}>Continue →</span></div>
        </div>
        {/* Library */}
        <div onClick={()=>onSelect("library")} style={{background:"white",borderRadius:20,padding:"20px",cursor:"pointer",border:`1.5px solid ${C.drySage}`,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,right:0,width:70,height:70,background:C.drySage,borderRadius:"0 20px 0 70px",opacity:.3}}/>
          <div style={{fontSize:28,marginBottom:8}}>📖</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:C.granite,marginBottom:3}}>Music Library</div>
          <div style={{fontSize:11,color:C.ashGrey,lineHeight:1.5,marginBottom:12}}>Everything you've unlocked — intervals, chords, scales, keys, and progressions.</div>
          <div style={{display:"inline-flex",alignItems:"center",background:C.tan,borderRadius:8,padding:"7px 14px"}}><span style={{fontSize:11,fontWeight:700,color:"white"}}>Open Library →</span></div>
        </div>
        {/* Leaderboard */}
        {Array.isArray(lb)&&lb.length>0&&(
          <div style={{background:"white",borderRadius:20,padding:"20px",border:`1.5px solid ${C.drySage}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:C.granite}}>Today's Board</div>
              <div style={{fontSize:10,color:C.ashGrey}}>{toDay()}</div>
            </div>
            {profile?.name&&myScore>0&&(
              <div style={{background:C.azureMist,borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.granite}}>You{myRank?` · #${myRank}`:""}</span>
                <span style={{flex:1}}/>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:C.granite}}>{myScore.toLocaleString()} pts</span>
              </div>
            )}
            {lb.slice(0,5).map((e,i)=>(
              <div key={e.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<4?`1px solid ${C.drySage}`:undefined}}>
                <span style={{fontSize:12,fontWeight:700,color:i===0?"#c9a227":i===1?C.ashGrey:i===2?C.tan:"#bbb",minWidth:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                <span style={{flex:1,fontSize:12,fontWeight:600,color:C.granite}}>{e.name}</span>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.granite}}>{(e.total||0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        {/* Sight Training locked */}
        <div style={{background:"white",borderRadius:20,padding:"20px",opacity:.45,border:`1.5px solid ${C.drySage}`,position:"relative"}}>
          <div style={{position:"absolute",top:12,right:14,fontSize:16}}>🔒</div>
          <div style={{fontSize:28,marginBottom:8,filter:"grayscale(1)"}}>👁</div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:C.granite,marginBottom:3}}>Sight Training</div>
          <div style={{fontSize:11,color:C.ashGrey,lineHeight:1.5}}>Read and recognise musical notation in real time. Coming soon.</div>
        </div>
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("hub");
  const[profile,setProfile]=useState(null);
  const[xp,setXp]=useState(0);
  const[lb,setLb]=useState([]);
  const refreshLb=()=>loadLB().then(b=>setLb(Array.isArray(b)?b:[])).catch(()=>{});
  useEffect(()=>{(async()=>{const p=await loadProfile();setProfile(p);setXp(p.etXp||0);})();},[]);
  useEffect(()=>{if(screen==="hub")refreshLb();},[screen]);
  if(!profile)return (<><Styles/><div style={{background:C.softLinen,minHeight:"100dvh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"'Fraunces',serif",fontSize:18,color:C.ashGrey,fontStyle:"italic"}}>Loading…</div></div></>);
  if(screen==="library")return (<><Styles/><LibraryScreen playerLv={levelFromXp(xp)} onBack={()=>setScreen("hub")}/></>);
  if(screen==="earTraining")return (<EarTraining xp={xp} setXp={setXp} profile={profile} setProfile={setProfile} onBack={()=>setScreen("hub")} onScoreUpdate={refreshLb}/>);
  return (<><Styles/><SubjectHub xp={xp} profile={profile} lb={lb} onSelect={s=>setScreen(s)}/></>);
}

// ─── Ear Training ─────────────────────────────────────────────────────────────
const INIT_MS={intervals:{f:0,s:0},chords:{f:0,s:0},scales:{f:0,s:0},progressions:{f:0,s:0},tempo:{f:0,s:0}};
const EMODES=[{id:"intervals",label:"Intervals",icon:"↔"},{id:"chords",label:"Chords",icon:"♪"},{id:"scales",label:"Scales",icon:"〜"},{id:"progressions",label:"Progs",icon:"♫"},{id:"tempo",label:"Tempo",icon:"♩"}];

function EarTraining({xp,setXp,profile,setProfile,onBack,onScoreUpdate}){
  const[mode,setMode]          =useState("intervals");
  const[dir,setDir]            =useState("asc");
  const[fixedRoot,setRoot]     =useState(null);
  const[question,setQuestion]  =useState(null);
  const[selected,setSelected]  =useState(null);
  const[playing,setPlaying]    =useState(false);
  const[revealed,setRevealed]  =useState(false);
  const[playFill,setPlayFill]  =useState(null); // {dur,id} for progress animation
  const[tempoG,setTempoG]      =useState("");
  const[tempoDone,setTempoD]   =useState(false);
  const[timeLeft,setTimeLeft]  =useState(TIME_LIMIT);
  const[playerLv,setPlayerLv] =useState(()=>levelFromXp(xp));
  const[content,setContent]   =useState(()=>getContent(levelFromXp(xp)));
  const[lvUpQ,setLvUpQ]        =useState([]);
  const[sessionScore,setSS]    =useState(0);
  const[modeMS,setModeMS]      =useState(INIT_MS);
  const[streak,setStreak]      =useState(0);
  const[bestStreak,setBest]    =useState(0);
  const[roundNum,setRound]     =useState(1);
  const[ptsFlash,setPtsFlash]  =useState(null);
  const[flashKey,setFlashKey]  =useState(0);
  const[bounceMsg,setBounce]   =useState(null);
  const[bounceKey,setBounceKey]=useState(0);
  const[weights,setWeights]    =useState({});
  const[conf,setConf]          =useState({});
  const[stats,setStats]        =useState({});
  const[showStats,setShowStats]=useState(false);
  const[showRoad,setShowRoad]  =useState(false);
  const[showEnd,setShowEnd]    =useState(false);
  const[endReason,setEndReason]=useState(null);
  const[showName,setShowName]  =useState(false);
  const[lb,setLb]              =useState([]);
  const[history,setHistory]    =useState([]);

  const audioRef=useRef(null);
  const playingR=useRef(false);
  const unlocked=useRef(false);
  const isFirstQ=useRef(true);
  const revealRef=useRef(null);
  const autoAdv=useRef(null);
  const timerRef=useRef(null);
  const prevDone=useRef({});
  const prevLvRef=useRef(levelFromXp(xp));
  const timeoutRef=useRef(false);
  // For gating next-question flow when level-up modal is open
  const lvUpActiveRef=useRef(false);
  const pendingNext=useRef(false);
  // Stable ref for handleNext so closures always get latest
  const handleNextRef=useRef(null);

  const getCtx=()=>{if(!audioRef.current)audioRef.current=new(window.AudioContext||window.webkitAudioContext)();return audioRef.current;};

  const anyModal=showStats||showRoad||showName||showEnd||lvUpQ.length>0;

  useEffect(()=>{
    if(profile?.id){loadHistory(profile.id).then(h=>setHistory(Array.isArray(h)?h:[])).catch(()=>{});}
    loadLB().then(b=>setLb(Array.isArray(b)?b:[])).catch(()=>{});
    const c=getContent(playerLv);setContent(c);
    const q=buildQ("intervals",c,{intervals:initW(c.intervals.pool)},{},null,"asc",playerLv);
    setQuestion(q);
  },[]);

  useEffect(()=>{
    lvUpActiveRef.current=lvUpQ.length>0;
  },[lvUpQ]);

  useEffect(()=>{
    if(!xp)return;
    const newLv=levelFromXp(xp);
    if(newLv>prevLvRef.current){
      const gained=UNLOCKS.filter(u=>u.lv>prevLvRef.current&&u.lv<=newLv&&u.name);
      const byLv={};gained.forEach(u=>{(byLv[u.lv]=byLv[u.lv]||[]).push(u);});
      const entries=Object.entries(byLv).sort((a,b)=>+a[0]-+b[0]).map(([lv,unlocks])=>({level:parseInt(lv),unlocks}));
      if(entries.length){lvUpActiveRef.current=true;setLvUpQ(q=>[...q,...entries]);}
      prevLvRef.current=newLv;setPlayerLv(newLv);setContent(getContent(newLv));
    }
  },[xp]);

  const stopTimer=useCallback(()=>{clearInterval(timerRef.current);timerRef.current=null;},[]);
  const startTimer=useCallback(()=>{
    stopTimer();
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{if(t<=1){stopTimer();return 0;}return t-1;});},1000);
  },[stopTimer]);

  useEffect(()=>{
    if(timeLeft===0&&revealed&&selected===null&&!timeoutRef.current){
      timeoutRef.current=true;
      setSelected("timeout");
      try{const ctx=getCtx();playNG(ctx);}catch{}
      setModeMS(prev=>{const ms={...prev[mode]};ms.f+=1;ms.s+=1;return{...prev,[mode]:ms};});
      setStreak(0);setBounce("💔");setBounceKey(k=>k+1);
      autoAdv.current=setTimeout(()=>handleNextRef.current?.(),2000);
    }
  },[timeLeft,revealed,selected,mode]);

  useEffect(()=>{
    if(!revealed||selected!==null||anyModal){stopTimer();return;}
    const ms=modeMS[mode];
    if(ms.f>=MAX_FAILS||ms.s>=MAX_SCORED){stopTimer();return;}
    timeoutRef.current=false;startTimer();
    return()=>stopTimer();
  },[revealed,selected,anyModal,mode]);

  useEffect(()=>{
    const ms=modeMS[mode];const wasDone=prevDone.current[mode];const isDone=ms.f>=MAX_FAILS||ms.s>=MAX_SCORED;
    if(!wasDone&&isDone){prevDone.current={...prevDone.current,[mode]:true};setEndReason(ms.f>=MAX_FAILS?"lives":"rounds");setShowEnd(true);}
  },[modeMS,mode]);

  // Auto-play new question — only if no level-up modal pending
  useEffect(()=>{
    if(!question)return;
    if(isFirstQ.current){isFirstQ.current=false;return;}
    if(!unlocked.current)return;
    if(lvUpActiveRef.current)return; // wait for modal to clear
    const t=setTimeout(()=>doPlay(question,true),300);
    return()=>clearTimeout(t);
  },[question]);

  const scheduleReveal=(dur)=>{
    setRevealed(false);clearTimeout(revealRef.current);
    revealRef.current=setTimeout(()=>setRevealed(true),dur);
  };

  const doPlay=useCallback(async(q,autoplay=false)=>{
    if(!q||playingR.current)return;
    playingR.current=true;setPlaying(true);
    try{
      const ctx=getCtx();if(ctx.state==="suspended")await ctx.resume();unlocked.current=true;
      const dur=scheduleAudio(ctx,q,dir);
      // Button progress bar fill — only when revealing for the first time
      if(!revealed){
        const fillId=Date.now();
        setPlayFill({dur,id:fillId});
        scheduleReveal(dur);
      }
      setTimeout(()=>{playingR.current=false;setPlaying(false);setPlayFill(null);},dur+100);
    }catch{playingR.current=false;setPlaying(false);setPlayFill(null);}
  },[dir,revealed]);

  const handleNext=useCallback(()=>{
    clearTimeout(autoAdv.current);stopTimer();timeoutRef.current=false;
    setBounce(null); // clear stale bounce before new question mounts
    setSelected(null);setPlaying(false);setPlayFill(null);
    setTempoG("");setTempoD(false);
    setRevealed(false);setTimeLeft(TIME_LIMIT);setRound(r=>r+1);
    const pool=mode!=="tempo"?content[mode]?.pool:null;
    const w=mode!=="tempo"?(weights[mode]||initW(pool||[])):[];
    if(!pool&&mode!=="tempo")return;
    const q=buildQ(mode,content,{[mode]:w},conf,fixedRoot,dir,playerLv);
    setQuestion(q);
  },[mode,content,weights,conf,fixedRoot,dir,playerLv,stopTimer]);

  // Keep ref current every render
  handleNextRef.current=handleNext;

  // Level-up dismiss handler — triggers pending next if last modal
  const handleLvUpDone=()=>{
    setLvUpQ(prev=>{
      const next=prev.slice(1);
      if(next.length===0){
        lvUpActiveRef.current=false;
        if(pendingNext.current){
          pendingNext.current=false;
          setTimeout(()=>handleNextRef.current?.(),80);
        }
      }
      return next;
    });
  };

  const handleAnswer=(id)=>{
    if(selected!==null)return;
    stopTimer();clearTimeout(autoAdv.current);timeoutRef.current=true;
    const elapsed=(TIME_LIMIT-timeLeft)*1000;
    const cid=question.cid;const ok=String(id)===String(cid);
    setSelected(id);
    try{const ctx=getCtx();ok?playOK(ctx):playNG(ctx);}catch{}
    const curMs=modeMS[mode];const scoring=curMs.f<MAX_FAILS&&curMs.s<MAX_SCORED;
    setWeights(prev=>{const nw={...prev};if(mode!=="tempo"&&content[mode]?.pool)nw[mode]=wUpd(prev[mode]||initW(content[mode].pool),cid,ok);return nw;});
    if(!ok)setConf(prev=>{const mC=prev[mode]||{},cR=mC[String(cid)]||{};return{...prev,[mode]:{...mC,[String(cid)]:{...cR,[String(id)]:(cR[String(id)]||0)+1}}};});
    setStats(prev=>{const mS=prev[mode]||{},e=mS[String(cid)]||{attempts:0,correct:0};return{...prev,[mode]:{...mS,[String(cid)]:{attempts:e.attempts+1,correct:e.correct+(ok?1:0)}}};});
    setModeMS(prev=>{const ms={...prev[mode]};if(!ok)ms.f+=1;ms.s+=1;return{...prev,[mode]:ms};});
    let xpE=0,pts=0;
    if(ok){
      const ns=streak+1;setStreak(ns);setBest(b=>Math.max(b,ns));
      xpE=question.type==="tempo"?calcTempoXp(ns,elapsed,Math.abs(parseInt(id,10)-cid)/cid):calcXp(ns,elapsed);
      if(scoring)pts=xpE;setBounce(`+${xpE}`);setBounceKey(k=>k+1);
    }else{setStreak(0);setBounce("💔");setBounceKey(k=>k+1);}
    if(xpE>0){
      const newXp=xp+xpE;setXp(newXp);setPtsFlash(xpE);setFlashKey(k=>k+1);
      (async()=>{if(profile){const p={...profile,etXp:newXp};setProfile(p);await saveProfile(p);}})();
    }
    if(pts>0){
      const ns2=sessionScore+pts;setSS(ns2);
      (async()=>{
        if(profile?.name){
          await submitLB(profile,ns2);await saveHistory(profile.id,{date:toDay(),total:ns2});
          const[nlb,nh]=await Promise.all([loadLB(),loadHistory(profile.id)]);
          setLb(Array.isArray(nlb)?nlb:[]);setHistory(Array.isArray(nh)?nh:[]);
          onScoreUpdate?.();
        }else setShowName(true);
      })();
    }
    if(pts>0&&!profile?.name)setShowName(true);
    // Defer next question if level-up modal is about to show
    autoAdv.current=setTimeout(()=>{
      if(lvUpActiveRef.current){pendingNext.current=true;}
      else{handleNextRef.current?.();}
    },700);
  };

  const switchMode=(m)=>{
    if(!(m==="intervals"||(m==="tempo"?content.tempo.on:content[m]?.on)))return;
    clearTimeout(autoAdv.current);stopTimer();timeoutRef.current=false;
    setBounce(null);setMode(m);setSelected(null);setPlaying(false);setPlayFill(null);
    setTempoG("");setTempoD(false);setRevealed(false);setTimeLeft(TIME_LIMIT);setRound(1);
    const pool=m!=="tempo"?content[m]?.pool:null;
    const w=m!=="tempo"?(weights[m]||initW(pool||[])):[];
    const q=buildQ(m,content,{[m]:w},conf,fixedRoot,dir,playerLv);
    setQuestion(q);isFirstQ.current=true;
  };

  const handleNameDone=async(name)=>{
    const p={...profile,name};setProfile(p);await saveProfile(p);setShowName(false);
    if(sessionScore>0){await submitLB(p,sessionScore);const nlb=await loadLB();setLb(Array.isArray(nlb)?nlb:[]);onScoreUpdate?.();}
  };

  if(!question)return null;

  const xpInfo=xpToNext(xp);
  const ms=modeMS[mode];
  const modeDone=ms.f>=MAX_FAILS||ms.s>=MAX_SCORED;
  const timerPct=timeLeft/TIME_LIMIT*100;
  const timerColor=timeLeft>30?C.granite:timeLeft>15?C.tan:"#e74c3c";
  const timerCls=timeLeft>30?"tf":timeLeft>15?"tm":"ts";
  const showDir=(mode==="intervals"&&content.dirOn)||(mode==="scales"&&content.scaleDirOn);
  const showRoot=(mode==="intervals"||mode==="chords"||mode==="scales"||mode==="progressions")&&content.rootOn;
  const availableRoots=KEY_STAGES[content[mode]?.keyStage||0]||[0];
  const skCls=streak>=10?"s10":streak>=5?"s5":streak>=3?"s3":"";
  const appSkCls=streak>=10?"sk10":streak>=5?"sk5":streak>=3?"sk3":"";
  const numChoices=question.choices?.length||0;
  const modePct=ms.s>0?Math.round((ms.s-ms.f)/ms.s*100):0;
  const choiceLabel=(id)=>{
    if(question.type==="interval"){const iv=IV.find(x=>x.id===id);return{abbr:iv?.abbr,name:iv?.name};}
    if(question.type==="chord")   return{abbr:CH[id]?.abbr,name:CH[id]?.name};
    if(question.type==="scale")   return{abbr:null,name:SC_BY[id]?.name};
    if(question.type==="progression")return{abbr:null,name:PG_BY[id]?.name};
    return{abbr:null,name:String(id)};
  };
  const showTimer=revealed&&selected===null&&!modeDone;
  const isReplaying=playing&&revealed;
  const isFirstPlay=playing&&!revealed;

  return(
    <>
      <Styles/>
      <div className={`r-app${appSkCls?" "+appSkCls:""}`}>

        {/* Header */}
        <div className="r-hdr">
          <div className="r-hdr-inner">
            <div className="r-h-top">
              <button className="r-brand" onClick={onBack}>← <em>Rhythmic</em></button>
              {streak>=3&&<span key={`sk${streak}`} className={`sk-badge ${skCls}`}>🔥{streak}</span>}
              <div className="r-score-wrap">
                {ptsFlash&&<div key={`pf${flashKey}`} className="r-pts-flash">+{ptsFlash}xp</div>}
                <span className="r-score-lbl" style={{marginRight:2}}>PTS</span>
                <span className="r-score">{sessionScore.toLocaleString()}</span>
              </div>
              <button className="r-hbtn" onClick={()=>setShowStats(true)}>Progress</button>
              <button className="r-hbtn" onClick={()=>setShowRoad(true)}>Map</button>
            </div>
            <div className="r-xp-row">
              <span className="r-xp-lv">Lv {xpInfo.lv}</span>
              <div className="r-xp-track"><div className="r-xp-fill" style={{width:`${xpInfo.pct}%`}}/></div>
              <span className="r-xp-txt">{xpInfo.cur}/{xpInfo.cur+xpInfo.need} xp</span>
              <div className="r-lives">
                {[0,1,2].map(i=><div key={i} className={`r-pip${ms.f>i?ms.f>=MAX_FAILS?" dead":" hit":""}`}/>)}
              </div>
            </div>
          </div>
        </div>

        {/* Mode nav — directly below header, no gap */}
        <div className="r-nav">
          {EMODES.map(m=>{
            const isOn=m.id==="intervals"||(m.id==="tempo"?content.tempo.on:content[m.id]?.on||false);
            const active=mode===m.id;
            return(<button key={m.id} className={`r-tab${active?" on":""}${!isOn?" locked":""}`} onClick={()=>isOn&&switchMode(m.id)}><span className="mi">{m.icon}</span><span className="ml">{isOn?m.label:"🔒"}</span></button>);
          })}
        </div>

        {/* Settings */}
        {(showRoot||showDir)&&(
          <div className="r-settings">
            {showRoot&&(<div className="r-pill"><label>Root</label><select value={fixedRoot===null?"rnd":String(fixedRoot)} onChange={e=>{const v=e.target.value==="rnd"?null:Number(e.target.value);setRoot(v);const q=buildQ(mode,content,{[mode]:weights[mode]||initW(content[mode]?.pool||[])},conf,v,dir,playerLv);setQuestion(q);setRevealed(false);isFirstQ.current=true;setSelected(null);setBounce(null);}}><option value="rnd">Random</option>{availableRoots.map(i=><option key={i} value={String(i)}>{NOTES[i]}</option>)}</select></div>)}
            {showDir&&(<div className="r-pill"><label>Dir</label><select value={dir} onChange={e=>setDir(e.target.value)}><option value="asc">↑ Asc</option><option value="desc">↓ Desc</option></select></div>)}
          </div>
        )}

        {/* Timer bar */}
        {showTimer&&(
          <div className="r-tbar-wrap">
            <div className="r-tbar-fill" style={{width:`${timerPct}%`,background:timerColor}}/>
          </div>
        )}

        {/* Question card */}
        <div className="r-card">
          <div className="r-qlbl">
            <span>Round {roundNum} · {EMODES.find(m=>m.id===mode)?.label}</span>
            {showTimer&&<span className={`timer-chip ${timerCls}`}>⏱ {timeLeft}s</span>}
          </div>
          {question.type==="interval"&&<Piano na={question.na} nb={question.nb} octs={question.oct}/>}
          {question.type==="interval"&&(<div className="notes-row"><div className="npill npa"><div className="nnm">{NOTES[question.na%12]}</div><div className="nsub">Root</div></div><span style={{fontSize:14,color:C.drySage}}>{dir==="desc"?"←":"→"}</span><div className="npill npb"><div className="nnm">{NOTES[question.nb%12]}</div><div className="nsub">Oct {4+Math.floor(question.nb/12)}</div></div></div>)}
          {question.type==="chord"&&<><span className="m-icon">♪</span><div className="info-chip">{fixedRoot!==null?`Key of ${NOTES[fixedRoot]}`:"Random key"} · Chord quality</div></>}
          {question.type==="scale"&&<><span className="m-icon">〜</span><div className="info-chip">{fixedRoot!==null?`Root: ${NOTES[fixedRoot]}`:"Random root"} · {dir==="desc"?"↓ Descending":"↑ Ascending"}</div></>}
          {question.type==="progression"&&<><span className="m-icon">♫</span><div className="info-chip">{fixedRoot!==null?`Key of ${NOTES[fixedRoot]}`:"Random key"} · Progression</div></>}
          {question.type==="tempo"&&<><span className="m-icon">♩</span><div className="info-chip">Listen to the pulse · What is the BPM?</div></>}

          {/* Play button — shows progress fill during first play, wave bars during replay */}
          <button
            className="play-btn"
            onClick={()=>doPlay(question)}
            disabled={playing}
            style={{cursor:playing?"default":"pointer"}}
          >
            {/* Progress fill only during first play (revealing) */}
            {playFill&&!revealed&&(
              <div
                key={playFill.id}
                className="play-fill"
                style={{animationName:"ri_playFill",animationDuration:`${playFill.dur}ms`,animationTimingFunction:"linear",animationFillMode:"forwards"}}
              />
            )}
            <span className="play-btn-lbl">
              {isReplaying&&<><div className="wave-bars"><div className="wave-bar wb1"/><div className="wave-bar wb2"/><div className="wave-bar wb3"/><div className="wave-bar wb4"/><div className="wave-bar wb5"/></div>Replaying…</>}
              {isFirstPlay&&"Listening…"}
              {!playing&&(unlocked.current?"↺ Replay":"▶ Play")}
            </span>
          </button>

          {question.type==="tempo"&&revealed&&(
            <div>
              <div className="tempo-wrap">
                <input type="number" className="tempo-in" value={tempoG} placeholder="BPM" min={30} max={300} disabled={tempoDone} onChange={e=>setTempoG(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!tempoDone&&tempoG){setTempoD(true);handleAnswer(parseInt(tempoG,10));}}}/>
                <button className="tempo-sub" disabled={!tempoG||tempoDone} onClick={()=>{if(tempoG&&!tempoDone){setTempoD(true);handleAnswer(parseInt(tempoG,10));}}}>Submit</button>
              </div>
              {tempoDone&&<div style={{textAlign:"center",marginTop:5,fontSize:11,color:C.ashGrey}}>You: <strong style={{color:C.granite}}>{tempoG}</strong> · Actual: <strong style={{color:C.granite}}>{question.cid}</strong></div>}
              {!tempoDone&&<div style={{fontSize:10,color:C.ashGrey,textAlign:"center",marginTop:4,fontStyle:"italic"}}>Count the beats, feel the space between them.</div>}
            </div>
          )}
        </div>

        {/* Choices */}
        {question.type!=="tempo"&&revealed&&question.choices&&(
          <div className="r-choices">
            <div className="choices-lbl">What is this?</div>
            {bounceMsg&&<div key={bounceKey} className="bounce-msg" style={{color:bounceMsg.startsWith("+")?"#405147":"#e74c3c"}}>{bounceMsg}</div>}
            <div className="choices-grid" style={numChoices<=3?{gridTemplateColumns:"repeat(3,1fr)"}:{}}>
              {question.choices.map(ch=>{
                const id=typeof ch==="object"?ch.id:ch;const lbl=choiceLabel(id);let cls="cbtn";
                if(selected!==null&&selected!=="timeout"){if(String(id)===String(question.cid))cls+=" correct";else if(String(id)===String(selected))cls+=" wrong";}
                else if(selected==="timeout"&&String(id)===String(question.cid))cls+=" correct";
                return(<button key={id} className={cls} onClick={()=>handleAnswer(id)} disabled={selected!==null}>{lbl.abbr&&<span className="cabbr">{lbl.abbr}</span>}<span style={{fontSize:lbl.abbr?10:11}}>{lbl.name}</span></button>);
              })}
            </div>
          </div>
        )}

        {/* Timeout-only announce (minimal, no feedback on correct/wrong) */}
        {selected==="timeout"&&(
          <div className="timeout-bar">
            <span style={{fontSize:14}}>⏱</span>
            <div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:C.granite}}>Time's up — that was {getLabel(question)?.name}</div>
              {ms.f<MAX_FAILS&&<div style={{fontSize:10,color:C.ashGrey,marginTop:2}}>{MAX_FAILS-ms.f} {MAX_FAILS-ms.f===1?"life":"lives"} remaining</div>}
            </div>
          </div>
        )}

        {/* Session end sheet */}
        {showEnd&&(
          <div className="end-overlay" onClick={e=>e.target===e.currentTarget&&setShowEnd(false)}>
            <div className="end-sheet">
              <div className="end-handle"/>
              <div style={{textAlign:"center",fontSize:40,marginBottom:6}}>{endReason==="lives"?"💔":"🎯"}</div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:C.granite,textAlign:"center",marginBottom:4}}>{endReason==="lives"?"Out of Lives":"Round Complete"}</div>
              <div style={{fontSize:12,color:C.ashGrey,textAlign:"center",lineHeight:1.5}}>{endReason==="lives"?"Scoring paused — keep practising or switch modes.":"25 scored rounds done. Switch modes or practise freely."}</div>
              <div className="end-stats">
                <div className="end-stat"><div className="end-stat-val">{ms.s-ms.f}</div><div className="end-stat-lbl">Correct</div></div>
                <div className="end-stat"><div className="end-stat-val">{modePct}%</div><div className="end-stat-lbl">Accuracy</div></div>
                <div className="end-stat"><div className="end-stat-val">{bestStreak}</div><div className="end-stat-lbl">Best 🔥</div></div>
              </div>
              <div className="end-btns">
                <button className="end-btn s" onClick={()=>setShowEnd(false)}>Keep Going</button>
                <button className="end-btn p" onClick={()=>{setShowEnd(false);setShowStats(true);}}>View Progress</button>
              </div>
            </div>
          </div>
        )}

        {showStats&&<StatsModal stats={stats} confMatrix={conf} history={history} lb={lb} profile={profile} sessionScore={sessionScore} onClose={()=>setShowStats(false)}/>}
        {showRoad&&<RoadmapSheet currentLevel={playerLv} onClose={()=>setShowRoad(false)}/>}
        {showName&&<NamePrompt onDone={handleNameDone}/>}
        {lvUpQ.length>0&&<LevelUp data={lvUpQ[0]} onDone={handleLvUpDone}/>}
      </div>
    </>
  );
}
