/** One pointer has exactly one intent. Movement before the hold threshold locks navigation. */
export const HOLD_TO_SELECT=350, SENTENCE_HOLD=1000, PARAGRAPH_HOLD=2000, MOVE_SLOP=12;
export type ReaderGesture={id:number;x:number;y:number;lastX:number;lastY:number;started:number;mode:'pending'|'navigate'|'hold'|'select';word?:{start:number;end:number};scrollTop:number;scrollable:boolean;menuFromEdge:boolean};
export function beginGesture(id:number,x:number,y:number,started:number,word:ReaderGesture['word'],scrollTop=0,scrollable=false,menuFromEdge=true):ReaderGesture{return{id,x,y,lastX:x,lastY:y,started,word,mode:'pending',scrollTop,scrollable,menuFromEdge};}
export function advanceGesture(g:ReaderGesture,x:number,y:number,now:number){
 const distance=Math.hypot(x-g.x,y-g.y);
 if(g.mode==='pending'&&distance>MOVE_SLOP)g.mode=g.word&&now-g.started>=HOLD_TO_SELECT?'select':'navigate';
 else if(g.mode==='hold'&&distance>MOVE_SLOP)g.mode='select';
 g.lastX=x;g.lastY=y;return g.mode;
}
export function armGesture(g:ReaderGesture,now:number){if(g.mode==='pending'&&g.word&&now-g.started>=HOLD_TO_SELECT)g.mode='hold';return g.mode;}
export function finishGesture(g:ReaderGesture,x:number,y:number,now:number):'word'|'selection'|'next'|'previous'|'settings'|'none'{
 advanceGesture(g,x,y,now);armGesture(g,now);if(g.mode==='hold'||g.mode==='select')return'selection';
 if(g.mode==='pending')return g.word?'word':'none';
 const dx=x-g.x,dy=y-g.y;
 if(Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.35)return dx<0?'next':'previous';
 if(dy<=-65&&Math.abs(dy)>Math.abs(dx)*1.35&&(!g.scrollable||g.menuFromEdge))return'settings';
 return'none';
}
export function opensOverview(initial:number,current:number){return initial>0&&Math.abs(current-initial)>=28&&(current/initial>=1.25||current/initial<=.75);}
