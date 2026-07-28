import{n as e}from"./modulepreload-polyfill-C_LrRQgL.js";import{$ as t,B as n,C as r,D as i,F as a,J as o,K as s,L as c,M as l,O as u,P as d,S as f,W as p,Y as m,Z as h,_ as g,a as _,at as v,ct as y,d as b,et as x,f as S,ft as C,g as w,i as T,it as E,j as D,k as O,l as k,lt as A,n as j,o as M,rt as N,s as P,t as F,u as I,x as L,y as R}from"./feature-security-DwgR72Uf.js";var z,B;e((()=>{A(),s(),C((()=>{h(),w(),x((()=>{n(),I(),m((()=>{a(),D(),p((()=>{c(),i(),N((()=>{_(),S(),v((()=>{P(),O(),E((()=>{o(),T(),M((()=>{R(),y(),j((()=>{g(),F(),L((()=>{u(),f(),r((()=>{k(),d(),b((()=>{l(),z=t((()=>{(function(){let e={greeting:[`Hey there!`,`Hi!`,`Hello, how are you?`],agreement:[`Agreed.`,`Sounds good.`,`Yes, absolutely.`],gratitude:[`Thank you!`,`Thanks a lot!`,`Appreciate it.`],farewell:[`Bye!`,`See you later.`,`Take care.`],question:[`I am not sure.`,`Let me check and get back to you.`,`Can you clarify?`],default:[`Okay.`,`Got it.`,`Thanks.`]},t=null,n=null,r=!1;function i(){let e=document.createElement(`style`);e.textContent=`
      #smart-reply-container {
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        background: var(--background);
        border-top: 1px solid var(--outline-variant);
        transition: all 0.3s ease;
      }
      #smart-reply-container::-webkit-scrollbar { display: none; }
      .smart-reply-chip {
        white-space: nowrap;
        padding: 6px 14px;
        border-radius: 16px;
        background: var(--surface-variant);
        color: var(--on-surface-variant);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--outline-variant);
        transition: all 0.2s ease;
      }
      .smart-reply-chip:hover {
        background: var(--primary);
        color: var(--on-primary);
        border-color: var(--primary);
      }
    `,document.head.appendChild(e),t=document.createElement(`div`),t.id=`smart-reply-container`,t.style.display=`none`;let i=document.getElementById(`input-bar`);i&&i.parentNode&&i.parentNode.insertBefore(t,i),document.addEventListener(`nsl:app-ready`,()=>{window.MutationBus&&window.MutationBus.onBodyChildList(`smart-reply`,()=>{a()}),!r&&window.selectChat&&(n=window.selectChat,window.selectChat=function(...e){let t=n.apply(this,e);return setTimeout(a,100),t},r=!0)})}function a(){if(!window.App||!window.App.currentChatId){c();return}let t=window.App.messages.filter(e=>e.chatId===window.App.currentChatId);if(!t.length){c();return}let n=t[t.length-1];if(n.senderId===window.App.currentUser.uid){c();return}if(!n.text){c();return}let r=o(n.text);s(e[r]||e.default)}function o(e){if(typeof e!=`string`)return`default`;let t=e.toLowerCase();return t.match(/^(hi|hello|hey)/)?`greeting`:t.match(/\?$/)?`question`:t.match(/(thanks|thank you)/)?`gratitude`:t.match(/(bye|cya|goodbye)/)?`farewell`:t.match(/(ok|okay|sure|sound good)/)?`agreement`:`default`}function s(e){t&&(t.innerHTML=``,e.forEach(e=>{let n=document.createElement(`div`);n.className=`smart-reply-chip`,n.textContent=e,n.onclick=()=>{let t=document.getElementById(`msg-input`);t&&(t.value=e,t.dispatchEvent(new Event(`input`)),t.focus(),c())},t.appendChild(n)}),t.style.display=`flex`)}function c(){t&&(t.style.display=`none`)}function l(){r&&n&&(window.selectChat=n,n=null,r=!1)}window.unhookSmartReplySelectChat=l,document.readyState===`loading`?document.addEventListener(`DOMContentLoaded`,i):i()})()})),B=z()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))()}))();export{B as default};