#!/usr/bin/env node
// Mutation controls on a task-owned built artifact; every changed byte is restored.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,openSync,readSync,writeSync,closeSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {reconcileRedistribution} from '../native/reconcile-redistribution.mjs';
const root=resolve(import.meta.dirname,'..'),output=resolve(process.argv[2]);
const reviewPath=join(output,'redistribution-review.json');
const baseline=readFileSync(reviewPath),review=JSON.parse(baseline),host=review.host;
const reconcile=()=>reconcileRedistribution(root,output,host,review.upstreamBinaryPreservation);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(reconcile(),review);
function corrupt(path,extra) {
  const file=join(output,path),descriptor=openSync(file,'r+'),byte=Buffer.alloc(1);
  readSync(descriptor,byte,0,1,0);
  const changed=Buffer.from([byte[0]^1]);
  let restore;
  try {
    writeSync(descriptor,changed,0,1,0);
    restore=extra?.();
    assert.throws(reconcile,undefined,'A changed material must reject: '+path);
    assert.equal(readFileSync(reviewPath).equals(baseline),true,'Failed reconciliation replaced accepted evidence');
  } finally {
    writeSync(descriptor,byte,0,1,0);closeSync(descriptor);restore?.();
  }
  assert.deepEqual(reconcile(),review);
}
const notices=Object.keys(review.reviewedMaterials).filter(path=>path.startsWith('licenses/'));
corrupt(notices[0]);
if(host.startsWith('linux-')) {
  corrupt(notices.find(path=>path.includes('linux-cpu/')));
  const gnuPath=join(output,'sources/gnu-redistribution.json');
  const pair=path=>{const saved=readFileSync(gnuPath),gnu=JSON.parse(saved);
    gnu.files[path]=sha(readFileSync(join(output,path)));writeFileSync(gnuPath,JSON.stringify(gnu));
    return ()=>writeFileSync(gnuPath,saved);};
  corrupt('sources/gcc12-aligned-new.patch',()=>pair('sources/gcc12-aligned-new.patch'));
  corrupt('sources/gcc-12_12.2.0.orig.tar.gz',()=>pair('sources/gcc-12_12.2.0.orig.tar.gz'));
  const saved=readFileSync(gnuPath),gnu=JSON.parse(saved);
  try {delete gnu.files['sources/gcc-12_12.2.0.orig.tar.gz'];writeFileSync(gnuPath,JSON.stringify(gnu));assert.throws(reconcile);}
  finally{writeFileSync(gnuPath,saved);}
}
const original=Object.keys(review.upstreamBinaryPreservation)[0],closurePath=join(output,'runtime-files.json');
corrupt('lib/'+original,()=>{
  const saved=readFileSync(closurePath),closure=JSON.parse(saved);
  closure.files.find(file=>file.path==='lib/'+original).sha256=sha(readFileSync(join(output,'lib',original)));
  writeFileSync(closurePath,JSON.stringify(closure));
  return ()=>writeFileSync(closurePath,saved);
});
const closure=JSON.parse(readFileSync(closurePath)),saved=readFileSync(closurePath);
const adapter=JSON.parse(readFileSync(join(root,'aug-package.json'))).native.artifacts.find(artifact=>artifact.id===host).link.libraries[0];
const adapterPath=join(output,adapter),aside=join(output,'.omitted-adapter');
try {
 renameSync(adapterPath,aside);
 writeFileSync(closurePath,JSON.stringify({...closure,files:closure.files.filter(file=>file.path!==adapter)}));
 assert.throws(reconcile,undefined,'Coherent directory/inspection omission of the required adapter must reject');
 assert.equal(readFileSync(reviewPath).equals(baseline),true);
}finally{renameSync(aside,adapterPath);writeFileSync(closurePath,saved);}
try {
  closure.files.pop();writeFileSync(closurePath,JSON.stringify(closure));
  assert.throws(reconcile,undefined,'An omitted runtime dependency must reject');
  assert.equal(readFileSync(reviewPath).equals(baseline),true);
}finally{writeFileSync(closurePath,saved);}
assert.deepEqual(reconcile(),review);
console.log('Redistribution gate rejects changed notices, upstream binaries and omitted closure members'+(host.startsWith('linux-')?', source archives and patches':''));
