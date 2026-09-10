const TEAMS = [
    { name:"NSG Pythons",           color:"#22eafc" },
    { name:"SBM Eagles",            color:"#ecfd00" },
    { name:"CCS Wizards",           color:"#7d7b80" },
    { name:"ENG'G Warriors",        color:"#970e02" },
    { name:"ARTSCIES Tigers",        color:"#ff4040" },
    { name:"LAW Lady Justices",     color:"#ffe17d" },
    { name:"MED Wolves",            color:"#ffffff" },
    { name:"AGGIES & SOE Colossus", color:"#54e34d" },
];

const SPORTS = [
    { key:"basketball", label:"Basketball", icon:"🏀", scoreType:"pts",  min:48, max:96 },
    { key:"volleyball",  label:"Volleyball", icon:"🏐", scoreType:"sets", min:0, max:3 },
    { key:"futsal",      label:"Futsal",     icon:"⚽", scoreType:"pts",  min:0, max:7 },
    { key:"chess",       label:"Chess",      icon:"♟️", scoreType:"pts",  min:0, max:4 },
    { key:"debate",      label:"Debate",     icon:"🎤", scoreType:"pts",  min:60, max:95 },
    { key:"pickleball",  label:"Pickleball", icon:"🥒", scoreType:"pts",  min:0, max:11 },
    { key:"frisbee",     label:"Frisbee",    icon:"🥏", scoreType:"pts",  min:0, max:15 },
    { key:"cheerdance",  label:"Cheerdance", icon:"💃", scoreType:"pts",  min:70, max:98 },
    { key:"baseball",    label:"Baseball",   icon:"⚾", scoreType:"pts",  min:0, max:11 },
    { key:"tennis",      label:"Tennis",     icon:"🎾", scoreType:"sets", min:0, max:3 },
    { key:"badminton",   label:"Badminton",  icon:"🏸", scoreType:"sets", min:0, max:2 },
    { key:"pingpong",    label:"Ping Pong",  icon:"🏓", scoreType:"sets", min:0, max:3 },
    { key:"softball",    label:"Softball",   icon:"🥎", scoreType:"pts",  min:0, max:9 },
    { key:"megacrew",    label:"Megacrew",   icon:"🕺", scoreType:"pts",  min:70, max:98 },
    { key:"esports",     label:"Esports",    icon:"🎮", scoreType:"sets", min:0, max:2 },
];

const DATES = [10,11,12,13,14,15,16,17,18,19,20]; // October 2026
const TODAY = 10;          // "today"
const NOW_MINUTES = 14*60 + 15; // 2:15 PM — current time for live-game logic
const TIME_SLOTS = ["8:00 AM","10:00 AM","12:30 PM","2:00 PM","4:00 PM","6:00 PM"];
const GAME_DURATION_MIN = 90;

function timeToMinutes(t){
    const [time, mer] = t.split(" ");
    let [h,m] = time.split(":").map(Number);
    if(mer === "PM" && h !== 12) h += 12;
    if(mer === "AM" && h === 12) h = 0;
    return h*60+m;
}

// seeded PRNG so the "made up" schedule is stable across reloads
function mulberry32(seed){
    return function(){
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function seedFor(day, sportKey){
    let s = day * 97;
    for(let i=0;i<sportKey.length;i++) s += sportKey.charCodeAt(i) * (i+3);
    return s;
}

function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
function pickTwoTeams(rng){
    const a = Math.floor(rng()*TEAMS.length);
    let b = Math.floor(rng()*TEAMS.length);
    while(b === a) b = Math.floor(rng()*TEAMS.length);
    return [TEAMS[a], TEAMS[b]];
}
function randInt(rng, min, max){ return Math.floor(rng()*(max-min+1))+min; }

// schedule[day][sportKey] = array of games
const schedule = {};

DATES.forEach(day=>{
    schedule[day] = {};
    const rng = mulberry32(day*1000);
    const sportsToday = [...SPORTS].sort(()=>rng()-0.5).slice(0, 5 + Math.floor(rng()*4));

    sportsToday.forEach(sport=>{
        const srng = mulberry32(seedFor(day, sport.key));
        const numGames = 1 + Math.floor(srng()*2); // 1-2 games
        const slots = [...TIME_SLOTS].sort(()=>srng()-0.5).slice(0, numGames);
        const games = slots.map(time=>{
        const [teamA, teamB] = pickTwoTeams(srng);
        return {
            sportKey: sport.key,
            day, time,
            teamA, teamB,
            finalA: randInt(srng, sport.min, sport.max),
            finalB: randInt(srng, sport.min, sport.max),
            liveA: 0, liveB: 0,
        };
        }).sort((a,b)=> timeToMinutes(a.time)-timeToMinutes(b.time));
        schedule[day][sport.key] = games;
    });
});

// determine live game state at NOW_MINUTES, avoid identical final ties
Object.values(schedule).forEach(daySports=>{
    Object.values(daySports).forEach(games=>{
        games.forEach(g=>{
        if(g.finalA === g.finalB) g.finalB += 1;
        const start = timeToMinutes(g.time);
        const liveRng = mulberry32(start + g.teamA.name.length*7);
        g.liveA = Math.round(g.finalA * (0.4 + liveRng()*0.35));
        g.liveB = Math.round(g.finalB * (0.4 + liveRng()*0.35));
        if(g.liveA === g.liveB) g.liveB += 1;
        });
    });
});

function gameStatus(g){
    if(g.day < TODAY) return "final";
    if(g.day > TODAY) return "upcoming";
    const start = timeToMinutes(g.time);
    if(NOW_MINUTES < start) return "upcoming";
    if(NOW_MINUTES >= start + GAME_DURATION_MIN) return "final";
    return "live";
}

// state
let selectedDay = TODAY;
let selectedSport = null;

// render
const dow = (day)=> new Date(2025,9,day).toLocaleDateString('en-US',{weekday:'short'});

document.getElementById('todayLabel').textContent = `${dow(TODAY)}, Oct ${TODAY}`;

function renderDateStrip(){
    const el = document.getElementById('dateStrip');
    el.innerHTML = "";
    DATES.forEach(day=>{
        const hasGames = Object.keys(schedule[day]).length > 0;
        const pill = document.createElement('div');
        pill.className = 'date-pill' + (hasGames? ' has-games':'') + (day===TODAY? ' is-today':'') + (day===selectedDay? ' selected':'');
        pill.innerHTML = `<div class="dow">${dow(day)}</div><div class="dom">${day}</div><div class="dot"></div>`;
        pill.addEventListener('click', ()=>{
        selectedDay = day;
        selectedSport = firstSportOfDay(day);
        renderAll();
        });
        el.appendChild(pill);
    });
}

function firstSportOfDay(day){
    const keys = Object.keys(schedule[day]);
    return keys.length ? keys[0] : null;
}

function renderSportGrid(){
    const grid = document.getElementById('sportGrid');
    const note = document.getElementById('noSportsNote');
    grid.innerHTML = "";
    const daySchedule = schedule[selectedDay];
    const activeSportKeys = Object.keys(daySchedule);

    if(activeSportKeys.length === 0){
        grid.style.display = 'none';
        note.style.display = 'block';
        return;
    }
    grid.style.display = 'grid';
    note.style.display = 'none';

    SPORTS.filter(s=> activeSportKeys.includes(s.key)).forEach(sport=>{
        const tile = document.createElement('div');
        tile.className = 'sport-tile' + (sport.key===selectedSport? ' selected':'');
        const count = daySchedule[sport.key].length;
        tile.innerHTML = `<div class="icon">${sport.icon}</div><div class="label">${sport.label}</div><div class="count">${count} game${count>1?'s':''}</div>`;
        tile.addEventListener('click', ()=>{
            selectedSport = sport.key;
            renderGames();
            document.querySelectorAll('.sport-tile').forEach(t=>t.classList.remove('selected'));
            tile.classList.add('selected');
        });
        grid.appendChild(tile);
    });
}

function scoreLabel(sport, val){
    return sport.scoreType === 'sets' ? val : val;
}

function renderGames(){
    const list = document.getElementById('gameList');
    const title = document.getElementById('gamesTitle');
    const sub = document.getElementById('gamesSub');
    list.innerHTML = "";

    if(!selectedSport){
        title.textContent = "No sport selected";
        sub.textContent = "";
        return;
    }

    const sport = SPORTS.find(s=>s.key===selectedSport);
    const games = schedule[selectedDay][selectedSport] || [];

    title.textContent = `${sport.icon} ${sport.label.toUpperCase()} — OCT ${selectedDay}`;
    sub.textContent = `${games.length} game${games.length>1?'s':''} scheduled`;

    games.forEach(g=>{
        const status = gameStatus(g);
        const card = document.createElement('div');
        card.className = 'game-card' + (status==='live'? ' is-live':'') + (status==='final'? ' is-final':'');

        let badgeHtml, scoreA, scoreB, note = "", scoreClassA="", scoreClassB="";

        if(status === 'upcoming'){
        badgeHtml = `<span class="badge upcoming">Upcoming</span>`;
        scoreA = "00"; scoreB = "00";
        scoreClassA = "dim"; scoreClassB = "dim";
        note = `<div class="not-started-note">Game hasn't started yet — scheduled ${g.time}</div>`;
        } else if(status === 'live'){
        badgeHtml = `<span class="badge live">● Live</span>`;
        scoreA = g.liveA; scoreB = g.liveB;
        } else {
        badgeHtml = `<span class="badge final">Final</span>`;
        scoreA = g.finalA; scoreB = g.finalB;
        if(g.finalA > g.finalB) scoreClassA = "winner"; else scoreClassB = "winner";
        }

        const winnerA = scoreClassA === 'winner';
        const winnerB = scoreClassB === 'winner';

        card.innerHTML = `
        <div class="game-meta">
            <span>${g.time}</span>
            ${badgeHtml}
        </div>
        <div class="matchup">
            <div class="team">
            <div class="team-dot" style="background:${g.teamA.color}"></div>
            <div class="team-name ${winnerA?'winner':''}">${g.teamA.name}</div>
            </div>
            <div style="display:flex; align-items:center;">
            <div class="score ${scoreClassA}">${scoreA}</div>
            <div class="score-sep">–</div>
            <div class="score ${scoreClassB}">${scoreB}</div>
            </div>
            <div class="team right">
            <div class="team-dot" style="background:${g.teamB.color}"></div>
            <div class="team-name ${winnerB?'winner':''}">${g.teamB.name}</div>
            </div>
        </div>
        ${note}
        `;
        list.appendChild(card);
    });
}

function renderAll(){
    renderDateStrip();
    renderSportGrid();
    renderGames();
}

selectedSport = firstSportOfDay(selectedDay);
renderAll();

setInterval(()=>{ // temp
    let changed = false;
    Object.values(schedule).forEach(daySports=>{
        Object.values(daySports).forEach(games=>{
        games.forEach(g=>{
            if(gameStatus(g)==='live' && Math.random() < 0.3){
            if(Math.random()<0.5 && g.liveA < g.finalA + 3) g.liveA += 1;
            else if(g.liveB < g.finalB + 3) g.liveB += 1;
            changed = true;
            }
        });
        });
    });
    if(changed) renderGames();
}, 4000);