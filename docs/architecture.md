# Ritmo

Aplicação web estática para acompanhar o plano A/B/C de uma mulher iniciante. Sem backend, autenticação, banco de dados ou dependências de execução. HTML, CSS e módulos JavaScript nativos.

## Usar e desenvolver

Execute `npm start` e abra `http://127.0.0.1:43187`. O servidor de desenvolvimento usa Node.js, sem dependências externas. Não abra o HTML por `file://`, pois o conteúdo é carregado por `fetch`.

Execute `npm test` para verificar agenda, datas locais, volume, adaptação, integridade das mídias e importação de registros. Node.js 22 ou superior é suficiente. Não há etapa de build: `dist/` já contém o site publicável.

## Conteúdo

- `dist/data/program.json`: fichas, séries, repetições, pausas, adaptação e calendários.
- `dist/data/exercises.json`: nomes, instruções e demonstrações dos 15 exercícios.
- `dist/data/guidance.json`: orientações do plano, progressão e privacidade.
- `dist/data/sources.json`: nove fontes da pesquisa científica anterior.
- `research/exercise-media.json`: metadados, correspondência de variantes e limites de verificação dos vídeos.
- `research/skills.json`: pesquisa de skills consultada em 19/10/2026.
- A skill beautiful-prose foi consultada no repositório de origem; seu texto não é redistribuído.

As variantes da interface foram delimitadas para corresponder às demonstrações. O agachamento usa halter (goblet); a flexora é sentada; o tríceps usa barra reta; a elevação lateral é sentada; a prancha usa mãos e joelhos. Não trocar o nome mantendo um vídeo de outra variação. Trocas de exercício devem ser avaliadas pelo instrutor e exigir sua própria mídia.

## Estado local

A chave `ritmo:v1` do `localStorage` contém versão, preferências e registros por data e ficha. Nenhum registro é enviado a servidor. O arquivo de exportação também é JSON, validado antes da importação. A importação e a exclusão pedem confirmação na interface. Alterar o plano preserva o histórico e a prescrição originalmente registrada.

Dados pertencem à origem e ao navegador usados. Trocar de endereço de hospedagem, limpar dados do navegador ou fechar a última aba privada pode impedir a recuperação. Oferecemos exportação/importação, sem prometer sincronização.

## Instalação e cache

O manifesto permite adicionar o app à tela inicial. O service worker armazena apenas os arquivos estáticos enumerados, sem interceptar YouTube ou outros domínios. Requer HTTPS em produção (localhost também é permitido). Ao alterar qualquer conteúdo em `dist/`, incremente a versão `CACHE` em `sw.js`. A atualização passa a valer após fechar as abas antigas e reabrir o site. Nenhum arquivo de usuário entra no cache do service worker.

## Mídias e atribuição

Os 15 vídeos foram encontrados por busca e verificados por metadados oEmbed e inspeção de miniaturas oficiais mostrando mulheres. Há 5 vídeos em português e 10 em inglês. Não foram assistidos integralmente. O player incorporado de hip thrust foi carregado e seus controles foram verificados na prévia; a reprodução de todos os vídeos em todos os dispositivos não foi certificada.

Não hospedamos cópias dos vídeos. A capa e o player vêm do YouTube, com atribuição ao canal e link externo. Algumas capas são de vídeos sobre erros: a interface orienta assistir à explicação, em vez de copiar a pose da miniatura. Incorporação, disponibilidade, legendas e restrições dependem do canal e do YouTube. O link externo permanece disponível. O modo `youtube-nocookie.com` não significa ausência de comunicação com o YouTube; imagens também fazem requisições ao serviço.

As fontes Bricolage Grotesque e Manrope são hospedadas localmente, com licenças OFL em `dist/assets/`. Ícones de interface em SVG são incluídos no código.

## Decisões de design

Público: iniciante usando o telefone durante a academia. A tela inicial mostra treino do dia, séries realizadas e o que vem amanhã. A, B e C são a referência visual, como fichas de treino, e não números decorativos.

Paleta: papel `#F7F8FC`, tinta `#24213A`, íris `#5B4CCE`, lilás `#EDEAFF`, menta `#D9EBE7`, coral `#F4B3A3`. Bricolage nos títulos, Manrope nos controles e textos. Navegação inferior no celular e lateral no desktop. Movimento limitado a feedback de interação, respeitando a preferência por movimento reduzido.

## Verificação

Os testes automatizados cobrem as regras de negócio. A revisão no navegador incluiu configuração de cinco dias, ficha e agenda, registro de carga/repetições, recarga com persistência, histórico, exportação e importação, player e cronômetro. Layouts examinados em 320, 390 e 1440 pixels. Ver `research/verification.txt` para o resultado final e limites.

## Publicação

O Dockerfile serve apenas `dist/` com nginx, usuário 101 e porta 8080. Consulte [Deploy](DEPLOYMENT.md).
