# Montar o site GNER.MODA em contas novas (GitHub, Supabase, Netlify)

Ordem: **Supabase → trocar 3 arquivos → GitHub → Netlify → domínio**. Leva cerca de 30 minutos.

---

## 1. Supabase (conta nova)

1. Crie um projeto em supabase.com (região *South America (São Paulo)*).
2. Anote, em *Project Settings → API* (ou *Connect*):
   - **Project URL** — formato `https://XXXXXXXX.supabase.co` (o XXXXXXXX é o *Project ID*)
   - **Publishable key** — começa com `sb_publishable_…`
   - Não use a *secret / service_role key* em nenhum arquivo.
3. *SQL Editor → New query*: cole e rode, **nesta ordem**, cada arquivo da pasta `supabase/`:
   `01_schema.sql` → `02_functions.sql` → `03_security.sql` → `04_seed.sql`
4. *Authentication → Users → Add user → Create new user* (marque *Auto confirm*). Depois, no SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'SEU-EMAIL';
   ```
5. *Authentication → Sign In / Providers* → desligue **Allow new users to sign up**.
6. *Authentication → URL Configuration* → Site URL = o domínio do site.
7. Opcional: *Authentication → Settings* → ative a proteção contra senhas vazadas.

---

## 2. Trocar os dados da conta antiga (3 arquivos)

Abra no editor de texto e substitua:

| Arquivo | Linhas | Trocar por |
|---|---|---|
| `src/config/site.ts` | `url:` e `key:` do `supabaseConfig` | nova Project URL e nova publishable key |
| `netlify/edge-functions/og.ts` | `SUPABASE_URL` e `SUPABASE_KEY` (topo do arquivo) | os mesmos dois valores |
| `src/config/site.ts`, `netlify/edge-functions/og.ts`, `index.html` | `gnermoda.com` | o novo domínio, **só se ele mudar** |

WhatsApp, e-mail e Instagram ficam em `src/config/site.ts`.

> Sem trocar esses valores, o site novo continuaria lendo o banco **antigo**.

---

## 3. GitHub (conta nova)

⚠️ **Não envie arrastando arquivos no site do GitHub**: o limite é 100 arquivos por envio e o projeto tem mais de 230 — a pasta `public/` (fotos, logo) se perde sem aviso. Foi o que quebrou as imagens da primeira vez.

Use o **GitHub Desktop** (desktop.github.com):
1. *File → New repository* → escolha a pasta do projeto (esta, descompactada) → *Create repository*.
2. *Publish repository* (pode ser privado).
3. Confira no site do GitHub que existem as pastas `public/static/acervo`, `public/static/gner` e `public/static/referencias`.

Ou pelo terminal, dentro da pasta:
```bash
git init && git add -A && git commit -m "Site GNER.MODA"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

---

## 4. Netlify (conta nova)

1. *Add new site → Import an existing project → GitHub* → escolha o repositório.
2. Não precisa preencher nada: build e pasta vêm do `netlify.toml`. *Deploy*.
3. Teste no endereço `.netlify.app` **antes** de ligar o domínio:
   - `/logo.svg` deve mostrar o quadro “logo” (se mostrar o site, a pasta `public/` não subiu)
   - `/acervo` com as 48 peças e fotos
   - `/admin` → login com o usuário do passo 1.4

Não use “arrastar a pasta dist” no Netlify: a função de prévia do WhatsApp não é publicada desse jeito.

---

## 5. Domínio

Se o domínio sair do site antigo: em *Netlify antigo → Domain management*, **remova** `gnermoda.com` primeiro (um domínio só pode estar em um site Netlify).

No novo site: *Domain management → Add domain* → `gnermoda.com`. No GoDaddy (*DNS*):

| Tipo | Nome | Valor |
|---|---|---|
| A | @ | 75.2.60.5 |
| CNAME | www | NOME-DO-SITE.netlify.app |

Apague outros registros A do `@`. O HTTPS é emitido sozinho depois que o DNS propaga.

---

## 6. O que NÃO vem junto

- **Conteúdo cadastrado pelo painel** na conta antiga (projetos, fotos enviadas, status alterados). O `04_seed.sql` recria só o estado inicial: 48 peças *Sob consulta* + projeto de teste.
  Se já houver conteúdo real cadastrado, ele precisa ser migrado à parte (banco + fotos do Storage) — peça ajuda antes de desligar a conta antiga.
- **Usuários admin**: recrie no passo 1.4.
