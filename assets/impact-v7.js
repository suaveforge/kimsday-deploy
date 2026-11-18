/* KIM'S DAY V9 -- low-power single impact renderer and richer fixed skyline. */
(() => {
  'use strict';
  const canvas=document.getElementById('siegeCanvas');
  const stage=document.querySelector('.impact-stage');
  const sites=Array.from(document.querySelectorAll('.impact-omen[data-omen]'));
  if(!canvas||!stage||sites.length!==3)return;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return;
  const PI=Math.PI, TAU=2*PI, rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const mobile=()=>innerWidth<670;
  let W=0,H=0,dpr=1,stageBottom=0,stageHeight=0,elapsed=0,prev=0,frame=0,renderTimer=0;
  let shots=[],bursts=[],smokes=[],fireflies=[],rubble=[];
  let nextShots=[.16,.82,1.48],nextAmbient=.53,lastAmbientX=-9999,ambientHits=0,events=0,onscreen=true;let startTime=0,lastPaint=0;
  const focus=[.18,.50,.82];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sprite=(kind,seed)=>{
    const cv=document.createElement('canvas');cv.width=cv.height=160;
    const g=cv.getContext('2d');
    const grad=g.createRadialGradient(80,80,3,80,80,78);
    const palettes={
      smoke:['rgba(128,74,53,.73)','rgba(70,46,43,.89)','rgba(40,29,30,.76)','rgba(8,7,9,0)'],
      ash:['rgba(221,99,36,.72)','rgba(77,48,42,.87)','rgba(32,24,25,.77)','rgba(12,9,13,0)'],
      flame:['rgba(255,238,176,.80)','rgba(255,148,51,.89)','rgba(214,49,8,.52)','rgba(132,14,0,0)']};
    const a=palettes[kind];grad.addColorStop(0,a[0]);grad.addColorStop(.25,a[1]);grad.addColorStop(.62,a[2]);grad.addColorStop(1,a[3]);
    g.fillStyle=grad;g.fillRect(0,0,160,160);
    // Chunky thermal texture; generated once instead of drawing expensive gradients every frame.
    if(kind!=='flame'){
      let n=18+seed*3;
      for(let i=0;i<n;i++){
        let ang=i*2.39996+seed, rad=20+((i*23+seed*17)%46), r=9+((i*7+seed*3)%20);
        g.fillStyle= i%3===0?'rgba(100,73,60,.07)':'rgba(0,0,0,.09)';
        g.beginPath();g.arc(80+Math.cos(ang)*rad,80+Math.sin(ang)*rad,r,0,TAU);g.fill();
      }
    }
    return cv;
  };
  const textures={smoke:[sprite('smoke',1),sprite('smoke',2),sprite('smoke',3)],ash:[sprite('ash',1),sprite('ash',2)],flame:[sprite('flame',1),sprite('flame',2)]};
  const siteState=sites.map((node,i)=>({node,i,lastHit:-99,lastFire:-99,firstHit:false,anchor:focus[i],lift:0}));
  const ruins=Array.from({length:24},(_,i)=>({u:i/44,w:rand(.011,.032),h:rand(.12,.52),broken:rand(.1,.95),seed:rand(0,6.28)}));
  const braziers=Array.from({length:9},(_,i)=>({u:(i+.45)/18,y:rand(.015,.23),sz:rand(.6,1.48),seed:rand(0,6.28)}));
  // Each syllable comes from airborne debris and burns into the smoke only after impact.
  sites.forEach((node,i)=>{
    const root=node.querySelector('.impact-words');
    const lines=Array.from(root.children).map(n=>n.textContent);
    root.innerHTML='';
    lines.forEach((line,li)=>{
      const row=document.createElement('span');row.className='impact-line';
      [...line].forEach((ch,j)=>{
        const g=document.createElement('span');g.className='death-glyph';g.textContent=ch;
        const n=li*23+j,angle=(n*3.73+i*1.7);
        g.style.setProperty('--glyph-delay',`${Math.round(90+j*65+li*180+rand(0,70))}ms`);
        g.style.setProperty('--burst-x',`${Math.round(Math.cos(angle)*rand(35,100))}px`);
        g.style.setProperty('--burst-y',`${Math.round(rand(42,110)+Math.sin(angle)*35)}px`);
        g.style.setProperty('--burst-r',`${Math.round(rand(-80,80))}deg`);
        row.appendChild(g);
      });
      root.appendChild(row);
    });
  });
  function place(){
    dpr=mobile()?.52:.58;W=innerWidth;
    const page=document.querySelector('.page');H=Math.max(innerHeight,page.offsetHeight);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
    const box=stage.getBoundingClientRect();stageBottom=box.bottom+scrollY;stageHeight=box.height;
  }
  function point(i){const st=siteState[i];return {x:W*st.anchor,y:Math.min(H-16,stageBottom-stageHeight*(.075+st.lift))};}
  let lastHeatRead=-2,cachedHeat=0;
  function heat(){if(elapsed-lastHeatRead<1)return cachedHeat;lastHeatRead=elapsed;const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--world-p'));cachedHeat=Number.isFinite(value)?clamp(value,0,1):0;return cachedHeat;}
  function projectile(slot,x,y,power){
    const life=clamp(.95+rand(0,.55)-heat()*.12,.81,1.52),startX=clamp(x+rand(-W*.46,W*.46),-90,W+90);
    shots.push({slot,x0:startX,y0:-95-rand(0,H*.13),cx:rand(Math.min(startX,x),Math.max(startX,x)),cy:y*rand(.23,.44),x1:x,y1:y,p:0,duration:life,trail:[],power});
    if(shots.length>7)shots.shift();
  }
  function launch(slot){
    const st=siteState[slot], narrow=mobile();
    st.anchor=rand(narrow?.30:.18,narrow?.70:.82);
    st.lift=rand(0,narrow?.085:.16);
    st.node.style.left=(st.anchor*100).toFixed(2)+'%';
    st.node.style.bottom=(st.lift*100).toFixed(2)+'%';
    st.node.classList.remove('revealed','cooling','detonating','vanishing');
    const p=point(slot),power=(slot===1?1.22:1.02)*(narrow?.68:1)*(1+heat()*.65);
    projectile(slot,p.x,p.y,power);st.lastFire=elapsed;
  }
  function launchAmbient(){
    const p=heat(),narrow=mobile();
    let x=0;for(let k=0;k<9;k++){x=W*rand(.045,.955);if(Math.abs(x-lastAmbientX)>W*(narrow?.22:.16))break;}
    lastAmbientX=x;
    const y=stageBottom-stageHeight*rand(.06,.66);
    projectile(-1,x,Math.min(H-18,y),rand(.36,.68)*(1+p*.72)*(narrow?.79:1));
  }
  function impact(s){
    const x=s.x1,y=s.y1,power=s.power,now=elapsed,ambient=s.slot<0;
    if(ambient)ambientHits++;
    bursts.push({x,y,age:0,life:4.8,power,slot:s.slot,noise:rand(0,TAU)});if(bursts.length>3)bursts.shift();
    const n=ambient?(mobile()?4:6):(mobile()?9:13);
    for(let i=0;i<n;i++){
      const ang=rand(0,TAU),offset=rand(2,26)*power;
      const speed=rand(10,48)*power;
      smokes.push({x:x+Math.cos(ang)*offset,y:y+Math.sin(ang)*offset*.19,vx:Math.cos(ang)*speed*(.9+heat()*.4),vy:-rand(35,106)*power,age:-rand(.02,.62),life:rand(3.3,5.9),radius:rand(17,47)*power,expand:rand(12,26),kind:i%5===0?'ash':'smoke',texture:i%3,spin:rand(-.8,.8)});
    }
    // Distinct expanding mushroom head, spawned with delay as the core rises.
    for(let i=0;i<(ambient?(mobile()?2:4):(mobile()?5:7));i++){
      const a=rand(0,TAU),r=rand(2,95)*power;
      smokes.push({x:x+Math.cos(a)*r,y:y-rand(75,115)*power+Math.sin(a)*r*.27,vx:Math.cos(a)*rand(8,35),vy:-rand(15,49)*power,age:-rand(.28,.9),life:rand(3.9,6.3),radius:rand(24,64)*power,expand:rand(16,34),kind:i%7===0?'ash':'smoke',texture:i%3,spin:rand(-.45,.45)});
    }
    for(let i=0;i<(ambient?(mobile()?4:6):(mobile()?8:12));i++){
      const a=rand(0,TAU),speed=rand(90,315)*power;
      fireflies.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(0,140),age:0,life:rand(.55,1.55),size:rand(1.2,4.4),trail:[]});
    }
    for(let i=0;i<(ambient?(mobile()?3:4):(mobile()?5:8));i++){
      rubble.push({x,y,vx:rand(-210,210)*power,vy:-rand(130,320)*power,age:0,life:rand(.8,2.4),size:rand(2,9),angle:rand(-PI,PI),av:rand(-6,6)});
    }
    if(smokes.length>75)smokes.splice(0,smokes.length-75);
    if(fireflies.length>48)fireflies.splice(0,fireflies.length-48);
    if(rubble.length>60)rubble.splice(0,rubble.length-60);
    if(!ambient){
      const state=siteState[s.slot],el=state.node;
      state.lastHit=now;state.firstHit=true;events++;
      if(mobile())sites.forEach((other,idx)=>{if(idx!==s.slot){other.classList.remove('revealed','detonating','cooling','vanishing')}});
      el.classList.remove('revealed','cooling','detonating','vanishing');
      // First flash; then individual glyphs travel out of the impact rubble.
      setTimeout(()=>{if(state.lastHit===now)el.classList.add('revealed','detonating');},200);
      setTimeout(()=>{if(state.lastHit===now)el.classList.remove('detonating');},1730);
      // Hold briefly, then dissolve into smoke and leave absolutely no permanent label.
      setTimeout(()=>{if(state.lastHit===now)el.classList.add('cooling','vanishing');},3350);
      setTimeout(()=>{if(state.lastHit===now)el.classList.remove('revealed','cooling','detonating','vanishing');},5650);
    }
    // If sound has been unlocked, play a short noise-burst explosion in sync with the visual impact.
    try{
      if((!ambient || Math.random()<.23) && document.getElementById('audioLaunch')?.getAttribute('aria-pressed')==='true'){
        const C=window.AudioContext||window.webkitAudioContext;
        if(C){window.__doomBlastAudio=window.__doomBlastAudio||new C();const ac=window.__doomBlastAudio;
          if(ac.state==='suspended')void ac.resume();
          const dur=.31,rate=ac.sampleRate,length=Math.floor(rate*dur),buf=ac.createBuffer(1,length,rate),data=buf.getChannelData(0);
          for(let j=0;j<length;j++){const t=j/rate;data[j]=(Math.random()*2-1)*Math.exp(-t*14)*.58;}
          const src=ac.createBufferSource(),lp=ac.createBiquadFilter(),gain=ac.createGain();lp.type='lowpass';lp.frequency.value=430;
          gain.gain.value=.15;src.buffer=buf;src.connect(lp).connect(gain).connect(ac.destination);src.start();src.stop(ac.currentTime+dur);
        }
      }
    }catch(e){}
  }
  function clouds(dt){
    ctx.save();
    for(let i=smokes.length-1;i>=0;i--){const s=smokes[i];s.age+=dt;if(s.age<0)continue;
      if(s.age>s.life){smokes.splice(i,1);continue;}
      let z=s.age/s.life;s.x+=s.vx*dt*(.6-z*.35);s.y+=s.vy*dt*(.9-z*.2);s.radius+=s.expand*dt;
      const alpha=Math.min(.84,Math.min(1,s.age/.22)*Math.pow(1-z,1.05)*.96);
      const rr=s.radius*(1+.25*z);ctx.globalAlpha=alpha;
      const spriteList=textures[s.kind];const sp=spriteList[s.texture%spriteList.length];
      ctx.drawImage(sp,s.x-rr,s.y-rr,rr*2,rr*2);
    }
    ctx.globalAlpha=1;ctx.restore();
  }
  function flashAndShocks(dt){
    for(let i=bursts.length-1;i>=0;i--){
      const b=bursts[i];b.age+=dt;
      if(b.age>b.life){bursts.splice(i,1);continue;}
      const a=b.age,p=b.power,core=Math.max(0,1-a/1.08);
      const remain=Math.pow(Math.max(0,1-a/b.life),.76)*Math.exp(-a*.39);
      const grow=Math.min(a,3.3),headY=b.y-(48+grow*32)*p,headR=(62+grow*34)*p;
      ctx.save();ctx.globalCompositeOperation='lighter';
      // Prebaked radial fire textures replace three new gradients, costly filters and 20 separate lobes per frame.
      for(let k=0;k<7;k++){
        const th=TAU*k/7+b.noise*.2+Math.sin(a+k)*.05;
        const xx=b.x+Math.cos(th)*headR*.72,yy=headY+Math.sin(th)*headR*.37;
        const r=(54+grow*18)*p*(.85+.12*Math.sin(a*2+k));
        ctx.globalAlpha=remain*(.72+.12*Math.sin(a*3+k));
        ctx.drawImage(textures.flame[k%2],xx-r,yy-r,r*2,r*2);
      }
      for(let k=0;k<5;k++){
        const z=k/5,xx=b.x+Math.sin(k*2.9+a*2)*19*p;
        const yy=b.y-z*(115+grow*36)*p,r=(33+z*43+grow*9)*p;
        ctx.globalAlpha=remain*(.83-z*.14);
        ctx.drawImage(textures.flame[(k+1)%2],xx-r,yy-r,r*2,r*2);
      }
      const groundR=(100+grow*37)*p;
      ctx.globalAlpha=remain*.79;
      ctx.drawImage(textures.flame[0],b.x-groundR,b.y-groundR*.26,groundR*2,groundR*.52);
      if(core>0){
        const rr=(25+170*Math.pow(clamp(a/1.08,0,1),.7))*p;
        ctx.globalAlpha=core*.90;
        ctx.drawImage(textures.flame[1],b.x-rr,b.y-rr,rr*2,rr*2);
      }
      const opacity=Math.max(0,1-a/1.35);
      if(opacity>0){
        const ring=Math.pow(clamp(a/1.35,0,1),.68)*245*p;
        ctx.save();ctx.translate(b.x,b.y);ctx.scale(1,.31);
        ctx.strokeStyle='rgba(255,215,128,'+(opacity*.9)+')';
        ctx.lineWidth=3.5+5*opacity;ctx.beginPath();ctx.arc(0,0,ring,0,TAU);ctx.stroke();ctx.restore();
      }
      ctx.restore();
    }
  }
  function hotDebris(dt){
    for(let i=fireflies.length-1;i>=0;i--){const p=fireflies[i];p.age+=dt;if(p.age>p.life){fireflies.splice(i,1);continue;}
      const t=p.age/p.life;p.vy+=235*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      const alpha=(1-t)*(1-t);ctx.strokeStyle=`rgba(255,${Math.round(145+90*alpha)},${Math.round(45+100*alpha)},${alpha.toFixed(3)})`;
      ctx.lineWidth=Math.max(.7,p.size*(1-t));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*dt*3,p.y-p.vy*dt*3);ctx.stroke();
      ctx.fillStyle=`rgba(255,239,182,${alpha*.95})`;ctx.fillRect(p.x-1,p.y-1,Math.max(1,p.size*.5),Math.max(1,p.size*.5));
    }
    for(let i=rubble.length-1;i>=0;i--){let d=rubble[i];d.age+=dt;if(d.age>d.life){rubble.splice(i,1);continue;}
      d.vy+=390*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.angle+=d.av*dt;
      ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.angle);ctx.globalAlpha=1-d.age/d.life;
      ctx.fillStyle=d.age<.7?'#fc6432':'#291b1a';ctx.fillRect(-d.size/2,-d.size/2,d.size,d.size*1.35);ctx.restore();
    }
  }
  function flight(dt){
    for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.p=Math.min(1,s.p+dt/s.duration);
      const p=s.p,im=1-p;
      const x=im*im*s.x0+2*im*p*s.cx+p*p*s.x1;
      const y=im*im*s.y0+2*im*p*s.cy+p*p*s.y1;
      s.trail.push({x,y});if(s.trail.length>30)s.trail.shift();
      ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowColor='#ff601c';ctx.shadowBlur=8;
      for(let k=1;k<s.trail.length;k++){
        const prev=s.trail[k-1],next=s.trail[k];const alpha=.06+.90*(k/s.trail.length)**1.8;
        ctx.strokeStyle=`rgba(255,${Math.round(55+140*k/s.trail.length)},${Math.round(13+117*k/s.trail.length)},${alpha.toFixed(3)})`;
        ctx.lineWidth=(2+5*k/s.trail.length)*s.power;
        ctx.beginPath();ctx.moveTo(prev.x,prev.y);ctx.lineTo(next.x,next.y);ctx.stroke();
      }
      ctx.fillStyle='#fff7d1';ctx.beginPath();ctx.arc(x,y,(4+2*heat())*s.power,0,TAU);ctx.fill();ctx.restore();
      if(p>=1){shots.splice(i,1);impact(s);}
    }
  }
  // Continuous environmental storytelling independent of meteor impacts.
  // Ruined towers, crawling molten fire, smoke fronts and ash all worsen with time.
  function environment(p){
    const baseline=stageBottom-stageHeight*.10,top=stageBottom-stageHeight*.94;
    const t=elapsed;ctx.save();
    let haze=ctx.createLinearGradient(0,top,0,stageBottom);
    haze.addColorStop(0,'rgba(255,55,16,0)');
    haze.addColorStop(.52,'rgba(126,29,16,'+(.065+p*.15)+')');
    haze.addColorStop(1,'rgba(255,74,16,'+(.16+p*.26)+')');
    ctx.fillStyle=haze;ctx.fillRect(0,top,W,stageHeight*1.08);
    // Thundercloud banks drift horizontally, visibly independent of the fixed backdrop.
    for(let i=0;i<5;i++){
      const bankX=((i/8+Math.sin(t*.05+i)*.04)%1)*W;
      const bankY=top+stageHeight*(.09+(i%3)*.14);
      const rr=W*(.14+.07*Math.sin(i*4.1)**2);
      ctx.globalAlpha=(.22+p*.24)*(.78+.22*Math.sin(t*.12+i));
      ctx.drawImage(textures.smoke[i%3],bankX-rr,bankY-rr*.55,rr*2,rr*1.1);
    }
    // Destroyed skyline, different silhouettes rather than a flat black background.
    ctx.globalAlpha=1;
    for(let i=0;i<ruins.length;i++){
      const b=ruins[i],x=b.u*W,w=Math.max(7,b.w*W),h=stageHeight*b.h*(.9+p*.36);
      ctx.fillStyle='rgba(7,3,5,'+(.66+p*.22)+')';
      ctx.fillRect(x-w*.5,baseline-h,w,h+stageHeight*.28);
      if(i%4===0){ctx.fillStyle='rgba(10,3,5,.94)';
        ctx.beginPath();ctx.moveTo(x-w*.5,baseline-h);ctx.lineTo(x-w*.28,baseline-h-15);ctx.lineTo(x+w*.08,baseline-h+4);ctx.lineTo(x+w*.5,baseline-h-7);ctx.lineTo(x+w*.5,baseline);ctx.lineTo(x-w*.5,baseline);ctx.fill();}
      if(i%3===0){const flick=.35+.35*(.5+.5*Math.sin(t*2.7+b.seed));
        ctx.fillStyle='rgba(255,91,24,'+(flick*(.47+p*.45))+')';
        ctx.fillRect(x-w*.22,baseline-h*.57,Math.max(2,w*.17),Math.max(3,h*.06));}
    }
    // Real animated fires at different skyline positions, their height and intensity grow with the deadline.
    ctx.globalCompositeOperation='screen';
    for(let i=0;i<braziers.length;i++){
      const f=braziers[i],x=f.u*W,root=baseline+stageHeight*f.y;
      const dance=Math.sin(t*3.2+f.seed)+.6*Math.sin(t*6.7+f.seed*3);
      const r=(20+stageHeight*.055)*f.sz*(1+p*.95);
      ctx.globalAlpha=(.46+p*.38)*(.74+.12*dance);
      ctx.drawImage(textures.flame[i%2],x-r,root-r*(1.95+.18*dance),r*2,r*(2.5+.33*dance));
      ctx.globalAlpha=(.18+p*.28);
      ctx.drawImage(textures.ash[i%2],x-r*1.45,root-r*3.0-t*3%33,r*2.9,r*2.7);
    }
    ctx.restore();
  }
  function scheduleFrame(){if(onscreen&&!reduced){const interval=!document.hasFocus()?190:mobile()?(elapsed>45?165:116):(elapsed>45?142:82);renderTimer=setTimeout(()=>requestAnimationFrame(render),interval);}}
  function render(time){
    if(!onscreen)return;
    scheduleFrame();
    if(!prev){prev=time;startTime=startTime||time;return;}const dt=clamp((time-prev)/1000,0,.19);prev=time;elapsed=(time-startTime)/1000;frame++;
    const every=1;
    const p=heat();
    if(elapsed>nextAmbient){launchAmbient();nextAmbient=elapsed+rand(Math.max(2.2,4.6-p*1.85),Math.max(3.6,6.9-p*2.15));}
    for(let i=0;i<3;i++)if(elapsed>nextShots[i]){
      launch(i);nextShots[i]=elapsed+rand(Math.max(5.8,11.2-p*3.9),Math.max(8.5,15.5-p*5.0));
    }
    ctx.clearRect(0,0,W,H);
    // The detailed city now lives in the cached SVG layer, not rebuilt every frame.
    clouds(dt*every);
    ctx.save();ctx.globalCompositeOperation='lighter';flight(dt*every);flashAndShocks(dt*every);hotDebris(dt*every);ctx.restore();
  }
  document.addEventListener('visibilitychange',()=>{onscreen=!document.hidden;prev=0;if(!onscreen){clearTimeout(renderTimer);shots.length=0;fireflies.length=0;rubble.length=0;}else if(!reduced){requestAnimationFrame(render);}});
  addEventListener('pagehide',()=>{onscreen=false;clearTimeout(renderTimer);});
  addEventListener('resize',place,{passive:true});place();
  window.__kimsdayImpactV7={get state(){return {shots:shots.length,bursts:bursts.length,smoke:smokes.length,particles:fireflies.length,renderScale:dpr,targetFps:mobile()?8:11,hits:events,ambientHits,impactSites:siteState.map(st=>({x:st.anchor,y:st.lift})),lettersVisible:sites.map(x=>x.classList.contains('revealed')&&!x.classList.contains('vanishing')),elapsed:Math.round(elapsed*10)/10};},trigger(index){launch(clamp(index|0,0,2));}};
  if(reduced){sites.forEach(s=>s.classList.remove('revealed','cooling','detonating','vanishing'));}
  else requestAnimationFrame(render);
})();
