# Contribuir com o Ritmo

O projeto reúne pesquisa, fichas em JSON e um renderizador para o celular. Contribuições podem melhorar qualquer uma dessas partes.

## Alterar uma ficha

1. Edite o perfil em `dist/data/profiles/` e mantenha seu ID estável.
2. Registre referências em `dist/data/sources.json`, distinguindo resultados da pesquisa e decisões de programação. Informe se consultou resumo, trechos ou texto completo.
3. Confira a variante de cada exercício e o vídeo em `exercises.json`. Um vídeo de outra variante não serve como confirmação de execução.
4. Rode `npm run sheets` e revise as agendas, séries reduzidas e tabelas de volume geradas.
5. Rode `npm test` e confira a ficha no celular, nos temas claro e escuro.

## Adicionar um perfil

Use um perfil existente e o [contrato dos dados](docs/architecture.md) como referência. Adicione o novo arquivo ao catálogo e ao cache em `dist/sw.js`, incrementando sua versão. A identificação da ficha não deve gerar ramificações no renderizador: declare a prescrição e as regras no JSON.

Inclua público, objetivo, limitações, fontes, adaptação e calendários válidos. Não apresente uma rotina como universal nem prometa resultados de composição corporal.

## Alterar o aplicativo

Preserve importação de cópias antigas, históricos separados, navegação por teclado e dados locais. Acrescente testes quando houver mudança no calendário, validação ou armazenamento. Evite dependências sem necessidade.

Ao abrir uma contribuição, descreva o problema, a mudança e como conferiu o resultado. Código e textos enviados devem poder ser distribuídos sob a licença do projeto; imagens, vídeos e pesquisas de terceiros exigem atribuição e respeito às próprias licenças.
