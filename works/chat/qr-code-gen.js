/**
 * QR Code Generator — compact byte-mode encoder (versions 1-10, EC level M)
 * Used for device pairing QR codes in MultiDevice
 */
'use strict';
const QRCodeGen = (() => {
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x & 128 ? 0x11d : 0); }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gfMul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;

  function rsGenPoly(n) {
    let g = new Uint8Array([1]);
    for (let i = 0; i < n; i++) {
      const ng = new Uint8Array(g.length + 1);
      for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gfMul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  }
  function rsEncode(data, nsym) {
    const gen = rsGenPoly(nsym);
    const out = new Uint8Array(data.length + nsym);
    for (let i = 0; i < data.length; i++) out[i] = data[i];
    for (let i = 0; i < data.length; i++) {
      const c = out[i]; if (!c) continue;
      for (let j = 0; j < gen.length; j++) out[i + j] ^= gfMul(gen[j], c);
    }
    for (let i = 0; i < data.length; i++) out[i] = data[i];
    return out;
  }

  // [totalCW, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
  const VP = {
    1:[26,10,1,16,0,0], 2:[44,16,1,28,0,0], 3:[70,26,1,44,0,0],
    4:[100,18,2,32,0,0], 5:[134,24,2,43,0,0], 6:[172,16,4,27,0,0],
    7:[196,18,4,31,0,0], 8:[242,22,2,38,2,39], 9:[292,22,3,36,2,37],
    10:[346,26,4,43,1,44]
  };
  const AL = { 2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50] };

  function getVersion(len) {
    for (let v = 1; v <= 10; v++) { const p = VP[v]; if (len <= p[2]*p[3]+p[4]*p[5]) return v; }
    return 10;
  }

  function encode(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xC0|(c>>6), 0x80|(c&63)); }
      else { bytes.push(0xE0|(c>>12), 0x80|((c>>6)&63), 0x80|(c&63)); }
    }
    const version = getVersion(bytes.length + 2);
    const size = version * 4 + 17;
    const p = VP[version];
    const totalData = p[2]*p[3]+p[4]*p[5];
    const ecPer = p[1];

    // Build data
    const d = [];
    d.push(0x40); // byte mode
    d.push(bytes.length);
    d.push(...bytes);
    while (d.length < totalData) d.push(d.length % 2 ? 0x11 : 0xEC);

    // Split blocks
    const blocks = [];
    let off = 0;
    for (let g = 0; g < 2; g++) {
      const bc = p[2+g*2], dc = p[3+g*2];
      for (let b = 0; b < bc; b++) {
        const bd = d.slice(off, off+dc);
        const ec = rsEncode(new Uint8Array(bd), ecPer);
        blocks.push({ data: bd, ec: Array.from(ec.slice(dc)) });
        off += dc;
      }
    }

    // Interleave
    const inter = [];
    const maxD = Math.max(...blocks.map(b=>b.data.length));
    for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.data.length) inter.push(b.data[i]);
    for (let i = 0; i < ecPer; i++) for (const b of blocks) if (i < b.ec.length) inter.push(b.ec[i]);

    // Matrix
    const M = Array.from({length:size}, ()=>Array(size).fill(false));
    const R = Array.from({length:size}, ()=>Array(size).fill(false));
    const set = (r,c,v) => { if(r>=0&&r<size&&c>=0&&c<size){M[r][c]=v;R[r][c]=true;} };

    // Finder
    const finder = (r0,c0) => {
      for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++) {
        const io=r>=0&&r<=6&&c>=0&&c<=6;
        const ib=r>=2&&r<=4&&c>=2&&c<=4;
        const ob=r===0||r===6||c===0||c===6;
        if(io&&(ib||ob)) set(r0+r,c0+c,true);
      }
    };
    finder(0,0); finder(0,size-7); finder(size-7,0);

    // Timing
    for(let i=8;i<size-8;i++){set(6,i,i%2===0);set(i,6,i%2===0);}

    // Alignment
    const ap=AL[version];
    if(ap) for(const r of ap) for(const c of ap) {
      if(R[r][c]) continue;
      for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++)
        set(r+dr,c+dc,Math.abs(dr)===2||Math.abs(dc)===2||(!dr&&!dc));
    }

    set(size-8,8,true); // dark module

    // Reserve format areas
    for(let i=0;i<8;i++){
      if(!R[8][i]){R[8][i]=true;}
      if(!R[i][8]){R[i][8]=true;}
      if(!R[8][size-1-i]){R[8][size-1-i]=true;}
      if(!R[size-1-i][8]){R[size-1-i][8]=true;}
    }

    // Place data
    let bi=0;const tb=inter.length*8;
    let col=size-1,up=true;
    while(col>=0){
      if(col===6)col--;
      for(let i=0;i<size;i++){
        const row=up?size-1-i:i;
        for(let dc=0;dc<2;dc++){
          const c=col-dc;
          if(c<0||R[row][c])continue;
          M[row][c]=bi<tb?((inter[bi>>3]>>(7-(bi&7)))&1)===1:false;
          bi++;
        }
      }
      up=!up;col-=2;
    }

    // Mask 0
    for(let r=0;r<size;r++) for(let c=0;c<size;c++)
      if(!R[r][c]&&(r+c)%2===0) M[r][c]=!M[r][c];

    // Format info (EC=M, mask=0)
    const fmt=[0x5412,0x5125,0x5E7C,0x5B4B,0x45F9,0x40CE,0x4F97,0x4AA0][0];
    for(let i=0;i<=5;i++) set(8,i,!!((fmt>>(14-i))&1));
    set(8,7,!!((fmt>>8)&1)); set(8,8,!!((fmt>>9)&1)); set(7,8,!!((fmt>>10)&1));
    for(let i=0;i<=5;i++) set(5-i,8,!!((fmt>>(11-i))&1));
    for(let i=0;i<=6;i++) set(size-1-i,8,!!((fmt>>i)&1));
    set(8,size-8,!!((fmt>>14)&1));

    return M;
  }

  return { encode };
})();
window.QRCodeGen = QRCodeGen;
