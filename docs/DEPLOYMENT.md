# Deploy no Coolify

O Ritmo é um site estático. O Dockerfile inclui somente nginx, configuração e `dist/`. Não há build de frontend, banco de dados, autenticação ou segredo de runtime.

## Configuração

Crie uma aplicação pela instalação do GitHub App que tenha acesso a este repositório, mesmo quando ele for público.

| Campo | Valor |
| --- | --- |
| Repositório | `matheus3301/ritmo` |
| Branch | `main` |
| Build pack | `Dockerfile` |
| Base directory | `/` |
| Dockerfile location | `/Dockerfile` |
| Porta da aplicação | `8080` |
| Domínio | hostname HTTPS escolhido na sua infraestrutura |
| Health check | `GET http://127.0.0.1:8080/health`, resposta `200` |
| Variáveis / volumes | nenhum |

O Dockerfile define seu próprio `HEALTHCHECK`. O nginx escuta em `0.0.0.0:8080`; a porta 80 herdada nos metadados da imagem base não é usada. O proxy do Coolify termina TLS. Configure DNS e certificado antes de compartilhar o endereço.

## Validar a imagem

```sh
npm ci
npm test
docker build --pull -t ritmo:local .
docker run -d --name ritmo-check \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 ritmo:local
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/data/program.json
docker inspect ritmo-check --format '{{.State.Health.Status}}'
docker rm -f ritmo-check
```

Espere `healthy` antes de considerar a implantação pronta. Verifique também a página inicial e o endpoint de saúde pelo endereço HTTPS externo. O teste automatizado no GitHub valida a imagem em Linux; a verificação do deploy deve confirmar o commit exato.

## Atualizar e reverter

Mantenha a imagem base fixada por versão e digest; atualize ambos após revisar vulnerabilidades e testar novamente. O projeto não instala pacotes npm no container.

Antes de cada publicação que altere `dist/`, incremente `CACHE` em `sw.js`. A atualização offline entra em vigor quando as abas antigas são fechadas e o aplicativo é reaberto. O nginx solicita revalidação HTTP dos arquivos para evitar misturar releases no cache da rede.

Habilite auto deploy no Coolify se quiser publicar a cada push. Como o webhook pode iniciar antes do CI terminar, exija CI aprovado antes de mesclar em `main`. Para reverter, publique o commit anterior pelo Coolify ou reverta o commit no GitHub. Não limpe dados locais dos usuários. Mudanças no formato do backup exigem migração compatível.
