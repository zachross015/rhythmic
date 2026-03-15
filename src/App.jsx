import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const NOTES=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const toDay=()=>new Date().toISOString().split('T')[0];


const S={
  async get(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null}catch{return null}},
  async set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
};
async function loadProfile(){
  let p=await S.get('rt3:profile');
  if(!p)p={id:Math.random().toString(36).slice(2,9),name:null,streak:0,welcomed:false};
  p.streak=p.streak||0;
  if(p.welcomed===undefined)p.welcomed=false;
  await S.set('rt3:profile',p); return p;
}
async function saveProfile(p){await S.set('rt3:profile',p);}

function calcXp(streak){return 10+Math.min(streak,20);}

const KEY_STAGES=[[0],[0,7,5],[0,7,5,2,10],[0,7,5,2,10,9,3],[0,7,5,2,10,9,3,4,8],[0,7,5,2,10,9,3,4,8,11,1],[0,1,2,3,4,5,6,7,8,9,10,11]];
const KEY_INFO={0:{name:'C Major',acc:0,notes:[]},7:{name:'G Major',acc:1,notes:['F#']},5:{name:'F Major',acc:-1,notes:['Bb']},2:{name:'D Major',acc:2,notes:['F#','C#']},10:{name:'Bb Major',acc:-2,notes:['Bb','Eb']},9:{name:'A Major',acc:3,notes:['F#','C#','G#']},3:{name:'Eb Major',acc:-3,notes:['Bb','Eb','Ab']},4:{name:'E Major',acc:4,notes:['F#','C#','G#','D#']},8:{name:'Ab Major',acc:-4,notes:['Bb','Eb','Ab','Db']},11:{name:'B Major',acc:5,notes:['F#','C#','G#','D#','A#']},1:{name:'Db Major',acc:-5,notes:['Bb','Eb','Ab','Db','Gb']},6:{name:'F#/Gb',acc:6,notes:['F#','C#','G#','D#','A#','E#']}};

// All content unlocked from the start
const ALL_INTERVALS=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,24];
const ALL_CHORDS=['maj','min','dim','aug','sus2','sus4','maj6','min6','dom7','maj7','min7','hdim7','dim7','aug7','dom9','dom7b9','min9','maj9','add9','minadd9'];
const ALL_SCALES=['major','natMin','majPent','minPent','blues','mixolyd','dorian','harmMin','lydian','melMin','phrygian','locrian','wholeTone'];
const ALL_KEY_STAGE=6;

// ── Settings default factories ──────────────────────────────────────────────
function defaultSettings(mode){
  if(mode==='intervals') return{activeIds:[...ALL_INTERVALS],ascOn:true,descOn:true,harmOn:true};
  if(mode==='chords')    return{activeIds:[...ALL_CHORDS],keyMode:'same',fixedKey:0,invertOn:false};
  if(mode==='scales')    return{activeIds:[...ALL_SCALES],ascOn:true,descOn:true,shuffleOn:false,keyMode:'same',fixedKey:0,ksSrc:'root'};
  return{};
}
async function loadSettings(mode){
  try{const v=await S.get('rt3:cfg:'+mode);return v||defaultSettings(mode);}catch{return defaultSettings(mode);}
}
async function saveSettings(mode,cfg){await S.set('rt3:cfg:'+mode,cfg);}
async function loadGlobal(){try{const v=await S.get('rt3:global');return{...(v||{})};}catch{return{};}}
async function saveGlobal(g){await S.set('rt3:global',g);}

function getContent(settings={}){
  const iv=settings.intervals||defaultSettings('intervals');
  const ch=settings.chords||defaultSettings('chords');
  const sc=settings.scales||defaultSettings('scales');
  const ivPool=iv.activeIds?.length?iv.activeIds:[1];
  const chPool=ch.activeIds?.length?ch.activeIds:['maj'];
  const scPool=sc.activeIds?.length?sc.activeIds:['major'];
  return{
    intervals:{pool:ivPool,choices:Math.min(4,ivPool.length),keyStage:ALL_KEY_STAGE,ascOn:iv.ascOn!==false,descOn:iv.descOn!==false,harmOn:iv.harmOn!==false,on:true},
    chords:   {pool:chPool,choices:Math.min(4,chPool.length),keyStage:ALL_KEY_STAGE,dirOn:false,keyMode:ch.keyMode||'same',fixedKey:ch.fixedKey??0,invertOn:ch.invertOn===true,on:true},
    scales:   {pool:scPool,choices:Math.min(4,scPool.length),keyStage:ALL_KEY_STAGE,ascOn:sc.ascOn!==false,descOn:sc.descOn!==false,shuffleOn:sc.shuffleOn===true,keyMode:sc.keyMode||'same',fixedKey:sc.fixedKey??0,ksSrc:sc.ksSrc||'root',on:true},
    dirOn:true,scaleDirOn:true,
  };
}

const IV=[
  {id:1, abbr:'m2', name:'Minor 2nd',    q:'Half step — sharp, biting dissonance.',         ref:'Jaws theme'},
  {id:2, abbr:'M2', name:'Major 2nd',    q:'Whole step — smooth, stepwise motion.',          ref:'Happy Birthday (first two notes)'},
  {id:3, abbr:'m3', name:'Minor 3rd',    q:'Dark and introspective — the blues third.',      ref:'Smoke on the Water'},
  {id:4, abbr:'M3', name:'Major 3rd',    q:'Bright and stable — the sunny third.',           ref:'Oh! Susanna'},
  {id:5, abbr:'P4', name:'Perfect 4th',  q:'Open and strong — foundational movement.',       ref:'Here Comes the Bride'},
  {id:6, abbr:'TT', name:'Tritone',      q:'Maximum tension — the devil interval.',          ref:'The Simpsons theme'},
  {id:7, abbr:'P5', name:'Perfect 5th',  q:'Pure power — the backbone of harmony.',          ref:'Star Wars main theme'},
  {id:8, abbr:'m6', name:'Minor 6th',    q:'Tender and bittersweet.',                        ref:'The Entertainer (opening)'},
  {id:9, abbr:'M6', name:'Major 6th',    q:'Warm and lyrical — jazz loves this one.',        ref:'My Bonnie Lies Over the Ocean'},
  {id:10,abbr:'m7', name:'Minor 7th',    q:'Dominant tension — pull to resolve.',            ref:'Somewhere (West Side Story)'},
  {id:11,abbr:'M7', name:'Major 7th',    q:'Luminous and searching — almost resolved.',      ref:'Take On Me (chorus leap)'},
  {id:12,abbr:'P8', name:'Octave',       q:'Perfect unity — same note, new register.',       ref:'Somewhere Over the Rainbow'},
  {id:13,abbr:'m9', name:'Minor 9th',    q:'Like a minor 2nd — wider and more open.',        ref:'m2 placed over an octave'},
  {id:14,abbr:'M9', name:'Major 9th',    q:'The classic jazz extension — expansive.',         ref:'M2 placed over an octave'},
  {id:15,abbr:'m10',name:'Minor 10th',   q:'A minor 3rd across an octave.',                  ref:'Sweet melancholy with depth'},
  {id:16,abbr:'M10',name:'Major 10th',   q:'A major 3rd with extra warmth.',                 ref:'Bright sunshine, expanded'},
  {id:17,abbr:'P11',name:'Perf 11th',    q:'Like a 4th — open and floating.',                ref:'P4 placed an octave higher'},
  {id:18,abbr:'A11',name:'Aug 11th',     q:'The Lydian sound — bright and elevated.',         ref:'Debussy and film scores'},
  {id:19,abbr:'P12',name:'Perf 12th',    q:'A 5th stretched — pure and resonant.',            ref:'Power and open space'},
  {id:20,abbr:'m13',name:'Minor 13th',   q:'Moody and complex — rich jazz colour.',           ref:'Deep jazz voicings'},
  {id:21,abbr:'M13',name:'Major 13th',   q:'The full jazz extension — bright and complete.',  ref:'Lush jazz chords'},
  {id:24,abbr:'2P8',name:'Two Octaves',  q:'Double the distance — perfectly unified.',        ref:'Outer edge of vocal range'},
];
const CH={
  // Triads (3 notes)
  maj:{id:'maj',  name:'Major',       abbr:'Maj', ivs:[0,4,7],       degs:[0,2,4],         q:'Bright and stable.',              formula:'Root + M3 + P5'},
  min:{id:'min',  name:'Minor',       abbr:'min', ivs:[0,3,7],       degs:[0,2,4],         q:'Dark and introspective.',          formula:'Root + m3 + P5'},
  dim:{id:'dim',  name:'Diminished',  abbr:'dim', ivs:[0,3,6],       degs:[0,2,4],         q:'Tense and unstable.',              formula:'Root + m3 + d5'},
  aug:{id:'aug',  name:'Augmented',   abbr:'aug', ivs:[0,4,8],       degs:[0,2,4],         q:'Mysterious and unresolved.',       formula:'Root + M3 + A5'},
  sus2:{id:'sus2',name:'Sus 2',       abbr:'sus2',ivs:[0,2,7],       degs:[0,1,4],         q:'Open and floating — no third.',    formula:'Root + M2 + P5'},
  sus4:{id:'sus4',name:'Sus 4',       abbr:'sus4',ivs:[0,5,7],       degs:[0,3,4],         q:'Ambiguous tension.',                formula:'Root + P4 + P5'},
  // Sixth chords (4 notes)
  maj6:{id:'maj6',name:'Major 6',     abbr:'6',   ivs:[0,4,7,9],     degs:[0,2,4,5],       q:'Warm and nostalgic.',              formula:'Major + M6'},
  min6:{id:'min6',name:'Minor 6',     abbr:'m6',  ivs:[0,3,7,9],     degs:[0,2,4,5],       q:'Bittersweet jazz colour.',         formula:'Minor + M6'},
  // Seventh chords (4 notes)
  dom7:{id:'dom7',name:'Dominant 7',  abbr:'7',   ivs:[0,4,7,10],    degs:[0,2,4,6],       q:'Strong pull to resolve.',          formula:'Major + m7'},
  maj7:{id:'maj7',name:'Major 7',     abbr:'Maj7',ivs:[0,4,7,11],    degs:[0,2,4,6],       q:'Lush and dreamy.',                 formula:'Major + M7'},
  min7:{id:'min7',name:'Minor 7',     abbr:'m7',  ivs:[0,3,7,10],    degs:[0,2,4,6],       q:'Cool and mellow.',                 formula:'Minor + m7'},
  hdim7:{id:'hdim7',name:'Half-Dim 7',abbr:'ø7',  ivs:[0,3,6,10],    degs:[0,2,4,6],       q:'Moody — ii chord in minor.',       formula:'Dim + m7'},
  dim7:{id:'dim7',name:'Dim 7',       abbr:'°7',  ivs:[0,3,6,9],     degs:[0,2,4,6],       q:'Fully symmetric — unstable.',      formula:'Dim + d7'},
  aug7:{id:'aug7',name:'Augmented 7', abbr:'aug7',ivs:[0,4,8,10],    degs:[0,2,4,6],       q:'Augmented with a dominant 7th.',   formula:'Aug + m7'},
  // Ninth chords (5 notes)
  dom9:{id:'dom9',name:'Dominant 9',  abbr:'9',   ivs:[0,4,7,10,14], degs:[0,2,4,6,8],     q:'Full dominant colour with 9th.',   formula:'Dom7 + M9'},
  dom7b9:{id:'dom7b9',name:'7♭9',     abbr:'7♭9', ivs:[0,4,7,10,13], degs:[0,2,4,6,8],     q:'Tense — Spanish/jazz flavour.',    formula:'Dom7 + m9'},
  min9:{id:'min9',name:'Minor 9',     abbr:'m9',  ivs:[0,3,7,10,14], degs:[0,2,4,6,8],     q:'Rich jazz minor colour.',           formula:'m7 chord + M9'},
  maj9:{id:'maj9',name:'Major 9',     abbr:'Maj9',ivs:[0,4,7,11,14], degs:[0,2,4,6,8],     q:'Expansive and luminous.',           formula:'Maj7 chord + M9'},
  add9:{id:'add9',name:'Add 9',       abbr:'add9',ivs:[0,4,7,14],    degs:[0,2,4,8],       q:'Major with 9th — no 7th.',         formula:'Major + M9 (no 7)'},
  minadd9:{id:'minadd9',name:'Min Add9',abbr:'m♯9',ivs:[0,3,7,14],  degs:[0,2,4,8],       q:'Minor with 9th — no 7th.',         formula:'Minor + M9 (no 7)'},
};
const SC=[
  {id:'major',    name:'Major',            ivs:[0,2,4,5,7,9,11],  degs:[0,1,2,3,4,5,6],   parentOffset:0,  q:'The universal bright scale.',          steps:'W-W-H-W-W-W-H',  char:'Leading tone (M7) pulls home'},
  {id:'natMin',   name:'Natural Minor',    ivs:[0,2,3,5,7,8,10],  degs:[0,1,2,3,4,5,6],   parentOffset:3,  q:'Dark and expressive.',                 steps:'W-H-W-W-H-W-W',  char:'Flat 3, 6, 7 give the dark tone'},
  {id:'harmMin',  name:'Harmonic Minor',   ivs:[0,2,3,5,7,8,11],  degs:[0,1,2,3,4,5,6],   parentOffset:0,  q:'Classical tension.',                   steps:'W-H-W-W-H-A2-H', char:'Raised 7 creates exotic aug 2nd'},
  {id:'melMin',   name:'Melodic Minor',    ivs:[0,2,3,5,7,9,11],  degs:[0,1,2,3,4,5,6],   parentOffset:0,  q:'Jazz minor — smooth ascending.',       steps:'W-H-W-W-W-W-H',  char:'Raised 6 and 7 smooth the line'},
  {id:'dorian',   name:'Dorian',           ivs:[0,2,3,5,7,9,10],  degs:[0,1,2,3,4,5,6],   parentOffset:2,  q:'Minor with a raised 6th.',             steps:'W-H-W-W-W-H-W',  char:'Raised 6th is the fingerprint'},
  {id:'phrygian', name:'Phrygian',         ivs:[0,1,3,5,7,8,10],  degs:[0,1,2,3,4,5,6],   parentOffset:4,  q:'Spanish — flat 2nd rules.',            steps:'H-W-W-W-H-W-W',  char:'Flat 2nd is the Spanish colour'},
  {id:'lydian',   name:'Lydian',           ivs:[0,2,4,6,7,9,11],  degs:[0,1,2,3,4,5,6],   parentOffset:5,  q:'Raised 4th — dreamy.',                 steps:'W-W-W-H-W-W-H',  char:'Raised 4th is its magic'},
  {id:'mixolyd',  name:'Mixolydian',       ivs:[0,2,4,5,7,9,10],  degs:[0,1,2,3,4,5,6],   parentOffset:7,  q:'Major with flat 7.',                   steps:'W-W-H-W-W-H-W',  char:'Flat 7 is the blues fingerprint'},
  {id:'locrian',  name:'Locrian',          ivs:[0,1,3,5,6,8,10],  degs:[0,1,2,3,4,5,6],   parentOffset:11, q:'Flat 2nd and 5th — most unstable.',    steps:'H-W-W-H-W-W-W',  char:'Dim 5th is most unstable'},
  {id:'majPent',  name:'Major Pentatonic', ivs:[0,2,4,7,9],        degs:[0,1,2,4,5],        parentOffset:0,  q:'Five notes, zero tension.',            steps:'W-W-m3-W-m3',    char:'No semitones — universally singable'},
  {id:'minPent',  name:'Minor Pentatonic', ivs:[0,3,5,7,10],       degs:[0,2,3,4,6],        parentOffset:3,  q:'Rock and blues backbone.',             steps:'m3-W-W-m3-W',    char:'Foundation of rock guitar'},
  {id:'blues',    name:'Blues Scale',      ivs:[0,3,5,6,7,10],     degs:[0,2,3,4,4,6],      parentOffset:3,  q:'Minor pent plus the blue note.',       steps:'m3-W-H-H-m3-W',  char:'Blue note (b5) is the soul'},
  {id:'wholeTone',name:'Whole Tone',       ivs:[0,2,4,6,8,10],     degs:[0,1,2,3,4,5],      parentOffset:0,  q:'Symmetric — Debussy-like.',            steps:'W-W-W-W-W-W',    char:'All whole steps — symmetric'},
];
const SC_BY=Object.fromEntries(SC.map(s=>[s.id,s]));
function sf(s){return 261.6256*Math.pow(2,s/12);}
function tone(ctx,freq,t,dur,vol=0.2,type='triangle'){const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+0.03);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.start(t);o.stop(t+dur);}
function playOK(ctx){const n=ctx.currentTime;[0,4,7,12].forEach((s,i)=>tone(ctx,sf(s),n+i*.07,.25,.18));}
function playNG(ctx){const n=ctx.currentTime;tone(ctx,sf(-12),n,.45,.28);tone(ctx,sf(-11),n+.03,.4,.18);}
function scheduleAudio(ctx,q){
  const n=ctx.currentTime;const dir=q.dir||'asc';
  const isMissing=q.subtype==='missing';
  if(q.type==='interval'){
    if(isMissing){
      // Only play the known note
      const knownSemi=q.missingNote==='na'?q.nb:q.na;
      tone(ctx,sf(knownSemi),n,.85);return 1000;
    }
    if(dir==='harm'){tone(ctx,sf(q.na),n,1.2);tone(ctx,sf(q.nb),n,1.2);return 1400;}
    const[a,b]=dir==='desc'?[q.nb,q.na]:[q.na,q.nb];tone(ctx,sf(a),n,.85);tone(ctx,sf(b),n+.75,.85);return 1700;
  }
  if(q.type==='chord'){
    const ivs=CH[q.cid].ivs;
    const inv=q.inversion||0;
    const inverted=ivs.map((iv,i)=>i<inv?iv+12:iv).slice(inv).concat(ivs.slice(0,inv).map(iv=>iv+12));
    if(isMissing){
      // Skip the missing note (map inverted index back to root-position index)
      inverted.forEach((iv,i)=>{
        const rootIdx=i<ivs.length-inv?i+inv:i-(ivs.length-inv);
        if(rootIdx!==q.missingIdx) tone(ctx,sf(q.root+iv),n+i*.02,1.2);
      });
    } else {
      inverted.forEach((iv,i)=>tone(ctx,sf(q.root+iv),n+i*.02,1.2));
    }
    return 1600;
  }
  if(q.type==='scale'){
    const notes=[...SC_BY[q.cid].ivs,12];
    let ord;
    if(dir==='desc') ord=[...notes].reverse();
    else if(dir==='shuffle'){
      ord=[...notes];
      for(let i=ord.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ord[i],ord[j]]=[ord[j],ord[i]];}
      q.shuffledIvs=ord;
    } else ord=notes;
    if(isMissing){
      // Leave a silent gap at the missing index position (in asc order)
      const missingIv=SC_BY[q.cid].ivs[q.missingIdx];
      ord.forEach((iv,i)=>{
        if(iv!==missingIv) tone(ctx,sf(q.root+iv),n+i*.2,.28,.18);
        // else: silent gap — no tone scheduled, time slot still passes
      });
    } else {
      ord.forEach((iv,i)=>tone(ctx,sf(q.root+iv),n+i*.2,.28,.18));
    }
    return ord.length*200+400;
  }
}

// Play a single answer-note preview when a choice button is tapped
function playAnswerNote(ctx,q,answerId){
  const n=ctx.currentTime;
  if(q.type==='interval'){
    const ivId=Number(answerId);
    const knownSemi=q.missingNote==='na'?q.nb:q.na;
    // Reconstruct the missing note at the same register as the question
    const targetAbs=q.missingNote==='na'?(knownSemi-ivId):(knownSemi+ivId);
    tone(ctx,sf(targetAbs),n,.6,.18);
  } else if(q.type==='chord'||q.type==='scale'){
    // Derive semitone from answerId
    let semi;
    if(String(answerId)===String(q.cid)){
      // Correct answer: the actual missing note semitone
      const ivs=q.type==='chord'?CH[q.cid].ivs:SC_BY[q.cid].ivs;
      semi=(q.root+ivs[q.missingIdx])%12;
    } else {
      semi=parseInt(answerId); // wrong answers stored as "N_wrong"
    }
    if(!isNaN(semi)&&semi>=0){
      // Play in octave 4 (middle octave), adjusted so it sounds near the question's root
      const rootOct=Math.floor(q.root/12);
      const absNote=rootOct*12+semi;
      tone(ctx,sf(absNote),n,.6,.18);
    }
  }
}


function initW(pool){const w={};pool.forEach(id=>{w[String(id)]=3;});return w;}
function wPick(pool,w){const tot=pool.reduce((s,id)=>s+(w[String(id)]||1),0);let r=Math.random()*tot;for(const id of pool){r-=(w[String(id)]||1);if(r<=0)return id;}return pool[pool.length-1];}
function wUpd(w,id,ok){const nw={...w},k=String(id);nw[k]=ok?Math.max(.4,(nw[k]||3)*.72):Math.min(9,(nw[k]||3)*1.5);return nw;}
function shuf(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// ── Static similarity maps ─────────────────────────────────────────────────
// Higher score = more likely to appear as a distractor.
// Organised by musical confusion: same quality family, nearby size, enharmonic.
const IV_SIM={
  1: [2,13,3],          // m2 → M2, m9, m3
  2: [1,14,4],          // M2 → m2, M9, M3
  3: [4,15,10],         // m3 → M3, m10, m7
  4: [3,16,9],          // M3 → m3, M10, M6
  5: [6,17,7],          // P4 → TT, P11, P5
  6: [5,7,18],          // TT → P4, P5, A11
  7: [5,19,6],          // P5 → P4, P12, TT
  8: [9,3,1],           // m6 → M6, m3, m2
  9: [8,4,11],          // M6 → m6, M3, M7
  10:[11,3,6],          // m7 → M7, m3, TT
  11:[10,4,12],         // M7 → m7, M3, P8
  12:[11,5,19],         // P8 → M7, P4, P12
  13:[14,1,3],          // m9 → M9, m2, m3
  14:[13,2,4],          // M9 → m9, M2, M3
  15:[16,3,8],          // m10 → M10, m3, m6
  16:[15,4,9],          // M10 → m10, M3, M6
  17:[18,5,7],          // P11 → A11, P4, P5
  18:[17,6,5],          // A11 → P11, TT, P4
  19:[12,7,5],          // P12 → P8, P5, P4
  20:[19,12,7],         // m13 → P12, P8, P5
  21:[20,14,9],         // M13 → m13, M9, M6
  24:[12,19,7],         // P15 → P8, P12, P5
};
const CH_SIM={
  maj:   ['min','aug','sus2','add9'],
  min:   ['maj','dim','sus4','minadd9'],
  dim:   ['min','hdim7','dim7'],
  aug:   ['maj','aug7','maj7'],
  sus2:  ['maj','sus4','add9'],
  sus4:  ['min','sus2','maj'],
  maj6:  ['min6','maj','maj7'],
  min6:  ['maj6','min','min7'],
  dom7:  ['maj7','min7','dom9'],
  maj7:  ['dom7','maj','maj9'],
  min7:  ['dom7','hdim7','min9'],
  hdim7: ['dim7','min7','dim'],
  dim7:  ['hdim7','dim','min7'],
  aug7:  ['dom7','aug','maj7'],
  dom9:  ['dom7','maj9','dom7b9'],
  dom7b9:['dom7','dom9','hdim7'],
  min9:  ['min7','maj9','minadd9'],
  maj9:  ['maj7','dom9','add9'],
  add9:  ['maj','sus2','maj9'],
  minadd9:['min','add9','min9'],
};
const SC_SIM={
  major:    ['lydian','mixolyd','natMin'],
  natMin:   ['major','dorian','phrygian'],
  harmMin:  ['natMin','melMin','phrygian'],
  melMin:   ['harmMin','natMin','dorian'],
  majPent:  ['major','minPent','blues'],
  minPent:  ['natMin','blues','majPent'],
  blues:    ['minPent','natMin','dorian'],
  dorian:   ['natMin','mixolyd','major'],
  phrygian: ['natMin','locrian','harmMin'],
  lydian:   ['major','mixolyd','wholeTone'],
  mixolyd:  ['major','dorian','lydian'],
  locrian:  ['phrygian','hdim7','natMin'],
  wholeTone:['lydian','augmented','majPent'],
};

const SIM_MAP={intervals:IV_SIM,chords:CH_SIM,scales:SC_SIM};

// confChoices: pick n-1 distractors weighted by similarity + historical confusion
function confChoices(pool,cid,n,cRow={},mode=''){
  const simList=(SIM_MAP[mode]||{})[String(cid)]||[];
  const simSet=new Set(simList.map(String));
  const others=pool.filter(id=>String(id)!==String(cid));
  const scored=others.map(id=>{
    const k=String(id);
    const simRank=simList.indexOf(Number(id)>=0?Number(id):id);
    // Similarity base: 1st similar=8, 2nd=5, 3rd=3, in sim list=2, else=1
    const simBase=simRank===0?8:simRank===1?5:simRank===2?3:simSet.has(k)?2:1;
    const confBonus=(cRow[k]||0)*6;
    return{id,score:simBase+confBonus};
  });
  const sel=[],rem=[...scored];
  for(let i=0;i<Math.min(n-1,rem.length);i++){
    const tot=rem.reduce((s,x)=>s+x.score,0);
    let r=Math.random()*tot;let ix=rem.length-1;
    for(let j=0;j<rem.length;j++){r-=rem[j].score;if(r<=0){ix=j;break;}}
    sel.push(rem[ix].id);rem.splice(ix,1);
  }
  return shuf([cid,...sel]);
}
function buildQ(mode,content,weights,confMatrix){
  const cfg=content[mode];
  const keyPool=KEY_STAGES[cfg?.keyStage||0]||[0];
  const root=keyPool[Math.floor(Math.random()*keyPool.length)];
  const ascOn=cfg?.ascOn!==false;
  const descOn=cfg?.descOn!==false;
  const harmOn=cfg?.harmOn!==false;
  const dirs=[...(ascOn?['asc']:[]),...(descOn?['desc']:[]),...(harmOn&&mode==='intervals'?['harm']:[]),...(cfg?.shuffleOn&&mode==='scales'?['shuffle']:[])];
  const dir=dirs.length>0?dirs[Math.floor(Math.random()*dirs.length)]:'asc';
  const cid=wPick(cfg.pool,weights[mode]||initW(cfg.pool));
  const cRow=(confMatrix[mode]||{})[String(cid)]||{};
  const choices=confChoices(cfg.pool,cid,cfg.choices,cRow,mode);
  if(mode==='intervals'){
    const doMissingI=Math.random()<.5;
    if(doMissingI){
      const missingNote=Math.random()<.5?'na':'nb';
      const knownSemi=missingNote==='na'?root+cid:root; // the note we know
      // Choices: correct note + wrong notes from distractor intervals applied to known note
      // choices is raw ids here — look up IV objects first
      const noteChoicesIv=choices.map(id=>{
        const ivObj=IV.find(x=>x.id===id);
        if(!ivObj)return null;
        const ivId=ivObj.id;
        const targetSemi=missingNote==='na'?(knownSemi-ivId+120)%12:(knownSemi+ivId)%12;
        return{id:ivObj.id,noteName:NOTES[targetSemi]};
      }).filter(Boolean);
      const seen=new Set();const deduped=[];
      for(const c of noteChoicesIv){if(!seen.has(c.noteName)){seen.add(c.noteName);deduped.push(c);}}
      return{type:'interval',subtype:'missing',cid,na:root,nb:root+cid,missingNote,
        noteChoices:deduped,choices:choices.map(id=>IV.find(x=>x.id===id)),dir};
    }
    return{type:'interval',cid,na:root,nb:root+cid,choices:choices.map(id=>IV.find(x=>x.id===id)),dir};
  }
  if(mode==='chords'){
    const km=cfg.keyMode||'same';
    const allKeys=KEY_STAGES[ALL_KEY_STAGE]||[0];
    let chRoot;
    if(km==='fixed') chRoot=cfg.fixedKey??0;
    else chRoot=root; // 'same' — use shared practice key
    // Inversion: randomly pick 0 (root position) through n-1
    const noteCount=CH[cid].ivs.length;
    const inversion=cfg.invertOn?Math.floor(Math.random()*noteCount):0;
    // 50% chance: "missing note" variant — name is given, find the missing note
    const doMissing=Math.random()<.5&&CH[cid].ivs.length>=3;
    if(doMissing){
      const missingIdx=Math.floor(Math.random()*noteCount);
      const {sharpSet,flatSet}=keySigns(chRoot%12);
      const spelled=spellNotes(chRoot%12,CH[cid].ivs,CH[cid].degs,sharpSet,flatSet);
      const correctSemi=(chRoot+CH[cid].ivs[missingIdx])%12;
      // Generate wrong choices: notes ±1 and ±2 semitones from correct, spelled naturally
      const wrongSemis=[-2,-1,1,2].map(d=>((correctSemi+d+12)%12)).filter(s=>s!==correctSemi);
      const noteChoices=[{id:cid,noteName:NOTES[correctSemi]}];
      const usedNames=new Set([NOTES[correctSemi]]);
      for(const s of wrongSemis){
        const name=NOTES[s];
        if(!usedNames.has(name)&&noteChoices.length<cfg.choices){
          usedNames.add(name);noteChoices.push({id:s+'_wrong',noteName:name});
        }
      }
      // Shuffle and trim to cfg.choices
      const shuffled=shuf(noteChoices).slice(0,cfg.choices);
      return{type:'chord',subtype:'missing',cid,root:chRoot,inversion,missingIdx,
        noteChoices:shuffled,choices:choices.map(id=>CH[id]),dir:'asc'};
    }
    return{type:'chord',cid,root:chRoot,inversion,choices:choices.map(id=>CH[id]),dir:'asc'};
  }
  if(mode==='scales'){
    const km=cfg.keyMode||'same';
    let scRoot;
    if(km==='fixed') scRoot=cfg.fixedKey??0;
    else scRoot=root; // 'same' — use shared practice key
    const doMissingS=Math.random()<.5;
    if(doMissingS){
      const sc=SC_BY[cid];
      const scLen=sc?.ivs?.length||7;
      // Skip index 0 (root is always the root note — trivial) and last (octave repeat)
      const missingIdx=1+Math.floor(Math.random()*(scLen-1));
      const ksSrc2=cfg.ksSrc||'root';
      const parentOffset2=sc?.parentOffset||0;
      const ksSemi2=ksSrc2==='parent'?((scRoot-parentOffset2+12)%12):scRoot;
      const {sharpSet,flatSet}=keySigns(ksSemi2);
      const correctSemi=(scRoot+sc.ivs[missingIdx])%12;
      // Wrong choices: ±1 and ±2 semitones, spelled as note names
      const wrongSemis=[-2,-1,1,2].map(d=>((correctSemi+d+12)%12)).filter(s=>s!==correctSemi);
      const noteChoices=[{id:cid,noteName:NOTES[correctSemi]}];
      const usedNames=new Set([NOTES[correctSemi]]);
      for(const s of wrongSemis){
        const name=NOTES[s];
        if(!usedNames.has(name)&&noteChoices.length<cfg.choices){
          usedNames.add(name);noteChoices.push({id:s+'_wrong',noteName:name});
        }
      }
      const shuffled=shuf(noteChoices).slice(0,cfg.choices);
      return{type:'scale',subtype:'missing',cid,root:scRoot,missingIdx,noteChoices:shuffled,
        choices:choices.map(id=>SC_BY[id]),dir,ksSrc:ksSrc2};
    }
    return{type:'scale',cid,root:scRoot,choices:choices.map(id=>SC_BY[id]),dir,ksSrc:cfg.ksSrc||'root'};
  }
  return null;
}
function getLabel(q){if(!q)return null;if(q.type==='interval')return IV.find(x=>x.id===q.cid);if(q.type==='chord')return CH[q.cid];if(q.type==='scale')return SC_BY[q.cid];return null;}

let _ctx=null;
function getCtx(){
  if(!_ctx||_ctx.state==='closed'){
    _ctx=new(window.AudioContext||window.webkitAudioContext)();
    // Play a silent buffer to unlock audio on iOS even with ringer off
    try{
      const buf=_ctx.createBuffer(1,1,22050);
      const src=_ctx.createBufferSource();src.buffer=buf;src.connect(_ctx.destination);src.start(0);
    }catch{}
  }
  return _ctx;
}
function stopCtx(){
  // Close and discard the context — all scheduled nodes are destroyed immediately
  if(_ctx){try{_ctx.close();}catch{}}_ctx=null;
}
function playTap(ctx){
  // Subtle soft click: very short sine blip, low volume
  const n=ctx.currentTime;
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.connect(g);g.connect(ctx.destination);
  o.type='sine';o.frequency.value=520;
  g.gain.setValueAtTime(0,n);
  g.gain.linearRampToValueAtTime(0.07,n+0.008);
  g.gain.exponentialRampToValueAtTime(0.001,n+0.06);
  o.start(n);o.stop(n+0.07);
}

function StreakBadge({streak,size=22}){
  if(!streak||streak<1)return null;
  const s=size;
  return(
    <div style={{position:'relative',width:s,height:s,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <svg width={s} height={s} viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' style={{position:'absolute',inset:0}}>
        <path d='M12 2C12 2 7 7.5 7 13a5 5 0 0010 0c0-2.5-1.5-5-2.5-6.5C14.5 9 14 10.5 14 12a2 2 0 01-4 0c0-2.5 2-5 2-10z' fill='#E8622A'/>
        <path d='M12 8C12 8 9.5 11 9.5 13.5a2.5 2.5 0 005 0C14.5 12 13.5 10.5 12 8z' fill='#F5A623'/>
        <path d='M12 11.5C12 11.5 11 12.5 11 13.5a1 1 0 002 0c0-.8-.5-1.5-1-2z' fill='#FDE68A'/>
      </svg>
      <span style={{position:'relative',zIndex:1,fontSize:s*0.36,fontWeight:700,color:'#fff',lineHeight:1,marginTop:s*0.12,fontFamily:"'Work Sans',sans-serif",textShadow:'0 1px 2px rgba(0,0,0,.35)'}}>{streak}</span>
    </div>
  );
}

function Piano({na,nb,dark=false,hiddenNote=null}){
  const WW=28,GAP=2,BW=16,BH=54,WH=88,U=WW+GAP;
  const WK=[0,2,4,5,7,9,11],BK=[[1,0],[3,1],[6,3],[8,4],[10,5]];
  const lo=Math.min(na,nb),hi=Math.max(na,nb);
  const startOct=Math.floor(lo/12);
  const endOct=Math.floor(hi/12);
  const octs=endOct-startOct+1;
  const ws=[],bs=[];
  for(let o=0;o<octs;o++){
    const base=(startOct+o)*12;
    WK.forEach((s,wi)=>{const abs=base+s;ws.push({abs,x:(o*7+wi)*U,a:abs===na,b:abs===nb});});
    BK.forEach(([s,aw])=>{const abs=base+s,x=(o*7+aw+1)*U-BW/2-1;bs.push({abs,x,a:abs===na,b:abs===nb});});
  }
  const tw=octs*7*U-GAP;
  const wFill=k=>k.abs===hiddenNote?(dark?'rgba(242,238,230,.12)':'white'):k.a?(dark?'rgba(156,183,177,.55)':'#D1E1DD'):k.b?(dark?'rgba(198,165,133,.35)':'rgba(198,165,133,.35)'):(dark?'rgba(242,238,230,.12)':'white');
  const wStroke=k=>k.abs===hiddenNote?(dark?'rgba(242,238,230,.2)':'#BEC9A6'):k.a?(dark?'rgba(156,183,177,.7)':'#9CB7B1'):k.b?(dark?'rgba(198,165,133,.6)':'#C6A585'):(dark?'rgba(242,238,230,.2)':'#BEC9A6');
  const bFill=k=>k.abs===hiddenNote?(dark?'rgba(242,238,230,.15)':'#405147'):k.a?(dark?'#9CB7B1':'#9CB7B1'):k.b?(dark?'#C6A585':'#C6A585'):(dark?'rgba(242,238,230,.15)':'#405147');
  const dotFill=k=>k.a?(dark?'#F2EEE6':'#405147'):'#C6A585';
  return(<div style={{overflowX:'auto',margin:'2px 0 10px',display:'flex',justifyContent:'center'}}>
    <svg width={Math.min(tw,370)} height={WH} viewBox={'0 0 '+tw+' '+WH} style={{display:'block'}}>
      {ws.map(k=><rect key={k.abs} x={k.x} y={0} width={WW} height={WH} rx={3} fill={wFill(k)} stroke={wStroke(k)} strokeWidth={1.5}/>)}
      {bs.map(k=><rect key={k.abs} x={k.x} y={0} width={BW} height={BH} rx={2} fill={bFill(k)}/>)}
      {ws.filter(k=>(k.a||k.b)&&k.abs!==hiddenNote).map(k=><circle key={'d'+k.abs} cx={k.x+WW/2} cy={WH-10} r={4} fill={dotFill(k)}/>)}
      {bs.filter(k=>(k.a||k.b)&&k.abs!==hiddenNote).map(k=><circle key={'d'+k.abs} cx={k.x+BW/2} cy={BH-9} r={3} fill={dark?'rgba(242,238,230,.8)':'#F2EEE6'}/>)}
    </svg></div>);
}
function MultiPiano({root,ivs,dark=false}){
  // Compute absolute semitone positions (root in octave 4 = semitone 48+root)
  const base=48+root;
  const abs=ivs.map(iv=>base+iv);
  const lo=Math.min(...abs), hi=Math.max(...abs);
  // Snap start to nearest C or F at or below lo, snap end to nearest B or E at or above hi
  // C=0, F=5 within an octave; B=11, E=4
  function snapDown(semi){
    // Find nearest C (0) or F (5) <= semi
    const mod=((semi%12)+12)%12;
    const oct=semi-mod;
    if(mod>=5) return oct+5;   // F of same octave
    return oct;                // C of same octave
  }
  function snapUp(semi){
    // Find nearest B (11) or E (4) >= semi
    const mod=((semi%12)+12)%12;
    const oct=semi-mod;
    if(mod<=4) return oct+4;   // E of same octave
    if(mod<=11) return oct+11; // B of same octave
    return oct+12+4;           // E of next octave (shouldn't happen)
  }
  const startSemi=snapDown(lo);
  const endSemi=snapUp(hi);
  // Build key list from startSemi to endSemi
  const WW=24,GAP=2,BW=14,BH=50,WH=80,U=WW+GAP;
  const WK=[0,2,4,5,7,9,11],BK=[[1,0],[3,1],[6,3],[8,4],[10,5]];
  const toneSet=new Set(abs);
  const ws=[],bs=[];
  // Walk semitones from startSemi to endSemi, grouping by octave-like segments
  // We'll iterate white keys only in the range
  let whiteIdx=0;
  for(let semi=startSemi;semi<=endSemi;semi++){
    const mod=((semi%12)+12)%12;
    const wPos=WK.indexOf(mod);
    if(wPos>=0){
      ws.push({abs:semi,x:whiteIdx*U,on:toneSet.has(semi)});
      // Check for black key just before this white key
      const bEntry=BK.find(([s,aw])=>s===mod);
      if(bEntry){
        // black key to the left of this white key
        const bSemi=semi-1; // the black key is 1 semitone below
        const bMod=((bSemi%12)+12)%12;
        if(bMod===bEntry[0]&&bSemi>=startSemi){
          bs.push({abs:bSemi,x:whiteIdx*U-BW/2-1,on:toneSet.has(bSemi)});
        }
      }
      whiteIdx++;
    }
  }
  // Handle black keys that sit between white keys (standard piano layout)
  // Re-derive properly: for each white key, check if a black key follows before next white key
  const ws2=[],bs2=[];
  let wi=0;
  for(let semi=startSemi;semi<=endSemi;semi++){
    const mod=((semi%12)+12)%12;
    if(WK.includes(mod)){
      ws2.push({abs:semi,x:wi*U,on:toneSet.has(semi)});
      wi++;
    }
  }
  // Place black keys by finding their x between adjacent white keys
  for(let semi=startSemi;semi<=endSemi;semi++){
    const mod=((semi%12)+12)%12;
    if(!WK.includes(mod)){
      // Black key: find which white-key index it sits after
      const prevWIdx=ws2.findIndex(w=>w.abs===semi-1);
      const nextWIdx=ws2.findIndex(w=>w.abs===semi+1);
      if(prevWIdx>=0&&nextWIdx>=0){
        const x=ws2[prevWIdx].x+WW-BW/2;
        bs2.push({abs:semi,x,on:toneSet.has(semi)});
      }
    }
  }
  const tw=wi*U-GAP;
  return(
    <div style={{display:'flex',justifyContent:'center'}}>
      <svg width={Math.min(tw,340)} height={WH} viewBox={'0 0 '+tw+' '+WH} style={{display:'block'}}>
        {ws2.map(k=><rect key={k.abs} x={k.x} y={0} width={WW} height={WH} rx={3}
          fill={k.on?(dark?'rgba(156,183,177,.55)':'#D1E1DD'):(dark?'rgba(242,238,230,.12)':'white')}
          stroke={k.on?(dark?'rgba(156,183,177,.7)':'#9CB7B1'):(dark?'rgba(242,238,230,.2)':'#BEC9A6')}
          strokeWidth={1.5}/>)}
        {bs2.map(k=><rect key={k.abs} x={k.x} y={0} width={BW} height={BH} rx={2}
          fill={k.on?(dark?'#9CB7B1':'#9CB7B1'):(dark?'rgba(242,238,230,.15)':'#405147')}/>)}
      </svg>
    </div>
  );
}



const Styles=()=>(<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;1,400;1,700&family=Work+Sans:wght@400;600;700&display=swap');
  @font-face{font-family:'Bravura';src:url('data:font/otf;base64,T1RUTwAMAIAAAwBAQ0ZGIH952xUAAAHsAAAVI0dERUYAEQAGAAAXEAAAABZHUE9TRHZMdQAAFygAAAAgR1NVQkR2THUAABdIAAAAIE9TLzJTclCQAAABMAAAAGBjbWFwAAzlOgAAAZgAAAA0aGVhZCJr6D0AAADMAAAANmhoZWEJHflrAAABBAAAACRobXR4BqcAAQAAF2gAAAAYbWF4cAAGUAAAAAEoAAAABm5hbWUABgAAAAABkAAAAAZwb3N0/7gAMgAAAcwAAAAgAAEAAAABZFr1GM+ZXw889QADA+gAAAAA3DiMSgAAAADl27c4AAD+DAFAAXUAAAADAAIAAAAAAAAAAQAAB9z4JAAAAUAAAAAAAUAAAQAAAAAAAAAAAAAAAAAAAAYAAFAAAAYAAAAEAbgBkAAFAAACigJYAAAASwKKAlgAAAFeADIApQAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAABTTVRHAEDk4+TnB9z4JAAAB9wH3AAAAAEAAAAAARMB2wAAACAABgAAAAAABgAAAAAAAgAAAAMAAAAUAAMAAQAAABQABAAgAAAABAAEAAEAAOTn//8AAOTj//8bHgABAAAAAAADAAAAAAAA/7UAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAQAEAgABAQEIQnJhdnVyYQABAQEp+CAA+CEB+CIMAPgjAvgjA/gkBIv8iPfU+AkFHBLvD6QcFLwSHBLzEQAKAgABAAgADwAWAB0AJAAxAKQR9BH7EgF1bmlFNEUzdW5pRTRFNHVuaUU0RTV1bmlFNEU2dW5pRTRFN1ZlcnNpb24gMS4zOTJCcmF2dXJhIGlzIGEgcmVnaXN0ZXJlZCB0cmFkZW1hcmsgb2YgU3RlaW5iZXJnIE1lZGlhIFRlY2hub2xvZ2llcyBHbWJIIGluIHRoZSBFdXJvcGVhbiBVbmlvbiBhbmQgb3RoZXIgdGVycml0b3JpZXMuQ29weXJpZ2h0IFwoY1wpIDIwMjEsIFN0ZWluYmVyZyBNZWRpYSBUZWNobm9sb2dpZXMgR21iSCBcKGh0dHA6Ly93d3cuc3RlaW5iZXJnLm5ldC9cKSwgd2l0aCBSZXNlcnZlZCBGb250IE5hbWUgIkJyYXZ1cmEiLiBUaGlzIEZvbnQgU29mdHdhcmUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIFNJTCBPcGVuIEZvbnQgTGljZW5zZSwgVmVyc2lvbiAxLjEuIFRoaXMgbGljZW5zZSBpcyBjb3BpZWQgYmVsb3csIGFuZCBpcyBhbHNvIGF2YWlsYWJsZSB3aXRoIGEgRkFRIGF0OiBodHRwOi8vc2NyaXB0cy5zaWwub3JnL09GTCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSBTSUwgT1BFTiBGT05UIExJQ0VOU0UgVmVyc2lvbiAxLjEgLSAyNiBGZWJydWFyeSAyMDA3IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIFBSRUFNQkxFIFRoZSBnb2FscyBvZiB0aGUgT3BlbiBGb250IExpY2Vuc2UgXChPRkxcKSBhcmUgdG8gc3RpbXVsYXRlIHdvcmxkd2lkZSBkZXZlbG9wbWVudCBvZiBjb2xsYWJvcmF0aXZlIGZvbnQgcHJvamVjdHMsIHRvIHN1cHBvcnQgdGhlIGZvbnQgY3JlYXRpb24gZWZmb3J0cyBvZiBhY2FkZW1pYyBhbmQgbGluZ3Vpc3RpYyBjb21tdW5pdGllcywgYW5kIHRvIHByb3ZpZGUgYSBmcmVlIGFuZCBvcGVuIGZyYW1ld29yayBpbiB3aGljaCBmb250cyBtYXkgYmUgc2hhcmVkIGFuZCBpbXByb3ZlZCBpbiBwYXJ0bmVyc2hpcCB3aXRoIG90aGVycy4gVGhlIE9GTCBhbGxvd3MgdGhlIGxpY2Vuc2VkIGZvbnRzIHRvIGJlIHVzZWQsIHN0dWRpZWQsIG1vZGlmaWVkIGFuZCByZWRpc3RyaWJ1dGVkIGZyZWVseSBhcyBsb25nIGFzIHRoZXkgYXJlIG5vdCBzb2xkIGJ5IHRoZW1zZWx2ZXMuIFRoZSBmb250cywgaW5jbHVkaW5nIGFueSBkZXJpdmF0aXZlIHdvcmtzLCBjYW4gYmUgYnVuZGxlZCwgZW1iZWRkZWQsIHJlZGlzdHJpYnV0ZWQgYW5kL29yIHNvbGQgd2l0aCBhbnkgc29mdHdhcmUgcHJvdmlkZWQgdGhhdCBhbnkgcmVzZXJ2ZWQgbmFtZXMgYXJlIG5vdCB1c2VkIGJ5IGRlcml2YXRpdmUgd29ya3MuIFRoZSBmb250cyBhbmQgZGVyaXZhdGl2ZXMsIGhvd2V2ZXIsIGNhbm5vdCBiZSByZWxlYXNlZCB1bmRlciBhbnkgb3RoZXIgdHlwZSBvZiBsaWNlbnNlLiBUaGUgcmVxdWlyZW1lbnQgZm9yIGZvbnRzIHRvIHJlbWFpbiB1bmRlciB0aGlzIGxpY2Vuc2UgZG9lcyBub3QgYXBwbHkgdG8gYW55IGRvY3VtZW50IGNyZWF0ZWQgdXNpbmcgdGhlIGZvbnRzIG9yIHRoZWlyIGRlcml2YXRpdmVzLiBERUZJTklUSU9OUyAiRm9udCBTb2Z0d2FyZSIgcmVmZXJzIHRvIHRoZSBzZXQgb2YgZmlsZXMgcmVsZWFzZWQgYnkgdGhlIENvcHlyaWdodCBIb2xkZXJcKHNcKSB1bmRlciB0aGlzIGxpY2Vuc2UgYW5kIGNsZWFybHkgbWFya2VkIGFzIHN1Y2guIFRoaXMgbWF5IGluY2x1ZGUgc291cmNlIGZpbGVzLCBidWlsZCBzY3JpcHRzIGFuZCBkb2N1bWVudGF0aW9uLiAiUmVzZXJ2ZWQgRm9udCBOYW1lIiByZWZlcnMgdG8gYW55IG5hbWVzIHNwZWNpZmllZCBhcyBzdWNoIGFmdGVyIHRoZSBjb3B5cmlnaHQgc3RhdGVtZW50XChzXCkuICJPcmlnaW5hbCBWZXJzaW9uIiByZWZlcnMgdG8gdGhlIGNvbGxlY3Rpb24gb2YgRm9udCBTb2Z0d2FyZSBjb21wb25lbnRzIGFzIGRpc3RyaWJ1dGVkIGJ5IHRoZSBDb3B5cmlnaHQgSG9sZGVyXChzXCkuICJNb2RpZmllZCBWZXJzaW9uIiByZWZlcnMgdG8gYW55IGRlcml2YXRpdmUgbWFkZSBieSBhZGRpbmcgdG8sIGRlbGV0aW5nLCBvciBzdWJzdGl0dXRpbmcgLS0gaW4gcGFydCBvciBpbiB3aG9sZSAtLSBhbnkgb2YgdGhlIGNvbXBvbmVudHMgb2YgdGhlIE9yaWdpbmFsIFZlcnNpb24sIGJ5IGNoYW5naW5nIGZvcm1hdHMgb3IgYnkgcG9ydGluZyB0aGUgRm9udCBTb2Z0d2FyZSB0byBhIG5ldyBlbnZpcm9ubWVudC4gIkF1dGhvciIgcmVmZXJzIHRvIGFueSBkZXNpZ25lciwgZW5naW5lZXIsIHByb2dyYW1tZXIsIHRlY2huaWNhbCB3cml0ZXIgb3Igb3RoZXIgcGVyc29uIHdobyBjb250cmlidXRlZCB0byB0aGUgRm9udCBTb2Z0d2FyZS4gUEVSTUlTU0lPTiAmIENPTkRJVElPTlMgUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weSBvZiB0aGUgRm9udCBTb2Z0d2FyZSwgdG8gdXNlLCBzdHVkeSwgY29weSwgbWVyZ2UsIGVtYmVkLCBtb2RpZnksIHJlZGlzdHJpYnV0ZSwgYW5kIHNlbGwgbW9kaWZpZWQgYW5kIHVubW9kaWZpZWQgY29waWVzIG9mIHRoZSBGb250IFNvZnR3YXJlLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczogMVwpIE5laXRoZXIgdGhlIEZvbnQgU29mdHdhcmUgbm9yIGFueSBvZiBpdHMgaW5kaXZpZHVhbCBjb21wb25lbnRzLCBpbiBPcmlnaW5hbCBvciBNb2RpZmllZCBWZXJzaW9ucywgbWF5IGJlIHNvbGQgYnkgaXRzZWxmLiAyXCkgT3JpZ2luYWwgb3IgTW9kaWZpZWQgVmVyc2lvbnMgb2YgdGhlIEZvbnQgU29mdHdhcmUgbWF5IGJlIGJ1bmRsZWQsIHJlZGlzdHJpYnV0ZWQgYW5kL29yIHNvbGQgd2l0aCBhbnkgc29mdHdhcmUsIHByb3ZpZGVkIHRoYXQgZWFjaCBjb3B5IGNvbnRhaW5zIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIGxpY2Vuc2UuIFRoZXNlIGNhbiBiZSBpbmNsdWRlZCBlaXRoZXIgYXMgc3RhbmQtYWxvbmUgdGV4dCBmaWxlcywgaHVtYW4tcmVhZGFibGUgaGVhZGVycyBvciBpbiB0aGUgYXBwcm9wcmlhdGUgbWFjaGluZS1yZWFkYWJsZSBtZXRhZGF0YSBmaWVsZHMgd2l0aGluIHRleHQgb3IgYmluYXJ5IGZpbGVzIGFzIGxvbmcgYXMgdGhvc2UgZmllbGRzIGNhbiBiZSBlYXNpbHkgdmlld2VkIGJ5IHRoZSB1c2VyLiAzXCkgTm8gTW9kaWZpZWQgVmVyc2lvbiBvZiB0aGUgRm9udCBTb2Z0d2FyZSBtYXkgdXNlIHRoZSBSZXNlcnZlZCBGb250IE5hbWVcKHNcKSB1bmxlc3MgZXhwbGljaXQgd3JpdHRlbiBwZXJtaXNzaW9uIGlzIGdyYW50ZWQgYnkgdGhlIGNvcnJlc3BvbmRpbmcgQ29weXJpZ2h0IEhvbGRlci4gVGhpcyByZXN0cmljdGlvbiBvbmx5IGFwcGxpZXMgdG8gdGhlIHByaW1hcnkgZm9udCBuYW1lIGFzIHByZXNlbnRlZCB0byB0aGUgdXNlcnMuIDRcKSBUaGUgbmFtZVwoc1wpIG9mIHRoZSBDb3B5cmlnaHQgSG9sZGVyXChzXCkgb3IgdGhlIEF1dGhvclwoc1wpIG9mIHRoZSBGb250IFNvZnR3YXJlIHNoYWxsIG5vdCBiZSB1c2VkIHRvIHByb21vdGUsIGVuZG9yc2Ugb3IgYWR2ZXJ0aXNlIGFueSBNb2RpZmllZCBWZXJzaW9uLCBleGNlcHQgdG8gYWNrbm93bGVkZ2UgdGhlIGNvbnRyaWJ1dGlvblwoc1wpIG9mIHRoZSBDb3B5cmlnaHQgSG9sZGVyXChzXCkgYW5kIHRoZSBBdXRob3JcKHNcKSBvciB3aXRoIHRoZWlyIGV4cGxpY2l0IHdyaXR0ZW4gcGVybWlzc2lvbi4gNVwpIFRoZSBGb250IFNvZnR3YXJlLCBtb2RpZmllZCBvciB1bm1vZGlmaWVkLCBpbiBwYXJ0IG9yIGluIHdob2xlLCBtdXN0IGJlIGRpc3RyaWJ1dGVkIGVudGlyZWx5IHVuZGVyIHRoaXMgbGljZW5zZSwgYW5kIG11c3Qgbm90IGJlIGRpc3RyaWJ1dGVkIHVuZGVyIGFueSBvdGhlciBsaWNlbnNlLiBUaGUgcmVxdWlyZW1lbnQgZm9yIGZvbnRzIHRvIHJlbWFpbiB1bmRlciB0aGlzIGxpY2Vuc2UgZG9lcyBub3QgYXBwbHkgdG8gYW55IGRvY3VtZW50IGNyZWF0ZWQgdXNpbmcgdGhlIEZvbnQgU29mdHdhcmUuIFRFUk1JTkFUSU9OIFRoaXMgbGljZW5zZSBiZWNvbWVzIG51bGwgYW5kIHZvaWQgaWYgYW55IG9mIHRoZSBhYm92ZSBjb25kaXRpb25zIGFyZSBub3QgbWV0LiBESVNDTEFJTUVSIFRIRSBGT05UIFNPRlRXQVJFIElTIFBST1ZJREVEICJBUyBJUyIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBBTlkgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQgT0YgQ09QWVJJR0hULCBQQVRFTlQsIFRSQURFTUFSSywgT1IgT1RIRVIgUklHSFQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgSE9MREVSIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgSU5DTFVESU5HIEFOWSBHRU5FUkFMLCBTUEVDSUFMLCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUiBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIFRIRSBVU0UgT1IgSU5BQklMSVRZIFRPIFVTRSBUSEUgRk9OVCBTT0ZUV0FSRSBPUiBGUk9NIE9USEVSIERFQUxJTkdTIElOIFRIRSBGT05UIFNPRlRXQVJFLkJyYXZ1cmFOb3JtYWwACgEBDxYwOUNMc3iFjCMdYrVwsaanlJiiHowLHo2MjIwaC4sai6TjjZghHZGDj4mMHoaIiYmIH4SFWU8LsW2pZWZsbWUL9yQBi/euA/euC7BtqWZmbW1mC1v7GyQd+wEV5weaf5Z9Hvt6BnyAgHwfLwd9ln+aHvd6BpmXl5kfDomLihsLi46OGrFsqWZlbW1lC4qKBYqLiwsBAYcEAAYCAAEAAwAFAAwA2wFJAblpDiYdW4kkHaMgCk78C7D3G90SjPcF+wX3oRPQ2WUVm3eZeJh2CI2Hj4OJIgqHiYeKhhsT4IeDjYyHH4onHYOOBVdpXFpZtlrUUx+Fk5WIkxuSko2PjB+MjoyNjRqUg5ODkh5+gKaUiR+Ik4qUlBq0oKu1qKyAhZwejIoFio+Ni40bjo2MjpdxrICXH2W5bLDDIQqMkgUhCo/Fr7ultAiOkIyQkBqVh5SLHov7KPdEepwekIaEjoUbgYGEfYaMho6FH4+AxFhDGmZ8YF5cHoGBh4CDGn2VgYseDjolCov3GhOQE1D3GvYVJR12l3mafx6Am56FnhuZmY6Plh8TMJmPlI+YkgiMjY2LjBuPjIeGiIuHiocfiHxD+1t5SQh/ooqRlpmNk5Uejo3t9/OLGo+dkJuMkAiVgZCJjB6JiIuHhR+FhFlPahsOgPtl9xz3CPcc+wStEov3HEv3HBPI92T3AxUgHY6NjI0bjo2Jhh8T0HtY+ymEfB54g3B/fRuMjygdYrVwsaWllJeiHo2NiYcfKR2LHiz7rwUjCoqKBYKUgaGokJeWjx73CPgRBROopeCeziIdaYoIDnefBqsKqQukjo8MDKmRpAwN+IgU998VpBMABgEBFhwkKjhFFecHmn+WfR77egZ8gIB8Hy8HJAoOjIuMjBoLGoqLiYqKHguLi4qLHgt9ln+aHvd6BpmXl5kfC/uP+D37G/cb+wSuEgsAAAEAAAAMAAAAAAAAAAIAAQABAAUAAQAAAAEAAAAKABwAHgABREZMVAAIAAQAAAAA//8AAAAAAAAAAQAAAAoAHAAeAAFERkxUAAgABAAAAAD//wAAAAAAAAEpAAABGwAAARsAAAEOAAEA+gAAAUAAAA==') format('opentype');font-display:block;}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body,#root{background:#F2EEE6;font-family:'Work Sans',sans-serif;}
  @keyframes ri_fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes ri_slideSheet{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes ri_scaleIn{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes ri_breathe{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.06);opacity:1}}
  @keyframes ri_playFill{from{width:0%}to{width:100%}}
  @keyframes ri_waveA{0%,100%{height:4px}50%{height:12px}}
  @keyframes ri_waveB{0%,100%{height:6px}50%{height:18px}}
  @keyframes ri_waveC{0%,100%{height:5px}50%{height:14px}}
  @keyframes ri_slideUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes ri_slideInRight{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes ri_slideInLeft{from{transform:translateX(-18px);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes ri_wrong{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
  @keyframes ri_correct{0%{transform:scale(1)}50%{transform:scale(1.03)}100%{transform:scale(1)}}
  @keyframes ri_glow{0%,100%{box-shadow:0 0 0 0 rgba(156,183,177,0)}60%{box-shadow:0 0 0 6px rgba(156,183,177,.12)}}
  @keyframes ri_cardIn{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes ri_choiceIn{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes ri_screenIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms !important;animation-delay:0ms !important;transition-duration:0.01ms !important;}}
  .r-root{background:#F2EEE6;min-height:100dvh;max-width:430px;margin:0 auto;display:flex;flex-direction:column;position:relative;will-change:opacity,transform;}
  .r-scroll{flex:1;overflow-y:auto;padding-bottom:24px;}
  .screen-enter{opacity:0;animation:ri_screenIn .5s ease forwards;}
  .r-nav{display:flex;background:white;border-bottom:1.5px solid #BEC9A6;overflow-x:auto;flex-shrink:0;}
  .r-nav-btn{flex:0 0 auto;padding:9px 10px;border:none;background:transparent;font-family:'Work Sans',sans-serif;font-size:13px;font-weight:600;color:#9CB7B1;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;transition:color .3s,border-color .3s;}
  .r-nav-btn.active{color:#405147;border-bottom-color:#405147;}
  .hub-card{background:white;border-radius:20px;padding:20px 22px;cursor:pointer;border:1.5px solid transparent;box-shadow:0 2px 12px rgba(64,81,71,.07);position:relative;overflow:hidden;transition:transform .25s ease,box-shadow .25s ease;}
  .hub-card:active{transform:scale(.98);box-shadow:0 1px 6px rgba(64,81,71,.05);}
  .hub-card-locked{cursor:default !important;}
  .hub-card-locked:active{transform:none !important;}
  .hub-card-stagger{animation:ri_slideUp .6s ease both;}
  .hub-tab-btn{flex:1;padding:12px 0;border:none;background:transparent;font-family:'Work Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2.5px solid transparent;transition:color .3s,border-color .3s;}
  .tab-fade{animation:ri_fadeIn .35s ease both;}
  .done-banner{background:white;border-radius:14px;padding:22px;margin:16px;text-align:center;border:1.5px dashed #BEC9A6;animation:ri_scaleIn .5s ease;}
  .seg-btn{flex:1;padding:12px 8px;border-radius:12px;border:1.5px solid #BEC9A6;background:transparent;color:#9CB7B1;font-size:13px;font-weight:700;font-family:'Work Sans',sans-serif;cursor:pointer;transition:background .25s,border-color .25s,color .25s,transform .2s;}
  .seg-btn:active{transform:scale(.97);}
  .seg-btn.seg-on{background:#405147;border-color:#405147;color:#F2EEE6;}
  .key-btn{width:46px;height:44px;border-radius:10px;border:1.5px solid #BEC9A6;background:transparent;color:#405147;font-size:14px;font-weight:700;font-family:'Fraunces',serif;cursor:pointer;transition:background .25s,border-color .25s,color .25s,transform .2s;}
  .key-btn:active{transform:scale(.9);}
  .key-btn.key-on{background:#405147;border-color:#405147;color:#F2EEE6;}
  .chip-btn{padding:8px 14px;border-radius:10px;border:1.5px solid #BEC9A6;background:white;color:#9CB7B1;font-size:12px;font-weight:700;cursor:pointer;transition:background .25s,border-color .25s,color .25s,transform .2s;display:flex;align-items:center;gap:5px;}
  .chip-btn:active{transform:scale(.9);}
  .chip-btn.chip-on{background:#405147;border-color:#405147;color:white;}
  .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #F2EEE6;cursor:pointer;user-select:none;transition:opacity .2s;}
  .toggle-row:active{opacity:.65;}
  .toggle-track{width:46px;height:26px;border-radius:13px;position:relative;flex-shrink:0;transition:background .3s;}
  .toggle-thumb{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:white;transition:left .3s ease;box-shadow:0 1px 3px rgba(0,0,0,.2);}
  .action-btn{width:100%;padding:11px;background:transparent;color:#405147;border:1.5px solid #BEC9A6;border-radius:10px;font-family:'Work Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:transform .2s,border-color .25s,background .25s,color .25s;}
  .action-btn:active{transform:scale(.98);background:#F2EEE6;}
  .action-btn:hover{border-color:#9CB7B1;}
  .et-root{background:#405147;min-height:100dvh;max-width:430px;margin:0 auto;display:flex;flex-direction:column;opacity:0;will-change:opacity,transform;}
  .et-root.screen-enter{animation:ri_screenIn .5s ease forwards;}
  .et-hdr{padding:16px 16px 10px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .et-back{background:transparent;border:none;color:rgba(242,238,230,.4);font-family:'Work Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;min-width:48px;transition:color .25s;}
  .et-back:active{color:#F2EEE6;}
  .et-hdr-mid{flex:1;text-align:center;}
  .et-mode-label{font-family:'Fraunces',serif;font-size:14px;font-weight:700;color:rgba(242,238,230,.35);letter-spacing:.01em;}
  .et-hdr-right{display:flex;gap:4px;min-width:48px;justify-content:flex-end;}
  .et-icon-btn{background:transparent;border:none;color:rgba(242,238,230,.35);font-size:16px;cursor:pointer;padding:4px;transition:color .25s,transform .2s;}
  .et-icon-btn:active{transform:scale(.88);color:#F2EEE6;}
  @keyframes ri_liftUp{from{transform:translateY(0)}to{transform:translateY(-48px)}}
  .et-scroll{flex:1;overflow-y:auto;padding:0 16px 48px;display:flex;flex-direction:column;}
  .et-question{flex:1;display:flex;flex-direction:column;padding:8px 0 16px;opacity:0;animation:ri_cardIn .55s ease forwards;will-change:opacity,transform;}
  .et-notes-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;}
  .et-npill{border-radius:10px;padding:8px 16px;text-align:center;}
  .et-npill-a{border:1.5px solid rgba(156,183,177,.35);background:rgba(156,183,177,.09);}
  .et-npill-b{border:1.5px solid rgba(198,165,133,.35);background:rgba(198,165,133,.07);}
  .et-nnm{font-family:'Fraunces',serif;font-size:20px;font-weight:700;color:#F2EEE6;}
  .et-nsub{font-size:9px;color:rgba(156,183,177,.6);margin-top:1px;}
  .et-arrow{font-size:16px;color:rgba(242,238,230,.2);}
  .et-play-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:17px;background:rgba(242,238,230,.07);color:rgba(242,238,230,.8);border:1.5px solid rgba(242,238,230,.14);border-radius:14px;font-family:'Work Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;position:relative;overflow:hidden;transition:background .25s,border-color .25s,transform .2s;}
  .et-play-btn:not(:disabled):active{transform:scale(.98);}
  .et-play-btn:disabled{opacity:.5;cursor:default;}
  .et-play-btn.idle-pulse{animation:ri_glow 3s ease-in-out infinite;}
  .play-fill{position:absolute;left:0;top:0;height:100%;background:rgba(255,255,255,.12);pointer-events:none;}
  .play-btn-inner{position:relative;z-index:1;display:flex;align-items:center;gap:6px;}
  .wave-bars{display:flex;gap:2px;align-items:center;height:20px;}
  .wave-bar{width:3px;border-radius:2px;background:rgba(156,183,177,.7);}
  .wb1{animation:ri_waveA 1.1s ease-in-out infinite;}
  .wb2{animation:ri_waveB 1.1s ease-in-out infinite .18s;}
  .wb3{animation:ri_waveC 1.1s ease-in-out infinite .36s;}
  .wb4{animation:ri_waveB 1.1s ease-in-out infinite .54s;}
  .wb5{animation:ri_waveA 1.1s ease-in-out infinite .27s;}
  .et-choices{margin-top:16px;opacity:0;animation:ri_slideUp .4s ease forwards;}
  .et-choices-lbl{font-size:10px;font-weight:600;color:rgba(242,238,230,.22);text-transform:uppercase;letter-spacing:.14em;margin-bottom:12px;text-align:center;}
  .et-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
  .et-cbtn{background:rgba(242,238,230,.05);border:1.5px solid rgba(242,238,230,.11);border-radius:14px;padding:20px 10px;font-family:'Work Sans',sans-serif;font-size:14px;font-weight:600;color:rgba(242,238,230,.7);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:background .2s,border-color .2s,transform .2s,color .2s;}
  .et-cbtn:not(:disabled):not(.et-correct):not(.et-wrong):active{transform:scale(.96);}
  .et-cbtn:not(:disabled):not(.et-correct):not(.et-wrong):hover{background:rgba(242,238,230,.09);border-color:rgba(242,238,230,.2);}
  .et-cbtn:disabled{cursor:default;}
  .et-cbtn.et-correct{background:rgba(156,183,177,.18);border-color:rgba(156,183,177,.5);color:#9CB7B1;animation:ri_correct .5s ease;}
  .et-cbtn.et-wrong{background:rgba(198,165,133,.1);border-color:rgba(198,165,133,.3);color:rgba(198,165,133,.75);animation:ri_wrong .4s ease;}
  .et-cbtn.et-pending{background:rgba(156,183,177,.12);border-color:rgba(156,183,177,.4);color:rgba(242,238,230,.9);}
  .et-cabbr{font-size:10px;font-weight:600;opacity:.45;}
  .et-bounce{text-align:center;font-family:'Fraunces',serif;font-size:15px;font-weight:700;padding:6px 0 10px;opacity:0;animation:ri_fadeIn .4s ease forwards;}
  .et-next{width:100%;padding:16px;background:rgba(242,238,230,.07);color:rgba(242,238,230,.65);border:1.5px solid rgba(242,238,230,.14);border-radius:14px;font-family:'Work Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;margin-top:14px;transition:background .25s,border-color .25s,transform .2s,color .25s;}
  .et-next:not(:disabled):active{transform:scale(.98);background:rgba(242,238,230,.12);}
  .et-info-chip{background:rgba(156,183,177,.09);border-radius:20px;padding:6px 16px;font-size:12px;color:rgba(156,183,177,.6);font-weight:600;display:block;width:fit-content;margin:0 auto 14px;}
  .et-m-icon{font-size:42px;display:block;margin:16px auto 8px;text-align:center;}
`}</style>);

function WelcomeScreen({onDone}){
  const[name,setName]=useState('');const[step,setStep]=useState(0);
  return(
    <div style={{position:'fixed',inset:0,background:'#405147',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',zIndex:100}}>
      {step===0&&(<>
        <div style={{fontSize:48,marginBottom:20}}>🎵</div>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:36,fontWeight:700,color:'#F2EEE6',textAlign:'center',lineHeight:1.1,marginBottom:10}}>Welcome to<br/><em style={{fontStyle:'italic',color:'#C6A585'}}>Rhythmic.</em></div>
        <div style={{fontSize:17,color:'#9CB7B1',textAlign:'center',maxWidth:320,lineHeight:1.8,marginBottom:10}}>A quiet space to deepen your ear. No timers, no pressure — just you and sound.</div>
        <div style={{background:'rgba(255,255,255,.07)',borderRadius:14,padding:'16px 18px',maxWidth:320,width:'100%',marginBottom:28}}>
          {['Work at your own pace — every session is yours to shape.','Fewer questions, done well, build deeper listening over time.','Return each day to tend your ear like a practice.'].map((t,i)=>(
            <div key={i} style={{display:'flex',gap:10,marginBottom:i<2?10:0}}><div style={{width:4,height:4,borderRadius:'50%',background:'#C6A585',flexShrink:0,marginTop:8}}/><div style={{fontSize:16,color:'#BEC9A6',lineHeight:1.7}}>{t}</div></div>
          ))}
        </div>
        <button onClick={()=>setStep(1)} style={{background:'#C6A585',color:'white',border:'none',borderRadius:12,padding:'14px 40px',fontFamily:"'Work Sans',sans-serif",fontSize:17,fontWeight:600,cursor:'pointer',letterSpacing:.01}}>Begin</button>
      </>)}
      {step===1&&(<>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:700,color:'#F2EEE6',textAlign:'center',marginBottom:8}}>What should we call you?</div>
        <div style={{fontSize:16,color:'#9CB7B1',marginBottom:24,textAlign:'center'}}>Just for a personal touch — nothing else.</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder='Your name…' style={{width:'100%',maxWidth:300,padding:'13px 16px',borderRadius:12,border:'2px solid rgba(156,183,177,.4)',background:'rgba(255,255,255,.07)',color:'#F2EEE6',fontFamily:"'Work Sans',sans-serif",fontSize:17,outline:'none',boxSizing:'border-box',textAlign:'center'}} onKeyDown={e=>e.key==='Enter'&&name.trim()&&onDone(name.trim())}/>
        <button onClick={()=>name.trim()&&onDone(name.trim())} disabled={!name.trim()} style={{marginTop:16,background:name.trim()?'#C6A585':'rgba(255,255,255,.1)',color:'white',border:'none',borderRadius:12,padding:'13px 36px',fontFamily:"'Work Sans',sans-serif",fontSize:16,fontWeight:600,cursor:name.trim()?'pointer':'default'}}>Continue</button>
        <button onClick={()=>onDone('')} style={{marginTop:10,background:'transparent',border:'none',color:'rgba(156,183,177,.5)',fontSize:15,cursor:'pointer',fontFamily:"'Work Sans',sans-serif"}}>skip for now</button>
      </>)}
    </div>
  );
}



// ── Settings sheet ────────────────────────────────────────────────────────
function SettingsSheet({mode,settings,onSave,onClose,globalSettings,onGlobalChange}){
  const [draft,setDraft]=useState(settings||defaultSettings(mode));
  const [globalDraft,setGlobalDraft]=useState(globalSettings||{});
  const cfg=draft;

  function Toggle({label,sub,on,onToggle}){
    return(
      <div onClick={onToggle} className='toggle-row'>
        <div>
          <div style={{fontSize:17,fontWeight:600,color:'#405147'}}>{label}</div>
          {sub&&<div style={{fontSize:16,color:'#9CB7B1',marginTop:1}}>{sub}</div>}
        </div>
        <div className='toggle-track' style={{background:on?'#405147':'#BEC9A6'}}>
          <div className='toggle-thumb' style={{left:on?23:3}}/>
        </div>
      </div>
    );
  }

  function ChipGrid({ids,allItems,getLabel,getAbbr}){
    return(
      <div style={{display:'flex',flexWrap:'wrap',gap:6,paddingBottom:4}}>
        {allItems.map(item=>{
          const id=typeof item==='object'?item.id:item;
          const on=ids.includes(id);
          const label=getLabel(item);
          const abbr=getAbbr?.(item);
          return(
            <button key={id} onClick={()=>setDraft(toggleId(cfg,mode,id))}
              className={'chip-btn'+(on?' chip-on':'')}>
              {abbr&&<span style={{fontSize:17,opacity:.8}}>{abbr}</span>}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  function toggleId(cfg,mode,id){
    const cur=cfg.activeIds||[];
    const newIds=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
    const safe=newIds.length===0?cur:newIds; // never allow empty
    return{...cfg,activeIds:safe};
  }

  const isIv=mode==='intervals';
  const isCh=mode==='chords';
  const isSc=mode==='scales';

  const RADII=[5,10,15,20];

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(64,81,71,.5)',zIndex:40,display:'flex',alignItems:'flex-end',animation:'ri_fadeIn .2s'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#F2EEE6',width:'100%',maxWidth:430,margin:'0 auto',borderRadius:'22px 22px 0 0',maxHeight:'88vh',display:'flex',flexDirection:'column',animation:'ri_slideSheet .3s'}}>
        <div style={{width:34,height:4,background:'#BEC9A6',borderRadius:2,margin:'10px auto 0'}}/>
        <div style={{padding:'14px 20px 12px',borderBottom:'1px solid #BEC9A6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:700,color:'#405147'}}>⚙ Settings</div>
            <div style={{fontSize:16,color:'#9CB7B1',marginTop:2}}>Customise what's in rotation</div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#9CB7B1',fontSize:24,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',padding:'16px 20px 36px'}}>

          {/* ── Intervals ── */}
          {isIv&&(<>
            <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Active Intervals</div>
            <ChipGrid
              ids={cfg.activeIds||ALL_INTERVALS}
              allItems={IV}
              getLabel={iv=>iv.abbr}
            />
            <div style={{marginTop:16}}>
              <Toggle
                label='Ascending'
                sub='Hear intervals going up'
                on={cfg.ascOn!==false}
                onToggle={()=>{const next={...cfg,ascOn:cfg.ascOn===false};if(!next.ascOn&&cfg.descOn===false&&cfg.harmOn===false)return;setDraft(next);}}
              />
              <Toggle
                label='Descending'
                sub='Hear intervals going down'
                on={cfg.descOn!==false}
                onToggle={()=>{const next={...cfg,descOn:cfg.descOn===false};if(!next.descOn&&cfg.ascOn===false&&cfg.harmOn===false)return;setDraft(next);}}
              />
              <Toggle
                label='Harmonic'
                sub='Hear both notes simultaneously'
                on={cfg.harmOn!==false}
                onToggle={()=>{const next={...cfg,harmOn:cfg.harmOn===false};if(!next.harmOn&&cfg.ascOn===false&&cfg.descOn===false)return;setDraft(next);}}
              />
            </div>
          </>)}

          {/* ── Chords ── */}
          {isCh&&(<>
            {[
              {label:'Triads', ids:['maj','min','dim','aug','sus2','sus4']},
              {label:'6th Chords', ids:['maj6','min6']},
              {label:'7th Chords', ids:['dom7','maj7','min7','hdim7','dim7','aug7']},
              {label:'9th Chords', ids:['dom9','dom7b9','min9','maj9','add9','minadd9']},
            ].map(group=>(
              <div key={group.label} style={{marginBottom:14}}>
                <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>{group.label}</div>
                <ChipGrid
                  ids={cfg.activeIds||ALL_CHORDS}
                  allItems={group.ids.map(id=>CH[id]).filter(Boolean)}
                  getLabel={ch=>ch.abbr}
                />
              </div>
            ))}
            <div style={{marginTop:20}}>
              <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Key Practice Mode</div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {[{id:'same',label:'Same Key'},{id:'fixed',label:'Fixed Key'}].map(({id,label})=>(
                  <button key={id} onClick={()=>setDraft({...cfg,keyMode:id})} className={'seg-btn'+((cfg.keyMode||'same')===id?' seg-on':'')}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:16,color:'#9CB7B1',marginBottom:(cfg.keyMode||'same')==='fixed'?10:0,lineHeight:1.5}}>
                {(cfg.keyMode||'same')==='same'&&'Chord root matches the shared practice key.'}
                {(cfg.keyMode||'same')==='fixed'&&'Always practice chords in one key of your choice.'}
              </div>
              {(cfg.keyMode||'same')==='fixed'&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {NOTES.map((n,i)=>(
                    <button key={i} onClick={()=>setDraft({...cfg,fixedKey:i})} className={'key-btn'+((cfg.fixedKey??0)===i?' key-on':'')}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{marginTop:16}}>
              <Toggle
                label='Inversions'
                sub='Randomly voice chords in 1st, 2nd or 3rd inversion'
                on={cfg.invertOn===true}
                onToggle={()=>setDraft({...cfg,invertOn:!cfg.invertOn})}
              />
            </div>
          </>)}

          {/* ── Scales ── */}
          {isSc&&(<>
            <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Active Scales</div>
            <ChipGrid
              ids={cfg.activeIds||ALL_SCALES}
              allItems={SC}
              getLabel={sc=>sc.name}
            />
            <div style={{marginTop:16}}>
              <Toggle
                label='Ascending'
                sub='Hear scales going up'
                on={cfg.ascOn!==false}
                onToggle={()=>{const next={...cfg,ascOn:cfg.ascOn===false};if(!next.ascOn&&cfg.descOn===false&&cfg.shuffleOn===true||!next.ascOn&&cfg.descOn===false&&!cfg.shuffleOn)return;setDraft(next);}}
              />
              <Toggle
                label='Descending'
                sub='Hear scales going down'
                on={cfg.descOn!==false}
                onToggle={()=>{const next={...cfg,descOn:cfg.descOn===false};if(!next.descOn&&cfg.ascOn===false&&!cfg.shuffleOn)return;setDraft(next);}}
              />
              <Toggle
                label='Shuffled'
                sub='Hear notes in random order'
                on={cfg.shuffleOn===true}
                onToggle={()=>{const next={...cfg,shuffleOn:!cfg.shuffleOn};if(!next.shuffleOn&&cfg.ascOn===false&&cfg.descOn===false)return;setDraft(next);}}
              />
            </div>
            {/* Key mode */}
            <div style={{marginTop:20}}>
              <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Key Practice Mode</div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {[{id:'same',label:'Same Key'},{id:'fixed',label:'Fixed Key'}].map(({id,label})=>(
                  <button key={id} onClick={()=>setDraft({...cfg,keyMode:id})} className={'seg-btn'+((cfg.keyMode||'same')===id?' seg-on':'')}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:16,color:'#9CB7B1',marginBottom:(cfg.keyMode||'same')==='fixed'?10:0,lineHeight:1.5}}>
                {(cfg.keyMode||'same')==='same'&&'Scale root matches the interval/chord practice key.'}
                {(cfg.keyMode||'same')==='fixed'&&'Always practice scales in one key of your choice.'}
              </div>
              {(cfg.keyMode||'same')==='fixed'&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((n,i)=>(
                    <button key={i} onClick={()=>setDraft({...cfg,fixedKey:i})} className={'key-btn'+((cfg.fixedKey??0)===i?' key-on':'')}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Key Signature Source */}
            <div style={{marginTop:20}}>
              <div style={{fontSize:16,color:'#9CB7B1',fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>Key Signature</div>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                {[{id:'root',label:'Root Key'},{id:'parent',label:'Parent Key'}].map(({id,label})=>(
                  <button key={id} onClick={()=>setDraft({...cfg,ksSrc:id})} className={'seg-btn'+((cfg.ksSrc||'root')===id?' seg-on':'')}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{fontSize:16,color:'#9CB7B1',lineHeight:1.5}}>
                {(cfg.ksSrc||'root')==='root'&&'Key sig of the scale root (e.g. F Lydian → 1 flat).'}
                {(cfg.ksSrc||'root')==='parent'&&'Parent major key sig (e.g. F Lydian → C major, 0 flats).'}
              </div>
            </div>
          </>)}


        </div>
        {/* ── Footer ── */}
        <div style={{padding:'12px 20px 28px',borderTop:'1px solid #BEC9A6',display:'flex',gap:10,flexShrink:0}}>
          <button onClick={onClose} style={{flex:1,padding:'13px',background:'transparent',border:'1.5px solid #BEC9A6',borderRadius:12,fontFamily:"'Work Sans',sans-serif",fontSize:15,fontWeight:700,color:'#9CB7B1',cursor:'pointer'}}>Cancel</button>
          <button onClick={()=>onSave(draft,globalDraft)} style={{flex:2,padding:'13px',background:'#405147',border:'none',borderRadius:12,fontFamily:"'Work Sans',sans-serif",fontSize:15,fontWeight:700,color:'#F2EEE6',cursor:'pointer'}}>Save & Restart</button>
        </div>
      </div>
    </div>
  );
}


const MODE_DEFS=[
  {id:'intervals', label:'Intervals', icon:'↔', desc:'Hear the space between two notes. Learn to feel distance in sound.', req:''},
  {id:'chords',    label:'Chords',    icon:'♪', desc:'Recognise how notes combine — the colour and character of harmony.', req:''},
  {id:'scales',    label:'Scales',    icon:'〜', desc:'Listen for the mood of a scale — its tension, brightness, and feel.', req:''},
];

function SubjectHub({profile,onSelect}){
  const[hubTab,setHubTab]=useState('learn');
  const content=getContent();

  const UNITS=[
    {
      id:'melody', num:1, title:'Melody',
      desc:'Train your ear to hear and reproduce melodic lines — the heart of musical listening.',
      sections:[
        {id:'melodic-dictation', title:'Melodic Dictation', subtitle:'Scalewise diatonic melodies', duration:'Exercise', dest:'melodicDictation', live:true},
      ],
    },
    {
      id:'intervals', num:2, title:'Intervals',
      desc:'The distance between two notes — the fundamental unit of ear training.',
      sections:[
        {id:'iv-intro',   title:'What is an interval?',           duration:'Coming soon'},
        {id:'iv-quality', title:'Quality: perfect, major, minor', duration:'Coming soon'},
      ],
    },
    {
      id:'chords', num:3, title:'Chords & Harmony',
      desc:'How notes combine into chords, and how chords create the feeling of music.',
      sections:[
        {id:'ch-triads', title:'Triads — the essential three', duration:'Coming soon'},
      ],
    },
  ];

  function LearnTab(){
    const[openUnit,setOpenUnit]=useState('melody');
    return(
      <div className='tab-fade' style={{padding:'24px 16px 40px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{marginBottom:4}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:'rgba(64,81,71,.45)',
            letterSpacing:.8,textTransform:'uppercase',marginBottom:6}}>Your path</div>
          <div style={{fontSize:14,color:'rgba(64,81,71,.55)',lineHeight:1.6}}>
            Work through each unit at your own pace.
          </div>
        </div>

        {UNITS.map((unit,ui)=>{
          const isOpen=openUnit===unit.id;
          const hasLive=unit.sections.some(s=>s.live);
          return(
            <div key={unit.id} style={{borderRadius:18,overflow:'hidden',
              boxShadow:isOpen?'0 4px 20px rgba(64,81,71,.10)':'0 1px 4px rgba(64,81,71,.06)',
              border:'1.5px solid',borderColor:isOpen?'#9CB7B1':'#E2DDD5',
              transition:'box-shadow .25s,border-color .25s'}}>
              {/* Unit header */}
              <button onClick={()=>setOpenUnit(isOpen?null:unit.id)}
                style={{width:'100%',background:isOpen?'#405147':'white',
                  padding:'16px 18px',display:'flex',alignItems:'center',gap:14,
                  cursor:'pointer',textAlign:'left',border:'none',transition:'background .2s'}}>
                <div style={{width:34,height:34,borderRadius:'50%',flexShrink:0,
                  background:isOpen?'rgba(242,238,230,.18)':'#F2EEE6',
                  border:'1.5px solid',borderColor:isOpen?'rgba(242,238,230,.3)':'#BEC9A6',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,
                    color:isOpen?'#F2EEE6':'#9CB7B1'}}>{unit.num}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,
                    color:isOpen?'#F2EEE6':'#405147',lineHeight:1.2}}>{unit.title}</div>
                  {!isOpen&&<div style={{fontSize:12,color:'rgba(64,81,71,.5)',marginTop:2,
                    overflow:'hidden',display:'-webkit-box',WebkitLineClamp:1,WebkitBoxOrient:'vertical'}}>
                    {unit.desc}
                  </div>}
                  {isOpen&&hasLive&&<div style={{fontSize:11,color:'rgba(156,183,177,.8)',marginTop:2,fontWeight:600}}>
                    {unit.sections.filter(s=>s.live).length} exercise{unit.sections.filter(s=>s.live).length>1?'s':''} available
                  </div>}
                </div>
                {hasLive&&!isOpen&&<div style={{width:7,height:7,borderRadius:'50%',background:'#9CB7B1',flexShrink:0,marginRight:4}}/>}
                <div style={{fontSize:18,color:isOpen?'rgba(242,238,230,.5)':'#BEC9A6',
                  transition:'transform .3s',transform:isOpen?'rotate(180deg)':'rotate(0deg)',flexShrink:0}}>
                  ›
                </div>
              </button>

              {/* Sections */}
              {isOpen&&(
                <div style={{background:'white'}}>
                  <div style={{padding:'12px 18px 10px',borderBottom:'1px solid #F2EEE6'}}>
                    <div style={{fontSize:13,color:'rgba(64,81,71,.55)',lineHeight:1.6}}>{unit.desc}</div>
                  </div>
                  {unit.sections.map((sec,si)=>(
                    <div key={sec.id}
                      onClick={()=>sec.dest&&onSelect(sec.dest)}
                      style={{padding:'14px 18px',
                        borderBottom:si<unit.sections.length-1?'1px solid #F5F3EF':'none',
                        display:'flex',alignItems:'center',gap:12,
                        cursor:sec.dest?'pointer':'default',
                        background:'transparent',transition:'background .12s'}}
                      onMouseEnter={e=>sec.dest&&(e.currentTarget.style.background='#FAFAF7')}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                        background:sec.live?'#9CB7B1':'#D4CFC7'}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:700,color:'#405147',lineHeight:1.3,
                          fontFamily:"'Fraunces',serif"}}>{sec.title}</div>
                        {sec.subtitle&&<div style={{fontSize:12,color:'rgba(64,81,71,.5)',marginTop:2}}>{sec.subtitle}</div>}
                      </div>
                      {sec.live
                        ?<div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                            <div style={{width:6,height:6,borderRadius:'50%',background:'#9CB7B1'}}/>
                            <span style={{fontSize:11,color:'#9CB7B1',fontWeight:700,fontFamily:"'Work Sans',sans-serif"}}>Exercise</span>
                          </div>
                        :<span style={{fontSize:11,color:'#BEC9A6',fontWeight:600,flexShrink:0,
                            fontFamily:"'Work Sans',sans-serif"}}>Soon</span>
                      }
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function TrainTab(){
    return(
      <div className='tab-fade' style={{padding:'24px 16px 40px',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{marginBottom:4}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:13,fontWeight:700,color:'rgba(64,81,71,.45)',
            letterSpacing:.8,textTransform:'uppercase',marginBottom:6}}>Exercises</div>
          <div style={{fontSize:14,color:'rgba(64,81,71,.55)',lineHeight:1.6}}>
            Jump into any exercise to practise freely.
          </div>
        </div>

        {MODE_DEFS.map((md,mi)=>{
          const on=content[md.id]?.on;
          return(
            <div key={md.id} onClick={()=>on&&onSelect('earTraining',md.id)}
              style={{background:on?'white':'#F5F3EF',
                border:'1.5px solid',borderColor:'#E2DDD5',
                borderRadius:18,padding:'18px 18px',cursor:on?'pointer':'default',
                opacity:on?1:.5,position:'relative',overflow:'hidden',
                boxShadow:on?'0 2px 10px rgba(64,81,71,.07)':'none',
                transition:'box-shadow .2s,transform .15s',animationDelay:(mi*80)+'ms'}}
              className='hub-card-stagger'
              onMouseEnter={e=>on&&(e.currentTarget.style.boxShadow='0 4px 18px rgba(64,81,71,.13)',e.currentTarget.style.transform='translateY(-1px)')}
              onMouseLeave={e=>(e.currentTarget.style.boxShadow=on?'0 2px 10px rgba(64,81,71,.07)':'none',e.currentTarget.style.transform='')}>
              {on&&<div style={{position:'absolute',top:0,right:0,width:56,height:56,
                background:'rgba(156,183,177,.12)',borderRadius:'0 18px 0 56px'}}/>}
              <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:8}}>
                <span style={{fontSize:22,lineHeight:1}}>{md.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:700,
                    color:'#405147',lineHeight:1.2,marginBottom:3}}>{md.label}</div>
                  {!on&&<span style={{fontSize:11,color:'#9CB7B1',background:'#F2EEE6',
                    borderRadius:5,padding:'2px 7px',fontWeight:600}}>{md.req}</span>}
                </div>
                {on&&<span style={{fontSize:16,color:'rgba(64,81,71,.3)',marginTop:2}}>→</span>}
              </div>
              <div style={{fontSize:14,color:'rgba(64,81,71,.55)',lineHeight:1.55}}>{md.desc}</div>
            </div>
          );
        })}

        {/* Reading section */}
        <div style={{marginTop:6,marginBottom:2}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:12,fontWeight:700,color:'rgba(64,81,71,.35)',
            letterSpacing:.7,textTransform:'uppercase',marginBottom:8}}>Reading</div>
        </div>
        {[
          {id:'noteId',  icon:'🎹', label:'Note Identification', dest:'noteId',
           desc:'A note appears on the keyboard or staff — name it.'},
          {id:'keyId',   icon:'🎼', label:'Key Identification',  dest:'keyId',
           desc:'A key signature appears on the staff — name the major key.'},
        ].map((ex,ei)=>(
          <div key={ex.id} onClick={()=>onSelect(ex.dest)}
            style={{background:'white',border:'1.5px solid #E2DDD5',borderRadius:18,
              padding:'18px 18px',cursor:'pointer',position:'relative',overflow:'hidden',
              boxShadow:'0 2px 10px rgba(64,81,71,.07)',
              transition:'box-shadow .2s,transform .15s',animationDelay:((MODE_DEFS.length+ei)*80)+'ms'}}
            className='hub-card-stagger'
            onMouseEnter={e=>(e.currentTarget.style.boxShadow='0 4px 18px rgba(64,81,71,.13)',e.currentTarget.style.transform='translateY(-1px)')}
            onMouseLeave={e=>(e.currentTarget.style.boxShadow='0 2px 10px rgba(64,81,71,.07)',e.currentTarget.style.transform='')}>
            <div style={{position:'absolute',top:0,right:0,width:56,height:56,
              background:'rgba(156,183,177,.12)',borderRadius:'0 18px 0 56px'}}/>
            <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:8}}>
              <span style={{fontSize:22,lineHeight:1}}>{ex.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:700,
                  color:'#405147',lineHeight:1.2}}>{ex.label}</div>
              </div>
              <span style={{fontSize:16,color:'rgba(64,81,71,.3)',marginTop:2}}>→</span>
            </div>
            <div style={{fontSize:14,color:'rgba(64,81,71,.55)',lineHeight:1.55}}>{ex.desc}</div>
          </div>
        ))}
        <div style={{height:8}}/>
      </div>
    );
  }

  return(
    <div className='screen-enter' style={{background:'#F2EEE6',minHeight:'100dvh',maxWidth:430,margin:'0 auto',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{background:'#F2EEE6',padding:'28px 20px 0',flexShrink:0,
        borderBottom:'1px solid rgba(64,81,71,.08)'}}>
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:32,fontWeight:700,color:'#405147',lineHeight:1}}>
            Rhythmic<em style={{fontStyle:'italic',color:'#C6A585'}}>.</em>
          </div>
          {profile?.name&&<div style={{fontSize:15,color:'rgba(64,81,71,.45)',marginTop:4,fontFamily:"'Work Sans',sans-serif"}}>
            Welcome back, {profile.name}
          </div>}
        </div>
        {/* Tabs */}
        <div style={{display:'flex',gap:4,background:'rgba(64,81,71,.07)',
          borderRadius:12,padding:4}}>
          {[{id:'learn',label:'Learn'},{id:'train',label:'Train'}].map(t=>(
            <button key={t.id} onClick={()=>setHubTab(t.id)}
              style={{flex:1,padding:'9px 0',border:'none',borderRadius:9,cursor:'pointer',
                fontFamily:"'Work Sans',sans-serif",fontSize:14,fontWeight:700,
                transition:'background .18s,color .18s,box-shadow .18s',
                background:hubTab===t.id?'white':'transparent',
                color:hubTab===t.id?'#405147':'rgba(64,81,71,.45)',
                boxShadow:hubTab===t.id?'0 1px 6px rgba(64,81,71,.12)':'none'}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
        {hubTab==='learn'&&<LearnTab/>}
        {hubTab==='train'&&<TrainTab/>}
      </div>
    </div>
  );
}

const EMODES=[{id:'intervals',label:'Intervals',icon:'↔'},{id:'chords',label:'Chords',icon:'♪'},{id:'scales',label:'Scales',icon:'〜'}];

// ── Shared staff notation constants ─────────────────────────────────────────
const STAFF_LSEMI=[0,2,4,5,7,9,11]; // natural semitone for C D E F G A B
const STAFF_ROOT_LI=[0,0,1,2,2,3,3,4,5,5,6,6]; // preferred letter index per root semitone
const STAFF_SHARP_KEYS=new Set([7,2,9,4,11,6,1]);
const KS_SHARP_STEPS=[10,7,11,8,5,9,6];
const KS_SHARP_LI   =[3, 0, 4, 1, 5, 2, 6];
const KS_FLAT_STEPS =[6, 9, 5, 8, 4, 7, 3];
const KS_FLAT_LI    =[6, 2, 5, 1, 4, 0, 3];
const KS_SHARPS={7:1,2:2,9:3,4:4,11:5,6:6,1:7};
const KS_FLATS ={5:1,10:2,3:3,8:4};

// Spell a sequence of semitone intervals (relative to rootSemi) onto staff steps,
// respecting the key signature so accidentals show as modifications of the key sig
// (e.g. B natural in F major shows as B♯ over B♭, not B♮).
// Spell notes onto the staff using explicit diatonic degrees.
// degs[i] = 0-based diatonic degree for ivs[i] (e.g. root=0, 2nd=1, 3rd=2, 5th=4, 7th=6, 9th=8)
// sharpSet/flatSet from key signature adjust the "natural" pitch of each letter.
function spellNotes(rootSemi, ivs, degs, sharpSet=new Set(), flatSet=new Set()){
  const rootLi=STAFF_ROOT_LI[rootSemi];
  return ivs.map((iv,ni)=>{
    const semi=(rootSemi+iv)%12;
    // Try the canonical degree letter; if it needs a double accidental, respell
    // by shifting to the adjacent letter (±1 step) to find a simpler spelling.
    for(const adjust of [0, 1, -1]){
      const absLi=rootLi+degs[ni]+adjust;
      const li=((absLi%7)+7)%7;
      const nat=STAFF_LSEMI[li];
      const ksDelta=sharpSet.has(li)?1:flatSet.has(li)?-1:0;
      const effNat=(nat+ksDelta+12)%12;
      const diff=((semi-effNat+12)%12);
      const totalDelta=ksDelta+(diff===1?1:diff===11?-1:diff===2?2:diff===10?-2:0);
      // Accept this spelling if it avoids a double accidental
      if(Math.abs(totalDelta)<=1){
        const acc=diff===0?null:diff===1?'♯':diff===11?'♭':null;
        const displayAcc=totalDelta===0?'':totalDelta===1?'#':'b';
        const shownAcc=totalDelta===0&&ksDelta!==0?'♮':acc;
        return{step:absLi, acc:shownAcc, li, displayAcc};
      }
    }
    // Fallback: canonical spelling even if double accidental needed (e.g. dim7 Bbb)
    const absLi=rootLi+degs[ni];
    const li=absLi%7;
    const nat=STAFF_LSEMI[li];
    const ksDelta=sharpSet.has(li)?1:flatSet.has(li)?-1:0;
    const effNat=(nat+ksDelta+12)%12;
    const diff=((semi-effNat+12)%12);
    const acc=diff===0?null:diff===1?'♯':diff===11?'♭':diff===2?'𝄪':diff===10?'𝄫':null;
    const totalDelta=ksDelta+(acc==='♯'?1:acc==='♭'?-1:acc==='𝄪'?2:acc==='𝄫'?-2:0);
    const displayAcc=totalDelta===0?'':totalDelta===1?'#':totalDelta===-1?'b':totalDelta===2?'##':totalDelta===-2?'bb':'';
    const shownAcc=totalDelta===0&&ksDelta!==0?'♮':acc;
    return{step:absLi, acc:shownAcc, li, displayAcc};
  });
}

// Compute key signature signs for a root semitone
function keySigns(rootSemi){
  const numSharps=KS_SHARPS[rootSemi]||0;
  const numFlats =KS_FLATS[rootSemi]||0;
  const signs=numSharps>0
    ? KS_SHARP_STEPS.slice(0,numSharps).map((s,ki)=>({s,acc:'♯',li:KS_SHARP_LI[ki]}))
    : numFlats>0
    ? KS_FLAT_STEPS.slice(0,numFlats).map((s,ki)=>({s,acc:'♭',li:KS_FLAT_LI[ki]}))
    : [];
  const sharpSet=new Set(numSharps>0?KS_SHARP_LI.slice(0,numSharps):[]);
  const flatSet =new Set(numFlats >0?KS_FLAT_LI.slice(0,numFlats) :[]);
  return{signs,sharpSet,flatSet};
}

// StaffNotation: renders notes on a treble staff with clef + key signature.
// props:
//   rootSemi   — root note semitone (0-11)
//   notes      — [{step, acc, li, label?}] — already-spelled notes
//   mode       — 'melodic' (sequential, one per x slot) | 'harmonic' (all stacked at centre)
//   subtitle   — string shown below the root name
function StaffNotation({rootSemi, ksSemi, notes, mode='melodic', subtitle, dark=false}){
  const SW=340, SH=130, MR=14;
  const lineGap=11;
  const L0=28;
  const botLineY=L0+4*lineGap;
  const yForStep=s=>botLineY-(s-2)*(lineGap/2);
  const clefSize=Math.round(lineGap*7);
  const clefY=botLineY+lineGap*0.6;
  const staffColor=dark?'rgba(242,238,230,.35)':'#BEC9A6';
  const noteColor=dark?'rgba(242,238,230,.9)':'#405147';
  const accColor=dark?'rgba(198,165,133,.9)':'#A0522D';
  const labelColor=dark?'rgba(156,183,177,.7)':'#9CB7B1';
  const titleColor=dark?'rgba(242,238,230,.6)':'#9CB7B1';
  const subtitleColor=dark?'rgba(242,238,230,.45)':'#9CB7B1';

  const {signs,sharpSet,flatSet}=keySigns(ksSemi??rootSemi);
  const clefW=22;
  const ksW=signs.length*9;
  const ML=36+clefW+ksW;
  const usable=SW-ML-MR;

  function ledgers(step){
    const ls=[];
    for(let s=0;s>=step;s-=2) ls.push(s);
    for(let s=12;s<=step;s+=2) ls.push(s);
    return ls;
  }

  // For melodic: each note gets its own x slot
  // For harmonic: all notes share the centre x, stem goes from lowest to highest+extension
  const noteXs = mode==='harmonic'
    ? notes.map(()=>ML+usable*0.5)
    : notes.map((_,i)=>ML+usable*(i+0.5)/notes.length);

  // For harmonic chords: single stem from bottom note to top note + 3 lineGaps
  const minStep=notes.length>0?Math.min(...notes.map(n=>n.step)):0;
  const maxStep=notes.length>0?Math.max(...notes.map(n=>n.step)):0;
  const chordStemUp=minStep<6;
  const chordX=ML+usable*0.5;

  return(
    <div style={{margin:'4px 0 6px'}}>
      <div style={{textAlign:'center',marginBottom:6}}>
        <span style={{fontFamily:"'Fraunces',serif",fontSize:17,fontWeight:700,color:titleColor}}>{NOTES[rootSemi]}</span>
        {subtitle&&<><span style={{fontSize:17,color:subtitleColor,margin:'0 5px'}}>·</span>
        <span style={{fontSize:17,color:subtitleColor}}>{subtitle}</span></>}
      </div>
      <svg width='100%' viewBox={`0 0 ${SW} ${SH}`} style={{display:'block'}}>
        {[0,1,2,3,4].map(i=>(
          <line key={i} x1={2} y1={L0+i*lineGap} x2={SW-MR} y2={L0+i*lineGap} stroke={staffColor} strokeWidth={1}/>
        ))}
        <text x={2} y={clefY} fontSize={clefSize} fontFamily='serif' fill={staffColor} style={{userSelect:'none',lineHeight:1}}>𝄞</text>
        {signs.map(({s,acc},ki)=>(
          <text key={ki} x={36+ki*9} y={yForStep(s)+5} fontSize={13} fontWeight='900'
            fontFamily="'Work Sans',sans-serif" fill={staffColor} textAnchor='middle'
            style={{userSelect:'none'}}>{acc}</text>
        ))}

        {/* Harmonic chord: single stem */}
        {mode==='harmonic'&&notes.length>0&&(chordStemUp
          ?<line x1={chordX+5} y1={yForStep(minStep)-1} x2={chordX+5} y2={yForStep(maxStep)-30} stroke={noteColor} strokeWidth={1.5}/>
          :<line x1={chordX-5} y1={yForStep(maxStep)+1} x2={chordX-5} y2={yForStep(minStep)+30} stroke={noteColor} strokeWidth={1.5}/>
        )}

        {notes.map(({step,acc,li,label},i)=>{
          const x=noteXs[i];
          const y=yForStep(step);
          const stemUp=step<6;
          const coveredByKS=(acc==='♯'&&sharpSet.has(li))||(acc==='♭'&&flatSet.has(li));
          const showAcc=acc==='♮'?'♮':acc&&!coveredByKS?acc:null;
          // Collision: in harmonic mode, a note that is exactly 1 step from its neighbour
          // must be flipped to the other side of the stem.
          // stem-up  → default side is LEFT of stem; collision note goes RIGHT (+noteW)
          // stem-down → default side is RIGHT of stem; collision note goes LEFT (-noteW)
          // We track each note's resolved xOff so chains propagate correctly.
          let xOff=0;
          if(mode==='harmonic'&&i>0){
            const prevStep=notes[i-1].step;
            const prevXOff=notes[i-1]._xOff||0;
            if(Math.abs(step-prevStep)===1){
              // flip: if previous was at default (0), move this one to the other side;
              // if previous was already flipped, come back to default
              xOff=prevXOff===0?(chordStemUp?11:-11):-prevXOff;
            }
          }
          notes[i]._xOff=xOff;
          const nx=x+xOff;
          return(
            <g key={i}>
              {ledgers(step).map(s=>(
                <line key={s} x1={nx-9} y1={yForStep(s)} x2={nx+9} y2={yForStep(s)} stroke={staffColor} strokeWidth={1}/>
              ))}
              {showAcc&&(
                <text x={nx-14} y={y+5} fontSize={15} fontWeight='900'
                  fontFamily="'Work Sans',sans-serif" fill={accColor} textAnchor='middle'
                  style={{userSelect:'none'}}>{showAcc}</text>
              )}
              <ellipse cx={nx} cy={y} rx={5.5} ry={4} fill={noteColor} transform={`rotate(-12,${nx},${y})`}/>
              {mode==='melodic'&&(stemUp
                ?<line x1={nx+5} y1={y-1} x2={nx+5} y2={y-28} stroke={noteColor} strokeWidth={1.5}/>
                :<line x1={nx-5} y1={y+1} x2={nx-5} y2={y+28} stroke={noteColor} strokeWidth={1.5}/>
              )}
              {label!=null&&mode==='melodic'&&<text x={x} y={SH-4} fontSize={9} fill={labelColor} textAnchor='middle'
                fontFamily="'Work Sans',sans-serif" fontWeight='600' fill={labelColor}>{label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function EarTraining({profile,setProfile,initialMode,onBack}){
  const[mode,setMode]          =useState(initialMode||'intervals');
  const[question,setQuestion]  =useState(null);
  const[selected,setSelected]  =useState(null);
  const[pendingAnswer,setPendingAnswer]=useState(null);
  const[bounce,setBounce]      =useState(null);
  const[bounceKey,setBounceKey]=useState(0);
  const[round,setRound]        =useState(0);
  const[playing,setPlaying]    =useState(false);
  const[fillDur,setFillDur]    =useState(1800);
  const[revealed,setRevealed]  =useState(false);
  const[readyToReveal,setReadyToReveal]=useState(false); // audio done, waiting for user to request choices
  const[weights,setWeights]    =useState({});
  const[conf,setConf]          =useState({});
  const[showCfg,setShowCfg]   =useState(false);
  const[settingsLoaded,setSettingsLoaded]=useState(false);
  const[globalSettings,setGlobalSettings]=useState({});
  const[settings,setSettings] =useState({
    intervals:defaultSettings('intervals'),
    chords:defaultSettings('chords'),
    scales:defaultSettings('scales'),
  });
  const content=getContent(settings);
  const playingR=useRef(false);
  const unlocked=useRef(false);
  const isFirstQ=useRef(false);
  const revealRef=useRef(null);
  const revealedRef=useRef(false);
  const displayRef=useRef(false); // alternates staff/piano each round



  // Load persisted settings for all modes + global
  useEffect(()=>{
    Promise.all([
      Promise.all(['intervals','chords','scales'].map(m=>loadSettings(m)))
      .then(([iv,ch,sc])=>setSettings({intervals:iv,chords:ch,scales:sc})),
      loadGlobal().then(g=>setGlobalSettings(g)),
    ]).catch(()=>{}).finally(()=>setSettingsLoaded(true));
  },[]);

  // Build question — wait until persisted settings are loaded
  useEffect(()=>{
    if(!settingsLoaded)return;
    const cfg=content[mode];if(!cfg?.pool?.length)return;
    displayRef.current=!displayRef.current;
    const q=buildQ(mode,content,weights,conf);
    if(['interval','chord','scale'].includes(q.type)) q.displayMode=displayRef.current?'piano':'staff';
    if(q.subtype==='missing') q.displayMode='piano'; // missing always uses piano layout
    setQuestion(q);
    setSelected(null);setBounce(null);setPendingAnswer(null);
    setReadyToReveal(false);
    // Missing questions now go through the same sing-back gate as normal questions
    setRevealed(false);revealedRef.current=false;
  },[round,mode,settingsLoaded]);

  // Auto-play audio when a new question loads
  useEffect(()=>{
    if(!question||!unlocked.current)return;
    const t=setTimeout(()=>{playingR.current=false;doPlay(question,true);},300);
    return()=>clearTimeout(t);
  },[question]);

  function scheduleReveal(dur){
    clearTimeout(revealRef.current);
    revealRef.current=setTimeout(()=>{
      // Audio done — prompt user to sing back before revealing choices
      if(!revealedRef.current) setReadyToReveal(true);
    },dur);
  }

  const doPlay=useCallback(async(q,autoplay=false)=>{
    if(!q||playingR.current)return;
    playingR.current=true;setPlaying(true);
    try{
      const ctx=getCtx();if(ctx.state==='suspended')await ctx.resume();
      unlocked.current=true;
      const dur=scheduleAudio(ctx,q);
      setFillDur(dur);
      if(!revealedRef.current)scheduleReveal(dur);
      setTimeout(()=>{playingR.current=false;setPlaying(false);},dur);
    }catch{playingR.current=false;setPlaying(false);}
  },[]);

  const handleAnswer=useCallback((id)=>{
    if(selected!==null)return; // already submitted
    setPendingAnswer(id);
    if(question?.subtype==='missing'){
      // Missing: preview the note this answer represents
      try{const ctx=getCtx();playAnswerNote(ctx,question,id);}catch{}
    } else {
      // Normal: subtle tap click
      try{const ctx=getCtx();if(ctx.state==='suspended')ctx.resume().then(()=>playTap(ctx));else playTap(ctx);}catch{}
    }
  },[selected,question]);

  const handleSubmit=useCallback(()=>{
    if(pendingAnswer===null||selected!==null)return;
    clearTimeout(revealRef.current);
    const id=pendingAnswer;
    const cid=question.cid;
    const ok=String(id)===String(cid);
    setSelected(id);
    const newStreak=ok?(profile.streak||0)+1:0;
    setWeights(w=>({...w,[mode]:wUpd(w[mode]||initW(content[mode].pool||[]),cid,ok)}));
    if(!ok)setConf(c=>{const nm={...c};if(!nm[mode])nm[mode]={};if(!nm[mode][String(id)])nm[mode][String(id)]={};nm[mode][String(id)][String(cid)]=(nm[mode][String(id)][String(cid)]||0)+1;return nm;});
    if(ok){
      setBounce('✓');setBounceKey(k=>k+1);
      const np={...profile,streak:newStreak};setProfile(np);saveProfile(np);
    } else {
      const np={...profile,streak:newStreak};setProfile(np);saveProfile(np);
      setBounce('✗');setBounceKey(k=>k+1);
    }
    try{const ctx=getCtx();ok?playOK(ctx):playNG(ctx);}catch{}
  },[pendingAnswer,selected,question,mode,content,profile]);

  function handleNextInner(){
    setSelected(null);setPendingAnswer(null);setBounce(null);
    setRevealed(false);revealedRef.current=false;
    setReadyToReveal(false);
    setRound(r=>r+1);
  }

  function switchMode(m){
    if(!content[m]?.on&&m!=='intervals')return;
    clearTimeout(revealRef.current);
    isFirstQ.current=true;unlocked.current=false;
    setMode(m);setSelected(null);setPendingAnswer(null);setBounce(null);
    setRevealed(false);setReadyToReveal(false);
    setRound(r=>r+1);
  }

  function choiceLabel(id){
    if(mode==='intervals'){const iv=IV.find(x=>x.id===Number(id));return{name:iv?.name||id,abbr:iv?.abbr||''};}
    if(mode==='chords'){const ch=CH[id];return{name:ch?.name||id,abbr:ch?.abbr||''};}
    if(mode==='scales'){const sc=SC_BY[id];return{name:sc?.name||id,abbr:''};}
    return{name:id+' BPM',abbr:''};
  }

  const numChoices=question?.choices?.length||2;
  const modeLabel=EMODES.find(e=>e.id===mode);

  return(
    <><Styles/>
    <div className='et-root screen-enter'>

      {/* ── Header ── */}
      <div className='et-hdr'>
        <button className='et-back' onClick={()=>{
          clearTimeout(revealRef.current);
          stopCtx()
          onBack();
        }}>← Hub</button>
        <div className='et-hdr-mid'>
          <div className='et-mode-label'>{modeLabel?.icon} {modeLabel?.label}</div>
        </div>
        <div className='et-hdr-right'>
          <button className='et-icon-btn' onClick={()=>setShowCfg(true)} title='Settings'>⚙</button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className='et-scroll'>

        {question&&(<>
          <div key={round} className='et-question'>

            {/* ── Pre-reveal: centred title + play button ── */}
            {!revealed&&(()=>{
              const isMissing=question.subtype==='missing';
              let title='', subtitle2='';
              if(question.type==='interval'){
                const iv=IV.find(x=>x.id===question.cid);
                if(isMissing){title=iv?.name||'Interval';subtitle2='find the missing note';}
                else{const dir=question.dir;title=dir==='harm'?'Harmonic interval':dir==='desc'?'Descending interval':'Ascending interval';subtitle2='listen closely';}
              } else if(question.type==='chord'){
                const ch=CH[question.cid];
                if(isMissing){title=ch?.name||'Chord';subtitle2='find the missing note';}
                else{title=`${NOTES[question.root%12]} chord`;subtitle2='listen closely';}
              } else if(question.type==='scale'){
                const sc=SC_BY[question.cid];
                if(isMissing){title=sc?.name||'Scale';subtitle2='find the missing note';}
                else{const dir=question.dir;title=`${NOTES[question.root%12]} scale`;subtitle2=dir==='desc'?'descending':dir==='shuffle'?'shuffled':'ascending';}
              }

              // Build hint pills for missing questions — shown immediately so user knows what's known
              let hintPills=null;
              if(isMissing){
                if(question.type==='interval'){
                  const mn=question.missingNote;
                  const pillA=mn==='na'?{note:'?',label:'Start',missing:true}:{note:NOTES[question.na%12],label:'Start',missing:false};
                  const pillB=mn==='nb'?{note:'?',label:'End',missing:true}:{note:NOTES[question.nb%12],label:'End',missing:false};
                  const arrow=question.dir==='desc'?'←':question.dir==='harm'?'⬡':'→';
                  hintPills=(<div className='et-notes-row'>
                    <div className={'et-npill '+(pillA.missing?'et-npill-b':'et-npill-a')}><div className='et-nnm'>{pillA.note}</div><div className='et-nsub'>{pillA.label}</div></div>
                    <span className='et-arrow'>{arrow}</span>
                    <div className={'et-npill '+(pillB.missing?'et-npill-b':'et-npill-a')}><div className='et-nnm'>{pillB.note}</div><div className='et-nsub'>{pillB.label}</div></div>
                  </div>);
                } else if(question.type==='chord'){
                  const ch=CH[question.cid];
                  const LETTERS='CDEFGAB';
                  const {sharpSet,flatSet}=keySigns(question.root%12);
                  const rootNotes=spellNotes(question.root%12,ch.ivs,ch.degs,sharpSet,flatSet);
                  const chordPills=rootNotes.map((n,i)=>({name:LETTERS[n.li%7]+(n.displayAcc||''),deg:i===0?'R':String(i+1),missing:i===question.missingIdx}));
                  hintPills=(<div className='et-notes-row' style={{flexWrap:'wrap',gap:6}}>
                    {chordPills.map((p,i)=>(
                      <div key={i} className={'et-npill '+(p.missing?'et-npill-b':'et-npill-a')}>
                        <div className='et-nnm'>{p.missing?'?':p.name}</div><div className='et-nsub'>{p.deg}</div>
                      </div>
                    ))}
                  </div>);
                } else if(question.type==='scale'){
                  const sc=SC_BY[question.cid];
                  const parentOffset=sc.parentOffset||0;
                  const ksSemi=question.ksSrc==='parent'?((question.root%12-parentOffset+12)%12):question.root%12;
                  const {sharpSet,flatSet}=keySigns(ksSemi);
                  const LETTERS='CDEFGAB';
                  const ascNotes=spellNotes(question.root%12,sc.ivs,sc.degs,sharpSet,flatSet);
                  const scalePills=ascNotes.map((n,i)=>({name:LETTERS[n.li%7]+(n.displayAcc||''),deg:String(i+1),missing:i===question.missingIdx}));
                  hintPills=(<div className='et-notes-row' style={{flexWrap:'wrap',gap:6}}>
                    {scalePills.map((p,i)=>(
                      <div key={i} className={'et-npill '+(p.missing?'et-npill-b':'et-npill-a')}>
                        <div className='et-nnm' style={{fontSize:15}}>{p.missing?'?':p.name}</div><div className='et-nsub'>{p.deg}</div>
                      </div>
                    ))}
                  </div>);
                }
              }

              return(
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',minHeight:0}}>
                  {/* Title + button group — lifts up when readyToReveal */}
                  <div style={{
                    display:'flex',flexDirection:'column',alignItems:'center',gap:28,
                    animation:readyToReveal?'ri_liftUp .5s cubic-bezier(.4,0,.2,1) forwards':'none',
                    width:'100%',maxWidth:300,
                  }}>
                    <div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:34,fontWeight:700,color:'#F2EEE6',lineHeight:1.1,letterSpacing:-.3,marginBottom:8}}>
                        {title}
                      </div>
                      <div style={{fontSize:13,color:'rgba(156,183,177,.5)',fontStyle:'italic'}}>
                        {subtitle2}
                      </div>
                    </div>
                    {/* Hint pills — visible immediately for missing questions */}
                    {hintPills}
                    <button className={'et-play-btn'+((!playing&&!unlocked.current)?' idle-pulse':'')}
                      onClick={()=>doPlay(question)} disabled={playing}
                      style={{width:'100%'}}>
                      {playing&&<div key={'pf'+round} className='play-fill' style={{animationName:'ri_playFill',animationDuration:fillDur+'ms',animationTimingFunction:'linear',animationFillMode:'forwards'}}/>}
                      <span className='play-btn-inner'>
                        {playing
                          ?<><div className='wave-bars'><div className='wave-bar wb1'/><div className='wave-bar wb2'/><div className='wave-bar wb3'/><div className='wave-bar wb4'/><div className='wave-bar wb5'/></div>Listening…</>
                          :<span>{unlocked.current?'Play again':'Listen'}</span>}
                      </span>
                    </button>
                  </div>
                  {/* Singing prompt + I'm ready — fades in below after audio */}
                  {readyToReveal&&(
                    <div style={{opacity:0,animation:'ri_fadeIn .6s ease .35s forwards',width:'100%',maxWidth:280,marginTop:40}}>
                      <div style={{fontFamily:"'Fraunces',serif",fontStyle:'italic',fontSize:16,color:'rgba(156,183,177,.6)',lineHeight:1.7,marginBottom:20}}>
                        {isMissing
                          ?<>Sing the missing note.<br/><span style={{fontSize:13,opacity:.8}}>When you can hear it, see the options.</span></>
                          :<>Sing or hum it back.<br/><span style={{fontSize:13,opacity:.8}}>When you're ready, see the options.</span></>
                        }
                      </div>
                      <button onClick={()=>{setRevealed(true);revealedRef.current=true;}} className='et-next'>
                        I'm ready
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Post-reveal: visuals (piano/staff/pills) ── */}
            {revealed&&(<>
            {/* Title at top for missing-note questions */}
            {question.subtype==='missing'&&(()=>{
              let title='';
              if(question.type==='interval'){const iv=IV.find(x=>x.id===question.cid);title=iv?.name||'Interval';}
              else if(question.type==='chord'){const ch=CH[question.cid];title=ch?.name||'Chord';}
              else if(question.type==='scale'){const sc=SC_BY[question.cid];title=sc?.name||'Scale';}
              return(
                <div style={{textAlign:'center',marginBottom:12,opacity:0,animation:'ri_fadeIn .4s ease forwards'}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:700,color:'#F2EEE6',letterSpacing:-.2,lineHeight:1.1}}>
                    {title}
                  </div>
                  <div style={{fontSize:12,color:'rgba(156,183,177,.5)',fontStyle:'italic',marginTop:5}}>
                    find the missing note
                  </div>
                </div>
              );
            })()}
            {question.type==='interval'&&question.displayMode==='piano'&&(()=>{
              const isMissing=question.subtype==='missing';
              const missingNote=question.missingNote; // 'na' or 'nb'
              const iv=IV.find(x=>x.id===question.cid);
              const pillA=isMissing&&missingNote==='na'
                ?{note:'?',label:'Start',missing:true}
                :{note:NOTES[question.na%12],label:isMissing?'Known':'Root',missing:false};
              const pillB=isMissing&&missingNote==='nb'
                ?{note:'?',label:'End',missing:true}
                :{note:NOTES[question.nb%12],label:isMissing?'Known':'Target',missing:false};
              const visibleNa=isMissing&&missingNote==='na'?null:question.na;
              const visibleNb=isMissing&&missingNote==='nb'?null:question.nb;
              return(<div>
                {/* title now in choices header */}
                <Piano na={visibleNa??question.na} nb={visibleNb??question.nb}
                  hiddenNote={isMissing?(missingNote==='na'?question.na:question.nb):null} dark/>
                <div className='et-notes-row'>
                  <div className={'et-npill '+(pillA.missing?'et-npill-b':'et-npill-a')}>
                    <div className='et-nnm'>{pillA.note}</div><div className='et-nsub'>{pillA.label}</div>
                  </div>
                  <span className='et-arrow'>{question.dir==='desc'?'←':question.dir==='harm'?'⬡':'→'}</span>
                  <div className={'et-npill '+(pillB.missing?'et-npill-b':'et-npill-a')}>
                    <div className='et-nnm'>{pillB.note}</div><div className='et-nsub'>{pillB.label}</div>
                  </div>
                </div>
              </div>);
            })()}
            {question.type==='interval'&&question.displayMode==='staff'&&(()=>{
              const isMissing=question.subtype==='missing';
              const missingNote=question.missingNote;
              const iv=IV.find(x=>x.id===question.cid);
              const rootSemi=question.na%12;
              const semitones=question.cid;
              const octaves=Math.floor(semitones/12);
              const semMod=semitones%12;
              const {sharpSet,flatSet}=keySigns(0); // intervals always in C major (no key sig)
              const EXPECTED=[0,1,1,2,2,3,3,4,5,5,6,6,7];
              const SL=[0,2,4,5,7,9,11],RL=[0,0,1,2,2,3,3,4,5,5,6,6];
              const rootLi=RL[rootSemi];
              const expected=EXPECTED[semMod]??1;
              let bestDeg=expected;
              const targetSemi=(rootSemi+semMod)%12;
              for(const d of [expected,expected-1,expected+1,0,expected+2,expected-2,expected+3]){
                if(d<0||d>8)continue;
                const li=((rootLi+d)%7+7)%7;
                const ksDelta=sharpSet.has(li)?1:flatSet.has(li)?-1:0;
                const effNat=(SL[li]+ksDelta+12)%12;
                const diff=((targetSemi-effNat+12)%12);
                const total=ksDelta+(diff===1?1:diff===11?-1:diff===2?2:diff===10?-2:0);
                if(Math.abs(total)<=1){bestDeg=d;break;}
              }
              let spelled=spellNotes(rootSemi,[0,semMod],[0,bestDeg],sharpSet,flatSet)
                .map((n,i)=>({...n,step:i===1?n.step+(octaves*7):n.step}));
              // For missing: remove the hidden note from staff
              if(isMissing){
                spelled=spelled.filter((_,i)=>(i===0&&missingNote!=='na')||(i===1&&missingNote!=='nb'));
              }
              const desc=question.dir==='desc';
              const harm=question.dir==='harm';
              const notes=desc?[...spelled].reverse():spelled;
              const subtitle=isMissing?(iv?.name||'?'):(desc?'↓ Descending':harm?'Harmonic':'↑ Ascending');
              const knownSemi=missingNote==='na'?question.nb%12:question.na%12;
              const [pillA,pillB]=isMissing
                ?missingNote==='na'
                  ?[{note:'?',label:'Start',missing:true},{note:NOTES[question.nb%12],label:'Known',missing:false}]
                  :[{note:NOTES[question.na%12],label:'Known',missing:false},{note:'?',label:'End',missing:true}]
                :desc
                  ?[{note:NOTES[question.nb%12],label:'Start',missing:false},{note:NOTES[question.na%12],label:'End',missing:false}]
                  :[{note:NOTES[question.na%12],label:'Root',missing:false},{note:NOTES[question.nb%12],label:'Target',missing:false}];
              return(<div>
                {/* title now in choices header */}
                <StaffNotation rootSemi={rootSemi} ksSemi={0} notes={notes} mode={harm?'harmonic':'melodic'} subtitle={isMissing?null:subtitle} dark/>
                <div className='et-notes-row'>
                  <div className={'et-npill '+(pillA.missing?'et-npill-b':'et-npill-a')}><div className='et-nnm'>{pillA.note}</div><div className='et-nsub'>{pillA.label}</div></div>
                  <span className='et-arrow'>{desc?'←':harm?'⬡':'→'}</span>
                  <div className={'et-npill '+(pillB.missing?'et-npill-b':'et-npill-a')}><div className='et-nnm'>{pillB.note}</div><div className='et-nsub'>{pillB.label}</div></div>
                </div>
              </div>);
            })()}
            {question.type==='chord'&&(()=>{
              const ch=CH[question.cid];
              const rootSemi=question.root%12;
              const inv=question.inversion||0;
              const {sharpSet,flatSet}=keySigns(rootSemi);
              const rootNotes=spellNotes(rootSemi, ch.ivs, ch.degs, sharpSet, flatSet);
              const invNotes=rootNotes.map((n,i)=>i<inv?{...n,step:n.step+7}:n);
              const sorted=[...invNotes].sort((a,b)=>a.step-b.step);
              const ORDINAL=['Root','1st','2nd','3rd','4th'];
              const invLabel=inv===0?null:ORDINAL[inv]+' inv.';
              const LETTERS='CDEFGAB';
              const isMissing=question.subtype==='missing';
              const missingIdx=question.missingIdx??-1;
              // Pills: show ? for missing note
              const chordPills=rootNotes.map((n,i)=>({
                name:LETTERS[n.li%7]+(n.displayAcc||''),
                deg:i===0?'R':String(i+1),
                missing:isMissing&&i===missingIdx,
              }));
              const notes=sorted.map((n,i)=>({...n,label:i===0?'R':String(i+1)}));
              // For missing: hide missing note from piano/staff
              const invIvs=ch.ivs.map((iv,k)=>k<inv?iv+12:iv).slice(inv).concat(ch.ivs.slice(0,inv).map(iv=>iv+12));
              const visibleInvIvs=isMissing?invIvs.filter((_,k)=>{
                // Map inverted index back to root-position index
                const rootIdx=k<ch.ivs.length-inv?k+inv:k-(ch.ivs.length-inv);
                return rootIdx!==missingIdx;
              }):invIvs;
              const visibleNotes=isMissing?notes.filter((_,k)=>{
                const rootIdx=sorted[k]?rootNotes.indexOf(sorted[k].source??sorted[k]):k;
                return true; // We'll null-label the missing one instead
              }):notes;
              // Null the label on the missing note in sorted order
              const staffNotes=isMissing?sorted.map((n,k)=>{
                // Find which root-position note this is
                const rootIdx=rootNotes.findIndex(rn=>rn.step===n.step||(rn.step+7)===n.step);
                if(rootIdx===missingIdx) return null; // skip
                return{...n,label:rootIdx===0?'R':String(rootIdx+1)};
              }).filter(Boolean):notes;
              const pills=(
                <div className='et-notes-row' style={{marginTop:10,flexWrap:'wrap',gap:6}}>
                  {chordPills.map((p,i)=>(
                    <div key={i} className={'et-npill '+(p.missing?'et-npill-b':'et-npill-a')}>
                      <div className='et-nnm'>{p.missing?'?':p.name}</div>
                      <div className='et-nsub'>{p.deg}</div>
                    </div>
                  ))}
                </div>
              );
              if(question.displayMode==='piano'){
                return(<div>
                  {invLabel&&<div style={{fontSize:11,color:'rgba(242,238,230,.45)',marginBottom:6,textAlign:'center'}}>{invLabel}</div>}
                  <MultiPiano root={rootSemi} ivs={visibleInvIvs} dark/>
                  {pills}
                </div>);
              }
              return(<div>
                <StaffNotation rootSemi={rootSemi} notes={staffNotes} mode='harmonic' subtitle={invLabel} dark/>{pills}</div>);
            })()}
            {question.type==='scale'&&(()=>{
              const sc=SC_BY[question.cid];
              const dir=question.dir;
              const rootSemi=question.root%12;
              const parentOffset=sc.parentOffset||0;
              const ksSemi=question.ksSrc==='parent'?((rootSemi-parentOffset+12)%12):rootSemi;
              const {sharpSet,flatSet}=keySigns(ksSemi);
              const ascNotes=spellNotes(rootSemi, sc.ivs, sc.degs, sharpSet, flatSet).map((n,i)=>({...n,label:null}));
              const isMissing=question.subtype==='missing';
              const missingIdx=question.missingIdx??-1;
              let notes,subtitle;
              if(dir==='desc'){notes=[...ascNotes].reverse();subtitle='↓ Descending';}
              else if(dir==='shuffle'){
                const shuffled=question.shuffledIvs||sc.ivs;
                const ivToNote=Object.fromEntries(sc.ivs.map((iv,i)=>[iv,ascNotes[i]]));
                notes=shuffled.filter(iv=>iv!==12).map(iv=>ivToNote[iv]);
                subtitle='↕ Shuffled';
              } else {notes=ascNotes;subtitle='↑ Ascending';}
              const LETTERS='CDEFGAB';
              const scalePills=ascNotes.map((n,i)=>{
                const name=LETTERS[n.li%7]+(n.displayAcc||'');
                return{name,deg:String(i+1),missing:isMissing&&i===missingIdx};
              });
              // Visible ivs for piano: exclude missing
              const visibleIvs=isMissing?sc.ivs.filter((_,i)=>i!==missingIdx):sc.ivs;
              const pillsRow=(
                <div className='et-notes-row' style={{marginTop:10,flexWrap:'wrap',gap:6}}>
                  {scalePills.map((p,i)=>(
                    <div key={i} className={'et-npill '+(p.missing?'et-npill-b':'et-npill-a')}>
                      <div className='et-nnm' style={{fontSize:15}}>{p.missing?'?':p.name}</div>
                      <div className='et-nsub'>{p.deg}</div>
                    </div>
                  ))}
                </div>
              );
              // For staff missing: filter out the missing-indexed note from ascNotes, then re-derive ordered notes
              const visibleAscNotes=isMissing?ascNotes.filter((_,i)=>i!==missingIdx):ascNotes;
              let staffNotes;
              if(dir==='desc') staffNotes=[...visibleAscNotes].reverse();
              else if(dir==='shuffle'){
                const shuffled=question.shuffledIvs||sc.ivs;
                const ivToVisNote=Object.fromEntries(sc.ivs.map((iv,i)=>[iv,ascNotes[i]]));
                staffNotes=shuffled.filter(iv=>iv!==12).map(iv=>ivToVisNote[iv]).filter(n=>n&&(!isMissing||ascNotes.indexOf(n)!==missingIdx));
              } else staffNotes=visibleAscNotes;
              if(question.displayMode==='piano'){
                return(<div>
                  <div style={{fontSize:11,color:'rgba(242,238,230,.45)',marginBottom:6,textAlign:'center'}}>{subtitle}</div>
                  <MultiPiano root={rootSemi} ivs={visibleIvs} dark/>
                  {pillsRow}
                </div>);
              }
              return(<div>
                <StaffNotation rootSemi={rootSemi} ksSemi={ksSemi} notes={staffNotes} mode='melodic' subtitle={subtitle} dark/>{pillsRow}</div>);
            })()}
            </>)}

            {/* Play again button — shown after reveal for replay */}
            {revealed&&(
              <button className='et-play-btn' onClick={()=>doPlay(question)} disabled={playing} style={{marginTop:4}}>
                <span className='play-btn-inner'>
                  {playing
                    ?<><div className='wave-bars'><div className='wave-bar wb1'/><div className='wave-bar wb2'/><div className='wave-bar wb3'/><div className='wave-bar wb4'/><div className='wave-bar wb5'/></div>Listening…</>
                    :<span>Play again</span>}
                </span>
              </button>
            )}

          </div>

          {revealed&&(question.choices||question.noteChoices)&&(
            <div className='et-choices'>
              <div className='et-choices-lbl'>{question.subtype==='missing'?'which note is missing?':'what do you hear?'}</div>
              {bounce&&<div key={bounceKey} className='et-bounce' style={{color:bounce.startsWith('+')||bounce==='✓'?'#9CB7B1':'rgba(198,165,133,.9)'}}>{bounce}</div>}
              {(()=>{
                const isMissing=question.subtype==='missing';
                const items=isMissing
                  ?(question.noteChoices||[])
                  :(question.choices||[]).map(ch=>({id:typeof ch==='object'?ch.id:ch,_ch:ch}));
                const correctId=String(question.cid);
                return(<>
                  <div className='et-grid' style={items.length<=3?{gridTemplateColumns:'repeat(3,1fr)'}:{}}>
                    {items.map((item,ci)=>{
                      const id=String(item.id);
                      const lbl=isMissing?{name:item.noteName,abbr:''}:choiceLabel(item.id);
                      let cls='et-cbtn';
                      if(selected!==null){
                        if(id===correctId)cls+=' et-correct';
                        else if(String(selected)===id)cls+=' et-wrong';
                      } else if(String(pendingAnswer)===id){
                        cls+=' et-pending';
                      }
                      const staggerStyle=selected===null&&pendingAnswer===null?{animation:`ri_choiceIn .4s ease ${ci*70}ms both`}:{};
                      return(<button key={id+'-'+ci} className={cls} style={staggerStyle}
                        onClick={()=>handleAnswer(item.id)} disabled={selected!==null}>
                        {lbl.abbr&&<span className='et-cabbr'>{lbl.abbr}</span>}
                        <span>{lbl.name}</span>
                      </button>);
                    })}
                  </div>
                  {selected===null
                    ?<button onClick={handleSubmit} className='et-next' disabled={pendingAnswer===null} style={{opacity:pendingAnswer===null?0.3:1}}>Confirm</button>
                    :<button onClick={handleNextInner} className='et-next'>Continue</button>
                  }
                </>);
              })()}
            </div>
          )}

        </>)}
      </div>

      {showCfg&&<SettingsSheet mode={mode} settings={settings[mode]}
        globalSettings={globalSettings}
        onSave={(cfg,gdraft)=>{
          const ns={...settings,[mode]:cfg};
          setSettings(ns);saveSettings(mode,cfg);
          setGlobalSettings(gdraft);saveGlobal(gdraft);
          setShowCfg(false);
          clearTimeout(revealRef.current);
          stopCtx()
          setSelected(null);setPendingAnswer(null);setBounce(null);
          setRevealed(false);revealedRef.current=false;setPlaying(false);setReadyToReveal(false);
          isFirstQ.current=true;unlocked.current=false;
          setRound(r=>r+1);
        }}
        onClose={()=>setShowCfg(false)}/> }
    </div>
    </>
  );
}

// ── Transcription ─────────────────────────────────────────────────────────────

const TR_LEVELS=[
  {id:0, label:'2 Notes',   noteCount:2, semRange:12, pool:'white'},
  {id:1, label:'3 Notes',   noteCount:3, semRange:12, pool:'white'},
  {id:2, label:'4 Notes',   noteCount:4, semRange:12, pool:'all'},
  {id:3, label:'5 Notes',   noteCount:5, semRange:16, pool:'all'},
  {id:4, label:'6 Notes',   noteCount:6, semRange:19, pool:'all'},
];
const TR_WHITE=[0,2,4,5,7,9,11]; // semitones of white keys within an octave

function buildMelody(level){
  const cfg=TR_LEVELS[level]||TR_LEVELS[0];
  // Use MIDI-like absolute semitones with base=48 (C4 display), but audio uses sf(abs-48)
  // Pool spans C4 (48) to B4 (59) for white-only, wider for all
  const base=48;
  const pool=cfg.pool==='white'
    ?TR_WHITE.map(s=>base+s)
    :[...Array(cfg.semRange)].map((_,i)=>base+i);
  const notes=[];
  let prev=null;
  for(let i=0;i<cfg.noteCount;i++){
    const candidates=pool.filter(n=>n!==prev);
    const scored=candidates.map(n=>({n,w:prev===null?1:Math.max(0.5,4-Math.abs(n-prev)*0.4)}));
    const tot=scored.reduce((s,x)=>s+x.w,0);
    let r=Math.random()*tot;
    let picked=candidates[candidates.length-1];
    for(const x of scored){r-=x.w;if(r<=0){picked=x.n;break;}}
    notes.push(picked);
    prev=picked;
  }
  return notes;
}

function scheduleMelody(ctx,notes){
  const n=ctx.currentTime;
  const gap=0.38;
  // Convert display absolute (base=48→C4=sf(0)) to sf-relative by subtracting 48
  notes.forEach((semi,i)=>tone(ctx,sf(semi-48),n+i*gap,0.32,0.22));
  return notes.length*gap*1000+400;
}

function TrPiano({onNote,inputNotes,targetNotes,revealed,dark=true}){
  // Tappable 2-octave piano C4–B5
  const base=48;
  const WW=28,GAP=2,BW=16,BH=54,WH=88,U=WW+GAP;
  const WK=[0,2,4,5,7,9,11];
  const BK_MAP=[[1,0],[3,1],[6,3],[8,4],[10,5]]; // [semMod, whiteIdx offset]
  const inputSet=new Set(inputNotes.map((_,i)=>i)); // not used directly
  const ws=[],bs=[];
  for(let oct=0;oct<2;oct++){
    const octBase=base+oct*12;
    WK.forEach((mod,wi)=>{
      const abs=octBase+mod;
      const inputCount=inputNotes.filter(n=>n===abs).length;
      const isTarget=revealed&&targetNotes.includes(abs);
      ws.push({abs,x:(oct*7+wi)*U,inputCount,isTarget});
    });
    BK_MAP.forEach(([mod,aw])=>{
      const abs=octBase+mod;
      const x=(oct*7+aw+1)*U-BW/2-1;
      const inputCount=inputNotes.filter(n=>n===abs).length;
      const isTarget=revealed&&targetNotes.includes(abs);
      bs.push({abs,x,inputCount,isTarget});
    });
  }
  const tw=2*7*U-GAP;
  const wFill=k=>{
    if(k.inputCount>0) return'rgba(156,183,177,.55)';
    if(k.isTarget) return'rgba(198,165,133,.35)';
    return dark?'rgba(242,238,230,.1)':'white';
  };
  const wStroke=k=>{
    if(k.inputCount>0) return'rgba(156,183,177,.8)';
    if(k.isTarget) return'rgba(198,165,133,.6)';
    return dark?'rgba(242,238,230,.18)':'#BEC9A6';
  };
  const bFill=k=>{
    if(k.inputCount>0) return'#9CB7B1';
    if(k.isTarget) return'#C6A585';
    return dark?'rgba(242,238,230,.18)':'#405147';
  };
  return(
    <div style={{overflowX:'auto',margin:'4px 0 10px',display:'flex',justifyContent:'center'}}>
      <svg width={Math.min(tw,370)} height={WH} viewBox={'0 0 '+tw+' '+WH} style={{display:'block',cursor:'pointer'}}
        onClick={e=>{
          // Hit-test: check black keys first (on top), then white
          const rect=e.currentTarget.getBoundingClientRect();
          const scaleX=tw/Math.min(tw,370);
          const px=(e.clientX-rect.left)*scaleX;
          const py=(e.clientY-rect.top)*(WH/rect.height);
          // Black keys first
          for(const k of bs){
            if(px>=k.x&&px<=k.x+BW&&py>=0&&py<=BH){onNote(k.abs);return;}
          }
          for(const k of ws){
            if(px>=k.x&&px<=k.x+WW&&py>=0&&py<=WH){onNote(k.abs);return;}
          }
        }}>
        {ws.map(k=><rect key={k.abs} x={k.x} y={0} width={WW} height={WH} rx={3}
          fill={wFill(k)} stroke={wStroke(k)} strokeWidth={1.5}/>)}
        {bs.map(k=><rect key={k.abs} x={k.x} y={0} width={BW} height={BH} rx={2}
          fill={bFill(k)}/>)}
        {/* Dot indicators for tapped notes on white keys */}
        {ws.filter(k=>k.inputCount>0).map(k=>(
          <circle key={'d'+k.abs} cx={k.x+WW/2} cy={WH-10} r={4} fill='#F2EEE6'/>
        ))}
        {bs.filter(k=>k.inputCount>0).map(k=>(
          <circle key={'d'+k.abs} cx={k.x+BW/2} cy={BH-9} r={3} fill='rgba(242,238,230,.8)'/>
        ))}
        {/* Note name labels on C keys */}
        {ws.filter(k=>k.abs%12===0).map(k=>(
          <text key={'l'+k.abs} x={k.x+WW/2} y={WH-2} textAnchor='middle'
            fontSize={8} fontFamily="'Work Sans',sans-serif" fill={dark?'rgba(242,238,230,.25)':'#9CB7B1'}>
            C{Math.floor(k.abs/12)-1}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Spell a single absolute semitone (base-48 system) onto treble staff
function spellMelodyNote(abs){
  const rel=abs-48;
  const oct=Math.floor(rel/12);
  const mod=((rel%12)+12)%12;
  const semToStep=[0,0,1,2,2,3,3,4,5,5,6,6];
  const semToAcc= [null,'♯',null,null,'♯',null,'♯',null,null,'♯',null,'♯'];
  const step=oct*7+semToStep[mod];
  const acc=semToAcc[mod];
  return{step,acc};
}

function TrStaff({melody,input,submitted,noteResults}){
  const SW=340,SH=140,MR=10,ML=28;
  const lineGap=11;
  const L0=32;
  const botLineY=L0+4*lineGap;
  const yForStep=s=>botLineY-(s-2)*(lineGap/2);
  const clefY=botLineY+lineGap*0.6;
  const clefSize=Math.round(lineGap*7);
  const usable=SW-ML-MR;
  const n=melody.length;
  function ledgers(step){
    const ls=[];
    for(let s=12;s<=step;s+=2) ls.push(s);
    for(let s=0;s>=step;s-=2) ls.push(s);
    return ls;
  }
  const staffColor='rgba(242,238,230,.35)';
  const correctColor='#9CB7B1';
  const wrongColor='rgba(198,165,133,.85)';
  const futureColor='rgba(242,238,230,.18)';
  return(
    <svg width='100%' viewBox={`0 0 ${SW} ${SH}`} style={{display:'block',margin:'4px 0 8px'}}>
      {[0,1,2,3,4].map(i=>(
        <line key={i} x1={2} y1={L0+i*lineGap} x2={SW-MR} y2={L0+i*lineGap} stroke={staffColor} strokeWidth={1}/>
      ))}
      <text x={2} y={clefY} fontSize={clefSize} fontFamily='serif' fill={staffColor} style={{userSelect:'none',lineHeight:1}}>&#119070;</text>
      {melody.map((abs,i)=>{
        const {step,acc}=spellMelodyNote(abs);
        const x=ML+usable*(i+0.5)/n;
        const y=yForStep(step);
        const isFilled=i<input.length;
        const isNext=i===input.length&&!submitted;
        const res=submitted&&isFilled?noteResults[i]:null;
        const fill=res?(res.correct?correctColor:wrongColor):isFilled?'rgba(242,238,230,.85)':futureColor;
        const ledgerLines=ledgers(step);
        return(
          <g key={i}>
            {ledgerLines.map(ls=>(
              <line key={ls} x1={x-10} y1={yForStep(ls)} x2={x+10} y2={yForStep(ls)} stroke={staffColor} strokeWidth={1}/>
            ))}
            {step<8
              ?<line x1={x+5} y1={y} x2={x+5} y2={y-28} stroke={fill} strokeWidth={1.5}/>
              :<line x1={x-5} y1={y} x2={x-5} y2={y+28} stroke={fill} strokeWidth={1.5}/>
            }
            <ellipse cx={x} cy={y} rx={6} ry={4.5} fill={fill}/>
            {acc&&<text x={x-11} y={y+4} fontSize={11} fontWeight='900'
              fontFamily="'Work Sans',sans-serif" fill={isFilled?fill:'rgba(242,238,230,.6)'}
              textAnchor='middle' style={{userSelect:'none'}}>{acc}</text>}
            {isNext&&<circle cx={x} cy={y+18} r={2.5} fill='rgba(156,183,177,.6)'/>}
          </g>
        );
      })}
    </svg>
  );
}

function Transcription({profile,setProfile,onBack}){
  const[level,setLevel]       =useState(0);
  const[inputMode,setInputMode]=useState('piano');
  const[melody,setMelody]     =useState(null);
  const[input,setInput]       =useState([]);
  const[playing,setPlaying]   =useState(false);
  const[fillDur,setFillDur]   =useState(1800);
  const[submitted,setSubmitted]=useState(false);
  const[inputReady,setInputReady]=useState(false); // user has sung it, ready to notate
  const[round,setRound]       =useState(0);
  const[score,setScore]       =useState({correct:0,total:0});
  const playingR=useRef(false);
  const unlocked=useRef(false);

  useEffect(()=>{
    const m=buildMelody(level);
    setMelody(m);setInput([]);setSubmitted(false);setInputReady(false);
  },[round,level]);

  useEffect(()=>{
    if(!melody||!unlocked.current)return;
    const t=setTimeout(()=>doPlay(melody),300);
    return()=>clearTimeout(t);
  },[melody]);

  const doPlay=useCallback(async(m)=>{
    const mel=m||melody;if(!mel||playingR.current)return;
    playingR.current=true;setPlaying(true);
    try{
      const ctx=getCtx();if(ctx.state==='suspended')await ctx.resume();
      unlocked.current=true;
      const dur=scheduleMelody(ctx,mel);
      setFillDur(dur);
      setTimeout(()=>{playingR.current=false;setPlaying(false);setInputReady(true);},dur);
    }catch{playingR.current=false;setPlaying(false);}
  },[melody]);

  function handleNote(semi){
    if(submitted||!melody||input.length>=melody.length)return;
    try{const ctx=getCtx();if(ctx.state==='suspended')ctx.resume().then(()=>tone(ctx,sf(semi-48),ctx.currentTime,0.32,0.2));else tone(ctx,sf(semi-48),ctx.currentTime,0.32,0.2);}catch{}
    setInput(prev=>[...prev,semi]);
  }

  function handleBackspace(){
    if(submitted||input.length===0)return;
    setInput(i=>i.slice(0,-1));
  }

  function handleSubmit(){
    if(!melody||input.length!==melody.length||submitted)return;
    setSubmitted(true);
    const correct=input.every((n,i)=>n===melody[i]);
    setScore(s=>({correct:s.correct+(correct?1:0),total:s.total+1}));
    try{const ctx=getCtx();correct?playOK(ctx):playNG(ctx);}catch{}
  }

  function handleNext(){ setRound(r=>r+1); }

  const isComplete=melody&&input.length===melody.length;
  const noteResults=submitted&&melody?input.map((n,i)=>({semi:n,correct:n===melody[i],name:NOTES[n%12]})):[];

  const ALL_INPUT_NOTES=[48,49,50,51,52,53,54,55,56,57,58,59,60];
  const WHITE_INPUT_NOTES=TR_WHITE.map(s=>48+s);
  const STAFF_INPUT_NOTES=TR_LEVELS[level].pool==='white'?WHITE_INPUT_NOTES:ALL_INPUT_NOTES;

  return(
    <><Styles/>
    <div className='et-root screen-enter'>
      <div className='et-hdr'>
        <button className='et-back' onClick={()=>{stopCtx();onBack();}}>&#8592; Hub</button>
        <div className='et-hdr-mid'>
          <div className='et-mode-label'>&#10000; Transcription</div>
        </div>
        <div className='et-hdr-right'>
          <span style={{fontSize:12,fontWeight:700,color:'rgba(156,183,177,.7)',fontFamily:"'Work Sans',sans-serif"}}>
            {score.total>0?`${score.correct}/${score.total}`:''}
          </span>
        </div>
      </div>

      <div style={{padding:'0 16px 10px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
        <div style={{display:'flex',gap:5,overflowX:'auto',flex:1}}>
          {TR_LEVELS.map(l=>(
            <button key={l.id} onClick={()=>{setLevel(l.id);setRound(r=>r+1);}}
              style={{flexShrink:0,padding:'5px 12px',borderRadius:20,border:'1.5px solid',
                borderColor:level===l.id?'rgba(156,183,177,.7)':'rgba(242,238,230,.15)',
                background:level===l.id?'rgba(156,183,177,.15)':'transparent',
                color:level===l.id?'#9CB7B1':'rgba(242,238,230,.4)',
                fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:700,cursor:'pointer'}}>
              {l.label}
            </button>
          ))}
        </div>
        <div style={{display:'flex',borderRadius:10,overflow:'hidden',border:'1.5px solid rgba(242,238,230,.15)',flexShrink:0}}>
          {[{id:'piano',label:'Piano'},{id:'staff',label:'Staff'}].map(m=>(
            <button key={m.id} onClick={()=>setInputMode(m.id)}
              style={{padding:'5px 10px',border:'none',
                background:inputMode===m.id?'rgba(156,183,177,.2)':'transparent',
                color:inputMode===m.id?'#9CB7B1':'rgba(242,238,230,.35)',
                fontSize:11,fontWeight:700,fontFamily:"'Work Sans',sans-serif",cursor:'pointer',transition:'background .12s,color .12s'}}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className='et-scroll'>
        {melody&&(<div className='et-question'>

          <div style={{textAlign:'center',marginBottom:12}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:700,color:'#F2EEE6',marginBottom:3}}>
              {submitted?'How did you do?':'Listen, then notate'}
            </div>
            <div style={{fontSize:12,color:'rgba(156,183,177,.55)'}}>
              {TR_LEVELS[level].noteCount} notes
            </div>
          </div>

          <TrStaff melody={melody} input={input} submitted={submitted} noteResults={noteResults}/>

          {submitted&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:'rgba(242,238,230,.25)',textTransform:'uppercase',letterSpacing:.1,textAlign:'center',marginBottom:6}}>Your answer vs correct</div>
              <div style={{display:'flex',justifyContent:'center',gap:6,flexWrap:'wrap'}}>
                {melody.map((semi,i)=>{
                  const yours=input[i];
                  const correct=yours===semi;
                  return(
                    <div key={i} style={{textAlign:'center',minWidth:36}}>
                      <div style={{fontSize:13,fontWeight:700,fontFamily:"'Fraunces',serif",
                        color:correct?'#9CB7B1':'rgba(198,165,133,.85)'}}>
                        {yours!=null?NOTES[yours%12]:'--'}
                      </div>
                      <div style={{fontSize:9,color:'rgba(242,238,230,.3)',marginTop:1}}>{NOTES[semi%12]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button className={'et-play-btn'+(!playing&&!submitted?' idle-pulse':'')}
            onClick={()=>doPlay(melody)} disabled={playing}>
            {playing&&<div className='play-fill' style={{animationName:'ri_playFill',animationDuration:fillDur+'ms',animationTimingFunction:'linear',animationFillMode:'forwards'}}/>}
            <span className='play-btn-inner'>
              {playing
                ?<><div className='wave-bars'><div className='wave-bar wb1'/><div className='wave-bar wb2'/><div className='wave-bar wb3'/><div className='wave-bar wb4'/><div className='wave-bar wb5'/></div>Listening...</>
                :<span>{unlocked.current?'Replay':'Listen to the melody'}</span>}
            </span>
          </button>

          {!submitted&&(
            <div style={{marginTop:14}}>
              {inputMode==='piano'
                ?<TrPiano onNote={handleNote} inputNotes={input} targetNotes={melody} revealed={false}/>
                :(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:4}}>
                    {STAFF_INPUT_NOTES.map(abs=>{
                      const name=NOTES[abs%12];
                      const isBlack=![0,2,4,5,7,9,11].includes(abs%12);
                      return(
                        <button key={abs} onClick={()=>handleNote(abs)}
                          style={{padding:'12px 6px',borderRadius:10,border:'1.5px solid',
                            borderColor:isBlack?'rgba(242,238,230,.2)':'rgba(242,238,230,.25)',
                            background:isBlack?'rgba(242,238,230,.06)':'rgba(242,238,230,.1)',
                            color:'rgba(242,238,230,.85)',fontFamily:"'Fraunces',serif",
                            fontSize:15,fontWeight:700,cursor:'pointer'}}>
                          {name}
                        </button>
                      );
                    })}
                  </div>
                )
              }
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:2,marginBottom:2}}>
                <button onClick={handleBackspace} disabled={input.length===0}
                  style={{background:'transparent',border:'none',color:'rgba(242,238,230,.3)',fontSize:18,cursor:'pointer',padding:'4px 8px'}}>
                  &#9003;
                </button>
              </div>
            </div>
          )}

          <div style={{marginTop:6}}>
            {!submitted
              ?<button onClick={handleSubmit} className='et-next' disabled={!isComplete} style={{opacity:isComplete?1:0.3}}>Confirm</button>
              :<button onClick={handleNext} className='et-next'>Continue</button>
            }
          </div>

        </div>)}
      </div>
    </div>
    </>
  );
}

// ── Melodic Dictation ─────────────────────────────────────────────────────────

// ── Melodic Dictation ─────────────────────────────────────────────────────────

const MAJ_IVS=[0,2,4,5,7,9,11];
const SOLFEGE=['Do','Re','Mi','Fa','Sol','La','Ti'];
const BEATS_PER_MEASURE=4;

// Rhythm durations in beats (quarter = 1 beat)
const DURATIONS=[
  {id:'whole',         beats:4,    label:'Whole'},
  {id:'half',          beats:2,    label:'Half'},
  {id:'quarter',       beats:1,    label:'Quarter'},
  {id:'eighth',        beats:0.5,  label:'8th'},
  {id:'sixteenth',     beats:0.25, label:'16th'},
  {id:'dotted-half',   beats:3,    label:'d. Half',   base:'half',     dotted:true},
  {id:'dotted-quarter',beats:1.5,  label:'d. Quarter', base:'quarter',  dotted:true},
  {id:'dotted-eighth', beats:0.75, label:'d. 8th',    base:'eighth',   dotted:true},
];

// Rhythm patterns by difficulty level.
// Values are beat durations (quarter = 1). 0 = quarter rest.
// These are per-measure patterns; the generator may also create cross-bar ties.
const RHYTHM_POOLS = {
  1: [
    [1,1,1,1],
  ],
  2: [
    [1,1,1,1],
    [2,1,1],
    [1,1,2],
    [2,2],
    [4],
    [1,2,1],
  ],
  3: [
    [1,1,1,1],
    [0.5,0.5,1,1,1],
    [1,0.5,0.5,1,1],
    [1,1,0.5,0.5,1],
    [0.5,0.5,0.5,0.5,1,1],
    [1.5,0.5,1,1],
    [1,1.5,0.5,1],
    [2,1,1],
    [1,1,2],
  ],
  4: [
    [1,1,1,1],
    [0.5,0.5,1,1,1],
    [0.25,0.25,0.5,1,1,1],
    [0.75,0.25,1,1,1],
    [1.5,0.5,1,1],
    [1,0,1,1,1],
    [1,1,0,1,1],
    [0.5,0.5,0,1,1,1],
  ],
};

// Given a list of {beats, isRest} events, split any note that crosses a barline
// into two tied notes. Returns {beats, isRest, tied} events.
function splitAtBarlines(events, startBeat=0){
  const BAR=BEATS_PER_MEASURE;
  const result=[];
  let pos=startBeat;
  for(const ev of events){
    const {beats, isRest}=ev;
    let rem=beats;
    let isTiedContinuation=false;
    while(rem>0.001){
      const barEnd=Math.ceil((pos+0.001)/BAR)*BAR;
      const fits=Math.min(rem, barEnd-pos);
      result.push({beats:fits, isRest, tied:isTiedContinuation&&!isRest});
      pos+=fits;
      rem-=fits;
      isTiedContinuation=true;
    }
  }
  return result;
}

function buildDiatonicMelody(measures, rootSemi, difficulty=1){
  const totalBeats=measures*BEATS_PER_MEASURE;
  const rootAbs=48+rootSemi;
  const pool=[];
  for(let oct=0;oct<2;oct++){
    MAJ_IVS.forEach(iv=>{
      const abs=rootAbs+oct*12+iv;
      if(abs>=48&&abs<=48+24) pool.push(abs);
    });
  }

  const rhythmPool=RHYTHM_POOLS[difficulty]||RHYTHM_POOLS[1];
  const isDotted=(b)=>[1.5,0.75,3].includes(b);

  // Generate raw events filling complete bars from beat 0
  const rawEvents=[];
  let filled=0;
  while(filled<totalBeats-0.001){
    const remaining=totalBeats-filled;
    const barEnd=Math.ceil((filled+0.001)/BEATS_PER_MEASURE)*BEATS_PER_MEASURE;
    const spaceInBar=barEnd-filled;
    const canCrossBar=difficulty>=3&&measures>1&&spaceInBar<remaining&&spaceInBar<2&&Math.random()<0.25;
    if(canCrossBar){
      const crossBeats=spaceInBar+(Math.random()<0.5?1:0.5);
      if(crossBeats<=remaining+0.001){
        rawEvents.push({beats:Math.min(crossBeats,remaining), isRest:false});
        filled+=Math.min(crossBeats,remaining);
        continue;
      }
    }
    const fits=rhythmPool.filter(p=>p.reduce((s,b)=>s+(b||1),0)<=remaining+0.001);
    const pat=fits.length>0?fits[Math.floor(Math.random()*fits.length)]:[1,1,1,1];
    for(const b of pat){
      if(filled>=totalBeats-0.001) break;
      const bv=b===0?1:b;
      if(filled+bv>totalBeats+0.001) break;
      rawEvents.push({beats:bv, isRest:b===0});
      filled+=bv;
    }
  }

  // Step 2: split events that cross barlines, producing tied noteheads
  const splitEvents=splitAtBarlines(rawEvents);

  // Step 3: assign pitches stepwise (imperative to avoid self-reference)
  let pitchIdx=0;
  let lastNoteAbs=pool[0];
  const notes=[];
  splitEvents.forEach(({beats, isRest, tied}, i)=>{
    if(isRest){
      notes.push({abs:null, beats, type:'rest', dotted:isDotted(beats), tied:false});
      return;
    }
    if(i===0){
      notes.push({abs:pool[0], beats, type:'note', dotted:isDotted(beats), tied:false});
      lastNoteAbs=pool[0];
      return;
    }
    if(tied){
      notes.push({abs:lastNoteAbs, beats, type:'note', dotted:isDotted(beats), tied:true});
      return;
    }
    const candidates=[];
    if(pitchIdx>0) candidates.push(pitchIdx-1);
    if(pitchIdx<pool.length-1) candidates.push(pitchIdx+1);
    const nextIdx=candidates[Math.floor(Math.random()*candidates.length)]??pitchIdx;
    pitchIdx=nextIdx;
    lastNoteAbs=pool[pitchIdx];
    notes.push({abs:lastNoteAbs, beats, type:'note', dotted:isDotted(beats), tied:false});
  });

  // Ensure the melody exactly fills totalBeats — pad with a rest if generation fell short
  const generatedBeats=notes.reduce((s,n)=>s+n.beats,0);
  const gap=Math.round((totalBeats-generatedBeats)*1000)/1000;
  if(gap>0.001){
    notes.push({abs:null,beats:gap,type:'rest',dotted:false,tied:false});
  }

  return notes;
}
// e.g. [{abs:60,beats:0.5,tied:false},{abs:60,beats:0.5,tied:true}] → [{abs:60,beats:1}]
function collapseForScoring(notes){
  const result=[];
  for(const n of notes){
    if(n.tied&&result.length>0&&n.type!=='rest'){
      result[result.length-1]={...result[result.length-1],beats:result[result.length-1].beats+n.beats};
    } else {
      result.push({...n});
    }
  }
  return result;
}

// Position-based scoring: compare sounding events by their beat position in the timeline.
// Both melody and input fill the same total beats, so we can overlay them by time.
// For each melody event, find what the user played at that beat position.
// Returns array aligned to melody sounding events.
function scoreSounding(mel, inp){
  // Build a timeline of input events: [{start, end, event}]
  let pos=0;
  const inpTimeline=inp.map(ev=>{
    const s=pos; pos+=ev.beats; return{start:s,end:pos,ev};
  });

  return mel.map((mev,mi)=>{
    // Find melody event's beat position
    let mstart=0;
    for(let k=0;k<mi;k++) mstart+=mel[k].beats;
    const mend=mstart+mev.beats;
    const mmid=mstart+mev.beats*0.5; // compare at midpoint to handle partial overlaps

    // Find the input event that covers this melody event's midpoint
    const iev=inpTimeline.find(({start,end})=>mmid>=start-0.001&&mmid<end-0.001);

    if(!iev) return{mel:mev,inp:null,correct:false,pitchOk:false,beatOk:false,missing:true};

    const inv=iev.ev;
    const typeOk=(mev.type==='rest')===(inv.type==='rest');
    const pitchOk=typeOk&&(mev.type==='rest'||mev.abs===inv.abs);
    // Beats match: the input event covering this position should have the same duration
    const beatOk=Math.abs(mev.beats-inv.beats)<0.01;
    return{mel:mev,inp:inv,correct:typeOk&&pitchOk&&beatOk,pitchOk,beatOk};
  });
}

function scheduleDictationMelody(ctx, notes){
  const n=ctx.currentTime;
  const beatDur=0.42;
  let t=0;
  // Merge tied notes into one held tone before scheduling
  const merged=[];
  notes.forEach(note=>{
    if(note.tied&&merged.length>0){
      // Extend the previous note's duration instead of attacking again
      const prev=merged[merged.length-1];
      merged[merged.length-1]={...prev,beats:prev.beats+note.beats};
    } else {
      merged.push({...note});
    }
  });
  merged.forEach(({abs,beats,type})=>{
    if(type!=='rest'&&abs!=null){
      tone(ctx, sf(abs-48), n+t, beats*beatDur*0.92, 0.22);
    }
    t+=beats*beatDur;
  });
  return t*1000+400;
}

function totalBeats(notes){ return notes.reduce((s,n)=>s+n.beats,0); }

// ── Memorize overlay ─────────────────────────────────────────────────────────
function MemorizeOverlay({playing}){
  if(!playing) return null;
  return(
    <div style={{position:'absolute',inset:0,borderRadius:14,pointerEvents:'none',overflow:'hidden'}}>
      {[0,1,2].map(i=>(
        <div key={i} style={{
          position:'absolute',inset:0,borderRadius:14,
          border:'1.5px solid rgba(156,183,177,.25)',
          animation:`ri_memorizeRing 3s ease-in-out ${i*1}s infinite`,
        }}/>
      ))}
    </div>
  );
}

// ── Music engraving — exact Bravura glyph paths ───────────────────────────────
// Paths extracted directly from Bravura.otf via fontTools.
// Bravura uses 1000 units/em, 1 staff space = 250 units, y-axis UP (font convention).
// To place a glyph centred at SVG point (x,y) at staff-space size s (= lineGap):
//   transform="translate(x,y) scale(s/250,-s/250) translate(-fontCx,-fontCy)"
// The y scale is negated to flip from font (y-up) to SVG (y-down).

// Notehead — simple rotated ellipse. rx/ry tuned to match Bravura notehead proportions.
function Notehead({cx, cy, rx, ry, open=false, color, bg='#405147'}){
  if(!open){
    return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color}
      transform={`rotate(-16,${cx},${cy})`}/>;
  }
  return(
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color}
        transform={`rotate(-16,${cx},${cy})`}/>
      <ellipse cx={cx} cy={cy} rx={rx*0.52} ry={ry*0.6} fill={bg}
        transform={`rotate(20,${cx},${cy})`}/>
    </g>
  );
}

// Quarter rest — exact Bravura path. Font centre: (136, -1). Place at staff middle line.
// Path spans ~1.1s wide × 3.0s tall in staff-space units.
const QREST_PATH='M78 -38C94 -58 108 -77 121 -98C123 -102 127 -110 127 -112C127 -113 127 -115 126 -116C124 -120 120 -121 115 -121C111 -121 103 -119 99 -118C98 -118 96 -118 95 -118L87 -115C35 -115 1 -162 1 -211C1 -261 44 -310 117 -366C125 -372 135 -375 143 -375C150 -375 157 -373 158 -369C159 -366 160 -364 160 -362C160 -353 152 -345 144 -338C131 -338 120 -311 118 -302C115 -294 114 -285 114 -276C114 -235 135 -203 177 -203C206 -203 239 -214 256 -220L257 -221C261 -222 263 -222 265 -222C268 -222 270 -221 270 -218C270 -206 244 -173 233 -161C195 -115 164 -78 164 -22C164 -21 164 -20 164 -19L165 -12C165 -11 165 -10 165 -9C169 49 205 97 231 138C234 143 235 148 235 153C235 163 231 172 231 172C231 172 83 348 66 365C61 370 54 373 48 373C38 373 28 366 28 352C28 347 29 342 32 336C36 325 93 274 93 202C93 165 78 122 33 75C23 65 19 54 19 46C19 32 29 22 29 22Z';

// Eighth rest — exact Bravura path. Font centre: (124, -38).
const E8REST_PATH='M134 107C134 144 104 174 67 174C30 174 0 144 0 107C0 86 12 68 27 56C43 45 62 39 81 39C95 39 109 42 120 46C134 50 143 54 156 61C158 62 160 62 161 62C165 62 166 58 166 53C166 50 166 46 165 42C162 27 90 -172 72 -238C72 -250 95 -251 101 -251C112 -251 126 -249 136 -241C139 -239 237 112 237 112C241 130 246 146 247 151C247 161 237 166 235 167C233 167 230 167 224 163C217 157 167 97 134 97Z';

// Sixteenth rest — exact Bravura path. Font centre: (160, -160).
const E16REST_PATH='M208 111C208 149 178 179 140 179C103 179 72 149 72 111C72 70 114 43 152 43C179 43 207 52 230 65C233 66 235 67 237 67C240 67 242 65 242 60C242 44 191 -105 184 -120C176 -139 149 -151 135 -151C136 -147 136 -144 136 -141C136 -103 105 -73 68 -73C30 -73 0 -103 0 -141C0 -182 42 -209 80 -209C106 -209 132 -200 155 -188C157 -188 159 -190 159 -194L158 -195C158 -196 158 -196 158 -196L63 -479C63 -479 63 -480 63 -480L62 -481C62 -490 71 -500 93 -500C122 -500 127 -488 131 -477L247 -96C273 -11 292 56 292 56C292 56 317 144 319 157C319 159 320 160 320 161C320 167 312 171 310 172C305 172 302 170 299 168C292 162 242 102 208 101Z';

// Full note glyphs (notehead + stem + flag) for unbeamed 8th/16th notes.
// Font notehead centre is at approx (166, 0) for quarterUp/8thUp/16thUp.
// Stem extends to y=875 (upward in font = downward in SVG after flip).
const NOTE8_PATH='M451 594C400 673 358 755 342 851C339 867 331 873 312 873C307 873 303 871 302 864V118C283 135 255 144 222 144C99 144 0 53 0 -44C0 -103 48 -138 109 -138C209 -138 332 -45 332 50V611C394 573 468 463 499 390C514 356 523 299 523 240C523 195 516 148 499 103C497 97 496 92 496 88C496 72 506 63 512 59L514 58C523 57 535 61 540 78C540 78 566 173 566 251C566 376 514 494 451 594Z';
const NOTE16_PATH='M552 327C552 330 551 332 551 336C551 338 551 340 552 343C555 349 577 409 577 470C577 483 576 494 574 506C564 574 538 602 466 680C412 738 356 754 339 860C337 871 325 873 319 873C313 873 302 872 302 872V118C283 135 255 144 222 144C99 144 0 53 0 -44C0 -103 48 -138 109 -138C209 -138 332 -45 332 50V474C387 470 449 453 509 331C532 283 541 234 541 182C541 153 538 123 533 93C532 89 532 87 532 84C532 71 540 58 554 58C561 58 568 62 574 75C578 80 581 137 581 185V207C581 249 570 290 552 327ZM538 440C536 432 536 422 531 414C530 411 523 408 518 408C515 408 513 409 511 412C495 437 478 457 457 481C410 535 364 559 343 641C342 642 342 643 342 644C342 648 348 654 356 654H364C425 654 479 598 512 549C530 523 539 492 539 460C539 453 539 447 538 440Z';

// Render a Bravura glyph path centred at (x,y) in SVG, scaled to staff size s=lineGap.
// fontCx/fontCy = the point in font coordinates that should land at (x,y) in SVG.
function BravuraPath({x, y, s, d, fontCx, fontCy, color}){
  const sc=s/250;
  return(
    <path d={d} fill={color}
      transform={`translate(${x},${y}) scale(${sc},${-sc}) translate(${-fontCx},${-fontCy})`}/>
  );
}

// Staff-level note/rest renderer
function RhythmNote({x, y, beats, type='note', fill='rgba(242,238,230,.82)', stemUp=true, lineGap=11, dotted=false}){
  const s=lineGap;
  const rx=s*0.56, ry=s*0.37;
  const stemLen=s*3.5;
  const sw=1.2;
  const fc=fill;
  // Base beats (without dot) for determining note type
  const baseBeat=dotted?beats/1.5:beats;
  // Dot: small circle to right of notehead, vertically offset to nearest line space
  const dotR=s*0.14;
  const dotX=x+rx+s*0.45;
  // Place dot between lines if on a line (step is even), else on the line space
  const dotEl=dotted?<AugDot x={dotX} y={y} r={dotR} color={fc}/>:null;

  if(type==='rest'){
    // For dotted rests the dot goes to the right of the rest symbol
    const restDotEl=dotted?<AugDot x={x+s*0.9} y={y-s*0.4} r={dotR} color={fc}/>:null;
    if(beats>=4||baseBeat>=4) return <g><rect x={x-s*0.55} y={y+s*0.1}  width={s*1.1} height={s*0.4} fill={fc} rx={1}/>{restDotEl}</g>;
    if(beats>=2||baseBeat>=2) return <g><rect x={x-s*0.55} y={y-s*0.48} width={s*1.1} height={s*0.4} fill={fc} rx={1}/>{restDotEl}</g>;
    if(baseBeat>=1) return <g><BravuraPath x={x} y={y} s={s} d={QREST_PATH} fontCx={136} fontCy={-1} color={fc}/>{restDotEl}</g>;
    if(baseBeat>=0.5) return <g><BravuraPath x={x} y={y-s*0.15} s={s} d={E8REST_PATH} fontCx={124} fontCy={-38} color={fc}/>{restDotEl}</g>;
    return <g><BravuraPath x={x} y={y-s*0.3} s={s} d={E16REST_PATH} fontCx={160} fontCy={-160} color={fc}/>{restDotEl}</g>;
  }
  if(type==='tie') return null;

  const nFlags=baseBeat<=0.5?(baseBeat<=0.25?2:1):0;

  // Whole note — use Bravura path, no stem
  if(baseBeat>=4){
    return <g>
      <BravuraPath x={x} y={y} s={s} d={NOTE_WHOLE_PATH} fontCx={230} fontCy={0} color={fc}/>
      {dotEl}
    </g>;
  }
  // Half note — use Bravura path (includes stem)
  if(baseBeat>=2){
    const path=stemUp?NOTE_HALF_UP_PATH:NOTE_HALF_DOWN_PATH;
    return <g>
      <BravuraPath x={x} y={y} s={s} d={path} fontCx={166} fontCy={0} color={fc}/>
      {dotEl}
    </g>;
  }
  // Quarter note — SVG notehead + stem
  if(baseBeat>=1){
    const sx=stemUp?x+rx*0.85:x-rx*0.85;
    const sy1=stemUp?y-ry*0.5:y+ry*0.5;
    const sy2=stemUp?y-stemLen:y+stemLen;
    return <g>
      <line x1={sx} y1={sy1} x2={sx} y2={sy2} stroke={fc} strokeWidth={sw}/>
      <Notehead cx={x} cy={y} rx={rx} ry={ry} color={fc} bg='#405147'/>
      {dotEl}
    </g>;
  }
  // Eighth / sixteenth — use Bravura full-note glyph (notehead+stem+flag in one path)
  if(stemUp){
    const path=baseBeat<=0.25?NOTE16_PATH:NOTE8_PATH;
    return <g>
      <BravuraPath x={x} y={y} s={s} d={path} fontCx={166} fontCy={0} color={fc}/>
      {dotEl}
    </g>;
  } else {
    const path=baseBeat<=0.25?NOTE16_PATH:NOTE8_PATH;
    const sc=s/250;
    return <g>
      <g transform={`translate(${x},${y}) scale(${-sc},${sc}) translate(${-166},0)`}>
        <path d={path} fill={fc}/>
      </g>
      {dotEl}
    </g>;
  }
}

// Button-sized duration symbol (rhythm selector buttons)
function DurSVG({id, color='rgba(242,238,230,.82)', size=30}){
  const c=color;
  const W=size, H=Math.round(size*1.7);
  const s=size*0.30; // 1 staff space in button units
  const rx=s*0.56, ry=s*0.37;
  const hX=W*0.38, hY=H*0.72;
  const sx=hX+rx*0.85;
  const stemTop=H*0.08;
  const sw=Math.max(1.0,size*0.04);

  if(id==='whole') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <BravuraPath x={hX} y={hY} s={s} d={NOTE_WHOLE_PATH} fontCx={230} fontCy={0} color={c}/>
    </svg>
  );
  if(id==='half') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <BravuraPath x={hX} y={hY} s={s} d={NOTE_HALF_UP_PATH} fontCx={166} fontCy={0} color={c}/>
    </svg>
  );
  if(id==='quarter') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <line x1={sx} y1={hY-ry*0.5} x2={sx} y2={stemTop} stroke={c} strokeWidth={sw}/>
      <Notehead cx={hX} cy={hY} rx={rx} ry={ry} color={c}/>
    </svg>
  );
  // 8th + 16th: use Bravura full-note glyphs, place notehead at hX,hY
  if(id==='eighth') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <BravuraPath x={hX} y={hY} s={s} d={NOTE8_PATH} fontCx={166} fontCy={0} color={c}/>
    </svg>
  );
  if(id==='sixteenth') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <BravuraPath x={hX} y={hY} s={s} d={NOTE16_PATH} fontCx={166} fontCy={0} color={c}/>
    </svg>
  );
  if(id==='rest') return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <BravuraPath x={W*0.45} y={H*0.52} s={s} d={QREST_PATH} fontCx={136} fontCy={-1} color={c}/>
    </svg>
  );
  return(
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
      <path d={`M${W*0.1},${H*0.62} Q${W*0.5},${H*0.28} ${W*0.9},${H*0.62}`}
        fill='none' stroke={c} strokeWidth={sw+0.3} strokeLinecap='round'/>
    </svg>
  );
}

// Whole note — Bravura path. Centre: (230, 0). Width ≈ 1.84s, height ≈ 1.09s.
const NOTE_WHOLE_PATH='M235 136C90 136 0 75 0 1C0 -72 62 -137 224 -137C402 -137 459 -75 459 1C459 78 336 136 235 136ZM207 111C281 111 341 31 341 -35C341 -90 307 -112 258 -112C186 -112 117 -29 117 41C117 97 156 111 207 111Z';
// Half note up — Bravura path. Notehead centre: (166, 0), stem to y=875.
const NOTE_HALF_UP_PATH='M112 -145C302 -145 341 9 341 48V875H311V118C291 135 262 145 227 145C54 145 0 11 0 -49C0 -110 49 -145 112 -145ZM256 97C281 97 305 77 305 51C305 28 281 0 200 -53C148 -88 112 -100 87 -100C60 -100 34 -79 34 -51C34 6 201 97 256 97Z';
// Half note down — Bravura path. Notehead centre: (166, 0), stem to y=-875.
const NOTE_HALF_DOWN_PATH='M227 145C54 145 0 12 0 -48V-875H30V-117C50 -135 79 -145 112 -145C303 -145 341 10 341 48C341 107 294 145 227 145ZM200 -53C148 -88 112 -100 87 -100C60 -100 34 -79 34 -51C34 6 201 97 256 97C281 97 305 77 305 51C305 28 281 0 200 -53Z';

// Augmentation dot — small filled circle placed to the right of the notehead
function AugDot({x, y, r, color}){
  return <circle cx={x} cy={y} r={r} fill={color}/>;
}

// ── Rhythm selector row ───────────────────────────────────────────────────────
function RhythmSelector({selected, dotOn, tieOn, onSelect, onToggleDot, onRest, onTie, remainingBeats}){
  const baseItems=[
    {id:'whole',    label:'Whole',   beats:4},
    {id:'half',     label:'Half',    beats:2},
    {id:'quarter',  label:'Quarter', beats:1},
    {id:'eighth',   label:'8th',     beats:0.5},
    {id:'sixteenth',label:'16th',    beats:0.25},
  ];
  const btn=(isSel,ok,onClick,children)=>(
    <button onClick={()=>ok&&onClick()}
      style={{flex:1,padding:'8px 2px 6px',borderRadius:12,border:'1.5px solid',
        borderColor:isSel?'rgba(156,183,177,.8)':ok?'rgba(242,238,230,.18)':'rgba(242,238,230,.06)',
        background:isSel?'rgba(156,183,177,.18)':'transparent',
        opacity:ok?1:0.25,cursor:ok?'pointer':'default',
        display:'flex',flexDirection:'column',alignItems:'center',gap:3,
        transition:'background .15s,border-color .15s'}}>
      {children}
    </button>
  );
  const lbl=(text,isSel)=>(
    <span style={{fontSize:9,color:isSel?'#9CB7B1':'rgba(242,238,230,.4)',
      fontFamily:"'Work Sans',sans-serif",fontWeight:600}}>{text}</span>
  );
  // For dotted mode, check if dotted version fits
  const dottedBeats=(id)=>{const d=DURATIONS.find(x=>x.id==='dotted-'+id||x.id===id); return d?d.beats*1.5:null;};
  const effectiveBeat=(id)=>dotOn?(id==='whole'?6:id==='half'?3:id==='quarter'?1.5:id==='eighth'?0.75:0.375):baseItems.find(d=>d.id===id)?.beats;

  return(
    <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
      {/* Row 1: note durations */}
      <div style={{display:'flex',gap:5}}>
        {baseItems.map(item=>{
          const eb=effectiveBeat(item.id);
          const ok=eb<=remainingBeats+0.001;
          const isSel=selected===item.id;
          return btn(isSel,ok,()=>onSelect(item.id),
            <><DurSVG id={item.id} color={isSel?'#9CB7B1':'rgba(242,238,230,.75)'} size={26}/>{lbl(item.label,isSel)}</>
          );
        })}
      </div>
      {/* Row 2: dot toggle, rest, tie */}
      <div style={{display:'flex',gap:5}}>
        {/* Dot toggle — wider button */}
        <button onClick={onToggleDot}
          style={{flex:2,padding:'8px 4px 6px',borderRadius:12,border:'1.5px solid',
            borderColor:dotOn?'rgba(198,165,133,.8)':'rgba(242,238,230,.18)',
            background:dotOn?'rgba(198,165,133,.18)':'transparent',
            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            transition:'background .15s,border-color .15s'}}>
          <span style={{fontSize:18,color:dotOn?'#C6A585':'rgba(242,238,230,.6)',lineHeight:1}}>·</span>
          <span style={{fontSize:10,color:dotOn?'#C6A585':'rgba(242,238,230,.4)',
            fontFamily:"'Work Sans',sans-serif",fontWeight:700}}>
            {dotOn?'Dotted On':'Dotted Off'}
          </span>
        </button>
        {/* Rest */}
        {btn(false,true,onRest,
          <><DurSVG id='rest' color='rgba(242,238,230,.75)' size={26}/>{lbl('Rest',false)}</>
        )}
        {/* Tie — shows active (teal) when pendingTie is on */}
        {btn(tieOn,true,onTie,
          <><DurSVG id='tie' color={tieOn?'#9CB7B1':'rgba(242,238,230,.75)'} size={26}/>{lbl('Tie',tieOn)}</>
        )}
      </div>
    </div>
  );
}

// ── Diatonic keyboard (solfège / note names) ──────────────────────────────────
function DiatonicKeyboard({rootSemi, onNote, lastInput, octave, onOctaveChange}){
  const rootAbs=48+rootSemi;
  const octBase=rootAbs+(octave-4)*12;
  const keys=MAJ_IVS.map((iv,deg)=>({
    abs:octBase+iv, deg, solfege:SOLFEGE[deg], noteName:NOTES[(octBase+iv)%12],
  }));
  const minOct=3, maxOct=6;

  return(
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 2px'}}>
        <button onClick={()=>onOctaveChange(Math.max(minOct,octave-1))} disabled={octave<=minOct}
          style={{width:38,height:38,borderRadius:10,border:'1.5px solid rgba(242,238,230,.18)',
            background:'transparent',color:octave<=minOct?'rgba(242,238,230,.15)':'rgba(242,238,230,.6)',
            fontSize:16,cursor:octave<=minOct?'default':'pointer',
            display:'flex',alignItems:'center',justifyContent:'center'}}>◀</button>
        <span style={{fontSize:13,color:'rgba(156,183,177,.6)',fontFamily:"'Work Sans',sans-serif",fontWeight:600}}>
          Octave {octave}
        </span>
        <button onClick={()=>onOctaveChange(Math.min(maxOct,octave+1))} disabled={octave>=maxOct}
          style={{width:38,height:38,borderRadius:10,border:'1.5px solid rgba(242,238,230,.18)',
            background:'transparent',color:octave>=maxOct?'rgba(242,238,230,.15)':'rgba(242,238,230,.6)',
            fontSize:16,cursor:octave>=maxOct?'default':'pointer',
            display:'flex',alignItems:'center',justifyContent:'center'}}>▶</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {keys.map(k=>{
          const isLast=lastInput===k.abs;
          return(
            <button key={k.abs} onClick={()=>onNote(k.abs)}
              style={{padding:'22px 2px 16px',borderRadius:12,border:'1.5px solid',
                borderColor:isLast?'rgba(156,183,177,.8)':'rgba(242,238,230,.2)',
                background:isLast?'rgba(156,183,177,.22)':'rgba(242,238,230,.08)',
                display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                cursor:'pointer',transition:'background .12s,border-color .12s,transform .1s'}}
              onMouseDown={e=>e.currentTarget.style.transform='scale(.92)'}
              onMouseUp={e=>e.currentTarget.style.transform='scale(1)'}
              onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <span style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,
                color:isLast?'#9CB7B1':'rgba(242,238,230,.9)',lineHeight:1}}>
                {k.noteName}
              </span>
              <span style={{fontSize:10,color:isLast?'rgba(156,183,177,.6)':'rgba(242,238,230,.32)',
                fontWeight:600,fontFamily:"'Work Sans',sans-serif"}}>
                {k.solfege}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:6}}>
        {[1,2,3,4,5,6,7].map(n=>(
          <div key={n} style={{textAlign:'center',fontSize:9,color:'rgba(156,183,177,.28)',
            fontWeight:600,fontFamily:"'Work Sans',sans-serif"}}>{n}</div>
        ))}
      </div>
    </div>
  );
}

// ── Dictation Piano (chromatic, diatonic keys highlighted) ────────────────────
function DictationPiano({rootSemi, onNote, lastInput, octave, onOctaveChange}){
  const rootAbs=48+rootSemi; // C4 = 48
  const diatonicSet=new Set(MAJ_IVS.map(iv=>((rootAbs+iv)%12)));
  // Build one octave: C to B starting at the given octave
  // abs = (octave-4)*12 + 48 + mod
  const octBase=(octave-4)*12+48;
  const WK=[0,2,4,5,7,9,11];
  const BK_MAP=[[1,0],[3,1],[6,3],[8,4],[10,5]]; // [semMod, after-white-idx]
  // Key sizes — fill ~360px width for 7 white keys
  const WW=46, GAP=3, BW=28, BH=90, WH=140, U=WW+GAP;
  const tw=7*U-GAP;

  const ws=WK.map((mod,wi)=>({abs:octBase+mod,x:wi*U,mod,isDiat:diatonicSet.has(mod),isLast:lastInput===octBase+mod}));
  const bs=BK_MAP.map(([mod,aw])=>({abs:octBase+mod,x:(aw+1)*U-BW/2-1,mod,isDiat:diatonicSet.has(mod),isLast:lastInput===octBase+mod}));
  const isTonicMod=rootSemi%12;
  const minOct=3, maxOct=6;

  return(
    <div style={{margin:'6px 0 10px'}}>
      {/* Octave nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,padding:'0 2px'}}>
        <button onClick={()=>onOctaveChange(Math.max(minOct,octave-1))} disabled={octave<=minOct}
          style={{width:36,height:36,borderRadius:10,border:'1.5px solid rgba(242,238,230,.18)',
            background:'transparent',color:octave<=minOct?'rgba(242,238,230,.18)':'rgba(242,238,230,.6)',
            fontSize:16,cursor:octave<=minOct?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          ◀
        </button>
        <span style={{fontSize:13,color:'rgba(156,183,177,.6)',fontFamily:"'Work Sans',sans-serif",fontWeight:600}}>
          Octave {octave}
        </span>
        <button onClick={()=>onOctaveChange(Math.min(maxOct,octave+1))} disabled={octave>=maxOct}
          style={{width:36,height:36,borderRadius:10,border:'1.5px solid rgba(242,238,230,.18)',
            background:'transparent',color:octave>=maxOct?'rgba(242,238,230,.18)':'rgba(242,238,230,.6)',
            fontSize:16,cursor:octave>=maxOct?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          ▶
        </button>
      </div>
      {/* Piano */}
      <div style={{display:'flex',justifyContent:'center'}}>
        <svg width={Math.min(tw,380)} height={WH} viewBox={`0 0 ${tw} ${WH}`}
          style={{display:'block',cursor:'pointer'}}
          onClick={e=>{
            const rect=e.currentTarget.getBoundingClientRect();
            const sx=tw/Math.min(tw,380);
            const px=(e.clientX-rect.left)*sx;
            const py=(e.clientY-rect.top)*(WH/rect.height);
            for(const k of bs){if(px>=k.x&&px<=k.x+BW&&py<=BH){onNote(k.abs);return;}}
            for(const k of ws){if(px>=k.x&&px<=k.x+WW){onNote(k.abs);return;}}
          }}>
          {ws.map(k=>(
            <g key={k.abs}>
              <rect x={k.x} y={0} width={WW} height={WH} rx={6}
                fill={k.isLast?'rgba(156,183,177,.65)':k.isDiat?'rgba(242,238,230,.22)':'rgba(242,238,230,.07)'}
                stroke={k.isLast?'rgba(156,183,177,.9)':k.isDiat?'rgba(242,238,230,.35)':'rgba(242,238,230,.12)'}
                strokeWidth={1.5}/>
              {/* Note name */}
              <text x={k.x+WW/2} y={WH-22} textAnchor='middle' fontSize={11}
                fontFamily="'Work Sans',sans-serif" fontWeight='600'
                fill={k.isLast?'#9CB7B1':k.isDiat?'rgba(242,238,230,.5)':'rgba(242,238,230,.2)'}>
                {NOTES[k.mod]}
              </text>
              {/* Do label on tonic */}
              {k.mod===isTonicMod&&(
                <text x={k.x+WW/2} y={WH-7} textAnchor='middle' fontSize={9}
                  fontFamily="'Work Sans',sans-serif"
                  fill={k.isLast?'rgba(156,183,177,.9)':'rgba(156,183,177,.45)'}>
                  Do
                </text>
              )}
            </g>
          ))}
          {bs.map(k=>(
            <g key={k.abs}>
              <rect x={k.x} y={0} width={BW} height={BH} rx={4}
                fill={k.isLast?'#9CB7B1':k.isDiat?'rgba(242,238,230,.4)':'rgba(242,238,230,.14)'}/>
              {k.isDiat&&<text x={k.x+BW/2} y={BH-6} textAnchor='middle' fontSize={8}
                fontFamily="'Work Sans',sans-serif"
                fill={k.isLast?'rgba(242,238,230,.9)':'rgba(242,238,230,.3)'}>
                {NOTES[k.mod]}
              </text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Dictation Staff ───────────────────────────────────────────────────────────
function DictationStaff({melody, input, submitted, noteResults, rootSemi}){
  const scrollRef=useRef(null);
  const SH=160, MR=24;
  const lineGap=11;
  const L0=40;
  const botLineY=L0+4*lineGap;
  const yForStep=s=>botLineY-(s-2)*(lineGap/2);
  const clefY=botLineY+lineGap*0.6;
  const clefSize=Math.round(lineGap*7);
  const {signs}=keySigns(rootSemi);
  const ksW=Math.max(signs.length*9,0);
  const headerW=42+ksW;
  const PX_PER_BEAT=72;
  const MIN_PX_PER_NOTE=28;
  const NOTE_OFFSET=20;

  const staffColor='rgba(242,238,230,.28)';
  const tonicFill='rgba(198,165,133,.85)';
  const filledFill='rgba(242,238,230,.82)';
  const correctFill='#9CB7B1';
  const wrongFill='rgba(198,165,133,.8)';
  const pitchOkFill='rgba(198,183,133,.85)'; // amber: pitch right, rhythm wrong
  const resFill=(res)=>res.correct?correctFill:res.pitchOk?pitchOkFill:wrongFill;
  const nextStroke='rgba(156,183,177,.45)';

  const melodyBeats=melody.reduce((s,n)=>s+n.beats,0);
  let cum=0;
  const melodyPositions=melody.map(n=>{const x=cum;cum+=n.beats;return x;});
  cum=0;
  const inputPositions=input.map(n=>{const x=cum;cum+=n.beats;return x;});

  const minBeat=input.reduce((m,n)=>n.type!=='rest'?Math.min(m,n.beats):m,1);
  const effectivePPB=Math.max(PX_PER_BEAT, MIN_PX_PER_NOTE/minBeat);
  const totalBeatsShown=Math.max(melodyBeats,inputPositions.length>0?inputPositions[inputPositions.length-1]+(input[input.length-1]?.beats||1):4);
  const SW=headerW+totalBeatsShown*effectivePPB+MR;
  const xAt=beatPos=>headerW+beatPos*effectivePPB+NOTE_OFFSET;

  useEffect(()=>{
    const el=scrollRef.current;
    if(!el) return;
    const latestX=headerW+(input.reduce((s,n)=>s+n.beats,0))*effectivePPB;
    const viewW=el.clientWidth;
    if(latestX+80>viewW) el.scrollLeft=latestX+80-viewW;
    else el.scrollLeft=0;
  },[input.length]);

  function spellAbs(abs){
    const rel=abs-(48+rootSemi);
    const oct=Math.floor(rel/12);
    const semInOct=((rel%12)+12)%12;
    const degIdx=MAJ_IVS.indexOf(semInOct);
    if(degIdx<0) return spellMelodyNote(abs);
    const cDeg={0:0,2:1,4:2,5:3,7:4,9:5,11:6};
    const rootDeg=cDeg[rootSemi]??0;
    return{step:oct*7+degIdx+rootDeg,acc:null};
  }

  function ledgers(step){
    const ls=[];
    for(let s=12;s<=step;s+=2) ls.push(s);
    for(let s=0;s>=step;s-=2) ls.push(s);
    return ls;
  }

  const barLines=[];
  for(let b=BEATS_PER_MEASURE;b<totalBeatsShown;b+=BEATS_PER_MEASURE) barLines.push(b);

  // Beaming: all sub-quarter notes in the same half-bar form one group.
  // This handles ESS, SSE, SES, E.S (dotted-eighth + sixteenth) etc.
  // Dotted-eighth (0.75 beats) is beamable — it's still a flagged note.
  function beamKey(beatStart, beats){
    if(beats>0.75||beats<=0) return null;
    // All beamable notes group by beat. After grouping, adjacent pure-eighth
    // groups within the same half-bar will be merged.
    return `bt-${Math.floor(beatStart)}`;
  }

  // Is this note beamable (has a flag if unbeamed)?
  function isBeamable(inp){
    return inp.type!=='rest' && inp.abs!=null && inp.beats<=0.75 && inp.beats>0;
  }
  const noteTiming=[];
  let c2=0;
  input.forEach((inp,i)=>{noteTiming.push({i,inp,beatStart:c2});c2+=inp.beats;});

  // Build raw beam groups by beat
  const rawGroups=[];
  let rg=null,rk=null;
  const flushRaw=()=>{if(rg&&rg.length>=2)rawGroups.push(rg);rg=null;rk=null;};
  noteTiming.forEach(({i,inp,beatStart})=>{
    if(!isBeamable(inp)){flushRaw();return;}
    const k=beamKey(beatStart,inp.beats);
    if(k===null){flushRaw();return;}
    if(rk!==null&&k!==rk) flushRaw();
    if(!rg) rg=[];
    rg.push({i,inp,beatStart}); rk=k;
  });
  flushRaw();

  // Merge adjacent groups if all notes are pure eighths and within the same half-bar
  const mergedGroups=[];
  for(let gi=0;gi<rawGroups.length;gi++){
    const g=rawGroups[gi];
    const allEighths=g.every(({inp})=>Math.abs(inp.beats-0.5)<0.001);
    if(allEighths&&mergedGroups.length>0){
      const prev=mergedGroups[mergedGroups.length-1];
      const prevAllEighths=prev.every(({inp})=>Math.abs(inp.beats-0.5)<0.001);
      const prevHalfBar=Math.floor(prev[0].beatStart/2);
      const curHalfBar=Math.floor(g[0].beatStart/2);
      if(prevAllEighths&&prevHalfBar===curHalfBar){
        mergedGroups[mergedGroups.length-1]=[...prev,...g];
        continue;
      }
    }
    mergedGroups.push(g);
  }
  // Only keep groups of 2+
  const beamGroups=mergedGroups.filter(g=>g.length>=2);

  // beamedSet: indices of notes in any beam group
  const beamedSet=new Set();
  beamGroups.forEach(g=>g.forEach(({i})=>beamedSet.add(i)));

  return(
    <div ref={scrollRef} style={{overflowX:'auto',margin:'4px 0 8px',WebkitOverflowScrolling:'touch'}}>
      <svg width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} style={{display:'block',minWidth:SW}}>
        {[0,1,2,3,4].map(i=>(
          <line key={i} x1={2} y1={L0+i*lineGap} x2={SW-MR/2} y2={L0+i*lineGap} stroke={staffColor} strokeWidth={1}/>
        ))}
        <text x={2} y={clefY} fontSize={clefSize} fontFamily='serif' fill={staffColor} style={{userSelect:'none'}}>&#119070;</text>
        {signs.map(({s,acc},ki)=>(
          <text key={ki} x={26+ki*9} y={yForStep(s)+5} fontSize={12} fontWeight='900'
            fontFamily="'Work Sans',sans-serif" fill='rgba(242,238,230,.45)' textAnchor='middle' style={{userSelect:'none'}}>{acc}</text>
        ))}
        {barLines.map(b=>(
          <line key={b} x1={headerW+b*effectivePPB} y1={L0} x2={headerW+b*effectivePPB} y2={L0+4*lineGap} stroke={staffColor} strokeWidth={1}/>
        ))}

        {/* Beams */}
        {beamGroups.map((group,gi)=>{
          const avgStep=group.reduce((s,{inp})=>{const {step}=spellAbs(inp.abs);return s+step;},0)/group.length;
          const stemUp=avgStep<=6;
          const stemLen=lineGap*3.5;
          const sxOff=stemUp?lineGap*0.52:-lineGap*0.52;
          const beamThick=lineGap*0.40;
          const beamGap=lineGap*0.46;
          const {i:fi,inp:fn}=group[0];
          const {i:li,inp:ln}=group[group.length-1];
          const xFirst=xAt(inputPositions[fi])+sxOff;
          const xLast= xAt(inputPositions[li])+sxOff;
          const {step:sf}=spellAbs(fn.abs);
          const {step:sl}=spellAbs(ln.abs);
          const yFirst=yForStep(sf)+(stemUp?-stemLen:stemLen);
          const yLast= yForStep(sl)+(stemUp?-stemLen:stemLen);
          const beamY=xq=>(xFirst===xLast)?yFirst:yFirst+(yLast-yFirst)*(xq-xFirst)/(xLast-xFirst);
          const f=submitted?(noteResults[fi]?resFill(noteResults[fi]):filledFill):filledFill;
          const dy=stemUp?beamThick:-beamThick;
          const result=[];

          result.push(
            <polygon key={`bg${gi}-primary`}
              points={`${xFirst},${yFirst} ${xLast},${yLast} ${xLast},${yLast+dy} ${xFirst},${yFirst+dy}`}
              fill={f}/>
          );

          // Secondary beam for 16th runs
          let seg16Start=null;
          group.forEach(({i:ni,inp:n},pos)=>{
            const x=xAt(inputPositions[ni])+sxOff;
            if(n.beats<=0.25){
              if(seg16Start===null) seg16Start=pos;
            } else {
              if(seg16Start!==null){
                if(pos-seg16Start>=2){
                  const xs=xAt(inputPositions[group[seg16Start].i])+sxOff;
                  const xe=xAt(inputPositions[group[pos-1].i])+sxOff;
                  const off=stemUp?(beamThick+beamGap):-(beamThick+beamGap);
                  result.push(<polygon key={`bg${gi}-sec${seg16Start}`}
                    points={`${xs},${beamY(xs)+off} ${xe},${beamY(xe)+off} ${xe},${beamY(xe)+off+dy} ${xs},${beamY(xs)+off+dy}`}
                    fill={f}/>);
                } else {
                  const xn=xAt(inputPositions[group[seg16Start].i])+sxOff;
                  const off=stemUp?(beamThick+beamGap):-(beamThick+beamGap);
                  const dir=seg16Start>0?-1:1;
                  result.push(<polygon key={`stub${gi}-${seg16Start}`}
                    points={`${xn},${beamY(xn)+off} ${xn+effectivePPB*0.22*dir},${beamY(xn)+off} ${xn+effectivePPB*0.22*dir},${beamY(xn)+off+dy} ${xn},${beamY(xn)+off+dy}`}
                    fill={f}/>);
                }
                seg16Start=null;
              }
            }
          });
          if(seg16Start!==null){
            const runLen=group.length-seg16Start;
            const off=stemUp?(beamThick+beamGap):-(beamThick+beamGap);
            if(runLen>=2){
              const xs=xAt(inputPositions[group[seg16Start].i])+sxOff;
              const xe=xAt(inputPositions[group[group.length-1].i])+sxOff;
              result.push(<polygon key={`bg${gi}-sec-end`}
                points={`${xs},${beamY(xs)+off} ${xe},${beamY(xe)+off} ${xe},${beamY(xe)+off+dy} ${xs},${beamY(xs)+off+dy}`}
                fill={f}/>);
            } else {
              const xn=xAt(inputPositions[group[seg16Start].i])+sxOff;
              const dir=seg16Start>0?-1:1;
              result.push(<polygon key={`stub${gi}-trail`}
                points={`${xn},${beamY(xn)+off} ${xn+effectivePPB*0.22*dir},${beamY(xn)+off} ${xn+effectivePPB*0.22*dir},${beamY(xn)+off+dy} ${xn},${beamY(xn)+off+dy}`}
                fill={f}/>);
            }
          }

          // Stems extended to beam line
          group.forEach(({i:ni,inp:n})=>{
            if(n.type==='rest'||!n.abs) return;
            const nx=xAt(inputPositions[ni]);
            const {step:ns}=spellAbs(n.abs);
            const noteY=yForStep(ns);
            const stemX=nx+sxOff;
            const stemY1=stemUp?noteY-lineGap*0.45:noteY+lineGap*0.45;
            const stemY2=beamY(stemX);
            const fc2=submitted?(noteResults[ni]?resFill(noteResults[ni]):filledFill):filledFill;
            result.push(<line key={`stem${ni}`} x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke={fc2} strokeWidth={1.2}/>);
          });

          return result;
        })}

        {/* Notes */}
        {(()=>{
          return input.map((inp,i)=>{
            const beatPos=inputPositions[i];
            const x=xAt(beatPos);
            const isFirst=i===0;
            const res=submitted?noteResults[i]:null;
            const isRest=inp.type==='rest';
            const isTied=inp.tied||false;
            const isBeamed=beamedSet.has(i);

            if(isRest||inp.abs==null){
              const restY=yForStep(6);
              const fill=res?resFill(res):'rgba(242,238,230,.55)';
              return(
                <g key={i}>
                  <RhythmNote x={x} y={restY} beats={inp.beats} type='rest' fill={fill} stemUp lineGap={lineGap} dotted={!!inp.dotted}/>
                </g>
              );
            }

            const {step}=spellAbs(inp.abs);
            const y=yForStep(step);
            const fill=isFirst?tonicFill:res?resFill(res):filledFill;
            const leds=ledgers(step);
            const stemUp=step<=6;
            const rx=lineGap*0.56, ry=lineGap*0.37;

            return(
              <g key={i}>
                {leds.map(ls=>(
                  <line key={ls} x1={x-10} y1={yForStep(ls)} x2={x+10} y2={yForStep(ls)} stroke={staffColor} strokeWidth={1}/>
                ))}
                {isTied&&i>0&&input[i-1]?.abs!=null&&(()=>{
                  const prevX=xAt(inputPositions[i-1]);
                  const {step:ps}=spellAbs(input[i-1].abs);
                  const py=yForStep(ps);
                  const cy=py+(stemUp?14:-14);
                  return <path d={`M${prevX+6},${py} Q${(prevX+x)/2},${cy} ${x-6},${y}`}
                    fill='none' stroke={fill} strokeWidth={1.5}/>;
                })()}
                {isBeamed
                  ?<g>
                      <Notehead cx={x} cy={y} rx={rx} ry={ry} color={fill} bg='#405147'/>
                      {inp.dotted&&<AugDot x={x+rx+lineGap*0.45} y={y} r={lineGap*0.14} color={fill}/>}
                    </g>
                  :<RhythmNote x={x} y={y} beats={inp.beats} fill={fill} stemUp={stemUp} lineGap={lineGap} dotted={!!inp.dotted}/>
                }
                {isFirst&&<text x={x} y={y+(stemUp?15:-20)} fontSize={8}
                  fontFamily="'Work Sans',sans-serif" fill='rgba(198,165,133,.4)'
                  textAnchor='middle'>Do</text>}
              </g>
            );
          });
        })()}

        {/* Next-note cursor */}
        {!submitted&&input.length<melody.length&&(()=>{
          const nextBeatPos=input.reduce((s,n)=>s+n.beats,0);
          const cx=xAt(nextBeatPos);
          const slotY=yForStep(6);
          return(
            <g>
              <ellipse cx={cx} cy={slotY} rx={6} ry={4.5} fill='none'
                stroke={nextStroke} strokeWidth={1} strokeDasharray='3 3'/>
              <circle cx={cx} cy={slotY+16} r={2} fill={nextStroke}/>
            </g>
          );
        })()}

        {/* Ghost notes: after submit, show the correct melody overlaid at melody beat positions.
            Only render ghost where the input at that beat position is wrong. */}
        {submitted&&(()=>{
          // Build input timeline by beat position for quick lookup
          let iCum=0;
          const inpTimeline=input.map(n=>{const s=iCum;iCum+=n.beats;return{start:s,end:iCum,n};});
          const inputAt=(beatPos,melBeats)=>{
            const mid=beatPos+melBeats*0.5;
            return inpTimeline.find(({start,end})=>mid>=start-0.001&&mid<end-0.001)?.n;
          };

          let mCum=0;
          return melody.map((note,i)=>{
            const beatPos=mCum;
            mCum+=note.beats;
            // Find what the user entered at this beat position
            const inpNote=inputAt(beatPos,note.beats);
            // If pitch and type match, no ghost needed
            const pitchMatch=note.type==='rest'
              ?(inpNote?.type==='rest')
              :(inpNote?.abs===note.abs&&inpNote?.type!=='rest');
            if(pitchMatch) return null;

            const x=xAt(beatPos);
            const ghostFill='rgba(156,183,177,.38)';
            const isRest=note.type==='rest';
            const stemUp=!isRest&&note.abs!=null?(()=>{const {step}=spellAbs(note.abs);return step<=6;})():true;

            if(isRest) return(
              <g key={'ghost'+i}>
                <RhythmNote x={x} y={yForStep(6)} beats={note.beats} type='rest'
                  fill={ghostFill} stemUp lineGap={lineGap} dotted={!!note.dotted}/>
              </g>
            );
            if(note.abs==null) return null;
            const {step}=spellAbs(note.abs);
            const y=yForStep(step);
            return(
              <g key={'ghost'+i}>
                {ledgers(step).map(ls=>(
                  <line key={ls} x1={x-10} y1={yForStep(ls)} x2={x+10} y2={yForStep(ls)}
                    stroke={staffColor} strokeWidth={1}/>
                ))}
                <RhythmNote x={x} y={y} beats={note.beats} type='note'
                  fill={ghostFill} stemUp={stemUp} lineGap={lineGap} dotted={!!note.dotted}/>
              </g>
            );
          });
        })()}
      </svg>
    </div>
  );
}

// ── Settings sheet ────────────────────────────────────────────────────────────
function DictationSettings({rootSemi,setRootSemi,measures,setMeasures,inputMode,setInputMode,difficulty,setDifficulty,onClose,onNewMelody}){
  const[r,setR]=useState(rootSemi);
  const[m,setM]=useState(measures);
  const[im,setIm]=useState(inputMode);
  const[d,setD]=useState(difficulty);
  function save(){setRootSemi(r);setMeasures(m);setInputMode(im);setDifficulty(d);onNewMelody();onClose();}
  const KEYS=[{s:0,l:'C'},{s:2,l:'D'},{s:4,l:'E'},{s:5,l:'F'},{s:7,l:'G'},{s:9,l:'A'},{s:11,l:'B'}];
  const DIFFS=[
    {v:1,l:'Quarters',   sub:'♩ only'},
    {v:2,l:'Simple',     sub:'♩ 𝅗𝅥 𝅝'},
    {v:3,l:'Moderate',   sub:'+ ♪ dotted'},
    {v:4,l:'Complex',    sub:'+ ♬ rests'},
  ];
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(40,55,45,.7)',zIndex:100,display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#2E3D33',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:430,margin:'0 auto',
        padding:'24px 20px 36px',animation:'ri_slideSheet .35s ease',display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:'#F2EEE6'}}>Settings</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'rgba(242,238,230,.4)',fontSize:20,cursor:'pointer',padding:4}}>×</button>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(156,183,177,.6)',textTransform:'uppercase',letterSpacing:.1,marginBottom:10}}>Rhythm</div>
          <div style={{display:'flex',gap:6}}>
            {DIFFS.map(({v,l,sub})=>(
              <button key={v} onClick={()=>setD(v)}
                style={{flex:1,padding:'8px 4px',borderRadius:10,border:'1.5px solid',
                  borderColor:d===v?'#9CB7B1':'rgba(242,238,230,.15)',
                  background:d===v?'rgba(156,183,177,.2)':'transparent',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer'}}>
                <span style={{color:d===v?'#9CB7B1':'rgba(242,238,230,.55)',fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:700}}>{l}</span>
                <span style={{color:'rgba(242,238,230,.28)',fontFamily:"'Work Sans',sans-serif",fontSize:9}}>{sub}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(156,183,177,.6)',textTransform:'uppercase',letterSpacing:.1,marginBottom:10}}>Key</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {KEYS.map(({s,l})=>(
              <button key={s} onClick={()=>setR(s)}
                style={{width:38,height:36,borderRadius:10,border:'1.5px solid',
                  borderColor:r===s?'#9CB7B1':'rgba(242,238,230,.15)',
                  background:r===s?'rgba(156,183,177,.2)':'transparent',
                  color:r===s?'#9CB7B1':'rgba(242,238,230,.45)',
                  fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,cursor:'pointer'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(156,183,177,.6)',textTransform:'uppercase',letterSpacing:.1,marginBottom:10}}>Measures</div>
          <div style={{display:'flex',gap:6}}>
            {[1,2,3,4].map(n=>(
              <button key={n} onClick={()=>setM(n)}
                style={{flex:1,padding:'10px',borderRadius:10,border:'1.5px solid',
                  borderColor:m===n?'#9CB7B1':'rgba(242,238,230,.15)',
                  background:m===n?'rgba(156,183,177,.2)':'transparent',
                  color:m===n?'#9CB7B1':'rgba(242,238,230,.45)',
                  fontFamily:"'Fraunces',serif",fontSize:15,fontWeight:700,cursor:'pointer'}}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(156,183,177,.6)',textTransform:'uppercase',letterSpacing:.1,marginBottom:10}}>Input Style</div>
          <div style={{display:'flex',gap:6}}>
            {[{id:'note',l:'Note Names'},{id:'piano',l:'Piano'}].map(({id,l})=>(
              <button key={id} onClick={()=>setIm(id)}
                style={{flex:1,padding:'10px',borderRadius:10,border:'1.5px solid',
                  borderColor:im===id?'#9CB7B1':'rgba(242,238,230,.15)',
                  background:im===id?'rgba(156,183,177,.2)':'transparent',
                  color:im===id?'#9CB7B1':'rgba(242,238,230,.45)',
                  fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,cursor:'pointer'}}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={save}
          style={{padding:'14px',background:'#405147',border:'none',borderRadius:12,
            fontFamily:"'Work Sans',sans-serif",fontSize:15,fontWeight:700,color:'#F2EEE6',cursor:'pointer',marginTop:4}}>
          Apply & New Melody
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function MelodicDictation({onBack}){
  const[measures,setMeasures]   =useState(1);
  const[rootSemi,setRootSemi]   =useState(0);
  const[inputMode,setInputMode] =useState('note');
  const[difficulty,setDifficulty]=useState(1);
  const[showSettings,setShowSettings]=useState(false);
  const[melody,setMelody]       =useState(null);
  // input: array of {abs, beats, type:'note'|'rest'|'tie'}
  const[input,setInput]         =useState([]);
  const[selectedDur,setSelectedDur]=useState('quarter');
  const[dotOn,setDotOn]           =useState(false);
  const[pendingTie,setPendingTie] =useState(false); // next note will be tied from previous
  const[playing,setPlaying]     =useState(false);
  const[fillDur,setFillDur]     =useState(2000);
  const[submitted,setSubmitted] =useState(false);
  const[phase,setPhase]         =useState('listen'); // 'listen' | 'sing' | 'notate'
  const[round,setRound]         =useState(0);
  const[playCount,setPlayCount] =useState(0);
  const[pianoOctave,setPianoOctave]=useState(4);
  const[diatKeyOctave,setDiatKeyOctave]=useState(4);
  const[score,setScore]         =useState({correct:0,total:0});
  const playingR=useRef(false);
  const unlocked=useRef(false);

  function newMelody(){setRound(r=>r+1);}
  function handleNext(){setRound(r=>r+1);}

  useEffect(()=>{
    const m=buildDiatonicMelody(measures,rootSemi,difficulty);
    setMelody(m);
    setInput([{...m[0],type:'note'}]); // first note pre-given
    setSubmitted(false);setPhase('listen');setPlayCount(0);setSelectedDur('quarter');setDotOn(false);setPendingTie(false);
  },[round,measures,rootSemi,difficulty]);

  useEffect(()=>{
    if(!melody||!unlocked.current)return;
    const t=setTimeout(()=>doPlay(melody),400);
    return()=>clearTimeout(t);
  },[melody]);

  const doPlay=useCallback(async(m)=>{
    const mel=m||melody;if(!mel||playingR.current)return;
    playingR.current=true;setPlaying(true);
    try{
      const ctx=getCtx();if(ctx.state==='suspended')await ctx.resume();
      unlocked.current=true;
      const dur=scheduleDictationMelody(ctx,mel);
      setFillDur(dur);setPlayCount(c=>c+1);
      setTimeout(()=>{playingR.current=false;setPlaying(false);},dur);
    }catch{playingR.current=false;setPlaying(false);}
  },[melody]);

  // Ties occupy their own beat slot — they are separate noteheads on the staff
  // Total beats is always the full measure count — never limited by melody event count
  const totalMelodyBeats=measures*BEATS_PER_MEASURE;
  const usedBeats=Math.round(input.reduce((s,n)=>s+n.beats,0)*1000)/1000;
  const remainingBeats=Math.round((totalMelodyBeats-usedBeats)*1000)/1000;
  const isComplete=remainingBeats===0;

  function effectiveBeats(){
    const dur=DURATIONS.find(d=>d.id===selectedDur);
    if(!dur) return 1;
    return dotOn ? dur.beats*1.5 : dur.beats;
  }

  function handleNote(abs){
    if(submitted||isComplete||phase!=='notate')return;
    const beats=effectiveBeats();
    if(beats>remainingBeats+0.001)return;
    try{const ctx=getCtx();if(ctx.state==='suspended')ctx.resume().then(()=>playTap(ctx));else playTap(ctx);}catch{}
    const lastNote=input.filter(n=>n.type!=='rest').slice(-1)[0];
    const tiedAbs=pendingTie&&lastNote?lastNote.abs:abs;
    // Auto-split notes crossing barlines, but NOT if the note exactly fills remaining beats
    // (e.g. a whole note filling the last bar should never be split)
    const currentBeat=Math.round(input.reduce((s,n)=>s+n.beats,0)*1000)/1000;
    const split=Math.abs(beats-remainingBeats)<0.001
      ?[{beats,isRest:false,tied:false}]
      :splitAtBarlines([{beats,isRest:false}],currentBeat);
    const newNotes=split.map(({beats:b},idx)=>({
      abs:tiedAbs, beats:b, type:'note', dotted:dotOn&&idx===0,
      tied: idx===0 ? pendingTie : true,
    }));
    setInput(prev=>[...prev,...newNotes]);
    setPendingTie(false);
  }

  function handleRest(){
    if(submitted||isComplete||phase!=='notate')return;
    const beats=effectiveBeats();
    if(beats>remainingBeats+0.001)return;
    setPendingTie(false);
    const currentBeat=Math.round(input.reduce((s,n)=>s+n.beats,0)*1000)/1000;
    const split=Math.abs(beats-remainingBeats)<0.001
      ?[{beats,isRest:true}]
      :splitAtBarlines([{beats,isRest:true}],currentBeat);
    setInput(prev=>[...prev,...split.map(({beats:b},idx)=>({abs:null,beats:b,type:'rest',dotted:dotOn&&idx===0}))]);
  }

  function handleTie(){
    // Toggle pending tie: next note entered will be tied from the previous note
    if(submitted||phase!=='notate') return;
    const lastNote=input.filter(n=>n.type!=='rest').slice(-1)[0];
    if(!lastNote) return; // nothing to tie from
    setPendingTie(t=>!t);
  }

  function handleBackspace(){
    if(submitted||input.length<=1)return;
    setInput(i=>i.slice(0,-1));
  }

  function handleSubmit(){
    if(!melody||!isComplete||submitted)return;
    setSubmitted(true);
    const aligned=scoreSounding(collapseForScoring(melody),collapseForScoring(input));
    const allCorrect=aligned.every(r=>r.correct);
    setScore(s=>({correct:s.correct+(allCorrect?1:0),total:s.total+1}));
    try{const ctx=getCtx();allCorrect?playOK(ctx):playNG(ctx);}catch{}
  }

  // Aligned results against melody sounding events (one per melody sounding event + extras).
  const alignedResults=useMemo(()=>{
    if(!submitted||!melody) return [];
    return scoreSounding(collapseForScoring(melody),collapseForScoring(input));
  },[submitted,melody,input]);

  // Per-notehead results: map each input notehead to the melody event it covers by beat position.
  const noteResults=useMemo(()=>{
    if(!submitted||!melody||!alignedResults.length) return [];
    // Build a timeline of melody sounding events with their beat positions
    const melS=collapseForScoring(melody);
    let mpos=0;
    const melTimeline=melS.map((ev,i)=>{
      const s=mpos; mpos+=ev.beats; return{start:s,end:mpos,result:alignedResults[i]};
    });
    // For each input notehead, find which melody sounding event covers its midpoint
    let ipos=0;
    return input.map(inp=>{
      const mid=ipos+inp.beats*0.5;
      ipos+=inp.beats;
      const match=melTimeline.find(({start,end})=>mid>=start-0.001&&mid<end-0.001);
      return match?.result||{correct:false,pitchOk:false,beatOk:false};
    });
  },[submitted,melody,input,alignedResults]);

  const lastInputAbs=input.filter(n=>n.abs!=null).slice(-1)[0]?.abs??null;

  return(
    <><Styles/>
    <style>{`@keyframes ri_memorizeRing{0%{opacity:0;transform:scale(1);}30%{opacity:1;}100%{opacity:0;transform:scale(1.18);}}`}</style>
    <div className='et-root screen-enter'>
      <div className='et-hdr'>
        <button className='et-back' onClick={()=>{stopCtx();onBack();}}>← Back</button>
        <div className='et-hdr-mid'>
          <div className='et-mode-label' style={{fontSize:12}}>Melodic Dictation</div>
        </div>
        <div className='et-hdr-right' style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:'rgba(156,183,177,.7)',fontFamily:"'Work Sans',sans-serif"}}>
            {score.total>0?`${score.correct}/${score.total}`:''}
          </span>
          <button className='et-icon-btn' onClick={()=>setShowSettings(true)}>⚙</button>
        </div>
      </div>

      <div style={{padding:'0 16px 10px',display:'flex',alignItems:'center',flexShrink:0}}>
        <div style={{fontSize:12,color:'rgba(156,183,177,.5)',fontFamily:"'Work Sans',sans-serif"}}>
          {NOTES[rootSemi]} major · {measures} bar{measures>1?'s':''} · {['','Quarters','Simple','Moderate','Complex'][difficulty]}
        </div>
        <div style={{flex:1}}/>
        <button onClick={newMelody} disabled={playing}
          style={{fontSize:11,color:'rgba(156,183,177,.45)',background:'transparent',
            border:'1px solid rgba(156,183,177,.18)',borderRadius:8,padding:'3px 10px',
            cursor:'pointer',fontFamily:"'Work Sans',sans-serif",fontWeight:600}}>
          New
        </button>
      </div>

      <div className='et-scroll'>
        {melody&&(<div className='et-question' style={{flex:1,display:'flex',flexDirection:'column'}}>

          {/* ── LISTEN phase — centred, full height ── */}
          {phase==='listen'&&(
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
              justifyContent:'center',textAlign:'center',minHeight:0}}>
              <div style={{
                display:'flex',flexDirection:'column',alignItems:'center',gap:28,width:'100%',maxWidth:280,
                animation:playCount>0&&!playing?'ri_liftUp .5s cubic-bezier(.4,0,.2,1) forwards':'none',
              }}>
                <div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:30,fontWeight:700,color:'#F2EEE6',
                    letterSpacing:-.3,lineHeight:1.1,marginBottom:8}}>
                    {NOTES[rootSemi]} major
                  </div>
                  <div style={{fontSize:13,color:'rgba(156,183,177,.5)',fontStyle:'italic'}}>
                    {measures} bar{measures>1?'s':''} · scalewise · starts on Do
                  </div>
                </div>
                <button className={'et-play-btn'+(playCount===0&&!playing?' idle-pulse':'')}
                  onClick={()=>doPlay(melody)} disabled={playing||playCount>=3} style={{width:'100%'}}>
                  {playing&&<div className='play-fill' style={{animationName:'ri_playFill',
                    animationDuration:fillDur+'ms',animationTimingFunction:'linear',animationFillMode:'forwards'}}/>}
                  <span className='play-btn-inner'>
                    {playing
                      ?<><div className='wave-bars'><div className='wave-bar wb1'/><div className='wave-bar wb2'/><div className='wave-bar wb3'/><div className='wave-bar wb4'/><div className='wave-bar wb5'/></div>Listen and memorise…</>
                      :playCount>=3
                        ?<span style={{opacity:.5}}>Listened ({playCount}/3)</span>
                        :<span>{playCount>0?`Listen again (${playCount}/3)`:'Listen'}</span>}
                  </span>
                </button>
              </div>

              {/* Sing prompt — fades in after first play */}
              {playCount>0&&!playing&&(
                <div style={{opacity:0,animation:'ri_fadeIn .6s ease .35s forwards',
                  width:'100%',maxWidth:280,marginTop:40,textAlign:'center'}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontStyle:'italic',fontSize:16,
                    color:'rgba(156,183,177,.6)',lineHeight:1.7,marginBottom:20}}>
                    Sing it back to yourself.<br/>
                    <span style={{fontSize:13,opacity:.8}}>Hold the melody in your mind before writing.</span>
                  </div>
                  <button onClick={()=>setPhase('notate')} className='et-next'>
                    I'm ready to notate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── NOTATE phase ── */}
          {phase==='notate'&&(
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              <div style={{textAlign:'center',marginBottom:12}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:'#F2EEE6',marginBottom:3}}>
                  {submitted?'How did you do?':'Notate the melody'}
                </div>
                <div style={{fontSize:11,color:'rgba(156,183,177,.45)'}}>
                  {remainingBeats>0&&!submitted?`${remainingBeats} beat${remainingBeats!==1?'s':''} remaining`:''}
                </div>
              </div>

              {/* Staff */}
              <div style={{position:'relative',borderRadius:14,
                background:playing?'rgba(156,183,177,.04)':'transparent',transition:'background .5s'}}>
                <MemorizeOverlay playing={playing}/>
                <DictationStaff melody={melody} input={input}
                  submitted={submitted} noteResults={noteResults} rootSemi={rootSemi}/>
              </div>

              {/* Input panel */}
              {!submitted&&(
                <div>
                  {/* Rhythm selector */}
                  <RhythmSelector
                    selected={selectedDur}
                    dotOn={dotOn}
                    tieOn={pendingTie}
                    onSelect={setSelectedDur}
                    onToggleDot={()=>setDotOn(d=>!d)}
                    onRest={handleRest}
                    onTie={handleTie}
                    remainingBeats={remainingBeats}
                  />
                  {/* Note keyboard */}
                  {inputMode==='piano'
                    ?<DictationPiano rootSemi={rootSemi} onNote={handleNote} lastInput={lastInputAbs}
                        octave={pianoOctave} onOctaveChange={setPianoOctave}/>
                    :<DiatonicKeyboard rootSemi={rootSemi} onNote={handleNote} lastInput={lastInputAbs}
                        octave={diatKeyOctave} onOctaveChange={setDiatKeyOctave}/>
                  }
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                    <div style={{fontSize:11,color:'rgba(156,183,177,.4)'}}>
                      {input.length} notes entered
                    </div>
                    <button onClick={handleBackspace} disabled={input.length<=1}
                      style={{background:'transparent',border:'none',color:'rgba(242,238,230,.3)',
                        fontSize:18,cursor:'pointer',padding:'4px 8px',
                        opacity:input.length<=1?0.2:1}}>
                      ⌫
                    </button>
                  </div>
                </div>
              )}

              {/* Results summary */}
              {submitted&&(
                <div style={{marginTop:4,marginBottom:4,opacity:0,animation:'ri_fadeIn .5s ease forwards'}}>
                  <div style={{textAlign:'center',fontSize:11,color:'rgba(156,183,177,.5)',
                    fontFamily:"'Work Sans',sans-serif"}}>
                    {(()=>{
                      const total=alignedResults.filter(r=>r.mel).length;
                      const correct=alignedResults.filter(r=>r.correct).length;
                      const pitchOnly=alignedResults.filter(r=>!r.correct&&r.pitchOk&&!r.beatOk).length;
                      if(correct===total) return '✓ Perfect';
                      if(pitchOnly>0&&correct+pitchOnly===total)
                        return `All pitches correct · ${pitchOnly} rhythm error${pitchOnly>1?'s':''}`;
                      return `${correct}/${total} correct · ghost notes show the answer`;
                    })()}
                  </div>
                </div>
              )}

              <div style={{marginTop:'auto',paddingTop:10}}>
                {!submitted
                  ?<button onClick={handleSubmit} className='et-next'
                      disabled={!isComplete}
                      style={{opacity:isComplete?1:0.3}}>
                      Confirm
                    </button>
                  :<button onClick={handleNext} className='et-next'>Continue</button>
                }
              </div>
            </div>
          )}

        </div>)}
      </div>
    </div>

    {showSettings&&<DictationSettings
      rootSemi={rootSemi} setRootSemi={setRootSemi}
      measures={measures} setMeasures={setMeasures}
      inputMode={inputMode} setInputMode={setInputMode}
      difficulty={difficulty} setDifficulty={setDifficulty}
      onClose={()=>setShowSettings(false)}
      onNewMelody={newMelody}
    />}
    </>
  );
}

// ── Shared clef definitions ───────────────────────────────────────────────────
// Each clef: glyph char, where middle C sits on the step axis (botLine=step 2),
// and the SVG y-offset tweak for the glyph.
// step axis: botLineY = step 2, each half-space up = -lineGap/2
// Treble: bot line = E4 = step 2+(E4-E4)=2... let's define absolute:
//   Treble: C4 = step 0 (one ledger below); botLine (step2) = E4
//   Alto:   C4 = step 6 (middle line 3); botLine (step2) = F3
//   Tenor:  C4 = step 8 (4th line); botLine (step2) = D3
//   Bass:   C4 = step 12 (one ledger above); botLine (step2) = G2
//
// NOTE_POOL step values are given relative to C4. We offset by middleCStep.
// A note's y = botLineY - (step - 2) * (lineGap/2)
// where step = middleCStep + noteLetterOffset + octaveOffset*7

const CLEFS=[
  {id:'treble', label:'Treble', glyph:'𝄞', middleCStep:0,  glyphY:-0.1,  glyphSize:6.2, xOff:0, clefW:52},
  {id:'alto',   label:'Alto',   glyph:'𝄡', middleCStep:6,  glyphY:-0.05, glyphSize:5.2, xOff:1, clefW:36},
  {id:'tenor',  label:'Tenor',  glyph:'𝄡', middleCStep:8,  glyphY:-1.05, glyphSize:5.2, xOff:1, clefW:36},
  {id:'bass',   label:'Bass',   glyph:'𝄢', middleCStep:12, glyphY:-0.9,  glyphSize:4.8, xOff:1, clefW:36},
];

// ── Dev mode: clef tuner (add ?dev to URL to enable) ─────────────────────────
const DEV=typeof window!=='undefined'&&window.location.search.includes('dev');

function ClefTuner({clefs, onChange}){
  if(!DEV) return null;
  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:999,
      background:'rgba(20,30,24,.97)',borderTop:'1px solid rgba(156,183,177,.3)',
      padding:'10px 12px',maxHeight:'45vh',overflowY:'auto',
      fontFamily:"'Work Sans',sans-serif",fontSize:11}}>
      <div style={{color:'rgba(156,183,177,.8)',fontWeight:700,marginBottom:8,letterSpacing:.5}}>
        CLEF TUNER — copy final values to CLEFS array
      </div>
      {clefs.map(c=>(
        <div key={c.id} style={{marginBottom:10,padding:'6px 8px',
          background:'rgba(242,238,230,.04)',borderRadius:6}}>
          <div style={{color:'#9CB7B1',fontWeight:700,marginBottom:4}}>{c.label}</div>
          {['glyphY','glyphSize','xOff','clefW'].map(prop=>(
            <div key={prop} style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
              <span style={{color:'rgba(242,238,230,.45)',width:64,flexShrink:0}}>{prop}</span>
              <input type='range'
                min={prop==='glyphSize'?2:prop==='clefW'?10:prop==='xOff'?-5:-4}
                max={prop==='glyphSize'?9:prop==='clefW'?80:prop==='xOff'?10:4}
                step={prop==='clefW'||prop==='xOff'?1:0.05}
                value={c[prop]}
                onChange={e=>onChange(c.id,prop,parseFloat(e.target.value))}
                style={{flex:1,accentColor:'#9CB7B1'}}/>
              <span style={{color:'#F2EEE6',width:36,textAlign:'right'}}>{Number(c[prop]).toFixed(2)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
const LETTER_STEP={'C':0,'D':1,'E':2,'F':3,'G':4,'A':5,'B':6};

// Render a single-note staff SVG
function SingleNoteStaff({noteName, clefId, keySemiForSigns}){
  const clef=CLEFS.find(c=>c.id===clefId)||CLEFS[0];
  const {signs}=keySigns(keySemiForSigns??0);
  const SH=140, SW=280, MR=20;
  const lineGap=12, L0=30;
  const botLineY=L0+4*lineGap;
  const yForStep=s=>botLineY-(s-2)*(lineGap/2);
  const staffColor='rgba(242,238,230,.35)';
  const noteColor='rgba(242,238,230,.9)';
  const accColor='rgba(198,165,133,.9)';
  const letter=noteName.charAt(0);
  const acc=noteName.slice(1);
  // Determine octave: place note in comfortable visible range per clef
  // Treble: default octave 4 (steps 0-6 = C4-B4, steps 7-13 = C5-B5)
  // Alto:   default octave 3-4 around middle (middleCStep=6 → C4=step6, range 4-10 comfortable)
  // Tenor:  default octave 3 range
  // Bass:   default octave 3 (C3 = middleCStep+(-7)=12-7=5, comfortable steps 2-8)
  const ls=LETTER_STEP[letter]??0;
  // Pick octave so note lands in steps ~2-10 (on or near the staff)
  const targetMid=6; // aim for middle of staff
  // Try octaves -1,0,1,2 relative to middle C octave
  let bestStep=clef.middleCStep+ls;
  for(const oct of[0,1,-1,2,-2]){
    const s=clef.middleCStep+ls+oct*7;
    if(s>=1&&s<=13){bestStep=s;break;}
  }
  const step=bestStep;
  const y=yForStep(step);
  const ksW=signs.length*10;
  const clefEndX=8+clef.clefW+4; // where key sigs start
  const headerW=clefEndX+ksW;
  const noteX=headerW+36;
  // Ledger lines
  const ledgers=[];
  for(let s=12;s<=step;s+=2) ledgers.push(s);
  for(let s=0;s>=step;s-=2) ledgers.push(s);
  // For alto/tenor: draw the C-clef bracket lines
  const isC=clef.id==='alto'||clef.id==='tenor';
  const cClefLine=clef.id==='alto'?6:8; // step where the C-clef arrow sits
  const stemUp=step<=6;
  const stemX=stemUp?noteX+6:noteX-6;
  return(
    <svg width='100%' viewBox={`0 0 ${SW} ${SH}`} style={{display:'block',margin:'4px 0'}}>
      {[0,1,2,3,4].map(i=>(
        <line key={i} x1={2} y1={L0+i*lineGap} x2={SW-MR} y2={L0+i*lineGap} stroke={staffColor} strokeWidth={1}/>
      ))}
      {/* Clef glyph */}
      <text x={2+clef.xOff} y={botLineY+clef.glyphY*lineGap}
        fontSize={Math.round(lineGap*clef.glyphSize)} fontFamily='serif'
        fill={staffColor} style={{userSelect:'none'}}>{clef.glyph}</text>
      {/* Key signature */}
      {signs.map(({s,acc:a},ki)=>(
        <text key={ki} x={clefEndX+ki*10+5} y={yForStep(s)+5} fontSize={Math.round(lineGap*1.6)} fontWeight='900'
          fontFamily="'Work Sans',sans-serif" fill='rgba(242,238,230,.65)' textAnchor='middle'
          style={{userSelect:'none'}}>{a}</text>
      ))}
      {/* Ledger lines */}
      {ledgers.map(ls=>(
        <line key={ls} x1={noteX-11} y1={yForStep(ls)} x2={noteX+11} y2={yForStep(ls)}
          stroke={staffColor} strokeWidth={1.2}/>
      ))}
      {/* Accidental */}
      {acc&&<text x={noteX-14} y={y+5} fontSize={14} fontWeight='900' fontFamily="'Work Sans',sans-serif"
        fill={accColor} textAnchor='middle' style={{userSelect:'none'}}>
        {acc==='#'?'♯':acc==='b'?'♭':acc==='##'?'𝄪':acc==='bb'?'𝄫':acc}
      </text>}
      {/* Stem */}
      <line x1={stemX} y1={stemUp?y-3:y+3} x2={stemX} y2={stemUp?y-32:y+32}
        stroke={noteColor} strokeWidth={1.5}/>
      {/* Notehead */}
      <ellipse cx={noteX} cy={y} rx={6.5} ry={4.8} fill={noteColor}
        transform={`rotate(-16,${noteX},${y})`}/>
    </svg>
  );
}

// ── Dev tool: clef position tuner ────────────────────────────────────────────
// Tap the header title 5 times to open. Shows live sliders for all clef params.
// Press "Copy" to get the updated CLEFS constant ready to paste.
function ClefDebugger({onClose}){
  const[vals,setVals]=useState(CLEFS.map(c=>({...c})));
  const set=(i,k,v)=>setVals(prev=>prev.map((c,ci)=>ci===i?{...c,[k]:v}:c));
  const lineGap=12, L0=30, SH=130, SW=260, MR=20;
  const botLineY=L0+4*lineGap;
  const yForStep=s=>botLineY-(s-2)*(lineGap/2);
  const staffColor='rgba(242,238,230,.35)';

  function copyCode(){
    const lines=vals.map(c=>
      `  {id:'${c.id}', label:'${c.label}', glyph:'${c.glyph}', middleCStep:${c.middleCStep}, `+
      ` glyphY:${c.glyphY}, glyphSize:${c.glyphSize}, xOff:${c.xOff}, clefW:${c.clefW}},`
    );
    navigator.clipboard.writeText(`const CLEFS=[\n${lines.join('\n')}\n];`);
  }

  const sl=(label,val,min,max,step,onChange)=>(
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
      <span style={{fontSize:10,color:'rgba(242,238,230,.5)',width:60,fontFamily:'monospace'}}>{label}</span>
      <input type='range' min={min} max={max} step={step} value={val}
        onChange={e=>onChange(parseFloat(e.target.value))}
        style={{flex:1,accentColor:'#9CB7B1'}}/>
      <span style={{fontSize:10,color:'#9CB7B1',width:36,fontFamily:'monospace',textAlign:'right'}}>{val}</span>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(30,40,35,.92)',zIndex:200,
      overflowY:'auto',padding:'16px'}}>
      <div style={{maxWidth:430,margin:'0 auto',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:'#F2EEE6'}}>
            Clef Tuner
          </span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={copyCode}
              style={{padding:'6px 14px',background:'#9CB7B1',border:'none',borderRadius:8,
                color:'#405147',fontFamily:"'Work Sans',sans-serif",fontSize:12,fontWeight:700,cursor:'pointer'}}>
              Copy code
            </button>
            <button onClick={onClose}
              style={{padding:'6px 10px',background:'transparent',border:'1px solid rgba(242,238,230,.2)',
                borderRadius:8,color:'rgba(242,238,230,.5)',fontSize:14,cursor:'pointer'}}>×</button>
          </div>
        </div>

        {vals.map((c,i)=>(
          <div key={c.id} style={{background:'rgba(242,238,230,.04)',borderRadius:12,padding:'12px'}}>
            {/* Preview */}
            <svg width='100%' viewBox={`0 0 ${SW} ${SH}`} style={{display:'block',marginBottom:8,background:'rgba(0,0,0,.2)',borderRadius:6}}>
              {[0,1,2,3,4].map(li=>(
                <line key={li} x1={2} y1={L0+li*lineGap} x2={SW-MR} y2={L0+li*lineGap} stroke={staffColor} strokeWidth={1}/>
              ))}
              <text x={2+c.xOff} y={botLineY+c.glyphY*lineGap}
                fontSize={Math.round(lineGap*c.glyphSize)} fontFamily='serif'
                fill='rgba(242,238,230,.8)' style={{userSelect:'none'}}>{c.glyph}</text>
            </svg>
            <div style={{fontSize:11,fontWeight:700,color:'#9CB7B1',marginBottom:6,fontFamily:"'Work Sans',sans-serif"}}>
              {c.label}
            </div>
            {sl('glyphY',    c.glyphY,    -3,   3,    0.05, v=>set(i,'glyphY',v))}
            {sl('glyphSize', c.glyphSize,  2,   10,   0.1,  v=>set(i,'glyphSize',v))}
            {sl('xOff',      c.xOff,      -5,   10,   0.5,  v=>set(i,'xOff',v))}
            {sl('clefW',     c.clefW,      10,  80,   1,    v=>set(i,'clefW',v))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shared settings sheet ─────────────────────────────────────────────────────
function ClefSettings({activeClefs, onToggle, onClose}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(40,55,45,.75)',zIndex:100,
      display:'flex',alignItems:'flex-end'}}>
      <div style={{background:'#2E3D33',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:430,
        margin:'0 auto',padding:'24px 20px 36px',display:'flex',flexDirection:'column',gap:16,
        animation:'ri_slideSheet .35s ease'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:'#F2EEE6'}}>Clefs</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',
            color:'rgba(242,238,230,.4)',fontSize:20,cursor:'pointer',padding:4}}>×</button>
        </div>
        <div style={{fontSize:13,color:'rgba(156,183,177,.5)'}}>
          Choose which clefs appear in exercises.
        </div>
        <div style={{display:'flex',gap:8}}>
          {CLEFS.map(c=>{
            const on=activeClefs.includes(c.id);
            return(
              <button key={c.id} onClick={()=>onToggle(c.id)}
                style={{flex:1,padding:'12px 4px',borderRadius:12,border:'1.5px solid',
                  borderColor:on?'#9CB7B1':'rgba(242,238,230,.15)',
                  background:on?'rgba(156,183,177,.2)':'transparent',
                  color:on?'#9CB7B1':'rgba(242,238,230,.4)',
                  cursor:'pointer',display:'flex',flexDirection:'column',
                  alignItems:'center',gap:6,transition:'all .15s'}}>
                <span style={{fontFamily:'serif',fontSize:22,lineHeight:1}}>{c.glyph}</span>
                <span style={{fontFamily:"'Work Sans',sans-serif",fontSize:11,fontWeight:700}}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
        {activeClefs.length===0&&(
          <div style={{fontSize:12,color:'rgba(198,165,133,.7)',textAlign:'center',fontStyle:'italic'}}>
            Select at least one clef
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared answer input + result display ──────────────────────────────────────
function AnswerInput({answer, onChange, onCheck, onNext, result, correctLabel, placeholder}){
  const inputRef=useRef(null);
  useEffect(()=>{if(result===null) setTimeout(()=>inputRef.current?.focus(),80);},[result]);
  const inputStyle={width:'100%',padding:'14px 16px',background:'rgba(242,238,230,.07)',
    border:'1.5px solid',borderColor:result==='correct'?'rgba(156,183,177,.5)':
      result==='wrong'?'rgba(198,165,133,.4)':'rgba(242,238,230,.18)',
    borderRadius:12,color:'#F2EEE6',fontSize:20,fontFamily:"'Fraunces',serif",fontWeight:700,
    textAlign:'center',outline:'none',boxSizing:'border-box',caretColor:'#9CB7B1',
    transition:'border-color .2s'};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:280,width:'100%',margin:'0 auto'}}>
      {result===null?(
        <>
          <input ref={inputRef} value={answer} onChange={e=>onChange(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&answer.trim()&&onCheck()}
            placeholder={placeholder} style={inputStyle}/>
          <button onClick={onCheck} disabled={!answer.trim()} className='et-next'
            style={{marginTop:0,opacity:answer.trim()?1:0.35}}>Check</button>
        </>
      ):(
        <div style={{opacity:0,animation:'ri_fadeIn .3s ease forwards',textAlign:'center'}}>
          <div style={{...inputStyle,display:'block',padding:'14px 16px',
            borderColor:result==='correct'?'rgba(156,183,177,.5)':'rgba(198,165,133,.4)'}}>
            {answer}
          </div>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,
            color:result==='correct'?'#9CB7B1':'rgba(198,165,133,.9)',marginTop:10,marginBottom:4}}>
            {result==='correct'?'✓ Correct':'✗ Not quite'}
          </div>
          {result==='wrong'&&<div style={{fontSize:13,color:'rgba(242,238,230,.45)',marginBottom:2}}>
            Answer: <strong style={{color:'rgba(242,238,230,.8)'}}>{correctLabel}</strong>
          </div>}
          <button onClick={onNext} className='et-next' style={{marginTop:10}}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Note Identification ───────────────────────────────────────────────────────
function NoteId({onBack}){
  const NOTE_ALIASES={
    'C':['C'],'C#':['C#','Db'],'Db':['C#','Db'],
    'D':['D'],'D#':['D#','Eb'],'Eb':['D#','Eb'],
    'E':['E'],'F':['F'],'F#':['F#','Gb'],'Gb':['F#','Gb'],
    'G':['G'],'G#':['G#','Ab'],'Ab':['G#','Ab'],
    'A':['A'],'A#':['A#','Bb'],'Bb':['A#','Bb'],
    'B':['B'],
  };
  const NOTE_POOL=[
    {semi:0,name:'C'},{semi:1,name:'C#'},{semi:1,name:'Db'},{semi:2,name:'D'},
    {semi:3,name:'Eb'},{semi:4,name:'E'},{semi:5,name:'F'},
    {semi:6,name:'F#'},{semi:6,name:'Gb'},{semi:7,name:'G'},{semi:8,name:'Ab'},
    {semi:9,name:'A'},{semi:10,name:'Bb'},{semi:11,name:'B'},
  ];
  const KS_OPTIONS=[0,2,4,5,7,9,11,1,3,6,8,10];

  const[round,setRound]       =useState(0);
  const[note,setNote]         =useState(null);
  const[clefId,setClefId]     =useState('treble');
  const[keySemi,setKeySemi]   =useState(0);
  const[answer,setAnswer]     =useState('');
  const[result,setResult]     =useState(null);
  const[score,setScore]       =useState({correct:0,total:0});
  const[activeClefs,setActiveClefs]=useState(['treble','alto','tenor','bass']);
  const[showSettings,setShowSettings]=useState(false);
  const[showDebug,setShowDebug]=useState(false);
  const tapCount=useRef(0);

  useEffect(()=>{
    const pool=activeClefs.length>0?activeClefs:['treble'];
    const n=NOTE_POOL[Math.floor(Math.random()*NOTE_POOL.length)];
    const cid=pool[Math.floor(Math.random()*pool.length)];
    const ks=KS_OPTIONS[Math.floor(Math.random()*KS_OPTIONS.length)];
    setNote(n);setClefId(cid);setKeySemi(ks);setAnswer('');setResult(null);
  },[round]);

  function toggleClef(id){
    setActiveClefs(prev=>
      prev.includes(id)&&prev.length>1?prev.filter(c=>c!==id):[...prev.filter(c=>c!==id),id]
    );
  }

  function checkAnswer(){
    if(!note||!answer.trim()) return;
    const raw=answer.trim();
    const norm=raw.charAt(0).toUpperCase()+raw.slice(1).replace(/B$/,'b');
    const aliases=NOTE_ALIASES[norm]||[norm];
    const correct=aliases.some(a=>(NOTE_ALIASES[note.name]||[note.name]).includes(a));
    setResult(correct?'correct':'wrong');
    setScore(s=>({correct:s.correct+(correct?1:0),total:s.total+1}));
    try{const ctx=getCtx();correct?playOK(ctx):playNG(ctx);}catch{}
  }

  const clefLabel=CLEFS.find(c=>c.id===clefId)?.label||'';

  return(
    <><Styles/>
    <div className='et-root screen-enter'>
      <div className='et-hdr'>
        <button className='et-back' onClick={onBack}>← Back</button>
        <div className='et-hdr-mid'>
          <div className='et-mode-label' onClick={()=>{tapCount.current+=1;if(tapCount.current>=5){tapCount.current=0;setShowDebug(true);}}}
            style={{cursor:'default'}}>♩ Note ID</div>
        </div>
        <div className='et-hdr-right' style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:'rgba(156,183,177,.7)',fontFamily:"'Work Sans',sans-serif"}}>
            {score.total>0?`${score.correct}/${score.total}`:''}
          </span>
          <button className='et-icon-btn' onClick={()=>setShowSettings(true)}>⚙</button>
        </div>
      </div>
      <div className='et-scroll'>
        <div key={round} className='et-question' style={{justifyContent:'center',gap:20}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:700,color:'#F2EEE6',marginBottom:4}}>
              Name this note
            </div>
            <div style={{fontSize:12,color:'rgba(156,183,177,.45)',fontStyle:'italic'}}>
              {clefLabel} clef
            </div>
          </div>
          <div style={{opacity:0,animation:'ri_fadeIn .4s ease .1s forwards'}}>
            {note&&<SingleNoteStaff noteName={note.name} clefId={clefId} keySemiForSigns={keySemi}/>}
          </div>
          <AnswerInput
            answer={answer} onChange={setAnswer}
            onCheck={checkAnswer} onNext={()=>setRound(r=>r+1)}
            result={result} correctLabel={note?.name}
            placeholder='e.g. C#, Bb, F…'
          />
        </div>
      </div>
    </div>
    {showSettings&&<ClefSettings activeClefs={activeClefs} onToggle={toggleClef} onClose={()=>setShowSettings(false)}/>}
    {showDebug&&<ClefDebugger onClose={()=>setShowDebug(false)}/>}
    </>
  );
}

// ── Key Identification ────────────────────────────────────────────────────────
function KeyId({onBack}){
  const MAJOR_KEYS=[
    {semi:0, name:'C major', aliases:['C major','C']},
    {semi:7, name:'G major', aliases:['G major','G']},
    {semi:2, name:'D major', aliases:['D major','D']},
    {semi:9, name:'A major', aliases:['A major','A']},
    {semi:4, name:'E major', aliases:['E major','E']},
    {semi:11,name:'B major', aliases:['B major','B','Cb major','Cb']},
    {semi:6, name:'F# major',aliases:['F# major','F#','Gb major','Gb']},
    {semi:1, name:'C# major',aliases:['C# major','C#','Db major','Db']},
    {semi:5, name:'F major', aliases:['F major','F']},
    {semi:10,name:'Bb major',aliases:['Bb major','Bb','A# major','A#']},
    {semi:3, name:'Eb major',aliases:['Eb major','Eb','D# major','D#']},
    {semi:8, name:'Ab major',aliases:['Ab major','Ab','G# major','G#']},
  ];

  const[round,setRound]       =useState(0);
  const[key,setKey]           =useState(null);
  const[clefId,setClefId]     =useState('treble');
  const[answer,setAnswer]     =useState('');
  const[result,setResult]     =useState(null);
  const[score,setScore]       =useState({correct:0,total:0});
  const[activeClefs,setActiveClefs]=useState(['treble','alto','tenor','bass']);
  const[showSettings,setShowSettings]=useState(false);

  useEffect(()=>{
    const pool=activeClefs.length>0?activeClefs:['treble'];
    const k=MAJOR_KEYS[Math.floor(Math.random()*MAJOR_KEYS.length)];
    const cid=pool[Math.floor(Math.random()*pool.length)];
    setKey(k);setClefId(cid);setAnswer('');setResult(null);
  },[round]);

  function toggleClef(id){
    setActiveClefs(prev=>
      prev.includes(id)&&prev.length>1?prev.filter(c=>c!==id):[...prev.filter(c=>c!==id),id]
    );
  }

  function KeyStaff({keySemi, clefId}){
    const clef=CLEFS.find(c=>c.id===clefId)||CLEFS[0];
    const{signs}=keySigns(keySemi);
    const SH=120, SW=280, MR=20;
    const lineGap=12, L0=30;
    const botLineY=L0+4*lineGap;
    const yForStep=s=>botLineY-(s-2)*(lineGap/2);
    const staffColor='rgba(242,238,230,.35)';
    const clefEndX=8+clef.clefW+4;
    return(
      <svg width='100%' viewBox={`0 0 ${SW} ${SH}`} style={{display:'block',margin:'4px 0'}}>
        {[0,1,2,3,4].map(i=>(
          <line key={i} x1={2} y1={L0+i*lineGap} x2={SW-MR} y2={L0+i*lineGap} stroke={staffColor} strokeWidth={1}/>
        ))}
        <text x={2+clef.xOff} y={botLineY+clef.glyphY*lineGap}
          fontSize={Math.round(lineGap*clef.glyphSize)} fontFamily='serif'
          fill={staffColor} style={{userSelect:'none'}}>{clef.glyph}</text>
        {signs.length===0&&(
          <text x={clefEndX+20} y={botLineY-lineGap*0.5} fontSize={12} fontFamily="'Work Sans',sans-serif"
            fill='rgba(242,238,230,.2)' style={{userSelect:'none',fontStyle:'italic'}}>no accidentals</text>
        )}
        {signs.map(({s,acc},ki)=>(
          <text key={ki} x={clefEndX+ki*11+5} y={yForStep(s)+5} fontSize={Math.round(lineGap*1.6)} fontWeight='900'
            fontFamily="'Work Sans',sans-serif" fill='rgba(242,238,230,.85)' textAnchor='middle'
            style={{userSelect:'none'}}>{acc}</text>
        ))}
      </svg>
    );
  }

  function checkAnswer(){
    if(!key||!answer.trim()) return;
    const raw=answer.trim().toLowerCase();
    const norm=raw.charAt(0).toUpperCase()+raw.slice(1).replace(/\s+major$/i,' major').replace(/\s+minor$/i,' minor');
    const correct=key.aliases.some(a=>a.toLowerCase()===raw||a.toLowerCase()===norm.toLowerCase());
    setResult(correct?'correct':'wrong');
    setScore(s=>({correct:s.correct+(correct?1:0),total:s.total+1}));
    try{const ctx=getCtx();correct?playOK(ctx):playNG(ctx);}catch{}
  }

  const clefLabel=CLEFS.find(c=>c.id===clefId)?.label||'';

  return(
    <><Styles/>
    <div className='et-root screen-enter'>
      <div className='et-hdr'>
        <button className='et-back' onClick={onBack}>← Back</button>
        <div className='et-hdr-mid'><div className='et-mode-label'>𝄢 Key ID</div></div>
        <div className='et-hdr-right' style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:'rgba(156,183,177,.7)',fontFamily:"'Work Sans',sans-serif"}}>
            {score.total>0?`${score.correct}/${score.total}`:''}
          </span>
          <button className='et-icon-btn' onClick={()=>setShowSettings(true)}>⚙</button>
        </div>
      </div>
      <div className='et-scroll'>
        <div key={round} className='et-question' style={{justifyContent:'center',gap:20}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:700,color:'#F2EEE6',marginBottom:4}}>
              Name this key
            </div>
            <div style={{fontSize:12,color:'rgba(156,183,177,.45)',fontStyle:'italic'}}>
              {clefLabel} clef · major key
            </div>
          </div>
          <div style={{opacity:0,animation:'ri_fadeIn .4s ease .1s forwards'}}>
            {key&&<KeyStaff keySemi={key.semi} clefId={clefId}/>}
          </div>
          <AnswerInput
            answer={answer} onChange={setAnswer}
            onCheck={checkAnswer} onNext={()=>setRound(r=>r+1)}
            result={result} correctLabel={key?.name}
            placeholder='e.g. G major, Bb…'
          />
        </div>
      </div>
    </div>
    {showSettings&&<ClefSettings activeClefs={activeClefs} onToggle={toggleClef} onClose={()=>setShowSettings(false)}/>}
    </>
  );
}


export default function App(){
  const[screen,setScreen]        =useState('hub');
  const[initMode,setInitMode]    =useState('intervals');
  const[profile,setProfile]      =useState(null);

  useEffect(()=>{loadProfile().then(p=>{setProfile(p);}).catch(()=>{});},[]);

  if(!profile)return(<><Styles/><div style={{background:'#405147',minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:"'Fraunces',serif",fontSize:18,color:'#9CB7B1',fontStyle:'italic'}}>Loading…</div></div></>);
  if(!profile.welcomed)return(<><Styles/><WelcomeScreen onDone={async(name)=>{const np={...profile,name:name||profile.name,welcomed:true};setProfile(np);await saveProfile(np);}}/></>);

  if(screen==='earTraining')return(
    <EarTraining
      profile={profile} setProfile={setProfile}
      initialMode={initMode}
      onBack={()=>setScreen('hub')}
    />
  );
  if(screen==='transcription')return(
    <Transcription
      profile={profile} setProfile={setProfile}
      onBack={()=>setScreen('hub')}
    />
  );
  if(screen==='melodicDictation')return(
    <MelodicDictation
      profile={profile} setProfile={setProfile}
      onBack={()=>setScreen('hub')}
    />
  );
  if(screen==='noteId')return(<><Styles/><NoteId onBack={()=>setScreen('hub')}/></>);
  if(screen==='keyId') return(<><Styles/><KeyId  onBack={()=>setScreen('hub')}/></>);
  return(<><Styles/><SubjectHub profile={profile} onSelect={(s,m)=>{if(m)setInitMode(m);setScreen(s);}}/></>);
}
