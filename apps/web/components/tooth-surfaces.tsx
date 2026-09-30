'use client';
const regions=[
 {key:'vestibular',label:'Vestibular',points:'10,10 290,10 215,85 85,85',x:150,y:47},
 {key:'mesial',label:'Mesial',points:'10,10 85,85 85,215 10,290',x:46,y:150},
 {key:'distal',label:'Distal',points:'290,10 290,290 215,215 215,85',x:254,y:150},
 {key:'oral',label:'Palatina / lingual',points:'10,290 85,215 215,215 290,290',x:150,y:257},
 {key:'occlusal_incisal',label:'Oclusal / incisal',points:'85,85 215,85 215,215 85,215',x:150,y:150},
];
export function ToothSurfaces({value,marked,disabled,onSelect}:{value:string;marked:string[];disabled:boolean;onSelect:(surface:string)=>void}){
 return <div className="tooth-surfaces"><p>Selecciona una superficie</p><svg viewBox="0 0 300 300" role="group" aria-label="Superficies del diente seleccionado">{regions.map(r=><g key={r.key} role="button" tabIndex={disabled?-1:0} aria-disabled={disabled} aria-label={'Superficie '+r.label} aria-pressed={value===r.key} className={(value===r.key?'selected ':'')+(marked.includes(r.key)?'recorded':'')} onClick={()=>{if(!disabled)onSelect(r.key);}} onKeyDown={e=>{if(!disabled&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect(r.key);}}}><polygon points={r.points}/><text x={r.x} y={r.y} textAnchor="middle" dominantBaseline="middle">{r.label.includes(' / ')?<><tspan x={r.x} dy="-7">{r.label.split(' / ')[0]}</tspan><tspan x={r.x} dy="17">/ {r.label.split(' / ')[1]}</tspan></>:r.label}</text>{marked.includes(r.key)&&<text x={r.x} y={r.y+28} textAnchor="middle" className="surface-dot">●</text>}</g>)}</svg><button className="button secondary" disabled={disabled} aria-pressed={value==='whole'} onClick={()=>onSelect('whole')}>Pieza completa{marked.includes('whole')?' · con observación':''}</button><small>Esquema de selección, sin orientación anatómica. Los nombres identifican las superficies. Azul: seleccionada · ●: con observación.</small></div>;
}
