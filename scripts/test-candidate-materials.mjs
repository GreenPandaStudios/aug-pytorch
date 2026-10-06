
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,openSync,readSync,writeSync,closeSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {verifyNativeCandidate} from '../native/source-identity.mjs';
const root=resolve(import.meta.dirname,'..'),candidate=JSON.parse(readFileSync(process.argv[2]));
verifyNativeCandidate(candidate,root);
for(const name of ['native/LICENSE.pytorch','native/NOTICE.pytorch','native/gcc12-aligned-new.patch','native/licenses/provenance.json']) {
 const path=join(root,name),fd=openSync(path,'r+'),original=Buffer.alloc(1);
 readSync(fd,original,0,1,0);
 try {writeSync(fd,Buffer.from([original[0]^1]),0,1,0);assert.throws(()=>verifyNativeCandidate(candidate,root),/changed/);}
 finally{writeSync(fd,original,0,1,0);closeSync(fd);}
 verifyNativeCandidate(candidate,root);
}
console.log('Candidate identity rejects changed copied notices, patch and component inventory');
