# Official nginx stable Alpine image, pinned to the multi-platform digest.
FROM nginx:1.30.6-alpine@sha256:970364228b1e4f932abc22d321932816782cca8a20b85a77552a7cfe9acfb3b5

LABEL org.opencontainers.image.title="Ritmo" \
      org.opencontainers.image.description="Treino ABC no celular, com registros locais" \
      org.opencontainers.image.source="https://github.com/matheus3301/ritmo" \
      org.opencontainers.image.licenses="MIT"

# Security fixes released after the pinned base image.
RUN apk upgrade --no-cache libexpat libx11

COPY nginx.conf /etc/nginx/nginx.conf
COPY dist/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
