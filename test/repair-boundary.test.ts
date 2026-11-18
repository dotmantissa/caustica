import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkProposal} from '../src/repair.js';
const before=new Map([['apps/checkout/src/pricing.mjs','broken'],['contracts/checkout.json','frozen'],['repair-input/failure.json','actual']]);const allowed=['apps/checkout/src/pricing.mjs'];
test('real application diff is allowed; changing requirements, evidence, adding paths or removing app rejects',()=>{
 const after=new Map(before).set(allowed[0],'repair');assert.equal(checkProposal(before,after,allowed).accepted,true);
 for(const changed of [new Map(after).set('contracts/checkout.json','weakened'),new Map(after).set('repair-input/failure.json','forged'),new Map(after).set('new-file','extra')])assert.equal(checkProposal(before,changed,allowed).accepted,false);
 const removed=new Map(after);removed.delete(allowed[0]);assert.equal(checkProposal(before,removed,allowed).accepted,false);assert.equal(checkProposal(before,before,allowed).accepted,false);
});
