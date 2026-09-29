# CineCar — GitHub + Cloudflare Workers

Esta é uma cópia independente do CineCar, pronta para uma conta própria do GitHub e do Cloudflare. O site usa **Cloudflare Workers** para páginas e APIs e **Cloudflare D1** para filmes, sessões e votos. O arquivo de vídeo continua no Google Drive informado pelo host; não é enviado ao D1.

## Antes de publicar

- Entre nas contas [GitHub](https://github.com/LunaVexy/cinecar) e [Cloudflare](https://dash.cloudflare.com/).
- Para desenvolver localmente, instale Node.js 22 ou superior e pnpm 11.25.0.
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

## Verificação de e-mail (preparação)

O novo fluxo pede um código de seis números antes de permitir data, voto e ingresso. O código expira em dez minutos, admite cinco tentativas e o login verificado fica ativo por 30 dias no mesmo navegador. O servidor usa a identidade verificada para registrar o voto, mesmo que alguém altere os dados enviados pelo navegador.

Para ativá-lo, crie uma conta gratuita em [EmailJS](https://dashboard.emailjs.com/sign-up), conecte uma conta de e-mail sua em **Email Services** e crie um template em **Email Templates**:

- **To Email:** `{{to_email}}`
- **Subject:** `Seu código para entrar no CineCar`
- **Content:** `Seu código é {{code}}. Ele vale por {{expires_minutes}} minutos. Se você não solicitou, ignore esta mensagem.`

Na página **Account → Security**, habilite a exigência de **Private Key** para envios. Anote Service ID, Template ID, Public Key e Private Key. No PowerShell, dentro de uma cópia atualizada deste repositório, execute `pnpm install` e então:

```powershell
pnpm run db:migrate
pnpm exec wrangler secret put EMAILJS_SERVICE_ID --name cinecar
pnpm exec wrangler secret put EMAILJS_TEMPLATE_ID --name cinecar
pnpm exec wrangler secret put EMAILJS_PUBLIC_KEY --name cinecar
pnpm exec wrangler secret put EMAILJS_PRIVATE_KEY --name cinecar
```

Cada comando pergunta o valor correspondente sem gravá-lo no GitHub. O projeto deve ser publicado **depois** da migração e dos quatro segredos. Teste com seu e-mail antes de compartilhar o site com o grupo. EmailJS tem limite gratuito mensal e usa a conta de e-mail que você conectar para enviar as mensagens.

## Primeira publicação

Depois de configurar o banco e o segredo:

```bash
pnpm run deploy
```

O endereço publicado é [cinecar.cinecar.workers.dev](https://cinecar.cinecar.workers.dev/). Verifique a página inicial, o painel e a criação de uma sessão de teste.

## Repositório GitHub

O código está em [LunaVexy/cinecar](https://github.com/LunaVexy/cinecar), na branch `main`. Para continuar no seu computador, clone esse repositório pelo GitHub Desktop ou com `git clone https://github.com/LunaVexy/cinecar.git`. Não precisa publicar o ZIP por cima do repositório.

No painel do Cloudflare, abra o Worker `cinecar` e conecte o repositório em **Settings → Builds → Connect**. Configure a branch de produção `main`, o comando de build `pnpm build` e o comando de deploy `pnpm exec wrangler deploy --config dist/server/wrangler.json`. Adicione a variável de build `PNPM_VERSION=11.25.0`, que corresponde à versão do projeto. Deixe a instalação automática de dependências habilitada. As próximas alterações enviadas à branch `main` poderão ser publicadas automaticamente.

## Para futuras alterações

Compartilhe o link do repositório GitHub com a conta ChatGPT que você usar. Ela precisará ter acesso ao repositório para ler e enviar alterações; o link sozinho não concede permissão se ele for privado. O Cloudflare recebe as mudanças pela integração com GitHub. Guarde a senha e as credenciais somente nos segredos do Cloudflare e da conta GitHub.

## Desenvolvimento local

```bash
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

O arquivo `wrangler.jsonc` contém o vínculo `DB` com o D1. `CINECAR_ADMIN_PIN` também deve existir no ambiente local para entrar no painel; mantenha-o num arquivo `.dev.vars` ignorado pelo Git, com a linha `CINECAR_ADMIN_PIN=...`.
