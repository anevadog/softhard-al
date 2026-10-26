# Spec Fase 3 — Taller interno

**Estado:** completada (sub-fases 3.1 a 3.7). Las decisiones tomadas al implementarla
están al final, en «Decisiones de implementación».

## Objetivo
Gestionar el trabajo real del taller: que cada reparación aceptada tenga un
responsable, que el trabajador registre su tiempo, que pueda avisar de que falta
una pieza o traspasar el trabajo, y que nadie olvide lo que tiene asignado. El
encargado ve el estado del taller y el tiempo dedicado a cada reparación.

## Decisión de diseño principal
No se crea una entidad "ticket interno". La unidad de trabajo es la
ServiceRequest (la reparación), que ya tiene responsable (assigneeId) y estados
en_reparacion, lista y entregada. Los mensajes del taller, los fichajes y las
asignaciones cuelgan de ella. Las tareas sueltas del taller y el inventario de
repuestos quedan fuera de esta fase.

## Actores y permisos
- Trabajador: ve solo las reparaciones que tiene asignadas y las aceptadas sin
  asignar (para tomarlas). Ficha su propio tiempo. Cambia el estado solo de sus
  reparaciones y solo hacia delante.
- Encargado y admin (mismos permisos que ahora): ven todo, asignan y reasignan,
  corrigen estados y fichajes, ven reportes.
- Cliente: sin acceso al taller. Sigue viendo su solicitud como hasta ahora.
- Ruta nueva /trabajador, accesible para trabajador, encargado y admin. Los
  permisos se comprueban en middleware, en layout y en cada Server Action
  revalidando el rol contra la base de datos, igual que requerirStaff. Se crea un
  guard equivalente para personal de taller.

## Estados y transiciones
Se añade el estado esperando_repuesto al enum de estados de solicitud.
Flujo normal: aceptada → en_reparacion → lista → entregada, con la posibilidad de
pasar de en_reparacion a esperando_repuesto y volver.
- El trabajador asignado puede: iniciar reparación (aceptada → en_reparacion),
  marcar esperando repuesto y volver, y marcar lista.
- Solo encargado y admin marcan entregada.
- Encargado y admin pueden corregir cualquier estado, con motivo obligatorio.
- El trabajador nunca toca estados anteriores a aceptada ni rechazada o expirada.
- Toda transición se registra en un historial de estados: de, a, quién, cuándo y
  motivo si lo hay.
- La regla actual "el staff puede poner cualquier estado" se sustituye por esta
  máquina de transiciones, y se mantiene un único lugar donde se decide qué cambio
  es válido (función pura con tests).

## Asignación
- El encargado asigna y reasigna a cualquier trabajador.
- Un trabajador puede tomar una reparación aceptada y sin responsable. La
  operación es condicional: si otro la tomó antes, falla con mensaje claro y no
  hay doble asignación.
- Un trabajador puede devolver una reparación al encargado con motivo
  obligatorio. La reparación conserva su estado y queda sin responsable; solo
  encargado/admin puede reasignarla. Los trabajadores solo toman las aceptadas
  sin responsable.
- Cada cambio de responsable se guarda en un historial de asignaciones: quién la
  tenía, quién la recibe, quién lo hizo, motivo y fecha.
- Si al reasignar o devolver el trabajador saliente tenía un fichaje abierto en
  esa reparación, se cierra en la misma transacción.

## Fichaje (WorkLog)
- Tipo reloj: entrada y salida con marcas de tiempo, siempre guardadas en UTC.
- Cada fichaje pertenece a un trabajador y puede estar ligado a una reparación o
  ser de horas generales (con una nota obligatoria en ese caso).
- Solo se puede fichar en una reparación asignada al propio trabajador y en estado
  en_reparacion.
- Un trabajador solo puede tener un fichaje abierto a la vez. Esta regla se
  garantiza también en la base de datos con un índice único parcial sobre los
  fichajes sin hora de salida, añadido como SQL manual en la migración. La salida
  nunca puede ser anterior a la entrada (restricción de base de datos).
- Siempre que el estado nuevo sea distinto de en_reparacion, el fichaje abierto
  de esa reparación se cierra en la misma transacción. Esto cubre lista,
  esperando_repuesto, entregada y también las correcciones del staff hacia atrás.
- Si un fichaje lleva abierto más de un número de horas configurable (valor por
  defecto razonable), el trabajador ve un aviso y el encargado puede cerrarlo.
- Las correcciones manuales solo las hace encargado o admin y dejan constancia de
  quién editó y cuándo. No hay pausas ni aprobación de horas en esta fase.

## Notas de reparación
- Mensajes internos entre taller y encargado ligados a una reparación, con autor,
  fecha y tipo: nota normal o falta de repuesto.
- Una nota de tipo falta de repuesto se destaca en la vista del encargado hasta
  que alguien la marque como atendida.
- El cliente no ve estas notas.

## Avisos (sin cron, evaluación perezosa)
- Se guarda en cada reparación la fecha de su última actividad, que se actualiza
  en la misma transacción de cualquier acción relevante: cambio de estado,
  asignación, nota o fichaje.
- Un parámetro de negocio en la tabla de configuración define las horas sin
  actividad tras las cuales una reparación se considera descuidada.
- Al cargar cualquier página de /trabajador se muestra un aviso visible con el
  número de reparaciones asignadas, aún abiertas, que superan ese plazo. Cada una
  enlaza a su detalle, donde el trabajador puede actualizar, dejar una nota o
  devolverla.
- El encargado ve en su panel las reparaciones sin actividad y las devueltas sin
  responsable.
- Los emails y notificaciones push no entran en esta fase.

## Vistas
Mobile-first en /trabajador (se usa desde el móvil del taller):
- Inicio: aviso de reparaciones descuidadas, fichaje actual con botón de entrada
  o salida, y lista de mis reparaciones por estado.
- Detalle de reparación: datos del equipo y la avería (sin datos de contacto del
  cliente salvo que el encargado decida lo contrario), cambio de estado, notas,
  fichajes de esa reparación y botón de devolver.
- Reparaciones sin asignar para tomar.
- Historial de mis fichajes por semana.
Para encargado y admin, dentro del panel actual:
- Asignación y reasignación desde el detalle de la solicitud, con historial.
- Lista de fichajes filtrable por trabajador y semana.
- Reportes mínimos: horas por trabajador y semana, horas por reparación,
  reparaciones por estado y reparaciones sin actividad.
Las semanas empiezan en lunes y se calculan en la zona horaria Europe/Madrid.

## Sub-fases
3.1 Datos y permisos: nuevas entidades (historial de estados, historial de
    asignaciones, fichajes, notas), estado esperando_repuesto, campo de última
    actividad, parámetro de aviso en la configuración, migración con las dos
    restricciones manuales, ruta /trabajador, middleware y guard de personal de
    taller.
3.2 Transiciones de estado y asignación (encargado y autoasignación), con
    historiales.
3.3 Panel del trabajador: mis reparaciones, detalle y reparaciones por tomar.
3.4 Fichaje.
3.5 Notas y falta de repuesto.
3.6 Avisos de reparaciones sin actividad.
3.7 Vistas y reportes del encargado.

## Criterios de aceptación
- Un trabajador no puede ver ni modificar reparaciones ajenas cambiando la URL
  (devuelve 404, sin revelar si existe).
- Dos trabajadores que intentan tomar la misma reparación a la vez: solo uno lo
  consigue.
- Es imposible tener dos fichajes abiertos del mismo trabajador, ni siquiera con
  doble clic o dos dispositivos.
- Toda reasignación y todo cambio de estado queda en su historial.
- Un trabajador no puede saltarse el flujo de estados ni marcar entregada.
- El aviso aparece cuando una reparación asignada supera el plazo y desaparece
  tras una actividad.
- Los reportes semanales respetan Europe/Madrid.
- Tests con Vitest de las funciones puras (transiciones, aviso, cálculo de
  horas), de las acciones y de los permisos por rol.
- typecheck, lint y build limpios.

## Fuera de alcance
- Inventario y stock de repuestos, pedidos a proveedores.
- Contabilidad, facturación y pagos reales.
- Tareas internas del taller que no sean una reparación.
- Pausas, aprobación de horas, nóminas.
- Emails y notificaciones push.
- Tests de integración contra una base de datos real.

## Decisiones de implementación
- 3.2 se dividió en 3.2a (transiciones) y 3.2b (asignación).
- Contacto del cliente: el trabajador nunca ve email ni teléfono. No existe en el
  esquema un campo para que el encargado decida lo contrario ni un campo de
  dirección para visitas a domicilio (deuda anotada).
- Una reparación libre (aceptada sin responsable) se ve en solo lectura, sin
  historiales ni nombre del cliente, con el botón Tomar.
- Una reparación devuelta no aparece en «Para tomar» ni se puede tomar: solo la
  reasigna encargado o admin.
- Solo el rol trabajador ficha. Las correcciones del encargado guardan el último
  editor (`editedById`/`editedAt`), no un historial completo, y no reabren fichajes.
- Una nota de falta de repuesto no cambia el estado; solo encargado o admin la
  marcan como atendida. Las notas no se editan ni se borran.
- El aviso de inactividad del trabajador cuenta `aceptada`, `en_reparacion` y
  `esperando_repuesto`; el panel añade `lista`. Exactamente en el plazo no avisa.
- Un fichaje cuenta entero en la semana en la que empieza; los abiertos, hasta ahora.
- Todas las fechas de la aplicación se muestran en Europe/Madrid.
