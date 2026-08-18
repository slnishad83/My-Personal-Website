/* ============================================================
   MESSAGE GROUPING — Consecutive same-sender bubble merging
   WhatsApp-style: group messages, show tails on first/last,
   flatten middle bubbles.
   ============================================================ */
'use strict';

window.MessageGrouping = {
  _groupGapMs: 60 * 1000,

  processMessages(messages) {
    if (!messages || !messages.length) return [];
    const result = [];
    let i = 0;
    while (i < messages.length) {
      const msg = messages[i];
      const sender = msg.senderId || msg.userId || '';
      const group = [msg];
      let j = i + 1;
      while (j < messages.length) {
        const next = messages[j];
        const nextSender = next.senderId || next.userId || '';
        if (nextSender !== sender) break;
        if (this._timeDiff(group[group.length - 1], next) > this._groupGapMs) break;
        if (next.replyTo && Object.keys(next.replyTo).length > 0) break;
        group.push(next);
        j++;
      }
      group.forEach((m, idx) => {
        m._groupPos = idx === 0 ? 'first' : idx === group.length - 1 ? 'last' : 'middle';
        m._groupSize = group.length;
      });
      result.push(...group);
      i = j;
    }
    return result;
  },

  _timeDiff(a, b) {
    const ts = msg => {
      const t = msg.timestamp || msg.time;
      if (!t) return 0;
      if (t.toMillis) return t.toMillis();
      if (t.seconds) return t.seconds * 1000;
      if (t instanceof Date) return t.getTime();
      return t;
    };
    return Math.abs(ts(b) - ts(a));
  },

  getBubbleRadius(isMe, groupPos) {
    if (!groupPos || groupPos === 'first') {
      return isMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px';
    }
    if (groupPos === 'last') {
      return isMe ? '4px 18px 18px 18px' : '18px 4px 18px 18px';
    }
    return isMe ? '4px 18px 18px 4px' : '18px 4px 4px 18px';
  },

  getTailSVG(isMe, groupPos) {
    if (!groupPos || groupPos === 'first') {
      return isMe ? this._tailRight : this._tailLeft;
    }
    return '';
  },

  _tailLeft: `<svg viewBox="0 0 8 13" width="8" height="13" style="position:absolute;top:0;left:-7px"><path d="M1.536 0C3.337 1.373 5.286 3.162 5.286 6v4.714C5.286 12.24 3.522 13 1.536 13H0V0h1.536z" fill="var(--surface-container,#fff)"/></svg>`,

  _tailRight: `<svg viewBox="0 0 8 13" width="8" height="13" style="position:absolute;top:0;right:-7px"><path d="M6.464 0C4.663 1.373 2.714 3.162 2.714 6v4.714C2.714 12.24 4.478 13 6.464 13H8V0H6.464z" fill="var(--primary-container,#d9fdd3)"/></svg>`
};
