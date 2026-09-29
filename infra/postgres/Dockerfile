# La imagen oficial postgis/postgis NO trae pgvector preinstalado.
# Este Dockerfile parte de ella y compila/instala pgvector encima,
# dejando una sola imagen con PostGIS + pgvector listos.

FROM postgis/postgis:16-3.4

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        postgresql-server-dev-16 \
        git \
        ca-certificates && \
    git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git /tmp/pgvector && \
    cd /tmp/pgvector && \
    make && make install && \
    apt-get purge -y --auto-remove build-essential git && \
    rm -rf /tmp/pgvector /var/lib/apt/lists/*
