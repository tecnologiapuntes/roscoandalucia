# ROSCO 4D ANDALUCÍA · V5.2 — EDICIÓN @tecnologiainsti

Edición para compartir como recurso de **Tecnología Insti (@tecnologiainsti)**, basada en la V5.2 del juego. Sustituye toda la identidad visual del centro anterior por el logo proporcionado de @tecnologiainsti. No incorpora lector de voz.

## ¿Qué conserva?

- 216 preguntas sobre Andalucía: cuatro niveles de dificultad, 27 letras y dos bancos independientes A/B por nivel.
- Partida individual o duelo por equipos, nombres personalizados y sorteo de salida.
- Dos formas de responder: respuesta escrita y comprobación, o corrección oral/manual mediante la PDI.
- Cronómetros separados, ayudas o comodines, avisos de tiempo y modo presentador **sin lectura de voz**.
- Deshacer la última respuesta, vista previa de preguntas, repaso de errores y diploma.
- Editor docente para cambiar enunciados, soluciones y «Empieza por»/«Contiene la»; verificador y exportación de un HTML personalizado para PDI.
- Dos opciones de ayuda: editar desde la web o descargar/descomprimir el ZIP.

## Contenido del ZIP

- `index.html`: página principal **autónoma**; lleva integrados el estilo, el banco de preguntas, la lógica del juego, el logo y la plantilla exportadora de HTML para PDI.
- `Rosco_4D_V5_2_TECNOLOGIA_INSTI_PDI.html`: juego autónomo con las 216 preguntas iniciales para abrir directamente en una PDI u ordenador.
- `solucionario.html` y `GUIA_DOCENTE.html`: páginas de apoyo docente.
- `GUIA_DOCENTE_DOS_OPCIONES.pdf`, `GUIA_DOCENTE_EDITAR_DESDE_WEB.pdf`, `GUIA_DOCENTE_PARA_COMPARTIR.pdf`: guías PDF ya personalizadas.
- `assets/logo-tecnologiainsti.webp` y `.png`: el logo del usuario optimizado para web y documentos.
- `css/` y `js/`: fuentes independientes editables para futuras versiones.

## Publicar en Tecnología Insti con GitHub Pages

**No sustituyas el `index.html` de la portada de tu web personal.** Dentro del repositorio `tecno` crea una carpeta, por ejemplo `rosco4d`, y copia allí *todos los archivos y subcarpetas* de esta edición. La ruta prevista será:

`https://tecnologiapuntes.github.io/tecno/rosco4d/`

Después, añade a tu web principal el enlace a esta ruta. Si prefieres alojar el Rosco en un repositorio GitHub independiente, copia los archivos a la raíz de ese repositorio.

En GitHub Desktop, desde tu copia limpia, sustituye o añade los archivos, realiza **Commit to main** y luego **Push origin**. **No uses «Merge into current branch»** para instalar la edición. Si ya existe un archivo antiguo `assets/logo-antiguo.png`, bórralo: esta edición no lo necesita.

## Personalizar preguntas y usarlas en clase

1. Abre `index.html` o la web publicada y pulsa **Editor docente**.
2. Selecciona dificultad, equipo A/B y letra. Modifica el enunciado, la respuesta y el tipo de pista.
3. Guarda cada pregunta. Usa la opción de verificación del banco.
4. Pulsa **Descargar mi rosco para PDI (.html)**, con el nombre que prefieras.
5. Guarda ese único HTML y ábrelo con Chrome o Edge en la PDI. Puede utilizarse sin Internet.

**Importante:** guardar una pregunta la conserva localmente en ese navegador; no altera los archivos del repositorio ni la web pública. Para transportarla a otro dispositivo hay que descargar el HTML personalizado.

## Identidad y compatibilidad

El logo, el crédito @tecnologiainsti y las referencias de exportación están incorporados tanto en el `index.html` principal como en los HTML personalizados descargados. El favicon y el logo mostrado no requieren archivos externos en la página principal. El lector de voz sigue excluido, como en la V5.2 de origen.

El navegador debe ser moderno (Chrome o Edge recomendados). La funcionalidad del juego no depende de servicios de pago ni de una base de datos.
