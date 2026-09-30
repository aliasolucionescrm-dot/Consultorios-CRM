'use client';
export type Condition={status:'unknown'|'none_reported'|'reported';detail:string};
export type Conditions=Partial<Record<'dietary'|'pharmacological'|'systemic'|'infectious',Condition>>;
const labels={dietary:'Alimenticia',pharmacological:'Farmacológica',systemic:'Enfermedades sistémicas',infectious:'Enfermedades infectocontagiosas'};
const states={unknown:'Sin verificar',none_reported:'Sin antecedentes reportados',reported:'Condición reportada'};
const blank:Condition={status:'unknown',detail:''};
export function ConditionsView({value,allergy}:{value?:Conditions;allergy:Condition}){
 return <div className="condition-grid">{[['allergic','Alérgica',allergy],...Object.entries(labels).map(([key,label])=>[key,label,value?.[key as keyof Conditions]||blank])] .map(([key,label,item])=>{const c=item as Condition;return <article className={'condition-card condition-'+key} key={key as string}><strong>{label as string}</strong><span>{states[c.status]}</span>{c.detail&&<p className="patient-notes">{c.detail}</p>}</article>;})}</div>;
}
export function ConditionsEditor({value={},onChange,disabled}:{value?:Conditions;onChange:(v:Conditions)=>void;disabled:boolean}){
 return <fieldset className="budget-fields"><legend>Condiciones clínicas</legend><p>Registra únicamente lo reportado o verificado. Los colores identifican categorías, no gravedad.</p>{Object.entries(labels).map(([key,label])=>{const k=key as keyof Conditions,c=value[k]||blank;return <div className={'condition-card condition-'+key} key={key}><label className="field"><span>{label}</span><select aria-label={'Estado · '+label} disabled={disabled} value={c.status} onChange={e=>onChange({...value,[key]:{status:e.target.value,detail:''}})}>{Object.entries(states).map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>{c.status==='reported'&&<label className="field"><span>Detalle · {label}</span><textarea aria-label={'Detalle · '+label} required maxLength={1500} disabled={disabled} value={c.detail} onChange={e=>onChange({...value,[key]:{...c,detail:e.target.value}})}/></label>}</div>;})}</fieldset>;
}
