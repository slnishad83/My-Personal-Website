import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{C as t,D as n,E as r,O as i,S as a,T as o,a as s,b as c,d as l,h as u,i as d,j as f,l as p,s as m,u as h,v as g,x as _}from"./feature-security-BDorBO9o.js";var v,y;e((()=>{i(),c(),f((()=>{a(),l(),t((()=>{u(),p(),_((()=>{o(),h(),g((()=>{r(),d(),n((()=>{s(),v=m((()=>{var e=/@aibot\b|@ai\b/i;function t(t){return e.test(t||``)}function n(e){return(e||``).replace(/@aibot\b/gi,``).replace(/@ai\b/gi,``).replace(/\s{2,}/g,` `).trim()}function r(){let e=document.getElementById(`messagesArea`);if(!e)return null;let t=`ai-thinking-${Date.now()}`,n=document.createElement(`div`);return n.id=t,n.className=`message ai-bot-message ai-bot-thinking`,n.innerHTML=`
    <div class="message-bubble">
      <div class="message-sender ai-bot-sender">AI Assistant</div>
      <div class="message-text">
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
        <span class="ai-thinking-dot"></span>
      </div>
    </div>
  `,e.appendChild(n),e.scrollTop=e.scrollHeight,t}function i(e){e&&document.getElementById(e)?.remove()}async function a(e,t,n){await firebase.functions().httpsCallable(`aiChatBot`,{timeout:35e3})({prompt:e,chatId:t,chatType:n,senderName:currentUser.displayName||currentUser.email||`User`})}async function o(e,o,s){if(!t(e))return;let c=n(e);if(!c){showToast(`Add a question after @AI â€” e.g. "@AI summarise the last 10 messages"`);return}let l=r();try{await a(c,o,s)}catch(e){window.__DEBUG__&&console.error(`AI bot error:`,e),showToast(`AI Assistant is unavailable. Make sure the Cloud Function is deployed.`,`error`)}finally{i(l)}}window.triggerAiBotIfMentioned=o,window.isAiBotTrigger=t})),y=v()}))()}))()}))()}))()}))()}))();export{y as default};