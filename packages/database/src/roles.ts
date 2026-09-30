export const rolePermissions:Record<string,string[]> = {
 'Propietario':['*'],
 'Administrador':['cash_closures.view','cash_closures.create','patients.view','payments.view','payments.create','payments.void','budgets.view','budgets.manage','catalogs.view','catalogs.manage','organizations.view','settings.manage','users.view','users.manage','audit.view','appointments.view','appointments.create','appointments.edit'],
 'Odontólogo':['budgets.view','budgets.manage','catalogs.view','organizations.view','patients.view','patients.create','patients.edit','clinical_records.view','clinical_records.edit','odontogram.view','odontogram.edit','clinical_notes.create','clinical_notes.sign','appointments.view','appointments.create','appointments.edit'],
 'Especialista':['catalogs.view','organizations.view','patients.view','clinical_records.view','clinical_records.edit','odontogram.view','odontogram.edit','clinical_notes.create','clinical_notes.sign','appointments.view'],
 'Asistente':['catalogs.view','organizations.view','patients.view','appointments.view','odontogram.view'],
 'Recepción':['catalogs.view','organizations.view','patients.view','patients.create','patients.edit','appointments.view','appointments.create','appointments.edit'],
 'Caja':['cash_closures.view','cash_closures.create','patients.view','catalogs.view','organizations.view','payments.view','payments.create'],
 'Contabilidad':['cash_closures.view','patients.view','organizations.view','payments.view','reports.financial'],
 'Inventario':['organizations.view','inventory.view','inventory.edit'],
 'Solo lectura':['organizations.view']
};


