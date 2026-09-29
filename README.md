# CineCar — GitHub + Cloudflare Workers

Esta é uma cópia independente do CineCar, pronta para uma conta própria do GitHub e do Cloudflare. O site usa **Cloudflare Workers** para páginas e APIs e **Cloudflare D1** para filmes, sessões e votos. O arquivo de vídeo continua no Google Drive informado pelo host; não é enviado ao D1.

## Antes de publicar

- Crie as contas no [GitHub](https://github.com/signup) e [Cloudflare](https://dash.cloudflare.com/sign-up).
- Instale Node.js 22 ou superior. Ative pnpm com `corepack enable` e `corepack prepare pnpm@11.25.0 --activate`.
- Extraia a pasta, abra um terminal nela e execute `pnpm install`.

## Banco gratuito D1

1. Execute `pnpm exec wrangler login` e escolha sua nova conta Cloudflare no navegador.
2. O banco `cinecar-db` já foi criado na conta Cloudflare, com o identificador configurado em `wrangler.jsonc`. Não execute a criação novamente.
3. Execute `pnpm run db:migrate` e confirme a criação das tabelas no banco remoto.

As migrações estão em `drizzle/`. O banco novo começa vazio; o catálogo inicial é criado ao abrir o painel pela primeira vez. Sessões, votos e filmes adicionados no site anterior não são transferidos automaticamente.

## Senha do painel

Defina a senha como **segredo** no Cloudflare, sem colocar o valor no GitHub:

```bash
pnpm exec wrangler secret put CINECAR_ADMIN_PIN --name cinecar
```

O comando pergunta a senha sem gravá-la no código. Use uma senha nova na migração; a anterior foi compartilhada na conversa e pode ser trocada agora.

## Primeira publicação

Depois de configurar o banco e o segredo:

```bash
pnpm run deploy
```

O Wrangler mostrará o endereço `*.workers.dev`. Essa publicação usa o mesmo código do repositório. Verifique a página inicial, o painel e a criação de uma sessão de teste.

## Colocar no seu GitHub

Crie um repositório **privado** e vazio chamado `cinecar` na nova conta GitHub. Não marque as opções de README, `.gitignore` ou licença na criação. Dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "CineCar inicial"
git branch -M main
git remote add origin https://github.com/LunaVexy/cinecar.git
git push -u origin main
```

O repositório `LunaVexy/cinecar` já foi criado. Para não usar comandos Git, abra a pasta no GitHub Desktop, publique no repositório privado existente e selecione a nova conta.

No painel do Cloudflare, abra o Worker `cinecar` e conecte o repositório em **Settings → Builds → Connect**. Configure o comando de build como `pnpm build` e o de deploy como `pnpm exec wrangler deploy --config dist/server/wrangler.json`. Se a tela pedir o comando de instalação, use `corepack enable && pnpm install --frozen-lockfile`. As próximas alterações enviadas à branch `main` poderão ser publicadas automaticamente.

## Para futuras alterações

Compartilhe o link do repositório GitHub com a conta ChatGPT que você usar. Ela precisará ter acesso ao repositório para ler e enviar alterações; o link sozinho não concede permissão se ele for privado. O Cloudflare recebe as mudanças pela integração com GitHub. Guarde a senha e as credenciais somente nos segredos do Cloudflare e da conta GitHub.

## Desenvolvimento local

```bash
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

O arquivo `wrangler.jsonc` contém o vínculo `DB` com o D1. `CINECAR_ADMIN_PIN` também deve existir no ambiente local para entrar no painel; mantenha-o num arquivo `.dev.vars` ignorado pelo Git, com a linha `CINECAR_ADMIN_PIN=...`.
