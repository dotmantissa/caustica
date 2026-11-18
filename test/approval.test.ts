import {test} from 'node:test';
import assert from 'node:assert/strict';
import {approve,type RunProof} from '../src/approval.js';
const expected={boundaryDigest:'contract',globalVariablesDigest:'vars',appDigest:'app'};
const healthy:RunProof={...expected,runId:'healthy',control:'none',identityValid:true,artifactsValid:true,outcome:{kind:'passed'}};
const control:RunProof={...healthy,runId:'control',control:'ignore-discount',controlEffective:true,outcome:{kind:'assertion-failed',acceptanceId:'coupon-total'}};
test('only a matching positive/relevant effective fault pair approves',()=>{
 assert.equal(approve(healthy,control,expected).verdict,'verified');
 for(const mutated of [{...control,controlEffective:false},{...control,outcome:{kind:'inconclusive' as const,reason:'Upload failed'}},{...control,outcome:{kind:'assertion-failed' as const,acceptanceId:'order-refresh'}}])assert.equal(approve(healthy,mutated,expected).verdict,'inconclusive');
 assert.equal(approve(healthy,undefined,expected).verdict,'inconclusive');
});
test('changed acceptance, repaired content, global variables and altered artifacts reject reuse',()=>{
 for(const e of [{...expected,boundaryDigest:'changed'},{...expected,appDigest:'repaired'},{...expected,globalVariablesDigest:'changed'}])assert.equal(approve(healthy,control,e).verdict,'evidence-rejected');
 assert.equal(approve({...healthy,identityValid:false},control,expected).verdict,'evidence-rejected');
 assert.equal(approve(healthy,{...control,artifactsValid:false},expected).verdict,'evidence-rejected');
});
