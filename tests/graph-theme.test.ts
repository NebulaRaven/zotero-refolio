import { script } from './source.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await script(new URL('../src/upstream/features/collections/graphView.ts',import.meta.url));
const themeSource=await script(new URL('../src/app/graphTheme.ts',import.meta.url));
function setup(preference=2,dark=false) {
  const handlers=new Set<(event: { matches: boolean }) => void>();let observer,redraws=0,unregistered=0;
  const media={matches:dark,addEventListener:(_type,cb)=>handlers.add(cb),removeEventListener:(_type,cb)=>handlers.delete(cb)};
  const prefs={get:()=>preference,registerObserver:(key,cb,global)=>{
    assert.equal(key,'browser.theme.toolbar-theme');assert.equal(global,true);observer=cb;return 0;
  },unregisterObserver:id=>{assert.equal(id,0);observer=null;unregistered++;}};
  const sandbox: vm.Context = {Zotero:{Prefs:prefs},window:{matchMedia:query=>{
    assert.equal(query,'(prefers-color-scheme: dark)');return media;
  },removeEventListener:()=>{}},addon:{api:{}},ztoolkit:{log:()=>{}}};
  const overrides={};
  const doc={defaultView:{getComputedStyle:element=>{
    const dark=view.container.style.colorScheme==='dark';
    const tokens={
      '--material-background':dark?'rgb(30, 30, 30)':'rgb(255, 255, 255)',
      '--color-border':dark?'rgba(255, 255, 255, 0.18)':'rgba(0, 0, 0, 0.15)',
      '--fill-primary':dark?'rgba(255, 255, 255, 0.9)':'rgba(0, 0, 0, 0.85)',
      '--fill-secondary':dark?'rgba(255, 255, 255, 0.55)':'rgba(0, 0, 0, 0.55)',
      '--accent-blue':'rgb(64, 114, 229)', '--accent-teal':'rgb(89, 173, 196)',
      '--accent-orange':'rgb(255, 121, 76)', '--accent-green':'rgb(57, 191, 104)',...overrides
    };
    return {color:tokens[element.style.color?.match(/var\(([^,]+)/)?.[1]],fontFamily:'Segoe UI'};
  }}};
  sandbox.spElement=()=>({style:{} as Record<string, string>,remove(){}});
  vm.runInNewContext(themeSource,sandbox);
  vm.runInNewContext(source,sandbox);
  const view=Object.create(sandbox.GraphView.prototype);
  const frame={documentElement:{style:{} as Record<string, string>},body:{style:{} as Record<string, string>}};
  Object.assign(view,{active:true,cleanups:[],timers:new Set(),animationFrames:new Set(),_prefObserverID:null,
    mode:'related',container:{style:{} as Record<string, string>,ownerDocument:doc,remove:()=>{}},resizer:{style:{} as Record<string, string>},
    renderer:{containerEl:{style:{} as Record<string, string>,ownerDocument:frame},testCSS:()=>redraws++,destroy:()=>{}}});
  return {view,frame,overrides,handlers,
    get redraws(){return redraws;},get unregistered(){return unregistered;},
    preference(value){preference=value;observer?.();},
    system(value){media.matches=value;for(const cb of handlers)cb({matches:value});}};
}

test('graph follows a dark system theme in Auto and respects explicit Light and Dark',()=>{
  const ctx: vm.Context = setup(2,true);const {view,frame}=ctx;
  view.observeTheme();
  assert.equal(view.getTheme(),'dark');
  assert.equal(view.container.style.backgroundColor,'rgb(30, 30, 30)');
  assert.equal(frame.body.style.color,'rgba(255, 255, 255, 0.9)');
  assert.equal(frame.documentElement.style.colorScheme,'dark');
  ctx.preference(1);
  assert.equal(view.getTheme(),'light');
  assert.equal(frame.body.style.backgroundColor,'rgb(255, 255, 255)');
  ctx.system(false);ctx.preference(0);
  assert.equal(view.getTheme(),'dark');
  ctx.system(true);ctx.preference(2);
  assert.equal(view.getTheme(),'dark');
  ctx.system(false);
  assert.equal(view.getTheme(),'light');
  assert.equal(frame.documentElement.style.backgroundColor,'rgb(255, 255, 255)');
});

test('live theme changes use host colors and fonts for the renderer and iframe',()=>{
  const ctx: vm.Context = setup(2,false);const {view,frame,overrides}=ctx;
  view.observeTheme();
  const before=ctx.redraws;
  view.mode='author';ctx.system(true);
  assert.ok(ctx.redraws>before);
  assert.equal(view.renderer.colors.text.rgb,0xffffff);
  assert.equal(view.renderer.containerEl.style.backgroundColor,frame.body.style.backgroundColor);
  assert.equal(view.container.style.backgroundColor,frame.documentElement.style.backgroundColor);
  assert.equal(view.renderer.fontFamily,'Segoe UI');
  assert.equal(frame.body.style.fontFamily,'Segoe UI');
  overrides['--accent-blue']='rgb(123, 45, 67)'; view.setTheme();
  assert.equal(view.renderer.colors.fillFocused.rgb,0x7b2d43);
});

test('dark graph text and links maintain contrast after alpha blending',()=>{
  const {view}=setup(0,false);view.setTheme();
  const rgb=n=>[n>>16&255,n>>8&255,n&255];
  const luminance=channels=>channels.map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4)
    .reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
  const background=view.container.style.backgroundColor.match(/\d+/g).map(Number);
  const contrast=color=>{
    const foreground=rgb(color.rgb).map((c,i)=>c*color.a+background[i]*(1-color.a));
    const a=luminance(foreground),b=luminance(background);
    return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  };
  assert.ok(contrast(view.renderer.colors.text)>=4.5);
  for(const key of ['line','fill','fillTag','fillFocused','fillUnresolved']) assert.ok(contrast(view.renderer.colors[key])>=3,key);
});

test('graph unload removes system and preference theme listeners, including observer ID zero',()=>{
  const ctx: vm.Context = setup();const {view}=ctx;
  view.observeTheme();assert.equal(ctx.handlers.size,1);
  view.destroy();
  assert.equal(ctx.handlers.size,0);assert.equal(ctx.unregistered,1);
  const previous=ctx.redraws;
  ctx.system(true);ctx.preference(0);view.setTheme();view.destroy();
  assert.equal(ctx.redraws,previous);assert.equal(ctx.unregistered,1);
});
