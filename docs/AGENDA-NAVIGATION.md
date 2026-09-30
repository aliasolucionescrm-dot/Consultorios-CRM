# Navegación persistente de agenda

La agenda recuerda la fecha, la vista día/semana/mes y la sucursal activa mediante sessionStorage. La clave incluye usuario y organización. La información se conserva al recargar y al ir a otra sección y regresar dentro de la misma pestaña. No se guardan pacientes, motivos ni borradores clínicos.

Al cargar la organización se valida que la sucursal recordada exista y esté activa. Si no, se usa la primera activa. Las fechas y vistas inválidas se ignoran. Si el navegador impide almacenar datos, la navegación continúa funcionando sin persistencia.

Al abrir una cita desde la ficha o búsqueda global se prioriza su fecha y sucursal, mostrando Día. Esa nueva fecha pasa a ser la recordada. La persistencia no comparte datos entre usuarios u organizaciones y no cambia permisos ni acceso a la API.

Alcance: sesión de pestaña; no sincroniza dispositivos, no crea enlaces compartibles, no restaura filtros ni formularios sin guardar. La organización activa sigue el comportamiento existente de inicio de sesión.
