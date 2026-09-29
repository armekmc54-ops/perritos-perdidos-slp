-- Se ejecuta automáticamente la primera vez que se crea el volumen de Postgres.
-- La extensión postgis ya viene activa en la imagen postgis/postgis,
-- pero la dejamos explícita por claridad. pgvector se instala aquí.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
