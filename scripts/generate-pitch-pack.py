# -*- coding: utf-8 -*-
"""Gera pacote executivo Comer Fora V2: DOCX técnico, DOCX roteiro/Q&A, PPTX 8min."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from pptx import Presentation
from pptx.dml.color import RGBColor as PRgb
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches as PInches
from pptx.util import Pt as PPt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "pitch"
ASSETS = OUT / "assets"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

IFOOD_RED = RGBColor(0xEA, 0x1D, 0x2C)
INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x66, 0x66, 0x66)

# Métricas sintéticas (média 3 seeds do audit-metrics) — demo
METRICS = {
    "base_users": 200,
    "new_cf_avg": 26,
    "new_cf_pct": 12.8,
    "gmv_delta_pct": 34.6,
    "margin_delta_pct": 25.9,
    "margin_delta_brl": 4919,
    "roi": 1.09,
    "lift_pp": 30.6,
    "partner_cf_delta": 2487,
    "partner_ben_delta": 643,
    "partner_rec_pp": 17.6,
    "occ_before": 51.2,
    "occ_after": 75.8,
}


def set_run(run, *, bold=False, size=11, color=INK, font="Calibri"):
    run.bold = bold
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.name = font
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), font)


def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        set_run(run, bold=True, size=18 if level == 1 else 14 if level == 2 else 12, color=IFOOD_RED if level == 1 else INK)
    return h


def add_para(doc, text, *, bold=False, size=11, color=INK, space_after=8):
    p = doc.add_paragraph()
    run = p.add_run(text)
    set_run(run, bold=bold, size=size, color=color)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    return p


def add_bullets(doc, items, *, size=11):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(item)
        set_run(run, size=size)
        p.paragraph_format.space_after = Pt(4)


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        run = p.add_run(h)
        set_run(run, bold=True, size=10, color=IFOOD_RED)
    for r_i, row in enumerate(rows):
        cells = table.rows[r_i + 1].cells
        for c_i, val in enumerate(row):
            cells[c_i].text = ""
            p = cells[c_i].paragraphs[0]
            run = p.add_run(str(val))
            set_run(run, size=10)
    doc.add_paragraph()
    return table


def make_charts():
    # 1) GMV / margem
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    labels = ["Antes", "Depois (estratégias)"]
    gmv = [100, 100 + METRICS["gmv_delta_pct"]]
    margem = [100, 100 + METRICS["margin_delta_pct"]]
    x = range(len(labels))
    w = 0.35
    ax.bar([i - w / 2 for i in x], gmv, w, label="GMV (índice)", color="#EA1D2C")
    ax.bar([i + w / 2 for i in x], margem, w, label="Margem líquida (índice)", color="#F5A623")
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels)
    ax.set_ylabel("Índice (base 100)")
    ax.set_title("Impacto sintético na base (média 3 seeds)")
    ax.legend(frameon=False)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    p1 = ASSETS / "chart_gmv_margin.png"
    fig.savefig(p1, dpi=160)
    plt.close(fig)

    # 2) Parceiro ocupação / recorrência
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    cats = ["Ocupação %", "Recorrência %"]
    trad = [METRICS["occ_before"], 23.6]
    cf = [METRICS["occ_after"], 23.6 + METRICS["partner_rec_pp"]]
    x = range(len(cats))
    w = 0.35
    ax.bar([i - w / 2 for i in x], trad, w, label="Tradicional", color="#A3A3A3")
    ax.bar([i + w / 2 for i in x], cf, w, label="Comer Fora + benefícios", color="#EA1D2C")
    ax.set_xticks(list(x))
    ax.set_xticklabels(cats)
    ax.set_title("Visão do restaurante — ocupação e recorrência (sintético)")
    ax.legend(frameon=False)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    p2 = ASSETS / "chart_partner.png"
    fig.savefig(p2, dpi=160)
    plt.close(fig)

    # 3) Mix de estratégias
    fig, ax = plt.subplots(figsize=(6.5, 3.6))
    mix = ["Cupom", "Giftback", "Prato grátis", "Nenhum"]
    vals = [137, 47, 15, 1]
    colors = ["#EA1D2C", "#F5A623", "#2BB673", "#A3A3A3"]
    ax.barh(mix, vals, color=colors)
    ax.set_xlabel("Usuários (aprox. seed médio / 200)")
    ax.set_title("Mix do otimizador (price_sensitivity + ROI)")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    p3 = ASSETS / "chart_mix.png"
    fig.savefig(p3, dpi=160)
    plt.close(fig)

    # 4) Funil jornada
    fig, ax = plt.subplots(figsize=(8, 2.8))
    stages = ["Descoberta", "Reserva", "Pré-pedido", "Check-in", "Comanda", "Split", "Retorno"]
    vals = [100, 72, 58, 48, 45, 32, 28]
    ax.plot(stages, vals, marker="o", color="#EA1D2C", linewidth=2.5)
    ax.fill_between(range(len(stages)), vals, alpha=0.12, color="#EA1D2C")
    ax.set_ylim(0, 110)
    ax.set_ylabel("Conversão relativa (ilustrativa)")
    ax.set_title("Funil Comer Fora 2.0 — jornada fechada")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    p4 = ASSETS / "chart_funnel.png"
    fig.savefig(p4, dpi=160)
    plt.close(fig)

    return {"gmv": p1, "partner": p2, "mix": p3, "funnel": p4}


def build_docx_part1(charts: dict):
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("iFood · Comer Fora 2.0")
    set_run(r, bold=True, size=26, color=IFOOD_RED)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(
        "Documento Técnico e Estratégico — Evolução do modelo presencial\n"
        "Pacote executivo · Case AI Builder · Dados sintéticos de demo"
    )
    set_run(r, size=11, color=MUTED)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = meta.add_run(
        "Classificação: uso interno de apresentação · Versão consolidada pós Feature Store (§7) e escopo V2 salão"
    )
    set_run(r, size=9, color=MUTED)
    doc.add_paragraph()

    # —— Cap 1 ——
    add_heading(doc, "1. Contextualização do Modelo Atual (“Comer Fora” no iFood)", 1)
    add_para(
        doc,
        "O Comer Fora nasce para conectar a base de delivery do iFood a uma experiência presencial: "
        "descobrir onde comer agora, garantir mesa e voltar ao restaurante com menos atrito do que o caminho espontâneo.",
    )
    add_heading(doc, "1.1 Proposta de valor atual", 2)
    add_bullets(
        doc,
        [
            "Descoberta contextual: ocasião, bairro, horário e capacidade real de mesa.",
            "Agendamento de mesa com confirmação e regras de disponibilidade (slots).",
            "Benefícios promocionais (cupom, cashback/giftback, experiências) para estimular a ida ao salão.",
            "Diagnóstico de decisão: vantagem financeira e tempo economizado vs. delivery (ETA − deslocamento − fila).",
            "Fila digital / percepção de espera: comunicação da fila típica do restaurante e atrito externo (chuva, trânsito).",
        ],
    )
    add_heading(doc, "1.2 Mecânica de descoberta e reserva", 2)
    add_para(
        doc,
        "No modelo base (Direção 1 — “Pra Hoje”), o consumidor informa a ocasião; um motor ranqueia restaurantes elegíveis "
        "com preço/horário/vaga vindos do banco (não inventados pela IA). A reserva consome capacidade via RPC transacional. "
        "A retenção leve pós-reserva usa preferências salvas e convites de retorno.",
    )
    add_heading(doc, "1.3 Lacunas do modelo atual", 2)
    add_bullets(
        doc,
        [
            "Funil incompleto após a reserva: chegada, consumo e pagamento ainda geram atrito no salão.",
            "Benefícios pouco calibrados por propensão real (RFM, NPS, atrito) — risco de canibalização e verba ineficiente.",
            "Parceiro (~75% só delivery no briefing fictício) não enxerga ROI claro de aderir ao presencial.",
            "Grupos grandes têm pouco incentivo progressivo e fricção alta para fechar a conta.",
        ],
    )

    # —— Cap 2 ——
    add_heading(doc, "2. Os Diferenciais do Novo Modelo (Proposta de Valor 2.0)", 1)
    add_para(
        doc,
        "A V2 fecha o funil Descoberta → Reserva → Pré-pedido → Chegada → Consumo → Pagamento → Retorno, "
        "com inteligência de incentivo e visibilidade B2B. Push e pagamento permanecem SIMULADOS na demo.",
    )
    doc.add_picture(str(charts["funnel"]), width=Inches(6.2))
    cap = doc.add_paragraph()
    r = cap.add_run("Figura 1 — Funil ilustrativo da jornada Comer Fora 2.0.")
    set_run(r, size=9, color=MUTED)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_heading(doc, "2.1 Pedido Antecipado (Pre-order)", 2)
    add_bullets(
        doc,
        [
            "Quando: após confirmar a reserva de mesa.",
            "O quê: seleção de pratos do cardápio antes da chegada.",
            "Notificação (simulada): próximo ao horário, aviso de início de preparo na cozinha.",
            "Check-in presencial: valida presença e libera entrega rápida à mesa — elimina a “fila pós-sentar”.",
            "Métricas: tempo mesa→primeiro prato; conversão reserva→check-in; no-show rate.",
        ],
    )
    add_heading(doc, "2.2 Comanda Digital Integrada", 2)
    add_bullets(
        doc,
        [
            "Substitui a comanda física: consumo em tempo real no app iFood.",
            "Adição de itens pós-chegada e pagamento in-app (simulado na demo).",
            "Métricas: ticket médio, itens adicionados pós-check-in, taxa de pagamento no app.",
        ],
    )
    add_heading(doc, "2.3 Divisão de Conta (Split Bill)", 2)
    add_bullets(
        doc,
        [
            "Titular compartilha a comanda via link/QR com convidados iFood na mesa.",
            "Modos: igualitário, por item consumido ou valor personalizado.",
            "Cada pagante quita a própria parte no app — reduz atrito social e tempo de fechamento.",
            "Métricas: % contas com split; tempo até 100% pago.",
        ],
    )
    add_heading(doc, "2.4 Benefícios Progressivos por Grupo", 2)
    add_bullets(
        doc,
        [
            "Quanto maior a mesa confirmada, maior o benefício — com ticket mínimo proporcional.",
            "Trava de margem: desconto só efetiva se o mínimo de check-ins da reserva for atingido.",
            "Alinhado a party_size_mode da Feature Store (1 / 2 / 4+).",
            "Métricas: party size médio; taxa de check-in completo; ROI com trava de gasto.",
        ],
    )
    add_heading(doc, "2.5 Novas Interfaces", 2)
    add_para(doc, "Visão do Cliente (/cliente)", bold=True)
    add_bullets(
        doc,
        [
            "Recomendações de alta conversão com benefício visível (culinária, horário, ROI do otimizador).",
            "Histórico de visitas com gatilho “Perdendo Interesse” e win-back por atrito (preço, demora, qualidade).",
            "Destaque de restaurante favorito e anti-churn quando a frequência cai.",
        ],
    )
    add_para(doc, "Visão do Restaurante (/parceiro)", bold=True)
    add_bullets(
        doc,
        [
            "KPIs: ocupação, ticket médio, permanência/giro, recorrência, margem média e lifetime margin da base.",
            "Comparativos: Comer Fora vs. operação tradicional; benefícios on vs. off.",
            "Canibalização estimada explícita nos cenários com benefício — evita métrica de vaidade.",
        ],
    )

    # —— Cap 3 ——
    add_heading(doc, "3. Arquitetura de Banco de Dados e Engenharia de Métricas", 1)
    add_para(
        doc,
        "A inteligência deixa de ser “inventada em memória” e passa a ser auditável na tabela synthetic_users "
        "(migration 007 — Feature Store). O motor analítico (RFM + PCA/K-Means), o strategyOptimizer e as telas "
        "de cliente/parceiro leem essas colunas para calibrar incentivo, win-back e ROI.",
    )
    add_table(
        doc,
        ["Feature", "Tipo", "Aplicação estratégica"],
        [
            ["preferred_cuisine", "Categórica", "Vitrine, pré-pedido e prato grátis alinhados ao gosto real"],
            ["preferred_hour_slot", "Faixa horária", "Ofertas em janelas low-demand / ociosidade de mesa"],
            ["price_sensitivity", "0.0–1.0", "Cupom vs giftback/prato — elimina chute por arquétipo"],
            ["coupon_redemption_rate_90d", "%", "Propensão real a converter com estímulo (RFM)"],
            ["last_nps_score + last_sentiment", "Score + label", "Prioriza reativação e tom da mensagem"],
            ["friction_reason", "preço/demora/qualidade/nenhum", "Win-back com mecânica certa para o atrito"],
            ["party_size_mode", "1 / 2 / 4+", "Progressivo e split bill mais assertivos"],
            ["comer_fora_visits_90d", "Inteiro", "Separa “já usa CF” de “só delivery” (conversão)"],
            ["favorite_restaurant_id", "UUID nullable", "Âncora de histórico e alerta anti-churn no favorito"],
            ["lifetime_margin_brl / avg_margin_pct", "R$ / %", "ROI e canibalização reais no dashboard parceiro"],
        ],
    )
    add_heading(doc, "3.1 Camadas de decisão", 2)
    add_bullets(
        doc,
        [
            "Sessão: time_saved_min = ETA delivery − (deslocamento + fila); vantagem financeira = promo salão + taxa delivery.",
            "Otimizador: escolhe cupom, giftback, prato grátis ou nenhum por lift − custo − canibalização; cupom gated (≤25% do ticket mínimo).",
            "Clusters de negócio: VIP orgânico, sensível a preço, risco de churn, novo/ocasional — prior, não regra fixa.",
        ],
    )
    doc.add_picture(str(charts["mix"]), width=Inches(5.8))
    cap = doc.add_paragraph()
    r = cap.add_run("Figura 2 — Mix típico de estratégias após Feature Store (demo sintética).")
    set_run(r, size=9, color=MUTED)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # —— Cap 4 ——
    add_heading(doc, "4. Resultados Projetados, Gráficos e Conclusão", 1)
    add_para(
        doc,
        "Números abaixo são sintéticos e determinísticos por seed (audit da demo com 200 personas). "
        "Servem para provar direção de valor e narrativa de ROI — não são forecast de produção.",
        size=10,
        color=MUTED,
    )
    add_table(
        doc,
        ["Indicador", "Resultado (média 3 seeds)", "Leitura executiva"],
        [
            ["Novos no Comer Fora", f"{METRICS['new_cf_avg']} usuários ({METRICS['new_cf_pct']}%)", "Conversão delivery → presencial"],
            ["Δ GMV", f"+{METRICS['gmv_delta_pct']}%", "Lift de gasto sob estratégias"],
            ["Δ Margem líquida", f"+R$ {METRICS['margin_delta_brl']:,} (+{METRICS['margin_delta_pct']}%)".replace(",", "."), "Lucro, não vaidade"],
            ["ROI campanha", f"{METRICS['roi']}x", "Incremental vs. custo de benefício"],
            ["Lift vs controle", f"+{METRICS['lift_pp']} pp", "Efeito além do baseline orgânico"],
            ["Parceiro Δ margem CF", f"+R$ {METRICS['partner_cf_delta']}/mês", "Argumento de adesão B2B"],
            ["Ocupação", f"{METRICS['occ_before']}% → {METRICS['occ_after']}%", "Mesas ociosas viram receita"],
            ["Recorrência parceiro", f"+{METRICS['partner_rec_pp']} pp", "Retenção no salão"],
        ],
    )
    doc.add_picture(str(charts["gmv"]), width=Inches(6.0))
    cap = doc.add_paragraph()
    r = cap.add_run("Figura 3 — GMV e margem (índice 100) antes vs. depois das estratégias.")
    set_run(r, size=9, color=MUTED)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_picture(str(charts["partner"]), width=Inches(6.0))
    cap = doc.add_paragraph()
    r = cap.add_run("Figura 4 — Ocupação e recorrência: tradicional vs. Comer Fora + benefícios.")
    set_run(r, size=9, color=MUTED)
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

    add_heading(doc, "4.1 Conclusão estratégica", 2)
    add_para(
        doc,
        "O Comer Fora 2.0 transforma o iFood de “marketplace de mesa” em sistema operacional do jantar presencial: "
        "prepara a cozinha, reduz fila, fecha a conta no app, reativa quem está saindo e prova margem ao parceiro. "
        "A Feature Store é o diferencial estrutural — incentivos deixam de ser genéricos e passam a ser mensuráveis, "
        "protegendo ROI do ecossistema (plataforma + restaurante + consumidor).",
    )
    add_bullets(
        doc,
        [
            "Escalabilidade: mesmas features alimentam recomendação, pricing de incentivo, retenção e B2B analytics.",
            "Governança: travas de cupom, check-in obrigatório e margem explícita reduzem risco operacional.",
            "Próximo experimento: medir no-show no pré-pedido, % split pago e adesão parceiro além dos ~25% do briefing.",
        ],
    )
    add_para(
        doc,
        "Disclaimer: métricas, personas e restaurantes são sintéticos para o Case AI Builder. "
        "Pagamento e push são simulados na interface.",
        size=9,
        color=MUTED,
    )

    path = OUT / "Comer_Fora_V2_Documento_Tecnico_Estrategico.docx"
    doc.save(path)
    return path


def build_docx_part2():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("O que você vai falar — Pitch 8 min + Respostas prontas (Q&A)")
    set_run(r, bold=True, size=20, color=IFOOD_RED)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(
        "Texto em 1ª pessoa, pronto para ensaiar em voz alta. "
        "Troque de slide quando o bloco indicar. Meta de ensaio: ≤ 7:45."
    )
    set_run(r, size=11, color=MUTED)
    doc.add_paragraph()

    add_heading(doc, "Parte A — Fala completa do pitch (8 minutos)", 1)
    add_para(
        doc,
        "Como usar: ensaiar lendo em voz alta 2–3 vezes; no dia, ter o texto à mão só como rede de segurança. "
        "Os trechos entre [ ] são instruções de cena — não falar.",
        size=10,
        color=MUTED,
    )

    # Bloco 1
    add_para(doc, "0:00–1:00  ·  Slide 1 (Capa)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Olhar para a banca. Pausar 1 segundo. Começar.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "Boa tarde. Eu vou falar do Comer Fora 2.0 — a evolução do modelo presencial do iFood.",
    )
    add_para(
        doc,
        "Hoje o iFood já resolve muito bem levar comida até a casa da pessoa. "
        "O Comer Fora existe para fazer o caminho inverso: levar a pessoa até a mesa do restaurante. "
        "Só que, no modelo atual, o funil praticamente para na reserva. "
        "A pessoa descobre, agenda… e depois a experiência de chegar, consumir, pagar e voltar ainda é frágil.",
    )
    add_para(
        doc,
        "O que nós construímos fecha essa jornada: da descoberta até a conta paga no app, "
        "com incentivo inteligente e com prova de valor para o restaurante. "
        "Porque, no briefing do case, cerca de setenta e cinco por cento dos parceiros ainda operam só no delivery — "
        "e eles não vão aderir se não enxergarem mesa cheia e margem.",
    )
    add_para(
        doc,
        "Em oito minutos eu mostro o problema, o produto novo, a inteligência de dados e o impacto projetado na demo.",
    )

    # Bloco 2
    add_para(doc, "1:00–2:00  ·  Slide 2 (Cenário atual)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 2.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "No modelo atual, a proposta de valor já é clara: descobrir onde comer agora, garantir mesa, "
        "e usar cupom, cashback ou experiência para estimular a ida ao salão. "
        "A gente já calcula, por exemplo, quanto tempo a pessoa economiza agendando pelo iFood: "
        "é o ETA do delivery menos o deslocamento e menos a fila do restaurante. "
        "Se esse número é positivo, sair de casa faz sentido no eixo tempo.",
    )
    add_para(
        doc,
        "O problema é o que vem depois. Chegada sem preparo antecipado vira espera sentado. "
        "Comanda em papel atrasa. Dividir a conta vira briga de PIX. "
        "E o restaurante não vê, com clareza, se o Comer Fora melhorou ocupação e lucro — "
        "então a adesão trava. A oportunidade é três frentes: converter quem só pede delivery, "
        "encher mesa ociosa em horário fraco, e reativar quem está perdendo interesse no lugar favorito.",
    )

    # Bloco 3
    add_para(doc, "2:00–3:45  ·  Slide 3 (Funcionalidades)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 3. Apontar os quatro cards enquanto fala.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "A versão 2.0 fecha o funil com quatro pilares.",
    )
    add_para(
        doc,
        "Primeiro: pedido antecipado. Depois de reservar a mesa, a pessoa já escolhe os pratos. "
        "Perto do horário, o app avisa — na demo isso é simulado — que a cozinha começou o preparo. "
        "No local, o check-in confirma presença e libera a entrega rápida à mesa. "
        "A dor que a gente mata é a fila depois de sentar.",
    )
    add_para(
        doc,
        "Segundo: comanda digital integrada. O consumo aparece em tempo real no app do iFood. "
        "Dá para pedir mais item e pagar ali mesmo — na demo o pagamento também é simulado. "
        "Isso sobe ticket e reduz atrito com garçom e conta em papel.",
    )
    add_para(
        doc,
        "Terceiro: divisão de conta. O titular compartilha a comanda por link ou QR. "
        "O grupo divide igual, por item ou por valor personalizado, e cada um paga a sua parte. "
        "Mesa de amigos deixa de ser caos na hora de fechar.",
    )
    add_para(
        doc,
        "Quarto: benefício progressivo por tamanho do grupo. "
        "Quanto mais gente na reserva, maior o incentivo — mas o ticket mínimo sobe na mesma proporção. "
        "E o desconto só libera se o mínimo de check-ins da mesa for atingido. "
        "Ou seja: benefício só existe se o grupo aparecer. Isso protege cozinha e margem.",
    )

    # Bloco 4
    add_para(doc, "3:45–4:45  ·  Slide 4 (Cliente vs Parceiro)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 4.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "Do lado do cliente, a tela mostra recomendações com o benefício já visível — "
        "não é cupom escondido no rodapé. E tem o histórico de visitas: "
        "quando a recorrência cai ou o risco de churn sobe, a gente marca “Perdendo Interesse” "
        "e dispara um win-back alinhado ao motivo do atrito anterior — preço, demora ou qualidade. "
        "Se tem restaurante favorito, esse alerta fica ainda mais assertivo.",
    )
    add_para(
        doc,
        "Do lado do restaurante, o dashboard não vende vaidade. "
        "Mostra ocupação, ticket médio, tempo de permanência, recorrência, margem média "
        "e a margem lifetime da base. E compara cenários: com versus sem Comer Fora, "
        "e benefícios ligados versus desligados — inclusive com canibalização estimada. "
        "A mensagem para o parceiro é: a gente vende mesa cheia e margem auditável.",
    )

    # Bloco 5
    add_para(doc, "4:45–6:00  ·  Slide 5 (Feature Store)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 5.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "Por baixo disso tem uma Feature Store persistida na base de usuários sintéticos. "
        "A ideia é simples: parar de chutar incentivo por arquétipo genérico.",
    )
    add_para(
        doc,
        "Três colunas mudam o jogo na prática. "
        "Price sensitivity, de zero a um, decide se o perfil responde melhor a cupom direto ou a giftback e prato grátis. "
        "Friction reason, junto com NPS e sentimento, escolhe o tipo certo de reativação. "
        "E lifetime margin ou average margin percent sustentam o ROI de verdade — "
        "porque GMV sozinho mente.",
    )
    add_para(
        doc,
        "Tem também culinária preferida e faixa horária para vitrine e low-demand; "
        "party size mode para grupo; visitas Comer Fora em noventa dias para saber quem já é presencial "
        "e quem ainda é só delivery; e o ID do restaurante favorito para anti-churn. "
        "Essas mesmas colunas alimentam recomendação, otimizador de estratégia, retenção e o dashboard do parceiro. "
        "Um dado, quatro motores.",
    )

    # Bloco 6
    add_para(doc, "6:00–7:15  ·  Slide 6 (Resultados)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 6. Apontar os gráficos.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "Antes dos números, um disclaimer honesto: os dados da demo são sintéticos. "
        "Duzentas personas, seeds determinísticos. Não é forecast de produção — "
        "é prova de arquitetura e de direção de valor.",
    )
    add_para(
        doc,
        f"Na média dos testes, a margem líquida sobe cerca de {METRICS['margin_delta_pct']:.0f} por cento, "
        f"algo perto de R$ {METRICS['margin_delta_brl']:,}".replace(",", ".")
        + f" na base. O GMV sobe cerca de {METRICS['gmv_delta_pct']:.0f} por cento. "
        f"O ROI da campanha fica em torno de {METRICS['roi']} vezes. "
        f"Cerca de {METRICS['new_cf_pct']:.0f} por cento da base aparece como novos no Comer Fora — "
        "conversão de quem quase só usava delivery.",
    )
    add_para(
        doc,
        f"No painel do parceiro, a ocupação vai de cerca de {METRICS['occ_before']:.0f} para "
        f"{METRICS['occ_after']:.0f} por cento, a recorrência sobe cerca de {METRICS['partner_rec_pp']:.0f} pontos, "
        f"e o ganho de margem do cenário Comer Fora versus operação tradicional fica na casa de "
        f"R$ {METRICS['partner_cf_delta']:,}".replace(",", ".")
        + " por mês na simulação. "
        f"O lift versus controle é cerca de {METRICS['lift_pp']:.0f} pontos percentuais — "
        "ou seja, não é só “ligar promoção genérica”.",
    )

    # Bloco 7
    add_para(doc, "7:15–8:00  ·  Slide 7 (Fechamento)", bold=True, size=12, color=IFOOD_RED)
    add_para(doc, "[Trocar para o slide 7. Desacelerar. Fechar olhando a banca.]", size=10, color=MUTED, bold=True)
    add_para(
        doc,
        "Fechando: o Comer Fora 2.0 deixa de ser só “marketplace de mesa” "
        "e vira o sistema operacional do jantar presencial. "
        "Prepara a cozinha, reduz fila, fecha a conta no app, reativa quem está saindo "
        "e prova margem para quem ainda está só no delivery.",
    )
    add_para(
        doc,
        "Os próximos experimentos que eu priorizaria são três: "
        "medir no-show real no pré-pedido, medir quanto tempo leva para a mesa quitar o split, "
        "e medir adesão de parceiro além daquele patamar baixo do briefing. "
        "Se quiserem, na sequência eu mostro a demo ao vivo: reserva, pré-pedido, check-in, comanda e o painel do restaurante.",
    )
    add_para(
        doc,
        "Última frase: menos fila para o cliente, mais mesa e margem para o restaurante, "
        "mais valor presencial para o iFood. Obrigado — fico à disposição para as perguntas.",
    )

    # Contagem aproximada
    add_para(
        doc,
        "Dica de ritmo: se passar de 8:00, corte o detalhe do split e o terceiro número do parceiro; "
        "nunca corte o disclaimer nem a última frase.",
        size=10,
        color=MUTED,
    )

    add_heading(doc, "Parte B — O que responder na sabatina (texto pronto para falar)", 1)
    add_para(
        doc,
        "Respostas em 40–70 segundos. Fale assim. Se pedirem aprofundar, aí cite o módulo (otimizador, migration 007, etc.).",
        size=10,
        color=MUTED,
    )

    qa = [
        (
            "Como evitar prejuízo na cozinha se houver atraso ou no-show no pré-pedido?",
            "A gente não trata pré-pedido como “já pode fritar tudo”. "
            "O preparo só é sinalizado perto do horário, e a liberação para a mesa depende do check-in presencial. "
            "Em produção, eu adicionaria hold de cozinha, cancelamento automático sem check-in, "
            "e itens de alto desperdício só começando depois que a pessoa chegou. "
            "Além disso, o benefício progressivo só libera com o mínimo de check-ins — "
            "reserva fantasma não ganha desconto. Cozinha e margem ficam protegidas.",
        ),
        (
            "Como evitar canibalização do delivery?",
            "Primeiro: a própria sessão já compara tempo e dinheiro contra o delivery, "
            "então a gente só empurra Comer Fora quando faz sentido. "
            "Segundo: as ofertas miram ociosidade de mesa e horário fraco, não o pico do delivery. "
            "Terceiro: a feature de visitas Comer Fora em noventa dias separa quem já é presencial "
            "de quem é conversão incremental. "
            "E o otimizador desconta canibalização no ROI esperado. "
            "A meta não é roubar pedido de casa — é encher mesa que estaria vazia.",
        ),
        (
            "Por que essas features no modelo de churn?",
            "Porque churn de salão quase nunca é uma causa só. "
            "Pode ser preço, demora, qualidade ou fadiga de notificação. "
            "Por isso a gente guarda NPS, sentimento e o motivo do atrito — "
            "para não mandar cupom para quem reclamou de demora, por exemplo. "
            "O restaurante favorito mostra onde a queda de frequência dói mais. "
            "E a taxa de resgate de cupom em noventa dias diz se estímulo promocional ainda converte "
            "ou se é desperdício de verba.",
        ),
        (
            "Como proteger a margem do restaurante nos cupons progressivos?",
            "São três travas, e eu digo isso de propósito. "
            "Um: o ticket mínimo sobe junto com o benefício. "
            "Dois: o cupom passa por um gate — o desconto não pode comer a conta; "
            "fica limitado em torno de vinte e cinco por cento do mínimo e preserva margem residual. "
            "Três: sem check-in suficiente do grupo, o desconto não efetiva. "
            "E no dashboard a gente olha margem média e margem lifetime — não só GMV.",
        ),
        (
            "Os números do dashboard são reais?",
            "Não. São sintéticos, feitos para o case, com personas e seeds determinísticos. "
            "Eu deixo isso explícito de propósito. "
            "O que é real é a arquitetura: as features, as travas de margem e o otimizador "
            "estão prontos para receber dados verdadeiros depois. "
            "A demo prova o mecanismo, não um forecast de mercado.",
        ),
        (
            "Por que não só giftback para VIP?",
            "Porque VIP no nome do cluster não significa “sempre giftback”. "
            "O que manda é a sensibilidade a preço e o ROI esperado. "
            "Quem é pouco sensível tende a giftback ou prato grátis; "
            "quem é muito sensível tende a cupom. "
            "Cluster é prioridade, não regra cega. "
            "Assim a gente não queima margem dando desconto para quem já iria de qualquer forma.",
        ),
        (
            "Split bill não fragmenta ticket e atrasa o salão?",
            "Na prática é o contrário do caos do PIX. "
            "Cada um vê a parte dele e paga no app; o salão acompanha quem já quitou. "
            "A métrica que importa não é quantidade de cobranças — "
            "é tempo até a mesa estar cem por cento paga e percentual de contas com split. "
            "Menos atrito social, giro melhor.",
        ),
        (
            "Como a IA entra sem inventar preço ou vaga?",
            "Regra de ouro do produto: preço, horário e capacidade vêm do banco. "
            "A IA ranqueia e explica o motivo. Se a IA falhar ou bater limite de uso, "
            "a gente cai para fallback local — a reserva não quebra. "
            "O modelo não inventa mesa e não inventa desconto.",
        ),
        (
            "Qual o risco de over-promoção e fadiga?",
            "A gente já mede sequência de push ignorado e score de fadiga. "
            "Se passa do limiar, entra modo silencioso — especialmente para perfil avesso a insistência. "
            "E o otimizador pode escolher “nenhum benefício” quando o incentivo pago não se paga em margem. "
            "Promover menos, com mais precisão, é parte do desenho.",
        ),
        (
            "Como escalar para milhares de restaurantes?",
            "A Feature Store e o otimizador já são por usuário e por restaurante — escala horizontal. "
            "No B2B, o primeiro passo é prova de valor no dashboard; depois campanha self-serve. "
            "Na reserva, a gente já usa lock transacional de capacidade para não overbookar. "
            "O caminho não é reinventar o motor a cada cidade — é plugar catálogo e demanda locais nas mesmas features.",
        ),
        (
            "E se o grupo não completar o check-in do benefício progressivo?",
            "O desconto não libera. Ponto. "
            "Isso é feature, não bug: a comunicação na reserva deixa claro que o benefício depende da presença. "
            "Num experimento futuro dá para testar benefício parcial proporcional aos check-ins, "
            "mas a versão atual prioriza proteção de margem.",
        ),
        (
            "Qual o norte de produto em uma frase?",
            "Converter intenção de comer fora em mesa ocupada, conta paga no app e retorno mensurável — "
            "com incentivo eficiente e ROI visível para o parceiro.",
        ),
    ]
    for i, (q, a) in enumerate(qa, 1):
        add_para(doc, f"Se perguntarem: “{q}”", bold=True, size=11)
        add_para(doc, f"Você responde: {a}", size=11)

    add_heading(doc, "Antes de subir — checklist de 30 segundos", 2)
    add_bullets(
        doc,
        [
            "Disclaimer sintético: “números da demo não são forecast”.",
            "Três travas: ticket mínimo · gate do cupom · check-in.",
            "Caminho da demo na cabeça: reserva → pré-pedido → visita → comanda → cliente → parceiro.",
            "Última frase memorizada sem olhar o papel.",
        ],
    )

    path = OUT / "Comer_Fora_V2_Roteiro_Pitch_e_QA.docx"
    doc.save(path)
    return path


def add_slide_title(prs, title, subtitle=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    # bar
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, PInches(0), PInches(0), PInches(13.333), PInches(0.12)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = PRgb(0xEA, 0x1D, 0x2C)
    shape.line.fill.background()

    box = slide.shapes.add_textbox(PInches(0.7), PInches(0.45), PInches(12), PInches(0.8))
    tf = box.text_frame
    tf.clear()
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = title
    run.font.size = PPt(28)
    run.font.bold = True
    run.font.color.rgb = PRgb(0x1A, 0x1A, 0x1A)
    run.font.name = "Calibri"

    if subtitle:
        box2 = slide.shapes.add_textbox(PInches(0.7), PInches(1.15), PInches(12), PInches(0.5))
        tf2 = box2.text_frame
        p2 = tf2.paragraphs[0]
        run2 = p2.add_run()
        run2.text = subtitle
        run2.font.size = PPt(14)
        run2.font.color.rgb = PRgb(0x66, 0x66, 0x66)
        run2.font.name = "Calibri"
    return slide


def add_bullets_slide(slide, bullets, left=0.7, top=1.8, width=11.5, size=16):
    box = slide.shapes.add_textbox(PInches(left), PInches(top), PInches(width), PInches(5.2))
    tf = box.text_frame
    tf.word_wrap = True
    for i, b in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = b
        p.level = 0
        p.font.size = PPt(size)
        p.font.color.rgb = PRgb(0x1A, 0x1A, 0x1A)
        p.font.name = "Calibri"
        p.space_after = PPt(10)


def build_pptx(charts: dict):
    prs = Presentation()
    prs.slide_width = PInches(13.333)
    prs.slide_height = PInches(7.5)

    # 1 Capa
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bg = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, PInches(0), PInches(0), PInches(13.333), PInches(7.5)
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = PRgb(0x14, 0x14, 0x14)
    bg.line.fill.background()
    accent = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, PInches(0), PInches(0), PInches(0.18), PInches(7.5)
    )
    accent.fill.solid()
    accent.fill.fore_color.rgb = PRgb(0xEA, 0x1D, 0x2C)
    accent.line.fill.background()
    box = slide.shapes.add_textbox(PInches(0.9), PInches(2.2), PInches(11), PInches(1))
    p = box.text_frame.paragraphs[0]
    run = p.add_run()
    run.text = "iFood · Comer Fora 2.0"
    run.font.size = PPt(40)
    run.font.bold = True
    run.font.color.rgb = PRgb(0xFF, 0xFF, 0xFF)
    box2 = slide.shapes.add_textbox(PInches(0.9), PInches(3.3), PInches(11), PInches(1.2))
    p2 = box2.text_frame.paragraphs[0]
    run2 = p2.add_run()
    run2.text = "Da reserva à conta paga — com inteligência de incentivo e ROI para o salão"
    run2.font.size = PPt(18)
    run2.font.color.rgb = PRgb(0xCC, 0xCC, 0xCC)
    box3 = slide.shapes.add_textbox(PInches(0.9), PInches(6.4), PInches(11), PInches(0.4))
    p3 = box3.text_frame.paragraphs[0]
    run3 = p3.add_run()
    run3.text = "Pitch executivo · 8 minutos · Dados sintéticos de demo"
    run3.font.size = PPt(12)
    run3.font.color.rgb = PRgb(0x99, 0x99, 0x99)

    # 2 Cenário atual
    s = add_slide_title(prs, "2. Cenário atual e oportunidade", "O funil parava na reserva")
    add_bullets_slide(
        s,
        [
            "Hoje: descoberta + mesa + benefícios — mas chegada, consumo e pagamento ainda doem",
            "Já medimos tempo economizado: ETA delivery − (deslocamento + fila)",
            "Dor do parceiro: ~75% só delivery (briefing) · adesão presencial ainda baixa",
            "Oportunidade: converter base, encher low-demand, reter quem está perdendo interesse",
        ],
    )

    # 3 Funcionalidades
    s = add_slide_title(prs, "3. Novas funcionalidades", "Quatro pilares que fecham o funil")
    # four cards as text columns
    cards = [
        ("Pré-pedido", "Cardápio na reserva\nPreparo perto do horário\nCheck-in libera mesa"),
        ("Comanda digital", "Consumo em tempo real\nPagamento no app\nTicket sobe no salão"),
        ("Split Bill", "Igual · por item · valor\nLink / QR na mesa\nQuitação individual"),
        ("Cupom progressivo", "Mais gente → mais benefício\nTicket mínimo sobe\nSó com check-ins"),
    ]
    for i, (t, body) in enumerate(cards):
        left = 0.55 + i * 3.15
        shp = s.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE, PInches(left), PInches(1.9), PInches(3.0), PInches(4.4)
        )
        shp.fill.solid()
        shp.fill.fore_color.rgb = PRgb(0xFF, 0xF5, 0xF5)
        shp.line.color.rgb = PRgb(0xEA, 0x1D, 0x2C)
        tb = s.shapes.add_textbox(PInches(left + 0.15), PInches(2.1), PInches(2.7), PInches(4.0))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        run = p.add_run()
        run.text = t
        run.font.bold = True
        run.font.size = PPt(16)
        run.font.color.rgb = PRgb(0xEA, 0x1D, 0x2C)
        p2 = tf.add_paragraph()
        run2 = p2.add_run()
        run2.text = body
        run2.font.size = PPt(13)
        run2.font.color.rgb = PRgb(0x1A, 0x1A, 0x1A)

    # 4 Telas
    s = add_slide_title(prs, "4. Experiência: Cliente vs Restaurante", "Duas faces do mesmo valor")
    left_box = s.shapes.add_textbox(PInches(0.7), PInches(1.8), PInches(5.8), PInches(5))
    tf = left_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "Cliente (/cliente)"
    r.font.bold = True
    r.font.size = PPt(18)
    r.font.color.rgb = PRgb(0xEA, 0x1D, 0x2C)
    for line in [
        "• Recomendações com benefício visível",
        "• Histórico + “Perdendo Interesse”",
        "• Win-back por atrito (preço/demora/qualidade)",
        "• Favorito com alerta anti-churn",
    ]:
        pp = tf.add_paragraph()
        rr = pp.add_run()
        rr.text = line
        rr.font.size = PPt(15)

    right_box = s.shapes.add_textbox(PInches(7.0), PInches(1.8), PInches(5.8), PInches(5))
    tf = right_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    r = p.add_run()
    r.text = "Restaurante (/parceiro)"
    r.font.bold = True
    r.font.size = PPt(18)
    r.font.color.rgb = PRgb(0xEA, 0x1D, 0x2C)
    for line in [
        "• Ocupação · ticket · giro · recorrência",
        "• Margem média + lifetime margin",
        "• Com vs sem Comer Fora",
        "• Benefícios on vs off + canibalização",
    ]:
        pp = tf.add_paragraph()
        rr = pp.add_run()
        rr.text = line
        rr.font.size = PPt(15)

    # 5 Feature store
    s = add_slide_title(prs, "5. Inteligência de dados — Feature Store", "Incentivo auditável, não chute por arquétipo")
    add_bullets_slide(
        s,
        [
            "price_sensitivity → cupom vs giftback/prato",
            "friction_reason + NPS → win-back certo",
            "preferred_cuisine / hour_slot → vitrine e low-demand",
            "party_size_mode + CF visits → grupo e conversão delivery→salão",
            "lifetime_margin_brl / avg_margin_pct → ROI real no parceiro",
            "favorite_restaurant_id → anti-churn no vínculo mais forte",
        ],
        size=15,
    )

    # 6 Resultados
    s = add_slide_title(
        prs,
        "6. Resultados esperados (demo sintética)",
        f"ROI ~{METRICS['roi']}x · Δ margem +{METRICS['margin_delta_pct']}% · novos CF ~{METRICS['new_cf_pct']}%",
    )
    s.shapes.add_picture(str(charts["gmv"]), PInches(0.5), PInches(1.7), width=PInches(6.2))
    s.shapes.add_picture(str(charts["partner"]), PInches(6.9), PInches(1.7), width=PInches(6.0))
    note = s.shapes.add_textbox(PInches(0.7), PInches(6.7), PInches(12), PInches(0.4))
    p = note.text_frame.paragraphs[0]
    run = p.add_run()
    run.text = (
        f"Parceiro Δ margem CF ≈ R$ {METRICS['partner_cf_delta']}/mês · "
        f"Ocupação {METRICS['occ_before']}% → {METRICS['occ_after']}% · Lift vs controle +{METRICS['lift_pp']} pp"
    )
    run.font.size = PPt(12)
    run.font.color.rgb = PRgb(0x66, 0x66, 0x66)

    # 7 Conclusão
    s = add_slide_title(prs, "7. Conclusão e próximos passos", "Sistema operacional do jantar presencial")
    add_bullets_slide(
        s,
        [
            "Menos fila e conta mais simples para o cliente",
            "Mais ocupação e margem auditável para o restaurante",
            "Mais LTV presencial para o iFood — com verba de incentivo eficiente",
            "Próximos experimentos: no-show no pré-pedido · % split quitado · adesão parceiro >25%",
            "Demo: reserva → pré-pedido → check-in → comanda/split → /cliente → /parceiro",
        ],
        size=16,
    )

    path = OUT / "Comer_Fora_V2_Pitch_8min.pptx"
    prs.save(path)
    return path


def main():
    charts = make_charts()
    p1 = build_docx_part1(charts)
    p2 = build_docx_part2()
    p3 = build_pptx(charts)
    print("OK")
    print(p1)
    print(p2)
    print(p3)


if __name__ == "__main__":
    main()
