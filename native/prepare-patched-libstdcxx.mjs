// Maintainer-only source build for the pinned GNU C++ runtime. Never an install hook.
import {copyFileSync,existsSync,mkdirSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const recipe=fileURLToPath(import.meta.url);
// Keep compiler/configure injection and loader overrides out of the measured recipe.
const toolEnvironment={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const correction={
  advisory:'CVE-2026-95619',
  upstreamCommit:'59d235ffa5a69231eb42e5290d52dc8c90d28b7a',
  upstream:'https://github.com/gcc-mirror/gcc/commit/59d235ffa5a69231eb42e5290d52dc8c90d28b7a'
};
function run(command,args,options={}) {
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:20000000,timeout:120000,env:toolEnvironment,...options});
  if(result.status!==0)throw new Error(command+' failed: '+String(result.stderr||result.stdout||result.error?.message).slice(-6000));
  return result.stdout;
}
function symbols(file) {
  const entries=new Map();
  for(const line of run('readelf',['--wide','--dyn-syms',file]).split('\n')) {
    const match=/^\s*\d+:\s+[0-9a-f]+\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/i.exec(line);
    if(match&&match[5]!=='UND'&&['GLOBAL','WEAK','UNIQUE'].includes(match[3]))
      entries.set(match[6],{type:match[2],binding:match[3],visibility:match[4],size:Number(match[1])});
  }
  if(entries.size<5000)throw new Error('GNU runtime export inventory is unexpectedly incomplete');
  return entries;
}
function checkAbi(original,library) {
  const before=symbols(original),after=symbols(library);
  for(const [name,expected] of before) {
    const actual=after.get(name);
    if(!actual||actual.type!==expected.type||actual.binding!==expected.binding||actual.visibility!==expected.visibility||['OBJECT','TLS'].includes(expected.type)&&actual.size!==expected.size)
      throw new Error('Patched GNU runtime changed a required versioned export: '+name);
  }
  if(!/\(SONAME\).*?\[libstdc\+\+\.so\.6\]/.test(run('readelf',['--dynamic',library])))
    throw new Error('Patched GNU runtime SONAME differs');
  for(const match of run('readelf',['--version-info',library]).matchAll(/\bGLIBC_(\d+)\.(\d+)\b/g))
    if(Number(match[1])>2||Number(match[1])===2&&Number(match[2])>36)
      throw new Error('Patched GNU runtime exceeds the glibc 2.36 floor');
  return {requiredDynamicExports:before.size,providedDynamicExports:after.size,
    requiredVersionedExports:[...before.keys()].filter(name=>name.includes('@')).length,minimumLibc:'2.36'};
}
function checkRegression(test,library,cache) {
  const executable=join(cache,'aligned-new-regression');
  run('g++',['-std=c++17','-O2','-pthread',test,library,'-Wl,-rpath,'+dirname(library),'-o',executable]);
  const env=toolEnvironment;
  const resolved=run('ldd',[executable],{env}).split('\n').find(line=>line.includes('libstdc++.so.6 =>'));
  const actual=resolved&&/=>\s+(\S+)/.exec(resolved)?.[1];
  if(!actual||realpathSync(actual)!==realpathSync(library))throw new Error('GNU runtime regression resolved another C++ library');
  const result=run(executable,[],{env});
  if(!result.includes('Aligned allocation and POSIX thread regression passed'))throw new Error('GNU runtime regression did not report success');
}
export function preparePatchedLibstdcxx(root,output,original) {
  if(process.platform!=='linux'||!['x64','arm64'].includes(process.arch))throw new Error('GNU runtime source builds require native Linux x64 or ARM64');
  const lock=JSON.parse(readFileSync(join(root,'native/linux-runtimes.lock.json'),'utf8'));
  const input=lock.inputs.find(input=>input.file==='gcc-12_12.2.0.orig.tar.gz');
  const archive=join(output,'downloads',input.file);
  if(sha(archive)!==input.sha256)throw new Error('Pinned GCC source input changed');
  const patch=join(root,'native/gcc12-aligned-new.patch'),test=join(root,'native/tests/aligned-new-overflow.cpp');
  const compiler=run('g++',['-dumpfullversion']).trim(),cCompiler=run('gcc',['-dumpfullversion']).trim(),target=run('g++',['-dumpmachine']).trim();
  const expectedTarget=process.arch==='x64'?'x86_64-linux-gnu':'aarch64-linux-gnu';
  if(compiler!=='12.2.0'||cCompiler!=='12.2.0'||target!==expectedTarget)throw new Error('This runtime recipe requires GCC 12.2.0 for '+expectedTarget);
  const identity={format:1,architecture:process.arch,compiler,cCompiler,target,sourceSha256:input.sha256,
    originalLibrarySha256:sha(original),patchSha256:sha(patch),testSha256:sha(test),recipeSha256:sha(recipe)};
  const cache=join(output,'gcc-patched'),library=join(cache,'lib/libstdc++.so.6'),receipt=join(cache,'build.json');
  let previous;
  try{previous=JSON.parse(readFileSync(receipt,'utf8'));}catch{}
  if(!existsSync(library)||JSON.stringify(previous?.identity)!==JSON.stringify(identity)||previous?.librarySha256!==sha(library)) {
    rmSync(cache,{recursive:true,force:true});mkdirSync(join(cache,'lib'),{recursive:true});
    const nested=join(cache,'gcc-source.tar.xz');
    const extraction=spawnSync('tar',['-xOf',archive,'gcc-12-12.2.0/gcc-12.2.0-dfsg.tar.xz'],{maxBuffer:100000000,timeout:120000,env:toolEnvironment});
    if(extraction.status!==0)throw new Error('Pinned GCC nested source extraction failed');
    writeFileSync(nested,extraction.stdout);
    const rootFiles=run('tar',['-tf',nested]).split('\n').filter(name=>/^gcc-12\.2\.0\/[^/]+$/.test(name));
    // Never select the root directory itself: tar would recursively extract all GCC languages.
    const selected=[...rootFiles,...['libstdc++-v3','libgcc','include','libiberty','config'].map(name=>'gcc-12.2.0/'+name),
      ...['BASE-VER','DATESTAMP','DEV-PHASE'].map(name=>'gcc-12.2.0/gcc/'+name)];
    writeFileSync(join(cache,'selected-files.txt'),selected.join('\n')+'\n');
    const extractionRoot=join(cache,'source');mkdirSync(extractionRoot,{recursive:true});
    run('tar',['-xf',nested,'-C',extractionRoot,'-T',join(cache,'selected-files.txt')]);
    const source=join(extractionRoot,'gcc-12.2.0'),build=join(cache,'build');mkdirSync(build,{recursive:true});
    // GCC's top-level configuration normally chooses this header. Standalone
    // libstdc++ configuration otherwise silently omits its POSIX thread exports.
    symlinkSync('gthr-posix.h',join(source,'libgcc/gthr-default.h'));
    run('patch',['--batch','--fuzz=0','-p1','-i',patch],{cwd:source});
    const architectureFlags=process.arch==='x64'?'-march=x86-64 -mtune=generic':'-march=armv8-a';
    const env={...toolEnvironment,CC:'/usr/bin/gcc',CXX:'/usr/bin/g++',CONFIG_SITE:'/dev/null',
      CFLAGS:'-O2 -g0 '+architectureFlags,CXXFLAGS:'-O2 -g0 '+architectureFlags};
    const configured=run(join(source,'libstdc++-v3/configure'),['--host='+target,'--build='+target,'--target='+target,
      '--disable-multilib','--enable-static','--enable-shared','--disable-libstdcxx-pch',
      '--enable-threads=posix','--enable-libstdcxx-threads','--prefix='+join(cache,'install')],{cwd:build,env});
    writeFileSync(join(cache,'configure.log'),configured);
    if(!configured.includes('checking for gthreads library... yes'))throw new Error('GNU runtime configuration omitted POSIX threads');
    const built=run('make',['-j4'],{cwd:build,env,timeout:900000});
    writeFileSync(join(cache,'make.log'),built);
    copyFileSync(join(build,'src/.libs/libstdc++.so.6.0.30'),library);
  }
  // Revalidate cached binaries too; an input hash alone is not evidence of ABI compatibility.
  const abi=checkAbi(original,library);
  checkRegression(test,library,cache);
  const record={identity,librarySha256:sha(library),...abi,regressionPassed:true,correction};
  writeFileSync(receipt,JSON.stringify(record,null,2)+'\n');
  return {library,record};
}
