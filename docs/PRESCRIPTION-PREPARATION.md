# Revisión y preparación para firma

Ficha → Borradores de recetas → abrir una versión → Revisar / imprimir. Vista previa aislada del resto de la ficha y acción de impresión del navegador (incluye Guardar como PDF donde el navegador lo admite). El borrador se imprime identificado como no válido para dispensación.

La revisión enumera campos faltantes del paciente, nombre/cédula/domicilio/título/institución del doctor y nombre/presentación/dosis/vía/frecuencia/duración de cada medicamento. Datos clínicos introducidos por el profesional, sin sugerencias. Corregir los datos del catálogo exige guardar una nueva versión para actualizar la copia histórica.

Preparar para firma requiere permisos clínicos de edición, paciente/profesional activos, versión más reciente, datos completos y confirmación explícita de revisión para preparación. Genera un folio UUID y fecha del servidor, sin permitir editar esa familia de borradores después. Reintentos y preparación concurrente devuelven el mismo folio. Para corregir, Copiar a nuevo borrador crea otra familia; el documento anterior se conserva. La copia solo permanece en memoria hasta guardarla.

Preparación e impresión no son emisión firmada. El documento muestra PREPARADA PARA FIRMA AUTÓGRAFA · SIN FIRMA, fecha de preparación en zona de la clínica y espacio de firma. Se registra quién lo preparó separadamente del doctor seleccionado; no acredita que el operador sea el prescriptor. No se implementa firma electrónica, vínculo verificado usuario-profesional, validación de cédula, recetarios especiales ni dispensación. La comprobación automática se limita a presencia de datos, no corrección clínica o validez jurídica integral. No hay marcado de firmado, anulación o revocación de documentos en este bloque.

Migración 0026: relación inmutable con versión del borrador, RLS forzada, solo SELECT/INSERT, API de revisión y preparación autenticada. Auditoría sin medicamentos. Vista HTML con escape de contenido, CSP y marco sin scripts; impresión incluye únicamente la receta, no el expediente completo. El documento usa las copias guardadas, no datos vivos del catálogo.

## Referencias consultadas el 30 septiembre 2026

- Reglamento de Insumos para la Salud, artículos 29 y 30: identificación/domicilio/cédula del prescriptor, fecha/firma y desglose del tratamiento. Texto oficial: https://sipot.cofepris.gob.mx/Archivos/juridico/PC/NORMATIVIDAD/rtoinsumos.pdf
- Reforma publicada el 24 abril 2026: https://sidof.segob.gob.mx/notas/docFuente/5785957 . Su listado de artículos reformados no incluye 29 ni 30.

Estas referencias orientan campos de la preparación; no se afirma cumplimiento integral para todos los medicamentos ni equivalencia de la preparación con una receta firmada. La emisión electrónica y sus requisitos quedan pendientes.
