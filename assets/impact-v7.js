/* KIM'S DAY V7 -- procedurally animated artillery impact + smoke + debris + forged dying messages. */
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
  let W=0,H=0,dpr=1,stageBottom=0,stageHeight=0,elapsed=0,prev=0,frame=0;
  let shots=[],bursts=[],smokes=[],fireflies=[],rubble=[];
  let nextShots=[.16,.82,1.48],events=0,onscreen=true;let startTime=0,lastPaint=0;
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
  const siteState=sites.map((node,i)=>({node,i,lastHit:-99,lastFire:-99,firstHit:false}));
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
    dpr=Math.min(1.6,devicePixelRatio||1);W=innerWidth;
    const page=document.querySelector('.page');H=Math.max(innerHeight,page.offsetHeight);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
    const box=stage.getBoundingClientRect();stageBottom=box.bottom+scrollY;stageHeight=box.height;
  }
  function point(i){return {x:W*focus[i],y:Math.min(H-16,stageBottom-stageHeight*.075)};}
  function heat(){const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--world-p'));return Number.isFinite(value)?clamp(value,0,1):0;}
  function launch(slot){
    const p=point(slot),scale=mobile()?.72:1;const life=clamp(1.1+(1-heat())*.25,1.05,1.4);
    const startX=clamp(p.x+rand(-W*.36,W*.36),-50,W+50);
    shots.push({slot,x0:startX,y0:-80-rand(0,100),cx:rand(Math.min(startX,p.x),Math.max(startX,p.x)),cy:p.y*.33,x1:p.x,y1:p.y,p:0,duration:life,trail:[],power:(slot===1?1.34:1.03)*scale*(1+heat()*.7)});
    if(shots.length>7)shots.shift();siteState[slot].lastFire=elapsed;
  }
  function impact(s){
    const {x,y}=point(s.slot),power=s.power,now=elapsed;
    bursts.push({x,y,age:0,life:5.4,power,slot:s.slot,noise:rand(0,TAU)});
    const n=mobile()?34:58;
    for(let i=0;i<n;i++){
      const ang=rand(0,TAU),offset=rand(2,26)*power;
      const speed=rand(10,48)*power;
      smokes.push({x:x+Math.cos(ang)*offset,y:y+Math.sin(ang)*offset*.19,vx:Math.cos(ang)*speed*(.9+heat()*.4),vy:-rand(35,106)*power,age:-rand(.02,.62),life:rand(3.3,5.9),radius:rand(17,47)*power,expand:rand(12,26),kind:i%5===0?'ash':'smoke',texture:i%3,spin:rand(-.8,.8)});
    }
    // Distinct expanding mushroom head, spawned with delay as the core rises.
    for(let i=0;i<(mobile()?18:33);i++){
      const a=rand(0,TAU),r=rand(2,95)*power;
      smokes.push({x:x+Math.cos(a)*r,y:y-rand(75,115)*power+Math.sin(a)*r*.27,vx:Math.cos(a)*rand(8,35),vy:-rand(15,49)*power,age:-rand(.28,.9),life:rand(3.9,6.3),radius:rand(24,64)*power,expand:rand(16,34),kind:i%7===0?'ash':'smoke',texture:i%3,spin:rand(-.45,.45)});
    }
    for(let i=0;i<(mobile()?46:75);i++){
      const a=rand(0,TAU),speed=rand(90,315)*power;
      fireflies.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(0,140),age:0,life:rand(.55,1.55),size:rand(1.2,4.4),trail:[]});
    }
    for(let i=0;i<(mobile()?15:26);i++){
      rubble.push({x,y,vx:rand(-210,210)*power,vy:-rand(130,320)*power,age:0,life:rand(.8,2.4),size:rand(2,9),angle:rand(-PI,PI),av:rand(-6,6)});
    }
    if(smokes.length>410)smokes.splice(0,smokes.length-410);
    if(fireflies.length>300)fireflies.splice(0,fireflies.length-300);
    if(rubble.length>150)rubble.splice(0,rubble.length-150);
    const state=siteState[s.slot],el=state.node;
    state.lastHit=now;state.firstHit=true;events++;
    if(mobile())sites.forEach((other,idx)=>{if(idx!==s.slot){other.classList.remove('revealed','detonating','cooling')}});
    el.classList.remove('revealed','cooling','detonating');
    // The flash is visible first; the surviving words appear inside its smoke 180 ms later.
    setTimeout(()=>{el.classList.add('revealed','detonating');},185);
    setTimeout(()=>{el.classList.remove('detonating');},1650);
    setTimeout(()=>{if(state.lastHit===now)el.classList.add('cooling');},5900);
    // If sound has been unlocked, play a short noise-burst explosion in sync with the visual impact.
    try{
      if(document.getElementById('audioLaunch')?.getAttribute('aria-pressed')==='true'){
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
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.age+=dt;if(b.age>b.life){bursts.splice(i,1);continue;}
      const a=b.age,p=b.power,core=Math.max(0,1-a/1.22);
      // Animated expanding mushroom fireball: every lobe changes position, size and glow per frame.
      // The fire lasts several seconds after the initial flash; it is never a background picture.
      const remaining=Math.pow(Math.max(0,1-a/b.life),.72),fireRemain=remaining*Math.exp(-a*.50),grow=Math.min(a,3.8);
      const headY=b.y-(48+grow*34)*p,headR=(64+grow*37)*p;
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(let k=0;k<11;k++){
        const th=TAU*k/11+b.noise*.2+Math.sin(a*1.4+k)*.07;
        const f=.68+.3*Math.sin(a*2.7+k*1.8);
        const xx=b.x+Math.cos(th)*headR*.81,yy=headY+Math.sin(th)*headR*.40;
        const rad=(60+grow*19)*p*f;
        ctx.globalAlpha=fireRemain*(.8+.13*Math.sin(a*4+k));
        const sp=textures.flame[k%2];ctx.drawImage(sp,xx-rad,yy-rad,rad*2,rad*2);
      }
      // Staggered vertical stem of incandescent gas and smoke climbing from the actual crater.
      for(let k=0;k<9;k++){
        const z=k/9,xx=b.x+Math.sin(k*2.9+a*2)*23*p;
        const yy=b.y-z*(118+grow*36)*p;
        const rr=(32+z*39+grow*8)*p;
        ctx.globalAlpha=fireRemain*(.83-z*.17);
        ctx.drawImage(textures.flame[(k+1)%2],xx-rr,yy-rr,rr*2,rr*2);
      }
      ctx.restore();ctx.globalAlpha=1;
      // Continuous molten ground fire after the concussion; the crater visibly cools.
      const groundR=(90+Math.min(3.8,a)*42)*p;
      const gl=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,groundR);
      gl.addColorStop(0,`rgba(255,238,162,${fireRemain*.77})`);
      gl.addColorStop(.25,`rgba(255,130,35,${fireRemain*.58})`);
      gl.addColorStop(.65,`rgba(222,48,9,${fireRemain*.22})`);
      gl.addColorStop(1,'rgba(151,16,3,0)');
      ctx.save();ctx.translate(b.x,b.y);ctx.scale(1,.26);ctx.fillStyle=gl;
      ctx.beginPath();ctx.arc(0,0,groundR,0,TAU);ctx.fill();ctx.restore();
      if(core>0){const radius=(28+195*Math.pow(clamp(a/1.22,0,1),.67))*p;const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,radius);
        g.addColorStop(0,`rgba(255,252,218,${core*.95})`);g.addColorStop(.13,`rgba(255,221,113,${core*.92})`);g.addColorStop(.48,`rgba(255,74,9,${core*.48})`);g.addColorStop(1,'rgba(255,20,4,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,radius,0,TAU);ctx.fill();
      }
      let ring=Math.pow(clamp(a/1.42,0,1),.68)*270*p,opacity=Math.pow(1-a/1.42,1.5);
      if(opacity>0){ctx.save();ctx.translate(b.x,b.y);ctx.scale(1,.32);
        ctx.shadowColor='#ff7d32';ctx.shadowBlur=22;ctx.strokeStyle=`rgba(255,215,128,${opacity*.92})`;ctx.lineWidth=4+5*opacity;ctx.beginPath();ctx.arc(0,0,ring,0,TAU);ctx.stroke();ctx.restore();}
      const spread=clamp(a/1.5,0,1),r=95*p+235*p*spread;
      let haze=ctx.createRadialGradient(b.x,b.y,1,b.x,b.y,r);haze.addColorStop(0,`rgba(255,91,18,${Math.max(0,.20-a*.12)})`);haze.addColorStop(.48,`rgba(255,38,7,${Math.max(0,.13-a*.065)})`);haze.addColorStop(1,'rgba(255,24,0,0)');
      ctx.fillStyle=haze;ctx.fillRect(b.x-r,b.y-r,r*2,r*2);
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
      ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowColor='#ff601c';ctx.shadowBlur=24;
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
  function render(time){
    requestAnimationFrame(render);
    if(!onscreen)return;
    if(!prev){prev=time;startTime=startTime||time;return;}const dt=clamp((time-prev)/1000,0,.19);prev=time;elapsed=(time-startTime)/1000;frame++;
    const every=mobile()?2:1;if(frame%every!==0)return;
    const p=heat();
    for(let i=0;i<3;i++)if(elapsed>nextShots[i]){
      launch(i);nextShots[i]=elapsed+rand(Math.max(2.45,9.2-p*6.2),Math.max(3.1,11.0-p*7.4));
    }
    ctx.clearRect(0,0,W,H);
    clouds(dt*every);
    ctx.save();ctx.globalCompositeOperation='lighter';flight(dt*every);flashAndShocks(dt*every);hotDebris(dt*every);ctx.restore();
  }
  document.addEventListener('visibilitychange',()=>{onscreen=!document.hidden;prev=0;});
  addEventListener('resize',place,{passive:true});place();
  window.__kimsdayImpactV7={get state(){return {shots:shots.length,bursts:bursts.length,smoke:smokes.length,particles:fireflies.length,hits:events,lettersVisible:sites.map(x=>x.classList.contains('revealed')),elapsed:Math.round(elapsed*10)/10};},trigger(index){launch(clamp(index|0,0,2));}};
  if(reduced){sites.forEach(s=>s.classList.add('revealed'));sites.forEach(s=>s.querySelectorAll('.death-glyph').forEach(g=>{g.style.opacity='1'}));}
  else requestAnimationFrame(render);
})();
