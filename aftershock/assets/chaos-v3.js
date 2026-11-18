/* AFTERSHOCK original-MV integration — licensed playback through the artist's official YouTube embed, no copied audio. */
(() => {
  'use strict';
  const button=document.getElementById('chaosSongButton');
  const player=document.getElementById('chaosMusic');
  const frame=document.getElementById('chaosMusicFrame');
  const close=document.getElementById('chaosMusicClose');
  if(!button||!player||!frame||!close)return;
  let pausedDoom=false;
  const video='https://www.youtube-nocookie.com/embed/7mDDM0eBWR0?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=1';
  const audio=document.getElementById('doomAudio');
  function play(){
    pausedDoom=!!audio&&!audio.paused;
    if(pausedDoom)audio.pause();
    player.classList.add('open');
    player.removeAttribute('inert');
    player.setAttribute('aria-hidden','false');
    button.setAttribute('aria-expanded','true');
    button.textContent='♫ 퇴사송 재생 중';
    frame.src=video;
    close.focus({preventScroll:true});
  }
  function stop(){
    player.classList.remove('open');
    player.setAttribute('inert','');
    player.setAttribute('aria-hidden','true');
    frame.src='about:blank';
    button.setAttribute('aria-expanded','false');
    button.textContent='▶ 퇴사할게여 · 원곡';
    if(pausedDoom&&audio&&document.querySelector('#audioLaunch')?.getAttribute('aria-pressed')==='true')audio.play().catch(()=>{});
    pausedDoom=false;
    button.focus({preventScroll:true});
  }
  button.addEventListener('click',()=>player.classList.contains('open')?stop():play());
  close.addEventListener('click',stop);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&player.classList.contains('open'))stop()});
  window.addEventListener('pagehide',()=>{frame.src='about:blank'});
})();