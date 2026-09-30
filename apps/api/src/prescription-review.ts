export type ReviewRow={input:{medications:Record<string,string>[]};snapshot:{patient:{first_name?:string;last_name?:string};professional:{name?:string;license?:string;practice_address?:string;training_institution?:string;professional_title?:string}}};
export function prescriptionMissing(row:ReviewRow){
 const missing:string[]=[];
 for(const [label,value] of [['Nombre del paciente',row.snapshot.patient.first_name],['Apellidos del paciente',row.snapshot.patient.last_name],['Nombre del doctor',row.snapshot.professional.name],['Cédula profesional',row.snapshot.professional.license],['Dirección profesional',row.snapshot.professional.practice_address],['Institución de formación',row.snapshot.professional.training_institution],['Título profesional',row.snapshot.professional.professional_title]])if(!value?.trim())missing.push(label!);
 const fields:Record<string,string>={name:'medicamento',presentation:'presentación',dose:'dosis',route:'vía',frequency:'frecuencia',duration:'duración'};
 row.input.medications.forEach((m,i)=>{for(const [key,label] of Object.entries(fields))if(!m[key]?.trim())missing.push('Medicamento '+(i+1)+': '+label);});
 return missing;
}
