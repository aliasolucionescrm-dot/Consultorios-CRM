export interface PatientSummary {
 id:string;record_number:string;first_name:string;last_name:string;birth_date:string|null;
 phone:string;email:string;tags:string[];active:boolean;version:number;
}
export interface Patient extends PatientSummary {
 sex:'female'|'male'|'other'|'not_specified';whatsapp:string;address:string;occupation:string;
 emergency_name:string;emergency_phone:string;guardian_name:string;guardian_relationship:string;
 fiscal_name:string;fiscal_rfc:string;fiscal_postal_code:string;administrative_notes:string;
 created_at:string;updated_at:string;
}
export interface PatientPage {items:PatientSummary[];nextCursor:string|null}
export function patientAge(date:string|null){
 if(!date)return 'Edad no registrada';
 const now=new Date(),[y,m,d]=date.split('-').map(Number);
 let age=now.getFullYear()-y;if(now.getMonth()+1<m||(now.getMonth()+1===m&&now.getDate()<d))age--;
 return `${age} años`;
}
