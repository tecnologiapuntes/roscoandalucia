/* Rosco 4D Andalucía · Tecnología Insti · @tecnologiainsti
   Aplicación estática: sin dependencias, sin servidores ni servicios de pago. */
(() => {
  'use strict';
  const LETTERS = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'];
  const BASE_BANK = JSON.parse(JSON.stringify(window.ROSCO_QUESTIONS));
  const installationKey = window.ROSCO_STANDALONE ? '_portable_'+String(window.ROSCO_PORTABLE_ID||'default') : '_v4';
  const KEYS = {bank:'rosco4d_custom_bank'+installationKey,legacy:'rosco4d_custom_bank_v1',game:'rosco4d_saved_game_v46'+installationKey,sound:'rosco4d_sound_v1',pdi:'rosco4d_pdi_v1'};
  const $ = (id) => document.getElementById(id);
  const ordinal = {1:"¡Con salero!",2:"¡Olé tu arte!",3:"¡Aquí hay duende!",4:"¡Quillo, qué nivelazo!"};
  const levelNames = {1:"Para entrar en compás",2:"La cosa se anima",3:"Hay que tener tablas",4:"Para auténticas eminencias"};
  const safeRead = (key) => {try {return JSON.parse(localStorage.getItem(key));} catch {return null;}};
  const safeWrite = (key, value) => {try {localStorage.setItem(key,JSON.stringify(value));} catch { /* almacenamiento privado o desactivado */ }};
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const norm = (s) => String(s ?? '').toLocaleLowerCase('es').replace(/ñ/g,'~n~').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/~n~/g,'ñ').replace(/[^a-z0-9ñ]/gi,'');
  // Una solución o alternativa solo es válida si cumple el tipo de pista (con acentos normalizados).
  const fitsLetter = (mode,letter,answer) => {
    const word=norm(answer), l=norm(letter);
    if(word.length<2 || !l)return false;
    return mode==='starts' ? word.startsWith(l) : word.includes(l);
  };
  // Nunca se admite una abreviatura que sea prefijo estricto de la respuesta principal.
  const incompleteAlias = (alias,answer) => {const a=norm(alias),b=norm(answer);return a.length<3 || (a!==b && b.startsWith(a));};
  const testLetter = (q) => fitsLetter(q.mode,q.letter,q.answer);
  const validEntry = (q,l) => q && q.letter===l && ['starts','contains'].includes(q.mode) && typeof q.answer==='string' && testLetter(q) && typeof q.clue==='string' && q.clue.trim() && typeof q.fact==='string' && Array.isArray(q.aliases) && q.aliases.every(v => typeof v==='string' && !incompleteAlias(v,q.answer) && fitsLetter(q.mode,q.letter,v));
  // Conserva las ediciones guardadas de versiones anteriores; solo descarta alternativas inválidas.
  const cleanAliases = (data) => {
    if(data && typeof data==='object')for(const l of [1,2,3,4]){
      const group=data[l];
      // Compatible tanto con el banco anterior de un solo equipo como con el nuevo doble.
      const lists=Array.isArray(group)?[group]:['green','white'].map(t=>group?.[t]).filter(Array.isArray);
      for(const list of lists)for(const q of list){
        if(q && Array.isArray(q.aliases))q.aliases=q.aliases.filter(a=>typeof a==='string' && !incompleteAlias(a,q.answer) && fitsLetter(q.mode,q.letter,a));
      }
    }
    return data;
  };
  const differentTeams = (data, level) => {
    const green=data[level].green,white=data[level].white;
    const answers=new Set(green.map(q=>norm(q.answer)));
    return white.every(q=>!answers.has(norm(q.answer)));
  };
  const validBank = (data) => !!data && typeof data==='object' && [1,2,3,4].every(level =>
    data[level] && ['green','white'].every(team => Array.isArray(data[level][team]) && data[level][team].length===27 &&
      data[level][team].every((q,i)=>validEntry(q,LETTERS[i]))) && differentTeams(data,level));
  const validOldBank = (data) => data && [1,2,3,4].every(l=>Array.isArray(data[l]) && data[l].length===27 && data[l].every((q,i)=>validEntry(q,LETTERS[i])));
  let bank = cleanAliases(safeRead(KEYS.bank));
  if (validBank(bank)) safeWrite(KEYS.bank,bank);
  if (!validBank(bank)) {
    bank=clone(BASE_BANK);
    const legacy=window.ROSCO_STANDALONE ? null : safeRead(KEYS.legacy);
    if (validOldBank(legacy)) {
      for(const level of [1,2,3,4]) bank[level].green=cleanAliases(clone(legacy[level]));
      if(validBank(bank))safeWrite(KEYS.bank,bank);
      else bank=clone(BASE_BANK);
    }
  }
  let selectedLevel='1'; let selectedMode='solo'; let selectedSoloBank='green'; let duration=300;
  let selectedStartingTeam=0;let selectedTeamNames=['Equipo A','Equipo B'];let pdiMode=safeRead(KEYS.pdi)===true;
  let game=null; let timerInterval=null; let lastTick=0; let lastPersist=0;
  let muted=safeRead(KEYS.sound)===false; let audioContext=null; let toastTimeout=null; let confirmCallback=null;
  let editorSelection=null; let editorDirty=false;

  // V5.2 · Sin síntesis de voz. Los avisos de tiempo siguen siendo opcionales.
  let alertsEnabled=safeRead('rosco4d_time_alerts_v51')!==false;
  let presenterMode=false;
  function initializeExtrasUI(){
    $('timeAlertsSelect').checked=alertsEnabled;
    $('timeAlertsSelect').addEventListener('change',()=>{
      alertsEnabled=$('timeAlertsSelect').checked;
      safeWrite('rosco4d_time_alerts_v51',alertsEnabled);
    });
    $('presenterButton').addEventListener('click',togglePresenter);
    $('presenterRevealButton').addEventListener('click',reveal);
  }
  function togglePresenter(){
    presenterMode=!presenterMode;document.body.classList.toggle('presenter-mode',presenterMode);
    $('presenterButton').setAttribute('aria-pressed',String(presenterMode));
    $('presenterButton').textContent=presenterMode?'Vista normal':'🖥️ Modo presentador';
  }
  function alertTime(team,left){
    if(!game||!game.duration||!alertsEnabled||game.phase!=='running')return;
    if(!Array.isArray(game.timeAlerts))game.timeAlerts=[[false,false],[false,false]];
    const flags=game.timeAlerts[team] ||= [false,false];
    if(left<=30000 && left>0 && !flags[0]){flags[0]=true;sound('warning');notify(`Quedan 30 segundos para ${game.mode==='duel'?teamName(team):'la clase'}.`);}
    if(left<=10000 && left>0 && !flags[1]){flags[1]=true;sound('warning');notify(`¡Últimos 10 segundos para ${game.mode==='duel'?teamName(team):'la clase'}!`);}
  }

  const screens={setup:$('setupScreen'),game:$('gameScreen'),end:$('endScreen')};

  function showScreen(name) {Object.entries(screens).forEach(([k,v]) => v.classList.toggle('is-hidden',k!==name));window.scrollTo({top:0,behavior:'instant'});}
  function notify(message) {const el=$('toast'); el.textContent=message;el.classList.remove('is-hidden');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.add('is-hidden'),2800);}
  function openDialog(id) {$(id).showModal();}
  function closeDialog(id) {$(id).close();}
  function ask(title,message,fn){$('confirmHeading').textContent=title;$('confirmBody').textContent=message;confirmCallback=fn;openDialog('confirmDialog');}
  function snapshotForUndo(action){
    if(!game || game.phase!=='running')return;
    const previous=clone(game);delete previous.undo;
    game.undo={action,previous};
  }
  function renderUndo(){
    const available=!!game?.undo;
    $('undoButton').disabled=!available;
    $('endUndoButton').disabled=!available;
    $('undoButton').title=available?`Deshacer: ${game.undo.action}`:'Todavía no hay acciones que deshacer';
  }
  function undoLast(){
    if(!game?.undo)return;
    const action=game.undo.action;
    const wasFinished=game.phase==='finished';
    game=clone(game.undo.previous);
    delete game.undo;
    lastTick=performance.now();lastPersist=lastTick;
    if(!$('endScreen').classList.contains('is-hidden'))showScreen('game');
    renderAll();if(wasFinished)startTimer();saveGame();if(game.phase==='running')
    notify(`Se ha deshecho «${action}»: letra, puntuación y turno restaurados.`);
  }
  function saveGame(){if(game && game.phase!=='finished')safeWrite(KEYS.game,game);}
  function clearSavedGame(){try{localStorage.removeItem(KEYS.game);}catch{} }
  function getSavedGame(){
    const data=safeRead(KEYS.game);
    if(!data || ![1,2,3,4].includes(Number(data.level)) || !data.questions || !['green','white'].every(t=>Array.isArray(data.questions[t]) && data.questions[t].length===27 && data.questions[t].every((q,i)=>validEntry(q,LETTERS[i]))) ||
       !['running','feedback'].includes(data.phase) || !['solo','duel'].includes(data.mode) || typeof data.duration!=='number' || !['green','white'].includes(data.soloBank))return null;
    if(data.mode==='duel'){
      if(!Array.isArray(data.teamRemainingMs) || data.teamRemainingMs.length!==2 || !data.teamRemainingMs.every(n=>Number.isFinite(n)&&n>=0) ||
         !Array.isArray(data.teamNames) || data.teamNames.length!==2 ||
         !Array.isArray(data.teamStatuses) || data.teamStatuses.length!==2 ||
         !data.teamStatuses.every(a=>Array.isArray(a) && a.length===27 && a.every(v=>['pending','correct','wrong'].includes(v))) ||
         !Array.isArray(data.teamCursors) || data.teamCursors.length!==2 ||
         !data.teamCursors.every(n=>Number.isInteger(n) && n>=-1 && n<27) ||
         ![0,1].includes(data.activeTeam))return null;
    }else if(!Array.isArray(data.statuses) || data.statuses.length!==27)return null;
    if(!Array.isArray(data.wildcardsUsed) || data.wildcardsUsed.length!==2 || !Array.isArray(data.hints)||data.hints.length!==2)return null;
    return data;
  }
  function updateResume(){
    const saved=getSavedGame();$('resumeBanner').classList.toggle('is-hidden',!saved);
    if(saved){
      const hits=saved.mode==='duel' ? saved.teamStatuses.reduce((sum,states)=>sum+states.filter(x=>x==='correct').length,0) : saved.statuses.filter(x=>x==='correct').length;
      $('resumeBanner').querySelector('span').textContent=`Partida guardada: ${ordinal[saved.level]} · ${hits} aciertos · ${saved.mode==='duel'?'2 equipos, roscos independientes':'clase completa'}.`;
    }
  }
  function chooseLevel(value){selectedLevel=value;document.querySelectorAll('.level-card').forEach(btn=>{const active=btn.dataset.level===value;btn.classList.toggle('is-selected',active);btn.setAttribute('aria-pressed',String(active));});}
  function chooseMode(value){selectedMode=value;document.querySelectorAll('#modeOptions button').forEach(btn=>{const active=btn.dataset.mode===value;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});$('soloBankRow').classList.toggle('is-hidden',value==='duel');$('duelSetup').classList.toggle('is-hidden',value!=='duel');}
  function enterNames(){selectedTeamNames=[$('nameGreen').value.trim().slice(0,26)||'Equipo A',$('nameWhite').value.trim().slice(0,26)||'Equipo B'];return selectedTeamNames;}
  function drawTeam(){enterNames();selectedStartingTeam=Math.random()<.5?0:1;$('drawResult').textContent=`🎉 ¡Empieza ${selectedTeamNames[selectedStartingTeam]}!`;$('drawResult').classList.remove('is-hidden');}
  function togglePdi(){pdiMode=!pdiMode;document.body.classList.toggle('pdi-mode',pdiMode);$('pdiButton').setAttribute('aria-pressed',String(pdiMode));$('pdiButton').textContent=pdiMode?'Vista normal':'Modo PDI';safeWrite(KEYS.pdi,pdiMode);}
  function makePreview(){const container=$('previewOrbit');LETTERS.forEach((letter,i)=>{const theta=(i/27)*Math.PI*2-Math.PI/2;const el=document.createElement('span');el.className='preview-letter';el.textContent=letter;el.style.left=`${50+60*Math.cos(theta)}%`;el.style.top=`${50+60*Math.sin(theta)}%`;container.append(el);});}
  function initWheel(){const target=$('roscoLetters'); target.replaceChildren(); LETTERS.forEach((letter,i)=>{const theta=(i/27)*Math.PI*2-Math.PI/2;const btn=document.createElement('button');btn.type='button';btn.className='letter-btn';btn.textContent=letter;btn.setAttribute('aria-label',`Letra ${letter}`);btn.dataset.index=String(i);btn.style.left=`${50+43.3*Math.cos(theta)}%`;btn.style.top=`${50+43.3*Math.sin(theta)}%`;btn.addEventListener('click',()=>jumpTo(i));target.append(btn);});}
  function initGame(){
    game={level:Number(selectedLevel),mode:selectedMode,duration,remainingMs:duration*1000,phase:'running',paused:false,
      cursor:0,activeTeam:selectedMode==='duel'?selectedStartingTeam:0,teamScores:[0,0],teamNames:enterNames(),
      teamRemainingMs:[duration*1000,duration*1000],
      statuses:LETTERS.map(()=> 'pending'),
      teamStatuses:[LETTERS.map(()=> 'pending'),LETTERS.map(()=> 'pending')],
      teamCursors:[0,0],passes:0,soloBank:selectedSoloBank,questions:clone(bank[selectedLevel]),
      wildcardsUsed:[{mijita:false,cable:false},{mijita:false,cable:false}],hints:[{},{}],
      feedback:null,feedbackCursor:null,feedbackTeam:null,
      timeAlerts:[[false,false],[false,false]],startedAt:new Date().toISOString(),reason:''};
    clearSavedGame();if(game.mode==='duel' && game.activeTeam===1)game.cursor=0;launchGame();
  }
  function launchGame(){if(!game)return;$('gameLevelChip').textContent=`${ordinal[game.level]}`;$('gameModeChip').textContent=game.mode==='duel'?'DUELO · 2 EQUIPOS':`CLASE · BANCO ${game.soloBank==='green'?'VERDE':'BLANCO'}`;$('teamsRow').classList.toggle('is-hidden',game.mode!=='duel');$('duelHud').classList.toggle('is-hidden',game.mode!=='duel');showScreen('game');renderAll();lastTick=performance.now();startTimer();saveGame();}
  function startTimer(){
    stopTimer();lastTick=performance.now();
    timerInterval=setInterval(()=>{
      const now=performance.now(),delta=Math.max(0,Math.min(1200,now-lastTick));lastTick=now;
      if(!game||game.duration===0||game.phase!=='running'||game.paused)return;
      if(game.mode==='duel'){
        const team=game.activeTeam;
        game.teamRemainingMs[team]=Math.max(0,game.teamRemainingMs[team]-delta);
        alertTime(team,game.teamRemainingMs[team]);
        if(game.teamRemainingMs[team]===0){
          sound('pass');
          if(canPlay(1-team)){
            switchTeam();renderAll();saveGame();notify(`¡Tiempo agotado para ${teamName(team)}! Juega ${teamName(game.activeTeam)}.`);
          } else finishGame('timeout');
          return;
        }
      }else{
        game.remainingMs=Math.max(0,game.remainingMs-delta);
        alertTime(0,game.remainingMs);
        if(game.remainingMs===0){finishGame('timeout');return;}
      }
      renderTimer();
      if(now-lastPersist>2000){saveGame();lastPersist=now;}
    },160);
  }
  function stopTimer(){if(timerInterval!==null){clearInterval(timerInterval);timerInterval=null;}}
  function timeLabel(ms){if(!game || !game.duration)return '∞';const seconds=Math.ceil(Math.max(0,ms)/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
  function timeLeft(team=game.activeTeam){return game.mode==='duel'?game.teamRemainingMs[team]:game.remainingMs;}
  function renderTimer(){
    const display=$('timerDisplay'), left=timeLeft();
    $('timeValue').textContent=timeLabel(left);
    $('timeFlash').classList.toggle('is-hidden',!game.duration || left>10000 || left===0 || game.phase!=='running');
    display.classList.toggle('time-warning',!!game.duration && left<=60000 && left>20000);
    display.classList.toggle('time-critical',!!game.duration && left<=20000);
    $('pauseButton').disabled=game.phase==='feedback';
    $('pauseButton').innerHTML=game.paused?'<svg><use href="#i-play"/></svg><span>Reanudar</span>':'<svg><use href="#i-pause"/></svg><span>Pausar</span>';
    $('teamOneTimer').textContent=timeLabel(game.teamRemainingMs[0]);
    $('teamTwoTimer').textContent=timeLabel(game.teamRemainingMs[1]);
    $('hudGreenTimer').textContent=timeLabel(game.teamRemainingMs[0]);$('hudWhiteTimer').textContent=timeLabel(game.teamRemainingMs[1]);
    $('hudGreenName').textContent='A · '+teamName(0);$('hudWhiteName').textContent='B · '+teamName(1);
    $('hudGreenScore').textContent=game.teamScores[0];$('hudWhiteScore').textContent=game.teamScores[1];
    $('timerDisplay').setAttribute('aria-label',game.mode==='duel'?`Tiempo de ${teamName(game.activeTeam)}`:'Tiempo de clase');
  }
  // Cada equipo conserva SUS 27 estados y SU letra actual. La rueda visible es la del equipo en turno.
  function statusesFor(team=game.activeTeam){return game.mode==='duel' ? game.teamStatuses[team] : game.statuses;}
  function teamKey(team=game.activeTeam){return game.mode==='duel'?(team===0?'green':'white'):game.soloBank;}
  function questionFor(index,team=game.activeTeam){return game.questions[teamKey(team)][index];}
  function remaining(team=game.activeTeam){return statusesFor(team).filter(v=>v==='pending').length;}
  function canPlay(team){return remaining(team)>0 && (game.duration===0 || game.teamRemainingMs[team]>0);}
  function allDone(){return game.mode==='duel' ? !canPlay(0) && !canPlay(1) : remaining()===0;}
  function setCursor(index){game.cursor=index;if(game.mode==='duel')game.teamCursors[game.activeTeam]=index;}
  function switchTeam(){
    if(game.mode!=='duel')return;
    const other=1-game.activeTeam;
    // Si el contrincante terminó su rosco, no se le vuelve a dar un turno vacío.
    if(canPlay(other))game.activeTeam=other;
    if(canPlay(game.activeTeam)){
      let index=game.teamCursors[game.activeTeam];
      if(!Number.isInteger(index) || index<0 || statusesFor()[index]!=='pending')index=nextPending((index+26)%27);
      setCursor(index);
    }
  }
  function nextPending(from,team=game.activeTeam){
    const statuses=statusesFor(team);
    for(let offset=1;offset<=27;offset++){
      const idx=(from+offset)%27;
      if(statuses[idx]==='pending')return idx;
    }
    return -1;
  }
  function jumpTo(index){
    if(!game || game.phase==='finished')return;
    if(game.phase==='feedback'){notify('Primero pulsa «Siguiente letra».');return;}
    if(statusesFor()[index]!=='pending'){notify('Esa letra ya está respondida para este equipo.');return;}
    setCursor(index);renderAll();saveGame();
  }
  function renderAll(){if(!game)return;renderWheel();renderQuestion();renderScoreboard();renderTimer();renderTurnIndicator();renderUndo();}
  function renderWheel(){
    const states=statusesFor(visibleTeam() ?? game.activeTeam);let correct=0;
    document.querySelectorAll('.letter-btn').forEach((btn,i)=>{
      const status=states[i];
      btn.classList.toggle('is-current',i===game.cursor && game.phase!=='finished' && status==='pending');
      btn.classList.toggle('is-correct',status==='correct');
      btn.classList.toggle('is-wrong',status==='wrong');
      btn.setAttribute('aria-label',`${LETTERS[i]}: ${status==='correct'?'acierto':status==='wrong'?'fallo':i===game.cursor?'pregunta actual':'pendiente'}${game.mode==='duel' ? ' de '+teamName(game.activeTeam) : ''}`);
      if(status==='correct')correct++;
    });
    $('coreCorrect').textContent=correct;
  }
  // V4.8: el equipo que aparece en la pregunta es el que determina el color.
  // Tras un fallo, la explicación todavía pertenece al equipo anterior:
  // el aviso anticipa quién jugará al pulsar «Siguiente letra».
  function visibleTeam(){
    if(!game || game.mode!=='duel')return null;
    return game.phase==='feedback' && [0,1].includes(game.feedbackTeam) ? game.feedbackTeam : game.activeTeam;
  }
  function renderTurnIndicator(){
    const duel=game.mode==='duel';
    $('turnBanner').classList.toggle('is-hidden',!duel);
    $('gameScreen').dataset.turnTeam=duel?(visibleTeam()===0?'a':'b'):'solo';
    $('duelHud').setAttribute('aria-label',duel?'Marcadores y cronómetros. Equipo activo: '+(visibleTeam()===0?'A':'B'):'Marcadores');
    $('hudGreen').classList.toggle('is-playing',duel && visibleTeam()===0);
    $('hudWhite').classList.toggle('is-playing',duel && visibleTeam()===1);
    if(!duel){$('coreTeamLabel').textContent='ROSCO';return;}
    const team=visibleTeam(), letter=team===0?'A':'B';
    $('turnTeamLetter').textContent=letter;
    $('turnTeamName').textContent=teamName(team);
    $('coreTeamLabel').textContent='EQUIPO '+letter;
    const feedback=game.phase==='feedback';
    $('turnKicker').textContent=feedback?'RESPUESTA DEL EQUIPO '+letter:'AHORA JUEGA · EQUIPO '+letter;
    const next=feedback && game.activeTeam!==team;
    $('turnNext').classList.toggle('is-hidden',!next);
    $('turnNext').textContent=next?'DESPUÉS: EQUIPO '+(game.activeTeam===0?'A':'B')+' · '+teamName(game.activeTeam):'';
    $('teamOne').classList.toggle('active',team===0);
    $('teamTwo').classList.toggle('active',team===1);
    $('hudGreenName').textContent='A · '+teamName(0);
    $('hudWhiteName').textContent='B · '+teamName(1);
  }
  function teamName(team){return game?.teamNames?.[team] || selectedTeamNames[team] || (team===0?'Equipo A':'Equipo B');}
  function renderQuestion(){
    const inFeedback=game.phase==='feedback';
    const index=inFeedback ? (game.feedbackCursor??game.cursor) : game.cursor;
    const q=questionFor(index,inFeedback ? game.feedbackTeam : game.activeTeam);
    $('questionCounter').textContent=`LETRA ${index+1} DE 27 · ${ordinal[game.level]}`;
    $('gameTitle').textContent=game.mode==='duel'
      ? (inFeedback ? `Respuesta · Equipo ${game.feedbackTeam===0?'A':'B'}` : `Turno · Equipo ${game.activeTeam===0?'A':'B'}`)
      : levelNames[game.level];
    $('letterMini').textContent=q.letter;
    $('letterRule').textContent=q.mode==='starts'?`EMPIEZA POR LA ${q.letter}`:`CONTIENE LA ${q.letter}`;
    $('questionText').textContent=q.clue;
    renderHints();
    $('answerInput').disabled=inFeedback || game.paused;
    $('checkInputButton').disabled=inFeedback || game.paused;
    $('correctButton').disabled=game.paused || (!inFeedback && $('answerInput').value.trim().length>0);
    $('wrongButton').disabled=game.paused;
    $('passButton').disabled=game.paused;
    $('questionActions').classList.toggle('is-hidden',inFeedback);
    $('nextActions').classList.toggle('is-hidden',!inFeedback);
    $('answerInput').closest('.answer-input-block').classList.toggle('is-hidden',inFeedback);
    $('answerValidation').textContent='';$('answerValidation').classList.add('is-hidden');$('answerInput').removeAttribute('aria-invalid');
    $('revealButton').classList.toggle('is-hidden',inFeedback);
    $('revealCard').classList.add('is-hidden');$('answerInput').value='';
    $('feedbackCard').classList.toggle('is-hidden',!inFeedback);
    if(inFeedback){
      const correct=game.feedback==='correct';
      $('feedbackCard').classList.toggle('is-wrong',!correct);
      $('feedbackIcon').textContent=correct?'✓':'×';
      $('feedbackTitle').textContent=correct
        ? (game.mode==='duel'?`¡Correcto! Sigue ${teamName(game.activeTeam)}`:'¡Respuesta correcta!')
        : (game.mode==='duel'?`Fallo · ahora juega ${teamName(game.activeTeam)}`:'¡Seguimos aprendiendo!');
      $('feedbackAnswer').textContent=`Respuesta: ${q.answer}`;
      $('feedbackFact').textContent=q.fact;
      $('feedbackAttempt').textContent=game.feedbackSource==='typed' ? `Has escrito: «${game.feedbackInput||''}».` : 'Respuesta marcada por el docente (oral).';
      $('nextButton').textContent='';
      $('nextButton').textContent=game.mode==='duel' && !correct ? `Continuar con ${teamName(game.activeTeam)} →` : 'Siguiente letra →';
    }
  }
  function renderScoreboard(){
    const states=statusesFor(visibleTeam() ?? game.activeTeam);
    const c=states.filter(v=>v==='correct').length,w=states.filter(v=>v==='wrong').length,p=27-c-w;
    $('scoreCorrect').textContent=c;$('scoreWrong').textContent=w;$('scorePending').textContent=p;
    $('progressCorrect').style.width=`${c/27*100}%`;$('progressWrong').style.width=`${w/27*100}%`;
    $('progressLabel').textContent=game.mode==='duel'?`PROGRESO DEL EQUIPO ${visibleTeam()===0?'A':'B'} · ${teamName(visibleTeam()).toUpperCase()}`:'PROGRESO DEL ROSCO';
    $('teamOneScore').textContent=game.teamScores[0];$('teamTwoScore').textContent=game.teamScores[1];
    $('teamNameOne').textContent=teamName(0);$('teamNameTwo').textContent=teamName(1);
    $('teamOne').classList.toggle('active',game.activeTeam===0);
    $('teamTwo').classList.toggle('active',game.activeTeam===1);
    $('teamOneProgress').textContent=game.mode==='duel'?`${27-remaining(0)}/27 letras`:'';
    $('teamTwoProgress').textContent=game.mode==='duel'?`${27-remaining(1)}/27 letras`:'';
  }
  function mark(status,source='teacher',typedText=''){
    if(source==='teacher' && status==='correct' && $('answerInput').value.trim()){
      $('answerValidation').textContent='Hay texto escrito: pulsa «Comprobar» o bórralo para corregir una respuesta oral.';
      $('answerValidation').classList.remove('is-hidden');return;
    }
    if(!game || game.phase!=='running' || game.paused)return;
    const oldTeam=game.activeTeam, oldIndex=game.cursor;
    if(statusesFor()[oldIndex]!=='pending')return;
    snapshotForUndo(status==='correct'?'Acierto':'Fallo');
    statusesFor()[oldIndex]=status;
    if(status==='correct')game.teamScores[oldTeam]++;
    game.feedback=status;game.feedbackCursor=oldIndex;game.feedbackTeam=oldTeam;
    game.feedbackSource=source;game.feedbackInput=source==='typed'?typedText:'';
    if(game.mode==='duel'){
      // Al responder, este equipo queda preparado para continuar en SU siguiente letra.
      game.teamCursors[oldTeam]=nextPending(oldIndex,oldTeam);
      if(status==='wrong')switchTeam();
    }
    game.phase='feedback';sound(status==='correct'?'correct':'wrong');renderAll();saveGame();
  }
  function pass(){
    if(!game || game.phase!=='running' || game.paused)return;
    snapshotForUndo('Pasapalabra');
    game.passes++;
    const nextIndex=nextPending(game.cursor);
    if(game.mode==='duel'){
      // Pasapalabra conserva la letra sin responder, pero el equipo retoma en la siguiente pendiente.
      game.teamCursors[game.activeTeam]=nextIndex;
      switchTeam(); // El otro equipo usa su propio cursor, inicialmente A.
    }else if(nextIndex>=0)setCursor(nextIndex);
    sound('pass');renderAll();saveGame();
  }
  function next(){
    if(!game || game.phase!=='feedback')return;
    if(allDone()){finishGame('completed');return;}
    if(game.mode==='duel'){
      // En acierto continúa el mismo equipo. En fallo el otro equipo ya quedó activado.
      if(game.feedback==='correct'){
        const active=game.activeTeam;
        if(canPlay(active))setCursor(game.teamCursors[active]);
        else switchTeam();
      }
      // Si el jugador entrante había terminado, vuelve al único equipo con pendientes.
      if(!canPlay(game.activeTeam))switchTeam();
    }else setCursor(nextPending(game.cursor));
    game.phase='running';game.feedback=null;game.feedbackCursor=null;game.feedbackTeam=null;
    renderAll();saveGame();
  }
  // V4.8: igualdad exacta con solución o alternativas completas que respetan la letra.
  function matchesFullAnswer(question, rawInput){
    const typed=norm(rawInput);
    if(!question || typed.length<2)return false;
    const candidates=[question.answer,...(Array.isArray(question.aliases)?question.aliases:[])];
    return candidates.some(candidate=>{
      const full=norm(candidate);
      return full.length>=2 && (full===norm(question.answer) || !incompleteAlias(candidate,question.answer)) && fitsLetter(question.mode,question.letter,candidate) && typed===full;
    });
  }
  function checkTyped(){
    if(!game || game.phase!=='running' || game.paused)return;
    const text=$('answerInput').value.trim();
    const typed=norm(text);
    if(typed.length<2){
      // Ni un acierto ni un fallo: la entrada no es una respuesta (ej. «A» o «Q»).
      $('answerInput').setAttribute('aria-invalid','true');
      $('answerValidation').textContent=typed.length===0
        ? 'Escribe la palabra o expresión completa antes de comprobar.'
        : `«${text}» es una respuesta incompleta. Escribe la palabra entera: una sola letra nunca puntúa.`;
      $('answerValidation').classList.remove('is-hidden');
      return;
    }
    const question=questionFor(game.cursor);
    mark(matchesFullAnswer(question,text)?'correct':'wrong','typed',text);
  }
  function currentHintKey(){return String(game.cursor);}
  function renderHints(){
    if(!game)return;
    const team=game.mode==='duel'?game.activeTeam:0;
    const key=game.phase==='feedback'?String(game.feedbackCursor):currentHintKey();
    const messages=game.hints?.[team]?.[key] || [];
    $('wildcardHint').textContent=messages.join('  ·  ');
    $('wildcardHint').classList.toggle('is-hidden',messages.length===0 || game.phase==='feedback');
    const used=game.wildcardsUsed?.[team]||{};
    for(const type of ['mijita','cable']){
      const el=$(type==='mijita'?'hintMijita':'hintCable');
      el.disabled=!!used[type] || game.phase!=='running'||game.paused;
      el.textContent=(type==='mijita'?'🌿 ¡Una mijita!':'💡 ¡Échame un cable!')+(used[type]?' · Usado':' · 1 disponible');
    }
  }
  function useWildcard(type){
    if(!game||game.phase!=='running'||game.paused)return;
    const team=game.mode==='duel'?game.activeTeam:0;
    if(game.wildcardsUsed[team][type])return;
    const answer=questionFor(game.cursor).answer;
    const letters=Array.from(answer).filter(ch=>/[a-záéíóúüñ]/i.test(ch));
    const length=letters.length;
    const clue=type==='mijita'
       ? (length>=4?`¡Una mijita!: la segunda letra es «${letters[1].toUpperCase()}».`:`¡Una mijita!: la respuesta tiene ${length} letras.`)
       : (length>=4?`¡Échame un cable!: tiene ${length} letras y termina en «${letters[length-1].toUpperCase()}».`:`¡Échame un cable!: la respuesta tiene ${length} letras.`);
    game.wildcardsUsed[team][type]=true;
    (game.hints[team][currentHintKey()] ||= []).push(clue);
    renderHints();saveGame();sound('pass');
  }
  function reveal(){if(!game || game.phase!=='running')return;const visible=!$('revealCard').classList.contains('is-hidden');$('revealCard').classList.toggle('is-hidden',visible);$('revealAnswer').textContent=questionFor(game.cursor).answer;$('revealButton').textContent=visible?'Ver solución':'Ocultar solución';if(visible){$('revealButton').innerHTML='<svg><use href="#i-eye"/></svg> Ver solución';}}
  function togglePause(){if(!game || game.phase!=='running')return;game.paused=!game.paused;lastTick=performance.now();renderTimer();renderQuestion();saveGame();notify(game.paused?'Partida en pausa.':'¡Reanudamos!');}
  function makeConfetti(){const target=$('confetti');target.replaceChildren();for(let i=0;i<52;i++){
    const piece=document.createElement('i');piece.style.left=`${(i*73)%100}%`;piece.style.animationDelay=`-${(i*0.17)%4}s`;
    piece.style.animationDuration=`${3.3+(i%7)*.43}s`;piece.style.background=['#1da565','#fff7c2','#d4edb7','#f9f9fa'][i%4];target.append(piece);
  }}
  function printDiploma(){if(!game||game.mode!=='duel')return;
    const [a,b]=game.teamScores, winner=a===b?'Ambos equipos':teamName(a>b?0:1);
    const page=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Diploma Rosco 4D</title><style>body{font-family:system-ui;text-align:center;padding:50px;border:16px double #15955b;color:#164a33}h1{font-size:55px;margin:35px 0 0}h2{font-size:38px}p{font-size:22px}strong{color:#067747}@page{size:A4 landscape;margin:14mm}</style></head><body><p>@tecnologiainsti · DÍA DE LA BANDERA DE ANDALUCÍA</p><h1>🏆 DIPLOMA 4D</h1><p>Se reconoce a</p><h2>${escapeHTML(winner)}</h2><p>por su participación en <strong>ROSCO 4D ANDALUCÍA</strong></p><p>${escapeHTML(ordinal[game.level])} · ${a} / ${b} aciertos</p><p>¡Con conocimiento, alegría y mucho arte!</p><p>________________________ · Docente</p></body></html>`;
    const w=window.open('','_blank');if(!w){notify('Permite ventanas emergentes para imprimir el diploma.');return;}w.document.open();w.document.write(page);w.document.close();w.focus();w.print();
  }
  function renderErrorReview(){
    const details=$('errorReview'), list=$('errorReviewList'), summary=$('errorReviewSummary');
    list.replaceChildren();details.open=false;
    const teams=game.mode==='duel'?[0,1]:[0];
    const counts=teams.map(t=>{
      const wrong=statusesFor(t).map((s,i)=>s==='wrong'?i:-1).filter(i=>i>=0);
      return {team:t, wrong};
    });
    const total=counts.reduce((n,r)=>n+r.wrong.length,0);
    summary.textContent=`📖 Repasar ${total} pregunta${total===1?'':'s'} fallada${total===1?'':'s'} · desplegar`;
    if(!total){
      const p=document.createElement('p');p.className='review-empty';p.textContent='¡Sin errores! No hay preguntas falladas que repasar.';list.append(p);return;
    }
    for(const group of counts){
      if(game.mode==='duel'){
        const head=document.createElement('h3');head.className='review-team-head';
        head.textContent=`Equipo ${group.team===0?'A':'B'} · ${teamName(group.team)} · ${group.wrong.length} fallos`;
        list.append(head);
      }
      for(const index of group.wrong){
        const q=questionFor(index,group.team);
        const article=document.createElement('article');article.className='review-item';
        const title=document.createElement('p');title.className='review-title';
        title.textContent=`Letra ${q.letter} · ${q.mode==='starts'?'Empieza por':'Contiene la'} ${q.letter}`;
        const clue=document.createElement('p');clue.className='review-clue';clue.textContent=q.clue;
        const answer=document.createElement('p');answer.className='review-answer';answer.textContent=`Respuesta: ${q.answer}`;
        const fact=document.createElement('p');fact.className='review-fact';fact.textContent=q.fact||'';
        article.append(title,clue,answer,fact);list.append(article);
      }
    }
  }
  let previewTeam='green';
  function renderPreview(){
    const dual=selectedMode==='duel';
    $('previewTabs').classList.toggle('is-hidden',!dual);
    const level=Number(selectedLevel), team=dual?previewTeam:selectedSoloBank;
    $('previewTitle').textContent=`Vista previa · ${ordinal[level]}`;
    $('previewIntro').textContent=`${dual?'Duelo: 27 preguntas diferentes para cada equipo':'Clase completa: 27 preguntas'} · ${team==='green'?'Equipo A (verde)':'Equipo B (azul)'}. Las soluciones no se muestran.`;
    document.querySelectorAll('[data-preview-team]').forEach(btn=>{
      const selected=btn.dataset.previewTeam===team;btn.setAttribute('aria-pressed',String(selected));
    });
    const target=$('previewList');target.replaceChildren();
    for(const q of bank[level][team]){
      const article=document.createElement('article');article.className='preview-item';
      const letter=document.createElement('span');letter.className='preview-item-letter';letter.textContent=q.letter;
      const info=document.createElement('div');const rule=document.createElement('small');
      rule.textContent=`${q.mode==='starts'?'EMPIEZA POR':'CONTIENE LA'} ${q.letter}`;
      const clue=document.createElement('p');clue.textContent=q.clue;
      info.append(rule,clue);article.append(letter,info);target.append(article);
    }
  }
  function openPreview(){previewTeam=selectedMode==='duel'?'green':selectedSoloBank;renderPreview();openDialog('previewDialog');}
  function finishGame(reason){
    if(!game)return;
    stopTimer();game.phase='finished';game.reason=reason;clearSavedGame();
    $('endTitle').textContent=reason==='timeout'?'¡Tiempo cumplido!':'¡Rosco completado!';
    $('endSubtitle').textContent=reason==='timeout'?'Se acabó el tiempo. ¡Lo importante es todo lo aprendido!':'Habéis recorrido Andalucía, su historia, sus símbolos y sus tradiciones.';
    const arrays=game.mode==='duel'?game.teamStatuses:[game.statuses];
    const c=arrays.reduce((sum,a)=>sum+a.filter(s=>s==='correct').length,0);
    const w=arrays.reduce((sum,a)=>sum+a.filter(s=>s==='wrong').length,0);
    $('endCorrect').textContent=c;$('endWrong').textContent=w;
    $('endPending').textContent=arrays.length*27-c-w;$('endCourse').textContent=ordinal[game.level];
    $('endTeamSummary').classList.toggle('is-hidden',game.mode!=='duel');
    if(game.mode==='duel'){
      const [a,b]=game.teamScores;
      const winner=a===b?'¡Empate! Gran trabajo de ambos equipos.':`¡Gana el equipo ${a>b?'verde':'blanco'}!`;
      $('endTeamSummary').textContent=`${winner} · ${teamName(0)}: ${a} aciertos · ${teamName(1)}: ${b} aciertos`;
      const percentage=n=>Math.round(n/27*100);
      $('endAwards').textContent=`🏆 ${a===b?'¡Empate con arte!':`¡Enhorabuena, ${teamName(a>b?0:1)}!`} · ${teamName(0)}: ${percentage(a)}% · ${teamName(1)}: ${percentage(b)}%`;
    }else{
      $('endAwards').textContent=`✨ ¡Qué arte! Habéis acertado el ${Math.round(c/27*100)}% del rosco.`;
    }
    const container=$('endLetters');container.replaceChildren();
    arrays.forEach((states,team)=>{
      const section=document.createElement('div');section.className='end-team-letters';
      if(game.mode==='duel'){
        const heading=document.createElement('strong');heading.className='end-team-label';
        heading.textContent=`${teamName(team)} · ${states.filter(s=>s==='correct').length} de 27`;
        section.append(heading);
      }
      const letters=document.createElement('div');letters.className='end-letter-row';
      LETTERS.forEach((letter,i)=>{
        const node=document.createElement('span');node.className=`end-letter ${states[i]==='pending'?'':states[i]}`;
        node.textContent=letter;node.title=questionFor(i,team).answer;letters.append(node);
      });
      section.append(letters);container.append(section);
    });
    $('diplomaButton').classList.toggle('is-hidden',game.mode!=='duel');renderErrorReview();renderUndo();showScreen('end');makeConfetti();sound('finish');
  }
  function backToSetup(){if(game && game.phase!=='finished'){game.paused=true;saveGame();}showScreen('setup');updateResume();}
  function resume(){const saved=getSavedGame();if(!saved){notify('No hay una partida guardada.');updateResume();return;}game=saved;game.paused=true;selectedLevel=String(game.level);selectedMode=game.mode;selectedSoloBank=game.soloBank;chooseLevel(selectedLevel);chooseMode(selectedMode);$('soloBankSelect').value=selectedSoloBank;duration=game.duration;$('timeSelect').value=String(duration);
    selectedTeamNames=game.teamNames||['Equipo A','Equipo B'];$('nameGreen').value=selectedTeamNames[0];$('nameWhite').value=selectedTeamNames[1];launchGame();notify('Partida recuperada. Pulsa «Reanudar» para continuar.');}
  function discard(){ask('¿Descartar la partida?','Se eliminará el progreso guardado en este navegador.',()=>{clearSavedGame();game=null;updateResume();notify('Partida descartada.');});}
  function fromNewGame(){const saved=getSavedGame();if(saved){ask('¿Comenzar de cero?','La partida guardada se sustituirá por una nueva.',initGame);}else initGame();}

  // Un único HTML portátil: el banco queda incrustado en el propio archivo.
  function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function portableScript(){
    const safe=JSON.stringify(bank).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    const id='p'+Date.now().toString(36)+Math.floor(Math.random()*0xffff).toString(36);
    return `window.ROSCO_STANDALONE = true;window.ROSCO_PORTABLE_ID=${JSON.stringify(id)};window.ROSCO_QUESTIONS = ${safe};`;
  }
  function downloadPortable(){
    if(editorDirty){notify('Guarda primero la pregunta que estás editando.');$('editorError').textContent='Pulsa «Guardar esta pregunta» antes de preparar el HTML para la PDI.';return;}
    const audit=auditQuestions();if(audit.issues.length){showAudit();notify('Corrige las preguntas señaladas antes de descargar el rosco.');return;}
    let html;
    if(window.ROSCO_PORTABLE_TEMPLATE_BASE64){
      const raw=atob(window.ROSCO_PORTABLE_TEMPLATE_BASE64);
      const bytes=Uint8Array.from(raw,ch=>ch.charCodeAt(0));
      const template=new TextDecoder('utf-8').decode(bytes);
      html=template.replace('/*__ROSCO_'+'PREGUNTAS_PORTATILES__*/',portableScript());
    }else if(window.ROSCO_STANDALONE){
      // El HTML portátil también puede volver a exportarse tras editarlo.
      const doc=document.documentElement.cloneNode(true);
      const script=doc.querySelector('#portableBank');
      if(!script){notify('No se encuentra el banco de preguntas del archivo.');return;}
      script.textContent=portableScript();
      html='<!doctype html>\n'+doc.outerHTML;
    }else{notify('No se encuentra el módulo de exportación. Comprueba que la carpeta js esté completa.');return;}
    const today=new Date().toISOString().slice(0,10);
    const requested=$('portableFileName').value.trim().replace(/\.html?$/i,'');
    const fileStem=(requested||'ROSCO_4D_TECNOLOGIA_INSTI').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_ -]/gi,'').trim().replace(/\s+/g,'_').slice(0,68)||'ROSCO_4D';
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`${fileStem}_${today}.html`);
    notify('¡Listo! Descargado tu HTML personalizado. Ábrelo en la PDI.');
  }
  function printStandaloneAnswers(){
    const level=game?.level??selectedLevel;
    const chosen=game?.mode==='duel'?'both':game?.soloBank??selectedSoloBank;
    const teams=chosen==='both'?['green','white']:[chosen];
    const title='Rosco 4D · Solucionario · '+ordinal[level];
    const blocks=teams.map(team=>`<section class="team"><h2>${team==='green'?'🟢 Equipo A (verde)':'🔵 Equipo B (azul)'}</h2><div class="rows">${bank[level][team].map(q=>`<article><div class="letter">${escapeHTML(q.letter)}</div><div><small>${q.mode==='starts'?'EMPIEZA POR LA':'CONTIENE LA'} ${escapeHTML(q.letter)}</small><p>${escapeHTML(q.clue)}</p><strong>${escapeHTML(q.answer)}</strong><em>${escapeHTML(q.fact)}</em></div></article>`).join('')}</div></section>`).join('');
    const content=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>body{font:14px/1.45 system-ui,Arial,sans-serif;color:#1b4431;margin:25px auto;max-width:1050px;padding:0 20px}h1{color:#087846;margin-bottom:0}.intro{color:#52705c}.buttons{display:flex;justify-content:flex-end;gap:10px}button{padding:11px 17px;background:#12834e;color:white;border:0;border-radius:9px;cursor:pointer}.team{margin:28px 0}.team h2{background:#e1f2e5;padding:10px;border-radius:8px}.rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 20px}article{display:flex;gap:10px;border-bottom:1px solid #d8e6dc;padding:8px 0;break-inside:avoid}.letter{font-weight:900;background:#148449;color:white;border-radius:50%;width:28px;height:28px;min-width:28px;display:grid;place-items:center}small{font-weight:800;color:#247853;font-size:10px}article p{margin:3px 0}article strong{display:block}article em{display:block;color:#617869;font-size:11px;font-style:normal;margin-top:3px}@media print{@page{size:A4;margin:12mm}.buttons{display:none}.rows{grid-template-columns:1fr 1fr}body{padding:0;margin:0;font-size:11px}article{padding:5px 0}.team{break-before:auto}}</style></head><body><div class="buttons"><button onclick="window.print()">Imprimir / Guardar PDF</button></div><h1>${escapeHTML(title)}</h1><p class="intro">Tecnología Insti · @tecnologiainsti · Día de la Bandera de Andalucía · Solucionario personalizado para el profesorado</p>${blocks}</body></html>`;
    const popup=window.open('','_blank');
    if(!popup){notify('Permite las ventanas emergentes para ver el solucionario.');return;}
    popup.document.open();popup.document.write(content);popup.document.close();
  }
  function selectTeacherGuide(mode){
    const selected=mode==='zip'?'zip':'web';
    document.querySelectorAll('#teacherHelpDialog [data-guide-tab]').forEach(btn=>{
      const on=btn.dataset.guideTab===selected;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',String(on));
    });
    document.querySelectorAll('#teacherHelpDialog [data-guide-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.guidePanel!==selected;
    });
  }
  function printTeacherGuide(){
    // Solo imprime la modalidad seleccionada, sin pestañas ni instrucciones ocultas.
    const panel=document.querySelector('#teacherHelpDialog [data-guide-panel]:not([hidden])');
    if(!panel)return;
    const label=panel.dataset.guidePanel==='zip'?'Descargar ZIP y editar sin Internet':'Editar directamente desde la web';
    const printable=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Rosco 4D · ${label} · Tecnología Insti · @tecnologiainsti</title><style>body{font:14px/1.55 system-ui,Arial;max-width:790px;margin:25px auto;padding:0 16px;color:#1b4431}h1{color:#077343;font-size:25px}.teacher-help-lead{margin:12px 0;background:#eaf8eb;padding:13px;border-radius:10px}.teacher-help-lead span{display:block}.teacher-steps>div{display:flex;gap:14px;padding:9px 0;border-bottom:1px solid #dae7dd;break-inside:avoid}.teacher-steps p{margin:0;flex:1}.step-num{font-weight:900;color:#05834a}.teacher-alert{border:2px solid #e1a13d;background:#fff9e6;border-radius:10px;padding:11px;margin:15px 0}.dialog-small{font-size:12px}@page{size:A4;margin:15mm}</style></head><body><h1>ROSCO 4D · Guía docente</h1><p>Tecnología Insti · @tecnologiainsti · Día de la Bandera de Andalucía · ${label}</p>${panel.innerHTML}</body></html>`;
    const popup=window.open('','_blank');if(!popup){notify('Permite las ventanas emergentes para imprimir la guía.');return;}
    popup.document.open();popup.document.write(printable);popup.document.close();popup.focus();popup.print();
  }

  function printAnswers(){if(window.ROSCO_STANDALONE){printStandaloneAnswers();return;}const level=game?.level??selectedLevel;const team=game?.mode==='duel'?'both':game?.soloBank??selectedSoloBank;window.open(`solucionario.html?curso=${encodeURIComponent(level)}&equipo=${encodeURIComponent(team)}`,'_blank','noopener');}
  function playAgain(){selectedLevel=String(game.level);selectedMode=game.mode;selectedSoloBank=game.soloBank;duration=game.duration;initGame();}

  function renderSound(){const btn=$('soundButton');btn.setAttribute('aria-pressed',String(!muted));btn.innerHTML=muted?'<svg><use href="#i-volume-off"/></svg>':'<svg><use href="#i-volume"/></svg>';btn.title=muted?'Activar sonido':'Desactivar sonido';}
  function sound(type){if(muted)return;try {const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;if(!audioContext)audioContext=new Context();if(audioContext.state==='suspended')audioContext.resume();const notes=type==='correct'?[520,740]:type==='wrong'?[240,185]:type==='finish'?[500,660,820]:type==='warning'?[820,690,820]:[400];const now=audioContext.currentTime;notes.forEach((freq,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),start=now+i*.105; o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.065,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+.115);o.connect(g);g.connect(audioContext.destination);o.start(start);o.stop(start+.13);});}catch{/* no molestar si el navegador no permite audio */}}
  async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('Usa F11 para activar pantalla completa.');}}

  // Editor completo: 4 niveles × 2 equipos × 27 letras = 216 preguntas.
  function editorValues(){
    return {letter:$('editLetter').value,mode:$('editMode').value,clue:$('editClue').value.trim(),answer:$('editAnswer').value.trim(),
      aliases:$('editAliases').value.split(';').map(a=>a.trim()).filter(Boolean),fact:$('editFact').value.trim()};
  }
  function editorLocation(){return {level:$('editLevel').value,team:$('editTeam').value,letter:$('editLetter').value};}
  function editorChoose(l,t,letter){
    if(editorDirty && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')){
      $('editLevel').value=editorSelection.level;$('editTeam').value=editorSelection.team;$('editLetter').value=editorSelection.letter;
      return;
    }
    $('editLevel').value=l;$('editTeam').value=t;$('editLetter').value=letter;
    loadEditor();
  }
  function setupEditor(){
    if(!$('editLetter').options.length)LETTERS.forEach(letter=>{const option=document.createElement('option');option.value=letter;option.textContent=letter;$('editLetter').append(option);});
    $('editLevel').value=selectedLevel;$('editTeam').value='green';$('editLetter').value='A';loadEditor();
  }
  function renderEditorLetters(){
    const {level,team,letter}=editorLocation();const container=$('editorAlphabet');container.replaceChildren();
    LETTERS.forEach((l,i)=>{
      const btn=document.createElement('button');btn.type='button';btn.className='editor-letter'+(l===letter?' selected':'');btn.textContent=l;
      btn.title=`Editar ${l} · Equipo ${team==='green'?'verde':'blanco'}`;btn.setAttribute('aria-pressed',String(l===letter));
      btn.addEventListener('click',()=>editorChoose(level,team,l));container.append(btn);
    });
    $('editorSummary').textContent=`${ordinal[level]} · 27 preguntas del equipo A + 27 del B · 54 preguntas distintas`;
    $('editorTeamIndicator').textContent=`EQUIPO ${team==='green'?'VERDE':'BLANCO'}`;
    $('editorTeamIndicator').className='editor-team-indicator '+team;
  }
  function loadEditor(){
    const {level,team,letter}=editorLocation();
    const q=bank[level][team][LETTERS.indexOf(letter)];
    $('editMode').value=q.mode;$('editClue').value=q.clue;$('editAnswer').value=q.answer;
    $('editAliases').value=q.aliases.join('; ');$('editFact').value=q.fact;
    $('editorError').textContent='';editorDirty=false;editorSelection={level,team,letter};
    renderEditorLetters();renderEditorPreview();
  }
  function renderEditorPreview(){
    const q=editorValues();const rule=q.mode==='starts'?`EMPIEZA POR LA ${q.letter}`:`CONTIENE LA ${q.letter}`;
    $('editorPreview').textContent=`${rule} · ${q.clue||'Escribe la pregunta...'} · Solución: ${q.answer||'pendiente'}`;
    const valid=validEntry(q,q.letter);
    $('editorCheck').textContent=valid?'✓ La solución y las alternativas cumplen la pista':`⚠ Comprueba la solución y las alternativas: deben ${q.mode==='starts'?'empezar por':'contener'} «${q.letter}».`;
    $('editorCheck').className='editor-check '+(valid?'valid':'invalid');
  }
  function auditQuestions(){
    const issues=[], warnings=[];
    for(const level of [1,2,3,4]){
      const levelAnswers=new Map();
      for(const team of ['green','white']){
        const seen=new Set();
        for(const [i,q] of bank[level][team].entries()){
          const tag=`Nivel ${level} · ${team==='green'?'Verde':'Blanco'} · ${LETTERS[i]}`;
          if(!validEntry(q,LETTERS[i]))issues.push(`${tag}: pregunta, respuesta o alternativas inválidas.`);
          if(q && typeof q.answer==='string'){
            const answer=norm(q.answer);
            if(seen.has(answer))issues.push(`${tag}: respuesta repetida dentro del equipo.`);
            seen.add(answer);
            if(levelAnswers.has(answer))issues.push(`${tag}: respuesta duplicada con ${levelAnswers.get(answer)}.`);
            else levelAnswers.set(answer,tag);
            if(q.aliases?.some(a=>incompleteAlias(a,q.answer)))issues.push(`${tag}: alternativa incompleta (abreviación de la solución).`);
          }
          if(!q?.fact?.trim())warnings.push(`${tag}: se recomienda añadir una explicación didáctica.`);
          if((q?.clue||'').trim().length<15)warnings.push(`${tag}: el enunciado es muy breve; revisa si es claro.`);
        }
      }
    }
    return {issues,warnings};
  }
  function showAudit(){
    if(editorDirty){$('editorError').textContent='Guarda antes la pregunta abierta para incluirla en la revisión.';return;}
    const {issues,warnings}=auditQuestions();
    const report=$('auditReport'); report.replaceChildren();report.classList.remove('is-hidden');
    const h=document.createElement('strong');h.textContent=issues.length?`⚠ ${issues.length} errores · ${warnings.length} avisos`:`✓ 216 preguntas revisadas · 0 errores · ${warnings.length} avisos`;
    report.append(h);
    for(const [kind,items] of [['error',issues],['aviso',warnings]]) for(const issue of items.slice(0,30)){
       const p=document.createElement('p');p.textContent=`${kind==='error'?'⛔':'ℹ'} ${issue}`;report.append(p);
    }
    if(issues.length+warnings.length>30){const p=document.createElement('p');p.textContent='Se muestran los primeros 30 resultados. Corrige y vuelve a verificar.';report.append(p);}
    report.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function saveEditor(ev){
    ev.preventDefault();const {level,team,letter}=editorLocation(),idx=LETTERS.indexOf(letter);const item=editorValues();
    if(!validEntry(item,letter)){
      $('editorError').textContent=`La respuesta y TODAS sus alternativas deben ${item.mode==='starts'?'empezar por':'contener'} la letra ${letter} y ser palabras completas (no abreviaciones).`;return;
    }
    const opposite=team==='green'?'white':'green';
    if(bank[level][opposite].some(q=>norm(q.answer)===norm(item.answer))){
      $('editorError').textContent=`El equipo ${opposite==='green'?'verde':'blanco'} ya tiene esa respuesta en este nivel. Elige otra para que ambos roscos sean diferentes.`;return;
    }
    bank[level][team][idx]=item;
    safeWrite(KEYS.bank,bank);editorDirty=false;$('editorError').textContent='';
    notify(`Guardada la ${letter} de ${ordinal[level]} · Equipo ${team==='green'?'verde':'blanco'}.`);
    loadEditor();
  }
  function restoreQuestion(){
    const {level,team,letter}=editorLocation();
    ask('¿Restaurar esta pregunta?',`Se recuperará la pregunta original de la letra ${letter} para el equipo ${team==='green'?'verde':'blanco'}.`,()=>{
      bank[level][team][LETTERS.indexOf(letter)]=clone(BASE_BANK[level][team][LETTERS.indexOf(letter)]);
      safeWrite(KEYS.bank,bank);loadEditor();notify('Pregunta original restaurada.');
    });
  }
  function exportBank(){
    const file=new Blob([JSON.stringify(bank,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='rosco-4d-tecnologiainsti-216-preguntas.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Exportadas 216 preguntas de ambos equipos.');
  }
  async function importBank(event){
    const input=event.target;const file=input.files?.[0];if(!file)return;
    try{
      if(file.size>5_000_000)throw new Error('Archivo demasiado grande.');
      const data=JSON.parse(await file.text());let candidate=data?.courses??data;let legacy=false;
      if(validOldBank(candidate)){
        const upgraded=clone(bank);for(const lv of [1,2,3,4])upgraded[lv].green=clone(candidate[lv]);
        candidate=upgraded;legacy=true;
      }
      if(!validBank(candidate))throw new Error('El JSON debe contener 4 niveles × 2 equipos × 27 letras, con respuestas válidas y diferentes entre equipos.');
      if(editorDirty && !window.confirm('Se perderán los cambios sin guardar. ¿Importar igualmente?'))return;
      bank=clone(candidate);safeWrite(KEYS.bank,bank);loadEditor();
      notify(legacy?'Banco antiguo importado para el equipo A. Se conserva el banco B.':'Importadas las 216 preguntas de los dos equipos.');
    }catch(err){$('editorError').textContent=`No se pudo importar: ${err.message}`;}
    finally{input.value='';}
  }
  function resetBank(){ask('¿Restaurar las 216 preguntas originales?',
    'Se eliminarán las modificaciones de los cuatro niveles y los dos equipos guardadas en este navegador.',()=>{
      bank=clone(BASE_BANK);safeWrite(KEYS.bank,bank);loadEditor();notify('Restaurados los 8 roscos originales.');
    });}
  function editorNavigate(dir){
    const {level,team,letter}=editorLocation();const idx=(LETTERS.indexOf(letter)+dir+27)%27;
    editorChoose(level,team,LETTERS[idx]);
  }

  // Eventos de interfaz.
  function listen(){document.querySelectorAll('.level-card').forEach(btn=>btn.addEventListener('click',()=>chooseLevel(btn.dataset.level)));document.querySelectorAll('#modeOptions button').forEach(btn=>btn.addEventListener('click',()=>chooseMode(btn.dataset.mode)));$('timeSelect').addEventListener('change',e=>{duration=Number(e.target.value);});$('soloBankSelect').addEventListener('change',e=>{selectedSoloBank=e.target.value;});$('startButton').addEventListener('click',fromNewGame);$('drawTeamButton').addEventListener('click',drawTeam);
    $('previewButton').addEventListener('click',openPreview);
    document.querySelectorAll('[data-preview-team]').forEach(btn=>btn.addEventListener('click',()=>{previewTeam=btn.dataset.previewTeam;renderPreview();}));
    $('undoButton').addEventListener('click',undoLast);$('endUndoButton').addEventListener('click',undoLast);
    $('pdiButton').addEventListener('click',togglePdi);$('hintMijita').addEventListener('click',()=>useWildcard('mijita'));
    $('hintCable').addEventListener('click',()=>useWildcard('cable'));
    $('checkBankButton').addEventListener('click',showAudit);$('diplomaButton').addEventListener('click',printDiploma);$('resumeButton').addEventListener('click',resume);$('discardButton').addEventListener('click',discard);$('helpButton').addEventListener('click',()=>openDialog('helpDialog'));$('teacherHelpButton').addEventListener('click',()=>{selectTeacherGuide('web');openDialog('teacherHelpDialog');});$('editorGuideButton').addEventListener('click',()=>{closeDialog('editorDialog');selectTeacherGuide('web');openDialog('teacherHelpDialog');});document.querySelectorAll('#teacherHelpDialog [data-guide-tab]').forEach(btn=>btn.addEventListener('click',()=>selectTeacherGuide(btn.dataset.guideTab)));$('printGuideButton').addEventListener('click',printTeacherGuide);$('downloadPortable').addEventListener('click',downloadPortable);$('editorButton').addEventListener('click',()=>{setupEditor();openDialog('editorDialog');});$('printButton').addEventListener('click',printAnswers);$('endAnswersButton').addEventListener('click',printAnswers);$('fullscreenButton').addEventListener('click',toggleFullscreen);$('soundButton').addEventListener('click',()=>{muted=!muted;safeWrite(KEYS.sound,!muted);renderSound();});$('correctButton').addEventListener('click',()=>mark('correct'));$('wrongButton').addEventListener('click',()=>mark('wrong'));$('passButton').addEventListener('click',pass);$('nextButton').addEventListener('click',next);$('checkInputButton').addEventListener('click',checkTyped);$('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();checkTyped();}});$('answerInput').addEventListener('input',()=>{$('answerValidation').textContent='';$('answerValidation').classList.add('is-hidden');$('answerInput').removeAttribute('aria-invalid');$('correctButton').disabled=!!game?.paused || $('answerInput').value.trim().length>0;});$('revealButton').addEventListener('click',reveal);$('pauseButton').addEventListener('click',togglePause);$('backButton').addEventListener('click',backToSetup);$('restartButton').addEventListener('click',()=>ask('¿Reiniciar el rosco?','Se perderán los aciertos y fallos de esta partida.',()=>{selectedLevel=String(game.level);selectedMode=game.mode;selectedSoloBank=game.soloBank;duration=game.duration;initGame();}));$('playAgainButton').addEventListener('click',playAgain);$('changeLevelButton').addEventListener('click',()=>{game=null;showScreen('setup');updateResume();});$('editLevel').addEventListener('change',e=>editorChoose(e.target.value,editorSelection?.team??'green',editorSelection?.letter??'A'));
    $('editTeam').addEventListener('change',e=>editorChoose(editorSelection?.level??selectedLevel,e.target.value,editorSelection?.letter??'A'));
    $('editLetter').addEventListener('change',e=>editorChoose(editorSelection?.level??selectedLevel,editorSelection?.team??'green',e.target.value));
    ['editMode','editClue','editAnswer','editAliases','editFact'].forEach(id=>$(id).addEventListener('input',()=>{editorDirty=true;renderEditorPreview();}));
    $('editorPrevious').addEventListener('click',()=>editorNavigate(-1));
    $('editorNext').addEventListener('click',()=>editorNavigate(1));
    $('restoreQuestion').addEventListener('click',restoreQuestion);$('editorForm').addEventListener('submit',saveEditor);$('exportQuestions').addEventListener('click',exportBank);$('importQuestions').addEventListener('change',importBank);$('resetQuestions').addEventListener('click',resetBank);document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeDialog(btn.dataset.close)));$('confirmYes').addEventListener('click',()=>{closeDialog('confirmDialog');const callback=confirmCallback;confirmCallback=null;if(callback)callback();});document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();}));document.addEventListener('visibilitychange',()=>{if(document.hidden){}if(document.hidden&&game&&game.phase==='running'&&!game.paused){game.paused=true;saveGame();renderTimer();renderQuestion();}});window.addEventListener('beforeunload',saveGame);}
  // SEGURIDAD DE EVALUACIÓN: sin atajos globales que puntúen al pulsar letras.
  // Solo se evalúa con «Comprobar»/Intro DENTRO de la casilla de respuesta
  // o con los botones explícitos de corrección del docente.
  function boot(){initializeExtrasUI();makePreview();initWheel();listen();renderSound();chooseMode(selectedMode);updateResume();showScreen('setup');document.body.classList.toggle('pdi-mode',pdiMode);$('pdiButton').setAttribute('aria-pressed',String(pdiMode));$('pdiButton').textContent=pdiMode?'Vista normal':'Modo PDI';}
  boot();
})();
