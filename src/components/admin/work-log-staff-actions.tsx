import {
  CerrarFichajeForm,
  CorreccionFichajeForm,
} from "@/components/admin/work-log-staff-forms";
import { inputMadridDesdeInstante } from "@/lib/work-logs";
import type { Fichaje } from "@/server/data/work-logs";

/** Cerrar (si está abierto) y corregir un fichaje desde el panel. */
export function StaffWorkLogActions({
  fichaje,
  origen,
  volverA,
}: {
  fichaje: Fichaje;
  origen: "abiertos" | "solicitud";
  /** Ruta de vuelta a `/admin/fichajes` con la semana y el trabajador filtrados. */
  volverA?: string;
}) {
  return (
    <div className="space-y-2">
      {fichaje.endedAt ? null : (
        <CerrarFichajeForm workLogId={fichaje.id} origen={origen} volverA={volverA} />
      )}
      <CorreccionFichajeForm
        workLogId={fichaje.id}
        origen={origen}
        inicioInicial={inputMadridDesdeInstante(fichaje.startedAt)}
        finInicial={fichaje.endedAt ? inputMadridDesdeInstante(fichaje.endedAt) : null}
        notaInicial={fichaje.note ?? ""}
        notaObligatoria={fichaje.request === null}
        volverA={volverA}
      />
    </div>
  );
}
