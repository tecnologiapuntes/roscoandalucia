# Rosco 4D Andalucía — V5.3.1 · Cambio de turno visible

Esta edición mantiene todas las funciones de la V5.3 y añade un **cartel a pantalla completa de cambio de turno** en los duelos cuando se produce Pasapalabra, un fallo (tras ver la respuesta y pulsar continuar) o se agota el tiempo de un equipo. Aparece durante 1,9 segundos, se puede cerrar tocándolo y **el cronómetro queda detenido durante el cartel**. Todo en verdes de Andalucía.

La misma función está incluida en `index.html`, en `Rosco_4D_V5_3_1_LISTO_PARA_PDI.html` y en los HTML personalizados que exporte el profesorado. No se han modificado los bancos de 216 preguntas, las reglas de puntuación ni el editor.

## Publicación

Para actualizar el sitio ya publicado en GitHub Pages, basta con sustituir el archivo `index.html`, hacer **Commit to main → Push origin**. Los archivos adicionales de este ZIP sirven para uso offline y documentación.

# Rosco 4D Andalucía — V5.3 · Vista Concurso · @tecnologiainsti

Versión basada en V5.2 Tecnología Insti. Mantiene el editor, banco de 216 preguntas, ayudas, solucionario, HTML autónomo sin conexión, cronómetros independientes, comodines, modo presentador, deshacer, vista previa y repaso de errores. Sin lector de voz.

## Novedades V5.3

1. **Vista Concurso** (predeterminada en duelo): muestra los dos roscos de 27 letras simultáneamente.
2. **Vista clásica**: se puede elegir en la portada o cambiar durante el juego, sin reiniciar.
3. **Turnos visibles**: equipo activo destacado, el otro rosco sigue presente.
4. **Adaptación para PDI**: estilos específicos para pantallas 1024×768, 1366×768 y Full HD y controles táctiles.
5. **Cronómetros**: dos contadores visibles dentro de los paneles de cada equipo, avisos de 30 y 10 segundos.
6. **Modo presentador**: cuando se usa con Vista Concurso mantiene los dos roscos visibles.
7. **Final de duelo**: compara gráficamente los dos roscos completos y sus resultados.

## Publicación GitHub Pages

En la rama `main`, sustituir únicamente `index.html`; hacer Commit → Push. El archivo principal es autosuficiente: incluye los estilos, las preguntas y la plantilla para exportar HTML. La versión completa incluye asimismo las guías y el solucionario.

## Para usar sin Internet

Abrir `Rosco_4D_V5_3_LISTO_PARA_PDI.html` en Chrome o Edge. También se puede abrir la web, editar las preguntas y descargar un HTML personalizado. Cada archivo incluye las dos vistas y todas las mejoras.

## Comportamiento de respuestas

La respuesta escrita solo se acepta al coincidir con una solución completa válida. Una letra aislada nunca puntúa. Los botones Correcto/Fallo/Pasapalabra de la PDI son acciones explícitas del docente.
