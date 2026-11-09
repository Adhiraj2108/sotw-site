import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
const source = stripTypeScriptTypes(readFileSync(new URL('../src/components/ProjectWall.astro', import.meta.url),'utf8').split('<script>')[1].split('</script>')[0]).replace('import("hls.js/light")','loadHls()');
function setup({ native = false, deferred = false } = {}) {
  const classes=new Set(), listeners={}, events={};
  let instance, finishImport;
  class Hls {
    static Events={ MANIFEST_PARSED:'parsed', ERROR:'error' };
    static isSupported=()=>true;
    constructor(config){ this.config=config; this.listeners={}; this.levels=[{height:360},{height:1080},{height:240},{height:720}]; instance=this; }
    on(event,callback){ this.listeners[event]=callback; }
    loadSource(url){ this.url=url; }
    attachMedia(){ queueMicrotask(()=>this.listeners.parsed()); }
    startLoad(){ this.started=true; }
    destroy(){ this.destroyed=true; }
  }
  const video={
    dataset:{stream:'https://assets.example/media/project-video-1/playlist.m3u8'},
    readyState:0, paused:true, playCalls:0,
    canPlayType:()=>native?'probably':'',
    async play(){ this.playCalls++; this.paused=false; this.readyState=2; events.playing(); },
    pause(){ this.paused=true; },
    addEventListener:(name,callback)=>events[name]=callback,
    requestVideoFrameCallback(callback){ this.frame=callback; return 1; },
    cancelVideoFrameCallback(){ this.frame=null; },
  };
  const card={querySelector:()=>video, classList:{add:c=>classes.add(c), remove:c=>classes.delete(c)}, addEventListener:(name,callback)=>listeners[name]=callback};
  const loadHls=()=>deferred?new Promise(resolve=>finishImport=()=>resolve({default:Hls})):Promise.resolve({default:Hls});
  runInNewContext(source,{ document:{querySelectorAll:()=>[card]}, URL, loadHls });
  return { video, listeners, classes, get hls(){return instance;}, finishImport:()=>finishImport() };
}
test('HLS starts at the actual 720p level and reveals only after a rendered frame',async()=>{
  const s=setup(); await s.listeners.pointerenter();
  assert.equal(s.hls.config.autoStartLoad,false);assert.equal(s.hls.config.testBandwidth,false);
  assert.equal(s.hls.startLevel,3);assert.equal(s.hls.loadLevel,3);assert.equal(s.hls.started,true);
  assert.equal(s.classes.has('playing'),false);
  s.video.frame();assert.equal(s.classes.has('playing'),true);assert.equal(s.hls.loadLevel,-1);
  s.listeners.pointerleave();assert.equal(s.video.paused,true);assert.equal(s.classes.has('playing'),false);
});
test('native HLS uses the 720p rendition and retains its cover until a frame arrives',async()=>{
  const s=setup({native:true});await s.listeners.focus();
  assert.equal(s.video.src,'https://assets.example/media/project-video-1/720p/video.m3u8');
  assert.equal(s.classes.has('playing'),false);s.video.frame();assert.equal(s.classes.has('playing'),true);
  s.listeners.blur();assert.equal(s.classes.has('playing'),false);
});
test('leaving during async initialization prevents late playback and cancelled frames stay covered',async()=>{
  const s=setup({deferred:true});const pending=s.listeners.pointerenter();s.listeners.pointerleave();s.finishImport();await pending;
  assert.equal(s.video.playCalls,0);assert.equal(s.classes.has('playing'),false);
  await s.listeners.pointerenter();const frame=s.video.frame;s.listeners.pointerleave();frame();
  assert.equal(s.classes.has('playing'),false);assert.equal(s.video.frame,null);
});
