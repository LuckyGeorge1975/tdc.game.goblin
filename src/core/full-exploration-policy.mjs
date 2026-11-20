const goalKinds=new Set(['destroy-core','destroy-escort','destroy-player-force','destroy-opponent-force']);
const dimensions=terrain=>Number.isInteger(terrain?.width)&&terrain.width>0&&
  Number.isInteger(terrain.height)&&terrain.height>0;
const inside=(cell,width,height)=>Number.isInteger(cell?.x)&&Number.isInteger(cell.y)&&
  cell.x>=0&&cell.y>=0&&cell.x<width&&cell.y<height;
const key=({x,y})=>x+','+y;
const improves=(rank,best)=> {
  if(!best) return true;
  const column=rank.findIndex((value,index)=>value!==best[index]);
  return column>=0&&rank[column]>best[column];
};

export function createFullExplorationPolicy({side,initialState}={}) {
  if(!['player','enemy'].includes(side)) throw Error('FULL_EXPLORATION_SIDE_INVALID');
  const observed=new Map();
  let width=null,height=null,step=0;
  if(initialState!==undefined) {
    const state=initialState;
    if(state?.version!=='full-exploration-v1'||state.side!==side||
        !(dimensions(state)||state.width===null&&state.height===null)||
        !Number.isSafeInteger(state.step)||state.step<0||!Array.isArray(state.observed)||
        state.width===null&&state.observed.length)
      throw Error('FULL_EXPLORATION_STATE_INVALID');
    width=state.width;height=state.height;step=state.step;
    for(const cell of state.observed) {
      if(!inside(cell,width,height)||!Number.isSafeInteger(cell.lastStep)||cell.lastStep<0||
          cell.lastStep>step||observed.has(key(cell))) throw Error('FULL_EXPLORATION_STATE_INVALID');
      observed.set(key(cell),cell.lastStep);
    }
  }
  function validView(view) {
    return view?.side===side&&dimensions(view.terrain)&&Array.isArray(view.observedCells)&&
      (width===null||width===view.terrain.width&&height===view.terrain.height)&&
      view.observedCells.every(cell=>inside(cell,view.terrain.width,view.terrain.height));
  }
  function observe(view) {
    if(!validView(view)) return false;
    width=view.terrain.width;height=view.terrain.height;
    for(const cell of view.observedCells) observed.set(key(cell),step);
    return true;
  }
  function accepted(view) {
    if(view!==undefined&&!validView(view)) return false;
    if(step===Number.MAX_SAFE_INTEGER) throw Error('FULL_EXPLORATION_STEP_LIMIT');
    step++;
    // After a native side transition the owner may have no fresh own view.
    // The next legitimate own offer supplies the observation.
    if(view!==undefined) observe(view);
    return true;
  }
  function select(batch,report) {
    const view=batch?.view;
    if(!batch?.ok||batch.side!==side||!validView(view)||width===null||
        !Array.isArray(batch.candidates)||!Array.isArray(view.units)) return undefined;
    const openGoal=view.objectives?.some(goal=>goalKinds.has(goal.kind)&&
      (Number.isFinite(goal.remaining)?goal.remaining>0:goal.satisfied!==true));
    if(!openGoal||view.units.some(unit=>unit.relation==='opponent'&&unit.alive&&!unit.embarkedOn))
      return undefined;
    const own=new Set(view.units.filter(unit=>unit.relation==='own'&&unit.alive&&!unit.disabled&&!unit.embarkedOn)
      .map(unit=>unit.id));
    let selected,best;
    for(const candidate of batch.candidates) {
      if(candidate.kind!=='move'||!own.has(candidate.actorId)||candidate.target?.kind!=='cell') continue;
      const cells=candidate.facts?.observedCellsAfterMove;
      if(!inside(candidate.target,width,height)||!Array.isArray(cells)||!cells.length||
          !cells.every(cell=>inside(cell,width,height))) continue;
      const unique=new Set(cells.map(key));
      let fresh=0,oldest=0,totalAge=0;
      for(const cell of unique) {
        const last=observed.get(cell);
        if(last===undefined) fresh++;
        const age=last===undefined?step+1:step-last;
        oldest=Math.max(oldest,age);
        totalAge+=age;
      }
      const rank=[fresh,oldest,totalAge];
      if(improves(rank,best)) {selected=candidate;best=rank;}
    }
    if(selected) report?.({key:selected.key,explanationKey:'v2.round.explore'});
    return selected?.key;
  }
  function snapshot() {
    return {version:'full-exploration-v1',side,width,height,step,
      observed:[...observed].map(([cell,lastStep])=>{
        const [x,y]=cell.split(',').map(Number);
        return {x,y,lastStep};
      })};
  }
  return Object.freeze({observe,accepted,select,snapshot,reset() {
    observed.clear();width=null;height=null;step=0;
  }});
}
