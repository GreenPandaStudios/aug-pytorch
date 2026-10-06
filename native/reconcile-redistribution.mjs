// Bounded, package-specific attribution and unchanged-upstream gate.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=file=>hash(readFileSync(file));
const sorted=value=>Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
export function reconcileRedistribution(root,output,host,upstreamFiles) {
  const lock=JSON.parse(readFileSync(join(root,'native/redistribution.lock.json')));
  const manifest=JSON.parse(readFileSync(join(root,'aug-package.json')));
  const artifact=manifest.native.artifacts.find(artifact=>artifact.id===host);
  assert.ok(artifact,'Missing declared target: '+host);
  const declared=[...new Set([...artifact.link.libraries,...artifact.runtime.files])].sort();
  assert.deepEqual(declared,lock.requiredRuntimeFiles[host],'Declared target closure differs from reviewed requirements');
  const inventoryPath='licenses/provenance.json',inventoryFile=join(output,inventoryPath);
  assert.equal(digest(inventoryFile),lock.baseNoticeInventorySha256,'Collected notice inventory changed');
  const inventory=JSON.parse(readFileSync(inventoryFile)),notices={};
  for(const file of [...inventory.files,...lock.additionalNotices.filter(file=>file.targets.includes(host))]) {
    const path='licenses/'+file.output,bytes=readFileSync(join(output,path));
    assert.equal(hash(bytes),file.sha256,'Required component notice changed: '+path);
    assert.equal(bytes.length,file.bytes,'Required component notice length differs: '+path);
    notices[path]=file.sha256;
  }
  for(const [path,sha256] of Object.entries(lock.directNotices)) {
    assert.equal(digest(join(output,path)),sha256,'Copied upstream notice changed: '+path);notices[path]=sha256;
  }
  assert.deepEqual(sorted(upstreamFiles),sorted(lock.upstreamLibraries[host]),'Original upstream binary set differs from reviewed input');
  const runtime=JSON.parse(readFileSync(join(output,'runtime-files.json'))).files;
  assert.deepEqual(runtime.map(file=>file.path).sort(),readdirSync(join(output,'lib')).map(file=>'lib/'+file).sort(),'Runtime closure is incomplete');
  assert.deepEqual(runtime.map(file=>file.path).sort(),declared,'Required declared link/runtime dependency is absent');
  const libraries={};
  for(const file of runtime) {
    assert.equal(digest(join(output,file.path)),file.sha256,'Final runtime binary differs from inspected closure: '+file.path);
    libraries[file.path]=file.sha256;
  }
  for(const [file,sha256] of Object.entries(upstreamFiles))
    assert.equal(libraries['lib/'+file],sha256,'Upstream library bytes must remain unchanged: '+file);
  const materials={...notices,[inventoryPath]:lock.baseNoticeInventorySha256};
  if(host.startsWith('linux-')) {
    const gnu=JSON.parse(readFileSync(join(output,'sources/gnu-redistribution.json')));
    assert.equal(gnu.libstdcxx.regressionPassed,true,'GNU runtime regression evidence absent');
    assert.equal(gnu.libstdcxx.correction.advisory,'CVE-2026-95619','GNU runtime correction absent');
    const required={...lock.gnuRequiredMaterials,
      'sources/prepare-linux-runtimes.mjs':digest(join(root,'native/prepare-linux-runtimes.mjs')),
      'sources/linux-runtimes.lock.json':digest(join(root,'native/linux-runtimes.lock.json')),
      'sources/Linux-runtime-BUILD.md':digest(join(root,'native/GNU_RUNTIME_BUILD.md'))};
    for(const [file,sha256] of Object.entries(required))assert.equal(gnu.files[file],sha256,'Required source-owned GNU material differs or is absent: '+file);
    assert.equal(gnu.libstdcxx.identity.patchSha256,required['sources/gcc12-aligned-new.patch']);
    assert.equal(gnu.libstdcxx.identity.recipeSha256,required['sources/prepare-patched-libstdcxx.mjs']);
    assert.equal(gnu.libstdcxx.identity.testSha256,required['sources/aligned-new-overflow.cpp']);
    for(const [file,sha256] of Object.entries(gnu.files)) {
      assert.equal(digest(join(output,file)),sha256,'Shipped GNU material differs: '+file);
      materials[file]=sha256;
    }
    for(const file of ['sources/gcc12-aligned-new.patch','sources/prepare-patched-libstdcxx.mjs','sources/aligned-new-overflow.cpp'])
      assert.ok(materials[file],'GNU corresponding source material omitted: '+file);
  }
  const record={format:1,host,scope:lock.scope,pytorchRevision:lock.pytorchRevision,
    upstreamBinaryPreservation:sorted(upstreamFiles),runtimeFiles:sorted(libraries),reviewedMaterials:sorted(materials),
    completeness:'bounded reviewed closure and known/conservative component texts; not an exhaustive static link map or legal clearance'};
  writeFileSync(join(output,'redistribution-review.json'),JSON.stringify(record,null,2)+'\n');
  return record;
}
