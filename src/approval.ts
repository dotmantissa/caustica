export type Verdict='verified'|'requirement-failed'|'evidence-rejected'|'inconclusive';
export const labels:Record<Verdict,string>={verified:'Verified for this contract and control','requirement-failed':'Requirement failed','evidence-rejected':'Evidence rejected',inconclusive:'Run inconclusive'};
export const exitCodes:Record<Verdict,number>={verified:0,'requirement-failed':1,'evidence-rejected':2,inconclusive:3};
export interface Decision{verdict:Verdict;reason:string;}
export interface RunProof{runId:string;boundaryDigest:string;globalVariablesDigest:string;appDigest:string;control:'none'|'ignore-discount';identityValid:boolean;artifactsValid:boolean;controlEffective?:boolean;outcome:{kind:'passed'|'assertion-failed'|'inconclusive';acceptanceId?:string;reason?:string};}
export function approve(healthy:RunProof,control:RunProof|undefined,expected:{boundaryDigest:string;globalVariablesDigest:string;appDigest:string}):Decision{
 for(const proof of [healthy,control].filter((p):p is RunProof=>!!p)){
  if(proof.boundaryDigest!==expected.boundaryDigest||proof.globalVariablesDigest!==expected.globalVariablesDigest)return {verdict:'evidence-rejected',reason:'Frozen requirements or execution inputs changed'};
  if(proof.appDigest!==expected.appDigest)return {verdict:'evidence-rejected',reason:'Evidence belongs to different application bytes'};
  if(!proof.identityValid||!proof.artifactsValid)return {verdict:'evidence-rejected',reason:'Served identity or recorded artifacts do not match'};
 }
 if(healthy.control!=='none')return {verdict:'evidence-rejected',reason:'Healthy proof has a fault enabled'};
 if(healthy.outcome.kind==='assertion-failed')return {verdict:'requirement-failed',reason:'The unchanged acceptance requirement failed'};
 if(healthy.outcome.kind!=='passed')return {verdict:'inconclusive',reason:healthy.outcome.reason??'Healthy execution did not produce supported evidence'};
 if(!control)return {verdict:'inconclusive',reason:'Matching fault calibration is missing'};
 if(control.control!=='ignore-discount'||!control.controlEffective)return {verdict:'inconclusive',reason:'The independent coupon fault was not effective'};
 if(control.outcome.kind!=='assertion-failed'||control.outcome.acceptanceId!=='coupon-total')return {verdict:'inconclusive',reason:'Kane did not demonstrate the intended coupon assertion failure'};
 return {verdict:'verified',reason:'Healthy checkout passed; the matching independent coupon fault was detected'};
}
