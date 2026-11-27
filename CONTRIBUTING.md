# Fluxo de branch + CI/CD

A partir de agora, **nada de feature direto na `main`**.

## 1. Branch por feature

```bash
git checkout main
git pull origin main
git checkout -b feature/<nome-curto>
# ou: fix/…  chore/…  docs/…
```

Exemplos: `feature/split-qr`, `fix/metricas-404`, `chore/upgrade-next`.

## 2. Desenvolvimento

- Commits pequenos e claros.
- Nunca commitar `.env` ou segredos.
- O app precisa passar localmente: `npm run lint` · `npm run build`.

## 3. Pull Request → validação humana

```bash
git push -u origin HEAD
gh pr create --base main --title "…" --body "…"
```

- O GitHub Actions (**CI**) roda no PR: lint, evals de segurança, build.
- **Só merge na `main` depois da sua validação** (e CI verde).
- Preferir **Squash and merge** para histórico limpo.

## 4. CD (deploy)

- Push/merge na `main` dispara o pipeline da Vercel (produção).
- PRs ganham **Preview Deploy** automático na Vercel (se o projeto estiver linkado ao repo).

## 5. Checklist rápido antes do merge

- [ ] CI verde no PR
- [ ] Preview Vercel ok (fluxo principal)
- [ ] Sem segredo no diff
- [ ] Você aprovou a mudança
