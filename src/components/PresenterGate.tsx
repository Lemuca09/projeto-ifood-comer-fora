export function PresenterGate() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold">Acesso restrito</h1>
      <p className="text-sm text-ink/70">
        Use <code>?token=</code> com o valor de <code>PRESENTER_TOKEN</code> do
        servidor. Não compartilhe o token em gravações públicas.
      </p>
    </div>
  );
}
