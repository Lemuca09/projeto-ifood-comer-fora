"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDemoSession } from "@/context/DemoSessionContext";
import { useAnalyticsDashboard } from "@/context/AnalyticsDashboardContext";
import { DiagnosisPanel } from "@/components/DiagnosisPanel";

/** Jornada oficial do Comer Fora hoje (briefing do case). */
const TODAY_JOURNEY = [
  {
    step: "01",
    title: "Descoberta",
    copy: "O atalho de Comer Fora fica escondido no Perfil; de lá, o usuário ainda precisa tocar em Explorar restaurantes. Pouca gente chega à jornada sozinha.",
  },
  {
    step: "02",
    title: "Reserva",
    copy: "Agenda a mesa pelo iFood. São mais de 500 mil reservas de mesa por mês na operação atual.",
  },
  {
    step: "03",
    title: "Chegada",
    copy: "Totem e check-in no salão. Em testes, a espera em fila caiu até 30 minutos.",
  },
  {
    step: "04",
    title: "Consumo",
    copy: "A experiência no local ainda depende do restaurante: cardápio, comanda e conta seguem no fluxo tradicional do salão.",
  },
  {
    step: "05",
    title: "Retorno",
    copy: "Depois da visita, a Reserva oferece CRM, marketing, avaliações e Giftback para fidelizar e medir satisfação.",
  },
] as const;

const TODAY_STATS = [
  {
    value: "65 mi",
    label: "Usuários do iFood (base para converter em visita)",
  },
  {
    value: "2,5 → 5 mi",
    label: "Meta de usuários ativos do Comer Fora até 2028",
  },
  {
    value: "20%",
    label: "Restaurantes ativos que divulgam Comer Fora no salão",
  },
  {
    value: "75%",
    label: "Dos ~400 mil parceiros operam só com delivery",
  },
] as const;

const JOURNEY_2 = [
  {
    step: "01",
    title: "Descoberta na jornada do delivery",
    copy: "No fluxo que o user já usa para pedir: oferta de mesa, benefício e redirecionamento para Comer Fora - sem passar pelo Perfil.",
  },
  {
    step: "02",
    title: "Pedido antecipado",
    copy: "Escolha os pratos antes de sair. A cozinha inicia perto do horário da mesa.",
  },
  {
    step: "03",
    title: "Check-in expresso",
    copy: "Chegou, validou no app e o prato vai à mesa - sem fila na porta.",
  },
  {
    step: "04",
    title: "Comanda & split",
    copy: "Consumo em tempo real e conta dividida entre amigos pelo iFood.",
  },
] as const;

const INTEL = [
  {
    title: "Concierge gastronômico",
    copy: "IA em linguagem natural com horários e benefícios reais. Sem inventar mesa ou desconto.",
  },
  {
    title: "Motor anti-churn",
    copy: "Detecta queda de visitas e dispara benefício personalizado para reconquistar o cliente.",
  },
  {
    title: "Rentabilidade protegida",
    copy: "Descontos com ticket mínimo e trava de margem. Promoção sem quebrar o salão.",
  },
] as const;

export function HomeExperience() {
  const { data, loading, error, bootstrap } = useDemoSession();
  const { dash } = useAnalyticsDashboard();
  const [techOpen, setTechOpen] = useState(false);

  const kpis = useMemo(() => {
    const gmv = dash?.kpis.gmvDeltaPct;
    const roi = dash?.kpis.roi;
    const newCf = dash?.kpis.newComerForaPct;
    return [
      {
        value: gmv != null ? `+${gmv}%` : "+35%",
        label: "GMV projetado na base sintética",
      },
      {
        value: "−40%",
        label: "Tempo ocioso na mesa (pré-pedido)",
      },
      {
        value: roi != null ? `${roi}×` : "1,1×",
        label: "ROI da campanha de benefícios",
      },
      {
        value: newCf != null ? `${newCf}%` : "~13%",
        label: "Novos no Comer Fora (conversão)",
      },
    ];
  }, [dash]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-48 animate-pulse rounded-if-lg bg-neutral-200" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-if-lg bg-neutral-100" />
          <div className="h-36 animate-pulse rounded-if-lg bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="if-card space-y-3 p-6 text-center">
        <p className="font-title text-lg font-extrabold">
          Não foi possível iniciar a demo
        </p>
        <p className="text-sm text-muted">{error}</p>
        <button
          type="button"
          className="if-btn-primary"
          onClick={() => void bootstrap()}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-14 sm:space-y-16">
      {/* 1 - Hero */}
      <section className="relative overflow-hidden rounded-if-lg bg-gradient-to-br from-[#1a1a1a] via-[#2a1518] to-ifood px-5 py-10 text-white shadow-if sm:px-8 sm:py-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,.2), transparent 40%), radial-gradient(circle at 85% 80%, rgba(0,0,0,.35), transparent 45%)",
          }}
        />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">
            Comer Fora · iFood
          </p>
          <h1 className="font-title mt-3 text-3xl font-extrabold leading-tight sm:text-4xl md:text-[2.65rem]">
            Comer Fora 2.0: da reserva à ocasião completa no salão
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            Hoje o Comer Fora existe - mas fica escondido no Perfil. A proposta
            é usar a jornada de delivery que o usuário já faz e redirecionar
            para a mesa: pré-pedido, comanda, split e inteligência na visita.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link
              href="/cliente"
              className="if-btn-primary bg-white text-ifood hover:bg-neutral-100"
            >
              Explorar visão do cliente
            </Link>
            <Link
              href="/parceiro"
              className="inline-flex items-center justify-center rounded-[var(--ifdl-radius-md)] border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              Explorar visão do restaurante
            </Link>
            <Link
              href="/cliente#concierge"
              className="inline-flex items-center justify-center rounded-[var(--ifdl-radius-md)] border border-white/35 bg-transparent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Testar Concierge IA
            </Link>
          </div>
        </div>
      </section>

      {/* 2 - Como funciona hoje (case) */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="font-title text-2xl font-extrabold text-ink sm:text-[1.75rem]">
            Como o Comer Fora funciona hoje
          </h2>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TODAY_JOURNEY.map((item, i) => (
            <li
              key={item.step}
              className="relative rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5"
            >
              <span className="font-title text-2xl font-extrabold text-neutral-300">
                {item.step}
              </span>
              {i < TODAY_JOURNEY.length - 1 && (
                <span
                  className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-neutral-300 lg:block"
                  aria-hidden
                />
              )}
              <h3 className="font-title mt-2 text-base font-extrabold text-ink">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {item.copy}
              </p>
            </li>
          ))}
        </ol>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TODAY_STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-page/80 px-4 py-4 text-center"
            >
              <p className="font-title text-xl font-extrabold text-ink sm:text-2xl">
                {s.value}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold leading-snug text-muted">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3 - O salto */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="font-title text-2xl font-extrabold text-ink sm:text-[1.75rem]">
            O salto de valor
          </h2>
          <p className="mt-1 text-sm text-muted">
            Tirar o Comer Fora do fundo do Perfil e encaixá-lo na jornada que o
            usuário já faz no delivery - além de fechar a ocasião no salão.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-5 shadow-[var(--ifdl-shadow-card)] sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
              Hoje · Comer Fora
            </p>
            <h3 className="font-title mt-2 text-lg font-extrabold text-ink">
              Produto bom, distribuição fraca
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted">
              <li className="flex gap-2">
                <span className="mt-0.5 text-neutral-400">–</span>
                Sessão escondida: Perfil → Explorar restaurantes
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-neutral-400">–</span>
                Pouco incentivo alinhado ao perfil do usuário (ocasião, grupo,
                horário)
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-neutral-400">–</span>
                Não intercepta a jornada de delivery que o user já faz
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-neutral-400">–</span>
                Consumo e conta ainda fora do fluxo iFood
              </li>
            </ul>
          </article>
          <article className="rounded-if-lg border border-ifood/25 bg-ifood-soft/40 p-5 shadow-[var(--ifdl-shadow-card)] sm:p-6">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-ifood">
              Proposta · Comer Fora 2.0
            </p>
            <h3 className="font-title mt-2 text-lg font-extrabold text-ink">
              Entra na jornada do delivery
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-ink/80">
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ifood">+</span>
                Usa a busca, o restaurante e o momento do pedido que o user já
                faz - e redireciona para Comer Fora quando faz sentido sair
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ifood">+</span>
                Reserva inteligente + pré-pedido na mesma intenção
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ifood">+</span>
                Comanda digital e split no app
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-ifood">+</span>
                Concierge IA e descoberta cultural da cidade
              </li>
            </ul>
          </article>
        </div>
      </section>

      {/* 4 - Jornada 2.0 */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="font-title text-2xl font-extrabold text-ink sm:text-[1.75rem]">
            Como o 2.0 funciona na prática
          </h2>
          <p className="mt-1 text-sm text-muted">
            Quatro passos da descoberta ao split - fechando o que ainda falta
            entre a reserva e o retorno.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {JOURNEY_2.map((item, i) => (
            <li
              key={item.step}
              className="relative rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-4 shadow-[var(--ifdl-shadow-card)] sm:p-5"
            >
              <span className="font-title text-2xl font-extrabold text-ifood/25">
                {item.step}
              </span>
              {i < JOURNEY_2.length - 1 && (
                <span
                  className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-ifood/30 xl:block"
                  aria-hidden
                />
              )}
              <h3 className="font-title mt-2 text-base font-extrabold text-ink">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {item.copy}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 5 - Inteligência */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="font-title text-2xl font-extrabold text-ink sm:text-[1.75rem]">
            Inteligência por trás da experiência
          </h2>
          <p className="mt-1 text-sm text-muted">
            Dados do salão + IA com guarda. Sem alucinar mesa ou preço.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {INTEL.map((card) => (
            <article
              key={card.title}
              className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white p-5 shadow-[var(--ifdl-shadow-card)]"
            >
              <div className="mb-3 h-1 w-8 rounded-full bg-ifood" />
              <h3 className="font-title text-base font-extrabold text-ink">
                {card.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {card.copy}
              </p>
            </article>
          ))}
        </div>

        <div className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold text-ink transition hover:bg-page sm:px-5"
            aria-expanded={techOpen}
            onClick={() => setTechOpen((o) => !o)}
          >
            Ver detalhes técnicos
            <span className="text-muted" aria-hidden>
              {techOpen ? "−" : "+"}
            </span>
          </button>
          {techOpen && (
            <div className="space-y-4 border-t border-[var(--ifdl-color-border)] px-4 py-4 sm:px-5">
              <p className="text-xs leading-relaxed text-muted">
                Ground truth no Supabase (slots, capacidade, promo do
                restaurante). Claude só narra/ranqueia candidatos elegíveis.
                Guardrails pré e pós-LLM; fallback local se a IA falhar.
              </p>
              {data ? (
                <DiagnosisPanel data={data} />
              ) : (
                <p className="text-xs text-muted">
                  Diagnóstico da sessão carrega após o bootstrap da demo.
                </p>
              )}
              <Link
                href="/metricas"
                className="inline-block text-sm font-bold text-ifood"
              >
                Abrir painel analítico →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 6 - Impacto + CTA */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <h2 className="font-title text-2xl font-extrabold text-ink sm:text-[1.75rem]">
            Impacto projetado
          </h2>
          <p className="mt-1 text-sm text-muted">
            Números da demo sintética - para motivar a conversa, não auditoria.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div
              key={k.label}
              className="rounded-if-lg border border-[var(--ifdl-color-border)] bg-white px-4 py-5 text-center shadow-[var(--ifdl-shadow-card)]"
            >
              <p className="font-title text-3xl font-extrabold text-ifood">
                {k.value}
              </p>
              <p className="mt-2 text-[11px] font-semibold leading-snug text-muted">
                {k.label}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-if-lg bg-ifood px-5 py-8 text-center text-white shadow-if sm:px-8">
          <h2 className="font-title text-xl font-extrabold sm:text-2xl">
            Explore o protótipo agora
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-white/85">
            Cliente, parceiro e métricas - a jornada completa em telas
            navegáveis.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/cliente"
              className="if-btn-primary bg-white text-ifood hover:bg-neutral-100"
            >
              Ir para Cliente
            </Link>
            <Link
              href="/parceiro"
              className="inline-flex items-center justify-center rounded-[var(--ifdl-radius-md)] border border-white/40 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Ir para Parceiro
            </Link>
            <Link
              href="/metricas"
              className="inline-flex items-center justify-center rounded-[var(--ifdl-radius-md)] border border-white/40 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Ver métricas
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
