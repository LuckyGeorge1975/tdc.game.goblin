// Synchronous classic-script geometry for the versioned Supercover showcase.
// Keep its geometry in parity with src/core/supercover-line.mjs.
const GoblinHexSupercover=Object.freeze((()=>{
  const axial=({x,y})=>({q:x-Math.floor(y/2),r:y});
  const offset=({q,r})=>({x:q+Math.floor(r/2),y:r});
  const ratio=(num,den)=>den<0n?{num:-num,den:-den}:{num,den};
  const compare=(a,b)=>a.num*b.den-b.num*a.den;
  function touchesHex(a,b,cell){
    const dq=a.q-cell.q,dr=a.r-cell.r,stepQ=b.q-a.q,stepR=b.r-a.r;
    let low={num:0n,den:1n},high={num:1n,den:1n};
    for(const [start,slope] of [[2*dq+dr,2*stepQ+stepR],[dq+2*dr,stepQ+2*stepR],[dq-dr,stepQ-stepR]]){
      for(const sign of [-1,1]){
        const value=sign*start,change=sign*slope;
        if(change===0){if(value>1)return false;continue}
        const bound=ratio(BigInt(1-value),BigInt(change));
        if(change>0&&compare(bound,high)<0)high=bound;
        if(change<0&&compare(bound,low)>0)low=bound;
        if(compare(low,high)>0)return false;
      }
    }
    return true;
  }
  function intermediateHexes(from,to){
    if(![from?.x,from?.y,to?.x,to?.y].every(Number.isInteger))
      throw new TypeError('integer odd-row hex coordinates required');
    if(from.x===to.x&&from.y===to.y)return [];
    const a=axial(from),b=axial(to),cells=[];
    for(let r=Math.min(a.r,b.r)-1;r<=Math.max(a.r,b.r)+1;r++){
      for(let q=Math.min(a.q,b.q)-1;q<=Math.max(a.q,b.q)+1;q++){
        const cell=offset({q,r});
        if(cell.x===from.x&&cell.y===from.y||cell.x===to.x&&cell.y===to.y)continue;
        if(touchesHex(a,b,{q,r}))cells.push(cell);
      }
    }
    return cells.sort((left,right)=>left.y-right.y||left.x-right.x);
  }
  return Object.freeze({intermediateHexes});
})());
