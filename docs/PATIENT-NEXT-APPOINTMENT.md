# Próxima cita del paciente

La ficha administrativa incluye la cita futura más cercana cuyo estado sea pendiente, confirmada, llegada o en consulta. Se busca entre todas las sucursales de la organización, ordenando por inicio e identificador. Las citas pasadas, canceladas, completadas y las inasistencias quedan fuera. Si no hay resultados se muestra un estado vacío; los errores se distinguen de ese estado.

El resumen presenta fecha y hora en la zona guardada en la cita, servicio, profesional, consultorio, sucursal y estado. Ver cita en agenda cambia la sucursal y abre el día correspondiente en la zona actual de la organización. La agenda conserva su lista diaria completa; el usuario puede abrir el detalle de la cita desde ella.

GET patients/:id/next-appointment requiere patients.view y appointments.view, valida pertenencia y usa la transacción con RLS. Sin permiso de agenda no se solicita ni muestra el resumen. Existe actualización manual y se recarga al regresar a la ficha.

No incluye historial completo, alertas médicas ni saldo. No envía recordatorios ni modifica citas.
