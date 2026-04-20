# /archive — Código legacy

Esta carpeta contiene código que ha sido reemplazado por implementaciones más
recientes. Se conserva como referencia histórica antes de borrarlo del todo.

## central-legacy/

**Sustituido por:** `Dashboard-Ops-/`

`central/` era el dashboard inicial deployado en `central.blackwolfsec.io`.
Todo su contenido ha sido migrado a `Dashboard-Ops-/` (que es el deploy
activo actual). La última feature del legacy (`feat(asesorias-suiza): add
Growth Passport`) ya está presente en Dashboard-Ops- (`src/pages/asesoriasuiza/`).

**Si necesitas algo de aquí:**
1. Revisa primero si está en `Dashboard-Ops-/` (probablemente sí).
2. Si no, copia el archivo concreto y abre PR en `Dashboard-Ops-`.

**Eliminar definitivamente cuando:** lleves 3 meses sin tocar archive/central-legacy
y nadie haya tenido que rescatar nada.
