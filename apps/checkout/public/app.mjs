const $ = (id) => document.getElementById(id);
const money = (cents) => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents / 100);
let appliedCoupon = '', busy = false;
async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data = await r.json(); if (!r.ok) throw new Error(data.error || 'The request failed. Please retry.'); return data;
}
function error(message='') { $('error').textContent=message; $('error').hidden=!message; }
function lock(value) {busy=value;$('apply').disabled=value;$('place-order').disabled=value;}
function renderQuote(q) {for(const name of ['subtotal','discount','total'])$(name).textContent=money(q[name+'Cents']);}
$('coupon-form').addEventListener('submit',async(e)=>{
  e.preventDefault();if(busy)return;lock(true);error();$('coupon-status').textContent='Checking coupon…';
  try{const coupon=$('coupon').value.trim().toUpperCase();const q=await api('/api/quote',{quantity:1,coupon});appliedCoupon=coupon;renderQuote(q);$('coupon-status').textContent=q.discountCents>0?'SAVE10 applied.':coupon?'No discount is available for this code.':'Coupon removed.';}
  catch(e){$('coupon-status').textContent='';error(e.message+' Apply the coupon again.');}finally{lock(false);}
});
$('place-order').addEventListener('click',async()=>{
  if(busy)return;lock(true);error();$('order-status').textContent='Placing your order…';
  try{const order=await api('/api/orders',{quantity:1,coupon:appliedCoupon});$('order-status').textContent=`Order ${order.id} placed. Total ${money(order.totalCents)}.`;await history();}
  catch(e){$('order-status').textContent='';error(e.message+' Please try placing the order again.');}finally{lock(false);}
});
async function history(){
  $('retry-history').hidden=true;
  try{const orders=await api('/api/orders');$('orders').replaceChildren();$('history-status').textContent=orders.length?'':'Your orders will appear here after checkout.';
    for(const order of orders){const li=document.createElement('li'),info=document.createElement('div'),detail=document.createElement('small'),amount=document.createElement('strong');info.textContent=order.product;detail.textContent=`Order ${order.id} · Coupon ${order.coupon||'none'}`;info.append(detail);amount.textContent=money(order.totalCents);li.append(info,amount);$('orders').append(li);}
  }catch(e){$('history-status').textContent='Order history could not load. Retry to see your saved orders.';$('retry-history').hidden=false;}
}
$('retry-history').addEventListener('click',history);history();
