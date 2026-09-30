# Familiares vinculados

La ficha permite buscar otro paciente activo por nombre, teléfono o expediente y vincularlo indicando qué parentesco tiene con la persona cuya ficha está abierta. Opciones: madre/padre, hija/hijo, hermana/hermano, pareja, abuela/abuelo, nieta/nieto y otro familiar.

Se guarda un único vínculo por pareja de pacientes; la otra ficha muestra automáticamente el parentesco inverso. No se infiere género. Los vínculos existentes continúan visibles si una ficha se desactiva. Abrir ficha permite navegar al familiar.

La lectura requiere patients.view y los cambios patients.edit. Ambos pacientes deben pertenecer a la organización. La base impide autorrelaciones y duplicados incluso bajo concurrencia. RLS y claves compuestas refuerzan el aislamiento. Retirar requiere versión y motivo, desactiva el vínculo en ambas fichas y deja auditoría. Para corregir un parentesco se retira el vínculo y se crea nuevamente.

Esto no otorga acceso, representación legal ni comparte datos clínicos, saldos o contactos. No sustituye los datos de responsable o tutor. Migración 0012.
