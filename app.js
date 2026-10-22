'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const phone = $('.phone');
const icons = {
 back:'<path d="m14 5-7 7 7 7"/>',
 speaker:'<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
 mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3M9 21h6"/>',
 camera:'<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>',
 end:'<path d="M3 14c4-6 14-6 18 0l-2 4-5-2v-3h-4v3l-5 2z"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
Object.entries(icons).forEach(([name,path]) => {
 const el = $(`[data-action="${name === 'back' ? 'voice' : name}"]`);
 if(el) el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
});
let state = 'listening', mode = 'voice', mic = true, camera = true;
let suspended = 'listening', interrupted = false, oldTopic = '', oldReply = '', currentTopic = '三天旅行计划';
let pending = [], generation = 0, elapsed = 0, activeReply = '', replyIndex = 0, pausedReply = '';
function later(fn, ms) { const id=setTimeout(fn, ms); pending.push(id); return id; }
function clearPending() { pending.forEach(clearTimeout); pending=[]; generation++; }
const copy = {
 listening:['我在听','慢慢说，我在这里'], understanding:['正在理解','把你的想法，轻轻理一理'],
 speaking:['正在回答','随时可以打断我'], paused:['我等你','不着急，准备好了再继续'], ended:['通话已结束','']
};
function setState(next, options={}) {
 clearPending(); state=next; phone.dataset.state=next;
 phone.classList.remove('user-talking','quiet');
 $('#state-title').textContent=copy[next][0]; $('#state-detail').textContent=copy[next][1];
 $('#subtitle').textContent=''; $('#context').textContent='';
 $('.conversation').hidden=next==='ended'; $('.ended-panel').hidden=next!=='ended';
 $('.resume-topic').hidden=!interrupted || ['paused','ended'].includes(next);
 if(next==='listening' && !mic) { $('#state-title').textContent='麦克风已关闭'; $('#state-detail').textContent='打开后，我会继续听'; }
 if(next==='speaking') speak(options.text || '我们可以把三天留给喜欢的地方，第一天先去老街慢慢逛。');
 if(next==='understanding' && options.auto) later(()=>setState('speaking',options),1500);
 updateControls();
}
function speak(text) {
 activeReply=text; replyIndex=0;
 const token=generation; let n=0;
 function tick(){ if(token!==generation || state!=='speaking') return; n++; replyIndex=n; $('#subtitle').textContent=text.slice(Math.max(0,n-32),n); if(n<text.length) later(tick,95); else later(()=>setState('listening'),3500); }
 tick();
}
function context(text) { $('#context').textContent=text; }
function switchMode(next) {
 closeMore(); mode=next; camera=true;
 phone.dataset.mode=next;
 const video=['video','navigation'].includes(next);
 $('#scene').hidden=!video; $('#tea-scene').hidden=next!=='video'; $('#nav-scene').hidden=next!=='navigation';
 $('.camera-tool').hidden=!video; $('.camera-off').hidden=true;
 $('.walking-label').hidden=next!=='walking';
 $('#mode-title').textContent=({voice:'语音通话',walking:'走路模式',video:'视频通话',navigation:'实景导航'})[next];
 $('#scene-caption').textContent=next==='navigation'?'室内 · 出口指引':'午后 · 茶饮小店';
 $$('.product').forEach(el=>el.classList.remove('selected'));
 $('#nav-scene').classList.remove('uncertain'); $('.uncertain-guide').hidden=true;
 interrupted=false; setState('listening');
 if(next==='walking') { currentTopic='三天旅行计划'; context('边走边聊，我会等你'); }
 if(next==='video') $('#subtitle').textContent='想选哪款茶？点一下，我帮你看看。';
 if(next==='navigation') setState('speaking',{text:'已确认出口 A，从左侧门出去。'});
 updateToggle('camera',true);
}
function interrupt() {
 if(state==='ended') return;
 if(!mic) { context('打开麦克风后，就可以插话'); return; }
 if(state==='speaking' && !interrupted) {oldTopic=currentTopic; oldReply=activeReply.slice(Math.max(0,replyIndex-6));}
 interrupted=true; setState('listening');
 $('#state-title').textContent='听你说'; context('已经停下回答，注意力交给你');
 later(()=>{if(state==='listening') $('#state-title').textContent='我在听';},1800);
}
function pauseResume() { if(state==='paused') resume(); else pause(); }
function pause() { if(state==='ended') return; suspended=state; pausedReply=state==='speaking'?activeReply.slice(Math.max(0,replyIndex-6)):''; setState('paused'); context(mode==='walking'?'没问题，路口先留意安全':'这段对话还在，随时继续'); }
function resume() {
 if(state==='ended') return;
 const previous=suspended;
 setState(previous==='speaking'?'speaking':'listening',{text:pausedReply || undefined}); context(`刚才我们聊到${currentTopic}`);
}
function userTalk() {
 if(state==='ended') return;
 if(!mic) {context('麦克风已关闭，请先打开'); return;}
 if(state==='speaking') interrupt(); else setState('listening');
 phone.classList.add('user-talking'); $('#state-detail').textContent='嗯，继续说';
 later(()=>{phone.classList.remove('user-talking'); $('#state-detail').textContent='慢慢说，我在这里';},2400);
}
function silence() {
 if(state==='ended') return;
 if(!mic) {context('打开麦克风后，我会继续听'); return;}
 setState('listening'); phone.classList.add('quiet'); $('#state-detail').textContent='我还在听';
 later(()=>{phone.classList.remove('quiet'); $('#state-detail').textContent='不着急，想好了再说';},3000);
}
function recognizeTea(name) {
 if(mode!=='video'||!camera||state==='ended') return;
 currentTopic=`${name}的选择`;
 $$('.product').forEach(el=>el.classList.toggle('selected',el.dataset.tea===name));
 const response={'伯爵茶':'推荐伯爵茶，佛手柑的香气清新，适合悠闲的午后。','红茶':'推荐红茶，口感醇厚，喜欢浓郁茶香可以选它。','柠檬茶':'推荐柠檬茶，酸甜清爽，走路后喝很合适。'}[name];
 setState('understanding',{auto:true,text:response}); context(`已定位 · ${name}`);
}
function uncertain() {
 if(mode!=='navigation') switchMode('navigation');
 if(!camera) {context('请先打开摄像头'); return;}
 setState('listening'); $('#nav-scene').classList.add('uncertain'); $('.uncertain-guide').hidden=false;
 $('#state-title').textContent='暂时无法确认'; $('#subtitle').textContent='请把镜头转向门牌或路标，我再帮你确认。';
}
function updateToggle(name,on) {
 const el=$(`[data-action="${name}"]`); el.setAttribute('aria-pressed',String(on));
 el.setAttribute('aria-label',`${on?'关闭':'打开'}${{speaker:'扬声器',mic:'麦克风',camera:'摄像头'}[name]}`);
 el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}${on?'':'<path d="m3 3 18 18"/>'}</svg>`;
}
function updateControls() {
 $$('.demo-grid button').forEach(el=>{const active=el.dataset.demo===state || el.dataset.demo===mode;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
}
function closeMore() { $('.more-sheet').hidden=true; $('.sheet-backdrop').hidden=true; $('[data-action="more"]').setAttribute('aria-expanded','false'); }
function run(action) {
 if(state==='ended' && action!=='restart') return;
 switch(action) {
 case 'listening': case 'understanding': case 'speaking': setState(action);break;
 case 'interrupt':interrupt();break;
 case 'pause':pause();break;
 case 'resume':resume();break;
 case 'voice': case 'walking': case 'video': case 'navigation':switchMode(action);break;
 case 'user-talk':userTalk();break;
 case 'silence':silence();break;
 case 'finish':if(mic) setState('understanding',{auto:true,text:interrupted?'听到了，你的新问题我们先聊；也可以继续刚才的话题。':undefined});else context('请先打开麦克风');break;
 case 'uncertain':uncertain();break;
 }
}
$$('[data-demo]').forEach(el=>el.addEventListener('click',()=>run(el.dataset.demo)));
$$('[data-tea]').forEach(el=>el.addEventListener('click',()=>recognizeTea(el.dataset.tea)));
$$('[data-action]').forEach(el=>el.addEventListener('click',()=>{
 const action=el.dataset.action;
 if(state==='ended' && action!=='restart') return;
 if(action==='more'){const open=$('.more-sheet').hidden;$('.more-sheet').hidden=!open;$('.sheet-backdrop').hidden=!open;el.setAttribute('aria-expanded',String(open));if(open) $('.more-sheet button').focus();return;}
 if(action==='speaker'){updateToggle('speaker',el.getAttribute('aria-pressed')!=='true');return;}
 if(action==='mic'){mic=!mic;updateToggle('mic',mic);if(state==='listening') setState('listening');else context(mic?'麦克风已打开':'麦克风已关闭');return;}
 if(action==='camera'){camera=!camera;updateToggle('camera',camera);$('.camera-off').hidden=camera;return;}
 if(action==='end'){closeMore();setState('ended');return;}
 if(action==='restart'){elapsed=0;mic=true;interrupted=false;currentTopic='三天旅行计划';updateToggle('mic',true);switchMode('voice');return;}
 if(action==='topic'){interrupted=false;currentTopic=oldTopic||'三天旅行计划';setState('speaking',{text:oldReply || '接着刚才的三天旅行计划，第二天可以去海边，留一些自由散步的时间。'});context(`接着聊${currentTopic}`);return;}
 closeMore(); if(action==='pause') pauseResume();else run(action);
}));
$('.sheet-backdrop').addEventListener('click',closeMore);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMore();$('[data-action="more"]').focus();}});
setInterval(()=>{if(state!=='ended')elapsed++;$('#call-time').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;},1000);
setState('listening');
