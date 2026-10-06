#!/usr/bin/env node
// Explicit native maintainer build. No package installation executes this recipe.
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,cpSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {nativeSourceIdentity} from './source-identity.mjs';
import {prepareLinuxRuntimes} from './prepare-linux-runtimes.mjs';
import {reconcileRedistribution} from './reconcile-redistribution.mjs';
const root=resolve(import.meta.dirname,'..'),arch=process.arch;
if(process.platform!=='linux'||!['x64','arm64'].includes(arch))throw Error('GNU/Linux x86-64 or ARM64 maintainer required');
const triple=(arch==='x64'?'x86_64':'aarch64')+'-unknown-linux-gnu';
const manifest=JSON.parse(readFileSync(join(root,'aug-package.json'))),lock=JSON.parse(readFileSync(join(root,'native/sources.lock.json')));
const name=manifest.name.split('/').at(-1).slice(4);
const cache=join(root,'.aug-build/native-linux-'+arch),out=join(cache,'artifact');
mkdirSync(cache,{recursive:true});rmSync(out,{recursive:true,force:true});for(const path of ['lib','licenses','sources'])mkdirSync(join(out,path),{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(command,args,options={})=>{const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:10000000,...options});if(result.status!==0)throw Error(command+': '+(result.stderr||result.error?.message));return result.stdout.replaceAll(root,'/aug-native/aug-'+name);};
const download=async(input,file)=>{if(!existsSync(file)){const response=await fetch(input.url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error('Pinned upstream input unavailable: '+input.url);const bytes=Buffer.from(await response.arrayBuffer());if(hash(bytes)!==input.sha256)throw Error('Upstream download digest differs');writeFileSync(file,bytes);}if(hash(readFileSync(file))!==input.sha256)throw Error('Upstream cached input changed');};
const cc=process.env.AUG_CC??'clang',cpp=process.env.AUG_CXX??'clang++';
const flags=['-O2','-g','-fPIC','-fvisibility=hidden','-ffile-prefix-map='+root+'=/aug-native/aug-'+name,'-I'+join(root,'native/include'),...(arch==='x64'?['-march=x86-64','-mtune=generic']:['-march=armv8-a'])];
const stem={pytorch:'torch',sqlite:'sqlite',zlib:'zlib',blake3:'blake3'}[name],library='lib/libaug_'+stem+'.so.1',target=join(out,library),shared=['-shared','-Wl,-soname,'+basename(library),'-Wl,-rpath,$ORIGIN','-pthread'];
let upstream,input=lock.inputs[0],cpuComponents=[];
const preservedUpstream=new Map();
if(name!=="pytorch")throw Error('This recipe only builds aug-pytorch');
{
const pins=JSON.parse(readFileSync(join(root,'native/linux-libtorch.lock.json')));input=pins[arch];
 const archive=join(cache,'libtorch-'+input.sha256+'.zip');await download(input,archive);
 const extraction=join(cache,'upstream-'+input.sha256);if(!existsSync(extraction)){mkdirSync(extraction);run('unzip',['-q',archive,'-d',extraction]);}
 upstream=join(extraction,input.kind==='libtorch'?'libtorch':'torch');
 // The ARM wheel supplies the real LibTorch C++ headers and CPU libraries.
 // Python is never imported, linked, or needed by either adapter or application.
 run(cpp,[...flags,'-std=c++20','-D_GLIBCXX_USE_CXX11_ABI=1',...shared,'-I'+join(upstream,'include'),join(root,'native/src/adapter.cpp'),'-L'+join(upstream,'lib'),'-ltorch_cpu','-lc10','-o',target]);
 const supplied=new Set(['libstdc++.so.6','libgcc_s.so.1','libgomp.so.1','libgfortran.so.5','libz.so.1']),pending=['libtorch_cpu.so','libc10.so'],seen=new Set();
 for(const file of pending){
  if(seen.has(file))continue;seen.add(file);const source=join(upstream,'lib',file);copyFileSync(source,join(out,'lib',file));preservedUpstream.set(file,hash(readFileSync(source)));
  for(const match of run('readelf',['-d',source]).matchAll(/Shared library: \[([^\]]+)\]/g)){
   const dependency=match[1];if(/^(libcuda|libcupti|libcublas|libnvpl|libtorch_python)/.test(dependency))throw Error('The CPU package cannot include '+dependency);
   if(!supplied.has(dependency)&&existsSync(join(upstream,'lib',dependency)))pending.push(dependency);
  }
 }
 for(const file of ['LICENSE.pytorch','NOTICE.pytorch'])copyFileSync(join(root,'native',file),join(out,'licenses',file));
 const wheelNotices=join(extraction,'torch-2.14.1+cpu.dist-info/licenses');if(existsSync(wheelNotices))cpSync(wheelNotices,join(out,'licenses/libtorch-wheel'),{recursive:true});
 if(arch==='arm64')for(const component of pins.arm64Components){
  if(!existsSync(join(out,'lib',component.binary)))throw Error('Missing declared CPU component '+component.id);
  const binary=run('strings',[join(out,'lib',component.binary)]);
  if(!binary.includes(component.id==='arm-compute'?'arm_compute_version=v'+component.version:'OpenBLAS '+component.version)||component.revision&&!binary.includes(component.revision))throw Error('CPU component version differs: '+component.id);
  const archive=join(cache,component.id+'-'+component.sha256+'.tar.gz');await download(component,archive);copyFileSync(archive,join(out,'sources',component.id+'.tar.gz'));
  const source=join(cache,component.directory);if(!existsSync(source))run('tar',['-xzf',archive,'-C',cache]);
  cpSync(join(source,component.licenses),join(out,'licenses',component.id),{recursive:true});cpuComponents.push(component);
 }

}
const licenseFolder=join(root,'native/licenses');if(existsSync(licenseFolder))cpSync(licenseFolder,join(out,'licenses'),{recursive:true});
copyFileSync(join(root,'LICENSE'),join(out,'licenses/august-adapter.txt'));copyFileSync(join(root,'THIRD_PARTY_NOTICES.md'),join(out,'THIRD_PARTY_NOTICES.md'));
if(['pytorch','blake3'].includes(name)){
 const fortran=existsSync(join(out,'lib/libopenblas.so.0'));
 const redistribution=await prepareLinuxRuntimes(root,join(cache,'gnu-runtime'),{fortran}),inputs=JSON.parse(readFileSync(join(redistribution,'redistribution.json')));
 const needed=name==='pytorch'?['libstdc++.so.6','libgcc_s.so.1','libgomp.so.1',...(fortran?['libgfortran.so.5','libz.so.1']:[])]:['libgcc_s.so.1'];
 for(const [file,digest] of Object.entries(inputs.files)){if(file.startsWith('lib/')&&!needed.includes(basename(file)))continue;if(hash(readFileSync(join(redistribution,file)))!==digest)throw Error('GNU runtime input changed');mkdirSync(join(out,file,'..'),{recursive:true});copyFileSync(join(redistribution,file),join(out,file));}
 const shipped=Object.fromEntries(Object.entries(inputs.files).filter(([file])=>!file.startsWith('lib/')||needed.includes(basename(file))));
 copyFileSync(join(redistribution,'redistribution.json'),join(out,'sources/gnu-input-materials.json'));
 writeFileSync(join(out,'sources/gnu-redistribution.json'),JSON.stringify({...inputs,inputMaterials:'gnu-input-materials.json',files:shipped},null,2)+'\n');
}
const libs=readdirSync(join(out,'lib')).sort(),system=new Set(['libc.so.6','libm.so.6','libdl.so.2','libpthread.so.0','librt.so.1',arch==='x64'?'ld-linux-x86-64.so.2':'ld-linux-aarch64.so.1']);
const closure=[];
for(const file of libs){
 const path=join(out,'lib',file);
 // Normalize vendored OpenMP sonames to the locked GCC implementation.
 for(const match of run('readelf',['-d',path]).matchAll(/Shared library: \[([^\]]+)\]/g)){
  const dependency=match[1];if(dependency.startsWith('libgomp-')&&name==='pytorch')throw Error('Upstream OpenMP loader name requires a reviewed matching runtime: '+dependency);
  else if(!libs.includes(dependency)&&!system.has(dependency))throw Error('Unpackaged native dependency '+dependency+' in '+file);
 }
 for(const match of run('readelf',['--version-info',path]).matchAll(/\bGLIBC_(\d+)\.(\d+)\b/g))if(Number(match[1])>2||Number(match[1])===2&&Number(match[2])>36)throw Error('Artifact exceeds glibc 2.36: '+file);
 if(preservedUpstream.has(file)) {
  if(hash(readFileSync(path))!==preservedUpstream.get(file))throw Error('Upstream native binary was modified: '+file);
  const loader=run('readelf',['-d',path]);
  if(!/\((?:RPATH|RUNPATH)\).*?\[\$ORIGIN\]/.test(loader))throw Error('Preserved upstream binary lacks its reviewed origin-relative loader path: '+file);
 } else if(!/\((?:RPATH|RUNPATH)\).*?\[\$ORIGIN\]/.test(run('readelf',['-d',path])))run('patchelf',['--set-rpath','$ORIGIN',path]);
 closure.push({path:'lib/'+file,sha256:hash(readFileSync(path)),dynamic:run('readelf',['-d',path]),versions:run('readelf',['--version-info',path])});
}
writeFileSync(join(out,'runtime-files.json'),JSON.stringify({format:1,files:closure},null,2)+'\n');
const redistributionReview=reconcileRedistribution(root,out,'linux-'+arch,Object.fromEntries(preservedUpstream));
const sourceIdentity=nativeSourceIdentity(root);
writeFileSync(join(out,'provenance.json'),JSON.stringify({format:1,source:sourceIdentity,package:manifest.name,target:triple,minimumLibc:'2.36',inputs:input,cpuComponents,upstream:lock.upstream,compiler:run(name==='pytorch'?cpp:cc,['--version']).trim(),adapter:hash(readFileSync(join(root,'native/src/adapter.'+(name==='pytorch'?'cpp':name==='blake3'?'rs':'c')))),runtimeInspection:'runtime-files.json',upstreamBinaryPreservation:Object.fromEntries(preservedUpstream),redistributionReview:'redistribution-review.json'},null,2)+'\n');
writeFileSync(join(out,'sbom.json'),JSON.stringify({format:1,upstream:lock.upstream,cpuComponents,runtimeFiles:closure.map(({path,sha256})=>({path,sha256})),licenses:readdirSync(join(out,'licenses')),cargo:name==='blake3'?readFileSync(join(root,'native/Cargo.lock'),'utf8'):undefined},null,2)+'\n');
if(existsSync(join(root,'native/tests/client.c'))){const client=join(cache,'native-client');run(cc,[...flags,'-std=c11',join(root,'native/tests/client.c'),target,'-Wl,-rpath,'+join(out,'lib'),'-o',client]);console.log(run(client,[]).trim());}
const files={};let unpacked=0;const walk=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())walk(join(directory,entry.name),path+'/');else{const bytes=readFileSync(join(directory,entry.name));unpacked+=bytes.length;files[path]=hash(bytes);}}};walk(out);
writeFileSync(join(out,'files.json'),JSON.stringify({format:1,files},null,2)+'\n');unpacked+=readFileSync(join(out,'files.json')).length;
const archive=join(cache,'native-linux-'+arch+'.tar.gz');run('tar',['-czf',archive,'-C',out,...readdirSync(out).sort()]);
const bytes=readFileSync(archive),artifact={id:'linux-'+arch,target:{triple,os:'linux',arch,minimumLibc:'2.36',cpuBaseline:arch==='x64'?'x86-64':'armv8-a',libc:'glibc',...(name==='pytorch'?{cxxRuntime:'bundled-libstdc++',cxxABI:'itanium-cxx11',features:['cpu','float64']}:{})},url:'https://github.com/GreenPandaStudios/aug-'+name+'/releases/download/v'+manifest.version+'/native-linux-'+arch+'.tar.gz',sha256:hash(bytes),maximumDownloadBytes:bytes.length,maximumUnpackedBytes:unpacked,link:{kind:'dynamic',libraries:[library]},runtime:{files:libs.map(file=>'lib/'+file),closureManifest:'runtime-files.json',relocation:'loader-relative'},components:[{id:lock.upstream.repository,version:lock.upstream.version,compatibilityKey:'aug-'+name+'-runtime',linkage:name==='pytorch'?'dynamic':'static',required:true},...(['pytorch','blake3'].includes(name)?[{id:'gcc-runtime',version:'12.2.0-14+deb12u1',compatibilityKey:'gcc-runtime',linkage:'dynamic',required:true}]:[])],fileManifest:'files.json',provenance:'provenance.json',notices:'THIRD_PARTY_NOTICES.md'};
artifact.components.push(...cpuComponents.map(component=>({id:component.id,version:component.version,compatibilityKey:component.id,linkage:'dynamic',required:true})));
manifest.native.artifacts=manifest.native.artifacts.filter(entry=>entry.id!==artifact.id).concat(artifact).sort((a,b)=>a.id.localeCompare(b.id));
manifest.native.sourceBuild.tools=['Clang or Apple Clang','platform C/C++ development headers','GCC 12.2.0, GNU make, patch and binutils on Linux','patchelf on Linux',...(name==='blake3'?['Rust 1.98.1 and Cargo']:[])];
writeFileSync(join(root,'aug-package.json'),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(join(cache,'candidate.json'),JSON.stringify({source:sourceIdentity,package:manifest.name,version:manifest.version,artifact},null,2)+'\n');console.log(JSON.stringify({archive,sha256:artifact.sha256,bytes:bytes.length,unpacked}));
