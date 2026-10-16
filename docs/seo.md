# SEO editorial

El modulo SEO guarda overrides editoriales y conserva el contenido canonico
en `MenuItem`, `Event`, `ImportantAnnouncement` y las paginas del sitio.
La migracion es aditiva y no elimina contenido existente.

## Contrato publico

`GET /seo?resourceType=&resourceKey=&locationId=` resuelve los valores
publicados. `resourceType` puede ser `page`, `menu_item`, `event` o
`announcement`. Si no existe un override, la API genera un titulo,
descripcion, imagen y canonical sensatos desde el recurso publicado.

`GET /sitemap.xml` incluye paginas, platos, eventos y avisos vigentes. Omite
recursos despublicados y overrides marcados como `noindex`.

`GET /robots.txt` permite el rastreo publico, bloquea `/admin` y enlaza el
sitemap usando `PUBLIC_SITE_URL`.

## Administracion

Las rutas `/seo/admin` requieren sesion, CSRF, `seo.read` para lectura o
`seo.manage` para crear, actualizar y eliminar. Todas las operaciones reciben
`locationId` y pasan por `AccessScopeService`; las paginas se almacenan con
alcance de negocio y los recursos operativos con alcance de sede.

Los limites del contrato son 70 caracteres para el titulo, 160 para la
descripcion, 500 para imagen/canonical y 160 para la clave. Las URLs aceptan
solo HTTP(S) sin credenciales.

## Configuracion

Define `PUBLIC_SITE_URL` en el entorno de la API. El valor por defecto local
es `http://localhost:5173`; no debe contener secretos ni credenciales.
